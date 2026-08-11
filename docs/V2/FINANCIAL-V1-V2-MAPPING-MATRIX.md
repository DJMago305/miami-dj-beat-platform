# FINANCIAL / PAYMENTS V1 → V2 — Mapping Matrix (DTO Read Model)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/FINANCIAL-V1-V2-MAPPING-MATRIX.md` |
| **Fase** | Dominio Finanzas & Pagos V2 — **Paso 1** (discovery) · ciclo lectura **cerrado** (Pasos 1–6) |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Types lab** | `MiamiDJBeat-MigracionV2/shared/types/financial.types.ts` |
| **Tipo** | Documentación discovery — **sin writers** · **sin SQL** · **sin commit** · **sin deploy** |
| **Prerrequisitos** | [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md) · [BOOKINGS-CYCLE-CLOSURE.md](./BOOKINGS-CYCLE-CLOSURE.md) |
| **Estado ciclo** | Pasos 1–5 **cerrados en lab** — ver [FINANCIAL-CYCLE-CLOSURE.md](./FINANCIAL-CYCLE-CLOSURE.md) (Paso 6) |
| **Suite consolidada** | **133/133 PASS** (Perfiles + Agenda + Finanzas) |
| **Jerarquía** | Constitución + Protocolo PO · [MODULE-CATALOG](./MiamiDJBeat-V2-MODULE-CATALOG.md) MOD-105/106/209 · MOD-306/309 (zona roja) |
| **Aislamiento** | **No** modificar OFTL (`shared/services/finance/`) · Weather · V1 `web/` · `supabase/` · ciclos Perfiles/Agenda sellados |

---

## 0. Lectura canónica aplicada

| Documento / evidencia | Uso |
|----------------------|-----|
| `docs/architecture/MASTER-WIRING-AUDIT-V1.md` | Hubs financieros fragmentados; `leads` ≠ `dj_ledger` |
| `docs/architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md` | Cash Flow Artista 1D · Empresa P1 · CFMovement 3B |
| `docs/architecture/CFMOVEMENT-READ-MAP-SPEC-V1.md` | Read-map conceptual (sin tabla `cf_movements`) |
| `docs/tickets/TICKET-V1-CONTINUITY-AUDIT-001.md` | Rails Stripe/Zelle; gaps cash/check/wire |
| `docs/tickets/TICKET-004-financial-order-architecture.md` | North star `order_ledger` (**no implementado**) |
| Migrations `*zelle*`, `*event_sales*`, `*flow_tab*`, billing | Inventario columnas / RLS (solo lectura documental) |
| OFTL lab contracts | `MiamiDJBeat-MigracionV2/shared/services/finance/` — **paralelo / no mezclar** en este ciclo |

**Root de implementación futura:** `MiamiDJBeat-MigracionV2/` — **no** tocar `web/` V1 ni writers de producción.

---

## 1. Principios de mapeo

1. **No existe ledger unificado en V1.** Cobro cliente vive en **`public.leads`** (`balance_paid`, `payment_status`); wallet DJ en **`public.dj_ledger`**; invoice staff en **`mdj_staff_manual_invoices`**. No hay `order_ledger` / `payment_receipts` / `cf_movements`.
2. **Cobro cliente ≠ earning DJ.** Regla producto congelada: Stripe/Zelle → `leads.balance_paid`; DJ ve wallet solo tras `staff_release_event_dj_payout` → `dj_ledger`.
3. **Receipt ≠ transaction history ≠ balance.**  
   - `PaymentReceiptReadDTO` = comprobante/recibo de un cobro o invoice visible.  
   - `TransactionHistoryDTO` = línea de historial / movimiento (proyección CFMovement-style).  
   - `FinancialBalanceReadDTO` = saldo agregado por rol (cliente adeudado/pagado; artista wallet; staff libro maestro).
