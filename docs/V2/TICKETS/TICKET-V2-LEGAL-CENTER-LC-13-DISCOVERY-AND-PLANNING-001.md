# TICKET-V2-LEGAL-CENTER-LC-13-DISCOVERY-AND-PLANNING-001

## Estado

**LC-13 DISCOVERY COMPLETADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**

| Campo | Valor |
|-------|-------|
| Ticket | LC-13 — Secure Access Architecture (RLS + RPC + boundaries) |
| Modo | Discovery + documentación — **sin implementación** |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD al cierre docs | `5b071328e35a1781d1d4f38c611ad41522ffed33` |
| Fecha | 2026-07-22 |
| SQL / RLS / RPC | ❌ NO creados |
| Runtime | ❌ NO modificado |
| Commit | ❌ NO autorizado en este ticket |

---

## 1. Contexto aprobado

| Estado | Valor |
|--------|-------|
| LC-12 DDL | **APPROVED_BY_PO_IN_ISOLATED_POSTGRES** |
| Bootstrap legacy | **BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT** |
| LC-12 cadena Supabase | **NOT APPLIED** vía 110 migraciones |
| LC-13B identity bridge | ✅ Runtime aprobado PO (`decf057`) |
| LC-13A read discovery | ✅ Aprobado PO — matrices en `docs/V2/LEGAL/` |
| LC-13 implementación SQL | **NOT_IMPLEMENTED / DEFERRED** |
| Producción | **NOT_AUTHORIZED** |

**Principio rector (LC-13A + Constitución):** la seguridad **no** depende del navegador. `previewRole`, query params y UI state **no** son autoridad.

---

## 2. Fuentes canónicas (no duplicar — referenciar)

| Documento | Rol |
|-----------|-----|
| `docs/V2/LEGAL/LC-13A-READ-AUTHORIZATION-MATRIX.md` | Matriz read Actor × Entity |
| `docs/V2/LEGAL/LC-13A-RPC-CONTRACT-MATRIX.md` | 7 RPC read + envelope |
| `docs/V2/LEGAL/LC-13B-0-ACCESS-CONTEXT-CONTRACT.md` | Bridge → `LegalReadAccessContext` |
| `docs/V2/LEGAL/LC-13B-0-IDENTITY-FLOW.md` | Flujo 9 pasos |
| `MiamiDJBeat-MigracionV2/shared/services/legal/persistence/identity/` | Bridge live |
| `…/submissions/legal-document-submission-permissions.ts` | Reglas write staff |
| `…/audit/legal-audit-immutability.ts` | Append-only dominio |

---

## 3. Inventario del dominio legal (LC-12)

### 3.1 `legal_templates`

| Campo | Valor |
|-------|-------|
| Propósito | Catálogo de plantillas legales (SPC-*) |
| Actor propietario | **SYSTEM_ONLY** (publicación staff management) |
| Sensibilidad | Media — metadatos; fiscal flags |
| Riesgo | Medio — filtración de plantillas fiscales |
| Read | Owner/Manager full · Seller public · Artist/Client scoped |
| Write | Owner/Manager publish · **Owner** retire/archival policy |
| Never | Client raw fiscal templates · `object_key` en listados |

**Clasificación:** STAFF (write) · ARTIST/CLIENT (read scoped) · SYSTEM_ONLY (seed)

### 3.2 `legal_template_versions`

| Campo | Valor |
|-------|-------|
| Propósito | Versiones publicadas (TV-*) |
| Actor propietario | **SYSTEM_ONLY** |
| Sensibilidad | Media-Alta — hash, semver, bodies JSON |
| Riesgo | Alto si expone contenido no publicado |
| Read | Misma matriz que templates |
| Write | Owner/Manager publish · no DELETE físico |
| Never | Seller fiscal versions · versiones draft |

**Clasificación:** STAFF · ARTIST/CLIENT (read) · SYSTEM_ONLY

### 3.3 `legal_template_assets`

| Campo | Valor |
|-------|-------|
| Propósito | Metadatos de assets (PDF refs privadas) |
| Actor propietario | **SYSTEM_ONLY** |
| Sensibilidad | **Alta** — `object_key` |
| Riesgo | **Alto** — path leakage |
| Read | Metadata only vía RPC; download vía signed URL futuro |
| Write | Owner/Manager |
| Never | Exponer `object_key` en SELECT directo a browser |

**Clasificación:** STAFF · SYSTEM_ONLY (storage) · **OWNER_ONLY** (fiscal assets)

### 3.4 `legal_document_instances`

