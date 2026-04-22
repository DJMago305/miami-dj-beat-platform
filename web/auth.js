// ─── MIAMI DJ BEAT Auth — Login & DJ Registration ──────────────────────────────────
// Uses window.getSupabaseClient() (lazy singleton, avoids CDN race condition).

/**
 * DJ que refiere (promoción / QR / botón WEB en perfil): ?ref= en URL, o localStorage
 * tras index.html?ref= o gotoAffiliateWeb() desde dj-profile.
 */
/** Supabase GoTrue: duplicate signup / email already in use */
function mdjIsUserAlreadyRegisteredError(err) {
    const code = String(err?.code || err?.status || '').toLowerCase();
    const msg = String(err?.message || err?.error_description || '').toLowerCase();
    if (code === 'user_already_registered' || code === 'email_exists') return true;
    return (
        msg.includes('user already registered') ||
        msg.includes('already been registered') ||
        msg.includes('already registered') ||
        msg.includes('email address is already') ||
        msg.includes('user already exists') ||
        msg.includes('database error finding user') ||
        msg.includes('duplicate key value') ||
        msg.includes('already in use')
    );
}

/** Email de bienvenida (Edge + Resend), mismo estilo que apps grandes; no bloquea el alta si falla. */
async function mdjSendSubscriptionWelcomeEmail(db, opts) {
    try {
        if (!db || !db.auth) return;
        const { data: wrap } = await db.auth.getSession();
        const session = wrap && wrap.session;
        if (!session || !session.access_token) return;
        const url =
            typeof window.mdbSupabaseFunctionUrl === 'function'
                ? window.mdbSupabaseFunctionUrl('send-subscription-welcome')
                : '';
        if (!url) return;
        const key = typeof window.MDB_SUPABASE_ANON_KEY === 'string' ? window.MDB_SUPABASE_ANON_KEY : '';
        const lang =
            typeof document !== 'undefined' &&
            document.documentElement &&
            String(document.documentElement.lang || '')
                .toLowerCase()
                .indexOf('es') === 0
                ? 'es'
                : 'en';
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + session.access_token,
                ...(key ? { apikey: key } : {}),
            },
            body: JSON.stringify({
                locale: lang,
                account_kind: (opts && opts.account_kind) || 'member',
            }),
        });
    } catch (e) {
        console.warn('[AUTH] subscription welcome email:', e);
    }
}

if (typeof window !== 'undefined') {
    window.mdjSendSubscriptionWelcomeEmail = mdjSendSubscriptionWelcomeEmail;
}

/** Public IP hint (best-effort); included in device fingerprint. No auth. */
async function mdjGetPublicIpHint() {
    try {
        const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        if (!r.ok) return '';
        const j = await r.json();
        return String(j && j.ip ? j.ip : '').trim().slice(0, 45);
    } catch (e) {
        return '';
    }
}

/** Stable device fingerprint (UA + screen + TZ + optional IP); stored in public.user_login_devices (perfil de dispositivos). */
async function mdjBuildDeviceFingerprint() {
    try {
        const ipHint = await mdjGetPublicIpHint();
        const ua = navigator.userAgent || '';
        const scr = typeof screen !== 'undefined' ? `${screen.width}x${screen.height}x${screen.colorDepth}` : '';
        const tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '') : '';
        const raw = ua + '|' + scr + '|' + tz + '|' + (navigator.hardwareConcurrency || '') + '|ip:' + ipHint;
        if (window.crypto && window.crypto.subtle) {
            const enc = new TextEncoder().encode(raw);
            const buf = await window.crypto.subtle.digest('SHA-256', enc);
            return Array.from(new Uint8Array(buf))
                .map(function (b) { return b.toString(16).padStart(2, '0'); })
                .join('');
        }
    } catch (e) { /* ignore */ }
    var fallback = (navigator.userAgent || '') + '|' + String(Date.now());
    try {
        return btoa(unescape(encodeURIComponent(fallback))).replace(/[^a-z0-9]/gi, '').slice(0, 64);
    } catch (e2) {
        return fallback.replace(/[^a-z0-9]/gi, '').slice(0, 64);
    }
}

function mdjGuessPlatformLabel() {
    var ua = (navigator.userAgent || '').toLowerCase();
    if (ua.indexOf('iphone') >= 0 || ua.indexOf('ipad') >= 0) return 'iOS';
    if (ua.indexOf('android') >= 0) return 'Android';
    if (ua.indexOf('mac os') >= 0 || ua.indexOf('macintosh') >= 0) return 'Mac';
    if (ua.indexOf('windows') >= 0) return 'Windows PC';
    if (ua.indexOf('linux') >= 0) return 'Linux';
    return 'Web';
}

/**
 * Rol efectivo para redirecciones y UI.
 * Los hooks de Auth pueden dejar app_metadata.role desalineado; el alta de talento vive en user_metadata.user_type
 * y debe prevalecer ANTES que admin/manager/seller en JWT — si no, un DJ con JWT erróneo acaba en admin-dashboard.
 * Cuenta cliente: user_type === "client" explícito.
 */
function mdjResolveEffectiveUserRole(user) {
    if (!user) return 'client';
    const ut = String(user.user_metadata?.user_type || '').toLowerCase();
    if (ut === 'client') return 'client';
    if (ut === 'talent' || ut === 'dj' || ut === 'artist') {
        return ut === 'artist' ? 'artist' : 'talent';
    }
    const appR = String(user.app_metadata?.role || '').toLowerCase();
    if (appR === 'admin' || appR === 'manager' || appR === 'seller' || appR === 'owner') return appR;
    if (appR && appR !== 'client') return appR;
    if (ut && ut !== 'client') return ut;
    return appR || ut || 'client';
}

if (typeof window !== 'undefined') {
    window.mdjResolveEffectiveUserRole = mdjResolveEffectiveUserRole;
}

/**
 * Tras login con contraseña: compara UA + huella (+ IP si disponible) con `public.user_login_devices` vía RPC;
 * si es nuevo, encola email (Edge) con protocolo anti-phishing. Staff admin/manager: sin alerta.
 * Alias público: `mdjCheckNewDevice` (no existe `public.profiles` de dispositivos en este proyecto).
 */
