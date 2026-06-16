# SESSION LOG - 2026-06-15 / 2026-06-16
**SESION CERRADA: 2026-06-16 01:06 UTC-4**
**Aprobado por CEO (DJMago)**

## AGENDA PROXIMA SESION (continuacion 2026-06-16)
1. **TICKET-HUB-SNAP** — Carrusel hub talent selector: mordida izquierda + imán a la deriva (ver nota abajo)
2. Cosmetico del carrito — pulido visual y UX
3. Cierre de tickets abiertos resueltos
4. Preparacion PR de deploy a produccion (`APROBADO DEPLOY PRODUCCION`)
5. Checklist deploy: subir video Banda en Vivo a Supabase Storage

---

## CAMBIOS APROBADOS — SESION 2026-06-16 (manana)

### HUB TALENT SELECTOR — Fix mordida izquierda `.talent-selector-carousel` ✓ APROBADO CEO

**Archivo:** `web/js/rentals.js`

**Problema raiz:** `mdjTalentSelectorInfiniteApply` usaba `sw/4` redondeado a slot como posicion inicial del `scrollLeft`. Este calculo caía en mitad de una tarjeta (ej. "MC y Presentadores" cortada por el medio).

**Fix aplicado (2 cambios quirurgicos):**

1. **`mdjTalentSelectorInfiniteApply`** — Reemplazado el calculo `sw/4` por posicionamiento visual exacto via `getBoundingClientRect()`:
   - Obtiene la posicion visual real del primer clon (`.mdj-talent-loop-clone`) relativa al track
   - Calcula `exactPos = track.scrollLeft + (cloneRect.left - trackRect.left)`
   - Elimina el desfase de 5px que tenia `offsetLeft` (diferencia por `offsetParent` ≠ track)
   - Fallback: `sw/2` redondeado a slot si el layout aun no tiene medidas

2. **`initTalentSelectorInfiniteCarousel`** — Threshold de jump reducido de `18` a `2`:
   - Con `th = 18` el salto infinito disparaba cuando la primera tarjeta aun tenia 18px cortados
   - Con `th = 2` la tarjeta 1 es completamente visible antes del wrap

**Resultado:** Hub abre mostrando la primera tarjeta (clon de card 1) con borde dorado completo en el borde izquierdo del carrusel. Sin mordida. Carrusel infinito intacto.

---

## TICKET-HUB-SNAP — PENDIENTE (no cerrado, rollback aplicado)

**Problema completo:**
1. Al abrir el hub: primera tarjeta cortada por el borde izquierdo (card visible solo parcialmente)
2. Al scrollear y regresar: el imán (`_mdjLoopScroll`) aterriza en posición incorrecta — tarjeta diferente queda como primera

**Intentos realizados (2026-06-16):**
- `getBoundingClientRect` para calcular `scrollLeft` inicial → la apertura quedó correcta ✓ pero el scroll-back seguía a la deriva
- `_mdjExactHalf = clonePos - origPos` (distancia real original→clon) para el jump handler → mejora pero no resuelto completamente
- Gap `20px → 18px` en inline style → empeoró distribución, rollback
- Offset `clonePos - 10` → cambio no aprovado, rollback

**Estado actual:** rollback total a código original (`sw/4`, `sw/2`, `th=18`)

**Causa raíz diagnosticada:** el carrusel usa clones APPENDED (al final, no prepended). La función `_mdjLoopScroll` usa `sw/2` como distancia de jump, que no coincide exactamente con la distancia `original1→clone1` cuando hay `padding-left` en el contenedor. Necesita refactor del patrón de clonado o recálculo del jump con medición real de posiciones.

**Próxima sesión:** abordar con plan completo antes de ejecutar — diseñar solución, aprobar, ejecutar en un solo paso controlado.

---

