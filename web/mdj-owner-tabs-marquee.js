/**
 * Franja #owner-tabs: siempre estática (sin marquee).
 * Al cargar, desmonta cualquier marquee antigua en caché y deja scroll horizontal nativo en styles.css.
 */
(function () {
    'use strict';

    var SEL_NAV = '#owner-tabs';
    var CL_NAV = 'dj-owner-tabs--marquee';
    var CLS_VIEW = 'mdj-owner-tabs-marquee-viewport';
    var CLS_TRACK = 'mdj-owner-tabs-marquee-track';
    var CLS_CLONE = 'mdj-owner-tabs-marquee-track--clone';

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

    function sync() {
        var nav = document.querySelector(SEL_NAV);
        if (!nav) return;
        var container = nav.querySelector(':scope > .container');
        if (!container) return;
        if (container.dataset.mdjOwnerMarquee === '1') {
            destroyMarquee(container, nav);
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
