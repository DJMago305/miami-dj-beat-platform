# TICKET-V2-OFTL-DATA-CONTRACTS-001

## OFTL Data Contracts — Specification Only (Documentation First)

| Campo | Valor |
|-------|-------|
| Ticket | V2 OFTL — Data Contracts Specification |
| Estado | **SPECIFICATION ONLY** — planificación técnica · **sin implementación** |
| Fase | **DC-0** — Especificación que gobierna la futura implementación TypeScript |
| Parent | `TICKET-V2-ARTIST-CASH-FLOW-MANUAL-TRANSACTION-LEDGER-DISCOVERY-001` (OFTL Discovery — commit `f9f006d`) |
| Rama baseline | `plan/v2-phase-4-api-client` |
| HEAD baseline | `f9f006dd73a7fc9b69e495ba3c99d6bfa2ee8365` |
| Fecha spec | 2026-07-23 |
| Product Owner | Pendiente aprobación PO de esta especificación |

---

## 0. Declaración operativa

Este ticket **no autoriza**:

- implementación TypeScript, runtime, Supabase, schemas SQL, migraciones;
- providers, adapters, services, UI, workers, Edge Functions;
- tests funcionales, staging, commit, push, PR, merge ni deploy;
- iniciar **DC-1** ni cualquier subfase de implementación de contratos.

**Estado esperado al cierre de este ticket:** especificación técnica escrita · **cero código** · **cero interfaces** · **cero tablas** · working tree con **un solo archivo nuevo** (este documento) · **sin commit** salvo autorización PO separada.

---

## 1. Objetivo

Definir la **especificación técnica** que gobernará la futura implementación de **Data Contracts OFTL** en Miami DJ Beat V2 — traduciendo el discovery arquitectónico aprobado en un plan de contratos, fases, dependencias, invariantes y criterios de aceptación **sin escribir código**.

Los contratos futuros deben:

- respetar la separación **Obligation → Payment → Allocation → BankSettlement → Reconciliation → Derived Projections → Reporting/Notifications**;
- tratar OFTL como **ledger operacional**, no como General Ledger contable completo;
- mantener **Financial Authority Matrix** y **Writer Exclusivity Matrix** como ley de diseño;
- desacoplar **notificaciones** del hecho financiero canónico;
- ser implementables en `MiamiDJBeat-MigracionV2/shared/services/finance/contracts/` siguiendo el patrón Legal Center DC-1, **en tickets posteriores**.

---

## 2. Alcance (este ticket)

| # | Entregable | Estado |
|---|------------|--------|
| 1 | Este documento de especificación | ✓ (único artefacto autorizado) |
| 2 | Inventario conceptual de contratos futuros | ✓ (§7) |
| 3 | Dependency Matrix (dependencia arquitectónica entre contratos) | ✓ (§8) |
| 4 | Orden de implementación propuesto DC-1…DC-8 | ✓ (§9) |
| 5 | Dependencias, riesgos, criterios de aceptación | ✓ (§4, §10, §11, §12) |
| 6 | Referencias obligatorias al discovery OFTL | ✓ (§6) |

---

## 3. Fuera de alcance (este ticket y hasta autorización PO de implementación)

| Item | Fase futura |
|------|-------------|
| Archivos `.ts` (entities, enums, ports, guards) | DC-1+ implementación |
| `shared/services/finance/` runtime / in-memory / persistence | DC-2+ lab |
| Supabase DDL, RLS, RPC SECURITY DEFINER | Ticket schema aditivo separado |
| UI Owner / portal artista Cash Flow | Tickets UI separados |
| Writers V1 (`flow-handler.js`, webhook, release RPC) | Sin alteración |
| JSON Schema export | Opcional post-DC-1 |
| Event bus / outbox workers | Post-DC-5 |
| Selección proveedor SMS | Ticket futuro |
| Propiedades TypeScript definitivas por contrato | Reservado a implementación DC-1+ |

---

## 4. Dependencias

### 4.1 Documentales (bloqueantes)

