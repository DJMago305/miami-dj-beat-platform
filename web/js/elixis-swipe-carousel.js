/* ═══════════════════════════════════════════════════════════════════
   ELIXIS · carrusel táctil de 3 pantallas (Enfoque / Avatar / Hilos)
   ═══════════════════════════════════════════════════════════════════
   Mecánica pura: no sabe qué hay dentro de cada pantalla, solo mueve la
   pista con el dedo y decide a cuál de las 3 quedarse pegado al soltar.
   Cada página (mdj-commander.html, staff.html) pone su propio contenido
   en los 3 huecos y llama a crear() una sola vez.

   Estructura esperada, ya con las clases puestas en el HTML:
     <div class="ew-carrusel">
       <div class="ew-carrusel-pista">
         <div class="ew-pantalla">...pantalla -1...</div>
         <div class="ew-pantalla">...pantalla  0...</div>
         <div class="ew-pantalla">...pantalla +1...</div>
       </div>
       <div class="ew-dots"><span class="ew-dot"></span>×3</div>
     </div> */
(function(){
  'use strict';

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
      if(typeof opts.onChange === 'function') opts.onChange(actual);
    }

    raiz.addEventListener('touchstart', function(e){
      if(e.touches.length!==1) return;
      startX=e.touches[0].clientX; startY=e.touches[0].clientY;
      arrastrando=true; esHorizontal=null; dx=0;
      pista.style.transition='none';
    }, {passive:true});

    raiz.addEventListener('touchmove', function(e){
      if(!arrastrando) return;
      var t=e.touches[0], ddx=t.clientX-startX, ddy=t.clientY-startY;
      if(esHorizontal===null && (Math.abs(ddx)>6 || Math.abs(ddy)>6)){
        esHorizontal = Math.abs(ddx) > Math.abs(ddy);
      }
      /* Si el gesto es mas vertical que horizontal, se suelta: es el
         scroll normal de la transcripcion, no un cambio de pantalla. */
      if(esHorizontal===false) return;
      if(esHorizontal===true && e.cancelable) e.preventDefault();
      dx = ddx;
      pista.style.transform = 'translateX(calc(' + pos(actual) + '% + ' + dx + 'px))';
    }, {passive:false});

    raiz.addEventListener('touchend', function(){
      if(!arrastrando) return;
      arrastrando=false;
      if(esHorizontal){
        if(dx <= -UMBRAL) ir(actual+1);
        else if(dx >= UMBRAL) ir(actual-1);
        else ir(actual);
      } else {
        ir(actual);   /* sin cambio de pantalla: vuelve a su sitio sin animar de mas */
      }
    });

    for(var k=0;k<dots.length;k++){
      (function(idx){ dots[idx].addEventListener('click', function(){ ir(idx); }); })(k);
    }

    window.addEventListener('resize', function(){ ir(actual, false); });
    ir(actual, false);
    return { ir:ir, actual:function(){ return actual; } };
  }

  window.ElixisSwipeCarousel = { crear:crear };
})();
