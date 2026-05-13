/**
 * FLOW HANDLER - Miami DJ Beat Professional Analytics (Influencer Style)
 * Carga datos financieros / eventos y gráficas para la pestaña Cash Flow (dueño del perfil; LITE o PRO).
 * SoundForTips™: propinas aceptadas vía RPC get_my_soundfortips_accepted_for_flow → KPI Propinas + libro mayor + timeline.
 *
 * Salud artística (estrellas): no depende solo de reseñas públicas — mezcla valoración de clientes con señales del
 * ecosistema en este rango (eventos completados/pendientes, movimiento en ledger —incluye ingresos que registres
 * aunque no pasen por Stripe—, tips, comisiones por referidos/QR, residencia/venues). Contratos en cheque u “off
 * platform” cuentan si el DJ los refleja en leads o en líneas del ledger.
 */

let flowCharts = { timeline: null, activity: null, distribution: null };
let currentLedger = [];
let currentRange = '30d';

/** Tras mostrar la pestaña Cash Flow o redimensionar ventana: Chart.js necesita `resize` si el canvas estuvo oculto. */
function scheduleFlowChartsResize() {
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            try {
                if (flowCharts.timeline && typeof flowCharts.timeline.resize === 'function') {
                    flowCharts.timeline.resize();
                }
                if (flowCharts.activity && typeof flowCharts.activity.resize === 'function') {
                    flowCharts.activity.resize();
                }
                if (flowCharts.distribution && typeof flowCharts.distribution.resize === 'function') {
                    flowCharts.distribution.resize();
                }
            } catch (e) { /* noop */ }
        });
    });
}
window.mdjFlowChartsResize = scheduleFlowChartsResize;

(function mdjFlowResizeListener() {
    if (window._mdjFlowResizeListener) return;
    window._mdjFlowResizeListener = true;
    var t;
    window.addEventListener('resize', function () {
        clearTimeout(t);
        t = setTimeout(function () {
            if (typeof window.mdjFlowChartsResize === 'function') {
                window.mdjFlowChartsResize();
            }
        }, 200);
    });
})();

/** Convierte filas SFT apertura tipo dj_ledger (bruto en amount_cents; comisión 10% en metadata). */
/**
 * Residencia / comunidad desde perfil (weekly_schedule + is_resident + venues).
 * byWeekday[d] = nº de turnos marcados residente activos ese día (0–6 dom–sáb).
 */
function computeResidencyMetrics(profile) {
    const byWeekday = [0, 0, 0, 0, 0, 0, 0];
    if (!profile) {
        return {
            byWeekday,
            residentDays: 0,
            residentSlots: 0,
            venueCount: 0,
            isResidentFlag: false,
            communityIndex: 0,
        };
    }
    let residentDays = 0;
    let residentSlots = 0;
    const ws = profile.weekly_schedule;
    if (ws && typeof ws === 'object') {
        for (let d = 0; d < 7; d++) {
            const slots = ws[String(d)] ?? ws[d];
            if (!Array.isArray(slots)) continue;
            let n = 0;
            slots.forEach(function (s) {
                if (s && s.enabled && s.is_resident) {
                    n += 1;
                    residentSlots += 1;
                }
            });
            byWeekday[d] = n;
            if (n > 0) residentDays += 1;
        }
    }
    const isResidentFlag = !!profile.is_resident;
    if (isResidentFlag && residentDays === 0) {
        [4, 5, 6].forEach(function (d) {
            byWeekday[d] = Math.max(byWeekday[d], 1);
        });
        residentDays = 3;
        residentSlots += 3;
    }
    let venueCount = 0;
    if (Array.isArray(profile.venues)) {
        venueCount = profile.venues.length;
    } else if (profile.venues && typeof profile.venues === 'object') {
        venueCount = Object.keys(profile.venues).length;
    }
    const communityIndex = residentDays * 2 + residentSlots + venueCount + (isResidentFlag ? 2 : 0);
    return {
        byWeekday,
        residentDays,
        residentSlots,
        venueCount,
        isResidentFlag,
        communityIndex,
    };
}