4. **`BookingPaymentStatus` (Agenda) es ortogonal** a `PaymentTransactionStatus` (este dominio). Agenda resume cobro en el booking; Finanzas modela comprobantes, historial y balances.
5. **OFTL (`OwnerFinancialTransaction`, etc.) es north-star lab separado.** Este ciclo define **read DTOs de portales** alineados a V1 real; no reescribe OFTL DC-1.
6. **Zona roja:** MOD-306 Invoices · MOD-309 Payments · leads money fields — discovery only; **cero writers**.
7. **Estados V2 canónicos (producto Paso 1):** `Pending` · `Verified` · `Rejected` · `Refunded` · `Completed`.
8. **Métodos de pago (read):** `Zelle` · `Cash` · `BankTransfer` · `StripeCard` · (+ `Check` / `Unknown` / `Other` por gaps V1).

---

## 2. Inventario de fuentes V1

### 2.1 Hub cobro cliente — `public.leads`

| Área | Columnas clave |
|------|----------------|
| Montos | `total_amount`, `deposit_required_usd` / `deposit_required`, `balance_paid` |
| Estado cobro | `payment_status` (`UNPAID` · `PENDING_ZELLE` · `PARTIAL` · `PAID` — strings sin CHECK único) |
| Stripe | `stripe_customer_id`, `stripe_session_id` |
| Invoice link | `staff_invoice_id` → `mdj_staff_manual_invoices` |
| Payout DJ (meta) | `dj_agreed_payout_usd`, `dj_payout_released_at`, `assigned_dj_id` |
| Identidad | `id`, `client_user_id`, `email`, `full_name` |

**Gap crítico:** **no** existe columna `payment_method` en `leads` — el método se **infiere** (Stripe session / Zelle RPC / futuro offline RPC).

### 2.2 Invoice staff — `public.mdj_staff_manual_invoices`

| Campo | Notas |
|-------|--------|
| `status` | `draft` · `sent` · `paid` · `void` |
| Link | `leads.staff_invoice_id` |
| RLS | Seller SELECT; management write (`is_staff_management`) |

Sin `payment_method` en invoice.

### 2.3 Wallet artista — `public.dj_ledger`

| Campo | Notas |
|-------|--------|
| `type`, `amount_cents`, `status`, `metadata` | Writer principal evento: `staff_release_event_dj_payout` |
| Consumo UI | `flow-handler.js` (Cash Flow tab) + rollups |

**No escriben `dj_ledger`:** Stripe webhook event deposit, Zelle confirm, Invoice save.

### 2.4 Event Builder — `public.event_builder_orders`

| Campo | Notas |
|-------|--------|
| `payment_status`, `amount_paid_usd`, `deposit_usd`, `total_usd` | UI “Mark as paid” **no** sync a `leads` |
| `stripe_pi_id` | Columna sin writer fiable documentado |

### 2.5 Rails de pago (runtime — solo lectura discovery)

| Rail | Mecanismo | Efecto |
|------|-----------|--------|
| **Stripe / Card** | Edge `create-event-payment` → `stripe-webhook` · `processed_webhooks` | `leads.balance_paid` ↑ · `PARTIAL`/`PAID` |
| **Zelle** | `client_mark_event_zelle_sent` → `staff_confirm_event_zelle_deposit` | `PENDING_ZELLE` → `balance_paid` ↑ |
| **Cash / Check / Wire / ACH** | ❌ Sin RPC genérico en V1 | Gap → TICKET offline payment |
| **Payout DJ** | `staff_release_event_dj_payout` | INSERT `dj_ledger` |
| **SFT tips** | webhook + `soundfortips_fan_requests` | Paralelo (fase 1.1) — no mezclar con cobro evento sin filtro |

### 2.6 Billing / buyer

| Fuente | Rol |
|--------|-----|
| `billing_settings` | `zelle_email`, `zelle_name` (instrucciones) |
| `client_profiles` | `buyer_stripe_customer_id`, billing PII |
| `payments` | Corroboración Stripe (si filas event-linked) |

### 2.7 North star no implementado

