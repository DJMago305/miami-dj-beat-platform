# TICKET: Nav CLS — Movimiento + posición inconsistente del nav en páginas internas
**Estado:** 🔴 ABIERTO — AMPLIADO 2026-06-22  
**Fecha inicio:** 2026-06-21  
**Última actualización:** 2026-06-22 12:46 AM UTC-4  
**Prioridad:** 🚨 CRÍTICA — **BLOQUEANTE DE DEPLOY A PRODUCCIÓN**  
**Declarado por el Capitán:** "necesitamos estabilizar las pestañas antes de poder aprobar el despliegue a PR"  
**Archivos en scope:** `web/mdj-shared-header.js`, `web/header-unified.css`, `web/contact.html`, `web/mdj-mainnav-infinite.js`, `web/events.html`, `web/rentals.html`, `web/jobs.html`

> ⛔ **NINGÚN MERGE A MAIN / DEPLOY A PRODUCCIÓN** hasta que las tres capas de este ticket estén resueltas y aprobadas visualmente por el Capitán.

---

## SÍNTOMA

En `contact.html` con sesión de **cliente** (ej. Wendy), la barra de navegación hace un movimiento visible al cargar la página. El tab de **CONTACTO** (activo en esa página) no mantiene su posición — se desplaza durante el auth resolve.

Con sesión de **owner/staff** el nav queda fijo — sin movimiento.

---

## ROOT CAUSE CONFIRMADO

El movimiento **no es un problema de CSS estático** (eso ya fue atacado con anti-brinco / phantom slots / flex-start). Es un problema de **JS auth resolution** que dispara múltiples cambios de DOM en secuencia rápida:

```
onAuthStateChange / getSession resuelve →
  mdjApplyStaffMainNavLink()        ← cambia clases en #mainNav-config-link
  mdjApplyBuyerSessionMainNav()     ← puede mover elementos en el DOM
  mdjApplyHeaderAuthPillSession()   ← cambia pill de sesión
  mdjNormalizePublicHomeMainNav()   ← reposiciona items (solo home, pero aplica en guard)
  mdjEnsureMiPortalInMainNav()      ← puede mover #mainNav-mi-portal-link en el DOM
  i18n hydration                    ← puede cambiar texto de pestañas
```

Cada función dispara un **layout recalculation** + **repaint**. El browser los pinta en secuencia → movimiento visible (~100-300ms de inestabilidad).

El contact page lo hace **peor** que otras páginas porque:
1. `position: fixed` en el header → cualquier repintado es visible en el centro del viewport
2. La página tiene poco contenido propio → el nav es lo más visible al cargar
3. Para el cliente, MI PORTAL y CONFIG cambian de estado (display:none → visible) durante ese window

---

## POR QUÉ EL OWNER NO TIENE ESTE PROBLEMA

El owner nav en páginas compactas (Jobs/Shop/Rentals) funciona porque:
1. `data-mdj-compact-nav="1"` → anti-brinco ya reserva espacio para CONFIG y MI PORTAL desde frame 0
2. Solo cambia `visibility` → no hay layout recalc → cero movimiento
3. `mdj-staff-nav` + `flex-start` → INICIO siempre anclado

El cliente en Contact **no tiene** `data-mdj-compact-nav="1"` → CONFIG y MI PORTAL nacen en `display:none` → al activarse causan layout shift.

---

## AVANCES YA APLICADOS (commits anteriores)

| Fix | Estado |
|---|---|
| `flex-start` para contact page (previene desplazamiento de INICIO) | ✅ Aplicado en `contact.html` |
| Anti-brinco para `page-mdj-contact` en `header-unified.css` | ❌ Intentado — no resolvió el movimiento del JS |
| `overflow-x: clip/visible` en contact nav | ❌ Revirtió — causa recorte de MI PORTAL |

---

## ESTRATEGIA PROPUESTA (próxima sesión)

