# TICKET-V2-LEGAL-CENTER-LC-13B-0-IDENTITY-BRIDGE-DISCOVERY-AND-CONTRACT-001

## Estado

**LC-13B-0 CERRADO — DISCOVERY APROBADO POR EL PRODUCT OWNER**

Discovery y documentación únicamente · **sin código runtime** · **sin SQL** · **sin RLS** · **sin RPC** · **sin migration apply** · **sin Supabase remoto** · **sin commit** · **LC-13B no iniciado**.

| Campo | Valor |
|-------|-------|
| Ticket | LC-13B-0 — Identity Bridge Discovery & Contract |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `fdbcba50dfcbf20a941ebe4e6a39cc4fb6d3e980` |
| Commit baseline | `docs(v2-legal): approve read security and rpc discovery` |
| Suite baseline | 1029 PASS |
| Fecha discovery | 2026-07-21 |
| Bloqueador LC-13A | Identity bridge — **este ticket** |
| Prerequisito LC-13B | Aprobación PO de LC-13B-0 + implementación bridge |

---

## 1. Baseline

| Check | Resultado |
|-------|-----------|
| Rama | `plan/v2-phase-4-api-client` ✓ |
| HEAD | `fdbcba50` ✓ |
| Working tree (pre-discovery) | limpio ✓ |
| typecheck | exit 0 ✓ |
| Suite | 1029 PASS ✓ |

---

## 2. Objetivo

Diseñar el **bridge canónico** que transformará:

```
Auth + Session + Portal Context + Role Resolution + Profile Ownership
                              ↓
                   LegalReadAccessContext
```

LC-13B-0 define contratos, dependencias, ownership, secuencia, errores, invariantes, amenazas y test plan.

**No implementa runtime.**

---

## 3. Exclusiones confirmadas

| Prohibido | Estado |
|-----------|--------|
| TypeScript funcional nuevo | NO |
| SQL / migrations | NO |
| RLS / RPC | NO |
| Supabase remoto | NO |
| UI / portales | NO |
| Tests runtime nuevos | NO |
| Tablas nuevas | NO |
| LC-13B | NO iniciado |
| Commit / push / merge / PR / deploy | NO |

---

## 4. Fuentes inspeccionadas

### Auth & Session (V2)

| Path | Contenido |
|------|-----------|
| `shared/auth/runtime/auth-port.ts` | Auth identifica; no resuelve roles |
| `shared/auth/AUTH-SESSION-BOUNDARY.md` | Auth ≠ Session ≠ Permissions |
| `shared/session/runtime/session-service.ts` | Opaque Authorization header |
| `shared/session/runtime/session-registry.ts` | `documentedRole` en registry |
| `shared/api/runtime/session-reader-port.ts` | `getActorType`: guest \| authenticated only |

### Permissions & Snapshot

| Path | Contenido |
|------|-----------|
| `shared/services/access-snapshot/access-snapshot-service.ts` | RPC `mdj_access_snapshot` |
| `shared/services/access-snapshot/access-snapshot-types.ts` | Payload + profile_kind |
| `shared/services/access-permissions/access-permission-orchestrator.ts` | Snapshot → PermissionSnapshot |
| `shared/permissions/runtime/profile-matrix.ts` | `staff.owner` → `staff_owner` |
| `shared/permissions/runtime/role-matrix.ts` | `DocumentedRoleId` catalog |

### Legal (tres vocabularios paralelos)

| Path | Rol vocabulary |
|------|----------------|
| `shared/services/legal/persistence/legal-read-access-context.ts` | `owner`/`manager`/`seller` + `actorType` |
| `shared/services/legal/in-memory/legal-access-policy.ts` | `staff_owner`/`staff_manager`/… |
| `shared/services/legal/workflows/legal-w9-workflow-actor.ts` | Short staff roles |
| `staff/legal/staff-legal-provider-wire.ts` | **URL previewRole** (no session) |

### LC-13A (PO approved)

- `docs/V2/TICKETS/TICKET-V2-LEGAL-CENTER-LC-13A-READ-SECURITY-RPC-DISCOVERY-001.md`
- `docs/V2/LEGAL/LC-13A-READ-AUTHORIZATION-MATRIX.md`
- `docs/V2/LEGAL/LC-13A-RPC-CONTRACT-MATRIX.md`

### V1 reference (no port directo)

- `web/mdj-identity.js` — `mdjClassifyPlatformIdentity()` from DB rows

### Documentos LC-13B-0 creados

- `docs/V2/LEGAL/LC-13B-0-ACCESS-CONTEXT-CONTRACT.md`
- `docs/V2/LEGAL/LC-13B-0-IDENTITY-FLOW.md`

---

## 5. Problema

LC-13A bloqueó LC-13B porque RLS/RPC requieren resolver **server-side**:

