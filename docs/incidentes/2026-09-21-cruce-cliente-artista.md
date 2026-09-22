# Incidente 2026-09-21 — un CLIENTE dentro del contenedor del ARTISTA (alerta roja)
**Qué pasó:** una sesión de cliente (Wendy) apareció en `account-settings.html` con el menú de artista (Categoría, Agenda, Productos, SoundForTips…).
**Causa:** ver `docs/contenedores-y-rutas.md` §«Causas» (6 causas; la principal: `account-settings.html` sin guarda de rol + varias entradas que llevaban al cliente allí).
**Detección:** el PO lo vio en pantalla. En esa captura el cruce lo provocó también una prueba mía (navegué la sesión de Wendy a esa página), pero el hueco era real y alcanzable por enlaces normales.
**Corrección:** muralla en el destino + cierre de las 6 causas + verificador automático `scripts/verificar-contenedores.mjs` (falla en rojo con el código anterior).
**Pendiente:** decisión sobre «Ver Portal» del DJ; retirada del código antiguo de clientes en `account-settings.html`; revisión visual del PO con artista/staff/owner (solo se probó el cliente en vivo).
