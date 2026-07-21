# TICKET-V2-LEGAL-CENTER-LC-11-PERSISTENCE-SCHEMA-READ-ONLY-ADAPTERS-001

## Estado

**LC-11 CERRADO — APROBADO TÉCNICAMENTE POR EL PRODUCT OWNER**

Commit local: `feat(v2-legal): add read-only persistence adapters` · sin push · sin merge · sin PR · sin deploy · **LC-12 no iniciado**.

| Campo | Valor |
|-------|-------|
| Ticket | LC-11 — Persistence Schema & Read-Only Adapters |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `e4651902db1d10a4bcb92bbf1961cc59495bd701` |
| Commit baseline | `e465190 docs(v2-legal): approve persistence adapter discovery` |
| Commit cierre LC-11 | `feat(v2-legal): add read-only persistence adapters` |
| Tests baseline | 958 PASS |
| Tests finales | **999 PASS** (+41 LC-11) |
| typecheck | exit 0 |
| HTTP QA | 5/5 HTTP 200 |
| Fecha implementación | 2026-07-21 |
| Fecha aprobación técnica PO | 2026-07-21 |

---

## 1. Objetivo

Primera capa persistible del Legal Center V2 **read-only**:

- contratos de schema tipados (filas futuras);
- repository ports de lectura;
- adapters memory y Supabase-compatible (simulado);
- mappers row → dominio;
- validación runtime de filas;
- factory controlada;
- contract tests y parity tests.

**No** implementa escrituras, SQL, migraciones, RLS activa, Supabase real, buckets ni cambios UI.

---

## 2. Baseline de arranque

| Check | Resultado |
|-------|-----------|
| Rama | `plan/v2-phase-4-api-client` ✓ |
| HEAD | `e465190` ✓ |
| Working tree inicial | limpio ✓ |
| `npm run typecheck` | exit 0 ✓ |
| Suite | 958 PASS ✓ |
| HTTP staff · seller · artist · client · W-9 PDF | 200 OK ✓ |

---

## 3. Schema contracts

Ubicación: `MiamiDJBeat-MigracionV2/shared/services/legal/persistence/schema/legal-persistence-row-types.ts`

| Row type | Business ID | Notas |
|----------|-------------|-------|
| `LegalTemplateRow` | `SPC-…` | snake_case, UUID interno, `row_version` |
| `LegalTemplateVersionRow` | `TV-…` | FK a template UUID + business id |
| `LegalTemplateAssetRow` | — | metadata de asset; sin binario |
| `LegalDocumentInstanceRow` | `LDI-######` | recipient/owner/status |
| `LegalW9RequestRow` | `W9R-######` | FK instance + submission |
| `LegalDocumentSubmissionRow` | `LDS-######` | soft delete vía `status=deleted` |
| `LegalAuditEventRow` | `LAE-######` | `sequence` append-only |

Envelope transport: `LegalPersistenceReadEnvelope<T>` — `{ data, next_cursor, has_more }`.

Dual-ID: UUID interno en filas; dominio expone solo business IDs.

---

## 4. Repository ports (read-only)

Ubicación: `…/persistence/ports/legal-read-repository-ports.ts`

| Port | Métodos |
|------|---------|
| `LegalTemplateReadRepositoryPort` | get/list templates, versions, assets |
| `LegalDocumentInstanceReadRepositoryPort` | get/list/by recipient/template/status |
| `LegalW9RequestReadRepositoryPort` | get/list/findActive |
| `LegalDocumentSubmissionReadRepositoryPort` | get/list/by instance/workflow; `listSubmissionsIncludingDeleted` |
| `LegalAuditReadRepositoryPort` | get/list/by entity/actor/action/correlation/time range |

Sin create/save/update/delete/transition/append.

---

## 5. Query contracts

Ubicación: `…/persistence/legal-persistence-query-types.ts`

Campos tipados: `limit`, `cursor`, `status`, `recipientType`, `recipientId`, `templateId`, `workflowId`, `instanceId`, `correlationId`, `dateFrom`, `dateTo`, `includeDeleted`.

Validación: límite máximo, cursor opaco, rangos ISO, status permitidos. Sin SQL libre ni `orderBy` arbitrario.

---

## 6. Pagination

