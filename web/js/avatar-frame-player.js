/* ═══════════════════════════════════════════════════════════════════
   ELIXIS · reproductor de fotogramas por estado ("State-Machine Clip
   Engine") -- ver ORDEN "motor de avatar por fotogramas" del 2026-08-26.
   ═══════════════════════════════════════════════════════════════════
   QUE ES: reemplaza cualquier intento de deformar matematicamente una
   foto plana (parpadeo/visemas CSS, cancelados el mismo dia) por el
   cruce entre CLIPS DE VIDEO reales pregrabados, uno por estado --
   idle / listening / thinking / speaking -- con cross-fade de 200ms
   entre dos <video> superpuestos (capas "a"/"b"), para que nunca haya
   un corte a negro entre un clip y el siguiente.

   HOY (2026-08-26) NO HAY ARCHIVOS DE VIDEO TODAVIA EN /assets.
   puedeIniciar() dice la verdad: false hasta que exista
   window.MDB_AVATAR_CLIPS con al menos 'idle'. Mientras tanto,
   fijarEstado() no hace nada -- la foto estatica (<img class="avatar-fig">,
   ya en el DOM de cada pagina, sin ninguna animacion desde la limpieza
   del 2026-08-26) es el fallback real, no una demo a medias.

   Como conectar los clips reales cuando existan (sin tocar
   mdj-commander.html ni staff.html otra vez):
     window.MDB_AVATAR_CLIPS = {
       idle:      '/assets/elixis-idle.mp4',
       listening: '/assets/elixis-listening.mp4',
       thinking:  '/assets/elixis-thinking.mp4',
       speaking:  '/assets/elixis-speaking.mp4'
     };
   En cuanto ese objeto exista con 'idle' definido, puedeIniciar() pasa a
   true y el proximo cambio de estado ya cruza clips solo.

   NOTA HONESTA para quien conecte los clips reales: la primera vez que
   se reproduce un clip nunca antes cargado, el navegador puede tardar
   uno o dos fotogramas en decodificar antes de que se vea algo -- con
   los clips ya en cache (mismo clip reusado dentro de la misma sesion)
   el cruce es limpio. Precargar los 4 de entrada no se hizo aqui porque
   no hay archivos reales con que probarlo todavia.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* Mapa de los estados finos de la app (idle/listening/transcribing/
     understanding/confirmation/executing/speaking) a los 4 estados que
     pidio el ticket. Vive en un solo lugar para no repetir el mapeo en
     cada pagina que llama a este motor. */
  var MAPA_ESTADO = {
    idle: 'idle',
    listening: 'listening', transcribing: 'listening',
    understanding: 'thinking', confirmation: 'thinking', executing: 'thinking',
    speaking: 'speaking'
  };

  function clipsConfigurados(){ return window.MDB_AVATAR_CLIPS || null; }
  function puedeIniciar(){ var c = clipsConfigurados(); return !!(c && c.idle); }

  /* El montaje vive COLGADO DEL PROPIO CONTENEDOR (contenedor._afp), no en
     una variable de modulo: asi, si la pagina reconstruye el HTML del
     avatar (mdj-commander.html lo hace en cada render()), el contenedor
     viejo se va con su montaje viejo sin dejar un video fantasma sonando,
     y llamar a montar() de nuevo sobre el MISMO nodo vivo es gratis. */
  function montar(contenedor){
    if(!contenedor) return null;
    if(contenedor._afp) return contenedor._afp;
    var a = contenedor.querySelector('[data-capa="a"]');
    var b = contenedor.querySelector('[data-capa="b"]');
    if(!a || !b) return null;
    contenedor._afp = { a: a, b: b, activa: null, estado: null };
    return contenedor._afp;
  }

  function reproducirClip(m, nombre){
    var c = clipsConfigurados();
    if(!c || !c[nombre]) return;
    var entra = m.activa === 'a' ? m.b : m.a;
    var sale  = m.activa === 'a' ? m.a : m.b;
    if(entra.getAttribute('data-clip') !== nombre){
      entra.src = c[nombre];
      entra.setAttribute('data-clip', nombre);
    }
    /* Aparte de "data-clip" (la categoria) se guarda el archivo real --
       fijarEstado() lo usa para saber si dos categorias distintas apuntan
       al mismo video (2026-08-27: el mismo loop calmado para las 4), caso
       en el que NO hay que reiniciar. */
    entra.setAttribute('data-clip-file', c[nombre]);
    entra.currentTime = 0;
    /* La opacidad se sube RECIEN cuando play() confirma que arranco de
       verdad -- no apenas se lo pide. Antes se ponia opacity:1 en el mismo
       instante de llamar a play(), pero el navegador todavia no habia
       decodificado ni un cuadro real: se veia negro/vacio una fraccion de
       segundo y despues "saltaba" al contenido, un parpadeo real al
       arrancar (reportado en vivo, 2026-08-27). */
    var revelar = function(){
      entra.style.opacity = '1';
      if(sale) sale.style.opacity = '0';
    };
    var p = entra.play();
    if(p && p.then){
      p.then(revelar).catch(function(){ /* autoplay bloqueado: se queda en el fallback estatico */ });
    } else {
      revelar(); // navegador viejo sin promesa en play()
    }
    m.activa = m.activa === 'a' ? 'b' : 'a';
  }

  /* Si el estado pedido no tiene clip propio (hoy: todo menos 'idle'),
     apaga la capa activa en vez de dejarla pegada -- sin esto, el ultimo
     clip mostrado (ej. idle) se queda tapando la foto para siempre en
     cuanto se activa un solo clip, aunque el estado real ya sea otro. */
  function apagarClipActivo(m){
    if(!m.activa) return;
    var v = m.activa === 'a' ? m.a : m.b;
    if(v){ v.style.opacity = '0'; v.pause(); }
    m.activa = null;
  }

  /* Idempotente a proposito: cada pagina llama a esto en cada cambio de
     estado real sin preguntarse si ya estaba en ese estado -- el propio
     motor decide si hay algo que cruzar. */
  function fijarEstado(m, estadoApp){
    if(!m || !puedeIniciar()) return;
    var nombre = MAPA_ESTADO[estadoApp] || 'idle';
    if(nombre === m.estado) return;
    m.estado = nombre;
    var c = clipsConfigurados();
    if(!c || !c[nombre]){ apagarClipActivo(m); return; }
    /* Si la categoria cambia (ej. idle->speaking) pero las dos apuntan al
       MISMO archivo (2026-08-27: un solo loop calmado para las 4, pedido
       en vivo por el PO -- "parece vivo" sin necesitar 4 grabaciones
       reales), no hay nada que cruzar: seguir reproduciendo lo que ya
       esta sonando, sin reiniciar desde el fotograma 0 en cada cambio de
       estado real (eso se veria como un salto/tranco, no un loop vivo). */
    var activo = m.activa === 'a' ? m.a : (m.activa === 'b' ? m.b : null);
    if(activo && activo.getAttribute('data-clip-file') === c[nombre]) return;
    reproducirClip(m, nombre);
  }

  function detener(m){
    if(!m) return;
    [m.a, m.b].forEach(function(v){
      if(!v) return;
      v.pause(); v.style.opacity = '0';
      v.removeAttribute('data-clip'); v.removeAttribute('src');
      try{ v.load(); }catch(e){}
    });
    m.activa = null; m.estado = null;
  }

  window.AvatarFramePlayer = {
    puedeIniciar: puedeIniciar,
    montar: montar,
    fijarEstado: fijarEstado,
    detener: detener
  };
})();
