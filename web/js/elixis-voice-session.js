/* ═══════════════════════════════════════════════════════════════════
   ELIXIS · sesión de voz consolidada (WebRTC + AnalyserNode + estados)
   ═══════════════════════════════════════════════════════════════════
   Antes de este archivo, mdj-commander.html y elixis-console.html traían
   CADA UNO su propia copia de este mismo motor (mismo `pc/dc/mic/ac`,
   mismo `analizador()/nivel()/latir()`, mismo `herramienta()` — la propia
   consola lo dice en su comentario: "ADAPTADO A LA CARCASA DE LA
   CONSOLA... el original escribia en #convo/#convoState"). Solo la parte
   que escribia directo al DOM cambiaba de un archivo a otro.

   Este modulo es esa parte comun, con la escritura a DOM sacada: en vez
   de tocar elementos por id, emite eventos (onState/onLevel/onTranscript/
   onTool/onSystem/onError) y quien lo use decide que pintar. Los dos
   archivos originales NO se tocaron — siguen con su copia propia,
   funcionando igual que hoy. Esto es un TERCER consumidor nuevo (el
   workspace nativo de staff.html), no un reemplazo de los otros dos. */
(function(){
  'use strict';

  var ESTADOS = ['idle','listening','transcribing','understanding','confirmation','executing','speaking'];

  /* Disparador de "modo dialogo" para DjMago (2026-08-30, directiva del PO
     tras el reporte real "hablo solo, las canciones que identifico no son
     las que han sonado"): con create_response:false para identidad djmago
     (ver elixis-realtime-session/index.ts), OpenAI transcribe cada turno
     pero NUNCA genera una respuesta hablada por su cuenta -- esto evita el
     bug de raiz (la API generaba y reproducia ALGO en cada turno detectado,
     sin importar lo que dijera el prompt sobre quedarse callado). Este
     patron es el UNICO lugar donde se decide, mirando la transcripcion REAL
     ya recibida, si de verdad preguntaron por la cancion -- si matchea, el
     cliente manda response.create a mano (mismo mecanismo que ya usa
     herramienta() tras una tool-call) para que DjMago SI responda esa vez. */
  var PREGUNTA_CANCION_RE = /qu[ée]\s+(canci[oó]n|tema|track|rola|disco)|qu[ée]\s+(es|era)\s+(esta|esa|eso)|qu[ée]\s+(est[aá]|esta)\s+(sonando|tocando|pasando)|c[oó]mo se llama (esta|esa)|what('?s| is)\s+(this|that)?\s*(song|track|playing)/i;

  function crear(handlers){
    handlers = handlers || {};
    function emit(nombre, arg){
      var fn = handlers[nombre];
      if(typeof fn === 'function'){ try{ fn(arg); }catch(e){ /* un handler roto no debe tumbar la sesion */ } }
    }
    function headers(){
      var h = handlers.getHeaders ? handlers.getHeaders() : null;
      return Promise.resolve(h || {});
    }

    var pc=null, dc=null, mic=null, spk=null;
    var ac=null, sink=null, anMic=null, anRem=null, buf=null, rafPulso=0;
    var sesion=null, hb=0, t0=0;
    /* Default 'general', no null (2026-08-31, orden del PO: el modo de
       enfoque real es criterio del usuario -- pero SIN elegir ninguno
       todavia, el comportamiento debe ser el generico, nunca el candado
       estricto de Cazador Musical). Ver mismo criterio en identidadActual
       un poco mas abajo. */
    var hablando=false, vivo=false, pulso=0, modoActual='general', _textoElixis='';
    var conectando=false, micPrecalentado=null;
    /* Continuidad de texto puro entre turnos (2026-08-31, autorizado por el
       PO -- sistema de hilos estilo ChatGPT). Mismo formato exacto que
       mdj-commander.html usa para _elixisHistory ({role:'user'|'assistant',
       content}), pasado como "history" al mismo elixis-orchestrator -- este
       ya reenvia el body COMPLETO a elixis-chat (ver el propio orchestrator),
       que ya sabe leer "history" desde antes; enviarTextoSolo() solo no lo
       estaba mandando todavia. staff.html llena esto con cargarHistorialTexto()
       al cargar un hilo guardado o al cambiar de Modo de Enfoque -- este
       modulo no sabe nada de hilos/Supabase, solo mantiene el buffer. */
    var historialTexto=[];
    var watchdogPensando=null; // ver limpiarWatchdogPensando()/evento()
    /* BUG REAL 2026-08-31 (reporte del PO con captura: monologo infinito --
       ELIXIS respondiendose a si misma, "Uff, boda!"..."Si, para romperla de
       verdad..."). El mute de anoche (arriba, response.output_audio_
       transcript.delta) corta el eco MIENTRAS habla, pero reactivaba el mic
       de inmediato en response.done -- ese evento es del CANAL DE DATOS, no
       garantiza que las bocinas ya terminaron de reproducir la cola de audio
       real (buffer de audio propio del hardware/WebRTC, un camino separado
       del canal de control). El mic se abria mientras el ultimo pedazo de la
       voz de ELIXIS seguia sonando, se volvia a captar, y arrancaba un turno
       nuevo. Dos variables para la defensa de abajo: */
    var micReactivarTimeout=null; // red de seguridad si output_audio_buffer.stopped no llega
    /* ¿Hay audio SONANDO ahora mismo por las bocinas? Lo dice output_audio_buffer
       .started/.stopped, no una estimacion. Mientras esto sea true NO existe
       ningun cronometro que pueda reabrir el microfono: se espera al evento. */
    var audioSalidaActiva=false;

    /* GUARDA ACUSTICA (2026-09-02). Cuando las bocinas terminan de sonar, el
       CUARTO todavia no se ha callado: quedan reverberacion, reflexiones y
       cola de decay. Abrir el mic en el mismo instante en que se drena el
       buffer vuelve a meter esa cola en el VAD. 400ms es un punto de partida
       de ingenieria, NO un numero oficial de OpenAI -- depende de la sala y
       del equipo. Se calibra en vivo sin tocar codigo ni redesplegar:
         localStorage.setItem('elixis_guarda_ms','250')   // 250/400/600/800
       Techo de 2s para que una calibracion mal escrita no cuelgue el mic. */
    function guardaAcusticaMs(){
      var v = parseInt(localStorage.getItem('elixis_guarda_ms'), 10);
      return (isFinite(v) && v >= 0 && v <= 2000) ? v : 400;
    }
    /* Tope ABSOLUTO contra un cuelgue real (el evento de fin nunca llega por
       una conexion rota), no contra una respuesta larga. Generoso a proposito:
       equivocarse por largo deja el mic cerrado unos segundos de mas; por
       corto reabre la puerta al eco, que es el fallo que estamos matando. */
    var TOPE_CUELGUE_MS = 45000;

    /* CANDADO DETERMINISTA (2026-09-02). El filtro anti-eco por PARECIDO de
       texto es un juicio: compara lo transcrito contra lo que dijo el
       asistente y decide si "se parece". Falla en los dos sentidos -- el STT
       de una cola de audio mal cortada transcribe distinto de la frase
       original, y su ventana se queda corta cuando la bocina sigue sonando.
       Esto NO es un juicio, es aritmetica: se apunta CUANDO se armo el
       microfono, y cualquier turno que empezo ANTES de ese instante -- o
       mientras el audio del asistente seguia sonando -- no pudo venir de una
       persona hablandole a un microfono abierto. Se descarta sin mirar el
       texto. */
    /* TRANSPORTE DEL MIC (2026-09-02). Ya no se mutea el track con
       .enabled=false: eso lo deja mudo TAMBIEN para nuestro propio analizador
       local, y sin oir el microfono no hay forma de detectar que el PO esta
       hablando encima. Se corta el ENVIO con replaceTrack(null) -- el track
       sigue vivo y sonando en casa, pero no viaja a OpenAI. Asi:
         · el eco NUNCA llega al servidor (ni turnos falsos ni cortes por VAD)
         · nosotros seguimos oyendo el microfono y podemos decidir
       Y no se vuelve a llamar getUserMedia, que es lo que reconfigura
       CoreAudio y corta a Serato en vivo. */
    var audioSender = null;   // RTCRtpSender del microfono
    var micTrack = null;      // la pista viva, para devolverla al sender
    var bargeinCuadros = 0;   // cuadros seguidos de voz por encima de la bocina
    var reintentoTrasCorte = false; // permite UN reintento si OpenAI rechaza tras cancelar
    var micArmadoEn = 0;      // Date.now() del ultimo micTx(true)
    var turnoSospechoso = false;

    function micTx(encendido){
      if(audioSender){
        try{ audioSender.replaceTrack(encendido ? micTrack : null); }
        catch(_){ if(mic) mic.getAudioTracks().forEach(function(t){ t.enabled = !!encendido; }); }
      } else if(mic){
        mic.getAudioTracks().forEach(function(t){ t.enabled = !!encendido; });
      }
      if(encendido) micArmadoEn = Date.now();
    }
    function limpiarBufferEntrada(){
      if(dc && dc.readyState==='open') dc.send(JSON.stringify({ type:'input_audio_buffer.clear' }));
    }
    /* El unico camino que vuelve a abrir el microfono. Todo lo que quiera
       reactivarlo pasa por aqui, para que la guarda no se pueda saltar. */
    function abrirMicTrasGuarda(){
      if(micReactivarTimeout){ clearTimeout(micReactivarTimeout); }
      limpiarBufferEntrada();                     // (1) tira el residuo ya acumulado
      micReactivarTimeout = setTimeout(function(){
        limpiarBufferEntrada();                   // (2) y lo que entro durante la guarda
        micTx(true);
        micReactivarTimeout = null;
      }, guardaAcusticaMs());
    }
    var historialAsistente=[]; // últimas frases de ELIXIS/DjMago con su hora, para el filtro anti-eco
    /* Default 'djmago', no null (2026-08-30, correccion en vivo -- reporte
       real: hablar sin haber tocado antes un boton de Modo dejaba
       identidadActual en null, el servidor caia a DEFAULT_IDENTIDAD='elixis'
       y perdia el VAD estricto de DJMAGO_VAD_THRESHOLD). No hay todavia un
       selector real de avatar (ver ewOrbePersona en staff.html, deshabilitado
       a proposito) -- hoy DjMago es la unica identidad real de este panel. */
    var identidadActual='djmago', musicHunterNodo=null;

    /* Pre-calentado de microfono + constraints RAW (2026-08-30, portado de
       mdj-commander.html/precalentarMic() -- mismo bug real reportado hoy
       en staff.html: "el microfono pide permiso y se cae la musica en
       Serato al ejecutar". Este modulo se extraio ANTES de que esa funcion
       existiera ahi (ver cabecera del archivo), asi que nunca la heredo.
       Mismas 3 piezas probadas en vivo, sin inventar nada nuevo:
       (1) constraints con TODO el procesamiento de voz apagado -- eso es
       lo que dispara la reconfiguracion de CoreAudio que corta a Serato;
       (2) evitar por nombre las interfaces de DJ/USB (comparten reloj de
       audio con Serato, causa real de glitches, no solo el primer golpe);
       (3) pedir el permiso UNA vez y reusar el mismo stream entre
       start()/stop() -- solo el primerisimo click en la sesion sigue
       tocando hardware nuevo (limite real de macOS, no arreglable en JS),
       pero ya no cada activacion. */
    var CONSTRAINTS_MIC_RAW = { audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:1 } };
    function elegirMicrofono(dispositivos){
      var EVITAR = /pioneer|serato|rane|ddj|flx|denon|xdj|traktor|djm|numark|reloop|hercules|usb audio|aggregate device/i;
      var PREFERIR = /built-?in|integrad|macbook|airpods/i;
      var entradas = dispositivos.filter(function(d){ return d.kind==='audioinput' && d.label; });
      if(!entradas.length) return null;
      var preferido = entradas.filter(function(d){ return PREFERIR.test(d.label); })[0];
      if(preferido) return preferido.deviceId;
      var seguro = entradas.filter(function(d){ return !EVITAR.test(d.label); })[0];
      return seguro ? seguro.deviceId : null;
    }
    async function precalentarMic(){
      if(micPrecalentado && micPrecalentado.getAudioTracks().some(function(t){ return t.readyState==='live'; })){
        return micPrecalentado;
      }
      try{
        var constraints = CONSTRAINTS_MIC_RAW;
        try{
          var deviceId = elegirMicrofono(await navigator.mediaDevices.enumerateDevices());
          if(deviceId){
            constraints = { audio: Object.assign({}, CONSTRAINTS_MIC_RAW.audio, { deviceId: { exact: deviceId } }) };
          }
        }catch(e){ /* enumerateDevices puede fallar sin permiso -- seguir con el default */ }
        var s = await navigator.mediaDevices.getUserMedia(constraints);
        s.getAudioTracks().forEach(function(t){ t.enabled=false; });
        micPrecalentado = s;
        return s;
      }catch(e){
        return null;
      }
    }

    /* ENTREGA DE DOCUMENTOS (2026-09-02, autorizado por el PO). El PDF se arma
       AQUI, en el navegador, no en el servidor: no hay nada que subir, nada que
       almacenar y ningun permiso nuevo. Misma libreria que ya usa
       contracts-engine.html (jsPDF 2.5.1 por CDN), y se carga SOLO cuando de
       verdad se pide un documento -- no penaliza a quien nunca lo use.
       Devuelve un resultado honesto al modelo: si algo falla, se entera y lo
       dice, en vez de dar por hecho que te lo entrego. */
    var jsPdfListo = null;
    function cargarJsPdf(){
      if(window.jspdf && window.jspdf.jsPDF) return Promise.resolve(true);
      if(jsPdfListo) return jsPdfListo;
      jsPdfListo = new Promise(function(resolve){
        var e = document.createElement('script');
        e.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        e.onload = function(){ resolve(!!(window.jspdf && window.jspdf.jsPDF)); };
        e.onerror = function(){ resolve(false); };
        document.head.appendChild(e);
      });
      return jsPdfListo;
    }

    async function entregarPdf(args){
      var titulo = String((args && args.titulo) || 'Documento').trim().slice(0, 90);
      var lineas = Array.isArray(args && args.lineas) ? args.lineas : [];
      lineas = lineas.map(function(l){ return String(l || '').trim(); })
                     .filter(Boolean).slice(0, 60);
      if(!lineas.length) return { ok:false, motivo:'sin_contenido' };

      var ok = await cargarJsPdf();
      if(!ok) return { ok:false, motivo:'fallo', detalle:'No pude cargar el generador de PDF.' };

      try{
        var doc = new window.jspdf.jsPDF({ unit:'pt', format:'letter' });
        var M = 56, y = M + 8;

        doc.setFont('helvetica','bold'); doc.setFontSize(9);
        doc.setTextColor(197,160,89);                    // dorado de la marca
        doc.text('MIAMI DJ BEAT LLC', M, y); y += 26;

        doc.setFontSize(18); doc.setTextColor(20,20,20);
        doc.text(titulo, M, y, { maxWidth: 500 }); y += 22;

        doc.setFont('helvetica','normal'); doc.setFontSize(9);
        doc.setTextColor(120,120,120);
        doc.text(new Date().toLocaleString('es-ES'), M, y); y += 18;

        doc.setDrawColor(197,160,89); doc.line(M, y, 556, y); y += 22;

        doc.setFontSize(11); doc.setTextColor(30,30,30);
        lineas.forEach(function(linea, i){
          var envuelto = doc.splitTextToSize(String(i + 1) + '.  ' + linea, 470);
          envuelto.forEach(function(trozo){
            if(y > 720){ doc.addPage(); y = M; }        // salto de pagina real
            doc.text(trozo, M, y); y += 17;
          });
        });

        var archivo = titulo.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48) || 'documento';
        archivo += '.pdf';
        doc.save(archivo);
        emit('onTool', { nombre:'entregar_pdf', args:{ titulo:titulo }, ok:true });
        return { ok:true, archivo:archivo, lineas:lineas.length };
      }catch(e){
        console.error('[ElixisVoiceSession] entregar_pdf:', e);
        return { ok:false, motivo:'fallo', detalle:'No pude armar el documento.' };
      }
    }

    function fnUrl(accion){
      if(!window.mdbSupabaseFunctionUrl) return null;
      var u = window.mdbSupabaseFunctionUrl('elixis-realtime-session');
      if(!u) return null;
      return accion ? u + (u.indexOf('?')===-1?'?':'&') + 'action=' + accion : u;
    }
    function usados(){ return t0 ? Math.max(0, Math.round((Date.now()-t0)/1000)) : 0; }

    /* Float32Array -> base64 (2026-08-30, Music Hunter): en trozos, no de un
       tiro -- String.fromCharCode.apply(null, arregloEnorme) puede reventar
       la pila con los ~1MB reales que salen de 6s de audio a 44.1kHz. */
    function pcmABase64(float32Array){
      var bytes = new Uint8Array(float32Array.buffer, float32Array.byteOffset, float32Array.byteLength);
      var CHUNK = 0x8000, binario = '';
      for(var i=0; i<bytes.length; i+=CHUNK){
        binario += String.fromCharCode.apply(null, bytes.subarray(i, i+CHUNK));
      }
      return btoa(binario);
    }

    /* Mismo sumidero mudo que las dos copias originales: sin el, algunos
       navegadores no alimentan un analizador que no llega a los parlantes. */
    function analizador(stream){
      if(!ac){
        var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null;
        ac=new AC(); sink=ac.createGain(); sink.gain.value=0; sink.connect(ac.destination);
        buf=new Uint8Array(256);
      }
      try{
        var an=ac.createAnalyser(); an.fftSize=512; an.smoothingTimeConstant=0.72;
        ac.createMediaStreamSource(stream).connect(an); an.connect(sink);
        return an;
      }catch(e){ return null; }
    }
    function nivel(an){
      if(!an||!buf) return 0;
      an.getByteTimeDomainData(buf);
      var s=0; for(var i=0;i<buf.length;i++){ var v=(buf[i]-128)/128; s+=v*v; }
      return Math.min(1, Math.sqrt(s/buf.length)*3.2);
    }
    /* BARGE-IN POR NIVEL (2026-09-02, autorizado por el PO: "es una
       conversacion sin roce de teclados"). No es cancelacion de eco: es
       comparar las DOS señales que este modulo YA medía para las particulas.
       Mientras DJMago habla, el microfono oye SU eco -- y ese eco sube y baja
       SIGUIENDO a la bocina. Cuando el PO habla encima, el microfono trae
       energia que la bocina no explica. Ese exceso es la señal.
       Se piden varios cuadros SEGUIDOS por encima del umbral, para no cortar
       con una tos, un golpe en la mesa o un pico de la propia mezcla.
       Se calibra en vivo, sin redesplegar ni tocar codigo:
         localStorage.setItem('elixis_bargein','off')          // apagarlo
         localStorage.setItem('elixis_bargein_margen','2.0')   // mas duro
         localStorage.setItem('elixis_bargein_piso','0.14')    // mas duro
       Margen ALTO = hay que hablar mas fuerte para cortarlo.
       Margen BAJO = corta mas facil, y se arriesga a que lo corte su propio eco. */
    /* ¿Es un tono puro (timbre, pitido, notificacion) en vez de voz? Mira el
       reparto del espectro: si la banda mas fuerte concentra demasiada energia
       del total, el sonido es tonal, no hablado. No necesita modelo ni
       entrenamiento -- es la diferencia fisica entre un pitido y una vocal. */
    var bufFrec = null, avisadoSinReferencia = false, bargeinPico = 0;
    function esTonoPuro(an){
      if(!an) return false;
      if(!bufFrec) bufFrec = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(bufFrec);
      var total = 0, pico = 0;
      for(var i = 0; i < bufFrec.length; i++){
        total += bufFrec[i];
        if(bufFrec[i] > pico) pico = bufFrec[i];
      }
      if(total < 1) return false;
      return (pico / total) > ajusteBargein('tonalidad', 0.33);
    }
    function ajusteBargein(clave, pordefecto){
      var v = parseFloat(localStorage.getItem('elixis_bargein_' + clave));
      return isFinite(v) && v > 0 ? v : pordefecto;
    }
    function vigilarBargein(){
      if(localStorage.getItem('elixis_bargein') === 'off'){ bargeinCuadros = 0; return; }
      /* Solo mientras EL suena y nosotros NO estamos enviando: si el sender ya
         lleva pista, el microfono esta abierto y no hay nada que interrumpir. */
      if(!audioSalidaActiva || !audioSender || audioSender.track){ bargeinCuadros = 0; return; }
      var nMic = nivel(anMic), nRem = nivel(anRem);
      /* SAFARI NO DEJA MEDIR EL AUDIO REMOTO (2026-09-02, cazado con los
         numeros reales del PO: "mic 0.110 vs bocina 0.000" mientras DJMago
         estaba hablando a todo volumen). createMediaStreamSource sobre un
         stream de WebRTC entrante devuelve silencio en WebKit -- el mismo
         motivo por el que este archivo ya arrastra el truco del "sumidero
         mudo" mas arriba. Consecuencia: la comparacion relativa (tu voz POR
         ENCIMA de la suya) no se evaluaba nunca, porque cualquier cosa es
         mayor que cero. Lo unico que filtraba era el piso absoluto -- y por eso
         un "ding" del sistema bastaba para cortar la conversacion.
         Sin referencia de bocina no se puede comparar, asi que se cambia de
         criterio en vez de fingir que se compara: piso mas alto, y el peso
         recae en las otras dos señales, que NO dependen del nivel de la bocina
         -- que el sonido DURE como dura el habla, y que no sea un tono puro. */
      var hayReferencia = nRem > 0.001;
      if(!hayReferencia && !avisadoSinReferencia){
        avisadoSinReferencia = true;
        console.warn('[ElixisVoiceSession] sin referencia de bocina (Safari no mide el stream remoto): ' +
                     'el barge-in pasa a piso absoluto + duracion + timbre.');
      }
      /* Dos condiciones a la vez: por encima de un piso absoluto (que no sea
         ruido de sala) Y por encima de lo que la bocina justifica. */
      /* TRES condiciones, no una. El nivel solo no distingue una VOZ de un
         "ding" del sistema, y el PO lo cazo en vivo: entro una notificacion de
         macOS y le corto la conversacion a media frase. Con notificaciones
         seguidas eso interrumpiria cada rato -- inaceptable. Lo que separa una
         notificacion de una persona no es el volumen, son otras dos cosas:

         1. DURACION. Un aviso es un transitorio: suena y se apaga. Una palabra
            hablada SOSTIENE energia. Por eso se piden ~14 cuadros seguidos
            (~230ms) en vez de 6 (~100ms): un "ding" no llega, "oye" si.
         2. FORMA DEL SONIDO. Un aviso del sistema es casi un tono puro -- casi
            toda su energia cae en una franja estrechisima del espectro. La voz
            humana es ancha, repartida entre formantes. Si UNA sola banda se
            lleva mas de un tercio de la energia, eso no es una persona
            hablando: es un timbre, un pitido o una nota. */
      var hayVoz = nMic > ajusteBargein(hayReferencia ? 'piso' : 'piso_solo', hayReferencia ? 0.10 : 0.16)
                && (!hayReferencia || nMic > nRem * ajusteBargein('margen', 1.7))
                && !esTonoPuro(anMic);
      /* MEDIDOR DE CALIBRACION (2026-09-02). Elegir el piso a ojo es lo que
         nos tiene subiendo y bajando numeros: a 0.10 cortaba una notificacion,
         a 0.16 el PO no consigue cortarlo. Con esto se mide en vez de adivinar:
           localStorage.setItem('elixis_bargein_debug','1')
         Guarda el pico real de voz de cada tramo en que el asistente hablo y lo
         imprime al final -- el PO habla encima, mira el numero, y el piso se
         fija JUSTO por debajo de lo que de verdad marca su voz en su sala. */
      if(localStorage.getItem('elixis_bargein_debug') === '1'){
        if(nMic > bargeinPico) bargeinPico = nMic;
      }
      bargeinCuadros = hayVoz ? bargeinCuadros + 1 : 0;
      if(bargeinCuadros >= ajusteBargein('cuadros', 14)){
        bargeinCuadros = 0;
        console.log('[ElixisVoiceSession] barge-in: voz por encima de la bocina (mic ' +
                    nMic.toFixed(3) + ' vs bocina ' + nRem.toFixed(3) + ')');
        interrumpir();
      }
    }

    function latir(){
      vigilarBargein();
      var an = hablando ? (anRem||anMic) : anMic;
      var objetivo = nivel(an);
      pulso += (objetivo - pulso) * 0.3;
      if(pulso < 0.002) pulso = 0;
      emit('onLevel', pulso);
      rafPulso = requestAnimationFrame(latir);
    }
    function encender(){ vivo=true; if(!rafPulso) rafPulso = requestAnimationFrame(latir); }
    function apagar(){
      vivo=false;
      if(rafPulso){ cancelAnimationFrame(rafPulso); rafPulso=0; }
      pulso=0; anMic=null; anRem=null;
      if(ac){ try{ ac.close(); }catch(e){} ac=null; sink=null; }
      emit('onLevel', 0);
    }

    /* Herramientas: ELIXIS pide, el navegador ejecuta CON el JWT del usuario.
       El candado de cada función server-side sigue mandando igual que antes. */
    async function accion(nombre, cuerpo){
      var u = fnUrl(nombre);
      if(!u) return { ok:false, motivo:'fallo' };
      try{
        var r = await fetch(u,{ method:'POST', headers:await headers(), body:JSON.stringify(cuerpo) });
        var d={}; try{ d=await r.json(); }catch(_){}
        if(r.status===401||r.status===403) return { ok:false, motivo:'sin_acceso' };
        if(!r.ok) return { ok:false, motivo:'fallo' };
        return d;
      }catch(e){ return { ok:false, motivo:'fallo' }; }
    }

    async function herramienta(item){
      emit('onState','executing');
      var args={}; try{ args=JSON.parse(item.arguments||'{}'); }catch(_){}
      var out;
      if(item.name==='consultar_elixis')      out = await accion('consultar',     { pregunta:String(args.pregunta||'') });
      else if(item.name==='recordar')         out = await accion('memory_write',  { clave:String(args.clave||''), hecho:String(args.hecho||'') });
      else if(item.name==='olvidar')          out = await accion('memory_forget', { clave:String(args.clave||'') });
      else if(item.name==='identificar_track'){
        /* Modo A ("bajo demanda") de Music Hunter -- Modo B (ciclo continuo
           de 15-20s / setlist logger) es el item 4, todavia sin autorizar.
           Usa la misma instantanea que expone obtenerMuestraMusicHunter(),
           leyendo musicHunterNodo directo (misma closure, sin pasar por la
           API publica que es para quien llama desde afuera). */
        var muestra = (musicHunterNodo && window.MusicHunterRingBuffer)
          ? await window.MusicHunterRingBuffer.obtenerInstantanea(musicHunterNodo) : null;
        out = muestra
          ? await accion('identificar_track', { pcm_base64: pcmABase64(muestra.pcm), sample_rate: muestra.sampleRate })
          : { ok:false, motivo:'sin_audio_capturado' };
      }
      /* Catalogo de Apple Music (2026-09-02). El puente vive en el servidor
         -- mdj-music guarda la credencial de Apple -- y elixis-realtime-session
         lo proxya y RECORTA la respuesta a lo que un DJ usa para decidir.
         Aqui solo se reenvia lo que pidio el modelo. */
      else if(item.name==='consultar_musica')  out = await accion('consultar_musica', {
        recurso: (args.recurso === 'buscar' ? 'buscar' : 'charts'),
        q: String(args.q || ''),
      });
      else if(item.name==='entregar_pdf')      out = await entregarPdf(args);
      else if(item.name==='buscar_cliente')   out = await accion('buscar_cliente', { query:String(args.query||'') });
      else if(item.name==='enviar_sms')       out = await accion('enviar_sms', { cliente_id:String(args.cliente_id||''), mensaje:String(args.mensaje||'') });
      else if(item.name==='confirmar_envio_mensaje') out = await accion('confirmar_envio_mensaje', { id:String(args.id||''), accion:String(args.accion||'') });
      else                                    out = { ok:false, motivo:'herramienta_desconocida' };
      emit('onTool', { nombre:item.name, args:args, ok:(out&&out.ok!==false) });

      if(!dc || dc.readyState!=='open') return;
      dc.send(JSON.stringify({ type:'conversation.item.create',
        item:{ type:'function_call_output', call_id:item.call_id, output:JSON.stringify(out) } }));
      dc.send(JSON.stringify({ type:'response.create' }));   /* sin esto se queda mudo */
    }

    /* Watchdog de "Pensando" (2026-08-31, reporte real del PO: el avatar se
       quedaba en PENSANDO para siempre y la unica pista visible era un
       placeholder de 3.2s en la caja de texto -- facil de no ver si se esta
       mirando el avatar). Dos capas de defensa, no una sola:
       1) el 'error' de abajo ahora SI resetea el estado (la causa real mas
          probable: OpenAI devuelve error tras el response.create manual y
          nada lo escuchaba).
       2) este watchdog cubre cualquier otro silencio sin evento -- conexion
          caida sin disparar onconnectionstatechange, respuesta que nunca
          llega, etc. 5s es suficiente margen sobre cualquier respuesta real
          (la primera transcripcion de audio suele llegar en <2s). */
    function limpiarWatchdogPensando(){
      if(watchdogPensando){ clearTimeout(watchdogPensando); watchdogPensando=null; }
    }

    /* Filtro anti-eco (2026-08-31, ver historialAsistente arriba): compara lo
       que OpenAI transcribio como "dijo el usuario" contra las ultimas frases
       reales del asistente. No exige coincidencia exacta -- el STT de la cola
       de audio mal cortada rara vez transcribe identico a la frase original --
       alcanza con que una contenga a la otra o que compartan la mayoria de
       las palabras. */
    function esTextoParecido(a, b){
      if(!a || !b) return false;
      /* BUG REAL encontrado en la propia verificacion de este fix (simulacion
         con node antes de comitear): una transcripcion real trae puntuacion
         ("boda!", "verdad,") que .split(/\s+/) sola no separa del texto --
         "boda!" != "boda" como palabras, y el filtro fallaba justo en el caso
         mas comun. Se quita toda puntuacion antes de comparar, no solo de
         separar. */
      var limpiar = function(s){ return s.replace(/[.,!?¡¿"'();:]/g,'').trim(); };
      var la = limpiar(a), lb = limpiar(b);
      if(!la || !lb) return false;
      if(la === lb) return true;
      if(la.length > 6 && lb.indexOf(la) !== -1) return true;
      if(lb.length > 6 && la.indexOf(lb) !== -1) return true;
      var pa = la.split(/\s+/).filter(Boolean), pb = lb.split(/\s+/).filter(Boolean);
      /* SEGUNDO BUG encontrado en la misma simulacion: con el minimo de
         palabras en el denominador, una respuesta corta y real del usuario
         ("si", "no", "dale") comparte UNA palabra con cualquier frase larga
         del asistente y sale ratio=1.0 -- se descartaria una respuesta real
         creyendola eco. Las frases de 1-2 palabras solo pueden caer por el
         chequeo de substring de arriba (que ya exige >6 caracteres); la
         proporcion de palabras en comun solo aplica de 3 palabras en
         adelante, donde de verdad distingue eco de respuesta real. */
      if(!pa.length || !pb.length || Math.min(pa.length, pb.length) < 3) return false;
      var comunes = pa.filter(function(w){ return pb.indexOf(w) !== -1; }).length;
      return (comunes / Math.min(pa.length, pb.length)) >= 0.6;
    }
    function armarWatchdogPensando(){
      limpiarWatchdogPensando();
      watchdogPensando = setTimeout(function(){
        console.warn('[ElixisVoiceSession] watchdog: 5s en "Pensando" sin respuesta -- reseteando a escuchando.');
        watchdogPensando=null;
        emit('onState','listening');
      }, 5000);
    }

    function evento(m){
      /* Log exhaustivo (2026-08-31, pedido explicito del PO): TODO evento
         entrante del canal de datos de OpenAI, no solo los que este switch
         ya sabe manejar -- la unica forma de ver, la proxima vez que esto
         pase, cual mensaje llego de verdad (incluye 'response.created',
         'rate_limits.updated', 'conversation.item.created', etc. que hoy no
         tienen case propio y antes se descartaban en silencio). */
      console.log('[ElixisVoiceSession][evento]', m.type, m);
      switch(m.type){
        /* Lo que dice el humano, por escrito — la copia de mdj-commander no
           la tenia, la de elixis-console si (ver su propio comentario "LO
           QUE DICE EL CAPITAN, por escrito. Sin esto el chat enseñaba media
           conversacion"). Se conserva aqui para no perder esa mejora real. */
        case 'conversation.item.input_audio_transcription.completed': {
          /* CANDADO DURO 2026-08-31 (reporte real del PO, capturas de un
             bucle de "Hola Gerardo" -- variantes DISTINTAS entre si, no la
             misma frase repetida): el filtro anti-eco de abajo es por
             SIMILITUD de texto, y una transcripcion de cola de audio mal
             cortada puede salir bastante distinta de lo que el asistente
             dijo (ruido, palabras a medias) -- pasaba la similitud y se
             tomaba como "el usuario dijo algo nuevo", disparando OTRA
             respuesta nativa (create_response:true en los modos estandar).
             hablando=false NO sirve de candado aca -- 'input_audio_buffer.
             speech_started' ya lo apaga ANTES de que esta transcripcion
             llegue, exactamente en el caso que mas importa. La señal real y
             dura es el propio track del microfono: mientras siga
             deshabilitado (ver 'response.output_audio_transcript.delta' /
             micReactivarTimeout mas abajo, la MISMA ventana de silencio
             fisico), nada de lo que "transcriba" el servidor en ese hueco
             puede ser una persona real -- se descarta sin ni mirar el
             contenido, no hace falta compararlo con nada. */
          if(mic){
            var pistaMic = mic.getAudioTracks()[0];
            if(pistaMic && !pistaMic.enabled){
              console.warn('[ElixisVoiceSession] transcripcion ignorada -- microfono deshabilitado (asistente hablando/enfriando).');
              break;
            }
          }
          var dicho = (m.transcript || '').trim();

          /* ALUCINACION DE SILENCIO (2026-09-02, reporte del PO: le dijo
             "descansa", DJMago se despidio, y a los pocos segundos volvio con
             "buenas Gerardo, que quieres probar ahora" -- abriendo dialogo
             nuevo sin haber cerrado el anterior).
             Whisper NO devuelve vacio ante silencio: INVENTA. Es un defecto
             documentado del modelo -- ante una sala callada o un roce suelta un
             "Gracias.", unos puntos suspensivos o un subtitulo de relleno. Para
             el navegador eso parece un turno real, dispara response.create, y
             el modelo -- sin nada que responder -- hace lo unico que puede:
             saludar.
             Se descarta ANTES de disparar nada: por longitud (una orden real no
             cabe en tres letras) y por las muletillas concretas que este modelo
             produce con silencio. */
          var soloLetras = dicho.replace(/[\s.,!¡?¿…"'-]/g, '');
          var MULETILLAS_DE_SILENCIO = /^(gracias|thankyou|thanks|subtitulos?|subtítulos?|amara\.?org|you|uh|um|mm+|ah+|eh+|ok)$/i;
          if(soloLetras.length < 4 || MULETILLAS_DE_SILENCIO.test(soloLetras)){
            console.warn('[ElixisVoiceSession] descartada por alucinacion de silencio:', JSON.stringify(dicho));
            break;
          }
          if(dicho){
            /* FILTRO ANTI-ECO 2026-08-31 (mismo reporte de monologo infinito):
               si lo que OpenAI transcribio como "dijo el usuario" se parece a
               algo que el propio asistente dijo en los ultimos 3s, es casi
               seguro cola de audio mal cortada, no una persona real -- se
               descarta antes de mostrarlo en el hilo o de poder disparar
               nada (el response.create manual de Cazador, mas abajo). Esto
               es defensa ADICIONAL, no la correccion principal: el cooldown
               + input_audio_buffer.clear de response.done (mas abajo) es lo
               que ataca la causa real (mic reabierto antes de que las
               bocinas terminen); esto solo tapa lo que se cuele de todos
               modos. */
            /* Candado duro primero: si el turno nacio sucio, ni se mira el
               texto. Aqui es donde se corta "arranca a contar una historia
               solo" -- sin esta linea la transcripcion del propio eco baja
               hasta el disparo manual de response.create de mas abajo y el
               agente termina contestandose a si mismo. */
            if(turnoSospechoso){
              turnoSospechoso = false;
              console.warn('[ElixisVoiceSession] transcripcion DESCARTADA: el turno nacio mientras sonaba el asistente:', dicho);
              break;
            }
            var dichoNorm = dicho.toLowerCase();
            var esEco = historialAsistente.some(function(h){
              /* 3000ms era demasiado corto: h.ts se sella en response.done y
                 la bocina sigue sonando DESPUES, asi que un eco tardio caia
                 FUERA de la ventana y pasaba el filtro. 12s cubre una respuesta
                 larga; el parecido de texto sigue siendo lo que decide -- esto
                 solo deja de cerrarle la puerta antes de tiempo. */
              return (Date.now() - h.ts) < 12000 && esTextoParecido(dichoNorm, h.texto);
            });
            if(esEco){
              console.warn('[ElixisVoiceSession] transcripcion descartada por eco probable del propio asistente:', dicho);
              break;
            }
            emit('onTranscript', { who:'yo', text:dicho, final:true });
            emit('onThreadLine', { rol:'yo', contenido:dicho, modo:modoActual });
            /* CORRECCION 2026-08-31, EXTENDIDA 2026-09-01 (server:
               elixis-realtime-session ahora pone create_response:false para
               TODA identidad djmago, no solo Cazador -- ver ese archivo para
               el porque completo: eco acustico real en silencio total,
               bocinas+microfono sin cancelacion de eco). Con el servidor
               mudo en los 6 modos de djmago, el disparo manual de aqui ya no
               es exclusivo de Cazador -- sin el, DJMago se quedaria callado
               tambien en modos de oficina. Cazador conserva su propia regla
               (solo responder si preguntan por la cancion, directiva
               explicita del PO); el resto de los modos responde a cualquier
               transcripcion real (ya filtrada de eco arriba). */
            if(identidadActual === 'djmago' && dc && dc.readyState==='open'){
              if(modoActual === 'cazador'){
                if(PREGUNTA_CANCION_RE.test(dicho)){
                  dc.send(JSON.stringify({ type:'response.create' }));
                }
              } else {
                dc.send(JSON.stringify({ type:'response.create' }));
              }
            }
          }
          break;
        }
        case 'input_audio_buffer.speech_started':
          /* ¿Este turno nacio limpio? Si el asistente todavia estaba sonando, o
             si empezo antes de que el mic se armara, es eco -- no una persona.
             Se anota AQUI, en el instante del hecho, y se decide al completarse
             la transcripcion (mas abajo). */
          turnoSospechoso = audioSalidaActiva || (Date.now() < micArmadoEn);
          if(turnoSospechoso){
            console.warn('[ElixisVoiceSession] turno nacido con la bocina sonando o con el mic sin armar -- marcado como eco');
          }
          hablando=false;
          limpiarWatchdogPensando();
          emit('onTranscript', { who:'elixis', reset:true });
          emit('onState','listening'); break;

        case 'input_audio_buffer.speech_stopped':
          armarWatchdogPensando();
          emit('onState','understanding'); break;

        case 'response.output_audio_transcript.delta':
          limpiarWatchdogPensando();
          if(!hablando){
            hablando=true; _textoElixis=''; emit('onTranscript', { who:'elixis', start:true });
            /* BUG REAL 2026-08-31 (reporte del PO con captura: bucle de
               "Hola Gerardo..." cortandose solo, una y otra vez). NO es un
               disparador duplicado -- se busco y no existe ningun otro sitio
               que mande response.create sin que el usuario hable. Es eco
               acustico real: las bocinas reproducen a DjMago/Elixis, el
               mismo microfono lo vuelve a captar, y con create_response:true
               + interrupt_response:true (flujo nativo, ver elixis-realtime-
               session) OpenAI interpreta su propia voz como que el usuario
               interrumpio -- corta la respuesta a medias Y dispara una
               nueva, en bucle. NO se soluciona pidiendo echoCancellation:
               true/noiseSuppression:true/autoGainControl:true en
               getUserMedia -- CONSTRAINTS_MIC_RAW (arriba) las tiene TODAS
               en false a proposito, porque encenderlas es justo lo que
               dispara la reconfiguracion de CoreAudio que corta a Serato en
               vivo (ver el comentario de precalentarMic()). Mutear el track
               por software mientras el asistente habla logra el mismo
               resultado (el eco nunca llega al VAD) sin tocar constraints
               ni CoreAudio. Efecto secundario aceptado: mientras el
               asistente habla, no se puede interrumpir por voz (hay que
               esperar a que termine) -- es el precio de cortar el eco sin
               arriesgar el audio de Serato. */
            /* Cancela un cooldown de reactivacion pendiente (ver response.done
               mas abajo): si un nuevo response.output_audio_transcript.delta
               llega mientras todavia se esperaba el margen de 800ms de la
               respuesta ANTERIOR, ese timer viejo reactivaria el mic a media
               respuesta nueva -- justo la ventana de eco que se esta
               cerrando. */
            if(micReactivarTimeout){ clearTimeout(micReactivarTimeout); micReactivarTimeout=null; }
            /* CORREGIDO 2026-09-02: esta linea apagaba la pista a mano
               (.enabled=false), saltandose micTx() -- justo lo que el cambio de
               transporte vino a evitar. Con la pista muteada, NUESTRO propio
               analizador local tambien se queda sordo, asi que el detector de
               barge-in por nivel no podia oir al PO hablando encima: nunca
               tenia señal que comparar. Ademas dejaba la pista en el estado que
               otro guardia de este mismo archivo interpreta como "microfono
               deshabilitado", y ese guardia descartaba la pregunta del PO --
               el "se quedo callado en la segunda pregunta" salia de aqui.
               micTx(false) corta el ENVIO y deja la pista viva en casa. */
            micTx(false);
          }
          _textoElixis += (m.delta||'');
          emit('onTranscript', { who:'elixis', delta:(m.delta||'') });
          emit('onState','speaking'); break;

        case 'response.done': {
          limpiarWatchdogPensando();
          /* BUG REAL 2026-08-31 (reporte del PO con captura: monologo
             infinito -- ELIXIS respondiendose a si misma, "Uff, boda!"...
             "Si, para romperla de verdad..."). response.done es del CANAL DE
             DATOS -- no garantiza que las bocinas ya terminaron de reproducir
             la cola de audio real (via WebRTC, un camino separado del canal
             de control). Reactivar el mic de inmediato aqui (como hacia
             anoche) lo abria mientras el ultimo pedazo de la voz de ELIXIS
             seguia sonando, se volvia a captar, y arrancaba un turno nuevo.
             Dos capas: (1) input_audio_buffer.clear descarta cualquier
             residuo que el servidor ya haya empezado a acumular; (2) el mic
             se reactiva 800ms despues, no de inmediato, dandole margen real
             a las bocinas. Ver tambien esTextoParecido()/historialAsistente
             arriba -- defensa adicional si algo se cuela de todos modos. */
          /* CORREGIDO 2026-09-02. Lo de arriba decia que "no hay evento real
             de 'la bocina ya termino' disponible" y estimaba el final del
             audio a ~35ms por caracter. Es FALSO: en WebRTC existe
             output_audio_buffer.stopped, que dispara cuando el buffer de
             salida se drena de verdad. La estimacion era justo el hueco del
             eco -- en una respuesta larga el mic volvia mientras la bocina
             todavia sonaba. El mic ya NO se reabre aqui: se reabre en
             output_audio_buffer.stopped (mas abajo), con guarda acustica.

             response.done significa "termino de GENERARSE", no "termino de
             SONAR": el audio viaja por la pista WebRTC, un camino distinto
             del canal de datos, y puede seguir reproduciendose despues.

             RED DE SEGURIDAD: una respuesta SIN audio (solo texto, o una
             llamada a herramienta) nunca dispara output_audio_buffer.stopped.
             Sin esto el mic se quedaria mudo para siempre. Se arma el margen
             viejo como TECHO -- output_audio_buffer.stopped lo cancela y toma
             el control apenas llega, asi que en el camino normal no se usa. */
          limpiarBufferEntrada();
          if(micReactivarTimeout){ clearTimeout(micReactivarTimeout); }
          /* CORREGIDO 2026-09-02, con logs reales del PO en pantalla:
               "output_audio_buffer.stopped no llego en 4400ms; reabriendo el
                mic por la red de seguridad"
               ...y acto seguido, en la MISMA consola, llegaba el evento:
               "output_audio_buffer.stopped" {event_id:"event_90e69ce2..."}
             El evento no faltaba: mi red saltaba antes. La primera version de
             esta red heredo el calculo viejo (35ms x caracter, techo 4s) + la
             guarda = 4400ms, o sea METIA POR LA PUERTA DE ATRAS la misma
             adivinanza que este cambio vino a eliminar. Una respuesta larga
             pasa de 4,4s sin despeinarse, la red abria el mic con la bocina
             sonando, y en los logs se ve el resto: speech_started ->
             committed -> input_audio_transcription.completed (DJMago
             transcribiendose a si mismo) -> "contando una historia solo".

             La red NO es para respuestas largas: es SOLO para respuestas SIN
             AUDIO (texto suelto, o una llamada a herramienta), donde
             output_audio_buffer.stopped no llega nunca porque nunca hubo nada
             que sonar. Si el audio empezo a sonar de verdad
             (audioSalidaActiva, puesto por output_audio_buffer.started), no
             hay cronometro que valga: se espera al evento, dure lo que dure.
             Solo queda un tope absoluto LARGO, contra un cuelgue de verdad --
             no contra una respuesta larga. */
          var techoMs = audioSalidaActiva
              ? TOPE_CUELGUE_MS
              : Math.min(4000, Math.max(800, _textoElixis.trim().length * 35)) + guardaAcusticaMs();
          micReactivarTimeout = setTimeout(function(){
            console.warn('[ElixisVoiceSession] ' + (audioSalidaActiva
              ? 'el audio nunca cerro tras ' + TOPE_CUELGUE_MS + 'ms (cuelgue real); reabriendo el mic'
              : 'respuesta sin audio: reabriendo el mic tras ' + techoMs + 'ms'));
            audioSalidaActiva = false;
            limpiarBufferEntrada();
            micTx(true);
            micReactivarTimeout = null;
          }, techoMs);
          /* Las llamadas a herramienta viajan DENTRO de response.done. Si se
             cierra el turno aqui sin mirarlas, la consulta no sale nunca. */
          var salida = (m.response && m.response.output) || [];
          var llamadas = salida.filter(function(i){ return i && i.type==='function_call'; });
          if(llamadas.length){ llamadas.forEach(herramienta); break; }
          /* El hilo se guarda completo aqui, no en cada delta -- una fila
             por turno, no una por fragmento de texto. Se guarda tambien en
             historialAsistente (arriba) para el filtro anti-eco. */
          if(hablando && _textoElixis.trim()){
            var _textoFinal = _textoElixis.trim();
            emit('onThreadLine', { rol:'elixis', contenido:_textoFinal, modo:modoActual });
            historialAsistente.push({ texto: _textoFinal.toLowerCase(), ts: Date.now() });
            if(historialAsistente.length > 6) historialAsistente.shift();
          }
          hablando=false;
          emit('onState','listening'); break;
        }
        /* ── EVENTOS REALES DE REPRODUCCION (WebRTC) ──────────────────
           Estos tres son la unica fuente de verdad sobre lo que suena de
           verdad por las bocinas. No confundir:
             · stopped  → la reproduccion NORMAL termino y el buffer se dreno.
                          ESTE es el que reabre el microfono.
             · cleared  → el audio se corto (cancelacion / interrupcion). NO
                          significa "termino bien", pero tambien deja de
                          sonar, asi que tambien pasa por la guarda.
             · started  → empezo a sonar. El mic ya deberia estar cerrado por
                          el delta de transcripcion; esto lo asegura para el
                          caso en que el audio salga antes que el texto. */
        case 'output_audio_buffer.started':
          audioSalidaActiva = true;
          if(micReactivarTimeout){ clearTimeout(micReactivarTimeout); micReactivarTimeout=null; }
          micTx(false);
          break;

        case 'output_audio_buffer.stopped':
        case 'output_audio_buffer.cleared':
          if(localStorage.getItem('elixis_bargein_debug') === '1'){
            console.log('[ElixisVoiceSession] CALIBRACION · pico de tu voz mientras el hablaba: ' +
                        bargeinPico.toFixed(3) + '  (piso actual: ' +
                        ajusteBargein('piso_solo', 0.16).toFixed(3) + ')');
          }
          bargeinPico = 0;
          audioSalidaActiva = false;
          abrirMicTrasGuarda();
          break;

        case 'error':
          /* BUG REAL 2026-08-31 (reporte del PO con captura: avatar colgado
             en "Pensando" indefinidamente). Antes este caso solo avisaba
             (onError, un placeholder de 3.2s en la caja de texto -- facil de
             no ver si se esta mirando el avatar) SIN tocar el estado. Si
             OpenAI rechaza el response.create manual (create_response:false
             para djmago) a mitad de turno, el aviso pasaba y "entendiendo"
             se quedaba pintado para siempre -- el watchdog de arriba habria
             tapado el sintoma en 5s, pero esto ataca la causa real: hay
             conexion viva (dc/pc siguen abiertos), asi que basta con volver
             a "escuchando", no hace falta tirar la sesion entera con stop(). */
          limpiarWatchdogPensando();
          console.error('[ElixisVoiceSession] error del canal de voz:', m.error || m);
          /* Si el rechazo llega justo despues de un corte, es el caso conocido:
             se pidio respuesta con la anterior todavia cerrandose. Se reintenta
             UNA vez -- sin esto el agente obedece el corte y luego se queda
             mudo, que es peor que no haber cortado. */
          if(reintentoTrasCorte && dc && dc.readyState==='open'){
            reintentoTrasCorte = false;
            console.warn('[ElixisVoiceSession] reintentando la respuesta tras el corte');
            setTimeout(function(){
              if(dc && dc.readyState==='open') dc.send(JSON.stringify({ type:'response.create' }));
            }, 250);
          }
          emit('onError', (m.error && m.error.message) || 'Error en el canal de voz');
          emit('onState','listening');
          if(micReactivarTimeout){ clearTimeout(micReactivarTimeout); micReactivarTimeout=null; }
          micTx(true); // no dejar el mic mudo si el error llego a mitad de la respuesta
          break;
      }
    }

    async function start(){
      /* conectando (2026-08-30, portado de mdj-commander.html -- mismo bug
         real ya resuelto ahi, "hey hey hey" en loop): "if(pc) return" solo
         no alcanza -- pc se asigna DESPUES de esperar el microfono, y
         durante esa espera un segundo toque al orbe pasa el mismo guard
         sin problema, creando dos sesiones en paralelo. conectando se pone
         en true ANTES de cualquier await (sincronico, cierra la ventana
         del todo) y se resetea en el finally de abajo pase lo que pase. */
      if(pc || conectando) return;
      conectando = true;
      try{
      var url = fnUrl(null);
      if(!url){ emit('onError','No pude ubicar el servidor de voz'); return; }
      url += (url.indexOf('?')===-1?'?':'&') + 'voice=' + (localStorage.getItem('elixis_voice')||'ash')
           + '&vad=' + (localStorage.getItem('elixis_vad')||'medium')
           + (modoActual ? '&modo=' + encodeURIComponent(modoActual) : '')
           + (identidadActual ? '&identidad=' + encodeURIComponent(identidadActual) : '');

      emit('onState','understanding');
      try{
        mic = await precalentarMic();
        if(!mic) throw new Error('sin_stream');
        // Armado inicial por el mismo camino que todo lo demas, para que el
        // estado del transporte y micArmadoEn queden coherentes desde el primer
        // turno (antes esto encendia la pista por fuera de micTx).
        mic.getAudioTracks().forEach(function(t){ t.enabled=true; });
        micTx(true);
      }catch(e){
        emit('onError','Necesito permiso de micrófono');
        emit('onState','idle'); return;
      }

      pc = new RTCPeerConnection();
      spk = handlers.getAudioEl ? handlers.getAudioEl() : null;
      pc.ontrack = function(ev){
        /* .play() devuelve una Promise -- si Safari bloquea el autoplay
           (NotAllowedError), rechaza SIN tirar una excepcion sincronica, asi
           que el try/catch de aqui nunca la atrapaba: el audio de respuesta
           se perdia en silencio total, sin ni una linea en consola (2026-08-
           31, mismo reporte del PO: "no hay salida de audio"). Ahora se
           loguea de verdad si esto pasa. */
        if(spk){
          try{
            spk.srcObject = ev.streams[0];
            var p = spk.play();
            if(p && typeof p.catch === 'function'){
              p.catch(function(e){ console.warn('[ElixisVoiceSession] audio remoto bloqueado (autoplay):', e && e.message); });
            }
          }catch(_){ }
        }
        anRem = analizador(ev.streams[0]);
      };
      micTrack = mic.getAudioTracks()[0] || null;
      if(micTrack) audioSender = pc.addTrack(micTrack, mic);
      anMic = analizador(mic);

      /* Music Hunter, Rama B (2026-08-30, autorizado por el PO): conecta el
         MISMO stream de mic -- ninguna captura nueva, ningun permiso extra --
         a un buffer circular de 6s (ver music-hunter-ring-buffer.js).

         SOLO identidad==='djmago' (2026-08-30, correccion en vivo -- reporte
         real: "al activar el modo Cazador y conectar el microfono, el audio
         general del sistema/musica se corta"). Antes esto se conectaba en
         TODA sesion de voz, ELIXIS incluido, sin necesidad real -- un
         AudioWorkletNode activo (aunque mudo) sigue procesando cada bloque de
         audio en el hilo de tiempo real del navegador, y sumarle eso a
         CUALQUIER sesion es exponer a Serato a un riesgo que solo tiene
         sentido pagar cuando Cazador Musical de verdad se va a usar. Acotar
         el alcance no prueba por si solo cual era la causa exacta (no hay
         forma de perfilar el audio real del PO desde aca), pero es la unica
         correccion honesta posible sin esa sesion en vivo: menos sesiones
         tocan esta rama, menos sesiones pueden verse afectadas. */
      if(window.MusicHunterRingBuffer && anMic && identidadActual === 'djmago'){
        window.MusicHunterRingBuffer.conectar(ac, mic).then(function(nodo){
          musicHunterNodo = nodo;
          console.log('[ElixisVoiceSession] Music Hunter ring buffer conectado:', !!nodo);
        }).catch(function(e){
          console.error('[ElixisVoiceSession] Music Hunter ring buffer, fallo al conectar:', e);
        });
      }

      dc = pc.createDataChannel('oai-events');
      dc.onopen = function(){
        /* Log de auditoria (2026-08-30, pedido explicito del PO: confirmar
           que esto es la conexion WebRTC real contra OpenAI Realtime y no
           un mock de consola). Este evento solo dispara cuando el canal de
           datos de verdad completo su handshake -- oferta/respuesta SDP
           real intercambiada con el backend (elixis-realtime-session) mas
           ICE/DTLS conectado -- no es un valor fijo ni un placeholder. */
        console.log('[ELIXIS-WEBRTC] Connected:', true, {
          session: sesion, iceConnectionState: pc.iceConnectionState, connectionState: pc.connectionState
        });
        emit('onSystem','Canal de voz conectado. Habla con normalidad.');
        encender();
        emit('onState','listening');
      };
      dc.onmessage = function(ev){ var m; try{ m=JSON.parse(ev.data); }catch(_){ return; } evento(m); };
      pc.onconnectionstatechange = function(){
        if(pc && ['failed','disconnected','closed'].indexOf(pc.connectionState)!==-1) stop(true);
      };

      var offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      var h = await headers(); h['Content-Type']='application/sdp';
      var res;
      try{ res = await fetch(url,{ method:'POST', headers:h, body:offer.sdp }); }
      catch(e){ emit('onError','No pude conectar la voz'); stop(true); return; }

      if(res.status===401){ emit('onUnauthorized'); return; }
      if(res.status===402){
        var q={}; try{ q=await res.json(); }catch(_){}
        emit('onError', q.error==='safety_cap_reached' ? 'Tope técnico alcanzado' : 'Sin saldo de voz · continúa por texto');
        stop(true); return;
      }
      if(res.status===403){ emit('onError','Esta cuenta no tiene acceso de voz'); stop(true); return; }
      if(res.status===429){ emit('onError','Demasiadas sesiones · espera un momento'); stop(true); return; }
      if(!res.ok){ emit('onError','La voz no está disponible ahora'); stop(true); return; }

      sesion = res.headers.get('x-elixis-session');
      t0     = Date.now();

      await pc.setRemoteDescription({ type:'answer', sdp: await res.text() });

      /* El latido evita que el barrendero de el bloque por abandonado y lo
         cobre entero. */
      if(sesion){
        hb = setInterval(function(){
          var u = fnUrl('heartbeat'); if(!u) return;
          headers().then(function(hd){
            fetch(u + '&session=' + encodeURIComponent(sesion), { method:'POST', headers:hd }).catch(function(){});
          });
        }, 4*60*1000);
      }
      }finally{ conectando = false; }
    }

    /* keepalive: la liquidacion sale aunque se cierre la pestaña. Sin esto se
       le cobra al cliente el bloque entero en vez de lo que realmente hablo. */
    function liquidar(){
      if(hb){ clearInterval(hb); hb=0; }
      if(!sesion){ t0=0; return; }
      var u = fnUrl('settle');
      var s = sesion; sesion=null;
      var seg = usados(); t0=0;
      if(!u) return;
      headers().then(function(hd){
        fetch(u + '&session=' + encodeURIComponent(s) + '&used=' + seg,
              { method:'POST', headers:hd, keepalive:true }).catch(function(){});
      });
    }

    function stop(silencioso){
      liquidar();
      if(micReactivarTimeout){ clearTimeout(micReactivarTimeout); micReactivarTimeout=null; } // mic=null mas abajo ya lo haria inofensivo, pero mejor no dejarlo pendiente
      detenerCazadorMusical(); // el ciclo de fondo no puede sobrevivir a musicHunterNodo
      if(dc){ try{ dc.close(); }catch(_){ } dc=null; }
      if(pc){ try{ pc.close(); }catch(_){ } pc=null; }
      if(musicHunterNodo && window.MusicHunterRingBuffer){
        window.MusicHunterRingBuffer.desconectar(musicHunterNodo); musicHunterNodo=null;
      }
      audioSender=null; micTrack=null; bargeinCuadros=0;
      if(mic){ mic.getTracks().forEach(function(t){ try{ t.stop(); }catch(_){ } }); mic=null; }
      if(spk){ try{ spk.pause(); spk.srcObject=null; }catch(_){ } }
      hablando=false;
      apagar();
      emit('onSystem','Canal de voz cerrado.');
      emit('onState','idle');
    }

    /* Modo de enfoque: inyecta contexto a media sesion via session.update,
       el mismo evento que la Realtime API usa para fijar 'instructions' al
       arrancar. No reinicia la conexion ni pierde el hilo de la conversacion
       -- solo cambia lo que ELIXIS tiene en mente para el siguiente turno. */
    function actualizarContexto(instrucciones){
      if(!dc || dc.readyState!=='open') return false;
      /* BUG REAL 2026-08-31 (reporte del PO, error textual de OpenAI en
         consola: "Missing required parameter: 'session.type'."). Confirmado
         contra la documentacion oficial actual (developers.openai.com/api/
         reference/resources/realtime/client-events), no adivinado: el objeto
         `session` de un session.update ahora es una union de dos formas
         (RealtimeSessionCreateRequest / RealtimeTranscriptionSessionCreateRequest)
         y exige `type:"realtime"` para distinguir cual es -- antes esto no
         hacia falta, cambio de esquema de OpenAI, no un bug de este archivo.
         Sin este campo, OpenAI rechazaba CUALQUIER cambio de Modo de Enfoque
         a media llamada con un error real -- que antes de hoy pasaba
         inadvertido (ver el fix de 'error' que ahora si resetea el estado). */
      dc.send(JSON.stringify({ type:'session.update', session:{ type:'realtime', instructions:String(instrucciones||'') } }));
      return true;
    }

    /* INTERRUPCION DETERMINISTA (2026-09-02, tras probar en vivo: "intente
       interrumpirlo pero no me escucho y siguio hablando"). NO era un fallo:
       mientras el asistente habla su microfono esta muteado A PROPOSITO -- es
       lo unico que impide que se oiga a si mismo, porque encender la
       cancelacion de eco del navegador reconfigura CoreAudio y corta a Serato
       en vivo. Pero un microfono muteado no distingue entre el eco y el PO.
       Con bocinas abiertas y sin AEC no se pueden tener las dos cosas por voz.
       La salida es darle a la interrupcion un disparador QUE NO SEA EL
       MICROFONO. El orden importa: primero se cancela la respuesta en curso,
       luego se tira el audio YA GENERADO que espera sonar (sin esto la bocina
       sigue soltando la cola aunque el modelo ya callo), luego se limpia lo
       que hubiera entrado, y solo al final se arma el microfono. */
    function interrumpir(){
      if(!dc || dc.readyState!=='open') return false;
      if(!audioSalidaActiva) return false;      // no hay nada que cortar
      try{
        dc.send(JSON.stringify({ type:'response.cancel' }));
        dc.send(JSON.stringify({ type:'output_audio_buffer.clear' }));
      }catch(_){ return false; }
      if(micReactivarTimeout){ clearTimeout(micReactivarTimeout); micReactivarTimeout=null; }
      audioSalidaActiva = false;
      hablando = false;
      /* BUG REAL 2026-09-02 (reporte en vivo del PO: "me respondio alzando yo
         un poco la voz pero despues se quedo callado"). Al interrumpir, lo que
         el PO dice es casi siempre SOBRE lo que el asistente estaba diciendo --
         se le corta para corregirlo o para meter baza en ese mismo tema. El
         filtro anti-eco por parecido de texto (historialAsistente, ventana de
         12s) veia esa semejanza y descartaba su frase como si fuera eco: el
         agente se quedaba mudo justo despues de obedecer el corte.
         El momento en que mas se parecen es el momento en que MENOS hay que
         comparar: un turno nacido de un corte deliberado es el PO por
         definicion -- no hay eco que filtrar, la bocina ya se vacio con
         output_audio_buffer.clear dos lineas mas arriba. */
      historialAsistente.length = 0;
      turnoSospechoso = false;
      limpiarBufferEntrada();
      micTx(true);                              // sin guarda: el corte lo pediste tu
      emit('onSystem','Te escucho.');
      emit('onState','listening');
      reintentoTrasCorte = true;
      console.log('[ElixisVoiceSession] interrumpido por el usuario');
      return true;
    }

    /* Un solo listener global, no uno por instancia (mismo patron que el
       teclado del carrusel). Se ignora si estas escribiendo: la barra
       espaciadora dentro de un campo de texto es un espacio, no una orden. */
    window.addEventListener('keydown', function(ev){
      if(ev.code !== 'Space' && ev.key !== ' ') return;
      var t = ev.target;
      if(t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA' || t.isContentEditable)) return;
      if(!pc) return;                            // sin sesion viva no hay nada que cortar
      if(interrumpir()) ev.preventDefault();
    });

    window.addEventListener('beforeunload', liquidar);
    /* Guarda el modo para el PROXIMO start() (va en la URL de sesion, ver
       arriba) Y, si ya hay sesion viva, lo aplica de una vez via
       actualizarContexto (session.update no reinicia la llamada). El texto
       humano del modo lo trae quien llama (ya lo tiene: EW_CONTEXTOS en
       staff.html, MC_CONTEXTOS en mdj-commander.html) -- este modulo no
       duplica ese mapa, solo decide CUANDO aplicarlo. */
    function fijarModo(nombre, textoInstrucciones){
      modoActual = nombre || null;
      if(dc && dc.readyState==='open' && textoInstrucciones) actualizarContexto(textoInstrucciones);
    }

    /* Identidad ('elixis'|'djmago', 2026-08-30, fork autorizado por el PO):
       a diferencia de fijarModo(), esto NO se puede aplicar a media sesion
       via session.update -- la identidad completa (quien es, que sabe, que
       tools tiene) se arma UNA vez en el servidor al abrir la llamada
       (buildInstructions() + el arreglo de tools en elixis-realtime-session),
       igual que la voz (?voice=): cambiarla de verdad implica una conexion
       nueva. fijarIdentidad() solo decide con que identidad arranca el
       PROXIMO start() -- quien llama (staff.html, segun que avatar este
       activo) la fija antes de tocar el orbe. */
    function fijarIdentidad(nombre){
      identidadActual = nombre || null;
    }

    /* Instantanea de audio crudo para Music Hunter (Rama B) -- devuelve
       null si no hay sesion de voz activa o si el archivo del ring buffer
       no esta cargado en la pagina. La maquina de estados de "Cazador
       Musical" (item 4, no autorizado aun) es quien decide CUANDO llamar
       esto; este modulo solo expone el dato. */
    function obtenerMuestraMusicHunter(){
      return (musicHunterNodo && window.MusicHunterRingBuffer)
        ? window.MusicHunterRingBuffer.obtenerInstantanea(musicHunterNodo)
        : Promise.resolve(null);
    }

    /* Cazador Musical, Modo B ("continuo" / setlist logger, 2026-08-30,
       autorizado por el PO): un ciclo de fondo cada 18s (dentro del rango
       15-20s pedido) que llama a identificar_track SIN pasar por el modelo
       de voz -- esto es deliberado, no un atajo: el pedido explicito fue
       "silenciar respuestas de voz automaticas durante el modo continuo
       para no interferir en cabina". Si esto fuera una tool-call real (como
       el Modo A "bajo demanda"), cada deteccion forzaria una respuesta
       hablada de DjMago sobre una cancion que nadie pidio identificar.
       En cambio esto llama accion('identificar_track', ...) DIRECTO (el
       mismo helper HTTP que usan consultar/memory_write) y solo avisa por
       el evento onMusicHunterTrack -- quien escuche (staff.html) decide
       que hacer (hoy: una fila en la tabla de Live Setlist), sin que la
       voz de la sesion diga una palabra.

       RE-VERIFICADO (2026-08-30, reporte en vivo del PO con capturas): la
       narracion en ingles ("no hay match todavia, Gerardo"/"dejame escuchar
       de nuevo") que se vio en produccion NO vino de aca -- esta funcion
       nunca toco `dc`. Vino del Modo A (herramienta(), mas abajo): el VAD
       normal confundio letras/voces de la musica de fondo con el DJ
       hablandole al avatar, y el modelo penso que le habian preguntado.
       El arreglo real esta del lado del servidor (umbral de VAD mas alto
       para identidad djmago + regla dura de silencio en el prompt, ver
       elixis-realtime-session/index.ts) -- este modulo no necesito cambios,
       ya estaba desacoplado como debia. */
    var CAZADOR_INTERVALO_MS = 18000;
    /* Piso de confianza (2026-08-30, reporte real: "las canciones que
       identifico no son las que han sonado en el ambiente") -- antes se
       aceptaba CUALQUIER match con artista/titulo, sin mirar la confianza.
       Verificado en una prueba anterior con un tono sintetico (sin musica
       real): ACRCloud devolvio un match REAL pero completamente falso, con
       confidence:0.28 -- exactamente el tipo de resultado que esta pasando
       en vivo. La causa de fondo probablemente sigue siendo la fuente de
       audio (mic ambiente/built-in, elegido a proposito para no tocar la
       interfaz de Serato -- ver elegirMicrofono() -- pero lejos y de baja
       fidelidad para fingerprinting real), no algo que este piso arregle
       del todo; pero al menos deja de registrar como "identificado" algo
       que ACRCloud en el fondo tampoco esta seguro de que sea. */
    var CAZADOR_CONFIANZA_MINIMA = 0.5;
    var cazadorTimer = 0, cazadorUltimoId = null, cazadorOrden = 0, cazadorCiclo = 0;
    function iniciarCazadorMusical(){
      if(cazadorTimer){ console.log('[CazadorMusical] iniciarCazadorMusical(): ya estaba corriendo, no hace nada.'); return; }
      console.log('[CazadorMusical] ciclo iniciado, cada', CAZADOR_INTERVALO_MS, 'ms. musicHunterNodo activo:', !!musicHunterNodo);
      cazadorTimer = setInterval(async function(){
        cazadorCiclo += 1;
        var etiqueta = '[CazadorMusical] ciclo #' + cazadorCiclo;
        /* Logs pedidos explicitamente (2026-08-30, reporte "playlist vacia,
           el ciclo de 18s no esta logrando identificar pistas") -- antes de
           esto no habia forma de saber, con datos reales, en que paso se
           estaba perdiendo: si musicHunterNodo nunca se conecto, si el
           buffer llegaba vacio, o si llegaba lleno pero ACRCloud de verdad
           no encontraba coincidencia (muy real con musica mezclada/pitcheada
           en vivo -- el fingerprint de un DJ set no calza igual que el de la
           grabacion de estudio original). */
        if(!musicHunterNodo){ console.warn(etiqueta, 'sin musicHunterNodo -- el ring buffer nunca se conecto en este start().'); return; }
        var muestra = await obtenerMuestraMusicHunter();
        if(!muestra || !muestra.pcm || !muestra.pcm.length){
          console.warn(etiqueta, 'obtenerMuestraMusicHunter() no devolvio PCM utilizable:', muestra);
          return;
        }
        console.log(etiqueta, 'PCM listo -- muestras:', muestra.pcm.length, '· sampleRate:', muestra.sampleRate, '· segundos reales:', muestra.segundos.toFixed(2));
        var resultado = await accion('identificar_track', {
          pcm_base64: pcmABase64(muestra.pcm), sample_rate: muestra.sampleRate,
        });
        console.log(etiqueta, 'respuesta de identificar_track:', resultado);
        if(!resultado || resultado.ok === false){ console.warn(etiqueta, 'la Edge Function respondio fallo.'); return; }
        if(resultado.mock){ console.warn(etiqueta, 'ACRCloud sin configurar (modo mock) -- nada real que registrar.'); return; }
        if(!resultado.artist && !resultado.title){ console.log(etiqueta, 'sin coincidencia real en ACRCloud para esta muestra.'); return; }
        if((resultado.confidence||0) < CAZADOR_CONFIANZA_MINIMA){
          console.warn(etiqueta, 'match descartado por confianza baja ('+resultado.confidence+' < '+CAZADOR_CONFIANZA_MINIMA+'):', resultado.artist, '-', resultado.title);
          return;
        }
        /* Anti-duplicado por ID/título (pedido explicito): isrc si vino,
           si no artista+titulo normalizado -- mientras siga sonando el
           MISMO track, cada ciclo de 18s vuelve a "detectarlo" y no debe
           generar una fila nueva cada vez. */
        var idNuevo = (resultado.isrc || (resultado.artist||'') + '|' + (resultado.title||'')).toLowerCase();
        if(idNuevo === cazadorUltimoId){ console.log(etiqueta, 'mismo track que el anterior, no se duplica fila.'); return; }
        cazadorUltimoId = idNuevo;
        cazadorOrden += 1;
        console.log(etiqueta, 'track NUEVO -> fila #' + cazadorOrden, resultado.artist, '-', resultado.title);
        emit('onMusicHunterTrack', {
          orden: cazadorOrden, hora: new Date(), artist: resultado.artist, title: resultado.title,
          bpm: resultado.bpm, musical_key: resultado.musical_key, genre: resultado.genre,
          isrc: resultado.isrc, confidence: resultado.confidence,
        });
      }, CAZADOR_INTERVALO_MS);
    }
    function detenerCazadorMusical(){
      if(cazadorTimer){ clearInterval(cazadorTimer); cazadorTimer=0; }
      cazadorUltimoId = null; cazadorOrden = 0; cazadorCiclo = 0;
    }

    /* enviarTexto(): via de entrada de TEXTO para el mismo turno de voz --
       conversation.item.create con role:user + input_text es el mecanismo
       real y documentado de la Realtime API para mezclar texto y voz en la
       misma sesion (no es un endpoint aparte).
       NO arranca start() por su cuenta (revertido 2026-08-29, incidente real
       del PO: escribir texto sin sesion activa disparaba getUserMedia() por
       primera vez en la pestana -- eso corto el audio de Serato un instante
       en vivo, DJ tocando en ese momento). Requiere sesion YA activa
       (activa()===true, el usuario prendio la voz a mano con el orbe) --
       nunca toca el microfono como efecto secundario de escribir. */
    function enviarTexto(texto){
      texto = String(texto||'').trim();
      if(!texto) return;
      if(!dc || dc.readyState!=='open'){
        enviarTextoSolo(texto);
        return;
      }
      dc.send(JSON.stringify({ type:'conversation.item.create',
        item:{ type:'message', role:'user', content:[{ type:'input_text', text:texto }] } }));
      dc.send(JSON.stringify({ type:'response.create' }));
    }

    /* Modo escritura SIN sesion de voz (2026-08-31, orden del PO: escribir
       no debe exigir microfono). NO se implemento como pedia el ticket
       literal ("conecta la sesion WebRTC en segundo plano" / "modo solo-
       datos sin audio") -- el comentario de arriba documenta el incidente
       REAL que puso este candado en primer lugar (2026-08-29: escribir sin
       sesion activa disparaba getUserMedia() por primera vez en la pestana y
       corto el audio de Serato en vivo). Cualquier camino que termine
       llamando a start() como efecto secundario de escribir reabre EXACTAMENTE
       ese incidente. En vez de eso, reusa el MISMO backend de texto puro que
       ya usa mdj-commander.html (askElixis() -> elixis-orchestrator, HTTP
       plano) -- nunca toca WebRTC, RTCPeerConnection ni getUserMedia. La
       Realtime API tampoco documenta un modo "solo texto, sin audio" real
       para WebRTC -- forzar eso a ciegas habria arriesgado el mismo tipo de
       error de esquema que ya costo una sesion completa (session.type). */
    async function enviarTextoSolo(texto){
      var url = window.mdbSupabaseFunctionUrl ? window.mdbSupabaseFunctionUrl('elixis-orchestrator') : null;
      if(!url){ emit('onError','No pude ubicar el servidor de texto.'); return; }
      /* BUG REAL 2026-08-31 (reporte del PO: "sale el avatar por un segundo,
         no sale nada en el chat... esto es chat escrito, no se necesita
         avatar aqui"). Dos causas, dos fixes:
         (1) el flag textoSolo:true en los onTranscript de abajo -- staff.html
             lo usa para ABRIR el panel de Hilos & Transcripcion, que ahora
             arranca cerrado por defecto (commit anterior, mismo dia). Sin
             este flag el texto SI se escribia en el DOM (confirmado en la
             verificacion previa) pero quedaba oculto dentro del panel
             colapsado -- el usuario nunca lo veia.
         (2) se quitaron los emit('onState', 'understanding'/'idle') que
             habia antes: eso es lo que prendia y apagaba la caja del avatar
             un instante (.avatar-stage deja de ser 'idle' -> opacity:1,
             vuelve a 'idle' -> opacity:0). En una conversacion de solo
             texto no hay nada que el avatar deba actuar -- el PO lo dijo
             explicito, esto es chat escrito. */
      emit('onTranscript', { who:'yo', text:texto, final:true, textoSolo:true });
      emit('onThreadLine', { rol:'yo', contenido:texto, modo:modoActual, textoSolo:true });
      try{
        var h = await headers();
        var res = await fetch(url, { method:'POST', headers:h, body:JSON.stringify({ message:texto, history:historialTexto.slice(-20) }) });
        if(res.status===401){ emit('onUnauthorized'); return; }
        var d = {}; try{ d = await res.json(); }catch(_){}
        if(!res.ok || !d.reply){
          emit('onError', (d && d.error==='forbidden_not_staff') ? 'Esta cuenta no tiene acceso de staff/owner.' : 'No se pudo obtener respuesta de texto.');
          return;
        }
        emit('onTranscript', { who:'elixis', start:true, textoSolo:true });
        emit('onTranscript', { who:'elixis', delta:d.reply, textoSolo:true });
        emit('onThreadLine', { rol:'elixis', contenido:d.reply, modo:modoActual, textoSolo:true });
        historialTexto.push({ role:'user', content:texto });
        historialTexto.push({ role:'assistant', content:d.reply });
        if(historialTexto.length > 40) historialTexto = historialTexto.slice(-40);
      }catch(e){
        emit('onError','No pude conectar con el texto.');
      }
    }

    /* Siembra/reemplaza el buffer de continuidad de texto -- llamado por
       staff.html al cargar el historial real de un hilo (elixis_get_thread_
       history) o al archivar uno nuevo (arreglo vacio). No dispara red ni
       toca la sesion de voz; solo el buffer que enviarTextoSolo() manda como
       "history" en el proximo turno. */
    function cargarHistorialTexto(mensajes){
      historialTexto = Array.isArray(mensajes) ? mensajes.slice(-20) : [];
    }

    /* Dispara el pre-calentado al entrar al workspace, no al primer clic
       del orbe -- mismo momento que "al entrar a Comando" en
       mdj-commander.html. crear() solo corre una vez por carga de pagina
       (ver el guard ewIniciado en staff.html), asi que esto tampoco se
       repite. Sin await: corre en segundo plano, silencioso (los errores
       ya los traga precalentarMic() a proposito), listo para cuando el
       usuario si toque el orbe. */
    precalentarMic();

    return { start:start, stop:stop, activa:function(){ return !!pc; }, actualizarContexto:actualizarContexto,
      fijarModo:fijarModo, fijarIdentidad:fijarIdentidad, obtenerMuestraMusicHunter:obtenerMuestraMusicHunter,
      iniciarCazadorMusical:iniciarCazadorMusical, detenerCazadorMusical:detenerCazadorMusical,
      enviarTexto:enviarTexto, cargarHistorialTexto:cargarHistorialTexto,
        interrumpir:interrumpir };
  }

  window.ElixisVoiceSession = { crear:crear, ESTADOS:ESTADOS };
})();
