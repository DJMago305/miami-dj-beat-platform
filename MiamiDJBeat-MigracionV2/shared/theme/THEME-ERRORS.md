# THEME-ERRORS.md

**TICKET-V2-SHARED-CORE-014 — Theme Manager Specification**

**Módulo:** MOD-007 · Errores  
**Versión:** 1.0

> Alineación conceptual Error Handler — **sin modificar** `shared/errors/` en este ticket.

---

## Catálogo ERR-THEME

| Código | Nombre | Severidad | Causa | Acción sistema | userMessageKey | Log permitido | Log prohibido |
|--------|--------|-----------|-------|----------------|----------------|---------------|---------------|
| ERR-THEME-001 | UNKNOWN_THEME_STATE | WARNING | State corrupt boot | Reset lifecycle | `error.theme.unknown_state` | state name | — |
| ERR-THEME-002 | THEME_CONFIG_MISSING | ERROR | Config theme keys absent | DEFAULT fallback | `error.theme.config_missing` | config key names | secrets |
| ERR-THEME-003 | INVALID_THEME_TOKEN | ERROR | Token fails schema | THEME_INVALID → fallback | `error.theme.invalid_token` | token id | hex values dump |
| ERR-THEME-004 | INVALID_USER_PREFERENCE | INFO | Bad pref value | Ignore persist · default | `error.theme.invalid_pref` | pref enum | — |
| ERR-THEME-005 | STORAGE_READ_FAILED | WARNING | Cannot read theme pref | Use default | `error.theme.storage_read` | key name | pref value |
| ERR-THEME-006 | STORAGE_WRITE_FAILED | WARNING | Cannot persist pref | Continue active theme | `error.theme.storage_write` | key name | — |
| ERR-THEME-007 | FALLBACK_THEME_FAILED | CRITICAL | Even fallback invalid | FAILED · minimal inline ADR | `error.theme.fallback_failed` | theme ids | tokens |
| ERR-THEME-008 | ACCESSIBILITY_CONTRAST_FAILED | WARNING | Contrast check fail spec | Force high-contrast theme | `error.theme.contrast` | pair ids | — |
| ERR-THEME-009 | THEME_SWITCH_FAILED | ERROR | Switch mid-flight fail | Revert previous theme | `error.theme.switch_failed` | themeId | — |
| ERR-THEME-010 | THEME_SECURITY_VIOLATION | CRITICAL | Secret in token payload | Block apply · log security | `error.theme.security` | violation code | payload |

---

## Normalización

```
ThemeError → ErrorHandling.normalizeThemeError() → userMessageKey via i18n
```

Theme errors **never** break Session or Permissions state.

---

*THEME-ERRORS v1.0 — 10 codes — TICKET-V2-SHARED-CORE-014*
