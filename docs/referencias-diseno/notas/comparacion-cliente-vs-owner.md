# Cliente (`client-account.html`, cuenta de Wendy) vs referencia OWNER — 2026-09-21 — SOLO INFORME
Medido en vivo con `getComputedStyle` en la sesión de Wendy (producción, www.miamidjbeat.com; `client-account.html` no ha sido modificado en este trabajo). Referencia: `configuracion-owner-referencia.md`. Regla del PO: mismos íconos/emojis y **misma tipografía** para los mismos ítems; lo que el cliente no tiene, no se agrega; sin inventar.

## 1. Íconos de la barra lateral (los 4 ítems compartidos)
Cuenta/Perfil, Recompensas, Pagos, Notificaciones: **dibujos idénticos** al owner (SVG 16 px, trazo 2). ✔ Consistente. «Cuenta» (grilla de 4 cuadros, `overview`) existe solo en cliente: se queda.

## 2. Emojis y símbolos dentro de los paneles
| Dónde | Cliente | Owner | Veredicto |
|---|---|---|---|
| Notificaciones (estado «Soporte · Tickets») | 📬 a 32 px | 📬 a 36 px | mismo emoji ✔, distinto tamaño |
| Recompensas | 🌱 «Cliente nuevo» (nivel) | sin emoji en Recompensas | solo cliente (nivel de fidelidad); sin equivalente en el owner |
| Perfil → fichas de contacto | ☎ y ✉ como **glifos de texto** (18 px, dorado / azul) | el owner no tiene fichas de contacto con ícono | sin equivalente: por decidir (no hay precedente en el owner ni en el banco) |
Ningún otro emoji en el panel de Cliente.

## 3. Tipografía — DIFERENCIAS SISTEMÁTICAS
El owner usa la pila del sistema (`-apple-system`); el cliente usa **Outfit** en los paneles y **Arial** en la barra lateral.
| Nivel | Owner (referencia) | Cliente (hoy) | ¿Igual? |
|---|---|---|---|
| Familia de fuente | `-apple-system` | `Outfit` (paneles) · `Arial` (barra lateral y «Añadir tarjeta») | **NO** |
| Ítem de barra lateral | 13 px · 800 activo / 600 inactivo (50 %) | **14 px · 600** (72 %), Arial | **NO** |
| Título de panel (h1) | **26 px · 800 · ls −0.5** | **21.6 px · 800** (sin ls) | **NO** |
| Título de tarjeta (h3) | 15 px · 600 · ls −0.1 | (no usa h3: usa h2 en mayúsculas 11 px) | NO |
| Etiqueta de sección | 14.4 px · 800 · MAYÚSC. · ls 2 · 30 % | 13 px · 800 · MAYÚSC. · ls 1.04 · 58 % (h2 de tabla) / 11 px · 800 · ls .66 · 78 % (h2 de tarjeta) | **NO** |
| Etiqueta de fila | 10 px · 800 · MAYÚSC. · ls 2 · 35 % | 11 px · 800 · MAYÚSC. · ls .66–1.1 (`th`, eyebrow) | **NO** |
| Etiqueta flotante de campo | 14 px · 600 (dorado al flotar con texto) | 14 px · 600 (claro cuando el campo está vacío) | ✔ **MISMO componente** (`mdj-outlined-fields.css`): el color depende del estado del campo. *(Corrección 2026-09-21: mi primera lectura lo tomó por una diferencia; medí campos llenos en el owner y vacíos en el cliente.)* |
| Etiqueta de campo | 12 px · 500 · MAYÚSC. · 45 % | 13 px · 600 (sin mayúsculas) | **NO** |
| Texto de interruptor | 14 px · 500 · 90 % | 14 px · 500 · casi blanco | ✔ |
| Texto de ayuda | 13 px · 400 · 45 % | 13–14 px · 400 · 58–78 % | parcial |
| Botón `sys-btn` | 13 px · 500 | **11 px · 700 · ls .33** | **NO** |
| Botón dorado «Abrir Inbox/Ticket» | 13 px · 900 · ls .06em · negro sobre dorado | 13 px · 900 · ls .65 px · negro sobre dorado | ✔ (casi igual) |
| Enlace «Añadir tarjeta» | — | Arial 13 px · 700 azul | no existe en el owner |

## 4. Resumen
- **Íconos:** consistentes (4/4).
- **Emojis:** 📬 igual (solo cambia el tamaño 32 vs 36). ☎ ✉ y 🌱 son propios del cliente y no tienen equivalente en el owner.
- **Tipografía:** el cliente usa **otro sistema** (Outfit/Arial, escala 21.6/13/11) distinto al del owner (`-apple-system`, escala 26/15/14.4/10). Es la diferencia más grande entre los dos perfiles.
- **Pendiente de decisión del PO:** alinear la tipografía del cliente a la del owner (mapa de la tabla §3), y qué hacer con ☎ ✉ 🌱 (sin equivalente). Nada se cambia sin su orden.


## 5. Alineación aplicada (2026-09-21, a orden del PO) — `client-account.html`
Bloque único «TIPOGRAFÍA ALINEADA A LA CONFIGURACIÓN DEL OWNER» al final de la hoja de estilos (revertible borrándolo) + 📬 de 32 a 36 px. Verificado en localhost con la sesión de Wendy (medido con `getComputedStyle`): barra activa/inactiva 13 px 800/600, título de panel 26 px/800/ls −0.5, etiqueta de sección 14.4 px/800/ls 2, encabezado de tabla 10 px/800/ls 2, etiqueta de campo 12 px/500/ls .5, botón `sys-btn` 13 px/500, título «Pagos» 26 px/800, texto de ayuda 13 px/400, 📬 36 px; familia `-apple-system` en todo. **No se tocaron** colores, ☎ ✉ 🌱 (sin equivalente en el owner) ni la etiqueta flotante.
Queda por decidir: los tonos de transparencia del texto (cliente 58–78 % vs owner 30–45 %) y los ☎ ✉ 🌱.


## 6. RETIRADO (2026-09-21): la alineación de tipografía del cliente al owner
El PO aclaró que la consistencia es SOLO de emojis/íconos y que los 3 contenedores son diferentes a propósito. El bloque «TIPOGRAFÍA ALINEADA…» de `client-account.html` se **retiró** (nunca se comiteó). Este informe queda solo como registro de lo medido; la tipografía NO es objeto del ticket. Se conserva el 📬 a 36 px (es tamaño de un emoji).
