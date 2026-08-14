# Miami DJ Beat V1 — Canonical Financial Architecture

**Ticket:** TICKET-V1-FINANCIAL-CANONICAL-ARCHITECTURE-CONSOLIDATION-005
**Estado:** `DOCUMENTATION COMPLETE — CANONICAL REFERENCE FOR FUTURE IMPLEMENTATION`
**Fecha:** 2026-08-03
**Modo:** Documento arquitectónico. No autoriza implementación, SQL, migraciones, ni cambios de runtime.

**Worktree canónico:** `/Users/djmago/Desktop/MiamiDJBeat-V1-offline-payment`
**Rama:** `fix/v1-staff-offline-payment-controlled`
**HEAD de referencia:** `13bb4c4790f074d4539620f7152f3f92f3fe8205`

**Revisión:** TICKET-023 (2026-08-04) — delta correctivo aplicado sobre evidencia de código real obtenida en TICKET-022 (readonly). No redefine el modelo entidad-relación, no reescribe el documento, no cambia comandos ni state machines. Ver **Anexo TICKET-023** al final del documento para el detalle completo.

**Consolida:** Financial Architecture Audit (001) · Canonical Data Model Refinement (002) · Legacy Store Semantic Verification (003) · Local Contract and Service Boundaries (004) · Product Owner Financial Contract Decisions · Domain Events + Outbox Refinement · Domain Event Outbox Final Decisions.

Este documento es la **fuente arquitectónica oficial** para toda implementación financiera futura de V1. Donde este documento contradiga cualquier ticket anterior de la serie, **este documento manda**. Las propuestas supersedidas quedan listadas explícitamente en la §23 para que no se reintroduzcan por accidente.

**Relación con BFI North Star (`TICKET-V1-FINANCIAL-CANONICAL-LINE-RECONCILIATION-AND-MAP-FREEZE-001`, 2026-08-09):** este documento es la **implementación técnica** del Canonical Financial Core definido empresarialmente en `MIAMI-DJ-BEAT-BUSINESS-FINANCIAL-INTELLIGENCE-NORTH-STAR.md §42`. No son dos sistemas canónicos paralelos — §42 define el contrato abstracto (6 capacidades); las entidades y comandos de este documento (§6, §9) lo materializan 1:1. Mapeo completo motor por motor en `MIAMI-DJ-BEAT-BUSINESS-FINANCIAL-INTELLIGENCE-NORTH-STAR.md §43.12`.

---

## Tabla de contenidos

1. Propósito y alcance
2. Contexto de negocio
3. Límites
4. Principios arquitectónicos
5. Modelo entidad-relación definitivo
6. Contrato exacto de entidades
7. State machines
8. Fórmulas canónicas
9. Comandos
10. Queries
11. Errores canónicos
12. Idempotencia
13. Legacy mapping
14. Duplicaciones confirmadas
15. Domain Events
16. Outbox multiconsumidor
17. Diferencia entre capas
18. Cableado UI futuro
19. Migración local-first
20. Orden completo de implementación
21. Gates obligatorios antes de tocar `accounting-module.js`
22. Decisiones del Product Owner (registro histórico)
23. Diseños supersedidos — excluidos explícitamente
24. Riesgos pendientes
25. Glosario
26. Anexo TICKET-023 — Delta Documental
27. Anexo TICKET-024B — Contrato Técnico Lead → Occurrence

---

## 1. Propósito y alcance

Definir la arquitectura financiera definitiva de Miami DJ Beat V1: cómo cada hecho de negocio (venta, cobro, pago, reverso, conciliación) nace una sola vez, en una fuente canónica única, y cómo el resto del sistema (Producción, Agenda, Accounting, Cash Flow, Bitácora) se entera de ese hecho sin volver a escribirlo.

Este documento reemplaza como referencia consolidada a los siete tickets/pasadas que lo precedieron. No es un documento de implementación — es el plano que cualquier ticket de implementación futuro debe seguir sin reabrir decisiones ya tomadas.

---

## 2. Contexto de negocio

| Canal / concepto | Definición operativa |
|---|---|
| **Private Event** | Evento comercial privado, vía `leads` (`businessChannel=PRIVATE_EVENT`). Maestro operativo = `leads`. |
| **Corporate Event** | Evento comercial corporativo, vía `leads` + cliente comercial (`businessChannel=CORPORATE_EVENT`). |
| **Special Event** | Show/flow especial; puede anclar a `leads` si hay cobro de plataforma, o vivir en `mdj_event_flows` si es solo producción. |
| **Venue Operations** | Residencia recurrente o cobertura puntual en un venue. Maestro operativo = `occurrences`, no `leads`. |
| **Occurrence** | Una presentación real, con fecha y turno. Es la unidad atómica del canal venue — un doble turno produce dos `occurrenceId`. |
| **Invoice** | Documento de obligación de cobro del canal comercial (`mdj_staff_manual_invoices`). No representa efectivo. |
| **Receivable** | Obligación de cobro del canal venue (`venue_receivables`) — equivalente conceptual al invoice, sin documento formal. |
| **Payable** | Obligación de pago de MDJB hacia un DJ, talento o proveedor, en cualquier canal. No representa salida de efectivo. |
| **Payment** | Movimiento monetario real, inflow u outflow, en cualquier canal. |
| **Payout** | Un `Payment` con `direction=OUTFLOW` aplicado (`allocatePayment`) contra un `Payable`. |
| **Ledger** | Registro append-only de asientos de caja (`owner_ledger_entries`), dominio OWNER. `dj_ledger` (dominio ARTIST) es una pieza distinta, ya existente, congelada. |
| **Reconciliation** | Verificación de un `Payment` contra evidencia bancaria/caja. No altera el monto original. |
| **Reporting** | Toda cifra de negocio (AR, AP, márgenes, cash position) se deriva por consulta, nunca se almacena como fuente. |

> **Nota (TICKET-023):** la definición de `Occurrence` de arriba es el contrato canónico objetivo. **No existe hoy ningún flujo en producción que la genere como tal.** Ver Anexo TICKET-023 §A-B.

---

## 3. Límites

**Dentro de alcance (V1, este documento):**
- Modelo financiero de Venue Operations, Private, Corporate y Special Event.
- Contrato de comandos, queries, errores, idempotencia.
- Domain Events + Outbox como mecanismo de desacoplamiento entre módulos.
- Legacy mapping desde `localStorage` (`mdjb_accounting_local_v1`).

**Fuera de alcance (explícitamente, no se diseña aquí):**
- **MDJPRO** y pagos de membresía — aplicación distinta del ecosistema, sin relación con esta arquitectura.
- **Seller / manager commissions** — north star de `TICKET-004-financial-order-architecture.md` (2026-05-22), fases D/E, no se implementan en esta iniciativa.
- **Supabase remoto** — todo el trabajo de esta serie de tickets es documental/local; cualquier tabla, RPC o migración remota requiere autorización explícita separada, ticket por ticket.
- **Cash Flow Empresa (P&L Owner)** — prioridad P1 declarada en `CASH-FLOW-PRODUCT-DEFINITION-V1.md`; se construye **después** de que el modelo canónico esté implementado, consumiendo sus vistas, no antes.
- **Localhost únicamente** — todo el trabajo se valida en `http://127.0.0.1:8080`, nunca en producción, hasta autorización explícita de deploy.

---

## 4. Principios arquitectónicos

| # | Principio | Regla |
|---|---|---|
| P1 | Una fuente canónica por hecho | Ningún hecho financiero tiene dos dueños. Ver matriz §6 y §14. |
| P2 | Documentos ≠ dinero | `Invoice`/`Payable` dicen "cuánto se debe"; nunca representan efectivo movido. |
| P3 | Payments ≠ Allocations | `Payment` dice "cuánto dinero se movió"; `PaymentAllocation` dice "a qué obligación se aplicó". Nunca se fusionan en una sola tabla. |
| P4 | Ledger append-only | `OwnerLedgerEntry` nunca se edita ni se borra — toda corrección es una fila nueva. |
| P5 | Historial derivado | Ningún "Historial"/timeline es un segundo lugar de escritura — siempre se reconstruye desde las fuentes canónicas. |
| P6 | Reversos compensatorios | Un reverso (`Payment`, `PaymentAllocation`) es siempre una fila **nueva**, referenciando a la original vía `reversalOf*Id`. La fila original **nunca se edita, ni siquiera su `status`**. |
| P7 | Idempotencia end-to-end | Toda escritura lleva `idempotencyKey`; un retry con el mismo payload no duplica, un retry con payload distinto es error. |
| P8 | Atomicidad por comando | Cada comando ejecuta, en una transacción futura: validar → mutar entidad → ledger posting (si aplica) → insertar `DomainEvent` → commit. |
| P9 | Proyecciones reconstruibles | Toda vista derivada (Bitácora de referencias, Cash Flow, dashboards) puede borrarse y reconstruirse desde las entidades canónicas y el stream de eventos — nunca es ella misma la fuente. |
| P10 | Eventos no sustituyen entidades | `DomainEvent` es una notificación de que algo pasó. No es la fuente de verdad para calcular balances, AR, AP, márgenes ni conciliación — esos se derivan siempre de las entidades canónicas. |

---

## 5. Modelo entidad-relación definitivo

```
dj_profiles / client_profiles (existentes, sin cambio)
        │
        ▼
    payees ◄──────────────────────────────┐ (contratistas sin auth.users — bridge-pending)
        │                                 │
venues ─┼─► venue_agreements ─► occurrences ─► performance_financial_records (PFR)
        │        (rate contract)   (1 presentación real)     (economics 1:1)
        │                                 │
leads ──┼──► mdj_staff_manual_invoices     │
 (PRIVATE/CORPORATE/SPECIAL)  (invoices)   │
        │        │                        │
        │        ▼                        ▼
        │   [invoiceBalance]        venue_receivables (solo canal venue,
        │    (vista derivada)        sin documento formal de invoice)
        │        │                        │
        │        └───────────┬────────────┘
        │                    ▼
        │            payment_allocations ◄──── payments (dinero real,
        │                    ▲                  inflow/outflow, idempotencyKey)
        │                    │
        │             payables (obligación de pago:
        │              DJ/talento/proveedor/gasto)
        │                                                │
        │                                                ▼
        │                                       owner_ledger_entries (append-only)
        │                                                │
        │                                                ▼
        │                                          reconciliations
        │
        ▼
   dj_ledger (EXISTENTE, congelado — dominio ARTIST, sin tocar schema)

Cada comando (§9) también inserta:
        ▼
   domain_events (append-only, misma transacción que el hecho)
        │
        ▼
   domain_event_delivery (por consumidor: operations_log_projection,
                           owner_financial_projection, notifications, analytics)
        │
        ▼
   Bitácora / Operations Log (solo referencia IDs, nunca copia montos)
   Historial / Resumen / Cash Flow Empresa (vistas derivadas)
```

