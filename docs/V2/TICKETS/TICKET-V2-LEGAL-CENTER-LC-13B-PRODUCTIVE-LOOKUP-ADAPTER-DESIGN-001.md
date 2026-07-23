# TICKET-V2-LEGAL-CENTER-LC-13B-PRODUCTIVE-LOOKUP-ADAPTER-DESIGN-001

## Estado

**LC-13B PRODUCTIVE LOOKUP ADAPTER DESIGN COMPLETADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**

| Campo | Valor |
|-------|-------|
| Ticket | LC-13B — Productive `LegalProfileLookupPort` adapter design |
| Modo | Diseño técnico + discovery dirigido — **sin implementación** |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `3c36a5bc31ef2b41e74bb292e095bf16b03bcaa9` |
| Commit | ❌ NO autorizado |
| Producción | ❌ NOT_AUTHORIZED |
| Bootstrap legacy | **BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT** |

---

## 1. Objetivo

Especificación ejecutable para un adapter productivo **`SupabaseLegalProfileLookupAdapter`** que resuelva identidad legal vía infraestructura canónica V2 **sin reescribir**:

- `LegalReadAccessContext`
- `resolveLegalReadAccessContextFromSession`
- RLS LC-13A
- 7 RPC read LC-13A

---

## 2. Inventario exacto del puerto (FASE 2)

### 2.1 Ubicación

```
MiamiDJBeat-MigracionV2/shared/services/legal/persistence/identity/legal-profile-lookup-port.ts
```

### 2.2 Firma actual

```typescript
LegalProfileLookupPort = {
  lookup(input: LegalProfileLookupInput): LegalProfileLookupResult;
}

LegalProfileLookupInput = {
  authUserId: string;
  profileKind: Exclude<ProfileKind, 'guest'>;
  documentedRole: DocumentedRoleId;
}

LegalProfileLookupRecord = {
  legalRecipientId: string;      // → LegalReadAccessContext.actorId
  legalProfileId?: string;       // optional correlation
}

LegalProfileLookupResult =
  | { ok: true; value: LegalProfileLookupRecord }
  | { ok: false; code: 'profile_missing' | 'identity_ambiguous'; message: string }
```

### 2.3 Comportamiento

| Aspecto | Valor |
|---------|-------|
| Sync/async | **Síncrono** — bridge llama inline |
| Nullable | Input `authUserId` validado upstream; output `legalProfileId` opcional |
| Errores | Solo 2 códigos en port; bridge mapea a `profile_missing` / `identity_ambiguous` |

### 2.4 Consumidores

| Consumidor | Archivo | Wiring |
|------------|---------|--------|
| Identity bridge | `legal-identity-bridge.ts` | Inyectado en `LegalIdentityBridgeInput` |
| Staff legal wire | `staff/legal/staff-legal-provider-wire.ts` | `DEFAULT_MEMORY_LEGAL_PROFILE_LOOKUP` |
| Unit tests | `tests/unit/legal-identity-bridge.test.ts` | `createMemoryLegalProfileLookup()` |

**Artist/Client portal legal wires:** no wired hoy — mismo patrón futuro vía provider factory.

### 2.5 Implementaciones actuales

| Implementación | Tipo | Archivo |
|----------------|------|---------|
| `createMemoryLegalProfileLookup` | Memory/mock | `memory-legal-profile-lookup.ts` |
| `DEFAULT_MEMORY_LEGAL_PROFILE_LOOKUP` | Singleton lab | mismo |

Staff mapping estático: `STAFF-OWNER-001`, `STAFF-MANAGER-001`, `STAFF-SELLER-001`. Artist/client: bindings `authUserId` → `ART-*` / `CLI-*`.

### 2.6 Clasificación del contrato

**EXTEND_MINIMALLY**

| Elemento | Decisión |
|----------|----------|
| Método `lookup()` sync | **KEEP_AS_IS** — bridge no se reescribe |
| Tipos input/output | **KEEP_AS_IS** |
| Códigos error port | **EXTEND_MINIMALLY** — opcional `lookup_unavailable` en ticket impl (mapeado fail-closed) |
| Resolución RPC async | **EXTEND** vía **prefetch en orchestrator** → cache sync readable por adapter |

**Justificación:** el bridge es sync; un adapter que llame RPC inline rompería la firma. La resolución productiva debe ocurrir **antes** del bridge (session permission attach), no dentro de `lookup()` blocking.

---

## 3. Diseño del adapter productivo (FASE 3)

### 3.1 Nombre y ubicación recomendados

| Campo | Valor |
|-------|-------|
| **Nombre** | `SupabaseLegalProfileLookupAdapter` |
| **Módulo futuro** | `MiamiDJBeat-MigracionV2/shared/services/legal/persistence/identity/supabase-legal-profile-lookup.ts` |
| **Factory** | `createSupabaseLegalProfileLookup(input: { readonly resolutionCache: LegalProfileResolutionCachePort })` |

