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
  /* 0.038, la mitad de 0.075. A ese grosor los conductos leían como mangueras;
     ahora son filamentos. Con el rescoldo al 25 % y el solitón largo, la fibra
     delgada mantiene la sensación de corriente continua sin convertirse en una
     banda luminosa que se come el encuadre. */
  /* Adelgazados "un chin" más (0.038 → 0.030, un 21 % menos) por decisión del
     PO: los conductos del sistema y los filamentos de la red neuronal exterior
     no deben leerse del mismo calibre. Estos bajan un poco, aquellos suben un
     poco, y la diferencia entre ambos se mantiene — no se igualan. */
  var RADIO_TUBO = 0.030;
  var PARTICULAS = 700;
  /* El nodo del núcleo mide 1.25 de radio; un Fénix de 6 unidades de punta a
     punta lo tapaba a él y a media escena. A 0.58 el ave enmarca el núcleo en
     vez de sustituirlo, que es lo que se le pide a un emblema. */

  /* ─── LAS 5 ESTACIONES DEL SISTEMA ───────────────────────────────────────
     El núcleo emite; los cuatro periféricos forman un anillo a su alrededor.
     Las posiciones están elegidas para que ninguna etiqueta tape a otra desde
     los waypoints del recorrido. */
  var ESTACIONES = [
    { id: 'nucleo',   nombre: 'MIAMI DJ BEAT — Hub Fénix',            subtitulo: 'Núcleo de Plataforma',
      pos: [0, 0, 0],         color: [1.00, 0.84, 0.45], hub: true,
      telemetria: 'Orquestando 4 subsistemas · enlace estable',
      slot: 'fenix-en-vuelo',
      narracion: 'El núcleo de la plataforma. Desde aquí Miami DJ Beat orquesta los cuatro subsistemas del negocio: la captura de clientes, el agente ejecutivo, el motor financiero y la cabina inteligente.',
      hud: { titulo: 'NÚCLEO FÉNIX', lineas: [
        ['EMBLEMA',    'corporativo · aros concéntricos'],
        ['SUBSISTEMAS','4 enlazados · 8 conductos'],
        ['ESTADO',     'nominal']
      ] } },
    { id: 'crm',      nombre: 'Captura & CRM de Leads',              subtitulo: 'Entrada de Booking',
      pos: [-9.5, 2.2, -3.5], color: [0.45, 0.85, 1.00], hub: false,
      telemetria: 'Sobres de correo energético en tránsito · termómetro de oportunidad',
      slot: 'paquetes-correo',
      narracion: 'Captura y gestión de clientes. Cada solicitud entra, se clasifica y recibe una cotización automática según el tipo de evento, sin que nadie tenga que teclearla.',
      hud: { titulo: 'CRM & CONTRATACIONES', lineas: [
        ['FLUJO',      'eventos entrantes en tránsito'],
        ['COTIZACIÓN', 'automática por tipo de evento'],
        ['SEGUIMIENTO','termómetro de oportunidad']
      ] } },
    { id: 'elixis',   nombre: 'ELIXIS — Agente Ejecutivo',           subtitulo: 'Orquestación IA',
      pos: [9.0, 3.4, -2.0],  color: [0.70, 0.55, 1.00], hub: false,
      telemetria: 'Negociación asistida · aprobación humana en el lazo',
      slot: 'avatar-audifonos',
      narracion: 'Soy Elixis, el agente ejecutivo. Negocio, preparo propuestas y coordino la cabina, pero ninguna decisión sensible se ejecuta sin aprobación humana.',
      hud: { titulo: 'ELIXIS AI CORE', lineas: [
        ['ASISTENTE', 'autónomo · negociación asistida'],
        ['CABINA',    'gestión y turnos'],
        ['CONTROL',   'aprobación humana en el lazo']
      ] } },
    { id: 'finanzas', nombre: 'Motor Financiero & Stripe',           subtitulo: 'Fintech & Escrow',
      pos: [7.2, -3.8, 5.5],  color: [0.40, 1.00, 0.70], hub: false,
      telemetria: 'Pulsos de liquidación y contratos · escrow con reparto automático',
      slot: 'contratos',
      narracion: 'Motor financiero. Los depósitos quedan en custodia hasta el evento y el reparto se liquida solo, con el contrato firmado y versionado detrás.',
      hud: { titulo: 'SMART CONTRACTS & STRIPE', lineas: [
        ['DEPÓSITOS', 'en custodia (escrow)'],
        ['REPARTO',   'automático al cierre'],
        ['CONTRATOS', 'firmados y versionados']
      ] } },
    /* NOMBRE REAL, NO INVENTADO. Esta estación se llamó durante un tiempo
       «Booth IA & Inteligencia Atmosférica», que no era el nombre de nada:
       fundía dos zonas distintas de la plataforma —The AI Booth (booth.html)
       y DJ Tools (dj-tools.html)— y encima añadía un término que no existe.

       Rótulo fijado por el PO: título MDJPRO, y debajo «espacio de trabajo
       para DJ». El producto da nombre a la estación; DJ Tools es el slot de la
       barra donde se llega a él, no el rótulo de escenario.

       El texto de apoyo sigue tomado de la propia dj-tools.html: Load Root,
       Library Cleaning, Smart Crates y Booth Assistant son funciones que la
       página anuncia de verdad.

       Regla que deja esto: los rótulos de escenario se COPIAN de la plataforma
       o los dicta el PO. Inventarlos delante de directores de venue es peor que
       dejarlos vacíos. */
    { id: 'mdjpro',   nombre: 'MDJPRO',                             subtitulo: 'Espacio de Trabajo para DJ',
      pos: [-7.8, -3.2, 5.0], color: [1.00, 0.55, 0.45], hub: false,
      telemetria: 'Load Root · Library Cleaning · Smart Crates · Booth Assistant',
      slot: 'mdjpro-herramientas',
      /* El nombre completo se dice una vez, en voz alta, la primera vez que se
         nombra: en un keynote la sigla sola no significa nada para quien no la
         conoce. Es el nombre oficial del manual, no una glosa mía. */
      narracion: 'MDJPRO, Magic DJ Pro: el espacio de trabajo para DJ. Es la aplicación que el DJ descarga a su propio ordenador para agilizar el trabajo: limpia la librería, ordena los crates y deja la cabina lista antes del evento.',
      hud: { titulo: 'MDJPRO', lineas: [
        ['LIBRERÍA', 'Load Root · limpieza'],
        ['CRATES',   'Smart Crates'],
        ['CABINA',   'Booth Assistant']
      ] } }
  ];

  /* SLOTS DE BRANDING — preparados, no ocupados.
     Cada estación declara qué holograma le corresponde (el Fénix en vuelo del
     núcleo, el avatar con audífonos de ELIXIS…). Hoy el motor solo reserva el
     campo y lo expone en la API: montar texturas o vídeo holográfico es un
     ticket propio, con su presupuesto de GPU y su medición. Declararlo aquí
     evita que mañana cada slot se invente en un sitio distinto. */

  /* Conductos: el núcleo con cada periférico, y el anillo entre periféricos.
     Cuatro radiales + cuatro perimetrales = ocho fibras. */
  var ENLACES = [ [0,1],[0,2],[0,3],[0,4], [1,2],[2,3],[3,4],[4,1] ];

  /* ─── Estado ──────────────────────────────────────────────────────────── */

  var contenedor = null, lienzo = null, gl = null, esWebGL2 = false;
  var extPerdidaContexto = null, extInstancing = null, modoInstancing = 'ninguno';

  var progTubos = null, progInstancias = null;
  var bufTubos = null, bufIndices = null, bufQuad = null, bufNodos = null, bufParticulas = null;
  var indicesTubos = 0, conteoVerticesTubos = 0;
  var progRed = null, bufRed = null, aRed = {}, uRed = {}, conteoVerticesRed = 0;
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
  /* 0.0275 y no 0.055: a la velocidad anterior el vuelo daba la vuelta a las
     cuatro estaciones en ~27 s y se sentía a 128 BPM — ritmo de pista, no de
     ponencia. A la mitad el recorrido dura ~54 s y deja hablar encima. */
  var recorrido = { s: 0, activo: true, velocidad: 0.0275 };

  /* ENCUADRE 60/40. La estación enfocada no va centrada: se coloca al 60 %
     del ancho, dejando libre el 40 % izquierdo para el holograma de la
     llamada. Se consigue desplazando el PUNTO MIRADO hacia la izquierda de la
     estación; la cámara gira un poco y la estación se va a la derecha sola.
     0.2 en coordenadas normalizadas es exactamente ese 10 % de desvío desde
     el centro (de 50 % a 60 %). */
  var DESVIO_ENCUADRE = 0.20;
  var nodoEnfocado = -1;
  var orbita = 0;
  var rotacionLibre = false, giroRaton = { yaw: 0, pitch: 0 };
  /* Visibilidad del holograma: 0 oculto, 1 presente. No es un booleano porque
     la aparición y el fundido tienen que ser continuos como todo lo demás. */
  var visHolograma = 0;
  var progLogo = null, aLogo = {}, uLogo = {};

  /* ─── EMBLEMAS DE MARCA ANCLADOS A ESTACIONES ────────────────────────────
     Antes había un solo emblema y su estación iba cableada a fuego en el pase
     de dibujo. Se convierte en tabla porque ya son dos y el criterio de cuál
     va dónde es de NEGOCIO, no de render: cada marca se pone donde vive.

       · núcleo (0) → emblema Fénix corporativo.
       · booth  (4) → MDJPRO, que es la app que los DJ rentan para trabajar.
                      La narración de esa estación ya lo decía; faltaba verlo.

     'tam' es el semiancho en unidades de mundo. El núcleo va más grande a
     propósito: es el hub y tiene que dominar el encuadre.

     ─── JERARQUÍA DE MARCA (regla del PO, no negociable) ──────────────────
     EL CENTRO ES EL CEREBRO FÉNIX Y NO LO DISPUTA NADIE. Un segundo emblema
     encendido al mismo brillo las 24 horas convierte la escena en dos centros
     compitiendo, que es exactamente lo que esta regla prohíbe. MDJPRO vive en
     reposo y SOLO cobra protagonismo cuando el recorrido llega a su estación.

     La regla se codifica en dos números por emblema, no en un 'if' suelto:
       · 'base'   — presencia en reposo, sin que nadie lo mire.
       · 'realce' — cuánto SUMA al recibir el foco. base + realce ≤ 1.
       · 'crece'  — cuánto engorda el billboard al recibir el foco.

     El núcleo lleva realce 0 y crece 0 a propósito: es constante, no respira
     con el foco ni se encoge cuando miras a otro lado. Ese cero ES la regla.
     MDJPRO arranca en 0.38 y solo alcanza el 1.0 cuando le toca su turno. */
  var EMBLEMAS = [
    { estacion: 0, archivo: './assets/branding/fenix-emblem-160.png',
      tam: 1.35, base: 1.00, realce: 0.00, crece: 0.00, prom: 1, tex: null, lista: false },
    /* Este es el ICONO OFICIAL de la app nativa, copiado del proyecto macOS
       (Assets.xcassets/AppIcon.appiconset/icon_512x512@2x.png). Se prefiere al
       antiguo mdj_logo.png por dos razones medidas, no de gusto:
         · aquel llevaba un bloque de texto «MDJPRO» diminuto en una esquina,
           ilegible a escala de billboard y puro ruido en proyector;
         · la marca ocupa más lienzo (78 % transparente frente a 72 %), así que
           se lee más grande sin subir 'tam'.
       Alfa verificado: esquinas a 0, borde verde (78,207,76), sin mate blanco
       —que en mezcla aditiva se convertiría en resplandor. Se conserva el 1024
       y no el 512 porque en un proyector 4K el billboard ronda los 500 px. */
    { estacion: 4, archivo: './assets/branding/mdjpro-appicon-1024.png',
      tam: 0.95, base: 0.38, realce: 0.62, crece: 0.30, prom: 0, tex: null, lista: false }
  ];
  var progHolo = null, bufHolo = null, aHolo = {}, uHolo = {};

  var audioEl = null, ctxAudio = null, analizador = null, datosFrecuencia = null;
  var fuenteMusica = null, fuenteMic = null, micStream = null, micActivo = false;
  /* Ganancia propia de la música: es la que se agacha cuando se abre el micro.
     Va en un GainNode y no en audioEl.volume porque las rampas de Web Audio
     son exactas al sample; con volume habría que animarlas desde un temporizador
     de JS, que ni suena igual ni cae en el mismo reloj que el audio. */
  var ganMusica = null, vozActiva = 0, vozHablando = false;
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
  /* Punto reutilizado por las curvas. Asignarlo aquí y no dentro del cuadro es
     la diferencia entre cero basura y treinta recolecciones por segundo. */
  var _p = [0, 0, 0];

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
      /* PALETA DORADO/CIAN POR FAMILIAS, NO POR INTERPOLACIÓN. Mezclar
         #ffd700 con #00f5ff pasa por el VERDE en el punto medio, y un cielo
         de puntos verdosos rompe el idioma cromático de la escena. Así que
         cada partícula pertenece a una de las dos familias y solo varía
         dentro de ella. Es el mismo criterio que ya rige los conductos. */
      /* COLORES DE MARCA EXACTOS, sin desviación. Antes llevaban un jitter que
         metía 0.30 de rojo en el cian y 0.38 de azul en el oro: eso lava el
         tono y los deja lechosos en vez de nítidos. La variación se consigue
         con la intensidad, no ensuciando el matiz. */
      if (Math.random() < 0.58) {
        d[o+3] = 0.0;  d[o+4] = 0.961; d[o+5] = 1.0;    // cian  #00f5ff
      } else {
        d[o+3] = 1.0;  d[o+4] = 0.843; d[o+5] = 0.0;    // oro   #ffd700
      }
      /* CUERPO. Las estaciones van a 0.80-1.25 de radio, así que a 0.075-0.210
         las partículas siguen siendo entre 4 y 10 veces más pequeñas: hay sitio
         de sobra para darles volumen sin que discutan el primer plano. */
      d[o+6] = 0.075 + Math.random()*0.135;
      /* EMISIÓN. Historia de este número: nació en 0.028-0.088 (3-9 %, o sea
         invisible), subió a 0.14-0.34 y seguía leyéndose apagado. Ahora
         0.34-0.70.
         Con mezcla aditiva lo percibido es alfa POR color, así que subir el
         alfa ES subir el glow: no hace falta tocar el shader para que brillen.
         Las estaciones están en 1.00-1.30, de modo que el cielo sigue por
         debajo y la jerarquía del keynote aguanta: estaciones → conductos →
         cielo. Ese orden no se rompe, solo deja de ser invisible el último. */
      d[o+7] = 0.34 + Math.random()*0.36;
      d[o+8] = -1;
    }
    return d;
  }

  /* Teje la red a partir de las posiciones YA generadas de las partículas, no
     de posiciones nuevas: si inventara sus propios puntos, la telaraña no
     tocaría el cielo que dice enlazar.

     Se calcula UNA vez en el arranque y viaja al buffer como STATIC_DRAW. El
     coste es un O(n²) de 245 000 comparaciones de distancia —milisegundos, y
     solo al iniciar—; a cambio, en cada cuadro no se recalcula nada.

     Dos topes gobiernan la densidad, y los dos importan:
       · MAX_POR_PARTICULA evita el apelmazamiento. Sin él, las zonas donde el
         azar juntó muchas partículas se convierten en manchas sólidas y el
         resto del cielo queda vacío: la red saldría a grumos.
       · MAX_ENLACES acota el gasto total pase lo que pase con el azar. */
  function construirRedFilamentos(part) {
    /* DENSIDAD. Con radio 3.6 y 2 enlaces por partícula la malla salía
       demasiado suelta para leerse como red: eran hilos sueltos, no tejido.
       Radio a 4.4 y tercer enlace permitido —la separación media entre
       partículas es de unas 3.3 unidades, así que 4.4 alcanza al vecino de
       vecino y empieza a cerrar triángulos, que es lo que el ojo lee como
       "red" en vez de "líneas". El tope sube en proporción. */
    var RADIO2 = 4.4 * 4.4;          // al cuadrado: nos ahorra la raíz
    var MAX_POR_PARTICULA = 3;
    var MAX_ENLACES = 900;
    var ENLACES_A_ESTACION = 46;

    var grado = new Uint8Array(PARTICULAS);
    var v = [];
    var enlaces = 0;
    var i, j, o, p, dx, dy, dz;

    for (i = 0; i < PARTICULAS && enlaces < MAX_ENLACES; i++) {
      if (grado[i] >= MAX_POR_PARTICULA) continue;
      o = i * 9;
      for (j = i + 1; j < PARTICULAS && enlaces < MAX_ENLACES; j++) {
        if (grado[j] >= MAX_POR_PARTICULA) continue;
        p = j * 9;
        dx = part[o] - part[p]; dy = part[o+1] - part[p+1]; dz = part[o+2] - part[p+2];
        if (dx*dx + dy*dy + dz*dz > RADIO2) continue;
        var s = Math.random() < 0.58 ? 0.0 : 1.0;   // familia cian u oro
        cinta(v, part[o], part[o+1], part[o+2], -1,
                 part[p], part[p+1], part[p+2], -1, s);
        grado[i]++; grado[j]++; enlaces++;
        if (grado[i] >= MAX_POR_PARTICULA) break;
      }
    }

    /* Amarres al negocio: unas pocas partículas se enganchan a su estación más
       cercana. Sin esto la telaraña flota como decoración ajena; con esto el
       cielo de clientes queda visiblemente conectado a la estructura, que es
       lo que la escena tiene que contar.
       El extremo que toca la estación guarda SU índice (0-4), así se mece con
       ella y no con las partículas. */
    var paso = Math.max(1, Math.floor(PARTICULAS / ENLACES_A_ESTACION));
    for (i = 0; i < PARTICULAS; i += paso) {
      o = i * 9;
      var mejor = -1, mejorD = Infinity;
      for (j = 0; j < ESTACIONES.length; j++) {
        var e = ESTACIONES[j].pos;
        dx = part[o] - e[0]; dy = part[o+1] - e[1]; dz = part[o+2] - e[2];
        var d2 = dx*dx + dy*dy + dz*dz;
        if (d2 < mejorD) { mejorD = d2; mejor = j; }
      }
      if (mejor < 0 || mejorD > 190) continue;   // demasiado lejos: no ata nada
      var se = Math.random() < 0.5 ? 0.0 : 1.0;
      var ep = ESTACIONES[mejor].pos;
      /* Aquí los dos extremos tienen índices DISTINTOS: la partícula mece con
         -1 y la estación con el suyo. Por eso el vértice guarda ambos. */
      cinta(v, part[o], part[o+1], part[o+2], -1,
               ep[0], ep[1], ep[2], mejor, se);
    }

    conteoVerticesRed = v.length / 11;
    return new Float32Array(v);
  }

  /* Un enlace = un quad de dos triángulos = 6 vértices. Cada vértice repite los
     dos extremos del segmento y se distingue por (aAlong, aLado): aAlong dice en
     cuál de los dos extremos se apoya, aLado a qué costado se desplaza. Toda la
     geometría se resuelve luego en el vértice, en espacio de pantalla.

     Se repiten los extremos en los 6 vértices —11 floats por vértice— porque la
     alternativa sería un uniform por línea, o sea 940 llamadas de dibujo en vez
     de una. 248 KB de buffer estático a cambio de una sola llamada es el
     canje correcto. */
  function cinta(v, ax, ay, az, ia, bx, by, bz, ib, s) {
    /* along, lado — dos triángulos que cubren la cinta completa. */
    var esquinas = [0,-1,  1,-1,  0,1,   0,1,  1,-1,  1,1];
    for (var k = 0; k < 12; k += 2) {
      v.push(ax, ay, az, bx, by, bz, ia, ib, esquinas[k+1], esquinas[k], s);
    }
  }

  var QUAD = new Float32Array([-1,-1,  1,-1,  -1,1,  1,1]);

  /* ─── Shaders ─────────────────────────────────────────────────────────── */

  var VERT_TUBOS = [
    'precision mediump float;',
    'attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;',
    'attribute float aRecorrido; attribute float aEnlace;',
    'uniform mat4 uProy; uniform mat4 uVista; uniform float uTiempo; uniform float uPulso;',
    'varying vec3 vColor; varying float vBrillo; varying float vBorde; varying float vSoliton;',
    'void main(){',
    '  vec4 posVista = uVista * vec4(aPos, 1.0);',
    /* Normal en espacio de vista: su componente Z dice cuánto mira hacia la
       cámara. Cerca de 0 estamos viendo el tubo de canto — ahí es donde un
       material translúcido se ve más denso. Es un Fresnel de dos líneas. */
    '  vec3 nVista = normalize((uVista * vec4(aNormal, 0.0)).xyz);',
    '  vBorde = 1.0 - abs(nVista.z);',
    /* ─── AXON FLOW · solitón bioeléctrico ──────────────────────────────
       Antes esto era una gaussiana SIMÉTRICA y, junto al emisor de partículas
       que ya se ha retirado, leía como un proyectil: aparecía y desaparecía
       igual de rápido por los dos lados — que es lo que hace una bala, no una
       señal recorriendo un axón.

       Un solitón real es ASIMÉTRICO: frente corto y estela larga. Se consigue
       con dos smoothstep sobre la posición dentro del paquete: uno que sube en
       el primer tercio y otro que baja durante los dos restantes. Ni un borde
       duro en ninguno de los extremos.

       La LONGITUD respira — un seno lento cruzado con uPulso la alarga y la
       acorta. Es la reactividad orgánica pedida: el pulso late, no se dispara
       hacia fuera. Y la velocidad baja de 0.22 a 0.12, para que el ojo lea
       "corriente por un cable" y no "disparo". */
    '  const float PAQUETES = 2.0;',
    '  float fase = fract(uTiempo * 0.085 + aEnlace * 0.17);',
    '  float sp = fract(aRecorrido * PAQUETES - fase * PAQUETES);',
    '  float largo = 0.72 + 0.10 * sin(uTiempo * 0.65 + aEnlace * 1.3) + uPulso * 0.12;',
    '  float frente = smoothstep(0.0, largo * 0.42, sp);',
    '  float estela = 1.0 - smoothstep(largo * 0.34, largo, sp);',
    '  float p = frente * estela;',
    /* Un rescoldo tenue detrás del solitón: sin él la fibra se apaga del todo
       entre pulso y pulso y el conjunto parpadea en vez de fluir. */
    '  p += (1.0 - smoothstep(largo, largo * 1.9, sp)) * 0.25;',
    '  vSoliton = clamp(p, 0.0, 1.0);',
    '  vBrillo = 0.24 + p * (1.55 + uPulso * 1.25);',
    '  vColor = aColor;',
    '  gl_Position = uProy * posVista;',
    '}'
  ].join('\n');

  var FRAG_TUBOS = [
    'precision mediump float;',
    'varying vec3 vColor; varying float vBrillo; varying float vBorde; varying float vSoliton;',
    'void main(){',
    /* El color de energía NO se pinta encima: se funde con el material del
       conducto en proporción al solitón. En reposo la fibra conserva el color
       de sus dos estaciones; al pasar la onda vira a cian y, en el corazón del
       pulso, a dorado. Así el conducto sigue diciendo de dónde sale y adónde
       llega incluso mientras conduce energía. */
    '  vec3 cian = vec3(0.0, 0.961, 1.0);',
    '  vec3 oro  = vec3(1.0, 0.843, 0.0);',
    '  vec3 energia = mix(cian, oro, smoothstep(0.35, 0.95, vSoliton));',
    '  vec3 c = mix(vColor, energia, vSoliton * 0.85);',
    /* El borde manda en la opacidad —el centro del tubo queda casi vidrio y la
       silueta se marca— y el solitón la engorda donde pasa: el pulso se ve por
       su color y porque la fibra se vuelve más densa ahí. Con mezcla aditiva,
       una superficie grande a alfa media se acumularía en una mancha sólida. */
    '  float alfa = (0.015 + vBorde * 0.22 + vSoliton * 0.16) * min(1.0, vBrillo * 1.35);',
    '  gl_FragColor = vec4(c * vBrillo, alfa);',
    '}'
  ].join('\n');

  var VERT_INST = [
    'precision mediump float;',
    'attribute vec2 aQuad;',
    'attribute vec3 iPos; attribute vec3 iColor; attribute float iRadio;',
    'attribute float iIntensidad; attribute float iIndice;',
    'uniform mat4 uProy; uniform mat4 uVista; uniform float uTiempo;',
    'uniform float uPulso; uniform float uActivo;',
    'varying vec2 vQuad; varying vec3 vColor; varying float vIntensidad; varying float vSlot; varying float vIdx;',
    'void main(){',
    '  vec3 p = iPos;',
    /* El slot se deduce del índice de instancia: 2 es ELIXIS. Sin atributo
       nuevo y sin cambiar el paso del buffer. */
    '  vSlot = (abs(iIndice - 2.0) < 0.5) ? 1.0 : 0.0;',
    '  vIdx = iIndice;',
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
    'uniform float uTiempo; uniform float uPulso;',
    'varying vec2 vQuad; varying vec3 vColor; varying float vIntensidad; varying float vSlot; varying float vIdx;',
    /* ─── GLYPHS DE ESTACIÓN ─────────────────────────────────────────────
       Los iconos que pedía el ticket (calendario, cerebro, banco, auriculares)
       NO EXISTEN como PNG en el repositorio: no hay ninguno en assets/. En vez
       de fabricar iconos de marca por mi cuenta, se dibujan con distancias
       aquí dentro. Sale el mismo resultado que describe el ticket —trazo
       monocromático aditivo con respiración, sin fondo opaco— y además no
       añade ni un archivo, ni una carga de textura, ni una llamada de dibujo:
       viajan dentro del quad que ya dibuja cada esfera.
       Si más adelante aparecen los PNG oficiales, el hueco está aquí. */
    'float caja(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }',
    'float segmento(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a;',
    '  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }',
    'void main(){',
    '  float d = length(vQuad);',
    '  if (d > 1.0) discard;',
    /* Núcleo compacto + halo suave: una esfera de luz sin texturas. */
    '  float nucleo = smoothstep(0.55, 0.0, d);',
    '  float halo = smoothstep(1.0, 0.0, d) * 0.45;',
    '  float a = (nucleo + halo) * vIntensidad;',
    /* EL NÚCLEO ES UN ANILLO, NO UN ORBE. La esfera central llevaba su núcleo
       relleno igual que las demás, y con el emblema encima el resplandor lo
       lavaba por el centro justo donde está el ave. Aquí la energía se calcula
       por RADIO: se apaga hacia dentro y solo vive en el perímetro, dejando el
       centro transparente para que el logo se lea limpio. */
    /* ¡OJO CON EL SIGNO! Esta comparación era 'vIdx < 0.5' y ahí estaba el bug
       que hizo "desaparecer" el cielo desde FEAT-3D-08: las PARTÍCULAS llevan
       iIndice = -1, y -1 también es menor que 0.5. Las 700 entraban en la rama
       del núcleo —aros concéntricos con corte interior, calibrados para un hub
       de radio 1.25— y hacían return antes de llegar a su propio código. En un
       punto de radio 0.1 ese corte interior le borra el centro, así que por
       mucho que se les subiera tamaño y opacidad seguían sin verse.
       Con abs() la rama captura SOLO la estación 0, que es lo que siempre
       quiso decir. Mismo idioma que el 'abs(vIdx - 4.0)' de más abajo. */
    '  if (abs(vIdx) < 0.5) {',
    /* ─── CLON DEL MOTOR DE ENERGÍA DE ELIXIS ────────────────────────────
       Estructura copiada del fragment del holograma, no reinventada. La regla
       que lo gobierna todo, y que yo había roto en el intento anterior, es
       esta línea suya:

           gl_FragColor = vec4(c * (0.7 + uPulso * 0.6), clamp(a, 0.0, 1.0));

       El COLOR solo se escala con el pulso. NUNCA con la intensidad de los
       anillos. Toda la estructura —crestas, ondas, parpadeo— vive en el ALFA.
       Multiplicar el color por el valor del aro, como hacía yo, sube los tres
       canales a la vez en las crestas y lo quema todo a blanco plano: se pierde
       el dorado y con él la marca. Aquí el brillo sale de la opacidad. */
    '    float vel = 1.1 + uPulso * 1.5;',
    /*     ONDAS DE CHOQUE: nacen en el centro y se expanden. Dos trenes con
           distinta frecuencia y velocidad, como en el holograma. */
    '    float onda1 = sin(d * 14.0 - uTiempo * vel);',
    '    float onda2 = sin(d *  9.0 - uTiempo * vel * 0.68 + 1.7);',
    '    float a1 = pow(max(onda1, 0.0),  8.0) * 0.90;',
    '    float a2 = pow(max(onda2, 0.0), 12.0) * 0.65;',
    /*     Desvanecido con la distancia y respuesta al pulso: idénticos a
           smoothstep(1.25, 0.15, r) * (0.35 + uPulso * 0.65) del original,
           reajustados al radio de la esfera. */
    '    float caida = smoothstep(1.05, 0.30, d) * (0.34 + uPulso * 0.42);',
    '    a1 *= caida; a2 *= caida;',
    /*     MICRO-PARPADEO. El holograma usa una línea de escaneo
           0.5 + 0.5 * sin(coord * 42.0 - t * 2.2); aquí es radial. Encima, un
           estrobo rápido ligado al pulso: es lo que da la textura granular de
           plasma en vez de un degradado liso. */
    '    float escaneo = 0.5 + 0.5 * sin(d * 42.0 - uTiempo * 2.2);',
    /*     DESTELLO CASI IMPERCEPTIBLE (petición del PO). El estrobo iba a
           0.82 ± 0.18 y a 14-36 Hz: eso es un centelleo del 22 % a velocidad
           de flash, y con el cielo de partículas ya encendido se convertía en
           lo primero que pesca el ojo. Se baja la amplitud a ± 0.06 y se
           ralentiza a la mitad. Sigue habiendo vida —no es una constante— pero
           deja de llamar la atención sobre el emblema. */
    '    float estrobo = 0.94 + 0.06 * sin(uTiempo * (7.0 + uPulso * 9.0) + d * 7.0);',
    '    float textura = (0.88 + escaneo * 0.12) * estrobo;',
    '    a1 *= textura; a2 *= textura;',
    /*     CORTE INTERIOR: alfa 0 en el área del emblema. */
    '    float corte = smoothstep(0.42, 0.60, d);',
    /*     COLOR POR TREN, no por degradado radial: el tren grueso es el CUERPO
           DORADO y el fino son los FILAMENTOS CIAN. Así nunca aparece el verde
           que sale de interpolar #ffd700 con #00f5ff, y cada color ocupa lo que
           le toca en vez de promediarse. */
    '    vec3 oroA  = vec3(1.0, 0.843, 0.0);',
    '    vec3 cianA = vec3(0.0, 0.961, 1.0);',
    '    vec3 cA = (oroA * a1 + cianA * a2) / max(0.0001, a1 + a2);',
    /*     BAJADA DE INTENSIDAD. Con mezcla aditiva, lo que se percibe es alfa
           POR color, así que subir los dos multiplica el deslumbre. Se recortan
           ambos: el empuje de alfa de 1.60 a 0.85 y la escala de color de 0.75
           a 0.50 — en conjunto queda en torno a un tercio del brillo anterior.
           Los aros siguen ahí, con su dorado y su filamento cian, pero dejan de
           competir con el emblema y de quemar en proyector. */
    /*     Y el calibre general de los aros, tercera bajada de esta línea: el
           empuje de alfa pasa de 0.85 a 0.40 y la escala de color de 0.38 a
           0.28. En aditivo lo percibido es alfa POR color, así que recortar
           ambos multiplica el efecto: queda en torno a un tercio de lo que
           había. Los aros NO se retiran —siguen ahí, con su oro y su filamento
           cian— simplemente dejan de destellar. */
    '    float aA = clamp((a1 + a2) * 0.40, 0.0, 1.0) * vIntensidad * corte;',
    '    gl_FragColor = vec4(cA * (0.28 + uPulso * 0.14), aA);',
    '    return;',
    '  }',
    /* ESTACIÓN CON EMBLEMA DE MARCA (booth → MDJPRO). Es el mismo problema que
       tuvo el núcleo y se le da la misma cura: el relleno interior lavaba el
       logo justo por el centro, que es donde está la M. Se vacía el disco por
       radio y queda solo el perímetro, así la estación se sigue leyendo como
       estación y el emblema se lee limpio encima.

       Además se renuncia al glifo de faders. No es una pérdida: el glifo era el
       marcador de posición de una marca que no teníamos: es exactamente el
       mismo cambio que hizo el Fénix al sustituir su malla procedural. Un
       emblema real pesa más en un keynote que un icono dibujado. */
    '  if (abs(vIdx - 4.0) < 0.5) {',
    '    a *= smoothstep(0.34, 0.62, d);',
    '    gl_FragColor = vec4(vColor * (0.6 + nucleo), a);',
    '    return;',
    '  }',
    /* SLOT DE ELIXIS: anillos de onda sonora saliendo de los audífonos. Se
       resuelven aquí y no con geometría nueva — son un seno sobre la distancia
       al centro, así que la estación sigue costando lo mismo y no añade ni un
       vértice ni una llamada de dibujo. */
    '  if (vSlot > 0.5) {',
    '    float onda = sin(d * 16.0 - uTiempo * 3.4) * 0.5 + 0.5;',
    '    float anillo = pow(onda, 6.0) * smoothstep(1.0, 0.25, d) * step(0.28, d);',
    '    a += anillo * vIntensidad * 0.85;',
    '  }',
    /* El glyph vive en el interior de la esfera, a media escala, y respira con
       un seno lento cruzado con el pulso del audio. Trazo, no relleno. */
    '  if (vIdx > 0.5) {',
    '    vec2 g = vQuad * 2.35;',
    '    float trazo = 0.055;',
    '    float f = 9.0;',
    '    if (vIdx < 1.5) {',
    /*     CALENDARIO: marco, cabecera y dos marcas de día. */
    '      f = abs(caja(g, vec2(0.62, 0.52))) - trazo;',
    '      f = min(f, abs(g.y - 0.24) - trazo * 0.8 + step(0.62, abs(g.x)) * 9.0);',
    '      f = min(f, length(g - vec2(-0.24, -0.10)) - 0.075);',
    '      f = min(f, length(g - vec2( 0.20, -0.10)) - 0.075);',
    '    } else if (vIdx < 2.5) {',
    /*     CHIP: encapsulado, núcleo interior y patillas a los cuatro lados. */
    '      f = abs(caja(g, vec2(0.46, 0.46))) - trazo;',
    '      f = min(f, abs(caja(g, vec2(0.20, 0.20))) - trazo * 0.85);',
    '      f = min(f, segmento(g, vec2(-0.62, 0.22), vec2(-0.46, 0.22)) - trazo * 0.7);',
    '      f = min(f, segmento(g, vec2(-0.62,-0.22), vec2(-0.46,-0.22)) - trazo * 0.7);',
    '      f = min(f, segmento(g, vec2( 0.46, 0.22), vec2( 0.62, 0.22)) - trazo * 0.7);',
    '      f = min(f, segmento(g, vec2( 0.46,-0.22), vec2( 0.62,-0.22)) - trazo * 0.7);',
    '      f = min(f, segmento(g, vec2(-0.22, 0.46), vec2(-0.22, 0.62)) - trazo * 0.7);',
    '      f = min(f, segmento(g, vec2( 0.22, 0.46), vec2( 0.22, 0.62)) - trazo * 0.7);',
    '    } else if (vIdx < 3.5) {',
    /*     ESCUDO CON CERRADURA: silueta que converge abajo y candado dentro. */
    '      f = segmento(g, vec2(-0.50, 0.42), vec2(0.50, 0.42)) - trazo;',
    '      f = min(f, segmento(g, vec2(-0.50, 0.42), vec2(-0.44,-0.16)) - trazo);',
    '      f = min(f, segmento(g, vec2( 0.50, 0.42), vec2( 0.44,-0.16)) - trazo);',
    '      f = min(f, segmento(g, vec2(-0.44,-0.16), vec2(0.0,-0.60)) - trazo);',
    '      f = min(f, segmento(g, vec2( 0.44,-0.16), vec2(0.0,-0.60)) - trazo);',
    '      f = min(f, abs(caja(g - vec2(0.0,-0.06), vec2(0.15, 0.12))) - trazo * 0.8);',
    '      f = min(f, abs(length(g - vec2(0.0, 0.13)) - 0.11) - trazo * 0.7 + step(0.0, -g.y + 0.13) * 9.0);',
    '    } else {',
    /*     FADERS: tres recorridos verticales con sus mandos a distinta altura,
           el gesto de una mesa de mezclas. */
    '      f = segmento(g, vec2(-0.42, 0.52), vec2(-0.42,-0.52)) - trazo * 0.6;',
    '      f = min(f, segmento(g, vec2(0.0, 0.52), vec2(0.0,-0.52)) - trazo * 0.6);',
    '      f = min(f, segmento(g, vec2(0.42, 0.52), vec2(0.42,-0.52)) - trazo * 0.6);',
    '      f = min(f, abs(caja(g - vec2(-0.42, 0.16), vec2(0.17, 0.075))) - trazo * 0.7);',
    '      f = min(f, abs(caja(g - vec2( 0.0, -0.22), vec2(0.17, 0.075))) - trazo * 0.7);',
    '      f = min(f, abs(caja(g - vec2( 0.42, 0.02), vec2(0.17, 0.075))) - trazo * 0.7);',
    '    }',
    '    float respira = 0.72 + 0.20 * sin(uTiempo * 1.15 + vIdx) + uPulso * 0.5;',
    '    float glyph = (1.0 - smoothstep(0.0, 0.045, f)) * respira;',
    /*   Cian y dorado, el mismo par que los conductos: la escena entera habla
         el mismo idioma cromático. */
    '    vec3 tinte = mix(vec3(0.0, 0.961, 1.0), vec3(1.0, 0.843, 0.0), 0.5 + 0.5 * sin(uTiempo * 0.5 + vIdx));',
    '    gl_FragColor = vec4(vColor * (0.6 + nucleo) + tinte * glyph * 0.85, a + glyph * 0.42);',
    '    return;',
    '  }',
    '  gl_FragColor = vec4(vColor * (0.6 + nucleo), a);',
    '}'
  ].join('\n');

  /* ─── RED DE FILAMENTOS (PLEXUS / CONSTELACIÓN) ──────────────────────────
     Telaraña bioeléctrica que entrelaza el cielo de partículas con las
     estaciones. Se dibuja con gl.LINES: una sola llamada, sin geometría de
     tubo y sin coste de relleno — un filamento de un píxel no paga fragmentos
     apenas, que es justo lo que permite tener cientos sin despeinar el cuadro.

     LA CLAVE ESTÁ EN EL VAIVÉN. Las partículas se mecen en el vértice con
     'p.y += sin(uTiempo*0.5 + iIndice*0.37)*0.18'. Si la red no repitiera esa
     fórmula EXACTA, los filamentos flotarían sueltos y se despegarían de los
     puntos que dicen unir. Por eso cada extremo guarda el índice de aquello a
     lo que se ancla —-1 si es partícula, 0-4 si es estación— y aplica el mismo
     desplazamiento. La red queda COSIDA, no superpuesta. */

  /* ─── ANCHO REAL: CINTAS, NO LÍNEAS ──────────────────────────────────────
     Esta red se dibujaba con gl.LINES y ahí topaba con un muro de la
     plataforma: gl.lineWidth() por encima de 1.0 lo IGNORA Chrome/ANGLE. Es un
     no-op, no una limitación de estilo. Para que un filamento pueda ser más
     gordo hay que dejar de pedirlo y construirlo: cada enlace pasa a ser un
     QUAD de dos triángulos orientado a la cámara.

     El ensanchado se hace en ESPACIO DE PANTALLA, no de mundo. Si se ensanchara
     en mundo, un filamento cercano saldría como una cinta y el mismo filamento
     al fondo desaparecería; midiendo en píxeles, el grosor es el que se pide
     pase lo que pase con la distancia. Cuesta un uniform de resolución.

     Cada vértice lleva LOS DOS extremos del segmento (aPosA/aPosB) porque la
     perpendicular necesita la dirección completa, y lleva los DOS índices
     (aIndA/aIndB) para poder mecer cada extremo con SU fase — un extremo puede
     ser partícula (-1) y el otro una estación (0-4). */

  var VERT_RED = [
    'precision mediump float;',
    'attribute vec3 aPosA; attribute vec3 aPosB;',
    'attribute float aIndA; attribute float aIndB;',
    'attribute float aLado; attribute float aAlong; attribute float aSemilla;',
    'uniform mat4 uProy; uniform mat4 uVista; uniform float uTiempo;',
    'uniform vec2 uResolucion; uniform float uSemiGrosorPx;',
    'varying float vSemilla; varying float vLejos;',
    'void main(){',
    /* Mismo vaivén que las partículas, aplicado a cada extremo con su índice:
       así la cinta sigue cosida a los dos puntos que une. */
    '  vec3 pa = aPosA; pa.y += sin(uTiempo * 0.5 + aIndA * 0.37) * 0.18;',
    '  vec3 pb = aPosB; pb.y += sin(uTiempo * 0.5 + aIndB * 0.37) * 0.18;',
    '  vec4 va = uVista * vec4(pa, 1.0);',
    '  vec4 vb = uVista * vec4(pb, 1.0);',
    '  vec4 ca = uProy * va;',
    '  vec4 cb = uProy * vb;',
    /* Guardia contra w ≈ 0: un extremo justo en el plano de la cámara haría
       explotar la división y llenaría el buffer de NaN, que en pantalla se ve
       como triángulos gigantes atravesando la escena. */
    '  float wa = max(1e-4, ca.w); float wb = max(1e-4, cb.w);',
    '  vec2 na = ca.xy / wa; vec2 nb = cb.xy / wb;',
    /* NDC → píxeles: el NDC abarca [-1,1], o sea resolución/2 por unidad. */
    '  vec2 dPix = (nb - na) * uResolucion * 0.5;',
    '  float largo = max(1e-5, length(dPix));',
    '  vec2 dir = dPix / largo;',
    '  vec2 perp = vec2(-dir.y, dir.x);',
    '  vec4 c = mix(ca, cb, aAlong);',
    /* De vuelta a NDC y multiplicado por w: gl_Position se divide por w después,
       así que el desplazamiento sobrevive intacto a la proyección. */
    '  c.xy += perp * aLado * uSemiGrosorPx * 2.0 / uResolucion * c.w;',
    /* Desvanecido por profundidad: la malla se disuelve al fondo en lugar de
       cortarse en seco contra el plano lejano. Sin esto se ve el borde del
       volumen y la ilusión de "cielo" se cae. */
    '  vLejos = 1.0 - smoothstep(16.0, 40.0, mix(-va.z, -vb.z, aAlong));',
    '  vSemilla = aSemilla;',
    '  gl_Position = c;',
    '}'
  ].join('\n');

  var FRAG_RED = [
    'precision mediump float;',
    'uniform float uTiempo; uniform float uPulso;',
    'varying float vSemilla; varying float vLejos;',
    'void main(){',
    /* Dos familias, sin interpolar entre ellas: interpolar oro y cian produce
       verde a mitad de camino. Cada filamento es de un color o del otro. */
    '  vec3 cian = vec3(0.0, 0.961, 1.0);',
    '  vec3 oro  = vec3(1.0, 0.843, 0.0);',
    '  vec3 c = (vSemilla < 0.5) ? cian : oro;',
    /* Latido lento y desfasado por filamento: la red respira por zonas en vez
       de parpadear entera, que es lo que la hace parecer viva y no un overlay. */
    '  float latido = 0.55 + 0.45 * sin(uTiempo * 0.75 + vSemilla * 37.0);',
    /* CALIBRE. 0.028-0.075 resultó indistinguible del negro: técnicamente se
       dibujaba y en pantalla no existía. Se subió a 0.10-0.23 y AQUÍ SE QUEDA:
       el PO pidió más grosor "con la misma opacidad", así que el alfa POR PÍXEL
       no se toca. Lo que cambió es cuántos píxeles cubre cada filamento, que
       ahora se resuelve con geometría de cinta en el vértice y no pidiendo un
       lineWidth que Chrome ignora. */
    '  float a = (0.10 + uPulso * 0.13) * latido * vLejos;',
    '  gl_FragColor = vec4(c, a);',
    '}'
  ].join('\n');

  /* ─── LOGO OFICIAL EN EL NÚCLEO ──────────────────────────────────────────
     Sustituye a la malla procedural del Fénix. Se pierde el aleteo y el
     plasma, y se gana la marca de verdad: en un keynote ante directores de
     venue, el emblema real pesa más que una animación bonita.

     Se usa fenix-emblem-160.png (145×160 RGBA, 48 KB) por decisión del PO:
     entra al instante y a la escala en que se dibuja no se distingue del de
     1920×1920, que pesa 3 MB. Descartados por inservibles mdjpro-fenix-gold.png
     y mdjpro-cdj-gold.png: son color type 0x02 —RGB SIN ALFA— y su damero está
     rasterizado dentro de la imagen, así que traerían un cuadro opaco. */

  var VERT_LOGO = [
    'precision mediump float;',
    'attribute vec2 aQuad;',
    'uniform mat4 uProy; uniform mat4 uVista;',
    'uniform vec3 uPos; uniform float uTam; uniform float uTiempo; uniform float uPulso;',
    'varying vec2 vUV;',
    'void main(){',
    '  vec4 pv = uVista * vec4(uPos, 1.0);',
    /* Respiración senoidal + latido del audio. El billboard se expande en
       espacio de VISTA, así que encara a la cámara sin matriz propia. */
    '  float resp = 1.0 + sin(uTiempo * 0.9) * 0.05 + uPulso * 0.16;',
    '  pv.xy += aQuad * uTam * resp;',
    '  vUV = aQuad * 0.5 + 0.5;',
    '  gl_Position = uProy * pv;',
    '}'
  ].join('\n');

  var FRAG_LOGO = [
    'precision mediump float;',
    'uniform sampler2D uTex; uniform float uTiempo; uniform float uPulso;',
    'uniform float uPresencia;',
    'varying vec2 vUV;',
    'void main(){',
    /* La V se invierte: las imágenes llegan con el origen arriba y WebGL lo
       quiere abajo. Sin esto el emblema sale del revés. */
    '  vec4 t = texture2D(uTex, vec2(vUV.x, 1.0 - vUV.y));',
    '  if (t.a < 0.02) discard;',
    '  float halo = 0.85 + sin(uTiempo * 0.9) * 0.10 + uPulso * 0.45;',
    /* El emblema deja de ser una calcomanía opaca y pasa a leerse como energía
       proyectada: se le baja la opacidad y se le da respiración propia con el
       pulso. Se multiplica el alfa DE LA TEXTURA, no se pone un valor fijo, para
       que el recorte del PNG siga mandando — el fondo transparente sigue
       transparente y solo el trazo dorado se vuelve translúcido. */
    '  float energia = 0.62 + uPulso * 0.20 + sin(uTiempo * 1.3) * 0.05;',
    /* JERARQUÍA DE MARCA. uPresencia vale 1.0 fijo en el núcleo —el cerebro no
       se atenúa jamás— y en un emblema subordinado sube desde su reposo solo
       cuando el recorrido llega a su estación. Se aplica al ALFA y no al color
       por la misma razón que en los aros: en mezcla aditiva lo percibido es
       alfa POR color, así que tocar el alfa atenúa sin desteñir la marca. */
    '  energia *= uPresencia;',
    /* Se multiplica el alfa por el color y no se toca el matiz: el dorado del
       emblema es el de la marca y no lo decide este shader. */
    '  gl_FragColor = vec4(t.rgb * halo, t.a * clamp(energia, 0.0, 1.0));',
    '}'
  ].join('\n');

  /* ─── HOLOGRAMA DE ELIXIS ─────────────────────────────────────────────────
     Se dibuja en COORDENADAS DE PANTALLA, no en el mundo: sus vértices van
     directos a clip space sin pasar por la vista, así que se queda clavado en
     el 40 % izquierdo pase lo que pase con la cámara. Es lo que se espera de
     un holograma de llamada — no orbita con la escena, acompaña al ponente.

     Toda la figura vive en el FRAGMENT: anillos resonantes y silueta se
     resuelven con distancias, sin geometría. Cuatro vértices en total, y el
     cuadrilátero se acota a la caja donde de verdad aparece algo en vez de
     cubrir el 40 % entero: cada píxel de más es relleno pagado por nada. */

  var VERT_HOLO = [
    'precision mediump float;',
    'attribute vec2 aQuad;',
    'uniform vec2 uCentro; uniform vec2 uTam;',
    'varying vec2 vUV;',
    'void main(){',
    '  vUV = aQuad;',
    '  gl_Position = vec4(uCentro + aQuad * uTam, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG_HOLO = [
    'precision mediump float;',
    'uniform float uTiempo; uniform float uPulso; uniform float uVisible;',
    'uniform float uAspecto;',
    'varying vec2 vUV;',
    'void main(){',
    '  if (uVisible < 0.01) discard;',
    /* Se corrige el aspecto para que los anillos salgan circulares y no
       ovalados en pantallas panorámicas. */
    '  vec2 p = vec2(vUV.x * uAspecto, vUV.y);',
    '  float r = length(p);',
    /* ANILLOS RESONANTES: se abren hacia fuera y su separación se comprime con
       uPulso — cuando ELIXIS habla o entra el bombo, la onda se acelera. */
    '  float vel = 1.1 + uPulso * 1.5;',
    '  float onda = sin(r * 9.0 - uTiempo * vel);',
    '  float anillos = pow(max(onda, 0.0), 8.0);',
    /* Se desvanecen con la distancia: nacen en el pecho, no en el borde. */
    '  anillos *= smoothstep(1.25, 0.15, r) * (0.35 + uPulso * 0.65);',
    /* SILUETA VECTORIAL con distancias: cabeza (círculo) y hombros (arco
       achatado por debajo). Sin geometría. */
    '  float cabeza = length((p - vec2(0.0, 0.34)) * vec2(1.0, 0.92)) - 0.20;',
    '  vec2 h = p - vec2(0.0, -0.30);',
    '  float hombros = length(h * vec2(0.62, 1.35)) - 0.44;',
    '  float silueta = min(cabeza, hombros);',
    /* Solo el CONTORNO, no el relleno: un holograma es luz en los bordes. */
    '  float borde = 1.0 - smoothstep(0.0, 0.030, abs(silueta));',
    '  borde *= 0.55 + uPulso * 0.45;',
    /* Barrido de escaneo: el tic visual que dice "esto es una proyección". */
    '  float escaneo = 0.5 + 0.5 * sin(vUV.y * 42.0 - uTiempo * 2.2);',
    '  borde *= 0.75 + escaneo * 0.25;',
    /* Cian abajo → magenta arriba. */
    '  vec3 cian    = vec3(0.30, 0.95, 1.00);',
    '  vec3 magenta = vec3(1.00, 0.35, 0.85);',
    '  vec3 c = mix(cian, magenta, clamp(vUV.y * 0.5 + 0.5, 0.0, 1.0));',
    '  float a = (anillos * 0.55 + borde) * uVisible;',
    '  gl_FragColor = vec4(c * (0.7 + uPulso * 0.6), clamp(a, 0.0, 1.0));',
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
    uInst.tiempoFrag = uInst.tiempo;   // el fragment comparte el uniform del vertex

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

    /* Las posiciones se guardan en una variable en vez de ir directas al
       buffer: la red de filamentos se teje a partir de ELLAS. Si se generaran
       aparte, la telaraña no tocaría las partículas que dice unir. */
    var datosParticulas = construirParticulas();
    bufParticulas = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufParticulas);
    gl.bufferData(gl.ARRAY_BUFFER, datosParticulas, gl.STATIC_DRAW);

    progRed = enlazar(VERT_RED, FRAG_RED);
    aRed.posA    = gl.getAttribLocation(progRed, 'aPosA');
    aRed.posB    = gl.getAttribLocation(progRed, 'aPosB');
    aRed.indA    = gl.getAttribLocation(progRed, 'aIndA');
    aRed.indB    = gl.getAttribLocation(progRed, 'aIndB');
    aRed.lado    = gl.getAttribLocation(progRed, 'aLado');
    aRed.along   = gl.getAttribLocation(progRed, 'aAlong');
    aRed.semilla = gl.getAttribLocation(progRed, 'aSemilla');
    uRed.proy    = gl.getUniformLocation(progRed, 'uProy');
    uRed.vista   = gl.getUniformLocation(progRed, 'uVista');
    uRed.tiempo  = gl.getUniformLocation(progRed, 'uTiempo');
    uRed.pulso   = gl.getUniformLocation(progRed, 'uPulso');
    uRed.resolucion = gl.getUniformLocation(progRed, 'uResolucion');
    uRed.grosor     = gl.getUniformLocation(progRed, 'uSemiGrosorPx');
    bufRed = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufRed);
    gl.bufferData(gl.ARRAY_BUFFER, construirRedFilamentos(datosParticulas), gl.STATIC_DRAW);

    progLogo = enlazar(VERT_LOGO, FRAG_LOGO);
    aLogo.quad = gl.getAttribLocation(progLogo, 'aQuad');
    uLogo.proy = gl.getUniformLocation(progLogo, 'uProy');
    uLogo.vista = gl.getUniformLocation(progLogo, 'uVista');
    uLogo.pos = gl.getUniformLocation(progLogo, 'uPos');
    uLogo.tam = gl.getUniformLocation(progLogo, 'uTam');
    uLogo.tiempo = gl.getUniformLocation(progLogo, 'uTiempo');
    uLogo.pulso = gl.getUniformLocation(progLogo, 'uPulso');
    uLogo.tex = gl.getUniformLocation(progLogo, 'uTex');
    uLogo.presencia = gl.getUniformLocation(progLogo, 'uPresencia');
    cargarTexturasEmblemas();

    progHolo = enlazar(VERT_HOLO, FRAG_HOLO);
    aHolo.quad = gl.getAttribLocation(progHolo, 'aQuad');
    uHolo.centro = gl.getUniformLocation(progHolo, 'uCentro');
    uHolo.tam = gl.getUniformLocation(progHolo, 'uTam');
    uHolo.tiempo = gl.getUniformLocation(progHolo, 'uTiempo');
    uHolo.pulso = gl.getUniformLocation(progHolo, 'uPulso');
    uHolo.visible = gl.getUniformLocation(progHolo, 'uVisible');
    uHolo.aspecto = gl.getUniformLocation(progHolo, 'uAspecto');
    bufHolo = bufQuad;   // reutiliza el cuadrilátero base: cero memoria nueva

    gl.clearColor(0.02, 0.03, 0.06, 1.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);   // aditivo: el orden no importa y evita ordenar

    stats.vertices = conteoVerticesTubos;
    stats.instancias = ESTACIONES.length + PARTICULAS;
  }

  /* La textura se sube cuando la imagen llega, no antes: el motor arranca sin
     ella y el núcleo simplemente no dibuja su emblema durante esos milisegundos.
     Bloquear el arranque por una imagen sería cambiar un fallo visual pequeño
     por una pantalla negra. */
  function esPotenciaDeDos(v) { return v > 0 && (v & (v - 1)) === 0; }

  function cargarTexturasEmblemas() {
    for (var i = 0; i < EMBLEMAS.length; i++) cargarEmblema(EMBLEMAS[i]);
  }

  /* Cada emblema carga por su cuenta y marca su propia bandera. Si uno falla,
     los demás siguen dibujándose: un 404 en una marca no debe apagar la otra. */
  function cargarEmblema(em) {
    em.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, em.tex);
    /* Píxel transparente de relleno: si se dibujara antes de tener la imagen,
       no pinta nada en vez de basura. */
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,0]));

    var img = new Image();
    img.onload = function () {
      try {
        gl.bindTexture(gl.TEXTURE_2D, em.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        /* El tamaño manda sobre el filtrado, y aquí conviven dos casos muy
           distintos:

           · fenix-emblem-160 es 145×160 — NO es potencia de dos. En WebGL1 eso
             obliga a CLAMP_TO_EDGE y a nada de mipmaps, o la textura sale en
             negro sin avisar. Como se dibuja casi a su tamaño nativo, no pierde
             nada por no tenerlos.
           · mdj_logo es 1024×1024 y se dibuja a ~100 px. Eso es una reducción
             de 10×: con LINEAR a secas cada cuadro muestrea téxeles distintos
             y el borde del círculo HIERVE al moverse la cámara. Siendo potencia
             de dos sí admite mipmaps, que es justo lo que mata ese centelleo.

           De ahí que se decida por imagen y no por una constante global. */
        if (esPotenciaDeDos(img.width) && esPotenciaDeDos(img.height)) {
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        em.lista = true;
      } catch (e) { em.lista = false; }
    };
    img.onerror = function () { em.lista = false; };
    img.src = em.archivo;
  }

  function liberarEscena() {
    if (!gl) return;
    try {
      [bufTubos, bufIndices, bufQuad, bufNodos, bufParticulas].forEach(function (b) { if (b) gl.deleteBuffer(b); });
      if (progTubos) gl.deleteProgram(progTubos);
      if (progInstancias) gl.deleteProgram(progInstancias);
      if (progLogo) gl.deleteProgram(progLogo);
      for (var i = 0; i < EMBLEMAS.length; i++) if (EMBLEMAS[i].tex) gl.deleteTexture(EMBLEMAS[i].tex);
      if (progHolo) gl.deleteProgram(progHolo);
      if (progRed) gl.deleteProgram(progRed);
      if (bufRed) gl.deleteBuffer(bufRed);
    } catch (e) { /* contexto ya muerto */ }
    bufTubos = bufIndices = bufQuad = bufNodos = bufParticulas = progTubos = progInstancias = null;
    /* conteoVerticesRed a 0 además de soltar el buffer: el pase de dibujo lo
       consulta antes de dibujar, así que un contexto perdido no deja una
       llamada apuntando a un buffer que ya no existe. */
    progRed = null; bufRed = null; conteoVerticesRed = 0;
    /* Las banderas se bajan SIEMPRE, aunque el borrado de arriba haya saltado
       por contexto muerto: si quedaran en true, el primer cuadro tras recuperar
       el contexto dibujaría con texturas de un contexto que ya no existe. */
    for (var j = 0; j < EMBLEMAS.length; j++) { EMBLEMAS[j].tex = null; EMBLEMAS[j].lista = false; }
    progLogo = null;
    progHolo = null; bufHolo = null;
  }

  /* ─── Audio ───────────────────────────────────────────────────────────── */

  /* ─── AUDIO DUAL: pista + voz en un solo analizador ───────────────────────

     ┌─ EL ENRUTADO IMPORTA MÁS QUE EL CÓDIGO ─────────────────────────────┐
     │ Antes el grafo era:  pista → analizador → altavoces.                │
     │ Enchufar el micrófono a ese analizador lo habría mandado también a  │
     │ los altavoces: en una sala con PA, el micro capta los altavoces que │
     │ reproducen el micro y el sistema se pone a aullar en mitad de la    │
     │ ponencia. Es el fallo clásico de sonido en directo, y aquí lo       │
     │ habríamos construido a propósito.                                   │
     │                                                                      │
     │ El grafo nuevo desacopla análisis de reproducción:                   │
     │     pista ─┬─> analizador   (sin salida: solo mide)                 │
     │            └─> altavoces                                            │
     │     micro ───> analizador   (JAMÁS a los altavoces)                 │
     │                                                                      │
     │ Un AnalyserNode no necesita estar conectado a la salida para medir. │
     │ Sigue habiendo UN solo FFT, como pide el ticket: las dos fuentes se │
     │ suman en su entrada y uPulso sale ya mezclado.                       │
     └──────────────────────────────────────────────────────────────────────┘ */

  function asegurarContextoAudio() {
    if (analizador) return true;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      if (!ctxAudio) ctxAudio = new Ctx();
      analizador = ctxAudio.createAnalyser();
      analizador.fftSize = 512;
      /* El suavizado del propio analizador evita el parpadeo de un cuadro a
         otro; la envolvente de leerAudio() se encarga del carácter del golpe. */
      analizador.smoothingTimeConstant = 0.72;
      /* Deliberadamente SIN analizador.connect(destination). Ver el recuadro. */
      datosFrecuencia = new Uint8Array(analizador.frequencyBinCount);
      return true;
    } catch (e) { return false; }
  }

  function activarAudio() {
    if (audioActivo) return Promise.resolve('ya activo');
    audioEl = document.querySelector('[data-nm3d-audio]');
    if (!audioEl) return Promise.resolve('falta el elemento de audio');
    if (!asegurarContextoAudio()) return Promise.resolve('este navegador no expone Web Audio API');
    try {
      if (!fuenteMusica) {
        fuenteMusica = ctxAudio.createMediaElementSource(audioEl);
        ganMusica = ctxAudio.createGain();
        ganMusica.gain.value = 1;
        fuenteMusica.connect(ganMusica);
        /* La ganancia alimenta las DOS ramas. Al agacharla, la música deja de
           oírse Y deja de medirse a la vez: durante el modo micrófono el pulso
           lo gobierna solo la voz, que es lo que se quiere. Si la rama del
           analizador no pasara por aquí, el Fénix seguiría latiendo con una
           música que nadie oye. */
        ganMusica.connect(analizador);
        ganMusica.connect(ctxAudio.destination);
      }
    } catch (e) {
      return Promise.resolve('no se pudo enrutar la pista');
    }
    return ctxAudio.resume().then(function () {
      return audioEl.play();
    }).then(function () {
      audioActivo = true;
      if (contenedor) contenedor.classList.add('nm3d--con-audio');
      actualizarHud();
      return 'audio en marcha';
    })['catch'](function () { return 'el navegador bloqueó la reproducción'; });
  }

  /* ─── MICRÓFONO ───────────────────────────────────────────────────────────
     NUNCA en la carga: getUserMedia sin gesto previo lo bloquean los
     navegadores y, peor, quema el permiso — si el usuario deniega por reflejo
     al abrir la página, recuperarlo exige entrar en la configuración del
     sitio. Va solo por la tecla M, cuando el ponente lo decide. */
  function activarMicrofono() {
    if (micActivo) return Promise.resolve('el micrófono ya está activo');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.resolve('este navegador no expone getUserMedia');
    }
    if (!asegurarContextoAudio()) return Promise.resolve('este navegador no expone Web Audio API');
    /* Cancelación de eco y supresión de ruido activadas: el ponente habla
       delante de unos altavoces, y sin esto el analizador leería la propia
       música por el micro y contaría el bombo dos veces. */
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    }).then(function (stream) {
      micStream = stream;
      fuenteMic = ctxAudio.createMediaStreamSource(stream);
      fuenteMic.connect(analizador);   // solo al analizador; nunca a la salida
      return ctxAudio.resume();
    }).then(function () {
      micActivo = true;
      agacharMusica(true);          // fuera la música antes de la primera sílaba
      if (contenedor) contenedor.classList.add('nm3d--con-mic');
      actualizarHud();
      return 'micrófono en marcha';
    })['catch'](function (e) {
      var n = (e && e.name) ? e.name : '';
      if (n === 'NotAllowedError') return 'permiso de micrófono denegado';
      if (n === 'NotFoundError') return 'no hay micrófono disponible';
      return 'no se pudo abrir el micrófono';
    });
  }

  /* DUCKING. 0,1 s para bajar y 0,5 s para subir: la bajada tiene que ganarle
     al primer sílaba del ponente —si no, el altavoz ya está sonando cuando el
     micro abre y hay realimentación—, y la subida tiene que ser lo bastante
     lenta para no sonar a interruptor. Asimetría deliberada. */
  function agacharMusica(agachar) {
    if (!ganMusica || !ctxAudio) return;
    try {
      var ahora = ctxAudio.currentTime;
      ganMusica.gain.cancelScheduledValues(ahora);
      /* Se ancla el valor actual antes de la rampa: sin esto, una rampa que
         empieza a mitad de otra salta al valor de partida de la anterior. */
      ganMusica.gain.setValueAtTime(ganMusica.gain.value, ahora);
      ganMusica.gain.linearRampToValueAtTime(agachar ? 0.0 : 1.0, ahora + (agachar ? 0.1 : 0.5));
    } catch (e) { /* contexto cerrado */ }
  }

  function desactivarMicrofono() {
    micActivo = false;
    agacharMusica(false);           // vuelve la música, sin sonar a interruptor
    try { if (fuenteMic) fuenteMic.disconnect(); } catch (e) { /* nada */ }
    /* Parar las pistas apaga el indicador de grabación del sistema. Dejarlas
       vivas mantendría el punto rojo del navegador durante toda la ponencia. */
    try {
      if (micStream) {
        var t = micStream.getTracks();
        for (var i = 0; i < t.length; i++) t[i].stop();
      }
    } catch (e2) { /* nada */ }
    fuenteMic = null; micStream = null;
    if (contenedor) contenedor.classList.remove('nm3d--con-mic');
    actualizarHud();
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
    /* Basta con que HAYA analizador y alguna fuente viva: el micrófono solo,
       sin pista, también tiene que mover al Fénix. */
    if (!analizador || (!audioActivo && !micActivo)) {
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
    /* La voz vive en los medios (≈300-3000 Hz) y el bombo en los graves. Con
       el micro abierto se sube el peso de los medios: si no, el ponente puede
       hablar y el Fénix ni se entera, porque su energía cae justo en la banda
       que menos pesaba. Es la «suma acústica» del ticket, hecha donde importa. */
    var pesoMedios = micActivo ? 0.95 : 0.35;
    var objetivo = Math.min(1.4, banda.graves * 1.9 + banda.medios * pesoMedios);
    pulso += (objetivo - pulso) * (objetivo > pulso ? 0.5 : 0.06);
  }

  /* ─── VOZ DE ELIXIS ──────────────────────────────────────────────────────
     El motor vive en web/js/elixis-voice-engine.js (Web Speech API) y expone
     elixisSpeak / elixisStopSpeaking más los eventos elixis:speak:start y
     elixis:speak:end. Aquí solo se dispara y se escucha: la síntesis, la
     elección de voz y el rescate de los fallos de Chrome son suyos.

     Se comprueba en cada llamada y no una sola vez al arrancar, porque el
     script podría cargar después que este si alguien reordena las etiquetas. */

  function vozDisponible() {
    return typeof window.elixisSpeak === 'function';
  }

  function narrarEstacion(i) {
    if (!vozDisponible()) return 'motor de voz no disponible';
    var e = ESTACIONES[i];
    if (!e || !e.narracion) return 'sin narración para esa estación';
    window.elixisSpeak(e.narracion);
    return 'narrando';
  }

  function alternarNarracion() {
    if (!vozDisponible()) return;
    /* Si ya está hablando, la tecla la calla. Un botón de explicar que no sabe
       callarse obliga a esperar la locución entera en mitad de una ponencia. */
    if (vozHablando) { window.elixisStopSpeaking(); return; }
    if (nodoEnfocado < 0) return;
    narrarEstacion(nodoEnfocado);
  }

  function instalarEscuchaVoz() {
    window.addEventListener('elixis:speak:start', function () {
      vozHablando = true;
      actualizarBotonVoz();
    });
    window.addEventListener('elixis:speak:end', function () {
      vozHablando = false;
      actualizarBotonVoz();
    });
  }

  function actualizarBotonVoz() {
    var b = document.querySelector('[data-nm3d-explicar]');
    if (!b) return;
    b.textContent = vozHablando ? '⏹ DETENER' : '🔊 EXPLICAR';
    b.setAttribute('aria-pressed', vozHablando ? 'true' : 'false');
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
      var px = e.pos[0] + Math.cos(orbita) * radio;
      var py = e.pos[1] + 2.6;
      var pz = e.pos[2] + Math.sin(orbita) * radio;
      obj.x = px; obj.y = py; obj.z = pz;

      /* Vector DERECHA de la cámara = normalizar(frente × arriba). Desplazando
         el punto mirado en sentido contrario, la estación se corre a la
         derecha del encuadre sin tocar la posición de la cámara ni el zoom. */
      var fx = e.pos[0] - px, fy = e.pos[1] - py, fz = e.pos[2] - pz;
      var lf = Math.sqrt(fx*fx + fy*fy + fz*fz) || 1;
      fx /= lf; fy /= lf; fz /= lf;
      var rx = -fz, rz = fx;                    // (f × arriba) con arriba = (0,1,0)
      var lr = Math.sqrt(rx*rx + rz*rz) || 1;
      rx /= lr; rz /= lr;

      /* Cuánto desplazar: media anchura del plano a esa distancia, por el
         desvío pedido. Depende del aspecto, así que un monitor 21:9 y uno 16:9
         dejan el mismo 40 % libre en vez de encuadres distintos. */
      var aspectoActual = lienzo ? (lienzo.width / Math.max(1, lienzo.height)) : 1.777;
      var desplazamiento = DESVIO_ENCUADRE * radio * Math.tan(1.15 / 2) * aspectoActual;

      obj.mx = e.pos[0] - rx * desplazamiento;
      obj.my = e.pos[1];
      obj.mz = e.pos[2] - rz * desplazamiento;
    } else {
      /* RECORRIDO: el parámetro crece sin límite y solo el índice da la
         vuelta, así que no hay discontinuidad posible al cerrar el ciclo. */
      if (recorrido.activo) {
        /* DESACELERACIÓN CINEMÁTICA. Los waypoints caen en los enteros de s,
           así que la fracción dice a qué distancia estamos de una estación:
           cerca de 0 o de 1 vamos llegando, en 0,5 estamos de paso. Un seno
           sobre esa fracción frena la llegada y acelera el tránsito, que es
           como se mueve una cámara de cine — y da tiempo a leer la etiqueta
           de la estación mientras se habla de ella. */
        var f = recorrido.s - Math.floor(recorrido.s);
        var factor = 0.30 + 0.70 * Math.sin(Math.PI * f);
        recorrido.s += dt * recorrido.velocidad * WAYPOINTS.length * factor;
      }
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

    /* 0 · RED DE FILAMENTOS. Va la PRIMERA, al fondo de todo. Con mezcla
       aditiva el orden no altera el color —la suma es conmutativa— pero sí
       ordena la lectura del código: esto es trasfondo, y lo que venga después
       se dibuja encima. Una sola llamada para toda la telaraña. */
    if (progRed && conteoVerticesRed > 0) {
      gl.useProgram(progRed);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufRed);
      /* 11 floats por vértice = 44 bytes:
         posA(3) posB(3) indA(1) indB(1) lado(1) along(1) semilla(1) */
      var PASO = 44;
      var att = [
        [aRed.posA, 3,  0], [aRed.posB, 3, 12], [aRed.indA, 1, 24],
        [aRed.indB, 1, 28], [aRed.lado, 1, 32], [aRed.along, 1, 36],
        [aRed.semilla, 1, 40]
      ];
      for (var ia = 0; ia < att.length; ia++) {
        gl.enableVertexAttribArray(att[ia][0]);
        gl.vertexAttribPointer(att[ia][0], att[ia][1], gl.FLOAT, false, PASO, att[ia][2]);
        fijarDivisor(att[ia][0], 0);
      }
      gl.uniformMatrix4fv(uRed.proy, false, _proy);
      gl.uniformMatrix4fv(uRed.vista, false, _vista);
      gl.uniform1f(uRed.tiempo, t);
      gl.uniform1f(uRed.pulso, pulso);
      /* Resolución del FRAMEBUFFER, no del CSS: en una pantalla Retina son el
         doble. Si se pasara la del CSS, los filamentos saldrían a la mitad de
         grosor exactamente en las pantallas donde se va a presentar. */
      gl.uniform2f(uRed.resolucion, lienzo.width, lienzo.height);
      /* SEMI-grosor: el quad se abre a los dos lados, así que 0.9 son ~1.8 px
         de ancho total. Un poco más que la línea de 1 px de antes, que es lo
         que se pidió — "un chin más gruesas", no el doble. */
      gl.uniform1f(uRed.grosor, 0.9);
      gl.drawArrays(gl.TRIANGLES, 0, conteoVerticesRed);
      stats.llamadasDibujo++;
    }

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


    /* 4 · EMBLEMAS DE MARCA. Billboards con los PNG oficiales, flotando en el
       corazón de su estación con halo aditivo y respiración senoidal. Cada uno
       se dibuja solo cuando SU textura ya llegó, de forma independiente.

       El programa, el buffer, el atributo y las dos matrices se fijan UNA vez
       fuera del bucle: son idénticos para todos los emblemas y volver a
       enviarlos por cada uno sería trabajo de GPU regalado. Dentro del bucle
       solo cambia lo que de verdad cambia — posición, tamaño y textura. */
    var dibujaAlguno = false;
    for (var ie = 0; ie < EMBLEMAS.length; ie++) {
      if (EMBLEMAS[ie].lista) { dibujaAlguno = true; break; }
    }

    if (dibujaAlguno) {
      gl.useProgram(progLogo);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
      gl.enableVertexAttribArray(aLogo.quad);
      gl.vertexAttribPointer(aLogo.quad, 2, gl.FLOAT, false, 0, 0);
      fijarDivisor(aLogo.quad, 0);
      gl.uniformMatrix4fv(uLogo.proy, false, _proy);
      gl.uniformMatrix4fv(uLogo.vista, false, _vista);
      gl.uniform1f(uLogo.tiempo, t);
      gl.uniform1f(uLogo.pulso, pulso);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(uLogo.tex, 0);

      for (var je = 0; je < EMBLEMAS.length; je++) {
        var emb = EMBLEMAS[je];
        if (!emb.lista) continue;
        var pe = ESTACIONES[emb.estacion].pos;
        gl.uniform3f(uLogo.pos, pe[0], pe[1], pe[2]);
        /* Con crece = 0 y realce = 0 estas dos líneas dan exactamente el mismo
           valor de siempre, así que el emblema del núcleo se dibuja idéntico a
           antes de existir la jerarquía. Era el requisito. */
        gl.uniform1f(uLogo.tam, emb.tam * (1 + emb.crece * emb.prom));
        gl.uniform1f(uLogo.presencia, emb.base + emb.realce * emb.prom);
        gl.bindTexture(gl.TEXTURE_2D, emb.tex);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        stats.llamadasDibujo++;
      }
    }

    /* 5 · HOLOGRAMA DE ELIXIS. Se omite entero cuando está oculto: sin foco no
       se paga ni una llamada ni un fragmento. */
    if (visHolograma > 0.01) {
      gl.useProgram(progHolo);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufHolo);
      gl.enableVertexAttribArray(aHolo.quad);
      gl.vertexAttribPointer(aHolo.quad, 2, gl.FLOAT, false, 0, 0);
      fijarDivisor(aHolo.quad, 0);
      /* Centro en x=-0.60: el corazón del 40 % izquierdo, justo el hueco que
         el encuadre 60/40 deja libre. */
      /* Sube a la mitad ALTA de la banda izquierda. Centrado en y=0.06 se
         comía el mismo espacio que la tarjeta de telemetría y esta le tapaba
         la silueta justo por el centro: se veían los anillos y no la figura.
         Arriba el holograma, debajo los datos. */
      gl.uniform2f(uHolo.centro, -0.60, 0.34);
      gl.uniform2f(uHolo.tam, 0.28, 0.34);
      gl.uniform1f(uHolo.tiempo, t);
      /* La voz suma al pulso del audio: si ELIXIS habla mientras suena la
         música, los anillos responden a las dos cosas. */
      gl.uniform1f(uHolo.pulso, Math.min(1.6, pulso + vozActiva * 0.85));
      gl.uniform1f(uHolo.visible, visHolograma);
      gl.uniform1f(uHolo.aspecto, 0.28 * aspecto / 0.34);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      stats.llamadasDibujo++;
    }
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
      /* Fundido continuo, no un interruptor: el holograma entra y sale con la
         misma suavidad que la cámara. 3.2 ≈ un cuarto de segundo. */
      var objetivoHolo = (nodoEnfocado >= 0) ? 1 : 0;
      visHolograma += (objetivoHolo - visHolograma) * Math.min(1, dt * 3.2);
      /* Los anillos reaccionan a la síntesis además de al audio. Se suaviza en
         vez de conmutar: al terminar la frase la onda se apaga sola en lugar de
         cortarse en seco, que es lo que delata a un interruptor. */
      var objetivoVoz = vozHablando ? 1 : 0;
      vozActiva += (objetivoVoz - vozActiva) * Math.min(1, dt * 5.0);
      /* PROTAGONISMO DE LOS EMBLEMAS SUBORDINADOS. Sube mientras el recorrido
         LLEGA a la estación, no de golpe al aterrizar: por eso es un fundido y
         a 2.2 —más lento que el holograma— para que se lea como algo que se
         enciende al acercarse y no como un interruptor. Los emblemas de realce
         0, o sea el núcleo, ni se tocan: su presencia es constante por regla. */
      for (var ke = 0; ke < EMBLEMAS.length; ke++) {
        var eb = EMBLEMAS[ke];
        if (eb.realce <= 0 && eb.crece <= 0) continue;
        var objProm = (nodoEnfocado === eb.estacion) ? 1 : 0;
        eb.prom += (objProm - eb.prom) * Math.min(1, dt * 2.2);
      }
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
    var previo = nodoEnfocado;
    nodoEnfocado = ((i % ESTACIONES.length) + ESTACIONES.length) % ESTACIONES.length;
    orbita = 0;
    actualizarHud();
    /* Solo al CAMBIAR de estación. Repetir la misma tecla no relanza la
       locución: en escena se pulsa de más, y volver a empezar la frase cada
       vez sería peor que no narrar. */
    if (nodoEnfocado !== previo) narrarEstacion(nodoEnfocado);
  }

  function siguienteNodo(paso) {
    if (nodoEnfocado < 0) { irANodo(paso > 0 ? 0 : ESTACIONES.length - 1); return; }
    irANodo(nodoEnfocado + paso);
  }

  function volverAlRecorrido() {
    nodoEnfocado = -1;
    /* Se calla al salir del foco: la narración pertenece a la estación, y
       seguir hablando sobre el vuelo orbital no tendría sentido. */
    if (vozDisponible() && vozHablando) window.elixisStopSpeaking();
    actualizarHud();
  }

  function alternarPausaRecorrido() {
    recorrido.activo = !recorrido.activo;
    stats.estado = recorrido.activo ? 'en marcha' : 'recorrido en pausa';
    actualizarHud();
  }

  function alternarMicrofono() {
    if (micActivo) { desactivarMicrofono(); return; }
    activarMicrofono().then(function (r) {
      if (!micActivo) { stats.estado = r; actualizarHud(); }
    });
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
      /* 1-5 saltan directo a su estación. El «lerp» ya lo hace perseguir():
         solo se mueve el objetivo y el estado lo alcanza con suavizado. */
      if (k >= '1' && k <= '5') {
        ev.preventDefault();
        irANodo(parseInt(k, 10) - 1);
        return;
      }
      if (k === 'v' || k === 'V') { alternarNarracion(); return; }
      if (k === 'm' || k === 'M') { alternarMicrofono(); return; }
      if (k === 'r' || k === 'R') { alternarRotacionLibre(); return; }
      if (k === 'f' || k === 'F') { alternarPantallaCompleta(); return; }
      if (k === 'Escape' || k === '0') { ev.preventDefault(); volverAlRecorrido(); return; }
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

    var btnExplicar = document.querySelector('[data-nm3d-explicar]');
    if (btnExplicar) btnExplicar.addEventListener('click', alternarNarracion);

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

    /* Tarjeta lateral de telemetría. La clase manda la transición; el
       contenido solo se reescribe cuando hay estación, para no vaciar el texto
       a mitad del fundido de salida. */
    var tarjeta = document.querySelector('[data-nm3d-tarjeta]');
    if (tarjeta) {
      tarjeta.classList.toggle('nm3d-tarjeta--visible', !!e);
      if (e && e.hud) {
        var tit = tarjeta.querySelector('[data-nm3d-tarjeta-titulo]');
        if (tit) tit.textContent = e.hud.titulo;
        var cuerpo = tarjeta.querySelector('[data-nm3d-tarjeta-lineas]');
        if (cuerpo && cuerpo.getAttribute('data-estacion') !== e.id) {
          cuerpo.setAttribute('data-estacion', e.id);
          cuerpo.textContent = '';
          for (var li = 0; li < e.hud.lineas.length; li++) {
            var fila = document.createElement('div');
            var cl = document.createElement('b'); cl.textContent = e.hud.lineas[li][0];
            var vl = document.createElement('span'); vl.textContent = e.hud.lineas[li][1];
            fila.appendChild(cl); fila.appendChild(vl);
            cuerpo.appendChild(fila);
          }
        }
      }
    }

    var insignia = document.querySelector('[data-nm3d-mic]');
    if (insignia) insignia.hidden = !micActivo;

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
    catch (e) {
      /* El mensaje incluye la causa real. Antes decía siempre "no se pudo
         compilar el motor gráfico" pasara lo que pasara dentro, y eso convertía
         cualquier fallo de construcción —un buffer, un uniform, una referencia
         suelta— en una adivinanza. El fallback debe informar, no tranquilizar. */
      mostrarFallback('el motor no arrancó: ' + (e && e.message ? e.message : e));
      return;
    }

    capaz = true;
    redimensionar();
    construirEtiquetas();
    instalarControles();
    instalarEscuchaVoz();

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
      c.instancing = modoInstancing; c.audioActivo = audioActivo; c.micActivo = micActivo; c.pulso = pulso;
      c.banda = { graves: banda.graves, medios: banda.medios, agudos: banda.agudos };
      c.estaciones = ESTACIONES.length; c.nodoEnfocado = nodoEnfocado;
      /* Diagnóstico de la red de filamentos: sin esto, "no la veo" y "no se
         está dibujando" son indistinguibles desde fuera. */
      /* /6 y no /2: desde que los filamentos son cintas, cada enlace son dos
         triángulos = 6 vértices. Con el divisor viejo el contador inflaba los
         enlaces por tres y hacía creer que la malla había triplicado. */
      c.red = { vertices: conteoVerticesRed, enlaces: conteoVerticesRed / 6, programa: !!progRed };
      c.particulas = PARTICULAS;
      c.recorridoActivo = recorrido.activo; c.rotacionLibre = rotacionLibre;
    c.visHolograma = +visHolograma.toFixed(3);
    c.vozHablando = vozHablando; c.vozActiva = +vozActiva.toFixed(3);
    /* Ganancia real de la música: es la única forma de comprobar que el
       ducking ocurre de verdad y no solo que se llamó a la función. */
    c.gananciaMusica = ganMusica ? +ganMusica.gain.value.toFixed(3) : null;
    c.vozDisponible = vozDisponible();
      c.camara = { x: +cam.x.toFixed(3), y: +cam.y.toFixed(3), z: +cam.z.toFixed(3) };
      return c;
    },
    fijarFps: function (v) { if (v === 30 || v === 60) { topeFps = v; msPorCuadro = 1000/v; proximoDibujo = performance.now(); stats.msCuadroMax = 0; } },
    pausar: function () { pausarMotor('petición externa'); },
    reanudar: reanudarMotor,
    activarAudio: activarAudio,
    desactivarAudio: desactivarAudio,
    activarMicrofono: activarMicrofono,
    desactivarMicrofono: desactivarMicrofono,
    alternarMicrofono: alternarMicrofono,
    irANodo: irANodo,
    siguienteNodo: siguienteNodo,
    volverAlRecorrido: volverAlRecorrido,
    alternarPausaRecorrido: alternarPausaRecorrido,
    alternarRotacionLibre: alternarRotacionLibre,
    narrarEstacion: narrarEstacion,
    alternarNarracion: alternarNarracion,
    estaciones: function () {
      return ESTACIONES.map(function (e) {
        /* ocupado: el núcleo lo llena el Fénix procedural y ELIXIS sus anillos
           de onda. Los otros tres siguen reservados. */
        var ocupado = (e.id === 'nucleo' || e.id === 'elixis');
        return { id: e.id, nombre: e.nombre, subtitulo: e.subtitulo, hub: e.hub, slot: e.slot, ocupado: ocupado };
      });
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
