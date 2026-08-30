/* ═══════════════════════════════════════════════════════════════════
   MUSIC HUNTER · buffer circular de audio crudo (Rama B)
   ═══════════════════════════════════════════════════════════════════
   Autorizado por el PO 2026-08-30 (especificacion "Music Hunter" +
   ticket de arranque "empieza por el fork del backend y la conexion
   del Ring Buffer en el cliente"). Esto es SOLO la Rama B: un buffer
   circular de los ultimos N segundos de PCM del mismo microfono que ya
   usa la conversacion de voz. No llama a ACRCloud, no tiene ciclo de
   muestreo cada 15-20s, no toca la tool identificar_track -- eso es la
   Edge Function music-fingerprint y la maquina de estados del modo
   "Cazador Musical" (items 3 y 4 de la especificacion, todavia no
   autorizados). Esto es la tuberia que esas piezas van a usar.

   POR QUE AudioWorklet y no ScriptProcessorNode: ScriptProcessorNode
   esta deprecado desde hace anos (sigue funcionando, pero es la API
   vieja); AudioWorklet es la reemplaza real, corre fuera del hilo
   principal (no compite con el render de la UI) y es lo que hay que
   usar en codigo nuevo en 2026. El unico costo es que el codigo del
   procesador vive en su propio scope aislado (AudioWorkletGlobalScope,
   sin acceso a `window`) y hay que cargarlo como un modulo aparte via
   audioWorklet.addModule(url) -- en vez de sumar un segundo archivo
   .js estatico solo para eso, el codigo del procesador se genera como
   Blob URL aca mismo: un solo archivo, misma tecnica que usa cualquier
   polyfill de worklet inline.

   COMO SE USA (ver la conexion real en elixis-voice-session.js):
     var nodo = await window.MusicHunterRingBuffer.conectar(audioContext, micStream);
     ... mas tarde, cuando haga falta una muestra ...
     var instantanea = await window.MusicHunterRingBuffer.obtenerInstantanea(nodo);
     // instantanea = { pcm: Float32Array, sampleRate: number, segundos: number }
     window.MusicHunterRingBuffer.desconectar(nodo); // al cortar la sesion
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var PROCESADOR_NOMBRE = 'music-hunter-ring-processor';
  var SEGUNDOS_BUFFER_DEFAULT = 6;

  /* Codigo del AudioWorkletProcessor, como texto -- corre en su propio
     scope aislado, nunca en el hilo principal. Mantiene un ring buffer
     mono de N segundos y responde con una copia ordenada cronologicamente
     cuando el hilo principal la pide por mensaje ("instantanea"). */
  var PROCESADOR_SRC = [
    'class MusicHunterRingProcessor extends AudioWorkletProcessor {',
    '  constructor(opciones){',
    '    super();',
    '    var segundos = (opciones && opciones.processorOptions && opciones.processorOptions.segundos) || 6;',
    '    this.tam = Math.max(1, Math.ceil(sampleRate * segundos));',
    '    this.buffer = new Float32Array(this.tam);',
    '    this.escritura = 0;',
    '    this.lleno = false;',
    '    var self = this;',
    '    this.port.onmessage = function(ev){',
    '      if(!ev.data || ev.data.cmd !== "instantanea") return;',
    '      var salida = new Float32Array(self.tam);',
    '      if(self.lleno){',
    '        var resto = self.tam - self.escritura;',
    '        salida.set(self.buffer.subarray(self.escritura), 0);',
    '        salida.set(self.buffer.subarray(0, self.escritura), resto);',
    '      } else {',
    '        salida.set(self.buffer.subarray(0, self.escritura), 0);',
    '      }',
    '      var segundosReales = (self.lleno ? self.tam : self.escritura) / sampleRate;',
    '      self.port.postMessage({cmd:"instantanea", buffer:salida, sampleRate:sampleRate, segundos:segundosReales}, [salida.buffer]);',
    '    };',
    '  }',
    '  process(inputs){',
    '    var canal = inputs[0] && inputs[0][0];',
    '    if(!canal || !canal.length) return true;',
    '    for(var i=0;i<canal.length;i++){',
    '      this.buffer[this.escritura] = canal[i];',
    '      this.escritura++;',
    '      if(this.escritura >= this.tam){ this.escritura = 0; this.lleno = true; }',
    '    }',
    '    return true;',
    '  }',
    '}',
    'registerProcessor("' + PROCESADOR_NOMBRE + '", MusicHunterRingProcessor);',
  ].join('\n');

  /* Un AudioContext solo acepta addModule() una vez por nombre de
     procesador -- si el mismo contexto de audio se reutiliza (pasa en
     elixis-voice-session.js entre start()/stop()), no hay que volver a
     cargar el modulo. */
  var modulosCargados = new WeakMap();
  var sinksPorContexto = new WeakMap();

  async function asegurarModulo(ac){
    if(modulosCargados.get(ac)) return true;
    try{
      var blob = new Blob([PROCESADOR_SRC], { type: 'application/javascript' });
      var url = URL.createObjectURL(blob);
      await ac.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      modulosCargados.set(ac, true);
      return true;
    }catch(e){
      console.error('[MusicHunterRingBuffer] no se pudo cargar el worklet:', e);
      return false;
    }
  }

  /* Sumidero mudo (2026-08-30): mismo motivo que analizador() en
     elixis-voice-session.js -- un nodo que nunca llega a `destination`
     puede quedar de baja prioridad (o directamente sin procesar) en
     algunos navegadores. gain=0 para que nunca se oiga. */
  function obtenerSink(ac){
    var s = sinksPorContexto.get(ac);
    if(!s){
      s = ac.createGain();
      s.gain.value = 0;
      s.connect(ac.destination);
      sinksPorContexto.set(ac, s);
    }
    return s;
  }

  /* Conecta el ring buffer al MISMO MediaStream que ya usa la conversacion
     (no pide el microfono de nuevo). Un MediaStreamAudioSourceNode
     independiente por llamada -- Web Audio permite varias fuentes leyendo
     el mismo stream sin que se pisen. */
  async function conectar(audioContext, mediaStream){
    if(!audioContext || !mediaStream) return null;
    if(typeof audioContext.audioWorklet === 'undefined'){
      console.error('[MusicHunterRingBuffer] este navegador no soporta AudioWorklet');
      return null;
    }
    var ok = await asegurarModulo(audioContext);
    if(!ok) return null;
    try{
      var fuente = audioContext.createMediaStreamSource(mediaStream);
      var nodo = new AudioWorkletNode(audioContext, PROCESADOR_NOMBRE, {
        numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1,
        processorOptions: { segundos: SEGUNDOS_BUFFER_DEFAULT },
      });
      fuente.connect(nodo);
      nodo.connect(obtenerSink(audioContext));
      nodo._mhFuente = fuente; // para poder desconectarla en desconectar()
      return nodo;
    }catch(e){
      console.error('[MusicHunterRingBuffer] no se pudo conectar:', e);
      return null;
    }
  }

  /* Pide una copia del buffer actual. No pensado para llamadas concurrentes
     sobre el MISMO nodo (el ciclo de muestreo de "Cazador Musical" las hace
     una a la vez, cada 15-20s) -- una segunda llamada antes de que la
     primera responda reemplaza el handler de la primera. */
  function obtenerInstantanea(nodo){
    return new Promise(function(resolve){
      if(!nodo){ resolve(null); return; }
      var vencido = setTimeout(function(){ resolve(null); }, 1500);
      nodo.port.onmessage = function(ev){
        if(!ev.data || ev.data.cmd !== 'instantanea') return;
        clearTimeout(vencido);
        resolve({ pcm: ev.data.buffer, sampleRate: ev.data.sampleRate, segundos: ev.data.segundos });
      };
      nodo.port.postMessage({ cmd: 'instantanea' });
    });
  }

  function desconectar(nodo){
    if(!nodo) return;
    try{ if(nodo._mhFuente) nodo._mhFuente.disconnect(); }catch(e){}
    try{ nodo.disconnect(); }catch(e){}
    try{ nodo.port.onmessage = null; }catch(e){}
  }

  window.MusicHunterRingBuffer = {
    conectar: conectar,
    obtenerInstantanea: obtenerInstantanea,
    desconectar: desconectar,
  };
})();
