# FEATURE-FLAGS-LIFECYCLE.md

**TICKET-V2-SHARED-CORE-015 — Feature Flags Specification**

**Módulo:** MOD-013 · Lifecycle  
**Versión:** 1.0

---

## Estados (9)

1. UNKNOWN  
2. LOADING  
3. RESOLVING  
4. READY  
5. UPDATED  
6. INVALID  
7. FALLBACK  
8. FAILED  
9. *(UPDATED es estado transitorio post-change — settle READY)*

---

## Tabla de transiciones

| Estado | Entrada | Salida | Evento | Error posible |
|--------|---------|--------|--------|---------------|
| **UNKNOWN** | Core boot | LOADING | FLAGS_LOADING | ERR-FLAG-001 |
| **LOADING** | Config keys read | RESOLVING \| FAILED | FLAGS_LOADING | ERR-FLAG-002 |
| **RESOLVING** | Merge env + registry | READY \| FALLBACK | — | ERR-FLAG-003, 004 |
| **READY** | All flags resolved | UPDATED \| stable | **FLAGS_READY** | — |
| **UPDATED** | Flag value change | READY | **FLAGS_UPDATED** | ERR-FLAG-009 |
| **INVALID** | Schema/unknown critical | FALLBACK | FLAGS_INVALIDATED | ERR-FLAG-003, 005 |
| **FALLBACK** | Safe defaults applied | READY | **FLAGS_FALLBACK** | ERR-FLAG-007 |
| **FAILED** | Unrecoverable registry | FALLBACK \| UNKNOWN | **FLAGS_ERROR** | ERR-FLAG-007, 010 |

---

## Eventos por transición

| Transición | Evento adicional |
|------------|------------------|
| Remote refresh start | FLAGS_REFRESH |
| Config hot reload | FLAGS_RELOADED |
| Invalidate cache | FLAGS_INVALIDATED |
| Resolution error | FLAGS_ERROR |

---

## Reglas

| # | Regla |
|---|-------|
| L-01 | **No** gate portal features antes de FLAGS_READY |
| L-02 | **No** persistir flag override inválido |
| L-03 | **Fallback obligatorio** — defaults documentados |
| L-04 | FLAGS_UPDATED vía Event Bus tras resolución estable |
| L-05 | Flag failure **no** rompe sesión ni permisos |
| L-06 | FAILED → all-safe-defaults (false red zone) before abort |
| L-07 | UPDATED transient — settles READY |
| L-08 | CONFIG_UPDATED → INVALID → RESOLVING → READY |

---

## Boot flow

```
UNKNOWN → LOADING → RESOLVING → READY → emit FLAGS_READY
```

---

## Refresh flow

```
READY → FLAGS_REFRESH → RESOLVING → UPDATED → FLAGS_UPDATED → READY
```

---

## Invalidation flow

```
CONFIG_UPDATED → INVALID → RESOLVING → (FALLBACK if needed) → READY → FLAGS_RELOADED
```

---

*FEATURE-FLAGS-LIFECYCLE v1.0 — TICKET-V2-SHARED-CORE-015*