async function mdjPostLoginDeviceRoutine(db, session) {
    try {
        var user = session && session.user;
        if (!user || !db) return;
        var rawRole = String(mdjResolveEffectiveUserRole(user) || '').toLowerCase();
        if (rawRole === 'admin' || rawRole === 'manager' || rawRole === 'seller') return;

        var fp = await mdjBuildDeviceFingerprint();
        var tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '') : '';
        var platform = mdjGuessPlatformLabel();

        var rpc = await db.rpc('mdj_record_login_device', {
            p_fingerprint: fp,
            p_user_agent: navigator.userAgent || '',
            p_platform_label: platform,
            p_approx_tz: tz
        });
        if (rpc.error) {
            console.warn('[AUTH] mdj_record_login_device', rpc.error);
            return;
        }
        var isNew = rpc.data === true;
        if (!isNew) return;

        var base = (typeof window.MDB_SUPABASE_URL === 'string' && window.MDB_SUPABASE_URL) ? window.MDB_SUPABASE_URL.replace(/\/$/, '') : '';
        var key = typeof window.MDB_SUPABASE_ANON_KEY === 'string' ? window.MDB_SUPABASE_ANON_KEY : '';
        if (!base || !key || !session.access_token) return;

        var ipPublic = await mdjGetPublicIpHint();

        var url =
            typeof window.mdbSupabaseFunctionUrl === 'function'
                ? window.mdbSupabaseFunctionUrl('notify-new-device-login')
                : base + '/functions/v1/notify-new-device-login';
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + session.access_token,
                apikey: key
            },
            body: JSON.stringify({ device_label: platform, approx_tz: tz, public_ip: ipPublic })
        });
    } catch (e) {
        console.warn('[AUTH] mdjPostLoginDeviceRoutine', e);
    }
}

/** @see mdjPostLoginDeviceRoutine */
async function mdjCheckNewDevice(db, session) {
    return mdjPostLoginDeviceRoutine(db, session);
}
if (typeof window !== 'undefined') {
    window.mdjCheckNewDevice = mdjCheckNewDevice;
}

/** Legal full name from signup fields (middle optional: one letter → "J.") */
function mdjNormalizeMiddleNameToken(raw) {
    var t = String(raw || '').trim();
    if (!t) return '';
    if (t.length === 1 && /^[A-Za-zÀ-ÿ]$/.test(t)) return t.toUpperCase() + '.';
    return t;
}

/** Dirección de registro → una línea legible (metadata) */
function mdjFormatSignupAddressOneLine(street, apt, city, state, zip, country) {
    var s1 = [String(street || '').trim(), String(apt || '').trim()].filter(Boolean).join(' ');
    var mid = [String(city || '').trim(), String(state || '').trim()].filter(Boolean).join(', ');
    var z = String(zip || '').trim();
    var tail = [mid, z, String(country || '').trim()].filter(Boolean).join(' · ');
    var parts = [];
    if (s1) parts.push(s1);
    if (tail) parts.push(tail);
    return parts.join(' — ').trim();
}

/** Bloque multilínea para `dj_profiles.address` */
function mdjFormatSignupAddressBlock(street, apt, city, state, zip, country) {
    var lines = [];
    var l1 = [String(street || '').trim(), String(apt || '').trim()].filter(Boolean).join(', ');
    if (l1) lines.push(l1);
    var l2 = [String(city || '').trim(), String(state || '').trim(), String(zip || '').trim()]
        .filter(Boolean)
        .join(' ');
    if (l2) lines.push(l2);
    var c = String(country || '').trim();
    if (c) lines.push(c);
    return lines.join('\n').trim();
}

