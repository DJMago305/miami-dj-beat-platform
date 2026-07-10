# I18N-SPEC.md

**TICKET-V2-SHARED-CORE-013 — Internationalization Specification**

**Módulo:** MOD-015 Internationalization (i18n)  
**Ticket:** TICKET-V2-SHARED-CORE-013  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Autoridad **única** de localización del Shared Core V2.  
> Resuelve keys → strings. **No** decide idioma del usuario. **No** renderiza UI.

---

## 1. Propósito

Proveer el contrato central de **traducción y formato locale-aware** para MiamiDJBeat-MigracionV2: keys, namespaces, fallback, interpolación, fechas, números y moneda — sin implementar bundles runtime en este ticket.

---

## 2. Scope

| Incluye | Descripción |
|---------|-------------|
| Translation keys | Catálogo Core + convenciones |
| `t(key, params?)` | Facade conceptual |
| Locales soportados | `en`, `es` (MVP) |
| Fallback | EN canónico → ver FALLBACK-STRATEGY.md |
| Format helpers | date, number, currency (conceptual) |
| Eventos | `LANGUAGE_CHANGED` |
| Errores | ERR-I18N-* → Error Handling |
| Cache | Bundles en memoria + Storage Preferences |

---

## 3. Non-scope

| Excluye | Responsable |
|---------|-------------|
| Decidir idioma activo del usuario | Session + Preferences + portal shell |
| Render UI / DOM | Portales · Components |
| Permisos / roles | Permissions |
| Identidad / auth copy flow | Auth |
| Tema visual / tokens | Theme MOD-007 |
| Copy legal sin PO | Legal tickets |
| Traducción V1 `translations.js` copy | Prohibido |
| Implementación Supabase | N/A |
| Nav anti-flash hardcoded HTML | Portal shell tickets |

---

## 4. Arquitectura

```
Configuration (defaultLocale)
       ↓
Session / Preferences (locale ref) ──→ i18n.setActiveLocale(locale)
       ↓
i18n.t(key, params) ──→ string
       ↑
Error Handling (userMessageKey) · Notifications (messageKey)
       ↑
Portal Shell / Components (consumen keys only)
```

i18n es **leaf consumer** de locale; **no** importa Permissions ni Auth.

---

## 5. Terminología

| Término | Definición |
|---------|------------|
| **Locale** | `en` \| `es` — idioma activo |
| **Canonical Language** | `en` — fuente de verdad para keys |
| **Fallback Language** | `en` — cuando falta key en locale activo |
| **Translation Key** | Identificador dot-notation único |
| **Namespace** | Prefijo lógico de keys (`error.`, `notification.`) |
| **Bundle** | Mapa locale → key → string |
| **Interpolation** | Sustitución `{param}` en template |
| **Active Locale** | Locale aplicado en runtime i18n |

---

## 6. Idiomas soportados

| Código | Idioma | Rol MVP |
|--------|--------|---------|
| `en` | English | **Canonical** · obligatorio completo |
| `es` | Español | Primer idioma secundario |

Futuros locales → ADR + catalog update antes de runtime.

---

## 7. Canonical Language

**English (`en`)** es el idioma canónico del sistema.

- Toda key nueva se define **primero** en EN.
- ES sigue EN; nunca al revés.
- Legal / técnico / producto: preferir EN cuando ES sea ambiguo.

---

## 8. Fallback Language

**English (`en`)** es el fallback universal.

Pipeline: active locale → EN → dev marker. Ver **FALLBACK-STRATEGY.md**.

---

## 9. Namespaces

| Namespace | Owner | Ejemplo |
|-----------|-------|---------|
| `common.*` | i18n Core | `common.button.save` |
| `error.*` | Error Handling | `error.api.timeout` |
| `notification.*` | Notifications | `notification.success.saved` |
| `auth.*` | Auth (keys only) | `auth.error.login_failed` |
| `config.*` | Configuration | `config.env.local` |
| `portal.client.*` | Portal Client | slice futuro |
| `portal.artist.*` | Portal Artist | slice futuro |
| `portal.staff.*` | Portal Staff | slice futuro |

Core Shared **solo** `common`, `error`, `notification`, `auth`, `config` transversales.

---

## 10. Translation Keys

Formato: `namespace.segment.snake_case`

| Regla | Detalle |
|-------|---------|
| K-01 | Lowercase + dots + underscores |
| K-02 | Sin espacios ni acentos en key |
| K-03 | EN string en catálogo primero |
| K-04 | Una key = un concepto |
| K-05 | Prohibido key duplicada con distinto meaning |

Ver **TRANSLATION-CONTRACT.md**.

---

## 11. Interpolation

| Regla | Detalle |
|-------|---------|
| I-01 | Placeholders `{name}` — no `$` templates |
| I-02 | Params object escapado HTML default |
| I-03 | **Nunca** concatenar strings manualmente en UI |
| I-04 | Orden params irrelevante |
| I-05 | Missing param → `[missing:param]` dev · key fallback prod ADR |

---

## 12. Plural Rules

