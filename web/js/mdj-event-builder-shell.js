/**
 * mdj-event-builder-shell.js
 * Universal Event Builder drawer injector.
 * Loads the CRM drawer CSS and HTML on any page that includes this script.
 * Safe to run multiple times — idempotent (checks before injecting).
 *
 * Requires (loaded separately by each page):
 *   mdj-event-builder-adapter.js
 *   mdj-event-builder.js
 *   mdj-event-builder-rentals-bridge.js  (for catalog pages)
 */
(function (global) {
    'use strict';

    var SHELL_VERSION = '20260616-crm-4';
    var CSS_HREF = (function () {
        try {
            var src = document.currentScript && document.currentScript.src;
            if (src) {
                return src.replace(/\/js\/[^/?#]+.*$/, '/css/mdj-event-builder.css?v=' + SHELL_VERSION);
            }
        } catch (e) { void e; }
        return './css/mdj-event-builder.css?v=' + SHELL_VERSION;
    }());

    // ── 1. Inject CSS link into <head> (once) ──────────────────────────────
    function injectCss() {
        if (document.querySelector('link[data-mdj-eb-shell-css]')) { return; }
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = CSS_HREF;
        link.setAttribute('data-mdj-eb-shell-css', SHELL_VERSION);
        document.head.appendChild(link);
    }

    // ── 2. Drawer HTML template ────────────────────────────────────────────
    var DRAWER_HTML = [
        '<div id="mdj-event-builder-root" data-mdj-eb-version="' + SHELL_VERSION + '" hidden aria-hidden="true">',
        '  <button type="button" id="mdj-eb-fab" class="mdj-eb-fab" aria-label="Open event cart">',
        '    <span class="mdj-eb-fab__label">My Cart</span>',
        '    <span id="mdj-eb-fab-count" class="mdj-eb-fab__count" hidden>0</span>',
        '  </button>',
        '  <div class="mdj-eb-overlay" id="mdj-eb-overlay" hidden></div>',
        '  <aside id="mdj-eb-drawer" class="mdj-eb-drawer mdj-eb-panel" role="dialog" aria-labelledby="mdj-eb-title" hidden>',
        '    <nav class="mdj-eb-cart-topbar" aria-label="Navegación del sitio (vista carrito)">',
        '      <a href="./index.html" data-mdj-nav="home" data-i18n="nav-home">Home</a>',
        '      <a href="./rentals.html" data-mdj-nav="services" data-i18n="nav-services">Services</a>',
        '      <a href="./events.html" data-mdj-nav="venues" data-i18n="nav-rentals">Events</a>',
        '      <a href="./shop.html" data-mdj-nav="shop" data-i18n="nav-shop">Shop</a>',
        '      <a href="./jobs.html" data-mdj-nav="jobs" data-i18n="nav-jobs">Jobs</a>',
        '      <a href="./contact.html" data-mdj-nav="contact" data-i18n="nav-contact">Contact</a>',
        '      <a href="./client-account.html" data-mdj-nav="client-config" data-i18n="nav-client-settings">⚙️CONFIG</a>',
        '      <a href="./client-portal.html" data-mdj-nav="mi-portal" data-i18n="header-mi-portal">MY PORTAL</a>',
        '    </nav>',
        '    <header class="mdj-eb-drawer__head">',
        '      <div class="mdj-eb-drawer__head-main">',
        '        <h2 id="mdj-eb-title">Event Cart <span id="mdj-eb-order-num" class="mdj-eb-order-num"></span></h2>',
        '        <div class="mdj-eb-context-bar" role="group" aria-label="Fecha y evento">',
        '          <label class="mdj-eb-context-bar__field">',
        '            <span class="mdj-eb-context-bar__hint" data-i18n="eb-opt-dia">D\u00eda</span>',
        '            <select class="mdj-eb-context-bar__select mdj-eb-context-bar__select--day" aria-label="D\u00eda" autocomplete="off">',
        '              <option value="" selected disabled>D\u00eda</option>',
        (function () {
            var opts = [];
            for (var d = 1; d <= 31; d++) { opts.push('              <option value="' + d + '">' + d + '</option>'); }
            return opts.join('\n');
        }()),
        '            </select>',
        '          </label>',
        '          <label class="mdj-eb-context-bar__field">',
        '            <span class="mdj-eb-context-bar__hint">Mes</span>',
        '            <select class="mdj-eb-context-bar__select mdj-eb-context-bar__select--month" aria-label="Mes" autocomplete="off">',
        '              <option value="" selected disabled>Mes</option>',
        '              <option value="1">1 \u2014 Ene</option>',
        '              <option value="2">2 \u2014 Feb</option>',
        '              <option value="3">3 \u2014 Mar</option>',
        '              <option value="4">4 \u2014 Abr</option>',
        '              <option value="5">5 \u2014 May</option>',
        '              <option value="6">6 \u2014 Jun</option>',
        '              <option value="7">7 \u2014 Jul</option>',
        '              <option value="8">8 \u2014 Ago</option>',
        '              <option value="9">9 \u2014 Sep</option>',
        '              <option value="10">10 \u2014 Oct</option>',
        '              <option value="11">11 \u2014 Nov</option>',
        '              <option value="12">12 \u2014 Dic</option>',
        '            </select>',
        '          </label>',
        '          <label class="mdj-eb-context-bar__field">',
        '            <span class="mdj-eb-context-bar__hint" data-i18n="eb-opt-anio">A\u00f1o</span>',
        '            <select class="mdj-eb-context-bar__select mdj-eb-context-bar__select--year" aria-label="A\u00f1o" autocomplete="off">',
        '              <option value="" selected disabled>A\u00f1o</option>',
        '              <option value="2025">2025</option>',
        '              <option value="2026">2026</option>',
        '              <option value="2027">2027</option>',
        '              <option value="2028">2028</option>',
        '            </select>',
        '          </label>',
        '          <label class="mdj-eb-context-bar__field mdj-eb-context-bar__field--assign">',
        '            <span class="mdj-eb-context-bar__hint">Asignar a evento</span>',
        '            <select class="mdj-eb-context-bar__select mdj-eb-context-bar__select--assign" aria-label="Asignar a evento" autocomplete="off">',
        '              <option value="" selected disabled>Asignar</option>',
        '            </select>',
        '          </label>',
        '        </div>',
        '      </div>',
        '      <div class="mdj-eb-head-actions">',
        '        <button type="button" id="mdj-eb-cta" class="mdj-eb-cta">ADD TO MY EVENT</button>',
        '        <button type="button" id="mdj-eb-close" class="mdj-eb-close" aria-label="Close">&times;</button>',
        '      </div>',
        '    </header>',
        '    <div class="mdj-eb-panel__body">',
        '      <div class="mdj-eb-panel__main">',
        '        <div id="mdj-eb-lines" class="mdj-eb-lines"></div>',
        '      </div>',
        '    </div>',
        '    <span id="mdj-eb-subtotal" hidden>$0.00</span>',
        '    <span id="mdj-eb-tax" hidden>$0.00</span>',
        '    <span id="mdj-eb-total" hidden>$0.00</span>',
        '  </aside>',
        '  <div id="mdj-eb-toast" class="mdj-eb-toast" hidden role="status"></div>',
        '</div>'
    ].join('\n');

    // ── 3. Inject / upgrade drawer HTML ────────────────────────────────────
    function injectDrawer() {
        var existing = document.getElementById('mdj-event-builder-root');
        if (existing) {
            // Already new version — skip
            if (existing.getAttribute('data-mdj-eb-version') === SHELL_VERSION) { return; }
            // Old version present — replace with new CRM drawer
            var tmp = document.createElement('div');
            tmp.innerHTML = DRAWER_HTML;
            var newRoot = tmp.firstElementChild;
            existing.parentNode.replaceChild(newRoot, existing);
            return;
        }
        // Not present — inject at end of body
        document.body.insertAdjacentHTML('beforeend', DRAWER_HTML);
    }

    // ── 4. Run ─────────────────────────────────────────────────────────────
    function run() {
        injectCss();
        injectDrawer();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }

}(window));
