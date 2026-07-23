# TICKET-V2-DWL-DC-1-CORE-WORK-CONTRACTS-001

## Core Work Data Contracts — Controlled Implementation

| Campo                | Valor                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| Ticket               | V2 Work Ledger — DC-1 Core Work Contracts                                    |
| Estado               | **IMPLEMENTADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**                     |
| Fase                 | **DWL-DC-1** — TypeScript domain contracts + unit guards                     |
| Parent specification | `docs/V2/TICKETS/TICKET-V2-DWL-DATA-CONTRACTS-SPECIFICATION-001.md`          |
| Parent discovery     | `docs/V2/TICKETS/TICKET-V2-DJ-WORK-LEDGER-AND-COMPENSATION-DISCOVERY-001.md` |
| Rama                 | `plan/v2-phase-4-api-client`                                                 |
| HEAD baseline        | `68bd71d5b31c1e8f5f120f11ec14a1d107d92cd1`                                   |
| Fecha                | 2026-07-23                                                                   |
| Commit               | **No autorizado en este ticket** — auditoría pre-commit PO pendiente         |

---

## 1. Autorización PO

Implementación local controlada de contratos TypeScript mínimos DWL-DC-1 **sin** commit · **sin** push · **sin** persistencia · **sin** providers · **sin** UI.

---

## 2. Baseline Git

| Check                | Valor                                      |
| -------------------- | ------------------------------------------ |
| Rama                 | `plan/v2-phase-4-api-client`               |
| HEAD inicial         | `68bd71d5b31c1e8f5f120f11ec14a1d107d92cd1` |
| Working tree inicial | LIMPIO                                     |

---

## 3. Alcance autorizado

| ID            | Contrato                        | Archivo           |
| ------------- | ------------------------------- | ----------------- |
| **DWL-C-001** | `WorkRecord`                    | `dwl-entities.ts` |
| **DWL-C-002** | `WorkSession`                   | `dwl-entities.ts` |
| **DWL-C-004** | `WorkAssignmentReference`       | `dwl-entities.ts` |
| **DWL-C-011** | `ProfessionalIdentityReference` | `dwl-entities.ts` |

Auxiliares: branded IDs · enums DC-1 · primitivas · guards puros · barrels.

---

## 4. Contratos explícitamente no implementados

WorkSet · WorkCoverageRecord · WorkEvidenceRecord · WorkApprovalRecord · CompensationCalculation · CompensationRecord · RevenueAttributionRecord · BeneficiaryPartyReference · WorkMetricsSnapshot · WorkLedgerOFTLBridgeRequest · WorkLedgerDomainEvent · providers · repositories · adapters · servicios · Supabase · UI.

---

## 5. Archivos autorizados (9)

| #   | Archivo                                                                           | Acción |
| --- | --------------------------------------------------------------------------------- | ------ |
| 1   | `docs/V2/TICKETS/TICKET-V2-DWL-DC-1-CORE-WORK-CONTRACTS-001.md`                   | Creado |
| 2   | `MiamiDJBeat-MigracionV2/shared/services/work-ledger/contracts/dwl-ids.ts`        | Creado |
| 3   | `MiamiDJBeat-MigracionV2/shared/services/work-ledger/contracts/dwl-enums.ts`      | Creado |
| 4   | `MiamiDJBeat-MigracionV2/shared/services/work-ledger/contracts/dwl-primitives.ts` | Creado |
| 5   | `MiamiDJBeat-MigracionV2/shared/services/work-ledger/contracts/dwl-entities.ts`   | Creado |
| 6   | `MiamiDJBeat-MigracionV2/shared/services/work-ledger/contracts/dwl-guards.ts`     | Creado |
| 7   | `MiamiDJBeat-MigracionV2/shared/services/work-ledger/contracts/index.ts`          | Creado |
| 8   | `MiamiDJBeat-MigracionV2/shared/services/work-ledger/index.ts`                    | Creado |
| 9   | `MiamiDJBeat-MigracionV2/tests/unit/dwl-data-contracts.test.ts`                   | Creado |

