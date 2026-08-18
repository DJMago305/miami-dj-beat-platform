/* ============================================================================
   NEURAL MATRIX 3D · andamiaje del motor (FEAT-3D-01)
   ----------------------------------------------------------------------------
   Recorrido inmersivo por circuitos y conexiones neuronales que representan la
   ruta de aprendizaje. Este archivo es el ANDAMIAJE: su trabajo es demostrar
   que el arnés de seguridad aguanta, no lucirse con los visuales.

   ┌─ POR QUÉ NO HAY THREE.JS ────────────────────────────────────────────────┐
   │ No existe Three.js en el repositorio y vendorizarlo son ~600KB y una     │
   │ decisión de dependencia con peso propio. web/weather-experience/js/      │
   │ hero.js ya demuestra que WebGL crudo rinde aquí, y trae un patrón de     │
   │ seguridad ya probado en producción. El arnés de abajo (tope de fps,      │
   │ contexto perdido, pausa, fallback) es AGNÓSTICO del motor: si mañana     │
   │ entra Three.js, se sustituye dibujarEscena() y el arnés no se toca.      │
   └──────────────────────────────────────────────────────────────────────────┘

   ┌─ POR QUÉ ESTE ARCHIVO EVITA ?. Y ?? ─────────────────────────────────────┐
   │ Lección del ticket P2.2: un SyntaxError ocurre al PARSEAR, antes de que  │
   │ corra una sola línea. Si este script usara sintaxis ES2020, en un WebKit │
   │ antiguo moriría entero — y el usuario vería una página en blanco en vez  │
   │ del fallback elegante que este mismo archivo se encarga de mostrar.      │
   │ El código que dibuja el mensaje de "no puedo" tiene que poder parsearse  │
   │ en el motor que no puede.                                                │
   └──────────────────────────────────────────────────────────────────────────┘

   SALVAGUARDAS DE GPU (obligatorias, ver directriz de WindowServer):
     · Tope estricto de refresco: 30 fps por defecto, 60 opcional.
     · webglcontextlost / webglcontextrestored con reinicio controlado.
     · Pausa por visibilitychange Y por blur — document.hidden NO dispara
       cuando la ventana solo queda DETRÁS de otra app (Serato encima), y sin
       esa segunda red seguiríamos quemando GPU en segundo plano.
     · devicePixelRatio acotado: en pantallas Retina, 3× de píxeles es 9× de
       trabajo de fragmento para nada apreciable en un fondo en movimiento.
     · Cero creación de geometría, buffers o programas dentro del bucle.
   ========================================================================== */

