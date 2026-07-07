# COMPONENT-LIFECYCLE.md

**TICKET-V2-SHARED-CORE-017 — Components Library Specification**

**Módulo:** MOD-009 · Lifecycle (subsistema registry)  
**Versión:** 1.0

> Lifecycle del **registry de componentes** en boot — no lifecycle DOM individual (runtime ADR).

---

## Estados (8)

1. UNREGISTERED  
2. REGISTRY_LOADING  
3. REGISTRY_READY  
4. COMPONENT_REGISTERED  
5. COMPONENT_DEPRECATED  
6. COMPONENT_REMOVED  
7. REGISTRY_INVALID  
8. REGISTRY_FAILED  

---

## Tabla de transiciones

| Estado | Entrada | Salida | Evento | Error |
|--------|---------|--------|--------|-------|
| **UNREGISTERED** | App boot | REGISTRY_LOADING | COMPONENT_REGISTRY_LOADING | ERR-COMP-001 |
| **REGISTRY_LOADING** | Parse inventory | REGISTRY_READY \| FAILED | COMPONENT_REGISTRY_READY | ERR-COMP-002 |
| **REGISTRY_READY** | Catalog valid | COMPONENT_REGISTERED | — | — |
| **COMPONENT_REGISTERED** | New spec approved | stable | COMPONENT_ADDED | — |
| **COMPONENT_DEPRECATED** | ADR deprecate | COMPONENT_REMOVED | COMPONENT_DEPRECATED | — |
| **COMPONENT_REMOVED** | Cutover complete | REGISTRY_READY | COMPONENT_REMOVED | — |
| **REGISTRY_INVALID** | Schema fail | REGISTRY_FAILED | COMPONENT_REGISTRY_INVALID | ERR-COMP-003 |
| **REGISTRY_FAILED** | Fatal | UNREGISTERED | COMPONENT_REGISTRY_ERROR | ERR-COMP-007 |

---

## Boot sequence (conceptual)

```
FLAGS_READY → REGISTRY_LOADING → REGISTRY_READY
  → Portal may compose after PORTAL_READY ADR
```

Component registry **non-fatal** on partial invalid — skip entry + log WARN.

---

## Reglas

| # | Regla |
|---|-------|
| L-01 | Unknown component id at portal → ERR-COMP-004 |
| L-02 | Deprecated component — warn dev · allow until cutover date |
| L-03 | Removed component — hard fail dev build ADR |
| L-04 | Registry version semver in manifest ADR |

---

*COMPONENT-LIFECYCLE v1.0 — TICKET-V2-SHARED-CORE-017*
