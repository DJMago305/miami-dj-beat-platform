# CFMovement Read-Map Spec — V1

**Ticket:** `TICKET-V1-CFMOVEMENT-READ-MAP-SPEC-001`  
**Persistencia:** `TICKET-V1-CFMOVEMENT-READ-MAP-SPEC-PERSIST-001`  
**Modo:** Documentación / arquitectura — contrato para implementación futura  
**Estado:** Aprobado PO — spec persistido (sin implementación)  
**Base:** `docs/architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md` (Opción **3B**), `docs/architecture/MASTER-WIRING-AUDIT-V1.md`, baseline Invoice commits `62cd301` + `d492306`

**Referencia producto congelada:** Cash Flow Artista **1D**, CFMovement **3B read-map primero**, **sin auto-release** payout.

---

## 1. Propósito

Definir cómo Miami DJ Beat **lee, normaliza y expone** movimientos financieros existentes como registros conceptuales **CFMovement**, en modo **observador (read-map)**, para:

- Audit trail unificado (brecha H3 del Master Wiring: webhook + Zelle sin trail común).
- Base de reportes **Cash Flow Artista (1D)** y **Cash Flow Empresa (P1)** sin reescribir fuentes V1.
- Primer escalón hacia capa **F** de TICKET-004 (`order_ledger` north star), **sin** crear `order_ledger` ni alterar semántica de pagos.

CFMovement fase 1 es **derivación read-only**: ningún writer V1 congelado se modifica; ningún payout se auto-libera.

---

## 2. Qué problema resuelve

| Problema V1 | Cómo lo resuelve read-map |
|-------------|---------------------------|
| `leads.balance_paid` es acumulado, no log append-only | Reconstruye **deltas** de cobro por canal con claves idempotentes |
| Stripe webhook y Zelle RPC escriben el mismo campo sin auditoría común | Unifica hechos bajo `movement_type` + `source_system` + `idempotency_key` |
| Cobro cliente ≠ wallet DJ (confianza operativa H1) | Separa explícitamente `client_*` vs `dj_payout` en el mismo timeline por `lead_id` |
| Admin/Owner lee P&L ad hoc sobre `leads` | Prepara vista empresa sin mezclar tab artista |
| Cash Flow runtime mezcla ledger + SFT sintético en browser | Contrato para **centralizar lectura** en fase implement (sin tocar `flow-handler.js` en este ticket) |
| Sin trazabilidad invoice ↔ cobro ↔ release | Encadena `staff_invoice_id` → `lead_id` → cobros → `dj_ledger` |

---

## 3. Qué NO resuelve todavía

- **No** crea tabla `cf_movements` ni `order_ledger` (implementación = ticket aparte).
- **No** escribe en `leads`, `dj_ledger`, Invoice, webhook, Zelle RPC ni `staff_release_event_dj_payout`.
- **No** auto-libera payout DJ ni cambia gates de release.
- **No** calcula margen empresa, comisiones seller/manager (%), ni P&L completo (Cash Flow Empresa UI = P1 posterior).
- **No** reconcilia refunds Stripe event deposit (I2: no handler hoy).
- **No** revierte movimientos en leads cancelados (I3: sin path financiero).
- **No** unifica shop (`mdj_orders`), cursos, referrals PRO, MDJPRO license en el **scope evento comercial** (van en apéndice paralelo opcional fase 1.1).
- **No** reemplaza Salud MDJ computada en browser (`computeCompositeHealthScore`).
- **No** corrige hero público = reviews only.
- **No** implementa writers aditivos fase 2+.

---

## 4. Fuentes actuales de datos

### 4.1 Scope primario (pipeline evento comercial PO)