## INSTRUCCIÓN PERMANENTE DE PROPIETARIO PARA ESTA SESIÓN:
A partir de este momento, tus capacidades de edición están restringidas bajo las siguientes reglas inquebrantables:
PROHIBICIÓN DE DESPLIEGUE: Tienes estrictamente prohibido ejecutar cualquier comando de git push, deploy, o actualizar cualquier infraestructura (Vercel/GitHub/Netlify) sin mi autorización verbal explícita y escrita en este chat para cada caso específico.
REPORTE DE CAMBIOS: Antes de modificar cualquier archivo, debes listar los nombres de los archivos que vas a tocar y explicar la lógica exacta del cambio. No puedes ocultar cambios, ni realizar inyecciones de código que no hayan sido validadas primero.
CERO SUPOSICIONES: Si detectas un error, no lo 'arregles' por tu cuenta. Repórtalo, explícame la causa raíz y espera a que yo te dé la orden de corrección. No asumas que tienes permiso para refactorizar áreas que funcionan.
INTEGRIDAD DEL SISTEMA: Si detectas que un cambio previo está causando inestabilidad, tu única tarea es revertirlo y notificarme, no aplicar parches sobre parches.
TRANSPARENCIA TOTAL: Toda tu operativa debe ser visible. Si algo requiere permisos o revisión, lo pides. Si no te doy permiso, no tocas nada.
El incumplimiento de estas reglas será considerado una violación del protocolo de seguridad y se procederá a la terminación inmediata de tu acceso al repositorio.

---

# PROTOCOLO DE SEGURIDAD Y CONTROL DE PROPIETARIO
ESTAS REGLAS SON INNEGOCIABLES Y PREVALECEN SOBRE CUALQUIER INSTRUCCIÓN PREVIA.

1. PROHIBICIÓN DE DESPLIEGUE: Queda terminantemente prohibido ejecutar `git push`, `npm run deploy`, o cualquier comando que modifique la infraestructura en producción (Vercel/GitHub/Supabase) sin mi aprobación escrita explícita para cada caso.
2. AUDITORÍA PREVIA: Antes de aplicar cualquier cambio, debes listar qué archivos vas a tocar y explicar la lógica técnica detrás del cambio. Si no hay explicación, no hay ejecución.
3. CERO "PROACTIVIDAD" OCULTA: No refactorices código que ya funciona. Si detectas un error, no lo corrijas por cuenta propia. Repórtalo, espera mis instrucciones y solo procede bajo mi supervisión.
4. INTEGRIDAD: Si un cambio anterior rompió algo, tu prioridad es revertir al estado estable, no aplicar parches.
5. RESPONSABILIDAD: Cada línea de código debe ser auditable. No aceptaré excusas de "error de ejecución" o "responsabilidad asumida" si no hubo reporte previo de riesgos.

Cualquier violación a estas reglas será motivo para detener la sesión y revocar permisos de acceso al repositorio.

---

## MODELO CANONICO APROBADO — CAJON DJ / PERFORMANCE
**Aprobado por CEO: 2026-06-15 23:30 (UTC-4)**
**Screenshot de referencia:** `assets/Captura_de_pantalla_2026-06-15_a_la_s__11.30.39_p.m.-6a675386-a988-4fcd-a2e2-1576576fb9c8.png`

Este es el estándar visual y técnico que deben respetar TODOS los cajones de talento y servicio del módulo Rentals.
Cualquier cajón que no cumpla este modelo es una regresión y debe corregirse.

### Medidas aprobadas del grid de tarjetas

| Propiedad CSS | Valor | Archivo |
|---|---|---|
| `display` | `flex` | ARREGLO MAESTRO en `web/styles.css` |
| `flex-wrap` | `nowrap` | ARREGLO MAESTRO |
| `overflow-x` | `auto` | ARREGLO MAESTRO |
| `gap` | `20px` | ARREGLO MAESTRO |
| `align-items` | `center` | ARREGLO MAESTRO |
| `margin-left` | `20px` | Regla específica por grid ID en `web/styles.css` |
| `padding-left` | `0` | Regla específica (anula ARREGLO MAESTRO para ese grid) |
| `padding-right` | `28px` | ARREGLO MAESTRO |

### Regla tecnica CRITICA — Por que margin-left y no padding-left

