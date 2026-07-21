# TICKET-V2-LEGAL-CENTER-LC-6-DOCUMENT-INSTANCE-LIFECYCLE-001

## LC-6 — Legal Document Instance Lifecycle Foundation

| Campo | Valor |
|-------|-------|
| Estado | **IMPLEMENTADO — APROBADO TÉCNICAMENTE POR EL PRODUCT OWNER** |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `0687f50e7c4f2cf586037aa7e005bc1ea61481cb` |
| HEAD post-auditoría | commit LC-6 pendiente de entrega |
| Fecha | 2026-07-20 |
| Parent | LC-5 Template Assets · DC-2 In-Memory · DC-1 Contracts |

---

## 1. Objetivo

Establecer la base de dominio y servicio in-memory para **instancias documentales** asignadas a destinatarios concretos, con lifecycle tipado, transiciones controladas, timestamps, versionado de instancia y expiración explícita.

**Sin UI · sin upload · sin firma · sin persistencia real.**

---

## 2. Problema resuelto

Antes de LC-6 existían:

- **LegalTemplate** (reutilizable, versionado) — catálogo/assets DC-1/LC-5.
- **LegalDocument** (LDC-002) — entidad expediente legacy con lifecycle distinto (`DRAFT`, `SENT`, …).

LC-6 introduce **`LegalDocumentInstance`** como modelo V2 aislado para el flujo:

```
Template → Instance → Status Lifecycle → Version / Audit Metadata → (future storage & signature)
```

No conectado aún a portales ni Legal Center UI.

---

## 3. Diferencia Template vs Instance

| Concepto | Ejemplo | ID |
|----------|---------|-----|
| **Template** | Corporate W-9 `SPC-001` / `TV-SPC-001-1` | Reutilizable |
| **Instance** | W-9 solicitado al artista `ART-001` | `LDI-000001` |
| **Instance** | Mismo template para artista `ART-002` | `LDI-000002` |

---

## 4. Modelo de dominio

**Ubicación:** `shared/services/legal/domain/`

| Tipo | Descripción |
|------|-------------|
| `LegalDocumentInstance` | Instancia concreta asignada |
| `LegalDocumentInstanceRecipient` | `recipientType`, `recipientId`, `displayName`, `email?` |
| `LegalDocumentInstanceOwner` | `ownerType`, `ownerId`, `issuedBy?`, `assignedBy?` |
| `LegalDocumentInstanceSignatureRequirementSpec` | `not_required` \| `single_signer` \| `multiple_signers` (+ `requiredSignerCount?`) |
| `LegalDocumentInstanceSource` | `template` \| `uploaded` \| `generated` \| `external` |
| `LegalDocumentInstanceMetadata` | `Record<string, string \| number \| boolean \| null>` |

Campos clave de instancia: `id`, `templateId`, `templateVersionId`, `category` (`LGL` \| `CTR` \| `SPC`), `title`, `recipient`, `owner`, `status`, `instanceVersion`, timestamps, `source`, `signatureRequirement`, `metadata`.

**ID opaco:** patrón `LDI-######` — no reutiliza `templateId`.

---

## 5. Estados

Unión cerrada (`legal-document-instance-status.ts`):

`draft` · `pending` · `sent` · `viewed` · `signed` · `rejected` · `expired` · `cancelled`

**Terminales:** `signed`, `rejected`, `expired`, `cancelled`

---

## 6. Matriz de transiciones

| From | To |
|------|-----|
| draft | pending, cancelled |
| pending | sent, cancelled, expired |
| sent | viewed, signed, rejected, expired, cancelled |
| viewed | signed, rejected, expired, cancelled |
| signed | — |
| rejected | — |
| expired | — |
| cancelled | — |

Funciones:

- `canTransitionLegalDocumentStatus(current, next)`
- `transitionLegalDocumentInstanceStatus(instance, next, updatedAt)`

Transición inválida → `{ ok: false, code: 'invalid_status_transition' | 'already_terminal' }`

---

## 7. Versionado

| Campo | Significado |
|-------|-------------|
| `templateVersionId` | Versión de plantilla (ej. `TV-SPC-001-1`) |
| `instanceVersion` | Versión material de la instancia (inicial **1**) |

Reglas: entero ≥ 1; rechaza 0, negativos, decimales, NaN.

LC-6 no implementa incremento material — campo reservado para LC futuro.

---

## 8. Timestamps (ISO 8601)

Siempre presentes: `createdAt`, `updatedAt`

Opcionales: `expiresAt`, `sentAt`, `viewedAt`, `signedAt`, `rejectedAt`, `cancelledAt`, `expiredAt`

Actualización automática en transición válida + `updatedAt` en cada cambio.

Clock inyectable: `createFixedLegalDocumentInstanceClock()` / `createSystemLegalDocumentInstanceClock()`.

---

## 9. Expiración

`expireLegalDocumentInstance(id)` / `service.expireInstance(id)`:

- Solo instancias **no terminales**
- Si `expiresAt` existe y `now < expiresAt` → `expiration_not_due`
- Terminales → `expiration_not_allowed`
- Éxito → `status: expired`, `expiredAt`, `updatedAt`

Sin scheduler.

---

## 10. Servicio in-memory

**Archivo:** `in-memory/in-memory-legal-document-instance-service.ts`

| Operación | Descripción |
|-----------|-------------|
| `createInstance()` | Factory + registro por ID |
| `getInstanceById()` | Copia inmutable |
| `listInstances()` | Opcional filtro por status |
| `listInstancesByRecipient()` | Por tipo + id |
| `listInstancesByTemplate()` | Por templateId |
| `transitionStatus()` | Transición validada |
| `cancelInstance()` | → `cancelled` |
| `expireInstance()` | Expiración controlada |

