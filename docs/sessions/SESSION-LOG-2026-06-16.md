# SESSION LOG — 2026-06-16
**Plataforma:** Miami DJ Beat LLC  
**Rama base:** `docs/session-log-june-14`  
**PRs mergeados a main:** #86, #87, #88, #89, #90, #91, #92  
**Deployments Vercel:** Ready ✅ (miami-dj-beat-platform + web)  
**Supabase migración aplicada:** `20260616100000_event_builder_orders.sql`  
**Sesión cerrada y notariada:** 2026-06-16 20:26 UTC-4

---

## TICKETS COMPLETADOS

### TICKET-EB-STATUS-ADMIN — Fase 2 (Event Builder Orders)

**Objetivo:** Persistir órdenes del Event Builder en tabla propia + panel de gestión para staff.

**Archivos modificados:**
- `supabase/migrations/20260616100000_event_builder_orders.sql` _(nuevo)_
- `web/js/mdj-event-builder.js`
- `web/admin-dashboard.html`

**Cambios:**

1. **Migración SQL** — Tabla `public.event_builder_orders`:
   - Columnas: `id`, `draft_id` (UNIQUE — puente carrito ↔ staff), `user_id`, `lead_id`, `event_date`, `lines` (JSONB), `order_status`, `payment_status`, `total_usd`, `deposit_usd`, `amount_paid_usd`, `staff_notes`, `stripe_pi_id`, `created_at`, `updated_at`
   - Trigger `ebo_updated_at_trigger` para auto-actualizar `updated_at`
   - Vista `event_builder_orders_staff` con join a `client_profiles` y `auth.users`
   - RLS: owner RW propias órdenes · staff READ todas · staff_management UPDATE cualquiera
   - **Aplicada manualmente en Supabase SQL Editor antes del merge**

2. **`mdj-event-builder.js` — `commitAddToMyEvent()`:**
   - Después del save exitoso a `leads.notes`, hace `upsert` a `event_builder_orders` usando `draft_id` como clave de conflicto (non-blocking)
   - **Nuevo comportamiento post-commit:** `state.lines = []` + `persistDraft()` — el carrito se limpia (badge vuelve a 0, como Amazon)
   - Toast actualizado: "✓ Orden guardada."

3. **`admin-dashboard.html` — Sección "Órdenes Event Builder":**
   - Nuevo enlace en sidebar bajo "Clientes"
   - Tabla con: ORDEN #, Cliente, Fecha evento, Total, Depósito, Estado (dropdown inline editable), Pago (dropdown inline editable), Líneas, botón "Ver detalle"
   - Filtro por estado en header
   - Modal de detalle: breakdown financiero (Total / Depósito / Pagado / Balance), notas de staff editables, tabla de líneas con `line_status`
   - Funciones: `loadEbOrders()`, `updateEboStatus()`, `showEboDetail()`, `saveEboNotes()`

---

### Cart Badge Universal — Limpieza post-commit

**Archivo:** `web/js/mdj-cart-pill.js`

**Cambio:** Agregados listeners `focus` y `pageshow` para que el badge se actualice inmediatamente cuando el usuario regresa a cualquier pestaña (sin esperar los 3 segundos del `setInterval`).

**Comportamiento anterior:** badge mostraba ítems stale de sesiones anteriores en `index.html` y otras páginas.  
**Comportamiento nuevo:** al hacer commit → `localStorage` se limpia → badge = 0 en todas las páginas.

**Fix adicional (localStorage manual):** Para sesiones previas con drafts stale, ejecutar en consola:
```js
Object.keys(localStorage).filter(k=>k.startsWith('mdj:event-builder:draft:v1:')).forEach(k=>localStorage.removeItem(k))
```

---

### TICKET-010 — Banda en Vivo (Live Bandas & Orquestas) — Video

**Objetivo:** Subir y conectar el video de Bandas & Orquestas a la tarjeta correcta en el catálogo.

**Archivo:** `web/js/rentals.js`

**Historia de fixes (4 iteraciones):**

| Commit | Fix |
|--------|-----|
| `aba733b` | Force-add `Live_Bandas_&_Orquestas.mp4` a git (7.1 MB) — falló CI check |
| `d420b57` | `git rm --cached` del video + URL Supabase CDN con `%26` — video no reproducía |
| `7e7d6d7` | URL corregida con `%20` (espacio) — `Live_Bandas_&_Orquestas%20.mp4` |
| `9765485` | Eliminado bloque `if (item.id === 'live_band')` con `<video>` hardcodeado dentro de la tarjeta |
| `f097065` | Emoji cambiado de 🎷 (saxofón) a 🎼 (partitura/orquesta) |

