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
let currentStatementLedger = [];
let currentStatementGrain = 'day';
let currentLedgerAll = [];
let currentLedgerFilterType = 'all';
let currentRange = '1y';
let _flowLoadSeq = 0;
console.info('[Flow] build 202605132300-ledger-filters');

function mdjFlowWithTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise(function (_resolve, reject) {
            setTimeout(function () { reject(new Error('timeout')); }, ms);
        }),
    ]);
}

function mdjFlowSetStatus(msg, tone) {
    var el = document.getElementById('flow-data-status');
    if (!el) return;
    if (!msg) {
        el.style.display = 'none';
        el.textContent = '';
        return;
    }
    el.style.display = 'block';
    el.textContent = msg;
    if (tone === 'error') el.style.color = 'rgba(255,120,120,0.9)';
    else if (tone === 'ok') el.style.color = 'rgba(0,255,136,0.85)';
    else el.style.color = 'rgba(255,255,255,0.45)';
}

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
        var artist = row.artist != null ? String(row.artist).trim() : '';
        var label = 'SoundForTips™';
        if (song) label += ' · ' + song.slice(0, 80);
        if (artist) label += ' — ' + artist.slice(0, 60);
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

/** Extracto banco: rollups por pestaña Día / Semana / Mes / Año (tablas dj_flow_*; RLS propio DJ). */
async function mdjFlowRefreshRollups(supabase) {
    try {
        var refreshRes = await mdjFlowWithTimeout(supabase.rpc('refresh_my_dj_flow_rollups'), 15000);
        if (refreshRes && refreshRes.error) {
            console.warn('[Flow] refresh_my_dj_flow_rollups:', refreshRes.error.message || refreshRes.error);
        }
    } catch (refreshErr) {
        console.warn('[Flow] refresh rollups omitido:', refreshErr && refreshErr.message ? refreshErr.message : refreshErr);
    }
}

function mdjFlowParseYmd(ymd) {
    var p = String(ymd || '').split('-');
    if (p.length < 3) return new Date(ymd);
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
}

