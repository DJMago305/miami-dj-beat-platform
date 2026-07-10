# CACHE-POLICY.md

**TICKET-V2-SHARED-CORE-011 — Storage Specification**

**Módulo:** MOD-012 · Políticas de Cache  
**Versión:** 1.0

---

## Scope

Cache policies apply to namespace **Cache** and cache-like behavior in **FeatureFlags**.  
API Client may write Cache entries; Storage enforces TTL/eviction.

---

## 1. TTL (Time To Live)

| Cache class | Default TTL | Config key |
|-------------|-------------|------------|
| API GET response | 60s | `storage.cache.ttl.apiGetMs` |
| API RPC read | 30s | `storage.cache.ttl.apiRpcMs` |
| Feature flags snapshot | 300s prod / 60s staging | `storage.cache.ttl.flagsMs` |
| Static config mirror | none — invalidate on version | — |
| Temporary | 3600000 (1h) max | hard cap |

### Envelope format

| Field | Descripción |
|-------|-------------|
| `value` | cached payload |
| `cachedAt` | ISO timestamp |
| `ttlMs` | expiry duration |
| `etag` | optional validator from API |

Expiry: `now > cachedAt + ttlMs` → stale.

---

## 2. Invalidación

| Trigger | Scope | Action |
|---------|-------|--------|
| TTL expiry | single key | lazy delete on read |
| Session logout | `cache_api_*` user-scoped | delete pattern |
| PERMISSION_CHANGED | FeatureFlags + user cache | invalidate all user keys |
| CONFIG_VERSION bump | Config + flags | clear namespaces |
| Manual `invalidate(key)` | single | immediate delete |
| Write mutation success | related GET keys ADR | pattern bust `{resource}*` |

**Never cache:** POST responses, checkout, payment, auth endpoints.

---

## 3. Refresh

| Strategy | Cuándo |
|----------|--------|
| **Stale-while-revalidate** | Cache hit near expiry (< 10% TTL left) → return stale + background refresh ADR |
| **Force refresh** | caller `read(key, { refresh: true })` |
| **On miss** | fetch upstream → Create cache entry |

Refresh orchestration lives in **API Client / services** — Storage provides read/write/invalidate only.

---

## 4. Eviction

| Policy | Aplica |
|--------|--------|
| **LRU** | Cache namespace when > 80% quota |
| **Priority** | FeatureFlags > API GET > Temporary mirror |
| **Low priority first** | evict oldest Temporary, then Cache API |
| **Never evict** | Session, Preferences (non-cache ns) via LRU |

| Event | Action |
|-------|--------|
| Quota 80% | evict LRU Cache until 70% |
| Quota 95% | evict all Temporary + LRU Cache |
| Quota 100% | ERR-0600 reject write |

Log `STORAGE_QUOTA_WARN` at 80%.

---

## 5. Cache Miss

| Condición | Behavior |
|-----------|----------|
| Key absent | return `null` · meta `{ hit: false }` |
| TTL expired | Invalidate → miss |
| Corrupt parse | Invalidate → miss · ERR-0601 logged |
| Wrong namespace | reject · not a miss |

Consumer flow:

```
read → miss → upstream fetch (API Client) → create cache entry → return value
```

---

## 6. Cache Hit

| Condición | Behavior |
|-----------|----------|
| Key present + valid TTL | return `value` · meta `{ hit: true, ageMs }` |
| Sliding TTL | optional refresh `cachedAt` on hit ADR |
| Hit logging | debug only · no cached body |

---

## Decision matrix

| Request type | Cache? | TTL | Invalidate on |
|--------------|--------|-----|---------------|
| GET public catalog | ✅ | 60s | version header |
| GET user profile | ✅ | 30s | logout, update |
| RPC permissions | ❌ | — | always fresh via Session |
| Edge checkout | ❌ | — | — |
| Feature flags | ✅ | 300s | PERMISSION_CHANGED, CONFIG |

---

## Cache key construction

```
mdj_v2_cache_api_{sha256(method + path + sortedQuery)}
```

Include `portal` in hash input — no cross-portal cache bleed.

---

## Security

| Regla | Detalle |
|-------|---------|
| No secrets in cache values | scan pre-write |
| No JWT in cache | reject |
| User-scoped keys | include userId hash in key suffix |
| Staff red zone responses | never cache |

---

## Métricas (runtime futuro)

| Métrica | Uso |
|---------|-----|
| hit rate | diag staging |
| eviction count | quota tuning |
| avg ageMs | TTL tuning |

Logging only — no Event Bus MVP.

---

*CACHE-POLICY v1.0 — TICKET-V2-SHARED-CORE-011*