- quién es el usuario (`auth.uid()`)
- qué portal usa (UX vs identidad real)
- qué rol posee (staff band)
- qué perfil controla (legal recipient ID)
- qué recursos le pertenecen (ownership)

**Hoy:** `LegalReadAccessContext` se construye solo con factories de lab (`createStaffOwnerReadContext('STAFF-OWNER-001')`). No existe bridge desde Session.

**Riesgo activo:** `staff-legal-provider-wire.ts` usa URL `previewRole` — explícitamente **no confiable** per LC-13A PO.

---

## 6. Contrato objetivo

Ver **`docs/V2/LEGAL/LC-13B-0-ACCESS-CONTEXT-CONTRACT.md`**.

Resumen campos `LegalReadAccessContext` (existente LC-11):

| Campo | Obligatorio | Fuente bridge |
|-------|-------------|---------------|
| `actorType` | Sí | `profile.kind` |
| `role` | Sí | `documentedRole` → short map |
| `portal` | Sí | Effective portal (not URL alone) |
| `actorId` | Sí | Legal recipient / staff actor ID |
| `recipientScope` | Artist sí | Own legal profile ID |

Campos evaluados y **rechazados** para extensión del tipo: `is_staff`, `is_owner`, etc. — usar guards existentes.

---

## 7. Fuente de identidad

### Opciones analizadas

| Option | Verdict |
|--------|---------|
| A — `auth.uid()` alone | ❌ Insufficient — no role/recipient |
| B — `auth.uid()` + profile lookup | ✅ Partial — needs snapshot for staff band |
| C — `auth.uid()` + membership lookup | ✅ Same as B for MDJB V1 model |
| **D — Combinación controlada** | ✅ **Recomendada** |

### Combinación aprobada (propuesta PO)

1. `session.user.userId` (= `auth.uid()`)
2. `mdj_access_snapshot` via `AccessPermissionOrchestrator` (roles/capabilities)
3. **Nuevo:** legal profile lookup — `auth.uid()` → `ART-*` / `CLI-*` / staff actor ID
4. Portal shell — hint only; validated against snapshot

**No usar:** JWT `app_metadata.role` · `previewRole` · client `recipient_id` params.

---

## 8. Portales

| Portal | ¿Determina permisos? | Notas |
|--------|---------------------|-------|
| `staff` | Parcial | Staff band from snapshot; seller ≠ owner |
| `artist` | Parcial | Requires artist profile + own scope |
| `client` | Parcial | Requires client profile; no fiscal |

**Portal = UX shell.** **Identidad real = snapshot + profile lookup.**

| Edge case | Comportamiento propuesto |
|-----------|-------------------------|
| Mismo usuario, varios perfiles | `identity_ambiguous` |
| Owner abre portal Artist | `portal_mismatch` o staff cross-read capability — **PO decision** |
| Artist abre portal Client | `portal_mismatch` → forbidden |
| Flag-off lab default staff→seller | **Dangerous** — bridge must require snapshot or fail closed |

Detalle: `docs/V2/LEGAL/LC-13B-0-IDENTITY-FLOW.md` § Portal scenarios.

---

## 9. Ownership

| Entity | Ownership key | Bridge supplies |
|--------|---------------|-----------------|
| `LegalDocumentInstance` | `recipient_type` + `recipient_id` | `actorId` / `recipientScope` |
| `LegalW9Request` | `recipient_type` + `recipient_id` | Same |
| `LegalDocumentSubmission` | Denorm + parent EXISTS (LC-13A hybrid) | Scope for RLS |
| `LegalAuditProjection` | Filter via `canReadAuditEventForContext` | actor + recipient from context |

| Ownership state | Behavior |
|-----------------|----------|
| Direct match | Allow |
| Derived match | Allow if parent valid |
| Ambiguous | `identity_ambiguous` |
| Invalid / spoofed param | `not found` or `forbidden` |
| Missing profile | `profile_missing` |

---

## 10. Staff (Owner / Manager / Seller)

| Pregunta | Respuesta |
|----------|-----------|
| ¿Dónde vive el rol? | Postgres `dj_profiles.role` → `mdj_access_snapshot.profile_kind` + `role` |
| ¿Cómo se resuelve? | `mapAccessSnapshotToProfileResolveInput()` → `resolveDocumentedRole()` |
| ¿Sincronización? | Re-snapshot on login/refresh — no localStorage cache |
| ¿JWT obsoleto? | Opaque token; snapshot RPC is operational truth |
| ¿Desaparece rol? | `role_unresolved`; deny reads |
| ¿Caché insegura? | **Prohibida** — no previewRole override |

Mapping: `staff_owner`→`owner`, `staff_manager`→`manager`, `staff_seller`→`seller`.

---

## 11. Artist y Client

