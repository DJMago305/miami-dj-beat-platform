/**
 * Cinta de reels de venues/testimonios (#experience, events.html): 3 tarjetas 9:16 visibles a todo el ancho (2 en tablet, 1 en teléfono).
 * Diseño tomado de bailaconmicho.com (PO 2026-10-09): la cinta se desliza 1 s (ease-in-out) y entran los videos siguientes.
 *
 * LISTA DE VIDEOS = reels-manifest.json (carpeta reels/ del Storage `assets`; copia base en el repo). Cada testimonio nuevo es UNA entrada
 * {file, title:{es,en}, subtitle:{es,en}, active?}; el orden del archivo es el orden de la cinta. Sin tocar la página ni hacer PR.
 * Orden de lectura: lista del Storage → copia del repo → las tarjetas escritas a mano en events.html (respaldo si todo falla).
 * Para preparar un video crudo y generar su entrada: node web/scripts/preparar-reel.mjs (ver LEEME.txt de la carpeta).
 *
 * - Con 3 o menos videos la cinta queda fija y sin flechas; con 4 o más se activan las flechas y el avance automático.
 * - Solo se cargan los videos visibles y el siguiente (y el siguiente solo con conexión rápida); los que salen de pantalla se pausan, así que
 *   la lista puede crecer sin que la página pese más.
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

  var REEL_DIR = './assets/eventos-venues-patrocinadores/reels/';
  var MANIFEST_PATH = REEL_DIR + 'reels-manifest.json';
  var FILE_OK = /^[A-Za-z0-9][A-Za-z0-9._-]*\.mp4$/;   // solo nombres simples: nada de rutas ni caracteres raros
  var manifestEntries = null;                          // null = se usan las tarjetas escritas en events.html

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

  function currentLang() {
    var l = (window.i18n && window.i18n.currentLang) || document.documentElement.lang || 'en';
    return String(l).slice(0, 2) === 'es' ? 'es' : 'en';
  }

  function pickText(o) {
    if (!o) return '';
    if (typeof o === 'string') return o;
    return o[currentLang()] || o.es || o.en || '';
  }

  function cleanEntries(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (e) {
      if (!e || e.active === false || typeof e.file !== 'string' || !FILE_OK.test(e.file)) return;
      out.push({ file: e.file, title: e.title, subtitle: e.subtitle });
    });
    return out;
  }

  /** Pone título y subtítulo (en el idioma activo) a las tarjetas que salen de la lista. */
  function applyTexts() {
    if (!manifestEntries) return;
    slides.forEach(function (slide, i) {
      var e = manifestEntries[i];
      if (!e) return;
      var t = slide.querySelector('.mdj-venues-video-venue');
      var st = slide.querySelector('.mdj-venues-video-type');
      if (t) t.textContent = pickText(e.title);
      if (st) st.textContent = pickText(e.subtitle);
    });
  }

  function makeSlide(e, i, entries) {
    var other = entries[(i + 1) % entries.length];
    var slide = document.createElement('div');
    slide.className = 'mdj-venues-slide';
    var card = document.createElement('div');
    card.className = 'mdj-venues-video-card mdj-venues-reel';
    card.setAttribute('data-venue', String(i));
    var frame = document.createElement('div');
    frame.className = 'mdj-venues-video-frame';
    var vid = document.createElement('video');
    vid.setAttribute('data-mdj-reel', e.file);
    if (other && other.file !== e.file) vid.setAttribute('data-mdj-reel-fallback', REEL_DIR + other.file);
    vid.muted = true;
    vid.defaultMuted = true;
    vid.loop = true;
    vid.preload = 'none';
    vid.setAttribute('muted', '');
    vid.setAttribute('playsinline', '');
    var meta = document.createElement('div');
    meta.className = 'mdj-venues-video-meta';
    var t = document.createElement('div');
    t.className = 'mdj-venues-video-venue';
    var st = document.createElement('div');
    st.className = 'mdj-venues-video-type';
    meta.appendChild(t);
    meta.appendChild(st);
    frame.appendChild(vid);
    frame.appendChild(meta);
    card.appendChild(frame);
    slide.appendChild(card);
    return slide;
  }

  /** Apaga el video de una tarjeta que ya no se usa. Sin esto, el error que dispara al vaciarle el src haría que se recargara solo. */
  function retire(slide) {
    var v = slide.querySelector('video');
    if (!v) return;
    v.onerror = null;
    try { v.pause(); } catch (e) { void e; }
    v.removeAttribute('src');
    try { v.load(); } catch (e2) { void e2; }
  }

  /**
   * Pone en la cinta las tarjetas de la lista. Las que ya existen (mismo archivo) se REUTILIZAN con su video ya cargado o reproduciéndose;
   * solo se crean las nuevas y solo se apagan las que sobran. Así agregar un testimonio no recarga ni deja en negro a los demás.
   */
  function useManifest(entries) {
    manifestEntries = entries;
    var pool = {};
    slides.forEach(function (slide) {
      var v = slide.querySelector('video');
      var f = v && v.getAttribute('data-mdj-reel');
      if (!f) return;
      (pool[f] = pool[f] || []).push(slide);
    });
    var next = entries.map(function (e, i) {
      var reuse = pool[e.file] && pool[e.file].shift();
      return reuse || makeSlide(e, i, entries);
    });
    var same = next.length === slides.length && next.every(function (s2, i) { return s2 === slides[i]; });
    if (!same) {
      Object.keys(pool).forEach(function (f) { pool[f].forEach(retire); });
      while (track.firstChild) track.removeChild(track.firstChild);
      next.forEach(function (slide, i) {
        slide.querySelector('.mdj-venues-video-card').setAttribute('data-venue', String(i));
        track.appendChild(slide);
      });
      slides = next;
      if (index > maxIndex()) index = maxIndex();
    }
    applyTexts();
    render();
    schedule();
  }

  function fetchManifest(urls, done) {
    var i = 0;
    (function next() {
      if (i >= urls.length) { done(null); return; }
      var url = urls[i++];
      var failed = function () { next(); };
      try {
        fetch(url, { cache: 'no-cache' })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (j) {
            var list = cleanEntries(j && j.reels);
            if (list.length) done(list); else failed();
          })
          .catch(function (err) {
            if (window.console && console.warn) console.warn('[venues-showcase] lista de reels no válida en ' + url + ':', err && err.message);
            failed();
          });
      } catch (e) {
        failed();
      }
    })();
  }

  function loadManifest() {
    if (typeof fetch !== 'function') return;
    var urls = [String(absoluteReelUrl(MANIFEST_PATH)), MANIFEST_PATH];
    if (urls[0] === urls[1]) urls.pop();
    fetchManifest(urls, function (list) { if (list) useManifest(list); });
  }

  document.addEventListener('languageChanged', applyTexts);

  visible = visibleCount();
  render();
  loadManifest();

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