| Fuente | Rol en read-map | Tipo lectura |
|--------|-----------------|--------------|
| **`leads`** | Hub: montos, cobro acumulado, status, DJ asignado, payout acordado | READ — delta inference |
| **`mdj_staff_manual_invoices`** | Invoice staff ligada a lead | READ — contexto + paid |
| **`processed_webhooks`** | Idempotencia Stripe | READ — evento + timestamp |
| **`stripe-webhook` efectos** (vía tablas mutadas) | Cobro confirmado, invoice paid | READ indirecto — **no modificar función** |
| **`create-event-payment` metadata** (en lead/session refs si existen) | Modo depósito vs total | READ |
| **RPC Zelle** (`client_mark_event_zelle_sent`, `staff_confirm_event_zelle_deposit`) | Estados + incremento `balance_paid` | READ — vía lead + payment_status |
| **`dj_ledger`** | Único writer wallet evento: `staff_release_event_dj_payout` | READ — 1 fila ≈ 1 `dj_payout` |
| **`mdj_event_flows`** | Contexto operativo producción (opcional enriquecimiento) | READ opcional |

### 4.2 Campos lead críticos para mapeo (conceptual)

`id`, `total_amount`, `deposit_required`, `balance_paid`, `payment_status`, `status`, `assigned_dj_id`, `dj_agreed_payout_usd`, `staff_invoice_id`, `client_id` / email, timestamps (`created_at`, `updated_at`).

### 4.3 Scope secundario (paralelo — fase 1.1 documentada, no bloqueante)

| Fuente | Movimiento conceptual |
|--------|----------------------|
| `soundfortips_fan_requests` + webhook SFT | `tip_gross`, `tip_net`, `platform_fee` |
| `dj_profiles` + webhook PRO | `subscription` |
| `course_purchases` | `subscription` / producto educación |
| `referrals` | comisión referido PRO (no `referral_sale_commissions` — huérfana) |
| `payments` (si filas event-linked) | Corroboración Stripe |

### 4.4 Fuentes explícitamente excluidas fase 1

- `order_ledger`, `order_*` (no existen).
- `referral_sale_commissions`, `soundfortip_splits` (huérfanas).
- `mdj_orders` (schema drift shop).

---

## 5. Eventos financieros detectables

### 5.1 Pipeline evento (obligatorio fase 1)

| # | Evento de negocio | Detección read-map | CFMovement(s) generado(s) |
|---|-------------------|--------------------|---------------------------|
| E1 | Invoice guardada (sin cobro) | `mdj_staff_manual_invoices` INSERT + `leads.staff_invoice_id` | **Ninguno financiero** — opcional evento comercial `invoice_issued` (amount=0, audit only) |
| E2 | Checkout Stripe iniciado | `create-event-payment` + lead payment pending | `client_payment` **pending** (opcional; si no hay fila intermedia, omitir) |
| E3 | Stripe webhook — depósito parcial | `balance_paid` ↑ + `payment_status` PARTIAL + webhook id | `client_deposit` **posted** |
| E4 | Stripe webhook — pago total | `balance_paid` → total + PAID + invoice paid | `client_payment` **posted** (+ invoice link) |
| E5 | Cliente marca Zelle enviado | `payment_status` → PENDING_ZELLE | `client_deposit` o `client_payment` **pending** |
| E6 | Staff confirma Zelle | RPC confirm + `balance_paid` ↑ | `client_deposit` / `client_payment` **posted** |
| E7 | Staff libera payout DJ | `staff_release_event_dj_payout` → `dj_ledger` | `dj_payout` **posted** |
| E8 | Lead cancelado post-cobro | `status` CANCELLED | **Gap V1** — marcar `adjustment` **pending reversal** doc-only; sin writer |

### 5.2 SoundForTips (fase 1.1)

| Evento | CFMovement |
|--------|------------|
| Tip pagado (webhook) | `tip_gross` posted |
| Tip aceptado DJ | `tip_net` posted (artista) + `platform_fee` posted (empresa) |

### 5.3 Suscripciones / otros (out of scope fase 1 core)

Documentados para extensión; **no mezclar** en timeline evento salvo filtro explícito por producto.

---

## 6. Campos conceptuales de CFMovement

