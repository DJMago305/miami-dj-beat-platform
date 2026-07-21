# TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001

## Estado

**DC-1 SPEC COMPLETE — RUNTIME REPOSITORIES NOT AUTHORIZED**

| Campo | Valor |
|-------|-------|
| Fase | **DC-1** — Data Contracts |
| Parent | TICKET-V2-LEGAL-DATA-CONTRACTS-DISCOVERY-001 (DC-0) |
| Fecha | 2026-07-20 |
| Autorización | TypeScript read contracts + unit guards · **no** SQL · **no** Supabase · **no** UI · **no** commit unless PO requests |

---

## Entregables DC-1

| # | Entregable | Ubicación | Estado |
|---|------------|-----------|--------|
| 1 | TypeScript entity types LDC-001…014 | `shared/services/legal/contracts/legal-entities.ts` | ✅ |
| 2 | ID aliases | `legal-ids.ts` | ✅ |
| 3 | Enumerations | `legal-enums.ts` | ✅ |
| 4 | Read projections | `legal-projections.ts` | ✅ |
| 5 | Domain events | `legal-domain-events.ts` | ✅ |
| 6 | Read-only ports | `legal-service-ports.ts` | ✅ |
| 7 | Barrel export | `index.ts` | ✅ |
| 8 | Human spec | `LEGAL-DATA-CONTRACTS-SPEC.md` | ✅ |
| 9 | Contract guards tests | `tests/unit/legal-data-contracts.test.ts` | ✅ |

---

## Cobertura LDC → TypeScript

| LDC | Type name |
|-----|-----------|
| LDC-001 | `LegalProfile` |
| LDC-002 | `LegalDocument` |
| LDC-003 | `LegalTemplate` |
| LDC-004 | `TemplateVersion` |
| LDC-005 | `SignaturePackage` |
| LDC-006 | `SigningSession` |
| LDC-007 | `SignatureRecord` |
| LDC-008 | `AcceptanceRecord` |
| LDC-009 | `FinalArtifact` |
| LDC-010 | `TaxProfile` |
| LDC-011 | `ComplianceProfile` |
| LDC-012 | `IntroductionRecord` |
| LDC-013 | `AuditEvent` |
| LDC-014 | `LegalNotification` |

---

## Read models (projections)

| Projection | Type |
|------------|------|
| Legal Status | `LegalStatusSnapshot` |
| Documents Library | `DocumentsLibraryView` |
| Signature History | `SignatureHistoryView` |
| Package progress | `PackageProgressView` |
| Tax Center | `TaxCenterView` |
| Compliance Center | `ComplianceCenterView` |
| Introduction Registry | `IntroductionRegistryView` |
| Audit Timeline | `AuditTimelineView` |
| Staff overview | `StaffLegalOverview` |
| Full expediente | `LegalExpedienteSnapshot` |

---

## Invariants codified

| Rule | Implementation |
|------|----------------|
| DC-01 UI reads snapshot | `LegalExpedienteSnapshot` |
| DC-02 Tax isolated | `TaxCenterView` separate; no `tinFull` on `TaxProfile` |
| TP-01 W-9 excluded from library | `isPublicLegalLibraryDocument()` |
| Audit payload safety | `assertAuditPayloadSafe()` + `FORBIDDEN_AUDIT_PAYLOAD_KEYS` |

---

## Service ports (read-only)

| Port | Methods |
|------|---------|
| `LegalProfilePort` | `getExpedienteSnapshot`, `getStatusSnapshot` |
| `LegalDocumentsPort` | `getLibraryView`, `getSignatureHistory` |
| `LegalTaxPort` | `getTaxCenterView` |
| `LegalCompliancePort` | `getComplianceCenterView` |
| `LegalIntroductionPort` | `getIntroductionRegistryView` |
| `LegalPackagePort` | `getPackageProgress` |
| `LegalAuditPort` | timeline by profile/package |
| `StaffLegalPort` | `getOverview` |

Implementations: **DC-4** mock · **DC-5** Postgres (red-zone ticket).

---

## Domain events (17)

`LEGAL_PROFILE_CREATED` · `LEGAL_STATUS_CHANGED` · `PACKAGE_*` · `DOCUMENT_*` · `W9_*` · `COMPLIANCE_*` · `INTRODUCTION_*` · `ARTIFACT_GENERATED` · `LEGAL_NOTIFICATION_CREATED`

Typed via `LegalDomainEvent<TName>` + `LegalDomainEventPayloadMap`.

---

## Explicit non-scope (DC-1)

| Item | Phase |
|------|-------|
| Postgres / SQL | DC-5 separate |
| Mock repositories | DC-4 |
| Legal Center UI | LC-3 / UX-4 |
| Signing runtime | SW-4 |
| JSON Schema export | Optional DC-1b |
| Event bus wiring | DC-3 |

---

## QA

```bash
cd MiamiDJBeat-MigracionV2 && npm run typecheck && npm test -- tests/unit/legal-data-contracts.test.ts
```

Expected: typecheck exit 0 · 2 new contract tests PASS · full suite unchanged baseline + 2.

---

## Próximo paso

**DC-2 — Runtime Planning:** mock `LegalServicePorts` + fixture expediente for Legal Center shell.

**ESTADO:** SPEC LISTO PARA REVISIÓN PO. Sin commit unless authorized.