function mdjFlowRollupLabel(grain, row) {
    var g = String(grain || '').toLowerCase();
    if (g === 'day' && row.bucket_date) {
        return mdjFlowParseYmd(row.bucket_date).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) + ' · ingresos';
    }
    if (g === 'week' && row.week_start) {
        var ws = mdjFlowParseYmd(row.week_start);
        var we = new Date(ws.getTime());
        we.setDate(we.getDate() + 6);
        return 'Sem ' + ws.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' – ' + we.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    if (g === 'month' && row.month_start) {
        return mdjFlowParseYmd(row.month_start).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
    if (g === 'year' && row.year_start) {
        return String(mdjFlowParseYmd(row.year_start).getFullYear());
    }
    return 'Ingresos';
}

async function mdjFlowFetchRollupGrain(supabase, grain) {
    var g = String(grain || 'week').toLowerCase();
    var cfg = {
        day: { table: 'dj_flow_daily', col: 'bucket_date', limit: 90 },
        week: { table: 'dj_flow_weekly', col: 'week_start', limit: 52 },
        month: { table: 'dj_flow_monthly', col: 'month_start', limit: 36 },
        year: { table: 'dj_flow_yearly', col: 'year_start', limit: 7 },
    }[g];
    if (!cfg) return [];
    var res = await supabase
        .from(cfg.table)
        .select(cfg.col + ', gross_cents, commission_cents, net_cents, tx_count')
        .order(cfg.col, { ascending: false })
        .limit(cfg.limit);
    if (res.error) {
        console.warn('[Flow] rollup ' + g + ':', res.error.message || res.error);
        return [];
    }
    return res.data || [];
}

function mdjFlowRollupRowsToDisplay(grain, rows) {
    if (!rows || !rows.length) return [];
    var g = String(grain || 'week').toLowerCase();
    var dateCol = g === 'day' ? 'bucket_date' : (g === 'week' ? 'week_start' : (g === 'month' ? 'month_start' : 'year_start'));
    return rows.map(function (row) {
        var dateKey = row[dateCol];
        var grossCents = Number(row.gross_cents) || 0;
        var commCents = Number(row.commission_cents) || 0;
        var netCents = Number(row.net_cents) != null ? Number(row.net_cents) : (grossCents - commCents);
        return {
            id: 'stmt-' + g + '-' + String(dateKey),
            type: 'income',
            amount_cents: grossCents,
            status: 'available',
            unlock_at: null,
            created_at: mdjFlowParseYmd(dateKey).toISOString(),
            metadata: {
                event_name: mdjFlowRollupLabel(g, row),
                flow_statement: true,
                flow_grain: g,
            },
            _statement: {
                commission_cents: commCents,
                net_cents: netCents,
                tx_count: row.tx_count,
            },
        };
    });
}

function mdjFlowEtYmd(iso) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function mdjFlowWeekStartKey(ymd) {
    var d = mdjFlowParseYmd(ymd);
    var dow = d.getDay();
    var mondayOffset = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + mondayOffset);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function mdjFlowIsPayoutTx(tx) {
    if (!tx) return false;
    var t = String(tx.type || '').toLowerCase();
    if (t === 'payout' || t === 'withdrawal') return true;
    if (tx.status === 'paid' && t !== 'income') return true;
    return !!(tx.metadata && tx.metadata.flow_payout_total);
}

function mdjFlowIsIncomeTx(tx) {
    if (!tx) return false;
    if (mdjFlowIsPayoutTx(tx)) return false;
    if (tx.metadata && tx.metadata.flow_week_total && !tx.metadata.flow_payout_total) return true;
    return String(tx.type || '').toLowerCase() === 'income' || !!(tx.metadata && tx.metadata.soundfortips);
}

function mdjFlowPayoutLabel(tx) {
    if (tx.metadata && tx.metadata.event_name) return tx.metadata.event_name;
    if (tx.metadata && tx.metadata.payout_method) return 'Retiro · ' + tx.metadata.payout_method;
    return 'Pago / retiro';
}

function mdjFlowGroupPayoutsWeekly(payouts) {
    if (!payouts.length) return [];
    var byWeek = Object.create(null);
    payouts.forEach(function (tx) {
        var wk = mdjFlowWeekStartKey(mdjFlowEtYmd(tx.created_at));
        if (!byWeek[wk]) byWeek[wk] = [];
        byWeek[wk].push(tx);
    });
    var out = [];
    Object.keys(byWeek).sort().reverse().forEach(function (wk) {
        var txs = byWeek[wk].slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        txs.forEach(function (tx) {
            out.push({
                id: tx.id || ('payout-' + wk + '-' + tx.created_at),
                type: tx.type || 'payout',
                amount_cents: Number(tx.amount_cents) || 0,
                status: tx.status || 'paid',
                unlock_at: tx.unlock_at || null,
                created_at: tx.created_at,
                metadata: {
                    event_name: mdjFlowPayoutLabel(tx),
                    flow_statement: true,
                    flow_grain: 'week-payout',
                },
            });
        });
        var totalCents = txs.reduce(function (s, t) { return s + (Number(t.amount_cents) || 0); }, 0);
        var ws = mdjFlowParseYmd(wk);
        var we = new Date(ws.getTime());
        we.setDate(we.getDate() + 6);
        out.push({
            id: 'week-payout-total-' + wk,
            type: 'payout',
            amount_cents: totalCents,
            status: 'paid',
            unlock_at: null,
            created_at: we.toISOString(),
            metadata: {
                event_name: 'Total pagos semana · ' + ws.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' – ' + we.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                flow_statement: true,
                flow_grain: 'week',
                flow_week_total: true,
                flow_payout_total: true,
            },
            _statement: { commission_cents: 0, net_cents: -totalCents, tx_count: txs.length },
        });
    });
    return out;
}

function mdjFlowGroupPayoutsByPeriod(payouts, grain) {
    if (!payouts.length) return [];
    var bucketKey = grain === 'year'
        ? function (iso) { return mdjFlowEtYmd(iso).slice(0, 4); }
        : function (iso) { return mdjFlowEtYmd(iso).slice(0, 7); };
    var by = Object.create(null);
    payouts.forEach(function (tx) {
        var k = bucketKey(tx.created_at);
        if (!by[k]) by[k] = [];
        by[k].push(tx);
    });
    return Object.keys(by).sort().reverse().map(function (k) {
        var txs = by[k];
        var totalCents = txs.reduce(function (s, t) { return s + (Number(t.amount_cents) || 0); }, 0);
        var label;
        if (grain === 'year') {
            label = 'Total pagos ' + k;
        } else {
            var parts = k.split('-');
            var d = mdjFlowParseYmd(parts[0] + '-' + parts[1] + '-01');
            label = 'Total pagos · ' + d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        }
        var sortDate = grain === 'year' ? (k + '-12-31') : (k + '-28');
        return {
            id: 'payout-' + grain + '-' + k,
            type: 'payout',
            amount_cents: totalCents,
            status: 'paid',
            unlock_at: null,
            created_at: mdjFlowParseYmd(sortDate).toISOString(),
            metadata: {
                event_name: label,
                flow_statement: true,
                flow_grain: grain,
                flow_payout_total: true,
            },
            _statement: { commission_cents: 0, net_cents: -totalCents, tx_count: txs.length },
        };
    });
}

function mdjFlowBuildPayoutGrainLedger(grain) {
    var payouts = currentLedgerAll.filter(mdjFlowIsPayoutTx);
    var g = String(grain || 'day').toLowerCase();
    if (!payouts.length) return [];
    if (g === 'day') {
        return payouts.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    }
    if (g === 'week') return mdjFlowGroupPayoutsWeekly(payouts);
    if (g === 'month') return mdjFlowGroupPayoutsByPeriod(payouts, 'month');
    if (g === 'year') return mdjFlowGroupPayoutsByPeriod(payouts, 'year');
    return [];
}

function mdjFlowDetailSubline(tx) {
    if (mdjFlowIsPayoutTx(tx) && !(tx.metadata && tx.metadata.flow_payout_total)) return 'Pago / retiro';
    if (tx.metadata && tx.metadata.soundfortips) return 'SoundForTips™ · propina individual';
    if (tx.metadata && tx.metadata.source) return String(tx.metadata.source);
    if (tx.type === 'payout' || tx.type === 'withdrawal') return 'PAGO';
    return 'INGRESO · libro mayor';
}

function mdjFlowDayDetailFromCache() {
    var since = new Date();
    since.setDate(since.getDate() - 90);
    return currentLedgerAll
        .filter(function (tx) { return new Date(tx.created_at) >= since; })
        .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
}

async function mdjFlowFetchDayDetailLedger(supabase, userId) {
    if (currentLedgerAll.length) return mdjFlowDayDetailFromCache();
    var since = new Date();
    since.setDate(since.getDate() - 90);
    var sinceIso = since.toISOString();
    var ledgerRes = await supabase
        .from('dj_ledger')
        .select('*')
        .eq('dj_user_id', userId)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false });
    if (ledgerRes.error) {
        console.warn('[Flow] day detail ledger:', ledgerRes.error.message || ledgerRes.error);
        return [];
    }
    var sftRows = [];
    try {
        var sftRes = await mdjFlowWithTimeout(
            supabase.rpc('get_my_soundfortips_accepted_for_flow', { p_since: sinceIso }),
            8000
        );
        if (sftRes && !sftRes.error && Array.isArray(sftRes.data)) sftRows = sftRes.data;
    } catch (_e) { /* optional */ }
    var ledger = (ledgerRes.data || []).filter(function (tx) {
        return !(tx.metadata && tx.metadata.soundfortips);
    });
    var merged = ledger.concat(soundfortipsAcceptedToLedgerRows(userId, sftRows));
    return merged.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
}