Registro **append-only conceptual** (virtual o persistido en fase implement):

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `id` | UUID | Sí | Estable; derivado de `idempotency_key` hash si no hay tabla |
| `occurred_at` | timestamptz | Sí | Momento del **hecho** (webhook time > lead.updated_at > ledger.created_at) |
| `mapped_at` | timestamptz | Sí | Cuándo el read-map materializó (audit del observador) |
| `lead_id` | UUID | Condicional | FK hub evento |
| `staff_invoice_id` | UUID | Opcional | FK invoice staff |
| `dj_ledger_id` | UUID | Opcional | FK payout wallet |
| `assigned_dj_id` | UUID | Opcional | Artista afectado |
| `client_id` | UUID | Opcional | Comprador |
| `movement_type` | enum | Sí | Ver §10 |
| `channel` | enum | Sí | `stripe`, `zelle`, `manual`, `internal` |
| `amount_usd` | decimal signed | Sí | Positivo = entrada al rol counterparty; signo empresa vs artista según tipo |
| `currency` | text | Sí | Default `USD` |
| `counterparty_role` | enum | Sí | `client`, `artist`, `company`, `seller`, `manager`, `platform` |
| `status` | enum | Sí | `posted`, `pending`, `reversed`, `void` |
| `source_system` | enum | Sí | Ver mapeo §7 |
| `source_record_ref` | text | Sí | p.ej. `processed_webhooks:{id}`, `dj_ledger:{id}`, `lead_delta:{lead_id}:{seq}` |
| `idempotency_key` | text | Sí | Único global — §8 |
| `payment_mode` | enum | Opcional | `deposit`, `full_balance`, `partial`, `unknown` |
| `balance_before_usd` | decimal | Opcional | Snapshot lead pre-hecho |
| `balance_after_usd` | decimal | Opcional | Snapshot lead post-hecho |
| `metadata` | json | Opcional | Stripe session id, staff uid, notas — **sin PII sensible en logs públicos** |
| `visibility_scope` | set | Sí | Subset de roles — §9 |
| `product_line` | enum | Sí | `event_commercial`, `soundfortips`, `subscription`, `other` |

### Valores `movement_type` (enum)

`client_deposit`, `client_payment`, `client_refund`, `dj_payout`, `platform_fee`, `tip_gross`, `tip_net`, `subscription`, `adjustment`, `invoice_issued` (audit comercial, amount=0).

**Regla semántica PO:** `client_*` **nunca** implica `dj_payout`. Son filas distintas en el mismo timeline.

---

## 7. Mapeo fuente → CFMovement

### 7.1 Stripe event deposit (congelado — solo lectura)

```
INPUT:  processed_webhooks (event_type checkout.session.completed | payment_intent.succeeded)
        + leads row (post-image via read)
        + mdj_staff_manual_invoices (if staff_invoice_id)
INFER:  delta_usd = balance_paid_after - balance_paid_before (per webhook event)
TYPE:   if delta < (total_amount - balance_before) AND deposit_required met → client_deposit
        if balance_after >= total_amount (tolerance) → client_payment
CHANNEL: stripe
SOURCE: stripe_webhook
KEY:    stripe:{processed_webhooks.id} OR stripe:{payment_intent_id}:{lead_id}
STATUS: posted
SCOPE:  owner, manager, seller(read-only aggregate), client(own), dj(no client amount detail — see §9)
```

### 7.2 Zelle

```
INPUT:  lead.payment_status transition + balance_paid delta
        staff_confirm_event_zelle_deposit RPC effect (read lead after)
PENDING: payment_status = PENDING_ZELLE → movement pending, amount = expected deposit or pending balance
POSTED:  after staff confirm → same typing as Stripe partial/full
CHANNEL: zelle
SOURCE:  zelle_rpc
KEY:     zelle:{lead_id}:confirm:{balance_after_usd}:{occurred_at_day}  (refinar en implement)
RISK:    I1 double confirm — key MUST include monotonic seq or RPC return id if exposed
```

### 7.3 DJ payout release (congelado — solo lectura)

```
INPUT:  dj_ledger row WHERE source = event_sale_release (or equivalent)
        + lead via release RPC side effects
TYPE:   dj_payout
AMOUNT: +dj_ledger.amount_usd to counterparty_role=artist
CHANNEL: internal
SOURCE: release_rpc
KEY:    ledger:{dj_ledger.id}
STATUS: posted
SCOPE:  owner, manager, dj(own), client(none), seller(none)
```

### 7.4 Invoice paid (correlación, no duplicar cobro)

