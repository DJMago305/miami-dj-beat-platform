# TICKET-V2-LEGAL-CENTER-LC-10-PERSISTENCE-ADAPTER-DISCOVERY-001

## Estado

**DISCOVERY APROBADO POR EL PRODUCT OWNER**

Documentación LC-10 committeada localmente · sin persistencia real · sin Supabase activo · sin push · sin merge · sin PR · sin deploy · **LC-11 no iniciado**.

| Campo | Valor |
|-------|-------|
| Ticket | LC-10 — Persistence Adapter Discovery |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `519f9ae082c57b9be221e9909c5d1443918399a5` |
| Commit baseline | `519f9ae feat(v2-legal): add legal audit trail foundation` |
| Commit cierre LC-10 | `docs(v2-legal): approve persistence adapter discovery` |
| Tests | **958 PASS** |
| typecheck | exit 0 |
| HTTP QA | 5/5 HTTP 200 |
| Fecha discovery | 2026-07-21 |
| Fecha aprobación PO | 2026-07-21 |
| Alcance | Solo documentación — **cero cambios runtime** |

---

## 1. Objetivo

Discovery exhaustivo de persistencia para Legal Center V2: inventario real del código LC-4→LC-9, límites de aggregates, repository ports propuestos, modelo relacional futuro, RLS, atomicidad, migración, riesgos y decisiones. **No implementa runtime.**

---

## 2. Baseline de arranque

| Check | Resultado |
|-------|-----------|
| Rama | `plan/v2-phase-4-api-client` ✓ |
| HEAD | `519f9ae` ✓ |
| Working tree inicial | limpio ✓ |
| `npm run typecheck` | exit 0 ✓ |
| Suite | 958 PASS ✓ |
| HTTP `/staff/` · seller · `/artist/` · `/client/` · W-9 PDF | 200 OK ✓ |

---

## 3. Inventario real del código

### 3.1 Estructura (`shared/services/legal/`)

| Carpeta | Rol | Archivos clave |
|---------|-----|----------------|
| `contracts/` | DC-1 — entidades LDC, IDs, enums, proyecciones read-only, `LegalServicePorts` | `legal-entities.ts`, `legal-service-ports.ts` |
| `domain/` | LC-6 — `LegalDocumentInstance` factory, status, transition, immutability, clock | 8 módulos |
| `workflows/` | LC-7 — `LegalW9Request`, actor, transitions, instance mapping, lab store | 9 módulos |
| `submissions/` | LC-8 — `LegalDocumentSubmission`, `StoredDocumentAsset`, storage port, permissions | 9 módulos |
| `audit/` | LC-9 — `LegalAuditEvent`, trail port, recorder, permissions, public view | 10 módulos |
| `assets/` | LC-5 — catálogo estático, resolver, URLs, access policy | 7 módulos |
| `in-memory/` | DC-2 + LC-6/7/8/9 — stores, fixtures, application services | 14 módulos |
| `provider/` | LC-4 — factory, portal adapters, shell mappers | 10 módulos |
| `ui/` | LC-4 — shell render (sin persistencia) | 7 módulos |

**Total:** 74 archivos bajo `shared/services/legal/` (maxdepth 4).

### 3.2 Tests unitarios Legal (LC-4 → LC-9)

| Archivo | Ticket |
|---------|--------|
| `legal-data-contracts.test.ts` | DC-1 |
| `legal-in-memory-service.test.ts` | DC-2 |
| `legal-provider-factory.test.ts` | LC-4 |
| `legal-portal-adapters.test.ts` | LC-4 |
| `legal-center-shell.test.ts` | LC-4 |
| `legal-template-assets.test.ts` | LC-5 |
| `legal-template-asset-download-mapper.test.ts` | LC-5 |
| `legal-document-instance-lifecycle.test.ts` | LC-6 |
| `legal-w9-workflow.test.ts` | LC-7 |
| `legal-w9-submission-storage.test.ts` | LC-8 |
| `legal-w9-submission-storage-audit.test.ts` | LC-8 |
| `legal-audit-trail.test.ts` | LC-9 |
| `legal-audit-integration.test.ts` | LC-9 |

### 3.3 Tickets documentales previos

- LC-5: `TICKET-V2-LEGAL-CENTER-LC-5-TEMPLATE-ASSET-INTEGRATION-001.md`
- LC-6: `TICKET-V2-LEGAL-CENTER-LC-6-DOCUMENT-INSTANCE-LIFECYCLE-001.md`
- LC-7: `TICKET-V2-LEGAL-CENTER-LC-7-W9-COLLECTION-WORKFLOW-001.md`
- LC-8: `TICKET-V2-LEGAL-CENTER-LC-8-W9-SUBMISSION-STORAGE-FOUNDATION-001.md`
- LC-9: `TICKET-V2-LEGAL-CENTER-LC-9-AUDIT-TRAIL-FOUNDATION-001.md`

### 3.4 Ports existentes (runtime real, no repositories)

| Port | Ubicación | Naturaleza |
|------|-----------|------------|
| `LegalServicePorts` | `contracts/legal-service-ports.ts` | Read-only proyecciones DC-1 (profile, documents, tax, audit timeline…) |
| `LegalDocumentStoragePort` | `submissions/legal-document-storage-port.ts` | CRUD in-memory submissions LC-8 |
| `LegalAuditTrailPort` | `audit/legal-audit-trail-port.ts` | Append-only audit LC-9 |

**No existen** `*RepositoryPort` ni adapters Supabase en el repo.

### 3.5 Application services (coordinadores actuales)

