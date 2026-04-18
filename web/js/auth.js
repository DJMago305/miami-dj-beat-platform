/**
 * Miami DJ Beat — Auth (login / signup / device check)
 *
 * Canonical implementation: `web/auth.js` (loaded by `login.html` and pages that include the bundle).
 * Header VIP + loyalty: `web/mdj-shared-header.js` + `window.checkSessionForNav`.
 * Do not duplicate signup or `mdjCheckNewDevice` logic here; edit `web/auth.js` only.
 *
 * Rol DJ vs cliente (menú VIP / `#accountBtn` / avatar): lo define `checkSessionForNav` en
 * `web/mdj-shared-header.js` — artistas con fila en `dj_profiles` → `dj-dashboard.html`; clientes →
 * `client-portal.html`. No re-enrutar artistas a `account-settings.html` desde aquí.
 */
