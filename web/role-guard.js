// ─── MDJPRO Role Guard v1 ────────────────────────────────────────────────────
// Include AFTER supabase-config.js on every protected page.
// Usage: <script src="./role-guard.js" data-role="dj"></script>
//   data-role: 'dj' | 'admin' | 'manager' | 'client' | 'any'
//   If omitted, defaults to 'any' (just requires login).

(async function RoleGuard() {
    // ── Config ─────────────────────────────────────────────────
    let PAGE_ROLE = document.currentScript?.dataset?.role || 'any';
    if (PAGE_ROLE === 'dj' || PAGE_ROLE === 'talent') PAGE_ROLE = 'artist'; // Homologar proteccion

    const LOGIN_URL = './login.html';
    const DENIED_URL = './index.html';

    // ── Route map: which role lands where after login ───────────
    const ROLE_HOME = {
        artist: './dj-profile.html',
        admin: './admin-dashboard.html',
        manager: './admin-dashboard.html',
        seller: './admin-dashboard.html',
        client: './client-portal.html',
    };

    // ── Wait for Supabase ───────────────────────────────────────
    let db = null;
    for (let i = 0; i < 15; i++) {
        db = window.getSupabaseClient?.();
        if (db) break;
        await new Promise(r => setTimeout(r, 200));
    }
    if (!db) { window.location.href = LOGIN_URL; return; }

    // ── Get session with retry ──────────────────────────────────
    let session = null;
    for (let i = 0; i < 5; i++) {
        const { data } = await db.auth.getSession();
        if (data?.session) {
            session = data.session;
            break;
        }
        await new Promise(r => setTimeout(r, 150));
    }

    const path = window.location.pathname;

    // Not logged in → redirect to login (unless already there or on allowed public/hybrid pages)
    if (!session) {
        const p = (path || '').toLowerCase();
        const isPublicPage =
            p.includes('login.html') ||
            p === '/' ||
            p.endsWith('/') ||
            p.includes('index.html') ||
            p.includes('jobs.html') ||
            p.includes('dj-profile.html') ||
            p.includes('rentals.html') ||
            p.includes('shop.html') ||
            p.includes('find-dj.html') ||
            p.includes('directory.html') ||
            p.includes('courses.html') ||
            p.includes('standards.html') ||
            p.includes('article.html') ||
            p.includes('forgot-password.html') ||
            p.includes('reset-password.html') ||
            p.includes('certification.html') ||
            p.includes('client-portal.html') ||
            p.includes('dj-tools.html') ||
            p.includes('booth.html') ||
            p.includes('academia.html');

        if (!isPublicPage) {
            console.log('[RoleGuard] No session found, redirecting to login.');
            window.location.href = `${LOGIN_URL}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
        return;
    }

    // ── Determine role (Strict Security Model) ─────────────────
    const jwt = session.access_token;
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    let rawRole = 'client';
    if (typeof window.mdjResolveEffectiveUserRole === 'function') {
        rawRole = window.mdjResolveEffectiveUserRole(session.user);
    } else {
        const ut = String(session.user?.user_metadata?.user_type || '').toLowerCase();
        const appR = String(session.user?.app_metadata?.role || '').toLowerCase();
        if (ut === 'talent' || ut === 'dj' || ut === 'artist') {
            rawRole = ut === 'artist' ? 'artist' : 'talent';
        } else {
            rawRole = appR || ut || 'client';
        }
    }
    /* Páginas con data-role="dj" esperan PAGE_ROLE === 'artist': talent/dj/artist son el mismo roster. */
    if (rawRole === 'talent' || rawRole === 'dj') rawRole = 'artist';
    const role = rawRole;

    // Already logged in and on login page → redirect to role home
    if (path.includes('login.html')) {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        window.location.assign(next || ROLE_HOME[role] || './dj-profile.html');
        return;
    }

    // ── Role check ─────────────────────────────────────────────
    if (PAGE_ROLE !== 'any') {
        /*
         * Panel DJ (data-role="dj" → PAGE_ROLE artist): el roster y staff híbrido usan el mismo HTML.
         * Si el JWT trae owner|manager|seller pero dj_profiles es artista, antes se redirigía a admin-dashboard
         * y el lock de admin devolvía a dj-dashboard → parpadeo y a veces ⛔ ACCESO DENEGADO al fallar el SELECT.
         */
        const DJ_PANEL_JWT_ROLES = ['artist', 'admin', 'owner', 'manager', 'seller'];
        let allowed = Array.isArray(PAGE_ROLE)
            ? PAGE_ROLE.includes(role)
            : PAGE_ROLE === role || role === 'admin';
        if (!allowed && PAGE_ROLE === 'artist') {
            allowed = DJ_PANEL_JWT_ROLES.includes(role);
        }

        if (!allowed) {
            console.warn(`[RoleGuard] Access denied. Required: ${PAGE_ROLE}, Got: ${role}`);
            window.location.href = ROLE_HOME[role] || DENIED_URL;
            return;
        }
    }

    // ── Expose to window for other scripts ─────────────────────
    window.__mdjpro = window.__mdjpro || {};
    window.__mdjpro.session = session;
    window.__mdjpro.user = session.user;
    window.__mdjpro.role = role;

    // ── Audit log helper ───────────────────────────────────────
    window.__mdjpro.logEvent = async function (event, metadata = {}) {
        try {
            await db.from('audit_log').insert({
                user_id: session.user.id,
                event,
                metadata: { ...metadata, path: window.location.pathname },
                user_agent: navigator.userAgent.substring(0, 200),
            });
        } catch (e) {
            console.warn('[Audit] Log failed (non-critical):', e.message);
        }
    };

    // Log page visit for sensitive pages
    const AUDIT_PAGES = ['account-settings', 'admin-dashboard', 'dj-profile', 'client-portal'];
    if (AUDIT_PAGES.some(p => path.includes(p))) {
        window.__mdjpro.logEvent('page_view');
    }

})();
