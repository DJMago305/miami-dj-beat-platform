/* ═══════════════════════════════════════════════════════════════════
   ELIXIS · puente de streaming LiveAvatar (HeyGen) para
   <video id="elixis-avatar-stream"> -- v4, portal inmutable (2026-08-27)
   ═══════════════════════════════════════════════════════════════════
   HISTORIAL:
   v1 hablaba con una API descontinuada (conectaba, nunca entregaba nada).
   v2 armo la conexion real a mano (LiveKit + websocket propio) pero con
   el protocolo de habla equivocado. v3 cambio al SDK oficial de HeyGen
   (protocolo correcto) pero el <video> seguia viviendo DENTRO de la
   pantalla que mdj-commander.html repinta en cada cambio de estado
   (escuchando/pensando/hablando) -- eso pasa todo el tiempo en una
   conversacion real, y cada repintado creaba un <video> nuevo y vacio en
   el lugar del que tenia el track conectado. Varios intentos de "no
   reconstruyas si hay sesion viva" siguieron chocando con condiciones de
   carrera (el aviso de listo llegando a mitad de un repintado, etc.) --
   confirmado en vivo, reportado por el PO, 2026-08-27.

   v4 (esta version) saca el <video> del problema de raiz: vive en un
   PORTAL fijo en el HTML (fuera de cualquier pantalla que se repinte),
   NUNCA se crea ni se destruye por un cambio de estado. mdj-commander.html
   solo lo reposiciona (estilos, no reconstruccion) para que visualmente
   quede encima de donde esta el avatar. Ver ahi mismo la funcion
   sincronizarPortalHeygen().

   FLUJO REAL (API real de LiveAvatar, confirmada contra codigo fuente,
   no contra su documentacion en prosa -- esa resulto tener el nombre de
   comando equivocado):
     backend (heygen-session-token) -> POST /v1/sessions/token con la
       clave permanente -> { session_token }
     frontend (aqui) -> new LiveAvatarSession(session_token, {voiceChat:
       false}) -> session.start() -- el SDK llama el solo a
       /v1/sessions/start con ese token corto (seguro exponerlo: esta
       limitado por rol y expira rapido, nunca es la clave permanente).
     video -> session.on(SessionEvent.SESSION_STREAM_READY, ...) ->
       session.attach(videoEl)
     voz -> session.repeatAudio(base64) -- LiveAvatar no sintetiza voz
       aqui, hay que darle audio ya generado. ELIXIS lo genera via
       elixis-tts (formato pcm crudo, 24kHz/16-bit -- exactamente lo que
       pide LiveAvatar, cero conversion en el navegador). repeatAudio()
       NO trocea internamente (confirmado en su codigo fuente): el troceo
       real a ~1s por llamada se hace aqui.

   DECISION DE ARQUITECTURA (sin cambios desde v1): mdj-commander.html
   silencia la voz normal de OpenAI (spk.muted, en RT.latir()) SOLO
   mientras state.modoPresentacion esta activo, y llama a hablar() una vez
   por turno completo (en el 'response.done' de RT.evento()).

   Llave ya configurada en Supabase Secrets (HEYGEN_API_KEY). Falta
   unicamente el avatar_id real: puedeIniciar() dice la verdad y da false
   hasta que exista window.MDB_HEYGEN_AVATAR_ID.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var sesion = null;      // { session: LiveAvatarSession } en vivo, o null
  var listo = false;      // true solo entre SESSION_STREAM_READY y desconexion
  var conectando = null;  // promesa de iniciar() en vuelo, o null
  var pararChroma = null; // funcion para apagar el recorte de fondo verde, o null

  function log(msg, extra){
    if(extra !== undefined) console.log('[HEYGEN-STATUS] '+msg, extra);
    else console.log('[HEYGEN-STATUS] '+msg);
  }

  function puedeIniciar(){
    return !!(window.MDB_HEYGEN_AVATAR_ID && window.LiveAvatarSDK);
  }

  /* La pantalla lee esto en cada repintado para decidir si mostrar la foto
     estatica o dejar ver el portal -- sin tocar el DOM del video para
     nada, solo una lectura de estado. */
  function estaListo(){
    return listo;
  }

  async function pedirToken(){
    if(typeof window.mdbSupabaseFunctionUrl !== 'function') throw new Error('falta mdbSupabaseFunctionUrl');
    if(typeof window._invokeHeaders !== 'function') throw new Error('falta _invokeHeaders (definido en cada pagina)');
    var url = window.mdbSupabaseFunctionUrl('heygen-session-token');
    var r = await fetch(url, {
      method:'POST',
      headers: window._invokeHeaders(),
      body: JSON.stringify({ avatar_id: window.MDB_HEYGEN_AVATAR_ID })
    });
    var d = {}; try{ d = await r.json(); }catch(e){}
    if(!r.ok || !d.ok || !d.session_token) throw new Error('heygen_token_failed: ' + (d.error||r.status));
    return d.session_token;
  }

  function esperar(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  function base64DeBytes(bytes){
    var CHUNK = 0x8000, binario = '';
    for(var i=0;i<bytes.length;i+=CHUNK){
      binario += String.fromCharCode.apply(null, bytes.subarray(i, i+CHUNK));
    }
    return btoa(binario);
  }

  /* El <video> vive en un portal fijo (ver mdj-commander.html) -- se busca
     SIEMPRE por id en todo el documento, nunca dentro de un contenedor que
     se repinte. El parametro "contenedor" ya no se usa para encontrarlo;
     se mantiene solo por compatibilidad de firma. */
  async function iniciar(contenedor){
    if(!puedeIniciar()) throw new Error('avatar-heygen-stream: falta MDB_HEYGEN_AVATAR_ID o el SDK no cargo');
    if(sesion) return sesion; // ya conectado
    if(conectando) return conectando; // ya hay una conexion en curso -- no arrancar una segunda

    conectando = (async function(){
      var video = document.getElementById('elixis-avatar-stream');
      if(!video) throw new Error('avatar-heygen-stream: no encontre #elixis-avatar-stream');

      log('Connecting');
      var token = await pedirToken();
      var SDK = window.LiveAvatarSDK;
      /* voiceChat:false -- no queremos que el SDK capture el microfono del
         staff para mandarselo a LiveAvatar: la conversacion real la maneja
         nuestro propio OpenAI Realtime, esto es solo la cara+voz. */
      var session = new SDK.LiveAvatarSession(token, { voiceChat: false });

      session.on(SDK.SessionEvent.SESSION_STREAM_READY, function(){
        session.attach(video);
        listo = true;
        log('Stream_Ready');
        /* Recorte de fondo verde (2026-08-27): Katya es de los "green-screen
           studio avatars" del catalogo de LiveAvatar -- el fondo verde solido
           es a proposito, pensado para removerse del lado del cliente (no
           hay parametro de fondo en la API de sesion, confirmado). El canvas
           visible vive en mdj-commander.html (#elixis-avatar-canvas, mismo
           portal fijo que el <video>); este solo arranca/para el bucle que
           lo dibuja. Si el canvas no existe todavia (pagina vieja sin este
           cambio) se sigue viendo el <video> crudo, sin romper nada. */
        var canvas = document.getElementById('elixis-avatar-canvas');
        if(canvas && window.AvatarHeygenChromaKey){
          if(pararChroma){ try{ pararChroma(); }catch(e){} }
          pararChroma = window.AvatarHeygenChromaKey.iniciarChromaKey(video, canvas);
        }
        /* Esto pasa en un momento cualquiera, no necesariamente junto a un
           repintado de pantalla -- mdj-commander.html necesita saber YA para
           posicionar el portal, no esperar a que algo mas dispare un render
           por casualidad. */
        document.dispatchEvent(new CustomEvent('heygen-listo'));
      });
      session.on(SDK.SessionEvent.SESSION_DISCONNECTED, function(razon){
        log('Disconnected', razon);
        detener();
        /* Este modulo no conoce el "state" de mdj-commander.html (a proposito,
           para no acoplarlos) -- sin este evento, una caida sola de la sesion
           (no un "Detener presentacion" del staff) dejaba modoPresentacion
           trabado en true del otro lado: la voz de OpenAI seguia muda para
           siempre porque nadie sabia que Katya ya no estaba. Encontrado en
           vivo 2026-08-27 ("se queda mudo"). */
        document.dispatchEvent(new CustomEvent('heygen-desconectado', { detail:{ razon: razon } }));
      });

      try{
        await session.start();
      }catch(e){
        log('Error', e && e.message || e);
        try{ session.stop(); }catch(e2){}
        throw e;
      }

      sesion = { session: session };
      return sesion;
    })();

    try{
      return await conectando;
    }finally{
      /* Se limpia siempre (exito o fallo) -- si no, un intento fallido
         dejaria "conectando" trabado y el proximo click pensaria que ya
         hay una conexion en curso para siempre. */
      conectando = null;
    }
  }

  /* Genera el audio real (elixis-tts, formato pcm crudo) y se lo manda a
     LiveAvatar en trozos de ~1s via el SDK oficial -- repeatAudio() no
     trocea solo (confirmado en su codigo fuente), asi que el ritmo real
     (mandar cada trozo con una pausa de 1s, como si fuera un microfono en
     vivo) se hace aqui.

     Si preguntas justo al activar "Modo presentacion", la respuesta de
     ELIXIS puede llegar mientras iniciar() todavia esta conectando (tarda
     unos segundos) -- antes, hablar() se rendia en silencio porque sesion
     todavia era null, y Katya se quedaba muda en esa primera pregunta sin
     ningun aviso (encontrado en vivo, 2026-08-27; cero llamadas a
     elixis-tts en los registros del servidor lo confirmo). Ahora espera a
     que esa conexion en curso termine antes de decidir si hay o no sesion. */
  async function hablarInterno(texto){
    if(conectando){ try{ await conectando; }catch(e){ return; } }
    if(!sesion || !texto) return;
    if(typeof window.mdbSupabaseFunctionUrl !== 'function') return;
    var url = window.mdbSupabaseFunctionUrl('elixis-tts');
    var cuerpo = { text: String(texto), format: 'pcm' };
    if(window.MDB_HEYGEN_AVATAR_VOICE) cuerpo.voice = window.MDB_HEYGEN_AVATAR_VOICE;
    var r = await fetch(url, {
      method:'POST',
      headers: window._invokeHeaders(),
      body: JSON.stringify(cuerpo)
    });
    if(!r.ok) throw new Error('heygen_tts_failed: ' + r.status);
    var bytes = new Uint8Array(await r.arrayBuffer());
    var PASO = 48000; // 1s de PCM16 mono a 24kHz = 24000 muestras * 2 bytes
    for(var i=0;i<bytes.length;i+=PASO){
      if(!sesion) return; // se pudo haber cortado la presentacion a mitad de envio
      var trozo = bytes.subarray(i, i+PASO);
      sesion.session.repeatAudio(base64DeBytes(trozo));
      if(i+PASO < bytes.length) await esperar(1000);
    }
  }

  /* Cola serial (2026-08-27, "se esta demorando mucho en responder"): antes
     mdj-commander.html llamaba hablar() UNA vez por turno completo, con el
     texto entero ya cerrado -- Katya no decia nada hasta que el LLM
     terminaba de escribir TODA la respuesta Y elixis-tts generaba el audio
     de esa respuesta ENTERA. Ahora mdj-commander.html llama hablar() una vez
     POR ORACION, apenas esa oracion queda completa en el texto que va
     llegando (ver response.output_audio_transcript.delta) -- Katya arranca a
     hablar con la primera oracion mientras el LLM todavia esta escribiendo
     el resto, igual que ya pasa con la voz nativa de OpenAI en modo DJMago.
     Sin esta cola, dos oraciones listas casi juntas pisarian su audio (la
     oracion 2 empezaria a mandarse antes de que la 1 terminara) -- la cola
     fuerza que cada hablar() espere a que el anterior termine de mandar todo
     su audio antes de arrancar el siguiente, sin que quien llama tenga que
     coordinar nada. Un fallo en una oracion (ej. elixis-tts caido) no traba
     la cola para las que siguen. */
  var colaHabla = Promise.resolve();
  function hablar(texto){
    colaHabla = colaHabla.then(function(){ return hablarInterno(texto); }, function(){ return hablarInterno(texto); });
    return colaHabla;
  }

  function detener(){
    if(pararChroma){ try{ pararChroma(); }catch(e){} pararChroma = null; }
    if(!sesion){ listo = false; return; }
    try{ sesion.session.stop(); }catch(e){}
    var video = document.getElementById('elixis-avatar-stream');
    if(video){ try{ video.srcObject = null; }catch(e){} }
    sesion = null; listo = false;
  }

  window.AvatarHeygenStream = {
    puedeIniciar: puedeIniciar,
    estaListo: estaListo,
    iniciar: iniciar,
    hablar: hablar,
    detener: detener
  };
})();
