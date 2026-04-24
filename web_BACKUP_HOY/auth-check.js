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
        let next = params.get('next') || 'dj-dashboard.html';
        if (next.includes('login.html') || next.includes('index.html')) {
            next = 'dj-dashboard.html';
        }
        window.location.replace(next);
    }
})();
