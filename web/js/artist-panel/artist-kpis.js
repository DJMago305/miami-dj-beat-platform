/* Panel del artista · TARJETAS Y GRÁFICA SEMANAL con datos REALES.
 * Las tarjetas «Ingresos totales», «Eventos completados/pendientes», «Propinas», «Ticket promedio», «Balance disponible» y «Turnos residente» las calculaba flow-handler.js solo con el
 * libro (dj_ledger) y los contratos (leads): ignoraba la residencia y la agenda, y contaba los contratos cancelados como pendientes. Aquí se recalculan, para el rango elegido (7 d, 30 d,
 * 90 d, 1 año), con: dinero por día de dj_flow_daily (ya incluye residencia y propinas), eventos de la agenda (sin notas, cumpleaños ni cancelados) y contratos completados.
 * También dibuja «Eventos + residencia (semana típica)» con datos reales (eventos realizados y turnos de residencia por día de la semana), en su propio lienzo para no chocar con
 * flow-handler. No reescribe flow-handler: actúa después de que él dibuja. Texto con textContent. Compatible con Safari 13. */
(function () {
    'use strict';
    var AP = window.ArtistPanel = window.ArtistPanel || {};
    var USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    function rangeKey() { var s = document.getElementById('metrics-range'), v = s && s.value; return /^(7d|30d|90d|1y)$/.test(v) ? v : '30d'; }
    function bounds(r) {
        var now = new Date(), s = new Date();
        if (r === '7d') s.setDate(now.getDate() - 7); else if (r === '30d') s.setDate(now.getDate() - 30); else if (r === '90d') s.setDate(now.getDate() - 90); else s.setFullYear(now.getFullYear() - 1);
        var days = Math.ceil((now - s) / 864e5), p = new Date(s); p.setDate(s.getDate() - days);
        return { now: now, start: s, prev: p };
    }
    function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function cents(v) { return (Number(v) || 0) / 100; }

    function compute(raw, r) {
        var b = bounds(r), sd = ymd(b.start), pd = ymd(b.prev);
        var m = { gross: 0, tips: 0, tx: 0, resDays: 0, resWeekdays: {}, resByWd: [0, 0, 0, 0, 0, 0, 0], prevGross: 0, prevTips: 0, prevTx: 0,
                  done: 0, prevDone: 0, pending: 0, evByWd: [0, 0, 0, 0, 0, 0, 0] };
        var ap = {}; (raw.aporte || []).forEach(function (a) { ap[a.day] = (ap[a.day] || { c: 0, n: 0 }); ap[a.day].c += a.cents; ap[a.day].n++; });   /* aporte clasificado por el Staff: no es cobro */
        (raw.daily || []).forEach(function (d) {
            var day = String(d.bucket_date).slice(0, 10), a = ap[day], g = cents(d.gross_cents) - (a ? cents(a.c) : 0), sft = cents(d.sft_gross_cents), rs = cents(d.residency_gross_cents), tx = (Number(d.tx_count) || 0) - (a ? a.n : 0);
            if (day >= sd) {
                m.gross += g; m.tips += sft; m.tx += tx;
                if (rs > 0) { m.resDays++; var w = new Date(day + 'T12:00:00').getDay(); m.resByWd[w]++; m.resWeekdays[w] = 1; }
            } else if (day >= pd) { m.prevGross += g; m.prevTips += sft; m.prevTx += tx; }
        });
        (raw.events || []).forEach(function (e) {                         /* solo trabajo real: sin notas ni cumpleaños de Google, solo activos */
            var tipo = String(e.tipo || ''); if (e.estado !== 'activo' || tipo === 'nota' || tipo === 'cumpleanos') return;
            var st = new Date(e.fecha_inicio), en = new Date(e.fecha_fin || e.fecha_inicio); if (isNaN(st.getTime())) return;
            if (st >= b.now) m.pending++;
            else if (en < b.now) { if (st >= b.start) { m.done++; m.evByWd[st.getDay()]++; } else if (st >= b.prev) m.prevDone++; }
        });
        (raw.leads || []).forEach(function (l) {                           /* contratos: los completados cuentan; los cancelados NUNCA son pendientes */
            var d = new Date(l.event_date || l.assigned_at), s = String(l.status || '').toUpperCase(); if (isNaN(d.getTime())) return;
            if (s === 'COMPLETED') { if (d >= b.start && d <= b.now) { m.done++; m.evByWd[d.getDay()]++; } else if (d >= b.prev && d < b.start) m.prevDone++; }
            else if (s !== 'CANCELLED' && d >= b.now) m.pending++;
        });
        /* Ticket promedio = ingreso medio por pago. Las propinas (muchas y pequeñas) lo desvirtuarían, así que, si las hay, se calcula sin ellas y por evento o turno trabajado. */
        var gigs = m.done + m.resDays, prevGigs = m.prevDone;
        m.avg = m.tips > 0 ? (gigs > 0 ? (m.gross - m.tips) / gigs : 0) : (m.tx > 0 ? m.gross / m.tx : 0);
        m.prevAvg = m.prevTips > 0 ? (prevGigs > 0 ? (m.prevGross - m.prevTips) / prevGigs : 0) : (m.prevTx > 0 ? m.prevGross / m.prevTx : 0);
        return m;
    }

    function txt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
    function trend(id, cur, prev) {
        var e = document.getElementById(id); if (!e) return;
        if (prev > 0) { var pct = ((cur - prev) / prev * 100).toFixed(1), up = pct >= 0; e.className = 'flow-card-trend ' + (up ? 'up' : 'down'); e.textContent = (up ? '↑ ' : '↓ ') + Math.abs(pct) + '% vs período anterior'; }
        else { e.className = 'flow-card-trend'; e.textContent = 'Sin datos previos'; }
    }

    function paintCards(m, model) {
        txt('kpi-gross', USD.format(m.gross)); trend('trend-gross', m.gross, m.prevGross);
        txt('kpi-events-done', String(m.done)); trend('trend-events', m.done, m.prevDone);
        txt('kpi-events-pending', String(m.pending));
        txt('kpi-tips', USD.format(m.tips)); trend('trend-tips', m.tips, m.prevTips);
        txt('kpi-avg-ticket', USD.format(m.avg)); trend('trend-avg', m.avg, m.prevAvg);
        txt('kpi-residency-days', String(Object.keys(m.resWeekdays).length));
        txt('kpi-residency-slots', String(m.resDays));
        var tr = document.getElementById('trend-residency'); if (tr) { tr.className = 'flow-card-trend'; tr.textContent = 'Turnos de residencia trabajados en el período'; }
        if (model) txt('kpi-available', USD.format(model.disponible));
    }

    function paintWeek(m) {
        if (typeof Chart === 'undefined') return;
        var orig = document.getElementById('chart-activity'); if (!orig || !orig.parentElement) return;
        var mine = document.getElementById('ap-act-canvas');
        if (!mine) { mine = document.createElement('canvas'); mine.id = 'ap-act-canvas'; orig.parentElement.insertBefore(mine, orig); }
        orig.style.display = 'none';
        var old = Chart.getChart ? Chart.getChart(mine) : null; if (old) old.destroy();
        new Chart(mine.getContext('2d'), {
            type: 'bar',
            data: { labels: DIAS, datasets: [
                { label: 'Eventos realizados', data: m.evByWd, backgroundColor: m.evByWd.map(function (_, i) { return (i === 5 || i === 6) ? '#c5a059' : 'rgba(255,255,255,0.18)'; }), borderRadius: 8 },
                { label: 'Turnos de residencia', data: m.resByWd, backgroundColor: 'rgba(168, 85, 247, 0.72)', borderRadius: 6 } ] },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', precision: 0, stepSize: 1 } }, x: { grid: { display: false }, ticks: { color: '#fff' } } },
                plugins: { legend: { display: true, position: 'top', labels: { color: 'rgba(255,255,255,0.75)', font: { size: 10 }, boxWidth: 8, usePointStyle: true, boxPadding: 8 } } } }
        });
    }

    function refresh(model) {
        return AP.data.loadActivity().then(function (raw) { var m = compute(raw, rangeKey()); paintCards(m, model); paintWeek(m); return m; }, function (e) {
            try { console.warn('[artist-panel] tarjetas', e && e.message); } catch (x) { /* sin consola */ }
        });
    }

    AP.kpis = { refresh: refresh, compute: compute };
})();
