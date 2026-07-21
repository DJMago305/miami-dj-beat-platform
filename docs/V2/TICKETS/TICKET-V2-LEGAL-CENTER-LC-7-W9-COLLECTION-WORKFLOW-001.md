# TICKET-V2-LEGAL-CENTER-LC-7-W9-COLLECTION-WORKFLOW-001

## LC-7 — W-9 Collection Workflow Foundation

| Campo | Valor |
|-------|-------|
| Estado | **IMPLEMENTADO — APROBADO VISUAL Y TÉCNICAMENTE POR EL PRODUCT OWNER** |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `b29a4513693230d072cbac4a3cdb8ff849d04ac1` |
| HEAD post-commit LC-7 | pendiente de entrega |
| Fecha | 2026-07-20 |
| Parent | LC-6 Document Instance · LC-5 Template Assets · LC-4A Shell |

---

## 1. Objetivo

Base del flujo de recopilación W-9 usando template `SPC-001` / `TV-SPC-001-1`, `LegalDocumentInstance` (LC-6), servicio in-memory, permisos por portal/rol y estados tipados.

**Sin upload real · sin email · sin firma · sin Supabase.**

---

## 2. Workflow

```
Staff Owner/Manager → requestW9()
  → LegalDocumentInstance (LDI-######, pending)
  → LegalW9Request (W9R-######, requested)
  → makeW9Available() → sent / available
  → markW9Viewed() → viewed
  → markAwaitingUpload() → awaiting_upload
  → (LC-8+) submitted / accepted / rejected
```

Detención LC-7: **antes de almacenar archivo completado**.

---

## 3. Actores autorizados

| Actor | Crear solicitud | Listar/consultar | Transiciones staff | Transiciones recipient |
|-------|-----------------|------------------|--------------------|------------------------|
| Staff Owner | Sí | Sí (todas) | Sí | — |
| Staff Manager | Sí | Sí (todas) | Sí | — |
| Staff Seller | No | No | No | — |
| Artist | No | Solo propias | No | viewed / awaiting_upload |
| Client | No | No | No | — |

Contexto: `LegalWorkflowActor` (`portal`, `role?`, `actorId`).

---

## 4. Destinatarios permitidos

| Tipo | Permitido |
|------|-----------|
| artist | Sí |
| vendor | Sí |
| company | Sí |
| external | Sí |
| client | **No** (`w9_recipient_not_allowed`) |
| staff | No (no requerido) |

---

## 5. Modelo `LegalW9Request`

| Campo | Descripción |
|-------|-------------|
| `id` | `W9R-######` |
| `documentInstanceId` | `LDI-######` (LC-6) |
| `templateId` / `templateVersionId` | `SPC-001` / `TV-SPC-001-1` |
| `recipient` | Destinatario tipado |
| `requestedBy` | Staff owner/manager |
| `status` | Workflow status |
| `reviewStatus` | `not_started` (LC-7) |
| `requestedAt` / `updatedAt` | ISO 8601 |
| `dueAt` / `viewedAt` / `completedAt?` | Opcionales |
| `metadata` | Serializable, sin datos fiscales sensibles |

---

## 6. Estados LC-7

**Operativos (transiciones públicas):**

`requested` · `available` · `viewed` · `awaiting_upload` · `expired` · `cancelled`

**Reservados LC-8 (tipos definidos, sin operaciones públicas):**

`submitted` · `accepted` · `rejected`

Estrategia: **Opción A** — definidos en union, bloqueados en matriz de transición.

---

## 7. Matriz de transiciones W-9

| From | To |
|------|-----|
| requested | available, cancelled, expired |
| available | viewed, cancelled, expired |
| viewed | awaiting_upload, cancelled, expired |
| awaiting_upload | cancelled, expired |
| terminales | — |

---

## 8. Mapping con LegalDocumentInstance

| W-9 status | Instance status |
|------------|-----------------|
| requested | pending |
| available | sent |
| viewed | viewed |
| awaiting_upload | viewed |
| expired | expired |
| cancelled | cancelled |

Toda transición workflow sincroniza vía `InMemoryLegalDocumentInstanceService` — sin mutación directa.

---

## 9. Política de duplicados

No más de una solicitud **activa** (`requested`, `available`, `viewed`, `awaiting_upload`) por:

- `recipientType` + `recipientId` + template `SPC-001`

Nueva solicitud permitida tras `cancelled` o `expired` (y futuros terminales LC-8).

Error: `w9_active_request_exists`.

Secuencia W9R: `bumpW9RequestSequenceFloor()` — misma auditoría que LC-6.

---

## 10. Operaciones del servicio

`InMemoryLegalW9WorkflowService`:

1. `requestW9()`
2. `getW9RequestById()`
3. `listW9Requests()`
4. `listW9RequestsByRecipient()`
5. `listW9RequestsByStatus()`
6. `makeW9Available()`
7. `markW9Viewed()` (idempotente en viewed/awaiting_upload)
8. `markAwaitingUpload()`
9. `cancelW9Request()`
10. `expireW9Request()`