/**
 * Estrellas compuestas: reseñas (rating/review_count) + ecosistema operativo en el periodo.
 * @returns {{ score: number, ecosystem: number, reviews: number, clientR: number }}
 */
function computeCompositeHealthScore(statsCurr, resM, profileRow, ledger, startDate) {
    const rm = resM || computeResidencyMetrics(null);
    const isCurrent = (date) => new Date(date) >= startDate;
    let incomeLines = 0;
    let payoutLines = 0;
    (ledger || []).forEach(function (tx) {
        if (!tx || !isCurrent(tx.created_at)) return;
        if (tx.type === 'income') incomeLines += 1;
        if (tx.type === 'payout' || tx.status === 'paid') payoutLines += 1;
    });

    const done = statsCurr.done || 0;
    const pend = statsCurr.pending || 0;
    const gross = statsCurr.gross || 0;
    const tips = statsCurr.tips || 0;
    const comm = statsCurr.commissions || 0;

    const s_work = Math.min(1, done * 0.095 + pend * 0.032);
    const s_ledger = Math.min(1, (incomeLines + payoutLines) * 0.075);
    const s_money = Math.min(1, Math.log1p(Math.max(0, gross)) / Math.log1p(12000));
    const s_tips = tips <= 0 ? 0 : Math.min(1, 0.18 + Math.min(0.82, tips / 420));
    const s_refs = comm <= 0 ? 0 : Math.min(1, 0.22 + Math.min(0.78, comm / 220));
    const s_res = Math.min(1, (rm.communityIndex || 0) / 22);

    const ecosystem = (
        0.24 * s_work +
        0.18 * s_ledger +
        0.16 * s_money +
        0.14 * s_tips +
        0.12 * s_refs +
        0.16 * s_res
    );

    const reviews = profileRow && profileRow.review_count != null ? Math.max(0, Number(profileRow.review_count)) : 0;
    const rawR = profileRow && profileRow.rating != null ? Number(profileRow.rating) : NaN;
    const clientR = (Number.isFinite(rawR) && rawR >= 1 && rawR <= 5) ? rawR : 4.0;

    const reviewWeight = Math.min(1, reviews / 7);
    const activityStars = 3.05 + 1.9 * ecosystem;
    let blended = reviewWeight * clientR + (1 - reviewWeight) * (0.4 * clientR + 0.6 * activityStars);
    blended = Math.min(5, Math.max(2.75, blended));

    if (done > 14 && blended < 4.05) blended = Math.max(blended, 4.02);
    if ((rm.isResidentFlag || rm.venueCount > 0) && blended < 4.28) blended = Math.max(blended, 4.18);
    if (incomeLines + payoutLines >= 6 && gross < 50 && done >= 3) {
        blended = Math.max(blended, 3.95);
    }

    return { score: blended, ecosystem, reviews, clientR };
}

function soundfortipsAcceptedToLedgerRows(userId, rows) {
    if (!rows || !rows.length) return [];
    return rows.map(function (row) {
        var gross = Number(row.tip_usd) || 0;
        var grossCents = Math.round(gross * 100);
        var song = row.song != null ? String(row.song).trim() : '';
        var label = song ? 'SoundForTips™ · ' + song.slice(0, 100) : 'SoundForTips™';
        return {
            id: 'sft-flow-' + String(row.id),
            dj_user_id: userId,
            type: 'income',
            amount_cents: grossCents,
            status: 'available',
            unlock_at: null,
            event_id: String(row.id),
            metadata: {
                source: 'tip',
                commission_rate: 10,
                event_name: label,
                soundfortips: true,
            },
            created_at: row.created_at,
        };
    });
}

