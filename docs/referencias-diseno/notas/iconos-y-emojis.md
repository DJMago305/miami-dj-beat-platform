# Iconos y emojis

## Confirmados por el PO
| Acción / significado | Símbolo | Dónde ya se usa | Nota |
|---|---|---|---|
| **Restaurar / reiniciar / repetir / renovar / evento movido** | **🔄** | `certification.html` («🔄 Reiniciar»), `courses.html` («🔄 REPETIR EXAMEN»), `standards.html` («🔄 Re-certificación»), portal del cliente (burbuja junto al «+», fila de Historial, lista «Restaurar órdenes borradas») | PO 2026-09-21: «esa es la idea» tras mostrar la captura del 🔄 azul. |
| Configuración de cuenta (todas las cuentas) | **íconos de línea de `Configuracion De Cuentas Parte 1.png`** | ver `../README.md` (tabla concepto → pieza en `piezas/iconos/`) | PO 2026-09-21: «todo igual en todas las páginas». |
| Desbloqueado / acceso owner activo | 🔓 | `staff.html` (Gobernanza) | Solo para eso. |
| Ítem owner-only bloqueado | 🔑 | `staff.html` | Solo para eso. |
| Estado vacío / seguro sin pendientes | 🔒 | `staff.html` | Solo para eso. |

## RECHAZADOS por el PO (no usar)
- `↺` (carácter de texto): «no es el diseño que estamos usando». Solo aparece como botón «Actualizar» pequeño (`.btn secondary small`, 10 px) en `dj-dashboard.html` (líneas ~2981 y ~2997) y `staff-agenda.html`; **no es el de Restaurar**.
- SVG `rotate-ccw` de Lucide para Restaurar (2026-09-21).
- La palabra «Restaurar» como texto de la burbuja.

## Uso observado en el código (significado por confirmar salvo lo indicado)
Conteo aproximado sobre `web/*.html`, `web/*.js`, `web/js/*.js`.
| Símbolo | Usos | Uso típico observado | Estado |
|---|---|---|---|
| ✓ / ✅ | 132 / 115 | confirmado, hecho, éxito | por confirmar |
| ❌ / ✕ | 76 / 31 | error, cerrar, quitar | por confirmar |
| ⚠ | 51 | advertencia | por confirmar |
| ⚙ | 122 | configuración (`CONFIG` en el menú) | visto en la barra |
| 🛒 | 74 | carrito / shop | por confirmar |
| 🤖 | 58 | ELIXIS / IA | por confirmar |
| 🎧 | 51 | DJ, set, evento asignado (también avisos de asignación) | por confirmar |
| 📅 | 18 | calendario / agenda | por confirmar |
| 🚫 | 18 | cancelado (avisos de cancelación, eventos cancelados) | usado en este trabajo |
| 💬 | 12 | chat | por confirmar |
| 📍 | 10 | ubicación | por confirmar |
| ⏰ | — | recordatorios 24 h / 2 h del DJ | usado en este trabajo, por confirmar |
| 🚨 | — | cancelaciones urgentes (staff) | usado en este trabajo, por confirmar |

## Íconos SVG (cuando la plataforma usa dibujo y no emoji)
Firma común (Lucide/Feather copiados a mano): `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"`, `stroke-width` **2** en general y **1.8** en la barra del calendario (`calendario-operacional-inteligente.html`: campana, usuario, ×, ✓). No mezclar con íconos rellenos.
Precedentes: `mdj-commander.html` (~línea 1097, diccionario `IC`: `history`, `bell`, `clients`…), barras laterales de `account-settings.html` y `staff.html`.

## Regla de oro
Un mismo concepto = un mismo símbolo en toda la web. Si el concepto ya tiene símbolo aquí, se usa ese. Si no hay, se **pregunta**.


## Aprobado 2026-09-21
- 🔄 también es el símbolo de **«evento movido»** (avisos del DJ, `js/dj-avisos.js`). PO: «usa 🔄 también para evento movido».
- Los íconos de configuración de cuenta son los de `../Configuracion De Cuentas Parte 1.png`, iguales en TODAS las cuentas. **Pendiente:** auditar `account-settings.html`, `client-account.html` y demás páginas de cuenta para que usen exactamente esos íconos (hoy cada una tiene su propio juego).

## Aprobado / corregido 2026-09-21 (a pedido del PO)
- Cliente → Perfil → fichas de contacto: los glifos de texto `☎` y `✉` **no son los que usamos**; se reemplazaron por los íconos de línea del estándar (`piezas/iconos/icono--cuenta--numero-de-telefono.png` y `icono--cuenta--correo-electronico.png`), en SVG de trazo 2, con el color de cada ficha (dorado / azul). Archivo: `client-account.html`.

## Aprobado 2026-10-02 (a pedido del PO)
- **Entradas** (taquilla de salas, Pedidos → Entradas en `staff.html`): **🏠** («una casita con una puerta»). Sustituye al 🎟️ que había puesto yo sin precedente. Ojo: 🏠 ya aparece como «🏠 RESIDENCIA» en `js/agenda-engine.js` (DJ residente de un local); son conceptos cercanos (el local), pero distintos: no usar 🏠 para otra cosa más.
- Mesas tomadas en el plano de salas: cartel «reservada» y rojo `#ff6060` (el del estado «Cancelado» del portal, aquí significa «ocupada»); disponible `#00c878`, elegida dorado `#c5a059`.
- **Comprar entrada** (botón de la sala `venue-room.html`): **🛒**, el mismo del carrito del header y de `shop.html` (aprobado por el PO 2026-10-02).


## Salas → Mesas (2026-10-07, a pedido del PO: «botones de solo emoji, ubicados donde todo el mundo los busca»)
Botonera de solo emoji en la esquina superior derecha del plano (el nombre solo aparece al pasar el cursor, `title`):
| Acción | Emoji | Origen | Estado |
|---|---|---|---|
| Mover mobiliario / diseñar mesas | **🗺️** | lo escribió el PO en sus órdenes («🗺️ Diseñar / Mover mesas») | en uso |
| Pantalla completa | **⛶** | lo escribió el PO en sus órdenes («⛶ Pantalla Completa») | en uso |
| Abrir la operación de hoy | **▶** | lo escribió el PO en sus órdenes («▶ Abrir operación de hoy») | en uso |
| Mapa maestro / plantilla de la sala | **🏛️** | el PO lo escribió en el selector («🏛️ Plantilla maestra») | en uso |
| Agregar mesa | **🪑** | **sin precedente en el banco**: elegido por equivalencia (silla = mesa/sillas) porque el PO dijo «si no existe, uno equivalente» | **APROBADO por el PO (2026-10-07, vía bloque pegado)** |
| Taburete de barra | **🍸** | lo escribió el PO en su orden («🍸 Taburete de Barra») | en uso (en el selector «Agregar» y en el aviso del botón); falta su confirmación visual |
| Eliminar el mueble seleccionado | **🗑️** | lo escribió el PO en su orden («🗑️ Eliminar mesa seleccionada») | en uso (botón rojo del panel de la mesa); falta su confirmación visual |
Se retiraron los íconos SVG dibujados por iniciativa propia (teléfono, mover, mesa, pantalla completa, etc.) y la lupa del buscador: no tenían precedente.