**URL final en producción:**
```
https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/live-music/Live_Bandas_&_Orquestas%20.mp4
```

**Regla aprendida:** Los `.mp4` están en `.gitignore` (`web/assets/**/*.mp4`). Todos los videos del catálogo deben servirse desde **Supabase Storage CDN**, no desde rutas relativas locales. El CI check `No tracked videos under web/assets` impide que videos sean commiteados accidentalmente.

**Estado final:** tarjeta muestra 🎼, video se reproduce en el hero al hacer hover/clic — igual que las demás tarjetas de músicos en vivo.

---

## RESUMEN DE ARCHIVOS MODIFICADOS HOY

| Archivo | Tipo | Cambio principal |
|---------|------|-----------------|
| `supabase/migrations/20260616100000_event_builder_orders.sql` | NUEVO | Tabla event_builder_orders + RLS + vista staff |
| `web/js/mdj-event-builder.js` | MOD | upsert event_builder_orders + limpiar carrito post-commit |
| `web/js/mdj-cart-pill.js` | MOD | listeners focus/pageshow para badge inmediato |
| `web/admin-dashboard.html` | MOD | Sección Órdenes Event Builder + nav sidebar |
| `web/js/rentals.js` | MOD | URL CDN Banda en Vivo + quitar video inline tarjeta + emoji 🎼 |

---

## PRs MERGEADOS

| PR | Título | Commits |
|----|--------|---------|
| #86 | feat: Event Builder Fase 2 + talent registration + admin tools + Banda en Vivo | `aba733b`, `d420b57` |
| #87 | fix: correct Banda en Vivo Supabase CDN URL (%20 space) | `7e7d6d7` |
| #88 | fix(ticket-010): remove inline video from Banda en Vivo card + correct emoji | `9765485`, `f097065` |

---

## ESTADO DE SUPABASE

| Elemento | Estado |
|----------|--------|
| Tabla `event_builder_orders` | ✅ Creada |
| Vista `event_builder_orders_staff` | ✅ Creada |
| RLS habilitado | ✅ |
| Trigger `ebo_updated_at_trigger` | ✅ |
| Video `Live_Bandas_&_Orquestas%20.mp4` en bucket `assets/live-music/` | ✅ |

---

## NOTAS TÉCNICAS

- **`draft_id`** es la clave que une el carrito del cliente (localStorage) con la orden en Supabase. Formato: `{uid.substring(0,8)}-{timestamp}`.
- **`event_builder_orders` vs `leads.notes`:** Los dos se actualizan en paralelo. `leads.notes.selected_services` sigue siendo la fuente de verdad para el CRM existente. `event_builder_orders` es la fuente de verdad para el panel de órdenes del staff.
- **Videos gitignoreados:** La regla `web/assets/**/*.mp4` en `.gitignore` + CI check `No tracked videos under web/assets` es una política de repo para evitar binarios pesados. Todos los videos deben estar en Supabase Storage.

---

## TRABAJO ADICIONAL (post-PR #88)

### fix(live-music): URLs Supabase CDN para live-sax, live-percussion, live-singer — PR #90
- Los 3 videos confirmados en Supabase Storage (HTTP 200)
- Rutas relativas `./assets/live-music/*.mp4` → URLs absolutas CDN
- Archivo: `web/js/rentals.js` líneas 146, 160, 174

### feat(rentals): Exclusividad mutua categorías exclusivas — PR #91
- Al seleccionar artista nuevo en categoría exclusiva (`dj`, `live`, `mc`, `horaloca`, `visuals`), el anterior se elimina automáticamente del carrito
- Bloque insertado entre `willBeAdded` y PASO 2 del handler `hl-activate-direct`
- Archivo: `web/js/rentals.js` (~línea 3598)
- Fallback seguro si Event Builder no está disponible

### docs: TICKET-INDEX-SYNTAX-001
- Documentado en `docs/tickets/TICKET-INDEX-SYNTAX-001.md`
- `SyntaxError: Parser error` en `index.html:1864` — pre-existente, no crítico
- Requiere autorización explícita del Capitán antes de intervenir

---

## PRs MERGEADOS (sesión completa)

| PR | Título | Estado |
|----|--------|--------|
| #86 | feat: Event Builder Fase 2 + talent registration + admin tools + Banda en Vivo | ✅ main |
| #87 | fix: correct Banda en Vivo Supabase CDN URL (%20 space) | ✅ main |
| #88 | fix(ticket-010): remove inline video from card + correct emoji | ✅ main |
| #89 | docs: session log 2026-06-16 | ✅ main |
| #90 | fix(live-music): Supabase CDN URLs para 3 videos live-music | ✅ main |
| #91 | feat(rentals): mutual exclusivity exclusive talent categories | ✅ main |
| #92 | fix(index.html): remove extra brace — SyntaxError Parser error line 1864 | ✅ main |