**Regla de fondo:** `invoices`/`venue_receivables`/`payables` dicen "cuánto se debe"; `payments` dice "cuánto se movió"; `payment_allocations` dice "a qué se aplicó"; `owner_ledger_entries` dice "qué pasó, en orden, para siempre"; `reconciliations` dice "está confirmado contra el banco/caja"; `domain_events` dice "quién más necesita saberlo". Ninguna de las seis capas sustituye a otra.

---

## 6. Contrato exacto de entidades

Convenciones: `Cents` = entero; `ActorId` = `dj_profiles.user_id`/`auth.uid()`; ningún campo financiero se sobrescribe una vez creado, solo `status` transiciona donde el contrato lo permite explícitamente.

### Venue
```
Venue {
  id: UUID (PK)
  name: String (required)
  address: String?
  contactName, contactPhone, contactEmail: String?
  status: ACTIVE | INACTIVE
  createdAt, updatedAt, createdBy
}
```
Sin FK (maestro raíz). Nunca editar `id/createdAt/createdBy`. Reverso: `status=INACTIVE`, nunca borrado físico si tiene `venue_agreements`/`occurrences`.

### VenueAgreement
```
VenueAgreement {
  id: UUID (PK)
  venueId: UUID (FK, required)
  title: String
  frequency: WEEKLY | BIWEEKLY | MONTHLY | ONE_OFF
  scheduledDays: String[]
  rateByDay: Map<DayCode, AmountCents>
  currency: Currency (default USD)
  effectiveFrom: Date (required)
  effectiveUntil: Date?
  status: ACTIVE | PAUSED | ENDED
  paymentMethod, notes: String?
  createdAt, updatedAt, createdBy
}
```
CHECK: `effectiveUntil >= effectiveFrom`; `rateByDay` valores > 0. Nunca editar `id/venueId`. Reverso: `status=ENDED`.

### Occurrence
```
Occurrence {
  id: UUID (PK)
  venueId: UUID (FK, required)
  agreementId: UUID?          // null = cobertura puntual/casual
  assignedProfileId: UUID?
  date: Date (required)
  shift: String? (default 'default')
  status: SCHEDULED | COMPLETED | CANCELLED | NO_SHOW
  createdAt, updatedAt, createdBy
}
```
UNIQUE `(venueId, date, shift)` — un doble turno produce dos filas (shifts distintos). **`date`/`shift` nunca se editan directamente** — solo vía `rescheduleOccurrence` (§9), que preserva el mismo `id` y registra `previousDate`/`previousShift` en el payload del evento `OccurrenceRescheduled`, no como columna permanente en la entidad.

### PerformanceFinancialRecord (PFR)
```
PerformanceFinancialRecord {
  id: UUID (PK)
  occurrenceId: UUID (FK, required, UNIQUE — 1:1 estricta)
  agreementId: UUID?
  rateAmountCents: Integer > 0        // canónico, input
  currency: Currency
  assignedProfileId: UUID?            // snapshot al generar
  expectedArtistPayoutCents: Integer >= 0
  rateByDaySnapshot: JSON             // congelado del agreement al generar
  createdAt, updatedAt, createdBy
}
```
**Nunca almacena:** `collectedAmount`, `paidPayout`, `collectionStatus`, `djPayoutStatus`, `billedIncome`, `expectedMargin`, `cashPosition`, `realizedMargin` — todos derivados vía vista (§8), uniendo PFR + `venue_receivables`/`payables` + `payments`. Corregir `rateAmountCents`/`expectedArtistPayoutCents` solo si no existe ningún `venue_receivables`/`payables` creado a partir de este PFR; si ya existen, exige `void` + recrear.

### VenueReceivable
```
VenueReceivable {
  id: UUID (PK)
  occurrenceId: UUID (FK, required, UNIQUE — 1 receivable por occurrence)
  amountCents: Integer > 0
  currency: Currency
  status: OPEN | PARTIALLY_PAID | PAID | VOID
  dueDate: Date?
  createdAt, updatedAt, createdBy
}
```
**No requiere invoice formal** — es la decisión fijada: Venue Operations no factura por occurrence en V1; el receivable se registra directo. Nunca editar `occurrenceId`/`amountCents` con allocations activas.

### Payable
```
Payable {
  id: UUID (PK)
  sourceType: LEAD | OCCURRENCE | EXPENSE
  sourceId: UUID?              // null solo si sourceType=EXPENSE
  payeeType: DJ_PROFILE | PAYEE
  payeeId: UUID
  purpose: DJ_PAYMENT | CONTRACTOR_PAYMENT | VENDOR_PAYMENT | REIMBURSEMENT | ADJUSTMENT | OWNER_WORK_RECORD
  amountCents: Integer >= 0    // 0 permitido solo para OWNER_WORK_RECORD
  currency: Currency
  status: PENDING | SCHEDULED | PARTIALLY_PAID | PAID | VOID
  dueDate: Date?
  createdAt, updatedAt, createdBy
}
```
UNIQUE `(sourceType, sourceId, payeeId, purpose)`. Vocabulario de `purpose` reutiliza `PAYMENT_TYPES` ya existente en `accounting-module.js:311-318`.

### Payment
```
Payment {
  id: UUID (PK)
  direction: INFLOW | OUTFLOW
  amountCents: Integer > 0
  currency: Currency
  method: STRIPE | ZELLE | CASH | CHECK | WIRE | ACH | REFUND | OTHER
  account, reference: String?
  paymentDate: Date (required)
  status: PENDING | CONFIRMED | FAILED     // únicos valores ALMACENADOS
  idempotencyKey: UUID (UNIQUE, required)
  reversalOfPaymentId: UUID?    // solo en pagos compensatorios
  createdAt, updatedAt, createdBy
}
```
**`status` NUNCA incluye `REVERSED`, `PARTIALLY_REVERSED` ni `FULLY_REVERSED` como valor almacenado** — esos son estados derivados en lectura (§7). `amountCents`/`direction`/`idempotencyKey`/`reversalOfPaymentId` inmutables para siempre.

### PaymentAllocation
```
PaymentAllocation {
  id: UUID (PK)
  paymentId: UUID (FK, required)
  targetType: INVOICE | VENUE_RECEIVABLE | PAYABLE
  targetId: UUID
  amountCents: Integer > 0
  direction: APPLY | REVERSE
  reversalOfAllocationId: UUID?   // solo en filas REVERSE
  idempotencyKey: String
  createdAt, createdBy
}
```
**La fila original NUNCA se edita — ni siquiera su `status`.** No existe campo `status` mutable en esta entidad. Reversar = insertar fila nueva `direction=REVERSE`. Monto neto = `SUM(APPLY) − SUM(REVERSE)`.

### OwnerLedgerEntry
```
OwnerLedgerEntry {
  id: UUID (PK)
  postingType: CASH_IN | CASH_OUT | ADJUSTMENT | REFUND | ALLOCATION_REVERSAL
  direction: INFLOW | OUTFLOW
  amountCents: Integer > 0
  currency: Currency
  sourceType: PAYMENT | ALLOCATION | RECONCILIATION
  sourceId: UUID
  reversalOfEntryId: UUID?
  createdAt: Timestamp (append-only, sin updatedAt)
  createdBy: ActorId
}
```
UNIQUE recomendada `(sourceType, sourceId, postingType)`. 100% append-only, sin excepción.

### Reconciliation
```
Reconciliation {
  id: UUID (PK)
  paymentId: UUID (FK, required)
  attemptUuid: UUID
  evidenceRef: String?
  status: UNRECONCILED | MATCHED | EXCEPTION | RECONCILED
  reconciledBy: ActorId?
  reconciledAt: Timestamp?
  notes: String?
  createdAt: Timestamp
}
```
UNIQUE `(paymentId, attemptUuid)` — no `UNIQUE(paymentId)` solo; múltiples intentos históricos permitidos.

### DomainEvent
```
DomainEvent {
  id: UUID (PK)
  eventType: String            // pasado: 'PaymentConfirmed'
  eventVersion: Integer        // empieza en 1
  eventPosition: BigInt        // monotónico, asignado por servidor — orden real
  aggregateType: String
  aggregateId: UUID
  commandId: UUID
  correlationId: UUID?
  causationId: UUID?
  actorId: UUID?
  idempotencyKey: String (UNIQUE)
  payload: JSON                // mínimo: IDs + montos + estado, nunca documento completo
  occurredAt: Timestamp
}
```
Append-only estricto. Orden de lectura: `ORDER BY eventPosition ASC` (no depender solo de `occurredAt`).

### DomainEventDelivery
```
DomainEventDelivery {
  eventId: UUID
  consumerName: String
  status: PENDING | PROCESSING | PROCESSED | FAILED | DEAD_LETTER
  attemptCount: Integer
  lastErrorCode, lastErrorMessage: String?
  nextAttemptAt, firstAttemptAt, processedAt: Timestamp?
  updatedAt: Timestamp
}
```
UNIQUE `(eventId, consumerName)` — es la clave de dedupe Y el mecanismo de claim. **No existe un `processedAt` global único** — cada consumidor tiene su propia fila y su propio checkpoint.

---

## 7. State machines

### Occurrence
| Estado | Comando | Siguiente | Permitido | Efecto |
|---|---|---|---|---|
| — | `createOccurrenceWithPfr` | SCHEDULED | Sí | Crea PFR |
| SCHEDULED | marcar completada | COMPLETED | Sí | — |
| SCHEDULED | `rescheduleOccurrence` | SCHEDULED | Sí | Cambia `date`/`shift`, mismo `id`, emite `OccurrenceRescheduled` |
| SCHEDULED | `cancelOccurrence` | CANCELLED | Sí, si sin allocations activas | Void receivable/payable en cascada |
| SCHEDULED | marcar no-show | NO_SHOW | Sí | — |
| COMPLETED/CANCELLED/NO_SHOW | `rescheduleOccurrence` | — | **No** | `INVALID_STATE_TRANSITION` |
| COMPLETED | `cancelOccurrence` | — | **No** | `INVALID_STATE_TRANSITION` |

### VenueReceivable
| Estado | Comando | Siguiente | Permitido |
|---|---|---|---|
| — | `createVenueReceivable` | OPEN | Sí |
| OPEN | `allocatePayment` (parcial) | PARTIALLY_PAID | Sí |
| PARTIALLY_PAID | `allocatePayment` (completa) | PAID | Sí |
| OPEN/PARTIALLY_PAID | `voidReceivable` | VOID | Sí, si sin allocations activas |
| PAID | `voidReceivable` | — | **No** (`RECEIVABLE_ALREADY_PAID`) |