| Campo | Valor |
|-------|-------|
| Propósito | Instancias de documentos (LDI-*) |
| Actor propietario | Recipient (`recipient_type` + `recipient_id`) |
| Sensibilidad | **Alta** — contratos, fiscal |
| Riesgo | **Alto** — cross-recipient leak |
| Read | Staff management · own recipient scope |
| Write | Staff create/send · recipient sign/view transitions |
| Never | Cross-profile enumeration (∅ foreign IDs) |

**Clasificación:** STAFF · ARTIST · CLIENT · **OWNER_ONLY** (staff-wide fiscal)

### 3.5 `legal_w9_requests`

| Campo | Valor |
|-------|-------|
| Propósito | Workflow W-9 (W9R-*) |
| Actor propietario | Recipient + requesting staff actor |
| Sensibilidad | **FISCAL CRITICAL** |
| Riesgo | **Alto** |
| Read | Recipient own · Owner/Manager staff · Seller 🚫 fiscal |
| Write | Staff request · recipient upload path |
| Never | Seller review fiscal · Client ver W-9 ajeno |

**Clasificación:** STAFF (management) · ARTIST (own) · **OWNER_ONLY** (accept/reject fiscal)

### 3.6 `legal_document_submissions`

| Campo | Valor |
|-------|-------|
| Propósito | Metadatos submission PDF (LDS-*) |
| Sensibilidad | **FISCAL CRITICAL** |
| Riesgo | **Alto** — storage_key, checksum |
| Read | Recipient + management staff |
| Write | Recipient upload · Manager review · soft delete |
| Never | Hard DELETE · Seller fiscal access |

**Clasificación:** ARTIST/CLIENT (own upload) · STAFF (review) · **OWNER_ONLY** (accept/reject/delete policy)

### 3.7 `legal_audit_events`

| Campo | Valor |
|-------|-------|
| Propósito | Audit trail append-only (LAE-*) |
| Actor propietario | **SYSTEM_ONLY** |
| Sensibilidad | Alta — acciones, estados |
| Riesgo | Medio — tampering |
| Read | Owner/Manager · projection sanitizada otros |
| Write | **INSERT only** (trigger blocks UPDATE/DELETE) |
| Never | UPDATE/DELETE · anon direct insert |

**Clasificación:** **SYSTEM_ONLY** (write) · STAFF (read scoped) · append-only

---

## 4. Matriz de roles y operaciones

### 4.1 Roles

| Rol | Identidad | Notas |
|-----|-----------|-------|
| **owner** | `STAFF-OWNER-*` · `is_staff_management` | Full legal + fiscal |
| **manager** | `STAFF-MANAGER-*` · `is_staff` | Ops + fiscal read TBD PO |
| **seller** | `STAFF-SELLER-*` · fail-closed default | No fiscal · ops-linked ⏳ |
| **artist** | `ART-*` | Own recipient scope |
| **client** | `CLI-*` | Own documents · no artist fiscal |
| **anonymous** | Sin sesión | Solo vía token público futuro |
| **invited-recipient** | Token + optional account | Public link scope |
| **system** | Edge/service role | Backend writes + audit insert |

### 4.2 Matriz operaciones (resumen)

Leyenda: **ALLOW** · **DENY** · **CONDITIONAL**

| Operación | owner | manager | seller | artist | client | anonymous | system |
|-----------|-------|---------|--------|--------|--------|-----------|--------|
| Listar documentos | ALLOW | ALLOW | COND | COND own | COND own | DENY | ALLOW |
| Ver documento | ALLOW | ALLOW | COND | COND own | COND own | COND token | ALLOW |
| Descargar PDF | ALLOW | ALLOW | DENY fiscal | COND own | COND own | COND token | ALLOW |
| Crear contrato | ALLOW | ALLOW | COND | DENY | DENY | DENY | ALLOW |
| Enviar W-9 | ALLOW | ALLOW | DENY | DENY | DENY | DENY | ALLOW |
| Solicitar firma | ALLOW | ALLOW | COND | COND own sign | COND own | COND token | ALLOW |
| Subir archivos | ALLOW | ALLOW | DENY | COND W-9 | COND own | COND token | ALLOW |
| Reemplazar versión | **ALLOW** | COND | DENY | DENY | DENY | DENY | ALLOW |
| Revocar enlace | **ALLOW** | ALLOW | DENY | DENY | DENY | DENY | ALLOW |
| Cerrar documento | ALLOW | ALLOW | DENY | COND | COND | DENY | ALLOW |
| Consultar auditoría | ALLOW | ALLOW | DENY | COND own | COND own | DENY | ALLOW |
| Exportar | **ALLOW** | COND | DENY | DENY | DENY | DENY | ALLOW |
| Eliminar (soft) | **ALLOW** | COND | DENY | DENY | DENY | DENY | ALLOW |

