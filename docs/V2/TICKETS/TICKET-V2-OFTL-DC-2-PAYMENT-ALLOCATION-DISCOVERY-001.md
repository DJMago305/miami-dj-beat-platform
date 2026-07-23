# TICKET-V2-OFTL-DC-2-PAYMENT-ALLOCATION-DISCOVERY-001

## Payment Allocation — Discovery + Architectural Specification (Documentation Only)

| Campo | Valor |
|-------|-------|
| Ticket | V2 OFTL — DC-2 Payment Allocation Discovery |
| Estado | **DOCUMENTADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO** |
| Fase | **DC-2 discovery** — especificación conceptual · **sin implementación** |
| Contrato objetivo | **OFTL-C-004** — `PaymentAllocation` |
| Parent specification | `docs/V2/TICKETS/TICKET-V2-OFTL-DATA-CONTRACTS-001.md` |
| Parent discovery | `docs/V2/TICKETS/TICKET-V2-ARTIST-CASH-FLOW-MANUAL-TRANSACTION-LEDGER-DISCOVERY-001.md` |
| Prerequisite implementado | `docs/V2/TICKETS/TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001.md` (OFTL-C-001…003) |
| Rama baseline | `plan/v2-phase-4-api-client` |
| HEAD baseline | `02949a8c885eeb67debd781aa1437a02a20b2f22` |
| Fecha discovery | 2026-07-23 |
| Modo | **Documentación únicamente** — cero código |

---

## 0. Declaración operativa

Este ticket **no autoriza**:

- TypeScript, runtime, Supabase, migraciones SQL, providers, repositories, adapters;
- servicios funcionales, UI, workers, Edge Functions, tests;
- modificar DC-1 (`finance/contracts/` committed), Notification Center, portales, Cash Flow runtime;
- staging, commit, push, PR, merge, deploy;
- iniciar DC-2 implementación (contratos TS, guards, tests).

**Estado exitoso:** discovery documentado · **SIN CÓDIGO** · commit local autorizado PO · DC-1 / NC / Cash Flow sin tocar.

---

## 1. Objetivo

Diseñar completamente el contrato conceptual **OFTL-C-004 — `PaymentAllocation`**: cómo un **`OwnerFinancialTransaction`** (pago/cobro ejecutado) se **aplica** a una o varias **`FinancialObligation`** (dinero debido), sin confundirlo con patas contables (`OwnerTransactionLeg`), settlement bancario, notificaciones ni proyecciones Cash Flow.

Define propósito, responsabilidades, relaciones, invariantes, límites, dependencias y reglas futuras para la fase de implementación TS (post-aprobación PO).

---

## 2. Baseline Git

| Check | Valor esperado | Resultado |
|-------|----------------|-----------|
| Rama | `plan/v2-phase-4-api-client` | ✓ |
| HEAD | `02949a8c885eeb67debd781aa1437a02a20b2f22` | ✓ |
| Working tree | Limpio | ✓ |
| DC-1 committed | `feat(v2-finance): add OFTL core financial contracts` | ✓ |

---

## 3. Documentos de referencia leídos

| Documento | Rol |
|-----------|-----|
| `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Gobernanza V2 · alcance por ticket |
| `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | Protocolo revisión PO |
| `docs/workflow-control.md` | Sin commit/deploy sin autorización |
| `docs/AGENT-MEMORY.md` | Baseline producto · tiers · zonas rojas |
| `docs/V2/README.md` | Mapa módulos V2 |
| `TICKET-V2-ARTIST-CASH-FLOW-MANUAL-TRANSACTION-LEDGER-DISCOVERY-001.md` | §5A.4 allocation · §5A.6 money · UC-3/6/7/12 |
| `TICKET-V2-OFTL-DATA-CONTRACTS-001.md` | OFTL-C-004 inventario · dependency matrix · fase DC-2 |
| `TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001.md` | Contratos core implementados · fuera de alcance DC-2 |
| `TICKET-V2-NOTIFICATION-CENTER-DISCOVERY-001.md` | Desacoplamiento notificación ↔ hecho financiero |

---

## 4. Problema, responsabilidad y justificación

### 4.1 ¿Qué problema resuelve?

Registra **explícitamente** cuánto de un pago ejecutado se imputa a cada obligación pendiente — habilitando saldo pendiente, cierre parcial/total, multi-obligación, multi-pago, crédito no aplicado y auditoría de imputación sin reinterpretar montos desde patas contables ni KPIs derivados.

### 4.2 ¿Por qué no basta `OwnerTransactionLeg`?

| Aspecto | `OwnerTransactionLeg` (OFTL-C-003) | `PaymentAllocation` (OFTL-C-004) |
|---------|-----------------------------------|----------------------------------|
| Propósito | Materializar impacto por bucket/rol (empresa, contraparte, ajuste) | Vincular **pago ↔ obligación** con monto aplicado |
| Granularidad | Contable-operacional por pata | Comercial-imputación por deuda |
| Parcial / multi-target | No modela Σ aplicado vs obligación | Modelo nativo |
| Sobrepago / unapplied | Fuera de alcance del leg | Excedente → `UnappliedCashBalance` (concepto) |
| Lifecycle | Hereda transacción padre | Vigencia propia documental (§8) sin mezclar enums de transacción |