### Payable
| Estado | Comando | Siguiente | Permitido |
|---|---|---|---|
| — | `createPayable` | PENDING | Sí |
| PENDING | programar | SCHEDULED | Sí |
| PENDING/SCHEDULED | `recordOwnerPayout` (parcial) | PARTIALLY_PAID | Sí |
| PARTIALLY_PAID | `recordOwnerPayout` (completa) | PAID | Sí |
| PENDING/SCHEDULED | `voidPayable` | VOID | Sí |
| PAID | `voidPayable` | — | **No** (`PAYABLE_ALREADY_PAID`) |

### Payment — almacenado
| Estado | Comando | Siguiente | Permitido |
|---|---|---|---|
| — | `recordPayment` | PENDING o CONFIRMED | Sí |
| PENDING | confirmación/webhook | CONFIRMED | Sí |
| PENDING | falla | FAILED | Sí |
| CONFIRMED | `recordRefund` | CONFIRMED (sin cambio de status almacenado) | Sí — crea `Payment` compensatorio nuevo |
| FAILED | cualquiera | — | **No** |

### Payment — `effectiveStatus` derivado (lectura, nunca almacenado)
```
reversedAmountCents(paymentId) =
  SUM(p.amountCents) WHERE p.reversalOfPaymentId = paymentId AND p.status = CONFIRMED

remainingConfirmedAmountCents = originalPayment.amountCents − reversedAmountCents

effectiveStatus:
  originalPayment.status ∈ {PENDING, FAILED}  → ese mismo estado
  reversedAmountCents = 0                      → CONFIRMED
  0 < reversedAmountCents < amountCents        → PARTIALLY_REVERSED
  reversedAmountCents = amountCents            → FULLY_REVERSED
  reversedAmountCents > amountCents            → anomalía bloqueante (alarma de integridad)
```

### PaymentAllocation — `effectiveStatus` derivado (lectura, nunca almacenado)
```
netAppliedCents(paymentId|targetId) = SUM(APPLY) − SUM(REVERSE)

effectiveStatus:
  net = monto originalmente aplicado  → ACTIVE
  0 < net < aplicado                  → PARTIALLY_REVERSED
  net = 0                             → FULLY_REVERSED
```

### Reconciliation
| Estado | Comando | Siguiente | Permitido |
|---|---|---|---|
| — | `reconcilePayment` | UNRECONCILED/MATCHED/EXCEPTION/RECONCILED (según input) | Sí, nueva fila |
| EXCEPTION | `reconcilePayment` (nuevo intento) | MATCHED/RECONCILED | Sí, nueva fila; la anterior queda en el historial |

---

## 8. Fórmulas canónicas

| Fórmula | Definición | Naturaleza |
|---|---|---|
| `invoiceBalance` | `invoiceTotal − SUM(allocations ACTIVE)` | Vista |
| `receivableBalance` | `receivable.amount − SUM(allocations ACTIVE)` | Vista |
| `payableBalance` | `payable.amount − SUM(allocations ACTIVE)` | Vista |
| `unallocatedAmount(paymentId)` | `payment.amountCents − SUM(alloc APPLY) + SUM(alloc REVERSE)` de ese payment | Vista |
| `reversedAmount(paymentId)` | `SUM(payments compensatorios CONFIRMED con reversalOfPaymentId = paymentId)` | Vista |
| `accountsReceivable(scope)` | `SUM(invoiceBalance ∪ receivableBalance)` donde `status ∉ {VOID, PAID}` | Vista agregada |
| `accountsPayable(scope)` | `SUM(payableBalance)` donde `status ∉ {VOID, PAID}` | Vista agregada |
| `cashInflow(period)` | `SUM(payment.amount) WHERE direction=INFLOW AND status=CONFIRMED` | Vista |
| `cashOutflow(period)` | `SUM(payment.amount) WHERE direction=OUTFLOW AND status=CONFIRMED` | Vista |
| `netCash(period)` | `cashInflow − cashOutflow` | Vista |
| `expectedMargin` | `expectedRevenue − expectedPayout` | Vista |
| `cashPosition` | `collectedRevenue − paidPayout` | Vista |
| `realizedMargin` | `= cashPosition` **solo si** invoice/receivable y payable están ambos `PAID`; si no, `NULL/PENDING` — nunca `0` mientras esté pendiente | Vista |

Ninguna se materializa en V1 (volumen bajo no lo justifica) — todas son vistas SQL de solo lectura.

---

## 9. Comandos

Plantilla: Input · Validaciones · Permisos · Precondiciones · Crea · Ledger · Idempotency · Errores · Atomicidad futura.

| Comando | Crea/muta | Ledger | Idempotency key | Errores principales |
|---|---|---|---|---|
| `createVenue` | `Venue` | No | — | `PERMISSION_DENIED` |
| `createVenueAgreement` | `VenueAgreement` | No | — | `TARGET_NOT_FOUND` |
| `createOccurrenceWithPfr` | `Occurrence` + `PFR` (transacción) | No | `occ:{venueId}:{date}:{shift}:{startTime}` | `OCCURRENCE_ALREADY_EXISTS`, `PFR_ALREADY_EXISTS` |
| `rescheduleOccurrence` | `Occurrence.date/shift` (mismo id) | No | `reschedule:{occurrenceId}:{attemptUuid}` | `TARGET_NOT_FOUND`, `INVALID_STATE_TRANSITION`, `OCCURRENCE_ALREADY_EXISTS` |
| `createVenueReceivable` | `VenueReceivable` | No | — | `TARGET_NOT_FOUND` |
| `createPayable` | `Payable` | No | `payable:{sourceType}:{sourceId}:{payeeId}:{purpose}` | `DUPLICATE_IDEMPOTENCY_KEY`, `CURRENCY_MISMATCH` |
| `recordPayment` | `Payment` | Sí, al confirmar | UUID por intento | `DUPLICATE_IDEMPOTENCY_KEY`, `CURRENCY_MISMATCH` |
| `allocatePayment` | `PaymentAllocation` (APPLY) | No (ya postea el Payment) | `alloc:{paymentId}:{targetType}:{targetId}:{attemptUuid}` | `PAYMENT_NOT_CONFIRMED`, `PAYMENT_OVERALLOCATED`, `TARGET_VOID` |
| `reverseAllocation` | `PaymentAllocation` (REVERSE, fila nueva) | `OwnerLedgerEntry(ALLOCATION_REVERSAL)` | idem original + attempt | `ALLOCATION_ALREADY_REVERSED` |
| `recordRefund` | `Payment` compensatorio + `PaymentAllocation` REVERSE | `OwnerLedgerEntry(REFUND)` | `refund:{originalPaymentId}:{attemptUuid}` | `REFUND_EXCEEDS_AVAILABLE_AMOUNT` |
| `recordOwnerPayout` | `Payment(OUTFLOW)` + `PaymentAllocation` | `OwnerLedgerEntry(CASH_OUT)` | UUID por intento | `PAYABLE_ALREADY_PAID`, `TARGET_VOID` |
| `reconcilePayment` | `Reconciliation` (fila nueva) | No | `reconcile:{paymentId}:{attemptUuid}` | `RECONCILIATION_CONFLICT` |
| `cancelOccurrence` | `Occurrence.status=CANCELLED` + void en cascada | No directo | — | `PARTIAL_FAILURE_REQUIRES_RECOVERY` |
| `voidReceivable` / `voidPayable` | `status=VOID` | No | — | `TARGET_VOID`, `*_ALREADY_PAID` |

Todos los comandos que mutan dinero requieren, a futuro, ejecutar en una sola transacción: validar → mutar entidad → ledger posting → insertar `DomainEvent` → commit (P8).

---

## 10. Queries

| Query | Fórmula/fuente | Naturaleza |
|---|---|---|
| `getInvoiceBalance` / `getReceivableBalance` / `getPayableBalance` | §8 | Vista |
| `getUnallocatedPayments` | §8 | Vista |
| `getAccountsReceivable` / `getAccountsPayable` | §8 | Vista agregada |
| `getCashInflow` / `getCashOutflow` / `getNetCash` | §8 | Vista, por rango |
| `getOccurrenceEconomics` | PFR + receivable + payable + payments | Vista |
| `getVenueProfitability` | agregado de `getOccurrenceEconomics` por venue | Vista agregada |
| `getFinancialHistory` | `owner_ledger_entries` + `payments` + `payment_allocations` | Vista, paginada |
| `getReconciliationExceptions` | `reconciliations WHERE status=EXCEPTION` | Vista |

---

## 11. Errores canónicos

`DUPLICATE_IDEMPOTENCY_KEY` · `INVALID_STATE_TRANSITION` · `PAYMENT_NOT_CONFIRMED` · `PAYMENT_OVERALLOCATED` · `TARGET_NOT_FOUND` · `TARGET_VOID` · `ALLOCATION_ALREADY_REVERSED` · `REFUND_EXCEEDS_AVAILABLE_AMOUNT` · `PAYABLE_ALREADY_PAID` · `RECEIVABLE_ALREADY_PAID` · `RECONCILIATION_CONFLICT` · `OCCURRENCE_ALREADY_EXISTS` · `PFR_ALREADY_EXISTS` · `CURRENCY_MISMATCH` · `PERMISSION_DENIED` · `PARTIAL_FAILURE_REQUIRES_RECOVERY`.

`errorCode` y `userMessage` son campos separados — el catálogo de arriba es el contrato estable; los mensajes de UI no forman parte de él.

---

## 12. Idempotencia

| Hecho | Clave | Retry con mismo payload | Retry con payload distinto |
|---|---|---|---|
| Occurrence | `occ:{venueId}:{date}:{shift}:{startTime}` | Devuelve la fila existente | `DUPLICATE_IDEMPOTENCY_KEY` |
| PFR | `pfr:{occurrenceId}` | Devuelve la fila existente | ídem |
| Payable | `payable:{sourceType}:{sourceId}:{payeeId}:{purpose}` | Devuelve la fila existente | ídem |
| Payment | UUID del actor externo | Devuelve el `Payment` existente | ídem |
| Allocation | `alloc:{paymentId}:{targetType}:{targetId}:{attemptUuid}` | Devuelve la fila existente | ídem |
| Refund | `refund:{originalPaymentId}:{attemptUuid}` | Devuelve el refund existente | ídem |
| Reconciliation | `reconcile:{paymentId}:{attemptUuid}` | Devuelve el intento existente | ídem |
| DomainEvent | `idempotencyKey` propio, ligado a `commandId` | No duplica el evento | — |

---

## 13. Legacy mapping (`mdjb_accounting_local_v1`)

