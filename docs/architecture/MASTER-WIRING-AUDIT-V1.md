# Master Wiring Audit — Plano Eléctrico Maestro (V1)

**Ticket:** TICKET-V1-MASTER-WIRING-AUDIT-001  
**Persistencia:** TICKET-V1-MASTER-WIRING-PERSIST-002  
**Estado:** Auditoría forense — solo lectura (sin implementación)  
**Fecha:** 2026-07-06  
**Alcance:** proyecto completo (`web/`, `supabase/`, `scripts/`, documentación de referencia)

**Referencia producto congelada:** `docs/architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md` (PO 2026-07-06)

---

## Resumen ejecutivo

Miami DJ Beat V1 no es un monolito financiero: es una **red de hubs de datos** conectados por **leads comerciales**, **perfiles duales** (artista/cliente/staff), **Stripe async** y **acciones staff manuales**. No existe bus central de eventos ni ledger unificado (`order_ledger` / TICKET-004 **no implementado**).

| Plano | Hub | Rol |
|-------|-----|-----|
| **Comercial** | `leads`, `event_builder_orders` | Venta, matching, portal, producción |
| **Identidad / marketplace** | `dj_profiles`, `public_dj_profiles`, `client_profiles` | Auth, ranking PRO, búsqueda, agenda |
| **Financiero fragmentado** | `leads.balance_paid`, `dj_ledger`, Stripe webhook | Cobro cliente ≠ wallet DJ |

**Edge Functions (30):** capa async crítica para pagos, SFT, MDJPRO, notificaciones.  
**Deuda estructural:** RPCs huérfanos, tablas legacy en `web/sql/` sin migración, esquema dual `supabase/migrations` vs SQL manual.

---

# PARTE 1 — Inventario completo de WRITERS

## 1.1 Leads / CRM (hub central comercial)

| Writer | Archivo | Qué escribe | Quién dispara |
|--------|---------|-------------|---------------|
| Formularios públicos | `web/form-handler.js`, `web/js/rentals.js`, `web/booth.html` | `leads` INSERT | Anónimo / cliente |
| Client Portal | `web/client-portal.js` | `leads` INSERT/UPDATE/DELETE | Cliente |
| Event Builder | `web/js/mdj-event-builder.js` | `leads` UPDATE (notes, total) | Cliente autenticado |
| Party Planner | `web/party-planner.js` | `leads` UPDATE | Cliente |
| Staff Producción | `web/js/production-module.js` | `leads` INSERT/UPDATE + payout RPC | Staff |
| Admin CRM | `web/admin-dashboard.html` | `leads` UPDATE (match, status, DJ) | Staff/owner |
| Staff Order | `web/staff-order.html` | `leads` UPDATE | Staff |
| Quick Invoice | `web/admin-quick-invoice.html` | `leads` INSERT | Staff |
| DJ complete | `web/dj-dashboard.html`, `web/weather-lab.html` | `leads` status COMPLETED | DJ asignado |
| Edge deposit | `supabase/functions/create-event-payment` | `leads` payment pending | Cliente/staff checkout |
| Webhook | `supabase/functions/stripe-webhook` | `leads` balance_paid, status | Stripe |
| Zelle RPC | `client_mark_event_zelle_sent`, `staff_confirm_event_zelle_deposit` | `leads.balance_paid` | Cliente / staff |
| Payout RPC | `staff_release_event_dj_payout` | `leads` + **`dj_ledger`** | Staff |

**RPC sin caller web:** `mdj_client_create_event_lead`, `mdj_assign_staff_to_lead` — definidos, no cableados.

## 1.2 Invoice / facturación staff

| Writer | Archivo | Tabla |
|--------|---------|-------|
| Producción | `web/js/production-module.js` | `mdj_staff_manual_invoices` INSERT; `leads.staff_invoice_id` |
| Webhook PAID | `stripe-webhook` | `mdj_staff_manual_invoices.status = paid` |
| Zelle confirm RPC | migration SQL | invoice paid si lead PAID |
| Event flows | `production-module.js` | `mdj_event_flows` |