| Servicio | Archivo | Responsabilidad |
|----------|---------|-----------------|
| `InMemoryLegalDocumentInstanceService` | `in-memory-legal-document-instance-service.ts` | LC-6 lifecycle + audit opcional |
| `InMemoryLegalW9WorkflowService` | `in-memory-legal-w9-workflow-service.ts` | LC-7/8 orquestación + rollback |
| `InMemoryLegalDocumentStorage` | `in-memory-legal-document-storage.ts` | LC-8 persistencia submissions |
| `InMemoryLegalAuditTrail` | `in-memory-legal-audit-trail.ts` | LC-9 append-only store |
| `InMemoryLegalService` | `in-memory-legal-service.ts` | DC-2 fixtures read-only |

### 3.6 Lab singletons (deuda de cutover)

- `getSharedLegalW9WorkflowService()` — `workflows/legal-w9-workflow-lab-store.ts`
- `getSharedLegalAuditTrail()` — `audit/legal-audit-lab-store.ts`
- `createInMemoryLegalService()` — nuevo store por llamada (provider factory)

---

## 4. Entidades — clasificación

| Entidad runtime | Tipo | Fuente | Clasificación |
|-----------------|------|--------|---------------|
| `LegalTemplate` (LDC-003) | Contract | `contracts/legal-entities.ts` | **Catalog root (futuro)** — no instanciado en LC-6+ |
| `TemplateVersion` (LDC-004) | Contract | contracts | **Child of template aggregate** |
| `LegalTemplateAssetCatalogEntry` | Static metadata | `assets/legal-template-asset-catalog.ts` | **Metadata-only** — binario en `./templates/` |
| `LegalDocumentInstance` | Domain | `domain/legal-document-instance-types.ts` | **Aggregate root (mutable)** |
| `LegalDocumentInstanceRecipient` | Value object | embedded in instance | **Child VO** |
| `LegalDocumentInstanceOwner` | Value object | embedded | **Child VO** |
| `LegalW9Request` | Workflow | `workflows/legal-w9-request-types.ts` | **Aggregate root (mutable)** |
| `LegalDocumentSubmission` | Submission | `submissions/legal-document-submission-types.ts` | **Aggregate root (mutable)** |
| `StoredDocumentAsset` | Metadata | embedded in submission | **Metadata-only** (binary external) |
| `LegalAuditEvent` | Audit | `audit/legal-audit-event-types.ts` | **Append-only immutable record** |
| `LegalDocument` (LDC-002) | Contract | contracts | **Legacy / parallel model** — ver §18 |
| `AuditEvent` (LDC-013) | Contract | contracts | **Legacy audit** — distinto de `LegalAuditEvent` LC-9 |
| `LegalWorkflowActor` | Actor VO | `workflows/legal-w9-workflow-actor.ts` | **Projection / session context** — no persistir como entidad |
| `LegalAuditActor` | Actor VO | audit | **Audit projection** — persistir como columnas, no PII |

### 4.1 IDs tipados actuales

| Prefijo | Patrón | Generador | Ejemplo |
|---------|--------|-----------|---------|
| Template | `SPC-###` | Catálogo estático | `SPC-001` |
| Template version | `TV-{template}-{n}` | Catálogo estático | `TV-SPC-001-1` |
| Instance | `LDI-######` | `formatLegalDocumentInstanceId(sequence)` | `LDI-000001` |
| W-9 request | `W9R-######` | `formatLegalW9RequestId(sequence)` | `W9R-000001` |
| Submission | `LDS-######` | `formatLegalDocumentSubmissionId(sequence)` | `LDS-000001` |
| Audit event | `LAE-######` | `formatLegalAuditEventId(sequence)` | `LAE-000001` |
| Correlation | `LAC-######` | `formatLegalAuditCorrelationId(sequence)` | `LAC-000001` |

Secuencias: in-memory counters por servicio/store; **no hay optimistic lock** salvo `instanceVersion` en instancia.

### 4.2 Estados terminales

| Entidad | Terminales |
|---------|------------|
| `LegalDocumentInstance` | `signed`, `rejected`, `expired`, `cancelled` |
| `LegalW9Request` | `expired`, `cancelled`, `accepted`, `rejected` |
| `LegalDocumentSubmission` | `accepted`, `rejected`, `deleted` |

### 4.3 Soft delete / replacement (LC-8 actual)

- `deleteSubmission()` → status `deleted` (no purge físico in-memory)
- `replaceSubmission()` → nuevo LDS + metadata `replacesSubmissionId` / `replacedBySubmissionId` + superseded marcado `deleted`
- `listSubmissions()` filtra activos; `listSubmissionsIncludingDeleted()` incluye histórico
- Audit hook `submission_replaced` **tipado pero no conectado** (deuda LC-9)

---

## 5. Aggregate boundaries (propuesta)

El código actual ya separa responsabilidades en servicios distintos. La propuesta de persistencia **confirma** cinco límites con ajustes:

### A. Template Aggregate — **RECOMENDADA**

**Root:** `LegalTemplate` (futuro DB) + versiones + assets metadata

**Incluye:** `LegalTemplate`, `TemplateVersion`, `LegalTemplateAssetCatalogEntry` (o fila equivalente)

**Atómico:** publicar versión + registrar asset metadata

**Nota:** Hoy el catálogo es **estático TypeScript** (`LEGAL_TEMPLATE_ASSET_CATALOG`). Persistencia futura migra catálogo a DB read-mostly; binarios siguen en object storage / static hosting.

### B. Document Instance Aggregate — **RECOMENDADA**

**Root:** `LegalDocumentInstance`

**Incluye:** recipient, owner, signatureRequirement, metadata, timestamps, `instanceVersion`