En DC-1, `financialObligationId` en un leg es **opcional** y **no sustituye** una fila de allocation: un pago puede tener legs correctos sin allocation (pago no imputado), o allocation sin que cada leg duplique la obligación.

### 4.3 ¿Por qué Allocation debe existir separado?

Principio PO discovery §5A.4: **no** un solo registro para obligación + pago + imputación + settlement + notificación. La imputación es un **hecho canónico append-only** distinto del pago y distinto del movimiento contable materializado.

### 4.4 ¿Qué ocurriría si no existiera?

- Imputación implícita vía `linkedFinancialObligationId` en transacción → **no soporta** 1 pago → N obligaciones ni N pagos → 1 obligación con trazabilidad por línea.
- Derivar imputación solo de legs → mezcla contabilidad con deuda comercial; KPIs outstanding payroll serían frágiles.
- Sobrepagos quedarían sin suspense explícito (UC-12); riesgo de obligaciones falsas o montos editados.
- Reversiones parciales sin compensating allocations auditables.

### 4.5 Responsabilidad única

**`PaymentAllocation` (OFTL-C-004)** = registro canónico append-only que declara: «de la transacción T, se aplican X minor units a la obligación O», con moneda explícita, origen, auditoría e idempotencia de escritura.

Representa la **aplicación de una porción válida de fondos** de una transacción a una obligación concreta.

**No representa ni sustituye:**

| Prohibido | Motivo |
|-----------|--------|
| Dinero nuevo / ingreso adicional | Distribuye fondos ya declarados en la transacción |
| `OwnerFinancialTransaction` | El pago es hecho separado |
| `OwnerTransactionLeg` | Clasificación contable ≠ imputación comercial |
| `FinancialObligation` | La deuda es hecho separado |
| Settlement bancario | DC-4 futuro |
| Reconciliación | DC-4 futuro |
| Cash Flow / `CFMovement` | Proyección derivada §13 |
| Notificación | DC-5 / Notification Center separado |

---

## 5. Modelo conceptual — cadena de dominio

```
FinancialObligation          (dinero debido — OFTL-C-001)
        ↓
OwnerFinancialTransaction    (pago/cobro ejecutado — OFTL-C-002)
        ↓
OwnerTransactionLeg          (pata materializada — OFTL-C-003)
        ↓
PaymentAllocation            (imputación pago → obligación — OFTL-C-004)
        ↓
[ futuro DC-3+ ] CheckInstrument · BankSettlement · ReconciliationRecord
        ↓
[ futuro DC-5+ ] FinancialDomainEvent · NotificationOutboxRecord
        ↓
[ futuro DC-6+ ] CFMovement · proyecciones Cash Flow (read/audit)
```

**Nota de dependencia:** una transacción puede existir **antes** de existir allocation (pago no asignado). Una obligación puede existir **sin** pago. Allocation **requiere** ambos extremos referenciados cuando se registra.

---

## 6. Transaction ≠ Leg ≠ Allocation

| Entidad | Pregunta que responde | Ejemplo |
|---------|----------------------|---------|
| **Transaction** | ¿Qué pago/cobro ocurrió, por qué método, por qué monto total? | Owner paga $400 cash a DJ Carlos |
| **Leg** | ¿Cómo se materializa el impacto contable-operacional por bucket? | Company OUTFLOW $400 + Artist wallet INFLOW $400 |
| **Allocation** | ¿Cuánto de ese pago reduce qué obligación? | $400 aplicados a obligation «Event payout $600» → $200 pending |

**Reglas de separación:**

1. Monto total del pago vive en **`OwnerFinancialTransaction.totalAmount`** — no se reconstruye sumando allocations para definir el pago.
2. Σ allocations **≤** monto imputable del pago (§10); excedente → **`UnappliedCashBalance`** (concepto suspense — no obligación ficticia).
3. Legs **no** sustituyen allocations; correlación leg↔allocation es opcional vía metadata (§8).
4. Cambiar obligation status (`OPEN` → `PARTIALLY_PAID` → `PAID`) es **efecto derivado** de allocations activas + reglas de dominio futuras — no un campo editable en allocation sin audit trail.

---

## 7. Contrato conceptual `PaymentAllocation` (OFTL-C-004)

Registro **append-only** · JSON-serializable (futuro) · sin clases · timestamps como `string` · montos en minor units no negativos · moneda explícita.

### 7.1 Campos conceptuales principales

| Campo conceptual | Obligatorio | Descripción |
|------------------|-------------|-------------|
| `schemaVersion` | Sí | Literal de evolución de contrato (futuro: `1`) |
| `paymentAllocationId` | Sí | Identificador nominal único |
| `ownerFinancialTransactionId` | Sí | Transacción que aporta el pago |
| `financialObligationId` | Sí | Obligación imputada |
| `allocatedAmount` | Sí | Par `{ amountMinorUnits, currencyCode }` — magnitud aplicada |
| `allocationStatus` | Sí | Vigencia documental de la fila (§8.1) |
| `allocationReason` | Sí | Motivo de negocio (§8.2) |
| `allocationSource` | Sí | Origen del registro (§8.3) |
| `allocationContext` | Opcional | Contexto UI/workflow (§8.5) |
| `allocationReference` | Opcional | Correlación externa / leg / batch (§8.4) |
| `allocationAuditMetadata` | Sí | Extension audit JSON-safe (§8.6) |
| `idempotencyKey` | Sí | Clave idempotente de **esta** escritura allocation |
| `recordedByUserId` | Sí | Actor que registra |
| `recordedAt` | Sí | ISO timestamp string |
| `createdAt` / `updatedAt` | Sí | Auditoría temporal |
| `reversalOfAllocationId` | Opcional | Si esta fila compensa otra (append-only) |
| `supersedesAllocationId` | Opcional | Reasignación futura auditada |