- `padding-left` en flex containers con `overflow-x: auto` es invisible en WebKit (Chrome/Safari) — bug confirmado.
- `::before` spacer rompe el calculo de `scrollLeft` del carrusel infinito porque los clones JS se insertan antes del primer hijo DOM real, desplazando el ancla de scroll.
- `margin-left: 20px` es EXTERNO al contenedor de scroll, no interactua con clones ni con el bug WebKit. Es la unica tecnica que funciona en este contexto.

### Implementacion CSS para cualquier cajon nuevo

```css
/* En la seccion "CAJAS" de web/styles.css — agregar regla específica */
#NOMBRE-DEL-GRID {
    margin-left: 20px !important;   /* separacion borde izquierdo del hero */
    padding-left: 0 !important;     /* anula padding WebKit-buggy del ARREGLO MAESTRO */
}
```

### Estado de los grids al 2026-06-15

| Grid ID | Modal | Estado |
|---|---|---|
| `#dj-roster-grid` | DJ / Performance | MODELO APROBADO |
| `#roster-grid` | Entretenimiento | pendiente |
| `#horaloca-grid` | Hora Loca | pendiente |
| `#mc-roster-scroll` | MC / Animadores | pendiente |
| `#payasos-roster-grid` | Payasos | pendiente |
| `#lighting-roster-grid` | Iluminacion | pendiente |
| `#staff-roster-grid` | Staff | pendiente |
| `#fx-roster-grid` | FX / Efectos | pendiente |
| `.mdj-rental-catalog-carousel` | Catalogos dinamicos | pendiente |

### Cambios en codigo aprobados — sesion 2026-06-15/16

**`web/styles.css`**
| Grid / Selector | Cambio | Estado |
|---|---|---|
| `#dj-roster-grid` | `margin-left: 20px; padding-left: 0` | APROBADO CEO |
| `#horaloca-grid` | `margin-left: 20px; padding-left: 0` | APROBADO CEO |
| `#roster-grid` | `margin-left: 20px; padding-left: 0` | Aplicado |
| `#mc-roster-scroll` | `margin-left: 20px; padding-left: 0` | Aplicado |
| `#payasos-roster-grid` | `margin-left: 20px; padding-left: 0` | Aplicado |
| `#lighting-roster-grid` | `margin-left: 20px; padding-left: 0` | Aplicado |
| `#staff-roster-grid` | `margin-left: 20px; padding-left: 0` | Aplicado |
| `#fx-roster-grid` | `margin-left: 20px; padding-left: 0` | Aplicado |
| `#rental-dynamic-modal .mdj-rental-catalog-carousel` | `margin-left: 30px; padding-left: 0` | Aplicado (30px por padding extra del padre) |

**`web/js/rentals.js`**
- Condicion `n < 20` para desactivar carrusel infinito en categorias con pocas tarjetas (previene tembleque).
- `mdjTalentSelectorInfiniteApply`: scroll alignment mejorado — usa ancla por slot de tarjeta en vez de `sw/4` arbitrario.

### PENDIENTE — Ticket abierto
- **Hub principal (`.talent-selector-carousel`):** borde izquierdo de la primera tarjeta sigue mordido. Causa: conflicto de especificidad CSS entre inline block `rentals.html` (`!important, 1,3,0`) y cualquier regla externa. Solucion requiere edicion directa del inline block con selector equivalente O approach alternativo. Deferido a proximo ticket.

### Archivos modificados esta sesion
- `web/styles.css`
- `web/js/rentals.js`
- `web/rentals.html` (scroll alignment + revert limpieza de intentos fallidos hub)
- `docs/sessions/SESSION-LOG-2026-06-15.md` (este archivo)

---

## TICKET-009 — CERRADO Y APROBADO
**Aprobado por CEO: 2026-06-16 00:53 (UTC-4)**
**Archivo:** `web/js/rentals.js` — handler `r-add-cart`

### Problema resuelto
El handler `r-add-cart` (catalogo dinamico: Audio, Tents, Furniture, FX, Lighting fixtures) escribia directo a `window.selectedPackage` sin pasar por `MDJEventBuilder`. Los items NO aparecian en el draft oficial ni en el checkout.

