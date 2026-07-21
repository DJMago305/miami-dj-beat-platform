# TICKET-V2-LEGAL-CENTER-LC-13A-READ-SECURITY-RPC-DISCOVERY-001

## Estado

**LC-13A CERRADO — DISCOVERY APROBADO POR EL PRODUCT OWNER**

Discovery y documentación únicamente · **sin RLS** · **sin RPC SQL** · **sin migration apply** · **sin Supabase remoto** · **sin código runtime** · **sin commit** · **LC-13B no iniciado**.

| Campo | Valor |
|-------|-------|
| Ticket | LC-13A — Supabase Read Security & RPC Discovery |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `40ff9c8ea55d1b0a94384f24fa9a0352da668c0f` |
| Commit baseline | `feat(v2-legal): add local persistence schema foundation` |
| Suite baseline | 1029 PASS |
| Fecha discovery | 2026-07-21 |

---

## 1. Baseline

| Check | Resultado |
|-------|-----------|
| Rama | `plan/v2-phase-4-api-client` ✓ |
| HEAD | `40ff9c8` ✓ |
| Working tree (pre-discovery) | limpio ✓ |
| typecheck | exit 0 ✓ |
| Suite | 1029 PASS ✓ |

---

## 2. Alcance

LC-13A produce especificación aprobable para:

1. Modelo de identidad
2. Resolución de roles
3. Matriz de acceso por entidad
4. Visibilidad de información fiscal
5. Reglas de ownership
6. Políticas RLS futuras (conceptual)
7. RPC read-only futuras
8. Contratos entrada/salida
9. Paginación y filtros
10. Sanitización de datos
11. Errores
12. Auditoría de accesos (read audit)
13. Estrategia de pruebas
14. Fases de implementación posteriores

**No crea comportamiento runtime nuevo.**

---

## 3. Exclusiones confirmadas

| Prohibido | Estado |
|-----------|--------|
| RLS SQL (`ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`) | NO creado |
| RPC SQL (`CREATE FUNCTION legal_read_*`) | NO creado |
| Migration apply / `supabase db push` | NO ejecutado |
| Supabase remoto / SQL Editor | NO conectado |
| Código TypeScript modificado | NO |
| SQL modificado | NO |
| UI / assets | NO |
| Write adapters | NO |
| Signed URL RPC | NO (ticket futuro) |
| LC-13B implementation | NO iniciado |
| Commit / push / merge / PR / deploy | NO |

---

## 4. Fuentes inspeccionadas

### Código Legal Center V2

| Área | Path |
|------|------|
| Persistence | `MiamiDJBeat-MigracionV2/shared/services/legal/persistence/` |
| Access context | `persistence/legal-read-access-context.ts` |
| Read helpers | `persistence/shared/legal-read-repository-helpers.ts` |
| Ports | `persistence/ports/legal-read-repository-ports.ts` |
| Transport / RPC names | `persistence/transport/legal-persistence-read-transport.ts` |
| Memory adapter | `persistence/memory/memory-legal-read-repositories.ts` |
| Supabase adapter | `persistence/supabase/supabase-legal-read-repositories.ts` |
| Row types | `persistence/schema/legal-persistence-row-types.ts` |
| Errors | `persistence/legal-persistence-errors.ts` |
| Contracts | `contracts/legal-ids.ts`, `contracts/legal-projections.ts` |
| W-9 workflow | `workflows/legal-w9-workflow-actor.ts` |
| Submissions | `submissions/legal-document-submission-permissions.ts` |
| Audit | `audit/legal-audit-public-view.ts`, `audit/legal-audit-immutability.ts` |
| In-memory policy | `in-memory/legal-access-policy.ts` |
| Provider / shell | `provider/legal-portal-view-models.ts`, `provider/legal-w9-workflow-shell-mapper.ts` |
| ApiClient | `persistence/transport/legal-persistence-read-transport.ts` → `apiClient.rpc()` |

### SQL foundation

- `supabase/migrations/20260721044500_legal_center_persistence_foundation.sql` (LC-12, **no aplicada**)

### Tickets previos

- `TICKET-V2-LEGAL-CENTER-LC-10-PERSISTENCE-ADAPTER-DISCOVERY-001.md` (§13 RLS strategy)
- `TICKET-V2-LEGAL-CENTER-LC-11-PERSISTENCE-SCHEMA-READ-ONLY-ADAPTERS-001.md` (§12 auth, §24 matrices)
- `TICKET-V2-LEGAL-CENTER-LC-12-SUPABASE-SCHEMA-LOCAL-MIGRATION-FOUNDATION-001.md` (schema, §24 LC-13 next)

