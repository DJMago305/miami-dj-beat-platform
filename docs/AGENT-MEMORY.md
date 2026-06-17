# MEMORIA DEL AGENTE — Miami DJ Beat Platform
*Nota de referencia diaria. Leer al inicio de cada sesión.*

---

## ESTADO ACTUAL DE LA PLATAFORMA (actualizado 2026-06-16)

### ✅ Funcional y estable
- Event Builder (carrito) — `rentals.html` y `services.html`
- Cart badge universal — todas las páginas via `mdj-cart-pill.js`
- Talent picker con filtro de disponibilidad por fecha (Fase A)
- Tabla CRM de órdenes en Admin Dashboard (`event_builder_orders`)
- Registro de artistas con `artist_specialty` y `available: true`
- Admin puede editar `artist_specialty` y `available` inline
- Videos de música en vivo — todos desde Supabase CDN
- Exclusividad mutua en categorías de talento (dj, live, mc, horaloca, visuals)
- PR/deploy workflow: rama `docs/session-log-june-14` → PR → merge a `main` → Vercel auto-deploy

### ⚠️ Tickets abiertos
| ID | Descripción | Prioridad |
|----|-------------|-----------|
| TICKET-DJTOOLS-006 (app) | Compra standalone MDJPRO App — necesita Stripe price ID | 🔴 ALTA |
| TICKET-SEARCH-007 | Resultados búsqueda feos + filtro incorrecto (bartenders en DJ search) | 🟡 MEDIA |
| TICKET-COMMS-001 | Sistema de notificaciones staff (suscripciones, leads, pedidos) | 🟡 ESTRATÉGICO |

### ✅ Tickets cerrados (2026-06-16 completo)
| ID | PR | Descripción |
|----|----|-------------|
| TICKET-EB-STATUS-ADMIN Fase 2 | #86 | Event Builder orders table + admin panel |
| TICKET-010 | #87, #88 | Banda en Vivo video CDN + card fix + emoji |
| TICKET-CDN-LIVE | #90 | live-sax, live-percussion, live-singer → Supabase CDN |
| TICKET-EXCL-MUTUA | #91 | Exclusividad mutua categorías rentals.js |
| TICKET-INDEX-SYNTAX-001 | #92 | SyntaxError brace extra index.html:1864 |
| TICKET-NAV-ARTIST-003 | #95 | Flash visual al entrar a Configuraciones (CSS delay) |
| TICKET-DJTOOLS-006 (flash) | #95 | Pantallazo PRO content en DJ Tools (display:none) |
| TICKET-PRO-CHECKOUT-004 | #96 | Botones PRO wired a Stripe create-checkout Edge Function |
| TICKET-CASHFLOW-005 | — | Cash Flow verificado — sin bug, datos vacíos son normales |
| TICKET-ROLE-REDIRECT-002 | #97+#98 | MI PORTAL → MI PERFIL artistas (doble fix identity+header) |

### 🔴 ANTI-REGRESIÓN CRÍTICA — Identidad de usuario (lección 2026-06-17 madrugada)
- **`mdj-identity.js` línea 60:** `else if (hasClientRow && !dj)` — NO cambiar a `hasClientRow` solo o artistas con ambas filas vuelven a ver MI PORTAL
- **`mdj-shared-header.js` línea 191:** `(sessionIsExplicitClient || metadataSaysClient) && !hasDjProfile` — NO quitar `!hasDjProfile`. `app_metadata.role='client'` en JWT no puede ganarle a `dj_profiles` existente.
- **`mdj-shared-header.js` línea 196:** `hasClientRow && !hasDjProfile && mdjIsBuyerJourneyPage()` — NO quitar `!hasDjProfile`
- **`mdj-shared-header.js` línea 3231:** `mdjEnsureMiPortalInMainNav` solo se llama cuando `isBuyerSession = true`. El else resetea el placeholder a `--guest` para artistas.
- **`mdj-shared-header.js` línea 3278:** `showConfigOnHome` usa `!isBuyerSession`, NO `!hasClientRow`. Artistas con ambas filas deben ver CONFIG.
- **Regla:** Artista con `client_profiles` + `dj_profiles` → SIEMPRE performer, nunca buyer. DB wins over JWT.
- **Diagnóstico clave:** `window.__mdjLastBuyerSession` y `window.__mdjLastPlatformIdentity` en consola revelan el estado real del clasificador.

---

## ARQUITECTURA CLAVE

### Flujo de carrito
1. Cliente construye evento en `rentals.html` → `MDJEventBuilder` (state en localStorage)
2. "ADD TO MY EVENT" → guarda en `leads.notes.selected_services` + upsert a `event_builder_orders`
3. Staff ve órdenes en Admin Dashboard → sección "Órdenes Event Builder"
4. Badge universal: `mdj-cart-pill.js` lee localStorage → redirige a `rentals.html?cart=open`
5. Al commitir una orden → carrito se limpia (badge = 0)