| Array/campo legacy | Destino | Confidence |
|---|---|---|
| `venues[]` | `Venue` | Alta |
| `agreements[]` | `VenueAgreement` | Alta |
| `occurrences[]` + `casualServices[]` (fusionados) | `Occurrence` | Media |
| `venuePayments[]` | `VenueReceivable` | Media — **`venueIncomes[]` NO se usa como fuente** (ver §14) |
| `venueIncomes[]` | **Descartado**, no se migra | — |
| `incomeSchedules[]` | **Descartado** — superseded por `agreements[]` | — |
| `payments[]` (outgoing) | `Payable` + `Payment(OUTFLOW)` | Media |
| `deposits[]` | `Payment(INFLOW)` | Alta — el mejor modelado del store legacy |
| `deposits[].leadId/invoiceId/eventId` | `LEGACY_READ_SUPPORTED` / `NEW_WRITE_DISABLED` (§22.3) | — |
| `performanceFinancialRecords[]` | `PFR`, descartando `collectedAmount/collectionStatus/djPayoutStatus/billedIncome` | Media |
| `state.ledger` | No se migra literal — se reconstruye como vista sobre `owner_ledger_entries`+`payments`+`allocations` | — |
| `state.auditHistory` | Auditoría técnica — se conserva el concepto, distinto de Bitácora | Alta |

---

## 14. Duplicaciones confirmadas (evidencia de código)

| Duplicación | Evidencia | Resolución |
|---|---|---|
| `venueIncomes[]` vs `venuePayments[]` | `accounting-module.js:3541-3568` (`saveScheduleFromWizard`) — mismos campos (`amount`, `currency`, `status`, `performanceDate`, `concept`) escritos en el mismo acto | Migrar **solo** desde `venuePayments[]`; `venueIncomes[]` no es fuente |
| `state.ledger` — reconstrucción idempotente vs `unshift` directo | Rebuild correcto: `rebuildFinancialLedgerFromMovements()` (2109-2320, con `idempotencyKey`/`existingIds`); unshift directo sin dedupe: líneas 3573, 3663 | El modelo nuevo usa solo el patrón de reconstrucción idempotente — nunca `unshift` directo |
| PFR canónico vs derivado | `accounting-module.js:2150` — `r.billedIncome`, `r.collectedAmount`, `r.collectionStatus` leídos directo de `performanceFinancialRecords` | PFR nuevo excluye estos campos; se derivan de `venue_receivables`/`payables`/`payments` |

---

## 15. Domain Events

Ver contrato completo en §6 (`DomainEvent`). Catálogo:

| EventType | Aggregate | Command productor | ¿Ledger? | ¿Bitácora? | ¿Proyección financiera? |
|---|---|---|---|---|---|
| `VenueRegistered` | Venue | `createVenue` | No | No | No |
| `VenueAgreementSigned` | VenueAgreement | `createVenueAgreement` | No | Sí | No |
| `OccurrenceCreated` | Occurrence | `createOccurrenceWithPfr` | No | No (audit only) | Agenda |
| `OccurrenceCompleted` | Occurrence | marcar completada | No | Sí | Sí |
| `OccurrenceCancelled` | Occurrence | `cancelOccurrence` | No | Sí | Sí |
| `OccurrenceRescheduled` | Occurrence | `rescheduleOccurrence` | No | Sí | Agenda |
| `InvoiceIssued`* | Invoice | `_saveInvoice` | No | Sí (ya vía enlace) | AR |
| `ReceivableCreated` | VenueReceivable | `createVenueReceivable` | No | No | AR |
| `PayableCreated` | Payable | `createPayable` | No | No | AP |
| `PaymentPending` | Payment | `recordPayment` | No | No | No |
| `PaymentConfirmed` | Payment | `recordPayment` | **Sí** | Sí | **Sí, crítico** |
| `PaymentFailed` | Payment | `recordPayment` | No | No | No |
| `PaymentReversalRecorded` | Payment | cualquiera con `reversalOfPaymentId` | Sí (vía su propio Confirmed) | Sí | Sí |
| `AllocationApplied` | PaymentAllocation | `allocatePayment` | No | No | Sí |
| `AllocationReversed` | PaymentAllocation | `reverseAllocation` | No | Opcional | Sí |
| `RefundRecorded` | Payment | `recordRefund` | Sí | Sí | Sí |
| `OwnerPayoutRecorded` | Payable/Payment | `recordOwnerPayout` | Sí | Sí | Sí |
| `ReconciliationAttempted` | Reconciliation | `reconcilePayment` | No | No | No |
| `ReconciliationMatched` | Reconciliation | `reconcilePayment` | No | Opcional | Sí |
| `ReconciliationExceptionRecorded` | Reconciliation | `reconcilePayment` | No | Sí | Sí |

\* `InvoiceIssued` — **la emisión desde `_saveInvoice` requiere ticket independiente** (§22.4); no queda autorizada por este documento.

**Consumidores:** `operations_log_projection`, `owner_financial_projection`, `notifications`, `analytics`. `future_sync` se menciona solo como capacidad futura (§22.3) — sin código, configuración, ni deliveries.

---

## 16. Outbox multiconsumidor

- **Sin `processedAt` global** — cada consumidor tiene su propia fila `DomainEventDelivery`, con `UNIQUE(eventId, consumerName)` como clave de dedupe y claim.
- **Retry:**
  ```
  attempt 1: inmediato
  attempt 2: +1 min
  attempt 3: +5 min
  attempt 4: +30 min
  attempt 5: +2 h
  después: DEAD_LETTER
  ```
  `notifications`: techo en 3 intentos, descarta entregas tardías sin valor operacional, conserva evidencia del fallo. `owner_financial_projection`/`analytics`: techo en 5, luego alerta Owner/Admin. **Nunca se elimina ni modifica el `DomainEvent` original** por este proceso — el retry es de la *delivery*, nunca del evento.
- **Poison event isolation:** un evento envenenado se aísla en `DEAD_LETTER` a nivel de esa delivery puntual, nunca detiene globalmente `owner_financial_projection`. La proyección afectada se marca `STALE`. Solo se bloquean eventos **posteriores del mismo `aggregateId`** cuando el orden es indispensable para ese agregado. La proyección **nunca** es la única fuente para calcular balances — siempre recalculables desde las entidades canónicas.
- **Idempotencia del efecto:** cada proyección mantiene su propia `UNIQUE(sourceEventId, projectionType)`, independiente de `DomainEventDelivery`. Transacción del consumidor: `1. aplicar efecto de proyección (guardado por esa UNIQUE) → 2. marcar delivery PROCESSED`.
- **Transacción del comando (productor):** no inserta filas de `DomainEventDelivery` — cada consumidor las genera de forma determinista al reclamar/procesar (`SELECT domain_events WHERE eventPosition > checkpoint AND eventType = ANY(subscritos) ORDER BY eventPosition` + `INSERT ... ON CONFLICT DO NOTHING`). Esto evita acoplar el productor a la lista de consumidores y hace gratis agregar uno nuevo más adelante.

---

## 17. Diferencia entre capas

| Capa | Pregunta que responde | Fuente de verdad | ¿Editable? | ¿Reconstruible? |
|---|---|---|---|---|
| Canonical Entity | Estado actual del hecho de negocio | Sí | Solo vía comandos | No aplica |
| Payment | Cuánto dinero se movió | Sí | `status` transiciona; `amount`/`direction` inmutables | No aplica |
| Allocation | A qué obligación se aplicó | Sí | Nunca — solo filas nuevas | No aplica |
| Ledger Entry | Asientos de caja, en orden, para siempre | Sí | Nunca | No aplica |
| Domain Event | Qué pasó, quién más debe saberlo | No (notificación) | Nunca | No aplica (append-only) |
| Delivery | ¿Este consumidor ya procesó esto? | No (metadata operativa) | `status`/`attemptCount` sí | Sí, se recrea vacía |
| Projection | Cómo se ve el mundo desde este consumidor | No, siempre derivada | Sí, libremente | **Sí, siempre**, re-escaneando eventos |
| Bitácora | Qué pasó operativamente hoy, con referencias | No — solo referencia, nunca copia el monto | Con gobernanza especial (Owner + reauth) | Parcial |
| Audit History | Quién hizo qué acción técnica | Sí, para auditoría técnica | No | No necesita |

---

## 18. Cableado UI futuro

| Pantalla | Comando futuro | Query posterior | Estado hoy |
|---|---|---|---|
| Accounting / Venues | `createVenue` | `getVenueProfitability` | Conectado, solo local |
| Accounting / Venues (wizard agreement) | `createVenueAgreement` + `createOccurrenceWithPfr` | — | Conectado, solo local; hoy duplica `venueIncomes` |
| Accounting / Deposits | `recordPayment(INFLOW)` + `allocatePayment` | `getReceivableBalance` | Conectado, solo local |
| Accounting / Payments | `createPayable` + `recordOwnerPayout` | `getPayableBalance` | Conectado, solo local |
| Accounting / History | — (solo lectura) | `getFinancialHistory` | Ya funciona como vista derivada, con inconsistencia de escritura pendiente de resolver (§14) |
| Accounting / Summary | — | `getAccountsReceivable/Payable`, `getCashInflow/Outflow/NetCash` | Cálculo ad hoc hoy |
| Production / Save Invoice | ya existe (`_saveInvoice`) | `getInvoiceBalance` | Conectado, Supabase real |
| Production / Payout | ya existe (`staff_release_event_dj_payout`) | `getPayableBalance` | Conectado y correcto |
| Accounting Center Wizard / One-off coverage *(no Agenda — corregido TICKET-023)* | `createOccurrenceWithPfr(agreementId=null)` | `getOccurrenceEconomics` | **No conectado** — hoy escribe a `state.occurrences` legacy, no invoca el comando canónico |
| Accounting Center Wizard / Recurring occurrence *(no Agenda — corregido TICKET-023)* | `createOccurrenceWithPfr` (batch) | — | **No conectado** — mismo origen legacy que la fila anterior |

> **Corrección TICKET-023:** las dos filas anteriores decían "Agenda" y "Conectado, solo local". Evidencia de código (TICKET-022) demuestra que ninguna afirmación era exacta: el origen real es el wizard de Accounting Center (`accounting-module.js:3501`, `saveScheduleFromWizard` → `state.occurrences`), y ese wizard no invoca el comando canónico `createOccurrenceWithPfr` — solo escribe al array legacy en `localStorage`. `agenda-engine.js` no tiene ninguna referencia a `occurrence`/`venue_agreement`. Ver Anexo TICKET-023 §A-B.

---

## 19. Migración local-first

1. **Export** — script de lectura del `localStorage` real, sin escrituras.
2. **Validar** — revisión manual de cada venue real antes de tocar nada.
3. **Importar localmente** — cargar a tablas nuevas en ambiente de prueba.
4. **Comparar** — totales agregados (por venue, por mes) entre export y modelo nuevo.
5. **Cortar lectura** — `accounting-module.js` deja de leer `localStorage`.
6. **Conservar backup readonly** — el JSON exportado se guarda, `localStorage` no se borra hasta validar en producción real.