| Dependencia | Rol |
|-------------|-----|
| **`TICKET-V2-ARTIST-CASH-FLOW-MANUAL-TRANSACTION-LEDGER-DISCOVERY-001`** | Fuente arquitectónica canónica OFTL |
| **`docs/architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md`** | Cash Flow Artista 1D; Empresa P1 separado; CFMovement 3B |
| **`docs/architecture/CFMOVEMENT-READ-MAP-SPEC-V1.md`** | Contrato observador; pipeline Invoice → Lead → Cobro → CFMovement |
| **`docs/tickets/TICKET-004-financial-order-architecture.md`** | North star 5 capas — OFTL como puente operativo |

### 4.2 Patrón de referencia (no dependencia de código OFTL)

| Referencia | Uso |
|------------|-----|
| **`TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001`** | Plantilla de fase DC-1 Legal (estructura archivos, guards, ports) |
| **`MiamiDJBeat-MigracionV2/shared/services/legal/contracts/`** | Convención V2 MigracionV2 — **solo lectura como modelo** |

### 4.3 Secuencia lógica post-especificación

```
Esta spec (DC-0) aprobada PO
        ↓
Implementación DC-1…DC-8 (tickets separados, cada uno con autorización PO)
        ↓
In-memory lab (análogo Legal DC-2)
        ↓
Supabase schema aditivo (zona roja, ticket separado)
        ↓
Bridge dj_ledger + CFMovement projections
```

---

## 5. Baseline Git

Verificado al inicio de este ticket:

| Check | Valor esperado | Resultado |
|-------|----------------|-----------|
| Rama | `plan/v2-phase-4-api-client` | ✓ |
| HEAD | `f9f006dd73a7fc9b69e495ba3c99d6bfa2ee8365` | ✓ |
| Working tree | Limpio (antes de crear este archivo) | ✓ |
| Parent commit discovery | `docs(v2-finance): add OFTL architecture discovery` | ✓ |

---

## 6. Documentos de referencia obligatorios

La implementación futura **debe** alinearse con estas secciones del discovery OFTL:

| Principio / artefacto | Sección discovery | Obligatoriedad |
|----------------------|-------------------|----------------|
| **OFTL Discovery aprobado** | Documento completo | Ley |
| **Financial Authority Matrix** | §5A.1 | OFTL ≠ SSOT global; canonical vs projection vs legacy |
| **Financial Writer Exclusivity Matrix** | §5A.3 | Un writer canónico por escenario |
| **Payment Model** | §5A.4, §6.2 | `OwnerFinancialTransaction` = pago ejecutado, no obligación |
| **Obligation Model** | §5A.4, §6.3 | `FinancialObligation` separada de payment |
| **Allocation Model** | §5A.4, §5A.6 | `PaymentAllocation`; `UnappliedCashBalance` |
| **Operational Ledger principles** | §5A.11 | No GL / QuickBooks / tax / 1099-W-2 |
| **State machines separadas** | §5A.2 | `TransactionLifecycleStatus`, `CheckInstrumentStatus`, `ObligationLifecycleStatus`, `BankSettlementStatus` |
| **Canonical money** | §5A.6 | `amount_minor_units` + `currency_code` |
| **Taxonomía financiera** | §5A.7, §5A.8 | `direction`, `operation_type`, `company_category`, `payment_method`, `payment_provider` |
| **Notification Addendum** | §5B | Outbox desacoplado; `NotificationDeliveryStatus` ≠ estados financieros |
| **Casos de uso** | §11 UC-1…UC-18 | Validación de contratos futuros |
| **Append-only repository semantics** | §5A.5 | Sin UPDATE destructivo de hechos monetarios |

---

## 7. Data contracts a implementar posteriormente (inventario conceptual)

**Regla:** este inventario **no define propiedades TypeScript**, tipos, interfaces ni schemas. Solo nombres, responsabilidad y fase sugerida.