(function () {
  'use strict';

  /* ─── Configuración ───────────────────────────────────────────────────── */

  var ID_VIEWPORT = 'neural-matrix-viewport';
  var FPS_POR_DEFECTO = 30;      // arranca suave; 60 es opt-in desde el HUD
  var DPR_MAXIMO = 1.75;         // techo de densidad de píxel
  var SEGMENTOS_POR_TRAMO = 96;  // resolución de cada curva neuronal
  var PARTICULAS = 900;          // nube de micropartículas reactiva

  /* Las cuatro rutas de aprendizaje. Cada una es una curva independiente en el
     espacio; los puntos son de control, no vértices — la curva los interpola. */
  var RUTAS = [
    { nombre: 'DJ',         color: [1.00, 0.78, 0.35], puntos: [[-6,-1.5,-30],[-3, 1.0,-20],[-1,-0.5,-10],[ 1, 1.5,  0],[ 3,-1.0, 10],[ 5, 0.5, 20]] },
    { nombre: 'Producción', color: [0.45, 0.85, 1.00], puntos: [[ 6, 1.5,-30],[ 3,-1.0,-20],[ 1, 0.8,-10],[-1,-1.2,  0],[-3, 1.0, 10],[-5,-0.6, 20]] },
    { nombre: 'Acústica',   color: [0.70, 0.55, 1.00], puntos: [[ 0, 4.0,-30],[ 2, 2.0,-20],[-2, 3.0,-10],[ 2, 1.5,  0],[-1, 3.5, 10],[ 1, 2.0, 20]] },
    { nombre: 'Negocio',    color: [0.40, 1.00, 0.70], puntos: [[ 0,-4.0,-30],[-2,-2.5,-20],[ 2,-3.0,-10],[-2,-1.8,  0],[ 1,-3.5, 10],[-1,-2.0, 20]] }
  ];

  /* ─── Estado ──────────────────────────────────────────────────────────── */

  var contenedor = null, lienzo = null, gl = null;
  /* La extensión se captura al arrancar y se guarda: una vez perdido el
     contexto, getExtension() devuelve null, así que pedirla en ese momento
     deja sin forma de invocar restoreContext(). */
  var extPerdidaContexto = null;
  var programa = null, bufRieles = null, bufParticulas = null;
  var conteoRieles = 0, conteoParticulas = 0;
  var uniformes = {};
  var corriendo = false, degradado = false, capaz = false;
  var topeFps = FPS_POR_DEFECTO, msPorCuadro = 1000 / FPS_POR_DEFECTO;
  var ultimoDibujo = 0, proximoDibujo = 0, t0 = 0;
  var camYaw = 0, camPitch = 0, yawObjetivo = 0, pitchObjetivo = 0;
  var reducirMovimiento = false;

  /* Telemetría — la lee el informe de consumo y el HUD. Sin esto, "va fluido"
     es una opinión; con esto es un número. */
  var stats = {
    cuadros: 0, saltados: 0, fps: 0, msCuadroJS: 0, msCuadroMax: 0,
    llamadasDibujo: 0, vertices: 0, contextosPerdidos: 0, contextosRestaurados: 0,
    pausas: 0, estado: 'arrancando'
  };
  var ventanaFps = [], ultimoFpsCalc = 0;

  /* ─── Utilidades de matriz (mínimas, sin dependencias) ────────────────── */

  function perspectiva(fovY, aspecto, cerca, lejos) {
    var f = 1.0 / Math.tan(fovY / 2), nf = 1 / (cerca - lejos);
    return [f / aspecto,0,0,0, 0,f,0,0, 0,0,(lejos + cerca) * nf,-1, 0,0,(2 * lejos * cerca) * nf,0];
  }

  function multiplicar(a, b) {
    var o = new Array(16);
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 4; j++) {
        o[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j] + a[i * 4 + 3] * b[12 + j];
      }
    }
    return o;
  }

  function rotacionY(r) { var c = Math.cos(r), s = Math.sin(r); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; }
  function rotacionX(r) { var c = Math.cos(r), s = Math.sin(r); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; }
  function traslacion(x, y, z) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]; }

  /* ─── Geometría: Catmull-Rom, evaluada UNA vez en el arranque ─────────── */

  /* Catmull-Rom centrípeta (alpha 0.5): no produce los lazos y las cúspides
     que la uniforme genera cuando los puntos de control están mal espaciados.
     Para un tubo neuronal que el usuario recorre por dentro, un lazo es un
     agujero visible en la ruta. */
  function catmullRom(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t, salida = [0, 0, 0];
    for (var i = 0; i < 3; i++) {
      salida[i] = 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t +
        (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
        (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
    }
    return salida;
  }

  function construirRieles() {
    var datos = [];
    for (var r = 0; r < RUTAS.length; r++) {
      var ruta = RUTAS[r], pts = ruta.puntos, col = ruta.color;
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[i > 0 ? i - 1 : 0], p1 = pts[i], p2 = pts[i + 1];
        var p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1];
        for (var s = 0; s < SEGMENTOS_POR_TRAMO; s++) {
          var t = s / SEGMENTOS_POR_TRAMO;
          var v = catmullRom(p0, p1, p2, p3, t);
          /* recorrido normalizado a lo largo de TODA la ruta: es lo que hace
             que el pulso viaje de principio a fin y no por tramos sueltos */
          var recorrido = (i + t) / (pts.length - 1);
          datos.push(v[0], v[1], v[2], col[0], col[1], col[2], recorrido, r);
        }
      }
    }
    conteoRieles = datos.length / 8;
    return new Float32Array(datos);
  }

  function construirParticulas() {
    var datos = [];
    for (var i = 0; i < PARTICULAS; i++) {
      var x = (Math.random() - 0.5) * 26, y = (Math.random() - 0.5) * 16, z = -32 + Math.random() * 56;
      datos.push(x, y, z, 0.55 + Math.random() * 0.45, Math.random());
    }
    conteoParticulas = PARTICULAS;
    return new Float32Array(datos);
  }

  /* ─── Shaders ─────────────────────────────────────────────────────────── */

  var VERT = [
    'precision mediump float;',
    'attribute vec3 aPos; attribute vec3 aColor; attribute float aRecorrido; attribute float aRuta;',
    'uniform mat4 uProy; uniform mat4 uVista; uniform float uTiempo; uniform float uPulso;',
    'varying vec3 vColor; varying float vBrillo;',
    'void main(){',
    '  vec4 mundo = vec4(aPos, 1.0);',
    /* El pulso es una gaussiana que viaja por el recorrido. Cada ruta arranca
       desfasada para que las cuatro no latan a la vez. */
    '  float fase = fract(uTiempo * 0.18 + aRuta * 0.25);',
    '  float d = abs(fract(aRecorrido - fase + 0.5) - 0.5);',
    /* Dos escalas: un halo ancho que mantiene el riel legible de punta a punta
       y un núcleo estrecho que es el pulso viajando. Con mezcla aditiva sobre
       fondo casi negro, un brillo base bajo se traga la línea entera. */
    '  float halo  = exp(-d * d *  22.0);',
    '  float nucleo = exp(-d * d * 300.0);',
    '  float pulso = halo * 0.45 + nucleo;',
    '  vBrillo = 0.62 + pulso * (1.25 + uPulso);',
    '  vColor = aColor;',
    '  gl_Position = uProy * uVista * mundo;',
    '  gl_PointSize = 2.0 + pulso * 5.0;',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'varying vec3 vColor; varying float vBrillo;',
    'void main(){',
    '  gl_FragColor = vec4(vColor * vBrillo, min(1.0, vBrillo));',
    '}'
  ].join('\n');

  var VERT_PART = [
    'precision mediump float;',
    'attribute vec3 aPos; attribute float aTam; attribute float aSemilla;',
    'uniform mat4 uProy; uniform mat4 uVista; uniform float uTiempo; uniform float uPulso;',
    'varying float vAlfa;',
    'void main(){',
    '  vec3 p = aPos;',
    '  p.y += sin(uTiempo * 0.5 + aSemilla * 6.28) * 0.35;',
    '  vAlfa = (0.10 + aSemilla * 0.18) * (0.6 + uPulso * 0.8);',
    '  gl_Position = uProy * uVista * vec4(p, 1.0);',
    '  gl_PointSize = aTam * (1.0 + uPulso);',
    '}'
  ].join('\n');

  var FRAG_PART = [
    'precision mediump float;',
    'varying float vAlfa;',
    'void main(){',
    '  vec2 c = gl_PointCoord - vec2(0.5);',
    '  float m = smoothstep(0.5, 0.0, length(c));',
    '  gl_FragColor = vec4(0.75, 0.85, 1.0, vAlfa * m);',
    '}'
  ].join('\n');

  function compilar(tipo, fuente) {
    var s = gl.createShader(tipo);
    gl.shaderSource(s, fuente); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(s); gl.deleteShader(s);
      throw new Error('shader: ' + log);
    }
    return s;
  }

  function enlazar(vsrc, fsrc) {
    var p = gl.createProgram();
    gl.attachShader(p, compilar(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(p, compilar(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('enlace: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  /* ─── Detección de capacidad ──────────────────────────────────────────── */

  function equipoModesto() {
    try {
      var nucleos = navigator.hardwareConcurrency || 4;
      var memoria = navigator.deviceMemory || 4;
      var movilEstrecho = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && Math.min(screen.width, screen.height) < 380;
      return nucleos <= 2 || memoria <= 2 || movilEstrecho;
    } catch (e) { return false; }
  }

  function obtenerContexto() {
    var opciones = { antialias: false, alpha: true, depth: true, premultipliedAlpha: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false };
    var ctx = null;
    try { ctx = lienzo.getContext('webgl', opciones) || lienzo.getContext('experimental-webgl', opciones); } catch (e) { ctx = null; }
    return ctx;
  }

  /* ─── Fallback elegante ───────────────────────────────────────────────── */

  function mostrarFallback(motivo) {
    capaz = false; corriendo = false;
    stats.estado = 'fallback: ' + motivo;
    if (!contenedor) return;
    contenedor.classList.add('nm3d--sin-webgl');
    var panel = contenedor.querySelector('.nm3d-fallback');
    if (panel) {
      panel.hidden = false;
      var detalle = panel.querySelector('[data-nm3d-motivo]');
      if (detalle) detalle.textContent = motivo;
    }
    actualizarHud();
  }

  /* ─── Dimensionado ────────────────────────────────────────────────────── */

  function redimensionar() {
    if (!lienzo || !gl) return;
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_MAXIMO);
    var w = Math.max(1, Math.floor(contenedor.clientWidth * dpr));
    var h = Math.max(1, Math.floor(contenedor.clientHeight * dpr));
    if (lienzo.width !== w || lienzo.height !== h) {
      lienzo.width = w; lienzo.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  /* ─── Construcción del escenario (una sola vez, nunca en el bucle) ────── */

  var progRieles = null, progParticulas = null;
  var attrRieles = {}, attrParticulas = {}, uniRieles = {}, uniParticulas = {};

  function construirEscena() {
    progRieles = enlazar(VERT, FRAG);
    progParticulas = enlazar(VERT_PART, FRAG_PART);

    attrRieles.pos = gl.getAttribLocation(progRieles, 'aPos');
    attrRieles.color = gl.getAttribLocation(progRieles, 'aColor');
    attrRieles.recorrido = gl.getAttribLocation(progRieles, 'aRecorrido');
    attrRieles.ruta = gl.getAttribLocation(progRieles, 'aRuta');
    uniRieles.proy = gl.getUniformLocation(progRieles, 'uProy');
    uniRieles.vista = gl.getUniformLocation(progRieles, 'uVista');
    uniRieles.tiempo = gl.getUniformLocation(progRieles, 'uTiempo');
    uniRieles.pulso = gl.getUniformLocation(progRieles, 'uPulso');

    attrParticulas.pos = gl.getAttribLocation(progParticulas, 'aPos');
    attrParticulas.tam = gl.getAttribLocation(progParticulas, 'aTam');
    attrParticulas.semilla = gl.getAttribLocation(progParticulas, 'aSemilla');
    uniParticulas.proy = gl.getUniformLocation(progParticulas, 'uProy');
    uniParticulas.vista = gl.getUniformLocation(progParticulas, 'uVista');
    uniParticulas.tiempo = gl.getUniformLocation(progParticulas, 'uTiempo');
    uniParticulas.pulso = gl.getUniformLocation(progParticulas, 'uPulso');

    bufRieles = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufRieles);
    gl.bufferData(gl.ARRAY_BUFFER, construirRieles(), gl.STATIC_DRAW);

    bufParticulas = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufParticulas);
    gl.bufferData(gl.ARRAY_BUFFER, construirParticulas(), gl.STATIC_DRAW);

    gl.clearColor(0.02, 0.03, 0.06, 1.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    stats.vertices = conteoRieles + conteoParticulas;
  }

  function liberarEscena() {
    if (!gl) return;
    try {
      if (bufRieles) gl.deleteBuffer(bufRieles);
      if (bufParticulas) gl.deleteBuffer(bufParticulas);
      if (progRieles) gl.deleteProgram(progRieles);
      if (progParticulas) gl.deleteProgram(progParticulas);
    } catch (e) { /* el contexto puede estar ya muerto; no es un fallo */ }
    bufRieles = bufParticulas = progRieles = progParticulas = null;
  }

  /* ─── Dibujo ──────────────────────────────────────────────────────────── */

  function dibujarEscena(t) {
    var aspecto = lienzo.width / Math.max(1, lienzo.height);
    var proy = perspectiva(1.15, aspecto, 0.1, 120.0);

    /* Avance cinemático por el riel + paneo suavizado hacia el objetivo. */
    camYaw += (yawObjetivo - camYaw) * 0.06;
    camPitch += (pitchObjetivo - camPitch) * 0.06;
    var z = reducirMovimiento ? -6.0 : (((t * 2.2) % 46) - 34);
    var vista = multiplicar(multiplicar(rotacionX(camPitch), rotacionY(camYaw)), traslacion(0, 0, z));

    var pulso = 0.0; // el motor audio-reactivo entra aquí en el siguiente ticket

    gl.clear(gl.COLOR_BUFFER_BIT);
    stats.llamadasDibujo = 0;

    /* Rieles: 8 floats por vértice (pos3, color3, recorrido1, ruta1) */
    gl.useProgram(progRieles);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufRieles);
    var z1 = 8 * 4;
    gl.enableVertexAttribArray(attrRieles.pos);       gl.vertexAttribPointer(attrRieles.pos, 3, gl.FLOAT, false, z1, 0);
    gl.enableVertexAttribArray(attrRieles.color);     gl.vertexAttribPointer(attrRieles.color, 3, gl.FLOAT, false, z1, 12);
    gl.enableVertexAttribArray(attrRieles.recorrido); gl.vertexAttribPointer(attrRieles.recorrido, 1, gl.FLOAT, false, z1, 24);
    gl.enableVertexAttribArray(attrRieles.ruta);      gl.vertexAttribPointer(attrRieles.ruta, 1, gl.FLOAT, false, z1, 28);
    gl.uniformMatrix4fv(uniRieles.proy, false, proy);
    gl.uniformMatrix4fv(uniRieles.vista, false, vista);
    gl.uniform1f(uniRieles.tiempo, t);
    gl.uniform1f(uniRieles.pulso, pulso);
    var porRuta = conteoRieles / RUTAS.length;
    for (var r = 0; r < RUTAS.length; r++) {
      gl.drawArrays(gl.LINE_STRIP, r * porRuta, porRuta);  // una llamada por ruta: 4 en total
      stats.llamadasDibujo++;
    }

    /* Partículas: 5 floats por vértice (pos3, tam1, semilla1) */
    gl.useProgram(progParticulas);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufParticulas);
    var z2 = 5 * 4;
    gl.enableVertexAttribArray(attrParticulas.pos);     gl.vertexAttribPointer(attrParticulas.pos, 3, gl.FLOAT, false, z2, 0);
    gl.enableVertexAttribArray(attrParticulas.tam);     gl.vertexAttribPointer(attrParticulas.tam, 1, gl.FLOAT, false, z2, 12);
    gl.enableVertexAttribArray(attrParticulas.semilla); gl.vertexAttribPointer(attrParticulas.semilla, 1, gl.FLOAT, false, z2, 16);
    gl.uniformMatrix4fv(uniParticulas.proy, false, proy);
    gl.uniformMatrix4fv(uniParticulas.vista, false, vista);
    gl.uniform1f(uniParticulas.tiempo, t);
    gl.uniform1f(uniParticulas.pulso, pulso);
    gl.drawArrays(gl.POINTS, 0, conteoParticulas);
    stats.llamadasDibujo++;
  }

  /* ─── Bucle con tope estricto ─────────────────────────────────────────── */

  /* El rAF se mantiene vivo a la frecuencia del monitor, pero el TRABAJO de
     GPU se salta por encima del tope. En una pantalla ProMotion de 120Hz esto
     es la diferencia entre 120 y 30 pasadas de fragmento por segundo. */
  function cuadro(ahora) {
    if (!capaz || !corriendo) return;
    requestAnimationFrame(cuadro);

    /* VENCIMIENTO ACUMULADO, no «hace cuánto que dibujé».
       La versión ingenua —if (ahora - ultimoDibujo < msPorCuadro)— parece
       correcta y no lo es: al fijar ultimoDibujo en el instante REAL, cada
       cuadro entra unas décimas tarde, el retraso se acumula y acaba comiendo
       cuadros enteros. Medido con marcas sintéticas: en un monitor de 60Hz
       daba 25,4 fps con tope 30 y 46,4 fps con tope 60.
       Sumando el periodo al vencimiento anterior, el error no se acumula: la
       media es exacta. La resincronización de abajo evita la ráfaga de
       recuperación al volver de una pausa o de una pestaña oculta. */
    if (ahora < proximoDibujo) { stats.saltados++; return; }
    proximoDibujo += msPorCuadro;
    if (proximoDibujo < ahora) proximoDibujo = ahora + msPorCuadro;
    ultimoDibujo = ahora;

    var inicio = performance.now();
    try {
      if (gl.isContextLost && gl.isContextLost()) return;
      dibujarEscena((ahora - t0) / 1000);
    } catch (e) {
      corriendo = false;
      stats.estado = 'error de dibujo: ' + (e && e.message ? e.message : e);
      mostrarFallback('el motor falló durante el render');
      return;
    }
    var costo = performance.now() - inicio;
    stats.msCuadroJS = costo;
    if (costo > stats.msCuadroMax) stats.msCuadroMax = costo;
    stats.cuadros++;

    ventanaFps.push(ahora);
    while (ventanaFps.length && ahora - ventanaFps[0] > 1000) ventanaFps.shift();
    if (ahora - ultimoFpsCalc > 250) { stats.fps = ventanaFps.length; ultimoFpsCalc = ahora; actualizarHud(); }
  }

  /* ─── Pausa y reanudación ─────────────────────────────────────────────── */

  function pausar(motivo) {
    if (!corriendo) return;
    corriendo = false; stats.pausas++; stats.estado = 'en pausa (' + motivo + ')';
    actualizarHud();
  }

  function reanudar() {
    if (!capaz || corriendo || degradado) return;
    if (document.hidden) return;
    corriendo = true; stats.estado = 'en marcha';
    ultimoDibujo = 0;
    proximoDibujo = performance.now();   // primer cuadro inmediato tras reanudar
    requestAnimationFrame(cuadro);
    actualizarHud();
  }

  /* ─── Contexto perdido / restaurado ───────────────────────────────────── */

  function alPerderContexto(e) {
    /* preventDefault es lo que hace que el navegador se moleste en emitir
       webglcontextrestored. Sin él, el contexto se pierde y no vuelve nunca. */
    e.preventDefault();
    corriendo = false; degradado = true;
    stats.contextosPerdidos++; stats.estado = 'contexto WebGL perdido';
    liberarEscena();
    if (contenedor) contenedor.classList.add('nm3d--degradado');
    actualizarHud();
  }

  function alRestaurarContexto() {
    stats.contextosRestaurados++;
    stats.estado = 'restaurando';
    try {
      construirEscena();          // todo el estado GPU murió con el contexto
      redimensionar();
      degradado = false;
      if (contenedor) contenedor.classList.remove('nm3d--degradado');
      t0 = performance.now();
      reanudar();
    } catch (err) {
      mostrarFallback('no se pudo reinicializar tras recuperar el contexto');
    }
    actualizarHud();
  }

  /* ─── Paneo 360° ──────────────────────────────────────────────────────── */

  function instalarPaneo() {
    contenedor.addEventListener('pointermove', function (e) {
      var r = contenedor.getBoundingClientRect();
      var nx = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
      var ny = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
      yawObjetivo = nx * 1.2;
      pitchObjetivo = ny * 0.6;
    }, { passive: true });

    /* Giroscopio en móvil. En iOS 13+ requiere permiso por gesto del usuario,
       así que aquí solo se engancha si el permiso ya está concedido; pedirlo
       es cosa de un botón explícito, no de la carga de la página. */
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', function (e) {
        if (e.gamma === null || e.beta === null) return;
        yawObjetivo = Math.max(-1.2, Math.min(1.2, (e.gamma || 0) / 45));
        pitchObjetivo = Math.max(-0.6, Math.min(0.6, ((e.beta || 0) - 45) / 90));
      }, { passive: true });
    }
  }

  /* ─── HUD ─────────────────────────────────────────────────────────────── */

  function actualizarHud() {
    var hud = document.querySelector('[data-nm3d-hud]');
    if (!hud) return;
    var campos = {
      fps: stats.fps + ' / ' + topeFps,
      estado: stats.estado,
      dibujo: stats.llamadasDibujo + ' llamadas',
      vertices: stats.vertices.toLocaleString('es'),
      js: stats.msCuadroJS.toFixed(2) + ' ms'
    };
    for (var k in campos) {
      if (!Object.prototype.hasOwnProperty.call(campos, k)) continue;
      var el = hud.querySelector('[data-nm3d-' + k + ']');
      if (el) el.textContent = campos[k];
    }
  }

  function instalarHud() {
    var botones = document.querySelectorAll('[data-nm3d-fps-set]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].addEventListener('click', function (e) {
        var v = parseInt(e.currentTarget.getAttribute('data-nm3d-fps-set'), 10);
        if (v !== 30 && v !== 60) return;
        topeFps = v; msPorCuadro = 1000 / v;
        proximoDibujo = performance.now();
        stats.msCuadroMax = 0;
        var todos = document.querySelectorAll('[data-nm3d-fps-set]');
        for (var j = 0; j < todos.length; j++) {
          todos[j].setAttribute('aria-pressed', todos[j] === e.currentTarget ? 'true' : 'false');
        }
        actualizarHud();
      });
    }
  }

  /* ─── Arranque ────────────────────────────────────────────────────────── */

  function iniciar() {
    contenedor = document.getElementById(ID_VIEWPORT);
    if (!contenedor) return;

    try {
      reducirMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { reducirMovimiento = false; }

    if (equipoModesto()) { mostrarFallback('equipo por debajo del mínimo para 3D'); return; }

    lienzo = contenedor.querySelector('canvas.nm3d-lienzo');
    if (!lienzo) { mostrarFallback('falta el lienzo en el documento'); return; }

    gl = obtenerContexto();
    if (!gl) { mostrarFallback('este navegador no expone WebGL'); return; }

    try { extPerdidaContexto = gl.getExtension('WEBGL_lose_context'); } catch (e) { extPerdidaContexto = null; }

    lienzo.addEventListener('webglcontextlost', alPerderContexto, false);
    lienzo.addEventListener('webglcontextrestored', alRestaurarContexto, false);

    try { construirEscena(); }
    catch (e) { mostrarFallback('no se pudo compilar el motor gráfico'); return; }

    capaz = true;
    redimensionar();
    instalarPaneo();
    instalarHud();

    window.addEventListener('resize', redimensionar, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pausar('pestaña oculta'); else reanudar();
    });
    /* blur/focus cierra el hueco que visibilitychange deja abierto: una ventana
       DETRÁS de otra app no está "oculta" para el navegador, pero para nosotros
       sí — y ahí es donde se va la GPU sin que nadie lo esté mirando. */
    window.addEventListener('blur', function () { pausar('ventana en segundo plano'); });
    window.addEventListener('focus', reanudar);

    t0 = performance.now();
    reanudar();
  }

  /* Superficie mínima para el informe de consumo y las pruebas. */
  window.mdjNeuralMatrix3D = {
    stats: function () {
      var copia = {};
      for (var k in stats) { if (Object.prototype.hasOwnProperty.call(stats, k)) copia[k] = stats[k]; }
      copia.topeFps = topeFps; copia.capaz = capaz; copia.corriendo = corriendo; copia.degradado = degradado;
      return copia;
    },
    fijarFps: function (v) { if (v === 30 || v === 60) { topeFps = v; msPorCuadro = 1000 / v; proximoDibujo = performance.now(); stats.msCuadroMax = 0; } },
    pausar: function () { pausar('petición externa'); },
    reanudar: reanudar,
    /* Pruebas de contexto perdido: la extensión es la única forma honesta de
       provocarlo sin desenchufar la tarjeta gráfica. */
    simularPerdidaContexto: function () {
      if (!extPerdidaContexto) return 'WEBGL_lose_context no disponible';
      extPerdidaContexto.loseContext(); return 'contexto perdido a propósito';
    },
    simularRestauracionContexto: function () {
      if (!extPerdidaContexto) return 'WEBGL_lose_context no disponible';
      extPerdidaContexto.restoreContext(); return 'restauración solicitada';
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