| Concepto | Estado |
|----------|--------|
| `order_ledger` / `order_client_financials` | Solo TICKET-004 |
| Tabla `cf_movements` | Spec read-map; **sin** persistencia |
| `staff_record_offline_payment` | Planificado; **no** en prod |

---

## 3. DTOs V2 de lectura (Paso 1)

### 3.1 `PaymentReceiptReadDTO` — comprobante / recibo

Proyección de un **hecho de cobro o invoice** visible al audience.

| Campo DTO | Fuente V1 (proyección) | Notas |
|-----------|------------------------|-------|
| `receiptId` | Sintético: `inv:{id}` · `lead-pay:{lead_id}:{seq}` · `wh:{processed_webhooks.id}` | No tabla receipts |
| `bookingId` / `leadId` | `leads.id` | Puente Agenda |
| `invoiceId` | `mdj_staff_manual_invoices.id` / `staff_invoice_id` | Nullable |
| `clientUserId` | `leads.client_user_id` | |
| `amountUsd` | Delta cobro o invoice total | |
| `currency` | Default `USD` | |
| `method` | Inferido → `PaymentMethodRead` | Gap si offline sin columna |
| `transactionStatus` | Map §4 | |
| `issuedAt` | webhook time / invoice / lead.updated_at | |
| `referenceLabel` | session id / Zelle ref / “offline TBD” | Masked por audience |
| `bookingTitle` / `eventDate` | leads enrichment | Display |
| `visibility` | `FinancialVisibilityAudience` | |

### 3.2 `TransactionHistoryDTO` — línea de historial

Alineado conceptualmente a **CFMovement read-map** (observador), no a OFTL writers.

| Campo DTO | Fuente V1 | Notas |
|-----------|-----------|-------|
| `transactionId` | = idempotency conceptual CFMovement | Sintético |
| `occurredAt` | webhook / RPC effect / ledger.created_at | |
| `kind` | `client_deposit` · `client_payment` · `dj_payout` · `refund` · `adjustment` · `invoice_issued` | |
| `direction` | `inflow` · `outflow` · `internal` | Vista por rol |
| `amountUsd` | signed según audience | |
| `method` | `PaymentMethodRead` | |
| `transactionStatus` | §4 | |
| `counterpartyRole` | `client` · `artist` · `company` · `platform` | |
| `leadId` / `djLedgerId` / `invoiceId` | FKs opcionales | |
| `sourceSystem` | `stripe_webhook` · `zelle_rpc` · `dj_ledger` · `invoice` · `inferred` | |
| `idempotencyKey` | Spec CFMovement §8 | |
| `visibility` | audience | |

### 3.3 `FinancialBalanceReadDTO` — saldo agregado

| Campo DTO | Cliente | Artista | Staff (libro maestro) |
|-----------|---------|---------|------------------------|
| `balanceId` | `client:{userId}` | `artist:{userId}` | `company:master` / filter |
| `audience` | `client_own` | `artist_wallet` | `staff_seller` / `staff_full` |
| `currency` | USD | USD | USD |
| `totalDueUsd` | `sum(total_amount - balance_paid)` open | n/a (no wallet) | sum leads open |
| `totalPaidUsd` | sum `balance_paid` own | n/a | sum cobros |
| `walletAvailableUsd` | n/a | sum `dj_ledger` available | n/a o empresa |
| `walletPendingReleaseUsd` | n/a | agreed payout not released | staff sees pipeline |
| `openReceiptCount` | count unpaid/partial | — | count |
| `asOf` | snapshot time | | |

**Regla:** balances **nunca** mezclan `balance_paid` del cliente dentro del wallet DJ sin release.

---

## 4. Estados de transacción / pago

### 4.1 Canónico V2 — `PaymentTransactionStatus`

