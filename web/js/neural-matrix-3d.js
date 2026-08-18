/* ============================================================================
   NEURAL MATRIX 3D · Modo Keynote (FEAT-3D-03)
   ----------------------------------------------------------------------------
   La matriz deja de ser escenografía de academia y pasa a ser el simulador del
   sistema de negocio que se presenta en escena: 5 estaciones, cámara cinemática
   continua, controles de escenario y HUD de proyector.

   ┌─ CÓMO SE MATA EL TELETRANSPORTE, DE VERDAD ─────────────────────────────┐
   │ La versión anterior calculaba z = ((t*2.2) % 46) - 34: cada 20,9 s el    │
   │ módulo saltaba 45,8 unidades y la escena daba un corte seco a mitad de   │
   │ frase. Quitar ese módulo no basta: cualquier cambio de modo o de nodo    │
   │ volvería a asignar una posición nueva de golpe.                          │
   │                                                                          │
   │ Aquí la cámara NUNCA se asigna. Se declara un OBJETIVO (posición y punto │
   │ mirado) y el estado real lo persigue con suavizado exponencial ajustado  │
   │ por dt. Cambiar de modo, saltar de estación o entrar en órbita libre     │
   │ solo mueve el objetivo — el camino hasta él siempre es continuo. Es una  │
   │ garantía estructural, no una corrección puntual.                         │
   │                                                                          │
   │ Y el recorrido usa una Catmull-Rom CERRADA: da la vuelta el ÍNDICE de    │
   │ los puntos de control, no el parámetro. Al pasar del último waypoint al  │
   │ primero la curva ya es continua por construcción.                        │
   └──────────────────────────────────────────────────────────────────────────┘

   SALVAGUARDAS DE GPU (intactas desde FEAT-3D-01):
     · Tope determinista por vencimiento acumulado: 30 fps por defecto.
     · webglcontextlost / webglcontextrestored con reinicio controlado.
     · Pausa por visibilitychange Y por blur.
     · devicePixelRatio acotado a 1.75.
     · Cero creación de geometría, buffers o programas dentro del bucle.

   Sin `?.` ni `??` a propósito (lección P2.2): el código que muestra el
   mensaje de "no puedo" tiene que parsearse en el motor que no puede.
   ========================================================================== */