### 7.2 Concepto relacionado: `UnappliedCashBalance`

No es un cuarto contrato core en DC-2 discovery; es **proyección o línea suspense explícita** cuando Σ allocations activas `<` monto imputable del pago (UC-12). **No** crear obligación falsa por el excedente.

---

## 8. Tipos auxiliares conceptuales (sin TypeScript)

### 8.1 `PaymentAllocationId`

Identificador nominal opaco (futuro: branded string). No intercambiable con `OwnerFinancialTransactionId` ni `FinancialObligationId`.

### 8.2 `AllocationStatus`

Estados documentales de la **fila** allocation (no reutilizar `TransactionLifecycleStatus` ni `ObligationLifecycleStatus`):

| Valor | Significado |
|-------|-------------|
| `PENDING` | Registrada; pendiente confirmación operativa (p. ej. cheque no cleared) |
| `ACTIVE` | Imputación vigente que cuenta para saldos |
| `REVERSED` | Compensada por fila reversal append-only |
| `CANCELLED` | Anulada antes de impacto contable final (policy futura PO) |
| `SUPERSEDED` | Reemplazada por reasignación auditada |

Vigencia global del hecho económico sigue gobernada por payment + obligation lifecycles (discovery §5A.2).

### 8.3 `AllocationReason`

Motivo de negocio normalizado (ejemplos conceptuales):

| Valor | Uso |
|-------|-----|
| `SCHEDULED_PAYOUT` | Pago programado contra obligación acordada |
| `PARTIAL_SETTLEMENT` | Imputación parcial explícita |
| `MULTI_OBLIGATION_SPLIT` | Porción en pago multi-target |
| `CLIENT_DEPOSIT_APPLIED` | Depósito cliente aplicado a receivable |
| `MANUAL_OWNER_APPLY` | Owner aplica crédito/unapplied manualmente |
| `CORRECTION_REALLOCATION` | Reasignación post-auditoría |
| `REVERSAL_COMPENSATION` | Compensación por reversal de pago |

### 8.4 `AllocationSource`

Provenance de la escritura (distinto de `OwnerFinancialSourceSystem` del pago):

| Valor | Uso |
|-------|-----|
| `OWNER_MANUAL_UI` | Captura Owner en panel futuro |
| `STAFF_MANUAL_UI` | Staff autorizado |
| `IMPORT_BATCH` | Importación controlada |
| `SYSTEM_AUTO_MATCH` | Matching automático futuro (policy PO) |
| `REVERSAL_ENGINE` | Generada por compensación |
| `BRIDGE_LEGACY` | Puente desde V1 (fase compatibilidad) |

### 8.5 `AllocationReference`

Correlación opcional — **no** sustituye IDs obligatorios:

| Subcampo conceptual | Uso |
|---------------------|-----|
| `ownerTransactionLegId` | Leg primario relacionado (trazabilidad) |
| `transactionGroupId` | Batch / grupo compartido |
| `externalReference` | ID cheque, Stripe pi_xxx, wire ref |
| `leadId` / `staffInvoiceId` | Contexto comercial |
| `batchSequence` | Orden dentro de multi-allocation |

### 8.6 `AllocationContext`

Snapshot de contexto no monetario en momento de imputación: pantalla origen, versión de contrato UI, notas operativas, `capabilitySnapshot` — **sin** enforcement runtime en DC-2.

### 8.7 `AllocationAuditMetadata`

Mapa JSON-safe (`string | number | boolean | null`) para auditoría: `reasonCode`, `approvedByStaffUserId`, `correlationId`, `causationId` — patrón alineado `FinancialAuditMetadata` DC-1.

---

## 9. Cardinalidades

| Relación | Cardinalidad | Regla |
|----------|--------------|-------|
| Transaction → Allocations | **1 → N** | Un pago puede imputarse a varias obligaciones (UC-6) |
| Allocation → Transaction | **N → 1** | Cada allocation pertenece a **exactamente una** transacción |
| Obligation → Allocations | **1 → N** | Varias imputaciones acumulativas (UC-7) |
| Allocation → Obligation | **N → 1** | Cada allocation apunta a **exactamente una** obligación |
| Legs → Allocation | **N → 0..1** | **Permitido** — ver §9.1 |

### 9.1 ¿N Legs → 1 Allocation permitido?

**Sí — y es el caso habitual.**

Justificación:

- Una transacción con doble impacto (p. ej. COMPANY OUTFLOW + ARTIST_WALLET INFLOW) produce **N ≥ 2 legs** por diseño §6.1 discovery.
- Una imputación comercial «$400 a obligation X» es **una** fila `PaymentAllocation`, independiente del número de legs.
- Opcionalmente `allocationReference.ownerTransactionLegId` señala **un** leg representativo; **no** se exige 1:1 leg-allocation.
- **Prohibido** inferir allocation únicamente multiplicando legs sin fila allocation explícita.