function mdjBuildLegalFullNameFromSignupParts(firstRaw, middleRaw, lastRaw) {
    var f = String(firstRaw || '').trim();
    var m = mdjNormalizeMiddleNameToken(middleRaw);
    var l = String(lastRaw || '').trim();
    var parts = [];
    if (f) parts.push(f);
    if (m) parts.push(m);
    if (l) parts.push(l);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Wrong password / bad credentials on signInWithPassword */
function mdjIsInvalidCredentialsError(err) {
    const code = String(err?.code || err?.name || '').toLowerCase();
    const msg = String(err?.message || err?.error_description || '').toLowerCase();
    if (code === 'invalid_credentials' || code === 'invalid_grant') return true;
    return msg.includes('invalid login credentials') || msg.includes('invalid_credentials');
}

/**
 * Same contract as login.html buildPostAuthReturnUrl: ?redirect=party-planner&lead=… → ./party-planner.html?from_auth=1&…
 * Restricts redirect slug to safe filename stem (no path / open redirect).
 */
function mdjBuildPostAuthReturnUrlFromQuery(search, user) {
    try {
        const qp = new URLSearchParams(search || '');
        const raw = (qp.get('redirect') || '').trim();
        if (!raw) return null;
        if (!/^[a-z][a-z0-9_-]{0,80}$/i.test(raw)) return null;
        /* Evita bucle: ?redirect=login → ./login.html tras auth */
        if (raw === 'login') return null;

        const ut = user ? String(user.user_metadata?.user_type || '').toLowerCase() : '';
        const appR = user ? String(user.app_metadata?.role || '').toLowerCase() : '';
        const isArtistJwt = ut === 'talent' || ut === 'dj' || appR === 'artist';
        /* Destinos de cliente prohibidos para JWT de artista (mezcla account-settings vs dashboard). */
        if (isArtistJwt && (raw === 'client-portal' || raw === 'account-settings' || raw === 'account-profile')) {
            return './dj-dashboard.html?tab=settings&from_auth=1';
        }

        /* Jobs: alta gratis (signup=free) sigue en jobs.html (#selection-screen); sesión talento existente → panel DJ. */
        if (raw === 'jobs' && user) {
            const signup = (qp.get('signup') || '').toLowerCase();
            const isNewFreeJobsSignup = signup === 'free';
            if (!isNewFreeJobsSignup) {
                const ut = String(user.user_metadata?.user_type || '').toLowerCase();
                const appR = String(user.app_metadata?.role || '').toLowerCase();
                const isTalent = ut === 'talent' || ut === 'dj' || appR === 'artist';
                if (isTalent) {
                    return './dj-dashboard.html?from_auth=1&source=jobs';
                }
            }
        }

        const lead = qp.get('lead');
        const eventType = qp.get('type');
        const ref = qp.get('ref');
        const dj = qp.get('dj');
        const profileId = qp.get('id');
        const tabRedirect = qp.get('tab');
        const panelRedirect = qp.get('panel');

        let finalUrl = `./${raw}.html?from_auth=1&`;
        if (lead) finalUrl += `lead=${encodeURIComponent(lead)}&`;
        if (eventType) finalUrl += `type=${encodeURIComponent(eventType)}&`;
        if (ref) finalUrl += `ref=${encodeURIComponent(ref)}&`;
        if (dj) finalUrl += `dj=${encodeURIComponent(dj)}&`;
        if (profileId) finalUrl += `id=${encodeURIComponent(profileId)}&`;
        if (tabRedirect) finalUrl += `tab=${encodeURIComponent(tabRedirect)}&`;
        if (panelRedirect) finalUrl += `panel=${encodeURIComponent(panelRedirect)}&`;
        var modeNav = qp.get('mode');
        if (modeNav) finalUrl += `mode=${encodeURIComponent(modeNav)}&`;

        return finalUrl.replace(/[&?]$/, '');
    } catch (e) {
        return null;
    }
}

if (typeof window !== 'undefined') {
    window.mdjBuildPostAuthReturnUrlFromQuery = mdjBuildPostAuthReturnUrlFromQuery;
}

/**
 * Tras login o registro (o sesión ya guardada en login.html): mismo destino que role-guard en login.
 * Un solo intento de navegación (evita doble disparo signup + onAuthStateChange).
 */
async function mdjPerformPostAuthRedirect(db, user) {
    if (!db || !user) return;
    if (typeof window !== 'undefined' && window.__mdjPostAuthRedirectLock) return;
    if (typeof window !== 'undefined') window.__mdjPostAuthRedirectLock = true;
    try {
        const params = new URLSearchParams(window.location.search);
        let rawRole = mdjResolveEffectiveUserRole(user);
        const utExplicit = String(user.user_metadata?.user_type || '').toLowerCase();
        if (rawRole === 'client' && db && utExplicit !== 'client') {
            try {
                const { data: djRow } = await db.from('dj_profiles').select('role').eq('user_id', user.id).maybeSingle();
                const r = djRow ? String(djRow.role || '').toLowerCase() : '';
                if (djRow && r !== 'client') {
                    rawRole = 'talent';
                }
            } catch (eDbRole) {
                console.warn('[AUTH] dj_profiles role fallback:', eDbRole);
            }
        }
        const role = rawRole === 'talent' || rawRole === 'dj' ? 'artist' : rawRole;

        let targetUrl = './dj-profile.html';
        if (role === 'admin' || role === 'manager' || role === 'seller') {
            targetUrl = './admin-dashboard.html';
        } else if (role === 'client') {
            targetUrl = './client-portal.html';
            try {
                const utNav = String(user.user_metadata?.user_type || '').toLowerCase();
                const { data: djRow } = await db.from('dj_profiles').select('role').eq('user_id', user.id).maybeSingle();
                if (utNav !== 'client' && djRow && djRow.role !== 'client') {
                    targetUrl = './dj-profile.html?id=' + encodeURIComponent(user.id);
                }
            } catch (roleFallbackErr) {
                console.warn('[AUTH] Role fallback check failed:', roleFallbackErr);
            }
        } else {
            targetUrl = './dj-profile.html?id=' + encodeURIComponent(user.id);
        }

        const postAuthFromRedirect = mdjBuildPostAuthReturnUrlFromQuery(window.location.search, user);
        if (postAuthFromRedirect) {
            window.location.assign(postAuthFromRedirect);
            return;
        }

        const nextRaw = (params.get('next') || '').trim();
        if (nextRaw) {
            let nextUrl = nextRaw.startsWith('./') || nextRaw.startsWith('/') ? nextRaw : `./${nextRaw.replace(/^\//, '')}`;
            const isArtistSession =
                role === 'artist' ||
                rawRole === 'talent' ||
                rawRole === 'dj' ||
                rawRole === 'artist';
            if (isArtistSession && /account-settings\.html|client-portal\.html/i.test(nextUrl)) {
                window.location.assign('./dj-dashboard.html?tab=settings');
                return;
            }
            window.location.assign(nextUrl);
            return;
        }

        window.location.assign(targetUrl);
    } catch (e) {
        console.warn('[AUTH] mdjPerformPostAuthRedirect:', e);
        if (typeof window !== 'undefined') window.__mdjPostAuthRedirectLock = false;
    }
}

if (typeof window !== 'undefined') {
    window.mdjPerformPostAuthRedirect = mdjPerformPostAuthRedirect;
}

function mdjAuthT(key, esFallback, enFallback) {
    try {
        if (window.i18n && typeof window.i18n.t === 'function') {
            const s = window.i18n.t(key);
            if (s) return s;
        }
    } catch (e) { /* ignore */ }
    const lang = (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang || 'es').toLowerCase();
    return lang.startsWith('en') ? enFallback : esFallback;
}

function mdjGetReferralDjId() {
    try {
        const fromUrl = new URLSearchParams(window.location.search).get('ref');
        if (fromUrl && String(fromUrl).trim()) return String(fromUrl).trim();
    } catch (e) { /* ignore */ }
    try {
        const a = localStorage.getItem('mdb_referral_dj_id');
        const b = localStorage.getItem('mdj_active_affiliate_dj');
        return (a || b || '').trim();
    } catch (e) {
        return '';
    }
}

/**
 * Categorías elegidas en jobs.html (`sessionStorage.mdj_jobs_roster_categories`) → roles + artist_specialty en dj_profiles.
 */
async function mdjApplyJobsRosterToDjProfile(db, userId) {
    if (!db || !userId) return;
    try {
        const raw = sessionStorage.getItem('mdj_jobs_roster_categories');
        if (!raw) return;
        const jobCat = JSON.parse(raw);
        const codes = jobCat && jobCat.codes;
        const labels = jobCat && jobCat.labels;
        if (!Array.isArray(codes) || codes.length === 0) return;
        const rolesStr = codes
            .map(function (c) {
                return String(c).trim();
            })
            .filter(Boolean)
            .join(', ');
        let specLine = null;
        if (Array.isArray(labels) && labels.length) {
            specLine = labels
                .map(function (l) {
                    return String(l).trim();
                })
                .filter(Boolean)
                .join(' · ');
        }
        const { error } = await db
            .from('dj_profiles')
            .update({
                roles: rolesStr,
                artist_specialty: specLine || null
            })
            .eq('user_id', userId);
        void error;
    } catch (e) {
        void e;
    }
}

if (typeof window !== 'undefined') {
    window.mdjApplyJobsRosterToDjProfile = mdjApplyJobsRosterToDjProfile;
}

/**
 * Signup puede terminar antes del INSERT (p. ej. confirmación de email sin sesión JWT).
 * En el primer login con sesión, crea la fila que falta en dj_profiles o client_profiles. Idempotente.
 */
async function mdjEnsureAuthProfileRows(db, user) {
    if (!db || !user || !user.id) return;
    const meta = user.user_metadata || {};
    const appMeta = user.app_metadata || {};
    const resolved = mdjResolveEffectiveUserRole(user);
    const rawRole = String(resolved || 'client').toLowerCase();
    if (rawRole === 'admin' || rawRole === 'manager' || rawRole === 'seller') return;

    const isTalent = rawRole === 'talent' || rawRole === 'dj' || rawRole === 'artist';
    const email = (user.email || '').trim();
    const fullName = String(meta.full_name || '').trim() || (email ? email.split('@')[0] : '') || 'User';
    const artistic = String(meta.artistic_name || '').trim();
    const displayStage = artistic || fullName;
    const planParam = String(meta.plan || 'LITE');
    const phone = String(meta.phone || '').trim();
    const addrCity = String(meta.addr_city || meta.city || '').trim();
    const addrStreet = String(meta.address_street || '').trim();
    const addrApt = String(meta.address_apt || '').trim();
    const addrState = String(meta.address_state || '').trim();
    const addrZip = String(meta.address_zip || '').trim();
    const addrCountry = String(meta.address_country || '').trim();
    const legacyLoc = String(meta.location || '').trim();
    const cityForColumn = addrCity || (!addrStreet && legacyLoc ? legacyLoc : '');
    const refCode = mdjGetReferralDjId() || (meta.source_ref ? String(meta.source_ref).trim() : '') || null;

    try {
        if (isTalent) {
            const { data: existingDj, error: selErr } = await db.from('dj_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
            if (selErr) {
                console.warn('[AUTH] mdjEnsureAuthProfileRows dj select:', selErr);
                return;
            }
            if (existingDj) return;

            const profileUid = user.id;
            const memberId = `DJ-${profileUid.substring(0, 6).toUpperCase()}`;
            const referralCode = `REF${memberId.replace('DJ-', '').substring(0, 5)}`;
            const profilePayload = {
                user_id: profileUid,
                email: email || null,
                dj_name: displayStage,
                stage_name: displayStage,
                full_name: fullName,
                plan: planParam,
                status: 'ACTIVE',
                member_id: memberId,
                referral_code: referralCode,
                photo_status: 'pending',
                rating: 1.0,
                review_count: 0
            };
            if (phone) profilePayload.phone = phone;
            if (cityForColumn) profilePayload.city = cityForColumn;
            const addrBlock = mdjFormatSignupAddressBlock(
                addrStreet,
                addrApt,
                addrCity || cityForColumn,
                addrState,
                addrZip,
                addrCountry
            );
            if (addrBlock) profilePayload.address = addrBlock;
            else if (legacyLoc && !addrStreet) profilePayload.address = legacyLoc;

            const { error: insErr } = await db.from('dj_profiles').insert([profilePayload]);
            if (insErr) console.warn('[AUTH] mdjEnsureAuthProfileRows dj_profiles insert:', insErr);
            else await mdjApplyJobsRosterToDjProfile(db, profileUid);
        } else {
            const { data: existingCl, error: selErr } = await db.from('client_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
            if (selErr) {
                console.warn('[AUTH] mdjEnsureAuthProfileRows client select:', selErr);
                return;
            }
            if (existingCl) return;

            const uname = String(meta.username || (email ? email.split('@')[0] : 'user')).trim().slice(0, 80) || 'user';
            const clientPayload = {
                user_id: user.id,
                username: uname,
                full_name: fullName,
                email: email || null,
                phone: phone || null,
                city: cityForColumn || null,
                address_street: addrStreet || null,
                address_apt: addrApt || null,
                address_state: addrState || null,
                address_zip: addrZip || null,
                address_country: addrCountry || null,
                source_ref: refCode || null,
                discount_eligible: true
            };
            const { error: insErr } = await db.from('client_profiles').insert([clientPayload]);
            if (insErr) console.warn('[AUTH] mdjEnsureAuthProfileRows client_profiles insert:', insErr);
        }
    } catch (e) {
        console.warn('[AUTH] mdjEnsureAuthProfileRows:', e);
    }
}

window.mdjEnsureAuthProfileRows = mdjEnsureAuthProfileRows;

/** Wait for the Supabase client to be ready (max ~3 sec). */
async function waitForSupabase(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const db = window.getSupabaseClient();
        if (db) return db;
        await new Promise(r => setTimeout(r, 300));
    }
    throw new Error('Supabase no está disponible. Recarga la página.');
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const errorMsg = document.getElementById('auth-error');

    function showError(msg, opts) {
        if (!errorMsg) return;
        if (opts && opts.html) {
            errorMsg.innerHTML = msg;
        } else {
            errorMsg.innerHTML = '';
            errorMsg.textContent = msg;
        }
        errorMsg.hidden = false;
        errorMsg.removeAttribute('data-tone');
        if (opts && opts.tone === 'info') {
            errorMsg.setAttribute('data-tone', 'info');
        }
    }
    function clearError() {
        if (!errorMsg) return;
        errorMsg.hidden = true;
        errorMsg.removeAttribute('data-tone');
        errorMsg.innerHTML = '';
        errorMsg.textContent = '';
    }

    /** Login/signup page: button labels follow `mdjpro_lang` + i18n. */
    function mdjAuthPageBtnT(key, fallback) {
        if (window.i18n && typeof window.i18n.t === 'function') {
            const s = window.i18n.t(key);
            if (s) return s;
        }
        return fallback;
    }

    /** Misma lógica que el submit de login: interior del sistema o redirect=party-planner, etc. */
    async function performPostAuthRedirect(db, user) {
        return mdjPerformPostAuthRedirect(db, user);
    }

    /** Resolves an input (email or username) to a real email for Supabase Auth. */
    async function resolveIdentity(input, db) {
        const cleanInput = input.trim();
        if (!cleanInput) {
            throw new Error('Introduce tu email o nombre de usuario.');
        }

        const { data: rpcEmail, error: rpcErr } = await db.rpc('mdj_resolve_email_for_login', {
            p_identity: cleanInput
        });

        if (rpcErr) {
            console.error('[AUTH RESOLVER] mdj_resolve_email_for_login:', rpcErr);
            throw new Error(rpcErr.message || 'No se pudo resolver el inicio de sesión.');
        }
        if (rpcEmail) return rpcEmail;

        throw new Error('No se encontró una cuenta vinculada a este nombre de usuario. Por favor verifica el nombre o usa tu email.');
    }

    // ── LOGIN ──────────────────────────────────────────────────────────────
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError();
            const btn = loginForm.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.textContent = mdjAuthPageBtnT('auth-login-btn-verifying', 'Verifying…'); }

            try {
                const db = await waitForSupabase();
                const identityInput = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;

                if (!identityInput) {
                    showError(
                        mdjAuthT(
                            'auth-validation-email-required',
                            'Indica tu email o nombre de usuario.',
                            'Enter your email or username.'
                        ),
                        { tone: 'error' }
                    );
                    if (btn) { btn.disabled = false; btn.textContent = mdjAuthPageBtnT('login-btn-submit', 'Login'); }
                    return;
                }
                if (!password) {
                    showError(
                        mdjAuthT(
                            'auth-validation-password-required',
                            'Introduce tu contraseña.',
                            'Enter your password.'
                        ),
                        { tone: 'error' }
                    );
                    if (btn) { btn.disabled = false; btn.textContent = mdjAuthPageBtnT('login-btn-submit', 'Login'); }
                    return;
                }

                // Resolve Identity
                const email = await resolveIdentity(identityInput, db);

                if (btn) btn.textContent = mdjAuthPageBtnT('auth-login-btn-signing-in', 'Signing in…');
                const { data: authData, error } = await db.auth.signInWithPassword({ email, password });
                if (error) throw error;

                let user = authData.user;
                try {
                    await db.auth.refreshSession();
                    const { data: sessFresh } = await db.auth.getSession();
                    if (sessFresh && sessFresh.session && sessFresh.session.user) {
                        user = sessFresh.session.user;
                    }
                } catch (eRf) {
                    void eRf;
                }

                // ── SHIELD VERIFICATION NEUTRALIZED PER USER DIRECTIVE ──────────────────
                /*
                const securityCheck = await window.MDJPRO_SECURITY.checkDevice(user, db);

                if (securityCheck.status === 'new_device') {
                    // Detener entrada y pedir alerta
                    const channel = securityCheck.preference === 'sms' ? 'SMS' : 'Email';
                    alert(`🚨 ¡NUEVO DISPOSITIVO DETECTADO!\n\nHemos enviado una alerta a tu ${channel} (${securityCheck.email || securityCheck.phone}).\nDebes aprobar este acceso antes de continuar.`);

                    // En un sistema real aquí invocaríamos la Edge Function para disparar el mensaje.
                    await window.MDJPRO_SECURITY.registerDevice(user.id, user.user_metadata?.user_type || 'client', db);
                }
                */

                try {
                    sessionStorage.setItem('mdj_vip_welcome_pending', '1');
                } catch (e) { /* ignore */ }
                try {
                    await mdjEnsureAuthProfileRows(db, user);
                } catch (ensureErr) {
                    console.warn('[AUTH] ensure profile after login:', ensureErr);
                }
                try {
                    await mdjCheckNewDevice(db, authData.session);
                } catch (devErr) {
                    console.warn('[AUTH] device routine after login:', devErr);
                }
                try {
                    var lpw = document.getElementById('login-password');
                    if (lpw) {
                        lpw.value = '';
                        lpw.setAttribute('type', 'password');
                    }
                } catch (eClr) {
                    void eClr;
                }
                await performPostAuthRedirect(db, user);

            } catch (err) {
                if (mdjIsInvalidCredentialsError(err)) {
                    const html = (window.i18n && typeof window.i18n.t === 'function')
                        ? window.i18n.t('auth-password-invalid')
                        : mdjAuthT(
                            'auth-password-invalid',
                            'Contraseña incorrecta. <a class="auth-inline-link" href="./forgot-password.html">¿No la recuerdas? Restablecer aquí</a>',
                            'Incorrect password. <a class="auth-inline-link" href="./forgot-password.html">Forgot it? Reset here</a>'
                        );
                    showError(html, { tone: 'error', html: true });
                } else {
                    showError(err.message || 'Error al iniciar sesión.');
                }
                if (btn) { btn.disabled = false; btn.textContent = mdjAuthPageBtnT('login-btn-submit', 'Login'); }
            }
        });
    }

    // ── SIGNUP ─────────────────────────────────────────────────────────────
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError();
            const btn = signupForm.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.textContent = mdjAuthPageBtnT('auth-signup-btn-creating', 'Creating account…'); }

            try {
                const db = await waitForSupabase();

                // Collect all fields — nombre legal: nombre + (opcional) segundo nombre o inicial + apellido
                const firstName = document.getElementById('signup-first-name')?.value.trim() || '';
                const middleName = document.getElementById('signup-middle-name')?.value.trim() || '';
                const lastName = document.getElementById('signup-last-name')?.value.trim() || '';
                const fullName = mdjBuildLegalFullNameFromSignupParts(firstName, middleName, lastName);
                const artisticName = document.getElementById('signup-name')?.value.trim() || '';
                const name = artisticName || fullName; // artistic name used as stage, fallback to legal full name
                const email = document.getElementById('signup-email')?.value.trim() || '';
                const password = document.getElementById('signup-password')?.value || '';
                const confirmPassword = document.getElementById('signup-password-confirm')?.value || '';
                const phoneRaw = document.getElementById('signup-phone')?.value.trim() || '';
                const phoneDigits =
                    typeof window.mdjNANPDigitsFromTel === 'function'
                        ? window.mdjNANPDigitsFromTel(phoneRaw)
                        : String(phoneRaw).replace(/\D/g, '').replace(/^1(\d{10})$/, '$1').slice(0, 10);
                const phone = phoneRaw;
                const addrStreet = document.getElementById('signup-address-line1')?.value.trim() || '';
                const addrApt = document.getElementById('signup-address-line2')?.value.trim() || '';
                const addrCity = document.getElementById('signup-address-city')?.value.trim() || '';
                const addrState = document.getElementById('signup-address-state')?.value.trim() || '';
                const addrZip = document.getElementById('signup-address-zip')?.value.trim() || '';
                const addrCountryEl = document.getElementById('signup-address-country');
                const addrCountry = addrCountryEl ? String(addrCountryEl.value || '').trim() : '';
                const locationOneLine = mdjFormatSignupAddressOneLine(
                    addrStreet,
                    addrApt,
                    addrCity,
                    addrState,
                    addrZip,
                    addrCountry
                );
                const instagram = document.getElementById('signup-instagram')?.value.trim().replace(/^@/, '') || '';
                const planParam = new URLSearchParams(window.location.search).get('plan') || 'LITE';

                const qpEarly = new URLSearchParams(window.location.search);
                const explicitUtEarly = (qpEarly.get('user_type') || '').toLowerCase();
                const redirectEarly = qpEarly.get('redirect');
                const signupEarly = (qpEarly.get('signup') || '').toLowerCase();
                let rosterEarly = null;
                try {
                    rosterEarly = JSON.parse(sessionStorage.getItem('mdj_jobs_roster_categories') || 'null');
                } catch (eRo) {
                    void eRo;
                }
                const hasJobsRosterEarly = rosterEarly && Array.isArray(rosterEarly.codes) && rosterEarly.codes.length > 0;
                const fromHiddenEarly = (document.getElementById('signup-usertype')?.value || 'client').toLowerCase();
                let resolvedUserType =
                    explicitUtEarly ||
                    (redirectEarly === 'jobs' || signupEarly === 'free' || hasJobsRosterEarly ? 'talent' : fromHiddenEarly);
                if (explicitUtEarly === 'talent' || explicitUtEarly === 'artist' || explicitUtEarly === 'dj') {
                    resolvedUserType = 'talent';
                }
                if (explicitUtEarly === 'client' && (redirectEarly === 'jobs' || hasJobsRosterEarly)) {
                    resolvedUserType = 'talent';
                }

                if (!firstName || !lastName) {
                    throw new Error(
                        mdjAuthT(
                            'auth-signup-legal-name-required',
                            'Completa nombre y apellido.',
                            'Enter first and last name.'
                        )
                    );
                }
                if (!email) {
                    throw new Error(
                        mdjAuthT(
                            'auth-signup-email-required',
                            'El correo electrónico es obligatorio.',
                            'Email is required.'
                        )
                    );
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    throw new Error(
                        mdjAuthT(
                            'auth-signup-email-invalid',
                            'Indica un correo electrónico válido (ej. nombre@dominio.com).',
                            'Enter a valid email address (e.g. name@domain.com).'
                        )
                    );
                }
                if (!password) {
                    throw new Error(
                        mdjAuthT(
                            'auth-signup-password-required',
                            'La contraseña es obligatoria.',
                            'Password is required.'
                        )
                    );
                }
                if (password.length < 6) {
                    throw new Error(
                        mdjAuthT(
                            'auth-signup-password-short',
                            'La contraseña debe tener al menos 6 caracteres.',
                            'Password must be at least 6 characters.'
                        )
                    );
                }
                if (password !== confirmPassword) {
                    throw new Error(
                        mdjAuthT(
                            'auth-signup-password-mismatch',
                            'Las contraseñas no coinciden. Verifícalas y vuelve a intentarlo.',
                            'Passwords do not match. Check both fields and try again.'
                        )
                    );
                }

                if (resolvedUserType === 'talent' && phoneDigits.length < 10) {
                    throw new Error(
                        mdjAuthT(
                            'auth-signup-phone-required-talent',
                            'El teléfono es obligatorio para talento: necesitamos poder contactarte.',
                            'Phone is required for talent accounts so we can reach you.'
                        )
                    );
                }
                /* Dirección postal: no bloquea el alta (mismo criterio que Apple/Meta/Instagram: cuenta primero; dirección en Ajustes). */

                // 1. Create Auth user — talento si viene de Jobs, alta gratis, o eligió categorías en el carrusel (sessionStorage).
                const userType = resolvedUserType;
                const suHidden = document.getElementById('signup-usertype');
                if (suHidden) suHidden.value = userType;
                const refCode = mdjGetReferralDjId();

                const { data, error: authErr } = await db.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            artistic_name: name,
                            full_name: fullName,
                            plan: planParam,
                            user_type: userType,
                            source_ref: refCode,
                            phone: phone || '',
                            location: locationOneLine || '',
                            addr_city: addrCity || '',
                            address_street: addrStreet || '',
                            address_apt: addrApt || '',
                            address_state: addrState || '',
                            address_zip: addrZip || '',
                            address_country: addrCountry || '',
                            username: email.split('@')[0]
                        }
                    }
                });
                if (authErr) throw authErr;

                const user = data?.user;
                if (!user) throw new Error('No se pudo crear el usuario. Intenta de nuevo.');

                // 2. Sesión JWT antes de INSERT en tablas con RLS (anon → 403 en dj_profiles / client_profiles)
                let userForRedirect = user;
                if (!data.session) {
                    const { data: siData, error: siErr } = await db.auth.signInWithPassword({ email, password });
                    if (!siErr && siData?.user) {
                        userForRedirect = siData.user;
                    } else {
                        const emLow = String(siErr?.message || '').toLowerCase();
                        if (emLow.includes('email not confirmed') || emLow.includes('not confirmed')) {
                            showError(
                                mdjAuthT(
                                    'auth-signup-confirm-email',
                                    'Cuenta creada. Revisa tu correo para confirmar; luego entra con tu email y contraseña.',
                                    'Account created. Check your email to confirm, then sign in with your password.'
                                ),
                                { tone: 'info' }
                            );
                            const tabLoginGo = document.getElementById('tab-login');
                            if (tabLoginGo) tabLoginGo.click();
                            const loginEmailGo = document.getElementById('login-email');
                            if (loginEmailGo) loginEmailGo.value = email;
                            if (btn) { btn.disabled = false; btn.textContent = mdjAuthPageBtnT('login-btn-register', 'Register'); }
                            return;
                        }
                        throw siErr || new Error('No se pudo abrir sesión automáticamente.');
                    }
                }

                // 3. Crear perfil (solo con sesión activa → políticas RLS)
                // user_id debe coincidir con auth.uid() del JWT (tras signUp o signInWithPassword).
                const profileUid = userForRedirect.id;
                if (userType === 'talent') {
                    const memberId = `DJ-${profileUid.substring(0, 6).toUpperCase()}`;
                    const referralCode = `REF${memberId.replace('DJ-', '').substring(0, 5)}`;

                    const profilePayload = {
                        user_id: profileUid,
                        email: email,
                        dj_name: name,
                        stage_name: name,
                        full_name: fullName,
                        plan: planParam,
                        status: 'ACTIVE',
                        member_id: memberId,
                        referral_code: referralCode,
                        photo_status: 'pending',
                        rating: 1.0,
                        review_count: 0
                    };

                    if (phone) profilePayload.phone = phone;
                    if (addrCity) profilePayload.city = addrCity;
                    const addrBlock = mdjFormatSignupAddressBlock(
                        addrStreet,
                        addrApt,
                        addrCity,
                        addrState,
                        addrZip,
                        addrCountry
                    );
                    if (addrBlock) profilePayload.address = addrBlock;
                    if (instagram) profilePayload.social_instagram = `https://instagram.com/${instagram.replace(/^@/, '')}`;

                    const { error: djProfileErr } = await db.from('dj_profiles').insert([profilePayload]);
                    if (djProfileErr) throw new Error(`No se pudo crear tu perfil de artista: ${djProfileErr.message || 'error desconocido'}`);
                    await mdjApplyJobsRosterToDjProfile(db, profileUid);
                } else {
                    const clientPayload = {
                        user_id: profileUid,
                        username: email.split('@')[0],
                        full_name: fullName,
                        email: email,
                        phone: phone || null,
                        city: addrCity || null,
                        address_street: addrStreet || null,
                        address_apt: addrApt || null,
                        address_state: addrState || null,
                        address_zip: addrZip || null,
                        address_country: addrCountry || null,
                        source_ref: refCode || null,
                        discount_eligible: true
                    };
                    const { error: clientProfileErr } = await db.from('client_profiles').insert([clientPayload]);
                    if (clientProfileErr) throw new Error(`No se pudo crear tu cuenta de cliente: ${clientProfileErr.message || 'error desconocido'}`);
                }

                try {
                    const piEl = document.getElementById('signup-plan-intent');
                    const rawPi = piEl ? String(piEl.value || '').toLowerCase() : 'lite';
                    let accountKindEmail = 'member';
                    if (userType === 'client') accountKindEmail = 'client';
                    else if (userType === 'talent') accountKindEmail = rawPi === 'pro' ? 'talent_pro_intent' : 'talent_lite';
                    void mdjSendSubscriptionWelcomeEmail(db, { account_kind: accountKindEmail });
                } catch (eWel) {
                    void eWel;
                }

                showError(
                    mdjAuthT(
                        'auth-welcome-new',
                        '¡Gracias por unirte a Miami DJ Beat! Ya estamos procesando tu solicitud.',
                        'Thanks for joining Miami DJ Beat! We\'re processing your request.'
                    ),
                    { tone: 'info' }
                );
                if (btn) { btn.disabled = false; btn.textContent = mdjAuthPageBtnT('login-btn-register', 'Register'); }

                try {
                    sessionStorage.setItem('mdj_vip_welcome_pending', '1');
                } catch (e) { /* ignore */ }
                setTimeout(function () {
                    void performPostAuthRedirect(db, userForRedirect);
                }, 150);

            } catch (err) {
                if (mdjIsUserAlreadyRegisteredError(err)) {
                    const em = document.getElementById('signup-email')?.value.trim() || '';
                    const loginEmailEl = document.getElementById('login-email');
                    if (loginEmailEl) loginEmailEl.value = em;
                    showError(
                        mdjAuthT(
                            'auth-account-exists-redirecting',
                            'Esta cuenta ya existe. Redirigiendo al inicio de sesión…',
                            'This account already exists. Redirecting to sign in…'
                        ),
                        { tone: 'info' }
                    );
                    if (btn) {
                        btn.disabled = true;
                        btn.textContent = '…';
                    }
                    try {
                        window.history.replaceState({}, '', './login.html?tab=login&email=' + encodeURIComponent(em));
                    } catch (h) { /* ignore */ }
                    setTimeout(function () {
                        window.location.href = './login.html?tab=login&email=' + encodeURIComponent(em);
                    }, 2000);
                    return;
                }
                showError(err.message || 'Error al crear la cuenta.');
                if (btn) { btn.disabled = false; btn.textContent = mdjAuthPageBtnT('login-btn-register', 'Register'); }
            }
        });
    }

    document.addEventListener('languageChanged', function () {
        try {
            const lf = document.getElementById('login-form');
            const sf = document.getElementById('signup-form');
            const lb = lf && lf.querySelector('button[type="submit"]');
            const sb = sf && sf.querySelector('button[type="submit"]');
            if (lb && !lb.disabled) lb.textContent = mdjAuthPageBtnT('login-btn-submit', 'Login');
            if (sb && !sb.disabled) sb.textContent = mdjAuthPageBtnT('login-btn-register', 'Register');
        } catch (e) {
            void e;
        }
    });
});

