/* ═══════════════════════════════════════════════════════════════════
   ELIXIS · carrusel táctil de 3 pantallas (Enfoque / Avatar / Hilos)
   ═══════════════════════════════════════════════════════════════════
   Mecánica pura: no sabe qué hay dentro de cada pantalla, solo mueve la
   pista con el dedo y decide a cuál de las 3 quedarse pegado al soltar.
   Cada página (mdj-commander.html, staff.html) pone su propio contenido
   en los 3 huecos y llama a crear() una sola vez.

   Estructura esperada, ya con las clases puestas en el HTML -- OJO: los
   dots van DENTRO de .ew-carrusel, hermanos de .ew-carrusel-pista (si
   quedan afuera, querySelectorAll('.ew-dot') de aca abajo nunca los
   encuentra y el clic-para-navegar no hace nada -- bug real encontrado en
   vivo 2026-08-27, screenshot del PO mostrando la consola):
     <div class="ew-carrusel">
       <div class="ew-carrusel-pista">
         <div class="ew-pantalla">...pantalla -1...</div>
         <div class="ew-pantalla">...pantalla  0...</div>
         <div class="ew-pantalla">...pantalla +1...</div>
       </div>
       <div class="ew-dots"><span class="ew-dot"></span>×3</div>
     </div>

   ESCRITORIO (2026-08-27, "el trackpad dispara Back/Forward del navegador
   en vez de mover el carrusel"): un swipe de dos dedos en el trackpad de
   Mac NO es un touchstart/touchmove -- no hay pantalla tactil -- es un
   evento "wheel" con deltaX, y si nadie lo atrapa, Safari/Chrome lo
   interpretan como el gesto nativo de navegar atras/adelante. Se agregaron
   DOS mecanismos nuevos, aparte del touch de siempre:
   (a) wheel con deltaX dominante -> mueve la pista igual que un touchmove,
       con preventDefault() (ademas del overscroll-behavior-x en el CSS de
       la pagina, doble seguro contra la navegacion nativa).
   (b) PointerEvent (mouse/lapiz, filtrando pointerType==='touch' para no
       procesar el mismo toque dos veces en una pantalla tactil real) --
       para poder arrastrar los paneles con el clic sostenido del mouse. */
