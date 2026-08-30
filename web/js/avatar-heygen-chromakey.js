/* ═══════════════════════════════════════════════════════════════════
   ELIXIS · recorte de pantalla verde en tiempo real (2026-08-27)
   ═══════════════════════════════════════════════════════════════════
   POR QUE: Katya (el avatar de LiveAvatar) es de los "green-screen studio
   avatars" del catalogo -- su fondo verde solido es a proposito, pensado
   para que el INTEGRADOR lo remueva del lado del cliente (confirmado
   contra la guia real: https://docs.liveavatar.com/docs/guides/change-
   background). La API de creacion de sesion no tiene ningun parametro de
   fondo/encuadre -- no hay forma de pedirselo al servidor, solo se puede
   recortar en el navegador.

   COMO: HSV por pixel via Canvas2D (mismo enfoque que el modulo de
   referencia oficial `chromaKey.ts`) -- convertir cada pixel a matiz/
   saturacion/valor, y si el matiz cae en el rango verde con suficiente
   saturacion, se pone su alpha en 0 (transparente). Lo que se ve detras
   del canvas (la red de particulas + fondo oscuro de la app) queda visible
   donde antes estaba el verde -- sin necesidad de pintar un fondo custom.

   RENDIMIENTO (advertencia real de la misma guia): getImageData + loop por
   pixel + putImageData es trabajo de CPU, no de GPU -- puede sufrir arriba
   de 720p en equipos modestos. Por eso el canvas de PROCESO se mantiene
   chico (MAX_LADO) aunque el canvas se vea grande en pantalla -- el
   navegador estira el bitmap ya recortado gratis (barato, es solo GPU),
   la parte cara (el recorte en si) nunca corre a una resolucion mayor de
   la necesaria. Si algun dia hace falta mas nitidez o pantallas mas
   grandes, la misma guia recomienda pasar esto a un shader de WebGL en
   vez de Canvas2D -- no se hizo aca porque no hay forma de probarlo en
   vivo desde este lado sin una sesion real de LiveAvatar.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* Valores por defecto tomados TAL CUAL de la guia oficial (no inventados):
     matiz 60-180 (verde amplio, cubre variaciones de iluminacion del
     estudio) con saturacion minima 0.10. Sin minValue (ver mas abajo) --
     esto NO cambia para HeyGen/Elixis, que nunca tuvo el problema descrito
     debajo y ya viene funcionando bien tal cual. */
  var OPCIONES_DEF = { minHue: 60, maxHue: 180, minSaturation: 0.10, threshold: 1.00 };
  var MAX_LADO = 480; /* lado mas largo del canvas de PROCESO -- ver nota de rendimiento arriba */

  /* minValue (2026-08-28, reintento calibrado del croma key de DJMago):
     rgbAHsv() ya devolvia "value" (el 3er elemento, brillo max(r,g,b)) pero
     aplicarChromaKey() lo ignoraba por completo -- solo miraba matiz+
     saturacion, tal cual la guia oficial. Eso fue la causa real del intento
     anterior que fallo en vivo (particulas colandose por el pelo, ruido en
     la chaqueta, revertido -- ver memoria de esa sesion): en H.264
     comprimido, las zonas MUY oscuras (chaqueta negra, pelo oscuro) generan
     ruido de matiz/saturacion que cae dentro del rango "verde" de forma
     intermitente, cuadro a cuadro.

     Analizado esta vez con los 123 frames completos del video candidato
     (no unos pocos puntos sueltos): el fondo verde real tiene brillo
     ~0.97 (muy alto), la chaqueta ~0.08 (muy bajo) -- una separacion
     enorme. Filtrando tambien por brillo minimo, la fraccion de pixeles
     con recorte INCONSISTENTE entre frames (el sintoma real del bug) bajo
     de 31.5% a 2.9% sobre el video completo. Sin este parametro (undefined),
     el comportamiento es IDENTICO al de antes -- por eso HeyGen, que nunca
     pasa minValue, no se ve afectado en nada. */

  /* zonaProtegida (2026-08-28, rotoscopia simplificada -- sugerencia real
     del PO: "se nota como un brillo moviendose zona de orejas"). Medido
     sobre los 394 frames del boomerang: en 236 de 394 (60%) la oreja
     derecha tiene pixeles con VERDE GENUINO tan intenso que caen dentro
     del rango "es fondo" -- ahi no alcanza con suprimirSpill (ese solo
     actua en pixeles que NO calificaron como fondo). El resultado real es
     que la oreja se recorta del todo en esos cuadros especificos y vuelve
     a aparecer en los siguientes -- eso ES el "brillo que se mueve": la
     red de particulas asomando a traves de la oreja de forma intermitente.
     Como la camara es fija, se puede proteger espacialmente en vez de solo
     por color -- una elipse (fraccion 0-1 del canvas, no pixeles fijos,
     para que funcione a cualquier resolucion real) donde el recorte NUNCA
     se aplica, sin importar que tan "verde" mida ese pixel ese cuadro en
     particular; dentro de la elipse solo corre suprimirSpill (limpia el
     tinte igual, pero nunca crea un agujero). Calculada midiendo el nucleo
     "nunca recortado en NINGUN frame" de la cabeza y reduciendolo 10% de
     margen de seguridad, para no proteger fondo real por error cerca del
     borde. Sin este campo (undefined), cero cambio de comportamiento. */
  function dentroDeElipse(px, py, ancho, alto, elipse){
    if(!elipse) return false;
    var dx = (px - elipse.cx*ancho) / (elipse.rx*ancho);
    var dy = (py - elipse.cy*alto) / (elipse.ry*alto);
    return (dx*dx + dy*dy) <= 1;
  }

  /* Recorta el fondo verde del contenido YA DIBUJADO en el canvas (ver
     dibujarCover). Muta el canvas in-place -- no devuelve nada nuevo. */
  function aplicarChromaKey(ctx, ancho, alto, opciones){
    var o = opciones || OPCIONES_DEF;
    var img = ctx.getImageData(0, 0, ancho, alto);
    var d = img.data;
    /* HSV calculado inline (2026-08-29, "contencion de CPU en movil"): antes
       rgbAHsv() devolvia un array [h,s,v] nuevo por cada pixel -- en un
       frame de 384x530 son ~200mil arrays descartables por fotograma, puro
       trabajo extra para el garbage collector sin cambiar el resultado.
       Mismo calculo exacto, verificado equivalente en 200k+ valores
       aleatorios + casos borde (negro/blanco/rgb puros) antes de aplicar. */
    for(var i=0; i<d.length; i+=4){
      var r=d[i], g=d[i+1], b=d[i+2];
      var rn=r/255, gn=g/255, bn=b/255;
      var max=Math.max(rn,gn,bn), min=Math.min(rn,gn,bn), delta=max-min;
      var h=0;
      if(delta!==0){
        if(max===rn) h=((gn-bn)/delta)%6;
        else if(max===gn) h=(bn-rn)/delta+2;
        else h=(rn-gn)/delta+4;
        h*=60; if(h<0) h+=360;
      }
      var s = max===0 ? 0 : delta/max;
      var esFondo = h>=o.minHue && h<=o.maxHue && s>=o.minSaturation &&
         (o.minValue===undefined || max>=o.minValue);
      if(esFondo && o.zonaProtegida){
        var idx = i/4;
        var px = idx % ancho, py = Math.floor(idx/ancho);
        if(dentroDeElipse(px, py, ancho, alto, o.zonaProtegida)) esFondo = false;
      }
      if(esFondo){
        d[i+3] = 0;
      } else if(o.suprimirSpill){
        /* suprimirSpill (2026-08-28, afinado a pedido del PO -- "se nota
           en orejas y cuello"): medido sobre los 394 frames del boomerang
           real, esos pixeles NO son ruido de compresion como en la
           chaqueta -- son verde GENUINO (saturacion ~0.7, brillo ~0.5),
           luz real del fondo reflejandose en el borde curvo/fino de la
           oreja. Subir umbrales no sirve: el pixel es tan "verde" en HSV
           como el fondo real, cualquier umbral que lo excluya tambien
           empezaria a dejar agujeros en el fondo de verdad. La tecnica
           estandar de la industria para esto es "spill suppression": no
           decidir transparente si/no, sino DESATURAR el tinte verde en los
           bordes -- si el canal verde supera el promedio de rojo/azul, se
           empuja hacia ese promedio. Quita el tinte sin crear agujeros.
           Sin este campo (undefined, el default), cero cambio de
           comportamiento -- HeyGen nunca lo pide. */
        var promedioRB = (r+b)/2;
        if(g > promedioRB){
          d[i+1] = Math.round(promedioRB + (g-promedioRB)*(1-o.suprimirSpill));
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* Dibuja el frame actual del video en el canvas replicando a mano
     "object-fit:cover; object-position:center top" -- un <canvas> no
     soporta object-fit (a diferencia de <video>/<img>), asi que el recorte
     hay que calcularlo aca, con la MISMA logica que ya usa el resto del
     avatar (ver .heygen-portal en mdj-commander.html: "cover" para no
     dejar huecos, "top" para no cortar la cara). */
  function dibujarCover(ctx, video, cw, ch, opciones){
    var vw = video.videoWidth, vh = video.videoHeight;
    if(!vw || !vh) return false;
    /* fraccionAncho (2026-08-28, zoom de 3 niveles a pedido del PO):
       "cover" normal escala por el eje que necesite MAS zoom (aca, casi
       siempre el alto, por lo vertical que es el marco del celular) --
       eso corta el ancho real del cuerpo/brazos si el video es horizontal.
       fraccionAncho, cuando viene definido (0 a 1), IGNORA ese calculo y
       fuerza a que esa fraccion del ANCHO del video ocupe exactamente cw
       -- deja ver mas cuerpo a los costados, a costa de desbordar (o dejar
       hueco) verticalmente. Sin este campo (undefined), el comportamiento
       es IDENTICO al cover normal de siempre -- no afecta a nadie que no
       lo pida explicitamente. */
    var escala = (opciones && opciones.fraccionAncho)
      ? cw / (vw * opciones.fraccionAncho)
      : Math.max(cw/vw, ch/vh);
    /* Math.ceil, no el numero crudo (2026-08-28): "cover" por definicion
       nunca deberia dejar hueco, pero vw*escala/vh*escala son decimales de
       punto flotante -- un redondeo hacia ABAJO de una fraccion de pixel
       (ej. 739.6 en vez de 740) deja un hueco real de sub-pixel en el
       borde inferior/lateral. Ese canvas se dibuja a una resolucion de
       PROCESO reducida (ver MAX_LADO) y despues el navegador lo ESTIRA con
       CSS al tamano real en pantalla -- un sub-pixel de hueco ahi se
       amplifica proporcionalmente al estirar, y se nota como una fina
       linea (reportado en vivo por el PO). Redondear hacia arriba
       garantiza dw/dh >= cw/ch siempre, sin excepcion. */
    var dw = Math.ceil(vw*escala), dh = Math.ceil(vh*escala);
    var dx = Math.round((cw-dw)/2);
    /* dy (2026-08-28, pedido en vivo sobre el zoom de 3 niveles): con
       fraccionAncho activo, dh puede quedar MENOR que ch (el "hueco" que
       revela la red de particulas, a proposito). Con dy=0 fijo, ese hueco
       caia siempre ABAJO -- el avatar se veia "flotando centrado arriba",
       sin relacion con el piso real de la pantalla. El PO lo pidio anclado
       al reves: al alejarse, el avatar tiene que quedar de pie cerca de
       donde termina la barra inferior, con el hueco (particulas) arriba,
       no en el medio. Math.max(0, ch-dh): cuando SI hay hueco (dh<ch),
       empuja el contenido hacia abajo para pegarlo al fondo del canvas;
       cuando NO hay hueco (dh>=ch, el nivel 0 de siempre), da 0 -- mismo
       "pegado arriba, prioriza no cortar la cara" de toda la vida, sin
       cambios ahi. */
    var dy = Math.max(0, ch-dh);
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(video, dx, dy, dw, dh);
    return true;
  }

  /* Elige que video dibujar este cuadro. Acepta un <video> solo (caso
     HeyGen: una sola fuente) o un array de <video> (caso DJMago local:
     avatar-frame-player.js cruza DOS capas -- data-capa="a"/"b" -- al
     cambiar de clip; se dibuja la que este mas visible ahora mismo,
     leyendo su opacidad real calculada, no data-capa a ciegas). */
  function elegirFuente(fuente){
    if(!fuente) return null;
    if(!Array.isArray(fuente)) return fuente;
    var mejor = null, mejorOpacidad = -1;
    fuente.forEach(function(v){
      if(!v) return;
      var op = parseFloat(getComputedStyle(v).opacity) || 0;
      if(op > mejorOpacidad){ mejorOpacidad = op; mejor = v; }
    });
    return mejorOpacidad > 0 ? mejor : null;
  }

  /* Arranca el bucle (requestAnimationFrame) que dibuja+recorta cada
     cuadro. "fuente" es un <video> o un array de <video> (ver
     elegirFuente). Devuelve una funcion para detenerlo -- llamarla SIEMPRE
     al cortar la sesion/desmontar, si no el bucle sigue vivo leyendo un
     video que ya no corresponde. */
  function iniciarChromaKey(fuente, canvas, opciones){
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var activo = true;
    var rafId = null;
    var cajaAnchoPrev = 0, cajaAltoPrev = 0;

    function ajustarResolucionSiHizoFalta(){
      var cajaAncho = canvas.clientWidth || MAX_LADO;
      var cajaAlto = canvas.clientHeight || MAX_LADO;
      if(cajaAncho===cajaAnchoPrev && cajaAlto===cajaAltoPrev) return;
      cajaAnchoPrev = cajaAncho; cajaAltoPrev = cajaAlto;
      var escalaProceso = Math.min(1, MAX_LADO / Math.max(cajaAncho, cajaAlto, 1));
      canvas.width = Math.max(1, Math.round(cajaAncho * escalaProceso));
      canvas.height = Math.max(1, Math.round(cajaAlto * escalaProceso));
    }

    function tick(){
      if(!activo) return;
      ajustarResolucionSiHizoFalta();
      var video = elegirFuente(fuente);
      if(video && video.readyState >= 2 && dibujarCover(ctx, video, canvas.width, canvas.height, opciones)){
        aplicarChromaKey(ctx, canvas.width, canvas.height, opciones);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height); /* nada que mostrar todavia -- no dejar el ultimo cuadro pegado */
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return function detener(){
      activo = false;
      if(rafId) cancelAnimationFrame(rafId);
      try{ ctx.clearRect(0, 0, canvas.width, canvas.height); }catch(e){}
    };
  }

  window.AvatarHeygenChromaKey = {
    OPCIONES_DEF: OPCIONES_DEF,
    iniciarChromaKey: iniciarChromaKey
  };
})();