| ID | Contrato conceptual | Responsabilidad única | Tipo de registro | Fase sugerida |
|----|---------------------|----------------------|------------------|---------------|
| **OFTL-C-001** | **`FinancialObligation`** | Dinero debido (cobrar o pagar): artista, staff, vendor, cliente, comisión, reembolso | **Canonical** | DC-1 (core) |
| **OFTL-C-002** | **`OwnerFinancialTransaction`** | Pago o cobro ejecutado por método determinado | **Canonical** | DC-1 (core) |
| **OFTL-C-003** | **`OwnerTransactionLeg`** | Impacto contable derivado (empresa / contraparte) materializado desde payment | **Derived from payment** (hecho derivado materializado, no captura manual duplicada) | DC-1 (core) |
| **OFTL-C-004** | **`PaymentAllocation`** | Aplicación de un payment a una o varias obligations | **Canonical link** (append-only) | DC-2 |
| **OFTL-C-005** | **`CheckInstrument`** | Ciclo de vida del instrumento cheque (incoming/outgoing) | **Canonical** (instrumento) | DC-3 |
| **OFTL-C-006** | **`BankSettlement`** | Hecho banco/procesador: depósito, clearing, devolución, fallo | **Canonical** (settlement) | DC-4 |
| **OFTL-C-007** | **`ReconciliationRecord`** | Match interno ↔ externo ↔ obligación ↔ pago | **Canonical** (reconciliation) | DC-4 |
| **OFTL-C-008** | **`FinancialDomainEvent`** | Evento de dominio post-commit derivado del write canónico | **Domain event** (outbox source) | DC-5 |
| **OFTL-C-009** | **`NotificationOutboxRecord`** | Trabajo pendiente de notificación; idempotente | **Outbox** (no hecho financiero) | DC-5 |
| **OFTL-C-010** | **`CFMovement`** | Proyección audit 3B — observador / materialización audit | **Derived Projection / Audit** | DC-6 |
| **OFTL-C-011** | **`DjLedgerProjection`** | Proyección wallet V1 (`dj_ledger`) | **Derived Projection** | DC-8 (compatibilidad) |

**Contratos auxiliares futuros (mencionar en implementación, no inventar ahora):**

- **`UnappliedCashBalance`** — concepto suspense explícito (UC-12); puede modelarse como proyección o línea derivada, no obligación falsa.
- **`NotificationDeliveryAttempt`** — intento por canal (§5B.2 discovery).
- **`OwnerFinanceAuditTrail`** — eventos audit append-only (§12.2 discovery).

**Prohibido en contracts futuros:**

- Un solo tipo que mezcle obligación + pago + settlement + notificación.
- Reutilizar `TransactionLifecycleStatus` para entrega de mensajes.
- `amount_usd` float como campo canónico de persistencia.

---

## 8. Dependency Matrix

**Propósito:** documentar la **dependencia arquitectónica** entre contratos — qué concepto referencia a cuál en el modelo de dominio. **No** es el orden obligatorio de implementación (ver §9). **No** implica que cada etapa deba existir antes de capturar la anterior en runtime (p. ej. un pago puede registrarse sin obligación previa; un cheque es opcional).

### 8.1 Cadena conceptual principal

Flujo de **dependencia de dominio** (hecho económico → derivados):

```
FinancialObligation
        ↓
OwnerFinancialTransaction
        ↓
OwnerTransactionLeg
        ↓
PaymentAllocation
        ↓
CheckInstrument          (rama opcional — solo si payment_method = CHECK)
        ↓
BankSettlement
        ↓
ReconciliationRecord
        ↓
FinancialDomainEvent       (post-commit; no altera hecho canónico)
        ↓
NotificationOutboxRecord   (derivado; fallo no revierte pago)
        ↓
CFMovement                 (proyección audit 3B — no hecho económico nuevo)
```

**Lectura:** la flecha indica *«el contrato inferior referencia o se materializa a partir del superior en el flujo operativo normal»*, no obligatoriedad de existencia previa en todos los escenarios.

| Relación | Significado arquitectónico |
|----------|---------------------------|
| Obligation → Payment | Un payment **puede** liquidar una o más obligations; un payment **puede existir** sin obligation (`UnappliedCashBalance`) |
| Payment → Leg | Cada leg **requiere** un `owner_transaction_id`; legs **no** se capturan manualmente aparte |
| Payment → Allocation | Allocation **requiere** payment; obligation es el otro extremo del vínculo |
| Payment → CheckInstrument | Instrumento cheque **cuelga de** transaction cuando método = CHECK; transacciones non-check **no** tienen CheckInstrument |
| CheckInstrument / Payment → BankSettlement | Settlement describe comportamiento banco/procesador; **separado** del lifecycle de transaction |
| Settlement + Payment + Obligation → ReconciliationRecord | Reconciliation **correlaciona** fuentes; no sustituye payment ni settlement |
| Canonical write → FinancialDomainEvent | Evento **después** de commit; input para outbox y audit |
| DomainEvent → NotificationOutboxRecord | Notificación **derivada**; estados de entrega propios |
| Transaction / Leg / Allocation → CFMovement | Proyección **read/audit**; **no** depende de notificación |

