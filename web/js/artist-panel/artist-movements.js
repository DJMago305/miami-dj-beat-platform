/* Panel del artista · MOVIMIENTOS (estado de cuenta, solo lectura).
 * Al final del Cash Flow: cada entrada y salida que pasa por Miami DJ Beat, con DE DÓNDE VIENE (evento, residencia, propina SoundForTips™, comisión por referido, pago),
 * como el estado de cuenta de un banco: pendiente vs disponible, monto con signo, saldo corriente solo de lo disponible, agrupado por día, paginado y exportable.
 * Los artistas no conectan cuentas bancarias, así que solo aparece lo que ocurre dentro de la plataforma; cada línea lleva su referencia (el id del asiento).
 *
 * Reglas (las mismas del resto del panel):
 *  - SOLO lo del usuario autenticado: lo lee artist-data.js (loadMovementSources), con su propio dj_user_id en cada consulta. Aquí no hay cifras de nadie: de la
 *    plantilla se copia el cableado y el esqueleto, jamás datos de otro artista.
 *  - Mismas reglas de comisión que la base (_refresh_dj_flow_rollups_core): ingresos del libro 10 % por defecto (metadata.commission_rate) y 0 % en ventas de evento
 *    (event_sale_*); propinas SoundForTips™ 10 %; residencias sin comisión; el movimiento va en la fecha del evento (metadata.fecha) si existe.
 *  - «Entradas» (bruto disponible) cuadra con «Cobrado / Disponible» de «Tus números». Los aportes de contribuyente (classification = contribution) se muestran
 *    marcados y NO cuentan en ningún total, igual que arriba.
 * Compatible con Safari 13 (sin ??, sin ?.). El estilo vive en css/mdj-cashflow-panel.css (un solo archivo para las páginas que llevan este panel). */
