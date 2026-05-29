/**
 * Artist nav context for Jobs / Shop / DJ Tools (?mdj_nav=profile).
 * Architecture is SEALED — see repo `.cursorrules` → "Artist nav context — satellite pages".
 * Do not remove script includes from jobs / shop / dj-tools or duplicate #mainHeader .header-nav.
 *
 * Cuando la URL lleva ?mdj_nav=profile (enlaces desde dj-profile / dashboard artista),
 * se muestra la barra tipo "perfil" (#owner-tabs) y se oculta la fila #mainNav.
 * Home en esa barra va a index sin parámetro (vuelve al modo sitio público).
 * Sin parámetro: comportamiento normal (barra Home/Services del index).
 */
(function () {
    'use strict';

    var PARAM = 'mdj_nav';
    var VALUE = 'profile';

    function hasProfileNavContext() {
        try {
            /* account-settings.html siempre activa el strip artístico —
               es el hub del owner/artista independiente del param ?mdj_nav */
            var _page = (window.location.pathname.split('/').pop() || '').toLowerCase();
            if (_page === 'account-settings.html') return true;
            return new URLSearchParams(window.location.search || '').get(PARAM) === VALUE;
        } catch (e) {
            return false;
        }
    }

    function withProfileNav(relPath) {
        try {
            var u = new URL(relPath, window.location.href);
            u.searchParams.set(PARAM, VALUE);
            var file = u.pathname.replace(/^.*\//, '') || '';
            return './' + file + u.search + (u.hash || '');
        } catch (e2) {
            var sep = relPath.indexOf('?') >= 0 ? '&' : '?';
            return relPath + sep + PARAM + '=' + VALUE;
        }
    }

    function pageTabKey() {
        var path = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if (path === 'jobs.html') return 'jobs';
        if (path === 'shop.html') return 'shop';
        if (path === 'dj-tools.html') return 'tools';
        if (path === 'account-settings.html') return 'config';
        return '';
    }

    function patchAnchorsForContext() {
        var sel = [
            '#header-cart-link[href*="shop.html"]',
            '#mobileMenu a[href="./shop.html"]',
            '#mobileMenu a[href="./jobs.html"]',
            '#mobileMenu a[href="./dj-tools.html"]'
        ].join(',');
        try {
            document.querySelectorAll(sel).forEach(function (a) {
                var href = a.getAttribute('href');
                if (!href || href.indexOf(PARAM + '=') !== -1) return;
                a.setAttribute('href', withProfileNav(href));
            });
        } catch (e) { /* noop */ }
    }

    function injectOwnerStrip(uid) {
        if (document.getElementById('owner-tabs')) return;
        var header = document.getElementById('mainHeader');
        if (!header) return;

        var tab = pageTabKey();

        function active(key) {
            return key === tab ? ' active' : '';
        }

        var hrefProfile = uid
            ? './dj-profile.html?id=' + encodeURIComponent(uid) + '&' + PARAM + '=' + VALUE
            : './dj-profile.html?' + PARAM + '=' + VALUE;
        var hrefFlow = withProfileNav('./dj-dashboard.html?tab=flow');
        var hrefSft = uid
            ? './dj-profile.html?id=' + encodeURIComponent(uid) + '&tab=sft&' + PARAM + '=' + VALUE
            : './dj-profile.html?tab=sft&' + PARAM + '=' + VALUE;

        var nav = document.createElement('nav');
        nav.className = 'dj-owner-tabs';
        nav.id = 'owner-tabs';
        nav.setAttribute('aria-label', 'Artist navigation');
        nav.innerHTML =
            '<div class="container">' +
            '<a href="./index.html" class="dj-tab-btn dj-tab-btn--home" data-i18n="nav-home">Home</a>' +
            '<a href="' + withProfileNav('./jobs.html') + '" class="dj-tab-btn' + active('jobs') + '" data-i18n="nav-jobs">Jobs</a>' +
            '<a href="' + withProfileNav('./shop.html') + '" class="dj-tab-btn' + active('shop') + '" data-i18n="nav-shop">Shop</a>' +
            '<a href="' + withProfileNav('./dj-dashboard.html') + '" class="dj-tab-btn" data-i18n="dash-your-profile">Agenda</a>' +
            '<a href="' + withProfileNav('./account-settings.html') + '" class="dj-tab-btn' + active('config') + '" data-i18n="nav-settings">⚙️ CONFIG</a>' +
            '<a href="' + withProfileNav('./academia.html') + '" class="dj-tab-btn" data-i18n="nav-academia">Academia</a>' +
            '<a href="' + withProfileNav('./dj-tools.html') + '" class="dj-tab-btn' + active('tools') + '" data-i18n="nav-tools">DJ Tools</a>' +
            '<a href="' + hrefFlow + '" class="dj-tab-btn" data-i18n="flow-dash">CASH FLOW</a>' +
            '<a href="' + hrefProfile + '" class="dj-tab-btn" data-i18n="menu-account">Mi Perfil</a>' +
            '<a href="' + hrefSft + '" class="dj-tab-btn" data-i18n="nav-soundfortips">SoundForTips™</a>' +
            '</div>';

        header.insertAdjacentElement('afterend', nav);

        try {
            if (typeof window.mdjOwnerTabsMarqueeRefresh === 'function') {
                window.mdjOwnerTabsMarqueeRefresh();
                setTimeout(function () {
                    try {
                        window.mdjOwnerTabsMarqueeRefresh();
                    } catch (e2) { /* noop */ }
                }, 0);
            }
        } catch (e) { /* noop */ }

        if (window.i18n && typeof window.i18n.updateUI === 'function') {
            try {
                window.i18n.updateUI();
            } catch (e) { /* noop */ }
        }
    }

    function hideSiteMainNavRow() {
        try {
            var hb = document.querySelector('#mainHeader .header-nav');
            if (hb) hb.style.setProperty('display', 'none', 'important');
        } catch (e) { /* noop */ }
    }

    function isEventsPublicHomePage() {
        var path = (window.location.pathname.split('/').pop() || '').toLowerCase();
        return path === 'events.html';
    }

    function run() {
        /* Events vive en menú home (#mainNav); no inyectar #owner-tabs aunque venga ?mdj_nav=profile. */
        if (isEventsPublicHomePage()) return;
        if (!hasProfileNavContext()) return;

        document.body.classList.add('mdj-from-profile');
        /* Evita doble barra si styles.css va en caché antigua sin reglas .mdj-from-profile */
        hideSiteMainNavRow();
        patchAnchorsForContext();

        var uid = null;
        function finish() {
            injectOwnerStrip(uid);
        }

        var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
        if (!sb) {
            finish();
            return;
        }

        sb.auth.getSession()
            .then(function (res) {
                var s = res && res.data && res.data.session;
                uid = s && s.user ? s.user.id : null;
            })
            .catch(function () { uid = null; })
            .finally(finish);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
