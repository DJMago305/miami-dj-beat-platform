# Artista vs referencia OWNER — 2026-09-21 — INFORME (parte estática; falta la medición en vivo)
Regla del PO: el artista usa los MISMOS íconos y la MISMA tipografía que la configuración del owner; lo que el artista no tiene, no se agrega.

## Qué páginas usa el artista
1. **`account-settings.html`** (botón CONFIG): la MISMA hoja que el owner (`mdjResolveConfigHref` manda ahí a owner, staff y artista); los paneles exclusivos del owner no existen en el DOM para el artista. **Idéntico por construcción.**
2. **`dj-dashboard.html`** (su estación): trae su **propia copia** de la barra lateral y de los estilos `.acct-*`.

## Verificado en el código — copia de `dj-dashboard.html`
- **Íconos de la barra (9 ítems):** 8 con el mismo dibujo que el owner; «Agenda / Disponibilidad» se dibuja igual (solo trae un `ry="2"` redundante). Tiene «Notificaciones» donde el owner dice «Inbox · Tickets» (misma campana). **Consistente.**
- **Tipografía `.acct-*`:** de 14 reglas comunes con `account-settings.html`, **0 diferencias reales** (las 4 que aparecen difieren solo en espacios dentro del color: `rgba(255,255,255,0.5)` vs `rgba(255, 255, 255, 0.5)`). Reglas solo de dj-dashboard: `.acct-modal-title` (18 px/800) y `.acct-modal-x` (13 px/700 dorado), del modal de esa página; el owner no tiene modal equivalente.
- **Pendiente de medir en vivo con sesión de artista:** los valores calculados (`getComputedStyle`) por si otra hoja los cambia en esa página (en el owner, «Etiqueta de sección» mide 14.4 px aunque su regla diga 10 px: hay otra regla que la sobreescribe) y los emojis dentro de los paneles.

## Emojis dentro del panel del artista (código de `dj-dashboard.html`)
Sin cambios de código; lista para revisar en vivo: ✅/❌ (guardar/errores), 🟢/🔴 (disponible/ocupado, igual que el owner en Agenda), 🎧, 🔒/🔑, ⚡, 📅, 📍, 💬, ⭐, ↺ (botón «Actualizar» de «Mi calendario»), 🔄 (aviso «evento movido»). Conflictos ya inventariados en `inventario-emojis-por-pagina.md`.

## Siguiente paso
Iniciar sesión como artista (p. ej. DJMago305) en la pestaña del navegador de la app y medir `account-settings.html` y `dj-dashboard.html` en vivo, contra `configuracion-owner-referencia.md`.