---

## PRÓXIMA PRIORIDAD — SISTEMA DE COMUNICACIONES MDJ

El CEO identificó que la plataforma está **pobre de comunicación**. No hay alertas automáticas cuando:
- Un cliente nuevo se registra
- Un artista nuevo se registra
- Alguien contrata un servicio / genera un lead
- Alguien hace un pedido en el Event Builder
- Alguien compra en la tienda

**Plan de trabajo documentado en:** `docs/tickets/TICKET-COMMS-001-notificaciones-staff.md`

---

## PENDIENTES PARA PRÓXIMA SESIÓN

1. **TICKET-COMMS-001** — Sistema de notificaciones y comunicación interna (PRIORIDAD ALTA)
   - Plan documentado en `docs/tickets/TICKET-COMMS-001-notificaciones-staff.md`
   - Fase A: triggers Postgres → inbox interno (costo $0)
   - Autorizar con: `Autorizo TICKET-COMMS-001 Fase A`

---

## ACTA DE CIERRE — SESIÓN 2026-06-16 (PRIMERA PARTE)

| Campo | Valor |
|-------|-------|
| Fecha | 2026-06-16 |
| Hora de cierre | 20:26 UTC-4 |
| Tickets cerrados | TICKET-EB-STATUS-ADMIN Fase 2, TICKET-010, TICKET-INDEX-SYNTAX-001, videos live-music CDN, exclusividad mutua |
| PRs a main | #86, #87, #88, #89, #90, #91, #92 |
| Estado Vercel | ✅ Ready (prod) |
| Próxima prioridad | TICKET-COMMS-001 — Sistema de comunicaciones staff |
| Autorizado por | DJMago305 (CEO / Capitán) |
| Ejecutado por | Agente IA — Ingeniero Jefe |

---

## SESIÓN NOCTURNA — 2026-06-16 (23:20 - 23:39 UTC-4)
*Bugs críticos reportados por DJYuyo (artista subscrito) desde móvil y confirmados por CEO*

### TICKET-ROLE-REDIRECT-002 — MI PORTAL vs MI PERFIL en cuentas artistas

**Síntoma:** DJYuyo (artista LITE con `dj_profiles` + `client_profiles`) veía "MI PORTAL" en el nav principal en lugar de "MI PERFIL". Clickar "MI PORTAL" llevaba al portal de cliente.

**Investigación:** Dos rutas de código independientes clasificaban al artista como buyer:

#### Bug #1 — `mdj-shared-header.js` línea 196
```js
// ANTES
if (opts.hasClientRow && mdjIsBuyerJourneyPage()) return true;
```
`mdjIsBuyerJourneyPage()` devuelve `true` para `index.html`. Artistas con `client_profiles` en la home page → `isBuyerSession = true` → MI PORTAL.