**Operaciones irreversibles (requieren Owner o audit obligatorio):**

- Hard delete (prohibido en LC-12 — solo soft delete submissions)
- Revocación global de plantilla publicada
- Aceptación fiscal W-9 (terminal state)
- Purga audit (prohibido — append-only)

**Frontera Owner / Manager / Seller:**

| Capacidad | Owner | Manager | Seller |
|-----------|-------|---------|--------|
| Fiscal read/write | ✅ | ✅ (PO TBD narrow) | 🚫 |
| W-9 accept/reject | ✅ | ✅ | 🚫 |
| Template publish | ✅ | ✅ | 🚫 |
| Public link revoke | ✅ | ✅ | 🚫 |
| Ops-linked instances | ✅ | ✅ | ⏳ COND |
| Audit full | ✅ | ✅ | 🚫 |

---

## 5. Diseño conceptual RLS (LC-13 — futuro SQL)

**Patrón aprobado LC-13A:** RLS base en tablas + **RPC SECURITY INVOKER** (no RPC-only bypass).

### 5.1 Políticas por tabla (conceptual)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `legal_templates` | Staff + scoped portal | Management only | Management only | **DENY** |
| `legal_template_versions` | Scoped | Management | Management | **DENY** |
| `legal_template_assets` | Metadata scoped | Management | Management | **DENY** |
| `legal_document_instances` | Recipient + staff | Staff create | State transitions | **DENY** |
| `legal_w9_requests` | Recipient + management | Staff request | Workflow states | **DENY** |
| `legal_document_submissions` | Recipient + management | Recipient/staff | Review/soft delete | **DENY** hard |
| `legal_audit_events` | Management + projection | **System/controlled** | **DENY** (trigger) | **DENY** (trigger) |

### 5.2 Append-only

| Objeto | Append-only |
|--------|-------------|
| `legal_audit_events` | ✅ **Sí** — LC-12 trigger + RLS no UPDATE/DELETE |
| Submissions replace chain | Logical replace via new row + `replaces_submission_row_id` |
| Templates/versions | New version row; no destructive delete |

### 5.3 Delegación

| Acción | Owner only | Delegable to Manager |
|--------|------------|----------------------|
| Template publish/retire | ✅ confirm | ✅ |
| W-9 accept | ✅ | ✅ |
| Public link revoke | ✅ | ✅ |
| Audit export | ✅ | ⏳ PO |
| Seller role assignment | ✅ | 🚫 |

---

## 6. Diseño conceptual RPC

### 6.1 Read RPC (LC-13A — implementación futura LC-13 SQL)

Implementar **7 RPCs** (paridad `LEGAL_READ_RPC_NAMES`):

1. `legal_read_templates`
2. `legal_read_template_versions`
3. `legal_read_template_assets`
4. `legal_read_instances`
5. `legal_read_w9_requests`
6. `legal_read_submissions`
7. `legal_read_audit_events`

Todas: **SECURITY INVOKER** · identidad desde `auth.uid()` + profile lookup · envelope `{ data, next_cursor, has_more }`.

Ver contratos completos: `docs/V2/LEGAL/LC-13A-RPC-CONTRACT-MATRIX.md`.

### 6.2 RPC agregadas propuestas (LC-13+ — no LC-13A scope)

| RPC (futura) | Objetivo | Entrada | Salida | Permisos | Riesgo |
|--------------|----------|---------|--------|----------|--------|
| `legal_read_dashboard()` | KPIs + action items portal | portal implicit | aggregates | session + role | Medio |
| `legal_read_document()` | Get single LDI + related | `business_id` | projection | recipient/staff | Alto |
| `legal_generate_public_link()` | Token scoped access | entity ref, TTL | token id (opaque) | staff management | **Alto** |
| `legal_revoke_public_link()` | Invalidate token | token id | ok | owner/manager | Medio |
| `legal_read_w9_status()` | Workflow summary | recipient scope | status DTO | recipient/staff | Alto fiscal |

**No escribir CREATE FUNCTION en este ticket.**

### 6.3 Write path (fuera de read RPC — ticket futuro)

Writes vía Edge Functions o RPC `SECURITY DEFINER` acotadas — **no** direct INSERT browser en tablas fiscales.

---

## 7. Enlaces públicos temporales

### 7.1 Casos

| Actor | Escenario |
|-------|-----------|
| Artista sin cuenta | W-9 / contrato via email link |
| Proveedor sin cuenta | Vendor agreement |
| Cliente sin cuenta | Sign package |