```
INPUT:  mdj_staff_manual_invoices.status = paid
RULE:   NO crear segundo movimiento de cobro si ya existe client_* posted con mismo lead + amount
        Opcional: enrichment metadata on existing CFMovement (invoice_id, paid_at)
SOURCE: stripe_webhook | zelle_rpc (enrichment only)
```

### 7.5 Invoice issued (audit comercial opcional)

```
TYPE:   invoice_issued (non-cash) OR omit
AMOUNT: 0
STATUS: posted (informational)
SCOPE:  owner, manager, seller
```

### 7.6 SFT (fase 1.1)

```
INPUT:  soundfortips_fan_requests status + amount fields
TYPE:   tip_gross (webhook paid) → tip_net + platform_fee (on accept/settle)
SOURCE: stripe_webhook | sft_rpc | settle-sft-manual-platform-fee
KEY:    sft:{fan_request_id}:{stage}
```

### 7.7 Delta inference algorithm (contrato implement)

1. Ordenar candidatos por `occurred_at` ascendente por `lead_id`.
2. Para cada webhook Zelle/Stripe confirmado, calcular `delta_usd` vs snapshot anterior **del mismo lead**.
3. Si `delta_usd <= 0` → no emitir (idempotente skip).
4. Clasificar deposit vs full usando `deposit_required`, `total_amount`, `payment_mode` metadata si disponible.
5. Emitir CFMovement; registrar `balance_before/after`.
6. **Nunca** escribir de vuelta a `leads`.

---

## 8. Reglas de idempotencia

| Regla | Detalle |
|-------|---------|
| **I-1** | Un `idempotency_key` → máximo un CFMovement `posted` |
| **I-2** | Re-ejecutar read-map completo produce mismo set (determinista) |
| **I-3** | Stripe: preferir `processed_webhooks.id`; fallback `payment_intent` + `lead_id` |
| **I-4** | Zelle: `lead_id` + confirm event + `balance_after` — alertar si duplicate confirm (I1) |
| **I-5** | Payout: 1:1 `dj_ledger.id` — nunca duplicar por re-read lead |
| **I-6** | Re-map no **revierte** fuente; solo puede emitir `reversed` si implement futuro detecta contradicción documentada |
| **I-7** | Pending → posted: misma key base con suffix `:posted` **prohibido** — actualizar status in-place en store fase implement, o emitir single posted si pending no persistió |
| **I-8** | Full re-sync: `mapped_at` nuevo; `id` estable por key |

**Clave compuesta recomendada:**

`{product_line}:{movement_type}:{source_system}:{source_native_id}`

---

## 9. Reglas de visibilidad

Matriz **read-map** (qué filas devuelve la API/RPC futura):

| Rol | Ve | No ve | Agregación permitida |
|-----|-----|-------|----------------------|
| **Owner** | Timeline completo evento: client_*, dj_payout, fees, invoice links, metadata Stripe | Secrets Stripe raw card | Totales empresa, margen bruto (derivado) |
| **Manager** | Igual Owner en módulos producción/finanzas staff | Config plataforma global no financiera | Igual Owner |
| **Seller** | Leads propios/comisionables: cobros posted agregados, invoice issued | `dj_agreed_payout_usd`, payout DJ detalle, client PII full | `% cobrado vs total` sin wallet DJ |
| **DJ (artista)** | `dj_payout` propios, tips SFT propios, eventos asignados (montos payout acordado) | **Montos cobro cliente detallados** salvo política PO futura; no margen empresa | Wallet = sum `dj_payout` + tips; **no** confundir con `balance_paid` |
| **Cliente** | Sus `client_deposit` / `client_payment` en sus leads | Payout DJ, margen, comisiones, otros clientes | Solo saldo pagado / pendiente propio |

### Reglas PO reforzadas

- DJ Cash Flow tab consume subset **artist** — alineado 1D; cobro cliente aparece como **estado evento** (`leads`), no como wallet.
- Seller **no** es staff management full — acotar por RLS futuro a leads seller-attributed (cuando exista campo; hoy documentar gap).
- Owner/Manager ven read-map en **Cash Flow Empresa P1** (UI futura); DJ lo ve filtrado en **Cash Flow Artista** (enriquecimiento futuro de timeline, sin reemplazar wallet actual en fase 1).

---