**Anti-doble-conteo leg ↔ allocation (obligatorio):**

- Los legs **no** crean fondos adicionales — solo materializan la transacción existente.
- Todo allocation debe identificar la **fuente monetaria aplicable**: `ownerFinancialTransactionId` + `allocatedAmount` (no Σ indiscriminada de legs).
- **No** se suman legs de débito y crédito como si fueran imputaciones independientes a obligaciones.
- La correlación exacta leg↔allocation (metadata 0..1 vs futuras reglas N→1) requiere **definición contractual en implementación** — no decisión definitiva en este discovery.
- Incumplimiento → riesgo **R-DC2-METRICS-01** (doble conteo).

---

## 10. Invariantes (reglas de dominio)

| ID | Regla |
|----|-------|
| **OFTL-AL-01** | Σ `allocatedAmount` (allocations **ACTIVE** + **PENDING** policy) por transacción **≤** monto imputable del pago (misma moneda) |
| **OFTL-AL-02** | Obligation en estado `PAID` o `CANCELLED` **no** recibe nuevas allocations **ACTIVE** |
| **OFTL-AL-03** | Cada allocation pertenece a **exactamente una** transacción |
| **OFTL-AL-04** | Cada allocation pertenece a **exactamente una** obligación |
| **OFTL-AL-05** | No existen montos allocation negativos — ajustes vía reversal/compensating allocation |
| **OFTL-AL-06** | Toda allocation tiene `currencyCode` explícita; debe coincidir con moneda del pago y obligación imputada (multi-moneda futura: gate PO) |
| **OFTL-AL-07** | Toda allocation tiene `allocationAuditMetadata` mínimo + actor + timestamps |
| **OFTL-AL-08** | Toda allocation tiene `allocationSource` y `allocationReason` |
| **OFTL-AL-09** | No existen allocations huérfanos — IDs de transacción y obligación referenciados deben existir en el mismo bounded context write |
| **OFTL-AL-10** | Escritura allocation es **append-only** — corrección = reversal / supersede, no UPDATE destructivo del monto |
| **OFTL-AL-11** | `idempotencyKey` único por intento lógico de crear allocation |
| **OFTL-AL-12** | Sobrepago: **no** crear allocation **ACTIVE** que exceda obligation pending ni monto aplicable del pago — excedente → `UnappliedCashBalance` / crédito futuro / exception state (§10.1) |
| **OFTL-AL-13** | Σ allocations **ACTIVE** (policy) hacia una obligation **≤** saldo válido pending de esa obligation |
| **OFTL-AL-14** | Allocations `REVERSED` · `CANCELLED` · `SUPERSEDED` **no** cuentan en Σ activo |
| **OFTL-AL-15** | Reasignación solo vía fila nueva + `supersedesAllocationId` — **sin** UPDATE silencioso ni reasignación sin trazabilidad |

### 10.1 Sobrepago y fondos no aplicados

El sistema **puede detectar** sobrepago o saldo no aplicado, pero **no** debe registrar allocation **ACTIVE** que viole OFTL-AL-01…13.

Un exceso de fondos queda conceptualmente como:

- **`unallocated_amount`** (transacción);
- **`UnappliedCashBalance`** / crédito pendiente futuro;
- **exception state** operativo;
- **acción pendiente de resolución** (Owner/staff);

**Prohibido:** aplicar ficticiamente el excedente a una obligation ya cubierta o inventar obligation por el sobrepago.

---

## 11. Casos de uso DC2-UC-01 … DC2-UC-12

| ID | Escenario | Hecho | Allocation esperada |
|----|-----------|-------|---------------------|
| **DC2-UC-01** | Pago completo | Obligation $600 pending; pago $600 | 1× ACTIVE $600 → obligation `PAID` |
| **DC2-UC-02** | Pago parcial | Obligation $600; pago $400 | 1× ACTIVE $400; obligation `PARTIALLY_PAID`; $200 pending |
| **DC2-UC-03** | Una transacción, varias obligaciones | Cheque $1500; 3 DJs × $500 | 3× ACTIVE $500 c/u, misma `ownerFinancialTransactionId` |
| **DC2-UC-04** | Varias transacciones, una obligación | Obligation $900; pagos $300+$400+$200 | 3× allocations acumulativas → `PAID` |
| **DC2-UC-05** | Sobrepago | Obligation $450; pago $500 | Allocation $450 ACTIVE; $50 → `UnappliedCashBalance` |
| **DC2-UC-06** | Crédito pendiente | Pago $500 sin obligation | 0 allocations; transacción POSTED; unapplied $500 suspense |
| **DC2-UC-07** | Allocation revertido | Reversal de pago parcial | Nueva allocation/fila `REVERSED` o compensating; obligation balance restaurado |
| **DC2-UC-08** | Allocation cancelado | Error antes de POSTED | Allocation `CANCELLED`; no cuenta en Σ |
| **DC2-UC-09** | Allocation pendiente | Cheque incoming RECEIVED | Allocation `PENDING` hasta policy POSTED/CLEARED |
| **DC2-UC-10** | Proveniente de cheque futuro | UC-2 discovery | Allocation referencia `externalReference` cheque; status sigue instrumento DC-3 |
| **DC2-UC-11** | Proveniente de Stripe | Client payment `payment_provider=STRIPE` | Allocation ACTIVE tras POSTED; `allocationSource` UI o bridge |
| **DC2-UC-12** | Proveniente de efectivo | UC-1 cash immediate | Allocation ACTIVE inmediata; legs cash POSTED |