### Documentos LC-13A creados

- `docs/V2/LEGAL/LC-13A-READ-AUTHORIZATION-MATRIX.md`
- `docs/V2/LEGAL/LC-13A-RPC-CONTRACT-MATRIX.md`

---

## 5. Modelo de identidad

### Principio rector

**La seguridad no puede depender del navegador.**

No aceptar como autoridad: `previewRole`, query string, portal route, localStorage, sessionStorage, UI state, JavaScript role labels, ni `recipient_id` supplied by client.

Toda autorización futura debe resolverse **server-side** mediante identidad autenticada + relación persistida + rol persistido + ownership verificable.

### Tres modelos paralelos hoy (deuda de unificación)

| Modelo | Uso | Gap |
|--------|-----|-----|
| `LegalReadAccessContext` | LC-11 read repos | No bridge desde sesión real |
| `LegalWorkflowActor` | LC-7/8 mutations | Sin `client` role field |
| `LegalViewerContext` | In-memory expediente UI | Proyecciones, no SQL |

**LC-13B requiere** un resolver único: `auth.uid()` + profile lookup → `LegalReadAccessContext`.

### Clasificación de datos de identidad

| Dato | Disponible hoy | Fuente futura recomendada |
|------|----------------|---------------------------|
| Authenticated user ID | Dominio + V1 auth | `auth.uid()` |
| Portal type | UI route (no trusted) | Derivado de profile class (staff DJ row vs client row) |
| Staff role (owner/manager/seller) | `dj_profiles.role` + `is_staff_management()` | DB lookup — **no** JWT alone |
| Artist profile ID | Domain `ART-*` / MDJB suffix A | `dj_profiles` business ID / MDJB |
| Client profile ID | Domain `CLI-*` / MDJB suffix C | `client_profiles` |
| `recipientScope` | LC-11 test factories | Artist profile ID server-side |
| Tenant/business scope | No modelado | Pendiente — no bloqueante LC-13B read scope |
| Custom JWT claims | No confiar sin DB | Validación contra `dj_profiles` / `client_profiles` |

### Fuente canónica recomendada (combinación controlada)

1. **`auth.uid()`** — sujeto autenticado
2. **Profile lookup** — `dj_profiles` (staff/artist) o `client_profiles` (buyer)
3. **Postgres helpers** — `public.is_staff(uid)`, `public.is_staff_management(uid)` (Constitución V1)
4. **RPC context** — RPC read-only recibe params de filtro; identidad **no** viene de params

**No asumir** claims personalizados inexistentes. **No inventar** tablas sin documentar dependencia.

---

## 6. Roles

| Rol | Staff? | Fiscal | Audit raw | Deleted submissions |
|-----|--------|--------|-----------|---------------------|
| Owner | management | ✅ | ✅ full | ✅ |
| Manager | staff | ✅ (LC-10 PO) | ✅ ops | 🚫 (LC-11) |
| Seller | staff limited | 🚫 | 🚫 | 🚫 |
| Artist | performer | ✅ own | 📋 projection | — |
| Client | buyer | 🚫 | 🚫 | 🚫 |
| System | backend | controlled | insert audit | service role |

Actores **fuera de alcance LC-13A:** Provider, Venue, Anonymous link, Guest signer, browser service-role, backend worker write — documentados como deuda futura.

---

## 7. Matriz de acceso

Matriz completa Actor × Entity × Operation en:

**`docs/V2/LEGAL/LC-13A-READ-AUTHORIZATION-MATRIX.md`**

Resumen de decisiones:

- **Owner:** lectura completa Legal Center; fiscal; deleted submissions; audit raw
- **Manager:** operativa amplia; fiscal permitido (LC-10 PO); audit ops; **no** deleted submissions
- **Seller:** sin fiscal; sin submissions; sin audit; templates públicos only
- **Artist:** own-only vía `recipient_type` + `recipient_id`; fiscal own; audit projection
- **Client:** own documents; sin W-9 de terceros; sin fiscal artista; audit projection mínima o none
- **System:** no browser; Edge/service role futuro

Política forbidden vs not-found alineada LC-11 §24.7 (ver matriz).

---

## 8. Política de información fiscal

### Clasificación

