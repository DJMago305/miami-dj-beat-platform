/**
 * Hero horizontal: galería de fotos bajo #experience.
 * - En producción: lista Storage bucket `assets`, carpeta `eventos-venues-patrocinadores/galeria/` (Dashboard coincide con web/assets/.../galeria/).
 * - En localhost: usa gallery-manifest.json (regenerar con `npm run gallery:manifest` en web/ tras añadir fotos a assets/.../galeria/).
 * - Extensión futura: subidas desde admin/manager a la misma ruta de Storage — ver LEEME en eventos-venues-patrocinadores/.
 */
(function () {
  var wrap = document.getElementById('mdjExperienceGalleryWrap');
  var root = document.getElementById('mdjVenuePhotoHero');
  if (!wrap || !root) return;

  /** Debe coincidir con el nombre del bucket en Supabase → Storage (p. ej. público `assets`). */
  var GALLERY_STORAGE_BUCKET = 'assets';
  /** Prefijo dentro del bucket (sin slash inicial/final). */
  var GALLERY_STORAGE_FOLDER = 'eventos-venues-patrocinadores/galeria';

  var MANIFEST_URL = './assets/eventos-venues-patrocinadores/gallery-manifest.json';
  var BASE = './assets/eventos-venues-patrocinadores/galeria/';

  var slideA = root.querySelector('.mdj-venue-photo-hero__slide--a');
  var slideB = root.querySelector('.mdj-venue-photo-hero__slide--b');
  var imgA = slideA && slideA.querySelector('img');
  var imgB = slideB && slideB.querySelector('img');
  var btnPrev = document.getElementById('mdjGalleryPhotoPrev');
  var btnNext = document.getElementById('mdjGalleryPhotoNext');
  var counterEl = root.querySelector('.mdj-venue-photo-hero__counter');

  var entries = [];
  var idx = 0;
  /** true si las entradas vienen del listado Storage (bucket assets + carpeta galería). */
  var useDedicatedGalleryBucket = false;
  /** La capa visible al terminar la última transición (true = A arriba). */
  var topIsA = true;
  var timer = null;
  var intervalMs = 6000;
  var transitionMs = 1000;
  var io = null;

  function resolveUrl(relPath) {
    if (typeof window.resolveEventosVenuesPublicUrl === 'function') {
      return window.resolveEventosVenuesPublicUrl(relPath);
    }
    return relPath;
  }

  function pathForFile(file) {
    var relPath = BASE + file;
    if (useDedicatedGalleryBucket && window.MDB_SUPABASE_URL) {
      var origin = String(window.MDB_SUPABASE_URL).replace(/\/$/, '');
      try {
        var seg = String(file || '')
          .split('/')
          .map(function (s) {
            try {
              return encodeURIComponent(decodeURIComponent(s));
            } catch (e) {
              return encodeURIComponent(s);
            }
          })
          .join('/');
        if (seg) {
          var folderSeg = GALLERY_STORAGE_FOLDER.split('/').map(function (part) {
            try {
              return encodeURIComponent(decodeURIComponent(part));
            } catch (e) {
              return encodeURIComponent(part);
            }
          }).join('/');
          return (
            origin +
            '/storage/v1/object/public/' +
            GALLERY_STORAGE_BUCKET +
            '/' +
            folderSeg +
            '/' +
            seg
          );
        }
      } catch (e2) {
        void e2;
      }
    }
    return resolveUrl(relPath);
  }

  function normalize(e) {
    if (typeof e === 'string') return { file: e, alt: '' };
    if (e && typeof e.file === 'string') return { file: e.file, alt: e.alt || '' };
    return null;
  }

  function prefersReduce() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function updateCounter() {
    if (!counterEl || entries.length === 0) return;
    counterEl.textContent = idx + 1 + ' / ' + entries.length;
  }

  function bootstrapFirst() {
    var e = entries[0];
    if (!imgA || !slideA) return;
    imgA.src = pathForFile(e.file);
    imgA.alt = e.alt || '';
    slideA.classList.add('is-visible');
    if (slideB) slideB.classList.remove('is-visible');
    topIsA = true;
    idx = 0;
    updateCounter();
  }

  function showIndex(n) {
    if (entries.length === 0) return;
    var next = ((n % entries.length) + entries.length) % entries.length;
    idx = next;
    var ent = entries[idx];
    var url = pathForFile(ent.file);
    var alt = ent.alt || '';

    var top = topIsA ? slideA : slideB;
    var bottom = topIsA ? slideB : slideA;
    var bottomImg = topIsA ? imgB : imgA;
    if (!bottom || !bottomImg || !top) return;

    if (prefersReduce()) {
      bottomImg.src = url;
      bottomImg.alt = alt;
      bottom.classList.add('is-visible');
      top.classList.remove('is-visible');
      topIsA = !topIsA;
      updateCounter();
      return;
    }

    bottomImg.onload = function () {
      bottomImg.onload = null;
      bottom.classList.add('is-visible');
      window.setTimeout(function () {
        top.classList.remove('is-visible');
        topIsA = !topIsA;
      }, transitionMs);
    };
    bottomImg.onerror = function () {
      bottomImg.onerror = null;
    };
    bottomImg.src = url;
    bottomImg.alt = alt;
    updateCounter();
  }

  function step(delta) {
    if (entries.length === 0) return;
    if (entries.length === 1) return;
    clearTimer();
    showIndex(idx + delta);
    schedule();
  }

  function schedule() {
    clearTimer();
    if (entries.length < 2) return;
    timer = window.setInterval(function () {
      showIndex(idx + 1);
    }, intervalMs);
  }

  function bindNav() {
    if (root.dataset.mdjGalleryNavBound === '1') return;
    root.dataset.mdjGalleryNavBound = '1';
    if (btnPrev) {
      btnPrev.addEventListener('click', function (e) {
        e.preventDefault();
        step(-1);
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', function (e) {
        e.preventDefault();
        step(1);
      });
    }
    root.addEventListener('keydown', function (e) {
      if (entries.length < 2) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      }
    });
  }

  function observeVisibility() {
    if (!('IntersectionObserver' in window)) {
      schedule();
      return;
    }
    io = new IntersectionObserver(
      function (ents) {
        ents.forEach(function (e) {
          if (e.isIntersecting && entries.length > 1) {
            if (!timer) schedule();
          } else {
            clearTimer();
          }
        });
      },
      { threshold: 0.12 }
    );
    io.observe(root);
  }

  function isImageFileName(name) {
    return typeof name === 'string' && /\.(jpe?g|png|webp|gif|avif)$/i.test(name);
  }

  /** En producción: lista Storage galeria/ para no depender del manifiesto al subir fotos nuevas. */
  function tryListFromSupabaseStorage() {
    return new Promise(function (resolve) {
      try {
        var force = window.MDJ_GALLERY_LIST_STORAGE === true;
        var h = '';
        try {
          h = String(location.hostname || '').toLowerCase();
        } catch (e2) {
          /* noop */
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
          .from(GALLERY_STORAGE_BUCKET)
          .list(GALLERY_STORAGE_FOLDER, { limit: 500 })
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
              if (!name || name[0] === '.' || !isImageFileName(name)) continue;
              out.push(name);
            }
            out.sort(function (a, b) {
              return a.localeCompare(b, undefined, { sensitivity: 'base' });
            });
            resolve(out.length ? out : null);
          })
          .catch(function () {
            resolve(null);
          });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function fetchManifestJson() {
    return fetch(MANIFEST_URL)
      .then(function (r) {
        if (!r.ok) return {};
        return r.text().then(function (txt) {
          try {
            return JSON.parse(txt);
          } catch (e) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn(
                '[venue-photo-gallery] gallery-manifest.json inválido (¿faltan comas entre ítems?).',
                e
              );
            }
            return {};
          }
        });
      })
      .catch(function () {
        return {};
      });
  }

  function applyGalleryData(data, storageFileNames) {
    if (data && typeof data.intervalMs === 'number' && data.intervalMs >= 2500) {
      intervalMs = data.intervalMs;
    }
    if (data && typeof data.transitionMs === 'number' && data.transitionMs >= 200) {
      transitionMs = data.transitionMs;
    }
    root.style.setProperty('--mdj-gallery-fade-ms', transitionMs + 'ms');
    entries = [];
    useDedicatedGalleryBucket = !!(storageFileNames && storageFileNames.length);
    if (storageFileNames && storageFileNames.length) {
      for (var s = 0; s < storageFileNames.length; s++) {
        entries.push({ file: storageFileNames[s], alt: '' });
      }
    } else {
      var raw = (data && data.images) || [];
      for (var i = 0; i < raw.length; i++) {
        var n = normalize(raw[i]);
        if (n && n.file) entries.push(n);
      }
    }
    if (entries.length === 0) {
      wrap.setAttribute('hidden', '');
      return;
    }
    wrap.removeAttribute('hidden');
    if (entries.length === 1) {
      if (btnPrev) btnPrev.hidden = true;
      if (btnNext) btnNext.hidden = true;
    }
    bootstrapFirst();
    bindNav();
    if (entries.length > 1) {
      observeVisibility();
    }
    if (window.i18n && typeof window.i18n.updateUI === 'function') {
      window.i18n.updateUI();
    }
  }

  Promise.all([fetchManifestJson(), tryListFromSupabaseStorage()])
    .then(function (pair) {
      var data = pair[0] || {};
      var storageFiles = pair[1];
      applyGalleryData(data, storageFiles);
    })
    .catch(function () {
      wrap.setAttribute('hidden', '');
    });
})();