(function () {
  'use strict';

  /* ─── Configuración ───────────────────────────────────────────────────── */

  var ID_VIEWPORT = 'neural-matrix-viewport';
  var FPS_POR_DEFECTO = 30;
  var DPR_MAXIMO = 1.75;
  var MUESTRAS_CONDUCTO = 64;
  var LADOS_TUBO = 6;
  var RADIO_TUBO = 0.075;
  var PARTICULAS = 700;

  /* ─── LAS 5 ESTACIONES DEL SISTEMA ───────────────────────────────────────
     El núcleo emite; los cuatro periféricos forman un anillo a su alrededor.
     Las posiciones están elegidas para que ninguna etiqueta tape a otra desde
     los waypoints del recorrido. */
  var ESTACIONES = [
    { id: 'nucleo',   nombre: 'MIAMI DJ BEAT',                       subtitulo: 'Núcleo de Plataforma',
      pos: [0, 0, 0],         color: [1.00, 0.84, 0.45], hub: true,
      telemetria: 'Orquestando 4 subsistemas · enlace estable' },
    { id: 'crm',      nombre: 'Captura & CRM de Leads',              subtitulo: 'Entrada de Booking',
      pos: [-9.5, 2.2, -3.5], color: [0.45, 0.85, 1.00], hub: false,
      telemetria: 'Respuesta media a lead · termómetro de oportunidad' },
    { id: 'elixis',   nombre: 'ELIXIS — Agente Ejecutivo',           subtitulo: 'Orquestación IA',
      pos: [9.0, 3.4, -2.0],  color: [0.70, 0.55, 1.00], hub: false,
      telemetria: 'Negociación asistida · aprobación humana en el lazo' },
    { id: 'finanzas', nombre: 'Motor Financiero & Stripe',           subtitulo: 'Fintech & Escrow',
      pos: [7.2, -3.8, 5.5],  color: [0.40, 1.00, 0.70], hub: false,
      telemetria: 'Escrow y reparto automático · liquidación programada' },
    { id: 'booth',    nombre: 'Booth IA & Inteligencia Atmosférica', subtitulo: 'Telemetría de Escenario',
      pos: [-7.8, -3.2, 5.0], color: [1.00, 0.55, 0.45], hub: false,
      telemetria: 'Sonido, luz y clima en vivo · lectura por venue' }
  ];

  /* Conductos: el núcleo con cada periférico, y el anillo entre periféricos.
     Cuatro radiales + cuatro perimetrales = ocho fibras. */
  var ENLACES = [ [0,1],[0,2],[0,3],[0,4], [1,2],[2,3],[3,4],[4,1] ];

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
  var proximoDibujo = 0, t0 = 0, ultimoT = 0;
  var reducirMovimiento = false;

  /* Cámara: estado real (persigue) y objetivo (se declara). Nunca se asigna
     la posición directamente — ver la nota de cabecera. */
  var cam = { x: 0, y: 3, z: 26, mx: 0, my: 0, mz: 0 };
  var obj = { x: 0, y: 3, z: 26, mx: 0, my: 0, mz: 0 };
  var recorrido = { s: 0, activo: true, velocidad: 0.055 };
  var nodoEnfocado = -1;
  var orbita = 0;
  var rotacionLibre = false, giroRaton = { yaw: 0, pitch: 0 };

  var audioEl = null, ctxAudio = null, analizador = null, datosFrecuencia = null;
  var pulso = 0, banda = { graves: 0, medios: 0, agudos: 0 }, audioActivo = false;

  var stats = {
    cuadros: 0, saltados: 0, fps: 0, msCuadroJS: 0, msCuadroMax: 0,
    llamadasDibujo: 0, vertices: 0, instancias: 0,
    contextosPerdidos: 0, contextosRestaurados: 0, pausas: 0,
    estado: 'arrancando', saltoCamaraMax: 0
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

  /* COLUMNA-MAYOR, como manda WebGL y como las construyen perspectivaEn() y
     miraEn(). La versión anterior multiplicaba como si fueran fila-mayor: el
     render no se enteraba —el shader recibe uProy y uVista por separado y
     multiplica la GPU— pero _mvp salía transpuesta, y _mvp es justo lo único
     que se usa en JS para proyectar mundo → pantalla. Resultado medido:
     etiquetas en x=2474 sobre un viewport de 1920, o descartadas por estar
     "detrás de la cámara". El error se auto-confirmaba en FEAT-3D-02 porque
     la selección de nodos usaba la MISMA proyección para poner y para medir. */
  function multiplicarEn(o, a, b) {
    for (var c = 0; c < 4; c++) {
      var b0=b[c*4], b1=b[c*4+1], b2=b[c*4+2], b3=b[c*4+3];
      o[c*4]   = a[0]*b0 + a[4]*b1 + a[8]*b2  + a[12]*b3;
      o[c*4+1] = a[1]*b0 + a[5]*b1 + a[9]*b2  + a[13]*b3;
      o[c*4+2] = a[2]*b0 + a[6]*b1 + a[10]*b2 + a[14]*b3;
      o[c*4+3] = a[3]*b0 + a[7]*b1 + a[11]*b2 + a[15]*b3;
    }
    return o;
  }

  /* Mirar-hacia. Con giro libre se desvía el vector de vista sin mover la
     posición: se pasea la mirada sin perder el ancla del recorrido. */
  function miraEn(o, px, py, pz, tx, ty, tz, yawExtra, pitchExtra) {
    var fx = tx-px, fy = ty-py, fz = tz-pz;
    var lf = Math.sqrt(fx*fx+fy*fy+fz*fz) || 1; fx/=lf; fy/=lf; fz/=lf;
    if (yawExtra || pitchExtra) {
      var cy = Math.cos(yawExtra), sy = Math.sin(yawExtra);
      var rx = fx*cy + fz*sy, rz = -fx*sy + fz*cy;
      fx = rx; fz = rz; fy += pitchExtra;
      var l2 = Math.sqrt(fx*fx+fy*fy+fz*fz) || 1; fx/=l2; fy/=l2; fz/=l2;
    }
    var ux = 0, uy = 1, uz = 0;
    var sx = fy*uz - fz*uy, sy2 = fz*ux - fx*uz, sz = fx*uy - fy*ux;
    var ls = Math.sqrt(sx*sx+sy2*sy2+sz*sz) || 1; sx/=ls; sy2/=ls; sz/=ls;
    var vx = sy2*fz - sz*fy, vy = sz*fx - sx*fz, vz = sx*fy - sy2*fx;
    o[0]=sx; o[1]=vx; o[2]=-fx; o[3]=0;
    o[4]=sy2;o[5]=vy; o[6]=-fy; o[7]=0;
    o[8]=sz; o[9]=vz; o[10]=-fz;o[11]=0;
    o[12]=-(sx*px+sy2*py+sz*pz);
    o[13]=-(vx*px+vy*py+vz*pz);
    o[14]=  (fx*px+fy*py+fz*pz);
    o[15]=1;
    return o;
  }

  /* ─── Catmull-Rom ─────────────────────────────────────────────────────── */

  function crEje(p0, p1, p2, p3, t) {
    var t2 = t*t, t3 = t2*t;
    return 0.5 * ((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
  }

  /* CERRADA: da la vuelta el índice, no el parámetro. Por eso el paso del
     último punto al primero no tiene costura ni salto. */
  function curvaCerrada(pts, s, salida) {
    var n = pts.length;
    var i = Math.floor(s) % n; if (i < 0) i += n;
    var t = s - Math.floor(s);
    var p0 = pts[(i-1+n)%n], p1 = pts[i], p2 = pts[(i+1)%n], p3 = pts[(i+2)%n];
    salida[0] = crEje(p0[0], p1[0], p2[0], p3[0], t);
    salida[1] = crEje(p0[1], p1[1], p2[1], p3[1], t);
    salida[2] = crEje(p0[2], p1[2], p2[2], p3[2], t);
    return salida;
  }

  function curvaAbierta(pts, u, salida) {
    var tramos = pts.length - 1;
    var f = Math.min(u, 0.999999) * tramos;
    var i = Math.floor(f), t = f - i;
    var p0 = pts[i>0?i-1:0], p1 = pts[i], p2 = pts[i+1];
    var p3 = pts[i+2<pts.length?i+2:pts.length-1];
    salida[0] = crEje(p0[0], p1[0], p2[0], p3[0], t);
    salida[1] = crEje(p0[1], p1[1], p2[1], p3[1], t);
    salida[2] = crEje(p0[2], p1[2], p2[2], p3[2], t);
    return salida;
  }

  /* Un waypoint por estación periférica. 5.0 y no 9.0 de empuje: más lejos la
     red cabía en el tercio central del encuadre —una maqueta, no un sistema
     que recorres— y las etiquetas se solapaban entre sí. */
  var WAYPOINTS = [];
  function construirWaypoints() {
    WAYPOINTS = [];
    for (var i = 1; i < ESTACIONES.length; i++) {
      var p = ESTACIONES[i].pos;
      var l = Math.sqrt(p[0]*p[0] + p[2]*p[2]) || 1;
      WAYPOINTS.push([ p[0] + (p[0]/l)*5.0, p[1] + 2.6, p[2] + (p[2]/l)*5.0 ]);
    }
  }

  /* ─── Conductos (una sola vez, fundidos, indexados) ───────────────────── */

  function puntosDeEnlace(a, b) {
    var pa = ESTACIONES[a].pos, pb = ESTACIONES[b].pos;
    /* Un punto medio desplazado convierte la recta en fibra: los conductos
       rectos leen como diagrama técnico, no como tejido vivo. */
    var mx = (pa[0]+pb[0])/2, my = (pa[1]+pb[1])/2, mz = (pa[2]+pb[2])/2;
    var d = Math.sqrt(Math.pow(pb[0]-pa[0],2) + Math.pow(pb[1]-pa[1],2) + Math.pow(pb[2]-pa[2],2));
    var comba = d * 0.16;
    return [pa, [mx, my + comba, mz], [mx - comba*0.35, my + comba*0.5, mz + comba*0.35], pb];
  }

  function construirTubos() {
    var vert = [], idx = [], a = [0,0,0], b = [0,0,0], base = 0;

    for (var e = 0; e < ENLACES.length; e++) {
      var pts = puntosDeEnlace(ENLACES[e][0], ENLACES[e][1]);
      var ca = ESTACIONES[ENLACES[e][0]].color, cb = ESTACIONES[ENLACES[e][1]].color;

      for (var m = 0; m < MUESTRAS_CONDUCTO; m++) {
        var u = m / (MUESTRAS_CONDUCTO - 1);
        curvaAbierta(pts, u, a);
        curvaAbierta(pts, Math.min(0.9999, u + 0.006), b);
        var tx = b[0]-a[0], ty = b[1]-a[1], tz = b[2]-a[2];
        if (m === MUESTRAS_CONDUCTO - 1) { tx=-tx; ty=-ty; tz=-tz; }
        var lt = Math.sqrt(tx*tx+ty*ty+tz*tz) || 1; tx/=lt; ty/=lt; tz/=lt;

        var ux = 0, uy = 1, uz = 0;
        if (Math.abs(ty) > 0.94) { ux = 1; uy = 0; uz = 0; }
        var nx = ty*uz - tz*uy, ny = tz*ux - tx*uz, nz = tx*uy - ty*ux;
        var ln = Math.sqrt(nx*nx+ny*ny+nz*nz) || 1; nx/=ln; ny/=ln; nz/=ln;
        var bx = ty*nz - tz*ny, by = tz*nx - tx*nz, bz = tx*ny - ty*nx;

        /* El color viaja de una estación a la otra: el conducto dice de dónde
           sale y adónde llega sin necesidad de leyenda. */
        var cr = ca[0]+(cb[0]-ca[0])*u, cg = ca[1]+(cb[1]-ca[1])*u, cz = ca[2]+(cb[2]-ca[2])*u;

        for (var k = 0; k < LADOS_TUBO; k++) {
          var ang = (k / LADOS_TUBO) * Math.PI * 2;
          var cs = Math.cos(ang), sn = Math.sin(ang);
          var dx = nx*cs + bx*sn, dy = ny*cs + by*sn, dz = nz*cs + bz*sn;
          vert.push(a[0]+dx*RADIO_TUBO, a[1]+dy*RADIO_TUBO, a[2]+dz*RADIO_TUBO,
                    dx, dy, dz, cr, cg, cz, u, e);
        }
      }

      for (var sg = 0; sg < MUESTRAS_CONDUCTO - 1; sg++) {
        for (var q = 0; q < LADOS_TUBO; q++) {
          var q2 = (q+1) % LADOS_TUBO;
          var f0 = base + sg*LADOS_TUBO + q,     f1 = base + sg*LADOS_TUBO + q2;
          var f2 = base + (sg+1)*LADOS_TUBO + q, f3 = base + (sg+1)*LADOS_TUBO + q2;
          idx.push(f0, f2, f1, f1, f2, f3);
        }
      }
      base += MUESTRAS_CONDUCTO * LADOS_TUBO;
    }

    conteoVerticesTubos = vert.length / 11;
    indicesTubos = idx.length;
    return { vertices: new Float32Array(vert), indices: new Uint16Array(idx) };
  }

  function construirNodos() {
    var d = new Float32Array(ESTACIONES.length * 9);
    for (var i = 0; i < ESTACIONES.length; i++) {
      var o = i*9, e = ESTACIONES[i];
      d[o]=e.pos[0]; d[o+1]=e.pos[1]; d[o+2]=e.pos[2];
      d[o+3]=e.color[0]; d[o+4]=e.color[1]; d[o+5]=e.color[2];
      d[o+6]= e.hub ? 1.25 : 0.80;      // el núcleo domina la escena
      d[o+7]= e.hub ? 1.30 : 1.00;
      d[o+8]= i;
    }
    return d;
  }

  function construirParticulas() {
    var d = new Float32Array(PARTICULAS * 9);
    for (var i = 0; i < PARTICULAS; i++) {
      var o = i*9;
      d[o]   = (Math.random()-0.5) * 34;
      d[o+1] = (Math.random()-0.5) * 20;
      d[o+2] = (Math.random()-0.5) * 34;
      d[o+3] = 0.75; d[o+4] = 0.85; d[o+5] = 1.0;
      d[o+6] = 0.026 + Math.random()*0.030;
      /* Ambiente y solo ambiente: jamás compite en brillo con las estaciones.
         Jerarquía de keynote — estaciones → conductos → fondo. */
      d[o+7] = 0.028 + Math.random()*0.060;
      d[o+8] = -1;
    }
    return d;
  }

  var QUAD = new Float32Array([-1,-1,  1,-1,  -1,1,  1,1]);

  /* ─── Shaders ─────────────────────────────────────────────────────────── */

  var VERT_TUBOS = [
    'precision mediump float;',
    'attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;',
    'attribute float aRecorrido; attribute float aEnlace;',
    'uniform mat4 uProy; uniform mat4 uVista; uniform float uTiempo; uniform float uPulso;',
    'varying vec3 vColor; varying float vBrillo; varying float vBorde;',
    'void main(){',
    '  vec4 posVista = uVista * vec4(aPos, 1.0);',
    /* Normal en espacio de vista: su componente Z dice cuánto mira hacia la
       cámara. Cerca de 0 estamos viendo el tubo de canto — ahí es donde un
       material translúcido se ve más denso. Es un Fresnel de dos líneas. */
    '  vec3 nVista = normalize((uVista * vec4(aNormal, 0.0)).xyz);',
    '  vBorde = 1.0 - abs(nVista.z);',
    '  float fase = fract(uTiempo * 0.22 + aEnlace * 0.17);',
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
    aTubos.enlace = gl.getAttribLocation(progTubos, 'aEnlace');
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
    stats.instancias = ESTACIONES.length + PARTICULAS;
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

  /* ─── CÁMARA: se declara el objetivo, nunca se asigna la posición ─────── */

  function actualizarObjetivoCamara(dt) {
    if (nodoEnfocado >= 0) {
      /* ENFOQUE: órbita lenta alrededor de la estación elegida. Manda el
         discurso, así que la cámara se mueve lo justo para dar volumen.
         15/11 y no 13/8,5: más cerca, el nodo llenaba el encuadre y los
         conductos vistos casi de canto se saturaban a blanco con la mezcla
         aditiva. Desde aquí la estación se lee entera, con su color, y el
         resto del sistema queda de contexto detrás. */
      var e = ESTACIONES[nodoEnfocado];
      orbita += dt * (recorrido.activo ? 0.22 : 0.06);
      var radio = e.hub ? 15.0 : 11.0;
      obj.x = e.pos[0] + Math.cos(orbita) * radio;
      obj.y = e.pos[1] + 2.6;
      obj.z = e.pos[2] + Math.sin(orbita) * radio;
      obj.mx = e.pos[0]; obj.my = e.pos[1]; obj.mz = e.pos[2];
    } else {
      /* RECORRIDO: el parámetro crece sin límite y solo el índice da la
         vuelta, así que no hay discontinuidad posible al cerrar el ciclo. */
      if (recorrido.activo) recorrido.s += dt * recorrido.velocidad * WAYPOINTS.length;
      curvaCerrada(WAYPOINTS, recorrido.s, _p);
      obj.x = _p[0]; obj.y = _p[1]; obj.z = _p[2];
      /* Se mira siempre al núcleo: ancla estable, sin el mareo de un punto de
         mira que va saltando de objeto en objeto. */
      obj.mx = 0; obj.my = 0; obj.mz = 0;
    }
  }

  /* Suavizado exponencial ajustado por dt: el mismo recorrido a 30 y a 60 fps.
     Sin el ajuste, subir el tope aceleraría la cámara. */
  function perseguir(dt) {
    var k = 1 - Math.pow(0.0025, dt);
    var aX = cam.x, aY = cam.y, aZ = cam.z;
    cam.x += (obj.x - cam.x) * k;
    cam.y += (obj.y - cam.y) * k;
    cam.z += (obj.z - cam.z) * k;
    cam.mx += (obj.mx - cam.mx) * k;
    cam.my += (obj.my - cam.my) * k;
    cam.mz += (obj.mz - cam.mz) * k;
    var salto = Math.sqrt(Math.pow(cam.x-aX,2) + Math.pow(cam.y-aY,2) + Math.pow(cam.z-aZ,2));
    if (salto > stats.saltoCamaraMax) stats.saltoCamaraMax = salto;
  }

  /* ─── Dibujo ──────────────────────────────────────────────────────────── */

  function dibujarEscena(t) {
    var aspecto = lienzo.width / Math.max(1, lienzo.height);
    perspectivaEn(_proy, 1.15, aspecto, 0.1, 200.0);
    miraEn(_vista, cam.x, cam.y, cam.z, cam.mx, cam.my, cam.mz, giroRaton.yaw, giroRaton.pitch);
    multiplicarEn(_mvp, _proy, _vista);

    gl.clear(gl.COLOR_BUFFER_BIT);
    stats.llamadasDibujo = 0;

    gl.useProgram(progTubos);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufTubos);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIndices);
    var zt = 11*4;
    gl.enableVertexAttribArray(aTubos.pos);       gl.vertexAttribPointer(aTubos.pos, 3, gl.FLOAT, false, zt, 0);
    gl.enableVertexAttribArray(aTubos.normal);    gl.vertexAttribPointer(aTubos.normal, 3, gl.FLOAT, false, zt, 12);
    gl.enableVertexAttribArray(aTubos.color);     gl.vertexAttribPointer(aTubos.color, 3, gl.FLOAT, false, zt, 24);
    gl.enableVertexAttribArray(aTubos.recorrido); gl.vertexAttribPointer(aTubos.recorrido, 1, gl.FLOAT, false, zt, 36);
    gl.enableVertexAttribArray(aTubos.enlace);    gl.vertexAttribPointer(aTubos.enlace, 1, gl.FLOAT, false, zt, 40);
    gl.uniformMatrix4fv(uTubos.proy, false, _proy);
    gl.uniformMatrix4fv(uTubos.vista, false, _vista);
    gl.uniform1f(uTubos.tiempo, t);
    gl.uniform1f(uTubos.pulso, pulso);
    gl.drawElements(gl.TRIANGLES, indicesTubos, gl.UNSIGNED_SHORT, 0);
    stats.llamadasDibujo++;

    if (modoInstancing === 'ninguno') return;

    gl.useProgram(progInstancias);
    gl.uniformMatrix4fv(uInst.proy, false, _proy);
    gl.uniformMatrix4fv(uInst.vista, false, _vista);
    gl.uniform1f(uInst.tiempo, t);
    gl.uniform1f(uInst.pulso, pulso);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
    gl.enableVertexAttribArray(aInst.quad);
    gl.vertexAttribPointer(aInst.quad, 2, gl.FLOAT, false, 0, 0);
    fijarDivisor(aInst.quad, 0);

    dibujarLote(bufParticulas, PARTICULAS, -1);
    dibujarLote(bufNodos, ESTACIONES.length, nodoEnfocado);
  }

  function dibujarLote(buf, cuantas, activo) {
    var zi = 9*4;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(aInst.pos);        gl.vertexAttribPointer(aInst.pos, 3, gl.FLOAT, false, zi, 0);
    gl.enableVertexAttribArray(aInst.color);      gl.vertexAttribPointer(aInst.color, 3, gl.FLOAT, false, zi, 12);
    gl.enableVertexAttribArray(aInst.radio);      gl.vertexAttribPointer(aInst.radio, 1, gl.FLOAT, false, zi, 24);
    gl.enableVertexAttribArray(aInst.intensidad); gl.vertexAttribPointer(aInst.intensidad, 1, gl.FLOAT, false, zi, 28);
    gl.enableVertexAttribArray(aInst.indice);     gl.vertexAttribPointer(aInst.indice, 1, gl.FLOAT, false, zi, 32);
    fijarDivisor(aInst.pos,1); fijarDivisor(aInst.color,1); fijarDivisor(aInst.radio,1);
    fijarDivisor(aInst.intensidad,1); fijarDivisor(aInst.indice,1);
    gl.uniform1f(uInst.activo, activo);
    if (dibujarInstanciado(gl.TRIANGLE_STRIP, 0, 4, cuantas)) stats.llamadasDibujo++;
  }

  /* ─── Etiquetas permanentes ───────────────────────────────────────────── */

  var etiquetas = [];

  function construirEtiquetas() {
    var capa = document.querySelector('[data-nm3d-etiquetas]');
    if (!capa) return;
    capa.innerHTML = '';
    etiquetas = [];
    for (var i = 0; i < ESTACIONES.length; i++) {
      var e = ESTACIONES[i];
      var el = document.createElement('div');
      el.className = 'nm3d-etiqueta' + (e.hub ? ' nm3d-etiqueta--nucleo' : '');
      var b = document.createElement('b'); b.textContent = e.nombre;
      var sp = document.createElement('span'); sp.textContent = e.subtitulo;
      el.appendChild(b); el.appendChild(sp);
      el.style.setProperty('--color', 'rgb(' + Math.round(e.color[0]*255) + ',' + Math.round(e.color[1]*255) + ',' + Math.round(e.color[2]*255) + ')');
      capa.appendChild(el);
      etiquetas.push(el);
    }
  }

  function colocarEtiquetas() {
    if (!etiquetas.length) return;
    var w = contenedor.clientWidth, h = contenedor.clientHeight;
    for (var i = 0; i < ESTACIONES.length; i++) {
      var p = ESTACIONES[i].pos, el = etiquetas[i];
      var cx = _mvp[0]*p[0] + _mvp[4]*p[1] + _mvp[8]*p[2]  + _mvp[12];
      var cy = _mvp[1]*p[0] + _mvp[5]*p[1] + _mvp[9]*p[2]  + _mvp[13];
      var cw = _mvp[3]*p[0] + _mvp[7]*p[1] + _mvp[11]*p[2] + _mvp[15];
      if (cw <= 0.05) { el.style.opacity = '0'; continue; }   // detrás de la cámara
      var sx = (cx/cw * 0.5 + 0.5) * w, sy = (1 - (cy/cw * 0.5 + 0.5)) * h;
      /* Se coloca con transform y no con left/top: left/top invalidan el
         layout en cada cuadro; transform solo compone. */
      el.style.transform = 'translate3d(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px,0) translate(-50%,-150%)';
      var op = Math.max(0.30, Math.min(1, 26 / cw));
      el.style.opacity = (i === nodoEnfocado ? 1 : op).toFixed(2);
    }
  }

  /* ─── Bucle ───────────────────────────────────────────────────────────── */

  function cuadro(ahora) {
    if (!capaz || !corriendo) return;
    requestAnimationFrame(cuadro);

    if (ahora < proximoDibujo) { stats.saltados++; return; }
    proximoDibujo += msPorCuadro;
    if (proximoDibujo < ahora) proximoDibujo = ahora + msPorCuadro;

    var t = (ahora - t0) / 1000;
    var dt = Math.min(0.1, Math.max(0.001, t - ultimoT));
    ultimoT = t;

    var inicio = performance.now();
    try {
      if (gl.isContextLost && gl.isContextLost()) return;
      leerAudio();
      actualizarObjetivoCamara(dt);
      perseguir(dt);
      dibujarEscena(t);
      colocarEtiquetas();
    } catch (e) {
      corriendo = false;
      stats.estado = 'error de dibujo';
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

  function pausarMotor(motivo) {
    if (!corriendo) return;
    corriendo = false; stats.pausas++; stats.estado = 'en pausa (' + motivo + ')';
    actualizarHud();
  }

  function reanudarMotor() {
    if (!capaz || corriendo || degradado) return;
    if (document.hidden) return;
    corriendo = true; stats.estado = 'en marcha';
    proximoDibujo = performance.now();
    ultimoT = (performance.now() - t0) / 1000;
    requestAnimationFrame(cuadro);
    actualizarHud();
  }

  function alPerderContexto(e) {
    e.preventDefault();
    corriendo = false; degradado = true;
    stats.contextosPerdidos++; stats.estado = 'contexto WebGL perdido';
    liberarEscena();
    if (contenedor) contenedor.classList.add('nm3d--degradado');
    actualizarHud();
  }

  function alRestaurarContexto() {
    stats.contextosRestaurados++; stats.estado = 'restaurando';
    try {
      construirEscena(); redimensionar();
      degradado = false;
      if (contenedor) contenedor.classList.remove('nm3d--degradado');
      t0 = performance.now(); ultimoT = 0;
      reanudarMotor();
    } catch (err) { mostrarFallback('no se pudo reinicializar tras recuperar el contexto'); }
    actualizarHud();
  }

  /* ─── CONTROLES DE ESCENARIO ──────────────────────────────────────────── */

  function irANodo(i) {
    nodoEnfocado = ((i % ESTACIONES.length) + ESTACIONES.length) % ESTACIONES.length;
    orbita = 0;
    actualizarHud();
  }

  function siguienteNodo(paso) {
    if (nodoEnfocado < 0) { irANodo(paso > 0 ? 0 : ESTACIONES.length - 1); return; }
    irANodo(nodoEnfocado + paso);
  }

  function volverAlRecorrido() { nodoEnfocado = -1; actualizarHud(); }

  function alternarPausaRecorrido() {
    recorrido.activo = !recorrido.activo;
    stats.estado = recorrido.activo ? 'en marcha' : 'recorrido en pausa';
    actualizarHud();
  }

  function alternarRotacionLibre() {
    rotacionLibre = !rotacionLibre;
    if (!rotacionLibre) { giroRaton.yaw = 0; giroRaton.pitch = 0; }
    if (contenedor) contenedor.classList.toggle('nm3d--giro-libre', rotacionLibre);
    actualizarHud();
  }

  function alternarPantallaCompleta() {
    try {
      if (!document.fullscreenElement) {
        var pr = document.documentElement.requestFullscreen();
        if (pr && pr['catch']) pr['catch'](function () { /* el navegador puede negarlo */ });
      } else { document.exitFullscreen(); }
    } catch (e) { /* sin API de pantalla completa */ }
  }

  function instalarControles() {
    /* El listener va en window, no en el lienzo: en escenario el foco puede
       estar en cualquier parte del documento y el clicker manda pulsaciones
       sin que nadie haya hecho clic antes en el visor. */
    window.addEventListener('keydown', function (ev) {
      var k = ev.key;
      if (k === ' ' || ev.code === 'Space') { ev.preventDefault(); alternarPausaRecorrido(); return; }
      if (k === 'ArrowRight') { ev.preventDefault(); siguienteNodo(1); return; }
      if (k === 'ArrowLeft')  { ev.preventDefault(); siguienteNodo(-1); return; }
      if (k === 'r' || k === 'R') { alternarRotacionLibre(); return; }
      if (k === 'f' || k === 'F') { alternarPantallaCompleta(); return; }
      if (k === 'Escape') { volverAlRecorrido(); return; }
      if (k === 'd' || k === 'D') { document.body.classList.toggle('nm3d-depurar'); return; }
    });

    contenedor.addEventListener('pointermove', function (e) {
      if (!rotacionLibre) return;
      var r = contenedor.getBoundingClientRect();
      var nx = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
      var ny = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
      giroRaton.yaw = nx * 1.6;
      giroRaton.pitch = -ny * 0.8;
    }, { passive: true });

    var botones = document.querySelectorAll('[data-nm3d-fps-set]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].addEventListener('click', function (e) {
        var v = parseInt(e.currentTarget.getAttribute('data-nm3d-fps-set'), 10);
        if (v !== 30 && v !== 60) return;
        topeFps = v; msPorCuadro = 1000/v; proximoDibujo = performance.now(); stats.msCuadroMax = 0;
        var todos = document.querySelectorAll('[data-nm3d-fps-set]');
        for (var j = 0; j < todos.length; j++) todos[j].setAttribute('aria-pressed', todos[j] === e.currentTarget ? 'true' : 'false');
        actualizarHud();
      });
    }

    var btnAudio = document.querySelector('[data-nm3d-audio-toggle]');
    if (btnAudio) {
      btnAudio.addEventListener('click', function () {
        if (audioActivo) { desactivarAudio(); btnAudio.setAttribute('aria-pressed','false'); btnAudio.textContent = 'Audio'; return; }
        btnAudio.disabled = true;
        activarAudio().then(function (r) {
          btnAudio.disabled = false;
          btnAudio.setAttribute('aria-pressed', audioActivo ? 'true' : 'false');
          btnAudio.textContent = audioActivo ? 'Silenciar' : 'Audio';
          if (!audioActivo) { stats.estado = r; actualizarHud(); }
        });
      });
    }
  }

  /* ─── HUD ─────────────────────────────────────────────────────────────── */

  function actualizarHud() {
    var e = nodoEnfocado >= 0 ? ESTACIONES[nodoEnfocado] : null;
    var pon = function (sel, txt) { var n = document.querySelector(sel); if (n) n.textContent = txt; };

    pon('[data-nm3d-estacion]', e ? e.nombre : 'Recorrido completo');
    pon('[data-nm3d-subtitulo]', e ? e.subtitulo : 'Sistema de booking 2026-2030');
    pon('[data-nm3d-telemetria]', e ? e.telemetria : '5 estaciones · 8 conductos activos');
    pon('[data-nm3d-conexion]', audioActivo ? 'En vivo' : 'Enlace estable');

    var modo = document.querySelector('[data-nm3d-modo]');
    if (modo) {
      modo.textContent = rotacionLibre ? 'Órbita libre'
        : (!recorrido.activo ? 'Pausado'
        : (nodoEnfocado >= 0 ? 'Enfoque' : 'Recorrido'));
    }

    /* Depuración: solo con la tecla D. En escenario no se proyecta. */
    pon('[data-nm3d-fps]', stats.fps + ' / ' + topeFps);
    pon('[data-nm3d-dibujo]', stats.llamadasDibujo + ' llamadas');
    pon('[data-nm3d-vertices]', stats.vertices.toLocaleString('es'));
    pon('[data-nm3d-instancias]', stats.instancias.toLocaleString('es'));
    pon('[data-nm3d-js]', stats.msCuadroJS.toFixed(2) + ' ms');
    pon('[data-nm3d-salto]', stats.saltoCamaraMax.toFixed(3) + ' u');
    pon('[data-nm3d-estadotec]', stats.estado);

    var barra = document.querySelector('[data-nm3d-barra]');
    if (barra) barra.style.transform = 'scaleX(' + Math.min(1, pulso/1.2).toFixed(3) + ')';

    for (var i = 0; i < etiquetas.length; i++) {
      etiquetas[i].setAttribute('data-activa', i === nodoEnfocado ? 'si' : 'no');
    }
  }

  /* ─── Arranque ────────────────────────────────────────────────────────── */

  function iniciar() {
    contenedor = document.getElementById(ID_VIEWPORT);
    if (!contenedor) return;

    try { reducirMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { reducirMovimiento = false; }
    if (reducirMovimiento) recorrido.activo = false;

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

    construirWaypoints();
    try { construirEscena(); }
    catch (e) { mostrarFallback('no se pudo compilar el motor gráfico'); return; }

    capaz = true;
    redimensionar();
    construirEtiquetas();
    instalarControles();

    /* La cámara nace ya sobre el primer waypoint: si naciera lejos, el primer
       cuadro sería un barrido largo que parece un fallo de carga. */
    curvaCerrada(WAYPOINTS, 0, _p);
    cam.x = obj.x = _p[0]; cam.y = obj.y = _p[1]; cam.z = obj.z = _p[2];
    cam.mx = obj.mx = 0; cam.my = obj.my = 0; cam.mz = obj.mz = 0;

    window.addEventListener('resize', redimensionar, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pausarMotor('pestaña oculta'); else reanudarMotor();
    });
    window.addEventListener('blur', function () { pausarMotor('ventana en segundo plano'); });
    window.addEventListener('focus', reanudarMotor);

    t0 = performance.now(); ultimoT = 0;
    reanudarMotor();
    actualizarHud();
  }

  window.mdjNeuralMatrix3D = {
    stats: function () {
      var c = {};
      for (var k in stats) { if (Object.prototype.hasOwnProperty.call(stats, k)) c[k] = stats[k]; }
      c.topeFps = topeFps; c.capaz = capaz; c.corriendo = corriendo; c.degradado = degradado;
      c.instancing = modoInstancing; c.audioActivo = audioActivo; c.pulso = pulso;
      c.banda = { graves: banda.graves, medios: banda.medios, agudos: banda.agudos };
      c.estaciones = ESTACIONES.length; c.nodoEnfocado = nodoEnfocado;
      c.recorridoActivo = recorrido.activo; c.rotacionLibre = rotacionLibre;
      c.camara = { x: +cam.x.toFixed(3), y: +cam.y.toFixed(3), z: +cam.z.toFixed(3) };
      return c;
    },
    fijarFps: function (v) { if (v === 30 || v === 60) { topeFps = v; msPorCuadro = 1000/v; proximoDibujo = performance.now(); stats.msCuadroMax = 0; } },
    pausar: function () { pausarMotor('petición externa'); },
    reanudar: reanudarMotor,
    activarAudio: activarAudio,
    desactivarAudio: desactivarAudio,
    irANodo: irANodo,
    siguienteNodo: siguienteNodo,
    volverAlRecorrido: volverAlRecorrido,
    alternarPausaRecorrido: alternarPausaRecorrido,
    alternarRotacionLibre: alternarRotacionLibre,
    estaciones: function () {
      return ESTACIONES.map(function (e) { return { nombre: e.nombre, subtitulo: e.subtitulo, hub: e.hub }; });
    },
    reiniciarSaltoMax: function () { stats.saltoCamaraMax = 0; },
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