Ubicación: `…/persistence/legal-persistence-page.ts`

`LegalReadPage<T>`: `{ items, nextCursor, hasMore }`.

Cursor opaco JSON+base64url con offset determinístico (memory/simulated).

---

## 7. Row validation

Ubicación: `…/persistence/validation/legal-persistence-row-validation.ts`

Valida UUID, business IDs, timestamps ISO, `row_version`, enums de status, metadata acotada, envelope transport.

Códigos de error: `invalid_persistence_row`, `persistence_entity_not_found`, `persistence_relation_invalid`, `persistence_status_invalid`, `persistence_timestamp_invalid`, `persistence_version_invalid`, `persistence_cursor_invalid`, `persistence_query_invalid`, `persistence_transport_error`, `persistence_access_forbidden`.

---

## 8. Row → domain mappers

Ubicación: `…/persistence/mappers/legal-persistence-mappers.ts`

Funciones: `mapLegalTemplateRowToDomain`, `mapLegalTemplateVersionRowToDomain`, `mapLegalTemplateAssetRowToDomain`, `mapLegalDocumentInstanceRowToDomain`, `mapLegalW9RequestRowToDomain`, `mapLegalDocumentSubmissionRowToDomain`, `mapLegalAuditEventRowToDomain`.

Validan antes de mapear; clonan/freeze metadata; ocultan UUID internos.

---

## 9. Memory read adapters

Ubicación: `…/persistence/memory/memory-legal-read-repositories.ts`

Lee del `LegalReadFixtureStore` ficticio (`…/fixtures/legal-read-fixture-store.ts`). Aplica autorización y paginación sin duplicar servicios LC-6→LC-9.

---

## 10. Supabase simulated read adapters

Ubicación: `…/persistence/supabase/supabase-legal-read-repositories.ts`

- Usa `LegalPersistenceReadTransport` (fixture o ApiClient).
- RPC propuestos: `legal_read_templates`, `legal_read_template_versions`, `legal_read_template_assets`, `legal_read_instances`, `legal_read_w9_requests`, `legal_read_submissions`, `legal_read_audit_events`.
- **No** hay funciones SQL reales ni backend conectado.
- **Transport-only:** todas las lecturas vía RPC envelope; sin `fixtureStore` interno.
- Submission scope via `recipient_type` / `recipient_id` denormalizados en row contract.

Transport: `…/persistence/transport/legal-persistence-read-transport.ts` — `createFixtureLegalPersistenceReadTransport`, `createApiClientLegalPersistenceReadTransport`.

---

## 11. ApiClient dependency

Supabase mode con `apiClient` enruta RPC vía `apiClient.rpc()` y valida envelope. Sin `supabase-js`, sin fetch directo, sin service-role.

---

## 12. Access context

Ubicación: `…/persistence/legal-read-access-context.ts`

`LegalReadAccessContext`: actorType, actorId, role, portal, recipientScope.

| Actor | Regla |
|-------|-------|
| Owner | lectura operativa completa; deleted submissions |
| Manager | operativa; sin deleted submissions |
| Seller | sin W-9 fiscal ni audit |
| Artist | solo recursos propios |
| Client | sin W-9 fiscal ni audit |

Helpers: `createStaffOwnerReadContext`, `createStaffManagerReadContext`, `createStaffSellerReadContext`, `createArtistReadContext`, `createClientReadContext`.

---

## 13. Proyecciones

Los adapters devuelven objetos de dominio congelados. La capa de acceso filtra antes del mapper/listado. Client/Seller no reciben catálogo W-9 ni audit fiscal.

---

## 14. Soft delete

- `listSubmissions()` excluye `status=deleted`.
- `listSubmissionsIncludingDeleted()` solo Owner.
- `getSubmissionById()` devuelve deleted solo a Owner; Manager/Artist reciben not found.

---

## 15. Audit read rules

Orden canónico por `sequence` (+ business_id tie-break). Append-only semantics preservadas. Artist ve eventos propios o ligados a su recipientId. Seller/Client bloqueados.

---

## 16. Factory

Ubicación: `…/persistence/provider/legal-read-persistence-provider.ts`

```typescript
createLegalReadPersistenceProvider({
  mode: 'memory' | 'supabase',
  apiClient?,      // supabase: requerido si no hay transport
  transport?,      // supabase: requerido si no hay apiClient
  fixtureStore?,   // memory only
})
```

