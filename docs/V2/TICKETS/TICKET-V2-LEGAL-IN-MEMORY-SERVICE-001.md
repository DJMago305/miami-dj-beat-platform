# TICKET-V2-LEGAL-IN-MEMORY-SERVICE-001

## Estado

**DC-2 — IN-MEMORY LEGAL SERVICE COMPLETE**

**PENDIENTE DE REVISIÓN DEL PRODUCT OWNER · SIN COMMIT · SIN PUSH · SIN DEPLOY**

| Campo | Valor |
|-------|-------|
| Fase | **DC-2** — In-memory read-only `LegalServicePorts` |
| Parent | TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001 (DC-1) |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD inicial | `3638954746f4c81a12ce6278469ca5a60a659df1` |
| Baseline DC-1 | commit local `3636185` (contratos read-only) |
| Fecha QA | 2026-07-20 |
| Modo | Laboratorio V2 · solo memoria · solo lectura |

---

## 1. Baseline real

| Métrica | Pre-DC-2 (PO) | Post-DC-2 (QA) |
|---------|---------------|----------------|
| Test files | 59 PASS | **60 PASS** |
| Tests | 788 PASS | **803 PASS** |
| typecheck | exit 0 | **exit 0** |

Working tree inicial: sin archivos `in-memory/` (solo DC-1 en contratos + test contracts).

Working tree final: archivos **untracked** bajo `shared/services/legal/in-memory/`, test unitario, ticket doc.

---

## 2. Archivos creados / modificados

### Creados

| Archivo | Rol |
|---------|-----|
| `MiamiDJBeat-MigracionV2/shared/services/legal/in-memory/legal-fixtures.ts` | Fixtures canónicos (5 personas) |
| `MiamiDJBeat-MigracionV2/shared/services/legal/in-memory/in-memory-legal-store.ts` | Store clone-on-read |
| `MiamiDJBeat-MigracionV2/shared/services/legal/in-memory/legal-projection-builders.ts` | Proyecciones LGC |
| `MiamiDJBeat-MigracionV2/shared/services/legal/in-memory/legal-status-resolver.ts` | Resolver GREEN/YELLOW/RED + razones |
| `MiamiDJBeat-MigracionV2/shared/services/legal/in-memory/legal-access-policy.ts` | Proyecciones seguras por rol |
| `MiamiDJBeat-MigracionV2/shared/services/legal/in-memory/in-memory-legal-service.ts` | `createInMemoryLegalService()` |
| `MiamiDJBeat-MigracionV2/shared/services/legal/in-memory/index.ts` | Barrel export |
| `MiamiDJBeat-MigracionV2/shared/services/legal/in-memory/LEGAL-IN-MEMORY-SERVICE.md` | Spec humana |
| `MiamiDJBeat-MigracionV2/tests/unit/legal-in-memory-service.test.ts` | 15 tests obligatorios |
| `docs/V2/TICKETS/TICKET-V2-LEGAL-IN-MEMORY-SERVICE-001.md` | Este ticket |

### Modificados

Ningún archivo fuera de alcance. **DC-1 contracts sin cambios.**

### Eliminado (scaffold intermedio)

`shared/services/legal/runtime/` — reemplazado por estructura canónica `in-memory/`.

---

## 3. Arquitectura

```
DC-1 contracts (read ports + entities)
        ↓
legal-fixtures → in-memory-legal-store (seed determinista)
        ↓
legal-projection-builders (LGC snapshots)
        ↓
legal-status-resolver (pure) + legal-access-policy (role views)
        ↓
in-memory-legal-service → LegalServicePorts (async) + lab sync helpers
        ↓
tests/unit/legal-in-memory-service.test.ts
```

**Sin red · sin localStorage · sin sessionStorage · sin mutación en consultas.**

---

## 4. Fixtures

| # | ID | Persona | Estado | Notas clave |
|---|-----|---------|--------|-------------|
| 1 | `LP-ART-GREEN-001` | DJMago305 / Gerardo A Valle | GREEN | LGL-001/002/003 · CTR-001 · W-9 approved · seguro · compliance full |
| 2 | `LP-ART-YELLOW-001` | Artist lab | YELLOW | Contrato firmado · W-9 approved · seguro pronto a vencer · warning corporativo |
| 3 | `LP-PRO-RED-001` | Vendor/provider | RED | W-9 missing · anti-bypass missing · contrato/seguro vencidos · 4 restrictions |
| 4 | `LP-CLI-001` | Client | GREEN | Contratos + historial · **sin** TaxProfile |
| 5 | `LP-EXT-001` | External signer | YELLOW | `PKG-EXT-001` · sesión stub · token ref no utilizable |

Constantes exportadas: `LEGAL_FIXTURE_PROFILE_IDS`, `LEGAL_FIXTURE_PACKAGE_IDS`, `LEGAL_FIXTURE_INTRODUCTION_IDS`, `LEGAL_FIXTURE_EXPEDIENTE`.

---

## 5. Puertos implementados (read-only)

Todos los puertos de `legal-service-ports.ts`:

| Port | Métodos |
|------|---------|
| `profile` | `getExpedienteSnapshot`, `getStatusSnapshot` |
| `documents` | `getLibraryView`, `getSignatureHistory` |
| `tax` | `getTaxCenterView` |
| `compliance` | `getComplianceCenterView` |
| `introduction` | `getIntroductionRegistryView` |
| `packages` | `getPackageProgress` |
| `audit` | timeline by profile / package |
| `staff` | `getOverview` |

**Lab accessors adicionales (no alteran DC-1):**

- `getProfileById` · `getDocumentById` · `listPackagesForProfile`
- `resolveLegalStatusForProfile` · `projectExpedienteForViewer`
- `getExternalSignerPackageView` · `canExternalSignerAccessPackage`
- `getExpedienteSnapshotSync`

**Sin write-side:** create · update · delete · send · sign · approve · reject · void · revoke.

---

## 6. Proyecciones por rol

Implementadas en `legal-access-policy.ts` via `projectExpedienteForViewer()`:

| Rol | Tax/W-9 | Compliance | Audit | Notes |
|-----|---------|------------|-------|-------|
| `staff_owner` | masked TIN | full | full | expediente completo no fiscal crudo |
| `staff_manager` | masked TIN | full | full | igual owner salvo futura ACL fiscal |
| `staff_seller` | hidden | summary | hidden | status resumido · sin IP/device |
| `artist` | own tax center | own | own | solo propio expediente |
| `client` | hidden | hidden | hidden | contratos + historial propio |
| `external_signer` | hidden | hidden | hidden | solo paquete asignado |

---

## 7. Legal Status resolver

`resolveLegalStatus()` en `legal-status-resolver.ts`:

- Entrada: profile + documents + tax + compliance (+ `now`)
- Salida: `{ status, reasons[], restrictions[] }`
- Razones estructuradas: `W9_REQUIRED`, `ANTI_BYPASS_MISSING`, `CONTRACT_EXPIRED`, `INSURANCE_EXPIRING_SOON`, `COMPLIANCE_WARNING`, etc.
- `blocking: true|false` por razón

Validado en tests 3–5 contra fixtures GREEN / YELLOW / RED.

---

## 8. Invariantes fiscales

| Regla | Implementación |
|-------|----------------|
| TP-01 W-9 fuera de library | `isPublicLegalLibraryDocument()` en builders |
| Sin `tinFull` | omitido en fixtures y tipos DC-1 |
| TIN enmascarado en proyección staff | `***-{last4}` en access policy |
| Client sin TaxProfile | fixture `LP-CLI-001` sin `taxProfileId` |
| Seller sin W-9 | `projectTaxCenterForViewer` → `undefined` |
| Audit seguro | `assertAuditPayloadSafe()` en timelines |

---

## 9. Introduction Registry fixture

| Campo | Valor |
|-------|-------|
| ID | `INTRO-2026-000421` |
| Platform | Miami DJ Beat LLC |
| Counterparty | Mojitos Calle 8 |
| Performer | DJMago305 |
| Fecha | 2026-05-01 |
| Protección | `active` |
| Vencimiento | 2028-05-01 (24 meses) |
| Waiver | ausente |

---

## 10. Tests

Archivo: `tests/unit/legal-in-memory-service.test.ts` — **15/15 PASS**

1. Fixtures deterministas  
2. Expediente por ID  
3. DJ GREEN → GREEN  
4. Artist YELLOW → YELLOW  
5. Provider RED → RED  
6. Seller sin W-9  
7. Client sin TaxProfile  
8. W-9 excluido de library  
9. TIN enmascarado  
10. Audit payload prohibido  
11. External signer scope  
12. Introduction activa  
13. Store inmutable en snapshot  
14. ID desconocido tipado  
15. Sin secretos utilizables  

---

## 11. Resultados QA

```bash
cd MiamiDJBeat-MigracionV2
npm run typecheck          # exit 0
npm test -- legal-in-memory-service   # 15/15 PASS
npm run test               # 60 files · 803 tests PASS · ~18.4s
```

Warnings: `npm warn Unknown env config "devdir"` (pre-existente, no bloqueante).

---

## 12. Limitaciones

- Status resolver es **conceptual lab** — no reemplaza motor server-side futuro (LC-03).
- Fixtures usan fecha fija `2026-07-20T21:00:00.000Z` para determinismo.
- External token es referencia stub (`lab-stub-token-ref-only`), no JWT utilizable.
- `aggregateStatus` en fixture puede diferir del resolver; tests validan **resolver** como fuente de reglas.

---

## 13. Fuera de alcance (confirmado)

SQL · Supabase · Postgres · Edge Functions · email · PDF · firma real · Staff/Artist/Client UI · Session · Auth · Event Bus · API Client · producción V1 · commit · push · merge · PR · deploy.

---

## 14. Próximo paso sugerido

**LC-2 / LC-3** — Legal Center provider factory en portales lab (`artist/`, `staff/`, `client/`) consumiendo `createInMemoryLegalService()`.

---

## Git (estado final)

```
HEAD: 3638954746f4c81a12ce6278469ca5a60a659df1
git status: untracked in-memory/ + test + ticket doc
git diff --stat: N/A (sin staged changes)
git diff --check: clean
```

**SIN COMMIT — DETENIDO.**
