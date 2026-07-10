# FLAG-ERRORS.md

**TICKET-V2-SHARED-CORE-015 — Feature Flags Specification**

**Módulo:** MOD-013 · Errores  
**Versión:** 1.0

> Catálogo local **ERR-FLAG-xxx**. Alineación conceptual con `shared/errors/` — **sin modificar** ERROR-CATALOG en este ticket.

---

## Catálogo ERR-FLAG

| Código | Nombre | Severidad | Causa | Acción sistema | userMessageKey | Log permitido | Log prohibido |
|--------|--------|-----------|-------|----------------|----------------|---------------|---------------|
| ERR-FLAG-001 | UNKNOWN_FLAG_STATE | WARNING | Boot/state corrupt | Reset → LOADING | `error.flag.unknown_state` | state name, correlationId | — |
| ERR-FLAG-002 | FLAG_CONFIG_MISSING | ERROR | Registry/config absent | FALLBACK defaults | `error.flag.config_missing` | config key names | secrets |
| ERR-FLAG-003 | INVALID_FLAG_DEFINITION | ERROR | Schema fail registry entry | Skip entry · FALLBACK | `error.flag.invalid_definition` | key name | values |
| ERR-FLAG-004 | INVALID_FLAG_KEY | INFO | Malformed key query | Return default false | `error.flag.invalid_key` | key attempted | — |
| ERR-FLAG-005 | RESOLUTION_FAILED | WARNING | Merge env+config fail | FALLBACK · continue boot | `error.flag.resolution_failed` | key, source | env secret values |
| ERR-FLAG-006 | FLAG_EXPIRED | INFO | Active override past expiration | Revert to default | — (internal) | key, expiration | — |
| ERR-FLAG-007 | FALLBACK_REGISTRY_FAILED | CRITICAL | Even defaults invalid | FAILED · all false ADR | `error.flag.fallback_failed` | registry version | full registry |
| ERR-FLAG-008 | STORAGE_READ_FAILED | WARNING | Cache read fail | Resolve without cache | `error.flag.storage_read` | key namespace | cached values |
| ERR-FLAG-009 | FLAG_UPDATE_FAILED | ERROR | Mid-flight update fail | Revert previous value | `error.flag.update_failed` | key | — |
| ERR-FLAG-010 | FLAG_SECURITY_VIOLATION | CRITICAL | Secret in flag · bypass attempt | Block apply · log security | `error.flag.security` | violation code enum | payload |

---

## Normalización → Error Handling

```
FlagError → ErrorHandling.normalizeFlagError() → ERR-000x band future sync ADR
```

Flag errors **never** force signOut unless combined with separate Permissions violation.

---

## Retry hints

| Código | Retry |
|--------|-------|
| ERR-FLAG-005 | true (bounded, cache bypass) |
| ERR-FLAG-008 | true (once) |
| ERR-FLAG-002 | false — use fallback |
| ERR-FLAG-010 | false — fatal audit |

---

## Log rules

- Log key names — **never** env secret values
- ERR-FLAG-010 → CRITICAL + Security channel ADR
- Unknown flag resolution → INFO/WARN only — not user-facing toast default

Ver `logging/LOG-REDACTION-RULES.md`.

---

## Boot vs runtime

| Fase | Behavior |
|------|----------|
| Boot ERR-FLAG-002/007 | FALLBACK → FLAGS_FALLBACK → continue |
| Runtime ERR-FLAG-009 | Revert · emit FLAGS_ERROR |
| Security ERR-FLAG-010 | Block flag apply · notify Error Handler |

---

*FLAG-ERRORS v1.0 — 10 codes — TICKET-V2-SHARED-CORE-015*