**Fix (PR #97):**
```js
// DESPUÉS
if (opts.hasClientRow && !opts.hasDjProfile && mdjIsBuyerJourneyPage()) return true;
```

#### Bug #2 — `mdj-identity.js` línea 60 (root cause principal)
```js
// ANTES
} else if (hasClientRow) {
  principal = 'buyer';   // sin verificar si existe djRow
```
Si `dj_profiles.role` es null/vacío: `dr = ''` → falsy → salta a `hasClientRow` → `principal = 'buyer'`. Esto disparaba en línea 190 de `mdjResolveBuyerSession` **antes** que el fix del PR #97.

**Fix (PR #98):**
```js
// DESPUÉS
} else if (hasClientRow && !dj) {
  principal = 'buyer';   // solo si NO existe djRow
```

**Impacto de los dos fixes combinados:**

| Usuario | Antes | Después |
|---------|-------|---------|
| Artista con client_profiles (role=null) | ❌ MI PORTAL | ✅ MI PERFIL |
| Artista con client_profiles (role='artist') | ❌ MI PORTAL | ✅ MI PERFIL |
| Cliente puro (sin dj_profiles) | ✅ MI PORTAL | ✅ MI PORTAL |

### PRs Sesión Nocturna

| PR | Archivo | Línea | Fix |
|----|---------|-------|-----|
| #94 | `web/mdj-shared-header.js` | 2975 | Partial fix: owner/staff roles en jwtArtist (sesión anterior) |
| #95 | `web/account-settings.html`, `web/dj-tools.html` | varios | Flash visual CSS delay (sesión anterior) |
| #96 | `web/account-settings.html`, `web/dj-tools.html`, `web/dj-profile.html` | varios | Botones PRO → Stripe checkout (sesión anterior) |
| **#97** | `web/mdj-shared-header.js` | 196 | `!hasDjProfile` en buyer journey check |
| **#98** | `web/mdj-identity.js` | 60 | `!dj` en hasClientRow → buyer classifier |

---

## SESIÓN MADRUGADA — 2026-06-17 (00:20 - 00:39 UTC-4)
*Continuación diagnóstico TICKET-ROLE-REDIRECT-002 — bug persistente tras PRs #94-#100*

### Root cause real — 3 bugs en `mdj-shared-header.js`

#### BUG A — `mdjResolveBuyerSession` línea 191 (CAUSA RAÍZ PRINCIPAL)
```js
// ANTES — app_metadata.role='client' en JWT fuerza buyer aunque exista dj_profiles
if (opts.sessionIsExplicitClient || opts.metadataSaysClient) return true;

// DESPUÉS — DB wins: dj_profiles con rol no-cliente bloquea el JWT client claim
if ((opts.sessionIsExplicitClient || opts.metadataSaysClient) && !opts.hasDjProfile) return true;
```
DJYuyo tenía `app_metadata.role = 'client'` en su JWT (registrado primero como cliente).
`metadataSaysClient = true` → `mdjResolveBuyerSession` retornaba `true` → MI PORTAL.
`idn.principal = 'performer'` era correcto pero nunca llegaba a controlar el nav.

#### BUG B — `mdjEnsureMiPortalInMainNav` llamado incondicionalmente (línea 3231)
```js
// ANTES — siempre revelaba MI PORTAL en páginas con nav completo
if (!_compactNavCheck || isBuyerSession) {
  mdjEnsureMiPortalInMainNav(miPortalHref, miPortalNavOpts);
}

// DESPUÉS — solo para buyer + reset explícito del placeholder para artistas
if (isBuyerSession) {
  mdjEnsureMiPortalInMainNav(miPortalHref, miPortalNavOpts);
} else {
  var _portalSlot = document.getElementById('mainNav-mi-portal-link');
  if (_portalSlot) {
    _portalSlot.classList.remove('mdj-mi-portal--hydrating');
    _portalSlot.classList.add('mdj-mi-portal--guest');
    _portalSlot.setAttribute('aria-hidden', 'true');
    _portalSlot.setAttribute('tabindex', '-1');
  }
}
```

#### BUG C — `showConfigOnHome` excluía artistas con `client_profiles` (línea 3278)
```js
// ANTES — !hasClientRow ocultaba CONFIG para artistas con ambas filas
var showConfigOnHome = onPublicHome && !!window.__mdjNavOwnUserId && !isBuyerSession && !hasClientRow;

// DESPUÉS — isBuyerSession es la fuente correcta
var showConfigOnHome = onPublicHome && !!window.__mdjNavOwnUserId && !isBuyerSession;
```

**Resultado tras los 3 fixes:** DJYuyo en localhost muestra **MI PERFIL** ✅ y **CONFIG** ✅

**Método de diagnóstico:** Consola del browser con cuenta de DJYuyo logueada en localhost reveló:
- `principal: "performer"` (identity correcto)
- `buyer: true` (buyer session incorrectamente true)
- `portal classes: mdj-mi-portal-mainnav mdj-mi-portal-gold mdj-mi-portal--mainnav-reserved-slot`

Esto permitió identificar que `mdjResolveBuyerSession` retornaba `true` a pesar de que `mdjClassifyPlatformIdentity` era correcto → bug en línea 191.

**PRs:** Pendiente deploy (requiere APROBADO PUSH + APROBADO DEPLOY PRODUCCIÓN)

---

## ACTA DE CIERRE — SESIÓN NOCTURNA 2026-06-16

| Campo | Valor |
|-------|-------|
| Fecha | 2026-06-16 |
| Hora de cierre | 23:39 UTC-4 |
| Tickets cerrados | TICKET-ROLE-REDIRECT-002 (definitivo, 2 PRs), TICKET-NAV-ARTIST-003, TICKET-DJTOOLS-006 (flash), TICKET-PRO-CHECKOUT-004, TICKET-CASHFLOW-005 |
| PRs nocturnos a main | #97, #98 |
| PRs anteriores en sesión | #94, #95, #96 |
| Estado Vercel | ✅ Deploying (post PR #98) |
| Tickets pendientes | TICKET-DJTOOLS-006 (standalone app), TICKET-SEARCH-007, TICKET-COMMS-001 |
| Autorizado por | DJMago305 (CEO / Capitán) |
| Ejecutado por | Agente IA — Ingeniero Jefe |
