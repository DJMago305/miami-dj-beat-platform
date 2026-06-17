/**
 * mdj-cart-pill.js  v20260616-pill-5
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight universal cart badge for every page EXCEPT rentals.html.
 *
 * What it does:
 *   1. Creates a minimal #mdj-event-builder-root stub so mdj-shared-header.js
 *      skips loading the full event-builder scripts on this page.
 *   2. Injects a 🛒 pill button into .header-avatar-cart-row (next to the
 *      shop cart link, just like the full builder does).
 *   3. Reads the cart draft from localStorage and shows the item count + gold
 *      color when the cart has items.
 *   4. On click → navigates to ./rentals.html?cart=open so the full drawer
 *      opens there.
 *   5. Listens to storage events so the badge updates instantly when items
 *      are added/removed from another tab.
 *
 * DO NOT load this script on rentals.html — that page uses the full builder.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function (global) {
    'use strict';

    /* ── 0. Guard: don't run on rentals page ─────────────────────────────── */
    var pagePath = global.location && global.location.pathname || '';
    var pageLeaf = pagePath.split('/').pop().replace(/\.html?$/i, '').toLowerCase();
    /* Don't run on pages that have the full event builder inline */
    if (pageLeaf === 'rentals' || pageLeaf === 'services') { return; }

    /* ── 1. Inject a stub root so shared-header skips the heavy chain ──────
       mdj-shared-header.js checks:
         if (document.getElementById('mdj-event-builder-root')) return;
       Placing this stub before that check runs prevents loading ~150 KB of
       unused event-builder scripts on non-cart pages.
    ────────────────────────────────────────────────────────────────────────── */
    function injectStubRoot() {
        if (document.getElementById('mdj-event-builder-root')) { return; }
        var stub = document.createElement('div');
        stub.id = 'mdj-event-builder-root';
        stub.setAttribute('data-mdj-eb-pill-stub', '1');
        stub.setAttribute('hidden', '');
        stub.style.cssText = 'display:none!important;';
        document.body.appendChild(stub);
    }

    /* ── 2. Read cart count from localStorage ───────────────────────────── */
    var DRAFT_KEY_ANON = 'mdj:event-builder:draft:v1:anon';

    function readCartCount() {
        try {
            /* Try anon key first; also scan for any user-specific key */
            var keys = [];
            keys.push(DRAFT_KEY_ANON);
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && k.indexOf('mdj:event-builder:draft:v1:') === 0 && k !== DRAFT_KEY_ANON) {
                        keys.push(k);
                    }
                }
            } catch (eK) { void eK; }

            var bestCount = 0;
            for (var j = 0; j < keys.length; j++) {
                var raw = localStorage.getItem(keys[j]);
                if (!raw) { continue; }
                var draft = JSON.parse(raw);
                var lines = Array.isArray(draft && draft.lines) ? draft.lines : [];
                var qty = lines.reduce(function (sum, l) {
                    var n = parseInt(l.qty, 10);
                    return sum + (n > 0 ? n : 0);
                }, 0);
                if (qty > bestCount) { bestCount = qty; }
            }
            return bestCount;
        } catch (e) {
            return 0;
        }
    }

    /* ── 3. Install pill on the cart button (create or take over existing) ─ */
    var PILL_ID = 'mdj-eb-header-cart-open';
    var COUNT_ID = 'mdj-eb-header-count';

    /* Gold inline styles applied to ANY button — overrides inherited page color */
    var GOLD_STYLES = [
        'color:rgba(212,175,55,0.95)',
        'border:1px solid rgba(197,160,89,0.42)',
        'background:rgba(255,255,255,0.08)',
        'border-radius:50%',
        'width:44px',
        'height:44px',
        'display:inline-flex',
        'align-items:center',
        'justify-content:center',
        'font-size:20px',
        'cursor:pointer',
        'position:relative',
        'flex-shrink:0'
    ].join(';');

    function applyGoldAndRedirect(btn) {
        /* Force gold color regardless of page CSS */
        btn.style.cssText = GOLD_STYLES;
        /* Replace ALL existing click handlers with our redirect */
        var fresh = btn.cloneNode(true);
        btn.parentNode.replaceChild(fresh, btn);
        fresh.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            global.location.href = './rentals.html?cart=open';
        });
        return fresh;
    }

    function injectPillButton() {
        var existing = document.getElementById(PILL_ID);
        if (existing) {
            /* shared-header already created the button — take it over */
            applyGoldAndRedirect(existing);
            return;
        }

        var mainHeader = document.getElementById('mainHeader');
        if (!mainHeader) { return; }

        var row = mainHeader.querySelector('.header-avatar-cart-row');
        var mountParent = row || mainHeader.querySelector('.header-actions') || mainHeader;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = PILL_ID;
        btn.className = 'header-cart-btn mdj-eb-header-cart-open';
        btn.title = 'Event cart';
        btn.setAttribute('aria-label', 'Open event cart');
        btn.style.cssText = GOLD_STYLES;
        btn.innerHTML =
            '<span aria-hidden="true">🛒</span>' +
            '<span id="' + COUNT_ID + '" class="header-cart-count" hidden></span>';

        var shopLink = document.getElementById('header-cart-link');
        if (row && shopLink && shopLink.parentNode === row) {
            var next = shopLink.nextSibling;
            if (next) { row.insertBefore(btn, next); } else { row.appendChild(btn); }
        } else {
            mountParent.appendChild(btn);
        }

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            global.location.href = './rentals.html?cart=open';
        });
    }

    /* ── 4. Update badge (count + gold glow) ───────────────────────────── */
    function updateBadge() {
        var count = readCartCount();
        var btn = document.getElementById(PILL_ID);
        if (!btn) { return; }

        /* Find or create the count span inside the button */
        var countEl = btn.querySelector('#' + COUNT_ID) || document.getElementById(COUNT_ID);
        if (!countEl) {
            countEl = document.createElement('span');
            countEl.id = COUNT_ID;
            countEl.className = 'header-cart-count';
            countEl.setAttribute('hidden', '');
            btn.appendChild(countEl);
        }
        /* Gold badge — always, regardless of page CSS */
        countEl.style.cssText = 'background:#c5a059;color:#0a0a0a;position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;font-size:11px;font-weight:800;line-height:18px;text-align:center;';

        if (count > 0) {
            countEl.textContent = count;
            countEl.removeAttribute('hidden');
            btn.classList.add('has-items');
            btn.style.borderColor = 'rgba(197,160,89,0.85)';
            btn.style.color = 'rgba(212,175,55,1)';
        } else {
            countEl.textContent = '';
            countEl.setAttribute('hidden', '');
            btn.classList.remove('has-items');
            btn.style.borderColor = 'rgba(197,160,89,0.42)';
            btn.style.color = 'rgba(212,175,55,0.95)';
        }
    }

    /* ── 5. Boot ─────────────────────────────────────────────────────────── */
    function run() {
        injectStubRoot();
        injectPillButton();
        updateBadge();

        /* Refresh badge whenever storage changes (other tabs or same-page writes) */
        global.addEventListener('storage', function (ev) {
            if (ev && ev.key && ev.key.indexOf('mdj:event-builder:draft:v1:') === 0) {
                updateBadge();
            }
        });

        /* Also refresh on page focus (user returns from rentals.html after commit) */
        global.addEventListener('focus', updateBadge);
        global.addEventListener('pageshow', updateBadge);

        /* Periodic refresh as fallback */
        setInterval(updateBadge, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }

}(window));
