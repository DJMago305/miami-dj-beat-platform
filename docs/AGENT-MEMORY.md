# MEMORIA DEL AGENTE — Miami DJ Beat Platform
*Nota de referencia diaria. Leer al inicio de cada sesión.*

---

## ESTADO ACTUAL DE LA PLATAFORMA (actualizado 2026-06-18)

### ✅ Funcional y estable
- Event Builder (carrito) — `rentals.html` y `services.html`
- Cart badge universal — todas las páginas via `mdj-cart-pill.js`
- Talent picker con filtro de disponibilidad por fecha (Fase A)
- Tabla CRM de órdenes en Admin Dashboard (`event_builder_orders`)
- Registro de artistas con `artist_specialty` y `available: true`
- Admin puede editar `artist_specialty` y `available` inline
- Videos de música en vivo — todos desde Supabase CDN
- Exclusividad mutua en categorías de talento (dj, live, mc, horaloca, visuals)
- Universal Smart Search — header busca artistas, categorías y equipo de renta
- Flujo PRO Artist completo — selector de planes en `dj-dashboard.html` + `dj-tools.html`
- MDJPRO App standalone — compra independiente $19.99/mes via "Acceso Anticipado"
- Edge Functions `create-checkout` + `stripe-webhook` deployadas con separación de `product_line`
- Event Builder upsert — manejo explícito de errores (sin catch silencioso)
- Plantillas universales confirmadas — 3 templates para artista / cliente / staff

### ⚠️ Tickets abiertos
| ID | Descripción | Prioridad |
|----|-------------|-----------|
| STRIPE-SECRETS-CHECK | Confirmar `STRIPE_PRICE_APP_MONTHLY=price_1TjV9aDtBrAhSobylMVTFqV0` en Supabase Secrets | 🔴 ALTA |
| FASE-6B-QA | QA manual Event Builder: toast + SQL + Staff Board (lo ejecuta el Capitán) | 🔴 ALTA |
| TICKET-COUPON-001 | Cupón primera compra $80 — Stripe + secreto + `create-checkout` | 🟡 MEDIA |
| TICKET-REFERRAL-001 | Códigos de referido de manager con descuento | 🟡 MEDIA |
| TICKET-COMMS-001 | Sistema de notificaciones staff (inbox interno → email → WhatsApp) | 🟡 ESTRATÉGICO |
| TICKET-004 (a→h) | Arquitectura financiera de órdenes — contratos, ledger, comisiones, pagos DJ | 🔵 ESTRATÉGICO |
| TICKET-VERCEL-DEPLOY | Confirmar PR #104 mergeado activó deploy en Vercel (probar ventana privada) | 🟡 MEDIA |

### ✅ Tickets cerrados (histórico completo)
| ID | PR | Descripción | Fecha |
|----|----|-------------|-------|
| TICKET-EB-STATUS-ADMIN Fase 2 | #86 | Event Builder orders table + admin panel | 2026-06-16 |
| TICKET-010 | #87, #88 | Banda en Vivo video CDN + card fix + emoji | 2026-06-16 |
| TICKET-CDN-LIVE | #90 | live-sax, live-percussion, live-singer → Supabase CDN | 2026-06-16 |
| TICKET-EXCL-MUTUA | #91 | Exclusividad mutua categorías rentals.js | 2026-06-16 |
| TICKET-INDEX-SYNTAX-001 | #92 | SyntaxError brace extra index.html:1864 | 2026-06-16 |
| TICKET-NAV-ARTIST-003 | #95 | Flash visual al entrar a Configuraciones | 2026-06-16 |
| TICKET-DJTOOLS-006 (flash) | #95 | Pantallazo PRO content en DJ Tools | 2026-06-16 |
| TICKET-PRO-CHECKOUT-004 | #96 | Botones PRO wired a Stripe create-checkout | 2026-06-16 |
| TICKET-CASHFLOW-005 | — | Cash Flow verificado — datos vacíos son normales | 2026-06-16 |
| TICKET-ROLE-REDIRECT-002 | #97+#98 | MI PORTAL → MI PERFIL artistas | 2026-06-17 |
| TICKET-SEARCH-007 | #103 | Universal Smart Search + find-dj redesign | 2026-06-17 |
| TICKET-ROLE-REDIRECT-002 (final) | #104 | `!djProfileErr` guard en `mdj-shared-header.js` | 2026-06-18 |
| TICKET-NAV-ARTIST-003 (v2) | #104 | Clase active estática eliminada + CTAs a dashboard billing | 2026-06-18 |
| TICKET-DJTOOLS-006 (completo) | #104 | Spinner anti-flash + gate LITE + sección planes + Acceso Anticipado | 2026-06-18 |
| TICKET-PRO-CHECKOUT-004 (v2) | #104 | Panel billing en dashboard + hash activation + links SFT a dj-tools | 2026-06-18 |
| TICKET-JOBS-AUTOSELECT | #104 | Auto-select plan PRO con `?plan=pro` en URL | 2026-06-18 |
| TICKET-EVENTBUILDER-006A | #104 | Catch silencioso → await con toast error/éxito | 2026-06-18 |
| TICKET-BACKEND-STRIPE-SECURITY | prod | `product_line` condicional + rama `mdjpro_app` en webhook | 2026-06-18 |

