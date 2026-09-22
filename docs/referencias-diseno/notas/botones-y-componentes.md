# Botones y componentes

## Botón principal del sitio (`styles.css`)
`.btn`: `padding 12px 14px`, radio 12 px, borde `--line`, fondo `rgba(255,255,255,.03)`, peso 700. `.btn.primary`: borde y texto `--gold`, degradado dorado `.15→.05`. `.btn.full`: ancho 100 %.

## Botón de acción en tablas (portal del cliente)
Padding `6px 10px` (rojo: `6px 12px`), radio 6 px, 12 px / 700, `white-space:nowrap`. Dorado = ver / restaurar; rojo = cancelar / borrar. Etiquetas actuales: **«Ver Orden»**, **«Cancelar»**, **«Delete»** (en inglés, así ya estaba la tabla) y **🔄** para restaurar.

## Burbuja de cristal (`.coi-glass`, `client-portal.html`) — PO 2026-09-21
Círculo 34×34 (`border-radius:999px`), fondo `rgba(255,255,255,.10)`, `backdrop-filter: blur(14px) saturate(140%)`, borde `rgba(255,255,255,.22)`, brillo interior `inset 0 1px 0 rgba(255,255,255,.25)` + sombra `0 4px 14px rgba(0,0,0,.35)`. Hover: fondo `.18` y borde dorado. Usada para **🔄 Restaurar** y **+** junto al selector de vista.

## Diálogos
Nunca `confirm()` / `alert()` nativos (se bloquean en navegadores embebidos): usar el diálogo en la página (`portalConfirmar` en `client-portal.js`, `MDJCancelarEvento` en `js/mdj-cancelar.js`). Fondo `#121212`, borde dorado `rgba(197,160,89,.5)`, radio 14 px, Esc / clic fuera = cancelar.

## Aviso temporal (toast)
`portalToast` (`client-portal.js`): abajo al centro, cristal oscuro, borde dorado, dura ~3.6 s.

## Selector de vista Día / Semana / Mes / Año
Contenedor `.seg` (fondo panel-2, radio 11 px). Opción activa en color de acento `--set` (ver `colores.md`).

## Por completar
Tarjetas, formularios, menú principal, insignias/badges, tablas de staff. Se agregan cuando el PO confirme cada patrón.
