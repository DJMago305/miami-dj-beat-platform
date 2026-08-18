/**
 * Miami DJ Beat — Elixis Voice Engine (Web Speech API / SpeechSynthesis)
 *
 * Voz nativa del navegador para respuestas rápidas de Elixis en cabina — sin costo de
 * API, sin red. Distinto de `booth-elevenlabs.js` (voz premium vía Edge Function,
 * usada para audio ya generado); este motor es para interjecciones inmediatas.
 *
 * Usage:
 *   elixisSpeak('Bienvenido a la central de operaciones.');
 *   elixisSpeak('Evento confirmado.', function (err) { if (err) console.warn(err); });
 *
 * Eventos (window): 'elixis:speak:start' / 'elixis:speak:end' — detail: { text }.
 * MRM puede escucharlos para modular los anillos del holograma.
 */
(function () {
  'use strict';

  var SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

  var PITCH = 1.2;
  var RATE = 1.1;

  /* Orden de preferencia del ticket: es-US primero, en-US como respaldo.
     "Femenino claro" es heurístico -- la Web Speech API no expone género
     estructurado, solo el nombre de la voz (varía por SO/navegador). */
  var FEMALE_NAME_HINTS = [
    'female', 'mujer', 'femenina', 'samantha', 'victoria', 'karen', 'moira',
    'tessa', 'susan', 'zira', 'paulina', 'monica', 'mónica', 'helena', 'sabina'
  ];

  var _voicesCache = null;
  var _voicesRequested = false;
  var _voicesWaiters = [];

  function _scoreVoice(voice) {
    var lang = (voice.lang || '').toLowerCase();
    var name = (voice.name || '').toLowerCase();
    var score = 0;
    if (lang === 'es-us') score += 100;
    else if (lang.indexOf('es') === 0) score += 60;
    else if (lang === 'en-us') score += 50;
    else if (lang.indexOf('en') === 0) score += 20;
    for (var i = 0; i < FEMALE_NAME_HINTS.length; i++) {
      if (name.indexOf(FEMALE_NAME_HINTS[i]) !== -1) {
        score += 10;
        break;
      }
    }
    return score;
  }

  function _pickVoice(voices) {
    if (!voices || !voices.length) return null;
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < voices.length; i++) {
      var s = _scoreVoice(voices[i]);
      if (s > bestScore) {
        bestScore = s;
        best = voices[i];
      }
    }
    return best;
  }

  /* Chrome carga las voces de forma asíncrona (getVoices() devuelve [] al
     inicio, hasta el evento 'voiceschanged'); Safari suele tenerlas ya
     disponibles. Se cubren ambos casos sin bloquear: si 'voiceschanged'
     nunca llega, un timeout corto libera a quien esté esperando de todos
     modos -- elixisSpeak() funciona igual, solo sin voz preferida asignada
     (el motor usa la voz por defecto del navegador). */
  function _getVoicesAsync(cb) {
    if (!SUPPORTED) {
      cb([]);
      return;
    }
    var immediate = window.speechSynthesis.getVoices();
    if (immediate && immediate.length) {
      cb(immediate);
      return;
    }
    _voicesWaiters.push(cb);
    if (_voicesRequested) return;
    _voicesRequested = true;
    var resolved = false;
    function resolveAll() {
      if (resolved) return;
      resolved = true;
      var voices = window.speechSynthesis.getVoices() || [];
      var waiters = _voicesWaiters;
      _voicesWaiters = [];
      waiters.forEach(function (fn) {
        try {
          fn(voices);
        } catch (e) {
          /* ignore listener errors */
        }
      });
    }
    try {
      window.speechSynthesis.addEventListener('voiceschanged', resolveAll, { once: true });
    } catch (eListen) {
      void eListen;
    }
    setTimeout(resolveAll, 1200);
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (eDispatch) {
      void eDispatch;
    }
  }

  /**
   * elixisSpeak(text, callback)
   * callback(error) -- error es null/undefined si terminó de hablar sin problema.
   */
  function elixisSpeak(text, callback) {
    var done = function (err) {
      if (typeof callback === 'function') callback(err);
    };

    if (!SUPPORTED) {
      done(new Error('speechSynthesis no disponible en este navegador'));
      return;
    }
    if (!text || typeof text !== 'string') {
      done(new Error('elixisSpeak: falta texto'));
      return;
    }

    /* Cancela cualquier habla en curso ANTES de emitir la nueva -- evita
       encolamiento/overlap si Elixis recibe varios mensajes seguidos.
       Se hace ya, síncrono: si se difiere, dos llamadas seguidas (mismo
       tick) cancelan antes de que la anterior siquiera hable, y deja de
       cancelar nada de verdad. */
    try {
      window.speechSynthesis.cancel();
    } catch (eCancel) {
      void eCancel;
    }

    _getVoicesAsync(function (voices) {
      _voicesCache = voices;
      var utter = new window.SpeechSynthesisUtterance(text);
      utter.pitch = PITCH;
      utter.rate = RATE;

      var voice = _pickVoice(voices);
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      } else {
        utter.lang = 'es-US';
      }

      var started = false;
      function markStarted() {
        if (started) return;
        started = true;
        _dispatch('elixis:speak:start', { text: text });
      }
      utter.onstart = markStarted;
      utter.onend = function () {
        _dispatch('elixis:speak:end', { text: text });
        done(null);
      };
      utter.onerror = function (ev) {
        _dispatch('elixis:speak:end', { text: text, error: true });
        done((ev && ev.error) || new Error('speechSynthesis error'));
      };

      try {
        window.speechSynthesis.speak(utter);
      } catch (eSpeak) {
        done(eSpeak);
        return;
      }

      /* Chrome (confirmado en pruebas): si speak() sigue de cerca a un
         cancel() de OTRA elocución, el audio nuevo SÍ suena (speechSynthesis
         .speaking pasa a true) pero 'onstart' nunca dispara para ella. Este
         respaldo detecta ese caso sin depender del evento roto. La
         salvaguarda de más abajo cubre el fallo real (Safari/iOS sin gesto
         de usuario previo -- ahí 'speaking' tampoco llega a ponerse true). */
      setTimeout(function () {
        if (!started && window.speechSynthesis.speaking) markStarted();
      }, 150);

      setTimeout(function () {
        if (!started) done(new Error('speechSynthesis no inició (¿falta gesto de usuario?)'));
      }, 3000);
    });
  }

  function elixisStopSpeaking() {
    if (!SUPPORTED) return;
    try {
      window.speechSynthesis.cancel();
    } catch (eStop) {
      void eStop;
    }
  }

  window.elixisSpeak = elixisSpeak;
  window.elixisStopSpeaking = elixisStopSpeaking;
  window.ElixisVoiceEngine = {
    speak: elixisSpeak,
    stop: elixisStopSpeaking,
    isSupported: function () {
      return SUPPORTED;
    }
  };
})();