// ── Inyección Global del Botón Logout ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const bootstrapGlobalHeader = async () => {
        const db = window.getSupabaseClient ? window.getSupabaseClient() : null;
        if (!db) {
            setTimeout(bootstrapGlobalHeader, 500);
            return;
        }

        const handleSessionState = async (session, liveUser = null) => {
            const loginBtn = document.getElementById('header-login-btn');
            const loginBtnMob = document.getElementById('header-login-btn-mobile');
            const authZone = document.getElementById('header-auth-zone');
            const headerDelegated = window.__MDJ_HEADER_SESSION_OWNER && document.getElementById('mainHeader');

            if (session) {
                if (!headerDelegated) {
                // UI Core Toggles (Morph Login to Logout — copy via window.updateAuthButtons + document.lang)
                if (loginBtn) {
                    loginBtn.setAttribute('data-i18n', 'btn-logout');
                    loginBtn.classList.remove('gold');
                    loginBtn.classList.add('danger');
                    loginBtn.href = '#';
                    loginBtn.onclick = window.doLogout || async function (e) { if (e) e.preventDefault(); await db.auth.signOut(); window.location.reload(); };
                    loginBtn.style.visibility = 'visible';
                    loginBtn.style.opacity = '1';
                    loginBtn.style.pointerEvents = 'auto';
                }
                if (loginBtnMob) {
                    loginBtnMob.setAttribute('data-i18n', 'btn-logout');
                    loginBtnMob.classList.remove('gold');
                    loginBtnMob.classList.add('danger');
                    loginBtnMob.href = '#';
                    loginBtnMob.onclick = window.doLogout || async function (e) { if (e) e.preventDefault(); await db.auth.signOut(); window.location.reload(); };
                    loginBtnMob.style.visibility = 'visible';
                    loginBtnMob.style.opacity = '1';
                    loginBtnMob.style.pointerEvents = 'auto';
                }
                if (authZone) {
                    authZone.style.visibility = 'visible';
                    authZone.style.opacity = '1';
                    authZone.style.pointerEvents = 'auto';
                }

                // Robust Avatar Sync (Live Fetch from user object) — VIP slot + legacy .avatar
                const targetUser = liveUser || session.user;
                const sessionAvatar = targetUser?.user_metadata?.avatar_url;
                const applyHeaderPhoto = (url) => {
                    if (!url || !String(url).trim()) return;
                    let u = String(url).trim();
                    if (typeof window.mdjNormalizeAvatarStorageUrl === 'function') {
                        u = window.mdjNormalizeAvatarStorageUrl(u) || u;
                    }
                    try {
                        console.log('📸 URL detectada para avatar:', u || '(ninguna)', { source: 'auth.js applyHeaderPhoto' });
                    } catch (eL) { /* ignore */ }
                    if (document.getElementById('mdjHeaderAvatarSlot') && typeof window.mdjHeaderVipApplyPhotoUrl === 'function') {
                        window.mdjHeaderVipApplyPhotoUrl(u);
                        return;
                    }
                    document.querySelectorAll('.avatar, #accountBtn .avatar, #mdjHeaderAvatarSlot img.mdj-header-vip-avatar').forEach(av => {
                        if (av) av.src = u;
                    });
                };
                if (sessionAvatar) {
                    applyHeaderPhoto(sessionAvatar);
                } else {
                    db.from('dj_profiles').select('photo_url').eq('user_id', session.user.id).maybeSingle().then(({ data }) => {
                        if (data?.photo_url) applyHeaderPhoto(data.photo_url);
                    }).catch(e => console.warn('[AUTH] Error loading avatar:', e.message));
                }
                }

                /* STAFF / admin hub: solo #mainNav-staff-link en el HTML + mdj-shared-header.js (no duplicar con #manager-link). */
                try {
                    const legacyMngr = document.getElementById('manager-link');
                    if (legacyMngr) legacyMngr.remove();
                } catch (eMn) { /* ignore */ }

            } else {
                if (!headerDelegated) {
                // Revert to strict unconnected state (Layout-Safe) — copy via updateAuthButtons
                if (loginBtn) {
                    loginBtn.setAttribute('data-i18n', 'btn-login');
                    loginBtn.classList.remove('danger');
                    loginBtn.classList.add('gold');
                    loginBtn.href = './login.html';
                    loginBtn.onclick = null;
                    loginBtn.style.visibility = 'visible';
                    loginBtn.style.opacity = '1';
                    loginBtn.style.pointerEvents = 'auto';
                }
                if (loginBtnMob) {
                    loginBtnMob.setAttribute('data-i18n', 'btn-login');
                    loginBtnMob.classList.remove('danger');
                    loginBtnMob.href = './login.html';
                    loginBtnMob.onclick = null;
                    loginBtnMob.style.visibility = 'visible';
                    loginBtnMob.style.opacity = '1';
                    loginBtnMob.style.pointerEvents = 'auto';
                }
                if (authZone) {
                    authZone.style.visibility = 'hidden';
                    authZone.style.opacity = '0';
                    authZone.style.pointerEvents = 'none';
                }
                }
                document.getElementById('manager-link')?.remove();
            }
            if (typeof window.updateAuthButtons === 'function') {
                window.updateAuthButtons();
            }
            // mdj-shared-header owns VIP chrome + segregación portal/dashboard (no duplicar rutas de menú aquí).
            if (session && headerDelegated && typeof window.checkSessionForNav === 'function') {
                void window.checkSessionForNav();
            }
        };

        // Guarantee immediate state read on boot
        const { data: { session } } = await db.auth.getSession();
        let liveUser = null;
        if (session) {
            try {
                const { data: { user } } = await db.auth.getUser();
                liveUser = user;
            } catch (authError) {
                console.warn('[AUTH] Cannot fetch liveUser, falling back to cached session', authError);
            }
            const u = liveUser || session.user;
            if (u) {
                try {
                    await mdjEnsureAuthProfileRows(db, u);
                } catch (ensureErr) {
                    console.warn('[AUTH] ensure profile on boot session:', ensureErr);
                }
            }
        }
        await handleSessionState(session, liveUser);

        // Keep watching for dynamic disconnections 
        db.auth.onAuthStateChange(async (event, sessionObj) => {
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && sessionObj?.user) {
                try {
                    await mdjEnsureAuthProfileRows(db, sessionObj.user);
                } catch (ensureErr) {
                    console.warn('[AUTH] ensure profile on auth state:', ensureErr);
                }
            }
            let evtLiveUser = null;
            if (sessionObj) {
                try {
                    const { data: { user } } = await db.auth.getUser();
                    evtLiveUser = user;
                } catch (authError) {
                    console.warn('[AUTH] Cannot fetch evtLiveUser, falling back to cached session', authError);
                }
            }
            handleSessionState(sessionObj, evtLiveUser);
        });
    };
    bootstrapGlobalHeader();
});
