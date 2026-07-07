# COMPONENT-ERRORS.md

**TICKET-V2-SHARED-CORE-017 — Components Library Specification**

**Módulo:** MOD-009 · Errores  
**Versión:** 1.0

> Catálogo **ERR-COMP-xxx**. Alineación conceptual Error Handler — **sin modificar** ERROR-CATALOG en este ticket.

---

## Catálogo ERR-COMP

| Código | Nombre | Severidad | Causa | Acción sistema | userMessageKey | Log permitido | Log prohibido |
|--------|--------|-----------|-------|----------------|----------------|---------------|---------------|
| ERR-COMP-001 | UNKNOWN_REGISTRY_STATE | WARNING | Boot state corrupt | Reset REGISTRY_LOADING | `error.comp.unknown_state` | state | — |
| ERR-COMP-002 | REGISTRY_CONFIG_MISSING | ERROR | Inventory manifest absent | Empty registry + WARN | `error.comp.registry_missing` | path | — |
| ERR-COMP-003 | INVALID_COMPONENT_DEFINITION | ERROR | Contract schema fail | Skip entry | `error.comp.invalid_definition` | component id | props dump |
| ERR-COMP-004 | UNKNOWN_COMPONENT_ID | INFO | Portal requests unknown id | Fallback placeholder ADR | `error.comp.unknown_id` | id | — |
| ERR-COMP-005 | COMPOSITION_VIOLATION | WARNING | Invalid child in tree | Dev warn · block prod ADR | — | parent, child ids | — |
| ERR-COMP-006 | ACCESSIBILITY_VIOLATION | ERROR | Missing ariaLabelKey etc. | Block dev build ADR | — | component id | user data |
| ERR-COMP-007 | REGISTRY_LOAD_FAILED | CRITICAL | Fatal parse | REGISTRY_FAILED · continue app | `error.comp.load_failed` | version | — |
| ERR-COMP-008 | THEME_TOKEN_MISSING | WARNING | Referenced token absent | Use DS fallback ADR | — | token id | — |
| ERR-COMP-009 | DEPRECATED_COMPONENT_USED | INFO | Sunset passed | Warn · render stub ADR | — | id, sunset | — |
| ERR-COMP-010 | COMPONENT_SECURITY_VIOLATION | CRITICAL | PII/secret in props | Block render · log security | `error.comp.security` | violation code | prop values |

---

## Normalización

```
ComponentError → ErrorHandling.normalizeComponentError() → ERR-090x band future ADR
```

Component errors **never** break Auth, Session, Permissions.

---

## Retry hints

| Código | Retry |
|--------|-------|
| ERR-COMP-007 | false — fallback empty registry |
| ERR-COMP-008 | true once after THEME_CHANGED |
| ERR-COMP-010 | false — fatal audit |

---

## Dev vs prod

| Código | Dev | Prod |
|--------|-----|------|
| ERR-COMP-005 | throw/build fail ADR | log warn |
| ERR-COMP-006 | build fail | log error |

---

*COMPONENT-ERRORS v1.0 — 10 codes — TICKET-V2-SHARED-CORE-017*