## 1.3 Event Builder Orders

| Writer | Archivo |
|--------|---------|
| `web/js/mdj-event-builder.js` | `event_builder_orders` UPSERT (draft_id) |
| `web/staff-order.html` | INSERT/UPDATE |
| `web/admin-dashboard.html` | UPDATE (staff_notes, patch) |

## 1.4 Perfiles artista (`dj_profiles`)

| Writer | Archivo / origen |
|--------|------------------|
| Signup | `web/auth.js`, `web/jobs.html` |
| Dashboard / settings | `web/dj-dashboard.html`, `web/account-settings.html`, `web/profile-loader.js` |
| Staff admin | `web/admin-dashboard.html`, `web/js/artists.js` |
| Courses exam | `web/courses.html` |
| SFT / verified | `web/dj-profile.html` |
| Security | `web/security-shield.js` (known_devices) |
| Stripe PRO | `create-checkout`, `stripe-webhook` (plan, subscription) |
| Admin edge | `create-platform-account`, `notify-photo-rejection` |
| SFT fee | `settle-sft-manual-platform-fee` |
| Triggers DB | MDJB sync, role guards, review rollup |

## 1.5 Perfiles cliente (`client_profiles`)

| Writer | Archivo / origen |
|--------|------------------|
| Signup | `web/auth.js`, `web/form-handler.js` |
| Account | `web/js/client-account.js`, `web/account-settings.html` |
| Staff CRM | `web/admin-dashboard.html` (VIP tier) |
| Stripe buyer | `create-event-payment`, `create-buyer-billing-portal` |
| Staff edge | `staff-create-client-account`, `create-platform-account` |

## 1.6 Wallet DJ (`dj_ledger`)

| Writer | Mecanismo |
|--------|-----------|
| **Único INSERT automático en repo** | RPC `staff_release_event_dj_payout` |
| Rollups (derivados) | RPC `refresh_my_dj_flow_rollups` → `dj_flow_*` |
| Management manual | RLS permite INSERT staff management |

**No escriben `dj_ledger`:** Stripe webhook event deposit, Zelle confirm, Invoice save.

## 1.7 Stripe / pagos

| Edge Function | Escribe |
|---------------|---------|
| `create-event-payment` | `leads`, `client_profiles` |
| `create-checkout` | `dj_profiles`, `audit_log` |
| `create-course-checkout` | Stripe session (DB en webhook) |
| `create-sft-tip-checkout` | `soundfortips_fan_requests` |
| `create-buyer-billing-portal` | `client_profiles` |
| **`stripe-webhook`** | `leads`, invoices, SFT, `course_purchases`, `dj_profiles`, `payments`, `referrals`, MDJPRO, `processed_webhooks` |

## 1.8 SoundForTips

| Writer | Path |
|--------|------|
| Fan request | `register-sft-fan-request` → INSERT |
| Card checkout | `create-sft-tip-checkout` |
| Payment | `stripe-webhook` → status |
| SMS pipeline | `send-sft-client-sms` |
| DJ accept/deny | RPC desde `web/dj-profile.html` |
| Fee settle | `settle-sft-manual-platform-fee` |
| **Orphan table** | `soundfortip_splits` (web/sql only — sin writer runtime) |

## 1.9 MDJPRO / suscripciones

| Writer | Path |
|--------|------|
| Webhook checkout | `mdjpro_issue_license`, `mdjpro_license_keys/events` |
| Subscription lifecycle | `mdjpro_apply_subscription_*`, `dj_profiles` |
| Mac app | `mdj-activate`, `mdj-heartbeat`, handoff edges |

## 1.10 Reviews / reputación

| Writer | Path |
|--------|------|
| Fan submit | RPC `submit_dj_public_review` (`dj-profile.html`) |
| Staff hide | RPC `staff_hide_dj_public_review` |
| Trigger | `refresh_dj_profile_review_rollup` → `dj_profiles.rating` |
| Visit analytics | RPC `record_dj_profile_visit` |