| Artefacto | Clasificación |
|-----------|---------------|
| W-9 request row | Fiscal |
| W-9 submission row | Fiscal |
| W-9 PDF / template asset | Fiscal |
| `storage_key` / `object_key` | Sensitive internal |
| `checksum` | Sensitive internal |
| Filename / size / mime | Restricted (L0 public view subset) |
| Recipient identity on W-9 | Fiscal |
| W-9 status / timestamps | Fiscal context |
| Rejection reason | Staff-only detail |
| Audit events on W-9/submission | Fiscal-sensitive metadata |

**Excluido LC-13A:** SSN, EIN, contenido del formulario W-9.

### Reglas mínimas por rol

| Rol | W-9 artista/proveedor |
|-----|----------------------|
| Seller | 🚫 |
| Client | 🚫 |
| Artist | ✅ own only |
| Owner | ✅ |
| Manager | ✅ (PO approved) |

Implementación actual LC-11: `canReadFiscalLegalData()`, `ensureFiscalReadAccess()`.

---

## 9. Ownership

### Campos canónicos

| Entity | Ownership key | Relación canónica |
|--------|---------------|-------------------|
| `legal_document_instances` | `recipient_type` + `recipient_id` | Instance assigned to recipient |
| `legal_w9_requests` | `recipient_type` + `recipient_id` | W-9 owed by recipient |
| `legal_document_submissions` | `recipient_type` + `recipient_id` **denormalized** | Copied from instance at write |
| `legal_audit_events` | Indirect — `entity_id` + `related_entity_ids[]` | No rigid FK (history) |

### Submissions denormalization — evaluación explícita

| Estrategia | Pros | Cons |
|------------|------|------|
| **A — Columna directa `recipient_*`** | RLS simple; sin join; LC-11/12 ya modelado | Riesgo drift si instance cambia |
| **B — Solo `document_instance_row_id` + JOIN** | Siempre consistente | Join cost; RLS más complejo |

**Recomendación LC-13A:** **Estrategia híbrida (más segura):**

1. RLS primary: `EXISTS (SELECT 1 FROM legal_document_instances i WHERE i.id = submission.document_instance_row_id AND i.recipient_id = session_recipient_id)`
2. Mantener `recipient_*` denormalizado como **cache autorizado** validado en write RPC (LC futuro write phase)
3. Periodic consistency check en LC-13B tests — denormalized must match parent

**No decidir silenciosamente** — PO debe aprobar híbrido en LC-13B kickoff.

### Audit ownership

- Resolve recipient via `related_entity_ids` array prefixes (`ART-`, `CLI-`, `LDI-`, `LDS-`, `W9R-`)
- Helper existente: `resolveAuditRecipientIdFromRelatedEntityIds()`
- RLS: staff full; artist `(actor_id = session OR recipient in scope)`

---

## 10. RLS conceptual (sin SQL)

Para cada tabla, policies SELECT futuras (LC-13B):

| Table | Owner | Manager | Seller | Artist own | Client own | Default |
|-------|-------|---------|--------|------------|------------|---------|
| `legal_templates` | all published | all published | public non-fiscal | allowed set | public library | deny |
| `legal_template_versions` | all | all | public | allowed | public | deny |
| `legal_template_assets` | metadata | metadata | deny fiscal | allowed portals | deny W-9 | deny |
| `legal_document_instances` | all | all | ⏳ ops-linked | recipient match | recipient match | deny |
| `legal_w9_requests` | all | all | deny | recipient match | deny | deny |
| `legal_document_submissions` | all | all non-deleted | deny | own + active | deny | deny |
| `legal_audit_events` | all | all | deny | filtered | deny | deny |

Cada policy LC-13B documentará: nombre conceptual, actor, USING condition, dependencias `is_staff*`, riesgo, fase.

**No ejecutar:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, `GRANT`, `REVOKE`.

---

## 11. RPC contracts

Especificación completa en **`docs/V2/LEGAL/LC-13A-RPC-CONTRACT-MATRIX.md`**.

### Cinco familias PO + extensión LC-11

| RPC | Status |
|-----|--------|
| `legal_read_templates` | Especificado |
| `legal_read_instances` | Especificado |
| `legal_read_w9_requests` | Especificado |
| `legal_read_submissions` | Especificado |
| `legal_read_audit_events` | Especificado |
| `legal_read_template_versions` | Extensión LC-11 — recomendado LC-13B |
| `legal_read_template_assets` | Extensión LC-11 — recomendado LC-13B |

Transport existente: `createApiClientLegalPersistenceReadTransport()` → `apiClient.rpc()`.

