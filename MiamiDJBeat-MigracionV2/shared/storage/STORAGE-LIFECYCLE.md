# STORAGE-LIFECYCLE.md

**TICKET-V2-SHARED-CORE-011 — Storage Specification**

**Módulo:** MOD-012 · Ciclo de vida  
**Versión:** 1.0

---

## Pipeline

```
Create → Read → Update → Invalidate → Delete
```

---

## 1. Create

| Paso | Acción |
|------|--------|
| Input | `namespace`, `key`, `value`, `opts` (backend, ttlMs) |
| Validate | namespace registered · key format · prohibited scan |
| Serialize | JSON.stringify + size check |
| Quota | reject if exceeds namespace/backend limit → ERR-0600 |
| Write | backend.set(fullKey, envelope) |
| Output | `StorageEntry` metadata |

**Idempotent:** same key exists → treat as Update unless `createOnly: true` → conflict ERR-0603 (reserved).

---

## 2. Read

| Paso | Acción |
|------|--------|
| Resolve | `fullKey = mdj_v2_{namespace}_{key}` |
| Backend | per namespace default or override |
| TTL check | if expired → Invalidate path → cache miss |
| Deserialize | parse envelope |
| Output | `value` or `null` (miss) |

Read fail parse → Invalidate + log corrupt → ERR-0601.

---

## 3. Update

| Paso | Acción |
|------|--------|
| Precondition | key exists OR upsert allowed (namespace rule) |
| Validate | same as Create |
| Merge | full replace default; `merge: true` ADR for objects |
| Touch | `updatedAt`, refresh TTL if sliding |
| Write | backend.set |

Upsert namespaces: Cache, Temporary, Drafts.  
Strict create: Session keys on SESSION_CREATED only.

---

## 4. Invalidate

| Trigger | Acción |
|---------|--------|
| TTL expiry | mark stale; delete on next read or lazy sweep |
| Explicit `invalidate(key)` | remove entry; emit invalidation log |
| Pattern `invalidate(ns, prefix*)` | Cache namespace only |
| Session LOGOUT | clear Session + Temporary + sensitive Cache |
| Permissions PERMISSION_CHANGED | invalidate FeatureFlags cache |
| API cache bust | domain event ADR |

Invalidate ≠ Delete: invalidate may leave tombstone `{ invalidatedAt }` in Cache for coalesced refresh.

---

## 5. Delete

| Paso | Acción |
|------|--------|
| Remove | backend.remove(fullKey) |
| Namespace clear | `clearNamespace(ns)` — Session DESTROYED |
| Verify | read returns null |
| Log | info level key name only — no value |

Hard delete on GDPR ADR → separate ticket.

---

## State diagram (entry)

```
[ absent ] --create--> [ active ]
[ active ] --read--> [ active ]
[ active ] --update--> [ active ]
[ active ] --ttl--> [ stale ] --invalidate--> [ absent ]
[ active ] --delete--> [ absent ]
[ stale ] --read--> cache miss → refresh path (Cache ns)
```

---

## Session integration lifecycle

| Session event | Storage action |
|---------------|----------------|
| SESSION_CREATED | Create Session keys |
| SESSION_READY | Update locale/theme prefs if changed |
| REFRESH | Update expires_at, auth_ref |
| LOGGING_OUT | — |
| SESSION_DESTROYED | Delete Session ns + Temporary + clear auth_ref keys |

Aligns **SESSION-STORAGE.md** — Session Manager orchestrates; Storage executes.

---

## Error paths

| Condition | Code | Recovery |
|-----------|------|----------|
| Quota exceeded | ERR-0600 | recoverable — eviction |
| Read fail | ERR-0601 | retryable once |
| Write fail | ERR-0602 | retryable once |
| Corrupt envelope | ERR-0601 | clear key |
| Prohibited payload | ERR-0604 (reserved) | reject write |

---

## Events (internal — future ADR)

| Event | Emisor |
|-------|--------|
| `STORAGE_WRITE` | internal log |
| `STORAGE_INVALIDATE` | internal |
| `STORAGE_QUOTA_WARN` | → Logging warn |

No Event Bus public events MVP — avoid noise.

---

*STORAGE-LIFECYCLE v1.0 — TICKET-V2-SHARED-CORE-011*