## 1.11 Certificaciones

| Writer | Path |
|--------|------|
| Theory exam | `web/certification.js` → `certificates` INSERT |
| Practical | `web/dj-profile.html` → `practical_history`, `certificates`, `dj_profiles.verified` |
| Admin | `admin-update` edge |

## 1.12 Referidos / cupones

| Writer | Path |
|--------|------|
| PRO checkout | `stripe-webhook` → `referrals`, `increment_referral_credits` |
| LocalStorage | `login.html`, `index.html`, `dj-profile.html` (pre-checkout) |
| Validate | RPC `mdj_validate_discount_code` (portal — solo validación) |
| **Orphan** | `referral_sale_commissions` (web/sql — sin writer) |
| **Orphan RPC** | `mdj_redeem_discount_code` (sin caller) |

## 1.13 Agenda / disponibilidad

| Writer | Campos en `dj_profiles` |
|--------|-------------------------|
| `dj-dashboard.html`, `account-settings.html` | `weekly_schedule`, vacation, `available`, `is_resident` |
| `profile-loader.js` | `availability[]` busy dates |

## 1.14 Matching / bookings

| Writer | Path |
|--------|------|
| Admin assign | `admin-dashboard.html` → `leads.assigned_dj_*`, `bookings` UPSERT |
| Producción | `production-module.js` → assigned DJ on create |
| Webhook partial pay | `leads.status` MATCHED |

## 1.15 Auth / identidad

| Writer | Path |
|--------|------|
| `web/auth.js` | profile rows, device RPCs |
| Triggers | `mdjb_account_ids`, role normalization |
| `web/role-guard.js` | `audit_log` |

## 1.16 Portal / mensajería / misc

| Writer | Tabla |
|--------|-------|
| `client-portal.js` | `portal_messages` |
| `notify-portal-message` | email log |
| `shop.html` | `mdj_orders` (sin migración repo) |
| Booth | RPCs → AI learning tables |
| Blueprint editors | `event_show_plans` |
| `admin-dashboard.html` | `platform_settings` |

## 1.17 Triggers / DB-only writers

- Review rollup on `dj_public_reviews`
- Lead outcome → `ai_booth_learning_examples`
- Portal message → notify trigger
- MDJB account sync on profile INSERT
- Flow rollup functions (batch)

## 1.18 Scripts / cron

| Path | Rol |
|------|-----|
| `supabase/scripts/` | SQL manual ops, identity audit |
| `scripts/` (root) | Preview/audit SQL — no runtime writers |
| `notify-dj-sms` | `event_reminders_queue` (scheduled edge) |
| GitHub workflows | CI only |

---

# PARTE 2 — Inventario completo de READERS

## 2.1 Hub tables — quién lee

| Entidad | Lectores principales |
|---------|---------------------|
| **`leads`** | client-portal, admin-dashboard, production-module, flow-handler, agenda-engine, event-intelligence, mdj-event-builder, staff-order, header-smart-search |
| **`dj_profiles`** | Casi todas las páginas autenticadas; auth, header, building-resolver, marketplace |
| **`client_profiles`** | client-portal, auth, header, admin, account-settings |
| **`public_dj_profiles`** | find-dj, event-builder, dj-profile (público), mdj-assistant, booth-chat |
| **`event_builder_orders`** | client-portal, staff-order, admin |
| **`dj_ledger`** | flow-handler (+ RPC statement) |
| **`platform_settings`** | index, rentals, admin, header, downloads, jobs |
| **`certificates`** | certification, dj-profile, verify, registry, directory, admin |
| **`soundfortips_fan_requests`** | dj-profile RPCs, SFT edges, stripe-webhook, flow SFT RPC |
| **`mdjpro_license_*`** | downloads, dashboard, account-settings, webhook, Mac edges |

## 2.2 Por superficie de producto

