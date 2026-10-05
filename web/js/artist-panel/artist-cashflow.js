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
            '#ap-cashflow .ap-h{font-size:15px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fff;margin:0 0 12px;}' +   /* mismo estilo que el título «Salud Profesional» de #tab-flow: sin opacidad */
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
            'html[data-theme="day"] #ap-cashflow .ap-h{color:#1b1f27;}' +
            'html[data-theme="day"] #ap-cashflow .ap-lab,html[data-theme="day"] #ap-cashflow .ap-sub,html[data-theme="day"] #ap-cashflow .ap-note{color:rgba(0,0,0,.6);}';
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
            if (AP.movements) AP.movements.refresh();                              /* estado de cuenta de movimientos (al final del Cash Flow) */
            if (AP.charts) {                                                       /* dona de origen del dinero + visitas en la gráfica de crecimiento */
                try { AP.charts.renderDonut(m); } catch (x1) { try { console.warn('[artist-panel] dona', x1 && x1.message); } catch (x2) { /* sin consola */ } }
                tintCharts();
                Promise.all([AP.data.loadVisits(800), AP.data.loadContribution(), AP.data.loadContributionDaily(800)]).then(function (r) {   /* series reales de la gráfica (solo lectura) */
                    if (mine === seq) { try { AP.charts.addSeries(r[0], r[1], r[2]); } catch (x3) { /* sin gráfica aún */ } tintCharts(); }
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
        var on = !!(h && h.classList.contains('active'));
        document.documentElement.classList.toggle('ap-flow-active', on);
        /* Base común de día (css/mdj-dia-base.css): se activa con body[data-mdj-dia]; aquí solo mientras Cash Flow está visible, porque las
           otras pestañas de estas páginas aún no tienen día. Solo se quita si lo puso este módulo ('flow'). */
        if (document.body) {
            if (on) { if (!document.body.hasAttribute('data-mdj-dia')) document.body.setAttribute('data-mdj-dia', 'flow'); }
            else if (document.body.getAttribute('data-mdj-dia') === 'flow') document.body.removeAttribute('data-mdj-dia');
        }
    }
    function watchChrome() {
        var h = document.querySelector(HOST_SEL); if (!h) return;
        css(); syncChrome();
        if (window.MutationObserver) new MutationObserver(syncChrome).observe(h, { attributes: true, attributeFilter: ['class'] });
    }
    /* Modo día en las gráficas: Chart.js guarda los colores de texto, rejilla y leyenda dentro de cada gráfica (blanco translúcido,
       fijado al crearla en flow-handler.js y en este módulo), así que el CSS de día no los alcanza. Aquí se cambian en vivo solo las
       gráficas de #tab-flow: rgba(255,255,255,a) -> negro translúcido en día, y se restauran en noche. No se toca flow-handler.js
       (lo comparten otras páginas). */
    var TINT_PATHS = [['ticks', 'color'], ['grid', 'color'], ['title', 'color']];
    function tintColor(c, day) {
        var m = typeof c === 'string' && c.replace(/\s+/g, '').match(/^rgba\(255,255,255,([\d.]+)\)$/);
        if (m) { var a = +m[1]; return 'rgba(27,31,39,' + (a < 0.2 ? Math.max(a, 0.08) : Math.min(0.85, a + 0.1)) + ')'; }
        return /^#(fff|ffffff)$/i.test(c || '') ? '#1b1f27' : c;
    }
    function tintHolder(ch, holder, key, tag, day) {
        if (!holder || typeof holder[key] !== 'string') return;
        ch.__apOrig = ch.__apOrig || {};
        if (!(tag in ch.__apOrig)) ch.__apOrig[tag] = holder[key];
        holder[key] = day ? tintColor(ch.__apOrig[tag], true) : ch.__apOrig[tag];
    }
    /* «Día» para las gráficas = el interruptor está en día Y el fondo real de #tab-flow es claro. dj-profile.html ya tiene su capa de día;
       staff-agenda.html y dj-dashboard.html comparten este módulo pero su panel sigue oscuro en día: ahí NO se tiñe (texto oscuro sobre
       fondo oscuro sería ilegible). */
    function isDay() {
        if (document.documentElement.getAttribute('data-theme') !== 'day') return false;
        var e = document.querySelector(HOST_SEL);
        while (e) {
            var m = (getComputedStyle(e).backgroundColor || '').match(/[\d.]+/g);
            if (m && (m.length < 4 || +m[3] > 0.5)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255 > 0.6;
            e = e.parentElement;
        }
        return false;
    }
    /* Series: las barras «sin evento» son blanco translúcido (invisibles sobre fondo claro). Se guarda el original por serie y, si la
       gráfica reasigna sus colores (cada refresco), el valor nuevo pasa a ser el original. */
    function tintSeriesColor(c, day) {
        var one = function (v) {
            var m = typeof v === 'string' && v.replace(/\s+/g, '').match(/^rgba\(255,255,255,([\d.]+)\)$/);
            if (m) return 'rgba(27,31,39,' + Math.max(0.16, Math.min(0.5, +m[1])) + ')';
            return /^#(fff|ffffff)$/i.test(v || '') ? '#1b1f27' : v;
        };
        if (!day) return c;
        return Array.isArray(c) ? c.map(one) : one(c);
    }
    function tintSeries(ch, day) {
        ch.__apSer = ch.__apSer || {};
        (ch.data && ch.data.datasets || []).forEach(function (ds, i) {
            ['backgroundColor', 'borderColor'].forEach(function (key) {
                var cur = ds[key]; if (cur == null) return;
                var tag = i + '.' + key, rec = ch.__apSer[tag], curJ = JSON.stringify(cur);
                if (!rec || curJ !== rec.t) rec = ch.__apSer[tag] = { o: cur, t: curJ };       /* valor nuevo = nuevo original */
                var want = tintSeriesColor(rec.o, day);
                rec.t = JSON.stringify(want);
                if (JSON.stringify(ds[key]) !== rec.t) ds[key] = want;
            });
        });
    }
    function tintChart(ch) {
        if (!ch || !ch.canvas || !ch.canvas.closest || !ch.canvas.closest('#tab-flow')) return false;
        var day = isDay();
        try {
            var o = ch.options || {}, sc = o.scales || {};
            Object.keys(sc).forEach(function (id) {
                TINT_PATHS.forEach(function (pk) { tintHolder(ch, sc[id] && sc[id][pk[0]], pk[1], 's.' + id + '.' + pk[0], day); });
            });
            tintHolder(ch, o.plugins && o.plugins.legend && o.plugins.legend.labels, 'color', 'legend', day);
            tintSeries(ch, day);
            return true;
        } catch (e) { return false; /* una gráfica con opciones raras no debe romper el panel */ }
    }
    /* Plugin de Chart.js: tiñe cada gráfica de #tab-flow en el momento en que se crea o se actualiza (la semanal y la dona se vuelven a
       crear en cada refresco, y ninguna otra pasada llega a tiempo). Se registra en cuanto Chart existe. */
    function registerTint() {
        if (registerTint.done || typeof Chart === 'undefined' || !Chart.register) return;
        Chart.register({ id: 'apDayTint', beforeUpdate: function (ch) { tintChart(ch); } });
        registerTint.done = true;
    }
    function tintCharts() {
        registerTint();
        if (typeof Chart === 'undefined' || !Chart.instances) return;
        Object.keys(Chart.instances).forEach(function (k) {
            var ch = Chart.instances[k];
            if (tintChart(ch)) { try { ch.update('none'); } catch (e) { /* sin gráfica */ } }
        });
    }
    /* staff-agenda.html corre dentro de staff.html (iframe). El portal difunde el tema con body[data-mode]="light"|"dark" y NO pone
       data-theme en el <html> del marco, así que el modo día (CSS compartido + módulos) nunca se activaba ahí. Se refleja aquí, solo en
       marcos, con el mismo contrato que ya usa el Matrix (body[data-mode]). */
    function watchFrameTheme() {
        if (window.top === window || !window.MutationObserver || !document.body) return;
        function sync() {
            var m = document.body.getAttribute('data-mode'), r = document.documentElement;
            if (m === 'light') r.setAttribute('data-theme', 'day'); else if (m === 'dark') r.removeAttribute('data-theme');
        }
        new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });
        sync();
    }
    function watchTheme() {
        if (!window.MutationObserver) return;
        new MutationObserver(function () { tintCharts(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    function mount() {
        ['loadFlowData', 'mdjLoadFlowTab', 'mdjFlowReloadIfAllowed'].forEach(wrap);
        registerTint(); watchFrameTheme(); watchChrome(); watchTheme();
        /* Cambio de idioma con el Cash Flow a la vista: se vuelve a cargar la pestaña (gráficas, tendencias y estados que arma flow-handler.js); wrap() de arriba repinta después este panel. */
        document.addEventListener('languageChanged', function () {
            var h = document.querySelector(HOST_SEL);
            if (!h || !(h.classList.contains('active') || h.offsetParent !== null)) return;
            if (typeof window.mdjLoadFlowTab === 'function') window.mdjLoadFlowTab(); else refresh();
        });
        var host = document.querySelector(HOST_SEL);
        if (host && (host.classList.contains('active') || host.offsetParent !== null)) refresh();
    }

    AP.cashflow = { mount: mount, render: render, refresh: refresh };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
