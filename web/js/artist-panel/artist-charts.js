/* Panel del artista · GRÁFICAS (con datos reales, mismo estilo que el panel de tráfico SEO·IA).
 *  1) Dona «Eventos vs comunidad / residencia»: de dónde viene el dinero del artista (turnos de residencia, eventos y contratos, pendiente de liquidación, propinas),
 *     con leyenda a la derecha y barras de detalle debajo. Reemplaza al dibujo de flow-handler.js, que usaba un índice de comunidad inventado.
 *  2) Gráfica «Crecimiento y Posicionamiento»: le suma dos series reales, Visitas al perfil y Escaneos QR SoundForTips™ (por día).
 * No reescribe flow-handler.js: actúa DESPUÉS de que él dibuja (artist-cashflow.js lo encadena). Texto con textContent. Compatible con Safari 13. */
(function () {
    'use strict';
    var AP = window.ArtistPanel = window.ArtistPanel || {};
    var C = { residencia: '#c084fc', eventos: '#c5a059', pendiente: '#f97316', propinas: '#22c55e', perfil: '#818cf8', qr: '#f0cc80' };

    var T = {
        es: { resid: 'Comunidad / residencia', events: 'Eventos y contratos', pend: 'Pendiente de liquidación', tips: 'Propinas SoundForTips™', none: 'Sin ingresos todavía',
              hint: 'Ingresos acumulados por origen', views: 'Visitas al perfil', qr: 'Escaneos QR SoundForTips™' },
        en: { resid: 'Community / residency', events: 'Events and contracts', pend: 'Pending settlement', tips: 'SoundForTips™ tips', none: 'No earnings yet',
              hint: 'Total earnings by source', views: 'Profile visits', qr: 'SoundForTips™ QR scans' }
    };
    function lang() { var l = String(document.documentElement.getAttribute('lang') || 'es').toLowerCase(); return l.indexOf('en') === 0 ? 'en' : 'es'; }
    function t(k) { return T[lang()][k]; }
    function money(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

    function css() {
        if (document.getElementById('ap-charts-style')) return;
        var s = document.createElement('style'); s.id = 'ap-charts-style';
        s.textContent =
            '#ap-contrib-chip{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:0 0 10px;font-size:11.5px;color:rgba(255,255,255,.7);}' +
            '#ap-contrib-chip .ap-cc-role{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#c5a059;border:1px solid rgba(197,160,89,.5);border-radius:999px;padding:3px 10px;}' +
            '#ap-contrib-chip .ap-cc-val{font-weight:700;color:rgba(255,255,255,.88);}' +
            'html[data-theme="day"] #ap-contrib-chip,html[data-theme="day"] #ap-contrib-chip .ap-cc-val{color:rgba(0,0,0,.7);}' +
            '#ap-dist-bars{margin-top:14px;display:flex;flex-direction:column;gap:9px;}' +
            '#ap-dist-bars .ap-hint{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.5);font-weight:700;margin-bottom:2px;}' +
            '#ap-dist-bars .ap-row{display:grid;grid-template-columns:150px 1fr 118px;align-items:center;gap:10px;font-size:12px;}' +
            '#ap-dist-bars .ap-name{color:rgba(255,255,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
            '#ap-dist-bars .ap-track{background:rgba(255,255,255,.08);border-radius:6px;height:10px;overflow:hidden;}' +
            '#ap-dist-bars .ap-fill{height:100%;border-radius:6px;}' +
            '#ap-dist-bars .ap-num{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:#fff;}' +
            '#ap-dist-bars .ap-num small{font-weight:600;opacity:.6;margin-left:5px;}' +
            '@media (max-width:560px){#ap-dist-bars .ap-row{grid-template-columns:110px 1fr 96px;}}' +
            'html[data-theme="day"] #ap-dist-bars .ap-name,html[data-theme="day"] #ap-dist-bars .ap-hint{color:rgba(0,0,0,.6);}' +
            'html[data-theme="day"] #ap-dist-bars .ap-num{color:#111;}html[data-theme="day"] #ap-dist-bars .ap-track{background:rgba(0,0,0,.08);}';
        document.head.appendChild(s);
    }

    function slices(m) {
        return [
            { name: t('resid'), val: m.residencia, color: C.residencia },
            { name: t('events'), val: m.contratos, color: C.eventos },
            { name: t('pend'), val: m.pendiente, color: C.pendiente },
            { name: t('tips'), val: m.propinas, color: C.propinas }
        ].filter(function (r) { return r.val > 0; });
    }

    function bars(canvas, rows, total) {
        css();
        var holder = canvas.parentElement && canvas.parentElement.parentElement ? canvas.parentElement.parentElement : canvas.parentElement; if (!holder) return;
        var b = document.getElementById('ap-dist-bars'); if (b) b.parentNode.removeChild(b);
        b = el('div'); b.id = 'ap-dist-bars';
        b.appendChild(el('div', 'ap-hint', t('hint')));
        if (!rows.length) b.appendChild(el('div', 'ap-hint', t('none')));
        rows.forEach(function (r) {
            var row = el('div', 'ap-row'), track = el('div', 'ap-track'), fill = el('div', 'ap-fill'), num = el('span', 'ap-num', money(r.val));
            fill.style.width = Math.max(4, Math.round(r.val / total * 100)) + '%'; fill.style.background = r.color;
            num.appendChild(el('small', null, Math.round(r.val / total * 100) + '%'));
            track.appendChild(fill); row.appendChild(el('span', 'ap-name', r.name)); row.appendChild(track); row.appendChild(num); b.appendChild(row);
        });
        holder.appendChild(b);
    }

    /* La dona va en SU PROPIO lienzo (#ap-dist-canvas). El lienzo original (#chart-distribution) sigue siendo de flow-handler.js, que lo redibuja en cada carga; si yo dibujara encima,
       su siguiente carga fallaba con «Canvas is already in use». El original se oculta (flow-handler sigue pintando ahí, sin conflicto). */
    /* Si la dona se crea con el contenedor oculto, Chart.js la deja en 0x0; se vigila el CONTENEDOR y, en cuanto tiene ancho, se vuelve a medir. */
    function kick(chart, host) {
        var tries = 0, iv = setInterval(function () {
            tries++;
            try {
                if (!chart.canvas || !chart.canvas.parentNode) { clearInterval(iv); return; }
                var w = host.clientWidth;
                if (w > 0 && (!chart.chartArea || chart.chartArea.width <= 0 || Math.abs(chart.width - w) > 2)) { chart.stop(); chart.resize(); chart.update('none'); }
                else if (w > 0 && chart.chartArea && chart.chartArea.width > 0 && tries > 3) clearInterval(iv);
            } catch (e) { clearInterval(iv); }
            if (tries > 120) clearInterval(iv);
        }, 400);
    }
    function renderDonut(m) {
        if (typeof Chart === 'undefined') return;
        var orig = document.getElementById('chart-distribution'); if (!orig || !orig.parentElement) return;
        var mine = document.getElementById('ap-dist-canvas');
        if (!mine) { mine = document.createElement('canvas'); mine.id = 'ap-dist-canvas'; orig.parentElement.insertBefore(mine, orig); }
        orig.style.display = 'none';
        var old = Chart.getChart ? Chart.getChart(mine) : null; if (old) old.destroy();
        var rows = slices(m), total = rows.reduce(function (a, r) { return a + r.val; }, 0), ctx = mine.getContext('2d');
        if (!rows.length) {
            kick(new Chart(ctx, { type: 'doughnut', data: { labels: [t('none')], datasets: [{ data: [1], backgroundColor: ['rgba(255,255,255,0.08)'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { enabled: false } } } }), mine.parentElement);
            bars(mine, rows, 1); return;
        }
        var donut = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: rows.map(function (r) { return r.name; }), datasets: [{ data: rows.map(function (r) { return r.val; }), backgroundColor: rows.map(function (r) { return r.color; }), borderWidth: 0, hoverOffset: 6 }] },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '70%',
                plugins: {
                    legend: { position: 'right', labels: { color: 'rgba(255,255,255,.7)', font: { size: 10 }, boxWidth: 8, usePointStyle: true, boxPadding: 8 } },
                    tooltip: { callbacks: { label: function (c) { return ' ' + c.label + ': ' + money(c.parsed) + ' (' + Math.round(c.parsed / total * 100) + '%)'; } } }
                }
            }
        });
        kick(donut, mine.parentElement);
        bars(mine, rows, total);
    }

    /* Suma a la gráfica de «Crecimiento y Posicionamiento», SOLO LECTURA y con datos reales:
         - Visitas al perfil y Escaneos QR SoundForTips™ (por día);
         - si la cuenta es CONTRIBUYENTE (owner, DJMago305): un espacio pequeño sobre la gráfica con su rol y sus aportes (horas del mes y total, pagos de suscripción
           si los hay) y la serie «Horas aportadas». Las horas las registra el Staff desde «Contribuciones»; aquí nadie escribe nada.
       Las etiquetas del gráfico las arma flow-handler (día+mes o mes+año), así que se alinea por etiqueta con el mismo formato. Quita antes las series propias para no duplicar. */
    var T2 = { es: { role: 'Contribuyente', nosal: 'sin salario por ahora', salary: 'Salario mensual', month: 'este mes', total: 'en total', subs: 'Suscripción', pay1: 'pago', payN: 'pagos', nopay: 'sin pagos registrados', hrsSeries: 'Horas aportadas', evts: 'Aporte en eventos', next: 'próximos', ledger: 'Aporte registrado' },
               en: { role: 'Contributor', nosal: 'no salary for now', salary: 'Monthly salary', month: 'this month', total: 'in total', subs: 'Subscription', pay1: 'payment', payN: 'payments', nopay: 'no payments recorded', hrsSeries: 'Hours contributed', evts: 'Event contribution', next: 'upcoming', ledger: 'Recorded contribution' } };
    function t2(k) { return T2[lang()][k]; }
    function hh(n) { return (Math.round((Number(n) || 0) * 100) / 100) + ' h'; }
    function labelOf(day, monthly) {
        var k = String(day).slice(0, 10);
        if (monthly) return new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        return new Date(k).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
    function bucket(rows, monthly, fields) {
        var out = fields.map(function () { return {}; });
        (rows || []).forEach(function (r) { var lab = labelOf(r.day, monthly); fields.forEach(function (f, i) { out[i][lab] = (out[i][lab] || 0) + Number(r[f] || 0); }); });
        return out;
    }
    function contribChip(canvas, sum) {
        var old = document.getElementById('ap-contrib-chip'); if (old && old.parentNode) old.parentNode.removeChild(old);
        if (!sum || !sum.mode) return;
        css();
        var holder = canvas.parentElement; if (!holder || !holder.parentNode) return;
        var chip = el('div'); chip.id = 'ap-contrib-chip';
        chip.appendChild(el('span', 'ap-cc-role', t2('role') + ' · ' + (sum.monthly_salary_cents != null ? t2('salary') + ' ' + money(Number(sum.monthly_salary_cents) / 100) : t2('nosal'))));
        chip.appendChild(el('span', 'ap-cc-val', hh(sum.hours_month) + ' ' + t2('month') + ' · ' + hh(sum.hours_total) + ' ' + t2('total')));
        /* Aporte en eventos: eventos realizados (sin ingreso registrado) × tarifa del contribuyente. Si el Staff registra un ingreso para un evento, ese evento deja de ser aporte. */
        if (sum.event_rate_cents != null) {
            var ne = Math.max(0, (Number(sum.events_done) || 0) - (Number(sum.events_paid) || 0)), up = Number(sum.events_upcoming) || 0;
            chip.appendChild(el('span', 'ap-cc-val', t2('evts') + ': ' + ne + ' × ' + money(Number(sum.event_rate_cents) / 100) + ' = ' + money(Number(sum.event_contrib_cents) / 100) + (up > 0 ? ' · ' + up + ' ' + t2('next') : '')));
        }
        if (Number(sum.ledger_contrib_cents) > 0) chip.appendChild(el('span', 'ap-cc-val', t2('ledger') + ': ' + money(Number(sum.ledger_contrib_cents) / 100)));
        /* Suscripción PRO: métrica ANUAL (cifra para el IRS), por año calendario de Miami. Con 0 pagos registrados lo dice, sin inventar nada. */
        var yr = sum.sub_year || new Date().getFullYear(), n = Number(sum.sub_payments_year) || 0;
        chip.appendChild(el('span', 'ap-cc-val', t2('subs') + ' PRO ' + yr + ': ' + (n > 0 ? money(Number(sum.sub_paid_year_cents) / 100) + ' · ' + n + ' ' + (n === 1 ? t2('pay1') : t2('payN')) : t2('nopay'))));
        holder.parentNode.insertBefore(chip, holder);
    }
    function addSeries(visitRows, contribSum, contribRows) {
        if (typeof Chart === 'undefined' || !Chart.getChart) return;
        var canvas = document.getElementById('chart-timeline'); if (!canvas) return;
        contribChip(canvas, contribSum);
        var chart = Chart.getChart(canvas); if (!chart || !chart.data || !chart.data.labels) return;
        chart.data.datasets = chart.data.datasets.filter(function (d) { return !d._ap; });
        var labels = chart.data.labels, monthly = labels.length && !/^\d/.test(String(labels[0]));
        var v = bucket(visitRows, monthly, ['profile_visits', 'sft_qr_visits']);
        chart.data.datasets.push({ _ap: true, label: t('views'), data: labels.map(function (l) { return v[0][l] || 0; }), borderColor: C.perfil, backgroundColor: 'rgba(129,140,248,.10)', fill: false,
            tension: 0.4, borderWidth: 2, pointRadius: 2, pointHoverRadius: 5, yAxisID: 'y1', order: 3 });
        chart.data.datasets.push({ _ap: true, label: t('qr'), data: labels.map(function (l) { return v[1][l] || 0; }), borderColor: C.qr, backgroundColor: 'rgba(240,204,128,.10)', fill: false,
            tension: 0.4, borderWidth: 2, pointRadius: 2, pointHoverRadius: 5, yAxisID: 'y1', order: 3 });
        if (contribSum && contribSum.mode) {
            var h = bucket(contribRows, monthly, ['hours']);
            chart.data.datasets.push({ _ap: true, type: 'bar', label: t2('hrsSeries'), data: labels.map(function (l) { return h[0][l] || 0; }), backgroundColor: 'rgba(56,189,248,.45)', borderRadius: 4, yAxisID: 'y1', order: 4 });
        }
        chart.update();
    }

    AP.charts = { renderDonut: renderDonut, addSeries: addSeries };
})();
