# LOCALE-RULES.md

**TICKET-V2-SHARED-CORE-013 — Internationalization Specification**

**Módulo:** MOD-015 · Reglas de locale  
**Versión:** 1.0

---

## Principio

> **i18n aplica locale; no lo decide.**  
> Resolución ocurre en Session, Preferences, Configuration o portal shell.

---

## Locales válidos

| Código | Válido |
|--------|--------|
| `en` | ✅ |
| `es` | ✅ |
| otros | ❌ reject ERR-I18N-005 |

---

## Resolución (orden oficial)

| # | Fuente | Módulo owner |
|---|--------|--------------|
| 1 | User preference explicit | Portal → Storage Preferences |
| 2 | Session snapshot `locale` | Session MOD-002 |
| 3 | Storage `mdj_v2_preferences_locale` | Storage MOD-012 |
| 4 | Configuration `defaultLocale` | Configuration MOD-006 |
| 5 | Browser detect (first visit only) | Portal shell ADR |

Resultado → `resolvedLocale` pasado a `i18n.setActiveLocale(resolvedLocale)`.

---

## Storage keys

| Key | Namespace | Valor |
|-----|-----------|-------|
| `locale` | Preferences | `en` \| `es` |

Session mirror: `mdj_v2_session_locale` / SESSION-STORAGE — Session writes; i18n reads via orchestrator.

---

## Configuration keys

| Key | Default |
|-----|---------|
| `i18n.defaultLocale` | `en` |
| `i18n.supportedLocales` | `['en','es']` |
| `i18n.fallbackLocale` | `en` |

---

## Session sync

| Event | Action |
|-------|--------|
| SESSION_READY | If locale changed → i18n.setActiveLocale |
| LANGUAGE_CHANGED | Session may update snapshot locale field |
| USER_LOGOUT | Locale pref persists (default) |

---

## Browser detect (ADR)

```
navigator.language startsWith 'es' → suggest 'es'
else → 'en'
```

Suggestion only — user confirm or preference overrides.

---

## Reglas

| # | Regla |
|---|-------|
| LR-01 | Invalid locale → ERR-I18N-005 → fallback EN |
| LR-02 | i18n never reads Permissions |
| LR-03 | i18n never reads Auth identity for locale |
| LR-04 | Staff vs client same locale mechanism — no role-based language |
| LR-05 | Legal locale ADR separate — not auto from browser |

---

*LOCALE-RULES v1.0 — TICKET-V2-SHARED-CORE-013*
