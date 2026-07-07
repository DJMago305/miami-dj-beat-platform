# NAMING-CONVENTIONS.md

**TICKET-V2-SHARED-CORE-017 — Components Library Specification**

**Módulo:** MOD-009 · Naming  
**Versión:** 1.0

---

## Component ID format

```
Mdj{ComponentName}
```

| Regla | Ejemplo | Anti-ejemplo |
|-------|---------|--------------|
| PascalCase after `Mdj` | `MdjButton` | `mdj-button` |
| Prefix `Mdj` mandatory | `MdjDataTable` | `Button` |
| No portal prefix in Core | `MdjModal` | `MdjClientModal` |
| No MOD-xxx in id | `MdjCard` | `MdjMOD108Card` |
| Descriptive not abbreviated | `MdjDatePicker` | `MdjDP` |

---

## File naming (runtime futuro)

| Artefacto | Patrón |
|-----------|--------|
| Spec entry | `COMPONENT-INVENTORY.md` row |
| Implementation | `MdjButton/` folder ADR |
| Test | `MdjButton.spec` ADR |
| Story | `MdjButton.stories` ADR |

**Este ticket:** solo ids en inventario — no archivos código.

---

## Variant naming

| Pattern | Example |
|---------|---------|
| lowercase enum | `primary`, `secondary` |
| semantic not visual-only | `danger` not `red` |
| size | `sm`, `md`, `lg` |

---

## i18n keys (reference only)

```
components.{componentId}.{slot}
```

Example: `components.MdjButton.submit` — values in MOD-015 catalog.

---

## Event naming

```
COMPONENT_{ACTION}
```

Upper snake — align EVENT-NAMING-STANDARD. Detail: COMPONENT-EVENTS.md.

---

## Flag keys

```
flag.mod-009.{component-kebab}
```

Align MOD-013 FLAG-CONTRACT.

---

## Deprecation

| Status | Label |
|--------|-------|
| Active | `documented` |
| Deprecated | `deprecated` + ADR id + sunset date |
| Removed | removed from inventory — archive ADR |

---

*NAMING-CONVENTIONS v1.0 — TICKET-V2-SHARED-CORE-017*