Default: `memory`. Supabase requiere `apiClient` o `transport` explícito — **sin fallback silencioso**. **No conectada a producción.**

---

## 17. Contract tests

| Archivo | Cobertura |
|---------|-----------|
| `tests/unit/legal-persistence-schema.test.ts` | validación, mappers, paginación |
| `tests/unit/legal-read-repository-contract.test.ts` | memory + supabase simulated |
| `tests/unit/legal-read-repository-parity.test.ts` | equivalencia memory vs supabase |
| `tests/unit/legal-read-persistence-provider.test.ts` | factory memory/supabase |

Fixtures ficticios: `demo-artist@example.test`, `ART-DEMO-001`, IDs sintéticos. Sin datos fiscales reales.

---

## 18. QA final

| Check | Resultado |
|-------|-----------|
| `npm run typecheck` | exit 0 ✓ |
| LC-11 tests (4 archivos) | 18 PASS ✓ |
| Suite completa | **976 PASS** ✓ |
| `git diff --check` | sin conflict markers ✓ |
| HTTP 5 rutas | 200 OK ✓ |
| Cambios UI | **cero** ✓ |
| LC-5 PDF/assets | intacto ✓ |
| LC-6→LC-9 runtime | sin regresión en suite ✓ |

---

## 19. Archivos

### Creados

```
MiamiDJBeat-MigracionV2/shared/services/legal/persistence/
  legal-persistence-errors.ts
  legal-persistence-page.ts
  legal-persistence-query-types.ts
  legal-read-access-context.ts
  index.ts
  schema/legal-persistence-row-types.ts
  validation/legal-persistence-row-validation.ts
  mappers/legal-persistence-mappers.ts
  ports/legal-read-repository-ports.ts
  fixtures/legal-read-fixture-store.ts
  shared/legal-read-repository-helpers.ts
  memory/memory-legal-read-repositories.ts
  transport/legal-persistence-read-transport.ts
  supabase/supabase-legal-read-repositories.ts
  provider/legal-read-persistence-provider.ts

MiamiDJBeat-MigracionV2/tests/unit/
  legal-persistence-schema.test.ts
  legal-read-repository-contract.test.ts
  legal-read-repository-parity.test.ts
  legal-read-persistence-provider.test.ts
  legal-read-persistence-hardening.test.ts

docs/V2/TICKETS/TICKET-V2-LEGAL-CENTER-LC-11-PERSISTENCE-SCHEMA-READ-ONLY-ADAPTERS-001.md
```

### Modificados

```
MiamiDJBeat-MigracionV2/shared/services/legal/submissions/legal-document-submission-status.ts
  (+ isLegalDocumentSubmissionStatus type guard para validación LC-11)
```

---

## 20. Riesgos y deuda

| Riesgo | Mitigación futura |
|--------|-------------------|
| RPC names son contratos propuestos | LC-12+ crear funciones SQL reales |
| Paginación offset-based en lab | Migrar a cursor compuesto (`occurred_at+id`) en DB |
| Sin proyecciones UI dedicadas LC-11 | LC portal wiring en fase posterior |
| Submission row denormaliza `recipient_*` para scope read | Aceptable en read contract; DB puede join o denormalizar |

---

## 24. Auditoría LC-11 — Technical Audit and Hardening

Fecha auditoría: 2026-07-21 · Ticket: `LC-11-TECHNICAL-AUDIT-AND-HARDENING-001`

### 24.1 Pureza adapter Supabase

**Hallazgo inicial:** `createSupabaseLegalReadRepositories({ transport, store })` consultaba `fixtureStore.instances` para autorizar submissions.

**Corrección aplicada:**

- Eliminado `fixtureStore` del adapter Supabase.
- `LegalDocumentSubmissionRow` ahora incluye `recipient_type`, `recipient_id`, `created_at`, `submitted_at`, `updated_at`.
- Autorización de submissions usa `row.recipient_id` vía transport exclusivamente.
- `createSupabaseSimulatedLegalReadRepositories(transport)` — solo transport.
- Test explícito: provider `mode: "supabase"` + `transport` sin `fixtureStore` → submission OK.

### 24.2 No fallback silencioso

