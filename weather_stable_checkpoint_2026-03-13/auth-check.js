// Auth Protection Check
(async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session && !window.location.pathname.includes('login.html')) {
        window.location.href = './login.html';
    }

    if (session && window.location.pathname.includes('login.html')) {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next') || 'dj-profile.html';
        window.location.assign(next);
    }
})();
