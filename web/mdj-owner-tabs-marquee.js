/**
 * Artist owner strip (#owner-tabs): full-bleed is handled in styles.css (max-width on .dj-owner-tabs .container).
 * When tabs still overflow, optional seamless marquee (Jobs-style), paused on hover so items stay clickable.
 */
(function () {
    'use strict';

    var SEL_NAV = '#owner-tabs';
    var CL_NAV = 'dj-owner-tabs--marquee';
    var CLS_VIEW = 'mdj-owner-tabs-marquee-viewport';
    var CLS_ANIM = 'mdj-owner-tabs-marquee-anim';
    var CLS_TRACK = 'mdj-owner-tabs-marquee-track';
    var CLS_CLONE = 'mdj-owner-tabs-marquee-track--clone';

    function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function applyTrackGap(track, computedContainer) {
        var g = computedContainer.columnGap;
        if (!g || g === 'normal' || g === '0px') g = computedContainer.gap;
        if (!g || g === 'normal') g = '0px';
        track.style.gap = g;
        track.style.columnGap = g;
    }

    function wireClone(trackA, trackB) {
        var n = Math.min(trackA.children.length, trackB.children.length);
        for (var i = 0; i < n; i++) {
            (function (a, b) {
                b.setAttribute('aria-hidden', 'true');
                b.querySelectorAll('a, button').forEach(function (el) {
                    el.tabIndex = -1;
                });
                b.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (a && typeof a.click === 'function') a.click();
                });
            })(trackA.children[i], trackB.children[i]);
        }
    }

    function destroyMarquee(container, nav) {
        var vp = container.querySelector('.' + CLS_VIEW);
        if (!vp) return;
        var trackA = vp.querySelector('.' + CLS_TRACK + ':not(.' + CLS_CLONE + ')');
        if (!trackA) {
            vp.remove();
            nav.classList.remove(CL_NAV);
            delete container.dataset.mdjOwnerMarquee;
            return;
        }
        while (trackA.firstChild) {
            container.appendChild(trackA.firstChild);
        }
        vp.remove();
        nav.classList.remove(CL_NAV);
        delete container.dataset.mdjOwnerMarquee;
    }

    function buildMarquee(container, nav) {
        if (container.querySelector('.' + CLS_VIEW)) return;
        var els = [].slice.call(container.children);
        if (!els.length) return;

        var csGap = window.getComputedStyle(container);

        var vp = document.createElement('div');
        vp.className = CLS_VIEW;
        var anim = document.createElement('div');
        anim.className = CLS_ANIM;
        anim.setAttribute('role', 'presentation');
        var trackA = document.createElement('div');
        trackA.className = CLS_TRACK;
        els.forEach(function (el) {
            trackA.appendChild(el);
        });
        applyTrackGap(trackA, csGap);

        var trackB = trackA.cloneNode(true);
        trackB.classList.add(CLS_CLONE);
        trackB.setAttribute('aria-hidden', 'true');
        applyTrackGap(trackB, csGap);
        wireClone(trackA, trackB);

        anim.appendChild(trackA);
        anim.appendChild(trackB);
        vp.appendChild(anim);
        container.appendChild(vp);
        container.dataset.mdjOwnerMarquee = '1';
        nav.classList.add(CL_NAV);

        function setDur() {
            var w = trackA.getBoundingClientRect().width;
            var sec = Math.max(28, Math.min(120, w / 52));
            anim.style.setProperty('--mdj-owner-marquee-dur', sec + 's');
        }
        setDur();
        requestAnimationFrame(setDur);
    }

    /** Margen para subpíxeles / Safari+Retina (p. ej. Mac Studio): evita marquee falso y texto “montado”. */
    var OVERFLOW_PX = 20;

    function measureOverflowPx(container) {
        if (container.clientWidth < 48) return 0;
        var sw = Math.ceil(container.scrollWidth);
        var cw = Math.floor(container.getBoundingClientRect().width);
        return sw - cw;
    }

    function needsOverflow(container) {
        return measureOverflowPx(container) > OVERFLOW_PX;
    }

    function sync() {
        var nav = document.querySelector(SEL_NAV);
        if (!nav) return;
        var container = nav.querySelector(':scope > .container');
        if (!container) return;

        if (prefersReducedMotion()) {
            if (container.dataset.mdjOwnerMarquee === '1') destroyMarquee(container, nav);
            return;
        }

        if (container.dataset.mdjOwnerMarquee === '1') {
            var vp = container.querySelector('.' + CLS_VIEW);
            var trackA = vp && vp.querySelector('.' + CLS_TRACK + ':not(.' + CLS_CLONE + ')');
            var anim = vp && vp.querySelector('.' + CLS_ANIM);
            if (vp && trackA && anim) {
                var w = trackA.getBoundingClientRect().width;
                var vpW = Math.floor(vp.getBoundingClientRect().width);
                /* Cabe en una fila: tolerancia pequeña solo por subpíxeles (no usar OVERFLOW_PX). */
                if (Math.ceil(w) <= vpW + 4) {
                    destroyMarquee(container, nav);
                    if (needsOverflow(container)) buildMarquee(container, nav);
                    return;
                }
                var sec = Math.max(28, Math.min(120, w / 52));
                anim.style.setProperty('--mdj-owner-marquee-dur', sec + 's');
            }
            return;
        }

        if (needsOverflow(container)) {
            buildMarquee(container, nav);
        }
    }

    window.mdjOwnerTabsMarqueeRefresh = sync;

    function boot() {
        try {
            sync();
        } catch (e) { /* noop */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    window.addEventListener('load', boot);
    setTimeout(boot, 0);
    setTimeout(boot, 500);

    if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(function () {
            boot();
        });
        var attach = function () {
            var n = document.querySelector(SEL_NAV);
            if (n) ro.observe(n);
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attach);
        } else {
            attach();
        }
    }

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
            boot();
        });
    }
})();
