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
            hConcept: 'Concepto', hOrigin: 'Origen', hStatus: 'Estado', hAmount: 'Monto', hBal: 'Saldo', from: 'de',
            avail: 'Disponible', pend: 'Pendiente', other: 'Otro', today: 'Hoy', yesterday: 'Ayer',
            kEvento: 'Evento', kComision: 'Comisión por referido', kResidencia: 'Residencia', kPropina: 'Propina SoundForTips™', kPago: 'Pago', kAporte: 'Aporte', kOtro: 'Otro ingreso',
            cEvento: 'Evento', cComision: 'Comisión por referido', cResidencia: 'Turnos de residencia', cPropina: 'Propina SoundForTips™', cPago: 'Pago / retiro', cAporte: 'Aporte (no es cobro)', cOtro: 'Ingreso',
            gross: 'bruto', comm: 'comisión', notCounted: 'no cuenta en los totales',
            gDay: 'Día', gWeek: 'Semana', gMonth: 'Mes', gYear: 'Año', mov: 'mov.', week: 'Sem', open: 'Abrir movimientos', close: 'Cerrar movimientos',
            totIn: 'Total ingresos', net: 'neto', pendShort: 'pendiente', outShort: 'Salidas',
            bPropina: 'SoundForTips™', bEvento: 'Eventos', bResidencia: 'Residencia', bComision: 'Comisiones', bOtro: 'Otros ingresos'
        },
        en: {
            title: 'Transactions', loading: 'Loading transactions…', error: 'Could not load transactions. Please try again in a moment.', empty: 'No transactions recorded yet.',
            emptyFilter: 'No transactions match this filter.', note: 'Only transactions recorded in Miami DJ Beat. Ref = entry identifier.',
            fAll: 'All', fIn: 'Credits', fOut: 'Debits', fPend: 'Pending', origin: 'Source', allOrigins: 'All sources', csv: 'CSV', more: 'Show more',
            sIn: 'Credits', sComm: 'Fee', sOut: 'Debits', sAvail: 'Available', sPend: 'Pending',
            hConcept: 'Description', hOrigin: 'Source', hStatus: 'Status', hAmount: 'Amount', hBal: 'Balance', from: 'from',
            avail: 'Available', pend: 'Pending', other: 'Other', today: 'Today', yesterday: 'Yesterday',
            kEvento: 'Event', kComision: 'Referral commission', kResidencia: 'Residency', kPropina: 'SoundForTips™ tip', kPago: 'Payout', kAporte: 'Contribution', kOtro: 'Other income',
            cEvento: 'Event', cComision: 'Referral commission', cResidencia: 'Residency shifts', cPropina: 'SoundForTips™ tip', cPago: 'Payout / withdrawal', cAporte: 'Contribution (not a payment)', cOtro: 'Income',
            gross: 'gross', comm: 'fee', notCounted: 'not counted in totals',
            gDay: 'Day', gWeek: 'Week', gMonth: 'Month', gYear: 'Year', mov: 'txns', week: 'Wk', open: 'Open transactions', close: 'Close transactions',
            totIn: 'Total income', net: 'net', pendShort: 'pending', outShort: 'Debits',
            bPropina: 'SoundForTips™', bEvento: 'Events', bResidencia: 'Residency', bComision: 'Commissions', bOtro: 'Other income'
        }
    };
    function lang() { var l = String(document.documentElement.getAttribute('lang') || 'es').toLowerCase(); return l.indexOf('en') === 0 ? 'en' : 'es'; }
    function t(k) { return T[lang()][k]; }

    var state = { rows: null, error: false, filter: 'all', origin: 'all', shown: PAGE, open: AP.ui.getOpen('movements'), grain: 'day' };
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
            rows.push({ id: p.id, ref: shortId(p.id), day: nyDay(p.created_at), ts: Date.parse(p.created_at) || 0, kind: 'Propina', concept: concept, who: p.sender_label ? String(p.sender_label) : '', status: 'avail', gross: g, comm: c, net: g - c, counted: true });
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

    function loc() { return lang() === 'en' ? 'en-US' : 'es-ES'; }
    function utcDate(day) { return new Date(day + 'T12:00:00Z'); }
    function isoDay(d) { return d.toISOString().slice(0, 10); }
    function mondayOf(day) { var d = utcDate(day), dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return isoDay(d); }
    function dayLabel(day) {
        var today = nyDay(new Date().toISOString()), y = new Date(); y.setDate(y.getDate() - 1);
        if (day === today) return t('today');
        if (day === nyDay(y.toISOString())) return t('yesterday');
        try { return utcDate(day).toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch (e) { return day; }
    }
    /* Periodo al que pertenece un movimiento según Día / Semana / Mes / Año (la semana empieza el lunes, igual que los resúmenes de la base). */
    function groupKey(day, grain) {
        if (grain === 'week') return mondayOf(day);
        if (grain === 'month') return day.slice(0, 7);
        if (grain === 'year') return day.slice(0, 4);
        return day;
    }
    function groupLabel(key, grain) {
        try {
            if (grain === 'day') return dayLabel(key);
            if (grain === 'year') return key;
            if (grain === 'month') { var m = utcDate(key + '-01').toLocaleDateString(loc(), { month: 'long', year: 'numeric', timeZone: 'UTC' }); return m.charAt(0).toUpperCase() + m.slice(1); }
            var a = utcDate(key), b = utcDate(key); b.setUTCDate(b.getUTCDate() + 6);
            var same = a.getUTCMonth() === b.getUTCMonth();
            var left = a.toLocaleDateString(loc(), same ? { day: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });
            var right = b.toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
            return t('week') + ' ' + left + ' – ' + right;
        } catch (e) { return key; }
    }

    /* ── Vista ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
    function chip(label, act, val, on) { var b = el('button', 'ledger-filter-btn apm-chip' + (on ? ' active' : ''), label); b.type = 'button'; b.setAttribute('data-act', act); b.setAttribute('data-val', val); return b; }

    /* Fila de cierre de cada periodo: «Total ingresos» y de dónde vienen (p. ej. SoundForTips™ $155.00), más comisión, neto y salidas. */
    function totalRow(g, key) {
        var row = el('tr', 'apm-gtotal'), c1 = el('td'), left = el('div', 'apm-gt-label', t('totIn') + ' \u00B7 ' + groupLabel(key, state.grain));
        c1.colSpan = 3; c1.appendChild(left);
        var by = el('div', 'apm-gt-by');
        g.order.sort(function (a, b) { return g.by[b].gross - g.by[a].gross; }).forEach(function (k) {
            var ch = el('span', 'apm-gt-chip apm-tag--' + k.toLowerCase()); ch.appendChild(el('span', 'apm-gt-k', t('b' + k))); ch.appendChild(el('b', null, ' ' + money(g.by[k].gross) + ' \u00B7 ' + g.by[k].n)); by.appendChild(ch);
        });
        if (g.out) { var co = el('span', 'apm-gt-chip apm-tag--pago'); co.appendChild(el('span', 'apm-gt-k', t('outShort'))); co.appendChild(el('b', null, ' \u2212' + money(g.out))); by.appendChild(co); }
        c1.appendChild(by); row.appendChild(c1);
        var c2 = el('td', 'apm-r'); c2.colSpan = 2; c2.appendChild(el('div', 'apm-gt-amt', money(g.inn)));
        var sub2 = t('comm') + ' \u2212' + money(g.comm) + ' \u00B7 ' + t('net') + ' ' + money(g.avail);
        if (g.pend) sub2 += ' \u00B7 ' + t('pendShort') + ' ' + money(g.pend);
        c2.appendChild(el('div', 'apm-sub', sub2)); row.appendChild(c2);
        return row;
    }

    function render() {
        var host = document.querySelector(HOST); if (!host) return;
        while (host.firstChild) host.removeChild(host.firstChild);
        var box = el('div', 'apm ap-acc' + (state.open ? ' ap-acc--open' : '')); host.appendChild(box);

        /* Encabezado de acordeón COMPARTIDO (artist-ui.js, el mismo de «Opiniones de clientes»): nombre a la izquierda y, siempre a su derecha, el botón «+» / «−» en un círculo de
           cristal. Cerrado, deja a la vista un resumen corto. */
        var mini = null;
        if (!state.open && state.rows && state.rows.length) { var tc = totals(state.rows); mini = AP.ui.mini([[t('sAvail'), money(tc.avail), 'avail'], [t('sPend'), money(tc.pend), 'pend']]); }
        var head = AP.ui.accHead({ title: t('title'), open: state.open, mini: mini, openLabel: t('open'), closeLabel: t('close') });
        box.appendChild(head);
        if (!state.open) return;

        var body = el('div', 'apm-body'); box.appendChild(body);
        if (state.error) { body.appendChild(el('div', 'apm-msg', t('error'))); return; }
        if (!state.rows) { body.appendChild(el('div', 'apm-msg', t('loading'))); return; }
        if (!state.rows.length) { body.appendChild(el('div', 'apm-msg', t('empty'))); return; }

        var bar = el('div', 'apm-bar'), grains = el('div', 'apm-grains'), tools = el('div', 'apm-tools');
        [['day', 'gDay'], ['week', 'gWeek'], ['month', 'gMonth'], ['year', 'gYear']].forEach(function (g) { grains.appendChild(chip(t(g[1]), 'grain', g[0], state.grain === g[0])); });
        [['all', 'fAll'], ['in', 'fIn'], ['out', 'fOut'], ['pend', 'fPend']].forEach(function (f) { tools.appendChild(chip(t(f[1]), 'filter', f[0], state.filter === f[0])); });
        var kinds = []; state.rows.forEach(function (r) { if (kinds.indexOf(r.kind) < 0) kinds.push(r.kind); });
        if (kinds.length > 1) {
            var sel = el('select', 'apm-select'); sel.setAttribute('data-act', 'origin'); sel.setAttribute('aria-label', t('origin'));
            var o0 = el('option', null, t('allOrigins')); o0.value = 'all'; sel.appendChild(o0);
            kinds.forEach(function (k) { var o = el('option', null, t('k' + k)); o.value = k; if (state.origin === k) o.selected = true; sel.appendChild(o); });
            tools.appendChild(sel);
        }
        var csv = chip(t('csv'), 'csv', '', false); csv.className = 'ledger-filter-btn apm-chip apm-csv'; tools.appendChild(csv);
        bar.appendChild(grains); bar.appendChild(tools); body.appendChild(bar);

        var tt = totals(state.rows), sum = el('div', 'apm-sum');
        [['sIn', money(tt.inn), 'in'], ['sComm', (tt.comm ? '−' : '') + money(tt.comm), 'neg'], ['sOut', (tt.out ? '−' : '') + money(tt.out), 'neg'], ['sAvail', money(tt.avail), 'avail'], ['sPend', money(tt.pend), 'pend']].forEach(function (s) {
            var c = el('div', 'apm-stat apm-stat--' + s[2]); c.appendChild(el('div', 'apm-stat-l', t(s[0]))); c.appendChild(el('div', 'apm-stat-v', s[1])); sum.appendChild(c);
        });
        body.appendChild(sum);

        var list = state.rows.filter(passes);
        if (!list.length) { body.appendChild(el('div', 'apm-msg', t('emptyFilter'))); body.appendChild(el('div', 'apm-note', t('note'))); return; }
        /* Totales por periodo (sobre TODO el periodo filtrado, aunque parte de sus líneas aún no esté en la página mostrada): ingresos brutos (disponibles + pendientes,
           como «Ingresos acumulados» de arriba) con su desglose por ORIGEN, comisión, neto disponible y salidas. */
        var sub = {};
        list.forEach(function (r) {
            var k = groupKey(r.day, state.grain), g = sub[k] || (sub[k] = { n: 0, shown: 0, inn: 0, comm: 0, avail: 0, pend: 0, out: 0, by: {}, order: [] });
            g.n++;
            if (!r.counted) return;
            if (r.gross > 0) {
                g.inn += r.gross;
                if (r.status === 'avail') { g.comm += r.comm; g.avail += r.net; } else if (r.status === 'pend') g.pend += r.net;
                var b = g.by[r.kind] || (g.by[r.kind] = { gross: 0, n: 0 }); if (!b.n) g.order.push(r.kind); b.gross += r.gross; b.n++;
            } else if (r.gross < 0) g.out += -r.gross;
        });
        var wrap = el('div', 'apm-scroll'), table = el('table', 'apm-table'), thead = el('thead'), tr = el('tr');
        [['hConcept', ''], ['hOrigin', ''], ['hStatus', ''], ['hAmount', 'apm-r'], ['hBal', 'apm-r']].forEach(function (h) { tr.appendChild(el('th', h[1], t(h[0]))); });
        thead.appendChild(tr); table.appendChild(thead);
        var tb = el('tbody'), lastKey = null;
        list.slice(0, state.shown).forEach(function (r) {
            var key = groupKey(r.day, state.grain);
            if (key !== lastKey) {
                lastKey = key;
                var g = sub[key], dr = el('tr', 'apm-day'), dl = el('td', null, groupLabel(key, state.grain)); dl.colSpan = 3; dr.appendChild(dl);
                var dt = el('td', 'apm-r'); dt.colSpan = 2; dt.appendChild(el('span', 'apm-g-n', g.n + ' ' + t('mov'))); dr.appendChild(dt); tb.appendChild(dr);
            }
            var row = el('tr', 'apm-row' + (r.counted ? '' : ' apm-row--off') + (r.status === 'pend' ? ' apm-row--pend' : ''));
            var c1 = el('td', 'apm-c1'); c1.appendChild(el('div', 'apm-concept', r.concept));
            var meta = el('div', 'apm-meta'); meta.appendChild(el('span', 'apm-ref', 'Ref ' + r.ref));
            if (!r.counted && r.kind === 'Aporte') meta.appendChild(el('span', 'apm-ref', '\u00B7 ' + t('notCounted')));
            c1.appendChild(meta); row.appendChild(c1);
            /* Columna ORIGEN: de dónde viene cada movimiento (y, en propinas, quién la envió). */
            var co = el('td', 'apm-origin'); co.appendChild(el('span', 'apm-tag apm-tag--' + r.kind.toLowerCase(), t('k' + r.kind)));
            if (r.who) co.appendChild(el('div', 'apm-from', t('from') + ' ' + r.who));
            row.appendChild(co);
            var c2 = el('td'); c2.appendChild(el('span', 'apm-pill apm-pill--' + r.status, t(r.status))); row.appendChild(c2);
            var c3 = el('td', 'apm-r'); c3.appendChild(el('div', 'apm-amt ' + (r.net < 0 ? 'apm-amt--neg' : 'apm-amt--pos'), signed(r.net)));
            if (r.comm > 0) c3.appendChild(el('div', 'apm-sub', t('gross') + ' ' + money(r.gross) + ' · ' + t('comm') + ' −' + money(r.comm)));
            row.appendChild(c3);
            row.appendChild(el('td', 'apm-r apm-bal', r.bal == null ? '—' : money(r.bal)));
            tb.appendChild(row);
            var gg = sub[key]; gg.shown++;
            if (gg.shown === gg.n && (gg.inn || gg.out)) tb.appendChild(totalRow(gg, key));
        });
        table.appendChild(tb); wrap.appendChild(table); body.appendChild(wrap);
        var foot = el('div', 'apm-foot');
        if (list.length > state.shown) { var more = chip(t('more') + ' (' + (list.length - state.shown) + ')', 'more', '', false); more.className = 'ledger-filter-btn apm-chip apm-more'; foot.appendChild(more); }
        foot.appendChild(el('span', 'apm-note', t('note'))); body.appendChild(foot);
    }

    /* ── CSV de lo que se ve (con los filtros aplicados) ───────────────────────────────────────────────────────────────────────────────────────── */
    function csvEsc(v) { var s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    function exportCsv() {
        var cols = ['date', 'concept', 'source', 'from', 'status', 'gross_usd', 'commission_usd', 'net_usd', 'balance_usd', 'ref'];
        var lines = [cols.join(',')];
        state.rows.filter(passes).forEach(function (r) {
            lines.push([r.day, r.concept, t('k' + r.kind), r.who || '', t(r.status), (r.gross / 100).toFixed(2), (r.comm / 100).toFixed(2), (r.net / 100).toFixed(2), r.bal == null ? '' : (r.bal / 100).toFixed(2), r.ref].map(csvEsc).join(','));
        });
        var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = 'MDJB-Movimientos.csv'; a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    function onClick(ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null; if (!b) return;
        var act = b.getAttribute('data-act');
        if (act === 'toggle') { state.open = !state.open; AP.ui.setOpen('movements', state.open); render(); }
        else if (act === 'grain') { state.grain = b.getAttribute('data-val'); state.shown = PAGE; render(); }
        else if (act === 'filter') { state.filter = b.getAttribute('data-val'); state.shown = PAGE; render(); }
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