async function loadFlowData(range = '30d', targetUserId = null) {
    currentRange = range;
    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const sessionUid = session.user.id;
    if (targetUserId && targetUserId !== sessionUid) {
        return;
    }
    const userId = sessionUid;

    // 1. DATE RANGES (antes del perfil: hace falta para rama “sin fila dj_profiles”)
    const now = new Date();
    let startDate = new Date();
    let prevStartDate = new Date();

    if (range === '7d') startDate.setDate(now.getDate() - 7);
    else if (range === '30d') startDate.setDate(now.getDate() - 30);
    else if (range === '90d') startDate.setDate(now.getDate() - 90);
    else if (range === '1y') startDate.setFullYear(now.getFullYear() - 1);

    const periodDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    prevStartDate.setDate(startDate.getDate() - periodDays);

    // 2. DJ PROFILE (maybeSingle: 0 filas ya no rompe todo el flujo)
    const { data: profile } = await supabase
        .from('dj_profiles')
        .select('id, commission_rate, rating, review_count, is_resident, venues, weekly_schedule')
        .eq('user_id', userId)
        .maybeSingle();

    if (!profile) {
        currentLedger = [];
        await processKPIs([], [], startDate, prevStartDate, 10, null);
        const emptyRes = computeResidencyMetrics(null);
        renderTimelineChart([], [], range, startDate, emptyRes);
        renderActivityChart([], range, startDate, emptyRes);
        renderDistributionChart([], [], range, startDate, emptyRes);
        renderLedgerTable([]);
        scheduleFlowChartsResize();
        return;
    }

    // 3. FETCH DATA (Ledger + Leads) — full history per DJ; charts filter by startDate client-side.
    // (Narrow gte on created_at hid legacy rows e.g. 2024-03 ledger outside 30d/1y prev window.)
    const [ledgerRes, leadsRes, sftRes] = await Promise.all([
        supabase.from('dj_ledger').select('*').eq('dj_user_id', userId).order('created_at', { ascending: false }),
        supabase.from('leads').select('*').eq('assigned_dj_id', profile.id).order('event_date', { ascending: false }),
        supabase.rpc('get_my_soundfortips_accepted_for_flow', { p_since: prevStartDate.toISOString() }),
    ]);

    if (sftRes.error) {
        console.warn('[Flow] SoundForTips RPC:', sftRes.error.message || sftRes.error);
    }

    if (ledgerRes.error) {
        var lb = document.getElementById('ledger-body');
        if (lb) {
            var lang = (typeof localStorage !== 'undefined' && localStorage.getItem('mdj_current_lang')) || 'es';
            var errMsg = lang === 'en'
                ? 'Could not load this data. If it continues, contact support.'
                : 'No se pudieron cargar los datos. Si persiste, contacta a soporte.';
            lb.innerHTML = '<tr><td colspan="7" style="padding:40px;text-align:center;color:rgba(255,255,255,0.35);">' + errMsg + '</td></tr>';
        }
        return;
    }

    var ledger = ledgerRes.data || [];
    var leads = leadsRes.data || [];
    if (leadsRes.error) {
        leads = [];
    }

    var sftLedger = soundfortipsAcceptedToLedgerRows(userId, sftRes.data || []);
    ledger = ledger.concat(sftLedger);
    ledger.sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
    });

    if (ledger.length) {
        var oldestLedgerMs = ledger.reduce(function (min, tx) {
            var t = new Date(tx.created_at).getTime();
            return t < min ? t : min;
        }, new Date(ledger[0].created_at).getTime());
        var oldestLedger = new Date(oldestLedgerMs);
        if (oldestLedger < startDate) {
            var spanDays = Math.max(1, Math.ceil((now - oldestLedger) / (1000 * 60 * 60 * 24)));
            startDate = new Date(oldestLedger);
            startDate.setHours(0, 0, 0, 0);
            prevStartDate = new Date(startDate);
            prevStartDate.setDate(startDate.getDate() - spanDays);
        }
    }

    currentLedger = ledger.filter(tx => new Date(tx.created_at) >= startDate);

    const residencyMetrics = computeResidencyMetrics(profile);

    // 4. PROCESS KPIs
    await processKPIs(ledger, leads, startDate, prevStartDate, profile.commission_rate, profile);

    // 5. RENDER CHARTS
    renderTimelineChart(ledger, leads, range, startDate, residencyMetrics);
    renderActivityChart(leads, range, startDate, residencyMetrics);
    renderDistributionChart(ledger, leads, range, startDate, residencyMetrics);

    // 6. RENDER LEDGER TABLE
    renderLedgerTable(currentLedger);

    scheduleFlowChartsResize();
}