---

## 12. Dependencias

### 12.1 Depende de (bloqueante conceptual)

| Contrato DC-1 | Uso en allocation |
|---------------|-----------------|
| `FinancialObligation` | Target de imputación; pending amount |
| `OwnerFinancialTransaction` | Fuente del pago; total imputable |
| `OwnerTransactionLeg` | Correlación opcional; no sustituto |
| `MoneyAmount` / minor units semantics | Monto allocation |
| `MdjUserId` / audit patterns DC-1 | Actor y metadata |

### 12.2 NO depende de (explícito)

| Dominio | Motivo |
|---------|--------|
| `CheckInstrument` | DC-3 — instrumento ≠ imputación |
| `BankSettlement` | DC-4 — banco ≠ imputación comercial |
| `ReconciliationRecord` | DC-4 — match externo posterior |
| `FinancialDomainEvent` / Notification | DC-5 — fallo notificación no altera allocation §5B |
| `CFMovement` / Cash Flow UI | DC-6 — proyección derivada |
| Supabase / runtime / providers | Fuera de alcance discovery |

---

## 13. Transparencia financiera y métricas hacia Cash Flow

**Principio arquitectónico:** cada dominio financiero OFTL **calcula y expone sus propias métricas**. Cash Flow **consolida y proyecta**. Cash Flow **no** es fuente canónica · **no** escribe transacciones · **no** corrige obligaciones · **no** modifica allocations · **no** debe inferir montos ocultos o ambiguos.

**Estado de integración:**

**CASH FLOW INTEGRATION: FUTURA · DOCUMENTADA CONCEPTUALMENTE · NO IMPLEMENTADA · NO AUTORIZADA EN DC-2 DISCOVERY**

### 13.1 Métricas propias de `FinancialObligation` (conceptuales — no implementar)

| Métrica conceptual | Descripción |
|--------------------|-------------|
| `original_amount` | Monto acordado/debido al crear la obligación |
| `paid_amount` | Suma de imputaciones activas válidas (§13.9) |
| `outstanding_amount` | Saldo pendiente de cobro/pago |
| `overdue_amount` | Porción outstanding vencida por `dueDate` (policy futura) |
| `cancelled_amount` | Monto anulado por cancelación auditada |
| `reversed_amount` | Monto neutralizado por reversión/compensación |

**Productor canónico:** `FinancialObligation` + agregación sobre `PaymentAllocation` — **no** CFMovement.

### 13.2 Métricas propias de `OwnerFinancialTransaction` (conceptuales — no implementar)

| Métrica conceptual | Descripción |
|--------------------|-------------|
| `total_transaction_amount` | `totalAmount` del pago/cobro |
| `posted_amount` | Porción en lifecycle POSTED / SETTLED |
| `settled_amount` | Porción con allocations que cierran obligaciones vinculadas |
| `pending_amount` | Porción PENDING / PARTIALLY_SETTLED sin cierre total |
| `reversed_amount` | Monto compensado por reversal append-only |
| `voided_amount` | Monto VOIDED (sin efecto neto) |

**Productor canónico:** transacción + lifecycles — **no** Cash Flow UI.

### 13.3 Métricas propias de `OwnerTransactionLeg` (conceptuales — no implementar)

| Métrica conceptual | Descripción |
|--------------------|-------------|
| `inflow_amount` | Magnitud INFLOW por leg |
| `outflow_amount` | Magnitud OUTFLOW por leg |
| `debit_amount` / `credit_amount` | Vista contable futura por bucket (policy PO) |
| `amount_by_ledger_bucket` | Agregación por `LegLedgerBucket` |
| `amount_by_leg_role` | Agregación por `TransactionLegRole` |

**Productor canónico:** legs materializados — **independiente** de allocation count.

### 13.4 Métricas propias de `PaymentAllocation` (conceptuales — no implementar)

| Métrica conceptual | Descripción |
|--------------------|-------------|
| `allocated_amount` | `allocatedAmount` de la fila |
| `active_allocated_amount` | Σ filas `ACTIVE` |
| `pending_allocated_amount` | Σ filas `PENDING` |
| `reversed_allocated_amount` | Σ filas `REVERSED` / compensating |
| `cancelled_allocated_amount` | Σ filas `CANCELLED` |
| `unallocated_amount` | Monto aplicable del pago − Σ active/pending policy |
| `overallocated_amount` | Exceso sobre monto aplicable — **idealmente cero** (OFTL-AL-01) |
| `allocation_count` | N filas por transacción u obligación |
| `obligations_covered_count` | N obligaciones distintas tocadas por un pago |

**Regla de no duplicación (§13.12):** allocation **distribuye** montos ya declarados en la transacción — **no** describe dinero nuevo ni ingreso adicional.

### 13.5 Cash Flow como proyección

`CFMovement` y cualquier read model Cash Flow futuro:

