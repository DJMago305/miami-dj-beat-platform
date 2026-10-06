// Auth Protection Check
(async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    const path = window.location.pathname;
    const isLoginPage = path.includes('login.html') || path === '/' || path.endsWith('index.html');

    if (!session && !isLoginPage) {
        window.location.replace('./login.html');
        return;
    }

    if (session && isLoginPage) {
        const params = new URLSearchParams(window.location.search);
        /* H3c: ?next= solo a rutas del propio sitio (mdjSafeNextRaw de auth.js; antes se asignaba tal cual) y destino por defecto = su edificio (tabla canónica de mdj-identity.js). */
        const home = typeof window.mdjBuildingHomeForRole === 'function'
            ? window.mdjBuildingHomeForRole(String((session.user.app_metadata && session.user.app_metadata.role) || ''))
            : 'dj-dashboard.html';
        let next = (typeof window.mdjSafeNextRaw === 'function' ? window.mdjSafeNextRaw(params.get('next')) : '') || home;
        if (next.includes('login.html') || next.includes('index.html')) {
            next = home;
        }
        window.location.replace(next);
    }
})();
