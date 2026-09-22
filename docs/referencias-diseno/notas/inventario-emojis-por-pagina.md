# Inventario de emojis por página y por concepto (2026-09-21) — SOLO INFORME
Base del ticket «compactar todos los emojis». Conteo estático (código de cada página y sus `.js` propios); **no sustituye** la revisión visual entrando a cada cuenta/perfil. Nada se modificó.

| Concepto | account-settings | client-portal | dj-dashboard | dj-profile | staff | staff-admin | staff-agenda |
|---|---|---|---|---|---|---|---|
| correcto / éxito | ✓20 ✅2 | ✓2 ✅1 | ✅7 | ✅8 ✓8 ✔3 | ✓3 ✅1 ✔1 | ✅36 ✓13 | ✅6 |
| error / cerrar | ✗2 ❌2 ✕1 | ❌1 | ❌5 ✕1 | ❌2 ✕2 | ✕2 | ❌26 ✕5 ✗2 | ❌5 ✕1 |
| advertencia | ⚠5 | ⚠1 | · | ⚠1 | · | ⚠11 | · |
| candado / seguridad | 🔒1 🔑1 | 🔒1 | 🔒1 🔑1 | · | 🔑2 🔓1 🔒1 | 🔑1 | 🔒1 🔑1 |
| disponible / ocupado | 🟢1 🔴1 | · | 🟢1 🔴1 | 🔴1 | 🟡1 🟢1 🔴1 | 🔴1 | 🟢1 🔴1 |
| notificación | · | · | 🔔1 | · | 🔔1 | · | · |
| calendario | · | 📅1 | 📅2 | 📅2 | 📅2 | 📅3 | 📅2 |
| configuración | ⚙2 | ⚙1 | ⚙1 | ⚙1 | ⚙6 | ⚙2 | ⚙1 |
| usuario | 👤2 | · | · | · | · | 👤10 | · |
| dinero | · | · | · | 💵3 💳1 | · | 💳2 💰1 | · |
| borrar | 🗑1 | · | · | · | 🗑1 | 🗑4 | · |
| reiniciar / restaurar / actualizar | · | · | ↺2 🔄1 | · | ↺1 | · | ↺1 |
| DJ / música | 🎧3 | 🎧2 | 🎧1 | 🎵8 🎧1 | 🎧3 🎵2 | 🎧7 🎵2 | · |
| estrella | ★1 | ★5 ⭐1 | ⭐2 | ★10 ⭐5 | ★19 | ⭐1 ★1 | ⭐2 |
(En `account-profile`, `client-account`, `client-billing`, `staff-order`, `admin`, `cash-flow` casi no hay emojis: solo ⚙, 🛒, 🤖 sueltos.)

## Conflictos: un mismo concepto con varios símbolos
- **Correcto / éxito:** `✓` `✔` `✅` (las tres en varias páginas).
- **Error / cerrar:** `✗` `✕` `❌`.
- **Estrella:** `★` y `⭐`.
- **Reiniciar / restaurar / actualizar:** `↺` (botón «Actualizar» de `dj-dashboard`, `staff`, `staff-agenda`) vs **🔄** (aprobado para restaurar/reiniciar/repetir/evento movido). Falta decidir si «Actualizar» pasa a 🔄.
- **Música / DJ:** `🎧` y `🎵` mezclados.
- **Disponible / ocupado:** `🟢🔴` con un `🟡` extra en `staff`/`admin`.

## Cómo seguir (propuesto)
1. El PO elige el símbolo único por concepto (una tabla de decisiones; queda en `iconos-y-emojis.md`).
2. Revisión visual entrando a cada perfil: owner, admin, manager, seller, artista (DJ), cliente. Se hace con la sesión iniciada por el PO en la pestaña del navegador de la app; se compara lo que ve cada rol.
3. Recién entonces se compacta, página por página y con su visto bueno.
