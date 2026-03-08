/**
 * FLOW HANDLER - Miami DJ Beat Professional Analytics (Influencer Style)
 * Responsable de la carga de datos financieros, eventos y renderizado de gráficas PRO.
 */

let flowCharts = { timeline: null, activity: null, distribution: null };
let currentLedger = [];
let currentRange = '30d';

async function loadFlowData(range = '30d', targetUserId = null) {
    currentRange = range;
    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    const userId = targetUserId || (session ? session.user.id : null);
    if (!userId) return;
    console.log(`[PRO FLOW] Loading Analytics Insight (${range}) for user ${userId}`);

    // 1. GET DJ PROFILE ID
    const { data: profile } = await supabase
        .from('dj_profiles')
        .select('id, commission_rate')
        .eq('user_id', userId)
        .single();

    if (!profile) return;

    // 2. DEFINE DATE RANGES (Current vs Previous for trends)
    const now = new Date();
    let startDate = new Date();
    let prevStartDate = new Date();

    if (range === '7d') startDate.setDate(now.getDate() - 7);
    else if (range === '30d') startDate.setDate(now.getDate() - 30);
    else if (range === '90d') startDate.setDate(now.getDate() - 90);
    else if (range === '1y') startDate.setFullYear(now.getFullYear() - 1);

    // Calculate previous period for trends (e.g., if 30d, compare with previous 30d)
    const periodDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    prevStartDate.setDate(startDate.getDate() - periodDays);

    // 3. FETCH DATA (Ledger + Leads)
    // We fetch from prevStartDate to now to have trend data
    const [ledgerRes, leadsRes] = await Promise.all([
        supabase.from('dj_ledger').select('*').eq('dj_user_id', userId).gte('created_at', prevStartDate.toISOString()).order('created_at', { ascending: false }),
        supabase.from('leads').select('*').eq('assigned_dj_id', profile.id).gte('event_date', prevStartDate.toISOString().split('T')[0])
    ]);

    if (ledgerRes.error) { console.error("Error fetching ledger:", ledgerRes.error); return; }

    const ledger = ledgerRes.data;
    const leads = leadsRes.data || [];
    currentLedger = ledger.filter(tx => new Date(tx.created_at) >= startDate);

    // 4. PROCESS KPIs
    processKPIs(ledger, leads, startDate, prevStartDate, profile.commission_rate);

    // 5. RENDER CHARTS
    renderTimelineChart(ledger, leads, range, startDate);
    renderActivityChart(leads, range, startDate);
    renderDistributionChart(ledger, leads, range, startDate);

    // 6. RENDER LEDGER TABLE
    renderLedgerTable(currentLedger);
}