async function mdjFlowBuildWeekLedger(supabase) {
    var days = await mdjFlowFetchRollupGrain(supabase, 'day');
    if (!days.length) return [];
    var byWeek = Object.create(null);
    days.forEach(function (row) {
        var wk = mdjFlowWeekStartKey(row.bucket_date);
        if (!byWeek[wk]) byWeek[wk] = [];
        byWeek[wk].push(row);
    });
    var out = [];
    Object.keys(byWeek).sort().reverse().forEach(function (wk) {
        var dayRows = byWeek[wk].slice().sort(function (a, b) {
            return String(b.bucket_date).localeCompare(String(a.bucket_date));
        });
        dayRows.forEach(function (d) {
            var disp = mdjFlowRollupRowsToDisplay('day', [d])[0];
            disp.metadata.flow_grain = 'week-day';
            disp.metadata.event_name = mdjFlowRollupLabel('day', d);
            out.push(disp);
        });
        var tg = 0;
        var tc = 0;
        var tn = 0;
        var txc = 0;
        dayRows.forEach(function (d) {
            tg += Number(d.gross_cents) || 0;
            tc += Number(d.commission_cents) || 0;
            tn += Number(d.net_cents) || 0;
            txc += Number(d.tx_count) || 0;
        });
        var ws = mdjFlowParseYmd(wk);
        var we = new Date(ws.getTime());
        we.setDate(we.getDate() + 6);
        out.push({
            id: 'week-total-' + wk,
            type: 'income',
            amount_cents: tg,
            status: 'available',
            unlock_at: null,
            created_at: we.toISOString(),
            metadata: {
                event_name: 'Total semana · ' + ws.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' – ' + we.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                flow_statement: true,
                flow_grain: 'week',
                flow_week_total: true,
            },
            _statement: { commission_cents: tc, net_cents: tn, tx_count: txc },
        });
    });
    return out;
}

async function mdjFlowBuildStatementForGrain(supabase, grain, userId, filterType) {
    var ft = filterType || currentLedgerFilterType || 'all';
    var g = String(grain || 'day').toLowerCase();

    if (g === 'day') {
        var lines = await mdjFlowFetchDayDetailLedger(supabase, userId);
        if (ft === 'income') lines = lines.filter(mdjFlowIsIncomeTx);
        else if (ft === 'payout') lines = lines.filter(mdjFlowIsPayoutTx);
        return { mode: 'detail', rows: lines };
    }

    if (ft === 'payout') {
        return { mode: 'statement', rows: mdjFlowBuildPayoutGrainLedger(g) };
    }

    if (g === 'week') {
        return { mode: 'statement', rows: await mdjFlowBuildWeekLedger(supabase) };
    }
    if (g === 'month') {
        var months = await mdjFlowFetchRollupGrain(supabase, 'month');
        return { mode: 'statement', rows: mdjFlowRollupRowsToDisplay('month', months) };
    }
    if (g === 'year') {
        var years = await mdjFlowFetchRollupGrain(supabase, 'year');
        return { mode: 'statement', rows: mdjFlowRollupRowsToDisplay('year', years) };
    }
    return { mode: 'statement', rows: [] };
}

function mdjFlowUpdateGrainHint(grain) {
    var el = document.getElementById('flow-statement-grain-hint');
    if (!el) return;
    var key = 'flow-statement-hint-' + String(grain || 'day').toLowerCase();
    var fallback = {
        day: 'Cada fila es un ingreso real (evento, libro o propina SFT). Hoy y últimos 90 días.',
        week: 'Días con actividad agrupados por semana + fila de total semanal.',
        month: 'Total ganado por mes (ingresos netos agregados).',
        year: 'Total ganado por año fiscal (hasta 7 años).',
    };
    el.textContent = (typeof window.t === 'function' && window.t(key)) || fallback[grain] || fallback.day;
}

/** Fallback: filas mezcladas del RPC legacy (misma pestaña activa). */
async function mdjFlowFetchStatementLedgerRpc(supabase, grain) {
    var stmtRes = await supabase.rpc('get_my_flow_statement');
    if (stmtRes.error) {
        console.warn('[Flow] get_my_flow_statement:', stmtRes.error.message || stmtRes.error);
        return [];
    }
    var g = String(grain || 'week').toLowerCase();
    return (stmtRes.data || []).filter(function (row) { return String(row.grain || '').toLowerCase() === g; });
}

