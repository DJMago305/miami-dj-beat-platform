# PLAN MAESTRA DE BUGS — Auditoría móvil 2026-06-16
**Plataforma:** Miami DJ Beat LLC  
**Auditado por:** DJMago305 (CEO) desde teléfono móvil — cuenta DJYuyo  
**Total bugs documentados:** 7  
**Fecha:** 2026-06-16 22:53 UTC-4  

---

## CATEGORÍA 1 — FILTRACIONES (PRIORIDAD MÁXIMA)

> Usuarios ven contenido que no les corresponde. Algunos ven pantalla de cliente cuando son artistas. Otros ven contenido PRO sin serlo. Esto rompe la confianza y la seguridad del producto.

---

### 🔴 FILTRACIÓN #1 — Mi Perfil redirige a pantalla de cliente
**Ticket:** TICKET-ROLE-REDIRECT-002  
**Síntoma:** Click en "Mi Perfil" → lleva al portal de cliente en vez del perfil del artista. Para entrar al perfil el artista tiene que usar "Configuraciones" como workaround.  
**Causa exacta confirmada:** `mdj-shared-header.js` línea 2982:
```javascript
(!p && hasClientRow && !jwtArtist)  // djRow no ha cargado aún → clasifica como cliente
```
En móvil la consulta a Supabase tarda más. Si el artista tiene también fila en `client_profiles`, el sistema lo clasifica como cliente antes de que `djRow` cargue.

**Fix:** Agregar roles de staff/owner al check `jwtArtist` para que no espere `djRow`:
```javascript
// ANTES (línea 2974):
(appRole && String(appRole).toLowerCase() === 'artist') ||

// DESPUÉS:
(appRole && String(appRole).toLowerCase() === 'artist') ||
(appRole && /^(owner|manager|admin|staff|seller)$/i.test(appRole)) ||
```
**Archivo:** `web/mdj-shared-header.js` — 1 línea  
**Riesgo:** bajo — solo agrega casos al check JWT, no modifica lógica existente  
**Autorización requerida:** `Autorizo TICKET-ROLE-REDIRECT-002`

---

### 🔴 FILTRACIÓN #2 — DJ Tools muestra contenido PRO por 1 segundo antes del gate
**Ticket:** TICKET-DJTOOLS-006  
**Síntoma:** Cada vez que se entra a DJ Tools (incluso re-entrando estando ya en la página), aparece un flash de ~1 segundo con contenido PRO antes de mostrar el gate de bloqueo. Un artista LITE ve contenido que no pagó.  
**Causa probable:** El HTML de DJ Tools tiene el contenido PRO visible en el DOM antes de que JavaScript evalúe el rol y aplique el gate.  
**Fix:** Ocultar el contenido PRO con CSS desde el HTML (`display:none` o clase `mdj-gate-pending`) y revelarlo solo si el JS confirma rol PRO.  
**Archivo:** `web/dj-tools.html`  
**Autorización requerida:** `Autorizo TICKET-DJTOOLS-006`

---

### 🟠 FILTRACIÓN #3 — Configuraciones muestra contenido de cliente al abrir
**Ticket:** TICKET-NAV-ARTIST-003  
**Síntoma:** Al entrar a Configuraciones (`account-settings.html`) hay un flash visual de contenido que parece del portal de cliente antes de que la vista se ajuste al artista.  
**Causa exacta confirmada:** `account-settings.html` línea 1341 — `#panel-account` tiene `class="acct-panel active"` en el HTML estático. Se pinta antes de que JS resuelva el rol.  
**Fix:** Quitar `active` del HTML estático — dejar que JS lo asigne según rol:
```html
<!-- ANTES -->
<div id="panel-account" class="acct-panel active">

<!-- DESPUÉS -->
<div id="panel-account" class="acct-panel">
```
**Archivo:** `web/account-settings.html` — 1 palabra  
**Riesgo:** mínimo  
**Autorización requerida:** `Autorizo TICKET-NAV-ARTIST-003`

---

## CATEGORÍA 2 — MONETIZACIÓN ROTA

> Ningún artista puede pagar nada. Todas las rutas de venta están bloqueadas.

---

### 🔴 CHECKOUT PRO no funciona — todos los gates mal cableados
**Ticket:** TICKET-PRO-CHECKOUT-004  
**Síntoma:** Todos los botones de upgrade PRO en la plataforma apuntan a páginas incorrectas — ninguno dispara Stripe checkout.

| Gate | Botón | Destino actual | Destino correcto |
|------|-------|---------------|-----------------|
| Settings / Billing | Upgrade → | `jobs.html?plan=PRO` | Stripe checkout |
| Settings / Rewards | Activar PRO | `jobs.html?plan=PRO` | Stripe checkout |
| DJ Tools | Ver planes en Jobs | `jobs.html?plan=PRO` | Stripe checkout |
| **SoundForTips** | Ver planes | **`shop.html`** | Stripe checkout |