| Locale | Regla MVP |
|--------|-----------|
| `en` | `{count, plural, one {# item} other {# items}}` ADR ICU futuro |
| `es` | Misma convención ADR |

MVP spec: documentar keys separadas `*.one` / `*.other` hasta ICU ADR.

---

## 13. Date Format

| Función conceptual | Input | Output |
|--------------------|-------|--------|
| `formatDate(iso, style?)` | ISO 8601 | locale string |

| Style | en ejemplo | es ejemplo |
|-------|------------|------------|
| short | 7/5/26 | 5/7/26 |
| long | July 5, 2026 | 5 de julio de 2026 |

Usa `Intl.DateTimeFormat` en runtime futuro — spec only.

---

## 14. Number Format

| Función | Uso |
|---------|-----|
| `formatNumber(n, options?)` | Decimales locale |

`en`: `1,234.56` · `es`: `1.234,56`

---

## 15. Currency Format

| Función | Uso |
|---------|-----|
| `formatCurrency(amount, currencyCode)` | USD default brand |

`en-US`: `$1,234.56` · `es-US`: `$1.234,56` (ADR locale tag)

Currency code from business layer — i18n **no** convierte FX.

---

## 16. Locale Resolution

i18n **no decide** idioma del usuario. Recibe locale resuelto:

| Prioridad | Fuente |
|-----------|--------|
| 1 | User explicit preference (Preferences / Session) |
| 2 | Session restore `mdj_v2_locale` |
| 3 | Configuration `defaultLocale` |
| 4 | Browser `navigator.language` (boot only — portal ADR) |

Ver **LOCALE-RULES.md** y **LANGUAGE-LIFECYCLE.md**.

---

## 17. Caching

| Layer | Contenido | TTL |
|-------|-----------|-----|
| Memory | Active bundle merged | session |
| Storage Preferences | `locale` key only | persistent |
| Bundle cache | Loaded JSON maps | until LANGUAGE_CHANGED |

Ver Storage namespace Preferences — i18n **no** persiste strings duplicados.

---

## 18. Invalidation

| Trigger | Action |
|---------|--------|
| `LANGUAGE_CHANGED` | Reload active bundle · clear memory cache |
| CONFIG version bump | Reload default locale config |
| Session logout | Keep locale pref optional ADR |
| Bundle hotfix ADR | version bump namespace |

---

## 19. Eventos

Ver **I18N-EVENTS.md** — `LANGUAGE_CHANGED` primary.

---

## 20. Errores

Ver **I18N-ERRORS.md** — ERR-I18N-001–010.

---

## 21. Relación con otros módulos

| Módulo | Relación |
|--------|----------|
| **Configuration** MOD-006 | `defaultLocale`, bundle paths |
| **Session** MOD-002 | Locale ref in snapshot; no i18n → Session |
| **Storage** MOD-012 | Preferences `locale` read/write via facade |
| **Notifications** MOD-011 | `messageKey` + params → `t()` |
| **Error Handling** MOD-014 | `userMessageKey` → `t()` |
| **Theme** MOD-007 | **Separado** — no mezclar tokens con copy |
| **API Client** MOD-005 | Sin traducción HTTP body — errors via Error Handling |
| **Permissions** MOD-003 | **Sin relación** |
| **Auth** MOD-001 | **Sin relación** — Auth usa keys, no lógica i18n |
| **Event Bus** MOD-004 | Emite `LANGUAGE_CHANGED` |
| **Portal Shell** | Consume `t()`; portal bundles namespace `portal.*` |

---

## 22. Reglas obligatorias

| # | Regla |
|---|-------|
| R-01 | **English** idioma canónico |
| R-02 | **Español** primer idioma soportado |
| R-03 | Toda traducción usa **Translation Keys** |
| R-04 | **Nunca** texto hardcoded en UI Core |
| R-05 | **Nunca** concatenar textos manualmente |
| R-06 | Toda UI consume **solo** Translation Keys |
| R-07 | **No** guardar textos duplicados cross-namespace |
| R-08 | **No** mezclar traducción con Theme |
| R-09 | **No** mezclar traducción con Permissions |
| R-10 | **No** mezclar traducción con Authentication |
| R-11 | i18n **no decide** idioma del usuario |
| R-12 | HTML escape default en output |

---

## Facade conceptual (runtime futuro)

```
createI18n(config, storageReader) → I18nFacade

I18nFacade.t(key, params?, localeOverride?)
I18nFacade.setActiveLocale(locale)  // called by Session/shell — not decision inside i18n
I18nFacade.getActiveLocale()
I18nFacade.formatDate / formatNumber / formatCurrency
I18nFacade.hasKey(key, locale?)
```

---

## Referencias

- `LANGUAGE-LIFECYCLE.md`
- `TRANSLATION-CONTRACT.md`
- `LOCALE-RULES.md`
- `I18N-EVENTS.md`
- `I18N-ERRORS.md`
- `FALLBACK-STRATEGY.md`
- `../CONTRACTS.md` §10

---

*I18N-SPEC v1.0 — TICKET-V2-SHARED-CORE-013*
