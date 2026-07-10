# FALLBACK-STRATEGY.md

**TICKET-V2-SHARED-CORE-013 — Internationalization Specification**

**Módulo:** MOD-015 · Estrategia fallback  
**Versión:** 1.0

---

## Jerarquía fallback (keys)

```
1. activeLocale[key]
2. en[key]          ← Canonical / Fallback Language
3. dev:  [missing:key]
   prod: en[key] || key last segment || '…'
```

---

## Jerarquía fallback (locale resolution)

Ver LOCALE-RULES.md — i18n recibe locale ya resuelto; si inválido → `en`.

---

## Missing key behavior

| Entorno | Comportamiento |
|---------|----------------|
| local | `[missing:namespace.key]` visible |
| staging | Log warn + EN fallback |
| production | EN fallback · log key only |

Emit ERR-I18N-001 internal — no toast default.

---

## Partial ES coverage

| Condición | Acción |
|-----------|--------|
| ES key missing | Use EN value · ERR-I18N-004 warn once |
| ES outdated vs EN | EN wins until ES updated |
| PO waiver | ADR documents intentional EN-only keys |

---

## Format fallback

| Helper | Fallback |
|--------|----------|
| formatDate | ISO string if Intl fail |
| formatNumber | String(n) |
| formatCurrency | `{code} {amount}` |

---

## Cache invalidation on fallback change

When EN bundle updates:

- Invalidate memory cache  
- Re-merge all locales  
- Do **not** emit LANGUAGE_CHANGED unless active locale display changes  

---

## Prohibiciones

| Prohibido |
|-----------|
| Fallback to V1 `translations.js` |
| Fallback to browser auto-translate |
| Fallback to hardcoded Spanish in code |
| Silent empty string |

---

*FALLBACK-STRATEGY v1.0 — TICKET-V2-SHARED-CORE-013*