async function mdjFlowFetchStatementLedger(supabase, grain, skipRefresh) {
    if (!skipRefresh) {
        await mdjFlowRefreshRollups(supabase);
    }
    var g = grain || currentStatementGrain || 'week';
    var rollupRows = await mdjFlowFetchRollupGrain(supabase, g);
    if (rollupRows.length) return { source: 'rollup', grain: g, rows: rollupRows };
    var rpcRows = await mdjFlowFetchStatementLedgerRpc(supabase, g);
    return { source: 'rpc', grain: g, rows: rpcRows };
}

function mdjStatementGrainSubline(grain, tx) {
    var g = String(grain || '').toLowerCase();
    if (tx && tx.metadata && tx.metadata.flow_payout_total) return 'Total de pagos';
    if (tx && tx.metadata && tx.metadata.flow_week_total) return 'Total semanal';
    if (g === 'week-payout') return 'Pago en la semana';
    if (g === 'week-day') return 'Día con actividad en la semana';
    if (g === 'day') return 'Extracto · día con actividad';
    if (g === 'week') return 'Extracto · semana';
    if (g === 'month') return 'Extracto · mes';
    if (g === 'year') return 'Extracto · año fiscal';
    return 'EXTRACTO';
}

function mdjStatementRowsToLedgerDisplay(rows) {
    if (!rows || !rows.length) return [];
    return rows.map(function (row) {
        var sortAt = row.sort_at || row.period_end || row.period_start;
        var grossCents = Number(row.gross_cents) || 0;
        var commCents = Number(row.commission_cents) || 0;
        var netCents = Number(row.net_cents) != null ? Number(row.net_cents) : (grossCents - commCents);
        return {
            id: 'stmt-' + String(row.grain || 'row') + '-' + String(row.period_start),
            type: 'income',
            amount_cents: grossCents,
            status: 'available',
            unlock_at: null,
            created_at: sortAt,
            metadata: {
                event_name: row.label || 'Ingresos',
                flow_statement: true,
                flow_grain: row.grain,
            },
            _statement: {
                commission_cents: commCents,
                net_cents: netCents,
                tx_count: row.tx_count,
            },
        };
    });
}

async function mdjFlowRenderStatementTable(supabase, grain, skipRefresh, filterType) {
    var g = grain || currentStatementGrain || 'day';
    var ft = filterType || currentLedgerFilterType || 'all';
    currentStatementGrain = g;
    currentLedgerFilterType = ft;
    if (!skipRefresh) {
        await mdjFlowRefreshRollups(supabase);
    }
    var sessionRes = await supabase.auth.getSession();
    var userId = sessionRes.data && sessionRes.data.session ? sessionRes.data.session.user.id : null;
    var pack = await mdjFlowBuildStatementForGrain(supabase, g, userId, ft);
    currentStatementLedger = pack.rows || [];
    mdjFlowSyncGrainTabUi(g);
    mdjFlowUpdateGrainHint(g);
    if (currentStatementLedger.length) {
        renderLedgerTable(currentStatementLedger);
        return true;
    }
    renderLedgerTable([]);
    return false;
}

function mdjFlowSyncGrainTabUi(grain) {
    var g = String(grain || 'day').toLowerCase();
    document.querySelectorAll('.flow-statement-grain-btn').forEach(function (btn) {
        var bg = btn.getAttribute('data-grain');
        btn.classList.toggle('active', bg === g);
    });
}

async function mdjFlowSwitchStatementGrain(grain, clickedEl) {
    var g = String(grain || 'day').toLowerCase();
    var supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) return;
    var body = document.getElementById('ledger-body');
    if (body) {
        body.innerHTML = '<tr><td colspan="7" style="padding:40px;text-align:center;color:rgba(255,255,255,0.25);">Cargando extracto…</td></tr>';
    }
    mdjFlowSyncGrainTabUi(g);
    mdjFlowSyncTypeFilterUi(currentLedgerFilterType);
    await mdjFlowRenderStatementTable(supabase, g, true, currentLedgerFilterType);
}

function mdjFlowSyncTypeFilterUi(filterType) {
    var ft = filterType || 'all';
    document.querySelectorAll('.ledger-type-filter-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-ledger-filter') === ft);
    });
}

async function mdjFlowTryRenderLedgerTable(supabase, fallbackLedger) {
    var ok = await mdjFlowRenderStatementTable(supabase, currentStatementGrain, false);
    if (!ok) {
        renderLedgerTable(fallbackLedger != null ? fallbackLedger : currentLedger);
    }
    return ok;
}

