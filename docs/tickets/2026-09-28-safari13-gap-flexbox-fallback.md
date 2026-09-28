# TICKET — Respaldo de `gap` en flexbox para Safari 13.1.2 / High Sierra
Hallazgo original documentado el 2026-09-08 (cierre del frente Safari 13/High Sierra, PRs #330-#332), nunca construido — quedó guardado en un `git stash` (`fix/flexbox-gap-safari13-carousels`, "wip antes de rebase") sin aplicar. Recuperado y CONSTRUIDO el 2026-09-28.

## El problema
Safari no soportó `gap`/`column-gap`/`row-gap` dentro de contenedores **flex** (sí en grid) hasta la versión 14.1. Safari 13.1.2 — tope real de macOS High Sierra 10.13.6, el último sistema que corre en hardware de esa época — lo ignora por completo: el espaciado colapsa a 0 en todo el sitio, porque `header-unified.css` (compartido por absolutamente todas las páginas) tenía 27 declaraciones reales de `gap`/`column-gap`/`row-gap` no-cero controlando el nav principal, el cluster de sesión/idioma, el carril del carrito, el menú móvil y la franja flotante de bienvenida.

## La solución — construida, campo por campo
Por cada declaración `gap` real (no-cero) se agregó, justo después de su regla, un bloque `@supports not (gap: 1px) { <mismo selector> > * + * { margin-left: <mismo valor>; } }` (patrón "lobotomized owl"):
- **Puramente aditivo y cero riesgo para navegadores modernos**: `@supports not (gap: 1px)` es `false` en cualquier navegador que sí soporte `gap` (Safari 14.1+, Chrome, Firefox, todos) — esos bloques nunca se evalúan ahí, así que no pueden competir ni alterar nada del comportamiento actual.
- **Mismo valor exacto** (literal, `clamp()` o `var(--mdj-nav-gap)`) que la regla `gap` que respalda — el espaciado en Safari 13 queda igual de "elástico" que en cualquier otro navegador, no un valor fijo aproximado.
- Los 11 usos de `gap: 0`/`row-gap: 0`/`column-gap: 0` (todos ya cero) se dejaron sin tocar — un respaldo de 0px es un no-op, no aporta nada.
- Los 27 usos reales quedaron cubiertos en 22 bloques `@supports` (algunos agrupan 2-3 declaraciones del mismo componente en un solo bloque).

## Verificación
- Balance de llaves del archivo completo verificado antes y después de cada tanda de cambios (Python, conteo de profundidad `{`/`}`) — se encontró y corrigió un error real propio en el camino (una regla cortada a la mitad, con una declaración huérfana dentro del `@supports`).
- Verificado en vivo (`localhost:8000`, contenedor real): header idéntico en desktop y móvil antes y después del cambio — exactamente lo esperado, ya que `@supports not (gap: 1px)` es falso en el navegador de prueba (Chromium) y en cualquier motor moderno.
- `check-hygiene.mjs`/`check-i18n.mjs` en verde.
- **No se pudo verificar visualmente en Safari 13.1.2/High Sierra real** — limitación conocida de este entorno (memoria `feedback_chromium_tool_cannot_verify_safari13`: "0 errores en Chromium no es prueba real" para ese navegador específico). La corrección se basa en la especificación CSS (`@supports`/lobotomized owl es un patrón establecido, no un experimento) y en que el valor de respaldo es idéntico al valor real, no en una captura de pantalla del navegador legado.

## Pendiente / fuera de alcance de este ticket
- **5 imágenes huérfanas** (`web/assets/lighting/laser.jpg`, `led-large.jpg`, `led-small.jpg`, `moving-heads.jpg`, `uplighting.jpg`) que el stash original también proponía borrar — confirmado que hoy no las referencia ningún HTML del sitio, pero es una limpieza de higiene sin relación directa con este fix. No se tocaron aquí; queda como nota para el PO, sin borrar sin pedido explícito.