Clock: reutiliza `LegalDocumentInstanceClock` (LC-6).

Assets: verificación vía `resolveLegalTemplateAssetUrl()` — **sin URL hardcoded en workflow**.

---

## 11. Errores de dominio

`w9_request_not_found` · `w9_duplicate_request_id` · `w9_actor_not_authorized` · `w9_recipient_not_allowed` · `w9_invalid_recipient` · `w9_invalid_due_at` · `w9_invalid_status_transition` · `w9_instance_creation_failed` · `w9_instance_transition_failed` · `w9_request_already_terminal` · `w9_expiration_not_due` · `w9_template_unavailable` · `w9_active_request_exists`

Patrón: `LegalW9WorkflowResult<T>`.

---

## 12. Integración UI (mínima LC-7)

**Implementada** — extensión LC-4A sin rediseño:

| Portal | UI |
|--------|-----|
| Staff Owner/Manager | Sección **W-9 Collection Requests** + listado demo + placeholder **Request W-9 — demo pending** |
| Staff Seller | Sin sección fiscal de colección |
| Artist | Sección **Assigned W-9 Request** + **Download W-9** + título **Upload coming soon** |
| Client | Sin W-9 collection, sin IDs fiscales, sin URL PDF |

Lab store: `getSharedLegalW9WorkflowService()` con seed demo (`ART-001`).

Creación interactiva completa: **pendiente** (placeholder documentado).

---

## 13. Archivos creados

| Archivo |
|---------|
| `workflows/legal-w9-workflow-actor.ts` |
| `workflows/legal-w9-request-status.ts` |
| `workflows/legal-w9-request-types.ts` |
| `workflows/legal-w9-request-errors.ts` |
| `workflows/legal-w9-request-transition.ts` |
| `workflows/legal-w9-instance-mapping.ts` |
| `workflows/legal-w9-request-immutability.ts` |
| `workflows/legal-w9-workflow-lab-store.ts` |
| `workflows/index.ts` |
| `in-memory/in-memory-legal-w9-workflow-service.ts` |
| `provider/legal-w9-workflow-shell-mapper.ts` |
| `tests/unit/legal-w9-workflow.test.ts` |

## Archivos modificados

| Archivo |
|---------|
| `in-memory/index.ts` |
| `provider/index.ts` |
| `provider/legal-center-shell-mapper.ts` |

---

## 14. Pruebas

| Archivo | Tests |
|---------|-------|
| `legal-w9-workflow.test.ts` | **18** |

Cobertura: creación, permisos, template, instancias, transiciones, duplicados, fechas, inmutabilidad, listados, matriz, regresión LC-5/LC-6, aislamiento client, UI shell.

---

## 15. QA

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | **PASS** |
| LC-7 tests | **18 PASS** |
| `npm test -- --run` | **68 files · 913 tests PASS** (+18 vs 895) |
| `git diff --check` | **PASS** |
| Portales + PDF HTTP | **200** |

---

## 16. Seguridad

- Sin SSN/EIN/TIN reales en fixtures/tests.
- Metadata de workflow únicamente — sin contenido de formulario.
- Client: sin filtrado de `W9R-`, `SPC-001`, URL PDF en DOM (test regresión).

---

## 17. Exclusiones

Upload · storage · Supabase · email · firma · submitted/accepted/rejected operativos · LC-8 · convergencia LDC-002 · commit/push/deploy.

---

## 18. Deuda / riesgos

| Item | Nota |
|------|------|
| Lab shared store | Singleton in-memory — no persistencia cross-session |
| Request W-9 interactivo | Placeholder UI; creación vía servicio en tests/API futura |
| `submitted/accepted/rejected` | Reservados para LC-8 |
| LDC-002 vs LC-6 | Coexistencia sin convergencia |

---

## 19. Git

| Acción | Estado |
|--------|--------|
| Commit | **NO** |
| Push | **NO** |
| Merge | **NO** |
| PR | **NO** |
| Deploy | **NO** |

---

## 20. Aprobación PO (localhost)

| Portal | Validación visual |
|--------|-------------------|
| Staff Owner | W-9 Collection Requests · demo artista · SENT · Download W-9 · placeholder no funcional · Tax & W-9 Center intacto · LC-4A sin regresión |
| Staff Seller | Sin colección W-9 ni creación |
| Artist | Solicitud asignada · Download W-9 · Upload coming soon pasivo |
| Client | Sin W-9 · sin W9R · sin SPC-001 · sin URL fiscal |

Observación futura (no bloqueante): renombrar copy “Request W-9” — fuera de alcance LC-7.

---

## 21. Estado final

**LC-7 CERRADO — APROBADO VISUAL Y TÉCNICAMENTE POR EL PRODUCT OWNER**

Sin Supabase · sin email · sin upload real · sin firma · sin push/merge/PR/deploy · LC-8 no iniciado.