**Atómico:** create, transitionStatus, cancel, expire

**Relación:** FK opcional a template/version; **no embeber** submission rows

### C. W-9 Workflow Aggregate — **RECOMENDADA**

**Root:** `LegalW9Request`

**Incluye:** recipient snapshot, requestedBy, status, reviewStatus, dueAt, submissionId pointer

**Atómico:** transiciones workflow; **no** incluir bytes de submission

**Constraint crítico:** unique partial index `(recipient_type, recipient_id, template_id) WHERE status IN active` — refleja `w9_active_request_exists` in-memory

**Relación obligatoria:** `document_instance_id` FK → instances (1:1 en flujo W-9 actual)

### D. Submission Aggregate — **RECOMENDADA (separado de W-9)**

**Root:** `LegalDocumentSubmission`

**Incluye:** `StoredDocumentAsset` metadata, submittedBy, replacement chain, status

**Atómico:** create/upload metadata, transition, soft delete, replace

**Relaciones:** FK `document_instance_id`, optional `workflow_id`; replacement self-FK

**Razón:** LC-8 storage port ya es independiente; replace/delete no deben acoplarse al row W-9 más allá del pointer `submission_id`.

### E. Audit Stream — **RECOMENDADA (append-only separado)**

**Root:** ninguno mutable — **event log**

**Incluye:** `LegalAuditEvent` inmutable

**Atómico:** solo INSERT

**Relación:** referencias lógicas por `entity_type` + `entity_id` + `correlation_id` — **sin FK estricto** a aggregates mutables (evita cascade delete sobre audit)

### Boundaries rechazados

| Propuesta | Decisión | Motivo |
|-----------|----------|--------|
| Single mega-aggregate W-9+Instance+Submission | **RECHAZADA** | Rompe LC-8 port; replace/delete independientes |
| Audit embebido en submission row | **RECHAZADA** | Viola append-only LC-9 |
| Template binario en Postgres | **RECHAZADA** | LC-5 separa metadata/binario |

### Consistencia eventual vs fuerte

| Relación | Consistencia |
|----------|--------------|
| W-9 create + Instance create + audit | **Fuerte** (una transacción) |
| Submit + submission + W-9 + instance + audit | **Fuerte** |
| Accept/reject coordinado | **Fuerte** |
| Audit append tras mutación | **Fuerte** en misma TX o outbox; hoy rollback in-memory |
| Template catalog vs instance | **Eventual** (template inmutable post-publish) |
| Physical object en bucket vs DB metadata | **Eventual** con checksum verification gate |

---

## 6. Repository ports propuestos (interfaces futuras)

Separación estricta: **repository = persistencia** · **application service = reglas + transacciones** · **authorization = fuera del adapter**.

### 6.1 `LegalTemplateRepositoryPort`

```typescript
// Propuesta — NO implementar en LC-10
getTemplateById(templateId: string): Promise<LegalTemplate | null>
getTemplateVersion(templateId: string, versionId: string): Promise<TemplateVersion | null>
listTemplates(filter?: { category?: string; status?: string }): Promise<readonly LegalTemplate[]>
listTemplateVersions(templateId: string): Promise<readonly TemplateVersion[]>
listTemplateAssets(templateId: string, versionId?: string): Promise<readonly LegalTemplateAssetCatalogEntry[]>
getTemplateAssetMetadata(assetKey: string): Promise<LegalTemplateAssetCatalogEntry | null>
```

Read-heavy; writes reservados a staff admin futuro.

### 6.2 `LegalDocumentInstanceRepositoryPort`

```typescript
create(input: CreateLegalDocumentInstanceInput): Promise<LegalDocumentInstanceResult<LegalDocumentInstance>>
getById(id: string): Promise<LegalDocumentInstanceResult<LegalDocumentInstance>>
list(filter?: ListLegalDocumentInstancesFilter): Promise<readonly LegalDocumentInstance[]>
listByRecipient(type: string, recipientId: string): Promise<readonly LegalDocumentInstance[]>
listByTemplate(templateId: string): Promise<readonly LegalDocumentInstance[]>
transitionStatus(id: string, nextStatus: LegalDocumentInstanceStatus, expectedVersion: number): Promise<LegalDocumentInstanceResult<LegalDocumentInstance>>
cancel(id: string, expectedVersion: number): Promise<LegalDocumentInstanceResult<LegalDocumentInstance>>
expire(id: string, expectedVersion: number): Promise<LegalDocumentInstanceResult<LegalDocumentInstance>>
saveWithExpectedVersion(instance: LegalDocumentInstance, expectedVersion: number): Promise<LegalDocumentInstanceResult<LegalDocumentInstance>>
```

Mapea 1:1 a `InMemoryLegalDocumentInstanceService` menos audit (audit vía port separado).

### 6.3 `LegalW9RequestRepositoryPort`

```typescript
create(input: RequestW9Input, documentInstanceId: string): Promise<LegalW9WorkflowResult<LegalW9Request>>
getById(id: string): Promise<LegalW9WorkflowResult<LegalW9Request>>
list(filter?: ListW9RequestsFilter): Promise<readonly LegalW9Request[]>
listByRecipient(recipientType: string, recipientId: string): Promise<readonly LegalW9Request[]>
listByStatus(status: LegalW9RequestStatus): Promise<readonly LegalW9Request[]>
findActiveByRecipientAndTemplate(recipientType: string, recipientId: string, templateId: string): Promise<LegalW9Request | null>
saveWithExpectedVersion(request: LegalW9Request, expectedVersion: number): Promise<LegalW9WorkflowResult<LegalW9Request>>
```

