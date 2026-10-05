/* Panel del artista · REPUTACIÓN (reseñas reales).
 *  - Tarjeta del Cash Flow (#kpi-rating): promedio REAL de las reseñas publicadas y cuántas hay. Sin reseñas dice «Sin reseñas», jamás «1.0 ★» ni un índice inventado.
 *  - Estrellas del encabezado del perfil (solo para el dueño): el mismo promedio real.
 *  - Lista «Opiniones de clientes» (#ap-reviews): las últimas, con la marca «Verificada» solo cuando hay un contrato detrás (source_lead_id).
 * Los datos salen de artist-data.js (get_my_review_summary; si no existe, del promedio y total de su propia fila de dj_profiles). Texto con textContent. Compatible con Safari 13. */
(function () {
    'use strict';
    var AP = window.ArtistPanel = window.ArtistPanel || {};
    var T = {
        es: { card: 'Reseñas de clientes', none: 'Sin reseñas', noneHint: 'Aparecerán cuando un cliente que contrató contigo te califique.', one: 'reseña', many: 'reseñas',
              ver1: 'verificada', verN: 'verificadas', title: 'Opiniones de clientes', verified: 'Verificada', empty: 'Aún no tienes opiniones. Cuando un cliente que contrató contigo te califique, aparecerá aquí con la marca «Verificada».', client: 'Cliente' },
        en: { card: 'Client reviews', none: 'No reviews', noneHint: 'They will appear once a client who hired you rates you.', one: 'review', many: 'reviews',
              ver1: 'verified', verN: 'verified', title: 'Client reviews', verified: 'Verified', empty: 'You have no reviews yet. Once a client who hired you rates you, it will show here with the “Verified” badge.', client: 'Client' }
    };
    function lang() { var l = String(document.documentElement.getAttribute('lang') || 'es').toLowerCase(); return l.indexOf('en') === 0 ? 'en' : 'es'; }
    function t(k) { return T[lang()][k]; }
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function stars(n) { var r = Math.max(0, Math.min(5, Math.round(Number(n) || 0))), s = ''; for (var i = 1; i <= 5; i++) s += i <= r ? '★' : '☆'; return s; }

    function css() {
        if (document.getElementById('ap-reputation-style')) return;
        var s = document.createElement('style'); s.id = 'ap-reputation-style';
        s.textContent =
            '#ap-reviews{margin:28px 0 28px;}' +
            '#ap-reviews .ap-h{font-size:15px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fff;margin:0 0 12px;}' +   /* mismo título que el resto del panel: sin opacidad */
            '#ap-reviews .ap-list{display:flex;flex-direction:column;gap:10px;}' +
            '#ap-reviews .ap-rev{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 16px;}' +
            '#ap-reviews .ap-top{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:12px;color:rgba(255,255,255,.62);}' +
            '#ap-reviews .ap-stars{color:#f0cc80;letter-spacing:.08em;font-size:14px;}' +
            '#ap-reviews .ap-who{font-weight:700;color:rgba(255,255,255,.9);}' +
            '#ap-reviews .ap-chip{font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7fdca0;border:1px solid rgba(127,220,160,.4);border-radius:999px;padding:2px 8px;}' +
            '#ap-reviews .ap-txt{margin:8px 0 0;font-size:13px;line-height:1.5;color:rgba(255,255,255,.78);}' +
            '#ap-reviews .ap-empty{font-size:12px;line-height:1.5;color:rgba(255,255,255,.5);}' +
            'html[data-theme="day"] #ap-reviews .ap-rev{background:#fff;border-color:rgba(0,0,0,.12);}' +
            'html[data-theme="day"] #ap-reviews .ap-txt,html[data-theme="day"] #ap-reviews .ap-who{color:#111;}' +
            'html[data-theme="day"] #ap-reviews .ap-h{color:#1b1f27;}' +
            'html[data-theme="day"] #ap-reviews .ap-top,html[data-theme="day"] #ap-reviews .ap-empty{color:rgba(0,0,0,.6);}';
        document.head.appendChild(s);
    }

    /* La tarjeta del Cash Flow que antes decía «Salud artística · ecosistema 4.2 ★» (un índice mezclado con suelos inventados) ahora dice lo único que importa: reseñas reales. */
    function paintCard(sum) {
        var ratEl = document.getElementById('kpi-rating'), trend = document.getElementById('trend-rating'); if (!ratEl) return;
        var label = ratEl.previousElementSibling; if (label) label.textContent = t('card');
        var n = Number(sum.review_count) || 0;
        if (n > 0 && sum.avg_rating != null) {
            ratEl.textContent = Number(sum.avg_rating).toFixed(1) + ' ★';
            if (trend) trend.textContent = n + ' ' + (n === 1 ? t('one') : t('many')) + (sum.verified_count != null ? ' · ' + sum.verified_count + ' ' + (sum.verified_count === 1 ? t('ver1') : t('verN')) : '');
        } else {
            ratEl.textContent = t('none');
            if (trend) trend.textContent = t('noneHint');
        }
    }

    /* Estrellas del encabezado del perfil (solo las ve el dueño de la página): el promedio real; sin reseñas, estrellas vacías. */
    function paintHero(sum) {
        if (typeof window.mdjPaintProfileHeroStarsFromHealth !== 'function' || !window._flowTabAllowed) return;
        var n = Number(sum.review_count) || 0;
        window.mdjPaintProfileHeroStarsFromHealth(n > 0 && sum.avg_rating != null ? Number(sum.avg_rating) : 0, { reviewAvg: n > 0 ? sum.avg_rating : null, reviewCount: n });
    }

    function renderList(sum) {
        var host = document.getElementById('tab-flow'); if (!host) return;
        css();
        var box = document.getElementById('ap-reviews');
        if (!box) { box = document.createElement('div'); box.id = 'ap-reviews'; }
        /* Al final de la pestaña Cash Flow, justo ANTES de «Exportación fiscal (IRS)», que es siempre lo último. Si esa franja no existe en la página, queda al final de todo. */
        var exp = document.getElementById('flow-export-panel');
        if (exp && exp.parentNode) { if (box.nextSibling !== exp || box.parentNode !== exp.parentNode) exp.parentNode.insertBefore(box, exp); }
        else host.appendChild(box);
        while (box.firstChild) box.removeChild(box.firstChild);
        box.appendChild(el('div', 'ap-h', t('title')));
        var rows = sum.reviews || [];
        if (!rows.length) {                                                 /* la sección SIEMPRE está, con o sin opiniones */
            var n = Number(sum.review_count) || 0;
            box.appendChild(el('div', 'ap-empty', n > 0 ? (n + ' ' + (n === 1 ? t('one') : t('many')) + ' · ' + (lang() === 'en' ? 'published' : 'publicadas') + '.') : t('empty')));
            return;
        }
        var list = el('div', 'ap-list'), loc = lang() === 'en' ? 'en-US' : 'es-ES';
        rows.slice(0, 6).forEach(function (r) {
            var card = el('div', 'ap-rev'), top = el('div', 'ap-top');
            top.appendChild(el('span', 'ap-stars', stars(r.rating)));
            top.appendChild(el('span', 'ap-who', r.reviewer || t('client')));
            var d = r.created_at ? new Date(r.created_at) : null;
            if (d && !isNaN(d.getTime())) top.appendChild(el('span', null, d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })));
            if (r.verified) top.appendChild(el('span', 'ap-chip', t('verified')));
            card.appendChild(top);
            if (r.comment) card.appendChild(el('p', 'ap-txt', String(r.comment).slice(0, 280)));
            list.appendChild(card);
        });
        box.appendChild(list);
    }

    function refresh() {
        return AP.data.loadReviews().then(function (sum) { paintCard(sum); paintHero(sum); renderList(sum); }, function (e) {
            try { console.warn('[artist-panel] reseñas', e && e.message); } catch (x) { /* sin consola */ }
        });
    }

    AP.reputation = { refresh: refresh };
})();