### 3.2 Dependencias permitidas

| Permitido | Prohibido |
|-----------|-----------|
| `LegalProfileResolutionCachePort` (lectura sync) | `supabase-js` directo |
| Tipos port existentes | SELECT directo a tablas |
| Normalizers puros | JWT claims como autoridad |
| Correlation desde `RequestContext` | Duplicar reglas RLS |
| | Duplicar `PermissionSnapshot` construction |
| | Permisos en portal UI |

### 3.3 Patrón: prefetch + sync cache (no reescribir bridge)

```
AccessPermissionOrchestrator (async)
  → mdj_access_snapshot (roles)
  → legal_resolve_profile_access (business entity)
  → write LegalProfileResolutionCache[userId+profileKind]
        ↓
resolveLegalReadAccessContextFromSession (sync)
  → SupabaseLegalProfileLookupAdapter.lookup()
  → read cache ONLY (fail-closed on miss)
```

### 3.4 Políticas operativas

| Política | Recomendación |
|----------|---------------|
| **Timeout RPC prefetch** | 3000ms default · alineado `AccessSnapshotFetchOptions` |
| **Cancelación** | Propagar `AbortSignal` del session refresh |
| **Retry** | Solo idempotent prefetch · max 1 retry · no elevar privilegios |
| **Cache** | Session-scoped · keyed `(authUserId, profileKind, documentedRole)` · invalidar on logout/expiry/role change |
| **Logging** | Structured · correlation ID · **no** log fiscal data |
| **Fail-closed** | Cache miss / RPC fail → `profile_missing` · Staff wire → seller (existente) |

---

## 4. Contrato RPC de lookup (FASE 4)

### 4.1 Decisión A / B / C

| Opción | Veredicto |
|--------|-----------|
| **A. Nueva RPC legal** | ✅ **SÍ** — `legal_resolve_profile_access` |
| **B. Extender `mdj_access_snapshot`** | ❌ **NO** — mezcla concerns; snapshot ya estable para MOD-003 |
| **C. Composición** | ✅ **RECOMENDADO** — snapshot para roles + RPC legal para business entity IDs |

**Justificación:** `mdj_access_snapshot` retorna `profile_kind`, `role`, `artist_tier`, flags — **no** `ART-*` / `CLI-*` / `STAFF-*` legal actor IDs requeridos por LC-13A RLS (`recipient_id` matching).

### 4.2 RPC recomendada: `legal_resolve_profile_access`

| Atributo | Valor |
|----------|-------|
| Security | `SECURITY DEFINER` acotado · `auth.uid()` obligatorio |
| Invoker | `authenticated` only |
| Transport | `ApiClient.rpc()` vía Supabase adapter · **no** SDK directo |

### 4.3 Request conceptual

| Campo | Origen | Autoridad |
|-------|--------|-----------|
| *(auth identity)* | Implícito `auth.uid()` | ✅ Servidor |
| `source_portal` | Session shell (`staff`/`artist`/`client`) | Validación mismatch |
| `correlation_id` | RequestContext opcional | Audit only |
| ~~`actor_id`~~ | — | ❌ **PROHIBIDO** en request |
| ~~`recipient_id`~~ | — | ❌ **PROHIBIDO** |

Body vacío `{}` aceptable si portal se infiere de perfil DB — preferir validación server-side portal vs profile kind.

### 4.4 Response conceptual (success)

```json
{
  "ok": true,
  "actor_type": "staff|artist|client",
  "actor_role": "owner|manager|seller|artist|client",
  "business_entity_id": "STAFF-OWNER-001|ART-xxx|CLI-xxx",
  "recipient_scope": "ART-xxx|null",
  "profile_status": "active|inactive",
  "revision": "2026-07-22T…",
  "mdjb_id": "MDJB-…-M|A|C|S"
}
```

**No devolver:** tokens, storage keys, TIN/fiscal payloads, permisos arbitrarios, PII innecesaria.

### 4.5 Response failure

```json
{ "ok": false, "code": "profile_missing|identity_ambiguous|portal_mismatch|unauthenticated", "reason": "…" }
```

---

## 5. Matriz PermissionSnapshot → LegalReadAccessContext (FASE 5)

Bridge ya mapea role vía `mapDocumentedRoleToLegalReadRole`. Tabla completa incluyendo guards existentes:

