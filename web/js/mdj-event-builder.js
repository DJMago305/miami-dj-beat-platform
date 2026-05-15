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
    var ebFamilyDjReady = false;
    var ebFamilyDjRows = [];
    var ebFamilyDjSource = '';

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

    function mdjEbNormalizeMockFamilyRows() {
        return MDJ_EB_MOCK_DJS_FAMILY.map(function (dj) {
            return {
                user_id: '',
                stage: dj.stage,
                legal: dj.legal,
                stars_label: dj.stars_label,
                score_paren: dj.score_paren,
                status: dj.status,
                avatar_url: dj.avatar_url
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
        return {
            user_id: uid,
            stage: stage,
            legal: legal,
            stars_label: mdjEbRatingToStarsLabel(row.rating),
            score_paren: mdjEbReviewParen(row),
            status: row.available ? 'Available' : '—',
            avatar_url: av
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
        var et = row && row.event_type ? String(row.event_type).trim() : 'Event';
        var d = row && row.event_date != null ? String(row.event_date).trim() : '';
        if (d.length >= 10) {
            d = d.slice(0, 10);
        }
        if (!d) {
            d = '—';
        }
        return et + ' — ' + d;
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
                html += '<option value="' + escapeHtml(id) + '">' + lab + '</option>';
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
                    html +=
                        '<option value="' +
                        escapeHtml(String(prow.id)) +
                        '">' +
                        escapeHtml(mdjEbFormatLeadAssignLabel(prow)) +
                        '</option>';
                }
            }
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
            state.assigned_lead_id = mdjEbUuidLike(v) ? v : null;
            persistDraft();
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
            if (lineIsDjFamilyEvent(state.lines[i])) {
                need = true;
                break;
            }
        }
        if (!need) {
            return;
        }
        var sb = typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null;
        if (!sb || typeof sb.from !== 'function') {
            ebFamilyDjReady = true;
            ebFamilyDjSource = 'mock';
            ebFamilyDjRows = mdjEbNormalizeMockFamilyRows();
            return;
        }
        ebFamilyDjInFlight = true;
        /* Columnas alineadas con la vista desplegada: evitar verified/review_count si la vista no los expone (400 → mock). */
        var sel =
            'user_id, dj_slug, stage_name, dj_name, full_name, photo_url, rating, available,' +
            'plan, plan_type, plan_status, plan_expires_at, is_premium, subscription_status';
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
            ebFamilyDjReady = true;
            ebFamilyDjSource = 'mock';
            ebFamilyDjRows = mdjEbNormalizeMockFamilyRows();
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
                ebFamilyDjReady = true;
                ebFamilyDjSource = 'mock';
                ebFamilyDjRows = mdjEbNormalizeMockFamilyRows();
                render();
                return;
            }
            if (!Array.isArray(data)) {
                data = [];
            }
            var picked = mdjEbPickFamilyDjRows(data);
            ebFamilyDjReady = true;
            ebFamilyDjSource = 'supabase';
            ebFamilyDjRows = picked.map(mdjEbNormalizeFamilyDjRowFromPublic).filter(Boolean);
            render();
        }).catch(function (err) {
            ebFamilyDjInFlight = false;
            ebFamilyDjReady = true;
            ebFamilyDjSource = 'mock';
            ebFamilyDjRows = mdjEbNormalizeMockFamilyRows();
            try {
                console.warn('[MDJEventBuilder] family roster:', err && err.message ? err.message : err);
            } catch (e2) {
                void e2;
            }
            render();
        });
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

    function renderLines(container) {
        if (!container) {
            return;
        }
        if (!state.lines.length) {
            container.innerHTML =
                '<p class="mdj-eb-empty">No services added yet. Browse Entertainment &amp; Talent and use Add to Package.</p>';
            return;
        }
        var preserveOpenLineId = null;
        var openDet = container.querySelector('details.mdj-eb-dj-pick[open]');
        if (openDet) {
            var hostArt = openDet.closest('article[data-line-id]');
            if (hostArt) {
                preserveOpenLineId = hostArt.getAttribute('data-line-id');
            }
        }
        container.innerHTML = state.lines
            .map(function (line) {
            var rawImg = line.image_url ? String(line.image_url).trim() : '';
            var imgOk = rawImg && rawImg !== EB_BROKEN_DJ_FAMILY_IMAGE && rawImg.indexOf('family-events.jpg') === -1;
            var thumb = imgOk
                ? '<img class="mdj-eb-line__thumb" src="' + escapeHtml(rawImg) + '" alt="" loading="lazy">'
                : '<div class="mdj-eb-line__thumb mdj-eb-line__thumb--ph" aria-hidden="true"></div>';
            var replaceBtn = line.replaceable
                ? '<button type="button" class="mdj-eb-line__replace" data-line-id="' + escapeHtml(line.line_id) + '" data-slot="' + escapeHtml(line.slot) + '">Replace</button>'
                : '';
            var qtyLabel = line.quantity > 1 ? ' <span class="mdj-eb-line__qty">×' + line.quantity + '</span>' : '';
            var djFamily = lineIsDjFamilyEvent(line);
            var lineClass = djFamily ? 'mdj-eb-line mdj-eb-line--dj-family' : 'mdj-eb-line';
            var djPickChip =
                djFamily && line.selected_artist_stage_name
                    ? '<span class="mdj-eb-line__dj-pick-chip">Selected DJ: ' +
                      escapeHtml(String(line.selected_artist_stage_name)) +
                      '</span>'
                    : '';
            var djExtra = djFamily ? renderDjFamilyPickerHtml(line) : '';
            return (
                '<article class="' + lineClass + '" data-line-id="' + escapeHtml(line.line_id) + '">' +
                '<div class="mdj-eb-line__row">' +
                thumb +
                '<div class="mdj-eb-line__meta">' +
                '<span class="mdj-eb-line__cat">' + escapeHtml(line.category_label) + '</span>' +
                '<span class="mdj-eb-line__name">' + escapeHtml(line.name) + qtyLabel + '</span>' +
                djPickChip +
                '<span class="mdj-eb-line__price">' + money(line.line_total_usd) + '</span>' +
                '</div>' +
                '<div class="mdj-eb-line__actions">' +
                replaceBtn +
                '<button type="button" class="mdj-eb-line__remove" data-line-id="' + escapeHtml(line.line_id) + '">Remove</button>' +
                '</div>' +
                '</div>' +
                djExtra +
                '</article>'
            );
        })
            .join('');
        if (preserveOpenLineId) {
            var artOpen = container.querySelector('article[data-line-id="' + preserveOpenLineId + '"]');
            if (artOpen) {
                var detOpen = artOpen.querySelector('details.mdj-eb-dj-pick');
                if (detOpen) {
                    detOpen.setAttribute('open', '');
                }
            }
        }
    }

    function render() {
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
        if (open) {
            if (bod) {
                bod.classList.add('mdj-eb-cart-open');
            }
        } else {
            if (bod) {
                bod.classList.remove('mdj-eb-cart-open');
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
        showToast(
            'Paquete guardado en el evento. El carrito sigue igual para que puedas seguir editando. Mi Portal: ./client-portal.html?lead=' +
                leadId
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
                        if (state.lines[ix].line_id === lid && lineIsDjFamilyEvent(state.lines[ix])) {
                            state.lines[ix].selected_artist_id = aid;
                            state.lines[ix].selected_artist_stage_name =
                                rosterBtn.getAttribute('data-artist-stage') || '';
                            state.lines[ix].selected_artist_photo_url =
                                rosterBtn.getAttribute('data-artist-photo') || '';
                            state.lines[ix].selected_artist_profile_href =
                                rosterBtn.getAttribute('data-artist-profile-href') || '';
                            state.lines[ix].selected_artist_roster_type = 'talent_dj';
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
                }
            });
        }

        global.document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && ui.drawerOpen) {
                closeDrawer();
            }
        });
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