Envelope: `{ data, next_cursor, has_more }`.

---

## 12. Paginación

| Aspecto | LC-11 lab | LC-13B target |
|---------|-----------|---------------|
| Cursor | Offset opaco | **Keyset** |
| Encoding | base64 offset | `{ v:1, k:[...] }` opaco |
| Limit | 1–100 | 1–100 |
| Sort stability | business_id tie-break audit | per-entity tuple |

Ver RPC matrix para tuplas por entidad.

---

## 13. Errores

Catálogo futuro (alinear LC-11):

- `persistence_access_forbidden`
- `persistence_entity_not_found`
- `persistence_query_invalid`
- `persistence_cursor_invalid`
- `persistence_limit_invalid`
- `persistence_identity_unavailable`
- `persistence_role_unresolved`
- `persistence_rpc_failed`
- `persistence_contract_violation`

| Regla | Uso |
|-------|-----|
| Recurso ajeno | **not found** |
| Operación global no autorizada | **forbidden** |
| Sin sesión | **identity unavailable** |
| Params inválidos | **query invalid** |

---

## 14. Sanitización de salida

Matriz de campos en RPC contract doc.

Reglas duras:

- **UUID internos:** nunca salen del boundary persistencia → portal
- **Storage keys / checksums:** no en listados; owner detail only bajo política
- **Audit state:** `sanitizeAuditState()` strips storageKey, checksum, tin, ssn, ein
- **Submission public view:** `toSubmissionPublicView()` — subset campos

---

## 15. Audit-on-read (recomendación — no implementar LC-13A)

| Evento futuro | Recomendación | Fase |
|---------------|---------------|------|
| W-9 read by staff | Audit `w9_viewed` | LC-14+ |
| W-9 download | Audit `w9_downloaded` | Signed URL ticket |
| Denied read attempt | Audit `access_denied` (careful volume) | ⏳ PO |
| Deleted submission read | Audit owner access | LC-14+ |
| Manager fiscal read | Optional ops audit | ⏳ PO |

**No implementar** audit-on-read en LC-13A/LC-13B. Documentar costo volumen + privacidad. Ticket futuro dedicado.

---

## 16. Arquitectura recomendada: RLS + RPC

### Patrones evaluados

| Pattern | Verdict |
|---------|---------|
| **A — RPC invoker + RLS** | ✅ **Preferido** |
| **B — RPC definer + internal auth** | Solo con justificación estricta |
| **C — RPC sola sin RLS** | ❌ Rechazado |

### Recomendación

1. **RLS como defensa base** en todas las tablas legal_*
2. **RPC read-only** como boundary de contrato + paginación + sanitización
3. **`SECURITY INVOKER`** por defecto
4. **`SECURITY DEFINER`** solo si invoker insufficient — requiere: `SET search_path = public`, schema qualification, identity checks, no dynamic SQL, minimal grants

### Flujo

```
Browser → ApiClient.rpc('legal_read_*') → PostgREST → RPC (invoker)
  → RLS policies filter rows → envelope → TS adapter validates → domain mapper
```

Post-fetch TS filtering (LC-11 supabase adapter today) debe **migrar a SQL-side** en LC-13B para evitar data leakage en transport.

---

## 17. Dependencias

| Dependencia | Estado | Bloqueante LC-13B? |
|-------------|--------|-------------------|
| LC-12 schema local | ✅ versionada, no aplicada | Sí — apply local first |
| `auth.uid()` | ✅ V1 Supabase auth | No |
| `is_staff()` / `is_staff_management()` | ✅ V1 Postgres | No |
| `dj_profiles.role` | ✅ V1 | No |
| `client_profiles` | ✅ V1 | No |
| Session → `LegalReadAccessContext` resolver | ❌ ausente | **Sí — ticket previo o LC-13B-0** |
| Staff membership formal table | Parcial (`dj_profiles`) | No |
| Artist/client profile ID → recipient_id map | Parcial domain | Sí |
| RLS helper SQL functions | ❌ ausente | LC-13B |
| Read RPC SQL (7) | ❌ ausente | LC-13B |
| DB test harness local Supabase | ❌ ausente | LC-13B |
| Signed URL RPC | ❌ ausente | No (futuro) |
| Seller operational entity linkage | ⏳ undefined | Parcial — no bloquea core |

### Recomendación de ticket previo (LC-13B-0)

**`LC-13B-0 — Legal Read Identity Resolver`** (~1 ticket):