async function processKPIs(ledger, leads, startDate, prevStartDate, commRate, profileRow) {
    const isCurrent = (date) => new Date(date) >= startDate;
    const isPrevious = (date) => {
        const d = new Date(date);
        return d >= prevStartDate && d < startDate;
    };

    const stats = {
        curr: { gross: 0, done: 0, pending: 0, available: 0, paidOut: 0, commissions: 0, tips: 0, count: 0 },
        prev: { gross: 0, done: 0, pending: 0, available: 0, paidOut: 0, commissions: 0, tips: 0, count: 0 }
    };

    // Process Ledger (+ filas sintéticas SoundForTips con metadata.soundfortips)
    ledger.forEach(tx => {
        const amount = tx.amount_cents / 100;
        if (isCurrent(tx.created_at)) {
            if (tx.type === 'income') stats.curr.gross += amount;
            if (tx.status === 'available') stats.curr.available += amount;
            if (tx.type === 'payout' || tx.status === 'paid') stats.curr.paidOut += amount;

            if (tx.metadata?.source === 'tip') {
                if (tx.metadata?.soundfortips === true) {
                    const rate = tx.metadata.commission_rate != null ? Number(tx.metadata.commission_rate) : 10;
                    stats.curr.tips += amount * (100 - rate) / 100;
                } else {
                    stats.curr.tips += amount;
                }
            }
            if (tx.metadata?.source === 'commission') stats.curr.commissions += amount;
        } else if (isPrevious(tx.created_at)) {
            if (tx.type === 'income') stats.prev.gross += amount;
            if (tx.type === 'payout' || tx.status === 'paid') stats.prev.paidOut += amount;
            if (tx.metadata?.source === 'tip') {
                if (tx.metadata?.soundfortips === true) {
                    const rateP = tx.metadata.commission_rate != null ? Number(tx.metadata.commission_rate) : 10;
                    stats.prev.tips += amount * (100 - rateP) / 100;
                } else {
                    stats.prev.tips += amount;
                }
            }
            if (tx.metadata?.source === 'commission') stats.prev.commissions += amount;
        }
    });

    // Process Leads
    leads.forEach(ev => {
        if (isCurrent(ev.event_date || ev.assigned_at)) {
            if (ev.status === 'COMPLETED') stats.curr.done++;
            else stats.curr.pending++;
        } else if (isPrevious(ev.event_date || ev.assigned_at)) {
            if (ev.status === 'COMPLETED') stats.prev.done++;
        }
    });

    // Update UI
    const format = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
    const setKPI = (id, val, trendId, currVal, prevVal) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;

        const trendEl = document.getElementById(trendId);
        if (trendEl && prevVal > 0) {
            const pct = ((currVal - prevVal) / prevVal * 100).toFixed(1);
            const isUp = pct >= 0;
            trendEl.className = `flow-card-trend ${isUp ? 'up' : 'down'}`;
            trendEl.innerHTML = `<span>${isUp ? '↑' : '↓'}</span> ${Math.abs(pct)}% vs mes anterior`;
        } else if (trendEl) {
            trendEl.innerHTML = `<span style="opacity:0.3">Sin datos previos</span>`;
        }
    };

    setKPI('kpi-gross', format(stats.curr.gross), 'trend-gross', stats.curr.gross, stats.prev.gross);
    setKPI('kpi-events-done', stats.curr.done, 'trend-events', stats.curr.done, stats.prev.done);

    if (document.getElementById('kpi-events-pending')) document.getElementById('kpi-events-pending').textContent = stats.curr.pending;
    if (document.getElementById('kpi-comm-rate')) document.getElementById('kpi-comm-rate').textContent = `${commRate || 10}%`;
    if (document.getElementById('kpi-available')) document.getElementById('kpi-available').textContent = format(stats.curr.available);

    // --- DASHBOARD UI RECONNECTION MAPPINGS ---
    if (document.getElementById('kpi-net')) document.getElementById('kpi-net').textContent = format(stats.curr.available);
    if (document.getElementById('kpi-pending')) document.getElementById('kpi-pending').textContent = format(stats.curr.gross - stats.curr.available);
    if (document.getElementById('kpi-paid')) document.getElementById('kpi-paid').textContent = format(stats.curr.gross);
    if (document.getElementById('kpi-paid-out')) document.getElementById('kpi-paid-out').textContent = format(stats.curr.paidOut);
    if (document.getElementById('kpi-dash-comm')) document.getElementById('kpi-dash-comm').textContent = `${commRate || 10}%`;
    // ------------------------------------------

    setKPI('kpi-tips', format(stats.curr.tips), 'trend-tips', stats.curr.tips, stats.prev.tips);
    setKPI('kpi-commissions', format(stats.curr.commissions), 'trend-commissions', stats.curr.commissions, stats.prev.commissions);

    const resM = computeResidencyMetrics(profileRow);
    const health = computeCompositeHealthScore(stats.curr, resM, profileRow, ledger, startDate);
    if (document.getElementById('kpi-residency-days')) {
        document.getElementById('kpi-residency-days').textContent = String(resM.residentDays);
    }
    if (document.getElementById('kpi-residency-slots')) {
        document.getElementById('kpi-residency-slots').textContent = String(resM.residentSlots);
    }
    if (document.getElementById('kpi-residency-venues')) {
        document.getElementById('kpi-residency-venues').textContent = String(resM.venueCount);
    }
    const tr = document.getElementById('trend-residency');
    if (tr) {
        tr.className = 'flow-card-trend';
        tr.style.color = 'rgba(255,255,255,0.38)';
        tr.innerHTML = resM.isResidentFlag
            ? '<span>Perfil + agenda</span> · residente activo'
            : '<span>Según agenda</span> · turnos marcados residente';
    }

    // Índice salud artística = reseñas + ecosistema (eventos, ledger, tips, refs, residencia)
    try {
        const ratEl = document.getElementById('kpi-rating');
        const trendRt = document.getElementById('trend-rating');
        if (profileRow) {
            if (ratEl) ratEl.textContent = `${health.score.toFixed(1)} ★`;
            if (trendRt) {
                trendRt.className = 'flow-card-trend';
                trendRt.style.cssText = 'color:rgba(255,255,255,0.38);font-size:11px;line-height:1.45;';
                trendRt.innerHTML =
                    '<span id="kpi-review-count">' + String(health.reviews) +
                    '</span> reseñas · + eventos, ledger, tips, referidos, residencia (cheque/local si lo registras)';
            }
        } else {
            if (ratEl) ratEl.textContent = health.score >= 2.75 ? `${health.score.toFixed(1)} ★` : '—';
            if (trendRt) {
                trendRt.className = 'flow-card-trend';
                trendRt.style.cssText = 'color:rgba(255,255,255,0.35);font-size:11px;line-height:1.45;';
                trendRt.innerHTML =
                    '<span id="kpi-review-count">0</span> reseñas · índice solo por actividad en este rango';
            }
        }
        // Mismo índice en el hero del perfil (solo tú lo ves: _flowTabAllowed = dueño de esta página).
        if (typeof window.mdjPaintProfileHeroStarsFromHealth === 'function' && window._flowTabAllowed) {
            window.mdjPaintProfileHeroStarsFromHealth(health.score, {
                reviewAvg: health.clientR,
                reviewCount: health.reviews,
            });
        }
    } catch (e) {
        /* omitir detalle en consola (datos personales / cumplimiento) */
    }

    const avgTicket = stats.curr.done > 0 ? stats.curr.gross / stats.curr.done : 0;
    const prevAvg = stats.prev.done > 0 ? stats.prev.gross / stats.prev.done : 0;
    setKPI('kpi-avg-ticket', format(avgTicket), 'trend-avg', avgTicket, prevAvg);
}