**Contrato auxiliar en paralelo (no en cadena vertical):**

- **`DjLedgerProjection`** — depende de `OwnerFinancialTransaction` + reglas wallet artista; **paralelo** a `CFMovement` (ambos Derived Projection).
- **`OwnerFinanceAuditTrail`** — puede consumir canonical write **y** domain events; **paralelo** a notification outbox.

### 8.2 Matriz de bloqueo (implementación futura de contratos)

| Contrato | Bloqueado por (debe definirse antes) | Bloquea a |
|----------|--------------------------------------|-----------|
| **`FinancialObligation`** | Enums core money + obligation lifecycle (DC-1) | `PaymentAllocation`, `ReconciliationRecord`, métricas outstanding payroll |
| **`OwnerFinancialTransaction`** | Enums core transaction lifecycle + taxonomía §5A.7 (DC-1) | `OwnerTransactionLeg`, `PaymentAllocation`, `CheckInstrument`, `BankSettlement`, `FinancialDomainEvent`, proyecciones |
| **`OwnerTransactionLeg`** | `OwnerFinancialTransaction` | Agregaciones empresa, `CFMovement` (parcial), `DjLedgerProjection` (indirecto) |
| **`PaymentAllocation`** | `OwnerFinancialTransaction` **y** `FinancialObligation` | Cierre obligation, `PARTIALLY_SETTLED` / `SETTLED`, UC-6/7/12 |
| **`CheckInstrument`** | `OwnerFinancialTransaction` + `CheckInstrumentStatus` (DC-3) | Flujos cheque incoming/outgoing; settlement cheque |
| **`BankSettlement`** | `OwnerFinancialTransaction`; frecuentemente `CheckInstrument` | `ReconciliationRecord`, estados bancarios finales |
| **`ReconciliationRecord`** | Payment (+ opcional obligation, settlement, legacy `leads`) | UC-4 sync lead ↔ cheque; audit match externo |
| **`FinancialDomainEvent`** | Contratos canonical mínimos (transaction ± allocation) | `NotificationOutboxRecord`, `OwnerFinanceAuditTrail` (correlación) |
| **`NotificationOutboxRecord`** | `FinancialDomainEvent` + enums entrega ≠ financieros (DC-5) | Delivery attempts, email/SMS/in-app (futuro) |
| **`CFMovement`** | `OwnerFinancialTransaction`, `OwnerTransactionLeg`; opcional allocation | Audit 3B, export; **no** bloquea canonical |

### 8.3 Desarrollo en paralelo (futuro)

Grupos que **pueden** avanzar en paralelo **después** de que DC-1 fije transaction + obligation + leg:

| Grupo | Contratos | Condición de paralelismo |
|-------|-----------|--------------------------|
| **A — Core link** | `PaymentAllocation` | Requiere stubs/IDs de OFTL-C-001 y OFTL-C-002 acordados |
| **B — Instrumento** | `CheckInstrument` | Requiere OFTL-C-002; **no** requiere allocation completa |
| **C — Settlement** | `BankSettlement`, `ReconciliationRecord` | Requiere OFTL-C-002; reconciliation enriquece con A y B cuando existan |
| **D — Proyección wallet** | `DjLedgerProjection` | Requiere OFTL-C-002 + leg; **paralelo** a grupo E |
| **E — Proyección audit** | `CFMovement` | Requiere OFTL-C-002 + leg; **paralelo** a grupo D; **independiente** de notificaciones |
| **F — Eventos** | `FinancialDomainEvent` | Requiere definición canonical write; **paralelo** a C si solo tipos evento |
| **G — Notificación** | `NotificationOutboxRecord`, `NotificationDeliveryAttempt` | Requiere F; **no** bloquea A–E |
| **H — Audit trail** | `OwnerFinanceAuditTrail` | Paralelo a F/G; correlación con canonical |

