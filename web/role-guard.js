// ─── MDJPRO Role Guard v1 ────────────────────────────────────────────────────
// Include AFTER supabase-config.js on every protected page.
// Usage: <script src="./role-guard.js" data-role="dj"></script>
//   data-role: 'dj' | 'admin' | 'manager' | 'client' | 'any'
//   If omitted, defaults to 'any' (just requires login).

(async function RoleGuard() {
    // ── Config ─────────────────────────────────────────────────
    const PAGE_ROLE = document.currentScript?.dataset?.role || 'any';
    const LOGIN_URL = './login.html';
    const DENIED_URL = './index.html';

    // ── Route map: which role lands where after login ───────────
    const ROLE_HOME = {
        dj: './dj-profile.html',
        admin: './admin-dashboard.html',
        manager: './admin-dashboard.html',
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

    // ── Get session ────────────────────────────────────────────
    const { data: { session } } = await db.auth.getSession();
    const path = window.location.pathname;

    // Not logged in → redirect to login (unless already there)
    if (!session) {
        if (!path.includes('login.html') && !path.includes('index.html') && !path.includes('jobs.html')) {
            window.location.href = `${LOGIN_URL}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
        return;
    }

    // ── Determine role ─────────────────────────────────────────
    const jwt = session.access_token;
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    const role = payload?.app_metadata?.role || 'dj';

    // Already logged in and on login page → redirect to role home
    if (path.includes('login.html')) {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        window.location.assign(next || ROLE_HOME[role] || './dj-profile.html');
        return;
    }

    // ── Role check ─────────────────────────────────────────────
    if (PAGE_ROLE !== 'any') {
        const allowed = Array.isArray(PAGE_ROLE)
            ? PAGE_ROLE.includes(role)
            : PAGE_ROLE === role || role === 'admin'; // admin can access any page

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
