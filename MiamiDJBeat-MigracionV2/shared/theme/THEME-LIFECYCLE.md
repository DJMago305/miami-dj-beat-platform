# THEME-LIFECYCLE.md

**TICKET-V2-SHARED-CORE-014 — Theme Manager Specification**

**Módulo:** MOD-007 · Lifecycle  
**Versión:** 1.0

---

## Estados (11)

1. UNKNOWN  
2. CONFIG_LOADING  
3. DEFAULT_THEME_RESOLVED  
4. USER_PREFERENCE_CHECKING  
5. SYSTEM_PREFERENCE_CHECKING  
6. THEME_READY  
7. THEME_SWITCHING  
8. THEME_CHANGED  
9. THEME_INVALID  
10. FALLBACK_THEME_ACTIVE  
11. FAILED  

---

## Tabla de transiciones

| Estado | Entrada | Salida | Evento esperado | Error posible | Módulo siguiente |
|--------|---------|--------|-----------------|---------------|------------------|
| **UNKNOWN** | Core boot | CONFIG_LOADING | THEME_LOAD_STARTED | ERR-THEME-001 | Configuration |
| **CONFIG_LOADING** | config read | DEFAULT_THEME_RESOLVED \| FAILED | THEME_LOAD_SUCCEEDED / FAILED | ERR-THEME-002 | Configuration |
| **DEFAULT_THEME_RESOLVED** | default ok | USER_PREFERENCE_CHECKING | THEME_DEFAULT_RESOLVED | — | Storage |
| **USER_PREFERENCE_CHECKING** | read pref | SYSTEM_PREFERENCE_CHECKING \| THEME_READY | USER_PREFERENCE_FOUND / MISSING | ERR-THEME-005 | Storage |
| **SYSTEM_PREFERENCE_CHECKING** | pref=system | THEME_READY | SYSTEM_PREFERENCE_FOUND | — | OS media query |
| **THEME_READY** | tokens valid | THEME_SWITCHING \| stable | — | ERR-THEME-003 | Components future |
| **THEME_SWITCHING** | user/system change | THEME_CHANGED \| FAILED | SWITCH_REQUESTED / SUCCEEDED / FAILED | ERR-THEME-009 | Event Bus |
| **THEME_CHANGED** | emit done | THEME_READY | **THEME_CHANGED** | — | Portal listeners |
| **THEME_INVALID** | bad token/pref | FALLBACK_THEME_ACTIVE | — | ERR-THEME-003, 004 | Error Handling |
| **FALLBACK_THEME_ACTIVE** | fallback ok | THEME_READY | THEME_FALLBACK_ACTIVATED | ERR-THEME-007 | Logging |
| **FAILED** | fatal | FALLBACK_THEME_ACTIVE \| UNKNOWN | THEME_LOAD_FAILED | ERR-THEME-* | Error Handling |

---

## Reglas

| # | Regla |
|---|-------|
| L-01 | **No** aplicar tema sin tokens válidos |
| L-02 | **No** persistir preferencia inválida |
| L-03 | **Fallback obligatorio** si tema no resuelve |
| L-04 | **THEME_CHANGED** vía Event Bus al completar switch |
| L-05 | Error visual **no** rompe sesión ni permisos |
| L-06 | FAILED → fallback dark-gold-high-contrast before abort |
| L-07 | THEME_CHANGED transient — settles THEME_READY |

---

## Boot flow

```
UNKNOWN → CONFIG_LOADING → DEFAULT_THEME_RESOLVED
  → USER_PREFERENCE_CHECKING → (SYSTEM if needed) → THEME_READY
  → emit THEME_CHANGED (initial apply)
```

---

## Switch flow

```
THEME_READY → THEME_SWITCHING → validate tokens
  → THEME_CHANGED (Event Bus) → THEME_READY
  → Storage persist if user-initiated
```

---

*THEME-LIFECYCLE v1.0 — TICKET-V2-SHARED-CORE-014*
