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

    var LEDGER_COLS = 'id,type,status,amount_cents,created_at,classification:metadata->>classification';
    var DAILY_COLS = 'bucket_date,gross_cents,residency_gross_cents,sft_gross_cents,tx_count';
    var PROFILE_COLS = 'plan_type,plan_status';

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
     * Pendiente de liquidación = ingresos del ledger en estado 'pending'.
     * Las filas del libro que el Staff clasificó como APORTE (metadata.classification = 'contribution', p. ej. los $500 de marzo de DJMago305) NO son cobro: se apartan en aporteLibro
     *   y no suman a Cobrado, Pendiente ni Ingresos acumulados. Se muestran solo en el espacio de contribuyente. */
    function buildModel(ledgerRows, dailyRows, tipRows, profile) {
        var disponibleLedger = 0, pendiente = 0, pendienteN = 0, aporteLibro = 0;
        (ledgerRows || []).forEach(function (r) {
            if (r.type !== 'income') return;
            if (r.classification === 'contribution') { if (r.status === 'available' || r.status === 'pending') aporteLibro += usd(r.amount_cents); return; }
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
            pendiente: pendiente, pendienteCount: pendienteN, aporteLibro: aporteLibro,
            total: disponible + pendiente
        };
    }

    /* Carga todo en paralelo. Devuelve una promesa del modelo; si algo falla, rechaza (la vista muestra un aviso, no una pantalla en blanco). */
    function load() {
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

    /* Visitas al perfil público por día (perfil + QR de SoundForTips), solo las del usuario autenticado: función get_my_profile_visits_daily (SECURITY DEFINER,
       filtra por auth.uid() dentro de la base). Si la función no existe todavía o falla, devuelve [] sin romper la pantalla. */
    var visitsWarned = false;
    function loadVisits(days) {
        var db = client(); if (!db) return Promise.resolve([]);
        return db.rpc('get_my_profile_visits_daily', { p_days: days || 800 }).then(function (r) {
            if (r && r.error) { if (!visitsWarned) { visitsWarned = true; try { console.warn('[artist-panel] visitas:', r.error.message); } catch (x) { /* sin consola */ } } return []; }
            return (r && r.data) || [];
        }, function () { return []; });
    }

    /* Reseñas REALES del propio artista. Primero la función get_my_review_summary (promedio, total, cuántas son «verificadas» = con contrato detrás, y las últimas 12). Si la función
       aún no existe, cae al promedio y total que ya guarda su propia fila de dj_profiles (columnas nombradas) y sin lista. Con 0 reseñas devuelve avg null: jamás «1.0». */
    function emptyReviews() { return { review_count: 0, verified_count: 0, avg_rating: null, reviews: [] }; }
    function loadReviews() {
        var db = client(); if (!db) return Promise.resolve(emptyReviews());
        function fromProfile() {
            return ownUserId(db).then(function (uid) {
                if (!uid) return emptyReviews();
                return db.from('dj_profiles').select('rating,review_count').eq('user_id', uid).maybeSingle().then(function (r) {
                    var d = r && r.data, n = d ? num(d.review_count) : 0;
                    return { review_count: n, verified_count: null, avg_rating: n > 0 ? num(d.rating) : null, reviews: [] };
                });
            });
        }
        return db.rpc('get_my_review_summary').then(function (r) {
            if (r && !r.error && r.data) { var d = r.data; return { review_count: num(d.review_count), verified_count: num(d.verified_count), avg_rating: d.avg_rating == null ? null : num(d.avg_rating), reviews: d.reviews || [] }; }
            return fromProfile();
        }, function () { return fromProfile(); });
    }

    /* Página de reseñas propias con orden: get_my_reviews_page(p_order 'recent'|'oldest', p_limit, p_offset) (SECURITY DEFINER, filtra por auth.uid() dentro de la base).
       get_my_review_summary solo trae las 12 más recientes; esta pide el resto cuando hay más. Devuelve el arreglo, o null si la función aún no existe / falla (el módulo cae a lo ya cargado). */
    function loadReviewsPage(order, limit, offset) {
        var db = client(); if (!db) return Promise.resolve(null);
        return db.rpc('get_my_reviews_page', { p_order: order === 'oldest' ? 'oldest' : 'recent', p_limit: limit || 6, p_offset: offset || 0 }).then(function (r) {
            return (r && !r.error && Array.isArray(r.data)) ? r.data : null;
        }, function () { return null; });
    }

    /* Modo CONTRIBUYENTE (owner y DJMago305: aportan sin salario por ahora). SOLO LECTURA: el Cash Flow mide, no se edita aquí. Las horas las registra únicamente el Staff de gestión
       desde su sección «Contribuciones». Funciones del propio usuario (auth.uid() dentro de la base): get_my_contribution_summary y get_my_contribution_daily. Una cuenta sin la
       marca recibe mode null y no ve nada; si las funciones aún no existen, también (sin romper la pantalla). */
    var NO_CONTRIB = { mode: null };
    function loadContribution() {
        var db = client(); if (!db) return Promise.resolve(NO_CONTRIB);
        return db.rpc('get_my_contribution_summary').then(function (r) { return (r && !r.error && r.data) ? r.data : NO_CONTRIB; }, function () { return NO_CONTRIB; });
    }
    function loadContributionDaily(days) {
        var db = client(); if (!db) return Promise.resolve([]);
        return db.rpc('get_my_contribution_daily', { p_days: days || 800 }).then(function (r) { return (r && !r.error && r.data) ? r.data : []; }, function () { return []; });
    }

    /* Actividad REAL del propio artista para las tarjetas y la gráfica semanal: dinero por día (dj_flow_daily, que ya incluye residencia y propinas), eventos de su agenda y sus
       contratos (leads). Todo con columnas nombradas (jamás las tarifas del local) y solo lo suyo: las tablas lo filtran por su usuario. Últimos 400 días. */
    function nyDay(iso) { try { return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } catch (e) { return String(iso).slice(0, 10); } }
    function loadActivity() {
        var db = client(); if (!db) return Promise.resolve({ daily: [], events: [], leads: [] });
        var since = new Date(); since.setDate(since.getDate() - 400);
        var sinceDay = since.getFullYear() + '-' + String(since.getMonth() + 1).padStart(2, '0') + '-' + String(since.getDate()).padStart(2, '0');
        return ownUserId(db).then(function (uid) {
            if (!uid) return { daily: [], events: [], leads: [] };
            function rows(r) { return (r && !r.error && r.data) ? r.data : []; }
            return Promise.all([
                db.from('dj_flow_daily').select('bucket_date,gross_cents,sft_gross_cents,residency_gross_cents,tx_count').eq('dj_user_id', uid).gte('bucket_date', sinceDay),
                db.from('elixis_agenda_eventos').select('tipo,estado,fecha_inicio,fecha_fin').eq('user_id', uid).eq('estado', 'activo').gte('fecha_inicio', since.toISOString()),
                db.from('dj_profiles').select('id').eq('user_id', uid).maybeSingle(),
                db.from('dj_ledger').select('amount_cents,created_at,fecha:metadata->>fecha').eq('dj_user_id', uid).eq('type', 'income').eq('metadata->>classification', 'contribution')
            ]).then(function (r) {
                var pid = r[2] && !r[2].error && r[2].data ? r[2].data.id : null;
                var aporte = rows(r[3]).map(function (a) { return { day: a.fecha ? String(a.fecha).slice(0, 10) : nyDay(a.created_at), cents: num(a.amount_cents) }; });
                if (!pid) return { daily: rows(r[0]), events: rows(r[1]), leads: [], aporte: aporte };
                return db.from('leads').select('status,event_date,assigned_at').eq('assigned_dj_id', pid).then(function (l) { return { daily: rows(r[0]), events: rows(r[1]), leads: rows(l), aporte: aporte }; });
            });
        }).catch(function () { return { daily: [], events: [], leads: [] }; });
    }

    /* Fuentes del ESTADO DE CUENTA de movimientos (artist-movements.js). Mismas reglas de esta capa: solo lo del usuario autenticado (cada consulta lleva su
       propio dj_user_id además de la RLS: el staff puede leer filas ajenas por política, así que NUNCA se confía solo en la RLS), columnas nombradas y nada de
       tarifas de local. Devuelve filas CRUDAS del libro, las residencias por día (solo días con residencia) y las propinas aceptadas; el modelo lo arma el módulo. */
    var MOV_LEDGER_COLS = 'id,type,status,amount_cents,created_at,event_id,src:metadata->>source,ename:metadata->>event_name,evento:metadata->>evento,fecha:metadata->>fecha,rate:metadata->>commission_rate,classification:metadata->>classification';
    function loadMovementSources() {
        var db = client();
        if (!db) return Promise.reject(new Error('sin cliente de datos'));
        return ownUserId(db).then(function (uid) {
            if (!uid) throw new Error('sin sesión');
            function ok(res, what) { if (res && res.error) throw new Error(what + ': ' + res.error.message); return (res && res.data) || []; }
            return Promise.all([
                db.from('dj_ledger').select(MOV_LEDGER_COLS).eq('dj_user_id', uid).order('created_at', { ascending: false }).limit(2000),
                db.from('dj_flow_daily').select('bucket_date,residency_gross_cents').eq('dj_user_id', uid).gt('residency_gross_cents', 0).order('bucket_date', { ascending: false }).limit(2000),
                db.rpc('get_my_soundfortips_accepted_for_flow', { p_since: '2020-01-01T00:00:00Z' })
            ]).then(function (r) { return { ledger: ok(r[0], 'dj_ledger'), daily: ok(r[1], 'dj_flow_daily'), tips: ok(r[2], 'propinas') }; });
        });
    }

    AP.data = { loadReviewsPage: loadReviewsPage, loadMovementSources: loadMovementSources, loadActivity: loadActivity, load: load, loadVisits: loadVisits, loadReviews: loadReviews, loadContribution: loadContribution, loadContributionDaily: loadContributionDaily, buildModel: buildModel };
})();
