# BITÁCORA DE INCIDENTES / DEUDA TÉCNICA — UI

> Registro de incidentes visuales/UI y su resolución. Dominio #5 (Weather Design Bible / UI).
> La SSOT global sigue siendo `docs/ESTADO_MAESTRO.md` (Dominio #1 / Hilo Maestro).

---

## INCIDENTE UI-0822 — "Paño negro" bajo la barra de menú en la vista Agenda (perfil Owner/Staff)

- **Fecha:** 2026-08-22
- **Reporte del PO:** aparecían franjas negras alrededor del clima en `staff.html?vista=agenda`
  — una arriba (entre el menú y el clima) y una abajo (barra gruesa vacía tras el
  calendario) — más un "efecto avestruz": la barra de controles del calendario
  (Día/Semana/Mes/Año + chips) y/o la franja de métricas del clima quedaban
  encimadas/escondidas al scrollear.
- **Estado:** ✅ **IDENTIFICADO Y MITIGADO** (pendiente confirmación visual del PO + commit — Regla 7).

### Auditoría forense (origen real, ya no es un misterio)

El "paño negro" no era un solo elemento, sino **tres causas de layout distintas**, todas
en el trasplante de la agenda inmersiva; ninguna era un elemento oculto con función
estructural — eran huecos/fondos del contenedor mostrándose:

1. **Franja negra ARRIBA (bajo el menú):** el `padding-top: 16px` de
   `#tab-dashboard > section:first-of-type` en `web/staff-agenda.html` dejaba 16px que
   mostraban el fondo del cuerpo de agenda (`rgb(7,9,14)`). Antes eran 62px.
   → **Fix:** `padding: 0` (clima a ras del menú).

2. **Franja marca/buscador montada sobre el clima:** la banda flotante `.staff-flota`
   (branding + buscador, `position:fixed`, transparente) flotaba sobre el hero y, al
   scrollear, dejaba ver el contenido a través → se leía como paño/encimado.
   → **Fix (decisión PO):** ocultarla SOLO en agenda
   (`body[data-vista="agenda"] .staff-flota{display:none}` en `web/staff.html`).
   Unificar a 1 fila se descartó: 10 pestañas de menú ya ocupan casi todo el ancho y
   desbordaban.

3. **Barra negra gruesa ABAJO + efecto avestruz:** intento previo de dar recorrido de
   scroll (`min-height:100vh` + `padding-bottom` en `#staff-matrix-embed`) creaba un
   vacío inservible; y el iframe del calendario (`calc(100vh-28px)`) scrolleaba por
   dentro escondiendo su barra de controles (Día/Semana/Mes/Año) al subir.
   → **Fix:** iframe del calendario a `calc(100vh - 28px)` (recorrido exacto, sin vacío)
   + calendario con **header fijo** (`.app{height:100vh}`, `.view{overflow-y:auto}`,
   `.toolbar/.ctx/.head/.legend{flex:0 0 auto}`) en
   `web/calendario-operacional-inteligente.html` (autorización puntual del PO) —
   solo la rejilla scrollea, el header (Día/Semana/Mes/Año + chips + título) queda fijo.

### Archivos tocados
- `web/staff.html` — franja oculta + menú esmerilado solo en agenda + clima pegado al menú.
- `web/staff-agenda.html` — padding del paño superior a 0 + altura del iframe de calendario + aire entre tarjetas.
- `web/calendario-operacional-inteligente.html` — header fijo del calendario (autorización puntual UI-0822).

### Ajuste estético adicional (misma ronda)
- La pieza de datos del clima (por horas + 10 días + métricas = `.wx-overlay`) se separó
  en **su propia tarjeta** (fondo, borde dorado tenue, redondeado, aire respecto al hero),
  igual estilo que la tarjeta del calendario. En `web/staff-agenda.html`.

### Causa real del "efecto imán" (scroll no fluido) — hallazgo final

No era `position:sticky` (verificado: cero elementos sticky/fixed en el clima). El imán
era **atrapamiento de scroll anidado**: el iframe del calendario tenía scroll interno
(contenido 862px > alto del iframe), y un intento de "header fijo" (`.view{overflow:auto}`)
lo agravó. El trackpad se "trababa" al pasar del clima al calendario porque el gesto
scrolleaba primero el contenedor interno.

**Fix definitivo:** el iframe del calendario se **auto-ajusta a la altura de su contenido**
(script en `staff-agenda.html` + `.wrap`/`.app` del calendario a altura natural), de modo
que **no tiene scroll interno**. Toda la agenda scrollea como una sola pieza → fluido,
sin imán. Verificado: `internalScrollLeftover: 0` en ambos iframes; un solo scroller.

**Afinado (imán residual):** tras lo anterior quedaba un "pegado" leve en la tarjeta del
medio al bajar — era **jank de repintado por `backdrop-filter: blur`** (Safari recomputa el
desenfoque en cada frame de scroll). Se quitó el blur de la tarjeta de datos del clima y del
menú de agenda (quedan con fondo sólido opaco — mismo efecto anti-sangrado, sin jank).

### Verificación técnica (Hilo #5, en el contenedor real staff.html?vista=agenda)
- Consola: **0 errores**.
- CSS: sin reglas muertas ni duplicadas; comentarios obsoletos corregidos; menú de agenda
  blindado (`!important`) para quedar opaco también en tema día.
- Scroll al fondo (medido): `heroBottomVp:0`, `wxOverlayBottomVp:-16` → **el clima sale 100%**;
  `calToolbarTopVp:28` → **barra del calendario visible bajo el menú**.
- **Efecto imán:** `stickyInWeather:[]` → ningún elemento del clima es `sticky`/`fixed`.
  Header del calendario fijo (solo la rejilla scrollea) → nada se pega al subir/bajar.

### Acción pendiente
- **Auditoría visual del PO** (scroll suave arriba/abajo, sin imán, sin paños negros) → si pasa,
  **se autoriza commit local**.
- Confirmar en más anchos de pantalla (portátil primero, prioridad de pantallas del PO).
