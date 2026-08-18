/* ============================================================================
   NEURAL MATRIX 3D · sinapsis, instancing y audio-reactividad (FEAT-3D-02)
   ----------------------------------------------------------------------------
   Sobre el andamiaje de FEAT-3D-01 se añaden tres cosas:
     · TUBOS TRANSLÚCIDOS — malla estática indexada, las cuatro rutas fundidas
       en un solo buffer. Una llamada de dibujo para todo el tejido neuronal.
     · NODOS DE SINAPSIS E INSTANCING — un cuadrilátero base instanciado para
       los nodos y otro para las micropartículas. Dos llamadas, no dos mil.
     · uPulso REAL — un AnalyserNode de la Web Audio API alimenta el brillo de
       los pulsos con la energía de graves de la pista.

   ┌─ LAS LLAMADAS DE DIBUJO BAJAN, NO SUBEN ────────────────────────────────┐
   │ FEAT-3D-01 gastaba 5 (una por ruta + partículas). Esta versión dibuja    │
   │ MÁS geometría con 3: tubos fundidos (1) + nodos instanciados (1) +       │
   │ partículas instanciadas (1). El requisito era no elevarlas.              │
   └──────────────────────────────────────────────────────────────────────────┘

   ┌─ POR QUÉ NO SE PIDE EL MICRÓFONO ───────────────────────────────────────┐
   │ El análisis se hace sobre la pista del propio sitio, servida del mismo   │
   │ origen. Pedir el micrófono para decorar un fondo dispara un permiso del  │
   │ sistema y mete audio del entorno del usuario en la página. No compensa.  │
   │ La Web Audio API exige además un gesto: hay un botón, no autoplay.       │
   └──────────────────────────────────────────────────────────────────────────┘

   ┌─ POR QUÉ ESTE ARCHIVO EVITA ?. Y ?? ─────────────────────────────────────┐
   │ Lección del ticket P2.2: un SyntaxError ocurre al PARSEAR, antes de que  │
   │ corra una sola línea. El código que dibuja el mensaje de "no puedo"      │
   │ tiene que poder parsearse en el motor que no puede.                      │
   └──────────────────────────────────────────────────────────────────────────┘

   SALVAGUARDAS DE GPU (intactas desde FEAT-3D-01, ver directriz WindowServer):
     · Tope determinista por vencimiento acumulado: 30 fps por defecto, 60 opt-in.
     · webglcontextlost / webglcontextrestored con reinicio controlado.
     · Pausa por visibilitychange Y por blur.
     · devicePixelRatio acotado a 1.75.
     · Cero creación de geometría, buffers o programas dentro del bucle.
   ========================================================================== */