---

## 6. Patrón estructural observado

Replicado desde `MiamiDJBeat-MigracionV2/shared/services/finance/contracts/` y `legal/contracts/`:

- archivos separados: ids · enums · primitives · entities · guards · index;
- literal unions (`as const`) — sin enum TypeScript tradicional;
- tipos `readonly` · JSON-serializable · sin clases · sin Date/BigInt;
- branded IDs con helpers `as*()`;
- guards puros + `WorkLedgerContractError`;
- barrel `shared/services/work-ledger/` re-exporta `contracts/`.

---

## 7. IDs branded

| Tipo                        | Helper                        |
| --------------------------- | ----------------------------- |
| `WorkRecordId`              | `asWorkRecordId`              |
| `WorkSessionId`             | `asWorkSessionId`             |
| `WorkAssignmentReferenceId` | `asWorkAssignmentReferenceId` |
| `ProfessionalIdentityId`    | `asProfessionalIdentityId`    |

Referencias externas opacas (local DC-1 — aislamiento sin importar finance runtime):

| Tipo              | Helper              |
| ----------------- | ------------------- |
| `EventId`         | `asEventId`         |
| `VenueId`         | `asVenueId`         |
| `ArtistProfileId` | `asArtistProfileId` |
| `MdjUserId`       | `asMdjUserId`       |

`ArtistProfileId` y `MdjUserId` son branded distintos para preservar separación identidad (DWL-DC1-INV-13).

---

## 8. Enums finales

| Enum                | Valores                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `WorkRole`          | DJ · ARTIST · SINGER · BAND · ORCHESTRA · MC · DANCER · TECHNICIAN · VENDOR · OTHER                  |
| `WorkRecordStatus`  | DRAFT · SCHEDULED · IN_PROGRESS · COMPLETED · PARTIALLY_COMPLETED · CANCELLED · NO_SHOW · SUPERSEDED |
| `AttendanceStatus`  | UNKNOWN · EXPECTED · ARRIVED · LATE · ABSENT · EXCUSED                                               |
| `PerformanceStatus` | NOT_STARTED · IN_PROGRESS · COMPLETED · PARTIAL · CANCELLED · REPLACED · NOT_APPLICABLE              |
| `WorkSessionStatus` | SCHEDULED · IN_PROGRESS · COMPLETED · PARTIAL · CANCELLED · NO_SHOW                                  |
| `WorkSourceSystem`  | events_roster · staff_manual · import · system_derived                                               |

Alineación: discovery §7 + specification §13–15 + autorización PO DWL-DC-1.

---

## 9. Primitivas finales

`IsoDateTimeString` · `IsoDateString` · `IanaTimezone` · `WorkLedgerSchemaVersion` · `WorkSourceReference` · `WorkAuditMetadata` · `WorkPeriod`

Sin money types · sin compensation · sin revenue.

### 9.1 WorkAuditMetadata — `createdByUserId` vs `WorkRecord.createdByUserId`

**Decisión intencional (patrón OFTL `recordedByUserId` + `authorizationContext`):**

| Campo | Rol |
| ----- | --- |
| `WorkRecord.createdByUserId` | Actor que registra el **hecho operativo** (p. ej. cuenta Owner) |
| `WorkAuditMetadata.createdByUserId` | Actor en el **envelope de auditoría** al momento de captura |

En DC-1 suelen coincidir en creación inicial. Se mantienen separados para que correcciones futuras (`updatedByUserId`) no reescriban el actor del hecho sin traza explícita. **No** implica inferencia artista ← usuario.

### 9.2 WorkAssignmentReference — IDs distintos

| Campo | Rol |
| ----- | --- |
| `assignmentReferenceId` | ID nominal interno DWL (branded) |
| `externalAssignmentId` | Identificador opaco del dominio Eventos/roster |
| `sourceSystem` + `sourceReference` | Provenance denormalizado + payload completo (ambos requeridos por spec DWL) |

