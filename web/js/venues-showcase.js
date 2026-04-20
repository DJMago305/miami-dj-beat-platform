/**
 * Galería de venues: tres vídeos que intercambian posición (izq / centro / der)
 * con pasos aleatorios (swap o rotación), no carrusel lineal.
 */
(function () {
  var stage = document.getElementById('mdjVenuesVideoStage');
  if (!stage) return;

  var SLOT_LEFT_PCT = [0, 36, 72];
  /** slotToVenue[s] = id de venue (0..2) colocado en el hueco físico s (0=izq, 1=centro, 2=der) */
  var slotToVenue = [0, 1, 2];
  var cards = Array.prototype.slice.call(stage.querySelectorAll('.mdj-venues-video-card'));
  var timer = null;

  function resolveFallback(url) {
    if (typeof window.resolveMdAssetPublicUrl === 'function') return window.resolveMdAssetPublicUrl(url);
    return url;
  }

  function applyReelSources() {
    stage.querySelectorAll('video[data-mdj-reel-fallback]').forEach(function (vid) {
      var reel = vid.getAttribute('data-mdj-reel');
      var fb = vid.getAttribute('data-mdj-reel-fallback');
      if (!fb) return;
      var useBucket =
        window.MDB_VENUES_REELS_URL && String(window.MDB_VENUES_REELS_URL).trim() && reel &&
        typeof window.resolveVenueReelUrl === 'function';
      var reelUrl = useBucket ? window.resolveVenueReelUrl('./venues-reels/' + reel) : '';
      var target = reelUrl && /^https?:\/\//i.test(reelUrl) ? reelUrl : resolveFallback(fb);
      vid.src = target;
      if (reelUrl && /^https?:\/\//i.test(reelUrl)) {
        vid.addEventListener(
          'error',
          function onErr() {
            vid.removeEventListener('error', onErr);
            if (vid.getAttribute('src') !== resolveFallback(fb)) vid.src = resolveFallback(fb);
          },
          { once: true }
        );
      }
    });
  }

  function prefersReduce() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isNarrow() {
    return window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
  }

  function venueToSlot(venueId) {
    for (var s = 0; s < 3; s++) {
      if (slotToVenue[s] === venueId) return s;
    }
    return 1;
  }

  function applyLayout() {
    if (isNarrow()) return;
    cards.forEach(function (card) {
      var v = parseInt(card.getAttribute('data-venue'), 10);
      var s = venueToSlot(v);
      card.style.left = SLOT_LEFT_PCT[s] + '%';
      card.setAttribute('data-slot', String(s));
      card.classList.toggle('is-center', s === 1);
    });
  }

  function randomMove() {
    if (isNarrow() || prefersReduce()) return;
    var r = Math.random();
    if (r < 0.42) {
      var a = Math.floor(Math.random() * 3);
      var b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
      var t = slotToVenue[a];
      slotToVenue[a] = slotToVenue[b];
      slotToVenue[b] = t;
    } else if (r < 0.71) {
      slotToVenue = [slotToVenue[1], slotToVenue[2], slotToVenue[0]];
    } else {
      slotToVenue = [slotToVenue[2], slotToVenue[0], slotToVenue[1]];
    }
    applyLayout();
  }

  function scheduleNext() {
    clearTimeout(timer);
    if (isNarrow() || prefersReduce()) return;
    timer = setTimeout(function () {
      randomMove();
      scheduleNext();
    }, 2800 + Math.random() * 4200);
  }

  function bootMotion() {
    if (isNarrow() || prefersReduce()) {
      cards.forEach(function (c) {
        c.style.left = '';
        c.classList.remove('is-center');
      });
      return;
    }
    applyLayout();
    scheduleNext();
  }

  function playVideos() {
    stage.querySelectorAll('video').forEach(function (v) {
      var p = v.play && v.play();
      if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay policy */ });
    });
  }

  applyReelSources();
  bootMotion();

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (ents) {
        ents.forEach(function (e) {
          if (e.isIntersecting) playVideos();
        });
      },
      { threshold: 0.1 }
    );
    io.observe(stage);
  } else {
    playVideos();
  }

  window.addEventListener(
    'resize',
    function () {
      clearTimeout(timer);
      if (isNarrow() || prefersReduce()) {
        cards.forEach(function (c) {
          c.style.left = '';
          c.classList.remove('is-center');
        });
        return;
      }
      applyLayout();
      scheduleNext();
    },
    { passive: true }
  );
})();
