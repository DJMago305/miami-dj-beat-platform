/**
 * Miami DJ Beat — #mainNav (cabecera unificada) como carrusel infinito cuando el menú
 * se desborda. Mismo ADN que `rentals.js` (clones + salto en bordes); además, deriva lenta
 * opcional (deshabilitada con prefers-reduced-motion).
 * Cargar después de `mdj-shared-header.js` y de `mdj-carousel-scroll-tick.js` (sonido trinquete).
 * Expone `window.mdjReinitMainNavInfinite`.
 */
(function () {
  'use strict';

  var CLONE = 'mdj-mainnav-infinite-clone';
  var CLS_ON = 'mdj-mainnav-infinite--on';
  var MOUNTED = 'data-mdj-mainnav-infinite';

  function getNav() {
    var h = document.getElementById('mainHeader');
    if (!h || !h.classList || !h.classList.contains('mdj-header-unified')) return null;
    var n = document.getElementById('mainNav');
    if (!n || !n.classList || !n.classList.contains('mdj-mainnav-flex')) return null;
    return n;
  }

  function isDesktop() {
    return typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1001px)').matches : window.innerWidth > 1000;
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function stopDrift(nav) {
    if (!nav) return;
    if (nav._mdjDriftRaf) {
      cancelAnimationFrame(nav._mdjDriftRaf);
      nav._mdjDriftRaf = 0;
    }
  }

  function teardownNav(nav) {
    if (!nav) return;
    if (nav.dataset && nav.dataset.mdjMainnavForceW === '1') {
      try {
        nav.style.maxWidth = '';
      } catch (eMw) { /* ignore */ }
      delete nav.dataset.mdjMainnavForceW;
    }
    stopDrift(nav);
    if (nav._mdjRemoveDragGuard) {
      try {
        nav._mdjRemoveDragGuard();
      } catch (e) { /* ignore */ }
      nav._mdjRemoveDragGuard = null;
    }
    nav.querySelectorAll('a.' + CLONE).forEach(function (a) {
      a.remove();
    });
    nav.classList.remove(CLS_ON);
    nav.removeAttribute(MOUNTED);
    delete nav._mdjInfSetWidth;
    if (nav._mdjInfScroll) {
      nav.removeEventListener('scroll', nav._mdjInfScroll, { passive: true });
      delete nav._mdjInfScroll;
    }
    if (nav._mdjInfResize) {
      window.removeEventListener('resize', nav._mdjInfResize, { passive: true });
      delete nav._mdjInfResize;
    }
    if (nav._mdjMainNavTickScroll) {
      nav.removeEventListener('scroll', nav._mdjMainNavTickScroll, { passive: true });
      delete nav._mdjMainNavTickScroll;
    }
    var cont = nav.parentElement;
    var bar = cont && cont.parentElement;
    if (bar && bar.classList && bar.classList.contains('header-nav')) {
      bar.classList.remove('mdj-mainnav-infinite--ui');
      bar.querySelectorAll('.mdj-mainnav-infinite-chevron').forEach(function (b) {
        b.remove();
      });
    } else if (cont) {
      cont.classList.remove('mdj-mainnav-infinite--ui');
      cont.querySelectorAll('.mdj-mainnav-infinite-chevron').forEach(function (b) {
        b.remove();
      });
    }
  }

  function applyStripWidth(nav) {
    if (!nav || nav.getAttribute(MOUNTED) !== '1') {
      if (nav) nav.scrollLeft = 0;
      return;
    }
    var orig = Array.prototype.slice.call(nav.querySelectorAll(':scope > a:not(.' + CLONE + ')'));
    var n = orig.length;
    if (n < 2) return;
    var a0 = orig[0];
    var a1 = orig[n - 1];
    if (!a0 || !a1) return;
    var sw = Math.round(a1.offsetLeft + a1.offsetWidth - a0.offsetLeft);
    if (!sw || sw < 8) {
      var tri = Math.round(nav.scrollWidth / 3);
      if (tri > 8) sw = tri;
    }
    if (!sw || sw < 8) return;
    nav._mdjInfSetWidth = sw;
    nav.scrollLeft = sw;
  }

  function cloneOne(el) {
    var c = el.cloneNode(true);
    c.classList.add(CLONE);
    c.classList.remove('active');
    c.removeAttribute('id');
    c.setAttribute('aria-hidden', 'true');
    c.setAttribute('tabindex', '-1');
    return c;
  }

  var CHEV_SVG_R =
    '<svg class="mdj-mainnav-chevron-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function playTickIfReady() {
    if (typeof window.mdjUiTickPlay !== 'function') return;
    try {
      window.mdjUiTickPlay();
    } catch (e) {
      /* ignore */
    }
  }

  function mountChevrons(nav) {
    var cont = nav.parentElement;
    if (!cont) return;
    var bar = cont.parentElement;
    if (!bar || !bar.classList || !bar.classList.contains('header-nav')) {
      return;
    }
    bar.querySelectorAll('.mdj-mainnav-infinite-chevron').forEach(function (b) {
      b.remove();
    });
    bar.classList.add('mdj-mainnav-infinite--ui');
    var raw = document.documentElement && String(document.documentElement.getAttribute('lang') || document.documentElement.lang || '').toLowerCase();
    var isEs = raw === 'es' || raw.indexOf('es-') === 0;
    var p = document.createElement('button');
    p.type = 'button';
    p.className = 'mdj-mainnav-infinite-chevron mdj-mainnav-infinite-chevron--prev';
    p.setAttribute('aria-label', isEs ? 'Desplazar el menú hacia la izquierda' : 'Scroll the menu left');
    p.innerHTML = CHEV_SVG_R;
    var nxt = document.createElement('button');
    nxt.type = 'button';
    nxt.className = 'mdj-mainnav-infinite-chevron mdj-mainnav-infinite-chevron--next';
    nxt.setAttribute('aria-label', isEs ? 'Desplazar el menú hacia la derecha' : 'Scroll the menu right');
    nxt.innerHTML = CHEV_SVG_R;
    var step = Math.max(100, Math.min(260, Math.floor(nav.clientWidth * 0.4)));
    p.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      // Tick solo vía initScrollSoundAcc (scroll), no al clic, para no solapar sonidos.
      nav.scrollBy({ left: -step, behavior: 'smooth' });
    });
    nxt.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      nav.scrollBy({ left: step, behavior: 'smooth' });
    });
    /* Fuera de .container: hermanas bajo .header-nav (cortina ancha), posicionadas con CSS. */
    bar.insertBefore(p, cont);
    cont.insertAdjacentElement('afterend', nxt);
  }

  function getMainNavTabMeta(nav) {
    var orig = Array.prototype.slice.call(nav.querySelectorAll(':scope > a:not(.' + CLONE + ')'));
    if (orig.length < 2) return null;
    var A0 = orig[0].offsetLeft;
    return {
      A: A0,
      rel: orig.map(function (a) {
        return a.offsetLeft - A0;
      })
    };
  }

  /* Cruces reales (borde izquierdo de cada pestaña), no fijo 58px — una nota por pestaña cruzada. */
  function countTabBoundaryCrossings(s0, s1, A, rel, sw) {
    if (!sw || s0 === s1 || !rel || rel.length < 2) return 0;
    var lo = Math.min(s0, s1);
    var hi = Math.max(s0, s1);
    if (hi - lo < 0.1) return 0;
    var c = 0;
    var pMin = Math.floor((lo - A) / sw) - 1;
    var pMax = Math.floor((hi - A) / sw) + 1;
    for (var p = pMin; p <= pMax; p++) {
      for (var j = 1; j < rel.length; j++) {
        var B = A + p * sw + rel[j];
        if (B > lo && B <= hi) c += 1;
      }
    }
    return c;
  }

  function initScrollSoundAcc(nav) {
    if (nav._mdjMainNavTickScroll) {
      nav.removeEventListener('scroll', nav._mdjMainNavTickScroll, { passive: true });
    }
    var lastS = -1;
    function onS() {
      if (nav.getAttribute(MOUNTED) !== '1') return;
      var s = nav.scrollLeft;
      var sw = nav._mdjInfSetWidth;
      if (lastS < 0) {
        lastS = s;
        return;
      }
      if (!sw || sw < 8) {
        lastS = s;
        return;
      }
      var d = s - lastS;
      /* Salto de carrusel infinito: ~±sw, sin ráfaga de n−1 chasquidos. */
      if (d !== 0 && Math.abs(Math.abs(d) - sw) < 28) {
        lastS = s;
        return;
      }
      var meta = getMainNavTabMeta(nav);
      if (!meta) {
        lastS = s;
        return;
      }
      var c = countTabBoundaryCrossings(lastS, s, meta.A, meta.rel, +sw);
      if (c > 0) {
        var m = Math.min(c, 16);
        if (m === 1) {
          playTickIfReady();
        } else {
          for (var k = 0; k < m; k++) {
            (function (i) {
              setTimeout(function () {
                playTickIfReady();
              }, Math.round(i * 8.5));
            })(k);
          }
        }
      }
      lastS = s;
    }
    nav._mdjMainNavTickScroll = onS;
    nav.addEventListener('scroll', onS, { passive: true });
  }

  function startDriftIfAllowed(nav) {
    if (!nav || prefersReducedMotion() || !nav.getAttribute || nav.getAttribute(MOUNTED) !== '1') return;
    stopDrift(nav);
    var speed = 0.32;
    var navRef = nav;

    function step() {
      if (!navRef.getAttribute || navRef.getAttribute(MOUNTED) !== '1') return;
      navRef._mdjDriftRaf = requestAnimationFrame(step);
      var sw = navRef._mdjInfSetWidth;
      if (sw) navRef.scrollLeft += speed;
    }
    nav._mdjDriftRaf = requestAnimationFrame(step);
  }

  function initScrollJump(nav) {
    var buf = 10;
    var jumping = false;
    function onScroll() {
      if (jumping) return;
      var sw = nav._mdjInfSetWidth;
      if (!sw) return;
      var max = nav.scrollWidth - nav.clientWidth;
      if (max <= 0) return;
      if (nav.scrollLeft <= buf) {
        jumping = true;
        nav.scrollLeft += sw;
        requestAnimationFrame(function () {
          jumping = false;
        });
      } else if (nav.scrollLeft >= max - buf) {
        jumping = true;
        nav.scrollLeft -= sw;
        requestAnimationFrame(function () {
          jumping = false;
        });
      }
    }
    nav._mdjInfScroll = onScroll;
    nav.addEventListener('scroll', onScroll, { passive: true });
  }

  function initDragClickGuard(track) {
    if (!track) return;
    if (track._mdjRemoveDragGuard) {
      try {
        track._mdjRemoveDragGuard();
      } catch (e) { /* ignore */ }
      track._mdjRemoveDragGuard = null;
    }
    var down = false;
    var moved = false;
    var ox = 0;
    var oy = 0;
    var MOVE = 5;
    var onDown = function (e) {
      if (e.button != null && e.button !== 0) return;
      down = true;
      moved = false;
      ox = e.clientX;
      oy = e.clientY;
    };
    var onMove = function (e) {
      if (!down) return;
      if (Math.abs(e.clientX - ox) >= MOVE || Math.abs(e.clientY - oy) >= MOVE) {
        moved = true;
      }
    };
    var onScroll = function () {
      if (down) moved = true;
    };
    var end = function () {
      down = false;
    };
    var onClick = function (e) {
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      moved = false;
    };
    var passive = { passive: true };
    track.addEventListener('pointerdown', onDown, true);
    track.addEventListener('pointermove', onMove, passive);
    track.addEventListener('scroll', onScroll, passive);
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('click', onClick, true);
    track._mdjRemoveDragGuard = function () {
      track.removeEventListener('pointerdown', onDown, true);
      track.removeEventListener('pointermove', onMove, passive);
      track.removeEventListener('scroll', onScroll, passive);
      track.removeEventListener('pointerup', end);
      track.removeEventListener('pointercancel', end);
      track.removeEventListener('click', onClick, true);
    };
  }

  function initResize(nav) {
    var t;
    var fn = function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (typeof window.mdjReinitMainNavInfinite === 'function') {
          window.mdjReinitMainNavInfinite();
        }
      }, 100);
    };
    nav._mdjInfResize = fn;
    window.addEventListener('resize', fn, { passive: true });
  }

  function mountIfOverflow(nav) {
    teardownNav(nav);
    if (!isDesktop()) return;
    var originals = Array.prototype.slice.call(nav.querySelectorAll(':scope > a:not(.' + CLONE + ')'));
    if (originals.length < 2) return;
    /*
     * Home: con viewport ancho el menú cabía en una línea → sin overflow → sin clones ni chevrones ni trinquete.
     * Forzamos un tope de ancho solo en page-home para recuperar el carrusel sin quitar columnas del menú.
     */
    if (nav.scrollWidth <= nav.clientWidth + 1) {
      var isHome =
        typeof document !== 'undefined' &&
        document.body &&
        document.body.classList &&
        document.body.classList.contains('page-home');
      if (isHome) {
        var cap = Math.max(400, Math.min(Math.floor(window.innerWidth * 0.38), 760));
        nav.dataset.mdjMainnavForceW = '1';
        nav.style.maxWidth = cap + 'px';
        try {
          void nav.offsetWidth;
        } catch (eOf) { /* ignore */ }
      }
      if (nav.scrollWidth <= nav.clientWidth + 1) {
        return;
      }
    }

    var frBefore = document.createDocumentFragment();
    originals.forEach(function (el) {
      frBefore.appendChild(cloneOne(el));
    });
    nav.insertBefore(frBefore, nav.firstChild);
    originals.forEach(function (el) {
      nav.appendChild(cloneOne(el));
    });

    nav.setAttribute(MOUNTED, '1');
    nav.classList.add(CLS_ON);
    mountChevrons(nav);
    initScrollSoundAcc(nav);
    initScrollJump(nav);
    initResize(nav);
    initDragClickGuard(nav);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        applyStripWidth(nav);
        startDriftIfAllowed(nav);
      });
    });
  }

  window.mdjReinitMainNavInfinite = function () {
    var nav = getNav();
    if (!nav) {
      return;
    }
    teardownNav(nav);
    if (!isDesktop()) return;
    if (getComputedStyle(nav).display === 'none') return;
    requestAnimationFrame(function () {
      var n2 = getNav();
      if (n2) {
        setTimeout(function () {
          if (n2) mountIfOverflow(n2);
        }, 0);
      }
    });
  };

  function boot() {
    if (getNav()) {
      document.addEventListener('languageChanged', function () {
        if (typeof window.mdjReinitMainNavInfinite === 'function') {
          window.mdjReinitMainNavInfinite();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot();
      if (window.mdjReinitMainNavInfinite) window.mdjReinitMainNavInfinite();
    });
  } else {
    boot();
    if (window.mdjReinitMainNavInfinite) window.mdjReinitMainNavInfinite();
  }
})();