---

## 10. Diseño de entidades

### WorkRecord (DWL-C-001)

Campos: `workRecordId` · `eventId` · `venueId?` · `assignmentReference?` · `artistProfileId` · `professionalIdentity` · `scheduledDate` · `timezone` · `workRole` · `workStatus` · `attendanceStatus` · `performanceStatus` · `sourceReference` · `createdByUserId` · `auditMetadata` · `schemaVersion`

**No contiene:** montos · compensación · revenue · obligation · transaction · allocation · CF · beneficiary · evidence · approval.

### WorkSession (DWL-C-002)

Campos: `workSessionId` · `workRecordId` · `sequence` · `scheduledStartAt` · `scheduledEndAt` · `actualStartAt?` · `actualEndAt?` · `timezone` · `sessionStatus` · `venueId?` · `notes?` · `auditMetadata` · `schemaVersion`

**No contiene:** WorkSet · tarifa · compensación · revenue · evidencia · aprobación.

### WorkAssignmentReference (DWL-C-004)

Referencia estable mínima a roster — no duplica entidad Assignment completa.

### ProfessionalIdentityReference (DWL-C-011)

Snapshot de identidad profesional con `displayNameSnapshot` inmutable en el contrato.

---

## 11. Cardinalidad WorkRecord / WorkSession

**Decisión:** `WorkSession.workRecordId` → `WorkRecord` (1..N conceptual).

`WorkRecord` **no** embebe `sessionIds[]` — evita doble SSOT. Sesiones existen como contratos independientes referenciando el record padre. Un record puede existir antes de que todas las sesiones estén capturadas.

---

## 12. Guards implementados

| Guard                            | Propósito                                     |
| -------------------------------- | --------------------------------------------- |
| `assertValidWorkSessionSequence` | Entero seguro positivo (1 … MAX_SAFE_INTEGER) |
| `isWorkRecordStatus`             | Narrowing puro                                |
| `isAttendanceStatus`             | Narrowing puro                                |
| `isPerformanceStatus`            | Narrowing puro                                |
| `isWorkSessionStatus`            | Narrowing puro                                |
| `isWorkRole`                     | Narrowing puro                                |
| `WorkLedgerContractError`        | Error de dominio contrato                     |

---

## 13. Invariantes DWL-DC1-INV-01…15

| ID     | Regla                                      | Codificación                                        |
| ------ | ------------------------------------------ | --------------------------------------------------- |
| INV-01 | WorkRecordId obligatorio                   | Tipo `WorkRecord.workRecordId`                      |
| INV-02 | ArtistProfile obligatorio                  | `WorkRecord.artistProfileId` + identity ref         |
| INV-03 | ProfessionalIdentity obligatorio           | `WorkRecord.professionalIdentity`                   |
| INV-04 | StaffAccount ≠ ArtistProfile               | Branded `MdjUserId` ≠ `ArtistProfileId`             |
| INV-05 | WorkRecord ≠ pago                          | Sin campos financieros en entidades                 |
| INV-06 | Session → un WorkRecord                    | `WorkSession.workRecordId`                          |
| INV-07 | Sequence entero positivo seguro            | `assertValidWorkSessionSequence`                    |
| INV-08 | Timestamps ISO string                      | `IsoDateTimeString` / `IsoDateString`               |
| INV-09 | Timezone explícita                         | `IanaTimezone` en record/session                    |
| INV-10 | Source reference obligatoria               | `WorkRecord.sourceReference`                        |
| INV-11 | Audit metadata obligatoria                 | `WorkRecord.auditMetadata`                          |
| INV-12 | Display name snapshot                      | `ProfessionalIdentityReference.displayNameSnapshot` |
| INV-13 | ArtistProfile ≠ createdByUserId inferencia | IDs branded separados + tests                       |
| INV-14 | Sin campos financieros DC-1                | Tipos + test forbidden keys                         |
| INV-15 | JSON-serializable                          | Sin Date · BigInt · Map · class                     |

