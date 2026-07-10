# TRANSLATION-CONTRACT.md

**TICKET-V2-SHARED-CORE-013 — Internationalization Specification**

**Módulo:** MOD-015 · Contrato de traducción  
**Versión:** 1.0

---

## TranslationRequest (conceptual)

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `key` | string | ✅ | Dot-notation key |
| `params` | Record<string, string \| number> | ○ | Interpolation |
| `locale` | `en` \| `es` | ○ | Override; default activeLocale |
| `namespace` | string | ○ | Validation hint |

---

## TranslationResponse (conceptual)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `text` | string | Resolved string |
| `localeUsed` | string | Locale that supplied text |
| `fallbackApplied` | boolean | true if EN used |
| `missingKey` | boolean | true if dev marker |

---

## Key registry rules

| Regla | Detalle |
|-------|---------|
| T-01 | Unique globally across Core |
| T-02 | EN entry required before ES |
| T-03 | Max key length 128 chars |
| T-04 | Max value length 1024 chars |
| T-05 | No HTML in values unless `allowHtml: true` ADR |
| T-06 | No secrets, tokens, PII templates |

---

## Bundle structure (futuro)

```
shared/i18n/catalog/
  en/
    common.json
    error.json
    notification.json
  es/
    common.json
    ...
```

Runtime merge: `en` base + locale overlay shallow merge per namespace.

---

## Portal slice contract

| Portal | Namespace prefix | Owner |
|--------|------------------|-------|
| Client | `portal.client.*` | client/ tickets |
| Artist | `portal.artist.*` | artist/ tickets |
| Staff | `portal.staff.*` | staff/ tickets |

Portals **register** bundles at shell init — i18n Core merges.

---

## Anti-patterns

| Prohibido | Correcto |
|-----------|----------|
| `"Hello " + name` | `t('greeting', { name })` |
| Duplicate keys same string | Single key reuse |
| ES-only key | EN first |
| Copy in Theme CSS | Key in i18n |
| Permission label in capability id | Separate display key |

---

## Validation (runtime futuro)

Pre-publish checklist:

- EN key exists  
- ES key exists or explicit waiver ADR  
- Params in string ⊆ params provided  
- No duplicate values across keys same screen ADR  

---

*TRANSLATION-CONTRACT v1.0 — TICKET-V2-SHARED-CORE-013*