| Superficie | Archivos clave | Lee |
|------------|----------------|-----|
| **Dashboard artista** | `dj-dashboard.html`, `profile-loader.js` | profiles, leads, billing, MDJPRO, inbox |
| **Cash Flow** | `flow-handler.js` | ledger, leads, profiles, flow rollups, SFT RPC |
| **Perfil público** | `dj-profile.html` | public_dj_profiles, reviews bundle, SFT, certs |
| **Client Portal** | `client-portal.js` | leads, EBO, client_profiles, messages, discounts |
| **Admin / Staff** | `admin-dashboard.html`, `production-module.js`, `staff-order.html` | CRM completo |
| **Marketplace** | `find-dj.html`, `mdj-event-builder.js`, `rentals.js` | public_dj_profiles, settings, busy leads |
| **Search** | `header-smart-search.js` | RPC teasers, profiles, leads ownership |
| **Billing** | dashboard, account-settings, portal, downloads | plans, Stripe ids, license snapshot |
| **Agenda** | `agenda-engine.js`, `event-intelligence.js`, `event-weather.js` | flows, leads, availability, event_notes |
| **Analytics** | flow-handler, admin KPIs, visibility RPC | agregados, visits |
| **MDJPRO** | downloads, Mac edges | license snapshot, handoffs |
| **SFT** | dj-profile, flow-handler | pending/accepted/night log |

## 2.3 RPCs “read” que también escriben

| RPC | Efecto |
|-----|--------|
| `refresh_my_dj_flow_rollups` | Materializa `dj_flow_*` antes de leer |
| `mdjb_ensure_mine` | Puede crear/sync MDJB id |
| `record_dj_profile_visit` | INSERT visit + rollup |

## 2.4 RPC documentado pero NO usado en runtime

| RPC | Sustituto vivo |
|-----|----------------|
| `mdj_access_snapshot` | `mdj-identity.js` + `mdj_identity_snapshot` + reads directos |
| `mdj_client_create_event_lead` | `.from('leads').insert()` directo |
| `mdj_assign_staff_to_lead` | admin manual UPDATE |

---

# PARTE 3 — Mapa de eventos de negocio

| Evento | Generador | Modifica | Reaccionan |
|--------|-----------|----------|------------|
| **Lead creado** | form, rentals, portal, booth, production | `leads` | admin CRM, notify-new-lead, portal |
| **Carrito EBO upsert** | event-builder | `event_builder_orders`, `leads.notes` | staff-order, portal loadLeadItems |
| **Invoice guardada** | production-module | `leads`, optional `mdj_staff_manual_invoices` | print, cobro panel |
| **Cliente paga Stripe** | create-event-payment → webhook | `leads.balance_paid`, invoice paid | portal status; **no** dj_ledger |
| **Cliente marca Zelle** | portal RPC | `payment_status PENDING_ZELLE` | staff confirm UI |
| **Staff confirma Zelle** | production RPC | `balance_paid` | cobro status refresh |
| **Staff asigna DJ** | admin modal | `assigned_dj_id`, `bookings` | notify-dj-assignment, DJ dashboard |
| **Staff libera payout** | production RPC | `dj_ledger` income | flow-handler gross ↑ |
| **DJ marca COMPLETED** | dj-dashboard | `leads.status` | flow KPI done; **no** auto payout |
| **Review publicada** | submit RPC | `dj_public_reviews` → rollup rating | find-dj sort secondary, profile hero |
| **SFT tip pagado** | stripe → fan_requests | status pipeline | DJ queue profile |
| **SFT aceptado** | accept RPC | accepted | flow-handler tips KPI |
| **PRO suscrito** | checkout → webhook | `dj_profiles.plan` | searchRankScore +1e9, SFT gate, MDJPRO license |
| **Certificado teórico** | certification.js | `certificates` | verify, directory |
| **Cuenta creada** | auth signup | profiles + MDJB trigger | header resolver, portal |
| **Evento cancelado** | admin/client | status CANCELLED | agenda colors; **no** refund auto |
| **Suscripción lapse** | webhook | MDJPRO suspended, plan downgrade | downloads gate, SFT |

