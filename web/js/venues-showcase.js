/**
 * Galería de venues (#experience): 4 “heroes” fijos en pantalla = ventana de 4 cartas.
 * Todos los .mp4 de reels/ son el mazo: van pasando por esos huecos (rotación +1) mientras
 * slotToVenue + CSS hacen el efecto baraja de casino (intercambios y giros entre ticks).
 * - Producción: lista bucket Storage assets → eventos-venues-patrocinadores/reels/
 * - Localhost: reels-manifest.json (npm run reels:manifest o reels:watch) + mismo orden que archivos en disco
 * - Textos por vídeo: reels-catalog.json (byFile); si falta entrada → i18n referral por defecto.
 */
(function () {
  var stage = document.getElementById('mdjVenuesVideoStage');
  if (!stage) return;

  var REELS_BUCKET = 'assets';
  var REELS_STORAGE_PREFIX = 'eventos-venues-patrocinadores/reels';
  var CATALOG_URL = './assets/eventos-venues-patrocinadores/reels-catalog.json';
  var MANIFEST_URL = './assets/eventos-venues-patrocinadores/reels-manifest.json';

  var cards = Array.prototype.slice.call(stage.querySelectorAll('.mdj-venues-video-card'));
  var NUM_SLOTS = cards.length;
  var GAP_PCT = 8;

  var allEntries = [];
  var rotationOffset = 0;
  var catalogData = { byFile: {}, fallbackReel: 'Mojitos_calle_8.mp4' };
  var shuffleTick = 0;
  var SWEEP_EVERY = 7;
  var timer = null;

  var REEL_FILENAME_ALIASES = {
    'bailaconmicho.mp4': [
      'Baila_Con_Micho.mp4',
      'Baila_con_Micho.mp4',
      'baila_con_micho.mp4',
      'BailaConMicho.mp4',
      'baila con micho.mp4',
      'Baila Con Micho.mp4',
      'BAILA_CON_MICHO.MP4'
    ],
    'Baila_Con_Micho.mp4': [
      'bailaconmicho.mp4',
      'Baila_con_Micho.mp4',
      'baila_con_micho.mp4',
      'BailaConMicho.mp4',
      'baila con micho.mp4',
      'Baila Con Micho.mp4',
      'BAILA_CON_MICHO.MP4'
    ],
    'Fashion_Show.mp4': ['fashion_show.mp4', 'FashionShow.mp4', 'FASHION_SHOW.MP4']
  };

  function isVideoFileName(name) {
    return typeof name === 'string' && /\.mp4$/i.test(name);
  }

  /** Un solo nombre en cola aunque Storage/manifiesto usen Baila_Con_Micho vs bailaconmicho (histórico). */
  function canonicalFileName(name) {
    if (!name || !isVideoFileName(name)) return name;
    var compact = String(name)
      .toLowerCase()
      .replace(/\.mp4$/i, '')
      .replace(/[\s_]/g, '');
    if (compact === 'bailaconmicho') return 'bailaconmicho.mp4';
    return name;
  }

  /**
   * Una entrada por archivo real; si Storage y el manifiesto difieren solo en mayúsculas,
   * se usa el nombre de reels-catalog.json (byFile) para que la URL del bucket coincida.
   */
  function uniqueSorted(names, cat) {
    var canonical = {};
    var bf = cat && cat.byFile ? cat.byFile : {};
    for (var ck in bf) {
      if (Object.prototype.hasOwnProperty.call(bf, ck) && isVideoFileName(ck)) {
        canonical[String(ck).toLowerCase()] = ck;
      }
    }
    var seenLower = {};
    var out = [];
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (!n || !isVideoFileName(n)) continue;
      var low = String(n).toLowerCase();
      if (seenLower[low]) continue;
      seenLower[low] = true;
      out.push(canonical[low] || n);
    }
    out.sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    return out;
  }

  function orderEntries(rows, cat) {
    var spotlight = cat && cat.spotlightReels ? cat.spotlightReels : [];
    if (!spotlight.length) return rows;
    var ord = {};
    for (var s = 0; s < spotlight.length; s++) {
      ord[String(spotlight[s]).toLowerCase()] = s;
    }
    var head = [];
    var tail = [];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var low = String(row.reel).toLowerCase();
      if (Object.prototype.hasOwnProperty.call(ord, low)) {
        head.push({ row: row, o: ord[low] });
      } else {
        tail.push(row);
      }
    }
    head.sort(function (a, b) {
      return a.o - b.o;
    });
    tail.sort(function (a, b) {
      return a.reel.localeCompare(b.reel, undefined, { sensitivity: 'base' });
    });
    var merged = [];
    for (var h = 0; h < head.length; h++) merged.push(head[h].row);
    for (var t = 0; t < tail.length; t++) merged.push(tail[t]);
    return merged;
  }

  /** Coloca el primer spotlight en la tarjeta central al cargar (mejor visibilidad que el borde). */
  function initialRotationOffset(rows, cat) {
    var n = rows.length;
    if (!n || NUM_SLOTS < 1) return 0;
    var spotlight = cat && cat.spotlightReels ? cat.spotlightReels : [];
    if (!spotlight.length) return 0;
    var want = String(spotlight[0]).toLowerCase();
    var idx = -1;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].reel).toLowerCase() === want) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return 0;
    var centerCardIdx = Math.min(Math.floor(NUM_SLOTS / 2), NUM_SLOTS - 1);
    return (idx - centerCardIdx + n) % n;
  }

  function metaForFile(name, cat) {
    var by = cat && cat.byFile ? cat.byFile : {};
    if (by[name]) return by[name];
    var lower = String(name).toLowerCase();
    for (var k in by) {
      if (Object.prototype.hasOwnProperty.call(by, k) && String(k).toLowerCase() === lower) return by[k];
    }
    return null;
  }

  function fallbackPath(cat) {
    var fb = (cat && cat.fallbackReel) || 'Mojitos_calle_8.mp4';
    return './assets/eventos-venues-patrocinadores/reels/' + fb;
  }

  function rowFromFile(filename, cat) {
    var meta = metaForFile(filename, cat);
    var fb = fallbackPath(cat);
    if (meta && meta.venueI18n) {
      return {
        reel: filename,
        fallback: fb,
        venueI18n: meta.venueI18n,
        typeI18n: meta.typeI18n,
        quoteI18n: meta.quoteI18n
      };
    }
    return {
      reel: filename,
      fallback: fb,
      venueI18n: 'exp-venue-referral-default',
      typeI18n: 'exp-type-referral-default',
      quoteI18n: 'exp-quote-referral-default'
    };
  }

  function filesFromCatalogKeys(cat) {
    var out = [];
    var bf = cat && cat.byFile ? cat.byFile : {};
    for (var k in bf) {
      if (Object.prototype.hasOwnProperty.call(bf, k) && isVideoFileName(k)) out.push(k);
    }
    return uniqueSorted(out, cat);
  }

  function tryListReelsFromSupabaseStorage() {
    return new Promise(function (resolve) {
      try {
        var force = window.MDJ_VENUE_REELS_FORCE_STORAGE === true;
        var h = '';
        try {
          h = String(location.hostname || '').toLowerCase();
        } catch (e2) {
          void e2;
        }
        if ((h === 'localhost' || h === '127.0.0.1') && !force) {
          resolve(null);
          return;
        }
        if (typeof window.getSupabaseClient !== 'function') {
          resolve(null);
          return;
        }
        var supa = window.getSupabaseClient();
        if (!supa || !supa.storage) {
          resolve(null);
          return;
        }
        supa.storage
          .from(REELS_BUCKET)
          .list(REELS_STORAGE_PREFIX, { limit: 500 })
          .then(function (res) {
            var err = res.error;
            var data = res.data;
            if (err || !data || !data.length) {
              resolve(null);
              return;
            }
            var out = [];
            for (var i = 0; i < data.length; i++) {
              var name = data[i].name;
              if (!name || name[0] === '.' || !isVideoFileName(name)) continue;
              out.push(name);
            }
            resolve(out.length ? uniqueSorted(out, null) : null);
          })
          .catch(function () {
            resolve(null);
          });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function fetchJson(url) {
    return fetch(url)
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  /** En localhost evita caché del manifiesto para que, tras añadir un .mp4 y recargar, entre en la cola. */
  function fetchManifestJson() {
    var url = MANIFEST_URL;
    try {
      var h = String(location.hostname || '').toLowerCase();
      if (h === 'localhost' || h === '127.0.0.1') {
        url = MANIFEST_URL + '?t=' + String(Date.now());
      }
    } catch (e1) {
      void e1;
    }
    return fetchJson(url);
  }

  function buildAllEntries(storageFiles, manifestObj, cat) {
    var fromMan = (manifestObj && manifestObj.files) || [];
    var merged = [];
    if (storageFiles && storageFiles.length) {
      for (var i = 0; i < storageFiles.length; i++) merged.push(canonicalFileName(storageFiles[i]));
    }
    for (var j = 0; j < fromMan.length; j++) merged.push(canonicalFileName(fromMan[j]));
    var names = uniqueSorted(merged, cat);
    if (!names.length) names = filesFromCatalogKeys(cat);
    var rows = [];
    for (var k = 0; k < names.length; k++) {
      rows.push(rowFromFile(names[k], cat));
    }
    return orderEntries(rows, cat);
  }

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
    try {
      vid.setAttribute('playsinline', '');
      vid.setAttribute('webkit-playsinline', '');
      vid.playsInline = true;
      if (!vid.getAttribute('preload')) vid.setAttribute('preload', 'auto');
    } catch (ePl) {
      void ePl;
    }
    var reel = vid.getAttribute('data-mdj-reel');
    var fb = vid.getAttribute('data-mdj-reel-fallback');
    if (!fb || !reel) return;
    var names = [reel].concat(REEL_FILENAME_ALIASES[reel] || []);
    var attempt = 0;
    var fallbackAbs = absoluteReelUrl(fb);
    var stallTimer = null;

    function clearStallTimer() {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    }

    function tryNext() {
      clearStallTimer();
      vid.onerror = null;
      if (attempt < names.length) {
        var localReelPath = './assets/eventos-venues-patrocinadores/reels/' + names[attempt];
        attempt += 1;
        vid.onerror = function () {
          tryNext();
        };
        vid.src = String(absoluteReelUrl(localReelPath));
        try {
          vid.load();
        } catch (eLoad) {
          void eLoad;
        }
        stallTimer = window.setTimeout(function () {
          stallTimer = null;
          try {
            if (vid.readyState < 2 && !vid.error) tryNext();
          } catch (eT) {
            void eT;
          }
        }, 14000);
        function clearOnReady() {
          clearStallTimer();
          vid.removeEventListener('loadeddata', clearOnReady);
          vid.removeEventListener('canplay', clearOnReady);
        }
        vid.addEventListener('loadeddata', clearOnReady, { once: true });
        vid.addEventListener('canplay', clearOnReady, { once: true });
        return;
      }
      vid.onerror = null;
      if (vid.getAttribute('src') !== String(fallbackAbs)) {
        vid.src = String(fallbackAbs);
        try {
          vid.load();
        } catch (eFb) {
          void eFb;
        }
      }
    }
    tryNext();
  }

  function applyRotation() {
    var n = allEntries.length;
    if (!n) return;
    cards.forEach(function (card, i) {
      var row = allEntries[(rotationOffset + i) % n];
      if (!row) return;
      var vid = card.querySelector('video');
      if (vid) {
        vid.removeAttribute('poster');
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

  /** Avanza o retrocede el “mazo” de una carta: cada hero acaba mostrando todos los vídeos. */
  function stepRotation(deltaSteps) {
    var n = allEntries.length;
    if (!n) return;
    rotationOffset = ((rotationOffset + deltaSteps) % n + n) % n;
  }

  function goRotationStep(delta) {
    if (allEntries.length < 2) return;
    stepRotation(delta);
    stage.classList.add('mdj-venues-sweeping');
    window.setTimeout(function () {
      applyRotation();
      for (var jj = 0; jj < NUM_SLOTS; jj++) {
        slotToVenue[jj] = jj;
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

  function sweepNextReel() {
    goRotationStep(1);
  }

  function scheduleNext() {
    clearTimeout(timer);
    if (isNarrow() || prefersReduce()) return;
    timer = window.setTimeout(function () {
      shuffleTick++;
      if (allEntries.length > 1 && shuffleTick >= SWEEP_EVERY) {
        shuffleTick = 0;
        sweepNextReel();
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

  function wireVenueNav() {
    var navPrev = document.getElementById('mdjVenuesNavPrev');
    var navNext = document.getElementById('mdjVenuesNavNext');
    var multi = allEntries.length > 1;
    if (navPrev) {
      navPrev.hidden = !multi;
      navPrev.onclick = function (e) {
        e.preventDefault();
        goRotationStep(-1);
      };
    }
    if (navNext) {
      navNext.hidden = !multi;
      navNext.onclick = function (e) {
        e.preventDefault();
        goRotationStep(1);
      };
    }
  }

  Promise.all([
    fetchJson(CATALOG_URL),
    fetchManifestJson(),
    tryListReelsFromSupabaseStorage()
  ])
    .then(function (triple) {
      var catRaw = triple[0];
      if (catRaw && typeof catRaw === 'object') {
        catalogData = catRaw;
      }
      var manifestObj = triple[1];
      var storageFiles = triple[2];
      allEntries = buildAllEntries(storageFiles, manifestObj, catalogData);
      rotationOffset = initialRotationOffset(allEntries, catalogData);
      applyRotation();
      wireVenueNav();
      bootMotion();
      playVideos();
    })
    .catch(function () {
      allEntries = buildAllEntries(null, null, catalogData);
      if (allEntries.length) {
        rotationOffset = initialRotationOffset(allEntries, catalogData);
        applyRotation();
        wireVenueNav();
        bootMotion();
        playVideos();
      }
    });

  window.addEventListener(
    'load',
    function () {
      requestSyncStageHeight();
    },
    { once: true }
  );

  document.addEventListener('languageChanged', function () {
    applyRotation();
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
