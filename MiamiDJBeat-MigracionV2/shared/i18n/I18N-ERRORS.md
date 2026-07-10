# I18N-ERRORS.md

**TICKET-V2-SHARED-CORE-013 — Internationalization Specification**

**Módulo:** MOD-015 · Errores  
**Versión:** 1.0

> Alineación conceptual ERR-0800 band Validation — **sin modificar** `shared/errors/ERROR-CATALOG.md` en este ticket.

---

## Catálogo ERR-I18N

| Código | Nombre | Severidad | Causa | Acción sistema | userMessageKey | Log permitido | Log prohibido |
|--------|--------|-----------|-------|----------------|----------------|---------------|---------------|
| ERR-I18N-001 | KEY_NOT_FOUND | INFO | Key missing all locales | Fallback EN → marker | `error.i18n.key_not_found` | key name | params PII |
| ERR-I18N-002 | BUNDLE_PARSE_FAILED | ERROR | Invalid JSON bundle | FAILED state · EN only | `error.i18n.bundle_parse` | file path | bundle content |
| ERR-I18N-003 | BUNDLE_LOAD_FAILED | ERROR | Network/fs load fail | Retry once · EN | `error.i18n.bundle_load` | path | — |
| ERR-I18N-004 | BUNDLE_MISSING_LOCALE | WARNING | es file absent | EN fallback continue | — (internal) | locale code | — |
| ERR-I18N-005 | INVALID_LOCALE | INFO | Unsupported locale code | Reject · use EN | `error.i18n.invalid_locale` | locale attempted | — |
| ERR-I18N-006 | INTERPOLATION_FAILED | WARNING | Missing param | Return partial + marker dev | `error.i18n.interpolation` | key, param name | param value |
| ERR-I18N-007 | DUPLICATE_KEY_REGISTRY | ERROR | Catalog duplicate | Block publish CI ADR | — | key | values |
| ERR-I18N-008 | NAMESPACE_VIOLATION | WARNING | Portal writes Core ns | Reject write | — | namespace | — |
| ERR-I18N-009 | NOT_READY | WARNING | `t()` before READY | Queue or return key ADR | — | state | — |
| ERR-I18N-010 | HARDCODED_STRING_DETECTED | CRITICAL | Lint CI portal | Fail build ADR | — | file path | string content |

---

## Normalización

```
I18nError → ErrorHandling.normalizeI18nError() → ERR-080x band future sync
```

i18n **never** shows raw error to user — key only.

---

*I18N-ERRORS v1.0 — 10 codes — TICKET-V2-SHARED-CORE-013*