function renderTimelineChart(ledger, leads, range, startDate, residencyMetrics) {
    if (typeof Chart === 'undefined') return;
    const ctx = document.getElementById('chart-timeline')?.getContext('2d');
    if (!ctx) return;

    const rm = residencyMetrics || computeResidencyMetrics(null);
    const now = new Date();
    const periodDays = Math.max(1, Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)));
    const bucketByMonth = periodDays > 120;

    const buckets = {};
    if (bucketByMonth) {
        let iter = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        while (iter <= now) {
            const key = iter.getFullYear() + '-' + String(iter.getMonth() + 1).padStart(2, '0');
            buckets[key] = { income: 0, new: 0, done: 0 };
            iter.setMonth(iter.getMonth() + 1);
        }
    } else {
        let iter = new Date(startDate);
        while (iter <= now) {
            const dStr = iter.toISOString().split('T')[0];
            buckets[dStr] = { income: 0, new: 0, done: 0 };
            iter.setDate(iter.getDate() + 1);
        }
    }

    ledger.filter(tx => tx.type === 'income' && new Date(tx.created_at) >= startDate).forEach(tx => {
        const d = new Date(tx.created_at);
        const key = bucketByMonth
            ? (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'))
            : d.toISOString().split('T')[0];
        if (buckets[key]) buckets[key].income += tx.amount_cents / 100;
    });

    leads.filter(ev => {
        const ref = ev.assigned_at || ev.event_date;
        if (!ref) return false;
        return new Date(ref) >= startDate;
    }).forEach(ev => {
        const ref = ev.assigned_at || ev.event_date;
        const d = new Date(ref);
        const key = bucketByMonth
            ? (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'))
            : d.toISOString().split('T')[0];
        if (buckets[key]) buckets[key].new++;
    });

    leads.filter(ev => ev.status === 'COMPLETED' && new Date(ev.event_date) >= startDate).forEach(ev => {
        const d = new Date(ev.event_date);
        const key = bucketByMonth
            ? (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'))
            : d.toISOString().split('T')[0];
        if (buckets[key]) buckets[key].done++;
    });

    const labels = Object.keys(buckets);
    const incomeData = labels.map(l => buckets[l].income);
    const newData = labels.map(l => buckets[l].new);
    const doneData = labels.map(l => buckets[l].done);

    const residencySeries = labels.map(function (key) {
        if (bucketByMonth) {
            return (rm.isResidentFlag ? 6 : 0);
        }
        const dt = new Date(key + 'T12:00:00');
        const w = dt.getDay();
        const base = (rm.byWeekday[w] || 0) * 9;
        return base + (rm.isResidentFlag ? 6 : 0);
    });

    if (flowCharts.timeline) flowCharts.timeline.destroy();

    flowCharts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(function (l) {
                if (bucketByMonth) {
                    var parts = l.split('-');
                    var dt = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
                    return dt.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
                }
                return new Date(l).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            }),
            datasets: [
                {
                    label: 'Salud Económica ($)',
                    data: incomeData,
                    borderColor: '#c5a059',
                    backgroundColor: 'rgba(197, 160, 89, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Nuevos Eventos',
                    data: newData,
                    borderColor: '#3b82f6',
                    borderDash: [5, 5],
                    tension: 0.4,
                    yAxisID: 'y1'
                },
                {
                    label: 'Eventos Completados',
                    data: doneData,
                    backgroundColor: 'rgba(0, 255, 136, 0.4)',
                    type: 'bar',
                    yAxisID: 'y1'
                },
                {
                    label: 'Residencia · comunidad (perfil)',
                    data: residencySeries,
                    type: 'line',
                    borderColor: 'rgba(168, 85, 247, 0.95)',
                    backgroundColor: 'rgba(168, 85, 247, 0.06)',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    tension: 0.35,
                    fill: false,
                    yAxisID: 'y1',
                    pointRadius: 0,
                    order: 10
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { type: 'linear', display: true, position: 'left', grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.4)' } },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#94a3b8' },
                    suggestedMin: 0
                },
                x: { ticks: { color: 'rgba(255,255,255,0.4)', maxRotation: 0 } }
            },
            plugins: {
                legend: { position: 'top', labels: { color: '#fff', usePointStyle: true, boxWidth: 6 } }
            }
        }
    });
}

