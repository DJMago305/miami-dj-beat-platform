# TICKET-V2-PHASE-10-STAFF-OPERATIONS-DATA-CONTRACT-001

## Estado

**IMPLEMENTADO, PROBADO, APROBADO POR PRODUCT OWNER Y COMMITTEADO LOCALMENTE**

| Campo | Valor |
|-------|-------|
| Rama | `plan/v2-phase-4-api-client` |
| Commit | `c897fc5a8eddc09b6871458335aa592d34a2baa0` |
| Mensaje commit | `feat(v2-staff): add dashboard data contracts` |
| HEAD pre-implementación | `eb72ffc` — `docs(v2): close phase 8 and 9 reopening` |
| Suite final | **766/766 PASS** · **56/56 files** |
| Typecheck | exit 0 |
| Validación visual Safari | ✅ Aprobada PO — mock metrics/events intactos |
| Push / PR / merge / deploy | ❌ NO AUTORIZADO |

---

## Objetivo

Introducir contratos tipados y un `StaffDashboardDataProvider` mock-only para Operations Preview, desacoplando métricas y eventos del renderer sin conectar runtime real, Supabase, RPC ni fetch.

---

## Motivación

Phase 9 entregó Operations Preview con datos inline/deprecados en `operations-preview-data.ts`. Phase 10 establece la capa de contratos y provider como prerrequisito arquitectónico para:

1. Un único contrato de snapshot operativo Staff.
2. Serialización/deserialización para tests y futuros adapters.
3. Separación entre **datos operativos** (provider) y **capability cards** (permisos Session).

---

## Contratos introducidos

**Archivo:** `MiamiDJBeat-MigracionV2/staff/contracts/staff-dashboard-contracts.ts`

| Tipo | Propósito |
|------|-----------|
| `StaffMetric` | KPI operativo — `id` · `label` · `value` |
| `StaffOperationsEvent` | Fila tabla eventos — `event` · `client` · `date` · `status` |
| `StaffLead` | Lead en snapshot |
| `StaffInvoice` | Factura en snapshot |
| `StaffMatchingItem` · `StaffProductionTask` | Items de colas |
| `StaffDashboardQueues` | `matching` · `production` |
| `StaffDashboardSnapshot` | Agregado versionado (`version: 1`) |
| `StaffDashboardDataError` | Errores `STAFF_DATA_SNAPSHOT_INVALID` · `STAFF_DATA_SNAPSHOT_PARSE` |

---

## Data provider

**Archivo:** `MiamiDJBeat-MigracionV2/staff/data/staff-dashboard-data-provider.ts`

```typescript
export type StaffDashboardDataProvider = {
  getMetrics(): readonly StaffMetric[];
  getEvents(): readonly StaffOperationsEvent[];
  getQueues(): StaffDashboardQueues;
  getDashboardSnapshot(): StaffDashboardSnapshot;
};
```

| Factory | Comportamiento |
|---------|----------------|
| `createStaffDashboardDataProvider(snapshot?)` | Provider desde snapshot validado |
| `createEmptyStaffDashboardDataProvider()` | Cero métricas · cero eventos · colas vacías |
| `getDefaultStaffDashboardDataProvider()` | Singleton mock aprobado |
| `setDefaultStaffDashboardDataProviderForTests()` | Override tests |
| `resetStaffDashboardDataProviderForTests()` | Restaura mock |

---

## Mock layer

**Archivo:** `MiamiDJBeat-MigracionV2/staff/data/staff-dashboard-mock-data.ts`

| Colección | Cantidad aprobada PO |
|-----------|----------------------|
| Métricas | 4 — Active events (12) · Pending invoices (7) · DJs assigned (18) · Monthly sales ($42,800) |
| Eventos | 4 — Wedding Miami Beach · Corporate Dinner · Birthday Coral Gables · Quinceañera Doral |
| Leads | 3 |
| Invoices | 3 |
| Colas matching/production | 3 + 3 |

Export: `STAFF_MOCK_DASHBOARD_SNAPSHOT` — snapshot congelado completo.

---

## Serialización

| Función | Rol |
|---------|-----|
| `serializeStaffDashboardSnapshot(snapshot)` | JSON string — valida snapshot |
| `parseStaffDashboardSnapshot(json)` | Parse + validación — lanza `StaffDashboardDataError` |

---

## Integración renderer

| Archivo | Cambio |
|---------|--------|
| `staff/render-operations-preview.ts` | `createOperationsPreviewSection(theme, dataProvider?)` — métricas/eventos desde provider |
| `staff/operations-preview-data.ts` | `@deprecated` re-exports; **capability cards sin cambio** |

Permisos: capability ON/OFF sigue vía `hasSessionCapability()` — independiente del provider.

---

## Tests

**Archivo:** `MiamiDJBeat-MigracionV2/tests/unit/staff-dashboard-data-provider.test.ts` — **10 tests**

1. Mock default metrics/events/queues
2. Empty provider
3. Snapshot completo equals `STAFF_MOCK_DASHBOARD_SNAPSHOT`
4. Serialize/parse round-trip
5. Malformed JSON error
6. Invalid version error
7. Missing collections error
8. Renderer mock metrics/events (4+4)
9. Empty provider → 0 metrics · 0 events · 6 capability cards
10. Owner preview + empty provider → 6/6 capabilities (permisos independientes)

---

## Alcance explícitamente NO modificado

| Área | Estado |
|------|--------|
| `staff/main.ts` factory injection | ⏳ Phase 11-A |
| `dashboard-mvp-data.ts` | Sin cambio — dual source pendiente 11-B |
| Session · Permissions · Bootstrap | Sin cambio |
| Supabase · RPC · fetch | Sin integración |
| DOM/CSS aprobado | Sin cambio visual |

---

## Commit

```
c897fc5a8eddc09b6871458335aa592d34a2baa0
feat(v2-staff): add dashboard data contracts
```

**Archivos:** 6 (3 creados · 3 modificados) · suite baseline post-commit: 766/766.

---

## Próximo paso

Phase 11-A — `TICKET-V2-PHASE-11A-STAFF-PROVIDER-FACTORY-001` — factory única + inyección en `main.ts`.

*Ticket histórico — documentación TICKET-V2-END-OF-DAY-DOCUMENTATION-2026-07-20-001*