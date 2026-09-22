# Auditoría de íconos — `web/account-settings.html` (2026-09-21) — SOLO INFORME

Estándar: `../Configuracion De Cuentas Parte 1.png` (íconos cortados en `../piezas/iconos/`). Nada de la página se modificó: los cambios de ícono/emoji se hacen **solo cuando el PO lo pida**.

## 1. Barra lateral (12 ítems, `.acct-side-link`)
Todos son SVG de línea (Feather/Lucide, `viewBox 24`, `stroke-width 2`): **misma familia** que el estándar. Lo que difiere es la **forma** de cada ícono, y para la mayoría **el estándar no trae un equivalente**.

| Ítem de la barra | Forma actual | ¿Hay equivalente en el estándar? | Pieza del estándar |
|---|---|---|---|
| Cuenta | usuario (círculo + hombros) | **No** | — |
| Categoría | nota musical (trazo + 2 círculos) | **No** | — |
| Agenda / Disponibilidad | calendario | **No** | — |
| Recompensas | estrella | **No** (el «destello» azul de *Mejorar el plan* significa otra cosa) | — |
| Productos | maletín | **No** | — |
| Inbox · Tickets | campana | **Sí** (Notificaciones) | `icono--cuenta--notificaciones.png` |
| Suscripción y pagos | tarjeta de crédito | **Parcial**: el estándar usa «cuadrado con +» para *Suscripción* | `icono--cuenta--suscripcion.png` |
| SoundForTips · Cobros | (2 trazos) | **No** | — |
| Dispositivos | monitor | **No** | — |
| Redes Sociales | nodos conectados | **No** | — |
| Documentos Legales | documento con líneas | **Aproximado**: *Términos de uso* (libreta con líneas) | `icono--acerca-de--terminos-de-uso.png` |
| Zona de riesgo | triángulo de alerta | **No** (lo más cercano son *Seguridad* = candado y *Controles de datos* = escudo, otro significado) | — |

**Resultado:** solo 1 coincidencia clara (campana), 2 aproximadas y **9 sin referencia**. Regla del banco: sin precedente **se pregunta**, no se inventa. Para completarlo el PO puede (a) dar capturas de los conceptos que faltan (Cuenta, Agenda, Recompensas, Productos, Dispositivos, Redes, Zona de riesgo, SoundForTips, Categoría) o (b) indicar que se mantengan los actuales.

## 2. Emojis dentro de los paneles (70 usos, 31 distintos)
Inventario, sin cambiar nada:
- Estados: `✓` (20, «SESIÓN ACTIVA…», «Plan Activo»), `✅`, `✗`, `❌`, `⚠` (5), `🟢` / `🔴` (disponible / ocupado), `🔒`, `🔑`.
- Insignias: `✦` («Owner Verificado»), `★` («LICENCIA VITALICIA»).
- Tarjetas de selección: `🏢`, `🤝`, `👤` (tipo de cuenta), `📡` (Emisor de Campañas), `🎧`, `🤖`, `🛒`, `⚙️`, `💻` / `🖥` (tipo de dispositivo), `🗑` (borrar), `✕` y `➔` (botones), `⛁` (Pasarelas & Licencias).
**Inconsistencias detectadas (informe):** el mismo concepto «correcto/éxito» aparece como `✓`, `✅` y `✔`; «error» como `✗`, `❌` y `✕`; «bloqueado/seguro» usa `🔒` y `🔑` (definidos así en el banco). Ninguno de estos tiene aún un símbolo aprobado por el PO en `iconos-y-emojis.md`.

## 3. Qué haría falta para igualar (si el PO lo pide)
1. Definir con el PO el símbolo único de «correcto», «error», «advertencia» y «disponible/ocupado».
2. Reemplazar solo los 3 íconos de la barra que sí tienen equivalente, si el PO lo aprueba.
3. Pedir referencia para los 9 conceptos sin equivalente.
4. Repetir esta auditoría en `client-account.html` y las demás páginas de cuenta.


## 4. Comparación entre perfiles (PO 2026-09-21: «cliente/staff/artista deben ser los mismos que en la configuración del owner; lo que un perfil no tiene, no se pone»)
Hallazgos del código (comparando la GEOMETRÍA de cada dibujo, no el texto):
- **Una sola hoja para owner, staff y artista:** `account-settings.html` («hoja ÚNICA de ajustes de todos los roles»; los paneles de owner —Ajustes de Sistema y Pasarelas & Licencias— solo se montan para owner). El botón CONFIG lleva ahí (`mdjResolveConfigHref`). `staff-config.html` ya solo redirige. **Por construcción comparten los mismos íconos.**
- **Cliente:** hoja aparte, `client-account.html`. Ítems que comparte con el owner: Cuenta/Perfil, Recompensas, Pagos, Notificaciones → los **4 son IDÉNTICOS** a los de `account-settings.html`. Ítem solo de cliente: «Account overview» (grilla de 4 cuadros): se queda solo en cliente.
- **Copia en `dj-dashboard.html`** (panel del artista): 9 ítems; **8 idénticos** a `account-settings.html`; «Agenda / Disponibilidad» difiere solo por un `ry="2"` redundante (se dibuja igual). Tiene «Notificaciones» donde `account-settings` dice «Inbox · Tickets» (misma campana).
- **Pendiente de revisión visual por perfil:** los emojis DENTRO de los paneles (cliente: 🌱 nivel de recompensas, ☎ y ✉ como texto en las fichas de contacto, 📬 estado vacío; owner: ✓ ✅ ⚠ 🟢🔴 🏢🤝👤 …) y todo lo que se pinte en JavaScript según el rol.