async function loadFlowData(range = '1y', targetUserId = null) {
    const loadSeq = ++_flowLoadSeq;
    currentRange = range;
    const supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) {
        mdjFlowSetStatus('Supabase no disponible en esta página.', 'error');
        return;
    }

    mdjFlowSetStatus('Cargando métricas…');

    try {
    const { data: { session } } = await supabase.auth.getSession();
    if (loadSeq !== _flowLoadSeq) return;
    if (!session) {
        mdjFlowSetStatus('Inicia sesión para ver Flujo de caja.', 'error');
        return;
    }

    const sessionUid = session.user.id;
    if (targetUserId && targetUserId !== sessionUid) {
        mdjFlowSetStatus(null);
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
    let { data: profile, error: profileErr } = await supabase
        .from('dj_profiles')
        .select('id, commission_rate, rating, review_count, is_resident, weekly_schedule')
        .eq('user_id', userId)
        .maybeSingle();
    if (loadSeq !== _flowLoadSeq) return;

    if (profileErr) {
        console.warn('[Flow] dj_profiles:', profileErr.message || profileErr);
    }

    if (!profile) {
        const fb = await supabase
            .from('dj_profiles')
            .select('id, rating, review_count')
            .eq('user_id', userId)
            .maybeSingle();
        if (loadSeq !== _flowLoadSeq) return;
        if (fb.data) {
            profile = fb.data;
        }
    }

    const ledgerRes = await supabase
        .from('dj_ledger')
        .select('*')
        .eq('dj_user_id', userId)
        .order('created_at', { ascending: false });
    if (loadSeq !== _flowLoadSeq) return;

    if (!profile) {
        currentLedger = ledgerRes.data || [];
        currentLedgerAll = currentLedger.slice();
        await processKPIs(currentLedger, [], startDate, prevStartDate, 10, null);
        const emptyRes = computeResidencyMetrics(null);
        renderTimelineChart(currentLedger, [], range, startDate, emptyRes);
        renderActivityChart([], range, startDate, emptyRes);
        renderDistributionChart(currentLedger, [], range, startDate, emptyRes);
        await mdjFlowTryRenderLedgerTable(supabase, currentLedger);
        if (loadSeq !== _flowLoadSeq) return;
        if (ledgerRes.error) {
            mdjFlowSetStatus('No se pudo leer el libro mayor. Revisa sesión o permisos.', 'error');
        } else if (currentLedger.length) {
            mdjFlowSetStatus(null);
        } else {
            mdjFlowSetStatus('Perfil DJ incompleto y libro mayor vacío desde la app.', 'error');
        }
        scheduleFlowChartsResize();
        await mdjFlowRefreshExportYears(supabase);
        return;
    }

    const leadsRes = await supabase
        .from('leads')
        .select('*')
        .eq('assigned_dj_id', profile.id)
        .order('event_date', { ascending: false });
    if (loadSeq !== _flowLoadSeq) return;

    var sftRows = [];
    try {
        const sftRes = await mdjFlowWithTimeout(
            supabase.rpc('get_my_soundfortips_accepted_for_flow', { p_since: prevStartDate.toISOString() }),
            6000
        );
        if (sftRes && !sftRes.error && Array.isArray(sftRes.data)) {
            sftRows = sftRes.data;
        } else if (sftRes && sftRes.error) {
            console.warn('[Flow] SoundForTips RPC:', sftRes.error.message || sftRes.error);
        }
    } catch (sftErr) {
        console.warn('[Flow] SoundForTips RPC omitido:', sftErr && sftErr.message ? sftErr.message : sftErr);
    }

    if (ledgerRes.error) {
        var stmtOnErr = await mdjFlowRenderStatementTable(supabase);
        if (loadSeq !== _flowLoadSeq) return;
        if (stmtOnErr) {
            mdjFlowSetStatus(null);
            scheduleFlowChartsResize();
            return;
        }
        mdjFlowSetStatus('No se pudo leer el libro mayor. Revisa sesión o permisos.', 'error');
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

    var sftLedger = soundfortipsAcceptedToLedgerRows(userId, sftRows);
    ledger = ledger.concat(sftLedger);
    currentLedgerAll = ledger.slice();
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

    // 6. RENDER LEDGER TABLE (extracto banco vía RPC; fallback libro crudo)
    await mdjFlowTryRenderLedgerTable(supabase, currentLedger);
    if (loadSeq !== _flowLoadSeq) return;

    if (currentStatementLedger.length || currentLedger.length) {
        mdjFlowSetStatus(null);
    } else if (ledger.length) {
        mdjFlowSetStatus('Sin movimientos en el rango seleccionado. Prueba Vista anual.', null);
    } else {
        console.info('[Flow] ledger vacío desde API | userId:', userId);
        mdjFlowSetStatus('No hay filas en tu libro mayor desde la app (0). Si en Supabase SQL sí ves $500, el RLS o la sesión no coinciden — recarga o vuelve a entrar.', 'error');
    }

    scheduleFlowChartsResize();
    setTimeout(scheduleFlowChartsResize, 250);
    await mdjFlowRefreshExportYears(supabase);
    } catch (flowErr) {
        console.error('[Flow] loadFlowData:', flowErr);
        if (loadSeq === _flowLoadSeq) {
            mdjFlowSetStatus('Error al cargar Flujo de caja. Recarga la página.', 'error');
        }
    }
}

/** Pestaña Flujo: carga datos y redibuja gráficas (canvas pudo estar oculto). */
async function mdjLoadFlowTab(range) {
    var mr = document.getElementById('metrics-range');
    var r = range || (mr && mr.value) || '1y';
    await loadFlowData(r);
    scheduleFlowChartsResize();
    setTimeout(scheduleFlowChartsResize, 350);
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

/** Vista libro: agrupa propinas SFT del mismo día (evita 100+ filas en una noche). KPIs usan ledger crudo. */
function mdjGroupSftForLedgerDisplay(ledger) {
    if (!ledger || !ledger.length) return [];
    var rest = [];
    var sftByDay = Object.create(null);
    ledger.forEach(function (tx) {
        if (tx && tx.metadata && tx.metadata.soundfortips === true && !tx.metadata.soundfortips_group) {
            var d = new Date(tx.created_at);
            var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            if (!sftByDay[key]) {
                sftByDay[key] = { txs: [], latestMs: 0 };
            }
            sftByDay[key].txs.push(tx);
            var tms = d.getTime();
            if (tms > sftByDay[key].latestMs) sftByDay[key].latestMs = tms;
        } else if (tx) {
            rest.push(tx);
        }
    });
    var grouped = Object.keys(sftByDay).map(function (key) {
        var bucket = sftByDay[key];
        var txs = bucket.txs;
        var grossCents = txs.reduce(function (sum, t) { return sum + (Number(t.amount_cents) || 0); }, 0);
        var n = txs.length;
        var grossUsd = (grossCents / 100).toFixed(2);
        return {
            id: 'sft-day-' + key,
            dj_user_id: txs[0].dj_user_id,
            type: 'income',
            amount_cents: grossCents,
            status: 'available',
            unlock_at: null,
            event_id: null,
            metadata: {
                source: 'tip',
                soundfortips: true,
                soundfortips_group: true,
                sft_count: n,
                commission_rate: txs[0].metadata && txs[0].metadata.commission_rate != null
                    ? txs[0].metadata.commission_rate
                    : 10,
                event_name: 'SoundForTips™ · Total noche ($' + grossUsd + ' · ' + n + ' propina' + (n === 1 ? '' : 's') + ')',
                sft_day: key,
            },
            created_at: new Date(bucket.latestMs).toISOString(),
        };
    });
    return rest.concat(grouped).sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
    });
}