`expectedVersion` derivado de `updatedAt` hash o columna `row_version`.

### 6.4 `LegalDocumentSubmissionRepositoryPort`

```typescript
create(input: StoreLegalDocumentSubmissionInput): Promise<LegalDocumentSubmissionResult<LegalDocumentSubmission>>
getById(id: string): Promise<LegalDocumentSubmissionResult<LegalDocumentSubmission>>
listByInstance(documentInstanceId: string): Promise<readonly LegalDocumentSubmission[]>
listByWorkflow(workflowId: string): Promise<readonly LegalDocumentSubmission[]>
listActive(): Promise<readonly LegalDocumentSubmission[]>
listIncludingDeleted(filter?: { instanceId?: string; workflowId?: string }): Promise<readonly LegalDocumentSubmission[]>
replace(id: string, input: ReplaceLegalDocumentSubmissionInput): Promise<LegalDocumentSubmissionResult<LegalDocumentSubmission>>
softDelete(id: string, deletedByActorId: string, reasonCode?: string): Promise<LegalDocumentSubmissionResult<LegalDocumentSubmission>>
transitionStatus(id: string, nextStatus: LegalDocumentSubmissionStatus, expectedVersion: number): Promise<LegalDocumentSubmissionResult<LegalDocumentSubmission>>
saveWithExpectedVersion(submission: LegalDocumentSubmission, expectedVersion: number): Promise<LegalDocumentSubmissionResult<LegalDocumentSubmission>>
```

Alineado a `LegalDocumentStoragePort` actual + campos soft-delete futuros.

### 6.5 `LegalAuditRepositoryPort`

Equivalente a `LegalAuditTrailPort` LC-9:

```typescript
append(input: AppendLegalAuditEventInput): Promise<LegalAuditResult<LegalAuditEvent>>
getById(id: string): Promise<LegalAuditResult<LegalAuditEvent>>
list(filter?: ListLegalAuditEventsFilter): Promise<readonly LegalAuditEvent[]>
listByEntity(entityType, entityId): Promise<readonly LegalAuditEvent[]>
listByActor(actorId: string): Promise<readonly LegalAuditEvent[]>
listByAction(action: LegalAuditAction): Promise<readonly LegalAuditEvent[]>
listByCorrelationId(correlationId: string): Promise<readonly LegalAuditEvent[]>
listByTimeRange(from: string, to: string): Promise<readonly LegalAuditEvent[]>
```

**Sin update/delete** en interfaz.

### 6.6 `LegalAssetStoragePort` (object storage, no SQL)

```typescript
put(objectKey: string, body: Uint8Array, contentType: string, checksum: string): Promise<Result<StoredObjectMetadata>>
getMetadata(objectKey: string): Promise<StoredObjectMetadata | null>
createSignedReadUrl(objectKey: string, ttlSeconds: number): Promise<Result<string>>
createSignedUploadUrl(objectKey: string, ttlSeconds: number, maxBytes: number): Promise<Result<string>>
deletePhysicalObject(objectKey: string): Promise<Result<true>>  // admin/system only
exists(objectKey: string): Promise<boolean>
```

Separado de `LegalDocumentSubmissionRepositoryPort`.

### 6.7 Capas — separación

| Capa | Responsabilidad |
|------|-----------------|
| Domain | Transitions puras, validación, immutability |
| Application | `LegalW9WorkflowService`, coordinación TX, audit recorder |
| Repository port | CRUD/queries sin permisos portal |
| Adapter | Supabase/postgrest, S3-compatible storage |
| Authorization | `is_staff`, `canActorViewSubmission`, RLS policies |
| UI mapper | Shell view models — nunca SQL |

---

## 7. Modelo relacional propuesto (sin SQL)

### 7.1 Tablas candidatas

| Tabla | Decisión |
|-------|----------|
| `legal_templates` | **Separada** — catálogo administrable |
| `legal_template_versions` | **Separada** — semver + content_hash |
| `legal_template_assets` | **Separada** — metadata + object_key |
| `legal_document_instances` | **Separada** — aggregate LC-6 |
| `legal_w9_requests` | **Separada** — aggregate LC-7 |
| `legal_document_submissions` | **Separada** — aggregate LC-8 |
| `legal_document_submission_assets` | **ALTERNATIVA** — fusionar en submissions si metadata ≤ 1:1 |
| `legal_audit_events` | **Separada** — append-only |

**Recomendación:** **no** crear `legal_document_submission_assets` separada en v1 — campos asset en `legal_document_submissions` (como `StoredDocumentAsset` embebido hoy). Tabla separada solo si multi-file submissions en futuro.

### 7.2 Esquema lógico por tabla

#### `legal_templates`

| Columna | Tipo lógico | Notas |
|---------|-------------|-------|
| `id` | UUID PK | interno |
| `business_id` | TEXT UNIQUE | `SPC-001` |
| `template_code` | TEXT | índice |
| `category` | TEXT | enum check |
| `official_name` | TEXT | |
| `status` | TEXT | draft/published/retired |
| `signature_plan_default` | JSONB | schema acotado |
| `field_schema_default` | JSONB | schema acotado |
| `is_policy` | BOOLEAN | |
| `requires_countersign` | BOOLEAN | |
| `counsel_review_required` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

JSONB **prohibido** para binarios, PII fiscal, field values firmados.

#### `legal_template_versions`

| Columna | Notas |
|---------|-------|
| `id` UUID PK | |
| `business_id` TEXT UNIQUE | `TV-SPC-001-1` |
| `template_id` UUID FK | |
| `semver` | TEXT |
| `content_hash` | TEXT |
| `published_at` | TIMESTAMPTZ |
| `published_by_staff_id` | UUID/TEXT |
| `effective_from` | TIMESTAMPTZ |
| `retired_at` | NULLable |
| `locale_bodies` | JSONB | solo referencias/texto counsel |