| Pregunta | Respuesta |
|----------|-----------|
| artist_profile_id | **Ausente** — lookup `auth.uid()` → DJ profile → legal `ART-*` recipient |
| client_profile_id | **Ausente** — lookup → `client_profiles` → `CLI-*` |
| Validación ownership | `matchesRecipientScope(context, row.recipient_id)` |
| Perfiles múltiples | `identity_ambiguous` |
| Sin perfil | `profile_missing` → deny |

**Invariante:** `actorId` for artist/client MUST be legal business recipient ID, not raw auth uid.

---

## 12. Secuencia de resolución

9 pasos documentados con diagrama en **`docs/V2/LEGAL/LC-13B-0-IDENTITY-FLOW.md`**.

1. Request autenticada
2. SessionSnapshot
3. PermissionSnapshot / snapshot RPC
4. mapAccessSnapshotToProfileResolveInput
5. resolveDocumentedRole
6. Legal profile lookup (**NEW**)
7. Portal shell validation
8. Build LegalReadAccessContext
9. Allow or structured error

---

## 13. Errores (catálogo bridge)

| Code | When | Maps to read layer |
|------|------|-------------------|
| `identity_unavailable` | No session / snapshot fail | `persistence_identity_unavailable` |
| `identity_ambiguous` | Multiple profiles | `persistence_identity_unavailable` |
| `role_unresolved` | guest / unknown role | `persistence_role_unresolved` |
| `profile_missing` | No DJ/client profile | `persistence_identity_unavailable` |
| `ownership_missing` | No recipient scope | `persistence_access_forbidden` |
| `ownership_invalid` | Scope ≠ row | `persistence_entity_not_found` |
| `membership_missing` | No MDJB/profile row | `persistence_identity_unavailable` |
| `portal_mismatch` | Shell vs identity conflict | `persistence_access_forbidden` |
| `session_expired` | Session invalid | `persistence_identity_unavailable` |
| `contract_violation` | Invariant break | `persistence_contract_violation` |

| Class | Use |
|-------|-----|
| **forbidden** | Global op / portal mismatch |
| **not found** | Foreign resource (anti-enumeration) |
| **unauthorized** | No session / expired |

---

## 14. Threat model

| Amenaza | Impacto | Mitigación | Fase |
|---------|---------|------------|------|
| previewRole spoofing | Vertical escalation | Ignore URL; snapshot only | LC-13B impl |
| Portal spoofing | Wrong access | Effective identity > shell | LC-13B impl |
| Stale JWT role | Wrong band | Snapshot RPC truth | Existing |
| Membership race | Brief wrong access | Re-resolve per read boundary | LC-13B |
| Profile duplication | Ambiguous access | `identity_ambiguous` | LC-13B |
| Role escalation | Fiscal leak | `is_staff_management` in SQL | LC-13B RLS |
| Ownership forgery | Cross-recipient read | Server actorId; RLS | LC-13B |
| Cross-portal access | Policy bypass | `portal_mismatch` | LC-13B |
| Deleted profile | Orphan reads | `profile_missing` | LC-13B |
| Orphan records | Scope leak | not found | LC-13B RLS |
| Cache poisoning | Stale role | No client role cache | LC-13B |
| Replay | Session reuse | Standard session TTL | Session MOD-002 |

---

## 15. Dependencias

| Dependencia | Estado | Bloqueante LC-13B? |
|-------------|--------|-------------------|
| Session MOD-002 | ✅ Disponible | No |
| Opaque Authorization | ✅ Disponible | No |
| `mdj_access_snapshot` RPC | ✅ Disponible (V2 client) | No |
| Permission orchestrator | ✅ Disponible | No |
| `LegalReadAccessContext` + guards | ✅ Disponible | No |
| **Identity bridge function** | ❌ Ausente | **Sí** |
| **Legal profile lookup** | ❌ Ausente | **Sí** |
| `auth.uid()` → recipient ID | ❌ Ausente | **Sí** |
| Staff legal wire (session) | ❌ Uses URL preview | **Sí** |
| LC-12 migration applied | ❌ Not applied | Sí for RLS tests |
| V1 `mdj-identity` port | ❌ Not in MigracionV2 | No — snapshot replaces |

---

## 16. Test plan (documental — no runtime)

| Case | Expected |
|------|----------|
| Owner → staff portal | context: staff/owner; fiscal allowed |
| Owner → artist portal | portal_mismatch or staff cross-read (PO) |
| Manager → staff portal | staff/manager; no deleted submissions |
| Seller → client portal | portal_mismatch → forbidden |
| Artist → own docs | actorId matches recipient |
| Artist → foreign docs | not found |
| Client → own docs | client scope |
| Client → foreign docs | not found |
| Session expired | identity_unavailable |
| Role ambiguous | identity_ambiguous |
| Ownership broken (denorm drift) | deny / not found |
| Profile missing | profile_missing |
| previewRole=owner as seller session | **ignored** — seller context |