function mdjLedgerIsStatementRow(tx) {
    return !!(tx && tx.metadata && tx.metadata.flow_statement);
}

function renderLedgerTable(ledger) {
    const body = document.getElementById('ledger-body');
    if (!body) return;

    if (!ledger || ledger.length === 0) {
        body.innerHTML = `<tr><td colspan="7" style="padding:60px; text-align:center; color:rgba(255,255,255,0.2);">No hay transacciones registradas.</td></tr>`;
        return;
    }

    const isDayGrain = currentStatementGrain === 'day';
    const useStatement = !isDayGrain && ledger.every(mdjLedgerIsStatementRow);
    const displayLedger = isDayGrain
        ? ledger
        : (useStatement ? ledger : mdjGroupSftForLedgerDisplay(ledger));

    var todayEt = mdjFlowEtYmd(new Date().toISOString());

    body.innerHTML = displayLedger.map(tx => {
        const isStmt = mdjLedgerIsStatementRow(tx);
        const isWeekTotal = !!(tx.metadata && tx.metadata.flow_week_total);
        const date = new Date(tx.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeEt = isDayGrain
            ? new Intl.DateTimeFormat('es-ES', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(tx.created_at))
            : '';
        let gross;
        let comm;
        let net;
        let commRate;
        if (isStmt && tx._statement) {
            gross = (tx.amount_cents / 100);
            comm = (tx._statement.commission_cents / 100);
            net = (tx._statement.net_cents / 100);
            if (tx.metadata && tx.metadata.flow_payout_total) {
                comm = 0;
                commRate = 0;
                net = -(gross);
            } else {
                commRate = gross > 0 ? Math.round((comm / gross) * 100) : 10;
            }
        } else if (mdjFlowIsPayoutTx(tx)) {
            gross = (tx.amount_cents / 100);
            comm = 0;
            commRate = 0;
            net = -gross;
        } else {
            gross = (tx.amount_cents / 100);
            commRate = tx.metadata?.commission_rate || 10;
            comm = (gross * commRate / 100);
            net = gross - comm;
        }

        const unlock = isStmt && tx._statement && tx._statement.tx_count != null
            ? String(tx._statement.tx_count) + ' mov.'
            : (tx.unlock_at ? new Date(tx.unlock_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—');
        const isSftGroup = !!(tx.metadata && tx.metadata.soundfortips_group);
        const isToday = isDayGrain && mdjFlowEtYmd(tx.created_at) === todayEt;
        const subLine = isDayGrain
            ? ((isToday ? 'Hoy · ' : '') + mdjFlowDetailSubline(tx))
            : (isStmt
                ? mdjStatementGrainSubline(tx.metadata.flow_grain, tx)
                : (isSftGroup
                    ? 'Total nocturno · detalle en SoundForTips™ Historia'
                    : String(tx.type || '').toUpperCase()));
        const rowStyle = isWeekTotal ? ' style="background:rgba(197,160,89,0.08);"' : '';
        const dateCell = isDayGrain ? (date + ' ' + timeEt) : date;

        return `
            <tr${rowStyle}>
                <td style="font-weight:700; color:#fff;">${dateCell}</td>
                <td>
                    <div style="font-weight:700;">${tx.metadata?.event_name || tx.event_id || 'Servicio'}</div>
                    <div style="font-size:10px; opacity:0.4;">${subLine}</div>
                </td>
                <td style="font-weight:700;">$${gross.toFixed(2)}</td>
                <td style="color:#ff5555;">-$${comm.toFixed(2)} (${commRate}%)</td>
                <td style="font-weight:900; color:${net < 0 ? '#ff6b6b' : '#00ff88'};">${net < 0 ? '-' : ''}$${Math.abs(net).toFixed(2)}</td>
                <td><span class="status-pill ${tx.status}">${tx.status}</span></td>
                <td>${unlock}</td>
            </tr>
        `;
    }).join('');
}

function filterLedger(type, clickedEl) {
    currentLedgerFilterType = type || 'all';
    mdjFlowSyncTypeFilterUi(currentLedgerFilterType);
    var supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (supabase && document.getElementById('flow-statement-grain-hint')) {
        mdjFlowRenderStatementTable(supabase, currentStatementGrain, true, currentLedgerFilterType);
        return;
    }
    var el = clickedEl;
    if (!el && typeof window !== 'undefined' && window.event && window.event.target) {
        el = window.event.target;
    }
    if (el && el.classList) el.classList.add('active');
    const src = currentStatementLedger.length ? currentStatementLedger : currentLedger;
    const filtered = currentLedgerFilterType === 'all'
        ? src
        : (currentLedgerFilterType === 'income'
            ? src.filter(mdjFlowIsIncomeTx)
            : src.filter(mdjFlowIsPayoutTx));
    renderLedgerTable(filtered);
    mdjFlowSyncGrainTabUi(currentStatementGrain);
}

/** Fase C — exportación fiscal CSV (detalle crudo; años vía get_my_flow_export_years). */
var _flowExportWired = false;

function mdjFlowTxInTaxYearEt(iso, taxYear) {
    if (!iso) return false;
    var y = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric' }).format(new Date(iso)));
    return y === Number(taxYear);
}

function mdjFlowFormatEtDateTime(iso) {
    var d = new Date(iso);
    return {
        date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
        time: new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d),
    };
}

function mdjFlowCsvEscape(v) {
    var s = String(v == null ? '' : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}

function mdjFlowLedgerRowToExport(tx) {
    var gross = (Number(tx.amount_cents) || 0) / 100;
    var rate = tx.metadata && tx.metadata.commission_rate != null ? Number(tx.metadata.commission_rate) : 10;
    var isPayout = String(tx.type || '').toLowerCase() === 'payout';
    var comm = isPayout ? 0 : (gross * rate / 100);
    var net = isPayout ? -gross : (gross - comm);
    var dt = mdjFlowFormatEtDateTime(tx.created_at);
    return {
        date_et: dt.date,
        time_et: dt.time,
        source: tx.metadata && tx.metadata.soundfortips ? 'soundfortips' : 'ledger',
        type: tx.type || 'income',
        concept: (tx.metadata && tx.metadata.event_name) || tx.event_id || 'Income',
        gross_usd: gross.toFixed(2),
        commission_usd: comm.toFixed(2),
        net_usd: net.toFixed(2),
        commission_pct: isPayout ? 0 : rate,
        status: tx.status || '',
        reference_id: tx.id || '',
    };
}

function mdjFlowDownloadCsv(filename, content) {
    var blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

function mdjFlowSetExportStatus(msg, tone) {
    var el = document.getElementById('flow-export-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = tone === 'error' ? '#ff6b6b' : (tone === 'ok' ? '#00ff88' : 'rgba(255,255,255,0.45)');
}

async function mdjFlowRefreshExportYears(supabase) {
    var sel = document.getElementById('flow-export-year');
    var btn = document.getElementById('flow-export-csv-btn');
    if (!sel) return;
    mdjFlowInitExportPanel();
    mdjFlowSetExportStatus('');
    var client = supabase || (window.getSupabaseClient ? window.getSupabaseClient() : window.supabase);
    if (!client) return;
    sel.disabled = true;
    if (btn) btn.disabled = true;
    var res = await client.rpc('get_my_flow_export_years');
    sel.innerHTML = '';
    if (res.error || !res.data || !res.data.length) {
        var ph = document.createElement('option');
        ph.value = '';
        ph.textContent = (typeof window.t === 'function' && window.t('flow-export-empty')) || 'Sin años con datos (7 años)';
        sel.appendChild(ph);
        return;
    }
    res.data.forEach(function (row) {
        var opt = document.createElement('option');
        var net = (Number(row.net_cents) || 0) / 100;
        var cnt = Number(row.line_count) || 0;
        opt.value = String(row.tax_year);
        opt.textContent = row.tax_year + ' — $' + net.toFixed(2) + ' net (' + cnt + ' mov.)';
        sel.appendChild(opt);
    });
    sel.disabled = false;
    if (btn) btn.disabled = false;
}

async function mdjFlowExportCsvForYear(taxYear) {
    var y = Number(taxYear);
    if (!y) return;
    var supabase = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
    if (!supabase) {
        mdjFlowSetExportStatus('Supabase no disponible.', 'error');
        return;
    }
    var btn = document.getElementById('flow-export-csv-btn');
    var loadingMsg = (typeof window.t === 'function' && window.t('flow-export-loading')) || 'Generando CSV…';
    mdjFlowSetExportStatus(loadingMsg);
    if (btn) btn.disabled = true;
    try {
        var sessionRes = await supabase.auth.getSession();
        if (!sessionRes.data || !sessionRes.data.session) {
            mdjFlowSetExportStatus('Inicia sesión para exportar.', 'error');
            return;
        }
        var userId = sessionRes.data.session.user.id;
        try {
            await mdjFlowWithTimeout(supabase.rpc('refresh_my_dj_flow_rollups'), 12000);
        } catch (_refreshSkip) { /* non-blocking */ }

        var since = new Date(Date.UTC(y - 1, 11, 15, 0, 0, 0)).toISOString();
        var until = new Date(Date.UTC(y + 1, 0, 15, 23, 59, 59)).toISOString();

        var ledgerRes = await supabase
            .from('dj_ledger')
            .select('*')
            .eq('dj_user_id', userId)
            .gte('created_at', since)
            .lte('created_at', until)
            .order('created_at', { ascending: true });

        if (ledgerRes.error) throw new Error(ledgerRes.error.message || 'ledger');

        var sftRows = [];
        try {
            var sftRes = await mdjFlowWithTimeout(
                supabase.rpc('get_my_soundfortips_accepted_for_flow', { p_since: since }),
                8000
            );
            if (sftRes && !sftRes.error && Array.isArray(sftRes.data)) {
                sftRows = sftRes.data.filter(function (row) { return mdjFlowTxInTaxYearEt(row.created_at, y); });
            }
        } catch (_sftSkip) { /* optional */ }

        var ledgerInYear = (ledgerRes.data || []).filter(function (tx) {
            if (tx.metadata && tx.metadata.soundfortips) return false;
            return mdjFlowTxInTaxYearEt(tx.created_at, y);
        });
        var sftLedger = soundfortipsAcceptedToLedgerRows(userId, sftRows);
        var merged = ledgerInYear.concat(sftLedger).sort(function (a, b) {
            return new Date(a.created_at) - new Date(b.created_at);
        });

        if (!merged.length) {
            mdjFlowSetExportStatus((typeof window.t === 'function' && window.t('flow-export-empty-year')) || 'Sin líneas en ese año fiscal.', 'error');
            return;
        }

        var exportRows = merged.map(mdjFlowLedgerRowToExport);
        var cols = ['date_et', 'time_et', 'source', 'type', 'concept', 'gross_usd', 'commission_usd', 'net_usd', 'commission_pct', 'status', 'reference_id'];
        var lines = [
            '# Miami DJ Beat LLC — Cash Flow export (tax year ' + y + ', America/New_York)',
            '# Confidential. For your records / tax preparer. Not legal or tax advice.',
            cols.join(','),
        ];
        var sumGross = 0;
        var sumComm = 0;
        var sumNet = 0;
        exportRows.forEach(function (row) {
            sumGross += Number(row.gross_usd);
            sumComm += Number(row.commission_usd);
            sumNet += Number(row.net_usd);
            lines.push(cols.map(function (c) { return mdjFlowCsvEscape(row[c]); }).join(','));
        });
        lines.push('');
        lines.push(['TOTAL', '', '', '', '', sumGross.toFixed(2), sumComm.toFixed(2), sumNet.toFixed(2), '', '', ''].map(mdjFlowCsvEscape).join(','));

        var fname = 'MDJB-Flow-' + y + '.csv';
        mdjFlowDownloadCsv(fname, lines.join('\r\n'));
        var doneMsg = (typeof window.t === 'function' && window.t('flow-export-done')) || 'CSV descargado.';
        mdjFlowSetExportStatus(doneMsg + ' (' + exportRows.length + ' líneas)', 'ok');
    } catch (exportErr) {
        console.warn('[Flow] export CSV:', exportErr);
        mdjFlowSetExportStatus((typeof window.t === 'function' && window.t('flow-export-err')) || 'No se pudo exportar. Reintenta.', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function mdjFlowInitExportPanel() {
    if (_flowExportWired) return;
    var btn = document.getElementById('flow-export-csv-btn');
    if (!btn) return;
    _flowExportWired = true;
    btn.addEventListener('click', function () {
        var sel = document.getElementById('flow-export-year');
        if (!sel || !sel.value) return;
        mdjFlowExportCsvForYear(Number(sel.value));
    });
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
    /* Hero público: mismo promedio de reseñas que ve el fan (renderDynamicReviewsAndKPI). */
    if (window.__MDJ_PUBLIC_RATING_LOCK) return;
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
window.mdjLoadFlowTab = mdjLoadFlowTab;
window.filterLedger = filterLedger;
window.mdjFlowSwitchStatementGrain = mdjFlowSwitchStatementGrain;
window.mdjFlowExportCsvForYear = mdjFlowExportCsvForYear;
window.mdjFlowRefreshExportYears = mdjFlowRefreshExportYears;

/** Reintento cuando la sesión llega después de switchDashTab(?tab=flow) o hub.connect. */
(function mdjFlowWireSession() {
    function tryFlowFromDom() {
        if (typeof window.mdjIsProfileFanPublicVisit === 'function' && window.mdjIsProfileFanPublicVisit()) {
            return;
        }
        var qs = new URLSearchParams(window.location.search);
        var panel = document.getElementById('tab-flow');
        var wantFlow = qs.get('tab') === 'flow' || (panel && panel.classList.contains('active'));
        if (!wantFlow) return;
        if (typeof window.mdjLoadFlowTab === 'function') {
            window.mdjLoadFlowTab();
            return;
        }
        if (typeof loadFlowData !== 'function') return;
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
    setTimeout(tryFlowFromDom, 800);
    mdjFlowInitExportPanel();
})();