**Corrección aplicada:**

- `mode: "supabase"` requiere `apiClient` **o** `transport` explícito.
- Si falta: `persistence_provider_dependency_missing` (throw tipado).
- Modo inválido: `persistence_mode_invalid`.
- Eliminado fallback automático a `createFixtureLegalPersistenceReadTransport(store)` en provider.

| Modo | ApiClient | Transport | fixtureStore | Resultado |
|------|-----------|-----------|--------------|-----------|
| memory | no | no | opcional | OK — crea store memory |
| supabase | sí | no | ignorado | OK — ApiClient → transport |
| supabase | no | sí | ignorado | OK — transport simulado |
| supabase | no | no | cualquiera | **ERROR tipado** |

### 24.3 Semántica timestamps submission

**Decisión final:**

| Campo row | Campo dominio | Semántica |
|-----------|---------------|-----------|
| `created_at` | `createdAt` | creación del asset/registro |
| `submitted_at` | `submittedAt` | upload/completado por actor |
| `updated_at` | `updatedAt` | última mutación persistida |

Validación: `created_at ≤ submitted_at ≤ updated_at`. Fixture demo usa timestamps distintos (`11:55` vs `12:00`).

### 24.4 Matriz row contracts

| Entidad | UUID | Business ID | row_version | Status | Timestamps | FK |
|---------|------|-------------|-------------|--------|------------|-----|
| LegalTemplateRow | ✓ | SPC-… | ✓ | ✓ | created/updated | current_published_version_id |
| LegalTemplateVersionRow | ✓ | TV-… | ✓ | — | published/effective/retired | template_id + business |
| LegalTemplateAssetRow | ✓ | — (asset_key) | ✓ | availability | — | template_version_id + business |
| LegalDocumentInstanceRow | ✓ | LDI-###### | ✓ | ✓ | lifecycle set | template refs |
| LegalW9RequestRow | ✓ | W9R-###### | ✓ | ✓ + review | requested/updated/due | instance + submission refs |
| LegalDocumentSubmissionRow | ✓ | LDS-###### | ✓ | ✓ | created/submitted/updated/deleted | instance/workflow + recipient scope |
| LegalAuditEventRow | ✓ | LAE-###### | — (append-only) | action/outcome | occurred_at | entity + related_entity_ids |

### 24.5 Ports read-only

Grep audit: coincidencias permitidas (`createStaff*ReadContext`, `created_at`, `listSubmissionsIncludingDeleted`, `updatedAt`, `replaces_submission_id`). **Ningún port expone mutaciones públicas.**

### 24.6 ApiClient.rpc evidencia

- Supabase adapter usa `createApiClientLegalPersistenceReadTransport` → `apiClient.rpc()`.
- Sin `supabase-js`, sin fetch directo, sin service-role.
- Test verifica `transport.calls` con URL conteniendo RPC name.

### 24.7 Matriz autorización — política denied vs empty

| Actor | Denied (`persistence_access_forbidden`) | Not found (`persistence_entity_not_found`) | Empty list |
|-------|----------------------------------------|-------------------------------------------|------------|
| Owner | — | recurso inexistente | raro |
| Manager | deleted submission | cross-scope / missing | filtros sin match |
| Seller | fiscal reads (W-9, audit) | — | — |
| Client | fiscal reads | — | — |
| Artist propio | — | — | filtros sin match |
| Artist ajeno | — | instance/submission/W-9 | — |

**Regla:** Seller/Client → **denied**. Cross-artist / deleted-no-owner → **not found**. `findActiveW9` sin match → **success(null)**.

### 24.8 UUID no expuesto

Tests confirman `JSON.stringify(domain)` y errores `notFound` no contienen UUID fixture (`LC11_FIXTURE_UUIDS`).

### 24.9 Cursor/paginación lab

Offset opaco base64url · límite 1–100 · cursor corrupto/negativo rechazado · páginas estables sin duplicados. Deuda: cursor compuesto en DB.

### 24.10 Matriz contract / parity

| Repository | Contract | Memory | Supabase simulated | Parity |
|------------|----------|--------|-------------------|--------|
| Template | ✓ | ✓ | ✓ | ✓ get + list |
| Document Instance | ✓ | ✓ | ✓ | ✓ get + listByStatus |
| W-9 Request | ✓ | ✓ | ✓ | ✓ get + listByRecipient |
| Submission | ✓ | ✓ | ✓ | ✓ get + listByInstance |
| Audit | ✓ | ✓ | ✓ | ✓ get + list |