| Regla | Detalle |
|-------|---------|
| Consume | Datos **ya validados** en contratos OFTL |
| No es | Fuente canónica · sustituto de OFTL |
| No modifica | Obligations · transactions · legs · allocations |
| No decide | Estados financieros canónicos |
| No calcula | Silenciosamente datos faltantes |
| Debe | Conservar referencias al origen |
| Debe ser | **Reconstruible** desde contratos canónicos append-only |

### 13.6 Trazabilidad obligatoria hacia Cash Flow

Toda métrica proyectada debe poder rastrearse mediante (campos futuros — documentar necesidad, no implementar en DC-2):

| Referencia | Cuándo |
|------------|--------|
| `financial_obligation_id` | Métricas de obligación / paid / outstanding |
| `owner_financial_transaction_id` | Métricas de pago / unallocated |
| `owner_transaction_leg_id` | Métricas por bucket/rol |
| `payment_allocation_id` | Métricas de aplicación |
| `source_reference` | Provenance dominio |
| `correlation_id` | Cadena evento/proyección (futuro DC-5/DC-6) |
| `causation_id` | Causa inmediata del cálculo (futuro) |
| `calculation_version` | Versión del algoritmo de proyección (futuro) |
| `generated_at` | Timestamp de materialización read model (futuro) |

### 13.7 Independencia por parte

Las métricas **no** deben consolidarse prematuramente en un único monto opaco. Dimensiones separadas:

- obligación · transacción · leg · allocation
- método de pago · categoría financiera
- actor / contraparte · portal / dominio origen
- evento · moneda · periodo contable futuro

Cash Flow consolidado = **capa superior** que **compone** métricas ya calculadas por dominio — no reemplaza el desglose.

### 13.8 Prevención de doble conteo

| Regla | Detalle |
|-------|---------|
| Transacción vs allocation | Un monto **no** cuenta como pago **y** como allocation en la **misma** métrica consolidada |
| Allocation | Aplicación de fondos — **no** nuevo ingreso |
| Settlement (DC-4 futuro) | Confirmación bancaria — **no** nuevo ingreso |
| Reversal | Neutraliza/revierte — **no** segunda transacción positiva |
| Cash Flow | Debe distinguir **bruto · neto · pendiente · aplicado · no aplicado · liquidado · revertido · cancelado** |
| Proyección | Debe **declarar base de cálculo** en metadata futura |

### 13.9 Reconciliación de métricas (identidades conceptuales futuras)

Identidades orientativas — **no** implementar runtime · **no** reglas definitivas fees/refunds/chargebacks/taxes/multi-currency:

```
Σ active_allocated (obligation)  ≤  monto total aplicable de transacciones relacionadas

paid_amount (obligation)  =  Σ allocations activos y válidos

outstanding_amount  =  original_amount − paid_amount válido

unallocated_amount (transaction)  =  monto aplicable − Σ allocations activos (policy)

active_allocated_amount  ≤  available applicable transaction amount

active_allocated_amount  ≤  valid obligation balance
```

**Fuera de alcance en este ticket (tickets separados):** fees · taxes · refunds · chargebacks · tips · commissions · currency conversion · exchange rates · settlement timing.

Violaciones → discrepancia auditable en UI futura — **sin** editar origen desde Cash Flow.

### 13.10 Transparencia para el Owner (UI futura — no implementar)

La futura UI Cash Flow Owner debe permitir conceptualmente:

- ver total consolidado **y** abrir desglose;
- identificar contrato de origen (OFTL-C-00x);
- conocer qué cálculo produjo la cifra (`calculation_version`);
- distinguir pendiente · aplicado · liquidado · revertido;
- detectar discrepancias vs identidades §13.9;
- exportar evidencia futura;
- auditar cambios **sin** editar canonical desde Cash Flow.

### 13.11 Transparencia para Artist, Client y Staff (futuro)

Cada portal futuro verá **solo** métricas autorizadas según rol · ownership · relación contractual · permisos · privacidad · sensibilidad financiera. **No** definir UI ni permisos runtime en este discovery.

### 13.12 Regla de no duplicación monetaria canónica

`PaymentAllocation` **no** crea segunda representación monetaria canónica. Referencia montos de **`OwnerFinancialTransaction`** y los **aplica** a **`FinancialObligation`**. La métrica allocation describe **distribución**, no dinero nuevo.

### 13.13 Impact analysis — métricas y Cash Flow

| Métrica (ejemplo) | Contrato productor | Fuente canónica | Consumidor futuro | Riesgo doble conteo | Regla trazabilidad | Estado |
|-------------------|-------------------|-----------------|-------------------|---------------------|-------------------|--------|
| `outstanding_amount` | Obligation + Allocation | OFTL-C-001 + C-004 | Cash Flow Artist KPI | Alto si suma txn bruta | `obligation_id` + Σ `allocation_id` | Documentado |
| `total_transaction_amount` | Transaction | OFTL-C-002 | CF company inflow/outflow | Alto si también suma allocations | `transaction_id` | Documentado |
| `active_allocated_amount` | Allocation | OFTL-C-004 | Outstanding payroll rollup | **Crítico** vs txn total | `payment_allocation_id` | Documentado |
| `unallocated_amount` | Transaction − Allocation | C-002 + C-004 | Unapplied suspense UI | Medio | `transaction_id` | Documentado |
| `amount_by_ledger_bucket` | Leg | OFTL-C-003 | Empresa P&L projection | Medio vs txn si mezclado | `leg_id` | Documentado |
| `settled_amount` (bank) | BankSettlement | OFTL-C-006 futuro | Cash Flow liquidado | **Crítico** vs posted | settlement ref | Futuro DC-4 |
| CFMovement line | Proyección | **Derivada** | Portal read | Alto si writer | full origin refs §13.6 | Futuro DC-6 |

