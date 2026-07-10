# LANGUAGE-LIFECYCLE.md

**TICKET-V2-SHARED-CORE-013 — Internationalization Specification**

**Módulo:** MOD-015 · Ciclo de vida locale  
**Versión:** 1.0

---

## Estados

1. **UNINITIALIZED**  
2. **LOADING_BUNDLE**  
3. **READY**  
4. **SWITCHING_LOCALE**  
5. **BUNDLE_MISSING**  
6. **FAILED**

---

## Pipeline

```
Boot → UNINITIALIZED
  → resolve locale (external — Session/Config)
  → LOADING_BUNDLE
  → merge EN + active locale
  → READY
User/shell change locale → SWITCHING_LOCALE → LOADING_BUNDLE → READY → LANGUAGE_CHANGED
Missing bundle → BUNDLE_MISSING → fallback EN → READY
Fatal → FAILED → Error Handling
```

---

## Tabla de transiciones

| Estado | Entrada | Salida | Evento | Error | Módulo siguiente |
|--------|---------|--------|--------|-------|------------------|
| UNINITIALIZED | Core boot | LOADING_BUNDLE | — | — | Configuration |
| LOADING_BUNDLE | locale known | READY \| BUNDLE_MISSING | — | ERR-I18N-003 | Storage |
| READY | `t()` calls | READY \| SWITCHING_LOCALE | — | ERR-I18N-001 | UI consumers |
| SWITCHING_LOCALE | setActiveLocale | LOADING_BUNDLE | pre-change | — | Session |
| BUNDLE_MISSING | file absent | READY (EN fallback) | — | ERR-I18N-004 warn | Logging |
| FAILED | parse error | UNINITIALIZED retry | — | ERR-I18N-002 | Error Handling |

---

## Boot sequence

```
1. Configuration.defaultLocale available
2. Session restore → locale from Preferences / session key
3. i18n.setActiveLocale(resolved)  // external caller
4. Load EN bundle (mandatory)
5. Load active locale overlay
6. State → READY
7. Portal shell may render i18n-dependent UI
```

i18n **no** ejecuta paso 2 — Session/portal orchestrates.

---

## Locale change sequence

```
1. User selects language (portal UI)
2. Portal → Session update preference
3. Portal → i18n.setActiveLocale(newLocale)
4. SWITCHING_LOCALE → reload bundles
5. Emit LANGUAGE_CHANGED { locale }
6. Listeners re-bind UI (Event Bus)
7. Storage Preferences persist locale
```

---

## Reglas

| # | Regla |
|---|-------|
| L-01 | No render portal i18n-only labels before READY (shell hardcoded exception — portal ADR) |
| L-02 | SWITCHING_LOCALE atomic — no mixed locale UI mid-frame ADR |
| L-03 | Logout no borra locale pref por default |
| L-04 | FAILED no deja locale undefined — fallback EN |

---

*LANGUAGE-LIFECYCLE v1.0 — TICKET-V2-SHARED-CORE-013*