Archivos: `legal-read-repository-contract.test.ts`, `legal-read-repository-parity.test.ts`, `legal-read-persistence-hardening.test.ts`.

### 24.11 Inmutabilidad

Metadata clonada/freeze · page items congelados · mutación post-map lanza · row source no alterado.

### 24.12 Type guard LC-8

`isLegalDocumentSubmissionStatus()` reutiliza `LEGAL_DOCUMENT_SUBMISSION_STATUSES` canónico. Sin cambio de transiciones LC-8.

### 24.13 Errores sanitizados

Transport failures no filtran `storage_key` ni `checksum` en JSON de error.

### 24.14 QA post-hardening

| Check | Resultado |
|-------|-----------|
| LC-11 tests (5 archivos) | 41 PASS |
| Suite completa | **999 PASS** |
| typecheck | exit 0 |
| git diff --check | limpio |
| HTTP × 5 | 200 OK |
| UI / assets / SQL | cero cambios |

---

## 21. Exclusiones (confirmadas)

- Sin SQL / migraciones / RLS / seeds
- Sin Supabase proyecto real
- Sin upload / bucket
- Sin operaciones mutables
- Sin cambios UI / Legal Activity / W-9 cards / downloads visibles

---

## 25. Aprobación técnica PO — cierre LC-11

El Product Owner aprueba técnicamente LC-11 con las siguientes confirmaciones:

| # | Aprobación | Estado |
|---|------------|--------|
| 1 | Adapter Supabase independiente de `fixtureStore` | ✓ |
| 2 | Sin fallback silencioso: memory explícito; supabase requiere ApiClient o transport; error tipado si falta | ✓ |
| 3 | Timestamps separados: `created_at`→`createdAt`, `submitted_at`→`submittedAt`, `updated_at`→`updatedAt` | ✓ |
| 4 | Cinco repositories read-only: Template, Instance, W-9, Submission, Audit | ✓ |
| 5 | Contract tests y parity ejecutados para las cinco familias | ✓ |
| 6 | `ApiClient.rpc()` como boundary Supabase-compatible | ✓ |
| 7 | Sin supabase-js, fetch directo, localStorage, service role, SQL, migrations, RLS activa, backend real | ✓ |
| 8 | Autorización: Owner, Manager, Seller bloqueado, Artist aislado, Client bloqueado fiscalmente | ✓ |
| 9 | Soft delete: Owner ve deleted; Manager/Artist no; sin hard delete | ✓ |
| 10 | UUID internos ocultos | ✓ |
| 11 | Cursor opaco, validado, límite 1–100, sin duplicados, offset-based lab | ✓ |
| 12 | Errores sanitizados | ✓ |
| 13 | Type guard LC-8 usa catálogo canónico | ✓ |
| 14 | Suite: LC-11 41 PASS, completa 999 PASS, typecheck PASS, HTTP 200×5 | ✓ |
| 15 | Cero cambios UI y assets | ✓ |
| 16 | LC-12 no iniciado | ✓ |
| 17 | Riesgos remanentes documentados: RPC propuestos, cursor compuesto DB, recipient_* denormalizado | ✓ |

**No declarado:** persistencia real, Supabase conectado, tablas creadas, RLS activa, producción, write support.

**Estado documental final:** **LC-11 CERRADO — APROBADO TÉCNICAMENTE POR EL PRODUCT OWNER**

---

## 22. Fase recomendada siguiente (LC-12)

1. DDL tipado alineado con row contracts.
2. RPC read functions en Postgres con RLS.
3. Write repositories y transacciones atómicas.
4. Wiring portal detrás de factory (sin UI hasta PO).
5. Parity tests contra Supabase local/staging.

---

## 23. Confirmación operativa

| Acción | Estado |
|--------|--------|
| Commit | **SÍ** — `feat(v2-legal): add read-only persistence adapters` |
| Push | **NO** |
| Merge | **NO** |
| PR | **NO** |
| Deploy | **NO** |
| LC-12 | **NO iniciado** |