### Pipeline financiero (eventos de cobro)

```
Invoice save → Lead
  → Stripe checkout → webhook → leads.balance_paid
  → Zelle mark → staff confirm → leads.balance_paid
  → (manual) staff_release_event_dj_payout → dj_ledger
```

---

# PARTE 4 — Dependencias cruzadas

## 4.1 Quién escribe → quién lee → impacto

| Dato | Writers | Readers | Si cambia, rompe |
|------|---------|---------|------------------|
| `leads.balance_paid` | webhook, Zelle RPC | portal, production, admin | Cobro UI, release gate |
| `leads.assigned_dj_id` | admin, production | flow, agenda, portal | KPIs, calendar, DJ view |
| `leads.status` | webhook, staff, DJ | flow charts, admin pipeline | Matching semantics |
| `dj_profiles.plan` | webhook | subscription.js rank, SFT edges | Marketplace order, PRO features |
| `dj_profiles.rating` | review trigger | public profile, EB sort, flow health | Search, hero fans |
| `dj_ledger` | release RPC only | flow-handler, rollups | Cash Flow artista wallet |
| `platform_settings` | admin | rentals prices, hero, catalog | Event builder pricing |
| `event_builder_orders.lines` | staff, EB | portal items (priority over lead notes) | Client order display |
| `staff_invoice_id` | production | webhook invoice paid | Invoice status |

## 4.2 Acoplamientos críticos

1. **Portal ↔ Lead ↔ EBO:** `loadLeadItems` prefiere EBO lines sobre `leads.notes` — dos fuentes de verdad comercial.
2. **Producción ↔ Webhook:** mismo lead; cobro no notifica ledger.
3. **Identity:** header usa `mdj-shared-header` + `mdj-building-resolver` + `mdj-identity.js` — paralelo a RPC `mdj_access_snapshot` no usado.
4. **Ranking:** `MDB_SUBSCRIPTION.searchRankScore` desacoplado de reviews, flow health, GBV.
5. **Salud MDJ:** calculada en browser (`flow-handler`) — no persiste; no alimenta marketplace.

## 4.3 Cadena de rotura (ejemplo)

```
Cambiar semántica leads.payment_status
  → client-portal display
  → production-module cobro panel
  → staff_release gate (deposit)
  → stripe-webhook assumptions
  → admin CRM colors
```

---

# PARTE 5 — Código muerto / huérfanos

## 5.1 Tablas huérfanas o no migradas

| Artefacto | Evidencia | Veredicto |
|-----------|-----------|-----------|
| `referral_sale_commissions` | Solo `web/sql/migrations/12_*`; 0 runtime | **Huérfana** |
| `soundfortip_splits` | Solo web/sql; SFT usa `soundfortips_fan_requests` | **Supersedida** |
| `order_*` / `order_ledger` | TICKET-004 doc only | **No existe** |
| `mdj_orders` | `shop.html` INSERT; no migration | **Drift risk** |
| `bookings` | admin upsert; no CREATE in supabase/migrations | **Legacy / prod bootstrap** |
| `leads` | ALTER only in migrations | **Pre-repo schema** |

## 5.2 RPCs sin consumidor runtime

| RPC | Estado |
|-----|--------|
| `mdj_access_snapshot` | Documentado; bypassed |
| `mdj_client_create_event_lead` | Bypassed by direct INSERT |
| `mdj_assign_staff_to_lead` | Sin assign path |
| `mdj_redeem_discount_code` | Validate sí; redeem no |
| `mdjpro_revoke_device` | Sin caller web/edge encontrado |

## 5.3 Duplicaciones

