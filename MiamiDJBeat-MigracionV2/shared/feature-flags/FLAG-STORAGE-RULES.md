# FLAG-STORAGE-RULES.md

**TICKET-V2-SHARED-CORE-015 — Feature Flags Specification**

**Módulo:** MOD-013 · Storage  
**Versión:** 1.0

> Reglas de persistencia local para cache y overrides documentados. Facade vía MOD-012 Storage — **sin implementación**.

---

## Namespace permitido

```
mdj_v2_flag_*
```

| Key pattern | Contenido permitido |
|-------------|---------------------|
| `mdj_v2_flag_cache_v{version}` | Resolved snapshot metadata — no secrets |
| `mdj_v2_flag_ttl_{key_hash}` | TTL timestamp ISO |
| `mdj_v2_flag_pref_{key}` | User preference opt-in boolean only |

**Prohibido:** `mdj_v2_auth_*`, `mdj_v2_perm_*`, `mdj_v2_theme_*`, payment keys.

---

## Qué puede guardarse

| Dato | Permitido |
|------|-----------|
| Cached `enabled` boolean per key | ✅ |
| `registryVersion` integer | ✅ |
| `lastResolvedAt` ISO timestamp | ✅ |
| User opt-in pref (category User Preference) | ✅ boolean only |
| TTL expiry marker | ✅ |

---

## Qué no puede guardarse

| Dato | Prohibido |
|------|-----------|
| Full registry JSON with secrets | ❌ |
| Capabilities · role matrix | ❌ |
| Remote fetch credentials | ❌ |
| Emergency override audit token | ❌ in client — server ADR |
| PII | ❌ |
| Theme · i18n data | ❌ |

---

## Persistencia

| Regla | Detalle |
|-------|---------|
| P-01 | Cache optional — resolution works memory-only |
| P-02 | User pref flags persist only if category User Preference |
| P-03 | Emergency overrides **never** persist client-side prod ADR |
| P-04 | Write via Storage facade MOD-012 only |

---

## TTL

| Item | Default TTL |
|------|-------------|
| Resolution cache | **60s** (align CONTRACTS.md §8) |
| Registry version cache | 60s |
| User preference | Session-aligned — invalidate SESSION_DESTROYED |

TTL expiry → FLAGS_INVALIDATED → RESOLVING.

---

## Invalidación

| Trigger | Acción |
|---------|--------|
| `CONFIG_UPDATED` | Clear cache namespace |
| `FLAGS_INVALIDATED` event | Delete affected keys |
| `SESSION_DESTROYED` | Clear user pref flags |
| `registryVersion` bump | Full cache clear |
| Manual PO | Ticket + FLAGS_RELOADED |

---

## Cache

| Regla | Detalle |
|-------|---------|
| C-01 | In-memory L1 + Storage L2 optional |
| C-02 | Cache miss → RESOLVING not FAILED |
| C-03 | Stale cache → WARN ERR-FLAG-008 → bypass |
| C-04 | No cache permission outcomes |

---

## Fallback

| Escenario | Storage behavior |
|-----------|------------------|
| Read fail | Skip cache · resolve fresh |
| Write fail | Continue · ERR-FLAG-008 · no block boot |
| Corrupt entry | Delete key · default false |

---

## Limpieza

| Evento | Limpieza |
|--------|----------|
| Logout | User pref flags |
| Portal switch ADR | Portal-scoped cache keys |
| Version upgrade app | Migrate or wipe `mdj_v2_flag_*` ADR |

Ver `storage/STORAGE-NAMESPACE-RULES.md` reglas transversales.

---

*FLAG-STORAGE-RULES v1.0 — TICKET-V2-SHARED-CORE-015*
