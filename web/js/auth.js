/**
 * Stub: la sesión y el header VIP (`web/mdjb-shared-header.js` → `checkSessionForNav`) definen rutas.
 * Implementación completa: `web/auth.js`.
 *
 * Cuentas artista vs cliente: post-login y `?next=` no deben mezclar `account-settings.html` / `client-portal.html`
 * con el panel de talento — ver `performPostAuthRedirect` y `mdjBuildPostAuthReturnUrlFromQuery` en `web/auth.js`.
 * Home de ajustes para artista en flujos que lo necesiten: `./dj-dashboard.html?tab=settings`
 */
if (typeof window !== 'undefined' && !window.MDJ_ACCOUNT_ARTIST_HOME) {
    window.MDJ_ACCOUNT_ARTIST_HOME = './dj-dashboard.html?tab=settings';
}
