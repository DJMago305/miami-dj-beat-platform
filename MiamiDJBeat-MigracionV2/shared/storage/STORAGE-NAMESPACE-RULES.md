# STORAGE-NAMESPACE-RULES.md

**TICKET-V2-SHARED-CORE-011 — Storage Specification**

**Módulo:** MOD-012 · Namespaces oficiales  
**Versión:** 1.0  
**Total namespaces:** **7**

---

## Prefix global

```
mdj_v2_{namespace}_{key}
```

| Regla | Detalle |
|-------|---------|
| namespace | lowercase enum |
| key | `[a-z0-9_]+` max 64 chars |
| full key max | 128 chars total |

---

## Catálogo de namespaces

| # | Namespace | Prefix ejemplo | Backend default | Persist | TTL default |
|---|-----------|----------------|-----------------|---------|-------------|
| 1 | **Config** | `mdj_v2_config_*` | localStorage | cross-tab | none (version bump invalidate) |
| 2 | **Session** | `mdj_v2_session_*` | sessionStorage (lab) / ADR prod | tab / ADR | session lifetime |
| 3 | **Cache** | `mdj_v2_cache_*` | memory + localStorage | optional | per-entry TTL |
| 4 | **Preferences** | `mdj_v2_preferences_*` | localStorage | cross-tab | none |
| 5 | **Drafts** | `mdj_v2_drafts_*` | sessionStorage → IndexedDB futuro | tab / durable | 7d ADR |
| 6 | **FeatureFlags** | `mdj_v2_featureflags_*` | memory + localStorage | short | 5m staging / 1m prod refresh |
| 7 | **Temporary** | `mdj_v2_temporary_*` | memory | tab | 1h max |

---

## Keys registradas (MVP)

### Config

| Key | Contenido permitido |
|-----|---------------------|
| `schema_version` | int |
| `last_boot_env` | local \| staging \| production |

### Session (SESSION-STORAGE.md)

| Key | Contenido |
|-----|-----------|
| `session_id` | uuid |
| `portal` | client \| artist \| staff |
| `locale` | en \| es |
| `theme` | dark \| light |
| `expires_at` | ISO |
| `user_id` | uuid \| null |
| `auth_ref` | opaque ref — **not** raw JWT |

### Preferences

| Key | Contenido |
|-----|-----------|
| `locale` | en \| es |
| `theme` | dark \| light |
| `notifications_muted` | boolean |

### Cache

| Key pattern | Contenido |
|-------------|-----------|
| `api_{hash}` | redacted API response snapshot |
| `flags_snapshot` | non-secret flag map |

### Drafts

| Key pattern | Contenido |
|-------------|-----------|
| `{formId}` | form state JSON — no PII beyond portal policy |

### FeatureFlags

| Key | Contenido |
|-----|-----------|
| `snapshot` | `{ flagId: boolean }` |
| `fetched_at` | ISO |

### Temporary

| Key pattern | Contenido |
|-------------|-----------|
| `wizard_step` | int |
| `ui_scroll_*` | position meta |

---

## Backend assignment rules

| Namespace | Memory | sessionStorage | localStorage | IndexedDB | Encrypted |
|-----------|--------|----------------|--------------|-----------|-----------|
| Config | boot mirror | — | ✅ | futuro | futuro |
| Session | runtime | ✅ lab | non-secret only ADR | — | auth_ref ADR |
| Cache | ✅ hot | — | ✅ warm | futuro bulk | — |
| Preferences | — | — | ✅ | — | — |
| Drafts | buffer | ✅ | — | futuro | — |
| FeatureFlags | ✅ | — | ✅ snapshot | — | — |
| Temporary | ✅ | optional | — | — | — |

---

## Prohibited payload scan (pre-write)

Reject write if value matches deny rules:

| # | Prohibido | Detection |
|---|-----------|-----------|
| P-01 | **Passwords** | key or value pattern password/pwd |
| P-02 | **JWT persistente** | eyJ… bearer full token in localStorage |
| P-03 | **Private Keys** | PEM blocks, `BEGIN PRIVATE KEY` |
| P-04 | **Stripe Secrets** | sk_live_, sk_test_, whsec_ |
| P-05 | **Service Role Keys** | service_role, sb_secret |
| P-06 | **SQL** | SELECT/INSERT/UPDATE/DELETE fragments in value |
| P-07 | **PII no autorizada** | ssn, full card, unmasked email+phone pair |

Session `auth_ref` = opaque handle only — validated by Auth ADR.

---

## Namespace isolation

| Regla | Detalle |
|-------|---------|
| NS-01 | Module may only write its assigned namespace(s) |
| NS-02 | Session owns Session ns — others read-only except Config boot |
| NS-03 | `clearNamespace` authorized only for owner module |
| NS-04 | Cross-namespace copy forbidden without facade helper |

### Writer authority

| Module | Namespaces write |
|--------|------------------|
| Configuration | Config |
| Session | Session |
| API Client | Cache (`api_*`) |
| Feature Flags module | FeatureFlags |
| Theme | Preferences (`theme`) |
| i18n | Preferences (`locale`) |
| Portals (via services) | Drafts, Temporary |

---

## Size limits (MVP)

| Backend | Max entry | Max total |
|---------|-----------|-----------|
| Memory | 256 KB | 4 MB |
| sessionStorage | 512 KB | 5 MB |
| localStorage | 512 KB | 5 MB |

Exceeded → ERR-0600 + eviction attempt (Cache) before fail.

---

*STORAGE-NAMESPACE-RULES v1.0 — 7 namespaces — TICKET-V2-SHARED-CORE-011*