#### `legal_template_assets`

| Columna | Notas |
|---------|-------|
| `id` UUID PK | |
| `template_version_id` UUID FK | |
| `asset_key` | TEXT UNIQUE |
| `filename` | TEXT |
| `mime_type` | TEXT |
| `kind` | TEXT |
| `availability` | ready/planned |
| `object_key` | TEXT | bucket path |
| `allowed_portals` | TEXT[] | |
| `is_public_library` | BOOLEAN | |

#### `legal_document_instances`

| Columna | Notas |
|---------|-------|
| `id` UUID PK | |
| `business_id` TEXT UNIQUE | `LDI-######` |
| `template_id` | TEXT/FK lógico | |
| `template_version_id` | TEXT/FK lógico | |
| `category` | TEXT | |
| `title` | TEXT | |
| `recipient_type` | TEXT | |
| `recipient_id` | TEXT | índice compuesto |
| `recipient_display_name` | TEXT | |
| `recipient_email` | TEXT NULL | encriptar/mask futuro |
| `owner_type` | TEXT | |
| `owner_id` | TEXT | |
| `issued_by` | TEXT NULL | |
| `assigned_by` | TEXT NULL | |
| `status` | TEXT | check enum LC-6 |
| `instance_version` | INT | optimistic lock |
| `source` | TEXT | |
| `signature_requirement` | JSONB pequeño | |
| `metadata` | JSONB | sin PII fiscal |
| `expires_at` … `expired_at` | TIMESTAMPTZ NULL | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Índices: `(recipient_type, recipient_id)`, `(template_id)`, `(status)`, `(updated_at)`.

#### `legal_w9_requests`

| Columna | Notas |
|---------|-------|
| `id` UUID PK | |
| `business_id` TEXT UNIQUE | `W9R-######` |
| `document_instance_id` UUID FK UNIQUE | 1:1 W-9 flow |
| `template_id` | TEXT | |
| `template_version_id` | TEXT | |
| `recipient_*` | snapshot columns | denormalizado |
| `requested_by_actor_id` | TEXT | |
| `requested_by_display_name` | TEXT | |
| `requested_by_role` | owner/manager | |
| `status` | TEXT | |
| `review_status` | TEXT | |
| `submission_id` | UUID FK NULL | pointer |
| `requested_at` / `updated_at` | TIMESTAMPTZ | |
| `due_at` … `completed_at` | TIMESTAMPTZ NULL | |
| `metadata` | JSONB | |
| `row_version` | INT | optimistic |

**Unique partial:** `UNIQUE (recipient_type, recipient_id, template_id) WHERE status IN ('requested','available','viewed','awaiting_upload')`

#### `legal_document_submissions`

| Columna | Notas |
|---------|-------|
| `id` UUID PK | |
| `business_id` TEXT UNIQUE | `LDS-######` |
| `document_instance_id` UUID FK | |
| `workflow_id` UUID FK NULL | |
| `template_id` / `template_version_id` | TEXT | |
| `storage_key` | TEXT | bucket key — **no exponer a client** |
| `filename` | TEXT | mask en UI |
| `mime_type` | TEXT | |
| `size_bytes` | BIGINT | |
| `checksum` | TEXT | sha256 — staff-only |
| `content_reference` | TEXT NULL | legacy lab |
| `submitted_by_*` | columns | actor snapshot |
| `status` | TEXT | |
| `metadata` | JSONB | |
| `replaces_submission_id` | UUID FK NULL | |
| `replaced_by_submission_id` | UUID FK NULL | |
| `deleted_at` | TIMESTAMPTZ NULL | soft delete |
| `deleted_by_actor_id` | TEXT NULL | |
| `delete_reason_code` | TEXT NULL | |
| `submitted_at` / `updated_at` | TIMESTAMPTZ | |
| `row_version` | INT | |

#### `legal_audit_events`

| Columna | Notas |
|---------|-------|
| `id` UUID PK | interno |
| `business_id` TEXT UNIQUE | `LAE-######` |
| `sequence` | BIGINT UNIQUE | monotónico DB-side |
| `occurred_at` | TIMESTAMPTZ | |
| `actor_type` | TEXT | |
| `actor_id` | TEXT | no email |
| `actor_role` | TEXT | |
| `actor_portal` | TEXT | |
| `actor_display_name` | TEXT NULL | |
| `action` | TEXT | |
| `entity_type` | TEXT | |
| `entity_id` | TEXT | business id |
| `related_entity_ids` | JSONB | ids tipados only |
| `previous_state` | JSONB NULL | sanitizado |
| `next_state` | JSONB NULL | sanitizado |
| `outcome` | TEXT | |
| `reason_code` | TEXT NULL | |
| `correlation_id` | TEXT NULL | `LAC-######` |
| `request_id` | TEXT NULL | |
| `metadata` | JSONB | sin PII |

Índices: `(entity_type, entity_id)`, `(correlation_id)`, `(actor_id)`, `(action)`, `(occurred_at)`, `(sequence)`.

---

## 8. Estrategia de IDs

### Opciones evaluadas

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| UUID only | Simple PK, no enumeración | Pierde IDs legibles operativos | **ALTERNATIVA** |
| Business IDs only | Legible, alineado lab | Riesgo client-supplied, secuencia global | **RECHAZADA** |
| Dual-ID (UUID PK + business UNIQUE) | Seguro + operable + compatible LC-6→9 | Dos columnas por tabla | **RECOMENDADA** |

