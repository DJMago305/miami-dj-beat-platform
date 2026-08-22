/**
 * Microfix B: owner-strip / local nav → dj-profile.html with ?id= when session uid is known.
 * Uses window.__mdjNavOwnUserId (mdjb-shared-header.js). Does not change header geometry.
 */
(function () {
    'use strict';

    function ownerProfileHref(href) {
        var uid = String(window.__mdjNavOwnUserId || '').trim();
        if (!uid) return null;
        var raw = String(href || '').trim();
        if (!raw || raw.indexOf('dj-profile.html') === -1) return null;
        if (/[?&]id=/.test(raw)) return null;

        var u;
        try {
            u = new URL(raw, window.location.href);
        } catch (e) {
            return './dj-profile.html?id=' + encodeURIComponent(uid);
        }
        u.searchParams.set('id', uid);
        var file = u.pathname.replace(/^.*\//, '') || 'dj-profile.html';
        return './' + file + u.search + (u.hash || '');
    }

    function patchOwnerProfileLinks() {
        var sel =
            '#owner-tabs a[href*="dj-profile.html"],' +
            '#mainNav-artist-dashboard-link[href*="dj-profile.html"]';
        try {
            document.querySelectorAll(sel).forEach(function (a) {
                var next = ownerProfileHref(a.getAttribute('href'));
                if (next) a.setAttribute('href', next);
            });
        } catch (e) {
            void e;
        }
    }

    function run() {
        patchOwnerProfileLinks();
        if (window.__mdjNavOwnUserId) return;
        var n = 0;
        var timer = setInterval(function () {
            n += 1;
            if (window.__mdjNavOwnUserId || n >= 45) {
                clearInterval(timer);
                patchOwnerProfileLinks();
            }
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
