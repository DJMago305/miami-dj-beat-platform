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

  /** FIX-AUDIO-01: defensa en profundidad — aunque este script se cargue directo (bypass del
   * gate en mdj-shared-header.js), ninguna llamada a new Audio()/AudioContext ocurre fuera
   * de la raíz ('/' o 'index.html'). */
  function mdjAmbientIsHomeRoute() {
    try {
      var path = (window.location.pathname || '').toLowerCase();
      return path === '/' || path === '' || path === '/index.html' || /\/index\.html$/.test(path);
    } catch (eRoute) {
      return false;
    }
  }
  if (!mdjAmbientIsHomeRoute()) return;

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
  var cashFlowAmbientBlocked = false;

  function isDjDashboardPage() {
    try {
      var file = (window.location.pathname || '').split('/').pop().toLowerCase();
      return file === 'dj-dashboard.html';
    } catch (e) {
      return false;
    }
  }

  /** Cash Flow: dj-dashboard con ?tab=flow o panel #tab-flow activo. */
  function isDjDashboardCashFlowActive() {
    if (!isDjDashboardPage()) return false;
    try {
      var tab = (new URLSearchParams(window.location.search || '').get('tab') || '').toLowerCase();
      if (tab === 'flow') return true;
      var panel = document.getElementById('tab-flow');
      return !!(panel && panel.classList.contains('active'));
    } catch (e2) {
      return false;
    }
  }

  function isAcademiaAmbientAllowed() {
    try {
      var file = (window.location.pathname || '').split('/').pop().toLowerCase();
      return file === 'academia.html' || file === 'courses.html' || file === 'dj-knowledge.html';
    } catch (eA) {
      return false;
    }
  }

  function isDjProfilePage() {
    try {
      return !!(document.body && document.body.classList.contains('dj-profile'));
    } catch (eP) {
      return false;
    }
  }

  /** Agenda / CONFIG / Cash Flow / perfil DJ en cabina: sin ambiente (Serato, etc.). Academia sí. */
  function mdjAmbientBlockedByArtistWork() {
    if (isAcademiaAmbientAllowed()) return false;
    if (cashFlowAmbientBlocked) return true;
    if (isDjDashboardPage()) return true;
    if (isDjProfilePage()) return true;
    return isDjDashboardCashFlowActive();
  }

  function mdjAmbientBlockedByCashFlow() {
    return mdjAmbientBlockedByArtistWork();
  }

  function mdjAmbientStopForCashFlow() {
    cashFlowAmbientBlocked = true;
    running = false;
    armBusy = false;
    detachFallback();
    try {
      audio.pause();
    } catch (eP) {
      void eP;
    }
  }

  function mdjAmbientClearCashFlowBlock() {
    cashFlowAmbientBlocked = false;
  }

  function mdjWatchDashboardCashFlowTab() {
    if (!isDjDashboardPage()) return;
    function syncCashFlowAmbient() {
      if (isDjDashboardCashFlowActive()) {
        mdjAmbientStopForCashFlow();
      } else {
        mdjAmbientClearCashFlowBlock();
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncCashFlowAmbient);
    } else {
      syncCashFlowAmbient();
    }
    try {
      var panel = document.getElementById('tab-flow');
      if (panel && typeof MutationObserver === 'function') {
        new MutationObserver(syncCashFlowAmbient).observe(panel, {
          attributes: true,
          attributeFilter: ['class']
        });
      }
    } catch (eObs) {
      void eObs;
    }
  }

  if (isDjDashboardPage()) {
    try {
      var _initTab = (new URLSearchParams(window.location.search || '').get('tab') || '').toLowerCase();
      if (_initTab === 'flow') cashFlowAmbientBlocked = true;
    } catch (eInit) {
      void eInit;
    }
    mdjWatchDashboardCashFlowTab();
  }

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
    if (mdjAmbientBlockedByCashFlow()) {
      detachFallback();
      return;
    }
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
    if (mdjAmbientBlockedByCashFlow()) return;
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
    if (mdjAmbientBlockedByCashFlow()) {
      try {
        audio.pause();
      } catch (eH) {
        void eH;
      }
      return;
    }
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

  /** FIX-AUDIO-01: desmontaje limpio — al salir de home (bfcache o navegación real) se pausa
   * y se libera la fuente de inmediato, para que nada quede sonando de fondo en el panel destino. */
  window.addEventListener(
    'pagehide',
    function () {
      running = false;
      armBusy = false;
      detachFallback();
      try {
        audio.pause();
      } catch (ePh) {
        void ePh;
      }
      try {
        audio.removeAttribute('src');
        audio.load();
      } catch (eRm) {
        void eRm;
      }
    },
    false
  );

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
    if (mdjAmbientBlockedByCashFlow()) return;
    if (autoplayScheduled) return;
    autoplayScheduled = true;
    var delays =
      typeof window !== 'undefined' && window.MDJ_AMBIENT_AUTOPLAY_DELAYS instanceof Array
        ? window.MDJ_AMBIENT_AUTOPLAY_DELAYS
        : [0, 80, 250, 700, 1800, 4200];
    delays.forEach(function (ms) {
      setTimeout(function () {
        if (mdjAmbientBlockedByCashFlow()) return;
        if (running) return;
        if (armBusy) return;
        startAmbientAttempt();
      }, ms);
    });
    setTimeout(function () {
      if (mdjAmbientBlockedByCashFlow()) return;
      if (!running) attachFallbackOnce();
    }, 2200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleAutoplay);
  } else {
    scheduleAutoplay();
  }

  if (typeof window !== 'undefined') {
    window.MDJ_AMBIENT_PAUSE_FOR_CASH_FLOW = mdjAmbientStopForCashFlow;
  }
})();
