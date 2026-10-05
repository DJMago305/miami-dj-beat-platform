/* Panel del artista · CASH FLOW (vista).
 * Pinta #ap-cashflow dentro de la pestaña Cash Flow (#tab-flow) de dj-dashboard.html y dj-profile.html, con los números de artist-data.js:
 *   1) Ingresos acumulados (turnos de residencia + contratos y eventos),
 *   2) Cobrado / Disponible frente a Pendiente de liquidación,
 *   3) Propinas SoundForTips™ ($0 con aviso neutro si el artista no tiene SoundForTips activo).
 * NO reescribe flow-handler.js: lo ENVUELVE. Cada vez que flow-handler carga la pestaña (loadFlowData, mdjLoadFlowTab…), esta vista se refresca.
 * Todo el texto se pone con textContent (nunca innerHTML con datos). Compatible con Safari 13 (sin ??, sin ?.). */
(function () {
    'use strict';
    var AP = window.ArtistPanel = window.ArtistPanel || {};
    var HOST_SEL = '#tab-flow';
    var seq = 0;

    var T = {
        es: {
            title: 'Tus números', loading: 'Cargando tus números…', error: 'No pudimos cargar tus números ahora. Vuelve a intentarlo en un momento.',
            total: 'Ingresos acumulados', residency: 'Turnos de residencia', contracts: 'Contratos y eventos',
            cobrado: 'Cobrado / Disponible', pendiente: 'Pendiente de liquidación', pendienteHint: 'Se suma a tu disponible cuando se liquida el pago.',
            tips: 'Propinas SoundForTips™', tipsNone: 'Sin propinas registradas.', tipsPro: 'SoundForTips™ se activa con el plan PRO.',
            tipsCount1: 'propina aceptada', tipsCountN: 'propinas aceptadas', shifts1: 'turno', shiftsN: 'turnos'
        },
        en: {
            title: 'Your numbers', loading: 'Loading your numbers…', error: 'We could not load your numbers right now. Please try again in a moment.',
            total: 'Total earnings', residency: 'Residency shifts', contracts: 'Contracts and events',
            cobrado: 'Collected / Available', pendiente: 'Pending settlement', pendienteHint: 'Added to your available balance once the payment is settled.',
            tips: 'SoundForTips™ tips', tipsNone: 'No tips recorded.', tipsPro: 'SoundForTips™ is activated with the PRO plan.',
            tipsCount1: 'accepted tip', tipsCountN: 'accepted tips', shifts1: 'shift', shiftsN: 'shifts'
        }
    };
    function lang() { var l = String(document.documentElement.getAttribute('lang') || 'es').toLowerCase(); return l.indexOf('en') === 0 ? 'en' : 'es'; }
    function t(k) { return T[lang()][k]; }
    function money(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    function css() {
        if (document.getElementById('ap-cashflow-style')) return;
        var s = document.createElement('style'); s.id = 'ap-cashflow-style';
        s.textContent =
            '#ap-cashflow{margin:0 0 28px;}' +
            '#ap-cashflow .ap-h{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.55);margin:0 0 12px;}' +
            '#ap-cashflow .ap-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;}' +
            '#ap-cashflow .ap-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:16px 18px;}' +
            '#ap-cashflow .ap-lab{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.5);}' +
            '#ap-cashflow .ap-val{font-size:30px;font-weight:900;line-height:1.15;margin-top:6px;color:#fff;}' +
            '#ap-cashflow .ap-val.ap-gold{color:#f0cc80;}#ap-cashflow .ap-val.ap-green{color:#00ff88;}#ap-cashflow .ap-val.ap-amber{color:#ffb454;}' +
            '#ap-cashflow .ap-sub{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:rgba(255,255,255,.62);margin-top:8px;}' +
            '#ap-cashflow .ap-sub b{color:rgba(255,255,255,.88);font-weight:700;}' +
            '#ap-cashflow .ap-note{font-size:12px;line-height:1.45;color:rgba(255,255,255,.5);margin-top:8px;}' +
            '#ap-cashflow .ap-split{display:grid;grid-template-columns:1fr 1fr;gap:12px;}' +
            /* Pestaña Cash Flow, solo mientras está activa (orden del PO): sin buscador, sin el logo (águila) y sin las letras de la marca en la cabecera. */
            'html.ap-flow-active .header-search-wrap,html.ap-flow-active .logo-img-eagle,html.ap-flow-active .mdj-flotante-letras,html.ap-flow-active #mdj-flotante-visitante .header-search-wrap,html.ap-flow-active #mdj-flotante-visitante .logo-img-eagle,html.ap-flow-active #mdj-flotante-visitante .mdj-flotante-letras{display:none !important;}' +   /* el id #mdj-flotante-visitante de header-unified.css pesa más: hay que repetirlo para ganarle */
            'html[data-theme="day"] #ap-cashflow .ap-card{background:#fff;border-color:rgba(0,0,0,.12);}' +
            'html[data-theme="day"] #ap-cashflow .ap-val,html[data-theme="day"] #ap-cashflow .ap-sub b{color:#111;}' +
            'html[data-theme="day"] #ap-cashflow .ap-h,html[data-theme="day"] #ap-cashflow .ap-lab,html[data-theme="day"] #ap-cashflow .ap-sub,html[data-theme="day"] #ap-cashflow .ap-note{color:rgba(0,0,0,.6);}';
        document.head.appendChild(s);
    }

    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function row(label, value) { var r = el('div', 'ap-sub'); r.appendChild(el('span', null, label)); r.appendChild(el('b', null, value)); return r; }

    function box() {
        var host = document.querySelector(HOST_SEL); if (!host) return null;
        var b = document.getElementById('ap-cashflow'); if (b) return b;
        css();
        b = document.createElement('div'); b.id = 'ap-cashflow';
        var h = host.querySelector('h1, h2'); var ctn = host.querySelector('.container, .flow-dashboard') || host;
        if (h && h.parentNode === ctn) { if (h.nextSibling) ctn.insertBefore(b, h.nextSibling); else ctn.appendChild(b); }
        else ctn.insertBefore(b, ctn.firstChild);
        return b;
    }

    function paint(b, node) { while (b.firstChild) b.removeChild(b.firstChild); b.appendChild(node); }
    function shell(inner) { var w = el('div'); w.appendChild(el('div', 'ap-h', t('title'))); w.appendChild(inner); return w; }

    function render(m) {
        var b = box(); if (!b) return;
        var grid = el('div', 'ap-grid');

        var c1 = el('div', 'ap-card'); c1.appendChild(el('div', 'ap-lab', t('total'))); c1.appendChild(el('div', 'ap-val', money(m.total)));
        c1.appendChild(row(t('residency') + (m.turnosResidencia ? ' · ' + m.turnosResidencia + ' ' + (m.turnosResidencia === 1 ? t('shifts1') : t('shiftsN')) : ''), money(m.residencia)));
        c1.appendChild(row(t('contracts'), money(m.contratos)));
        grid.appendChild(c1);

        var c2 = el('div', 'ap-card'); var sp = el('div', 'ap-split');
        var a = el('div'); a.appendChild(el('div', 'ap-lab', t('cobrado'))); a.appendChild(el('div', 'ap-val ap-green', money(m.disponible)));
        var p = el('div'); p.appendChild(el('div', 'ap-lab', t('pendiente'))); p.appendChild(el('div', 'ap-val ap-amber', money(m.pendiente)));
        sp.appendChild(a); sp.appendChild(p); c2.appendChild(sp); c2.appendChild(el('div', 'ap-note', t('pendienteHint')));
        grid.appendChild(c2);

        var c3 = el('div', 'ap-card'); c3.appendChild(el('div', 'ap-lab', t('tips'))); c3.appendChild(el('div', 'ap-val ap-gold', money(m.propinas)));
        if (m.propinas > 0) c3.appendChild(el('div', 'ap-note', m.propinasCount + ' ' + (m.propinasCount === 1 ? t('tipsCount1') : t('tipsCountN'))));
        else c3.appendChild(el('div', 'ap-note', t('tipsNone') + (m.isPro ? '' : ' ' + t('tipsPro'))));
        grid.appendChild(c3);

        paint(b, shell(grid));
    }

    function refresh() {
        var b = box(); if (!b) return Promise.resolve();
        var mine = ++seq;
        if (!b.firstChild) paint(b, shell(el('div', 'ap-note', t('loading'))));
        return AP.data.load().then(function (m) {
            if (mine !== seq) return;
            render(m);
            if (AP.kpis) AP.kpis.refresh(m);                                       /* tarjetas y gráfica semanal con datos reales */
            if (AP.reputation) AP.reputation.refresh();                            /* reseñas reales: tarjeta, estrellas del perfil y lista */
            if (AP.charts) {                                                       /* dona de origen del dinero + visitas en la gráfica de crecimiento */
                try { AP.charts.renderDonut(m); } catch (x1) { try { console.warn('[artist-panel] dona', x1 && x1.message); } catch (x2) { /* sin consola */ } }
                Promise.all([AP.data.loadVisits(800), AP.data.loadContribution(), AP.data.loadContributionDaily(800)]).then(function (r) {   /* series reales de la gráfica (solo lectura) */
                    if (mine === seq) { try { AP.charts.addSeries(r[0], r[1], r[2]); } catch (x3) { /* sin gráfica aún */ } }
                });
            }
        }, function (e) {
            if (mine !== seq) return;
            try { console.warn('[artist-panel] cashflow', e && e.message); } catch (x) { /* sin consola */ }
            paint(b, shell(el('div', 'ap-note', t('error'))));
        });
    }

    /* Envuelve (sin reescribir) las funciones probadas de flow-handler.js: tras cada carga de la pestaña, refresca esta vista. */
    function wrap(name) {
        var f = window[name]; if (typeof f !== 'function' || f.__apWrapped) return;
        var w = function () {
            var r = f.apply(this, arguments), go = function () { setTimeout(refresh, 0); };
            if (r && typeof r.then === 'function') r.then(go, go); else go();      /* espera a que flow-handler termine de dibujar y entonces actúa */
            return r;
        };
        w.__apWrapped = true; window[name] = w;
    }
    /* Marca <html> con .ap-flow-active mientras #tab-flow es la pestaña visible (y solo entonces), para que el CSS de arriba quite buscador y marca. */
    function syncChrome() {
        var h = document.querySelector(HOST_SEL);
        document.documentElement.classList.toggle('ap-flow-active', !!(h && h.classList.contains('active')));
    }
    function watchChrome() {
        var h = document.querySelector(HOST_SEL); if (!h) return;
        css(); syncChrome();
        if (window.MutationObserver) new MutationObserver(syncChrome).observe(h, { attributes: true, attributeFilter: ['class'] });
    }
    function mount() {
        ['loadFlowData', 'mdjLoadFlowTab', 'mdjFlowReloadIfAllowed'].forEach(wrap);
        watchChrome();
        var host = document.querySelector(HOST_SEL);
        if (host && (host.classList.contains('active') || host.offsetParent !== null)) refresh();
    }

    AP.cashflow = { mount: mount, render: render, refresh: refresh };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