### Recomendación

1. **PK interno:** `uuid` generado server-side (`gen_random_uuid()`).
2. **Business ID:** `LDI-######`, `W9R-######`, etc. — UNIQUE, generado por secuencia DB o función dedicada.
3. **Nunca** aceptar business ID del browser como PK.
4. **Correlación:** `LAC-######` — secuencia separada de audit/app layer.
5. **Migración desde lab:** mapping table temporal solo en Phase G dual-run.

---

## 9. Concurrency control

### Mecanismos propuestos

| Mecanismo | Uso |
|-----------|-----|
| `instance_version` / `row_version` | Optimistic concurrency en UPDATE |
| `updated_at` compare | Secundario / diagnóstico |
| Partial unique index | W-9 activo por recipient+template |
| DB sequence | `LAE`, `LDS`, `W9R`, `LDI` business ids |
| `BIGSERIAL sequence` | Audit ordering |

### Conflictos esperados

| Escenario | Código dominio futuro | Mitigación |
|-----------|----------------------|------------|
| Transición concurrente instance | `invalid_status_transition` / `version_conflict` | expectedVersion |
| Duplicate W-9 activo | `duplicate_active_request` | unique index |
| Double submit | `w9_invalid_status_transition` | status gate + row lock |
| Double accept/reject | `w9_request_already_terminal` | terminal check + version |
| Replace simultáneo | `submission_replace_not_allowed` | terminal + version |
| Soft delete simultáneo | `submission_already_terminal` | status check |
| Audit append | N/A (insert-only) | sequence UNIQUE |

---

## 10. Transaction boundaries

Operaciones que **deben** compartir una transacción SQL (o RPC atómico):

| Operación | Mutaciones coordinadas | Audit events |
|-----------|------------------------|--------------|
| `requestW9()` | create instance + create W-9 | `instance_created`, `w9_requested` |
| `submitW9Document()` | create submission + update W-9 + update instance | `w9_submitted`, `submission_uploaded` |
| `markSubmissionUnderReview()` | submission + W-9 metadata | `submission_review_started`, `w9_marked_under_review` |
| `acceptSubmission()` | submission + W-9 + instance | correlated accept events |
| `rejectSubmission()` | submission + W-9 + instance | correlated reject events |
| `replaceSubmission()` | soft-delete old + create new + metadata chain | `submission_replaced` (futuro) |
| `deleteW9Submission()` | soft-delete submission | `submission_deleted` |

### Patrón recomendado

```
Browser → Application Service (TS)
       → Supabase RPC (SECURITY DEFINER, auth.uid() validated)
       → BEGIN … mutations … audit append … COMMIT
       → return canonical snapshot DTO
```

| Enfoque | Decisión |
|---------|----------|
| Browser direct INSERT a tablas sensibles | **RECHAZADO** |
| PostgREST direct write sin RPC | **RECHAZADO** para W-9/submissions |
| Edge Function orchestrator | **ALTERNATIVA** para upload/sign URL |
| Postgres RPC transaccional | **RECOMENDADO** para multi-aggregate |

Rollback: si audit append falla dentro TX → ROLLBACK completo (paridad LC-9 in-memory).

---

## 11. Audit append-only persistence

### Garantías requeridas

- INSERT only — no UPDATE/DELETE grants en `legal_audit_events`
- `sequence BIGINT` monotónico — `GENERATED ALWAYS AS IDENTITY` o tabla sequence dedicada
- `business_id LAE-######` — UNIQUE
- Payload inmutable — JSONB con check de tamaño máximo
- Sin PII — reutilizar `sanitizeAuditState` server-side antes de INSERT

### Impedir tampering

| Capa | Medida |
|------|--------|
| RLS | INSERT solo vía `service_role` o RPC |
| GRANT | REVOKE UPDATE/DELETE en tabla audit |
| Trigger opcional | `BEFORE UPDATE OR DELETE RAISE EXCEPTION` |
| App | No exponer audit port write al browser |

### Separación de `AuditEvent` (LDC-013) vs `LegalAuditEvent` (LC-9)

- **LDC-013:** modelo broad signatures/compliance — futuro unificación o bridge view
- **LC-9:** Legal Center operational audit — **tabla dedicada** en v1 persistencia
- **Recomendación:** no merge en Phase A; ticket futuro `LC-11-AUDIT-UNIFICATION` si PO lo autoriza

---

## 12. Storage strategy (metadata vs binary)

### Base de datos almacena

- Submission metadata, checksum, MIME, size, storage_key, status, replacement FKs
- Template asset metadata + object_key
- **Nunca** PDF bytes

### Object storage almacena

- W-9 PDFs uploaded
- Template PDFs (catálogo LC-5)
- Future signed artifacts

### Propuesta bucket

| Item | Valor |
|------|-------|
| Bucket | `mdj-legal-private` (nombre tentativo) |
| Key pattern | `legal/submissions/{instance_business_id}/{lds_business_id}.pdf` |
| Template keys | `legal/templates/{asset_key}/{filename}` |
| Access | signed URL TTL corto (60–300s read) |
| Upload | signed PUT + `content-type: application/pdf` + max 20MB (LC-8 constant) |
| Verification | checksum sha256 post-upload antes de `uploaded` status |
| Future hooks | malware scan, retention job — **out of scope** |

---

## 13. RLS strategy (futura)

Basada en `public.is_staff(auth.uid())`, `is_staff_management`, y filas `dj_profiles` / `client_profiles` (Constitución V1).