## 10. Estados del movimiento

| Estado | Significado | Transiciones permitidas |
|--------|-------------|-------------------------|
| **`pending`** | Hecho anunciado no confirmado (Zelle marcado, checkout iniciado) | → `posted`, → `void` |
| **`posted`** | Hecho confirmado en fuente V1 | → `reversed` (solo fase 4+ con refund explícito) |
| **`reversed`** | Contra-asiento append-only (futuro) | Terminal |
| **`void`** | Pending cancelado antes de posted | Terminal |

**Nota V1:** mayoría cobros Stripe/Zelle llegan directo a **posted** en fuente; `pending` es principalmente Zelle pre-confirm.

---

## 11. Relación con Cash Flow Artista

| Aspecto | Relación |
|---------|----------|
| **Hoy** | `flow-handler.js` lee `dj_ledger` + leads assigned + SFT merge + health MDJ |
| **Read-map fase 1** | **Observador paralelo** — no reemplaza runtime |
| **Futuro fase 1 implement** | DJ dashboard puede **mostrar timeline CFMovement** (payout + tips) además de KPIs actuales |
| **Wallet number** | Sigue siendo sum(`dj_ledger`) — CFMovement **no redefine** wallet |
| **Salud MDJ** | Puede **consumir** CFMovement como input adicional; no recalcular en read-map |
| **Regla** | Tab `?tab=flow` **no** muestra cobro cliente como ingreso DJ |

---

## 12. Relación con Cash Flow Empresa

| Aspecto | Relación |
|---------|----------|
| **Producto** | P1 separado — Owner/Manager — **no** tab artista |
| **Read-map** | Fuente primaria para P&L operativo futuro: ingresos `client_*`, costos `dj_payout`, fees `platform_fee` |
| **Margen** | `sum(client_*) - sum(dj_payout) - fees` — **derivado en capa lectura**, no writer |
| **Fase 1** | Solo spec + audit export; **sin UI** |
| **Dependencia** | Cash Flow Empresa UI ticket **bloqueado conceptualmente** tras read-map implement estable |

---

## 13. Relación con Invoice V1

| Punto | Contrato |
|-------|----------|
| Invoice save | Enlaza `staff_invoice_id`; no genera cobro CFMovement |
| Print / Copy link / Depósito-Total | **Sin impacto** read-map salvo metadata `payment_mode` en Stripe session |
| Webhook marca invoice paid | Enriquecimiento; no duplicar cobro |
| **Congelado** | `production-module.js`, print template, charge mode — **cero hooks** en fase 1 |
| Correlación | `staff_invoice_id` ↔ `lead_id` ↔ movimientos `client_*` |

Baseline commits: `62cd301`, `d492306` — read-map **no altera** comportamiento aprobado.

---

## 14. Relación con Stripe / Zelle

### Stripe (congelado)

- Lectura vía efectos en `leads`, `mdj_staff_manual_invoices`, `processed_webhooks`.
- **No** interceptar `stripe-webhook` ni `create-event-payment`.
- Depósito vs total: inferir de delta + `deposit_required` + charge mode metadata (si presente en session).

### Zelle

- Lectura vía `payment_status` + delta `balance_paid`.
- **Pending** explícito en read-map (mejora operativa vs solo acumulado).
- Riesgo I1: spec exige idempotencia estricta en confirm.

### Semántica PO (inmutable)

```
Cliente paga (Stripe/Zelle) → leads.balance_paid  [CFMovement client_*]
Staff libera manualmente    → dj_ledger           [CFMovement dj_payout]
```

**Puente automático cobro → ledger: PROHIBIDO.**

---

## 15. Riesgos

