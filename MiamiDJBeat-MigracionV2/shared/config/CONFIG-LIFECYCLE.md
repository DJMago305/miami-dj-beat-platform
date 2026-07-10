# CONFIG-LIFECYCLE.md

**TICKET-V2-SHARED-CORE-006 — Configuration Specification**

**Módulo:** MOD-006 · Ciclo de vida  
**Versión:** 1.0

---

## Fases

```
Load → Parse → Validate → Freeze → Expose → (Reload*) → Shutdown
```

*Reload solo local hot-reload ADR; prohibido en production runtime.

---

## 1. Load

| Paso | Acción |
|------|--------|
| Trigger | Core boot first module |
| Fuente | Env vars, build-time inject, optional local file (gitignored) |
| Output | Raw key-value map |
| Errores | IO fail → CONFIG_ERROR_MISSING_KEY |

Configuration **no** fetch remoto en load.

---

## 2. Parse

| Paso | Acción |
|------|--------|
| Coerce | strings → enum, number, boolean |
| Normalize | trim URLs, strip trailing slash deploy root |
| Strip | reject unknown keys in strict whitelist mode (optional ADR) |
| Output | ParsedConfig draft |

---

## 3. Validate

| Paso | Acción |
|------|--------|
| Schema | All CONFIG-SPEC rules |
| Forbidden scan | Reject service role patterns |
| V1 path scan | Reject `/web/` in deploy URLs |
| Cross-field | portal URLs consistent with deploy root |
| Fail strict | throw CONFIG_ERROR_* → Core abort |
| Fail soft | warn + fallback (non-critical only) |

---

## 4. Freeze

| Paso | Acción |
|------|--------|
| Action | Build immutable `AppConfig` |
| Mutability | **Read-only** for Core lifetime |
| Exposure | `getConfig()` singleton accessor (futuro) |
| Event | Contribuye a `SYSTEM_READY` prerequisites |

Orden boot Core:

```
Configuration (validate+freeze) → Event Bus → Session → Auth → …
```

---

## 5. Expose

| Consumidor | Lee |
|------------|-----|
| Logging | level, env, app name |
| Session | storage, TTL, portal |
| API Client | base URL, timeouts |
| Auth | redirect URLs, API public |
| Feature Flags | env flag defaults |
| Theme / i18n | defaults |

Consumers **must not** read `process.env` / `import.meta.env` directly — solo `AppConfig`.

---

## 6. Reload (local only)

| Condición | Acción |
|-----------|--------|
| Dev hot reload | Re-run Load→Validate→Freeze |
| staging/prod | **Prohibido** sin redeploy |
| Invalid reload | Keep previous frozen config + log |

---

## 7. Shutdown

| Paso | Acción |
|------|--------|
| Trigger | App teardown |
| Action | Clear in-memory AppConfig ref |
| Persist | None — config stateless |

---

## Errores en lifecycle

| Fase | Error típico | Resultado |
|------|--------------|-----------|
| Load | missing required | CONFIG_ERROR_MISSING_KEY |
| Parse | bad boolean | CONFIG_ERROR_INVALID_* |
| Validate | forbidden key | CONFIG_ERROR_FORBIDDEN_KEY |
| Validate | V1 path | CONFIG_ERROR_V1_PATH |
| Freeze | — | success → SYSTEM_READY eligible |

Fatal config → no Session, no Auth, no portales Core.

---

## Testing (futuro 007+)

- Fixture `AppConfig` per env
- Table-driven validate tests
- Forbidden key rejection
- Fallback paths

---

*CONFIG-LIFECYCLE v1.0 — TICKET-V2-SHARED-CORE-006*