**Sin dual-write prolongado** — dado el volumen bajo confirmado, cortar directo tras validar es más seguro que sincronizar dos escrituras indefinidamente.

> **Amendment TICKET-023 — Fase Bridge (previa al paso 1):** la secuencia de arriba asume implícitamente un legacy inmóvil en el momento del export. Evidencia de TICKET-022 demuestra que esto no es así: hoy existen **dos puntos de entrada operativos activos** que siguen creando registros legacy en tiempo real mientras no exista un bridge (Accounting Center Wizard para Venue Operations; Producción/`leads` para Private/Corporate/Special — ver Anexo TICKET-023 §B). Por lo tanto, **antes del paso 1 (Export) debe existir una fase Bridge con reconciliación continua**: un consumidor de solo lectura sobre `domain_events` (patrón outbox, §16) que compare continuamente legacy vs. modelo nuevo mientras ambos coexisten, en vez de asumir un export de una sola vez contra un legacy detenido. Esto **no contradice** "sin dual-write prolongado": el bridge no es una segunda escritura del legacy, es un lector que reconcilia; el corte (paso 5) sigue siendo directo, una sola vez, una vez que la fase Bridge confirma equivalencia continua — no solo puntual. Detalle no diseñado aquí, solo registrado como requisito de contrato; ver Anexo TICKET-023 §E.

---

## 20. Orden completo de implementación

```
1.  Contrato financiero consolidado.               (este documento)
2.  Legacy adapter readonly.
3.  Servicios locales en memoria.
4.  Contrato de Domain Events.
5.  Outbox y deliveries locales en memoria.
6.  Tests de comandos y emisión atómica simulada.
7.  Tests multiconsumidor, retry, dedupe y poison events.
8.  Fixture anonimizado.
9.  Evidencia de equivalencia.
10. Inventario previo de accounting-module.js.
11. Conexión UI local feature-flagged — requiere autorización explícita.
12. Export/import local.
13. Diseño SQL sin ejecutar.
14. Migraciones únicamente en entorno local de prueba.
15. Supabase remoto únicamente con autorización expresa futura.
```
Cada paso requiere autorización individual del Product Owner. Este documento no autoriza automáticamente ningún paso de implementación.

---

## 21. Gates obligatorios antes de tocar `accounting-module.js`

Corresponde al paso 11 de la §20. Antes de abrirlo deben existir y estar aprobados:

```
1. Contrato técnico local            → este documento
2. Legacy adapter readonly           → pendiente de construir y aprobar
3. Servicios locales aislados        → pendiente
4. Tests unitarios                   → pendiente
5. Fixture anonimizado y validado    → pendiente
6. Evidencia de equivalencia         → pendiente
7. Inventario exacto de funciones/sectores a modificar → pendiente
8. Rollback local definido           → pendiente
9. Confirmación de un solo agente escritor → decisión del PO, por ticket
10. Localhost validado por el PO     → pendiente
```
**No autoriza:** migración Supabase, SQL remoto, eliminación de `localStorage`, dual write, modificación de Producción, cambios visuales amplios, refactor general del archivo. Debe ser feature-flagged, acotado y reversible.

---

## 22. Decisiones del Product Owner (registro histórico)

1. **Reprogramación de Occurrence** → comando propio `rescheduleOccurrence`, nunca edición directa de `date`. Ver §6 (Occurrence), §9, §15 (`OccurrenceRescheduled`).
2. **Reversos de Payment** → granularidad `PARTIALLY_REVERSED`/`FULLY_REVERSED` como valor **derivado**, nunca almacenado. Ver §7.
3. **`deposits[].leadId/invoiceId/eventId`** → `LEGACY_READ_SUPPORTED` / `NEW_WRITE_DISABLED`. El puente comercial↔venue futuro será vía `PaymentAllocation.targetType=INVOICE`, no un enlace improvisado desde `deposits[]`.
4. **Orden de implementación** → aceptado como dependencia técnica, no como autorización automática. Cada ticket (§20) requiere aprobación individual; `accounting-module.js` requiere además los 10 gates de §21.
5. **Domain Events + Outbox** → aprobado conceptualmente. Retry, poison-event isolation, `future_sync` fuera de alcance activo, `InvoiceIssued` requiere ticket propio, `eventPosition` monotónico, idempotencia del efecto vía `(sourceEventId, projectionType)` — todos incorporados en §15-16.
6. **Allocation reversal** → corregido de "status flip en la fila original" a "fila compensatoria nueva con `direction=REVERSE`", fila original inmutable siempre. Ver §6 (`PaymentAllocation`).

---

## 23. Diseños supersedidos — excluidos explícitamente

**No vigentes, no deben reintroducirse:**

| Diseño descartado | Reemplazado por |
|---|---|
| `Payment.status` binario `REVERSED` | `effectiveStatus` derivado: `CONFIRMED` / `PARTIALLY_REVERSED` / `FULLY_REVERSED` (§7) |
| `PaymentAllocation` original mutada a `status=REVERSED` | Fila compensatoria nueva, `direction=REVERSE`, original inmutable (§6) |
| `processedAt` global único en el outbox | `DomainEventDelivery` por consumidor, `UNIQUE(eventId, consumerName)` (§6, §16) |
| `future_sync` como consumidor activo | Mención de capacidad futura únicamente, sin código/config/deliveries (§15) |
| Bitácora como writer financiero | Bitácora = solo referencia (`sourceRecordId`/`depositId`/`paymentId`/`occurrenceId`), nunca re-persiste montos (§17) |
| Ledger como sustituto de todos los documentos operacionales | Ledger es una de seis capas separadas (P3); no reemplaza invoices/receivables/payables |
| `venueIncomes[]` como fuente canónica | Descartado; fuente = `venuePayments[]` únicamente (§13-14) |
| Puente `deposits[]→invoice` activado | Desactivado — `LEGACY_READ_SUPPORTED`/`NEW_WRITE_DISABLED` hasta autorización futura (§22.3) |
| `InvoiceIssued` automático desde `_saveInvoice` | Requiere ticket independiente con criterios de aceptación propios (§15, §22.5) |
| Invoice obligatoria por occurrence de venue | Venue Operations usa `VenueReceivable` directo, sin documento formal (§2, §6) |
| Dual-write prolongado en la migración | Cortar directo tras validar (§19) |

---

## 24. Riesgos pendientes

1. **[TICKET-023: formalizado como decisión pendiente del PO, no como ambigüedad menor]** `rescheduleOccurrence` está restringido a `status=SCHEDULED` únicamente (excluye también `COMPLETED`, no solo `CANCELLED`/`NO_SHOW`). TICKET-022 no aportó evidencia nueva que resuelva esto — el contrato permanece exactamente como está hoy (§7) hasta decisión explícita del Product Owner. Ver Anexo TICKET-023 §F.
2. `RECEIVABLE_ALREADY_EXISTS` no está en el catálogo de errores (§11) pero es necesario para `createVenueReceivable` — pendiente de agregar o mapear a `DUPLICATE_IDEMPOTENCY_KEY`.
3. Doble disciplina de escritura de `state.ledger` en el código actual (§14) sigue sin corregirse — es hallazgo, no corrección; se corrige en implementación futura, no en este documento.
4. Volumen real de datos en `localStorage` de julio 2026 (cuántos venues/dispositivos) — determina si la migración manual asistida es viable sin exportador automatizado.
5. Techo exacto de reintentos y ventana de backoff (§16) son valores conceptuales iniciales — pueden ajustarse cuando haya datos reales de fallos.

---

## 25. Glosario

| Término | Definición |
|---|---|
| **Aggregate** | Entidad raíz sobre la que se aplican comandos y de la que se emiten eventos (ej. `Payment`, `Occurrence`). |
| **Allocation** | Aplicación explícita de un `Payment` a una obligación (`Invoice`/`VenueReceivable`/`Payable`). |
| **Append-only** | Que nunca se actualiza ni se borra — toda corrección es una fila nueva. |
| **Businesschannel** | Clasificación obligatoria de todo evento comercial: `VENUE_OPERATION` \| `PRIVATE_EVENT` \| `CORPORATE_EVENT` \| `SPECIAL_EVENT`. |
| **Correlationid** | Agrupa eventos del mismo hilo de negocio. |
| **Dead Letter** | Estado de una `delivery` que agotó sus reintentos — requiere intervención manual. |
| **Domain Event** | Notificación inmutable de un hecho de negocio ya ocurrido. |
| **Effective Status** | Estado calculado en lectura, nunca almacenado como columna primaria. |
| **Idempotency Key** | Clave que garantiza que un reintento no duplique un efecto. |
| **Outbox transaccional** | Patrón donde el evento se inserta en la misma transacción que el hecho que describe — evita dual-write. |
| **PFR** | Performance Financial Record — condiciones económicas 1:1 de una `Occurrence`. |
| **Poison event** | Evento que un consumidor no logra procesar tras el máximo de reintentos. |
| **Projection** | Vista derivada mantenida por un consumidor, reconstruible desde los eventos/entidades. |
| **Reversal / Compensatorio** | Registro nuevo que anula el efecto de uno anterior sin editarlo. |

---

*Documento canónico de la arquitectura financiera V1. Cambios requieren ticket + aprobación PO. Reemplaza como referencia consolidada a los tickets 001-004 y a las decisiones de Domain Events/Outbox que le precedieron — esos tickets permanecen como registro histórico de cómo se llegó a este diseño, pero este documento es la fuente de verdad para implementación futura.*

---

## 26. Anexo TICKET-023 — Delta Documental

**Ticket:** TICKET-023 — Canonical Financial Architecture Delta Revision
**Fecha:** 2026-08-04
**Fuente de evidencia:** exclusivamente TICKET-022 (readonly, verificado contra código vivo). Ningún hallazgo nuevo de auditoría independiente — prohibido explícitamente por el propio TICKET-023.
**Naturaleza:** delta correctivo, no rediseño. El modelo entidad-relación (§5-6), las state machines (§7), los comandos (§9), la idempotencia (§12) y el catálogo de eventos (§15) permanecen exactamente como estaban — ninguno de ellos fue tocado por este delta.

### §A — Corrección: Agenda no es la fuente de Occurrence