| Área | Duplicado |
|------|-----------|
| Lead creation | RPC vs direct INSERT |
| Identity snapshot | identity.js vs identity_snapshot RPC vs access_snapshot RPC |
| SFT split math | SQL function vs `monetization.js` JS |
| Flow rollups | DB tables + client-side SFT merge |
| SQL tracks | `web/sql/migrations/` vs `supabase/migrations/` (~109 files) |
| Hero stars | Public reviews vs MDJ health (owner override) |

## 5.4 `event_notes`

Migración + RLS existen; **no browser INSERT** encontrado en paths auditados — posible wiring incompleto.

---

# PARTE 6 — Mapa financiero completo

## 6.1 Flujo real V1 (aprobado PO)

```
CLIENTE
  │ form / portal / rentals / EB
  ▼
LEAD (total_amount, deposit_required, assigned_dj, dj_agreed_payout)
  │ production save
  ▼
INVOICE opcional (mdj_staff_manual_invoices)
  │
  ├─ STRIPE ── create-event-payment ── webhook ──► leads.balance_paid
  │                                              payment_status PARTIAL|PAID
  │                                              invoice.status paid (if full)
  │
  └─ ZELLE ── client mark ── staff confirm ──► leads.balance_paid

  │ BRECHA: sin CFMovement (aprobado 3B futuro)
  │ BRECHA: sin auto-bridge a dj_ledger

  ▼ (manual staff)
staff_release_event_dj_payout
  ▼
WALLET DJ (dj_ledger income, source=event_sale_release)
  ▼
CASH FLOW ARTISTA (flow-handler.js)
  • ledger + leads assigned + SFT synthetic + health MDJ

MARKETPLACE
  • searchRankScore(PRO) — independent of wallet
  • rating secondary in EB

EMPRESA P&L
  • NO producto V1 (aprobado P1 futuro)
  • admin reads leads.balance_paid ad hoc

ANALYTICS / ESTRELLAS
  • Público: dj_public_reviews → rating
  • Privado: computeCompositeHealthScore (browser only)
```

## 6.2 Flujos financieros paralelos

| Flujo | Entrada | Destino |
|-------|---------|---------|
| Artist PRO sub | create-checkout → webhook | `dj_profiles` + MDJPRO license |
| MDJPRO app | webhook mdjpro_app | license keys |
| SFT tip | SFT checkout → webhook | fan_requests → flow tips |
| Course | course checkout → webhook | `course_purchases` |
| Shop | shop.html | `mdj_orders` (orphan schema) |
| Referral PRO | webhook | `referrals` (not sale_commissions) |

## 6.3 CFMovement (futuro — PO aprobado, no implementado)

Pipeline documentado en `CASH-FLOW-PRODUCT-DEFINITION-V1.md`:

```
Invoice → Lead → Cobro → CFMovement read-map → Payout → Reportes Artista + Empresa
```

---

# PARTE 7 — Matriz maestra