| Rol | Instances | W-9 | Submissions | Audit | Templates |
|-----|-----------|-----|-------------|-------|-----------|
| Owner | RW | RW | RW + delete | R full | R |
| Manager | RW review | RW review | RW review | R ops | R |
| Seller | **deny fiscal** | deny | deny | deny | R público |
| Artist | R own recipient | R own | R/create own | R own projection | R allowed |
| Client | R own contracts futuro | **deny** | deny | deny | R library |
| External | deny session | deny | secure link futuro | deny | deny |
| System/Edge | service role | RPC only | RPC only | insert RPC | R |

### Operaciones prohibidas desde browser directo

- INSERT/UPDATE submissions
- INSERT audit
- DELETE físico
- UPDATE terminal rows
- Generación business IDs

---

## 14. Soft delete y retention

Propuesta alineada a LC-8:

| Campo | Propósito |
|-------|-----------|
| `deleted_at` | soft delete timestamp |
| `deleted_by_actor_id` | staff owner |
| `delete_reason_code` | opcional |
| `replaced_by_submission_id` | chain |
| `replaces_submission_id` | chain |

Políticas:

- List activo: `deleted_at IS NULL AND status != 'deleted'`
- Histórico: staff owner/manager only
- Hard delete: **RECHAZADO** por defecto
- Physical object cleanup: job diferido post-soft-delete — ticket futuro
- GDPR/CCPA purge: **out of scope** — no afirmar compliance

---

## 15. Migration plan (fases futuras — no ejecutar)

| Phase | Entregable | Gate |
|-------|------------|------|
| **A** | Schemas, tables, indexes, constraints, ID generators | PO + Architect SQL review |
| **B** | Read-only repository adapters + parity read tests | 958+ tests green |
| **C** | Write adapters (single-table) | contract tests |
| **D** | Transactional RPCs (multi-aggregate) | rollback tests |
| **E** | RLS policies + isolation tests | security review |
| **F** | Asset storage bucket + signed URLs | upload E2E |
| **G** | Dual-run in-memory vs Supabase parity | LC-6→9 regression |
| **H** | Cutover + disable lab singletons | PO sign-off |

---

## 16. Test strategy (futura)

| Tipo | Objetivo |
|------|----------|
| Contract tests | Cada `*RepositoryPort` |
| Parity tests | in-memory vs Supabase same inputs → same outcomes |
| Optimistic concurrency | version conflict paths |
| RLS tests | por rol — artist A ≠ artist B |
| Transaction rollback | audit fail → no partial mutation |
| Partial failure | storage ok / DB fail |
| Audit append-only | reject UPDATE/DELETE |
| Secure link isolation | external recipient |
| Metadata/binary separation | no bytes in DB |
| Migration tests | business ID sequences |

Hoy: **958 tests** cubren in-memory; parity suite es ticket post-Phase B.

---

## 17. Legacy debt

### `LegalDocument` (LDC-002) vs `LegalDocumentInstance` (LC-6)

| Aspecto | LegalDocument | LegalDocumentInstance |
|---------|---------------|----------------------|
| Origen | DC-1 contracts | LC-6 domain |
| Uso runtime LC-4→9 | Proyecciones/fixtures DC-2 | **Operacional W-9** |
| Campos | packageId, signerProfileIds, fieldValues | recipient, owner, instanceVersion |
| Persistencia futura | Signature package era | **Legal Center W-9 path** |

**Recomendación (ticket futuro LC-11 o LC-12):**

1. Tratar `LegalDocument` como **proyección legacy** del expediente DC-1.
2. **No** mapear 1:1 a `legal_document_instances` sin análisis signature flows.
3. W-9 path persiste solo `LegalDocumentInstance` + `LegalW9Request` + `LegalDocumentSubmission`.
4. Bridge view `legal_expediente_documents_v` puede unificar lectura UI a largo plazo.

### Otras deudas

| Item | Estado | Acción futura |
|------|--------|---------------|
| Singleton lab stores | Activo | Reemplazar por injected provider en cutover |
| Demo fixtures `LEGAL_FIXTURE_PROFILE_IDS` | Activo | Seed scripts Phase G |
| In-memory sequences | No global | DB sequences Phase A |
| Unconnected audit hooks | `submission_replaced`, `template_asset_*` | LC-11 wiring o Phase C |
| Static template catalog TS | Activo | Migrate Phase A + seed |
| `LegalProviderMode SUPABASE` | Declarado unimplemented | Phase B factory |
| `contentReference: in-memory://` | Lab only | Replace with storage_key |
| Dual audit models LDC-013 / LC-9 | Coexist | Document bridge — no merge now |

---

## 18. Security review

| Riesgo | Impacto | Mitigación futura |
|--------|---------|-------------------|
| W-9 exposure | Fiscal PII | RLS + signed URLs + no client SELECT wide |
| Query leakage | Cross-tenant | RLS recipient match + tests |
| Signed URL duration | URL replay | TTL ≤ 300s, one-time optional |
| Service role misuse | Full bypass | Edge/RPC only, no browser key |
| Client-generated IDs | Collision / hijack | Server-only business IDs |
| Double submit | Duplicate files | status + unique active submission |
| Unauthorized review | Wrong acceptance | `canActorReviewSubmissions` in RPC |
| Audit tampering | Forensics loss | append-only DB + revoke |
| Metadata leakage | filename/checksum in UI | public mappers + column grants |
| Cross-tenant access | Artist A → B | RLS + tests exist LC-8/9 |
| External recipient | Session bypass | secure link token — future |

**No afirmar** SOC 2, HIPAA, GDPR, CCPA, IRS compliance.

---

## 19. Decisiones requeridas