Corrige la implicación previa en §18 (ya editada en el cuerpo del documento). Evidencia de código, obtenida en TICKET-022:
- `agenda-engine.js`: cero referencias a `occurrence`, `venue_agreement`, o tabla `occurrences`. Solo lee/escribe `leads`.
- `production-module.js`: cero referencias a `occurrences`, `venue_agreements`, `venue_receivables`.
- `createOccurrenceWithPfr()` solo se invoca hoy dentro de los self-tests y del propio pipeline T009-T016 (`mdj-financial-local-services.js`, `mdj-financial-domain-events.js`, `mdj-financial-legacy-import-bridge.js` y sus `.local-selftest.mjs`) — nunca desde una pantalla real.
- El único punto de código vivo donde algo equivalente a una Occurrence nace hoy es `accounting-module.js:3501` (`saveScheduleFromWizard`), que escribe a `state.occurrences` dentro de `localStorage` (`mdjb_accounting_local_v1`).

### §B — Dos puntos de entrada operativos (registro oficial)

| Origen | Canal | Ruta actual | ¿Genera Occurrence canónica hoy? |
|---|---|---|---|
| Accounting Center Wizard (`accounting-module.js:3501`) | Venue Operations | `state.occurrences` (legacy, `localStorage`) | No — solo el array legacy |
| Producción (`production-module.js`) / `leads` | Private / Corporate / Special | Fila `leads`, sin concepto de Occurrence | No — el modelo actual no genera Occurrence para estos canales en absoluto |

**Consecuencia para el diseño del bridge (registrada aquí, no implementada):** el bridge no puede asumir una única entrada. Debe aceptar al menos estos dos orígenes, con lógica de traducción distinta para cada uno — el primero ya tiene una estructura análoga a `Occurrence` (falta traducir formato); el segundo no tiene ningún concepto de Occurrence hoy y requiere una decisión de diseño separada (§C).

### §C — Pendiente: Conversión Lead → Occurrence

**No implementado. No diseñado en detalle.** Registrado únicamente como definición pendiente:
- ¿Cuándo debería ocurrir la conversión de un `lead` (Private/Corporate/Special) en una `Occurrence` canónica? — no definido.
- ¿Quién la ejecutaría? — no definido.
- ¿Qué comando la dispararía? — no existe todavía en el catálogo de §9.
- ¿Qué validaciones previas requeriría (p. ej. relación con `InvoiceIssued`, ya marcado fuera de alcance en §15 nota\*)? — no definido.

Placeholder de definición futura, no diseño. Requiere un ticket de diseño propio antes de cualquier implementación.

### §D — Pendiente: migración de registros legacy ya monetizados

**No definido en el documento original. Requisito obligatorio antes de cualquier cutover (§19).**
- ¿Qué ocurre con una Occurrence legacy (`state.occurrences`) que ya tiene `venuePayments[]`/depósitos/`collectedAmount` asociados en el momento de la migración?
- ¿Cómo se traduce un `collectedAmount` legacy parcial a `VenueReceivable.status=PARTIALLY_PAID` + `PaymentAllocation` reales, sin inventar fecha/actor/`idempotencyKey` ficticios?
- ¿Qué pasa con reconciliaciones parciales ya realizadas en el modelo legacy, que no tiene el concepto formal de `Reconciliation` de §6?

Marcado como **bloqueante para el paso 3 (Importar localmente) de §19** — no puede ejecutarse sin una regla explícita de traducción para registros ya monetizados, distinta de la regla para registros vacíos/nuevos.

### §E — Por qué se amplió §19

Ver amendment insertado directamente en el cuerpo de §19. Resumen: §19 asumía implícitamente un legacy inmóvil en el momento del export. TICKET-022 demostró que el legacy sigue recibiendo escrituras reales (vía el wizard de Accounting Center) mientras el bridge no exista — una fase de reconciliación continua previa al export es obligatoria, no opcional. El principio "sin dual-write prolongado" (decisión original del PO, §22.4) se mantiene intacto: el bridge propuesto es un **consumidor de lectura**, nunca un segundo escritor.

### §F — `rescheduleOccurrence`

Ver amendment en §24, ítem 1. No se resuelve aquí — queda formalmente como decisión pendiente del Product Owner, sin evidencia nueva de TICKET-022 que la resuelva.

### §G — Limitaciones conocidas (registro formal)

Lo siguiente **no puede implementarse todavía** porque requiere, respectivamente:

| Limitación | Requiere |
|---|---|
| Conversión Lead → Occurrence (§C) | Diseño propio + decisión del Product Owner |
| Migración de registros legacy monetizados (§D) | Regla de traducción explícita + decisión del PO antes del cutover |
| Alcance de `rescheduleOccurrence` (§F) | Decisión del Product Owner |
| Bridge multi-origen (§B) | Implementación futura — solo registrado en el contrato, no diseñado en detalle |
| `InvoiceIssued` automático (§15 nota\*, sin cambios) | Ticket independiente, sin relación con este delta |

---

*Anexo TICKET-023. No altera la filosofía, el modelo de entidades, los comandos ni las state machines del documento base (§1-25). Cambios adicionales requieren nuevo ticket + aprobación PO, igual que el resto del documento.*

---

## 27. Anexo TICKET-024B — Contrato Técnico Lead → Occurrence

**Ticket:** TICKET-024B — Contrato Técnico Canónico Lead → Occurrence
**Fecha:** 2026-08-04
**Alcance:** exclusivamente el canal Private / Corporate / Special Event originado como `lead` en Producción. Venue Operations, Accounting Center Wizard, migración de `state.occurrences` legacy y Cash Flow quedan fuera — se resuelven por líneas separadas.
**Naturaleza:** extiende el contrato base (§1-25) — no lo reescribe. Ninguna entidad, comando, state machine o fórmula existente fue editada. Donde este Anexo requiere un campo que hoy no existe en una entidad de §6, se declara aquí como **extensión formal específica de este canal**, sin alterar el comportamiento ya aprobado de Venue Operations.

### §27.0 — Decisiones de negocio preservadas (TICKET-024A, no reabiertas)

Las 15 decisiones cerradas en TICKET-024A se usan tal cual como restricciones de diseño de este contrato. No se reinterpretan. Cada sección de abajo cita el número de decisión que aplica.

### §27.1 — Hueco 1: `venueId` / `locationSnapshot`

**Opción elegida: A** (`venueId` opcional para canales no-Venue + `locationSnapshot` obligatorio). Se descartan explícitamente:
- **Opción D** (Venue genérico compartido "ad-hoc"): rechazada. Agruparía bajo una sola fila de `Venue` eventos privados sin ninguna relación real entre sí — `getVenueProfitability` y cualquier reporting "por venue" quedarían contaminados con datos de ubicaciones completamente distintas, y la deduplicación/trazabilidad se vuelve imposible de reconstruir después.
- **Opción C** (un `Venue` ad-hoc individual por ubicación): rechazada. Preserva integridad referencial pero malusa la entidad `Venue` — que existe para modelar relaciones recurrentes (`VenueAgreement`, `rateByDay`) — inflándola con filas de un solo uso que nunca deberían aparecer en un listado real de venues.
- **Opción B** (entidad de ubicación canónica independiente): rechazada para V1 por sobre-ingeniería — no hay evidencia de que se necesite más que un snapshot de texto/JSON. Queda anotada como posible V2 si el volumen lo justifica.

**Extensión formal (aplica únicamente a Occurrences con `originType=LEAD`, ver §27.3):**
```
Occurrence.venueId: UUID?          // nullable SOLO cuando originType=LEAD
Occurrence.originType: LEAD | VENUE_AGREEMENT   // nuevo campo, default VENUE_AGREEMENT para no alterar el comportamiento existente
Occurrence.sourceLeadId: UUID?     // requerido cuando originType=LEAD, prohibido en caso contrario
Occurrence.locationSnapshot: JSON? // requerido cuando venueId es null; congelado al momento de conversión (mismo patrón que PFR.rateByDaySnapshot, §6)
```
Para Venue Operations, `originType=VENUE_AGREEMENT`, `venueId` sigue siendo obligatorio exactamente como hoy — **cero cambio de comportamiento** para ese canal. Las queries de reporting por venue (§8, §10) deben filtrar implícitamente `originType=VENUE_AGREEMENT` (o `venueId IS NOT NULL`) — un lead sin venue simplemente no participa en agregados "por venue", que es lo correcto.

### §27.2 — Hueco 2: definición formal de `BOOKED`

**Opción elegida: estado canónico externo al `status` legacy** (no se overloadea `leads.status`/`payment_status`, no se reemplaza ningún valor existente — evita cualquier riesgo de romper lógica legacy que no fue auditada de nuevo en este ticket, per directiva de no duplicación).

```
leads.booking_confirmed_at: Timestamp?   // null = no booked; no-null = booked, valor = auditoría
leads.booked_by: ActorId?                // quién ejecutó la conversión
```

**Transición hacia BOOKED — Fase 1 del ticket, resuelta como Opción B**: BOOKED se establece **como parte de la misma transacción lógica** que crea la Occurrence — nunca como paso separado. No existe (por diseño) un estado "Lead BOOKED sin Occurrence": el acto de marcar `booking_confirmed_at` y el acto de crear Occurrence(s)+PFR(s) son la misma operación atómica dentro de `confirmLeadAsOccurrence` (§27.4). Esto elimina por construcción los tres anti-patrones que el ticket pide evitar explícitamente: Lead BOOKED sin Occurrence, Occurrence creada con Lead todavía NEW, y conversión doble.

> **INVARIANTE — Separación de hechos comerciales, financieros y operacionales (TICKET-024D, corrección obligatoria de TICKET-024C):**
> `BOOKED` representa un hecho **comercial**. `Payment` y `Deposit` representan hechos **financieros**. `Occurrence` representa un hecho **operacional**. Ninguno de estos hechos causa automáticamente la creación, modificación o eliminación de otro.
>
> La confirmación de un `Payment`/`Deposit` puede constituir una **precondición** para que un Lead sea elegible para `BOOKED`, pero no crea por sí misma una `Occurrence`. Del mismo modo, la creación de una `Occurrence` no implica automáticamente la existencia de `Payment`, `Deposit`, `Refund`, `PaymentAllocation` ni ningún otro hecho financiero.
>
> `staff_confirm_event_zelle_deposit` participa exclusivamente como workflow financiero de **validación** cuando corresponda (§27.4, precondición V1) — nunca como propietario del lifecycle comercial u operacional del evento.
>
> La transición Lead → Occurrence solo puede producirse mediante la confirmación explícita y autorizada del Lead como `BOOKED` y la ejecución idempotente de `confirmLeadAsOccurrence` (§27.4).

**Distinción de estados (pedida en Hueco 2, punto 6):**
| Estado | Cómo se distingue |
|---|---|
| Lead creado | fila `leads` existe, `booking_confirmed_at IS NULL` |
| Cotización enviada / propuesta aceptada | valores legacy ya existentes de `status`, sin cambio — fuera de alcance de este contrato |
| Depósito confirmado | resultado de `staff_confirm_event_zelle_deposit` (ya existente, ver §27.7) |
| Evento BOOKED | `booking_confirmed_at IS NOT NULL` |
| Evento convertido | existe `Occurrence` con `sourceLeadId=leadId` |
| Evento cancelado | transición existente de `leads.status`, sin cambio |