**Secuencia mínima crítica (no negociable en diseño):**

```
DC-1 (Obligation + Transaction + Leg)
        ↓
DC-2 (Allocation)  ∥  DC-3 (Check)     ← paralelo posible
        ↓                    ↓
DC-4 (Settlement + Reconciliation)
        ↓
DC-5 (DomainEvent + Outbox)  ∥  DC-6 (CFMovement)  ∥  DC-8 (DjLedgerProjection)
        ↓
DC-7 (Audit trail — puede solaparse con DC-5/6)
```

### 8.4 Anti-patrones de dependencia

| Anti-patrón | Por qué está prohibido |
|-------------|------------------------|
| `CFMovement` → `OwnerFinancialTransaction` como writer | CFMovement es proyección; no crea hecho canónico |
| `NotificationOutboxRecord` → altera allocation | Notificación no es parte del hecho financiero §5B |
| `CheckInstrument.lifecycle_status` → `TransactionLifecycleStatus` | Enums separados §5A.2 |
| `ReconciliationRecord` sustituye `Payment` | Reconciliation confirma correspondencia; no es pago |
| Implementar outbox antes de definir canonical write | Eventos sin payload estable generan duplicados |

---

## 9. Orden de implementación futura propuesto

Cada subfase es un **ticket separado** con autorización PO. **Ninguna subfase está autorizada por este documento.**

| Fase | Nombre | Contratos / artefactos | Objetivo |
|------|--------|------------------------|----------|
| **DC-1** | Core Financial Contracts | `FinancialObligation`, `OwnerFinancialTransaction`, `OwnerTransactionLeg`; enums core (`TransactionLifecycleStatus`, `ObligationLifecycleStatus`, direction, operation_type, company_category, payment_method); IDs; guards money minor units | Base TypeScript en `shared/services/finance/contracts/` |
| **DC-2** | Allocation Contracts | `PaymentAllocation`; reglas Σ allocation ≤ payment; `UnappliedCashBalance` concept | Parcial, multi-obligation, UC-6/7/12 |
| **DC-3** | Check Contracts | `CheckInstrument`; `CheckInstrumentStatus`; incoming/outgoing SM; REDEPOSITED como transición auditada (Opción A) | Separación instrumento ↔ transaction lifecycle |
| **DC-4** | Settlement Contracts | `BankSettlement`, `ReconciliationRecord`; `BankSettlementStatus` | Banco/procesador ≠ payment |
| **DC-5** | Notification Contracts | `FinancialDomainEvent`, `NotificationOutboxRecord`, `NotificationDeliveryAttempt`; `NotificationDeliveryStatus`; dedupe key conceptual | Desacoplado de canonical write — §5B |
| **DC-6** | Projection Contracts | `CFMovement`, company leg read models, artist Cash Flow snapshots derivados | No duplicar hechos económicos — 3B |
| **DC-7** | Audit Contracts | `OwnerFinanceAuditTrail`; payload safety guards; correlation financial_event → audit | Append-only; least privilege |
| **DC-8** | Compatibility Contracts | `DjLedgerProjection`; bridge metadata (`owner_transaction_id`); idempotency keys cross-V1 | Coexistencia release RPC + legacy leads |

### 9.1 Ubicación objetivo (implementación futura — no crear ahora)

```
MiamiDJBeat-MigracionV2/shared/services/finance/
  contracts/
    oftl-ids.ts
    oftl-enums.ts
    oftl-entities.ts
    oftl-projections.ts
    oftl-domain-events.ts
    oftl-service-ports.ts
    oftl-guards.ts
    index.ts
    OFTL-DATA-CONTRACTS-SPEC.md
  tests/unit/oftl-data-contracts.test.ts   ← futuro
```

### 9.2 Invariantes a codificar en implementación (referencia para DC-1+)

