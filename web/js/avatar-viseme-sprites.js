/* ═══════════════════════════════════════════════════════════════════
   ELIXIS · sprites de boca por amplitud real ("viseme sprite engine")
   ═══════════════════════════════════════════════════════════════════
   QUE ES: en vez de deformar la foto (cancelado) o fingir con un video
   generico sin relacion con el audio (tambien cancelado), este motor
   elige entre FOTOGRAMAS REALES de la boca de ELIXIS -- cuantos mas,
   mas natural -- segun la amplitud REAL del audio que esta sonando en
   ese instante. Reusa el mismo "pulso" (RMS real, 0-1) que YA calculan
   RT.latir() en mdj-commander.html y latir() en elixis-voice-session.js
   para mover el anillo del boton -- no se inventa un analisis nuevo,
   solo se le busca ademas la foto mas parecida a ese nivel.

   HOY (2026-08-26) NO HAY FOTOGRAMAS TODAVIA. puedeIniciar() dice la
   verdad: false hasta que exista window.MDB_AVATAR_VISEMES con al menos
   2 fotogramas. Mientras tanto, pintarNivel() no hace nada -- la capa
   de sprites se queda en opacity:0 y lo que sea que este debajo (foto
   estatica o el clip de avatar-frame-player.js) se ve normal.

   Como conectar los fotogramas reales cuando existan (sin tocar
   mdj-commander.html ni staff.html otra vez):
     window.MDB_AVATAR_VISEMES = [
       { src:'/assets/elixis-boca-cerrada.png',  nivel:0    },
       { src:'/assets/elixis-boca-media.png',    nivel:0.35 },
       { src:'/assets/elixis-boca-redonda.png',  nivel:0.55 },
       { src:'/assets/elixis-boca-abierta.png',  nivel:0.85 },
       { src:'/assets/elixis-boca-sonrisa.png',  nivel:0.65, tipo:'sonrisa' }
       // cuantos mas fotogramas, con "nivel" repartido entre 0 y 1, mas
       // suave se ve -- no hace falta que esten parejos ni en este orden,
       // el motor siempre elige el mas cercano al nivel real del instante.
       // "tipo:'sonrisa'" es opcional: marca cual fotograma preferir cuando
       // fijarPreferenciaDesdeTexto() detecta tono amable (ver mas abajo).
     ];

   SOBRE "activar sonrisa con risas del audio" (pedido en la ORDEN del
   2026-08-27): NO esta implementado, y no lo voy a fingir con una regla
   inventada. Detectar risa de verdad en audio crudo es clasificacion de
   señal (distinguir la risa de la voz hablada por su forma de onda), no
   algo que se pueda aproximar de forma honesta con el analisis de
   amplitud que ya existe aqui -- eso mediria "fuerte" o "suave", nunca
   "risa" o "no risa". Lo que SI esta implementado y es real: preferir
   el fotograma 'sonrisa' cuando el TEXTO que ELIXIS esta diciendo (ya
   disponible en cada pagina) contiene saludo o tono amable -- ver
   fijarPreferenciaDesdeTexto() mas abajo.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  function frames(){ var f = window.MDB_AVATAR_VISEMES; return (f && f.length >= 2) ? f : null; }
  function puedeIniciar(){ return !!frames(); }

  /* Igual que avatar-frame-player.js: el montaje vive colgado del propio
     contenedor, para que sobreviva a que la pagina reconstruya el HTML
     del avatar y llamar a montar() de nuevo sobre el mismo nodo sea gratis. */
  function montar(contenedor){
    if(!contenedor) return null;
    if(contenedor._avs) return contenedor._avs;
    var img = contenedor.querySelector('[data-viseme]');
    if(!img) return null;
    contenedor._avs = { img: img, actual: null };
    return contenedor._avs;
  }

  /* Margen de histeresis: un nivel real oscila (es audio, no una rampa
     limpia). Sin esto, un valor que tiembla justo en el punto medio entre
     dos fotogramas los alterna cada cuadro -- un parpadeo real, medido:
     109 cambios en 200 cuadros oscilando +-0.03 en el limite, antes de
     este fix. Con margen, el fotograma actual se queda puesto salvo que
     el nuevo candidato sea claramente mejor, no apenas mejor. */
  var MARGEN_HISTERESIS = 0.06;

  /* Tono amable/saludo detectado en el TEXTO real que ELIXIS esta diciendo
     -- no en el audio. Lista corta a proposito: mejor no activar la sonrisa
     alguna vez de mas que activarla con cualquier palabra suelta. */
  var PATRON_AMABLE = /\b(bienvenid\w*|hola|buenas|gracias|genial|excelente|perfecto|un placer|qu[eé] bueno|me alegra|claro que s[ií]|por supuesto|dale)\b/i;

  function fijarPreferenciaDesdeTexto(m, texto){
    if(!m) return;
    m.prefiereSonrisa = !!(texto && PATRON_AMABLE.test(texto));
  }

  function frameSonrisa(){
    var f = frames();
    for(var i = 0; i < f.length; i++) if(f[i].tipo === 'sonrisa') return f[i];
    return null;
  }

  function masCercano(nivel, actual, prefiereSonrisa){
    var f = frames();
    var mejor = f[0], dist = Math.abs(f[0].nivel - nivel);
    for(var i = 1; i < f.length; i++){
      var d = Math.abs(f[i].nivel - nivel);
      if(d < dist){ dist = d; mejor = f[i]; }
    }
    if(prefiereSonrisa){
      var sonrisa = frameSonrisa();
      /* Solo se prefiere si el nivel real ya esta en un rango donde una
         sonrisa es creible -- nunca en silencio total ni en el pico mas
         abierto, para no forzarla donde no pega (ver punto 4 de la orden:
         "que acompañen de forma creible", no "siempre que el texto sea
         amable"). */
      if(sonrisa && Math.abs(sonrisa.nivel - nivel) < 0.25){
        mejor = sonrisa;
        dist = Math.abs(sonrisa.nivel - nivel);
      }
    }
    if(actual && actual !== mejor){
      var distActual = Math.abs(actual.nivel - nivel);
      if(distActual - dist < MARGEN_HISTERESIS) return actual;
    }
    return mejor;
  }

  /* Retencion minima: aunque el nivel ya justifique un cambio real (no es
     el caso de flicker en el limite, eso ya lo cubre la histeresis), un
     habla rapida puede pedir varios cambios legitimos en menos de 100ms.
     A esa velocidad el ojo humano no asimila cada cambio como forma de
     boca, lo lee como parpadeo. Retener el fotograma actual un minimo de
     tiempo, aunque el candidato sea mejor, lo vuelve legible. */
  var MIN_RETENCION_MS = 80;

  /* nivel: 0-1, el "pulso" real que ya calcula latir() en cada pagina.
     activo: true SOLO mientras ELIXIS esta hablando de verdad -- en
     escucha, el pulso es la voz del Capitan, no la boca de la foto. */
  function pintarNivel(m, nivel, activo){
    if(!m) return;
    if(!activo || !puedeIniciar()){
      m.img.style.opacity = '0';
      return;
    }
    var elegido = masCercano(Math.max(0, Math.min(1, nivel || 0)), m.actual, m.prefiereSonrisa);
    m.img.style.opacity = '1';
    if(elegido === m.actual) return;
    var ahora = Date.now();
    if(m.ultimoCambio && (ahora - m.ultimoCambio) < MIN_RETENCION_MS) return;
    m.actual = elegido;
    m.ultimoCambio = ahora;
    m.img.src = elegido.src;
  }

  window.AvatarVisemeSprites = {
    puedeIniciar: puedeIniciar,
    montar: montar,
    pintarNivel: pintarNivel,
    fijarPreferenciaDesdeTexto: fijarPreferenciaDesdeTexto
  };
})();