(function(){
  'use strict';

  /* Instancias activas (2026-08-27, soporte de escritorio -- teclado):
     crear() se llama de nuevo cada vez que la pantalla que aloja el
     carrusel se re-pinta (mdj-commander.html reconstruye el HTML del
     carrusel completo en cada render de esa pantalla) -- un listener de
     keydown agregado DENTRO de crear() se acumularia sin limite, uno mas
     por cada repintado, cada uno con su propio "raiz"/"ir" ya viejos. En
     vez de eso, un UNICO listener global (mas abajo) recorre esta lista y
     actua solo sobre la instancia cuyo "raiz" este REALMENTE visible en
     ese instante -- las demas (de pantallas que ya no se ven, o cuyo nodo
     ya fue reemplazado) se ignoran y se limpian de la lista de paso. */
  var instancias = [];

  function crear(raiz, opts){
    opts = opts || {};
    var pista = raiz.querySelector('.ew-carrusel-pista');
    var pantallas = raiz.querySelectorAll('.ew-pantalla');
    var dots = raiz.querySelectorAll('.ew-dot');
    if(!pista || !pantallas.length) return { ir:function(){}, actual:function(){return 1;} };

    var UMBRAL = opts.umbral || 50;
    var n = pantallas.length;
    var actual = (typeof opts.inicio === 'number') ? opts.inicio : 1;
    var startX=0, startY=0, arrastrando=false, esHorizontal=null, dx=0;

    function pos(i){ return -i*100/n; }
    function ir(i, animar){
      actual = Math.max(0, Math.min(n-1, i));
      pista.style.transition = (animar===false) ? 'none' : 'transform .32s cubic-bezier(.22,.61,.36,1)';
      pista.style.transform = 'translateX(' + pos(actual) + '%)';
      for(var k=0;k<dots.length;k++) dots[k].classList.toggle('activo', k===actual);
      if(flechaIzq) flechaIzq.disabled = (actual===0);
      if(flechaDer) flechaDer.disabled = (actual===n-1);
      if(typeof opts.onChange === 'function') opts.onChange(actual);
    }

    /* Nucleo compartido: touch, pointer (mouse/lapiz) y wheel arman su
       coordenada X/Y como puedan y llaman a estas tres. Antes esto estaba
       escrito tres veces (una por tipo de evento touch) -- factorizado para
       que agregar mouse/trackpad no significara triplicar la logica. */
    function inicioArrastre(x, y){
      startX=x; startY=y;
      arrastrando=true; esHorizontal=null; dx=0;
      pista.style.transition='none';
    }
    function moverArrastre(x, y, e){
      if(!arrastrando) return;
      var ddx=x-startX, ddy=y-startY;
      if(esHorizontal===null && (Math.abs(ddx)>6 || Math.abs(ddy)>6)){
        esHorizontal = Math.abs(ddx) > Math.abs(ddy);
      }
      /* Si el gesto es mas vertical que horizontal, se suelta: es el
         scroll normal de la transcripcion, no un cambio de pantalla. */
      if(esHorizontal===false) return;
      if(esHorizontal===true && e && e.cancelable) e.preventDefault();
      dx = ddx;
      pista.style.transform = 'translateX(calc(' + pos(actual) + '% + ' + dx + 'px))';
    }
    function finArrastre(){
      if(!arrastrando) return;
      arrastrando=false;
      if(esHorizontal){
        if(dx <= -UMBRAL) ir(actual+1);
        else if(dx >= UMBRAL) ir(actual-1);
        else ir(actual);
      } else {
        ir(actual);   /* sin cambio de pantalla: vuelve a su sitio sin animar de mas */
      }
    }

    /* Pantalla tactil real -- sin cambios de comportamiento respecto a la
       version anterior, solo llama al nucleo compartido de arriba. */
    raiz.addEventListener('touchstart', function(e){
      if(e.touches.length!==1) return;
      inicioArrastre(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive:true});
    raiz.addEventListener('touchmove', function(e){
      if(!arrastrando) return;
      moverArrastre(e.touches[0].clientX, e.touches[0].clientY, e);
    }, {passive:false});
    raiz.addEventListener('touchend', finArrastre);

    /* Mouse/lapiz con clic sostenido (2026-08-27) -- PointerEvent unifica
       mouse y lapiz; se descarta pointerType==='touch' a proposito porque
       en una pantalla tactil real ese mismo toque YA disparo touchstart
       arriba -- procesarlo dos veces duplicaria el arrastre. */
    var arrastrandoMouse = false;
    raiz.addEventListener('pointerdown', function(e){
      if(e.pointerType==='touch') return;
      arrastrandoMouse = true;
      inicioArrastre(e.clientX, e.clientY);
    });
    raiz.addEventListener('pointermove', function(e){
      if(!arrastrandoMouse || e.pointerType==='touch') return;
      moverArrastre(e.clientX, e.clientY, e);
    });
    function soltarMouse(){
      if(!arrastrandoMouse) return;
      arrastrandoMouse = false;
      finArrastre();
    }
    raiz.addEventListener('pointerup', soltarMouse);
    raiz.addEventListener('pointercancel', soltarMouse);
    raiz.addEventListener('pointerleave', soltarMouse); /* si suelta el clic fuera del carrusel, no se queda "pegado" arrastrando */

    /* Trackpad de Mac SIN clic (2026-08-27, "dispara Back/Forward del
       navegador") -- un swipe de dos dedos es un evento "wheel" con deltaX,
       no un touch ni un pointerdown. No hay un "fin de gesto" nativo como
       touchend, asi que se acumula el deltaX de una racha de eventos wheel
       muy seguidos y se decide al cabo de una pausa corta sin nuevos
       eventos (debounce). preventDefault() aca es la segunda barrera contra
       la navegacion nativa (la primera es overscroll-behavor-x:none en el
       CSS de la pagina que aloja el carrusel). */
    var wheelDX = 0, wheelTimer = null;
    raiz.addEventListener('wheel', function(e){
      if(Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; /* mas vertical que horizontal: no es este gesto */
      if(e.cancelable) e.preventDefault();
      if(!wheelTimer) pista.style.transition='none';
      wheelDX -= e.deltaX;
      pista.style.transform = 'translateX(calc(' + pos(actual) + '% + ' + wheelDX + 'px))';
      if(wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function(){
        var terminaDX = wheelDX;
        wheelDX = 0; wheelTimer = null;
        if(terminaDX <= -UMBRAL) ir(actual+1);
        else if(terminaDX >= UMBRAL) ir(actual-1);
        else ir(actual);
      }, 120);
    }, {passive:false});

    for(var k=0;k<dots.length;k++){
      (function(idx){ dots[idx].addEventListener('click', function(){ ir(idx); }); })(k);
    }

    /* Flechas laterales < / > (2026-08-28, pedido real: soporte de
       escritorio sin depender de gestos). El modulo las inyecta el mismo
       -- "mecanica pura, no sabe que hay dentro de cada pantalla", pero
       la navegacion en si es generica, no contenido de pantalla. Si la
       pagina ya trae sus propias flechas en el HTML (con estas clases),
       se reusan en vez de duplicarlas -- reintentar crear() sobre el
       mismo raiz (poco comun, pero mas seguro que asumir). Ocultas por
       CSS en pantallas tactiles reales (@media hover:hover and
       pointer:fine, ver mdj-commander.html/staff.html) -- en touch el
       gesto de arrastre ya cubre esto, un boton de mas ahi solo estorba. */
    var flechaIzq = raiz.querySelector('.ew-flecha-izq');
    var flechaDer = raiz.querySelector('.ew-flecha-der');
    if(!flechaIzq){
      flechaIzq = document.createElement('button');
      flechaIzq.type = 'button';
      flechaIzq.className = 'ew-flecha ew-flecha-izq';
      flechaIzq.setAttribute('aria-label', 'Anterior');
      flechaIzq.textContent = '‹';
      raiz.appendChild(flechaIzq);
    }
    if(!flechaDer){
      flechaDer = document.createElement('button');
      flechaDer.type = 'button';
      flechaDer.className = 'ew-flecha ew-flecha-der';
      flechaDer.setAttribute('aria-label', 'Siguiente');
      flechaDer.textContent = '›';
      raiz.appendChild(flechaDer);
    }
    flechaIzq.onclick = function(){ ir(actual-1); };
    flechaDer.onclick = function(){ ir(actual+1); };

    window.addEventListener('resize', function(){ ir(actual, false); });
    ir(actual, false);
    var instancia = { raiz:raiz, ir:ir, actual:function(){ return actual; } };
    instancias.push(instancia);
    return instancia;
  }

  /* Flechas de teclado (2026-08-28, mismo pedido de escritorio). UN solo
     listener global para toda la vida de la pagina -- ver el comentario
     de "instancias" arriba sobre por que no se agrega esto dentro de
     crear() (se acumularia un listener nuevo en cada repintado). Actua
     solo sobre la instancia cuyo raiz este REALMENTE visible ahora mismo
     (offsetParent!==null) -- si ninguna lo esta (el usuario esta en otra
     pantalla que no tiene carrusel), no hace nada. Se salta por completo
     si el foco esta en un input/textarea/campo editable, para no robarle
     las flechas a alguien escribiendo o moviendo el cursor de texto. */
  if(!window._ewKeydownGlobal){
    window._ewKeydownGlobal = true;
    document.addEventListener('keydown', function(e){
      if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
      var activo = document.activeElement;
      if(activo && (activo.tagName==='INPUT' || activo.tagName==='TEXTAREA' || activo.isContentEditable)) return;
      instancias = instancias.filter(function(inst){ return document.body.contains(inst.raiz); });
      var visible = null;
      for(var i=0;i<instancias.length;i++){
        if(instancias[i].raiz.offsetParent !== null){ visible = instancias[i]; break; }
      }
      if(!visible) return;
      e.preventDefault();
      visible.ir(visible.actual() + (e.key==='ArrowLeft' ? -1 : 1));
    });
  }

  window.ElixisSwipeCarousel = { crear:crear };
})();