| Entidad | Writers principales | Readers principales | Eventos clave | Dependencias | Impacto cambio | Estado V1 |
|---------|---------------------|---------------------|---------------|--------------|----------------|-----------|
| **`leads`** | forms, portal, EB, production, webhook, Zelle | portal, admin, flow, agenda, matching | pago, match, complete | Stripe, profiles, invoice | **CRÍTICO** | ✅ Vivo, fragmentado |
| **`event_builder_orders`** | EB, staff-order, admin | portal, staff-order | cart save | leads | Alto | ✅ Vivo |
| **`mdj_staff_manual_invoices`** | production | production lists, webhook | paid | leads.staff_invoice_id | Medio | ✅ Vivo |
| **`dj_ledger`** | release RPC | flow-handler, rollups | payout | leads deposit gate | Alto — wallet DJ | ⚠️ Sub-alimentado |
| **`dj_profiles`** | auth, dashboard, webhook, admin | everywhere | PRO, agenda, rating | Stripe, reviews | **CRÍTICO** | ✅ Hub identidad |
| **`client_profiles`** | auth, portal, staff | portal, header, admin | VIP, buyer stripe | checkout | Alto | ✅ Vivo |
| **`public_dj_profiles`** | VIEW | find-dj, EB, profile | search | dj_profiles | Medio | ✅ Vivo |
| **`dj_public_reviews`** | submit RPC | profile bundle, admin | review | trigger rollup | Medio reputación | ✅ Vivo |
| **`soundfortips_fan_requests`** | SFT edges | profile, flow RPC | tip lifecycle | Stripe, PRO gate | Medio | ✅ Vivo |
| **`stripe-webhook`** | Stripe | idempotency read | all payments | 10+ tables | **CRÍTICO** | ✅ Congelado PO |
| **`processed_webhooks`** | webhook | webhook | idempotency | Stripe | Alto | ✅ Vivo |
| **`platform_settings`** | admin | rentals, index, admin | config | pricing UI | Medio | ✅ Vivo |
| **`certificates`** | certification, profile | verify, directory | graduación | profiles.verified | Bajo-medio | ✅ Vivo |
| **`referral_sale_commissions`** | — | — | — | diseño | Ninguno runtime | ❌ Huérfana |
| **`order_ledger`** | — | — | — | TICKET-004 | N/A | ❌ No existe |
| **`CFMovement`** | — (futuro 3B) | — (futuro) | cobro audit | all financial | N/A | 📋 Documentado |
| **`bookings`** | admin upsert | admin CRM | sync lead | leads | Medio | ⚠️ Legacy |
| **`mdj_orders`** | shop | — | shop order | — | Bajo | ⚠️ Schema drift |
| **Salud MDJ (computed)** | flow-handler JS | owner UI only | — | ledger, leads, reviews | UI only | ⚠️ No persiste |
| **Marketplace rank** | subscription.js | find-dj, EB, admin | search | dj_profiles.plan | Producto PRO | ✅ PRO-only |

---

# PARTE 8 — Riesgos

## 8.1 Dependencias ocultas

| # | Riesgo |
|---|--------|
| H1 | Cobro ≠ wallet invisible to artists — operational trust |
| H2 | EBO lines override lead notes in portal — silent data precedence |
| H3 | Webhook + Zelle both mutate `balance_paid` without unified audit trail |
| H4 | `mdj_access_snapshot` bypass — JWT vs DB drift undetected at scale |
| H5 | Hero stars owner vs fan — brand/reputation confusion |

## 8.2 Acoplamientos

| # | Acoplamiento |
|---|--------------|
| A1 | `admin-dashboard.html` monolith — CRM + matching + settings + analytics |
| A2 | `client-portal.js` (~3772 lines) — billing math + lead + chat + loyalty |
| A3 | `stripe-webhook` multi-product switch — single failure surface |
| A4 | `flow-handler` merges DB ledger + synthetic SFT client-side |

## 8.3 Duplicidad / falta de sincronización

| # | Issue |
|---|-------|
| D1 | Dual SQL migration tracks |
| D2 | RPCs designed but direct SQL used |
| D3 | referral_sale_commissions vs referrals table |
| D4 | soundfortip_splits vs fan_requests |
| D5 | TICKET-004 doc vs leads+ledger reality |
| D6 | PRO_PARTNER_POLICY GBV tiers vs code |

## 8.4 Bucles / inconsistencias

| # | Issue |
|---|-------|
| I1 | Zelle confirm sums without idempotency — double credit risk |
| I2 | No event deposit refund handler in webhook |
| I3 | Cancelled lead — no financial reversal path |
| I4 | refresh rollups from browser — timeout / partial state |

## 8.5 Deuda técnica priorizada (V2)

1. CFMovement read-map (PO aprobado 3B)
2. Cash Flow Empresa P1 (producto separado)
3. Consolidar identity → single snapshot RPC path
4. Wire or delete orphan RPCs/tables
5. Migrate `web/sql/` into supabase/migrations
6. Marketplace ranking policy (ticket separado)
7. TICKET-004 phased — north star

## 8.6 Congelado PO (no tocar sin ticket)

