# TICKET-V2-LEGAL-CENTER-LC-8-W9-SUBMISSION-STORAGE-FOUNDATION-001

## LC-8 — W-9 Submission and Storage Port Foundation

| Campo | Valor |
|-------|-------|
| Estado | **IMPLEMENTADO — APROBADO TÉCNICAMENTE POR EL PRODUCT OWNER** |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `ffdc22d5a7c3c3865601e4b24a49359c288801a9` |
| HEAD post-commit LC-8 | pendiente de entrega en commit |
| Parent | LC-7 W-9 Collection Workflow · LC-6 Document Instance · LC-5 Template Assets |

---

## 1. Objetivo

Introducir el concepto **“Documento W-9 completado y almacenado”** como metadata-only, desacoplado de proveedor real:

- `LegalDocumentSubmission` (`LDS-######`)
- `LegalDocumentStoragePort`
- `InMemoryLegalDocumentStorage`
- Validaciones tipadas (PDF, 20 MB, filename, checksum)
- Integración con LC-7 (`submitW9Document`, review, accept/reject)
- Placeholders UI controlados (sin uploader real)

**Sin Supabase Storage · sin buckets · sin upload navegador · sin OCR · sin firma · sin Edge Functions.**

---

## 2. Baseline de arranque

| Check | Esperado |
|-------|----------|
| Rama | `plan/v2-phase-4-api-client` |
| HEAD | `ffdc22d5a7c3c3865601e4b24a49359c288801a9` |
| Working tree | limpio |
| `npm run typecheck` | PASS |
| `npm test -- --run` | 913 PASS |
| HTTP 200 | `/staff/`, `/staff/?previewRole=seller`, `/artist/`, `/client/`, PDF W-9 |

---

## 3. Arquitectura

```
LegalW9Request (W9R-######)
  └── LegalDocumentInstance (LDI-######)
        └── LegalDocumentSubmission (LDS-######)  ← LC-8
              └── StoredDocumentAsset (metadata-only)
                    storageKey, contentReference, checksum, filename, mimeType, sizeBytes
```

**StoragePort** es la única dependencia de persistencia del dominio de submissions. LC-8 implementa `InMemoryLegalDocumentStorage`; LC-9+ puede sustituir por Supabase u otro backend sin cambiar contratos de dominio.

---

## 4. Modelo `LegalDocumentSubmission`

| Campo | Descripción |
|-------|-------------|
| `id` | `LDS-######` (identidad propia; no reutiliza W9R/LDI/SPC) |
| `documentInstanceId` | `LDI-######` |
| `workflowId?` | `W9R-######` |
| `templateId` / `templateVersionId` | `SPC-001` / `TV-SPC-001-1` |
| `filename`, `mimeType`, `sizeBytes` | Metadata del archivo |
| `checksum` | Digest serializable obligatorio |
| `storageKey` | Clave interna (`legal/submissions/{LDI}/{LDS}`) — no expuesta en UI |
| `contentReference` | Puntero metadata-only (sin blob) |
| `submittedBy` | Actor portal/rol |
| `submittedAt` / `updatedAt` | ISO 8601 |
| `status` | Ver §5 |
| `metadata` | Serializable, sin datos fiscales |

Proyección pública: `LegalDocumentSubmissionPublicView` — **sin** `storageKey`, **sin** `checksum`.

---

## 5. Estados del submission

| Estado | Terminal | Descripción |
|--------|----------|-------------|
| `pending_upload` | No | Reservado / preview |
| `uploaded` | No | Metadata registrada (sin blob) |
| `under_review` | No | Staff revisando |
| `accepted` | Sí | Aceptado |
| `rejected` | Sí | Rechazado |
| `deleted` | Sí | Eliminado lógico (owner) |

Transiciones: `canTransitionSubmissionStatus()` / `transitionSubmissionStatus()`.

**Prohibido:** `accepted → uploaded`, `rejected → uploaded`, `deleted → uploaded`.

---

## 6. StoragePort

`LegalDocumentStoragePort`:

| Operación | Descripción |
|-----------|-------------|
| `storeSubmission()` | Crear metadata |
| `getSubmission()` | Lectura por id |
| `listSubmissions()` | Listado global (lab) |
| `listSubmissionsByInstance()` | Por `LDI` |
| `listSubmissionsByWorkflow()` | Por `W9R` |
| `replaceSubmission()` | Nueva `LDS`; superseded → `deleted` con metadata |
| `transitionSubmission()` | Cambio de estado |
| `deleteSubmission()` | Soft delete (`deleted`, conserva registro) |
| `listSubmissionsIncludingDeleted()` | Auditoría in-memory |
| `purgeUnlinkedSubmission()` | Rollback coordinado (solo `uploaded` sin link) |
| `exists()` | Presencia |