function renderActivityChart(leads, range, startDate, residencyMetrics) {
    if (typeof Chart === 'undefined') return;
    const ctx = document.getElementById('chart-activity')?.getContext('2d');
    if (!ctx) return;

    const rm = residencyMetrics || computeResidencyMetrics(null);
    const weekdayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const activity = [0, 0, 0, 0, 0, 0, 0];

    leads.filter(ev => ev.event_date && new Date(ev.event_date) >= startDate).forEach(ev => {
        const day = new Date(ev.event_date).getDay();
        activity[day]++;
    });

    const resBars = rm.byWeekday.slice();

    if (flowCharts.activity) flowCharts.activity.destroy();

    flowCharts.activity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weekdayNames,
            datasets: [
                {
                    label: 'Eventos (día de evento)',
                    data: activity,
                    backgroundColor: activity.map((v, i) => (i === 5 || i === 6) ? '#c5a059' : 'rgba(255,255,255,0.12)'),
                    borderRadius: 8
                },
                {
                    label: 'Turnos residencia declarados',
                    data: resBars,
                    backgroundColor: 'rgba(168, 85, 247, 0.72)',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.4)' } },
                x: { ticks: { color: '#fff' } }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: 'rgba(255,255,255,0.75)', font: { size: 10 }, boxWidth: 8 }
                }
            }
        }
    });
}

