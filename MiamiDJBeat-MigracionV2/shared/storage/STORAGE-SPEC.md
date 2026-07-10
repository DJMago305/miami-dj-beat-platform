# STORAGE-SPEC.md

**TICKET-V2-SHARED-CORE-011 — Storage Specification**

**Módulo:** MOD-012 Storage  
**Ticket:** TICKET-V2-SHARED-CORE-011  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Autoridad única para **almacenamiento local de datos** del laboratorio V2 (browser/runtime client).  
> No Supabase. No lógica de negocio. No secretos.

---

## 1. Responsabilidad del módulo

| Hace | No hace |
|------|---------|
| Abstrae backends Memory / sessionStorage / localStorage | **No autentica** |
| Namespaces oficiales + key registry | **No consulta Supabase** |
| Políticas cache TTL / eviction | **No contiene lógica de negocio** |
| Lifecycle Create → Delete | **No guarda secretos** |
| Validación datos prohibidos pre-write | **No guarda Service Role** |
| Schema version hooks (futuro) | **No guarda refresh tokens permanentes** |
| ERR-06xx on quota/fail | **No decide permisos** |

**Alcance:** persistencia client-side V2. Upload/download archivos remotos (Supabase buckets) → ticket futuro separado (Media / remote blob ADR).

---

## 2. Tipos de almacenamiento

**Total:** **5** (3 MVP + 2 futuro)

| # | Tipo | MVP | Uso |
|---|------|-----|-----|
| 1 | **Memory** | ✅ | Snapshot runtime authoritative; tab lifetime |
| 2 | **Session Storage** | ✅ | Tab-scoped; session restore dev/lab |
| 3 | **Local Storage** | ✅ | Cross-tab non-secret prefs |
| 4 | **IndexedDB** | futuro | Drafts grandes, offline cache |
| 5 | **Encrypted Storage** | futuro | ADR Web Crypto; no plain secrets MVP |

Detalle backends: **STORAGE-NAMESPACE-RULES.md** · cache: **CACHE-POLICY.md**

---

## 3. Namespaces oficiales

**Total:** **7** — detalle **STORAGE-NAMESPACE-RULES.md**

Config · Session · Cache · Preferences · Drafts · FeatureFlags · Temporary

Prefix global: `mdj_v2_{namespace}_*`

---

## 4. Políticas de Cache

Detalle: **CACHE-POLICY.md**

TTL · Invalidación · Refresh · Eviction · Cache Miss · Cache Hit

---

## 5. Lifecycle

Detalle: **STORAGE-LIFECYCLE.md**

```
Create → Read → Update → Invalidate → Delete
```

---

## 6. Relación con otros módulos

| Módulo | Relación | Dirección |
|--------|----------|-----------|
| **Configuration** MOD-006 | Key registry, backend selection, TTL defaults | Config → Storage |
| **Session** MOD-002 | Persist restore artifacts namespace `Session` | Session → Storage (via facade) |
| **Permissions** MOD-003 | **no** persist capabilities[] | Session re-fetch on restore |
| **API Client** MOD-005 | Cache namespace API responses (non-secret) | API Client → Storage write Cache |
| **Logging** MOD-010 | Quota/corrupt events; no values | Storage → Logging |
| **Error Handling** MOD-014 | ERR-0600–0602 normalize | Storage → Errors |
| **Notifications** MOD-011 | Quota exceeded toast optional | Errors → Notifications |

**Orden init:** Configuration → Logging → Error Handling → **Storage** → Session → …

---

## 7. Reglas operativas

| # | Regla |
|---|-------|
| S-01 | Storage **NO autentica** |
| S-02 | Storage **NO consulta Supabase** |
| S-03 | Storage **NO contiene lógica de negocio** |
| S-04 | Storage **NO guarda secretos** |
| S-05 | Storage **NO guarda Service Role** |
| S-06 | Storage **NO guarda Refresh Tokens permanentes** |
| S-07 | Storage **NO decide permisos** |
| S-08 | Toda key debe tener namespace registrado |
| S-09 | Write rejected si payload en deny list |
| S-10 | Clear namespace on Session DESTROYED where applicable |

---

## 8. Datos prohibidos

Ver **STORAGE-NAMESPACE-RULES.md** § Prohibited payload scan.

Passwords · JWT persistente · Private Keys · Stripe Secrets · Service Role Keys · SQL · PII no autorizada

---

## 9. Preparación Runtime (sin dependencias circulares)

### Facade conceptual

```
createStorage(config) → StorageFacade

StorageFacade.create(ns, key, value, opts?)
StorageFacade.read(ns, key)
StorageFacade.update(ns, key, value, opts?)
StorageFacade.invalidate(ns, key | pattern)
StorageFacade.delete(ns, key)
StorageFacade.clearNamespace(ns)
```

### Consumidores

| Consumidor | Namespace | Acoplamiento |
|------------|-----------|--------------|
| **Session** | Session | Session calls facade; Storage never calls Session |
| **Configuration** | Config | boot read only |
| **API Client** | Cache | response cache optional |
| **Feature Flags** | FeatureFlags | snapshot cache TTL |
| **Theme** | Preferences | `theme` key |
| **i18n** | Preferences | `locale` key |

**Prohibido:** Storage → Session, Storage → API Client, Storage → Portals direct.

Circular prevention: Storage es **leaf** — solo recibe calls; emite logs/errors.

---

## 10. Visión futura

| Capacidad | Estado |
|-----------|--------|
| Sincronización offline | ADR + IndexedDB |
| Persistencia inteligente | LRU + priority tiers |
| Cache distribuido | out of browser scope; server ADR |
| Storage cifrado | Encrypted Storage backend |
| Versionado | `mdj_v2_meta_schema_version` |
| Migraciones de esquema | `Storage.migrate(from, to)` ADR |

---

## StorageEntry (conceptual)

| Campo | Descripción |
|-------|-------------|
| `namespace` | enum 7 namespaces |
| `key` | string sin secrets |
| `value` | JSON-serializable |
| `backend` | memory \| session \| local \| idb \| encrypted |
| `ttlMs` | optional expiry |
| `createdAt` | ISO 8601 |
| `updatedAt` | ISO 8601 |
| `version` | schema version int |

---

## Referencias

- `STORAGE-LIFECYCLE.md`
- `STORAGE-NAMESPACE-RULES.md`
- `CACHE-POLICY.md`
- `../session/SESSION-STORAGE.md`
- `../errors/ERROR-CATALOG.md` ERR-0600–0699

---

*STORAGE-SPEC v1.0 — TICKET-V2-SHARED-CORE-011*
