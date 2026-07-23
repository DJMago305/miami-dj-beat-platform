# TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001

## Core Financial Data Contracts — Controlled Implementation

| Campo | Valor |
|-------|-------|
| Ticket | V2 OFTL — DC-1 Core Financial Contracts |
| Estado | **IMPLEMENTADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO** |
| Fase | **DC-1** — TypeScript domain contracts + unit guards |
| Parent specification | `docs/V2/TICKETS/TICKET-V2-OFTL-DATA-CONTRACTS-001.md` |
| Parent discovery | `docs/V2/TICKETS/TICKET-V2-ARTIST-CASH-FLOW-MANUAL-TRANSACTION-LEDGER-DISCOVERY-001.md` |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `9328ee239d5e37b328c3ce849af5cddb0a4831c2` |
| Fecha | 2026-07-23 |
| Commit | **Local autorizado PO** — mensaje `feat(v2-finance): add OFTL core financial contracts` |

---

## 1. Objetivo

Implementar el **núcleo semántico TypeScript** del ledger operacional OFTL (OFTL-C-001…003) sin runtime funcional, persistencia, Supabase ni integración con portales.

Establecer contratos serializables JSON para:

- **`FinancialObligation`** — dinero debido
- **`OwnerFinancialTransaction`** — pago/cobro ejecutado
- **`OwnerTransactionLeg`** — pata financiera materializada

---

## 2. Baseline Git

| Check | Valor |
|-------|-------|
| Rama | `plan/v2-phase-4-api-client` |
| HEAD | `9328ee239d5e37b328c3ce849af5cddb0a4831c2` |
| Working tree inicial | NC discovery committed · DC-1 untracked |

---

## 3. Documentos parent

| Documento | Rol |
|-----------|-----|
| `TICKET-V2-OFTL-DATA-CONTRACTS-001.md` | Spec DC-0 — inventario, dependency matrix, fases DC-1…8 |
| `TICKET-V2-ARTIST-CASH-FLOW-MANUAL-TRANSACTION-LEDGER-DISCOVERY-001.md` | Discovery — Authority Matrix, estados, taxonomía, §6.2 campos |
| `MiamiDJBeat-MigracionV2/shared/services/legal/contracts/` | Patrón estructural V2 (const unions, readonly types, guards) |

---

## 4. Alcance autorizado

| ID | Contrato | Archivo principal |
|----|----------|-------------------|
| **OFTL-C-001** | `FinancialObligation` | `oftl-entities.ts` |
| **OFTL-C-002** | `OwnerFinancialTransaction` | `oftl-entities.ts` |
| **OFTL-C-003** | `OwnerTransactionLeg` | `oftl-entities.ts` |

Auxiliares: IDs, enums DC-1, primitivos (party/source/money/audit), guards puros.

---

## 5. Archivos previstos / creados

| Archivo | Acción |
|---------|--------|
| `docs/V2/TICKETS/TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001.md` | Creado |
| `MiamiDJBeat-MigracionV2/shared/services/finance/contracts/oftl-ids.ts` | Creado |
| `MiamiDJBeat-MigracionV2/shared/services/finance/contracts/oftl-enums.ts` | Creado |
| `MiamiDJBeat-MigracionV2/shared/services/finance/contracts/oftl-primitives.ts` | Creado |
| `MiamiDJBeat-MigracionV2/shared/services/finance/contracts/oftl-entities.ts` | Creado |
| `MiamiDJBeat-MigracionV2/shared/services/finance/contracts/oftl-guards.ts` | Creado |
| `MiamiDJBeat-MigracionV2/shared/services/finance/contracts/index.ts` | Creado |
| `MiamiDJBeat-MigracionV2/shared/services/finance/index.ts` | Creado |
| `MiamiDJBeat-MigracionV2/tests/unit/oftl-data-contracts.test.ts` | Creado |

---

## 6. Tipos auxiliares autorizados

- `FinancialObligationId`, `OwnerFinancialTransactionId`, `OwnerTransactionLegId`, `TransactionGroupId`, `IdempotencyKey`
- `MdjUserId`, `MdjStaffUserId` (actor references)
- `CurrencyCode`, `MoneyMinorUnits`, `MoneyAmount`
- `TransactionLifecycleStatus`, `ObligationLifecycleStatus`
- `FinancialDirection`, `FinancialLegDirection`, `FinancialOperationType`
- `CompanyFinancialCategory`, `PaymentMethod`, `PaymentProvider`, `CounterpartyType`
- `FinancialObligationKind`, `OwnerFinancialSourceSystem`, `LegLedgerBucket`, `TransactionLegRole`
- `FinancialPartyRef`, `FinancialSourceReference`, `FinanceAuthorizationContext`, `FinancialAuditMetadata`