- Map `auth.uid()` + profiles → `LegalReadAccessContext`
- Unit tests sin DB
- Document bridge from `LegalWorkflowActor`

Sin esto, RPC no puede autorizar de forma confiable.

---

## 18. Threat model

| Amenaza | Impacto | Mitigación | Fase |
|---------|---------|------------|------|
| Role spoofing (`previewRole`) | Escalación vertical | Ignorar client role; DB staff check | LC-13B |
| Recipient ID spoofing | Horizontal escalation | Session profile prevails; RLS recipient match | LC-13B |
| Horizontal privilege (Artist A→B) | Fiscal leak | RLS + not-found | LC-13B tests |
| Vertical (Client→Staff) | Full leak | `is_staff` gate | LC-13B |
| UUID enumeration | Internal exposure | Never expose UUID | LC-13B sanitize |
| Business ID enumeration | Reconnaissance | not-found for foreign | LC-13B |
| Fiscal document leakage | Compliance | RLS fiscal families | LC-13B |
| Storage key leakage | Bucket access | Omit from RPC output | LC-13B |
| Checksum leakage | Integrity attacks | Owner detail only | LC-13B |
| Audit metadata leakage | Ops intelligence | Projection layer | LC-13B |
| Soft-deleted submission leak | Data retention breach | Owner-only + RLS | LC-13B |
| Cursor tampering | Skip/access rows | Signed opaque cursor | LC-13B |
| Oversized queries | DoS | limit 1–100 | LC-13B |
| Malicious filters | Injection | Typed params; no dynamic SQL | LC-13B |
| Security definer abuse | Bypass RLS | Prefer invoker | LC-13B |
| search_path injection | Privilege escalation | SET search_path fixed | LC-13B if definer |
| Stale JWT role claims | Wrong access | DB role prevails | LC-13B-0 |
| Cross-portal access | Wrong nav data | Profile class gate | LC-13B |
| Browser bypass UI | Direct RPC abuse | Server-side auth | LC-13B |

---

## 19. Test plan futuro (LC-13B)

Matriz mínima documentada — **no tests implementados LC-13A**.

| Suite | Cases |
|-------|-------|
| Owner | list/get all; fiscal; deleted |
| Manager | ops scope; no deleted |
| Seller | no fiscal; no foreign; no audit |
| Artist | own visible; foreign ∅ |
| Client | own visible; artist fiscal hidden |
| Security | spoof recipient; previewRole ignored; no UUID; no storage path; cursor invalid; limit invalid; SQL injection strings; cross-role; soft-delete |

Herramienta: local Supabase + pgTAP or integration suite mirroring `legal-read-persistence-hardening.test.ts`.

---

## 20. Riesgos remanentes

1. LC-11 Supabase adapter filtra **post-fetch** — leakage risk until LC-13B moves auth to SQL
2. Dual identity models sin bridge
3. Seller operational scope undefined
4. Submission denormalization drift
5. No PostgreSQL validation of LC-12 schema yet
6. Keyset cursor migration from offset lab
7. Manager deleted submission policy asymmetry (by design LC-11)
8. Audit-on-read volume if enabled later

---

## 21. Decisiones propuestas (requieren aprobación PO)

| # | Decisión | Recomendación |
|---|----------|---------------|
| 1 | RLS + RPC, no RPC sola | ✅ Aprobar patrón A |
| 2 | Fuente identidad | `auth.uid()` + profile lookup + `is_staff*` |
| 3 | Manager fiscal | ✅ Permitido (LC-10 PO baseline) |
| 4 | Seller operativo | Templates públicos; sin fiscal; ⏳ ops linkage |
| 5 | Artist | Own-only recipient match |
| 6 | Client | Own-only; sin fiscal ajeno |
| 7 | Audit raw | Staff owner/manager only |
| 8 | Portal activity | Proyección sanitizada (`LegalAuditEventPublicView`) |
| 9 | Paginación | Keyset DB cursors |
| 10 | UUID | Oculto siempre en portal boundary |
| 11 | Signed URL | Ticket futuro separado |
| 12 | Security invoker | Default invoker |
| 13 | Dependency tickets | LC-13B-0 identity resolver antes o paralelo día 1 |
| 14 | LC-13B start | **Condicional** — autorizar tras aprobar LC-13A + LC-13B-0 scope |

---

## 22. Preguntas abiertas

