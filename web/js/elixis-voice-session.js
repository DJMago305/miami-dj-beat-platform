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
    var hablando=false, vivo=false, pulso=0, modoActual=null, _textoElixis='';
    var conectando=false, micPrecalentado=null;
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
    function latir(){
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
      else                                    out = { ok:false, motivo:'herramienta_desconocida' };
      emit('onTool', { nombre:item.name, args:args, ok:(out&&out.ok!==false) });

      if(!dc || dc.readyState!=='open') return;
      dc.send(JSON.stringify({ type:'conversation.item.create',
        item:{ type:'function_call_output', call_id:item.call_id, output:JSON.stringify(out) } }));
      dc.send(JSON.stringify({ type:'response.create' }));   /* sin esto se queda mudo */
    }

    function evento(m){
      switch(m.type){
        /* Lo que dice el humano, por escrito — la copia de mdj-commander no
           la tenia, la de elixis-console si (ver su propio comentario "LO
           QUE DICE EL CAPITAN, por escrito. Sin esto el chat enseñaba media
           conversacion"). Se conserva aqui para no perder esa mejora real. */
        case 'conversation.item.input_audio_transcription.completed': {
          var dicho = (m.transcript || '').trim();
          if(dicho){
            emit('onTranscript', { who:'yo', text:dicho, final:true });
            emit('onThreadLine', { rol:'yo', contenido:dicho, modo:modoActual });
            /* Modo dialogo bajo demanda (ver PREGUNTA_CANCION_RE arriba):
               con identidad djmago, create_response:false hace que llegar
               hasta aca (transcripcion real, turno detectado) NO implique
               que DjMago vaya a decir nada -- salvo que la transcripcion
               real diga que le preguntaron por la cancion. */
            if(identidadActual === 'djmago' && PREGUNTA_CANCION_RE.test(dicho) && dc && dc.readyState==='open'){
              dc.send(JSON.stringify({ type:'response.create' }));
            }
          }
          break;
        }
        case 'input_audio_buffer.speech_started':
          hablando=false;
          emit('onTranscript', { who:'elixis', reset:true });
          emit('onState','listening'); break;

        case 'input_audio_buffer.speech_stopped':
          emit('onState','understanding'); break;

        case 'response.output_audio_transcript.delta':
          if(!hablando){ hablando=true; _textoElixis=''; emit('onTranscript', { who:'elixis', start:true }); }
          _textoElixis += (m.delta||'');
          emit('onTranscript', { who:'elixis', delta:(m.delta||'') });
          emit('onState','speaking'); break;

        case 'response.done': {
          /* Las llamadas a herramienta viajan DENTRO de response.done. Si se
             cierra el turno aqui sin mirarlas, la consulta no sale nunca. */
          var salida = (m.response && m.response.output) || [];
          var llamadas = salida.filter(function(i){ return i && i.type==='function_call'; });
          if(llamadas.length){ llamadas.forEach(herramienta); break; }
          /* El hilo se guarda completo aqui, no en cada delta -- una fila
             por turno, no una por fragmento de texto. */
          if(hablando && _textoElixis.trim()) emit('onThreadLine', { rol:'elixis', contenido:_textoElixis.trim(), modo:modoActual });
          hablando=false;
          emit('onState','listening'); break;
        }
        case 'error':
          emit('onError', (m.error && m.error.message) || 'Error en el canal de voz'); break;
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
        mic.getAudioTracks().forEach(function(t){ t.enabled=true; });
      }catch(e){
        emit('onError','Necesito permiso de micrófono');
        emit('onState','idle'); return;
      }

      pc = new RTCPeerConnection();
      spk = handlers.getAudioEl ? handlers.getAudioEl() : null;
      pc.ontrack = function(ev){
        if(spk){ try{ spk.srcObject = ev.streams[0]; spk.play(); }catch(_){ } }
        anRem = analizador(ev.streams[0]);
      };
      mic.getAudioTracks().forEach(function(t){ pc.addTrack(t, mic); });
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
      detenerCazadorMusical(); // el ciclo de fondo no puede sobrevivir a musicHunterNodo
      if(dc){ try{ dc.close(); }catch(_){ } dc=null; }
      if(pc){ try{ pc.close(); }catch(_){ } pc=null; }
      if(musicHunterNodo && window.MusicHunterRingBuffer){
        window.MusicHunterRingBuffer.desconectar(musicHunterNodo); musicHunterNodo=null;
      }
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
      dc.send(JSON.stringify({ type:'session.update', session:{ instructions:String(instrucciones||'') } }));
      return true;
    }

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
        emit('onError','Activa la voz antes de escribir — así no se toca el micrófono sin que tú lo pidas.');
        return;
      }
      dc.send(JSON.stringify({ type:'conversation.item.create',
        item:{ type:'message', role:'user', content:[{ type:'input_text', text:texto }] } }));
      dc.send(JSON.stringify({ type:'response.create' }));
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
      enviarTexto:enviarTexto };
  }

  window.ElixisVoiceSession = { crear:crear, ESTADOS:ESTADOS };
})();
