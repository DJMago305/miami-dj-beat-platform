# RESPONSIVE-ERRORS.md

**TICKET-V2-SHARED-CORE-018 — Responsive Engine Specification**

**Módulo:** MOD-016 · Errores  
**Versión:** 1.0

> Catálogo **ERR-RESP-xxx** — alineación conceptual Error Handler · **sin modificar** ERROR-CATALOG.

---

## Catálogo ERR-RESP

| Código | Nombre | Severidad | Causa | Acción sistema | userMessageKey | Log permitido | Log prohibido |
|--------|--------|-----------|-------|----------------|----------------|---------------|---------------|
| ERR-RESP-001 | UNKNOWN_RESPONSIVE_STATE | WARNING | Boot corrupt | Reset init | `error.responsive.unknown_state` | state | — |
| ERR-RESP-002 | BREAKPOINT_CONFIG_MISSING | ERROR | Config bp absent | Default bp.base | `error.responsive.config_missing` | keys | — |
| ERR-RESP-003 | INVALID_BREAKPOINT | ERROR | Unknown bp token | Ignore · base | `error.responsive.invalid_bp` | token | — |
| ERR-RESP-004 | VIEWPORT_READ_FAILED | WARNING | Cannot read dimensions | Assume base | `error.responsive.viewport_read` | — | — |
| ERR-RESP-005 | ORIENTATION_UNKNOWN | INFO | Orientation API fail | Default portrait ADR | — | — | — |
| ERR-RESP-006 | LAYOUT_CONTRACT_VIOLATION | WARNING | Component breaks rules | Dev warn | — | component id | — |
| ERR-RESP-007 | RESPONSIVE_INIT_FAILED | CRITICAL | Fatal init | Continue base bp | `error.responsive.init_failed` | — | — |
| ERR-RESP-008 | FOLD_API_UNSUPPORTED | INFO | Foldable API absent | Ignore | — | — | — |
| ERR-RESP-009 | SAFE_AREA_UNKNOWN | INFO | env() unsupported | Zero insets ADR | — | — | — |
| ERR-RESP-010 | RESPONSIVE_SECURITY_VIOLATION | CRITICAL | Geo PII in payload | Block emit | `error.responsive.security` | code | payload |

---

## Normalización

```
ResponsiveError → ErrorHandling.normalizeResponsiveError() → ERR-090x band future ADR
```

Responsive errors **never** break Session, Auth, Permissions.

---

## Boot behavior

| Error | Fallback |
|-------|----------|
| ERR-RESP-002/007 | `bp.base` + RESPONSIVE_READY with warning |
| ERR-RESP-004 | Debounce retry once |

---

*RESPONSIVE-ERRORS v1.0 — 10 codes — TICKET-V2-SHARED-CORE-018*