| Regla | Origen discovery |
|-------|------------------|
| OFTL-DC-01 | Payment ≠ Obligation — tipos separados |
| OFTL-DC-02 | `amount_minor_units` entero; sin float en persistencia |
| OFTL-DC-03 | Estados financieros ≠ `NotificationDeliveryStatus` |
| OFTL-DC-04 | Writer matrix — un canonical writer por escenario |
| OFTL-DC-05 | Append-only — reversal vía compensating entry |
| OFTL-DC-06 | `dj_ledger` / CFMovement = Derived Projection |
| OFTL-DC-07 | Cobro cliente (`leads.balance_paid`) = Legacy Authority hasta migración PO |
| OFTL-DC-08 | Notification failure no altera payment/allocation |

---

## 10. Criterios de aceptación (esta especificación)

Al cierre de **este ticket de spec**, debe quedar explícito que:

- [x] Existe **solo** este documento como entregable autorizado
- [x] **Aún no existe código** TypeScript OFTL
- [x] **Aún no existen interfaces** ni enums implementados
- [x] **Aún no existen tablas** ni migraciones Supabase OFTL
- [x] **Aún no existe runtime** finance service
- [x] **Aún no existen providers** ni adapters
- [x] **Aún no existen tests** funcionales OFTL
- [x] Inventario conceptual de contratos futuros documentado (§7)
- [x] Dependency Matrix arquitectónica documentada (§8)
- [x] Orden DC-1…DC-8 documentado (§9)
- [x] Referencias obligatorias al discovery OFTL (§6)
- [x] Financial Authority Matrix y Writer Exclusivity referenciadas
- [x] Payment / Obligation / Notification addendum referenciados
- [x] Operational ledger vs GL explícito
- [x] Sin staging · sin commit · sin push (salvo autorización PO separada)

**Veredicto spec:** **READY FOR PO REVIEW** — implementación **no iniciada**.

---

## 11. Riesgos (planificación)

| ID | Riesgo | Mitigación en contracts futuros |
|----|--------|--------------------------------|
| R-DC-01 | Contrato monolítico mezcla obligation + payment | DC-1 separación estricta OFTL-C-001 / OFTL-C-002 |
| R-DC-02 | Enum `status` único para transacción y cheque | DC-1 + DC-3 enums separados §5A.2 |
| R-DC-03 | Float en montos | DC-1 guard `amount_minor_units` |
| R-DC-04 | CFMovement como writer duplicado de cobro | DC-6 projection-only; Authority Matrix §5A.1 |
| R-DC-05 | Notification contract acoplado a payment row | DC-5 outbox separado §5B |
| R-DC-06 | Contracts afirman GL completo | DC-1 docstring / spec disclaimer §5A.11 |
| R-DC-07 | REDEPOSITED como enum persistente | DC-3 transición auditada Opción A |
| R-DC-08 | Scope creep en DC-1 (incluir Supabase) | Gates PO por fase; schema ticket separado |

---

## 12. Gates de aprobación PO (post-spec)

1. Aprobar esta especificación (POAC spec).
2. Autorizar **implementación DC-1** (TypeScript core contracts + unit guards) — ticket separado.
3. Autorizar commit de esta spec — frase explícita PO.
4. **No** autorizar Supabase hasta ticket schema aditivo + zona roja.

---

## 13. Próximo paso recomendado (no autorizado aquí)

**Implementación DC-1 — Core Financial Contracts** en `MiamiDJBeat-MigracionV2/shared/services/finance/contracts/`:

- Tipos para OFTL-C-001, OFTL-C-002, OFTL-C-003
- Enums core §5A.2 A (transaction + obligation lifecycle parcial)
- Guards money + idempotency key
- Unit tests análogos a `legal-data-contracts.test.ts`

Requiere autorización PO explícita distinta a este ticket.

---

## 14. Confirmación final

| Afirmación | Estado |
|------------|--------|
| Especificación escrita | ✓ |
| Código TypeScript | ✗ |
| Runtime | ✗ |
| Supabase | ✗ |
| Implementación DC-1 iniciada | ✗ |
| Staging | ✗ |
| Commit | ✗ |
| Push / PR / merge / deploy | ✗ |

*Documento canónico spec OFTL Data Contracts DC-0. Implementación requiere ticket + aprobación PO.*