Implementación: LC-13B-1 (bridge unit tests) + LC-13B RLS integration.

---

## 17. Recomendaciones

1. **Implementar** `resolveLegalReadAccessContextFromSession()` en LC-13B (single module).
2. **Añadir** legal profile lookup RPC or shared service (`auth.uid()` → recipient business ID).
3. **Unificar** role mappers: Session `DocumentedRoleId` → LegalRead + LegalViewer + LegalWorkflowActor.
4. **Reemplazar** URL preview in `staff-legal-provider-wire.ts` with bridge (LC-13B).
5. **Fail closed** when snapshot permissions disabled in non-lab environments.
6. **No LC-13B-1 needed** if LC-13B bundles bridge + lookup + tests — unless PO splits tickets.

---

## 18. Bloqueadores

| Bloqueador | Resolución |
|------------|------------|
| No bridge module | LC-13B implementation |
| No legal profile lookup | New RPC/service in LC-13B |
| Three role vocabularies | Unified mapper in LC-13B |
| URL previewRole in staff legal | Wire to session bridge |
| LC-12 not applied | Separate PO gate before RLS integration tests |

**LC-13B NO puede comenzar** hasta aprobación PO de este discovery **y** decisión sobre legal profile lookup shape.

**LC-13B-1 NO requerido** si LC-13B scope incluye bridge + lookup explícitamente.

---

## 19. Siguiente fase

| Ticket | Entregable | Gate |
|--------|------------|------|
| **LC-13B-0** (this) | Discovery + contract | PO approval |
| **LC-13B** | Bridge impl + legal profile lookup + role mappers + wire staff legal | PO + LC-13B-0 approved |
| **LC-13B RLS/RPC** | SQL policies + 7 read RPCs | Bridge live + LC-12 local apply |

---

## 20. QA (LC-13B-0 closeout)

| Check | Resultado |
|-------|-----------|
| Docs creados | 3 archivos |
| Código modificado | 0 |
| SQL modificado | 0 |
| typecheck | exit 0 |
| Suite | 1029 PASS |
| git diff --check | limpio |
| HTTP × 5 | 200 OK |
| Commit | SÍ (closeout autorizado PO) |

---

## 21. Confirmación operativa

| Acción | Estado |
|--------|--------|
| Discovery docs | ✅ |
| Commit | **SÍ** (closeout autorizado PO) |
| Push | **NO** |
| LC-13B | **NO iniciado** |
| RLS/RPC/SQL/runtime | **NO** |

---

## 22. Aprobación Product Owner (TICKET-V2-LEGAL-CENTER-LC-13B-0-CLOSEOUT-AND-COMMIT-001)

**Estado final:** LC-13B-0 CERRADO — DISCOVERY APROBADO POR EL PRODUCT OWNER

| # | Decisión aprobada |
|---|-------------------|
| 1 | **`LegalReadAccessContext` existente** permanece como contrato objetivo (LC-11) |
| 2 | **No se añaden flags booleanos redundantes** al contexto |
| 3 | **`auth.uid()`** se obtiene mediante `session.user.userId` |
| 4 | **`PermissionSnapshot.documentedRole`** es la fuente del rol documentado |
| 5 | **`previewRole`, rutas, portal shell y query params no son autoridad** |
| 6 | **Portal es contexto UX**, no identidad ni autorización |
| 7 | **`actorId` legal debe ser business recipient ID:** `ART-*` Artist · `CLI-*` Client · ID staff canónico Staff |
| 8 | **Raw auth UUID no debe usarse** como recipient ID legal |
| 9 | **Staff role mapping:** `staff_owner` → `owner` · `staff_manager` → `manager` · `staff_seller` → `seller` |
| 10 | **Artist y Client** requieren lookup canónico: auth user → legal profile business ID |
| 11 | **Sin perfil:** `profile_missing` |
| 12 | **Perfiles múltiples incompatibles:** `identity_ambiguous` |
| 13 | **Submissions ownership híbrido:** parent relationship autoridad · recipient denormalizado contraste · inconsistencia → denegación |
| 14 | **Legal audit portal access** usa proyección segura, no audit crudo |
| 15 | **LC-13B puede implementar** bridge + profile lookup en un solo ticket |
| 16 | **LC-13B no incluirá:** RLS · RPC SQL · migration apply · Supabase remoto · producción |

**Siguiente paso autorizado (post-commit):** LC-13B — Identity Bridge & Legal Profile Lookup Implementation

**No autorizado:** LC-13B implementado · RLS · RPC SQL · migration apply

Commit local autorizado: `docs(v2-legal): approve identity bridge discovery` · sin push · sin merge · sin PR · sin deploy.

---

**Estado final:** LC-13B-0 CERRADO — DISCOVERY APROBADO POR EL PRODUCT OWNER
