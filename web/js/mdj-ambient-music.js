/**
 * Miami DJ Beat — una sola pista de música ambiental por página (no se duplica al hacer scroll).
 *
 * - Home (page-home): en cada carga del inicio suena la apertura oficial; al terminar → instrumental en loop
 *   en esa misma visita. Si sales del home y vuelves (nueva carga), otra vez la apertura y luego el loop.
 * - Otras páginas: solo el instrumental en loop.
 *
 * Los vídeos del sitio van aparte (mdj-videos-force-mute.js): siempre mudos para no mezclar con esto.
 *
 * Autoplay + reintentos; si el navegador bloquea, fallback a primer clic/pointer en la ventana.
 * Desactivar: MDJ_SKIP_AMBIENT_MUSIC o data-mdj-no-ambient en html.
 */
(function () {
  'use strict';

  if (window.__MDJ_AMBIENT_BOOTED) return;
  window.__MDJ_AMBIENT_BOOTED = true;

  if (typeof window !== 'undefined' && window.MDJ_SKIP_AMBIENT_MUSIC) return;
  try {
    if (document.documentElement && document.documentElement.getAttribute('data-mdj-no-ambient') === '1') return;
  } catch (e) {
    void e;
  }

  var BASE = './assets/Musica_Miamidjbeat/';
  var OPENING =
    (typeof window !== 'undefined' && window.MDJ_AMBIENT_OPENING_FILE) || 'Ashé_Ashé_Opening_Home_DJMago305.mp3';
  var JUNGLE =
    (typeof window !== 'undefined' && window.MDJ_AMBIENT_JUNGLE_FILE) || 'JungleIn_My_Head_DJMago305.mp3';

  var VOL_OPENING =
    typeof window !== 'undefined' && typeof window.MDJ_AMBIENT_VOL_OPENING === 'number'
      ? window.MDJ_AMBIENT_VOL_OPENING
      : 0.2;
  var VOL_JUNGLE =
    typeof window !== 'undefined' && typeof window.MDJ_AMBIENT_VOL_JUNGLE === 'number'
      ? window.MDJ_AMBIENT_VOL_JUNGLE
      : 0.14;

  /** Solo memoria de esta carga: en home, tras la apertura → jungle en la misma página. Nueva visita al home = otra apertura. */
  var homeIntroConsumedThisVisit = false;

  var audio = new Audio();
  audio.preload = 'auto';

  var running = false;
  var armBusy = false;
  var fallbackAttached = false;
  var autoplayScheduled = false;

  function isHome() {
    try {
      return document.body && document.body.classList && document.body.classList.contains('page-home');
    } catch (e) {
      return false;
    }
  }

  function wantOpening() {
    return isHome() && !homeIntroConsumedThisVisit;
  }

  function detachFallback() {
    if (!fallbackAttached) return;
    fallbackAttached = false;
    window.removeEventListener('click', onFallbackGesture, true);
    window.removeEventListener('pointerdown', onFallbackGesture, true);
  }

  function onFallbackGesture() {
    if (running) {
      detachFallback();
      return;
    }
    if (armBusy) return;
    armBusy = true;
    applyTrack();
    playAfterBuffered(true);
  }

  function attachFallbackOnce() {
    if (fallbackAttached || running) return;
    fallbackAttached = true;
    window.addEventListener('click', onFallbackGesture, { capture: true, passive: true });
    window.addEventListener('pointerdown', onFallbackGesture, { capture: true, passive: true });
  }

  function applyTrack() {
    if (wantOpening()) {
      audio.loop = false;
      audio.volume = VOL_OPENING;
      audio.src = BASE + OPENING;
    } else {
      audio.loop = true;
      audio.volume = VOL_JUNGLE;
      audio.src = BASE + JUNGLE;
    }
    try {
      audio.load();
    } catch (eLd) {
      void eLd;
    }
  }

  function playAfterBuffered(resolveRunning) {
    function finishOk() {
      if (resolveRunning) {
        running = true;
        armBusy = false;
        detachFallback();
      }
    }
    function tryPlay() {
      var p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(finishOk).catch(function () {
          if (resolveRunning) armBusy = false;
        });
      } else {
        finishOk();
      }
    }
    if (audio.readyState >= 2) {
      tryPlay();
      return;
    }
    var fired = false;
    var fallbackT = setTimeout(function () {
      if (fired) return;
      fired = true;
      audio.removeEventListener('canplay', onReady);
      audio.removeEventListener('loadeddata', onReady);
      tryPlay();
    }, 12000);
    function onReady() {
      if (fired) return;
      fired = true;
      clearTimeout(fallbackT);
      audio.removeEventListener('canplay', onReady);
      audio.removeEventListener('loadeddata', onReady);
      tryPlay();
    }
    audio.addEventListener('canplay', onReady);
    audio.addEventListener('loadeddata', onReady);
  }

  function startAmbientAttempt() {
    if (running) return;
    if (armBusy) return;
    armBusy = true;
    applyTrack();
    playAfterBuffered(true);
  }

  function onEnded() {
    if (audio.loop) return;
    if (isHome()) {
      homeIntroConsumedThisVisit = true;
    }
    audio.loop = true;
    audio.volume = VOL_JUNGLE;
    audio.src = BASE + JUNGLE;
    try {
      audio.load();
    } catch (eLd) {
      void eLd;
    }
    playAfterBuffered(false);
  }

  audio.addEventListener('ended', onEnded);
  audio.addEventListener(
    'error',
    function () {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[mdj-ambient-music] No se pudo cargar el audio (¿MP3 en assets/Musica_Miamidjbeat/?).');
      }
    },
    { once: true }
  );

  document.addEventListener('visibilitychange', function () {
    if (!running) return;
    try {
      if (document.hidden) {
        audio.pause();
      } else {
        audio.play().catch(function () {});
      }
    } catch (e) {
      void e;
    }
  });

  window.addEventListener(
    'pageshow',
    function (ev) {
      if (!ev.persisted || !isHome()) return;
      homeIntroConsumedThisVisit = false;
      running = false;
      armBusy = false;
      try {
        audio.pause();
      } catch (e1) {
        void e1;
      }
      try {
        audio.removeAttribute('src');
      } catch (e2) {
        void e2;
      }
      autoplayScheduled = false;
      scheduleAutoplay();
    },
    false
  );

  function scheduleAutoplay() {
    if (autoplayScheduled) return;
    autoplayScheduled = true;
    var delays =
      typeof window !== 'undefined' && window.MDJ_AMBIENT_AUTOPLAY_DELAYS instanceof Array
        ? window.MDJ_AMBIENT_AUTOPLAY_DELAYS
        : [0, 80, 250, 700, 1800, 4200];
    delays.forEach(function (ms) {
      setTimeout(function () {
        if (running) return;
        if (armBusy) return;
        startAmbientAttempt();
      }, ms);
    });
    setTimeout(function () {
      if (!running) attachFallbackOnce();
    }, 2200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleAutoplay);
  } else {
    scheduleAutoplay();
  }
})();
