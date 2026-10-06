// ─── MDJPRO Role Guard v1 ────────────────────────────────────────────────────
// Include AFTER supabase-config.js on every protected page.
// Usage: <script src="./role-guard.js" data-role="dj"></script>
//   data-role: 'dj' | 'admin' | 'manager' | 'client' | 'any'
//   If omitted, defaults to 'any' (just requires login).

(async function RoleGuard() {
    // ── Config ─────────────────────────────────────────────────
    let PAGE_ROLE = (document.currentScript && document.currentScript.dataset && document.currentScript.dataset.role) || 'any';
    if (PAGE_ROLE === 'dj' || PAGE_ROLE === 'talent') PAGE_ROLE = 'artist'; // Homologar proteccion

    const LOGIN_URL = './login.html';
    /* Destino del CLIENTE cuando la página no es suya: cada página declara su contenedor con data-client-home
       (p. ej. account-settings.html → ./client-account.html). Sin él, va a su portal (tabla canónica de mdj-identity.js). */
    const CLIENT_HOME_OVERRIDE = (document.currentScript && document.currentScript.dataset && document.currentScript.dataset.clientHome) || '';
    /* Las páginas protegidas nacen ocultas (data-mdj-guard="pending" en <html>) hasta que la guarda decide:
       así un rol equivocado nunca ve, ni por un instante, el contenedor de otro. */
    function _revelar() { try { document.documentElement.removeAttribute('data-mdj-guard'); } catch (e) { /* noop */ } }

    // ── A dónde va cada edificio (login / página que no es suya) ──────────────────────────────────────────────
    // UNA sola tabla (mdj-identity.js → mdjBuildingHome, decisión del PO 2026-10-06): staff → su ficha de Staff, artista → su estación,
    // cliente → su portal (o el contenedor que la página declare con data-client-home), cuenta sin perfil → account-profile.
    // mdj-identity.js puede cargar DESPUÉS de esta guarda en algunas páginas: si falta cuando hace falta, se carga aquí.
    function _ensureIdentity() {
        if (typeof window.mdjResolveAccessKind === 'function') return Promise.resolve(true);
        return new Promise(function (resolve) {
            try {
                var sc = document.createElement('script');
                sc.src = './mdj-identity.js?v=20261006-edificio2';
                sc.onload = function () { resolve(true); };
                sc.onerror = function () { resolve(false); };
                document.head.appendChild(sc);
            } catch (e) { resolve(false); }
        });
    }
    async function _homeFor(db, user) {
        await _ensureIdentity();
        var acc = { kind: 'unknown' };
        try { if (typeof window.mdjResolveAccessKind === 'function') acc = await window.mdjResolveAccessKind(db, user); } catch (e) { /* cae al destino general */ }
        if (acc.kind === 'buyer' && CLIENT_HOME_OVERRIDE) return CLIENT_HOME_OVERRIDE;
        return typeof window.mdjBuildingHome === 'function' ? window.mdjBuildingHome(acc.kind) : './account-profile.html';
    }

    // ── Wait for Supabase ───────────────────────────────────────
    let db = null;
    for (let i = 0; i < 15; i++) {
        db = (window.getSupabaseClient && window.getSupabaseClient());
        if (db) break;
        await new Promise(r => setTimeout(r, 200));
    }
    if (!db) { window.location.href = LOGIN_URL; return; }

    // ── Get session with retry ──────────────────────────────────
    let session = null;
    for (let i = 0; i < 5; i++) {
        const { data } = await db.auth.getSession();
        if (data && data.session) {
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

        if (isPublicPage) _revelar();
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
        const ut = String((session.user && session.user.user_metadata && session.user.user_metadata.user_type) || '').toLowerCase();
        const appR = String((session.user && session.user.app_metadata && session.user.app_metadata.role) || '').toLowerCase();
        if (appR === 'client' || appR === 'artist' || appR === 'dj' || appR === 'talent') {
            rawRole = appR; // el rol del servidor manda; user_type lo escribe el usuario
        } else if (ut === 'talent' || ut === 'dj' || ut === 'artist') {
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
        /* ?next= solo a rutas del propio sitio (mdjSafeNextRaw, auth.js): antes se asignaba tal cual (redirección abierta). Sin esa función, se ignora. */
        const next = typeof window.mdjSafeNextRaw === 'function' ? window.mdjSafeNextRaw(params.get('next')) : '';
        window.location.assign(next || await _homeFor(db, session.user));
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
            window.location.replace(await _homeFor(db, session.user));
            return;
        }
    }

    // ── Rol permitido: se muestra la página ─────────────────────
    _revelar();

    // ── Expose to window for other scripts ─────────────────────
    window.__mdjpro = window.__mdjpro || {};
    window.__mdjpro.session = session;
    window.__mdjpro.user = session.user;
    window.__mdjpro.role = role;

    // page_view ya no se registra desde el navegador: audit_log no tiene permiso de
    // INSERT para el cliente ni las columnas que se enviaban (daba 400 en cada carga).

})();