---

## 14. Separación identidad · Owner/DJMago305

Person ≠ UserAccount ≠ StaffAccount ≠ ArtistProfile ≠ ProfessionalIdentity ≠ BeneficiaryParty

Caso Owner/DJMago305 representable: `createdByUserId` = cuenta Owner · `artistProfileId` + `professionalIdentity` = DJMago305 · sin fusión · sin owner draw · sin compensación en DC-1.

---

## 15. Privacidad (conceptual)

DC-1 no implementa permisos runtime. Contratos excluyen margen · banca · fiscal · beneficiary.

---

## 16. Dependencias prohibidas

Sin Supabase · network · storage · UI · DOM · providers · repositories · adapters · OFTL runtime · Cash Flow · Notification Center.

Referencias externas definidas localmente en `dwl-ids.ts` para preservar aislamiento del módulo work-ledger.

---

## 17. Pruebas

Archivo: `MiamiDJBeat-MigracionV2/tests/unit/dwl-data-contracts.test.ts`

Cobertura mínima PO: 34 casos base + 2 refuerzos auditoría = **36 casos** (fixtures · JSON · branded IDs · compile-time separation · sequence guards · status guards · barrels · forbidden fields · forbidden imports · Owner/DJMago305 JSON triple · no Date/BigInt).

Comando: `npm test -- tests/unit/dwl-data-contracts.test.ts`

Typecheck: `npm run typecheck`

---

## 18. Impact Analysis

| Componente                     | Modificado |
| ------------------------------ | ---------- |
| DWL discovery / specification  | **No**     |
| OFTL DC-1 / DC-2               | **No**     |
| Notification Center            | **No**     |
| Cash Flow                      | **No**     |
| Artist / Staff / Event runtime | **No**     |
| Supabase / V1                  | **No**     |

**RIESGO FUNCIONAL DIRECTO:**

**NULO EN RUNTIME, PORQUE DWL-DC-1 IMPLEMENTA EXCLUSIVAMENTE CONTRATOS TIPADOS SIN INYECCIÓN, PROVIDERS, PERSISTENCIA NI UI.**

**RIESGO ARQUITECTÓNICO:**

**CONTROLADO MEDIANTE AISLAMIENTO DE ARCHIVOS, PRUEBAS, TYPECHECK, AUDITORÍA PRE-COMMIT Y GATES FUTUROS DEL PRODUCT OWNER.**

---

## 19. Supervisión profesional

**ESTADO LEGAL:** CONTRATOS TÉCNICOS — PENDIENTES DE REVISIÓN LEGAL PROFESIONAL

**ESTADO CONTABLE:** SIN LÓGICA CONTABLE EN DWL-DC-1

**ESTADO FISCAL:** SIN CLASIFICACIONES FISCALES EN DWL-DC-1

No afirmar: legalmente aprobado · payroll · empleado/contratista · cumplimiento garantizado · producción.

---

## 20. Riesgos pendientes

| ID           | Riesgo                                           |
| ------------ | ------------------------------------------------ |
| R-DWL-DC1-01 | Enum drift vs discovery futuro                   |
| R-DWL-DC1-02 | Referencias externas duplicadas vs módulo events |
| R-DWL-DC1-03 | Cardinalidad session sin agregador runtime       |
| R-DWL-DC1-04 | Auto-aprobación Owner/DJMago305 (DC-3)           |

---

## 21. Estado final

**DWL-DC-1 — IMPLEMENTADO LOCALMENTE — PENDIENTE DE REVISIÓN Y APROBACIÓN PO — SIN COMMIT**

No marcar: FINALIZADO · CERRADO · PRODUCTION READY · LEGALMENTE APROBADO · RELEASED · DEPLOYED.

---

_Implementación canónica Work Ledger DC-1. Commit requiere auditoría pre-commit PO separada._