### Tablas Supabase principales
- `leads` — solicitudes de clientes (event_date, notes JSONB con selected_services)
- `client_profiles` — perfil comprador (user_id, full_name, phone, city)
- `dj_profiles` — perfil artista (user_id, artist_specialty, available, role, plan)
- `event_builder_orders` — órdenes Event Builder (draft_id, lines JSONB, order_status, payment_status)
- `mdjb_account_ids` — código público MDJB-XXXX-XXXX-C|A|S|M

### Funciones Supabase críticas
- `public.is_staff(uid)` — gate de acceso staff
- `public.is_staff_management(uid)` — gate admin/manager
- `public.mdj_access_snapshot()` — snapshot completo de acceso del usuario
- `public.mdjb_ensure_mine()` — generar/actualizar código MDJB propio

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

## REGLAS DE TRABAJO (resumen operativo)

### Protocolo de deploy
| Acción | Frase requerida |
|--------|----------------|
| Push a rama feature | `APROBADO PUSH` |
| Merge PR + deploy producción | `APROBADO DEPLOY PRODUCCIÓN` |

**Flujo correcto:**
1. Cambio local → validar en localhost → `APROBADO PUSH` → push
2. PR creado → esperar check verde → `APROBADO DEPLOY PRODUCCIÓN` → merge

### Archivos LOCKED (no tocar sin alcance explícito)
`web/index.html`, `web/styles.css`, `web/dj-knowledge.html`, `web/courses.html`, `web/jobs.html`, `web/dj-profile.html`, `web/dj-dashboard.html`

### Reglas anti-regresión críticas
- No tocar `onclick`, listeners, `#header-login-btn`, `doLogout`, `data-i18n` sin alcance
- No mezclar perfiles: owner → `admin-dashboard.html#staff`, nunca `account-profile.html`
- No inyectar funciones pesadas antes de `document.documentElement.classList.remove('mdj-admin-gate-pending')`
- Rutas públicas en Vercel: `/pagina.html` (no `/web/pagina.html`)

---

## PRÓXIMA SESIÓN — PRIORIDAD #1

### TICKET-COMMS-001: Sistema de Comunicaciones MDJ

**Problema:** El equipo no se entera en tiempo real cuando:
- Un cliente nuevo se registra
- Un artista nuevo se registra
- Alguien genera un lead (solicita un evento)
- Alguien hace un pedido en el Event Builder
- Alguien compra en la tienda

**Infraestructura disponible para construir sobre ella:**
- Tabla `leads` — ya tiene `created_at`, `email`, `event_type`
- Tabla `event_builder_orders` — ya tiene `created_at`, `user_id`, `total_usd`
- Tabla `client_profiles` — trigger en signup
- Tabla `dj_profiles` — trigger en signup
- Admin Dashboard — ya tiene panel de leads y órdenes
- `platform_inbox_messages` — tabla existente para inbox de staff (ya usada en admin-dashboard.html)

**Plan de trabajo propuesto (3 fases):**

**Fase A — Inbox interno (sin costo, sin servicios externos)**
- Cuando alguien se registra → INSERT en `platform_inbox_messages` (ya existe la tabla)
- Cuando llega un lead → INSERT en `platform_inbox_messages`
- Cuando se crea una orden Event Builder → INSERT en `platform_inbox_messages`
- Admin Dashboard ya lee esta tabla y muestra badge 🔔

**Fase B — Email al staff (requiere Resend o SendGrid)**
- Edge Function `notify-staff-new-lead` → email a equipo cuando llega lead
- Edge Function `notify-staff-new-signup` → email cuando se registra cliente/artista
- Edge Function `notify-client-order-confirmed` → email al cliente cuando staff confirma

**Fase C — WhatsApp/SMS al staff (requiere Twilio o WhatsApp Business)**
- Mensaje automático al número del manager cuando llega lead urgente
- Mensaje al artista cuando es asignado a un evento

**Empezar por Fase A** — cero costo, cero servicios externos, usa infraestructura ya existente.

---

## HISTORIAL DE SESIONES

| Fecha | PRs | Resumen |
|-------|-----|---------|
| 2026-06-13 | — | Setup inicial, arquitectura base |
| 2026-06-14 | — | Event Builder MVP, carrito universal |
| 2026-06-15 | #85 | Cart wiring audit, CRM tables, talent picker |
| 2026-06-16 | #86-92 | EB Fase 2, TICKET-010 videos, exclusividad mutua, CDN fix, SyntaxError index.html |