Factory: `createLegalDocumentInstance()` — status inicial **`draft`**, `instanceVersion: 1`.

---

## 11. Errores de dominio

| Code | Caso |
|------|------|
| `instance_not_found` | ID inexistente |
| `duplicate_instance_id` | ID duplicado en store |
| `invalid_status_transition` | Salto no permitido / mismo status |
| `invalid_instance_version` | Reservado validadores versión |
| `invalid_recipient` | Recipient inválido |
| `invalid_template_reference` | Template/título/categoría/owner inválidos |
| `already_terminal` | Transición desde terminal |
| `expiration_not_allowed` | Expirar terminal |
| `expiration_not_due` | Antes de `expiresAt` |
| `invalid_instance_timestamp` | ISO 8601 inválido en `expiresAt` o clock |

Patrón: `LegalDocumentInstanceResult<T>` = `{ ok: true, value }` \| `{ ok: false, code, message, metadata? }`

---

## 12A. Auditoría técnica final (PO)

### Colisiones de ID

- Patrón **`LDI-######`** confirmado.
- Misma plantilla → IDs distintos (`LDI-000001`, `LDI-000002`, …).
- ID explícito duplicado → **`duplicate_instance_id`**.
- Tras crear **`LDI-000010`** explícito, el servicio sincroniza `sequence` vía `bumpSequenceFloor()`; el siguiente auto-generado es **`LDI-000011`** (sin colisión).
- Estrategia probada en `legal-document-instance-lifecycle.test.ts` (bloque auditoría).

### Inmutabilidad

- `freezeLegalDocumentInstance()` + `cloneLegalDocumentInstance()` congelan/clonan `recipient`, `owner`, `metadata`, `signatureRequirement`.
- Prueba de auditoría: intentos de mutación en nested props lanzan error; re-lectura del servicio confirma estado intacto.

### Fechas y expiración

- `isValidLegalDocumentInstanceTimestamp()` rechaza ISO inválido → **`invalid_instance_timestamp`** (sin throw genérico).
- `expiration_not_due` cuando `now < expiresAt`.
- `expireInstance` permitido cuando `now >= expiresAt` (incluye igualdad exacta).
- Clock inyectable usado para `expiredAt` y `updatedAt`.
- Terminales `signed`, `rejected`, `cancelled`, `expired` → **`expiration_not_allowed`**.

### Matriz de transiciones

Sin cambios respecto al contrato aprobado (ver §6). Prueba explícita en auditoría.

### Deuda conocida (mantenida)

- **`LegalDocument` (LDC-002)** y **`LegalDocumentInstance` (LC-6)** coexisten.
- LC-6 no modifica ni elimina LDC-002.
- Convergencia reservada para ticket futuro — sin adapters en este commit.

### QA post-auditoría

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | **PASS** |
| LC-6 tests | **44 PASS** |
| Suite completa | **895 PASS** |
| `git diff --check` | **PASS** |
| LC-5 regresión | Sin cambios funcionales |

---

## 12. Archivos creados

| Archivo |
|---------|
| `domain/legal-document-instance-status.ts` |
| `domain/legal-document-instance-errors.ts` |
| `domain/legal-document-instance-types.ts` |
| `domain/legal-document-instance-transition.ts` |
| `domain/legal-document-instance-clock.ts` |
| `domain/legal-document-instance-factory.ts` |
| `domain/legal-document-instance-immutability.ts` |
| `domain/index.ts` |
| `in-memory/in-memory-legal-document-instance-service.ts` |
| `tests/unit/legal-document-instance-lifecycle.test.ts` |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `in-memory/index.ts` | Export servicio LC-6 |

**Sin cambios:** UI, wires, LC-5 mapper/assets, provider factory core, portales.

---

## 13. Pruebas

| Archivo | Tests |
|---------|-------|
| `legal-document-instance-lifecycle.test.ts` | **44** |

Cobertura: factory, IDs, matriz transiciones, timestamps, expiración, servicio, versionado, regresión LC-5 download.

---

## 14. Resultados QA

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | **PASS** |
| `npm test -- --run tests/unit/legal-document-instance-lifecycle.test.ts` | **44 PASS** |
| `npm test -- --run` | **67 files · 895 tests PASS** (+44 vs baseline 851) |
| `git diff --check` | **PASS** |
| Portales HTTP (Vite) | staff/seller/artist/client **200** |

---

## 15. Exclusiones (confirmadas)

UI · uploads · Supabase · firma · email · LC-7 · commit · push · deploy.

---

## 16. Riesgos / deuda

| Item | Nota |
|------|------|
| Dos modelos documentales | `LegalDocument` (LDC-002) vs `LegalDocumentInstance` (LC-6) — convergencia en ticket futuro |
| Sin integración provider | Instancias no aparecen en Legal Center hasta LC posterior |
| `instanceVersion` sin bump | Campo listo; lógica de revisión material pendiente |

---

## 17. Decisiones pendientes PO

- ¿Status inicial alternativo `pending` para ciertos flujos staff?
- ¿Unificar enums recipient con `LegalSubjectType` / `RecipientRole` de DC-1?
- ¿Punto de integración con expediente in-memory existente?

---

## 18. Git

| Acción | Estado |
|--------|--------|
| Commit | **NO** |
| Push | **NO** |
| Merge | **NO** |
| PR | **NO** |
| Deploy | **NO** |

---

## 19. Estado final

**IMPLEMENTADO — APROBADO TÉCNICAMENTE POR EL PRODUCT OWNER**

Sin UI · sin persistencia · sin firma · sin uploads · LC-7 no iniciado.