| # | Decisión | Estado |
|---|----------|--------|
| 1 | Dual-ID: UUID PK + business UNIQUE | **RECOMENDADA** |
| 2 | Repository per aggregate | **RECOMENDADA** |
| 3 | Transaction via Supabase RPC | **RECOMENDADA** |
| 4 | Audit append-only insert-only | **RECOMENDADA** |
| 5 | Metadata DB + binary bucket | **RECOMENDADA** |
| 6 | No browser direct write sensibles | **RECOMENDADA** |
| 7 | RLS owner/manager/artist isolation | **RECOMENDADA** |
| 8 | Soft delete submissions | **RECOMENDADA** |
| 9 | Optimistic versioning | **RECOMENDADA** |
| 10 | Staged cutover Phase A→H | **RECOMENDADA** |
| — | UUID-only IDs | **ALTERNATIVA** |
| — | Business-ID-only | **RECHAZADA** |
| — | Mega-aggregate single table | **RECHAZADA** |
| — | PDF in Postgres BYTEA | **RECHAZADA** |
| — | Browser PostgREST write | **RECHAZADA** |

---

## 20. Riesgos del discovery

1. **Dual model LegalDocument vs LegalDocumentInstance** — riesgo de schema drift si se unifican prematuramente.
2. **Singleton lab stores** — dificulta parity tests hasta Phase G.
3. **Static catalog** — migración a DB requiere seed + URL resolver refactor.
4. **Audit dual LDC-013 / LC-9** — consultas UI pueden confundir timelines.
5. **RLS + RPC complexity** — underestimating Phase D/E effort.
6. **Replacement chain** — FK cycles require careful migration order.

---

## 21. Fuera de alcance (confirmado LC-10)

- Implementación runtime · tablas · migrations · Supabase connect
- UI changes · bucket creation · signed URLs · upload
- LC-11 implementation · hooks `submission_replaced` / `template_asset_*`
- GDPR purge · compliance certification · production deploy

---

## 22. Adapter factory (propuesta futura — no implementar)

```typescript
createLegalPersistenceProvider({
  mode: 'memory' | 'supabase',
  apiClient,
  sessionReader,
  clock,
  logger,
}): {
  templates: LegalTemplateRepositoryPort;
  instances: LegalDocumentInstanceRepositoryPort;
  w9Requests: LegalW9RequestRepositoryPort;
  submissions: LegalDocumentSubmissionRepositoryPort;
  audit: LegalAuditRepositoryPort;
  assets: LegalAssetStoragePort;
}
```

Preserva:

- `IN_MEMORY` para tests (958+ suite)
- `SUPABASE` futuro sin imports en UI
- Portal injection via `resolveLegalProvider` extension — **modo `SUPABASE` ya declarado unimplemented** en `legal-provider-mode.ts`

---

## 23. Recommended next ticket

**LC-11 — Persistence Schema & Read-Only Adapters (Phase A + B)**

Entregables sugeridos:

1. SQL migrations (tables + indexes + sequences) — **sin RLS inicial**
2. `SupabaseLegalDocumentInstanceRepository` read-only
3. Parity tests read path vs in-memory
4. ID generator functions (`next_ldi_id`, etc.)
5. Document seed strategy for template catalog

Prerrequisito: ~~aprobación PO de este discovery~~ **cumplido — 2026-07-21**.

Alternativa paralela documental: **LC-11-A — Connect unconnected audit hooks** (runtime menor, no persistencia).

---

## 25. Aprobación Product Owner (2026-07-21)

El Product Owner aprueba el discovery LC-10 y las decisiones arquitectónicas siguientes:

| # | Decisión | Estado PO |
|---|----------|-----------|
| 1 | Aggregates separados: Template · Document Instance · W-9 Workflow · Submission · Audit stream | ✅ Aprobado |
| 2 | Repository ports por aggregate | ✅ Aprobado |
| 3 | Dual-ID: UUID interno PK + business ID tipado UNIQUE | ✅ Aprobado |
| 4 | Optimistic concurrency mediante versionado | ✅ Aprobado |
| 5 | Operaciones multi-aggregate mediante RPC transaccional futuro | ✅ Aprobado |
| 6 | Audit trail append-only · insert-only · sin UPDATE/DELETE | ✅ Aprobado |
| 7 | Storage: metadata en DB · PDF binario en bucket privado | ✅ Aprobado |
| 8 | Soft delete para submissions | ✅ Aprobado |
| 9 | RLS: Owner total · Manager operativo no destructivo · Artist recursos propios · Seller/Client sin acceso fiscal | ✅ Aprobado |
| 10 | Migración por fases con contract tests y parity tests | ✅ Aprobado |

Confirmaciones adicionales:

- Baseline runtime: `519f9ae082c57b9be221e9909c5d1443918399a5`
- Cero cambios runtime en LC-10
- 958 tests PASS · typecheck PASS · HTTP 200 × 5
- Sin persistencia real · sin Supabase activo
- LC-11 **no iniciado** — pendiente ticket explícito
- Próximo ticket recomendado: **LC-11 — Persistence Schema & Read-Only Adapters**

**Estado final:** LC-10 CERRADO — DISCOVERY APROBADO POR EL PRODUCT OWNER

---

## 24. Validación post-documentación

| Check | Resultado esperado |
|-------|-------------------|
| Archivos tocados | Solo docs LC-10 (+ registro README/NOTA opcional) |
| Runtime | Sin cambios |
| typecheck | exit 0 |
| Suite | 958 PASS |
| HTTP × 5 | 200 OK |

---

*LC-10 CERRADO — DISCOVERY APROBADO POR EL PRODUCT OWNER — 2026-07-21*
