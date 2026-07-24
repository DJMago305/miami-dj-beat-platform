# TICKET-V1-CONTINUITY-AUDIT-001 — Auditoría de Continuidad V1 Financial / Manual Payments

**Estado:** READ ONLY — auditoría completada  
**Modo:** Sin implementación · sin commits · sin push  
**Alcance:** V1 exclusivamente (`web/`, `supabase/migrations/`, `supabase/functions/`, `docs/` de referencia V1)  
**Fuera de alcance:** V2 (`MiamiDJBeat-MigracionV2/`), incidente V1/V2 separation  
**Captura:** 2026-07-24  
**Baseline producción Git remota (referencia):** `origin/main` @ `13bb4c4790f074d4539620f7152f3f92f3fe8205` (merge PR #116, 2026-07-06) [HECHO VERIFICADO — EXEC-001/EXEC-002]

---

## Reglas de Evidencia

| Etiqueta | Uso |
|----------|-----|
| **[HECHO VERIFICADO]** | Confirmado en código, migraciones o documentación V1 citada. |
| **[INFERENCIA]** | Conclusión lógica; no equivale a hecho directo. |
| **[NO VERIFICADO]** | No comprobado en esta auditoría (p. ej. Supabase remoto aplicado). |

---

## Resumen Ejecutivo

V1 tiene un **hub comercial operativo** centrado en `public.leads` con cobro **Stripe automatizado** y **Zelle manual** para depósitos de evento. El **Cash Flow artista** (`dj_ledger` + `flow-handler.js`) está **vivo** pero **no se alimenta automáticamente** de cobros Stripe/Zelle en `leads` — solo vía RPC `staff_release_event_dj_payout`.

**Pagos manuales genéricos** (cash, check, wire, ACH, Venmo en eventos) **no tienen backend V1**. La arquitectura north star **TICKET-004** (`record-payment`, ledger unificado) está **diseñada, no implementada**.

**Último desarrollo funcional V1 documentado antes del incidente:** cierre local **TICKET-V1-INVOICE-UX-PANELS-001** + merge **PR #116** (invoice / Stripe checkout en Producción staff) — **2026-07-06**.

**Recomendación de continuidad:** el siguiente ticket más pequeño con beneficio claro es **`TICKET-V1-STAFF-OFFLINE-PAYMENT-RECORD-001`** — RPC staff + UI Producción para acreditar `leads.balance_paid` con método explícito (cash/check/wire/ACH), siguiendo el patrón existente de `staff_confirm_event_zelle_deposit`.

---

## 1. Estado del Perfil Cliente

### Superficies V1

| Superficie | Archivo | Rol financiero |
|------------|---------|----------------|
| Portal por evento | `web/client-portal.html` + `web/client-portal.js` | **Canónico** — resumen, pago, invoice PDF |
| Cuenta comprador | `web/client-account.html` + `web/js/client-account.js` | Eventos agregados + tarjetas guardadas |
| Billing legacy | `web/client-billing.html` + `web/account-billing.js` | Placeholder / redirect roto |
| Profile redirect | `web/account-profile.html` | Redirect → `account-settings.html` (artista/staff) |

### 1.1 Historial financiero

| Item | Estado | Evidencia |
|------|--------|-----------|
| Historial por evento en portal | ⚠️ Parcial — estado `payment_status` + montos en lead activo | `client-portal.js` `updatePayments()` |
| Historial de cuenta (todos los pagos) | ❌ Stub — `#ca-payment-history-empty` estático, sin loader JS | `client-account.html` L1428–1431; grep sin `loadPaymentHistory` |
| Tabla eventos con Paid/Balance | ✅ Implementado | `client-account.js` `renderEventsRows()` |

### 1.2 Payments (cobro activo)

| Método | Estado | Evidencia |
|--------|--------|-----------|
| Stripe Checkout (depósito / saldo) | ✅ | `payDepositStripe()` → Edge `create-event-payment` |
| Zelle (marca enviado) | ✅ | `markZelleDepositSent()` → RPC `client_mark_event_zelle_sent` |
| PayPal evento | ❌ | `exportFinanceMeta().paypalComingSoon: true` |
| Cash / check / wire / ACH (evento) | ❌ | Sin RPC/UI en portal |

### 1.3 Balance

| Item | Estado | Evidencia |
|------|--------|-----------|
| Balance por lead (`total_amount - balance_paid`) | ✅ | `client-portal.js` L2084–2160; columnas `leads` |
| Balance agregado cuenta | ⚠️ Parcial — por fila en tablas eventos, no ledger unificado | `client-account.js` |

### 1.4 Cash Flow (cliente)

| Item | Estado | Evidencia |
|------|--------|-----------|
| Panel Cash Flow cliente | ❌ N/A | Cash Flow es **solo artista** (`flow-handler.js`, `dj-dashboard.html?tab=flow`) |

### 1.5 Invoice

| Item | Estado | Evidencia |
|------|--------|-----------|
| Invoice PDF desde portal | ✅ | `buildInvoiceSalePayload()` + `invoice-print-bridge.js` |
| Invoice staff vinculada | ✅ | `leads.staff_invoice_id` → `mdj_staff_manual_invoices` |
| Invoice pagada vía webhook | ✅ | `stripe-webhook` marca invoice `paid` si lead PAID |

### 1.6 Payment History

| Item | Estado |
|------|--------|
| Lista transacciones cuenta | ❌ UI vacía permanente |
| Detalle por evento en portal | ⚠️ Solo estado actual del lead, no histórico de movimientos |

### 1.7 Métodos de pago (wallet comprador)

| Item | Estado | Evidencia |
|------|--------|-----------|
| Listar tarjetas guardadas | ✅ | Edge `get-buyer-payment-methods` |
| Añadir/eliminar tarjeta | ✅ | Stripe Customer Portal `create-buyer-billing-portal` |
| Billing address en perfil | ✅ | `client_profiles.billing_*` vía `saveProfile()` |
| Enlace portal → `client-billing.html` | ⚠️ Misrouting — página stub | `client-portal.html` link; `client-billing.html` placeholder |

**Clasificación global perfil cliente [INFERENCIA]:** cobro **por evento** maduro (Stripe + Zelle); **cuenta agregada** incompleta (historial/receipts stub).

---

## 2. Estado del Perfil DJ

### Superficies V1

| Superficie | Archivo | Rol |
|------------|---------|-----|
| Cash Flow live | `web/dj-dashboard.html?tab=flow`, `web/dj-profile.html?tab=flow` | KPIs + ledger + export CSV |
| Cash Flow marketing | `web/cash-flow.html` | Solo informativo — **sin** `flow-handler.js` |
| Producción staff | `web/admin-dashboard.html#production` | Cobro cliente + release payout DJ |
| Billing artista PRO | `web/dj-dashboard.html` panel billing | Suscripción MDJB (outbound) |

### 2.1 Earnings

| Item | Estado | Evidencia |
|------|--------|-----------|
| Módulo “Earnings” dedicado | ❌ | No existe página; earnings = KPIs Cash Flow |
| SFT session earnings (cabina) | ⚠️ Session-only | `sessionStorage` en `dj-profile.html` — no `dj_ledger` |

### 2.2 Balance (wallet artista)

| Item | Estado | Evidencia |
|------|--------|-----------|
| `dj_ledger` + rollups | ✅ | Migración `20260302_flow_tab_implementation.sql`; `flow-handler.js` |
| Auto-crédito por cobro cliente Stripe/Zelle | ❌ | MASTER-WIRING-AUDIT §6.1 — brecha documentada |
| Release payout manual staff | ✅ | RPC `staff_release_event_dj_payout` → INSERT `dj_ledger` |

### 2.3 Historial financiero

| Item | Estado | Evidencia |
|------|--------|-----------|
| Bank-style statement | ✅ | `#ledger-body`, grains day/week/month/year |
| SFT tips en Flow | ✅ | RPC `get_my_soundfortips_accepted_for_flow` |
| Referral commissions KPI | ✅ | metadata `source=commission` en ledger |

### 2.4 Dashboard financiero

| Item | Estado | Evidencia |
|------|--------|-----------|
| KPI gross / available / tips | ✅ | `#kpi-gross`, `#kpi-available`, `#kpi-tips` |
| Charts timeline/activity | ✅ | Chart.js en dashboard flow tab |
| Export fiscal CSV | ✅ | Dashboard flow (no en profile tab duplicado) |

### 2.5 Invoice (lado DJ)

| Item | Estado | Evidencia |
|------|--------|-----------|
| DJ ve invoice cliente | ❌ directo | DJ ve payout acordado en lead/production, no invoice PDF cliente |
| `dj_agreed_payout_usd` | ✅ | Columna `leads`; gate con depósito recibido |

### 2.6 Cash Flow

| Item | Estado | Evidencia |
|------|--------|-----------|
| Engine completo | ✅ | `flow-handler.js` (~1786 líneas) |
| Duplicación UI dashboard vs profile | ⚠️ | Dos markup copies — riesgo drift [INFERENCIA] |
| Copy “reflect checks in ledger” | ⚠️ | `cash-flow.html` — **sin** RPC para hacerlo |

**Clasificación global perfil DJ [INFERENCIA]:** Cash Flow **producción-ready** para lectura wallet; **desconectado** del pipeline automático de cobros en `leads`.

---

## 3. Stripe

### Qué ya funciona [HECHO VERIFICADO]

| Flujo | Edge / webhook | Tablas afectadas |
|-------|----------------|------------------|
| Depósito evento (cliente/staff) | `create-event-payment` → `stripe-webhook` | `leads.balance_paid`, `payment_status`, `stripe_session_id` |
| MDJ Pro / artista PRO | `create-checkout` → webhook | `dj_profiles`, `payments`*, `referrals` |
| Curso | `create-course-checkout` → webhook | `course_purchases` |
| SFT tip tarjeta | `create-sft-tip-checkout` → webhook + capture SMS | `soundfortips_fan_requests` |
| Tarjetas comprador | `get-buyer-payment-methods`, `create-buyer-billing-portal` | Stripe Customer |
| SFT fee manual (carga DJ) | `settle-sft-manual-platform-fee` | Stripe charge on DJ card |

\* Tabla `payments`: INSERT en webhook; **CREATE TABLE no encontrado** en migraciones repo [HECHO VERIFICADO grep].

### Qué depende únicamente de Stripe

| Capacidad | Sin Stripe |
|-----------|------------|
| Checkout tarjeta evento | No hay acreditación automática `balance_paid` |
| Renovación PRO | No |
| SFT tip card path | No |
| Buyer saved cards | No |
| Idempotencia cobro | `processed_webhooks` |

### Flujo existente (evento)

```
Staff/Cliente → create-event-payment (POST lead_id, amount_cents)
  → Stripe Checkout Session
  → checkout.session.completed (metadata.lead_id)
  → stripe-webhook incrementa leads.balance_paid
  → payment_status PARTIAL | PAID
  → mdj_staff_manual_invoices.status = paid (si saldo completo)
```

**Archivo canónico:** `supabase/functions/stripe-webhook/index.ts`

### Qué limita registrar pagos manuales (no-Stripe)

| Limitación | Evidencia |
|------------|-----------|
| Webhook solo procesa eventos Stripe | No branch cash/check/wire |
| `leads` no tiene columna `payment_method` | Migración `20260513710000_event_sales_staff_cobro.sql` |
| Único RPC manual evento = **Zelle** | `staff_confirm_event_zelle_deposit` — hardcoded semántica depósito |
| No existe `record-payment` Edge | TICKET-004g — **pendiente** |
| Stripe webhook **no** escribe `dj_ledger` | MASTER-WIRING-AUDIT §1.6, §6.1 |

---

## 4. Manual Payments — Búsqueda de Evidencia

| Término / concepto | ¿Existe? | UI | Backend DB | Notas |
|--------------------|----------|-----|------------|-------|
| **Zelle** (evento) | ✅ Completo (evento) | Portal + Producción | RPCs `client_mark_event_zelle_sent`, `staff_confirm_event_zelle_deposit` | Único rail manual **operativo** en leads |
| **Cash** | ❌ | Copy informativo `cash-flow.html` | No | — |
| **Check** | ❌ | Copy only | No | TICKET-004 doc menciona `pay_method` — **no tabla** |
| **Wire Transfer** | ❌ | No | No | V2 enums en discovery docs only |
| **ACH** | ❌ | No | No | — |
| **Venmo** | ⚠️ Parcial | SFT fan tips UI + `sft_pay_venmo_instructions` | `payment_channel=manual` SFT only — **no** leads | Honor system; no verificación inbound |
| **CashApp** | ❌ | No | No | — |
| **Offline Payment** | ⚠️ Parcial | Texto portal manager mode (PCI) | No RPC genérico | `client-portal.js` L306 |
| **Manual Payment** | ⚠️ Parcial | Staff Zelle confirm; SFT manual | Zelle RPC; SFT `register-sft-fan-request` | No modelo unificado |
| **Payment Method** | ⚠️ Parcial | Buyer cards (Stripe); shop UI strings | `client_profiles.buyer_stripe_customer_id` | No enum en `leads` |
| **Record Payment** | ❌ | No | TICKET-004g planificado | — |
| **Mark As Paid** | ⚠️ Parcial | EBO dropdown manual `event_builder_orders.payment_status` | **No** sync a `leads.balance_paid` | admin-dashboard |
| **Mark As Paid** (lead) | ⚠️ Parcial | Zelle confirm = efecto similar | `staff_confirm_event_zelle_deposit` | Solo Zelle |

### Respuestas consolidadas

| Pregunta | Respuesta |
|----------|-----------|
| ¿Existe implementación manual payments genérica? | **NO** |
| ¿Existe parcialmente? | **SÍ** — Zelle (eventos) + SFT manual tips + EBO flag manual |
| ¿Existe solo UI? | **SÍ** — shop simulated checkout, client-billing stubs, cash-flow copy |
| ¿Existe backend? | **SÍ solo para Zelle + Stripe + SFT manual channel** |
| ¿Existe base de datos? | **SÍ parcial** — `leads.balance_paid`, `payment_status`; sin `payment_method` en leads |

---

## 5. Base de Datos

### Tablas V1 relevantes [HECHO VERIFICADO — migraciones en repo]

| Tabla | Columnas / campos financieros clave |
|-------|-------------------------------------|
| `public.leads` | `total_amount`, `balance_paid`, `payment_status`, `deposit_required_usd`, `stripe_customer_id`, `stripe_session_id`, `staff_invoice_id`, `dj_agreed_payout_usd`, `dj_payout_released_at` |
| `public.mdj_staff_manual_invoices` | `status` (draft/sent/paid/void) — **sin** `payment_method` |
| `public.dj_ledger` | `type`, `amount_cents`, `status`, `metadata` |
| `public.event_builder_orders` | `payment_status`, `amount_paid_usd`, `deposit_usd`, `total_usd`, `stripe_pi_id` (columna **sin writer** encontrado) |
| `public.billing_settings` | `zelle_email`, `zelle_name` |
| `public.client_profiles` | `buyer_stripe_customer_id`, `billing_*` |
| `public.soundfortips_fan_requests` | `payment_channel` (manual/stripe), status lifecycle |

### Columnas buscadas — resultado grep migraciones V1

| Columna / concepto | Encontrado en V1 runtime |
|--------------------|--------------------------|
| `payment_method` | ❌ en `leads` / invoices — shop.html string only; orphan `mdj_orders` |
| `payment_status` | ✅ `leads`, `event_builder_orders` |
| `manual_payment` | ❌ |
| `transaction_type` | ❌ en leads — `dj_ledger.type` |
| `received_by` | ❌ |
| `received_date` | ❌ |
| `reference_number` | ❌ |
| `payment_reference` | ❌ |
| `payment_notes` | ❌ |

**North star no implementado:** `order_client_financials`, `order_ledger` — solo en `docs/tickets/TICKET-004-financial-order-architecture.md`.

---

## 6. Flujo Actual

### Diagrama V1 aprobado PO [HECHO VERIFICADO — MASTER-WIRING-AUDIT §6.1]

```
CLIENTE
  │ form / portal / rentals / Event Builder
  ▼
RESERVA → LEAD
  │ (total_amount, deposit_required, assigned_dj, dj_agreed_payout_usd)
  │ staff: production-module save
  ▼
INVOICE (opcional)
  │ mdj_staff_manual_invoices + print PDF
  ▼
COBRO
  ├─ STRIPE ── create-event-payment ── webhook ──► leads.balance_paid ↑
  │                                              payment_status PARTIAL|PAID
  │
  └─ ZELLE ── client_mark_event_zelle_sent (PENDING_ZELLE)
            ── staff_confirm_event_zelle_deposit ──► leads.balance_paid ↑

  ✗ CASH / CHECK / WIRE / ACH / VENMO (evento) ──► SIN CAMINO

  ▼ (manual staff, post-depósito)
staff_release_event_dj_payout ──► dj_ledger (event_sale_release)

  ▼
ESTADO FINAL (cliente)
  payment_status: UNPAID | PENDING_ZELLE | PARTIAL | PAID
  balance_paid vs total_amount
  invoice.status paid (si aplicable)

ESTADO FINAL (DJ wallet)
  dj_ledger row SOLO tras release RPC — NO automático al cobrar cliente
```

### Dónde deja de funcionar si el pago NO entra por Stripe

| Paso | Comportamiento |
|------|----------------|
| Cliente elige Zelle en portal | ✅ Flujo manual continúa — **requiere** staff confirm |
| Cliente paga cash/check/wire en persona | ❌ **No hay UI staff** genérica para acreditar `balance_paid` |
| Staff marca EBO `payment_status=paid` | ⚠️ Actualiza **solo** `event_builder_orders` — **no** `leads` |
| Staff intenta “Mark as paid” en admin leads grid | ❌ Columnas financieras **fetch** pero **no renderizadas** — sin acción |
| DJ espera ver cobro en Cash Flow | ❌ Cobro en `leads` **no** crea fila `dj_ledger` hasta `staff_release_event_dj_payout` |
| Invoice PDF refleja pago offline | ⚠️ Print muestra totales del lead; pago offline no registrado → estados incorrectos |

**Punto de ruptura principal [INFERENCIA]:** cualquier pago **que no sea Stripe webhook ni Zelle RPC** no incrementa `leads.balance_paid` — el sistema queda en `UNPAID`/`PARTIAL` incorrecto salvo intervención manual no instrumentada.

---

## 7. Necesidades Operativas vs Soporte V1 Hoy

| Escenario negocio | Soporte V1 hoy | Notas |
|-------------------|----------------|-------|
| Cliente paga por **Zelle** | ✅ | Portal marca enviado + staff confirma RPC |
| Cliente paga **Cash** | ❌ | Sin registro en `leads` |
| Cliente paga **Check** | ❌ | Sin registro; TICKET-004 diseña campos futuros |
| Cliente paga **ACH** | ❌ | — |
| Cliente paga **Wire** | ❌ | — |
| Cliente paga **parcialmente** (múltiples pagos) | ⚠️ Parcial | Stripe/Zelle RPC **acumulan** `balance_paid`; segundo pago offline sin rail |
| Cliente paga **después del evento** | ⚠️ Parcial | Stripe/Zelle técnicamente posibles si staff mantiene lead abierto; sin workflow “post-event manual” |
| Cliente paga con **tarjeta** | ✅ | Stripe Checkout |
| DJ recibe payout acordado | ⚠️ Parcial | Manual `staff_release_event_dj_payout` tras depósito |
| Empresa ve P&L unificado | ❌ | Admin analytics lee `leads.balance_paid` ad hoc — no producto |

---

## 8. Gap Analysis

| Funcionalidad | Estado | Evidencia principal |
|---------------|--------|---------------------|
| Lead comercial (`total`, `balance_paid`, status) | ✅ Existe | `20260513710000_event_sales_staff_cobro.sql` |
| Staff manual invoice + print PDF | ✅ Existe | `production-module.js`, TICKET-V1-INVOICE-UX-PANELS-001 |
| Stripe event checkout + webhook | ✅ Existe | `create-event-payment`, `stripe-webhook` |
| Zelle event deposit (cliente + staff) | ✅ Existe | `20260513900000_event_zelle_deposit.sql` |
| Producción Panel 5 (Stripe depósito/total) | ✅ Existe | `production-module.js` — merged PR #116 |
| Client portal financial summary | ✅ Existe | `client-portal.js` |
| Client portal Stripe pay | ✅ Existe | `payDepositStripe()` |
| Client portal Zelle | ✅ Existe | `markZelleDepositSent()` |
| Client saved cards (Stripe) | ✅ Existe | `get-buyer-payment-methods` |
| Invoice PDF from portal | ✅ Existe | `invoice-print-bridge.js` |
| Artist Cash Flow ledger | ✅ Existe | `flow-handler.js` |
| DJ payout release to ledger | ✅ Existe | `staff_release_event_dj_payout` |
| Generic offline payment record (cash/check/wire/ACH) | ❌ No existe | TICKET-004g pendiente |
| `payment_method` on lead/invoice | ❌ No existe | Gap vs TICKET-004 |
| Unified `order_ledger` / TICKET-004 layers | ❌ No existe | Doc only |
| Auto-bridge lead payment → `dj_ledger` | ❌ No existe | MASTER-WIRING-AUDIT §6.1 |
| Client account payment history | ❌ No existe | Stub UI |
| Client billing page (`client-billing.html`) | ⚠️ Parcial | Placeholder |
| Receipts archive | ⚠️ Parcial | Stub copy |
| Shop offline payment simulation | ⚠️ Parcial | UI only → orphan `mdj_orders` |
| EBO payment_status vs leads sync | ⚠️ Parcial | Manual enum only |
| SFT Venmo/PayPal manual tips | ⚠️ Parcial | SFT only, not events |
| Manager discount (Production) | ⚠️ Parcial | Placeholder UI |
| Admin leads grid financial columns | ⚠️ Parcial | Data fetched, not shown |
| CFMovement read-map pipeline | ❌ No existe | CASH-FLOW-PRODUCT-DEFINITION — futuro |
| PayPal event payments | ❌ No existe | `paypalComingSoon: true` |
| Production copy payment link | ✅ Existe | `production-module.js` `#prod-inv-action-copy-link` wired [HECHO VERIFICADO grep] |
| Supabase remoto = migraciones repo | [NO VERIFICADO] | Requiere check PO en proyecto Supabase |

---

## 9. Continuidad

### 9.1 ¿Cuál fue el último desarrollo funcional realizado?

| Item | Detalle | Clasificación |
|------|---------|---------------|
| **Ticket cerrado PO** | **TICKET-V1-INVOICE-UX-PANELS-001** — Paneles Producción 1–5, guardar lead/invoice, print, Stripe checkout, depósito/total | [HECHO VERIFICADO] `docs/tickets/TICKET-V1-INVOICE-UX-PANELS-001.md` |
| **Merge producción Git** | **PR #116** → `origin/main` @ `13bb4c4` — “Invoice V1, Cash Flow baseline and Owner Staff profile navigation” | [HECHO VERIFICADO] git log `origin/main` |
| **Commits clave en línea invoice** | `7445089` feat(invoice): complete manual invoice UX panels · `0f8c598` feat(invoice): add Stripe payment link workflow | [HECHO VERIFICADO] git log |
| **Documentación congelada mismo día** | MASTER-WIRING-AUDIT, invoice/cashflow baselines (`08911c2` docs) | [HECHO VERIFICADO] git log |
| **Zelle event (anterior)** | `38368a0` feat(payments): Zelle event deposit + portal access stability | [HECHO VERIFICADO] git log `client-portal.js` |

**Nota:** El trabajo **inmediatamente anterior** al incidente V1/V2 fue **documentación forense + EXEC-001/002** — **no** desarrollo funcional V1 financiero.

### 9.2 ¿En qué porcentaje quedó?

Estimación **por área** [INFERENCIA] — para planificación, no métrica formal:

| Área | % aprox. | Fundamento |
|------|----------|------------|
| Cobro evento **Stripe** | **~90%** | E2E webhook + portal + production |
| Cobro evento **Zelle** | **~85%** | RPC + portal + production confirm |
| **Manual payments genéricos** (cash/check/wire/ACH) | **~5%** | Solo copy; 0% backend leads |
| **TICKET-004** north star (ledger 5 capas) | **~0%** | Diseño doc; sin tablas |
| Client **payment history / receipts** | **~15%** | UI shell |
| Puente **lead cobro → dj_ledger** | **~40%** | Release RPC existe; auto-bridge no |
| Staff **Production** invoice UX | **~85%** | PO cerró ticket; manager discount pendiente |

**Línea de trabajo interrumpida para “manual payments” completo [INFERENCIA]:** la investigación pausó antes de iniciar **TICKET-004 sub-tickets** (especialmente **004g** `record-payment`) o extensión Zelle→multi-method. El PO había dejado baseline local aprobada **sin push** el 2026-07-06; producción remota refleja PR #116 merge.

### 9.3 ¿Qué falta exactamente?

**Prioridad operativa (manual payments / continuidad V1):**

1. **RPC + UI staff** para registrar pagos offline en `leads` (cash, check, wire, ACH) con monto, método, referencia, fecha, notas — patrón análogo a `staff_confirm_event_zelle_deposit`.
2. **Columna o metadata** `payment_method` / audit trail append-only (TICKET-004 F layer — mínimo viable).
3. **Client payment history** — leer de `leads` + futuros movimientos; reemplazar stub `#ca-payment-history-empty`.
4. **Sincronización EBO** `event_builder_orders` ↔ `leads` (o deprecar dual write).
5. **Manager discount** en Production (placeholder existente).
6. **Puente opcional** cobro confirmado → movimiento Cash Flow / CFMovement (roadmap PO — no urgente para registrar pago).
7. **TICKET-004 phased** — north star; no big-bang.

**Pendientes menores ya documentados (TICKET-V1-INVOICE-UX-PANELS-001):**

- Manager Discount lógica
- Pulido visual Panel 5
- Hardening server-side `payment_mode` metadata

### 9.4 ¿Cuál es el siguiente ticket más pequeño para continuar?

**Recomendado:** `TICKET-V1-STAFF-OFFLINE-PAYMENT-RECORD-001`

| Campo | Valor |
|-------|-------|
| **Beneficio claro** | Staff puede acreditar cash/check/wire/ACH en `leads.balance_paid` — desbloquea escenarios reales Miami |
| **Riesgo conocido** | 🟠 Medio — toca RPC + `leads` + UI Production; **no** producción Stripe webhook |
| **Plan reversión** | RPC idempotente + audit log; feature flag PO; rollback migración DROP FUNCTION |
| **Alcance mínimo** | SQL: `staff_record_offline_payment(p_lead_id, p_amount, p_method, p_reference, p_notes)` · UI: Panel 5 Producción botón “Registrar pago offline” · Sin TICKET-004 completo |
| **Alternativa más pequeña (solo UX)** | Wire client payment history from existing `leads` rows — **no** resuelve staff record offline |

**Precondición PO:** confirmar Supabase remoto incluye migraciones `202605137*` y `202605139*` [NO VERIFICADO en esta auditoría].

---

## Referencias V1 Consultadas

| Documento / artefacto | Uso |
|----------------------|-----|
| `docs/tickets/TICKET-V1-INVOICE-UX-PANELS-001.md` | Último ticket funcional cerrado |
| `docs/tickets/TICKET-004-financial-order-architecture.md` | North star pendiente |
| `docs/architecture/MASTER-WIRING-AUDIT-V1.md` | Flujo real + brechas |
| `docs/architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md` | CFMovement futuro |
| `supabase/migrations/20260513710000_event_sales_staff_cobro.sql` | Schema leads cobro |
| `supabase/migrations/20260513900000_event_zelle_deposit.sql` | Zelle RPCs |
| `web/client-portal.js`, `web/js/production-module.js`, `web/flow-handler.js` | Runtime V1 |
| `web/js/client-account.js` | Client account payments |
| EXEC-001 / EXEC-002 | Confirmación prod intacta post-incidente |

---

## Declaración de Alcance

- **Solo lectura** del codebase y documentación V1.
- **No se modificó** código, Supabase remoto, GitHub, Vercel, producción.
- **No se crearon** commits ni push.
- **Esperando instrucciones** del Product Owner para siguiente ticket de implementación.

---

*TICKET-V1-CONTINUITY-AUDIT-001 · Auditoría de continuidad V1 · READ ONLY*