**No creados (DC-2+):** CheckInstrumentStatus, BankSettlementStatus, PaymentAllocation, CFMovement, outbox types.

---

## 7. Invariantes codificadas

| Regla | Implementación |
|-------|----------------|
| **OFTL-DC-01** | Tipos separados `FinancialObligation` ≠ `OwnerFinancialTransaction` |
| **OFTL-DC-02** | `MoneyMinorUnits` entero + `assertValidMoneyMinorUnits()` |
| Lifecycle separados | `TransactionLifecycleStatus` ≠ `ObligationLifecycleStatus` |
| Leg → parent | `ownerTransactionId` obligatorio en leg |
| Leg → obligation | `financialObligationId` opcional |
| Currency explícita | `MoneyAmount.currencyCode` en montos |
| Serializable | `string` timestamps; `number` minor units; sin Date/Map/Set/class |
| No writer CFMovement | Sin tipo CFMovement en DC-1 |
| Operational ledger | Comentario de dominio en barrel — no GL |

---

## 8. Guards autorizados

| Guard | Propósito |
|-------|-----------|
| `assertValidMoneyMinorUnits` | Rechaza NaN, ±Infinity, decimales, unsafe integer; opción `allowZero` |
| `isTransactionLifecycleStatus` | Narrowing puro |
| `isObligationLifecycleStatus` | Narrowing puro |
| `OftlContractError` | Error de dominio contrato (patrón Legal) |

---

## 9. Pruebas requeridas

Archivo: `tests/unit/oftl-data-contracts.test.ts`

Cubre: fixtures válidos ×3, JSON roundtrip, currency explícita, minor units, rechazos decimal/NaN/Infinity/unsafe integer, lifecycles distintos, leg→transaction, leg→obligation opcional, exports barrel, ausencia imports runtime prohibidos.

---

## 10. Fuera de alcance

PaymentAllocation · CheckInstrument · BankSettlement · ReconciliationRecord · FinancialDomainEvent · NotificationOutboxRecord · CFMovement · DjLedgerProjection · repositories · services · Supabase · UI · portales · commit · push.

---

## 11. Riesgos

| ID | Riesgo | Mitigación |
|----|--------|------------|
| R-DC1-01 | `tsc` no incluye `shared/services/` en `tsconfig` include | Vitest transpila tests; reportar en validación |
| R-DC1-02 | Colisión nombres V1 | Namespace `finance/contracts`; sin tocar `web/` |
| R-DC1-03 | BigInt vs number | `number` safe integer — alineado JSON + `dj_ledger.amount_cents` JS |
| R-DC1-04 | `operation_type` SCREAMING (TS) vs snake_case (discovery §6.2 doc) | Mantener SCREAMING en DC-1; decisión de serialización/persistencia pendiente fase futura — no bloquea commit |

---

## 12. Criterios de aceptación

- [x] OFTL-C-001…003 implementados como `type` readonly
- [x] Enums DC-1 only (transaction + obligation lifecycle)
- [x] Guards money puros
- [x] Unit tests PASS (21/21)
- [x] Sin Supabase / UI / runtime imports
- [x] Commit local DC-1 autorizado PO
- [ ] Aprobación funcional final PO (pendiente)

---

## 13. Validaciones ejecutadas

| Validación | Resultado |
|------------|-----------|
| `npm test -- tests/unit/oftl-data-contracts.test.ts` | **21/21 PASS** |
| `npm run typecheck` | **exit 0** |
| `tsc --listFiles` (finance) | **7/7 archivos** `shared/services/finance/**` |
| `npm test` (suite general) | **85 files · 1089 tests PASS** |
| Forbidden imports scan | Sin Supabase / fetch / storage en `finance/contracts/` |
| Pre-staging editorial | Sin TODO/FIXME/TBD · newline final OK |

---

## 14. Estado final permitido

**IMPLEMENTADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**

Post-commit review (2026-07-23): branded core IDs (`__brand` pattern); money guard semantics B; 21 unit tests PASS; all 7 finance TS files in `tsc --listFiles`; working tree limpio tras commit local.

No marcar FINALIZADO · CERRADO · APROBADO · PRODUCTION READY · RELEASED · DEPLOYED · LEGALMENTE APROBADO hasta PO.

---

*Ticket DC-1 OFTL. Integración DC-2+ requiere autorización PO separada.*
