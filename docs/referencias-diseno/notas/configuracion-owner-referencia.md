# Configuración del OWNER — referencia para todos los perfiles (medido en vivo, 2026-09-21)
Fuente: `http://localhost:8000/account-settings.html` con la sesión de owner (miamidjbeat@gmail.com, «Gerardo A Valle»), leída con `getComputedStyle`. **Regla del PO:** cliente, staff y artista usan EXACTAMENTE esto para los mismos ítems; lo que un perfil no tiene, no se agrega; no se inventan emojis nuevos.

## Tipografía (todo en la pila del sistema: `-apple-system`)
| Nivel | Tamaño / peso | Extras | Color |
|---|---|---|---|
| Ítem de barra lateral (activo) | 13 px / 800 | — | blanco |
| Ítem de barra lateral (inactivo) | 13 px / 600 | — | blanco 50 % |
| Ítem «Zona de riesgo» | 13 px / 600 | — | rojo `rgba(255,80,80,.6)` |
| Pastilla «SETTINGS» (encabezado) | 13 px / 700 | MAYÚSCULAS, ls 1.5 px | blanco 70 % |
| **Título de panel `.acct-h1`** | **26 px / 800** | ls −0.5 px | blanco (`Danger Zone`: rojo `rgb(255,85,85)`) |
| Título de tarjeta (`h3`) | 15 px / 600 | ls −0.1 px, con ícono de línea a la izquierda | blanco |
| Etiqueta de campo flotante | 14 px / 600 | — | dorado `rgba(197,160,89,.92)` |
| Etiqueta pequeña de campo | 12 px / 500 | MAYÚSCULAS, ls .5 px | blanco 45 % |
| «Eyebrow» (MiamiDJBeat ID) | 10 px / 800 | MAYÚSCULAS, ls 1.8 px | dorado 75 % |
| Etiqueta de sección (Productos, Pagos) | 14.4 px / 800 | MAYÚSCULAS, ls 2 px | blanco 30 % |
| Etiqueta de fila (Recompensas, Pagos, Danger) | 10 px / 800 | MAYÚSCULAS, ls 2 px | blanco 35 % (rojo 60 % en Danger) |
| Valor de fila | 14 px / 500 | — | blanco (Recompensas: 28 px / 900) |
| Texto de interruptor | 14 px / 500 | — | blanco 90 % |
| Texto de ayuda / descripción | 13 px / 400 | — | blanco 45 % |
| Texto pequeño (`fineprint`) | 11 px / 400 | — | `rgb(183,194,220)` |
| Metadatos (Role / Status) | 11 px / 400 | ls .44 px | blanco 55 % |
| Botón secundario (`sys-btn`: Change Photo…) | 13 px / 500 | — | blanco |
| Botón principal (`sys-btn`: Save) | 13 px / 500 | — | negro sobre dorado |
| Botón «editar» (`acct-edit`) | 13 px / 700 | — | dorado `rgb(197,160,89)` (rojo en Danger/Dispositivos: 12–13 px / 700) |
Iconos de la barra lateral: SVG de línea 16 px, `stroke-width 2`, `currentColor`.

## Emojis y símbolos de la configuración del owner
| Dónde | Símbolo | Significado |
|---|---|---|
| Agenda Operativa | 🟢 / 🔴 | disponible / ocupado o cerrado |
| Crear Perfiles | 🔑 | «Acceso exclusivo · Owner» |
| Crear Perfiles (tarjetas de tipo de cuenta) | 🏢 🤝 👤 🎧 | venue / socio / cliente / artista (en ese orden de tarjetas) |
| Emisor de Campañas | 📡 (título) · 📧 Email · 💬 SMS | canal de campaña |
| Dispositivos | ✓ «SESIÓN ACTIVA EN ESTE DISPOSITIVO», ⚠ «Nuevo dispositivo detectado», 💻 / 🖥 (según el equipo) | estado / advertencia / tipo de equipo |
| Insignia de plan | ✦ «Owner Verificado», ★ «Licencia vitalicia» | insignia |
| Barra lateral (solo owner) | ⚙ «Ajustes de Sistema», ⛁ «Pasarelas & Licencias» | **glifos de texto, sin SVG** |

## Inconsistencias DENTRO de la propia configuración del owner (informe, sin cambiar)
1. Los 2 ítems exclusivos del owner (`⚙ Ajustes de Sistema`, `⛁ Pasarelas & Licencias`) usan **glifos de texto** mientras los otros 12 usan **SVG de línea**.
2. **Idioma de los títulos de panel mezclado**: «Categoría Artística», «Agenda Operativa», «Recompensas MDJPRO» (español) frente a «Manage Products», «Subscriptions & Payments», «Danger Zone», «Personal Information» (inglés).
3. Tamaño de la pastilla «SETTINGS» (13 px) y del título de tarjeta (15 px) no aparecen en la escala de títulos de panel (26 px): dos niveles distintos que conviene nombrar.
Estos puntos NO se corrigen sin pedido del PO; se anotan para decidir cuál es «la referencia» final.

## Cómo usarla en el siguiente perfil
Comparar, ítem por ítem: (a) símbolo, (b) fuente, (c) tamaño/peso/espaciado/color de cada nivel de la tabla, (d) mismo orden de tarjetas. Solo para ítems que ese perfil también tenga.