function renderDistributionChart(ledger, leads, range, startDate, residencyMetrics) {
    if (typeof Chart === 'undefined') return;
    const ctx = document.getElementById('chart-distribution')?.getContext('2d');
    if (!ctx) return;

    const rm = residencyMetrics || computeResidencyMetrics(null);

    const distribution = {
        'Privado': 0,
        'Corporativo': 0,
        'Festivales': 0,
        'Otros': 0,
        'Comunidad / residencia': Math.max(0, rm.communityIndex)
    };

    leads.filter(ev => ev.status === 'COMPLETED' && new Date(ev.event_date) >= startDate).forEach(ev => {
        const type = ev.event_type || 'Otros';
        if (type.toLowerCase().includes('private') || type.toLowerCase().includes('boda') || type.toLowerCase().includes('cumple')) distribution['Privado']++;
        else if (type.toLowerCase().includes('corp') || type.toLowerCase().includes('empresa')) distribution['Corporativo']++;
        else if (type.toLowerCase().includes('fest') || type.toLowerCase().includes('conciert')) distribution['Festivales']++;
        else distribution['Otros']++;
    });

    const labelOrder = ['Privado', 'Corporativo', 'Festivales', 'Otros', 'Comunidad / residencia'];
    const colorOrder = ['#c5a059', '#3b82f6', '#a855f7', '#64748b', 'rgba(192, 132, 252, 0.92)'];
    const filtered = labelOrder
        .map(function (key, i) { return { key: key, val: distribution[key] || 0, color: colorOrder[i] }; })
        .filter(function (row) { return row.val > 0; });

    if (flowCharts.distribution) flowCharts.distribution.destroy();

    if (!filtered.length) {
        flowCharts.distribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Sin datos en este rango'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['rgba(255,255,255,0.08)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
        return;
    }

    flowCharts.distribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: filtered.map(function (r) { return r.key; }),
            datasets: [{
                data: filtered.map(function (r) { return r.val; }),
                backgroundColor: filtered.map(function (r) { return r.color; }),
                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#fff', font: { size: 10 } } }
            }
        }
    });
}

