/**
 * Carrusel horizontal en #residencies: flechas, rueda/trackpad, arrastre, teclado.
 * Sonido: trinquete vía data-mdj-ui-tick-scroll + mdj-carousel-scroll-tick.js (scroll).
 * Bucle infinito: contenido duplicado en el track; corrección de scrollLeft al cruzar extremos
 * (dataset.mdjTickMute durante el salto para no disparar ráfagas de sonido).
 */
(function () {
  var root = document.getElementById('mdjResidenciesCarousel');
  if (!root) return;

  var viewport = root.querySelector('.mdj-residencies-carousel__viewport');
  var track = root.querySelector('.mdj-residencies-carousel__track');
  var prevBtn = root.querySelector('.mdj-residencies-nav--prev');
  var nextBtn = root.querySelector('.mdj-residencies-nav--next');
  if (!viewport || !track || !prevBtn || !nextBtn) return;

  /** Umbral izq./der.: bajo = menos saltos espurios; el wrap se dispara tras parar el scroll (debounce/scrollend). */
  var EDGE = 2;
  var wrapLock = false;
  var wrapDebounce = null;
  var WRAP_DEBOUNCE_MS = 56;
  var supportsScrollEnd = false;
  try {
    supportsScrollEnd = 'onscrollend' in viewport || typeof viewport.onscrollend !== 'undefined';
  } catch (e) {
    supportsScrollEnd = false;
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function scrollBehavior() {
    return prefersReducedMotion() ? 'auto' : 'smooth';
  }

  function playTick() {
    if (typeof window.mdjUiTickPlay === 'function') window.mdjUiTickPlay();
  }

  function withTickMute(fn) {
    viewport.dataset.mdjTickMute = '1';
    fn();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        delete viewport.dataset.mdjTickMute;
      });
    });
  }

  function getGapPx() {
    var s = window.getComputedStyle(track);
    var g = s.gap || s.columnGap;
    var n = parseFloat(g);
    return Number.isFinite(n) ? n : 14;
  }

  function getStep() {
    var card = track.querySelector('a.residency-card--map');
    if (!card) return Math.min(viewport.clientWidth * 0.85, 320);
    return card.getBoundingClientRect().width + getGapPx();
  }

  function maxScroll() {
    return Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  }

  function getSegmentWidth() {
    if (track.dataset.mdjResidenciesLoop !== '1') return 0;
    return viewport.scrollWidth / 2;
  }

  function duplicateTrackForLoop() {
    if (track.dataset.mdjResidenciesLoop === '1') return;
    var nodes = track.children;
    if (!nodes || nodes.length === 0) return;
    var frag = document.createDocumentFragment();
    var i;
    for (i = 0; i < nodes.length; i++) {
      frag.appendChild(nodes[i].cloneNode(true));
    }
    track.appendChild(frag);
    track.dataset.mdjResidenciesLoop = '1';
  }

  function instantWrap() {
    if (wrapLock) return;
    if (track.dataset.mdjResidenciesLoop !== '1') return;
    var seg = getSegmentWidth();
    if (seg < 48) return;
    var sl = viewport.scrollLeft;
    var V = viewport.clientWidth;
    var total = viewport.scrollWidth;
    var max = total - V;
    if (max <= EDGE) return;

    if (sl <= EDGE) {
      wrapLock = true;
      var targetL = Math.round(sl + seg);
      withTickMute(function () {
        viewport.scrollLeft = targetL;
      });
      requestAnimationFrame(function () {
        wrapLock = false;
      });
      return;
    }
    if (sl >= max - EDGE) {
      wrapLock = true;
      var targetR = Math.round(sl - seg);
      withTickMute(function () {
        viewport.scrollLeft = targetR;
      });
      requestAnimationFrame(function () {
        wrapLock = false;
      });
    }
  }

  function scheduleDebouncedWrap() {
    if (supportsScrollEnd) return;
    if (wrapDebounce) clearTimeout(wrapDebounce);
    wrapDebounce = setTimeout(function () {
      wrapDebounce = null;
      instantWrap();
    }, WRAP_DEBOUNCE_MS);
  }

  function isScrolledToStart() {
    return viewport.scrollLeft <= EDGE;
  }

  function isScrolledToEnd() {
    var max = maxScroll();
    if (max <= EDGE) return true;
    return viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - EDGE;
  }

  function updateNav() {
    var max = maxScroll();
    prevBtn.removeAttribute('hidden');
    nextBtn.removeAttribute('hidden');
    if (max <= EDGE) {
      /* Flechas visibles como pista de carrusel (antes `hidden` las quitaba en pantallas anchas). */
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      prevBtn.style.opacity = '0.42';
      nextBtn.style.opacity = '0.42';
    } else {
      prevBtn.disabled = false;
      nextBtn.disabled = false;
      prevBtn.style.opacity = '';
      nextBtn.style.opacity = '';
    }
  }

  function onPrev() {
    var max = maxScroll();
    if (max <= EDGE) return;
    var seg = getSegmentWidth();
    if (seg > 48 && isScrolledToStart()) {
      var target = Math.max(0, Math.round(seg - viewport.clientWidth));
      withTickMute(function () {
        viewport.scrollTo({ left: target, behavior: 'auto' });
      });
      playTick();
      return;
    }
    viewport.scrollBy({ left: -getStep(), behavior: scrollBehavior() });
  }

  function onNext() {
    var max = maxScroll();
    if (max <= EDGE) return;
    if (isScrolledToEnd()) {
      withTickMute(function () {
        viewport.scrollTo({ left: 0, behavior: 'auto' });
      });
      playTick();
      return;
    }
    viewport.scrollBy({ left: getStep(), behavior: scrollBehavior() });
  }

  prevBtn.addEventListener('click', onPrev);
  nextBtn.addEventListener('click', onNext);

  viewport.addEventListener(
    'scroll',
    function () {
      requestAnimationFrame(updateNav);
      if (supportsScrollEnd) return;
      scheduleDebouncedWrap();
    },
    { passive: true }
  );

  if (supportsScrollEnd) {
    viewport.addEventListener(
      'scrollend',
      function () {
        instantWrap();
      },
      { passive: true }
    );
  }

  window.addEventListener(
    'resize',
    function () {
      requestAnimationFrame(updateNav);
    },
    { passive: true }
  );

  viewport.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onNext();
    }
  });

  duplicateTrackForLoop();
  requestAnimationFrame(updateNav);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      requestAnimationFrame(updateNav);
    });
  }
  setTimeout(updateNav, 200);
})();