(function () {
  'use strict';

  /* ─── Configuración ───────────────────────────────────────────────────── */

  var ID_VIEWPORT = 'neural-matrix-viewport';
  var FPS_POR_DEFECTO = 30;
  var DPR_MAXIMO = 1.75;
  var MUESTRAS_POR_RUTA = 120;   // puntos a lo largo de cada curva
  var LADOS_TUBO = 6;            // vértices por anillo: 6 basta para leerse redondo
  var RADIO_TUBO = 0.085;   // conducto, no tubería: la cámara los atraviesa
  var PARTICULAS = 900;

  var RUTAS = [
    { nombre: 'DJ',         color: [1.00, 0.78, 0.35], puntos: [[-6,-1.5,-30],[-3, 1.0,-20],[-1,-0.5,-10],[ 1, 1.5,  0],[ 3,-1.0, 10],[ 5, 0.5, 20]] },
    { nombre: 'Producción', color: [0.45, 0.85, 1.00], puntos: [[ 6, 1.5,-30],[ 3,-1.0,-20],[ 1, 0.8,-10],[-1,-1.2,  0],[-3, 1.0, 10],[-5,-0.6, 20]] },
    { nombre: 'Acústica',   color: [0.70, 0.55, 1.00], puntos: [[ 0, 4.0,-30],[ 2, 2.0,-20],[-2, 3.0,-10],[ 2, 1.5,  0],[-1, 3.5, 10],[ 1, 2.0, 20]] },
    { nombre: 'Negocio',    color: [0.40, 1.00, 0.70], puntos: [[ 0,-4.0,-30],[-2,-2.5,-20],[ 2,-3.0,-10],[-2,-1.8,  0],[ 1,-3.5, 10],[-1,-2.0, 20]] }
  ];

  /* ─── Estado ──────────────────────────────────────────────────────────── */

  var contenedor = null, lienzo = null, gl = null, esWebGL2 = false;
  var extPerdidaContexto = null, extInstancing = null, modoInstancing = 'ninguno';

  var progTubos = null, progInstancias = null;
  var bufTubos = null, bufIndices = null, bufQuad = null, bufNodos = null, bufParticulas = null;
  var indicesTubos = 0, conteoVerticesTubos = 0;
  var nodos = [], datosNodos = null, datosParticulas = null;

  var aTubos = {}, uTubos = {}, aInst = {}, uInst = {};

  var corriendo = false, degradado = false, capaz = false;
  var topeFps = FPS_POR_DEFECTO, msPorCuadro = 1000 / FPS_POR_DEFECTO;
  var ultimoDibujo = 0, proximoDibujo = 0, t0 = 0;
  var camYaw = 0, camPitch = 0, yawObjetivo = 0, pitchObjetivo = 0;
  var reducirMovimiento = false;
  var raton = { x: -1, y: -1 }, nodoActivo = -1;

  /* Audio */
  var audioEl = null, ctxAudio = null, analizador = null, datosFrecuencia = null;
  var pulso = 0, banda = { graves: 0, medios: 0, agudos: 0 }, audioActivo = false;

  var stats = {
    cuadros: 0, saltados: 0, fps: 0, msCuadroJS: 0, msCuadroMax: 0,
    llamadasDibujo: 0, vertices: 0, instancias: 0,
    contextosPerdidos: 0, contextosRestaurados: 0, pausas: 0, estado: 'arrancando'
  };
  var ventanaFps = [], ultimoFpsCalc = 0;

  /* Vectores reutilizados en el bucle: asignarlos aquí y no dentro del cuadro
     es la diferencia entre cero basura y 30 recolecciones por segundo. */
  var _proy = new Float32Array(16), _vista = new Float32Array(16), _mvp = new Float32Array(16);
  var _tmpA = new Float32Array(16), _tmpB = new Float32Array(16);

  /* ─── Matrices ────────────────────────────────────────────────────────── */

  function perspectivaEn(o, fovY, aspecto, cerca, lejos) {
    var f = 1.0 / Math.tan(fovY / 2), nf = 1 / (cerca - lejos);
    o[0]=f/aspecto; o[1]=0; o[2]=0; o[3]=0;
    o[4]=0; o[5]=f; o[6]=0; o[7]=0;
    o[8]=0; o[9]=0; o[10]=(lejos+cerca)*nf; o[11]=-1;
    o[12]=0; o[13]=0; o[14]=(2*lejos*cerca)*nf; o[15]=0;
    return o;
  }

  function multiplicarEn(o, a, b) {
    for (var i = 0; i < 4; i++) {
      var a0=a[i*4], a1=a[i*4+1], a2=a[i*4+2], a3=a[i*4+3];
      o[i*4]   = a0*b[0] + a1*b[4] + a2*b[8]  + a3*b[12];
      o[i*4+1] = a0*b[1] + a1*b[5] + a2*b[9]  + a3*b[13];
      o[i*4+2] = a0*b[2] + a1*b[6] + a2*b[10] + a3*b[14];
      o[i*4+3] = a0*b[3] + a1*b[7] + a2*b[11] + a3*b[15];
    }
    return o;
  }

  function vistaEn(o, yaw, pitch, z) {
    var cy=Math.cos(yaw), sy=Math.sin(yaw), cx=Math.cos(pitch), sx=Math.sin(pitch);
    _tmpA[0]=1;_tmpA[1]=0;_tmpA[2]=0;_tmpA[3]=0;
    _tmpA[4]=0;_tmpA[5]=cx;_tmpA[6]=sx;_tmpA[7]=0;
    _tmpA[8]=0;_tmpA[9]=-sx;_tmpA[10]=cx;_tmpA[11]=0;
    _tmpA[12]=0;_tmpA[13]=0;_tmpA[14]=0;_tmpA[15]=1;
    _tmpB[0]=cy;_tmpB[1]=0;_tmpB[2]=-sy;_tmpB[3]=0;
    _tmpB[4]=0;_tmpB[5]=1;_tmpB[6]=0;_tmpB[7]=0;
    _tmpB[8]=sy;_tmpB[9]=0;_tmpB[10]=cy;_tmpB[11]=0;
    _tmpB[12]=0;_tmpB[13]=0;_tmpB[14]=z;_tmpB[15]=1;
    return multiplicarEn(o, _tmpA, _tmpB);
  }

  /* ─── Curva ───────────────────────────────────────────────────────────── */

  function catmullRom(p0, p1, p2, p3, t, salida) {
    var t2 = t * t, t3 = t2 * t;
    for (var i = 0; i < 3; i++) {
      salida[i] = 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t +
        (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
        (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
    }
    return salida;
  }

  /* Evalúa la ruta entera con u en [0,1] y devuelve el punto. */
  function puntoEnRuta(pts, u, salida) {
    var tramos = pts.length - 1;
    var f = Math.min(u, 0.999999) * tramos;
    var i = Math.floor(f), t = f - i;
    var p0 = pts[i > 0 ? i - 1 : 0], p1 = pts[i], p2 = pts[i + 1];
    var p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1];
    return catmullRom(p0, p1, p2, p3, t, salida);
  }

  /* ─── Geometría de tubos (una sola vez, fundida, indexada) ────────────── */

  function construirTubos() {
    var vert = [], idx = [], a = [0,0,0], b = [0,0,0], base = 0;

    for (var r = 0; r < RUTAS.length; r++) {
      var pts = RUTAS[r].puntos, col = RUTAS[r].color;

      for (var m = 0; m < MUESTRAS_POR_RUTA; m++) {
        var u = m / (MUESTRAS_POR_RUTA - 1);
        puntoEnRuta(pts, u, a);
        /* Tangente por diferencia adelantada; en el último punto se mira atrás
           para no salirse del dominio de la curva. */
        puntoEnRuta(pts, Math.min(0.9999, u + 0.004), b);
        var tx = b[0]-a[0], ty = b[1]-a[1], tz = b[2]-a[2];
        if (m === MUESTRAS_POR_RUTA - 1) { tx = -tx; ty = -ty; tz = -tz; }
        var lt = Math.sqrt(tx*tx + ty*ty + tz*tz) || 1;
        tx/=lt; ty/=lt; tz/=lt;

        /* Marco del anillo. Si la tangente casi coincide con el "arriba" del
           mundo, el producto vectorial degenera y el tubo se retuerce: se
           cambia de referencia en ese caso. */
        var ux = 0, uy = 1, uz = 0;
        if (Math.abs(ty) > 0.94) { ux = 1; uy = 0; uz = 0; }
        var nx = ty*uz - tz*uy, ny = tz*ux - tx*uz, nz = tx*uy - ty*ux;
        var ln = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1; nx/=ln; ny/=ln; nz/=ln;
        var bx = ty*nz - tz*ny, by = tz*nx - tx*nz, bz = tx*ny - ty*nx;

        for (var k = 0; k < LADOS_TUBO; k++) {
          var ang = (k / LADOS_TUBO) * Math.PI * 2;
          var ca = Math.cos(ang), sa = Math.sin(ang);
          var dx = nx*ca + bx*sa, dy = ny*ca + by*sa, dz = nz*ca + bz*sa;
          vert.push(
            a[0] + dx*RADIO_TUBO, a[1] + dy*RADIO_TUBO, a[2] + dz*RADIO_TUBO,
            dx, dy, dz,                    // normal del anillo → término de borde
            col[0], col[1], col[2],
            u, r
          );
        }
      }

      for (var s = 0; s < MUESTRAS_POR_RUTA - 1; s++) {
        for (var q = 0; q < LADOS_TUBO; q++) {
          var q2 = (q + 1) % LADOS_TUBO;
          var f0 = base + s*LADOS_TUBO + q,  f1 = base + s*LADOS_TUBO + q2;
          var f2 = base + (s+1)*LADOS_TUBO + q, f3 = base + (s+1)*LADOS_TUBO + q2;
          idx.push(f0, f2, f1,  f1, f2, f3);
        }
      }
      base += MUESTRAS_POR_RUTA * LADOS_TUBO;
    }

    conteoVerticesTubos = vert.length / 11;
    indicesTubos = idx.length;
    return { vertices: new Float32Array(vert), indices: new Uint16Array(idx) };
  }

  /* ─── Nodos de sinapsis ───────────────────────────────────────────────── */

  /* Un nodo al final de cada tramo de cada ruta: son los puntos de decisión y
     el acceso a las lecciones. El estado (desbloqueado) queda preparado para
     la persistencia en user_learning_paths; hoy es local. */
  function construirNodos() {
    nodos = [];
    var p = [0,0,0];
    for (var r = 0; r < RUTAS.length; r++) {
      var pts = RUTAS[r].puntos, tramos = pts.length - 1;
      for (var i = 1; i <= tramos; i++) {
        var u = i / tramos;
        puntoEnRuta(pts, u, p);
        nodos.push({
          x: p[0], y: p[1], z: p[2],
          ruta: r, leccion: i,
          nombre: RUTAS[r].nombre + ' · lección ' + i,
          color: RUTAS[r].color,
          desbloqueado: i <= 2,          // dos primeras abiertas por defecto
          pantalla: { x: -1, y: -1, visible: false }
        });
      }
    }
    var d = new Float32Array(nodos.length * 9);
    for (var n = 0; n < nodos.length; n++) {
      var o = n * 9, nd = nodos[n];
      d[o]=nd.x; d[o+1]=nd.y; d[o+2]=nd.z;
      d[o+3]=nd.color[0]; d[o+4]=nd.color[1]; d[o+5]=nd.color[2];
      d[o+6]=nd.desbloqueado ? 0.42 : 0.26;    // radio
      d[o+7]=nd.desbloqueado ? 1.0 : 0.35;     // intensidad
      d[o+8]=n;                                 // índice, para resaltar el activo
    }
    datosNodos = d;
    return d;
  }

  function construirParticulas() {
    var d = new Float32Array(PARTICULAS * 9);
    for (var i = 0; i < PARTICULAS; i++) {
      var o = i * 9;
      d[o]   = (Math.random() - 0.5) * 26;
      d[o+1] = (Math.random() - 0.5) * 16;
      d[o+2] = -32 + Math.random() * 56;
      d[o+3] = 0.75; d[o+4] = 0.85; d[o+5] = 1.0;
      /* JERARQUÍA VISUAL (decisión de keynote): estaciones → conductos →
         fondo. Las partículas son ambiente y nada más; con la intensidad
         anterior competían en brillo con los nodos y la audiencia no podía
         distinguir una estación de una mota de polvo en pantalla gigante. */
      d[o+6] = 0.028 + Math.random() * 0.032;  // radio
      d[o+7] = 0.030 + Math.random() * 0.065;  // intensidad
      d[o+8] = -1;                             // nunca es el nodo activo
    }
    datosParticulas = d;
    return d;
  }

  /* Cuadrilátero base compartido por nodos y partículas: 4 vértices, y todas
     las instancias se construyen desplazándolo en espacio de vista. */
  var QUAD = new Float32Array([-1,-1,  1,-1,  -1,1,  1,1]);

  /* ─── Shaders ─────────────────────────────────────────────────────────── */

  var VERT_TUBOS = [
    'precision mediump float;',
    'attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;',
    'attribute float aRecorrido; attribute float aRuta;',
    'uniform mat4 uProy; uniform mat4 uVista; uniform float uTiempo; uniform float uPulso;',
    'varying vec3 vColor; varying float vBrillo; varying float vBorde;',
    'void main(){',
    '  vec4 posVista = uVista * vec4(aPos, 1.0);',
    /* Normal en espacio de vista: su componente Z dice cuánto mira hacia la
       cámara. Cerca de 0 estamos viendo el tubo de canto — ahí es donde un
       material translúcido se ve más denso. Es un Fresnel de dos líneas. */
    '  vec3 nVista = normalize((uVista * vec4(aNormal, 0.0)).xyz);',
    '  vBorde = 1.0 - abs(nVista.z);',
    '  float fase = fract(uTiempo * 0.18 + aRuta * 0.25);',
    '  float d = abs(fract(aRecorrido - fase + 0.5) - 0.5);',
    '  float halo = exp(-d * d * 22.0);',
    '  float nucleo = exp(-d * d * 300.0);',
    '  float p = halo * 0.45 + nucleo;',
    '  vBrillo = 0.26 + p * (1.95 + uPulso * 2.1);',
    '  vColor = aColor;',
    '  gl_Position = uProy * posVista;',
    '}'
  ].join('\n');

  var FRAG_TUBOS = [
    'precision mediump float;',
    'varying vec3 vColor; varying float vBrillo; varying float vBorde;',
    'void main(){',
    /* El borde manda en la opacidad: el centro del tubo queda casi vidrio y
       la silueta se marca. Es lo que lo hace leer como translúcido y no como
       un cilindro pintado. */
    /* El núcleo casi no aporta y el borde sí: con mezcla aditiva, una
       superficie grande a alfa media se acumula en una mancha sólida. Aquí
       el tubo es casi invisible de frente y solo se marca su silueta. */
    '  float alfa = (0.030 + vBorde * 0.44) * min(1.0, vBrillo * 1.35);',
    '  gl_FragColor = vec4(vColor * vBrillo, alfa);',
    '}'
  ].join('\n');

  var VERT_INST = [
    'precision mediump float;',
    'attribute vec2 aQuad;',
    'attribute vec3 iPos; attribute vec3 iColor; attribute float iRadio;',
    'attribute float iIntensidad; attribute float iIndice;',
    'uniform mat4 uProy; uniform mat4 uVista; uniform float uTiempo;',
    'uniform float uPulso; uniform float uActivo;',
    'varying vec2 vQuad; varying vec3 vColor; varying float vIntensidad;',
    'void main(){',
    '  vec3 p = iPos;',
    '  p.y += sin(uTiempo * 0.5 + iIndice * 0.37) * 0.18;',
    '  vec4 posVista = uVista * vec4(p, 1.0);',
    /* Billboard: el cuadrilátero se expande en espacio de VISTA, así que
       siempre encara a la cámara sin necesidad de matriz por instancia. */
    '  float activo = (abs(iIndice - uActivo) < 0.5) ? 1.0 : 0.0;',
    '  float radio = iRadio * (1.0 + uPulso * 0.55 + activo * 0.85);',
    '  posVista.xy += aQuad * radio;',
    '  vQuad = aQuad;',
    '  vColor = mix(iColor, vec3(1.0), activo * 0.5);',
    '  vIntensidad = iIntensidad * (0.55 + uPulso * 0.9) + activo * 0.7;',
    '  gl_Position = uProy * posVista;',
    '}'
  ].join('\n');

  var FRAG_INST = [
    'precision mediump float;',
    'varying vec2 vQuad; varying vec3 vColor; varying float vIntensidad;',
    'void main(){',
    '  float d = length(vQuad);',
    '  if (d > 1.0) discard;',
    /* Núcleo compacto + halo suave: una esfera de luz sin texturas. */
    '  float nucleo = smoothstep(0.55, 0.0, d);',
    '  float halo = smoothstep(1.0, 0.0, d) * 0.45;',
    '  float a = (nucleo + halo) * vIntensidad;',
    '  gl_FragColor = vec4(vColor * (0.6 + nucleo), a);',
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
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('enlace: ' + gl.getProgramInfoLog(p));
    return p;
  }

  /* ─── Instancing: tres niveles, se usa el mejor disponible ────────────── */

  function fijarDivisor(loc, divisor) {
    if (esWebGL2) gl.vertexAttribDivisor(loc, divisor);
    else if (extInstancing) extInstancing.vertexAttribDivisorANGLE(loc, divisor);
  }

  function dibujarInstanciado(modo, primeros, cuenta, instancias) {
    if (esWebGL2) { gl.drawArraysInstanced(modo, primeros, cuenta, instancias); return true; }
    if (extInstancing) { extInstancing.drawArraysInstancedANGLE(modo, primeros, cuenta, instancias); return true; }
    return false;
  }

  /* ─── Capacidad ───────────────────────────────────────────────────────── */

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
    /* WebGL2 primero: trae instancing en el núcleo y evita depender de una
       extensión. Si no está, WebGL1 + ANGLE_instanced_arrays. Si tampoco,
       el motor sigue funcionando sin nodos ni partículas (ver dibujarEscena). */
    try { ctx = lienzo.getContext('webgl2', opciones); } catch (e) { ctx = null; }
    if (ctx) { esWebGL2 = true; modoInstancing = 'webgl2'; return ctx; }
    try { ctx = lienzo.getContext('webgl', opciones) || lienzo.getContext('experimental-webgl', opciones); } catch (e2) { ctx = null; }
    return ctx;
  }

  /* ─── Fallback ────────────────────────────────────────────────────────── */

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

  /* ─── Construcción (una sola vez) ─────────────────────────────────────── */

  function construirEscena() {
    progTubos = enlazar(VERT_TUBOS, FRAG_TUBOS);
    aTubos.pos = gl.getAttribLocation(progTubos, 'aPos');
    aTubos.normal = gl.getAttribLocation(progTubos, 'aNormal');
    aTubos.color = gl.getAttribLocation(progTubos, 'aColor');
    aTubos.recorrido = gl.getAttribLocation(progTubos, 'aRecorrido');
    aTubos.ruta = gl.getAttribLocation(progTubos, 'aRuta');
    uTubos.proy = gl.getUniformLocation(progTubos, 'uProy');
    uTubos.vista = gl.getUniformLocation(progTubos, 'uVista');
    uTubos.tiempo = gl.getUniformLocation(progTubos, 'uTiempo');
    uTubos.pulso = gl.getUniformLocation(progTubos, 'uPulso');

    progInstancias = enlazar(VERT_INST, FRAG_INST);
    aInst.quad = gl.getAttribLocation(progInstancias, 'aQuad');
    aInst.pos = gl.getAttribLocation(progInstancias, 'iPos');
    aInst.color = gl.getAttribLocation(progInstancias, 'iColor');
    aInst.radio = gl.getAttribLocation(progInstancias, 'iRadio');
    aInst.intensidad = gl.getAttribLocation(progInstancias, 'iIntensidad');
    aInst.indice = gl.getAttribLocation(progInstancias, 'iIndice');
    uInst.proy = gl.getUniformLocation(progInstancias, 'uProy');
    uInst.vista = gl.getUniformLocation(progInstancias, 'uVista');
    uInst.tiempo = gl.getUniformLocation(progInstancias, 'uTiempo');
    uInst.pulso = gl.getUniformLocation(progInstancias, 'uPulso');
    uInst.activo = gl.getUniformLocation(progInstancias, 'uActivo');

    var tubos = construirTubos();
    bufTubos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufTubos);
    gl.bufferData(gl.ARRAY_BUFFER, tubos.vertices, gl.STATIC_DRAW);
    bufIndices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIndices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tubos.indices, gl.STATIC_DRAW);

    bufQuad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

    bufNodos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufNodos);
    gl.bufferData(gl.ARRAY_BUFFER, construirNodos(), gl.STATIC_DRAW);

    bufParticulas = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufParticulas);
    gl.bufferData(gl.ARRAY_BUFFER, construirParticulas(), gl.STATIC_DRAW);

    gl.clearColor(0.02, 0.03, 0.06, 1.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);   // aditivo: el orden no importa y evita ordenar

    stats.vertices = conteoVerticesTubos;
    stats.instancias = nodos.length + PARTICULAS;
  }

  function liberarEscena() {
    if (!gl) return;
    try {
      [bufTubos, bufIndices, bufQuad, bufNodos, bufParticulas].forEach(function (b) { if (b) gl.deleteBuffer(b); });
      if (progTubos) gl.deleteProgram(progTubos);
      if (progInstancias) gl.deleteProgram(progInstancias);
    } catch (e) { /* contexto ya muerto */ }
    bufTubos = bufIndices = bufQuad = bufNodos = bufParticulas = progTubos = progInstancias = null;
  }

  /* ─── Audio ───────────────────────────────────────────────────────────── */

  function activarAudio() {
    if (audioActivo) return Promise.resolve('ya activo');
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return Promise.resolve('este navegador no expone Web Audio API');
    audioEl = document.querySelector('[data-nm3d-audio]');
    if (!audioEl) return Promise.resolve('falta el elemento de audio');
    try {
      ctxAudio = new Ctx();
      var fuente = ctxAudio.createMediaElementSource(audioEl);
      analizador = ctxAudio.createAnalyser();
      analizador.fftSize = 512;
      /* El suavizado del propio analizador evita el parpadeo de un cuadro a
         otro; la envolvente de abajo se encarga del carácter del golpe. */
      analizador.smoothingTimeConstant = 0.72;
      fuente.connect(analizador);
      analizador.connect(ctxAudio.destination);
      datosFrecuencia = new Uint8Array(analizador.frequencyBinCount);
    } catch (e) {
      return Promise.resolve('no se pudo abrir el analizador: ' + (e && e.message ? e.message : e));
    }
    return ctxAudio.resume().then(function () {
      return audioEl.play();
    }).then(function () {
      audioActivo = true;
      if (contenedor) contenedor.classList.add('nm3d--con-audio');
      actualizarHud();
      return 'audio en marcha';
    })['catch'](function (e) {
      return 'el navegador bloqueó la reproducción: ' + (e && e.message ? e.message : e);
    });
  }

  function desactivarAudio() {
    audioActivo = false;
    try { if (audioEl) audioEl.pause(); } catch (e) { /* nada */ }
    if (contenedor) contenedor.classList.remove('nm3d--con-audio');
    actualizarHud();
  }

  /* Lee el espectro y lo convierte en un solo número: uPulso.
     getByteFrequencyData escribe en un array ya reservado — cero basura. */
  function leerAudio() {
    if (!audioActivo || !analizador) {
      /* Sin audio, un latido sintético lento para que la escena no esté muerta. */
      var objetivoSin = 0.16 + 0.16 * Math.sin(performance.now() / 900);
      pulso += (objetivoSin - pulso) * 0.05;
      return;
    }
    analizador.getByteFrequencyData(datosFrecuencia);
    var n = datosFrecuencia.length;
    var finGraves = Math.max(2, Math.floor(n * 0.06));
    var finMedios = Math.floor(n * 0.35);
    var sg = 0, sm = 0, sa = 0, i;
    for (i = 0; i < finGraves; i++) sg += datosFrecuencia[i];
    for (i = finGraves; i < finMedios; i++) sm += datosFrecuencia[i];
    for (i = finMedios; i < n; i++) sa += datosFrecuencia[i];
    banda.graves = sg / (finGraves * 255);
    banda.medios = sm / ((finMedios - finGraves) * 255);
    banda.agudos = sa / ((n - finMedios) * 255);

    /* Envolvente asimétrica: sube de golpe con el bombo y baja despacio. Con
       un suavizado simétrico el pulso se convierte en una media aburrida. */
    var objetivo = Math.min(1.4, banda.graves * 1.9 + banda.medios * 0.35);
    pulso += (objetivo - pulso) * (objetivo > pulso ? 0.5 : 0.06);
  }

  /* ─── Selección de nodos (proyección, no raycast) ─────────────────────── */

  /* Con 20 nodos, proyectarlos y medir distancia en pantalla cuesta
     microsegundos y es exacto para esferas. Un raycast contra geometría sería
     más código y más lento para el mismo resultado. */
  function actualizarNodoActivo() {
    var w = contenedor.clientWidth, h = contenedor.clientHeight;
    var mejor = -1, mejorDist = 44;   // radio de agarre en píxeles CSS
    for (var i = 0; i < nodos.length; i++) {
      var nd = nodos[i];
      var x = nd.x, y = nd.y, z = nd.z;
      var cx = _mvp[0]*x + _mvp[4]*y + _mvp[8]*z  + _mvp[12];
      var cy = _mvp[1]*x + _mvp[5]*y + _mvp[9]*z  + _mvp[13];
      var cw = _mvp[3]*x + _mvp[7]*y + _mvp[11]*z + _mvp[15];
      if (cw <= 0.0001) { nd.pantalla.visible = false; continue; }
      var sx = (cx / cw * 0.5 + 0.5) * w;
      var sy = (1 - (cy / cw * 0.5 + 0.5)) * h;
      nd.pantalla.x = sx; nd.pantalla.y = sy; nd.pantalla.visible = true;
      if (raton.x < 0) continue;
      var dx = sx - raton.x, dy = sy - raton.y;
      var d = Math.sqrt(dx*dx + dy*dy);
      if (d < mejorDist) { mejorDist = d; mejor = i; }
    }
    if (mejor !== nodoActivo) { nodoActivo = mejor; mostrarEtiquetaNodo(); }
  }

  function mostrarEtiquetaNodo() {
    var et = document.querySelector('[data-nm3d-nodo]');
    if (!et) return;
    if (nodoActivo < 0) { et.hidden = true; contenedor.style.cursor = 'crosshair'; return; }
    var nd = nodos[nodoActivo];
    et.hidden = false;
    et.style.left = Math.round(nd.pantalla.x) + 'px';
    et.style.top = Math.round(nd.pantalla.y) + 'px';
    et.setAttribute('data-estado', nd.desbloqueado ? 'abierto' : 'bloqueado');
    var t = et.querySelector('[data-nm3d-nodo-titulo]');
    var s = et.querySelector('[data-nm3d-nodo-estado]');
    if (t) t.textContent = nd.nombre;
    if (s) s.textContent = nd.desbloqueado ? 'Abrir lección' : 'Bloqueada';
    contenedor.style.cursor = nd.desbloqueado ? 'pointer' : 'not-allowed';
  }

  /* ─── Dibujo ──────────────────────────────────────────────────────────── */

  function dibujarEscena(t) {
    var aspecto = lienzo.width / Math.max(1, lienzo.height);
    perspectivaEn(_proy, 1.15, aspecto, 0.1, 120.0);

    camYaw += (yawObjetivo - camYaw) * 0.06;
    camPitch += (pitchObjetivo - camPitch) * 0.06;
    var z = reducirMovimiento ? -6.0 : (((t * 2.2) % 46) - 34);
    vistaEn(_vista, camYaw, camPitch, z);
    multiplicarEn(_mvp, _proy, _vista);

    gl.clear(gl.COLOR_BUFFER_BIT);
    stats.llamadasDibujo = 0;

    /* 1 · TUBOS — las cuatro rutas en una sola llamada indexada.
       11 floats por vértice: pos3, normal3, color3, recorrido1, ruta1 */
    gl.useProgram(progTubos);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufTubos);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIndices);
    var zt = 11 * 4;
    gl.enableVertexAttribArray(aTubos.pos);       gl.vertexAttribPointer(aTubos.pos, 3, gl.FLOAT, false, zt, 0);
    gl.enableVertexAttribArray(aTubos.normal);    gl.vertexAttribPointer(aTubos.normal, 3, gl.FLOAT, false, zt, 12);
    gl.enableVertexAttribArray(aTubos.color);     gl.vertexAttribPointer(aTubos.color, 3, gl.FLOAT, false, zt, 24);
    gl.enableVertexAttribArray(aTubos.recorrido); gl.vertexAttribPointer(aTubos.recorrido, 1, gl.FLOAT, false, zt, 36);
    gl.enableVertexAttribArray(aTubos.ruta);      gl.vertexAttribPointer(aTubos.ruta, 1, gl.FLOAT, false, zt, 40);
    gl.uniformMatrix4fv(uTubos.proy, false, _proy);
    gl.uniformMatrix4fv(uTubos.vista, false, _vista);
    gl.uniform1f(uTubos.tiempo, t);
    gl.uniform1f(uTubos.pulso, pulso);
    gl.drawElements(gl.TRIANGLES, indicesTubos, gl.UNSIGNED_SHORT, 0);
    stats.llamadasDibujo++;

    if (modoInstancing === 'ninguno') return;   // sin instancing, solo tubos

    /* 2 y 3 · PARTÍCULAS y NODOS — mismo programa, mismo cuadrilátero base,
       distinto buffer de instancias. 9 floats por instancia. */
    gl.useProgram(progInstancias);
    gl.uniformMatrix4fv(uInst.proy, false, _proy);
    gl.uniformMatrix4fv(uInst.vista, false, _vista);
    gl.uniform1f(uInst.tiempo, t);
    gl.uniform1f(uInst.pulso, pulso);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
    gl.enableVertexAttribArray(aInst.quad);
    gl.vertexAttribPointer(aInst.quad, 2, gl.FLOAT, false, 0, 0);
    fijarDivisor(aInst.quad, 0);

    dibujarLoteInstanciado(bufParticulas, PARTICULAS, -1);
    dibujarLoteInstanciado(bufNodos, nodos.length, nodoActivo);
  }

  function dibujarLoteInstanciado(buf, cuantas, activo) {
    var zi = 9 * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(aInst.pos);        gl.vertexAttribPointer(aInst.pos, 3, gl.FLOAT, false, zi, 0);
    gl.enableVertexAttribArray(aInst.color);      gl.vertexAttribPointer(aInst.color, 3, gl.FLOAT, false, zi, 12);
    gl.enableVertexAttribArray(aInst.radio);      gl.vertexAttribPointer(aInst.radio, 1, gl.FLOAT, false, zi, 24);
    gl.enableVertexAttribArray(aInst.intensidad); gl.vertexAttribPointer(aInst.intensidad, 1, gl.FLOAT, false, zi, 28);
    gl.enableVertexAttribArray(aInst.indice);     gl.vertexAttribPointer(aInst.indice, 1, gl.FLOAT, false, zi, 32);
    fijarDivisor(aInst.pos, 1); fijarDivisor(aInst.color, 1); fijarDivisor(aInst.radio, 1);
    fijarDivisor(aInst.intensidad, 1); fijarDivisor(aInst.indice, 1);
    gl.uniform1f(uInst.activo, activo);
    if (dibujarInstanciado(gl.TRIANGLE_STRIP, 0, 4, cuantas)) stats.llamadasDibujo++;
  }

  /* ─── Bucle ───────────────────────────────────────────────────────────── */

  function cuadro(ahora) {
    if (!capaz || !corriendo) return;
    requestAnimationFrame(cuadro);

    /* VENCIMIENTO ACUMULADO, no «hace cuánto que dibujé». La versión ingenua
       —if (ahora - ultimoDibujo < msPorCuadro)— acumula retraso y come cuadros:
       medido, daba 25,4 fps con tope 30 en un monitor de 60Hz. */
    if (ahora < proximoDibujo) { stats.saltados++; return; }
    proximoDibujo += msPorCuadro;
    if (proximoDibujo < ahora) proximoDibujo = ahora + msPorCuadro;
    ultimoDibujo = ahora;

    var inicio = performance.now();
    try {
      if (gl.isContextLost && gl.isContextLost()) return;
      leerAudio();
      dibujarEscena((ahora - t0) / 1000);
      actualizarNodoActivo();
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

  /* ─── Pausa ───────────────────────────────────────────────────────────── */

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
    proximoDibujo = performance.now();
    requestAnimationFrame(cuadro);
    actualizarHud();
  }

  /* ─── Contexto ────────────────────────────────────────────────────────── */

  function alPerderContexto(e) {
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
      construirEscena();
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

  /* ─── Interacción ─────────────────────────────────────────────────────── */

  function instalarInteraccion() {
    contenedor.addEventListener('pointermove', function (e) {
      var r = contenedor.getBoundingClientRect();
      raton.x = e.clientX - r.left; raton.y = e.clientY - r.top;
      yawObjetivo = (raton.x / Math.max(1, r.width) - 0.5) * 1.2;
      pitchObjetivo = (raton.y / Math.max(1, r.height) - 0.5) * 0.6;
    }, { passive: true });

    contenedor.addEventListener('pointerleave', function () {
      raton.x = -1; raton.y = -1;
      if (nodoActivo !== -1) { nodoActivo = -1; mostrarEtiquetaNodo(); }
    }, { passive: true });

    contenedor.addEventListener('click', function () {
      if (nodoActivo < 0) return;
      var nd = nodos[nodoActivo];
      /* El andamiaje no navega todavía: emite el evento y deja que quien
         monte las lecciones decida. Así la ruta de datos queda probada sin
         acoplar el motor 3D a la academia. */
      try {
        contenedor.dispatchEvent(new CustomEvent('nm3d:nodo', {
          bubbles: true,
          detail: { ruta: RUTAS[nd.ruta].nombre, leccion: nd.leccion, desbloqueado: nd.desbloqueado }
        }));
      } catch (e) { /* navegador sin CustomEvent constructor */ }
    });

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
      instancias: stats.instancias.toLocaleString('es'),
      js: stats.msCuadroJS.toFixed(2) + ' ms',
      /* la clave se llama 'audio-estado' y no 'audio' a propósito: el selector
         se compone como [data-nm3d-<clave>], y [data-nm3d-audio] ya es el
         <audio> de la página — escribiríamos el texto dentro del reproductor */
      'audio-estado': audioActivo ? ('pulso ' + pulso.toFixed(2)) : 'sin audio'
    };
    for (var k in campos) {
      if (!Object.prototype.hasOwnProperty.call(campos, k)) continue;
      var el = hud.querySelector('[data-nm3d-' + k + ']');
      if (el) el.textContent = campos[k];
    }
    var barra = hud.querySelector('[data-nm3d-barra]');
    if (barra) barra.style.transform = 'scaleX(' + Math.min(1, pulso / 1.2).toFixed(3) + ')';
  }

  function instalarControles() {
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

    var btnAudio = document.querySelector('[data-nm3d-audio-toggle]');
    if (btnAudio) {
      btnAudio.addEventListener('click', function () {
        if (audioActivo) { desactivarAudio(); btnAudio.setAttribute('aria-pressed', 'false'); btnAudio.textContent = 'Activar audio'; return; }
        btnAudio.disabled = true;
        activarAudio().then(function (r) {
          btnAudio.disabled = false;
          btnAudio.setAttribute('aria-pressed', audioActivo ? 'true' : 'false');
          btnAudio.textContent = audioActivo ? 'Silenciar' : 'Activar audio';
          if (!audioActivo) { stats.estado = r; actualizarHud(); }
        });
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

    if (!esWebGL2) {
      try { extInstancing = gl.getExtension('ANGLE_instanced_arrays'); } catch (e) { extInstancing = null; }
      modoInstancing = extInstancing ? 'webgl1+ANGLE' : 'ninguno';
    }
    try { extPerdidaContexto = gl.getExtension('WEBGL_lose_context'); } catch (e) { extPerdidaContexto = null; }

    lienzo.addEventListener('webglcontextlost', alPerderContexto, false);
    lienzo.addEventListener('webglcontextrestored', alRestaurarContexto, false);

    try { construirEscena(); }
    catch (e) { mostrarFallback('no se pudo compilar el motor gráfico'); return; }

    capaz = true;
    redimensionar();
    instalarInteraccion();
    instalarControles();

    window.addEventListener('resize', redimensionar, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pausar('pestaña oculta'); else reanudar();
    });
    window.addEventListener('blur', function () { pausar('ventana en segundo plano'); });
    window.addEventListener('focus', reanudar);

    t0 = performance.now();
    reanudar();
  }

  window.mdjNeuralMatrix3D = {
    stats: function () {
      var copia = {};
      for (var k in stats) { if (Object.prototype.hasOwnProperty.call(stats, k)) copia[k] = stats[k]; }
      copia.topeFps = topeFps; copia.capaz = capaz; copia.corriendo = corriendo;
      copia.degradado = degradado; copia.instancing = modoInstancing;
      copia.audioActivo = audioActivo; copia.pulso = pulso;
      copia.banda = { graves: banda.graves, medios: banda.medios, agudos: banda.agudos };
      copia.nodos = nodos.length; copia.nodoActivo = nodoActivo;
      return copia;
    },
    fijarFps: function (v) { if (v === 30 || v === 60) { topeFps = v; msPorCuadro = 1000 / v; proximoDibujo = performance.now(); stats.msCuadroMax = 0; } },
    pausar: function () { pausar('petición externa'); },
    reanudar: reanudar,
    activarAudio: activarAudio,
    desactivarAudio: desactivarAudio,
    /* Para pruebas: coloca el cursor virtual sobre un nodo por índice. */
    apuntarANodo: function (i) {
      if (i < 0 || i >= nodos.length) return 'fuera de rango';
      var nd = nodos[i];
      if (!nd.pantalla.visible) return 'ese nodo no está en pantalla ahora';
      raton.x = nd.pantalla.x; raton.y = nd.pantalla.y;
      return 'cursor sobre ' + nd.nombre;
    },
    nodos: function () {
      return nodos.map(function (n) {
        return { nombre: n.nombre, ruta: RUTAS[n.ruta].nombre, leccion: n.leccion, desbloqueado: n.desbloqueado, visible: n.pantalla.visible };
      });
    },
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