### Opción A — "Freeze nav during auth" (recomendada)
Usar la clase `body.mdj-nav-booting` (ya existe en `mdj-shared-header.js` línea 45) para:

```css
/* Durante boot de auth: nav invisible — sin movimiento visible */
body.mdj-nav-booting #mainHeader .header-nav {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
body:not(.mdj-nav-booting) #mainHeader .header-nav {
  opacity: 1;
  transition: opacity 0.15s ease;
}
```

El JS ya agrega `mdj-nav-booting` al iniciar — solo falta quitarla al FINALIZAR auth resolve (después de todos los cambios de DOM).

**Riesgo:** Requiere verificar exactamente en qué punto del JS se puede quitar `mdj-nav-booting` para todos los flows (staff, cliente, guest, artist).

### Opción B — Audit de JS en contact.html con sesión cliente
Usar DevTools → Performance → grabar el load → identificar exactamente qué funciones de `mdj-shared-header.js` corren en el contact page con sesión cliente y cuántos layout recalcs disparan. Eliminar recalcs innecesarios.

### Opción C — Añadir contact page a data-mdj-compact-nav
Dar a `contact.html` el mismo tratamiento que páginas compactas (Jobs/Shop). Requiere:
1. Agregar `data-mdj-compact-nav="1"` al `#mainNav` en contact.html
2. Verificar que el CSS de compact nav funcione correctamente para contact

---

## PASOS PARA PRÓXIMA SESIÓN

```
PASO 1 — Diagnóstico JS con DevTools
→ Abrir contact.html con sesión de Wendy
→ DevTools → Performance → Record → Reload
→ Identificar qué funciones JS tocan el nav y cuándo

PASO 2 — Verificar body.mdj-nav-booting
→ Confirmar en mdj-shared-header.js línea 45 que se agrega al inicio
→ Confirmar en qué línea se QUITA (o si no se quita — ese es el bug)
→ Si no se quita: agregar la remoción al final del auth flow

PASO 3 — Aplicar Opción A o B según el diagnóstico

PASO 4 — Test: contact.html con sesión cliente → nav debe quedar fijo
```

---

## ARCHIVOS EN SCOPE

| Archivo | Sección | Cambio requerido |
|---|---|---|
| `web/mdj-shared-header.js` | Auth flow `onAuthStateChange` | Quitar `mdj-nav-booting` al final de auth resolve |
| `web/header-unified.css` | Nuevo bloque | `body.mdj-nav-booting .header-nav { opacity:0 }` |
| `web/contact.html` | Nav `#mainNav` | Posible: agregar `data-mdj-compact-nav="1"` |
| `web/mdj-mainnav-infinite.js` | `shouldSkipMainNavInfinite()` | Añadir skip para páginas internas |

---

## AMPLIACIÓN — 2026-06-22 (Notarización sesión nocturna)

### Nuevos síntomas confirmados visualmente

**Problema 1 — Carousel activo en páginas internas (TODOS los tipos de sesión)**

Los phantom slots anti-CLS (`#mainNav-config-link` + `#mainNav-mi-portal-link`) reservan ~235px de espacio invisible en el nav. Esto infla el `scrollWidth` del nav por encima del `clientWidth` del contenedor → `mdj-mainnav-infinite.js` detecta overflow → inicializa el carousel → clona el DOM → activa drift (`scrollLeft += 0.32` por animation frame) → **movimiento lateral continuo visible**.

Páginas afectadas confirmadas: `contact.html`, `events.html`, `rentals.html` (services), `jobs.html`.

La función clave: `startDriftIfAllowed()` salta el home (`if (isPageHome()) return`) pero NO las páginas internas. Para staff/owner, drift corre sin restricción.

**Problema 2 — Posición X de CONTACTO inconsistente entre sesiones**

Con `justify-content: flex-start`, la posición horizontal de CONTACTO depende del número de ítems visibles antes de él:

| Sesión | Ítems visibles antes de CONTACTO | Posición X de CONTACTO |
|---|---|---|
| Guest | 5 (Inicio, Servicios, Eventos, Shop, Trabajos) | ~X₁ |
| Cliente (Wendy) | 7 (+ CONFIG visible + MI PORTAL visible) | ~X₂ (más a la derecha) |
| Owner | 6 (CONFIG oculto, Trabajos + extras JS) | ~X₃ (diferente) |

El tab de CONTACTO **no tiene posición fija** — cambia según quién esté logueado. Las pestañas no coinciden en el mismo paralelo vertical y horizontal entre sesiones.

### Intentos aplicados en sesión 2026-06-22 (NINGUNO APROBADO)

| Intento | Archivo | Acción | Resultado |
|---|---|---|---|
| 1 | `header-unified.css` | Remover staff `flex-start` override para jobs/shop/rentals/events | Sin resultados visuales |
| 2 | `contact.html` | `overflow-x: clip → visible` | Sin resultados visuales |
| 3 | `mdj-mainnav-infinite.js` | Skip carousel pages internas (sin contact) | Sin resultados visuales |
| 4 | `contact.html` | Reorden DOM nav (CONFIG al final) | **VIOLACIÓN DE CONTRATO — revertido** |
| 5 | `mdj-mainnav-infinite.js` | Añadir `page-mdj-contact` al skip list | Sin resultados visuales (versión JS cacheada) |
| 6 | Todos | Actualizar version tags JS/CSS | Sin resultados — no aprobado |

### Estado del disco al cierre (cambios no aprobados presentes)

```bash
# Para revertir todo al último commit aprobado:
git checkout HEAD -- web/contact.html web/header-unified.css web/mdj-mainnav-infinite.js web/events.html web/rentals.html
```

### Solución arquitectural requerida — decisión del Capitán + Arquitecto

El problema tiene dos capas independientes que requieren solución coordinada:

**Capa 1 — Carousel en páginas internas**  
→ `shouldSkipMainNavInfinite()` debe retornar `true` para contact/events/jobs/rentals/shop  
→ Los phantom slots no deben inflar `scrollWidth` → requiere que estén en `display:none` (sin espacio) durante el boot

**Capa 2 — Posición X inconsistente de CONTACTO**  
→ Requiere que el número de ítems visibles antes de CONTACTO sea CONSTANTE para todos los tipos de sesión  
→ Solución: `justify-content: center` + todos los phantom slots siempre reservando el mismo espacio (guest ve los mismos "huecos" que cliente/owner pero centrados → menos notorios)  
→ O: freeze nav durante boot (`opacity:0`) → auth resuelve → nav aparece en estado final → sin shifts visibles

**Sin decisión explícita del Capitán, este ticket permanece BLOQUEADO.**

---

## CAPA ADICIONAL — Perfil Artista (notarizado 2026-06-22)

El nav desde cuentas de **artista** tiene correcciones pendientes **diferentes** a las de cliente y owner/staff. No se han especificado los síntomas exactos — requiere sesión dedicada con el Capitán para describir el comportamiento esperado vs el actual.

**Contexto arquitectural conocido:**
- El artista usa el sistema `mdj_nav=profile` (nav dual: site nav vs artist strip `#owner-tabs`)
- Las páginas satélite con `mdj_nav=profile` ocultan `#mainHeader .header-nav` e inyectan `#owner-tabs` vía `web/mdj-profile-nav-context.js`
- El comportamiento del nav para artista es independiente del nav para cliente y owner en páginas públicas

**Estado:** ⏳ NOTARIZADO — Pendiente descripción de síntomas por el Capitán (2026-06-22 12:45 AM UTC-4).  
**Acción requerida:** El Capitán debe especificar qué páginas y qué comportamiento incorrecto observa desde la cuenta artista antes de que el Arquitecto pueda diseñar la corrección. Sin esa descripción, esta capa no se toca.
