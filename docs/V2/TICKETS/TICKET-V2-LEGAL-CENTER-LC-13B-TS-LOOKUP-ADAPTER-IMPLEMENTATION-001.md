# TICKET-V2-LEGAL-CENTER-LC-13B-TS-LOOKUP-ADAPTER-IMPLEMENTATION-001

**Proyecto:** Miami DJ Beat V2
**Tipo:** Implementación TypeScript aislada
**Estado:** EJECUTADO EN LAB — SIN COMMIT — SIN SQL — SIN PRODUCCIÓN
**Baseline:** `32ea3e69e80f4696abd6e03b2e56ae58fc05a975` · rama `plan/v2-phase-4-api-client`

---

## 1. Objetivo cumplido

Infraestructura TypeScript LC-13B para resolver `LegalProfileLookupPort` mediante:

1. Prefetch async (`ApiClient.rpc` + `MemoryTransport` en lab)
2. Cache session-scoped (`LegalProfileResolutionCache`)
3. Lookup sync cache-backed (`createSupabaseLegalProfileLookup`)
4. Bridge existente sin reescritura (`resolveLegalReadAccessContextFromSession`)

**Conservado sin cambios:**

- `LegalReadAccessContext`
- `resolveLegalReadAccessContextFromSession`
- Políticas RLS LC-13A
- Siete RPC read LC-13A
- Comportamiento fail-closed Staff → seller

---

## 2. Qué NO se implementó

| Item | Estado |
|------|--------|
| RPC SQL `legal_resolve_profile_access` | ❌ Pendiente ticket LC-13B-SQL |
| Supabase remoto / supabase-js directo | ❌ Prohibido |
| Migraciones / RLS / Edge | ❌ Sin tocar |
| Bootstrap legacy | ❌ Sigue `BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT` |
| Commit / push / deploy | ❌ No autorizado |

---

## 3. Arquitectura implementada

```
LegalProfileAccessPrefetchService (async)
  → ApiClient.rpc('legal_resolve_profile_access')
  → validate + PermissionSnapshot cross-check
  → LegalProfileResolutionCache.set(authUserId|profileKind|sourcePortal|documentedRole)

resolveLegalReadAccessContextFromSession (sync, unchanged)
  → resolveLegalProfileLookupPort()
  → createSupabaseLegalProfileLookup.lookup() — cache read ONLY
  → LegalReadAccessContext
```

**Binding:**

| `api.transportMode` | Lookup |
|---------------------|--------|
| `memory` (default lab) | `DEFAULT_MEMORY_LEGAL_PROFILE_LOOKUP` |
| `fetch` | `createSupabaseLegalProfileLookup({ cache })` |

Staff wire usa `resolveLegalProfileLookupPort()` — fail-closed seller preservado ante cache miss.

---

## 4. Archivos creados

| Archivo | Rol |
|---------|-----|
| `shared/services/legal/persistence/identity/legal-profile-resolution-cache.ts` | Cache memory-only |
| `shared/services/legal/persistence/identity/legal-resolve-profile-access-types.ts` | Contrato TS RPC + validación |
| `shared/services/legal/persistence/identity/legal-profile-access-prefetch-errors.ts` | Taxonomía errores prefetch |
| `shared/services/legal/persistence/identity/legal-profile-access-prefetch-service.ts` | Orchestrator prefetch |
| `shared/services/legal/persistence/identity/supabase-legal-profile-lookup.ts` | Adapter sync cache-backed |
| `shared/services/legal/persistence/identity/legal-profile-lookup-binding.ts` | Factory memory vs cache |
| `tests/unit/legal-profile-resolution-cache.test.ts` | 7 tests |
| `tests/unit/legal-profile-access-prefetch.test.ts` | 9 tests |
| `tests/unit/supabase-legal-profile-lookup.test.ts` | 3 tests |
| `tests/unit/staff-legal-provider-wire.test.ts` | 3 tests |

---

## 5. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `shared/services/legal/persistence/identity/index.ts` | Exports LC-13B |
| `staff/legal/staff-legal-provider-wire.ts` | `resolveLegalProfileLookupPort()` |
| `docs/V2/README.md` | Entrada LC-13B TS |
| `docs/V2/NOTA-DIARIA-LAB-001.md` | Entrada LC-13B TS |

---

## 6. Firmas finales

### Cache

```typescript
class LegalProfileResolutionCache implements LegalProfileResolutionCachePort {
  set(key: LegalProfileResolutionCacheKeyInput, entry: LegalProfileResolutionCacheEntry): void;
  get(key: LegalProfileResolutionCacheKeyInput): LegalProfileResolutionCacheEntry | null;
  has(key: LegalProfileResolutionCacheKeyInput): boolean;
  delete(key: LegalProfileResolutionCacheKeyInput): boolean;
  clear(): void;
  invalidateForAuthUser(authUserId: string): void;
}
```

Clave: `authUserId | profileKind | sourcePortal | documentedRole`

### Prefetch

```typescript
createLegalProfileAccessPrefetchService(cache?: LegalProfileResolutionCachePort): {
  prefetch(input: LegalProfileAccessPrefetchInput): Promise<LegalProfileAccessPrefetchResult>;
}
```

### Adapter

```typescript
createSupabaseLegalProfileLookup(input?: { resolutionCache?: LegalProfileResolutionCachePort }): LegalProfileLookupPort
// sync lookup — no network
```

### Contrato RPC TypeScript

```typescript
LEGAL_RESOLVE_PROFILE_ACCESS_RPC = 'legal_resolve_profile_access'
request: { source_portal, correlation_id? }
success: { ok: true, actor_type, actor_role, business_entity_id, recipient_scope, profile_status, revision, mdjb_id? }
failure: { ok: false, code, reason }
```

---

## 7. Validación ejecutada

| Comando | Resultado |
|---------|-----------|
| `npm test -- tests/unit/legal-profile-resolution-cache.test.ts` | 7 PASS |
| `npm test -- tests/unit/legal-profile-access-prefetch.test.ts` | 9 PASS |
| `npm test -- tests/unit/supabase-legal-profile-lookup.test.ts` | 3 PASS |
| `npm test -- tests/unit/staff-legal-provider-wire.test.ts` | 3 PASS |
| `npm test -- tests/unit/legal-identity-bridge.test.ts` | 13 PASS (regresión) |
| `npm test` (suite completa) | **84 files · 1068 PASS** |
| `npm run typecheck` | **PASS** |
| `npm run lint` | Pre-existing project errors (no nuevos en archivos LC-13B) |

---

## 8. Revisión de seguridad

| Control | Verificado |
|---------|------------|
| Lookup sync sin red | ✅ |
| Cache sin tokens / storage keys | ✅ |
| Cache miss → profile_missing → Staff seller | ✅ |
| Malformed RPC → no cache write | ✅ |
| Portal mismatch → deny + cache clear | ✅ |
| Retry máximo 1 solo transitorio | ✅ |
| No elevación Owner/Manager por fallback | ✅ |
| Bridge sin modificación | ✅ |

---

## 9. Estado final

> **LC-13B TYPESCRIPT LOOKUP ADAPTER IMPLEMENTADO EN LAB — CACHE Y PREFETCH VALIDATED — STAFF FAIL-CLOSED PRESERVED — SQL RPC NOT IMPLEMENTED — PRODUCTION NOT AUTHORIZED — PENDIENTE DE REVISIÓN Y VALIDACIÓN PO**

**Siguiente paso PO:** ticket LC-13B-SQL (`legal_resolve_profile_access`) + validación aislada Postgres.