### 7.2 Diseño

| Control | Recomendación |
|---------|---------------|
| Expiración | TTL default 72h · max 30d · Owner configurable |
| Revocación | Staff management · audit `link_revoked` |
| Token | Opaque UUID v4 · hash stored · single-table `legal_public_access_tokens` (**futuro**, no LC-12) |
| Usos | Default single-use sign · multi-use read-only COND |
| Auditoría | `legal_audit_events`: `link_issued`, `link_viewed`, `link_used`, `link_revoked` |
| IP / UA | Log en audit metadata · no block alone |
| Abuso | Rate limit Edge · lock after N failures |

### 7.3 Riesgos

| Riesgo | Nivel |
|--------|-------|
| Token leak | **HIGH** |
| Enumeration | **HIGH** — use ∅ not 403 |
| Replay after revoke | **MEDIUM** |
| Over-broad scope | **HIGH** |

---

## 8. Estrategia de auditoría

### 8.1 Eventos obligatorios (siempre registrar)

- Document sent / viewed / signed / rejected / cancelled
- W-9 requested / submitted / accepted / rejected
- Submission uploaded / reviewed / soft-deleted
- Public link issued / viewed / revoked / expired
- Staff fiscal access (read submission metadata)
- Access denied (denied outcome + reason_code)
- Template published / version activated

### 8.2 Eventos opcionales

- List/dashboard aggregate views (sampled)
- Cursor pagination RPC (debug tier)

### 8.3 Retención y cumplimiento

- Append-only permanente en LC-12
- Export: Owner-only RPC + audit event
- `correlation_id` (LAC-*) obligatorio en flujos LC-9
- Retención legal: ⏳ PO + counsel — no purge en V2 lab

---

## 9. Compatibilidad firma electrónica (conceptual)

| Capacidad | Diseño |
|-----------|--------|
| DocuSign / Adobe Sign | Webhook → system actor · map external envelope id → `LDI-*` |
| Firma propia | In-platform sign flow · hash PDF en submission |
| OTP email | Second factor before sign · audit `otp_verified` |
| Consentimiento | Instance `signature_requirement` jsonb |
| Hash documental | `content_hash` version · submission `checksum` |
| Versionado | `legal_template_versions` + instance `instance_version` |

**No elegir proveedor en este ticket.**

---

## 10. Impacto bootstrap legacy

| Área | Clasificación | Notas |
|------|---------------|-------|
| Diseño RLS/RPC LC-13 | **SAFE_TO_CONTINUE** | Independiente de 110 migraciones |
| Spec + tests TS memory | **SAFE_TO_CONTINUE** | Ya activo |
| SQL RLS/RPC apply Supabase | **BLOCKED_BY_BOOTSTRAP** | Requiere LC-12 en stack o PG aislado + futuro pipeline V2 |
| Integración `is_staff()` V1 | **BLOCKED_BY_BOOTSTRAP** | Funciones leen `dj_profiles` — no en cadena vacía |
| Public link table migration | **SAFE_TO_CONTINUE** design · **BLOCKED** apply cadena |
| Producción | **BLOCKED** | Sin autorización PO |

**LC-13 design no debe resolver deuda legacy** — documentar separación explícita.

---

## 11. Fases de implementación propuestas (post-PO)

| Fase | Alcance | Bootstrap |
|------|---------|-----------|
| **LC-13-READ-SQL** | 7 read RPC + RLS SELECT | PG aislado LC-12 o pipeline V2 |
| **LC-13-WRITE-EDGE** | Create/send/sign vía Edge | Parcial SAFE |
| **LC-13-PUBLIC-LINK** | Token table + RPC | Design SAFE · apply BLOCKED |
| **LC-13-AUDIT-EXPORT** | Owner export RPC | SAFE design |

---

## 12. Restricciones

| Prohibido | Estado |
|-----------|--------|
| CREATE POLICY / ENABLE RLS | ❌ |
| CREATE FUNCTION | ❌ |
| Migraciones nuevas | ❌ |
| Runtime TS | ❌ |
| Supabase / Docker | ❌ |
| Commit (este ticket) | ❌ |

---

## 13. Estado final

> **LC-13 DISCOVERY COMPLETADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**

**Recomendación provisional:**

- Adoptar LC-13A matrices como base read obligatoria.
- Implementar SQL en ticket PO separado sobre **PostgreSQL aislado LC-12** o pipeline V2.
- No alterar 110 migraciones legacy en alcance Legal Center.
- Public links + write RPC en tickets posteriores.
- No avanzar a implementación sin aprobación PO explícita.