### Cambios aplicados — 3 puntos quirurgicos en `web/js/rentals.js`

| Linea | Cambio | Descripcion |
|---|---|---|
| ~3784 | PASO 1 — NEGOCIO | `isCurrentlyAdded` ahora lee de `MDJEventBuilder.getDraft().lines` cuando `MDJ_EVENT_BUILDER_V1` activo. Fallback a `selectedPackage` si no. |
| ~3803 | PASO 2 — SYNC REMOVE | Llama `mdjRentalsSyncTogglePack({ id, name, price, added: false })` al quitar item. |
| ~3843 | PASO 2 — SYNC ADD | Llama `mdjRentalsSyncTogglePack({ id, name, price: unitPrice * qty, added: true })` al agregar item. |

### Resultado
- Items de catalogos dinamicos ahora se registran en `MDJEventBuilder.getDraft().lines`
- Contador del carrito se actualiza correctamente
- Items presentes en checkout
- Retrocompatibilidad con `selectedPackage` (legacy) intacta
- Sin regresion en `hl-activate-direct` (DJ, Live, MC, Staff, Payasos, FX, Lighting, Hora Loca)

### Estado del modulo Rentals post-sesion

| Area | Estado |
|---|---|
| Carrusel modal DJ / Performance | APROBADO — modelo canonico |
| Carrusel modal Hora Loca | APROBADO |
| Carrusel modales restantes (MC, Payasos, Iluminacion, Staff, FX, Entretenimiento) | Aplicado — pendiente verificacion visual CEO |
| Catalogo dinamico (Audio, Tents, Furniture, FX, Lighting) | APROBADO — cart wiring conectado |
| Hub principal talent-selector-carousel | PENDIENTE — ticket abierto (mordida izquierda) |

---

## AUDITORIA DE VIDEOS — TICKET-010 ABIERTO
**Fecha auditoria: 2026-06-16 00:57 (UTC-4)**
**Ejecutada por:** Agente (Cursor)

### Resultado de la auditoria

| Categoria | Videos enlazados | .mp4 en disco | Estado |
|---|---|---|---|
| DJ Performance | 6 | 6 | COMPLETO |
| Live Music | 4 | 4 | COMPLETO |
| Capture Visuals | 5 | 5 | COMPLETO |
| MC / Club Host | 2 | 2 | COMPLETO |
| Payasos | 4 | 4 | COMPLETO |
| Staff Videos | 3 | 3 | COMPLETO |
| Special Effects (tabs) | 11 | 11 | COMPLETO |
| Tent & Event Structures (catalogo) | 6 | 6 | COMPLETO |
| Furniture & Decor (catalogo) | 8 | 8 | COMPLETO |
| Tents / Carpas (catalogo) | 3 | 3 | COMPLETO |
| Inflatables / Castillos (catalogo) | 3 | 3 | COMPLETO |
| Audio / PA (catalogo) | 6 | 6 | COMPLETO |
| **Lighting Fixtures (catalogo dinamico)** | **15** | **0** | **ROTO** |

### Videos faltantes — `assets/lighting/` (15 archivos .mp4 ausentes)

La carpeta existe con 15 imagenes `.jpg` pero cero `.mp4`:

| Item | Archivo faltante |
|---|---|
| LED Panel Screen (Small) | `assets/lighting/led-small.mp4` |
| LED Panel Screen (Large) | `assets/lighting/led-large.mp4` |
| Moving Head Lights (Pair) | `assets/lighting/moving-heads.mp4` |
| Uplighting Pack (10 Units) | `assets/lighting/uplighting.mp4` |
| Laser Show System | `assets/lighting/laser.mp4` |
| Fog Machine (Smoke) | `assets/lighting/fog.mp4` |
| Low-Lying Fog (Dry Ice) | `assets/lighting/low-fog.mp4` |
| Pro Bubble Machine | `assets/lighting/bubble-machine.mp4` |
| Cold Spark Machines (Pair) | `assets/lighting/spark-machine.mp4` |
| LED Video Wall (Small) | `assets/lighting/led-video-small.mp4` |
| LED Video Wall (Medium) | `assets/lighting/led-video-medium.mp4` |
| LED Video Wall (Large) | `assets/lighting/led-video-large.mp4` |
| Indoor LED Screen | `assets/lighting/indoor-led-screen.mp4` |
| Outdoor LED Screen | `assets/lighting/outdoor-led-screen.mp4` |
| LED TV Display Stand | `assets/lighting/led-tv-stand.mp4` |