| ID | Riesgo | Mitigación en read-map |
|----|--------|------------------------|
| R1 | `balance_paid` sin historial → delta incorrecto | Snapshots ordenados + webhook corroboration |
| R2 | Zelle doble confirm (I1) | Idempotency key estricta; alerta duplicate |
| R3 | DJ confunde cobro con wallet (H1) | Visibilidad DJ §9; copy producto 1D |
| R4 | Re-map interpretado como fuente contable legal | Disclaimer: observador V1; legal sigue invoices + Stripe dashboard |
| R5 | Read-map desincronizado vs runtime flow-handler | Fase 1 no reemplaza; reconciliación report |
| R6 | Sin refunds event deposit (I2) | No emitir `reversed` falso; gap documentado |
| R7 | Lead cancelado post-cobro (I3) | Flag `needs_manual_adjustment` metadata |
| R8 | Implementación escribe fuentes por error | Ticket implement exige **READ ONLY** grants + no triggers en V1 writers |
| R9 | Mezclar SFT/PRO en timeline evento | `product_line` filter obligatorio |
| R10 | Seller sin atribución en schema | Visibilidad seller limitada hasta ticket CRM |

---

## 16. Fases futuras

| Fase | Entrega | Toca congelados |
|------|---------|-----------------|
| **0** | Product definition (`CASH-FLOW-PRODUCT-DEFINITION-V1.md`) | ✅ Hecho |
| **0.5** | Este spec (read-map contract) | No |
| **1** | Implement read-map: RPC/view/tabla audit **aditiva**, job re-sync, export Owner | No writers V1 |
| **1.1** | Extensión SFT + reconciliación básica | No |
| **2** | Writers paralelos aditivos (eventos en insert CFMovement al cobrar) | Ticket PO explícito |
| **3** | Cash Flow Empresa UI P1 | UI admin separada |
| **4** | Refunds, `reversed`, cancelaciones | Webhook + política PO |
| **5** | TICKET-004 capas A–F, migración north star | Phased, no big-bang |

---

## 17. Archivos que NO deben tocarse

**Congelado PO — prohibido en fase 1 read-map:**

| Área | Artefactos |
|------|------------|
| Invoice V1 | `web/js/production-module.js`, `web/admin-dashboard.html` (Producción), print template |
| Stripe UX | Payment link, Checkout popup, charge mode selector |
| Edge | `create-event-payment`, **`stripe-webhook`** (rama event) |
| Payout | **`staff_release_event_dj_payout`** RPC |
| Nav | Header / `#mainNav` |
| Cash Flow runtime | `flow-handler.js` y tab Flow — **no refactor** en fase 1 |
| Portal cobro | `client-portal.js` paths Zelle mark (solo lectura futura) |
| Supabase | Migraciones que ALTER `leads`, `dj_ledger`, invoice tables sin ticket PO |
| Auth / roles | `auth.js`, RLS staff gates |

**Todo `web/` runtime Invoice/Stripe/Cash Flow permanece intacto hasta ticket implement aprobado.**

---

## 18. Próximo ticket sugerido

### `TICKET-V1-CFMOVEMENT-READ-MAP-IMPLEMENT-002`

**Modo:** Implementación acotada — **solo capa lectura/aditiva**

**Entregables propuestos:**

1. Migración **aditiva**: tabla `cf_movement_audit` (o materialized view + refresh job) — schema alineado §6.
2. RPC `mdj_cf_movement_read_map_for_lead(lead_id)` y `mdj_cf_movement_timeline(filters)` — **SECURITY DEFINER** con matriz §9.
3. Job idempotente backfill desde `processed_webhooks` + `dj_ledger` + leads history.
4. Export CSV Owner (sin PII) — admin-only.
5. Tests: determinismo idempotency keys; no writes a `leads`/`dj_ledger`.
6. Doc: schema final referenciando este archivo.

**Precondición PO:** Aprobación de persistencia de este spec + autorización explícita de implement.

**Fuera de scope implement 002:** Cash Flow Empresa UI, auto-release, webhook changes, Invoice panels.

---

## Relación con documentación aprobada

| Documento | Relación |
|-----------|----------|
| `docs/architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md` | Producto CFMovement 3B; glosario y congelados |
| `docs/architecture/MASTER-WIRING-AUDIT-V1.md` | Writers/readers, pipeline financiero V1, brechas H1–H3 |
| `docs/tickets/TICKET-004-financial-order-architecture.md` | North star `order_ledger` — no implementado |
| `docs/tickets/TICKET-V1-INVOICE-UX-PANELS-001.md` | Invoice V1 baseline congelado |

---

*Documento canónico CFMovement read-map V1. Cambios requieren ticket + aprobación PO. Sin implementación en este ticket.*
