/**
 * Galería de venues (#experience): reels 9:16 en fila.
 * - Barajado: permuta qué tarjeta va en cada hueco (efecto tipo casino).
 * - Barrido: pasa al siguiente lote de venues (BATCHES[b], BATCHES[b+1]…); mismo layout, nuevos reels/textos.
 *
 * Cap fijo: el DOM tiene exactamente 4 .mdj-venues-video-card (no añadir más columnas). No es “un hero por venue nuevo”:
 * los nuevos venues entran por rotación automática dentro de estos huecos (más entradas en BATCHES, más .mp4 en reels/, i18n).
 * Añadir lotes: empuja otro subarray con 4 objetos (mismo orden de slots que index.html inicial).
 * Cada fila debe usar solo venueI18n/typeI18n/quoteI18n del partner cuyo .mp4 es `reel` (nunca placeholders genéricos).
 */
(function () {
  var stage = document.getElementById('mdjVenuesVideoStage');
  if (!stage) return;

  var cards = Array.prototype.slice.call(stage.querySelectorAll('.mdj-venues-video-card'));
  var NUM_SLOTS = cards.length;
  /* Mismo valor que --mdj-venues-gap-pct en styles.css (carril tipo referencia: menos hueco entre columnas). */
  var GAP_PCT = 8;

  /**
   * Lotes: siempre 4 entradas (= tarjetas DOM). Lote 0 refleja el estado inicial de index.html.
   * Sin poster en <video>: se ve el vídeo directo (primer frame / negro breve mientras carga).
   */
  var BATCHES = [
    [
      {
        reel: 'Mojitos_calle_8.mp4',
        fallback: './assets/eventos-venues-patrocinadores/reels/El_Valle_Restaurante.mp4',
        venueI18n: 'exp-venue-title-mojitos',
        typeI18n: 'exp-type-latin',
        quoteI18n: 'exp-quote-mojitos'
      },
      {
        reel: 'El_Valle_Restaurante.mp4',
        fallback: './assets/eventos-venues-patrocinadores/reels/Mojitos_calle_8.mp4',
        venueI18n: 'exp-venue-title-valle',
        typeI18n: 'exp-type-dining',
        quoteI18n: 'exp-quote-valle'
      },
      {
        reel: 'Sundowners_Key_Largo.mp4',
        fallback: './assets/eventos-venues-patrocinadores/reels/El_Valle_Restaurante.mp4',
        venueI18n: 'exp-venue-title-sundowners',
        typeI18n: 'exp-type-waterfront',
        quoteI18n: 'exp-quote-sundowners'
      },
      {
        reel: 'Baila_Con_Micho.mp4',
        fallback: './assets/eventos-venues-patrocinadores/reels/Mojitos_calle_8.mp4',
        venueI18n: 'exp-venue-title-baila',
        typeI18n: 'exp-type-baila',
        quoteI18n: 'exp-quote-baila'
      }
    ],
    [
      /* Mismo criterio que el lote 0: cada reel solo con textos i18n del partner real (nada genérico / placeholder). */
      {
        reel: 'Sundowners_Key_Largo.mp4',
        fallback: './assets/eventos-venues-patrocinadores/reels/Mojitos_calle_8.mp4',
        venueI18n: 'exp-venue-title-sundowners',
        typeI18n: 'exp-type-waterfront',
        quoteI18n: 'exp-quote-sundowners'
      },
      {
        reel: 'Mojitos_calle_8.mp4',
        fallback: './assets/eventos-venues-patrocinadores/reels/El_Valle_Restaurante.mp4',
        venueI18n: 'exp-venue-title-mojitos',
        typeI18n: 'exp-type-latin',
        quoteI18n: 'exp-quote-mojitos'
      },
      {
        reel: 'El_Valle_Restaurante.mp4',
        fallback: './assets/eventos-venues-patrocinadores/reels/Mojitos_calle_8.mp4',
        venueI18n: 'exp-venue-title-valle',
        typeI18n: 'exp-type-dining',
        quoteI18n: 'exp-quote-valle'
      },
      {
        reel: 'Ebenezer_Family_Farm.mp4',
        fallback: './assets/eventos-venues-patrocinadores/reels/Sundowners_Key_Largo.mp4',
        venueI18n: 'exp-venue-title-ebenezer',
        typeI18n: 'exp-type-ebenezer',
        quoteI18n: 'exp-quote-ebenezer'
      }
    ]
  ];

  var batchIndex = 0;
  var shuffleTick = 0;
  var SWEEP_EVERY = 7;

  function buildSlotLeftPct(numSlots, gapPct) {
    var w = (100 - (numSlots - 1) * gapPct) / numSlots;
    var out = [];
    for (var s = 0; s < numSlots; s++) {
      out.push(Math.round(s * (w + gapPct) * 1000) / 1000);
    }
    return out;
  }

  var SLOT_LEFT_PCT = buildSlotLeftPct(NUM_SLOTS, GAP_PCT);

  var slotToVenue = [];
  for (var j = 0; j < NUM_SLOTS; j++) {
    slotToVenue[j] = j;
  }
  cards.forEach(function (card) {
    var s = parseInt(card.getAttribute('data-slot'), 10);
    var v = parseInt(card.getAttribute('data-venue'), 10);
    if (!isNaN(s) && s >= 0 && s < NUM_SLOTS && !isNaN(v)) {
      slotToVenue[s] = v;
    }
  });

  stage.style.setProperty('--mdj-venues-slots', String(NUM_SLOTS));

  var timer = null;

  /** Si el .mp4 en Storage tiene otro casing/nombre, probar aquí antes del fallback genérico. */
  var REEL_FILENAME_ALIASES = {
    'Baila_Con_Micho.mp4': ['bailaconmicho.mp4', 'Baila_con_Micho.mp4', 'baila_con_micho.mp4']
  };

  /**
   * URL absoluta del bucket `assets` en producción (Vercel no incluye .mp4 locales si usas .vercelignore).
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
    if (!vid) return;
    var reel = vid.getAttribute('data-mdj-reel');
    var fb = vid.getAttribute('data-mdj-reel-fallback');
    if (!fb || !reel) return;
    var names = [reel].concat(REEL_FILENAME_ALIASES[reel] || []);
    var attempt = 0;
    var fallbackAbs = absoluteReelUrl(fb);
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
      if (vid.getAttribute('src') !== String(fallbackAbs)) vid.src = String(fallbackAbs);
    }
    tryNext();
  }

  function applyReelSources() {
    stage.querySelectorAll('video[data-mdj-reel-fallback]').forEach(hydrateVideo);
  }

  function applyBatch(index) {
    var batch = BATCHES[index];
    if (!batch || batch.length !== NUM_SLOTS) return;
    cards.forEach(function (card, i) {
      var row = batch[i];
      if (!row) return;
      var vid = card.querySelector('video');
      if (vid) {
        if (row.poster) {
          vid.setAttribute('poster', row.poster);
        } else {
          vid.removeAttribute('poster');
        }
        vid.setAttribute('data-mdj-reel', row.reel);
        vid.setAttribute('data-mdj-reel-fallback', row.fallback);
        hydrateVideo(vid);
      }
      var metaVenue = card.querySelector('.mdj-venues-video-venue');
      var metaType = card.querySelector('.mdj-venues-video-type');
      var metaQuote = card.querySelector('.mdj-venues-video-quote');
      if (metaVenue) metaVenue.setAttribute('data-i18n', row.venueI18n);
      if (metaType) metaType.setAttribute('data-i18n', row.typeI18n);
      if (metaQuote) metaQuote.setAttribute('data-i18n', row.quoteI18n);
    });
    if (window.i18n && typeof window.i18n.updateUI === 'function') {
      window.i18n.updateUI();
    }
  }

  function prefersReduce() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isNarrow() {
    return window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
  }

  function venueToSlot(venueId) {
    for (var s = 0; s < NUM_SLOTS; s++) {
      if (slotToVenue[s] === venueId) return s;
    }
    return Math.min(1, NUM_SLOTS - 1);
  }

  /** Las tarjetas son position:absolute → el stage no crece solo; reservamos altura para no montar #residencies / marketplace encima. */
  var STAGE_TOP_PAD = 10;
  var STAGE_BOTTOM_PAD = 20;

  function syncStageHeight() {
    if (!stage) return;
    if (isNarrow()) {
      stage.style.minHeight = '';
      return;
    }
    var maxH = 0;
    cards.forEach(function (card) {
      var h = card.getBoundingClientRect().height;
      if (h > maxH) maxH = h;
    });
    if (maxH > 0) {
      stage.style.minHeight = Math.ceil(STAGE_TOP_PAD + maxH + STAGE_BOTTOM_PAD) + 'px';
    }
  }

  function requestSyncStageHeight() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(syncStageHeight);
    });
  }

  function applyLayout() {
    if (isNarrow()) return;
    cards.forEach(function (card) {
      var v = parseInt(card.getAttribute('data-venue'), 10);
      var s = venueToSlot(v);
      card.style.left = SLOT_LEFT_PCT[s] + '%';
      card.setAttribute('data-slot', String(s));
      card.classList.toggle('is-center', NUM_SLOTS >= 2 && s === Math.floor(NUM_SLOTS / 2));
    });
    requestSyncStageHeight();
  }

  function rotateLeft(arr) {
    var a = arr.slice();
    a.push(a.shift());
    return a;
  }

  function rotateRight(arr) {
    var a = arr.slice();
    a.unshift(a.pop());
    return a;
  }

  function randomMove() {
    if (isNarrow() || prefersReduce()) return;
    if (NUM_SLOTS < 2) return;
    var r = Math.random();
    if (r < 0.42) {
      var a = Math.floor(Math.random() * NUM_SLOTS);
      var b = (a + 1 + Math.floor(Math.random() * (NUM_SLOTS - 1))) % NUM_SLOTS;
      var t = slotToVenue[a];
      slotToVenue[a] = slotToVenue[b];
      slotToVenue[b] = t;
    } else if (r < 0.71) {
      slotToVenue = rotateLeft(slotToVenue);
    } else {
      slotToVenue = rotateRight(slotToVenue);
    }
    applyLayout();
  }

  /** Cambia de lote (3+3): delta +1 siguiente, -1 anterior — flechas del carril estilo referencia. */
  function goBatchStep(delta) {
    if (BATCHES.length < 2) return;
    batchIndex = (batchIndex + delta + BATCHES.length) % BATCHES.length;
    stage.classList.add('mdj-venues-sweeping');
    window.setTimeout(function () {
      applyBatch(batchIndex);
      for (var j = 0; j < NUM_SLOTS; j++) {
        slotToVenue[j] = j;
      }
      applyLayout();
      playVideos();
      requestSyncStageHeight();
      window.requestAnimationFrame(function () {
        stage.classList.remove('mdj-venues-sweeping');
        syncStageHeight();
      });
    }, 160);
  }

  function sweepNextBatch() {
    goBatchStep(1);
  }

  function scheduleNext() {
    clearTimeout(timer);
    if (isNarrow() || prefersReduce()) return;
    timer = window.setTimeout(function () {
      shuffleTick++;
      if (BATCHES.length > 1 && shuffleTick >= SWEEP_EVERY) {
        shuffleTick = 0;
        sweepNextBatch();
      } else {
        randomMove();
      }
      scheduleNext();
    }, 2800 + Math.random() * 4200);
  }

  function bootMotion() {
    if (isNarrow() || prefersReduce()) {
      stage.style.minHeight = '';
      cards.forEach(function (c) {
        c.style.left = '';
        c.classList.remove('is-center');
      });
      return;
    }
    applyLayout();
    requestSyncStageHeight();
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

  (function wireVenueNav() {
    var navPrev = document.getElementById('mdjVenuesNavPrev');
    var navNext = document.getElementById('mdjVenuesNavNext');
    if (BATCHES.length < 2) {
      if (navPrev) navPrev.hidden = true;
      if (navNext) navNext.hidden = true;
      return;
    }
    if (navPrev) {
      navPrev.addEventListener('click', function (e) {
        e.preventDefault();
        goBatchStep(-1);
      });
    }
    if (navNext) {
      navNext.addEventListener('click', function (e) {
        e.preventDefault();
        goBatchStep(1);
      });
    }
  })();

  window.addEventListener(
    'load',
    function () {
      requestSyncStageHeight();
    },
    { once: true }
  );

  document.addEventListener('languageChanged', function () {
    applyBatch(batchIndex);
    applyLayout();
    requestSyncStageHeight();
  });

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
        stage.style.minHeight = '';
        cards.forEach(function (c) {
          c.style.left = '';
          c.classList.remove('is-center');
        });
        return;
      }
      applyLayout();
      requestSyncStageHeight();
      scheduleNext();
    },
    { passive: true }
  );
})();