| Estado | Significado producto |
|--------|----------------------|
| **Pending** | Esperando verificación (ej. `PENDING_ZELLE`, checkout iniciado) |
| **Verified** | Staff/sistema confirmó el hecho; cobro acreditado pero puede no ser “cerrado” |
| **Rejected** | Rechazado / no acreditado (gap V1 — poco cableado) |
| **Refunded** | Reembolso (gap V1 event deposit — I2 sin handler fiable) |
| **Completed** | Ciclo cerrado para ese recibo/movimiento (`PAID` / ledger posted / invoice paid) |

### 4.2 Mapa V1 → V2 (helper `mapV1PaymentSignalToTransactionStatus`)

| Señal V1 | → V2 |
|----------|------|
| `UNPAID` / unpaid / vacío | `Pending` (o sin receipt) |
| `PENDING_ZELLE` | `Pending` |
| Stripe checkout pending (si detectable) | `Pending` |
| `PARTIAL` + balance ↑ | `Verified` |
| Zelle staff confirm | `Verified` (o `Completed` si salda total) |
| `PAID` / invoice `paid` | `Completed` |
| invoice `void` | `Rejected` |
| refund Stripe (si aparece) | `Refunded` |
| `dj_ledger` income posted | `Completed` (kind=`dj_payout`) |
| string desconocido | `Pending` + `statusUnmapped: true` |

### 4.3 Relación con Agenda `BookingPaymentStatus`

| Agenda (`bookings.types`) | Finanzas (`financial.types`) |
|---------------------------|------------------------------|
| `Unpaid` · `Pending` · `Partial` · `Paid` · `Unknown` | `Pending` · `Verified` · `Rejected` · `Refunded` · `Completed` |
| Resumen en booking chip | Historial / recibo / balance |

No unificar enums en Paso 1 — mappers futuros pueden puentear.

---

## 5. Métodos de pago (read)

### 5.1 Canónico V2 — `PaymentMethodRead`

| Método | V1 real | Notas |
|--------|---------|-------|
| **Zelle** | ✅ RPC + `billing_settings` | Único offline operativo en leads |
| **Cash** | ❌ Sin RPC | DTO ready; UI lab mock only hasta writer ticket |
| **BankTransfer** | ❌ (wire/ACH) | DTO ready; gap V1 |
| **StripeCard** | ✅ Edge + webhook | Inferido vía session / `payments` |
| **Check** | ❌ Copy only | Incluido como extensión gap |
| **Unknown** | Default | Cuando no hay `payment_method` columna |
| **Other** | SFT Venmo manual, etc. | Fuera de scope evento core |

---

## 6. Visibilidad por rol

| Audience | Ve | No ve |
|----------|----|-------|
| **Client** (`client_own`) | Propios recibos, historial de cobros propios, balance due/paid | Wallet DJ, márgenes empresa, PII otros clientes, raw Stripe secrets |
| **Artist** (`artist_wallet` / assigned) | Propios `dj_ledger` lines, payouts liberados, pending release **sin** montos cliente detalle (policy CFMovement §9) | `balance_paid` cliente como “su dinero”, billing PII buyer, ledger otros DJs |
| **Staff seller** | Ledger maestro **agregado** / pipeline cobros read; PII limitada | Writers invoice/payment; datos full management si policy lo niega |
| **Staff full** (owner/manager) | Libro maestro: leads money + invoices + releases + historial unificado | Secrets Stripe live keys (nunca en DTO) |
| **Público** | Nada financiero | — |

Alineación: Perfiles V2 (`client.*` / `artist.*` / `staff_seller` / `staff_full`) + RLS V1 documentada — **Postgres manda** en prod; lab usa mocks + future service read-only.

---

## 7. Módulos V2 consumidores

| MOD | Nombre | DTO primario |
|-----|--------|--------------|
| MOD-105 | Invoices (client) | `PaymentReceiptReadDTO` |
| MOD-106 | Payments (buyer) | `TransactionHistoryDTO` · receipts |
| MOD-209 | Cash Flow (artist) | `FinancialBalanceReadDTO` · history (wallet) |
| MOD-306 | Invoices (staff) | receipts + invoice status (**red zone**) |
| MOD-309 | Payments (staff) | master ledger / history (**red zone**) |
| MOD-104 / 109 | Orders / Bookings | Puente `leadId` · no duplicar money UI |