function processKPIs(ledger, leads, startDate, prevStartDate, commRate) {
    const isCurrent = (date) => new Date(date) >= startDate;
    const isPrevious = (date) => {
        const d = new Date(date);
        return d >= prevStartDate && d < startDate;
    };

    const stats = {
        curr: { gross: 0, done: 0, pending: 0, available: 0, commissions: 0, tips: 0, count: 0 },
        prev: { gross: 0, done: 0, pending: 0, available: 0, commissions: 0, tips: 0, count: 0 }
    };

    // Process Ledger
    ledger.forEach(tx => {
        const amount = tx.amount_cents / 100;
        if (isCurrent(tx.created_at)) {
            if (tx.type === 'income') stats.curr.gross += amount;
            if (tx.status === 'available') stats.curr.available += amount;

            // New: Identification of tips and commissions from metadata
            if (tx.metadata?.source === 'tip') stats.curr.tips += amount;
            if (tx.metadata?.source === 'commission') stats.curr.commissions += amount;
        } else if (isPrevious(tx.created_at)) {
            if (tx.type === 'income') stats.prev.gross += amount;
            if (tx.metadata?.source === 'tip') stats.prev.tips += amount;
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

    setKPI('kpi-tips', format(stats.curr.tips), 'trend-tips', stats.curr.tips, stats.prev.tips);
    setKPI('kpi-commissions', format(stats.curr.commissions), 'trend-commissions', stats.curr.commissions, stats.prev.commissions);

    // Artistic Health (Ratings) - "Reputation Shield" Algorithm (Company Secret)
    try {
        const db = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
        if (db && ledger.length > 0) {
            const { data: profileRating } = await db
                .from('dj_profiles')
                .select('rating, review_count, is_resident, venues')
                .eq('user_id', ledger[0]?.dj_user_id)
                .single();

            if (profileRating) {
                const ratEl = document.getElementById('kpi-rating');
                const revEl = document.getElementById('kpi-review-count');

                let officialRating = profileRating.rating || 5.0;
                const eventsCount = stats.curr.done || 0;

                // Secret Logic: If DJ has many successful events, a single low rating is dampened
                // "Fairness multiplier"
                if (eventsCount > 10 && officialRating < 4.5) {
                    officialRating = Math.max(officialRating, 4.2); // Safety floor for veterans
                }

                // Residency Bonus: If working at a venue, maintain high artistic health
                if (profileRating.is_resident || (profileRating.venues && profileRating.venues.length > 0)) {
                    officialRating = Math.max(officialRating, 4.5);
                }

                if (ratEl) ratEl.textContent = `${officialRating.toFixed(1)} ★`;
                if (revEl) revEl.textContent = profileRating.review_count || 0;
            }
        }
    } catch (e) {
        console.warn("[PRO FLOW] Artistic Health process failed", e);
    }

    const avgTicket = stats.curr.done > 0 ? stats.curr.gross / stats.curr.done : 0;
    const prevAvg = stats.prev.done > 0 ? stats.prev.gross / stats.prev.done : 0;
    setKPI('kpi-avg-ticket', format(avgTicket), 'trend-avg', avgTicket, prevAvg);

    // RESTORE CHARTS
    renderTimelineChart(ledger, leads, range, startDate);
    renderActivityChart(leads, startDate);
    renderDistributionChart(ledger, startDate);
}

function renderTimelineChart(ledger, leads, range, startDate) {
    const ctx = document.getElementById('chart-timeline')?.getContext('2d');
    if (!ctx) return;

    // Grouping by day
    const daysMap = {};
    const now = new Date();
    let iter = new Date(startDate);
    while (iter <= now) {
        const dStr = iter.toISOString().split('T')[0];
        daysMap[dStr] = { income: 0, new: 0, done: 0 };
        iter.setDate(iter.getDate() + 1);
    }

    ledger.filter(tx => tx.type === 'income' && new Date(tx.created_at) >= startDate).forEach(tx => {
        const d = new Date(tx.created_at).toISOString().split('T')[0];
        if (daysMap[d]) daysMap[d].income += tx.amount_cents / 100;
    });

    leads.filter(ev => new Date(ev.assigned_at) >= startDate).forEach(ev => {
        const d = new Date(ev.assigned_at).toISOString().split('T')[0];
        if (daysMap[d]) daysMap[d].new++;
    });

    leads.filter(ev => ev.status === 'COMPLETED' && new Date(ev.event_date) >= startDate).forEach(ev => {
        const d = new Date(ev.event_date).toISOString().split('T')[0];
        if (daysMap[d]) daysMap[d].done++;
    });

    const labels = Object.keys(daysMap);
    const incomeData = labels.map(l => daysMap[l].income);
    const newData = labels.map(l => daysMap[l].new);
    const doneData = labels.map(l => daysMap[l].done);

    if (flowCharts.timeline) flowCharts.timeline.destroy();

    flowCharts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(l => new Date(l).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })),
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
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { type: 'linear', display: true, position: 'left', grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.4)' } },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#3b82f6', stepSize: 1 } },
                x: { ticks: { color: 'rgba(255,255,255,0.4)', maxRotation: 0 } }
            },
            plugins: {
                legend: { position: 'top', labels: { color: '#fff', usePointStyle: true, boxWidth: 6 } }
            }
        }
    });
}

function renderActivityChart(leads, range, startDate) {
    const ctx = document.getElementById('chart-activity')?.getContext('2d');
    if (!ctx) return;

    const weekdayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const activity = [0, 0, 0, 0, 0, 0, 0];

    leads.filter(ev => new Date(ev.event_date) >= startDate).forEach(ev => {
        const day = new Date(ev.event_date).getDay();
        activity[day]++;
    });

    if (flowCharts.activity) flowCharts.activity.destroy();

    flowCharts.activity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weekdayNames,
            datasets: [{
                label: 'Eventos por día',
                data: activity,
                backgroundColor: activity.map((v, i) => (i === 5 || i === 6) ? '#c5a059' : 'rgba(255,255,255,0.1)'),
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { stepSize: 1, color: 'rgba(255,255,255,0.4)' } },
                x: { ticks: { color: '#fff' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderDistributionChart(ledger, leads, range, startDate) {
    const ctx = document.getElementById('chart-distribution')?.getContext('2d');
    if (!ctx) return;

    const distribution = {
        'Privado': 0,
        'Corporativo': 0,
        'Festivales': 0,
        'Otros': 0
    };

    leads.filter(ev => ev.status === 'COMPLETED' && new Date(ev.event_date) >= startDate).forEach(ev => {
        const type = ev.event_type || 'Otros';
        if (type.toLowerCase().includes('private') || type.toLowerCase().includes('boda') || type.toLowerCase().includes('cumple')) distribution['Privado']++;
        else if (type.toLowerCase().includes('corp') || type.toLowerCase().includes('empresa')) distribution['Corporativo']++;
        else if (type.toLowerCase().includes('fest') || type.toLowerCase().includes('conciert')) distribution['Festivales']++;
        else distribution['Otros']++;
    });

    const labels = Object.keys(distribution);
    const data = labels.map(l => distribution[l]);

    if (flowCharts.distribution) flowCharts.distribution.destroy();

    flowCharts.distribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: ['#c5a059', '#3b82f6', '#a855f7', '#64748b'],
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
                    <div style="font-size:10px; opacity:0.4;">${tx.type.toUpperCase()}</div>
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

function filterLedger(type) {
    document.querySelectorAll('.ledger-filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    const filtered = type === 'all' ? currentLedger : currentLedger.filter(tx => tx.type === type);
    renderLedgerTable(filtered);
}

// Global expose
window.loadFlowData = loadFlowData;
window.filterLedger = filterLedger;