| Actor / estado | documentedRole | actorType | role | actorId source | recipientScope | canReadFiscal | canReadAudit | canReadTemplates (W-9) | Fail-closed |
|----------------|----------------|-----------|------|----------------|----------------|---------------|--------------|------------------------|-------------|
| Owner | staff_owner | staff | owner | RPC/cache STAFF-* | — | ✅ | ✅ full | ✅ | — |
| Manager | staff_manager / staff_admin | staff | manager | RPC/cache STAFF-* | — | ✅ | ✅ full | ✅ | — |
| Seller | staff_seller | staff | seller | RPC/cache STAFF-* | — | ❌ | ❌ | ❌ fiscal cat | — |
| Artist | artist_* | artist | artist | RPC/cache ART-* | ART-* | ✅ own | 📋 projection | ✅ W-9 flow | profile_missing |
| Client | buyer | client | client | RPC/cache CLI-* | — | ❌ | ❌ | ❌ fiscal | profile_missing |
| Anonymous | guest | — | — | — | — | ❌ | ❌ | ❌ | identity_unavailable |
| Expired session | * | — | — | — | — | ❌ | ❌ | ❌ | session_expired |
| Refreshing | * | — | — | — | — | ❌ | ❌ | ❌ | identity_unavailable (no cache) |
| Snapshot error | * | — | — | — | — | ❌ | ❌ | ❌ | role_unresolved |
| Unknown role | unsupported | — | — | — | — | ❌ | ❌ | ❌ | role_unresolved |
| Portal mismatch | valid | * | * | — | — | ❌ | ❌ | ❌ | portal_mismatch |
| Ambiguous profile | * | * | * | multiple ART | — | ❌ | ❌ | ❌ | identity_ambiguous |

**Regla:** guards (`canReadFiscalLegalData`, etc.) se evalúan **después** del context — no duplicar en adapter.

---

## 6. Taxonomía de errores (FASE 6)

| Error conceptual | Código interno recomendado | Log | Portal expose | Bridge result | Seller | Owner | Retry |
|------------------|---------------------------|-----|---------------|---------------|--------|-------|-------|
| Identity unavailable | `identity_unavailable` | ✅ | generic deny | failure | seller UI | deny | once |
| Unauthenticated | `identity_unavailable` | ✅ | login | failure | seller | deny | no |
| Access forbidden | `portal_mismatch` | ✅ | forbidden | failure | seller | deny | no |
| Profile missing | `profile_missing` | ✅ | soft deny | failure | **seller** | deny | no |
| Profile inactive | `profile_missing` | ✅ | deny | failure | seller | deny | no |
| Role unsupported | `role_unresolved` | ✅ | deny | failure | seller | deny | no |
| Portal mismatch | `portal_mismatch` | ✅ | deny | failure | seller | deny | no |
| Snapshot malformed | `role_unresolved` | ✅ | deny | failure | seller | deny | refresh session |
| RPC unavailable | `lookup_prefetch_failed` | ✅ | deny | cache miss → profile_missing | **seller** | deny | 1× idempotent |
| Timeout | `lookup_prefetch_timeout` | ✅ | deny | cache miss | seller | deny | 1× |
| Cancellation | `lookup_prefetch_cancelled` | ○ | silent | cache miss | seller | deny | user action |
| Stale revision | `lookup_stale_revision` | ✅ | refresh | invalidate cache | seller | deny | refresh |

**Regla obligatoria:** ante ambigüedad o error → **nunca elevar privilegios**.

---

## 7. Wiring futuro por portal (FASE 7)

### 7.1 Punto de inyección

| Portal | Composition root | Lookup instance | Fail-closed |
|--------|------------------|-----------------|-------------|
| **Staff** | `staff-legal-provider-wire.ts` | Prod: cache-backed Supabase adapter · Lab: memory | ✅ seller (live) |
| **Artist** | Futuro `artist/legal/*-wire.ts` | Mismo factory | deny / empty VM |
| **Client** | Futuro `client/legal/*-wire.ts` | Mismo factory | deny / empty VM |

### 7.2 Provider factory

| Modo | Lookup | Trigger |
|------|--------|---------|
| **Lab** (`api.transportMode=memory`) | `DEFAULT_MEMORY_LEGAL_PROFILE_LOOKUP` | Sin RPC |
| **Prod** | `createSupabaseLegalProfileLookupAdapter({ cache })` | Prefetch on permission attach |

**Feature flag:** solo si PO exige rollout gradual — preferir `transportMode` existente; **no** flag adicional salvo necesidad demostrada.

### 7.3 Escenarios fail-closed

| Escenario | Staff | Artist | Client |
|-----------|-------|--------|--------|
| Adapter unavailable | seller role | legal center hidden | legal center hidden |
| RPC fails | seller + no fiscal UI | deny reads | deny reads |
| Profile missing | seller | bridge fail | bridge fail |
| Portal mismatch | bridge fail | bridge fail | bridge fail |
| Seller actor | seller capabilities | N/A | N/A |