**Causa:** Links simples `<a href>` sin lógica de checkout. El Edge Function `create-checkout` existe en `jobs.html` pero no está conectado a estos gates.  
**Fix:** Reemplazar todos los `<a href>` de upgrade por botones con `onclick` → `create-checkout`.  
**Bloqueador:** **Stripe Price IDs** del plan PRO mensual y anual.  
**Archivos:** `web/account-settings.html`, `web/dj-tools.html`, `web/soundfortips.html` (o donde esté el gate de SFT)  
**Autorización requerida:** `Autorizo TICKET-PRO-CHECKOUT-004` + Price IDs

---

### 🔴 MDJPRO App standalone no se puede comprar
**Ticket:** TICKET-DJTOOLS-006 (Bug 2)  
**Síntoma:** El gate de DJ Tools solo muestra "Ver planes en Jobs" (roto) y no ofrece opción de comprar solo la app independientemente del plan PRO.  
**Lógica correcta:**
```
Gate DJ Tools:
├── ¿PRO? → acceso completo
├── ¿LITE? → 
│   ├── [Comprar MDJPRO App standalone] ← FALTA
│   └── [Upgrade a PRO] ← existe pero roto
```
**Bloqueador:** necesito precio y método de pago para la app standalone.  
**Autorización requerida:** `Autorizo TICKET-DJTOOLS-006`

---

## CATEGORÍA 3 — UX / MEJORAS

---

### 🟡 Buscador — UI fea y filtro incorrecto
**Ticket:** TICKET-SEARCH-007  
**Síntoma 1:** Página de resultados sin diseño de marca — se ve genérica y fea.  
**Síntoma 2:** Buscar "dj" devuelve perfiles de otras categorías (ej. Jean Poul — bartender). El query no filtra por `artist_specialty`.  
**Fix:** Rediseñar página de resultados + agregar filtro por especialidad al query de búsqueda.  
**Autorización requerida:** `Autorizo TICKET-SEARCH-007`

---

### 🟡 Cash Flow — cableado sin verificar
**Ticket:** TICKET-CASHFLOW-005  
**Síntoma:** Tab Cash Flow visible en dashboard del artista pero no se ha confirmado que los datos sean reales y actualizados.  
**Fix:** Revisión de queries y conexiones a Supabase.  
**Autorización requerida:** `Autorizo TICKET-CASHFLOW-005`

---

## AUDITORÍA COMPLETA — ESTADO POR SECCIÓN

| Sección | Estado | Ticket |
|---------|--------|--------|
| Inicio | ✅ Bien | — |
| Eventos | ✅ Bien | — |
| Servicios | ✅ Bien | — |
| Trabajo (Jobs) | ✅ Bien | — |
| Agenda | ✅ Bien | — |
| Shop | ✅ Bien | — |
| Academia | ✅ Bien | — |
| Contacto | ✅ Bien | — |
| Booth Assistant | ✅ Bien | — |
| Mi Perfil | ❌ Filtración a cliente | TICKET-ROLE-REDIRECT-002 |
| Configuraciones | ⚠️ Flash de cliente | TICKET-NAV-ARTIST-003 |
| Upgrade PRO | ❌ Sin checkout | TICKET-PRO-CHECKOUT-004 |
| DJ Tools | ❌ Flash PRO + standalone roto | TICKET-DJTOOLS-006 |
| Cash Flow | ⚠️ Sin verificar | TICKET-CASHFLOW-005 |
| SoundForTips | ❌ Gate → redirige a shop.html | TICKET-PRO-CHECKOUT-004 |
| Search (lupa) | ⚠️ UI fea + filtro mal | TICKET-SEARCH-007 |

**9 secciones sanas / 6 con bugs**

---

## PLAN DE EJECUCIÓN — ORDEN DE TRABAJO

### SESIÓN 1 — Filtraciones (máxima urgencia)
| # | Ticket | Archivo | Cambio | Tiempo estimado |
|---|--------|---------|--------|----------------|
| 1 | TICKET-ROLE-REDIRECT-002 | `mdj-shared-header.js` | 1 línea | 10 min |
| 2 | TICKET-NAV-ARTIST-003 | `account-settings.html` | 1 palabra | 5 min |
| 3 | TICKET-DJTOOLS-006 (flash) | `dj-tools.html` | gate CSS | 20 min |

### SESIÓN 2 — Monetización
| # | Ticket | Bloqueador | Archivo |
|---|--------|-----------|---------|
| 4 | TICKET-PRO-CHECKOUT-004 | Stripe Price IDs | `account-settings.html` |
| 5 | TICKET-DJTOOLS-006 (standalone) | Precio app standalone | `dj-tools.html` |

### SESIÓN 3 — UX
| # | Ticket | Archivo |
|---|--------|---------|
| 6 | TICKET-SEARCH-007 | `web/search.html` o similar |
| 7 | TICKET-CASHFLOW-005 | `dj-dashboard.html` |

---

## PARA ARRANCAR SESIÓN 1

Decir las 3 frases en orden:
1. `Autorizo TICKET-ROLE-REDIRECT-002`
2. `Autorizo TICKET-NAV-ARTIST-003`
3. `Autorizo TICKET-DJTOOLS-006`

Para Sesión 2 traer los **Stripe Price IDs** del plan PRO.

---
DOCUMENTO VIVO — actualizar al cerrar cada ticket.
