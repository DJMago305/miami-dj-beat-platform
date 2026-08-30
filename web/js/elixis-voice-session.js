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

    function fnUrl(accion){
      if(!window.mdbSupabaseFunctionUrl) return null;
      var u = window.mdbSupabaseFunctionUrl('elixis-realtime-session');
      if(!u) return null;
      return accion ? u + (u.indexOf('?')===-1?'?':'&') + 'action=' + accion : u;
    }
    function usados(){ return t0 ? Math.max(0, Math.round((Date.now()-t0)/1000)) : 0; }

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
      if(pc) return;
      var url = fnUrl(null);
      if(!url){ emit('onError','No pude ubicar el servidor de voz'); return; }
      url += (url.indexOf('?')===-1?'?':'&') + 'voice=' + (localStorage.getItem('elixis_voice')||'ash')
           + '&vad=' + (localStorage.getItem('elixis_vad')||'medium')
           + (modoActual ? '&modo=' + encodeURIComponent(modoActual) : '');

      emit('onState','understanding');
      try{
        mic = await navigator.mediaDevices.getUserMedia({
          audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } });
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

      dc = pc.createDataChannel('oai-events');
      dc.onopen = function(){
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
      if(dc){ try{ dc.close(); }catch(_){ } dc=null; }
      if(pc){ try{ pc.close(); }catch(_){ } pc=null; }
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

    return { start:start, stop:stop, activa:function(){ return !!pc; }, actualizarContexto:actualizarContexto, fijarModo:fijarModo, enviarTexto:enviarTexto };
  }

  window.ElixisVoiceSession = { crear:crear, ESTADOS:ESTADOS };
})();