---

## 8. Gaps bloqueantes / abiertos

| # | Gap | Impacto | Resolución futura (ticket) |
|---|-----|---------|------------------------------|
| G1 | Sin tabla `payment_receipts` / `cf_movements` | IDs sintéticos | Persistencia opcional post read-map |
| G2 | Sin `payment_method` en `leads` | Inferencia frágil | Columna o RPC offline + audit |
| G3 | Cash/Check/Wire/ACH sin camino | Métodos DTO sin fuente | `staff_record_offline_payment` |
| G4 | Cobro ≠ `dj_ledger` auto | Artista no ve cobro cliente como wallet | Producto: mantener separación; UI aclara |
| G5 | EBO `payment_status` ≠ leads | Doble verdad | Sync policy o deprecar EBO money |
| G6 | Refunds event deposit | `Refunded` poco poblable | Handler Stripe + read-map |
| G7 | `Rejected` poco usado en V1 | Estado canónico aspiracional | Writers verificación offline |
| G8 | OFTL vs portal DTOs | Dos vocabularios | Mantener frontera; bridge doc futuro |
| G9 | Weather / Agenda writers | Ortogonales | **No** acoplar |
| G10 | Shop `mdj_orders` drift | Fuera scope evento | Fase 1.1 paralela |

---

## 9. Fuera de alcance (ciclo lectura)

- Writers (registrar cobro, aprobar comprobante, refund, release payout, Mark as Paid)
- SQL / RLS / RPC nuevas / Edge deploy
- Mutar OFTL contracts (`shared/services/finance/`)
- Weather Engine · reabrir Perfiles/Agenda sellados
- Commit / push / deploy

Detalle de cierre: [FINANCIAL-CYCLE-CLOSURE.md](./FINANCIAL-CYCLE-CLOSURE.md).

---

## 10. Hoja de ruta ciclo lectura (cerrada)

| Paso | Entregable | Estado |
|------|------------|--------|
| 1 | Discovery matrix + types DTO | ✅ (este documento) |
| 2 | `shared/services/financial/` read-only + Vitest | ✅ |
| 3 | MOD-301 Staff Master Ledger UI | ✅ `staff/finance/` |
| 4 | MOD-204 Artist Wallet UI | ✅ `artist/finance/` |
| 5 | MOD-103 Client Receipts UI | ✅ `client/finance/` |
| 6 | Documentación cierre | ✅ [FINANCIAL-CYCLE-CLOSURE.md](./FINANCIAL-CYCLE-CLOSURE.md) |

**Post-ciclo** (writers, offline payment RPC, cf_movements persistidos, wiring auth): requiere ticket + OK PO — ver cierre §7.

---

## 11. Referencias

| Recurso | Ruta |
|---------|------|
| Types | `MiamiDJBeat-MigracionV2/shared/types/financial.types.ts` |
| Spec servicio | `MiamiDJBeat-MigracionV2/shared/services/financial/FINANCIAL-SPEC.md` |
| **Cierre ciclo** | `docs/V2/FINANCIAL-CYCLE-CLOSURE.md` |
| Agenda cierre | `docs/V2/BOOKINGS-CYCLE-CLOSURE.md` |
| Perfiles cierre | `docs/V2/PROFILES-CYCLE-CLOSURE.md` |
| CFMovement spec | `docs/architecture/CFMOVEMENT-READ-MAP-SPEC-V1.md` |
| Cash Flow producto | `docs/architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md` |
| Wiring V1 | `docs/architecture/MASTER-WIRING-AUDIT-V1.md` |
| OFTL (no tocar este ciclo) | `MiamiDJBeat-MigracionV2/shared/services/finance/` |

---

*Finanzas V2 — matriz discovery + cierre ciclo lectura Pasos 1–6 — 2026-08-11 — documentation only — no commit*