**Actor autorizado:** owner / admin / manager (mismo patrón de rol usado hoy en `_canRecordOfflinePayment`/`_syncOfflinePaymentButtonVisibility`, `production-module.js`).

### §27.3 — Hueco 3: evidencia de contrato

**Opción elegida: D** (señal operacional mínima para V1, infraestructura legal completa diferida a ticket separado — per decisión 14, que usa lenguaje no-bloqueante: "puede funcionar como evidencia o prerrequisito").

```
leads.contract_on_file: Boolean (default false)
leads.contract_marked_by: ActorId?
leads.contract_marked_at: Timestamp?
```

**No bloquea la primera implementación del bridge.** `contract_on_file=false` **no** produce un error canónico — aparece como `warning` en la salida del comando (§27.10), dejando la decisión de proceder o no al criterio del staff, exactamente porque no existe hoy infraestructura real de verificación de contratos. El error `LEAD_AGREEMENT_REQUIRED` queda **reservado, no usado en V1** — se activaría solo si un ticket futuro construye el módulo legal y el PO decide hacerlo bloqueante.

### §27.4 — Comando canónico: `confirmLeadAsOccurrence`

| Campo | Definición |
|---|---|
| Input | `{ leadId: UUID, actorId: UUID, occurrenceDates: [{date, shift}, ...] }` |
| Output | Ver §27.10 |
| Actor autorizado | owner \| admin \| manager |
| Precondiciones | lead existe, no cancelado, no ya convertido (`booking_confirmed_at IS NULL`); depósito Zelle confirmado (§27.7, precondición V1); datos mínimos presentes (fecha, `locationSnapshot` o `venueId`, `total_amount`) — **DJ asignado NO es precondición** (decisión 15) |
| Validaciones | una por cada fecha/turno del array `occurrenceDates`, ver §27.5 |
| Atomicidad | transacción única futura: validar → marcar `booking_confirmed_at`+`booked_by` → `createOccurrenceWithPfr` por cada fecha/turno → buscar Payments no asignados del lead → (ver nota de bloqueo abajo) → insertar `DomainEvent` → commit |
| idempotencyKey | `lead-confirm:{leadId}` (sin `version` — un reintento con el mismo `leadId` siempre debe devolver el resultado ya existente, replay puro; no se diseña reconversión en V1) |
| Errores | `LEAD_NOT_FOUND` → reutiliza `TARGET_NOT_FOUND` (§11); `LEAD_NOT_BOOKABLE` (nuevo); `LEAD_MISSING_REQUIRED_DATA` (nuevo); `LEAD_LOCATION_REQUIRED` (nuevo); `OCCURRENCE_ALREADY_EXISTS_FOR_LEAD_SLOT` → reutiliza `OCCURRENCE_ALREADY_EXISTS` (§11); permiso → reutiliza `PERMISSION_DENIED` (§11) |
| Relación con `createOccurrenceWithPfr` | `confirmLeadAsOccurrence` **nunca** crea `Occurrence`/`PFR` directamente — siempre delega, una vez por fecha/turno. Preserva P1: `createOccurrenceWithPfr` sigue siendo el único creador real. |
| Relación con `recordPayment` | Ninguna — el Payment (depósito Zelle) ya existe antes de este comando (§27.6/§27.7). `confirmLeadAsOccurrence` solo lo *busca*, nunca lo crea. |
| Relación con `allocatePayment` | **Bloqueada en V1** — ver nota crítica abajo. |
| Comportamiento multi-fecha | Ver §27.5, Opción A (atomicidad total). |
| Rollback | Cualquier fallo en cualquier fecha/turno revierte el lote completo — cero Occurrences quedan creadas, `booking_confirmed_at` no se marca. |
| Replay idempotente | Mismo `leadId`, mismo payload → devuelve el resultado existente, `replayed=true`. |
| Mismatch de idempotencia | Mismo `leadId`, payload distinto (p. ej. fechas distintas a las ya confirmadas) → `LEAD_ALREADY_CONVERTED` con el detalle de la discrepancia — **no** se trata como el camino feliz de replay. |

> **Nota crítica — bloqueo real encontrado, no resuelto aquí a propósito:** el canal Lead usa `Invoice` (`mdj_staff_manual_invoices`, vía `_saveInvoice`) como su documento de cobro, no `VenueReceivable` (exclusivo de Venue Operations, §2). El propio documento base ya dejó registrado en §15 (nota\*) que **`InvoiceIssued` automático requiere un ticket independiente** y "no queda autorizado por este documento". Consecuencia directa: `confirmLeadAsOccurrence` **no debe crear ningún documento de cobro ni ejecutar `allocatePayment`** en V1 — solo crea `Occurrence`+`PFR`. El Payment del depósito permanece explícitamente sin asignar (`paymentsNotAssigned` en la salida, §27.10) hasta que el ticket de `InvoiceIssued` se resuelva por separado. Esto no es una omisión de este contrato — es el límite exacto que ya existía en el documento base, ahora hecho explícito para este flujo.

### §27.5 — Cardinalidad Lead → Occurrence

**Decisión: Opción A — atomicidad total de todas las occurrences del lead.** Se descartan Opción B (comando individual por occurrence) y Opción C (coordinador con receipts individuales) para V1: con el volumen bajo ya confirmado en otros documentos de esta serie, ninguna justifica su complejidad adicional; quedan como posible evolución V2 si el patrón de leads multi-fecha se vuelve frecuente.

- **Representación de la relación**: `Occurrence.sourceLeadId` (extensión de §27.1), análoga a como `Payable` ya usa `sourceType`/`sourceId`.
- **Identificación de cada occurrence derivada / evitar duplicar fecha-turno**: dado que `venueId` es null para este canal, la unicidad `UNIQUE(venueId, date, shift)` de §6 no aplica — se usa en su lugar `UNIQUE(sourceLeadId, date, shift)`.
- **idempotencyKey por occurrence**: `lead-occurrence:{leadId}:{date}:{shift}` (se omite `startTime` porque no es un campo del contrato de `Occurrence` en §6 — no se inventa uno nuevo).
- **¿Acepta un array?** Sí — `occurrenceDates: [{date, shift}]` en el input (§27.4).
- **¿Se confirma cada una individualmente?** No — bajo atomicidad total, todo el array se valida y se crea en una sola operación.
- **Replay parcial**: no existe bajo esta opción — o se crean todas, o ninguna.
- **Falla en una de varias**: revierte el lote completo (ver Rollback, §27.4); el error identifica exactamente qué fecha/turno falló y por qué.

### §27.6 — Payment previo → Allocation posterior

Formaliza el patrón ya compatible con §6/§10 (`getUnallocatedPayments`) sin crear ninguna entidad nueva.

- **Vínculo Payment↔Lead antes de existir Occurrence**: el contrato de `Payment` (§6) no tiene `sourceType`/`sourceId` propios (eso vive en `PaymentAllocation`, no en `Payment`). Se reutiliza el campo **ya existente** `Payment.reference: String?` para portar el vínculo: `reference = "lead:{leadId}"`. No se agrega ningún campo nuevo a `Payment`.
- **idempotencyKey del Payment**: `payment-lead:{leadId}:{externalPaymentReference}` — **dependencia pendiente**: Zelle no aporta hoy una referencia externa verificable (es confirmación manual de staff, no una API de Zelle real). Sin esa referencia, la clave tendría que derivarse de algo determinístico disponible (p. ej. `leadId` + monto + fecha de confirmación) — queda registrado como hueco de implementación, no resuelto con certeza aquí.
- **Moneda / importe / método**: `currency=USD` (implícito hoy, `calcEventDepositUsd`), `amountCents` = `depositUsd * 100`, `method=ZELLE`.
- **Si la conversión falla**: el Payment permanece exactamente como estaba — confirmado, real, sin asignar. Nunca se revierte, oculta ni borra automáticamente (regla explícita del ticket, Fase 5).
- **Si el lead se cancela**: igual — el Payment sigue siendo un hecho financiero real; un reembolso, si corresponde, es una decisión de negocio separada vía `recordRefund` (§9), nunca automática.
- **Si excede lo debido**: sin `VenueReceivable` para este canal (§27.4, nota crítica), se reformula como "si el Payment excede `total_amount`" — el remanente queda reflejado vía `unallocatedAmount(paymentId)` (§8), sin acción automática.
- **Si cubre varias occurrences**: bajo Opción A (§27.5) todas las occurrences nacen juntas — el reparto exacto del Payment entre PFRs individuales es una decisión de **implementación futura**, no resuelta en detalle aquí (depende de que exista el target de allocation, ver nota crítica §27.4).
- **Evitar doble registro del mismo Zelle**: responsabilidad exclusiva del `idempotencyKey` del Payment (P7) — no requiere ninguna regla nueva más allá de la ya existente en §12.

### §27.7 — Integración con el workflow Zelle existente

Auditado puntualmente (spot-check, no re-auditoría completa): `production-module.js:2875-2972` — `_sendDepositZelleInstructions`, `_confirmZelleDeposit` (RPC `staff_confirm_event_zelle_deposit(p_lead_id)` → `{ok, credited_usd, error}`), `_releaseDjPayout` (RPC `staff_release_event_dj_payout(p_lead_id)` → `{ok, already, error}`). Ambas RPC operan estrictamente por `leadId`, sin `idempotencyKey` explícito ni referencia externa — confirmado, sin cambios.

**Coordinación de los 8 pasos pedidos:**

| # | Paso | Estado hoy |
|---|---|---|
| 1 | Confirmar depósito | Ya existe — `staff_confirm_event_zelle_deposit`, sin cambios |
| 2 | Registrar/confirmar `Payment` | **No existe** — extensión futura de la RPC o paso adicional del cliente tras éxito |
| 3 | Verificar elegibilidad BOOKED | Nuevo — validaciones de §27.4 |
| 4 | Ejecutar `confirmLeadAsOccurrence` | Nuevo comando, no existe hoy |
| 5 | Crear Occurrence + PFR | Delega en `createOccurrenceWithPfr` (existe, nunca invocado desde este flujo) |
| 6 | Crear `VenueReceivable` cuando corresponda | **No aplica a este canal** — se omite explícitamente (ver nota crítica §27.4) |
| 7 | Ejecutar `allocatePayment` | **Bloqueado en V1** (ver nota crítica §27.4) |
| 8 | Resultado visible al staff | §27.10 |

**Los dos resultados exigidos por el ticket:**

