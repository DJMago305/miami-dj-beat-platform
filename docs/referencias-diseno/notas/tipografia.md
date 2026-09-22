# Tipografía

## Familias (frecuencia en `web/*.css` y `web/*.html`)
| Familia | Usos | Dónde |
|---|---|---|
| `'Outfit', sans-serif` | cuerpo del sitio | `styles.css` (`body`) |
| `'Playfair Display', serif` | 81 | títulos de sección/marca |
| `'Cormorant Garamond', serif` | ~79 | títulos elegantes (`academia`, etc.) |
| `'Inter', sans-serif` | 20 | interfaces de datos; Google Fonts `Inter 300–900` + `Playfair Display 700/italic` (`display=optional`) |
| `"Helvetica Neue", system-ui…` (`--sans`) | calendario | `calendario-operacional-inteligente.html` |
| `ui-monospace, "SF Mono", Menlo` (`--mono`) | contadores, etiquetas técnicas del calendario | ídem |
Emoji: fuente del sistema (Apple Color Emoji en macOS); los botones con emoji usan pila `-apple-system, 'Apple Color Emoji', 'Segoe UI Emoji'`.

## Tamaños por caso (medidos en el código)
| Caso | Tamaño / peso | Fuente en el código |
|---|---|---|
| Título de sección `h2` | 28 px | `styles.css` |
| Subtítulo `.sub` | 16 px, color `--muted` | `styles.css` |
| Saludo del portal (`client-welcome`) | 26 px | `client-portal.js` (hub) |
| Encabezado de tabla del portal | 11 px / 700 / MAYÚSCULAS / letter-spacing .1em | `client-portal.js` (`TH`) |
| Celda de tabla del portal | 14 px / 600, color `#d4af37` | `client-portal.js` (`TD`) |
| Botón de acción de tabla | 12 px / 700 | «Ver Orden», «Cancelar», «Delete», «🔄» |
| Chip de evento del calendario | 12 px | `client-portal.html` (`.portal-coi .chip`) |
| Selector Día/Semana/Mes/Año | 13.5–14 px / 600 (activa 700) | calendarios |
| Diálogos propios (`portalConfirmar`, `mdj-cancelar.js`) | texto 13–14 px, títulos 17 px / 900, etiquetas 11 px / 800 en MAYÚSCULAS | esos archivos |
| Avisos / texto de ayuda | 11–12 px, color `rgba(255,255,255,.5–.7)` | varios |

**Por medir / por confirmar:** tamaños de `h1` por página (`styles.css` tiene reglas `h1` con `!important` en la línea ~8024), cuerpo de texto base, y tamaños del menú principal (`#mainNav`).
