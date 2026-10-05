/* Panel del artista · CAPA DE DATOS (solo lectura).
 * Única puerta de datos del Cash Flow del artista. Reglas:
 *  - Solo lee lo del usuario autenticado (auth.uid()): las tablas con RLS (dj_ledger, dj_flow_daily, dj_profiles propia) y la función
 *    get_my_soundfortips_accepted_for_flow, que filtra por auth.uid() dentro de la base.
 *  - PROHIBIDO select('*'): cada consulta nombra sus columnas. Ninguna columna de tarifas de local (venue_pay, tarifa_venue_cents…) se pide jamás.
 *  - Nada de staff_profiles ni de métricas de Staff: este módulo no sabe que existen.
 * Compatible con Safari 13 (sin ??, sin ?.). */
(function () {
    'use strict';
    var AP = window.ArtistPanel = window.ArtistPanel || {};

    var LEDGER_COLS = 'id,type,status,amount_cents,created_at';
    var DAILY_COLS = 'bucket_date,gross_cents,residency_gross_cents,sft_gross_cents,tx_count';
    var PROFILE_COLS = 'plan_type,plan_status';

    function isLocal() { return /^(localhost|127\.0\.0\.1)$/.test(location.hostname); }
    function client() { return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : window.supabase; }
    function usd(cents) { return (Number(cents) || 0) / 100; }
    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

    function ownUserId(db) {
        return db.auth.getSession().then(function (r) {
            var s = r && r.data && r.data.session;
            return s && s.user ? s.user.id : null;
        });
    }

    /* Convierte las filas leídas en el modelo que pinta artist-cashflow.js.
     * Cobrado / Disponible = ingresos del ledger en estado 'available' + turnos de residencia + propinas aceptadas
     *   (así los trata ya flow-handler.js: los turnos y las propinas se cuentan como disponibles).
     * Pendiente de liquidación = ingresos del ledger en estado 'pending'. */
    function buildModel(ledgerRows, dailyRows, tipRows, profile) {
        var disponibleLedger = 0, pendiente = 0, pendienteN = 0;
        (ledgerRows || []).forEach(function (r) {
            if (r.type !== 'income') return;
            if (r.status === 'available') disponibleLedger += usd(r.amount_cents);
            else if (r.status === 'pending') { pendiente += usd(r.amount_cents); pendienteN++; }
        });
        var residencia = 0, turnos = 0;
        (dailyRows || []).forEach(function (d) { residencia += usd(d.residency_gross_cents); });
        (dailyRows || []).forEach(function (d) { if (num(d.residency_gross_cents) > 0) turnos += 1; });
        var propinas = 0, propinasN = 0;
        (tipRows || []).forEach(function (t) { propinas += num(t.tip_usd); propinasN++; });
        var plan = profile && profile.plan_type ? String(profile.plan_type) : 'free';
        var isPro = plan !== 'free' && String(profile && profile.plan_status || '') === 'active';
        var disponible = disponibleLedger + residencia + propinas;
        return {
            isPro: isPro,
            disponible: disponible, contratos: disponibleLedger, residencia: residencia, turnosResidencia: turnos,
            propinas: propinas, propinasCount: propinasN,
            pendiente: pendiente, pendienteCount: pendienteN,
            total: disponible + pendiente
        };
    }

    /* Carga todo en paralelo. Devuelve una promesa del modelo; si algo falla, rechaza (la vista muestra un aviso, no una pantalla en blanco). */
    /* SOLO en localhost: ?ap_demo=<nombre> simula a un artista para revisar la vista antes de publicar. Los datos de las simulaciones viven en
       artist-demo.local.js, un archivo que NO se sube a Git (son cifras reales de personas); en producción esta rama no se ejecuta. */
    function demoModel() {
        if (!isLocal()) return null;
        if (window.__AP_DEMO__) return Promise.resolve(window.__AP_DEMO__);
        var m = /[?&]ap_demo=([a-z0-9_-]+)/i.exec(location.search); if (!m) return null;
        var name = m[1].toLowerCase();
        function pick() { var set = window.__AP_DEMO_SETS__ || {}; return set[name] ? Promise.resolve(set[name]) : Promise.reject(new Error('simulación «' + name + '» no definida')); }
        if (window.__AP_DEMO_SETS__) return pick();
        return new Promise(function (resolve, reject) {
            var sc = document.createElement('script'); sc.src = './js/artist-panel/artist-demo.local.js';
            sc.onload = function () { pick().then(resolve, reject); }; sc.onerror = function () { reject(new Error('falta artist-demo.local.js')); };
            document.head.appendChild(sc);
        });
    }

    function load() {
        var demo = demoModel(); if (demo) return demo;
        var db = client();
        if (!db) return Promise.reject(new Error('sin cliente de datos'));
        return ownUserId(db).then(function (uid) {
            if (!uid) throw new Error('sin sesión');
            function ok(res, what) { if (res && res.error) throw new Error(what + ': ' + res.error.message); return (res && res.data) || []; }
            return Promise.all([
                db.from('dj_ledger').select(LEDGER_COLS).eq('dj_user_id', uid),
                db.from('dj_flow_daily').select(DAILY_COLS).eq('dj_user_id', uid),
                db.rpc('get_my_soundfortips_accepted_for_flow', { p_since: '2020-01-01T00:00:00Z' }),
                db.from('dj_profiles').select(PROFILE_COLS).eq('user_id', uid).maybeSingle()
            ]).then(function (r) {
                var prof = r[3] && !r[3].error ? r[3].data : null;
                return buildModel(ok(r[0], 'dj_ledger'), ok(r[1], 'dj_flow_daily'), ok(r[2], 'propinas'), prof);
            });
        });
    }

    AP.data = { load: load, buildModel: buildModel };
})();