---

## ARQUITECTURA DE PLANTILLAS — 3 UNIVERSALES (CONFIRMADO 2026-06-18)

Nunca arreglar perfiles uno por uno. Cada template sirve a todos los usuarios de su categoría de forma dinámica.

| Plantilla | Archivos maestros | Aplica a |
|---|---|---|
| **Artista** | `dj-profile.html` / `dj-dashboard.html` / `account-settings.html` | DJMago305, DJYuyo, bartenders, músicos, MCs, artistas futuros |
| **Cliente** | `client-portal.html` | Wendi, clientes actuales y futuros |
| **Staff** | `admin-dashboard.html` | Owner, manager, seller — según `is_staff` / `is_staff_management` |

---

## ARQUITECTURA CLAVE

### Flujo PRO Artist (LITE → PRO)
```
Artista LITE → dj-tools.html / dj-profile.html / account-settings.html
  → CTA "Activar PRO Artist" o "Ver planes"
  → dj-tools.html?mdj_nav=profile#djt-plan-section (selector mensual/$480/$840)
  → mdjCheckoutPro(billing) → create-checkout Edge Function
  → Stripe Checkout → stripe-webhook
  → product_line=mdj_artist_pro → dj_profiles.plan = 'PRO'
  → DJ Tools desbloqueado
```

### Flujo MDJPRO App standalone
```
Artista (cualquier tier) → dj-tools.html → "Acceso Anticipado"
  → mdjCheckoutPro('app_monthly') → create-checkout
  → product_line=mdjpro_app → Stripe $19.99/mes
  → stripe-webhook → mdjpro_issue_license(manual)
  → Licencia emitida — dj_profiles.plan NO se toca
```

### Separación de productos en backend
| billing | product_line | Webhook acción |
|---|---|---|
| `monthly / semestral / annual` | `mdj_artist_pro` | Actualiza `dj_profiles.plan = 'PRO'` |
| `app_monthly / app_annual` | `mdjpro_app` | Emite licencia MDJPRO, NO toca plan |

### Flujo de carrito (Event Builder)
1. Cliente construye evento en `rentals.html` → `MDJEventBuilder` (state en localStorage)
2. "ADD TO MY EVENT" → guarda en `leads.notes.selected_services` + upsert AWAIT a `event_builder_orders`
3. Si upsert falla → toast error, carrito no se limpia
4. Si upsert ok → toast éxito, carrito se limpia, drawer cierra
5. Staff ve órdenes en Admin Dashboard → sección "Órdenes Event Builder"
6. Badge universal: `mdj-cart-pill.js` lee localStorage → redirige a `rentals.html?cart=open`

### Tablas Supabase principales
- `leads` — solicitudes de clientes (event_date, notes JSONB con selected_services)
- `client_profiles` — perfil comprador (user_id, full_name, phone, city)
- `dj_profiles` — perfil artista (user_id, artist_specialty, available, role, plan)
- `event_builder_orders` — órdenes Event Builder (draft_id, lines JSONB, order_status, payment_status)
- `mdjb_account_ids` — código público MDJB-XXXX-XXXX-C|A|S|M
- `mdjpro_license_keys` — licencias MDJPRO App (plan_source: miamidjbeat_pro | mdjpro_standalone | manual | bundle)

### Funciones Supabase críticas
- `public.is_staff(uid)` — gate de acceso staff
- `public.is_staff_management(uid)` — gate admin/manager
- `public.mdj_access_snapshot()` — snapshot completo de acceso del usuario
- `public.mdjb_ensure_mine()` — generar/actualizar código MDJB propio
- `public.mdjpro_issue_license(uid, plan_source)` — emite licencia MDJPRO App
  - `'miamidjbeat_pro'` — requiere plan PRO activo
  - `'manual'` — sin gate de elegibilidad (usado por webhook app_monthly)

### Secretos Supabase Edge Functions
| Secreto | Valor | Uso |
|---|---|---|
| `STRIPE_SECRET_KEY` | sk_live_... | Auth Stripe API |
| `STRIPE_WEBHOOK_SECRET` | whsec_... | Verificar firma webhook |
| `STRIPE_PRICE_MONTHLY` | price_... | Plan PRO mensual $100 |
| `STRIPE_PRICE_SEMESTRAL` | price_... | Plan PRO 6 meses $480 |
| `STRIPE_PRICE_ANNUAL` | price_... | Plan PRO anual $840 |
| `STRIPE_PRICE_APP_MONTHLY` | `price_1TjV9aDtBrAhSobylMVTFqV0` | MDJPRO App $19.99/mes — **verificar activo** |