Implementación: `InMemoryLegalDocumentStorage` (`shared/services/legal/in-memory/in-memory-legal-document-storage.ts`).

---

## 7. Validaciones

| Regla | Error |
|-------|-------|
| `mimeType === application/pdf` | `invalid_mime_type` |
| Rechaza `image/*`, `video/*`, ejecutables, zip | `invalid_mime_type` |
| `sizeBytes <= 20 MB` | `submission_too_large` |
| filename no vacío, sin `../`, sin path traversal | `invalid_filename` |
| checksum `algorithm:digest` (e.g. `sha256:...`) | `invalid_checksum` |
| `contentReference` solo `in-memory://...` | `invalid_submission_input` |

---

## 8. Integración LC-7

### Operaciones de dominio (W-9 workflow service)

| Método | Actor | Efecto |
|--------|-------|--------|
| `submitW9Document()` | Artist (propio) | submission `uploaded`, workflow `submitted`, instance `viewed` |
| `markSubmissionUnderReview()` | Owner/Manager | submission `under_review`, workflow permanece `submitted` |
| `acceptSubmission()` | Owner/Manager | submission `accepted`, workflow `accepted`, instance `signed` |
| `rejectSubmission()` | Owner/Manager | submission `rejected`, workflow `rejected`, instance `rejected` |
| `deleteW9Submission()` | Owner | submission `deleted` |

### Mapeo workflow ↔ submission ↔ instance

| Workflow W-9 | Submission | Instance LC-6 |
|--------------|------------|---------------|
| `awaiting_upload` | (sin submission / preview) | `viewed` |
| `submitted` | `uploaded` → `under_review` | `viewed` |
| `accepted` | `accepted` | `signed` |
| `rejected` | `rejected` | `rejected` |

LC-7 operational path (`requested → available → viewed → awaiting_upload`) **sin regresión**.

---

## 9. Permisos

| Actor | Submit | Ver | Review | Accept/Reject | Delete |
|-------|--------|-----|--------|---------------|--------|
| Owner | — | Sí | Sí | Sí | Sí |
| Manager | — | Sí | Sí | Sí | No |
| Seller | — | No | No | No | No |
| Artist | Propio | Propio | No | No | No |
| Client | — | No | No | No | No |

Validaciones en `legal-document-submission-permissions.ts` — dominio puro, sin DOM.

---

## 10. Inmutabilidad

`freezeLegalDocumentSubmission()` / `cloneLegalDocumentSubmission()` protegen:

- `metadata`
- `submittedBy`
- `checksum`
- `storageKey`

Pruebas en `legal-w9-submission-storage.test.ts`.

---

## 11. UI (placeholders LC-8)

| Portal | Placeholder |
|--------|-------------|
| Artist | `Submission pipeline ready` (awaiting upload) |
| Staff | `Submission status: Awaiting upload / Uploaded / Under review / Accepted / Rejected` |

**No** drag & drop · **no** file picker · **no** modal · **no** exposición de `storageKey`/`checksum`.

Archivo: `legal-w9-workflow-shell-mapper.ts`.

---

## 12. Archivos

### Creados

- `shared/services/legal/submissions/*` (types, status, errors, validation, transition, immutability, factory, permissions, port, index)
- `shared/services/legal/in-memory/in-memory-legal-document-storage.ts`
- `tests/unit/legal-w9-submission-storage.test.ts`
- `tests/unit/legal-w9-submission-storage-audit.test.ts`
- `docs/V2/TICKETS/TICKET-V2-LEGAL-CENTER-LC-8-W9-SUBMISSION-STORAGE-FOUNDATION-001.md`

### Modificados

- `shared/services/legal/in-memory/in-memory-legal-w9-workflow-service.ts`
- `shared/services/legal/in-memory/index.ts`
- `shared/services/legal/workflows/legal-w9-request-status.ts`
- `shared/services/legal/workflows/legal-w9-request-transition.ts`
- `shared/services/legal/workflows/legal-w9-instance-mapping.ts`
- `shared/services/legal/workflows/legal-w9-request-types.ts`
- `shared/services/legal/provider/legal-w9-workflow-shell-mapper.ts`
- `tests/unit/legal-w9-workflow.test.ts` (matriz LC-8 + placeholder artist)

---

## 13. Exclusiones (LC-8)

- Supabase Storage / buckets
- Upload real navegador
- Firma electrónica / OCR / parsing PDF
- Resend / email / secure links / webhooks
- Encryption real / Edge Functions
- **LC-9 no iniciado**

---

## 14. Riesgos y deuda