1. **Seller:** ¿Qué entidades operativas (non-fiscal) puede listar sin relación persistida explícita?
2. **Manager deleted submissions:** ¿Mantener deny (LC-11) o ampliar read-only?
3. **Client audit timeline:** ¿Ninguno vs proyección mínima de contratos propios?
4. **7 vs 5 RPCs:** ¿PO confirma 7 funciones SQL para parity LC-11 transport?
5. **Submission RLS:** ¿Aprobar estrategia híbrida EXISTS + denormalized column?
6. **Audit-on-read:** ¿Qué eventos son mandatorios vs opcionales?

---

## 23. Bloqueadores

| Bloqueador | Severidad | Resolución |
|------------|-----------|------------|
| Identity resolver ausente | Alta | LC-13B-0 |
| LC-12 migration not applied locally | Media | PO authorize local apply (separate ticket) before RLS tests |
| Post-fetch auth in supabase adapter | Alta | LC-13B SQL-side filtering |

**LC-13B puede comenzar** discovery de implementación tras aprobación PO de LC-13A, pero **implementación** debe iniciar con LC-13B-0 + local migration apply gate.

---

## 24. Fase siguiente

| Fase | Ticket | Entregable |
|------|--------|------------|
| LC-13B-0 | Identity resolver | TS resolver + tests |
| LC-13B | RLS + Read RPC SQL | 7 functions + policies + local apply |
| LC-13C | Signed URL + storage | Future |
| LC-14 | Audit-on-read | Future |

---

## 25. QA (LC-13A closeout)

| Check | Resultado |
|-------|-----------|
| Solo docs LC-13A en diff | ✓ (3 archivos) |
| Código modificado | 0 |
| SQL modificado | 0 |
| typecheck | exit 0 |
| Suite | 1029 PASS |
| git diff --check | limpio |
| HTTP × 5 | 200 OK |
| RLS/RPC creados | 0 |
| Migration aplicada | NO |
| Commit | SÍ (closeout autorizado PO) |

---

## 26. Confirmación operativa

| Acción | Estado |
|--------|--------|
| Discovery docs | ✅ Creados |
| Commit | **SÍ** (closeout autorizado PO) |
| Push | **NO** |
| Merge | **NO** |
| PR | **NO** |
| Deploy | **NO** |
| Migration apply | **NO** |
| Supabase remoto | **NO** |
| LC-13B | **NO iniciado** (bloqueado hasta LC-13B-0) |

---

## 27. Aprobación Product Owner (TICKET-V2-LEGAL-CENTER-LC-13A-CLOSEOUT-AND-COMMIT-001)

**Estado final:** LC-13A CERRADO — DISCOVERY APROBADO POR EL PRODUCT OWNER

| # | Decisión aprobada |
|---|-------------------|
| 1 | **RLS base + RPC security invoker** como arquitectura aprobada |
| 2 | **RPC-only rechazada** — RLS obligatoria como defensa base |
| 3 | **Navegador no es autoridad de identidad** — autorización server-side únicamente |
| 4 | `previewRole`, query strings, rutas y **client-supplied `recipient_id` no son confiables** |
| 5 | **Owner** con lectura fiscal autorizada |
| 6 | **Manager** con acceso fiscal conforme decisión aprobada LC-10 |
| 7 | **Seller** sin acceso a W-9, submissions fiscales ni audit sensible |
| 8 | **Artist own-only** |
| 9 | **Client own-only** |
| 10 | **Submissions ownership híbrido:** relación padre canónica + recipient denormalizado como apoyo; inconsistencia → denegación |
| 11 | **UUID internos nunca expuestos** al portal |
| 12 | **storage bucket, object key y checksum** no expuestos en listados del portal |
| 13 | **`LegalAuditEvent` interno** separado de **Legal Activity projection** UI |
| 14 | **Keyset pagination** aprobada conceptualmente (LC-13B) |
| 15 | **Signed URLs** — ticket posterior (no LC-13B read RPC) |
| 16 | **Security definer no aprobado** de forma genérica |
| 17 | **Audit-on-read** — LC-14 o fase posterior |
| 18 | **LC-13B bloqueado** hasta resolver identity bridge |

**Siguiente paso autorizado:** LC-13B-0 — Identity Bridge Discovery & Contract

**No autorizado:** LC-13B implementación (RLS/RPC SQL) hasta completar LC-13B-0.

Commit local autorizado: `docs(v2-legal): approve read security and rpc discovery` · sin push · sin merge · sin PR · sin deploy.

---

**Estado final:** LC-13A CERRADO — DISCOVERY APROBADO POR EL PRODUCT OWNER