- **RESULTADO A** — Depósito confirmado, lead elegible, Occurrence(s) + PFR(s) creados, Payment queda **registrado pero sin asignar** (no "asignado" — la asignación real está bloqueada, ver nota crítica).
- **RESULTADO B** — Depósito confirmado como hecho financiero real, lead **no** elegible (falta dato mínimo), Occurrence no creada, Payment permanece intacto y sin asignar, el sistema devuelve exactamente qué falta (`missingRequirements`, §27.10). **En ningún caso la falta de datos operativos revierte, borra u oculta el depósito ya confirmado** — regla explícita, preservada sin excepción.

### §27.8 — Domain Events

Comparado contra el catálogo ya existente en §15 — se **rechazan** 5 de los 7 eventos sugeridos por ser redundantes:
- `OccurrenceCreatedFromLead` → redundante con `OccurrenceCreated` (§15), que ya cubre la creación; el payload simplemente incluye `originType=LEAD, sourceLeadId` cuando aplica.
- `PaymentRecorded` → redundante con `PaymentConfirmed`/`PaymentPending` (§15).
- `PaymentAllocated` → redundante con `AllocationApplied` (§15).
- `PaymentPendingAllocation` → no es un Domain Event (P10: un evento notifica un hecho ocurrido; "está pendiente" es un estado derivado, ya cubierto por la query `getUnallocatedPayments`, §10).
- `LeadBooked` → no aplica bajo la Opción B de §27.2 (BOOKED y creación de Occurrence son la misma transacción — no hay un momento "BOOKED sin conversión" que notificar por separado).

**Se aprueban exactamente 2 eventos nuevos:**

| EventType | Aggregate | aggregateId | Productor | Payload mínimo |
|---|---|---|---|---|
| `LeadConfirmedAsOccurrence` | Lead | `leadId` | `confirmLeadAsOccurrence` | `leadId`, `occurrenceIds[]`, `actorId`, `occurredAt` |
| `LeadOccurrenceConversionFailed` | Lead | `leadId` | `confirmLeadAsOccurrence` (rama de error) | `leadId`, `errorCode`, `missingRequirements[]` |

Ambos siguen el contrato de `DomainEvent` de §6 sin modificación (`eventVersion`, `eventPosition`, `idempotencyKey`, etc.) y son compatibles con el outbox multiconsumidor de §16 sin cambios.

### §27.9 — Reschedule y cancelación

- **Antes de conversión**: se edita el `lead` directamente (fecha, datos) — nunca se emite `OccurrenceRescheduled`, nunca se ejecuta `rescheduleOccurrence` (decisión 10).
- **Después de conversión**: únicamente `rescheduleOccurrence`, únicamente sobre `status=SCHEDULED` (decisiones 11-13). `COMPLETED`/`CANCELLED`/`NO_SHOW` no son reprogramables — confirmado, sin cambios respecto al riesgo §24.1 ya cerrado.
- **Re-booking tras cancelación**: se crea una **nueva** `Occurrence` (nuevo `occurrenceId`) — el hecho cancelado original nunca se altera (P6). La relación con el lead/contrato original se conserva vía `sourceLeadId` cuando aplique.
- **Receivable**: no aplica a este canal (§27.4).
- **Allocations**: si existían, se reversan formalmente vía `reverseAllocation` (§9, ya existente) — nunca se editan.
- **Payout ya liberado antes de cancelar**: caso de riesgo de negocio real (dinero ya salió) — **fuera del alcance de este contrato técnico**, requiere regla de negocio separada; el error ya existente `PARTIAL_FAILURE_REQUIRES_RECOVERY` (§11) es el candidato natural, sin diseñar más aquí.
- **Depósitos**: permanecen como `Payment` real; reverso vía `recordRefund` (§9) solo por decisión explícita del PO, nunca automático.
- **Cambio de fecha sin cambio de monto**: `rescheduleOccurrence` simple.
- **Cambio de fecha y monto**: `rescheduleOccurrence` + corrección de PFR, reutilizando la regla ya existente en §6 (corregir `rateAmountCents` solo si no existen `payables`/`receivables` creados desde ese PFR; si ya existen, exige void + recrear) — sin inventar nada nuevo.

### §27.10 — Errores canónicos

| Código | Nuevo/Reutilizado | Nota |
|---|---|---|
| `LEAD_NOT_BOOKABLE` | **Nuevo** | específico del dominio, sin equivalente genérico claro |
| `LEAD_MISSING_REQUIRED_DATA` | **Nuevo** | específico del dominio |
| `LEAD_LOCATION_REQUIRED` | **Nuevo** | específico del Hueco 1 |
| `LEAD_NOT_FOUND` | Reutiliza `TARGET_NOT_FOUND` (§11) | — |
| `OCCURRENCE_ALREADY_EXISTS_FOR_LEAD_SLOT` | Reutiliza `OCCURRENCE_ALREADY_EXISTS` (§11) | — |
| `LEAD_BOOKING_NOT_AUTHORIZED` | Reutiliza `PERMISSION_DENIED` (§11) | — |
| `PAYMENT_CURRENCY_MISMATCH` | Reutiliza `CURRENCY_MISMATCH` (§11) | — |
| `LEAD_ALREADY_CONVERTED` | **No es error** | es el camino feliz de idempotencia (`replayed=true`), no un código de error |
| `LEAD_AGREEMENT_REQUIRED` | **Reservado, no usado en V1** | ver §27.3 |
| `PAYMENT_NOT_FOUND_FOR_LEAD` | **No es error** | ausencia normal, se refleja como lista vacía en la salida |
| `PAYMENT_PENDING_ALLOCATION` | **No es error** | estado normal esperado en V1 (ver nota crítica §27.4) |
| `MULTI_OCCURRENCE_CONVERSION_FAILED` | **No se crea** | un fallo parcial ya se identifica con el error específico de la fecha/turno que falló (§27.5); un código genérico adicional no aporta información nueva |

### §27.11 — Idempotencia (fórmulas fijadas)

| Hecho | Fórmula fijada | Diferencia vs. sugerencia original del ticket |
|---|---|---|
| Conversión del lead | `lead-confirm:{leadId}` | sin `:version` — un lead se convierte una vez; reconversión no se diseña en V1 |
| Occurrence derivada | `lead-occurrence:{leadId}:{date}:{shift}` | sin `:startTime` — no es campo del contrato de `Occurrence` hoy |
| Payment del depósito | `payment-lead:{leadId}:{externalPaymentReference}` | igual a lo sugerido; `externalPaymentReference` queda pendiente de definir (Zelle no aporta una hoy) |
| Allocation futura | `alloc:{paymentId}:{targetType}:{targetId}:{attemptUuid}` | se reutiliza **exactamente** la fórmula ya existente en §12 — no se crea una variante nueva |

### §27.12 — Contrato de salida de `confirmLeadAsOccurrence`

```
{
  leadId: UUID,
  bookingStatus: 'CONFIRMED' | 'PENDING' | 'REJECTED',
  occurrenceIds: UUID[],
  performanceFinancialRecordIds: UUID[],
  venueReceivableIds: [],              // siempre vacío en V1 para este canal (ver nota crítica §27.4)
  paymentIds: UUID[],                  // payments encontrados con reference="lead:{leadId}"
  allocationIds: [],                   // siempre vacío en V1 (bloqueado, ver nota crítica §27.4)
  paymentsNotAssigned: UUID[],         // = paymentIds completo, en V1
  replayed: Boolean,
  commandReceiptId: UUID,
  domainEventIds: UUID[],
  warnings: String[],                  // incluye 'CONTRACT_NOT_ON_FILE' si aplica (§27.3)
  missingRequirements: String[]        // solo presente cuando bookingStatus='REJECTED'
}
```

Distingue los 6 casos pedidos: éxito total (`CONFIRMED`, sin `missingRequirements`), depósito confirmado pero conversión pendiente (`PENDING`, `missingRequirements` no vacío, Payment ya buscado/registrado igual), replay idempotente (`replayed=true`, mismo resultado anterior), rechazo por datos incompletos (`REJECTED`), error técnico con rollback (excepción, ningún campo de éxito poblado, lote completo revertido per §27.5), error financiero que requiere revisión (fuera de alcance de este comando — pertenece a `reconcilePayment`/`PARTIAL_FAILURE_REQUIRES_RECOVERY`, ya existentes).

### §27.13 — Dependencias y bloqueantes

| # | Dependencia | Clasificación |
|---|---|---|
| 1 | Nuevo estado `BOOKED` en `leads` (columnas `booking_confirmed_at`/`booked_by`) | REQUIRED_BEFORE_RUNTIME |
| 2 | Resolución de `venueId`/`locationSnapshot`/`originType`/`sourceLeadId` en `Occurrence` | REQUIRED_BEFORE_RUNTIME |
| 3 | Evidencia contractual mínima (`contract_on_file` y columnas asociadas) | CAN_FOLLOW_LATER — no bloquea (§27.3) |
| 4 | Integración con `staff_confirm_event_zelle_deposit` (idempotencyKey, registro de Payment) | BLOCKS_IMPLEMENTATION |
| 5 | Permisos owner/admin/manager para `confirmLeadAsOccurrence` | REQUIRED_BEFORE_RUNTIME |
| 6 | Persistencia futura (tablas reales, hoy todo el pipeline T009-T016 es local-first) | BLOCKS_IMPLEMENTATION |
| 7 | Migraciones futuras (columnas nuevas de #1/#2/#3) | REQUIRED_BEFORE_RUNTIME |
| 8 | UI futura (botón/flujo de staff para disparar la conversión) | CAN_FOLLOW_LATER |
| 9 | Reconciliación con `InvoiceIssued` (bloqueo central, ver nota crítica §27.4) | BLOCKS_IMPLEMENTATION |
| 10 | Tests (unitarios + self-tests, patrón ya usado en T009-T016) | REQUIRED_BEFORE_RUNTIME |
| 11 | *(no pedida por el ticket, agregada por relevancia directa)* Extensión de `staff_release_event_dj_payout` para soportar múltiples occurrences por lead (§27.5/§27.6) | V2_FUTURE — hoy la RPC es 1:1 por `leadId`; mientras no evolucione, el uso real seguirá siendo 1 occurrence por lead en la práctica, aunque el contrato permita más |

---

*Anexo TICKET-024B. Extiende, no reescribe, el documento base (§1-25) ni el Anexo TICKET-023 (§26). No se implementó código, no se ejecutaron migraciones, no se modificó ningún archivo fuera de este documento. El bloqueo central identificado (`InvoiceIssued` automático, nota crítica §27.4) ya estaba registrado en §15 del documento base — este Anexo lo hace explícito para el flujo Lead→Occurrence, no lo crea. Cambios adicionales requieren nuevo ticket + aprobación PO.*