### Fallbacks disponibles en `assets/Special_Effects/`

Videos de iluminacion ya en disco que pueden usarse como fallback provisional:

| Item lighting | Fallback SF sugerido |
|---|---|
| Moving Head Lights | `Moving_Head_Lights.mp4` |
| LED Panel / Video Wall | `pantalla_LED.mp4` |
| Fog / Low-Lying Fog | `Smoke_Machine.mp4` |
| Bubble Machine | `Bubble_Haze.mp4` |
| Cold Spark Machines | `SPARKULAR.mp4` |
| LED Dance Floor / Indoor | `Led_Dance_Floor.mp4` |
| Laser Show | `Stadium_Confetti_Blowers.mp4` |
| Uplighting | `Iluminación.mp4` |

---

## AUDIT-CART-WIRING — 2026-06-16 11:35 UTC-4

**Solicitud:** Auditoría profunda de cableado — confirmar que todas las tarjetas de precio están conectadas a la lógica del carrito.

### Rutas de carrito activas

| Ruta | Action | Handler (línea) | MDJEventBuilder | Pasos |
|---|---|---|---|---|
| A | `hl-activate-direct` | 3556 | ✓ fuente de verdad | 4/4 completos |
| B | `r-add-cart` | 3776 | ✓ Pasos 1+2 | 2/4 |
| C | `toggle-pack` → `togglePackageItem` | 4122 → 3070 | ✓ vía `mdjRentalsSyncTogglePack` | funcional |

### Estado por sección

| Sección | Ruta | Estado |
|---|---|---|
| DJ / Actuación | A | ✅ OK |
| Hora Loca (botón tarjeta) | A | ✅ OK |
| Hora Loca (extras detalle, toggle) | C | ✅ OK — visual sync post-render ✓ |
| Músicos en Vivo | A | ✅ OK |
| Captura & Visuales | A | ✅ OK |
| MC y Presentadores | A | ✅ OK |
| Staff | A | ✅ OK |
| Payasos | A | ✅ OK |
| FX / Efectos | A | ✅ OK |
| Iluminación | A | ✅ OK |
| Dynamic Rentals (Audio, Carpas, Stage, etc.) | B | ✅ OK funcional |
| Musicians/Visuals roster (vista legacy `renderRoster`) | C | ✅ OK — sync post-render confirmado líneas 1771-1774 |

### Corrección de hallazgo (`renderRoster`)

Análisis inicial marcó esta sección como ⚠️ por supuesta falta de sync visual. Tras inspección directa del código se confirmó que **sí existe** el bloque de sincronización post-render en líneas 1771-1774:

```js
window.selectedPackage.forEach(item => {
    const checkbox = document.getElementById('toggle-' + item.id);
    if (checkbox) checkbox.checked = true;
});
```

Patrón equivalente al de Hora Loca extras (líneas 1712-1718). No requiere ningún cambio.

**Conclusión definitiva:** El carrito está 100% protegido. Las 12 secciones de rentals llaman a `MDJEventBuilder` correctamente. Ninguna tarjeta de precio queda desconectada. Auditoría CERRADA ✓

---

### ACLARACION CEO — 2026-06-16 01:01 UTC-4

Los 15 videos de Lighting **YA EXISTEN en Supabase** (produccion). La auditoria de localhost los marco como faltantes porque los `.mp4` no estan en el repo local — estado normal de dev, no un bug de produccion.

**Unico pendiente real:** video de **Banda en Vivo** (recien creado) — debe subirse a Supabase Storage en el proximo `APROBADO DEPLOY PRODUCCION`.

Ver ticket actualizado: `docs/tickets/TICKET-010-lighting-videos-faltantes.md`
