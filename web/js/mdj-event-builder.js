/**
 * MDJ Event Builder — local draft + drawer UI (Phase 1A).
 * Gated by window.MDJ_EVENT_BUILDER_V1. Optional Supabase sync: pack → leads.notes.selected_services (MVP A).
 */
(function (global) {
    'use strict';

    if (!global.MDJ_EVENT_BUILDER_V1) {
        return;
    }

    /* Legacy keys may still exist in localStorage; this module does not read or write them (no migration). */
    var TAX_RATE = 0.07;
    /** Bridge/adapter used a JPG that does not exist in web/assets; use glass placeholder in UI. */
    var EB_BROKEN_DJ_FAMILY_IMAGE = './assets/DJ_Performance/family-events.jpg';

    /** Mock roster for Event Cart DJ picker (Family Events); UI only — no persistence. */
    var MDJ_EB_MOCK_DJS_FAMILY = [
        {
            id: 'mock-excel',
            stage: 'DJ EXCEL',
            legal: 'Alexander Gomez',
            stars_label: '★★★★★',
            score_paren: '(98)',
            status: 'Available (mock)',
            avatar_url: './assets/branding/logo-transparent.png'
        },
        {
            id: 'mock-mattv',
            stage: 'DJ MATT V',
            legal: 'Matthew Velez',
            stars_label: '★★★★★',
            score_paren: '(94)',
            status: 'Available (mock)',
            avatar_url: './assets/branding/logo-transparent.png'
        },
        {
            id: 'mock-steve',
            stage: 'DJ STEVE STYLEZ',
            legal: 'Steven Rodriguez',
            stars_label: '★★★★★',
            score_paren: '(92)',
            status: 'Available (mock)',
            avatar_url: './assets/branding/logo-transparent.png'
        }
    ];

    /** Family Events DJ table: fetch once (memory cache); read-only public_dj_profiles. */
    var ebFamilyDjInFlight = false;
    var ebFamilyDjReady   = false;
    var ebFamilyDjRows    = [];   // top-3 global (backward compat)
    var ebAllDjNorm       = [];   // todos los artistas normalizados para filtrado por categoría
    var ebFamilyDjSource  = '';

    var ebActiveUserId = null;
    var ebUiBound = false;
    var ebAuthListenerBound = false;

    function getDraftKey() {
        if (ebActiveUserId) {
            return 'mdj:event-builder:draft:v1:u:' + ebActiveUserId;
        }
        return 'mdj:event-builder:draft:v1:anon';
    }

    function mdjEbResolveUserId(cb) {
        try {
            var sb = typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null;
            if (!sb || !sb.auth || typeof sb.auth.getSession !== 'function') {
                cb(null);
                return;
            }
            var p = sb.auth.getSession();
            if (!p || typeof p.then !== 'function') {
                cb(null);
                return;
            }
            p.then(function (res) {
                var uid = res && res.data && res.data.session && res.data.session.user && res.data.session.user.id;
                cb(uid ? String(uid) : null);
            }).catch(function () {
                cb(null);
            });
        } catch (e) {
            cb(null);
        }
    }

    function mdjEbSetActiveUserId(uidOrNull) {
        ebActiveUserId = uidOrNull && String(uidOrNull).trim() ? String(uidOrNull).trim() : null;
    }

    function mdjEbRehydrateFromActiveKeys() {
        closeDrawer();
        hydrateDraft();
        render();
        void mdjEbRefreshAssignDropdown();
    }

    function mdjEbEnsureAuthListenerOnce() {
        if (ebAuthListenerBound) {
            return;
        }
        try {
            var sb = typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null;
            if (!sb || !sb.auth || typeof sb.auth.onAuthStateChange !== 'function') {
                return;
            }
            ebAuthListenerBound = true;
            sb.auth.onAuthStateChange(function () {
                mdjEbResolveUserId(function (uid) {
                    mdjEbSetActiveUserId(uid);
                    mdjEbRehydrateFromActiveKeys();
                });
            });
        } catch (eListen) {
            void eListen;
        }
    }

    /** Mirrors client-portal hub cache key for optional fast-path ownership (sessionStorage). */
    var MDJ_EB_PORTAL_HUB_STORAGE_KEY = 'mdj_portal_hub_v1';

    var state = {
        schema_version: 1,
        draft_id: null,
        lines: [],
        assigned_lead_id: null,
        updated_at: null
    };

    var ebAssignRefreshInFlight = false;
    var MDJ_EB_ASSIGN_CREATE_EVENT = '__mdj_eb_create_event__';
    var MDJ_EB_MONTH_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    var ebCtaBusy = false;

    var ui = {
        root: null,
        drawerOpen: false
    };

    function uuid() {
        if (global.crypto && typeof global.crypto.randomUUID === 'function') {
            return global.crypto.randomUUID();
        }
        return 'eb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    }

    function money(n) {
        var v = isNaN(n) ? 0 : n;
        return '$' + v.toFixed(2);
    }

    function readJson(key, fallback) {
        try {
            var raw = global.localStorage.getItem(key);
            if (!raw) {
                return fallback;
            }
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    }

    function writeJson(key, val) {
        try {
            global.localStorage.setItem(key, JSON.stringify(val));
        } catch (e) { /* ignore */ }
    }

    function persistDraft() {
        state.updated_at = new Date().toISOString();
        writeJson(getDraftKey(), {
            schema_version: state.schema_version,
            draft_id: state.draft_id,
            lines: state.lines,
            assigned_lead_id: state.assigned_lead_id && mdjEbUuidLike(state.assigned_lead_id) ? state.assigned_lead_id : null,
            updated_at: state.updated_at
        });
    }

    // Infiere category_key desde prefijos de ID conocidos + rentalCatalogs
    function mdjEbInferCategoryFromSku(sku) {
        var s = String(sku || '');
        if (s.indexOf('dj_') === 0) return 'dj';
        if (s.indexOf('hl_') === 0) return 'horaloca';
        if (s.indexOf('mc_') === 0) return 'mc';
        if (s.indexOf('staff_') === 0) return 'staff';
        if (s.indexOf('payaso_') === 0) return 'payaso';
        if (s.indexOf('fx_') === 0) return 'fx';
        if (s.indexOf('live_') === 0 || s.indexOf('sax_') === 0 || s.indexOf('percussion_') === 0) return 'live';
        if (s.indexOf('visuals_') === 0 || s.indexOf('photo_') === 0 || s.indexOf('video_') === 0 || s.indexOf('drone_') === 0) return 'visuals';
        if (
            s.indexOf('led_') === 0 || s.indexOf('moving_heads') === 0 || s.indexOf('uplighting') === 0 ||
            s.indexOf('laser_') === 0 || s.indexOf('fog_') === 0 || s.indexOf('low_fog') === 0 ||
            s.indexOf('bubble_') === 0 || s.indexOf('spark_') === 0 ||
            s.indexOf('indoor_led') === 0 || s.indexOf('outdoor_led') === 0 || s.indexOf('led_tv') === 0
        ) return 'lighting';
        if (s.indexOf('pa_') === 0 || s.indexOf('wireless_mic') === 0 || s.indexOf('dj_monitor') === 0 || s.indexOf('audio_') === 0) return 'audio';
        if (s.indexOf('f_') === 0) return 'furniture';
        if (s.indexOf('truss_') === 0 || s.indexOf('stage_') === 0 || s.indexOf('goalpost') === 0) return 'stages';
        if (s.indexOf('tent_') === 0 || s.indexOf('canopy_') === 0 || s.indexOf('marquee_') === 0) return 'tents';
        if (s.indexOf('inflat') === 0 || s.indexOf('bounce_') === 0 || s.indexOf('castle_') === 0) return 'inflatables';
        // Búsqueda exhaustiva en rentalCatalogs
        var rc = global.rentalCatalogs;
        if (rc) {
            var keys = Object.keys(rc);
            for (var k = 0; k < keys.length; k++) {
                var cat = rc[keys[k]];
                if (cat && Array.isArray(cat.items)) {
                    for (var j = 0; j < cat.items.length; j++) {
                        if (cat.items[j] && cat.items[j].id === s) return keys[k];
                    }
                }
            }
        }
        return null;
    }

    function hydrateDraft() {
        var saved = readJson(getDraftKey(), null);
        if (saved && saved.schema_version === 1 && Array.isArray(saved.lines)) {
            state.draft_id = saved.draft_id || uuid();
            state.lines = saved.lines;
            state.updated_at = saved.updated_at || null;
            state.assigned_lead_id =
                saved.assigned_lead_id && mdjEbUuidLike(saved.assigned_lead_id) ? saved.assigned_lead_id : null;
            var i;
            var migrated = false;
            for (i = 0; i < state.lines.length; i++) {
                if (state.lines[i] && state.lines[i].image_url === EB_BROKEN_DJ_FAMILY_IMAGE) {
                    state.lines[i].image_url = null;
                    migrated = true;
                }
                // Re-infer stale category_key ('addon'/'general') using prefix rules + rentalCatalogs
                var sl = state.lines[i];
                if (sl && (sl.category_key === 'addon' || sl.category_key === 'general') && sl.catalog_sku) {
                    var newCat = mdjEbInferCategoryFromSku(sl.catalog_sku);
                    if (!newCat && typeof global.mdjRentalsInferCategoryKey === 'function') {
                        newCat = global.mdjRentalsInferCategoryKey(sl.catalog_sku);
                    }
                    if (newCat && newCat !== 'addon' && newCat !== 'general') {
                        sl.category_key = newCat;
                        migrated = true;
                    }
                }
                // Migrar líneas sin line_status (cotizado por defecto)
                if (sl && !sl.line_status) {
                    sl.line_status = 'cotizado';
                    migrated = true;
                }
            }
            if (migrated) {
                persistDraft();
            }
        } else {
            state.draft_id = uuid();
            state.lines = [];
            state.updated_at = null;
            state.assigned_lead_id = null;
        }
    }

    function computeTotals() {
        var subtotal = 0;
        state.lines.forEach(function (line) {
            subtotal += parseFloat(line.line_total_usd) || 0;
        });
        subtotal = Math.round(subtotal * 100) / 100;
        var tax = Math.round(subtotal * TAX_RATE * 100) / 100;
        var total = Math.round((subtotal + tax) * 100) / 100;
        return { subtotal: subtotal, tax: tax, total: total };
    }

    function slotIsSingleton(slot) {
        return String(slot || '').indexOf('gear_') !== 0;
    }

    function addLine(dto) {
        var adapter = global.MDJEventBuilderAdapter;
        if (!adapter || !dto) {
            return null;
        }
        var line = adapter.buildLineFromCatalog(dto);
        if (!line) {
            return null;
        }
        if (!line.line_status) {
            line.line_status = 'cotizado';
        }
        if (slotIsSingleton(line.slot)) {
            state.lines = state.lines.filter(function (l) {
                return l.slot !== line.slot;
            });
        } else {
            var existing = state.lines.find(function (l) {
                return l.catalog_sku === line.catalog_sku;
            });
            if (existing) {
                existing.quantity += line.quantity;
                existing.line_total_usd = Math.round(existing.unit_price_usd * existing.quantity * 100) / 100;
                persistDraft();
                render();
                return existing;
            }
        }
        state.lines.push(line);
        persistDraft();
        render();
        return line;
    }

    function removeLine(lineId) {
        state.lines = state.lines.filter(function (l) {
            return l.line_id !== lineId;
        });
        persistDraft();
        render();
    }

    function removeByCatalogSku(sku) {
        var key = String(sku || '');
        if (!key) {
            return;
        }
        state.lines.filter(function (l) {
            return l.catalog_sku === key;
        }).forEach(function (l) {
            removeLine(l.line_id);
        });
    }

    function replaceLineInSlot(slot, dto) {
        state.lines = state.lines.filter(function (l) {
            return l.slot !== slot;
        });
        var next = Object.assign({}, dto, { slot: slot });
        return addLine(next);
    }

    function getDraft() {
        return {
            schema_version: state.schema_version,
            draft_id: state.draft_id,
            lines: state.lines.slice(),
            assigned_lead_id: state.assigned_lead_id && mdjEbUuidLike(state.assigned_lead_id) ? state.assigned_lead_id : null,
            updated_at: state.updated_at
        };
    }

    function clearDraft() {
        state.lines = [];
        state.assigned_lead_id = null;
        state.draft_id = uuid();
        persistDraft();
        var asel = mdjEbGetAssignSelectEl();
        if (asel) {
            asel.selectedIndex = 0;
        }
        render();
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function lineIsDjFamilyEvent(line) {
        return !!(line && line.slot === 'dj_primary' && line.catalog_sku === 'dj_family');
    }

    var TALENT_CAJON_KEYS = {
        dj: 1, horaloca: 1, live: 1, live_music: 1,
        visuals: 1, mc: 1, staff: 1, payaso: 1
    };

    function lineIsTalentRow(line) {
        return !!(line && TALENT_CAJON_KEYS[line.category_key]);
    }

    function mdjEbNormalizeMockFamilyRows() {
        return MDJ_EB_MOCK_DJS_FAMILY.map(function (dj) {
            return {
                user_id:    '',
                stage:      dj.stage,
                legal:      dj.legal,
                stars_label: dj.stars_label,
                score_paren: dj.score_paren,
                status:     dj.status,
                avatar_url: dj.avatar_url,
                tier_label: dj.tier_label || 'LITE',
                specialty:  dj.specialty || 'DJ'
            };
        });
    }

    function mdjEbRatingToStarsLabel(rating) {
        var n = parseFloat(rating);
        if (!isFinite(n) || n <= 0) {
            return '—';
        }
        var rounded = Math.round(Math.min(5, Math.max(0, n)));
        var filled = '★'.repeat(rounded);
        var empty = '☆'.repeat(5 - rounded);
        return filled + empty;
    }

    function mdjEbReviewParen(row) {
        var rc = row.review_count;
        if (rc != null && rc !== '' && isFinite(Number(rc))) {
            return '(' + String(Number(rc)) + ')';
        }
        var r = row.rating;
        if (r != null && r !== '' && isFinite(Number(r))) {
            return '(' + Number(r).toFixed(1) + ')';
        }
        return '';
    }

    function mdjEbNormalizeFamilyDjRowFromPublic(row) {
        if (!row) {
            return null;
        }
        var stage = String(row.stage_name || row.dj_name || '').trim() || 'DJ';
        var legal = String(row.full_name || '').trim();
        if (!legal) {
            legal = '—';
        }
        var av = String(row.photo_url || '').trim();
        if (!av) {
            av = './assets/branding/logo-transparent.png';
        }
        var uid = row.user_id ? String(row.user_id).trim() : '';
        var pl  = String(row.plan || '').toUpperCase();
        var pt  = String(row.plan_type || '').toUpperCase();
        var tierLabel = 'LITE';
        if (pl === 'ELITE' || pt.indexOf('ELITE') !== -1) {
            tierLabel = 'ELITE';
        } else if (pl === 'PRO' || row.is_premium === true || pt === 'PRO_MONTHLY' || pt === 'PRO_ANNUAL' || pt === 'PRO') {
            tierLabel = 'PRO';
        }
        return {
            user_id:    uid,
            stage:      stage,
            legal:      legal,
            stars_label: mdjEbRatingToStarsLabel(row.rating),
            score_paren: mdjEbReviewParen(row),
            status:     row.available ? 'Available' : '—',
            avatar_url: av,
            tier_label: tierLabel,
            // Si artist_specialty está vacío, el perfil es de DJ por defecto
            // (public_dj_profiles es una tabla de artistas DJ)
            specialty:  String(row.artist_specialty || 'DJ').trim() || 'DJ'
        };
    }

    /** Solo artistas con MDJ Pro / suscripción activa (mismo criterio que subscription.js + roster). */
    function mdjEbIsSubscribedArtistRow(row) {
        if (!row) {
            return false;
        }
        var mdb = global.MDB_SUBSCRIPTION;
        if (mdb && typeof mdb.isPremiumTier === 'function') {
            return !!mdb.isPremiumTier(row);
        }
        var pl = String(row.plan || '').toUpperCase();
        var st = String(row.plan_status || 'inactive').toLowerCase();
        var activePlan = st === 'active' && (!row.plan_expires_at || new Date(row.plan_expires_at) > new Date());
        if (row.is_premium === true) {
            return true;
        }
        var sub = String(row.subscription_status || '').toLowerCase();
        if (sub === 'active' || sub === 'trialing') {
            return true;
        }
        if ((pl === 'PRO' || pl === 'ELITE') && activePlan) {
            return true;
        }
        var pt = String(row.plan_type || '');
        if ((pt === 'pro_monthly' || pt === 'pro_annual' || pt === 'PRO') && activePlan) {
            return true;
        }
        return false;
    }

    /** Entre perfiles de pago: ELITE > PRO / is_premium / plan_type pro_* > suscripción Stripe sola. */
    function mdjEbPremiumTierOrder(row) {
        if (!row || !mdjEbIsSubscribedArtistRow(row)) {
            return 0;
        }
        var pl = String(row.plan || '').toUpperCase();
        var pt = String(row.plan_type || '').toUpperCase();
        if (pl === 'ELITE' || pt.indexOf('ELITE') !== -1) {
            return 4;
        }
        if (pl === 'PRO' || row.is_premium === true) {
            return 3;
        }
        if (pt === 'PRO_MONTHLY' || pt === 'PRO_ANNUAL' || pt === 'PRO') {
            return 3;
        }
        var sub = String(row.subscription_status || '').toLowerCase();
        if (sub === 'active' || sub === 'trialing') {
            return 2;
        }
        return 2;
    }

    function mdjEbRankFamilyDjRow(row) {
        var mdb = global.MDB_SUBSCRIPTION;
        if (mdb && typeof mdb.searchRankScore === 'function') {
            return mdb.searchRankScore(row);
        }
        var r = parseFloat(row && row.rating);
        return isFinite(r) ? r * 1e6 : 0;
    }

    /**
     * Orden único para la tabla Family: prioriza Pro/premium (mdjEbIsSubscribedArtistRow + tier),
     * luego el resto de DJs available con user_id (LITE, etc.); hasta 3 filas, sin duplicar user_id.
     */
    function mdjEbFamilyRowPickScore(row) {
        if (!row || !row.user_id || row.available !== true) {
            return -1;
        }
        var proBoost = mdjEbIsSubscribedArtistRow(row) ? 1e18 : 0;
        var tier = mdjEbPremiumTierOrder(row);
        var rank = mdjEbRankFamilyDjRow(row);
        var rate = parseFloat(row.rating);
        rate = isFinite(rate) ? rate : 0;
        return proBoost + tier * 1e12 + rank + rate;
    }

    /**
     * Filas de operación (dueño/admin) suelen tener stage_name o dj_name "OWNER" y available=true;
     * no deben salir como opción de contratación. La vista no siempre expone dj_profiles.role → heurística por nombre.
     */
    function mdjEbIsNonBookableStaffRosterRow(row) {
        if (!row) {
            return true;
        }
        var reserved = ['OWNER', 'ADMIN'];
        function exactReserved(s) {
            var t = String(s || '')
                .trim()
                .toUpperCase();
            return reserved.indexOf(t) !== -1;
        }
        if (exactReserved(row.stage_name) || exactReserved(row.dj_name)) {
            return true;
        }
        var u = String(row.username || '')
            .trim()
            .toUpperCase();
        return u === 'OWNER' || u === 'ADMIN';
    }

    function mdjEbPickFamilyDjRows(raw) {
        var data = Array.isArray(raw) ? raw.slice() : [];
        var pool = data.filter(function (r) {
            return r && r.available === true && r.user_id && !mdjEbIsNonBookableStaffRosterRow(r);
        });
        pool.sort(function (a, b) {
            return mdjEbFamilyRowPickScore(b) - mdjEbFamilyRowPickScore(a);
        });
        var seen = {};
        var pick = [];
        var i;
        var uid;
        for (i = 0; i < pool.length && pick.length < 3; i++) {
            uid = String(pool[i].user_id);
            if (!seen[uid]) {
                seen[uid] = true;
                pick.push(pool[i]);
            }
        }
        return pick;
    }

    function mdjEbUuidLike(uid) {
        var s = String(uid || '').trim();
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
    }

    function mdjEbGetQueryLeadId() {
        try {
            var u = new URL(global.location.href);
            var v = u.searchParams.get('lead');
            return mdjEbUuidLike(v) ? String(v).trim() : null;
        } catch (eU) {
            return null;
        }
    }

    function mdjEbPortalHubLeadGranted(sessionUserId, leadId) {
        if (!sessionUserId || !leadId) {
            return false;
        }
        try {
            var raw = global.sessionStorage.getItem(MDJ_EB_PORTAL_HUB_STORAGE_KEY);
            if (!raw) {
                return false;
            }
            var o = JSON.parse(raw);
            if (!o || String(o.uid) !== String(sessionUserId)) {
                return false;
            }
            if (Date.now() - Number(o.ts || 0) > 86400000) {
                return false;
            }
            return (o.ids || []).some(function (id) {
                return String(id) === String(leadId);
            });
        } catch (eG) {
            return false;
        }
    }

    /**
     * Same merge rule as portalFetchLeadsForLoggedInUser (client-portal.js) — do not import that file.
     */
    async function mdjEbFetchLeadsForLoggedInUser(db, sessionUserId, emailNorm) {
        var cols =
            'id,email,client_user_id,event_type,event_date,status,created_at,payment_status,balance_paid,total_amount';
        var seen = {};
        var rows = [];
        function absorb(data) {
            (data || []).forEach(function (row) {
                if (row && row.id && !seen[row.id]) {
                    seen[row.id] = true;
                    rows.push(row);
                }
            });
        }
        var lastErr = null;
        if (sessionUserId) {
            var r1 = await db
                .from('leads')
                .select(cols)
                .eq('client_user_id', sessionUserId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (r1.error) {
                lastErr = r1.error;
            }
            absorb(r1.data);
        }
        if (emailNorm) {
            var r2 = await db
                .from('leads')
                .select(cols)
                .ilike('email', emailNorm)
                .order('created_at', { ascending: false })
                .limit(50);
            if (r2.error && !lastErr) {
                lastErr = r2.error;
            }
            absorb(r2.data);
        }
        rows.sort(function (a, b) {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        if (rows.length > 50) {
            rows = rows.slice(0, 50);
        }
        return { data: rows, error: rows.length ? null : lastErr };
    }

    async function mdjEbSessionOwnsLead(db, leadId, sessionUserId, sessionEmail) {
        if (!db || !leadId) {
            return false;
        }
        if (sessionUserId && mdjEbPortalHubLeadGranted(sessionUserId, leadId)) {
            return true;
        }
        try {
            var peek = await db.from('leads').select('email, client_user_id').eq('id', leadId).maybeSingle();
            if (peek.data) {
                var rowEmail = peek.data.email ? String(peek.data.email).trim().toLowerCase() : '';
                var emailOk = rowEmail && sessionEmail && rowEmail === sessionEmail;
                var uidOk =
                    sessionUserId &&
                    peek.data.client_user_id &&
                    String(peek.data.client_user_id) === String(sessionUserId);
                if (emailOk || uidOk) {
                    return true;
                }
            }
        } catch (eP) {
            void eP;
        }
        var q = await mdjEbFetchLeadsForLoggedInUser(db, sessionUserId, sessionEmail);
        var leads = q.data || [];
        return leads.some(function (L) {
            return L && String(L.id) === String(leadId);
        });
    }

    function mdjEbFormatLeadAssignLabel(row) {
        var et = row && row.event_type ? String(row.event_type).trim() : '';
        return et || 'Event';
    }

    function mdjEbEventDateIsoFromRow(row) {
        var d = row && row.event_date != null ? String(row.event_date).trim() : '';
        if (d.length >= 10) {
            return d.slice(0, 10);
        }
        return '';
    }

    function mdjEbGetContextDateSelects() {
        return {
            day: global.document.querySelector('select.mdj-eb-context-bar__select--day'),
            month: global.document.querySelector('select.mdj-eb-context-bar__select--month'),
            year: global.document.querySelector('select.mdj-eb-context-bar__select--year')
        };
    }

    /** Mes corto en select (Sep, no «9 — Sep»); hints Día/Mes/Año quedan en HTML. */
    function mdjEbNormalizeContextBarDateSelects() {
        var sels = mdjEbGetContextDateSelects();
        if (sels.month) {
            var opts = sels.month.options;
            var i;
            for (i = 0; i < opts.length; i++) {
                var mo = parseInt(opts[i].value, 10);
                if (mo >= 1 && mo <= 12) {
                    opts[i].textContent = MDJ_EB_MONTH_SHORT[mo];
                } else if (!opts[i].value) {
                    opts[i].textContent = 'Mes';
                }
            }
        }
        if (sels.day) {
            var dopts = sels.day.options;
            var j;
            for (j = 0; j < dopts.length; j++) {
                if (!dopts[j].value && dopts[j].disabled) {
                    dopts[j].textContent = 'Día';
                }
            }
        }
        if (sels.year) {
            var yopts = sels.year.options;
            var k;
            for (k = 0; k < yopts.length; k++) {
                if (!yopts[k].value && yopts[k].disabled) {
                    yopts[k].textContent = 'Año';
                }
            }
        }
    }

    function mdjEbApplyContextDateIso(iso) {
        var sels = mdjEbGetContextDateSelects();
        if (!sels.day || !sels.month || !sels.year) {
            return;
        }
        var d = String(iso || '').trim().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
            return;
        }
        var parts = d.split('-');
        sels.year.value = parts[0];
        sels.month.value = String(parseInt(parts[1], 10));
        sels.day.value = String(parseInt(parts[2], 10));
    }

    function mdjEbSyncContextDateForLeadId(leadId, rows) {
        if (!leadId || !rows || !rows.length) {
            return;
        }
        var i;
        for (i = 0; i < rows.length; i++) {
            if (rows[i] && String(rows[i].id) === String(leadId)) {
                mdjEbApplyContextDateIso(mdjEbEventDateIsoFromRow(rows[i]));
                return;
            }
        }
    }

    function mdjEbGetAssignSelectEl() {
        return global.document.querySelector('select.mdj-eb-context-bar__select--assign');
    }

    async function mdjEbRefreshAssignDropdown() {
        var sel = mdjEbGetAssignSelectEl();
        if (!sel || ebAssignRefreshInFlight) {
            return;
        }
        var db = typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null;
        if (!db || typeof db.from !== 'function') {
            return;
        }
        ebAssignRefreshInFlight = true;
        try {
            var res = await db.auth.getSession();
            var session = res && res.data && res.data.session;
            if (!session || !session.user) {
                sel.innerHTML = '<option value="" selected disabled>Sign in to assign…</option>';
                return;
            }
            var uid = String(session.user.id);
            var emailNorm = session.user.email ? String(session.user.email).trim().toLowerCase() : '';
            var q = await mdjEbFetchLeadsForLoggedInUser(db, uid, emailNorm);
            var rows = q.data || [];
            var urlLead = mdjEbGetQueryLeadId();
            var html = '<option value="" disabled selected>Asignar…</option>';
            var seen = {};
            rows.forEach(function (row) {
                if (!row || !row.id) {
                    return;
                }
                seen[String(row.id)] = true;
                var id = String(row.id);
                var lab = escapeHtml(mdjEbFormatLeadAssignLabel(row));
                var iso = escapeHtml(mdjEbEventDateIsoFromRow(row));
                html +=
                    '<option value="' +
                    escapeHtml(id) +
                    '"' +
                    (iso ? ' data-event-date="' + iso + '"' : '') +
                    '>' +
                    lab +
                    '</option>';
            });
            if (urlLead && !seen[urlLead]) {
                var peek = await db
                    .from('leads')
                    .select('id,event_type,event_date,email,client_user_id')
                    .eq('id', urlLead)
                    .maybeSingle();
                var prow = peek && peek.data;
                var ok = await mdjEbSessionOwnsLead(db, urlLead, uid, emailNorm);
                if (ok && prow) {
                    var pIso = escapeHtml(mdjEbEventDateIsoFromRow(prow));
                    html +=
                        '<option value="' +
                        escapeHtml(String(prow.id)) +
                        '"' +
                        (pIso ? ' data-event-date="' + pIso + '"' : '') +
                        '>' +
                        escapeHtml(mdjEbFormatLeadAssignLabel(prow)) +
                        '</option>';
                    rows.push(prow);
                }
            }
            html +=
                '<option value="' +
                escapeHtml(MDJ_EB_ASSIGN_CREATE_EVENT) +
                '">+ Crear evento nuevo</option>';
            sel.innerHTML = html;
            var pick =
                state.assigned_lead_id && mdjEbUuidLike(state.assigned_lead_id) ? state.assigned_lead_id : '';
            if (!pick && urlLead) {
                var ownPre = await mdjEbSessionOwnsLead(db, urlLead, uid, emailNorm);
                if (ownPre) {
                    pick = urlLead;
                    state.assigned_lead_id = urlLead;
                    persistDraft();
                }
            }
            if (pick) {
                sel.value = pick;
                if (sel.value !== pick) {
                    sel.selectedIndex = 0;
                } else {
                    mdjEbSyncContextDateForLeadId(pick, rows);
                    var optPick = sel.selectedOptions && sel.selectedOptions[0];
                    if (optPick && optPick.getAttribute('data-event-date')) {
                        mdjEbApplyContextDateIso(optPick.getAttribute('data-event-date'));
                    }
                }
            }
        } catch (eR) {
            try {
                console.warn('[MDJEventBuilder] assign dropdown:', eR && eR.message ? eR.message : eR);
            } catch (eL) {
                void eL;
            }
        } finally {
            ebAssignRefreshInFlight = false;
        }
    }

    function mdjEbBindAssignSelectOnce() {
        var sel = mdjEbGetAssignSelectEl();
        if (!sel || sel.getAttribute('data-mdj-eb-assign-bound') === '1') {
            return;
        }
        sel.setAttribute('data-mdj-eb-assign-bound', '1');
        sel.addEventListener('change', function () {
            var v = sel.value ? String(sel.value).trim() : '';
            if (v === MDJ_EB_ASSIGN_CREATE_EVENT) {
                state.assigned_lead_id = null;
                persistDraft();
                try {
                    global.location.href = './client-portal.html';
                } catch (eNav) {
                    void eNav;
                }
                return;
            }
            state.assigned_lead_id = mdjEbUuidLike(v) ? v : null;
            persistDraft();
            var opt = sel.selectedOptions && sel.selectedOptions[0];
            if (opt && opt.getAttribute('data-event-date')) {
                mdjEbApplyContextDateIso(opt.getAttribute('data-event-date'));
            }
        });
    }

    function mdjEbParseNotesObject(raw) {
        if (raw == null || raw === '') {
            return {};
        }
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
            return Object.assign({}, raw);
        }
        try {
            var j = JSON.parse(String(raw));
            return typeof j === 'object' && j !== null && !Array.isArray(j) ? Object.assign({}, j) : {};
        } catch (eN) {
            return {};
        }
    }

    function mdjEbMapLinesToSelectedServices(lines) {
        return (lines || []).map(function (line) {
            var name = String(line.name || 'Item').trim() || 'Item';
            var stage = line.selected_artist_stage_name && String(line.selected_artist_stage_name).trim();
            if (stage) {
                name = name + ' — DJ: ' + stage;
            }
            var qty = parseInt(line.quantity, 10);
            if (!isFinite(qty) || qty < 1) {
                qty = 1;
            }
            var price = parseFloat(line.unit_price_usd);
            if (!isFinite(price)) {
                price = 0;
            }
            price = Math.round(price * 100) / 100;
            return { name: name, price: price, qty: qty };
        });
    }

    function mdjEbTotalsFromSelectedServices(services) {
        var subtotal = 0;
        (services || []).forEach(function (item) {
            var p = parseFloat(item.price) || 0;
            var q = parseInt(item.qty, 10) || 1;
            subtotal += p * q;
        });
        subtotal = Math.round(subtotal * 100) / 100;
        var tax = Math.round(subtotal * TAX_RATE * 100) / 100;
        var total = Math.round((subtotal + tax) * 100) / 100;
        return { subtotal: subtotal, tax: tax, total: total };
    }

    function mdjEbDjFamilyRowSelectable(dj) {
        return ebFamilyDjSource === 'supabase' && mdjEbUuidLike(dj && dj.user_id);
    }

    function mdjEbDjFamilyTableRowHtml(dj, line) {
        line = line || {};
        var profileHref = dj.user_id ? './dj-profile.html?id=' + encodeURIComponent(dj.user_id) : './dj-profile.html';
        var uid = dj.user_id ? String(dj.user_id).trim() : '';
        var selected = !!(line.selected_artist_id && uid && String(line.selected_artist_id).trim() === uid);
        var trClass = 'mdj-eb-dj-pick-table__tr' + (selected ? ' mdj-eb-dj-pick-table__tr--selected' : '');
        var selectable = mdjEbDjFamilyRowSelectable(dj);
        var stageAttr = escapeHtml(dj.stage || '');
        var photoAttr = escapeHtml(dj.avatar_url || '');
        var hrefAttr = escapeHtml(profileHref);
        var lineIdAttr = escapeHtml(line.line_id || '');
        var artistIdAttr = escapeHtml(uid);
        var btnHtml;
        if (selectable) {
            btnHtml =
                '<button type="button" class="mdj-eb-dj-pick-table__select' +
                (selected ? ' mdj-eb-dj-pick-table__select--selected' : '') +
                '" data-mdj-eb-roster-select="1" data-line-id="' +
                lineIdAttr +
                '" data-artist-id="' +
                artistIdAttr +
                '" data-artist-stage="' +
                stageAttr +
                '" data-artist-photo="' +
                photoAttr +
                '" data-artist-profile-href="' +
                hrefAttr +
                '" aria-pressed="' +
                (selected ? 'true' : 'false') +
                '">' +
                (selected ? 'Selected' : 'Select DJ') +
                '</button>';
        } else {
            btnHtml =
                '<button type="button" class="mdj-eb-dj-pick-table__select" disabled aria-pressed="false">Preview</button>';
        }
        return (
            '<tr class="' +
            trClass +
            '">' +
            '<td class="mdj-eb-dj-pick-table__td mdj-eb-dj-pick-table__td--photo">' +
            '<img class="mdj-eb-dj-pick-table__avatar" src="' +
            escapeHtml(dj.avatar_url) +
            '" alt="" width="40" height="40" loading="lazy">' +
            '</td>' +
            '<td class="mdj-eb-dj-pick-table__td mdj-eb-dj-pick-table__td--stage">' +
            escapeHtml(dj.stage) +
            '</td>' +
            '<td class="mdj-eb-dj-pick-table__td mdj-eb-dj-pick-table__td--legal">' +
            escapeHtml(dj.legal) +
            '</td>' +
            '<td class="mdj-eb-dj-pick-table__td mdj-eb-dj-pick-table__td--rating">' +
            '<span class="mdj-eb-dj-pick-table__stars" aria-hidden="true">' +
            escapeHtml(dj.stars_label) +
            '</span>' +
            ' <span class="mdj-eb-dj-pick-table__score">' +
            escapeHtml(dj.score_paren) +
            '</span>' +
            '</td>' +
            '<td class="mdj-eb-dj-pick-table__td mdj-eb-dj-pick-table__td--status">' +
            escapeHtml(dj.status) +
            '</td>' +
            '<td class="mdj-eb-dj-pick-table__td mdj-eb-dj-pick-table__td--visit">' +
            '<a class="mdj-eb-dj-pick-table__link" href="' +
            escapeHtml(profileHref) +
            '">Visit Profile</a>' +
            '</td>' +
            '<td class="mdj-eb-dj-pick-table__td mdj-eb-dj-pick-table__td--select">' +
            btnHtml +
            '</td>' +
            '</tr>'
        );
    }

    function mdjEbTriggerFamilyDjFetchIfNeeded() {
        if (ebFamilyDjReady || ebFamilyDjInFlight) {
            return;
        }
        var i;
        var need = false;
        for (i = 0; i < state.lines.length; i++) {
            if (lineIsTalentRow(state.lines[i])) {
                need = true;
                break;
            }
        }
        if (!need) {
            return;
        }
        var sb = typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null;
        if (!sb || typeof sb.from !== 'function') {
            ebFamilyDjReady  = true;
            ebFamilyDjSource = 'mock';
            ebFamilyDjRows   = mdjEbNormalizeMockFamilyRows();
            ebAllDjNorm      = ebFamilyDjRows.slice();
            return;
        }
        ebFamilyDjInFlight = true;
        /* Incluir artist_specialty para filtrado por categoría de cajón. */
        var sel =
            'user_id, dj_slug, stage_name, dj_name, full_name, photo_url, rating, available,' +
            'plan, plan_type, plan_status, plan_expires_at, is_premium, subscription_status,' +
            'artist_specialty';
        var q = sb
            .from('public_dj_profiles')
            .select(sel)
            .eq('available', true)
            .order('is_premium', { ascending: false })
            .order('rating', { ascending: false })
            .limit(120);
        var p = q.then ? q : null;
        if (!p || typeof p.then !== 'function') {
        ebFamilyDjInFlight = false;
        ebFamilyDjReady    = true;
        ebFamilyDjSource   = 'mock';
        ebFamilyDjRows     = mdjEbNormalizeMockFamilyRows();
        ebAllDjNorm        = ebFamilyDjRows.slice();
        return;
        }
        p.then(function (res) {
            ebFamilyDjInFlight = false;
            var err = res && res.error;
            var data = res && res.data;
            if (err) {
                try {
                    console.warn('[MDJEventBuilder] public_dj_profiles:', err.message || String(err));
                } catch (eLog) {
                    void eLog;
                }
                ebFamilyDjReady  = true;
                ebFamilyDjSource = 'mock';
                ebFamilyDjRows   = mdjEbNormalizeMockFamilyRows();
                ebAllDjNorm      = ebFamilyDjRows.slice();
                render();
                return;
            }
            if (!Array.isArray(data)) {
                data = [];
            }
            var picked = mdjEbPickFamilyDjRows(data);
            ebFamilyDjReady  = true;
            ebFamilyDjSource = 'supabase';
            ebFamilyDjRows   = picked.map(mdjEbNormalizeFamilyDjRowFromPublic).filter(Boolean);
            // Pool completo para filtrado por categoría (PRO primero, sin límite de 3)
            ebAllDjNorm = data
                .filter(function (r) { return r && r.available === true && r.user_id && !mdjEbIsNonBookableStaffRosterRow(r); })
                .sort(function (a, b) { return mdjEbFamilyRowPickScore(b) - mdjEbFamilyRowPickScore(a); })
                .map(mdjEbNormalizeFamilyDjRowFromPublic)
                .filter(Boolean);
            render();
        }).catch(function (err) {
            ebFamilyDjInFlight = false;
            ebFamilyDjReady  = true;
            ebFamilyDjSource = 'mock';
            ebFamilyDjRows   = mdjEbNormalizeMockFamilyRows();
            ebAllDjNorm      = ebFamilyDjRows.slice();
            try {
                console.warn('[MDJEventBuilder] family roster:', err && err.message ? err.message : err);
            } catch (e2) {
                void e2;
            }
            render();
        });
    }

    /**
     * Mapa category_key → fragmentos de texto que pueden aparecer en artist_specialty.
     * Cuando un artista nuevo se registra con la specialty correcta, aparece automáticamente
     * en la lista del cajón correspondiente sin ningún cambio de código.
     */
    /** Reads day/month/year selects → ISO date string YYYY-MM-DD, or '' if incomplete. */
    function mdjEbReadContextDateIso() {
        var sels = mdjEbGetContextDateSelects();
        var y = sels.year && sels.year.value ? String(sels.year.value).trim() : '';
        var m = sels.month && sels.month.value ? String(parseInt(sels.month.value, 10)) : '';
        var d = sels.day && sels.day.value ? String(parseInt(sels.day.value, 10)) : '';
        if (!y || !m || !d || isNaN(parseInt(m, 10)) || isNaN(parseInt(d, 10))) { return ''; }
        var mm = parseInt(m, 10) < 10 ? '0' + parseInt(m, 10) : String(parseInt(m, 10));
        var dd = parseInt(d, 10) < 10 ? '0' + parseInt(d, 10) : String(parseInt(d, 10));
        return y + '-' + mm + '-' + dd;
    }

    /**
     * Queries Supabase leads for the given date and returns a plain object map
     * { [artist_uuid]: true } for every artist already assigned to a lead on that date.
     * Reads leads.notes.selected_services[].selected_artist_id (MVP-A schema).
     * Returns {} (no-busy) on any error or when no date is provided.
     */
    async function mdjEbFetchBusyArtistIdsForDate(db, dateIso) {
        var busyMap = {};
        if (!db || !dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) { return busyMap; }
        try {
            var res = await db
                .from('leads')
                .select('notes')
                .gte('event_date', dateIso + 'T00:00:00')
                .lte('event_date', dateIso + 'T23:59:59')
                .neq('status', 'cancelled');
            if (res.error || !Array.isArray(res.data)) { return busyMap; }
            res.data.forEach(function (row) {
                try {
                    var notes = row.notes;
                    if (typeof notes === 'string') { notes = JSON.parse(notes); }
                    var services = notes && Array.isArray(notes.selected_services) ? notes.selected_services : [];
                    services.forEach(function (svc) {
                        if (svc && svc.selected_artist_id) {
                            busyMap[String(svc.selected_artist_id).trim()] = true;
                        }
                    });
                } catch (e) { /* ignore parse errors per row */ }
            });
        } catch (e) { /* ignore network / permission errors */ }
        return busyMap;
    }

    var SPECIALTY_CAJON_MAP = {
        dj:         ['dj', 'open format', 'wedding', 'latin', 'edm', 'hip hop', 'reggaeton', 'house', 'techno', 'trap', 'productor'],
        horaloca:   ['hora loca'],
        live:       ['músicos en vivo', 'musicos en vivo', 'orquesta', 'banda', 'cantante', 'violinista', 'saxofonista', 'percusionista', 'live'],
        live_music: ['músicos en vivo', 'musicos en vivo', 'orquesta', 'banda', 'cantante'],
        mc:         ['mc', 'presentador', 'animador'],
        visuals:    ['captura', 'visual', 'foto booth', '360', 'fotografo', 'videografo'],
        payaso:     ['payaso', 'clown', 'infantil'],
        staff:      ['staff', 'bartender', 'mesero', 'camarero', 'cocinero', 'chef', 'limpieza', 'utileria', 'operador', 'drone']
    };

    var EB_TIER_ORDER = { ELITE: 3, PRO: 2, LITE: 1 };

    /**
     * Retorna los top-3 artistas del pool completo (ebAllDjNorm) filtrados por categoría.
     * PRO/ELITE siempre primero. Si no hay match de specialty, devuelve los top-3 globales.
     * Cualquier artista que en el futuro se registre con la specialty correcta aparece aquí.
     */
    function mdjEbFilterTalentForCategory(categoryKey) {
        var pool = ebAllDjNorm && ebAllDjNorm.length ? ebAllDjNorm : (ebFamilyDjRows || []);
        var keywords = SPECIALTY_CAJON_MAP[categoryKey] || [];
        // Sin fallback: si no hay artistas en esta categoría se retorna vacío
        // y el picker muestra cartel "Pendiente de asignación por el board"
        if (keywords.length === 0) { return []; }
        var matched = pool.filter(function (row) {
            var sp = String(row.specialty || '').toLowerCase();
            return keywords.some(function (kw) { return sp.indexOf(kw) !== -1; });
        });
        matched.sort(function (a, b) {
            return (EB_TIER_ORDER[b.tier_label] || 0) - (EB_TIER_ORDER[a.tier_label] || 0);
        });
        return matched.slice(0, 3);
    }

    function renderTalentMiniCard(dj, line, isBusy) {
        var uid      = String(dj.user_id || '').trim();
        var selected = !!(line.selected_artist_id && uid && String(line.selected_artist_id).trim() === uid);
        var selectable = ebFamilyDjSource === 'supabase' && mdjEbUuidLike(uid);
        var tier     = dj.tier_label || 'LITE';
        var profileHref = uid ? './dj-profile.html?id=' + encodeURIComponent(uid) : './dj-profile.html';
        var busyBadge = isBusy
            ? '<span class="mdj-eb-talent-mini__busy-badge" title="Artista ya asignado en otro evento esta fecha">⚠ Ocupado</span>'
            : '';
        var btnHtml;
        if (selectable) {
            btnHtml =
                '<button type="button"' +
                ' class="mdj-eb-talent-mini__assign' + (selected ? ' mdj-eb-talent-mini__assign--active' : '') + (isBusy ? ' mdj-eb-talent-mini__assign--busy' : '') + '"' +
                ' data-mdj-eb-roster-select="1"' +
                ' data-line-id="' + escapeHtml(line.line_id) + '"' +
                ' data-artist-id="' + escapeHtml(uid) + '"' +
                ' data-artist-stage="' + escapeHtml(dj.stage) + '"' +
                ' data-artist-photo="' + escapeHtml(dj.avatar_url) + '"' +
                ' data-artist-profile-href="' + escapeHtml(profileHref) + '"' +
                ' aria-pressed="' + (selected ? 'true' : 'false') + '">' +
                (selected ? '✓ Asignado — Cambiar' : (isBusy ? 'Asignar igualmente' : 'Asignar')) +
                '</button>';
        } else {
            btnHtml = '<button type="button" class="mdj-eb-talent-mini__assign" disabled>Vista previa</button>';
        }
        var profileUrl = uid ? './dj-profile.html?id=' + encodeURIComponent(uid) : './dj-profile.html';
        return (
            '<div class="mdj-eb-talent-mini__card' + (selected ? ' mdj-eb-talent-mini__card--selected' : '') + (isBusy ? ' mdj-eb-talent-mini__card--busy' : '') + '">' +
            '<img class="mdj-eb-talent-mini__avatar" src="' + escapeHtml(dj.avatar_url) + '" alt="" width="52" height="52" loading="lazy">' +
            '<div class="mdj-eb-talent-mini__info">' +
            '<div class="mdj-eb-talent-mini__top">' +
            '<span class="mdj-eb-talent-mini__stage">' + escapeHtml(dj.stage) + '</span>' +
            '<span class="mdj-eb-talent-mini__tier mdj-eb-talent-mini__tier--' + tier.toLowerCase() + '">' + tier + '</span>' +
            busyBadge +
            '</div>' +
            '<div class="mdj-eb-talent-mini__legal">' + escapeHtml(dj.legal) + '</div>' +
            '</div>' +
            '<div class="mdj-eb-talent-mini__actions">' +
            btnHtml +
            '<a class="mdj-eb-talent-mini__profile-link" href="' + escapeHtml(profileUrl) + '" target="_blank" rel="noopener">Ver perfil</a>' +
            '</div>' +
            '</div>'
        );
    }

    /**
     * @param {object} line  - cart line object
     * @param {object} [busyMap] - { [uuid]: true } artists already booked on the selected date
     * @param {boolean} [checkingAvailability] - true while async fetch is in progress
     */
    function renderTalentMiniPickerHtml(line, busyMap, checkingAvailability) {
        busyMap = busyMap || {};
        if (!ebFamilyDjReady) {
            return (
                '<div class="mdj-eb-talent-mini">' +
                '<div class="mdj-eb-talent-mini__loading">Cargando talentos…</div>' +
                '</div>'
            );
        }
        var artists = mdjEbFilterTalentForCategory(line.category_key);
        if (!artists || artists.length === 0) {
            return (
                '<div class="mdj-eb-talent-mini">' +
                '<div class="mdj-eb-talent-mini__pending">' +
                '<span class="mdj-eb-talent-mini__pending-icon">⏳</span>' +
                '<div class="mdj-eb-talent-mini__pending-body">' +
                '<strong>Pendiente de confirmación</strong>' +
                '<p>No hay artistas registrados en esta categoría aún. ' +
                'El board / staff revisará la solicitud y asignará al profesional correspondiente.</p>' +
                '</div>' +
                '</div>' +
                '</div>'
            );
        }
        var availabilityNote = checkingAvailability
            ? '<div class="mdj-eb-talent-mini__avail-note mdj-eb-talent-mini__avail-note--checking">Verificando disponibilidad…</div>'
            : (Object.keys(busyMap).length > 0
                ? '<div class="mdj-eb-talent-mini__avail-note">Disponibilidad verificada para la fecha del evento.</div>'
                : '');
        var cards = artists.map(function (dj) {
            var uid = String(dj.user_id || '').trim();
            var isBusy = !!(uid && busyMap[uid]);
            return renderTalentMiniCard(dj, line, isBusy);
        }).join('');
        return (
            '<div class="mdj-eb-talent-mini">' +
            '<div class="mdj-eb-talent-mini__label">Top talentos · PRO primero:</div>' +
            availabilityNote +
            '<div class="mdj-eb-talent-mini__cards">' + cards + '</div>' +
            '</div>'
        );
    }

    function renderDjFamilyPickerHtml(line) {
        line = line || {};
        var rows;
        if (!ebFamilyDjReady) {
            rows =
                '<tr><td class="mdj-eb-dj-pick-table__td" colspan="7" style="text-align:center;padding:14px;opacity:0.85;">Loading…</td></tr>';
        } else {
            rows = ebFamilyDjRows
                .map(function (dj) {
                    return mdjEbDjFamilyTableRowHtml(dj, line);
                })
                .join('');
        }
        return (
            '<div class="mdj-eb-line__dj-extra">' +
            '<details class="mdj-eb-dj-pick">' +
            '<summary class="mdj-eb-dj-pick__summary"><span class="mdj-eb-dj-pick__summary-label">Escoger DJ</span></summary>' +
            '<div class="mdj-eb-dj-pick__panel">' +
            '<table class="mdj-eb-dj-pick-table" aria-label="DJs (preview)">' +
            '<thead><tr>' +
            '<th class="mdj-eb-dj-pick-table__th mdj-eb-dj-pick-table__th--photo" scope="col">Photo</th>' +
            '<th class="mdj-eb-dj-pick-table__th" scope="col">Artistic</th>' +
            '<th class="mdj-eb-dj-pick-table__th" scope="col">Real name</th>' +
            '<th class="mdj-eb-dj-pick-table__th" scope="col">Rating</th>' +
            '<th class="mdj-eb-dj-pick-table__th" scope="col">Status</th>' +
            '<th class="mdj-eb-dj-pick-table__th" scope="col">Profile</th>' +
            '<th class="mdj-eb-dj-pick-table__th" scope="col">Select</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '</table>' +
            '</div>' +
            '</details>' +
            '</div>'
        );
    }

    // Mapa category_key → nombre del cajón en rentals.html
    var EB_CAJON_LABELS = {
        dj:          'Entretenimiento y Talento',
        horaloca:    'Entretenimiento y Talento',
        live:        'Entretenimiento y Talento',
        live_music:  'Entretenimiento y Talento',
        visuals:     'Entretenimiento y Talento',
        mc:          'Entretenimiento y Talento',
        staff:       'Entretenimiento y Talento',
        payaso:      'Entretenimiento y Talento',
        fx:          'Efectos Especiales',
        lighting:    'Iluminación y Pantallas LED',
        audio:       'Audio y Sonido Profesional',
        tents:       'Carpas y Estructuras',
        furniture:   'Mobiliario y Decoración',
        inflatables: 'Castillos Inflables',
        staging:     'Stage & Event Structures',
        stages:      'Stage & Event Structures',
        addon:       'Servicios Adicionales',
        general:     'Servicios Adicionales'
    };

    // Orden canónico de cajones + catch-all
    var CAJON_ORDER = [
        'Entretenimiento y Talento',
        'Audio y Sonido Profesional',
        'Iluminación y Pantallas LED',
        'Mobiliario y Decoración',
        'Efectos Especiales',
        'Carpas y Estructuras',
        'Stage & Event Structures',
        'Castillos Inflables',
        'Servicios Adicionales'
    ];

    var CRM_TABLE_HEAD =
        '<thead>' +
        '<tr class="mdj-eb-crm-thead-row">' +
        '<th class="mdj-eb-crm-th mdj-eb-crm-th--ln">#</th>' +
        '<th class="mdj-eb-crm-th mdj-eb-crm-th--svc">Servicio / Add-on</th>' +
        '<th class="mdj-eb-crm-th mdj-eb-crm-th--desc">Descripción</th>' +
        '<th class="mdj-eb-crm-th mdj-eb-crm-th--qty">Cant.</th>' +
        '<th class="mdj-eb-crm-th mdj-eb-crm-th--upr">P. Unit</th>' +
        '<th class="mdj-eb-crm-th mdj-eb-crm-th--sub">Subtotal</th>' +
        '<th class="mdj-eb-crm-th mdj-eb-crm-th--sta">Estado</th>' +
        '<th class="mdj-eb-crm-th mdj-eb-crm-th--prv">Proveedor</th>' +
        '<th class="mdj-eb-crm-th mdj-eb-crm-th--nts">Notas</th>' +
        '<th class="mdj-eb-crm-th mdj-eb-crm-th--act">Acción</th>' +
        '</tr>' +
        '</thead>';

    var EB_STATUS_CONFIG = {
        cotizado:      { label: 'Cotizado',      cls: 'mdj-eb-crm-badge--cotizado' },
        en_proceso:    { label: 'En proceso',    cls: 'mdj-eb-crm-badge--proceso' },
        confirmado:    { label: 'Confirmado',    cls: 'mdj-eb-crm-badge--confirmado' },
        no_disponible: { label: 'No disponible', cls: 'mdj-eb-crm-badge--nodisponible' }
    };

    function mdjEbStatusBadge(status) {
        var cfg = EB_STATUS_CONFIG[String(status || 'cotizado')] || EB_STATUS_CONFIG['cotizado'];
        return '<span class="mdj-eb-crm-badge ' + cfg.cls + '">' + cfg.label + '</span>';
    }

    function renderLines(container) {
        if (!container) {
            return;
        }

        // Preservar estado del DJ picker abierto
        var preserveOpenLineId = null;
        var openDet = container.querySelector('details.mdj-eb-dj-pick[open]');
        if (openDet) {
            var hostRow = openDet.closest('tr[data-line-id]');
            if (hostRow) {
                preserveOpenLineId = hostRow.getAttribute('data-line-id');
            }
        }

        // Agrupar líneas por cajón
        var linesByCajon = {};
        CAJON_ORDER.forEach(function (name) { linesByCajon[name] = []; });
        state.lines.forEach(function (line) {
            var key = EB_CAJON_LABELS[line.category_key] || EB_CAJON_LABELS[line.category_label] || 'Servicios Adicionales';
            if (!linesByCajon[key]) {
                linesByCajon[key] = [];
            }
            linesByCajon[key].push(line);
        });

        // Renderizar una fila CRM para una línea dentro de su cajón
        function renderCrmRow(line, idxInCajon) {
            var qty = Math.max(1, line.quantity || 1);
            var unitPrice = parseFloat(line.unit_price_usd) || 0;
            if (!unitPrice && qty > 0) {
                unitPrice = Math.round((parseFloat(line.line_total_usd) || 0) / qty * 100) / 100;
            }
            var subtotalLine = Math.round(qty * unitPrice * 100) / 100;
            var isTalent = lineIsTalentRow(line);

            // Ícono de perfil por categoría de talento
            var TALENT_PROFILE_ICON = {
                dj: '🎧', horaloca: '🎉', live: '🎵', live_music: '🎵',
                mc: '🎤', visuals: '📷', payaso: '🎪', staff: '👤'
            };

            // URL del perfil del artista asignado
            var artistHref = '';
            if (isTalent && line.selected_artist_id) {
                artistHref = line.selected_artist_profile_href
                    || ('./dj-profile.html?id=' + encodeURIComponent(line.selected_artist_id));
            }

            // DESCRIPCIÓN: solo nombre del artista, sin enlace ni flecha
            var selCell;
            if (isTalent && line.selected_artist_stage_name) {
                selCell = '<span class="mdj-eb-crm-sel-name">' + escapeHtml(String(line.selected_artist_stage_name)) + '</span>';
            } else {
                selCell = isTalent ? '<span class="mdj-eb-crm-sel-hint">Seleccionar talento</span>' : '';
            }

            // PROVEEDOR: MDJB si seleccionado en plataforma, nombre de vendedor si venta manual, — si nada
            var providerText;
            if (isTalent && line.selected_artist_stage_name) {
                if (line.selected_artist_roster_type === 'talent') {
                    providerText = 'MDJB';
                } else if (line.provider_name) {
                    providerText = escapeHtml(String(line.provider_name));
                } else {
                    providerText = 'MDJB';
                }
            } else {
                providerText = '—';
            }

            // NOTAS: ícono de categoría como enlace al perfil artístico
            // Si hay artista asignado → su perfil; si no → directorio de artistas
            var notesCell = '';
            if (isTalent) {
                var icon = TALENT_PROFILE_ICON[line.category_key] || '🔗';
                var linkHref = artistHref || './find-dj.html';
                var linkTitle = artistHref ? 'Ver perfil artístico' : 'Explorar artistas disponibles';
                var linkOpacity = artistHref ? '' : ' style="opacity:0.40;"';
                notesCell = '<a class="mdj-eb-crm-notes-link" href="' + escapeHtml(linkHref) + '" target="_blank" rel="noopener" title="' + linkTitle + '"' + linkOpacity + '>' + icon + '</a>';
            }

            var replaceBtn = line.replaceable
                ? '<button type="button" class="mdj-eb-line__replace mdj-eb-crm-act-btn" data-line-id="' + escapeHtml(line.line_id) + '" data-slot="' + escapeHtml(line.slot) + '" title="Reemplazar">↺</button>'
                : '';
            var removeBtn =
                '<button type="button" class="mdj-eb-line__remove mdj-eb-crm-act-btn mdj-eb-crm-act-btn--rm" data-line-id="' + escapeHtml(line.line_id) + '" title="Quitar">✕</button>';

            return (
                '<tr class="mdj-eb-crm-row' + (isTalent ? ' mdj-eb-crm-row--talent' : '') + '"' +
                (isTalent ? ' data-mdj-talent-row="1"' : '') +
                ' data-line-id="' + escapeHtml(line.line_id) + '">' +
                '<td class="mdj-eb-crm-td mdj-eb-crm-td--ln">' + (idxInCajon + 1) + '</td>' +
                '<td class="mdj-eb-crm-td mdj-eb-crm-td--svc">' + escapeHtml(line.name) + '</td>' +
                '<td class="mdj-eb-crm-td mdj-eb-crm-td--desc">' + selCell + '</td>' +
                '<td class="mdj-eb-crm-td mdj-eb-crm-td--qty">' + qty + '</td>' +
                '<td class="mdj-eb-crm-td mdj-eb-crm-td--upr">' + money(unitPrice) + '</td>' +
                '<td class="mdj-eb-crm-td mdj-eb-crm-td--sub mdj-eb-crm-td--sub-val">' + money(subtotalLine) + '</td>' +
                '<td class="mdj-eb-crm-td mdj-eb-crm-td--sta">' + mdjEbStatusBadge(line.line_status) + '</td>' +
                '<td class="mdj-eb-crm-td mdj-eb-crm-td--prv">' + providerText + '</td>' +
                '<td class="mdj-eb-crm-td mdj-eb-crm-td--nts">' + notesCell + '</td>' +
                '<td class="mdj-eb-crm-td mdj-eb-crm-td--act">' + replaceBtn + removeBtn + '</td>' +
                '</tr>'
            );
        }

        // Renderizar todos los cajones (vacíos con fila placeholder, llenos con sus filas)
        var sectionsHtml = CAJON_ORDER.filter(function (n) { return n !== 'Servicios Adicionales'; }).concat(
            linesByCajon['Servicios Adicionales'] && linesByCajon['Servicios Adicionales'].length ? ['Servicios Adicionales'] : []
        ).map(function (cajonName) {
            var lines = linesByCajon[cajonName] || [];
            var isEmpty = lines.length === 0;
            var countLabel = isEmpty
                ? '<span class="mdj-eb-cajon-title-bar__count mdj-eb-cajon-title-bar__count--empty">—</span>'
                : '<span class="mdj-eb-cajon-title-bar__count">' + lines.length + ' servicio' + (lines.length !== 1 ? 's' : '') + '</span>';
            var bodyContent = isEmpty
                ? '<tr class="mdj-eb-crm-row--empty"><td colspan="10" class="mdj-eb-crm-td--empty">Sin servicios seleccionados</td></tr>'
                : lines.map(renderCrmRow).join('');
            return (
                '<section class="mdj-eb-cajon-section' + (isEmpty ? ' mdj-eb-cajon-section--empty' : '') + '">' +
                '<div class="mdj-eb-cajon-title-bar">' +
                '<span class="mdj-eb-cajon-title-bar__name">' + escapeHtml(cajonName) + '</span>' +
                countLabel +
                '</div>' +
                '<div class="mdj-eb-crm-scroll">' +
                '<table class="mdj-eb-crm-table" cellspacing="0" cellpadding="0">' +
                CRM_TABLE_HEAD +
                '<tbody>' + bodyContent + '</tbody>' +
                '</table>' +
                '</div>' +
                '</section>'
            );
        }).join('');

        var totals = computeTotals();
        var deposit30 = Math.round(totals.subtotal * 0.30 * 100) / 100;
        var balance70 = Math.round(totals.subtotal * 0.70 * 100) / 100;

        // Si sectionsHtml está vacío pero hay líneas, es que todas son addon sin mapear
        var visibleContent = sectionsHtml.trim();
        if (!visibleContent && state.lines.length > 0) {
            visibleContent = '<p class="mdj-eb-empty">Cargando categorías… si persiste, recarga la página.</p>';
        }

        var summaryHtml = state.lines.length
            ? '<div class="mdj-eb-crm-summary">' +
              '<div class="mdj-eb-crm-sum-row"><span class="mdj-eb-crm-sum-lbl">Subtotal servicios</span><span class="mdj-eb-crm-sum-val">' + money(totals.subtotal) + '</span></div>' +
              '<div class="mdj-eb-crm-sum-row mdj-eb-crm-sum-row--deposit"><span class="mdj-eb-crm-sum-lbl">Depósito 30%</span><span class="mdj-eb-crm-sum-val">' + money(deposit30) + '</span></div>' +
              '<div class="mdj-eb-crm-sum-row"><span class="mdj-eb-crm-sum-lbl">Balance 70%</span><span class="mdj-eb-crm-sum-val">' + money(balance70) + '</span></div>' +
              '<div class="mdj-eb-crm-sum-row mdj-eb-crm-sum-row--tax"><span class="mdj-eb-crm-sum-lbl">Sales Tax (7%)</span><span class="mdj-eb-crm-sum-val">' + money(totals.tax) + '</span></div>' +
              '<div class="mdj-eb-crm-sum-row mdj-eb-crm-sum-row--total"><span class="mdj-eb-crm-sum-lbl">TOTAL</span><span class="mdj-eb-crm-sum-val">' + money(totals.total) + '</span></div>' +
              '</div>'
            : '';

        container.innerHTML = '<div class="mdj-eb-cajones-wrap">' + visibleContent + '</div>' + summaryHtml;

        if (preserveOpenLineId) {
            var rowOpen = container.querySelector('tr[data-line-id="' + preserveOpenLineId + '"]');
            if (rowOpen) {
                var nextTr = rowOpen.nextElementSibling;
                if (nextTr && nextTr.classList.contains('mdj-eb-crm-picker-row')) {
                    var detOpen = nextTr.querySelector('details.mdj-eb-dj-pick');
                    if (detOpen) {
                        detOpen.setAttribute('open', '');
                    }
                }
            }
        }
    }

    function mdjEbUpdateOrderNum() {
        var el = global.document.getElementById('mdj-eb-order-num');
        if (!el) { return; }
        var id = String(state.draft_id || '').replace(/-/g, '').toUpperCase();
        if (!id) { el.textContent = ''; return; }
        // Año del evento si está fijado; si no, año actual
        var year = (state.event_year && String(state.event_year).length === 4)
            ? String(state.event_year)
            : String(new Date().getFullYear());
        el.textContent = 'MDJB-' + year + '-' + id.slice(0, 8);
    }

    function render() {
        mdjEbUpdateOrderNum();
        var totals = computeTotals();
        var subEl = global.document.getElementById('mdj-eb-subtotal');
        var taxEl = global.document.getElementById('mdj-eb-tax');
        var totalEl = global.document.getElementById('mdj-eb-total');
        var countEl = global.document.getElementById('mdj-eb-fab-count');
        var linesEl = global.document.getElementById('mdj-eb-lines');

        if (subEl) {
            subEl.textContent = money(totals.subtotal);
        }
        if (taxEl) {
            taxEl.textContent = money(totals.tax);
        }
        if (totalEl) {
            totalEl.textContent = money(totals.total);
        }
        var lineCount = state.lines.length;
        if (countEl) {
            countEl.textContent = lineCount > 0 ? String(lineCount) : '';
            countEl.hidden = lineCount === 0;
        }
        var headerCountEl = global.document.getElementById('mdj-eb-header-count');
        var headerOpenBtn = global.document.getElementById('mdj-eb-header-cart-open');
        if (headerCountEl) {
            headerCountEl.textContent = lineCount > 0 ? String(lineCount) : '';
            headerCountEl.hidden = lineCount === 0;
        }
        if (headerOpenBtn) {
            if (lineCount > 0) {
                headerOpenBtn.classList.add('has-items');
            } else {
                headerOpenBtn.classList.remove('has-items');
            }
        }
        mdjEbTriggerFamilyDjFetchIfNeeded();
        renderLines(linesEl);
    }

    function setDrawerOpen(open) {
        ui.drawerOpen = !!open;
        var drawer = global.document.getElementById('mdj-eb-drawer');
        var overlay = global.document.getElementById('mdj-eb-overlay');
        var bod = global.document.body;
        var docEl = global.document.documentElement;
        if (open) {
            if (bod) {
                var sw = 0;
                try {
                    sw = Math.max(
                        0,
                        (global.window.innerWidth || 0) - (docEl && docEl.clientWidth ? docEl.clientWidth : 0)
                    );
                } catch (eSw) {
                    void eSw;
                }
                /* Compensa la barra vertical que desaparece con overflow:hidden → evita brinco del header/carrito. */
                if (sw > 0 && sw < 96) {
                    bod.style.paddingRight = sw + 'px';
                }
                bod.classList.add('mdj-eb-cart-open');
            }
        } else {
            if (bod) {
                bod.classList.remove('mdj-eb-cart-open');
                try {
                    bod.style.paddingRight = '';
                } catch (ePad) {
                    void ePad;
                }
            }
        }
        if (drawer) {
            drawer.hidden = !open;
        }
        if (overlay) {
            overlay.hidden = !open;
        }
        if (open) {
            render();
            void mdjEbRefreshAssignDropdown();
        }
    }

    function openDrawer() {
        setDrawerOpen(true);
    }

    function closeDrawer() {
        setDrawerOpen(false);
    }

    function showToast(msg) {
        var el = global.document.getElementById('mdj-eb-toast');
        if (!el) {
            return;
        }
        el.textContent = msg;
        el.hidden = false;
        global.setTimeout(function () {
            el.hidden = true;
        }, 4200);
    }

    function commitLocal() {
        return commitAddToMyEvent();
    }

    async function commitAddToMyEvent() {
        if (!state.lines.length) {
            showToast('Add at least one item before saving.');
            return;
        }
        var db = typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null;
        if (!db) {
            showToast('Database not available. Try again when online.');
            return;
        }
        var sessionWrap = await db.auth.getSession();
        var session = sessionWrap && sessionWrap.data && sessionWrap.data.session;
        var user = session && session.user;
        if (!user) {
            try {
                var gu = await db.auth.getUser();
                user = gu && gu.data && gu.data.user ? gu.data.user : null;
            } catch (eGu) {
                user = null;
            }
        }
        if (!user) {
            showToast('Sign in to add items to your event.');
            return;
        }
        var uid = String(user.id);
        var emailNorm = user.email ? String(user.email).trim().toLowerCase() : '';
        var assignSel = mdjEbGetAssignSelectEl();
        var leadId =
            assignSel && assignSel.value && mdjEbUuidLike(assignSel.value)
                ? String(assignSel.value).trim()
                : state.assigned_lead_id && mdjEbUuidLike(state.assigned_lead_id)
                  ? state.assigned_lead_id
                  : '';
        if (!leadId) {
            showToast('Select an event (Asignar a evento).');
            return;
        }
        var owns = await mdjEbSessionOwnsLead(db, leadId, uid, emailNorm);
        if (!owns) {
            showToast('You do not have access to this event. Select a valid event from the list.');
            return;
        }
        var fetched = await db.from('leads').select('notes').eq('id', leadId).maybeSingle();
        if (fetched.error) {
            showToast('Could not read event: ' + (fetched.error.message || String(fetched.error)));
            return;
        }
        if (!fetched.data) {
            showToast('Could not read event — check permissions or select another event.');
            return;
        }
        var rawNotes = fetched.data.notes;
        var nextNotes = mdjEbParseNotesObject(rawNotes);
        var services = mdjEbMapLinesToSelectedServices(state.lines);
        nextNotes.selected_services = services;
        nextNotes.event_cart_sync = {
            schema_version: 1,
            source: 'event_cart_mvp',
            synced_at: new Date().toISOString()
        };
        var totals = mdjEbTotalsFromSelectedServices(services);
        var upd = await db
            .from('leads')
            .update({
                notes: JSON.stringify(nextNotes),
                total_amount: totals.total
            })
            .eq('id', leadId)
            .select('id');
        if (upd.error) {
            showToast(
                'Could not save (permissions or event invalid): ' + (upd.error.message || String(upd.error))
            );
            return;
        }
        var rowsBack = upd.data;
        if (!Array.isArray(rowsBack) || rowsBack.length === 0) {
            showToast(
                'No se guardó: el evento no existe o no tienes permiso para actualizarlo. Revisa el evento asignado o abre Mi Portal.'
            );
            return;
        }
        state.assigned_lead_id = leadId;
        persistDraft();

        // Fase 2 — persist order snapshot to event_builder_orders (blocking: await result before success)
        var draftKey = state.draft_id || (String(uid).substring(0, 8) + '-' + Date.now());
        var contextDate = mdjEbReadContextDateIso() || null;
        var orderPayload = {
            draft_id:       draftKey,
            user_id:        uid,
            lead_id:        leadId || null,
            event_date:     contextDate || null,
            lines:          services,
            subtotal_usd:   totals.subtotal  || 0,
            tax_usd:        totals.tax        || 0,
            total_usd:      totals.total      || 0,
            deposit_usd:    Math.round((totals.total || 0) * 0.30 * 100) / 100,
            order_status:   'pending',
            updated_at:     new Date().toISOString()
        };
        var upsertRes;
        try {
            upsertRes = await db.from('event_builder_orders')
                .upsert(orderPayload, { onConflict: 'draft_id' });
        } catch (eOrd) {
            console.error('[MDJEventBuilder] event_builder_orders upsert exception:', eOrd);
            upsertRes = { error: eOrd };
        }
        if (upsertRes && upsertRes.error) {
            console.error('[MDJEventBuilder] event_builder_orders upsert failed:', upsertRes.error.message || upsertRes.error);
            showToast('⚠️ No se pudo guardar la orden en el tablero. Revisa conexión o permisos. (draft: ' + draftKey + ')');
            return;
        }

        // Upsert confirmed — safe to clear cart and show success
        state.lines = [];
        state.assigned_lead_id = '';
        persistDraft();

        showToast(
            '✓ Orden guardada para el cliente y visible en el tablero. Mi Portal: ./client-portal.html?lead=' + leadId
        );
        closeDrawer();
        void mdjEbRefreshAssignDropdown();
        render();
    }

    function addTestItem(preset, opts) {
        var adapter = global.MDJEventBuilderAdapter;
        if (!adapter) {
            return null;
        }
        var line = adapter.buildTestLine(preset, opts || {});
        if (!line) {
            return null;
        }
        return addLine(line);
    }

    function bindUi() {
        var fab = global.document.getElementById('mdj-eb-fab');
        var closeBtn = global.document.getElementById('mdj-eb-close');
        var overlay = global.document.getElementById('mdj-eb-overlay');
        var cta = global.document.getElementById('mdj-eb-cta');
        var linesEl = global.document.getElementById('mdj-eb-lines');

        function onOpenDrawerClick(e) {
            e.preventDefault();
            e.stopPropagation();
            openDrawer();
        }
        if (fab) {
            fab.addEventListener('click', onOpenDrawerClick);
        }
        var headerOpen = global.document.getElementById('mdj-eb-header-cart-open');
        if (headerOpen) {
            headerOpen.addEventListener('click', onOpenDrawerClick);
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', closeDrawer);
        }
        if (overlay) {
            overlay.addEventListener('click', closeDrawer);
        }
        var drawerEl = global.document.getElementById('mdj-eb-drawer');
        if (drawerEl) {
            drawerEl.addEventListener('click', function (e) {
                var link = e.target && e.target.closest && e.target.closest('.mdj-eb-cart-topbar a[href]');
                if (!link) {
                    return;
                }
                closeDrawer();
            });
        }
        if (cta) {
            cta.addEventListener('click', function () {
                if (ebCtaBusy) {
                    return;
                }
                ebCtaBusy = true;
                var p = commitAddToMyEvent();
                if (p && typeof p.finally === 'function') {
                    p.finally(function () {
                        ebCtaBusy = false;
                    });
                } else {
                    ebCtaBusy = false;
                }
            });
        }
        if (linesEl) {
            linesEl.addEventListener('click', function (e) {
                var rosterBtn = e.target && e.target.closest && e.target.closest('[data-mdj-eb-roster-select="1"]');
                if (rosterBtn) {
                    e.preventDefault();
                    var lid = rosterBtn.getAttribute('data-line-id');
                    var aid = rosterBtn.getAttribute('data-artist-id');
                    if (!lid || !aid) {
                        return;
                    }
                    var ix;
                    for (ix = 0; ix < state.lines.length; ix++) {
                        if (state.lines[ix].line_id === lid && lineIsTalentRow(state.lines[ix])) {
                            state.lines[ix].selected_artist_id = aid;
                            state.lines[ix].selected_artist_stage_name =
                                rosterBtn.getAttribute('data-artist-stage') || '';
                            state.lines[ix].selected_artist_photo_url =
                                rosterBtn.getAttribute('data-artist-photo') || '';
                            state.lines[ix].selected_artist_profile_href =
                                rosterBtn.getAttribute('data-artist-profile-href') || '';
                            state.lines[ix].selected_artist_roster_type = 'talent';
                            break;
                        }
                    }
                    persistDraft();
                    render();
                    return;
                }
                var removeBtn = e.target.closest('.mdj-eb-line__remove');
                if (removeBtn) {
                    removeLine(removeBtn.getAttribute('data-line-id'));
                    return;
                }
                var replaceBtn = e.target.closest('.mdj-eb-line__replace');
                if (replaceBtn) {
                    var slot = replaceBtn.getAttribute('data-slot');
                    if (slot === 'dj_primary') {
                        replaceLineInSlot(slot, global.MDJEventBuilderAdapter.buildTestLine('dj', { preset: 'private' }));
                    } else if (slot === 'horaloca_pack') {
                        replaceLineInSlot(slot, global.MDJEventBuilderAdapter.buildTestLine('horaloca'));
                    } else {
                        showToast('Replace preview: add another test item for this slot via console.');
                    }
                    return;
                }
                // Talent row click → toggle mini picker
                // Excluir clics en el ícono de notas (ese abre el perfil, no el picker)
                var talentTr = e.target.closest && e.target.closest('tr[data-mdj-talent-row="1"]');
                if (talentTr && !e.target.closest('.mdj-eb-crm-notes-link')) {
                    mdjEbToggleTalentPicker(linesEl, talentTr.getAttribute('data-line-id'));
                }
            });
        }

        global.document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && ui.drawerOpen) {
                closeDrawer();
            }
        });
    }

    function mdjEbToggleTalentPicker(linesEl, lineId) {
        if (!lineId) { return; }
        var doc = global.document;
        // Eliminar cualquier picker abierto
        var existing = linesEl.querySelectorAll('.mdj-eb-talent-picker-row');
        var alreadyOpen = false;
        existing.forEach(function (el) {
            if (el.getAttribute('data-picker-for') === lineId) { alreadyOpen = true; }
            el.parentNode && el.parentNode.removeChild(el);
        });
        if (alreadyOpen) { return; } // toggle off
        // Buscar la línea en el estado
        var line = null;
        for (var i = 0; i < state.lines.length; i++) {
            if (state.lines[i].line_id === lineId) { line = state.lines[i]; break; }
        }
        if (!line) { return; }
        // Activar fetch si aún no está listo
        mdjEbTriggerFamilyDjFetchIfNeeded();
        // Encontrar el <tr> correspondiente
        var tr = linesEl.querySelector('tr[data-line-id="' + lineId + '"]');
        if (!tr) { return; }
        // Crear e inyectar el picker row (inicial: sin disponibilidad aún)
        var pickerTr = doc.createElement('tr');
        pickerTr.className = 'mdj-eb-talent-picker-row';
        pickerTr.setAttribute('data-picker-for', lineId);
        var td = doc.createElement('td');
        td.setAttribute('colspan', '10');
        td.className = 'mdj-eb-talent-picker-cell';
        var dateIso = mdjEbReadContextDateIso();
        var needsAvailCheck = !!(dateIso);
        td.innerHTML = renderTalentMiniPickerHtml(line, {}, needsAvailCheck);
        pickerTr.appendChild(td);
        tr.insertAdjacentElement('afterend', pickerTr);
        // Async: fetch availability and re-render picker cell if date is set
        if (needsAvailCheck) {
            var db = typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null;
            mdjEbFetchBusyArtistIdsForDate(db, dateIso).then(function (busyMap) {
                // Re-render only if the picker is still open for this line
                var stillOpen = linesEl.querySelector('tr.mdj-eb-talent-picker-row[data-picker-for="' + lineId + '"] .mdj-eb-talent-picker-cell');
                if (!stillOpen) { return; }
                stillOpen.innerHTML = renderTalentMiniPickerHtml(line, busyMap, false);
            }).catch(function () { /* silently ignore */ });
        }
    }

    function init() {
        mdjEbResolveUserId(function (uid) {
            mdjEbSetActiveUserId(uid);
            hydrateDraft();
            ui.root = global.document.getElementById('mdj-event-builder-root');
            if (ui.root) {
                ui.root.hidden = false;
                ui.root.setAttribute('aria-hidden', 'false');
            }
            if (global.document.body) {
                global.document.body.classList.add('mdj-event-builder-on');
            }
            if (!ebUiBound) {
                bindUi();
                mdjEbNormalizeContextBarDateSelects();
                mdjEbBindAssignSelectOnce();
                ebUiBound = true;
            }
            render();
            mdjEbEnsureAuthListenerOnce();
            void mdjEbRefreshAssignDropdown();
        });
    }

    global.MDJEventBuilder = {
        init: init,
        addLine: addLine,
        removeLine: removeLine,
        removeByCatalogSku: removeByCatalogSku,
        replaceLineInSlot: replaceLineInSlot,
        getDraft: getDraft,
        clearDraft: clearDraft,
        computeTotals: computeTotals,
        render: render,
        openDrawer: openDrawer,
        closeDrawer: closeDrawer,
        commitLocal: commitLocal,
        commitAddToMyEvent: commitAddToMyEvent,
        addTestItem: addTestItem
    };

    function boot() {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    boot();
}(typeof window !== 'undefined' ? window : globalThis));