### Videos (todos en Supabase CDN)
```
Base URL: https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/
live-music/live-sax.mp4
live-music/live-percussion.mp4
live-music/live-singer.mp4
live-music/Live_Bandas_&_Orquestas%20.mp4
```
> REGLA: Los `.mp4` están en `.gitignore`. NUNCA force-add videos. Siempre usar URL Supabase CDN.

---

## TICKET-004 — ARQUITECTURA FINANCIERA (DISEÑADO, PENDIENTE IMPLEMENTAR)

Cada orden de evento tiene 6 capas financieras separadas con visibilidad por rol:

| Capa | Tabla | Visible a |
|---|---|---|
| A. Client Financials | `order_client_financials` | Cliente, Owner, Manager |
| B. Talent Compensation | `order_talent_compensation` | DJ asignado, Owner, Manager |
| C. Company Financials | `order_company_financials` | Owner, Manager |
| D. Seller Commission | `order_seller_commission` | Seller propio, Owner, Manager |
| E. Manager Commission | `order_manager_commission` | Manager propio, Owner |
| F. Ledger / Audit Trail | `order_ledger` | Append-only, según rol |

**Reglas críticas:**
- DJ pay ≠ event total. Nunca mezclar en la misma vista.
- Ledger es append-only. Ninguna fila se borra ni actualiza.
- Renegociación de precio dispara cascada de recálculo + ledger entries.
- Cliente solo ve sus pagos, nunca finanzas de la empresa.

**Sub-tickets pendientes:** 004a (migración SQL) → 004b (RLS) → 004c-h (UI + Edge Functions)

---

## REGLAS DE TRABAJO (resumen operativo)

### Protocolo de deploy
| Acción | Frase requerida |
|--------|----------------|
| Push a rama feature | `APROBADO PUSH` |
| Merge PR + deploy producción | `APROBADO DEPLOY PRODUCCIÓN` |
| Deploy Edge Functions | `APROBADO DEPLOY PRODUCCIÓN` |

**Flujo correcto:**
1. Cambio local → validar en localhost → `APROBADO PUSH` → push → PR → check verde → `APROBADO DEPLOY PRODUCCIÓN` → merge

### Archivos LOCKED (no tocar sin alcance explícito)
`web/index.html`, `web/styles.css`, `web/dj-knowledge.html`, `web/courses.html`, `web/jobs.html`, `web/dj-profile.html`, `web/dj-dashboard.html`

---

## REGLAS ANTI-REGRESIÓN CRÍTICAS

### Identidad de usuario (lección 2026-06-17 madrugada)
- **`mdj-identity.js` línea 60:** `else if (hasClientRow && !dj)` — NO cambiar. Artistas con ambas filas siempre son performer.
- **`mdj-shared-header.js`:** `isClient` requiere `!djProfileErr`. Artista con error de red no debe clasificarse como cliente.
- **Regla:** DB wins over JWT. Artista con `dj_profiles` → SIEMPRE performer, nunca buyer.
- **Diagnóstico:** `window.__mdjLastBuyerSession` y `window.__mdjLastPlatformIdentity` en consola.

### Stripe / Backend (lección 2026-06-18)
- **`product_line` en `create-checkout` es condicional** — NO hardcodear `mdj_artist_pro`.
- **`dj_profiles.plan` solo se toca en rama `mdj_artist_pro`** — `mdjpro_app` tiene SECURITY WALL permanente.
- **`mdjCheckoutPro(billing)` en dj-tools.html** — solo acepta `monthly | semestral | annual`. Guard activo contra `app_monthly`.
- **Botón "Acceso Anticipado"** — llama `mdjCheckoutPro('app_monthly')`. No reemplazar por link estático.

### Event Builder
- **Catch silencioso prohibido** — cualquier `upsert` a `event_builder_orders` debe ser `await` con manejo explícito.
- **Hash activation en dj-dashboard.html** — script usa `setTimeout(0)`. No mover ni eliminar.

### Nav artista
- **`mdj_nav=profile`** — links desde perfil/dashboard artista a páginas satélite deben preservar este param.
- **No duplicar `#mainHeader .header-nav`** cuando `body.mdj-from-profile` está activo.
- **SoundForTips "Ver planes"** → `dj-tools.html?mdj_nav=profile#djt-plan-section`. No cambiar a jobs.html ni a dashboard.

---

## HISTORIAL DE SESIONES

| Fecha | PRs | Resumen |
|-------|-----|---------|
| 2026-06-13 | — | Setup inicial, arquitectura base |
| 2026-06-14 | — | Event Builder MVP, carrito universal |
| 2026-06-15 | #85 | Cart wiring audit, CRM tables, talent picker |
| 2026-06-16 | #86-92 | EB Fase 2, videos CDN, exclusividad mutua, SyntaxError |
| 2026-06-17 | #95-103 | Role redirect fix, flash fixes, PRO checkout, Smart Search |
| 2026-06-18 | #104 | PRO flow completo, MDJPRO App standalone, backend security, plantillas confirmadas |