function renderLedgerTable(ledger) {
    const body = document.getElementById('ledger-body');
    if (!body) return;

    if (!ledger || ledger.length === 0) {
        body.innerHTML = `<tr><td colspan="7" style="padding:60px; text-align:center; color:rgba(255,255,255,0.2);">No hay transacciones registradas.</td></tr>`;
        return;
    }

    body.innerHTML = ledger.map(tx => {
        const date = new Date(tx.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        const gross = (tx.amount_cents / 100);
        const commRate = tx.metadata?.commission_rate || 10;
        const comm = (gross * commRate / 100);
        const net = gross - comm;

        const unlock = tx.unlock_at ? new Date(tx.unlock_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—';

        return `
            <tr>
                <td style="font-weight:700; color:#fff;">${date}</td>
                <td>
                    <div style="font-weight:700;">${tx.metadata?.event_name || tx.event_id || 'Servicio'}</div>
                    <div style="font-size:10px; opacity:0.4;">${String(tx.type || '').toUpperCase()}</div>
                </td>
                <td style="font-weight:700;">$${gross.toFixed(2)}</td>
                <td style="color:#ff5555;">-$${comm.toFixed(2)} (${commRate}%)</td>
                <td style="font-weight:900; color:#00ff88;">$${net.toFixed(2)}</td>
                <td><span class="status-pill ${tx.status}">${tx.status}</span></td>
                <td>${unlock}</td>
            </tr>
        `;
    }).join('');
}

function filterLedger(type, clickedEl) {
    document.querySelectorAll('.ledger-filter-btn').forEach(b => b.classList.remove('active'));
    var el = clickedEl;
    if (!el && typeof window !== 'undefined' && window.event && window.event.target) {
        el = window.event.target;
    }
    if (el && el.classList) el.classList.add('active');

    const filtered = type === 'all' ? currentLedger : currentLedger.filter(tx => tx.type === type);
    renderLedgerTable(filtered);
}

// Refrescar Cash Flow tras aceptar SOUNDFORTIPS en cabina (mantiene el rango del selector).
window.mdjFlowReloadIfAllowed = function (targetUserId) {
    if (!targetUserId || !window._flowTabAllowed || typeof loadFlowData !== 'function') return;
    loadFlowData(currentRange, targetUserId);
};

/** Ruta SVG estrella (24×24). */
function mdjStarPathD() {
    return 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';
}

/**
 * Hero #pub-hero-rating: alinea estrellas con el índice MDJ (mismo que kpi-rating en Flujo de caja).
 * Visitantes siguen viendo solo reseñas vía renderDynamicReviewsAndKPI; esto solo corre si _flowTabAllowed.
 */
window.mdjPaintProfileHeroStarsFromHealth = function (score, meta) {
    const el = document.getElementById('pub-hero-rating');
    if (!el) return;
    const path = mdjStarPathD();
    const blank = '<svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)" style="vertical-align:middle" aria-hidden="true"><path d="' + path + '"/></svg>';
    const full = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;color:var(--gold)" aria-hidden="true"><path d="' + path + '"/></svg>';
    const half = '<span style="display:inline-block;width:14px;height:14px;position:relative;vertical-align:middle" aria-hidden="true">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)" style="position:absolute;left:0;top:0"><path d="' + path + '"/></svg>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="position:absolute;left:0;top:0;color:var(--gold);clip-path:inset(0 50% 0 0)"><path d="' + path + '"/></svg></span>';
    const s = Math.min(5, Math.max(0, Number(score) || 0));
    var parts = [];
    for (var i = 1; i <= 5; i++) {
        if (s >= i) parts.push(full);
        else if (s >= i - 0.5) parts.push(half);
        else parts.push(blank);
    }
    el.innerHTML = parts.join('');
    el.classList.add('mdj-hero-rating--mdj-health');
    var ra = meta && meta.reviewAvg != null && Number.isFinite(Number(meta.reviewAvg)) ? Number(meta.reviewAvg).toFixed(1) : '';
    var rc = meta && meta.reviewCount != null ? String(meta.reviewCount) : '';
    el.title = 'Índice MDJ (Flujo de caja / salud profesional): ' + s.toFixed(1) + ' ★' +
        (ra !== '' ? ' — Promedio en reseñas públicas: ' + ra + ' ★' + (rc !== '' ? ' (' + rc + ' opiniones)' : '') : '');
};

// Global expose
window.loadFlowData = loadFlowData;
window.filterLedger = filterLedger;

/** Reintento cuando la sesión llega después de switchDashTab(?tab=flow) o hub.connect. */
(function mdjFlowWireSession() {
    function tryFlowFromDom() {
        var qs = new URLSearchParams(window.location.search);
        var panel = document.getElementById('tab-flow');
        var wantFlow = qs.get('tab') === 'flow' || (panel && panel.classList.contains('active'));
        if (!wantFlow || typeof loadFlowData !== 'function') return;
        var mr = document.getElementById('metrics-range');
        loadFlowData(mr && mr.value ? mr.value : '1y');
    }

    var sb = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (sb && sb.auth && sb.auth.onAuthStateChange) {
        sb.auth.onAuthStateChange(function (event, session) {
            if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
                tryFlowFromDom();
            }
        });
    }
    setTimeout(tryFlowFromDom, 500);
    setTimeout(tryFlowFromDom, 2000);
})();