| Riesgo | Mitigación / deuda |
|--------|-------------------|
| Storage in-memory no persiste entre reload | LC-9: adapter Supabase |
| `contentReference` es puntero ficticio | LC-9: URL firmada / bucket key real |
| Review manual sin cola async | LC-9+: notifications |
| Convergencia LDC-002 vs LDI | Fuera de alcance LC-8 (deuda conocida LC-6) |
| Demo seed comparte singleton lab | Tests usan servicios aislados |

---

## 15. Pruebas

Suite LC-8: `tests/unit/legal-w9-submission-storage.test.ts`

Cubre: creación, IDs LDS, validaciones, storage CRUD, transiciones submission, inmutabilidad, integración LC-7, permisos, regresión LC-5/6/7 UI.

---

## 16. QA

Ejecutar post-implementación:

```bash
npm run typecheck
npm test -- --run
git diff --check
```

HTTP 200: `/staff/`, `/staff/?previewRole=seller`, `/artist/`, `/client/`, PDF W-9 runtime.

---

## 18. Auditoría técnica final (PO)

### 18.1 Consistencia / atomicidad (estrategia B + C)

Operaciones coordinadas en `InMemoryLegalW9WorkflowService`:

1. **Validación previa completa** — `applyLegalW9RequestStatusTransition()` + `validateInstanceSyncForWorkflowStatus()` calculan el plan antes de mutar stores.
2. **Persistencia ordenada** — submission → workflow/instance solo tras plan válido.
3. **Rollback in-memory** — si falla sync/persist posterior:
   - `submitW9Document()` → `purgeUnlinkedSubmission()` elimina `LDS` huérfano (`uploaded` sin link).
   - `acceptSubmission()` / `rejectSubmission()` → `transitionSubmission(..., 'under_review')` revierte submission si workflow/instance falla.

Pruebas: `legal-w9-submission-storage-audit.test.ts` (fallo de instance sync sin estado parcial).

### 18.2 Semántica `accepted → signed` (W-9)

Para W-9 collection:

- **`accepted`** (submission/workflow) = documento completado recibido y aprobado por staff.
- **`signed`** (instance LC-6) = instancia finalizada para W-9; **no** implica firma electrónica verificada por plataforma.
- LC-8 **no** valida firma criptográfica ni representa e-sign MDJB.
- Matriz global LC-6 **sin cambios**; semántica W-9 documentada aquí y en metadata de workflow `w9_collection`.

### 18.3 Política `replaceSubmission`

- Solo submissions **no terminales**.
- Terminal (`accepted` / `rejected` / `deleted`) → `submission_replace_not_allowed`.
- **No** cambia `documentInstanceId`; **no** cambia `workflowId`.
- Reemplazo material → **nueva `LDS`**; anterior → `deleted` con `replacedBySubmissionId` / `replacesSubmissionId`.
- Validaciones de filename, checksum, size, mime re-ejecutadas.

### 18.4 Política `deleteSubmission`

- **Soft delete** — registro permanece en Map con `status: deleted` y `updatedAt`.
- Listados activos (`listSubmissions`, by instance/workflow) **excluyen** `deleted`.
- `getSubmission()` y `listSubmissionsIncludingDeleted()` conservan auditoría mínima in-memory.
- Solo **Owner** vía `deleteW9Submission()`.

### 18.5 Seguridad

- `storageKey` generado internamente (`legal/submissions/{LDI}/{LDS}`); no input de actor.
- `contentReference` restringido a `in-memory://...` (no URLs públicas).
- Checksum formato `algorithm:digest`.
- Sin exposición de `storageKey` / `checksum` en UI pública.

### 18.6 Autorización

- Capa dominio: `canActorListSubmissions`, `canActorViewSubmission`, `listW9Submissions()`, gates en workflow service.
- Artist A ≠ Artist B; Seller/Client bloqueados en servicio (no solo UI).
- Pruebas cruzadas en audit suite.

### 18.7 QA post-auditoría

| Check | Resultado |
|-------|-----------|
| `npm run typecheck` | PASS |
| LC-8 tests | 14 PASS |
| LC-8 audit tests | 8 PASS |
| LC-7 tests | 18 PASS |
| Suite completa | **935 PASS** (baseline 913 + 22 LC-8) |
| `git diff --check` | PASS |
| HTTP 200 (5 URLs) | PASS |

---

## 19. Confirmación de entrega

- Commit autorizado PO: `feat(v2-legal): add W-9 submission and storage foundation`
- Sin push
- Sin merge
- Sin PR
- Sin deploy
- LC-9 no iniciado

**Estado final:** **LC-8 CERRADO — APROBADO TÉCNICAMENTE POR EL PRODUCT OWNER**