### 13.14 Riesgos métricas / Cash Flow

| ID | Riesgo |
|----|--------|
| R-DC2-METRICS-01 | Doble conteo entre transaction, allocation y Cash Flow |
| R-DC2-METRICS-02 | Cash Flow convertido accidentalmente en fuente canónica |
| R-DC2-METRICS-03 | Métricas consolidadas sin referencia al origen |
| R-DC2-METRICS-04 | Confusión entre dinero recibido y dinero aplicado |
| R-DC2-METRICS-05 | Confusión entre dinero aplicado y dinero liquidado por banco |
| R-DC2-METRICS-06 | Reversiones contadas como nuevos movimientos positivos |
| R-DC2-METRICS-07 | Cálculos diferentes entre Staff, Artist y Owner |
| R-DC2-METRICS-08 | Métricas históricas que cambian sin versionado de cálculo |
| R-DC2-METRICS-09 | Montos opacos imposibles de auditar |
| R-DC2-METRICS-10 | Multi-moneda consolidada sin reglas de conversión verificables |

---

## 14. Riesgos

| ID | Riesgo | Mitigación documentada |
|----|--------|-------------------------|
| R-DC2-01 | **Duplicidad** — doble allocation mismo pago/obligación | `idempotencyKey` + UNIQUE futuro en persistencia |
| R-DC2-02 | **Idempotencia** — retry UI crea segunda fila | Misma clave → no-op o conflicto explícito |
| R-DC2-03 | **Sobrepago** mal modelado como obligation extra | `UnappliedCashBalance` suspense UC-12 |
| R-DC2-04 | **Concurrencia** — dos pagos paralelos misma obligation | Unidad lógica write + validación Σ pending |
| R-DC2-05 | **Cancelaciones** sin audit trail | `CANCELLED` / `REVERSED` append-only |
| R-DC2-06 | **Reversiones** parciales incorrectas | Compensating allocation + link `reversalOfAllocationId` |
| R-DC2-07 | **Pagos futuros** aplicados a obligation ya `PAID` | Guard OFTL-AL-02 |
| R-DC2-08 | **Integridad** Σ allocation vs payment | OFTL-AL-01 en service futuro |
| R-DC2-09 | **Auditoría** insuficiente | Metadata obligatoria §8.7 |
| R-DC2-10 | **Fraude** — staff imputa a obligation ajena | `FinanceAuthorizationContext` + RLS futuro |
| R-DC2-11 | **Multi-moneda futura** | Gate PO; hoy USD-first — currency must match |
| R-DC2-12 | Confundir leg optional FK con allocation | Este discovery §6 — DC-2 implementación no sustituye |
| R-DC2-13 | Métricas / Cash Flow (ver §13.14) | R-DC2-METRICS-01…10 · reglas §13.8–13.12 |

---

## 15. Roadmap futuro (post-discovery)

| ID | Entregable | Notas |
|----|------------|-------|
| **DC2-RM-01** | Contratos TS `PaymentAllocation` + auxiliares | Extiende `finance/contracts/` |
| **DC2-RM-02** | Guards (`assertValidAllocationAmount`, status narrows) | Puros · sin I/O |
| **DC2-RM-03** | Tests unitarios allocation | Fixtures UC-01…12 |
| **DC2-RM-04** | Barrels / exports | `contracts/index.ts` |
| **DC2-RM-05** | Provider futuro (in-memory lab) | Análogo Legal DC-2 |
| **DC2-RM-06** | Persistencia futura | Append-only repository |
| **DC2-RM-07** | Supabase futura | DDL aditivo · zona roja PO |
| **DC2-RM-08** | Integración Cash Flow | Proyección CFMovement — read |
| **DC2-RM-09** | Notification domain events | Post-commit · no writer allocation |
| **DC2-RM-10** | Reporting | Outstanding payroll · unapplied balances |

---

## 16. Dependency Matrix

| Consumidor / productor | Relación con `PaymentAllocation` |
|------------------------|-----------------------------------|
| `FinancialObligation` | **Referenciada por** allocation — no contiene lógica allocation |
| `OwnerFinancialTransaction` | **Referenciada por** allocation — `linkedFinancialObligationId` opcional no sustituye filas |
| `OwnerTransactionLeg` | **Correlación opcional** — no depende de allocation para existir |
| `UnappliedCashBalance` (concepto) | **Derivado de** Σ payment − Σ allocation |
| `CheckInstrument` | **No debe** escribir allocation directamente — transición vía payment policy |
| `BankSettlement` | **No depende** de allocation |
| `ReconciliationRecord` | **Puede referenciar** allocation IDs futuro — no sustituye |
| `FinancialDomainEvent` | **Puede emitirse** post allocation confirmada |
| `NotificationOutboxRecord` | **Puede consumir** evento — **no altera** allocation |
| `CFMovement` | **Proyección** — lee allocation — **no writer** |
| Cash Flow portal UI | **Read model** futuro |
| Supabase RLS | **Futuro** — no en DC-2 discovery |