Manual Invoice V1, Stripe link, webhook event branch, `staff_release_event_dj_payout`, Header/Nav — per `CASH-FLOW-PRODUCT-DEFINITION-V1.md`.

---

# Apéndice A — Edge Functions (30)

| Función | Tipo | Escribe / notifica |
|---------|------|-------------------|
| `stripe-webhook` | **Hub async financiero** | Multi-table |
| `create-event-payment` | Checkout evento | leads |
| `create-checkout` | PRO sub | dj_profiles |
| `create-sft-tip-checkout` | SFT | fan_requests |
| `register-sft-fan-request` | SFT manual | fan_requests |
| `settle-sft-manual-platform-fee` | SFT billing | profiles, requests |
| `send-sft-client-sms` | SFT ops | requests, Stripe cancel/refund |
| `mdjpro-install-handoff` | MDJPRO | handoff RPC |
| `mdjpro-activate-handoff` | MDJPRO | consume handoff |
| `mdj-activate` | MDJPRO Mac | activate device |
| `mdj-heartbeat` | MDJPRO Mac | heartbeat |
| `create-platform-account` | Admin provision | profiles |
| `staff-create-client-account` | Admin provision | client_profiles |
| `admin-update` | Certs | certificates |
| `notify-new-lead` | Notify | email |
| `notify-portal-message` | Notify | email + log read |
| `notify-dj-assignment` | Notify | email |
| `notify-dj-sms` | Scheduled | event_reminders_queue |
| `notify-event-note` | Notify | email |
| `notify-photo-rejection` | Notify | dj_profiles update |
| `notify-account-profile-change` | Notify | email |
| `notify-new-device-login` | Notify | email |
| `send-certificate` | Email only | — |
| `send-subscription-welcome` | Email only | — |
| `create-buyer-billing-portal` | Client billing | client_profiles |
| `get-buyer-payment-methods` | Client billing | read client_profiles |
| `create-course-checkout` | Courses | webhook downstream |
| `verify-client-billing-unlock` | Gate | read leads |
| `booth-chat` | AI | read public_dj_profiles |
| `booth-tts` | AI | TTS |

---

# Apéndice B — Relación con documentación aprobada

| Documento | Relación |
|-----------|----------|
| `docs/architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md` | Producto financiero oficial; define brecha cobro≠wallet, CFMovement 3B, congelados |
| `docs/tickets/TICKET-004-financial-order-architecture.md` | North star **no cableado** — `order_ledger` no existe |
| `docs/AGENT-MEMORY.md` | Baseline Cash Flow 2026-07-06; tickets audit/brief/definition |
| `web/PRO_PARTNER_POLICY.md` | Policy GBV/comisiones **≠** `searchRankScore` en código |
| `docs/mdjpro-licensing-architecture.md` | MDJPRO license path (webhook + Mac edges) |

---

# Apéndice C — Tablas CREATE en supabase/migrations (39)

`dj_ledger`, `billing_settings`, `discount_codes`, `referrals`, `platform_settings`, `processed_webhooks`, `mdjb_account_ids`, `mdj_user_ids`, `dj_events`, `dj_communications`, `event_notes`, `event_builder_orders`, `mdj_event_flows`, `mdj_staff_manual_invoices`, `soundfortips_fan_requests`, `dj_flow_daily/weekly/monthly/yearly`, `dj_profile_visits`, `dj_public_reviews`, `portal_messages`, `portal_chat_email_notify_log`, `platform_tickets`, `platform_inbox_messages`, AI booth tables (4), fashion show tables (3), MDJPRO licensing tables (5), `course_purchases`, `user_login_devices`.

**Views:** `public_dj_profiles`, `ai_booth_session_training`, `event_builder_orders_staff`.

**Legacy (ALTER-only / web/sql bootstrap):** `dj_profiles`, `client_profiles`, `leads`, `certificates`, `contracts`, `payments`, `bookings`.

---

*Documento canónico del cableado V1. Cambios requieren ticket + aprobación PO. Referencia pre-desarrollo V2.*