---

## 8. Compatibilidad LC-13A SQL (FASE 8)

| Objeto SQL | Clasificación | Transición |
|------------|---------------|------------|
| RLS policies (15) | **KEEP** | Sin cambio lógico |
| 7 RPC read | **KEEP** | Sin cambio contrato |
| `prevent_legal_audit_mutation` | **KEEP** | — |
| `legal_lc13_identity_profiles` | **LAB_ONLY** → **DROP_AFTER_REPLACEMENT** | Tras SQL helper prod validado aislado |
| `legal_lc13_test_set_session` | **LAB_ONLY** | Eliminar en prod path |
| `auth.uid()` stub | **DROP_AFTER_REPLACEMENT** | Supabase native |
| `legal_lc13_read_access_context()` | **REWRITE** | Lee `dj_profiles`/`client_profiles`/lookup RPC interna |
| Helpers `legal_lc13_*` | **REWRITE** | Delegar a identidad productiva; misma semántica LC-13A tests |

**Secuencia segura (sin cadena 110 en PG vacío):**

1. Implementar RPC `legal_resolve_profile_access` en migración **LC-13B-SQL** autocontenida + prereqs documentados.
2. Validar RPC + REWRITE helpers en **PG aislado LC-12+LC-13A** (como validación LC-13A).
3. Implementar TS prefetch + cache adapter contra RPC en entorno con DB existente (Option A).
4. Contract tests TS ↔ SQL aislado.
5. **DROP_AFTER_REPLACEMENT** stubs solo tras PO + tests verdes.

---

## 9. Estrategia bootstrap legacy (FASE 9)

| Opción | Seguridad | Reproducibilidad | Legacy dep | Prod risk | Tests | Reversibilidad |
|--------|-----------|------------------|------------|-----------|-------|----------------|
| **A — TS adapter vs RPC en env existente** | Alta | Media | Alta (DB real) | Media | Integration contra staging | Alta |
| **B — Pipeline V2 aislado + baseline** | Alta | Alta | Baja local | Baja | PG aislado full | Media |
| **C — Contract test / mocks only** | Media | Alta | Ninguna | Baja | Unit only | Alta |

**Recomendación PO:** **Opción A + B en paralelo**

- **A** para primer adapter TS + prefetch wiring ( próximo ticket impl ).
- **B** para REWRITE SQL helpers sin depender de cadena 110 vacía.

No ejecutar en este ticket.

---

## 10. Plan de pruebas futuro (FASE 10)

### Unit

- Snapshot → context mapping (all roles)
- Cache hit/miss/stale
- Portal mismatch
- Seller fail-closed mapping
- Malformed RPC response normalization
- Cancellation / timeout → cache miss

### Integration aislada

- RPC contract round-trip (mock transport)
- Owner/manager/seller/artist/client/anonymous
- Cross-tenant leak scan
- Fiscal gates unchanged

### Portal wiring

- Staff: owner vs seller shell
- Artist/Client: own-only reads

### Regresión

- LC-13A 7 read RPC unchanged
- No `storage_key` / UUID in list responses
- Audit append-only unaffected

---

## 11. Decisión GO / NO-GO (FASE 11)

### **READY_FOR_IMPLEMENTATION_TICKET**

| Campo | Valor |
|-------|-------|
| Próximo ticket | `TICKET-V2-LEGAL-CENTER-LC-13B-PRODUCTIVE-LOOKUP-ADAPTER-IMPLEMENTATION-001` |
| Alcance impl | Prefetch service · cache port · Supabase adapter · staff wire swap · unit tests |
| Archivos probables | `legal-profile-resolution-cache.ts`, `supabase-legal-profile-lookup.ts`, `access-permission-orchestrator` hook, `staff-legal-provider-wire.ts`, tests |
| SQL | Ticket separado `LC-13B-SQL-legal_resolve_profile_access` — **no** en mismo commit que TS |
| Bloqueos | Bootstrap cadena vacía · prod deploy · LC-13A stub drop |
| Diferidos | Artist/client wires · public links · write RPC |

---

## 12. Restricciones respetadas

Sin TypeScript · SQL · migraciones · tests · Docker · Supabase · commit · push · producción.

---

## 13. Estado final

> **LC-13B PRODUCTIVE LOOKUP ADAPTER DESIGN COMPLETADO — IMPLEMENTATION NOT STARTED — PRODUCTION SQL INTEGRATION REMAINS BLOCKED — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**

Handoff: [`SESSION-SUMMARIES/2026-07-22-LC13B-PRODUCTIVE-LOOKUP-ADAPTER-DESIGN.md`](../SESSION-SUMMARIES/2026-07-22-LC13B-PRODUCTIVE-LOOKUP-ADAPTER-DESIGN.md)