(function () {
    'use strict';
    var AP = window.ArtistPanel = window.ArtistPanel || {};
    var HOST = '#ap-movements';
    var PAGE = 25;

    var T = {
        es: {
            title: 'Movimientos', loading: 'Cargando movimientos…', error: 'No se pudieron cargar los movimientos. Reintenta en un momento.', empty: 'Aún no hay movimientos registrados.',
            emptyFilter: 'No hay movimientos con este filtro.', note: 'Solo movimientos registrados en Miami DJ Beat. Ref = identificador del asiento.',
            fAll: 'Todo', fIn: 'Entradas', fOut: 'Salidas', fPend: 'Pendientes', origin: 'Origen', allOrigins: 'Todos los orígenes', csv: 'CSV', more: 'Mostrar más',
            sIn: 'Entradas', sComm: 'Comisión', sOut: 'Salidas', sAvail: 'Disponible', sPend: 'Pendiente',
            hConcept: 'Concepto', hStatus: 'Estado', hAmount: 'Monto', hBal: 'Saldo',
            avail: 'Disponible', pend: 'Pendiente', other: 'Otro', today: 'Hoy', yesterday: 'Ayer',
            kEvento: 'Evento', kComision: 'Comisión por referido', kResidencia: 'Residencia', kPropina: 'Propina SoundForTips™', kPago: 'Pago', kAporte: 'Aporte', kOtro: 'Otro ingreso',
            cEvento: 'Evento', cComision: 'Comisión por referido', cResidencia: 'Turnos de residencia', cPropina: 'Propina SoundForTips™', cPago: 'Pago / retiro', cAporte: 'Aporte (no es cobro)', cOtro: 'Ingreso',
            gross: 'bruto', comm: 'comisión', notCounted: 'no cuenta en los totales'
        },
        en: {
            title: 'Transactions', loading: 'Loading transactions…', error: 'Could not load transactions. Please try again in a moment.', empty: 'No transactions recorded yet.',
            emptyFilter: 'No transactions match this filter.', note: 'Only transactions recorded in Miami DJ Beat. Ref = entry identifier.',
            fAll: 'All', fIn: 'Credits', fOut: 'Debits', fPend: 'Pending', origin: 'Source', allOrigins: 'All sources', csv: 'CSV', more: 'Show more',
            sIn: 'Credits', sComm: 'Fee', sOut: 'Debits', sAvail: 'Available', sPend: 'Pending',
            hConcept: 'Description', hStatus: 'Status', hAmount: 'Amount', hBal: 'Balance',
            avail: 'Available', pend: 'Pending', other: 'Other', today: 'Today', yesterday: 'Yesterday',
            kEvento: 'Event', kComision: 'Referral commission', kResidencia: 'Residency', kPropina: 'SoundForTips™ tip', kPago: 'Payout', kAporte: 'Contribution', kOtro: 'Other income',
            cEvento: 'Event', cComision: 'Referral commission', cResidencia: 'Residency shifts', cPropina: 'SoundForTips™ tip', cPago: 'Payout / withdrawal', cAporte: 'Contribution (not a payment)', cOtro: 'Income',
            gross: 'gross', comm: 'fee', notCounted: 'not counted in totals'
        }
    };
    function lang() { var l = String(document.documentElement.getAttribute('lang') || 'es').toLowerCase(); return l.indexOf('en') === 0 ? 'en' : 'es'; }
    function t(k) { return T[lang()][k]; }

    var state = { rows: null, error: false, filter: 'all', origin: 'all', shown: PAGE };
    var seq = 0;

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function money(cents) { return '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function signed(cents) { return (cents < 0 ? '−' : '+') + money(cents); }
    function nyDay(iso) { try { return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } catch (e) { return String(iso).slice(0, 10); } }
    function shortId(id) { return String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase(); }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

    /* ── Modelo: filas crudas → movimientos (mismas reglas de comisión que la base) ─────────────────────────────────────────────────────────────────── */
    function buildRows(src) {
        var rows = [];
        (src.ledger || []).forEach(function (r) {
            var isPayout = String(r.type || '').toLowerCase() === 'payout';
            if (r.type !== 'income' && !isPayout) return;
            var amt = num(r.amount_cents), name = String(r.src || ''), contrib = r.classification === 'contribution';
            var isSale = /^event_sale/.test(name);
            var kind = isPayout ? 'Pago' : contrib ? 'Aporte' : isSale ? 'Evento' : name === 'commission' ? 'Comision' : 'Otro';
            var gross = isPayout ? -Math.abs(amt) : amt;
            var rate = (r.rate != null && r.rate !== '' && isFinite(Number(r.rate))) ? Number(r.rate) : 10;
            var comm = (isPayout || gross <= 0 || isSale || contrib) ? 0 : Math.floor(gross * rate / 100);
            var status = r.status === 'pending' ? 'pend' : (r.status === 'available' || isPayout) ? 'avail' : 'other';
            var concept = r.ename || r.evento || t('c' + (kind === 'Otro' ? 'Otro' : kind));
            rows.push({ id: r.id, ref: shortId(r.id), day: r.fecha ? String(r.fecha).slice(0, 10) : nyDay(r.created_at), ts: Date.parse(r.created_at) || 0,
                kind: kind, concept: concept, status: status, gross: gross, comm: comm, net: gross - comm, counted: !contrib && status !== 'other' });
        });
        (src.daily || []).forEach(function (d) {
            var g = num(d.residency_gross_cents); if (g <= 0) return;
            var day = String(d.bucket_date).slice(0, 10);
            rows.push({ id: 'res-' + day, ref: 'RES-' + day.replace(/-/g, ''), day: day, ts: Date.parse(day + 'T12:00:00Z') || 0, kind: 'Residencia', concept: t('cResidencia'),
                status: 'avail', gross: g, comm: 0, net: g, counted: true });
        });
        (src.tips || []).forEach(function (p) {
            var g = Math.round(num(p.tip_usd) * 100); if (g <= 0) return;
            var c = Math.floor(g * 10 / 100);
            var concept = p.song ? String(p.song) + (p.artist ? ' · ' + String(p.artist) : '') : t('cPropina');
            rows.push({ id: p.id, ref: shortId(p.id), day: nyDay(p.created_at), ts: Date.parse(p.created_at) || 0, kind: 'Propina', concept: concept, status: 'avail', gross: g, comm: c, net: g - c, counted: true });
        });
        /* Saldo corriente (solo lo disponible, como un banco: lo pendiente no mueve el saldo). Se calcula en orden cronológico y se muestra del más nuevo al más viejo. */
        rows.sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : a.ts - b.ts; });
        var run = 0;
        rows.forEach(function (r) { if (r.counted && r.status === 'avail') { run += r.net; r.bal = run; } else r.bal = null; });
        rows.reverse();
        return rows;
    }

    function totals(rows) {
        var o = { inn: 0, comm: 0, out: 0, avail: 0, pend: 0 };
        rows.forEach(function (r) {
            if (!r.counted) return;
            if (r.status === 'avail') { if (r.gross > 0) { o.inn += r.gross; o.comm += r.comm; } else o.out += -r.gross; }
            else if (r.status === 'pend') o.pend += r.net;
        });
        o.avail = o.inn - o.comm - o.out;
        return o;
    }

    function passes(r) {
        if (state.origin !== 'all' && r.kind !== state.origin) return false;
        if (state.filter === 'in') return r.counted && r.gross > 0;
        if (state.filter === 'out') return r.counted && r.gross < 0;
        if (state.filter === 'pend') return r.status === 'pend';
        return true;
    }

    function dayLabel(day) {
        var today = nyDay(new Date().toISOString()), y = new Date(); y.setDate(y.getDate() - 1);
        if (day === today) return t('today');
        if (day === nyDay(y.toISOString())) return t('yesterday');
        try { return new Date(day + 'T12:00:00Z').toLocaleDateString(lang() === 'en' ? 'en-US' : 'es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch (e) { return day; }
    }

    /* ── Vista ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
    function chip(label, act, val, on) { var b = el('button', 'ledger-filter-btn apm-chip' + (on ? ' active' : ''), label); b.type = 'button'; b.setAttribute('data-act', act); b.setAttribute('data-val', val); return b; }

    function render() {
        var host = document.querySelector(HOST); if (!host) return;
        while (host.firstChild) host.removeChild(host.firstChild);
        var box = el('div', 'apm'); host.appendChild(box);
        var head = el('div', 'apm-head'); head.appendChild(el('h3', 'chart-title apm-title', t('title'))); box.appendChild(head);
        if (state.error) { box.appendChild(el('div', 'apm-msg', t('error'))); return; }
        if (!state.rows) { box.appendChild(el('div', 'apm-msg', t('loading'))); return; }
        if (!state.rows.length) { box.appendChild(el('div', 'apm-msg', t('empty'))); return; }

        var tools = el('div', 'apm-tools'); head.appendChild(tools);
        [['all', 'fAll'], ['in', 'fIn'], ['out', 'fOut'], ['pend', 'fPend']].forEach(function (f) { tools.appendChild(chip(t(f[1]), 'filter', f[0], state.filter === f[0])); });
        var kinds = []; state.rows.forEach(function (r) { if (kinds.indexOf(r.kind) < 0) kinds.push(r.kind); });
        if (kinds.length > 1) {
            var sel = el('select', 'apm-select'); sel.setAttribute('data-act', 'origin'); sel.setAttribute('aria-label', t('origin'));
            var o0 = el('option', null, t('allOrigins')); o0.value = 'all'; sel.appendChild(o0);
            kinds.forEach(function (k) { var o = el('option', null, t('k' + k)); o.value = k; if (state.origin === k) o.selected = true; sel.appendChild(o); });
            tools.appendChild(sel);
        }
        var csv = chip(t('csv'), 'csv', '', false); csv.className = 'ledger-filter-btn apm-chip apm-csv'; tools.appendChild(csv);

        var tt = totals(state.rows), sum = el('div', 'apm-sum');
        [['sIn', money(tt.inn), 'in'], ['sComm', (tt.comm ? '−' : '') + money(tt.comm), 'neg'], ['sOut', (tt.out ? '−' : '') + money(tt.out), 'neg'], ['sAvail', money(tt.avail), 'avail'], ['sPend', money(tt.pend), 'pend']].forEach(function (s) {
            var c = el('div', 'apm-stat apm-stat--' + s[2]); c.appendChild(el('div', 'apm-stat-l', t(s[0]))); c.appendChild(el('div', 'apm-stat-v', s[1])); sum.appendChild(c);
        });
        box.appendChild(sum);

        var list = state.rows.filter(passes);
        if (!list.length) { box.appendChild(el('div', 'apm-msg', t('emptyFilter'))); box.appendChild(el('div', 'apm-note', t('note'))); return; }
        var wrap = el('div', 'apm-scroll'), table = el('table', 'apm-table'), thead = el('thead'), tr = el('tr');
        [['hConcept', ''], ['hStatus', ''], ['hAmount', 'apm-r'], ['hBal', 'apm-r']].forEach(function (h) { tr.appendChild(el('th', h[1], t(h[0]))); });
        thead.appendChild(tr); table.appendChild(thead);
        var tb = el('tbody'), lastDay = null;
        list.slice(0, state.shown).forEach(function (r) {
            if (r.day !== lastDay) { lastDay = r.day; var dr = el('tr', 'apm-day'), dc = el('td', null, dayLabel(r.day)); dc.colSpan = 4; dr.appendChild(dc); tb.appendChild(dr); }
            var row = el('tr', 'apm-row' + (r.counted ? '' : ' apm-row--off') + (r.status === 'pend' ? ' apm-row--pend' : ''));
            var c1 = el('td', 'apm-c1'); c1.appendChild(el('div', 'apm-concept', r.concept));
            var meta = el('div', 'apm-meta'); meta.appendChild(el('span', 'apm-tag apm-tag--' + r.kind.toLowerCase(), t('k' + r.kind))); meta.appendChild(el('span', 'apm-ref', 'Ref ' + r.ref));
            if (!r.counted && r.kind === 'Aporte') meta.appendChild(el('span', 'apm-ref', '· ' + t('notCounted')));
            c1.appendChild(meta); row.appendChild(c1);
            var c2 = el('td'); c2.appendChild(el('span', 'apm-pill apm-pill--' + r.status, t(r.status))); row.appendChild(c2);
            var c3 = el('td', 'apm-r'); c3.appendChild(el('div', 'apm-amt ' + (r.net < 0 ? 'apm-amt--neg' : 'apm-amt--pos'), signed(r.net)));
            if (r.comm > 0) c3.appendChild(el('div', 'apm-sub', t('gross') + ' ' + money(r.gross) + ' · ' + t('comm') + ' −' + money(r.comm)));
            row.appendChild(c3);
            row.appendChild(el('td', 'apm-r apm-bal', r.bal == null ? '—' : money(r.bal)));
            tb.appendChild(row);
        });
        table.appendChild(tb); wrap.appendChild(table); box.appendChild(wrap);
        var foot = el('div', 'apm-foot');
        if (list.length > state.shown) { var more = chip(t('more') + ' (' + (list.length - state.shown) + ')', 'more', '', false); more.className = 'ledger-filter-btn apm-chip apm-more'; foot.appendChild(more); }
        foot.appendChild(el('span', 'apm-note', t('note'))); box.appendChild(foot);
    }

    /* ── CSV de lo que se ve (con los filtros aplicados) ───────────────────────────────────────────────────────────────────────────────────────── */
    function csvEsc(v) { var s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    function exportCsv() {
        var cols = ['date', 'concept', 'source', 'status', 'gross_usd', 'commission_usd', 'net_usd', 'balance_usd', 'ref'];
        var lines = [cols.join(',')];
        state.rows.filter(passes).forEach(function (r) {
            lines.push([r.day, r.concept, t('k' + r.kind), t(r.status), (r.gross / 100).toFixed(2), (r.comm / 100).toFixed(2), (r.net / 100).toFixed(2), r.bal == null ? '' : (r.bal / 100).toFixed(2), r.ref].map(csvEsc).join(','));
        });
        var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = 'MDJB-Movimientos.csv'; a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    function onClick(ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null; if (!b) return;
        var act = b.getAttribute('data-act');
        if (act === 'filter') { state.filter = b.getAttribute('data-val'); state.shown = PAGE; render(); }
        else if (act === 'more') { state.shown += PAGE; render(); }
        else if (act === 'csv') { if (state.rows) exportCsv(); }
    }
    function onChange(ev) {
        var s = ev.target; if (!s || s.getAttribute('data-act') !== 'origin') return;
        state.origin = s.value; state.shown = PAGE; render();
    }

    /* ── Carga (la dispara artist-cashflow.js tras cada carga de la pestaña, igual que el resto de módulos) ──────────────────────────────────────── */
    function refresh() {
        var host = document.querySelector(HOST); if (!host) return Promise.resolve();
        var mine = ++seq;
        if (!state.rows) { state.error = false; render(); }
        return AP.data.loadMovementSources().then(function (src) {
            if (mine !== seq) return;
            state.rows = buildRows(src); state.error = false; render();
        }, function (e) {
            if (mine !== seq) return;
            try { console.warn('[artist-panel] movimientos', e && e.message); } catch (x) { /* sin consola */ }
            if (!state.rows) { state.error = true; render(); }
        });
    }

    function mount() {
        var host = document.querySelector(HOST); if (!host) return;
        host.addEventListener('click', onClick); host.addEventListener('change', onChange);
        document.addEventListener('languageChanged', function () { /* los textos del modelo (conceptos fijos) se reconstruyen con el idioma nuevo */ if (state.rows) { refresh(); } else render(); });
        render();
    }

    AP.movements = { refresh: refresh, render: render };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
