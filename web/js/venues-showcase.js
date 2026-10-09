/**
 * Cinta de reels de venues (#experience, events.html): 3 tarjetas 9:16 visibles a todo el ancho (2 en tablet, 1 en teléfono).
 * Diseño tomado de bailaconmicho.com (PO 2026-10-09): la cinta se desliza 1 s (ease-in-out) y entran los videos siguientes.
 * - Para añadir un venue: otro <div class="mdj-venues-slide"> en events.html (mismo molde) + el .mp4 en reels/ + las claves en translations.js.
 *   Con 3 slides la cinta queda fija y sin flechas; con 4 o más se activan el avance automático y las flechas.
 * - Solo se cargan los videos visibles y el siguiente (y el siguiente solo con conexión rápida); los que salen de pantalla se pausan.
 * - Sin `gap`/`aspect-ratio`/`inset` en el CSS asociado y sin sintaxis nueva aquí (respaldo Safari 13).
 * Esta página es la única que tiene #mdjVenuesVideoStage; las demás cargan el script y salen sin hacer nada.
 */
(function () {
  var stage = document.getElementById('mdjVenuesVideoStage');
  if (!stage) return;

  var track = stage.querySelector('.mdj-venues-track');
  var slides = Array.prototype.slice.call(stage.querySelectorAll('.mdj-venues-slide'));
  var navPrev = document.getElementById('mdjVenuesNavPrev');
  var navNext = document.getElementById('mdjVenuesNavNext');
  if (!track || !slides.length) return;

  var AUTO_MS = 6000;          // pausa entre desplazamientos automáticos
  var PAUSE_AFTER_USER_MS = 15000;
  var index = 0;
  var visible = 3;
  var timer = null;
  var inView = false;
  var userUntil = 0;

  /** Si el .mp4 en Storage tiene otro casing/nombre, probar aquí antes del fallback. */
  var REEL_FILENAME_ALIASES = {};

  /**
   * URL absoluta del bucket `assets` en producción (los .mp4 locales no viajan a Vercel).
   * En localhost devuelve la ruta relativa salvo MDJ_VENUE_REELS_FORCE_STORAGE.
   */
  function absoluteReelUrl(localPath) {
    if (!localPath || typeof localPath !== 'string') return localPath;
    try {
      if (typeof location !== 'undefined' && location.hostname) {
        var h = String(location.hostname).toLowerCase();
        if (h === 'localhost' || h === '127.0.0.1') {
          if (window.MDJ_VENUE_REELS_FORCE_STORAGE !== true) return localPath;
        }
      }
    } catch (e) {
      void e;
    }
    if (
      typeof window.resolveMdAssetPublicUrl === 'function' &&
      window.MDB_ASSETS_URL &&
      String(window.MDB_ASSETS_URL).trim()
    ) {
      return window.resolveMdAssetPublicUrl(localPath);
    }
    return localPath;
  }

  function hydrateVideo(vid) {
    if (!vid || vid.getAttribute('data-hydrated') === '1') return;
    var reel = vid.getAttribute('data-mdj-reel');
    var fb = vid.getAttribute('data-mdj-reel-fallback');
    if (!reel) return;
    vid.setAttribute('data-hydrated', '1');
    var names = [reel].concat(REEL_FILENAME_ALIASES[reel] || []);
    var attempt = 0;
    var fallbackAbs = fb ? absoluteReelUrl(fb) : '';
    function tryNext() {
      if (attempt < names.length) {
        var localReelPath = './assets/eventos-venues-patrocinadores/reels/' + names[attempt];
        attempt += 1;
        vid.onerror = function () {
          tryNext();
        };
        vid.src = String(absoluteReelUrl(localReelPath));
        return;
      }
      vid.onerror = null;
      if (fallbackAbs && vid.getAttribute('src') !== String(fallbackAbs)) vid.src = String(fallbackAbs);
    }
    vid.preload = 'auto';
    tryNext();
  }

  function fastConnection() {
    var c = navigator.connection;
    if (!c) return true;
    if (c.saveData) return false;
    if (c.effectiveType && c.effectiveType !== '4g') return false;
    return !(typeof c.downlink === 'number' && c.downlink > 0 && c.downlink < 5);
  }

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function visibleCount() {
    if (!window.matchMedia) return 3;
    if (window.matchMedia('(max-width: 639px)').matches) return 1;
    if (window.matchMedia('(max-width: 1023px)').matches) return 2;
    return 3;
  }

  function maxIndex() {
    return Math.max(0, slides.length - visible);
  }

  function quiet(p) {
    if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay policy: se reintenta al volver a la vista */ });
  }

  /** Carga y reproduce los visibles (+ el siguiente si hay buena conexión); pausa el resto. */
  function syncVideos() {
    var next = index + visible;
    slides.forEach(function (slide, i) {
      var vid = slide.querySelector('video');
      var on = i >= index && i < index + visible;
      slide.classList.toggle('is-visible', on);
      if (!vid) return;
      if (on) {
        hydrateVideo(vid);
        if (inView) quiet(vid.play());
      } else {
        if (i === next && fastConnection()) hydrateVideo(vid);
        try { vid.pause(); } catch (e) { void e; }
      }
    });
  }

  function render() {
    stage.style.setProperty('--mdj-venues-visible', String(visible));
    track.style.transform = 'translateX(' + (-index * 100 / visible) + '%)';
    track.style.webkitTransform = track.style.transform;
    var more = maxIndex() > 0;
    if (navPrev) navPrev.hidden = !more;
    if (navNext) navNext.hidden = !more;
    syncVideos();
  }

  function goTo(i) {
    var m = maxIndex();
    index = i > m ? 0 : (i < 0 ? m : i);   // al llegar al final vuelve al principio, y al revés
    render();
  }

  function schedule() {
    clearTimeout(timer);
    if (maxIndex() === 0 || reduced() || !inView || document.hidden) return;
    timer = window.setTimeout(function () {
      if (Date.now() < userUntil) { schedule(); return; }
      goTo(index + 1);
      schedule();
    }, AUTO_MS);
  }

  function userMoved(delta) {
    userUntil = Date.now() + PAUSE_AFTER_USER_MS;
    goTo(index + delta);
    schedule();
  }

  if (navPrev) navPrev.addEventListener('click', function (e) { e.preventDefault(); userMoved(-1); });
  if (navNext) navNext.addEventListener('click', function (e) { e.preventDefault(); userMoved(1); });

  // Deslizar con el dedo (teléfono / tablet)
  var touchX = null;
  stage.addEventListener('touchstart', function (e) {
    touchX = e.touches && e.touches.length === 1 ? e.touches[0].clientX : null;
  }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (touchX === null || !e.changedTouches || !e.changedTouches.length) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 40) userMoved(dx < 0 ? 1 : -1);
  }, { passive: true });

  window.addEventListener('resize', function () {
    var v = visibleCount();
    if (v === visible) return;
    visible = v;
    if (index > maxIndex()) index = maxIndex();
    render();
    schedule();
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { clearTimeout(timer); return; }
    syncVideos();
    schedule();
  });

  visible = visibleCount();
  render();

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        inView = e.isIntersecting;
        syncVideos();
        schedule();
      });
    }, { threshold: 0.1 });
    io.observe(stage);
  } else {
    inView = true;
    syncVideos();
    schedule();
  }
})();