**Anti-patrones prohibidos:**

- Notification retry creando segunda allocation.
- CFMovement como fuente canónica de imputación.
- Cash Flow UI escribiendo obligations, transactions, legs o allocations.
- Mezclar `AllocationStatus` con `CheckInstrumentStatus`.
- Tratar `allocated_amount` como ingreso nuevo en KPI consolidado.

---

## 17. Control de riesgo de regresiones

| Área | ¿Modificado por este ticket? |
|------|------------------------------|
| DC-1 TypeScript committed | **No** |
| Notification Center discovery | **No** |
| Runtime / portales / Supabase | **No** |
| Legal Center | **No** |

**RIESGO FUNCIONAL DIRECTO:**

**NULO EN RUNTIME, PORQUE EL ENTREGABLE ES EXCLUSIVAMENTE DOCUMENTACIÓN.**

**RIESGO ARQUITECTÓNICO:**

**CONTROLADO MEDIANTE GATES FUTUROS DEL PRODUCT OWNER, VALIDACIÓN TÉCNICA, SEGURIDAD, PRIVACIDAD, REVISIÓN CONTABLE Y REVISIÓN LEGAL ANTES DE IMPLEMENTACIÓN.**

No afirmar riesgo cero absoluto.

---

## 18. Supervisión legal

**ESTADO LEGAL:**

**ARQUITECTURA TÉCNICA — PENDIENTE DE REVISIÓN LEGAL PROFESIONAL**

Este documento **no afirma**:

- compliance o cumplimiento definitivo · cumplimiento garantizado;
- legalmente aprobado;
- production ready;
- reglas fiscales definitivas · reglas contables definitivas;
- política de retención legal definitiva.

**Gates futuros recomendados:**

| Área | Gate |
|------|------|
| Revisión legal profesional | Antes producción |
| Revisión contable | Tratamiento imputación / nómina |
| Revisión fiscal | 1099/W-2 / impuestos cuando aplique |
| Privacidad | Datos personales en metadata allocation |
| Seguridad | RLS · fraude · staff imputación ajena |
| Auditoría | Append-only · evidencia exportable |
| Retención | Política legal futura |
| Permisos por rol | Owner · Staff · Artist · Client |
| Exposición financiera | Sensibilidad por portal |
| Exportaciones / evidencia | Cash Flow Owner §13.10 |

Las decisiones legales definitivas requieren **abogado competente** antes de producción.

---

## 19. Criterios de aceptación (discovery)

- [x] Problema y responsabilidad única documentados (§4)
- [x] Cadena Obligation → Transaction → Leg → Allocation (§5–6)
- [x] Tipos auxiliares conceptuales definidos (§8)
- [x] Cardinalidades analizadas incl. N legs → 1 allocation (§9)
- [x] Invariantes OFTL-AL-01…15 (§10)
- [x] DC2-UC-01…12 (§11)
- [x] Dependencias y exclusiones (§12)
- [x] Transparencia financiera y métricas Cash Flow (§13)
- [x] Cash Flow **no** aparece como escritor ni fuente canónica
- [x] Allocation **no** tratada como ingreso nuevo
- [x] Prevención doble conteo · trazabilidad · independencia por dominio (§13.6–13.8)
- [x] Distinción aplicado / pendiente / liquidado / revertido (§13.8–13.10)
- [x] Riesgos incl. R-DC2-METRICS-01…10 (§13.14 · §14)
- [x] Roadmap DC2-RM-01…10 (§15)
- [x] Dependency Matrix (§16)
- [x] Regresión + legal (§17–18)
- [x] Sin TypeScript · sin tests
- [x] Commit local discovery autorizado PO
- [ ] Aprobación arquitectónica final PO (pendiente)

**El discovery no puede aprobarse si:** Cash Flow es escritor o SSOT · allocation = ingreso nuevo · no hay prevención doble conteo · métricas no rastreables · métricas obligation/transaction/leg/allocation mezcladas · no hay independencia por dominio · no se distingue aplicado/pendiente/liquidado/revertido.

---

## 20. Confirmación final

| Afirmación | Estado |
|------------|--------|
| Discovery documentado | ✓ |
| Transparencia métricas → Cash Flow | ✓ (§13) |
| Cash Flow integration | Futura · no implementada · no autorizada DC-2 |
| Código TypeScript | ✗ |
| Supabase / migraciones | ✗ |
| Tests | ✗ |
| UI / runtime | ✗ |
| DC-1 modificado | ✗ |
| Notification Center modificado | ✗ |
| Cash Flow runtime modificado | ✗ |
| Commit local | Autorizado PO · ver post-commit |
| Push remoto | ✗ |

**Estado post-commit autorizado:**

**DC-2 PAYMENT ALLOCATION DISCOVERY — DOCUMENTADO Y COMMITTED LOCALMENTE**

**PENDIENTE DE:** aprobación arquitectónica final PO · revisión contable · revisión legal profesional · revisión seguridad · autorización data contracts · implementación futura · integración Cash Flow futura · validación visual · release V2.

No marcar: IMPLEMENTADO · PRODUCTION READY · RELEASED · DEPLOYED · LEGALMENTE APROBADO.

---

*Documento canónico discovery Payment Allocation V2 (OFTL-C-004). Una línea de código requiere ticket + aprobación PO separada.*
