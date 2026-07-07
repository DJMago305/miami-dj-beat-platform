# COMPOSITION-RULES.md

**TICKET-V2-SHARED-CORE-017 — Components Library Specification**

**Módulo:** MOD-009 · Composición  
**Versión:** 1.0

---

## Principios de composición

| # | Regla |
|---|-------|
| C-01 | Prefer composition over mega-component |
| C-02 | Slots named — header, body, footer, actions |
| C-03 | Foundation inside Layout inside Pattern |
| C-04 | Max depth 4 levels without ADR |
| C-05 | Portal composes organisms — Core does not compose pages |

---

## Allowed composition patterns

| Parent | Allowed children |
|--------|------------------|
| MdjModal | MdjButton, MdjText, MdjStack, form organisms |
| MdjCard | MdjText, MdjBadge, MdjButton, MdjMedia |
| MdjForm | MdjInput, MdjSelect, MdjButton, MdjAlert |
| MdjDataTable | MdjBadge, MdjButton (row actions), MdjSkeleton |
| MdjTabs | Panel content any — one visible |

---

## Prohibited composition

| Pattern | Razón |
|---------|-------|
| MdjButton contains MdjModal | Inversion — trigger outside |
| Core component imports portal module | Dependency violation |
| Nested Modals >2 | UX/a11y — ADR required |
| Payment form inside MdjCard without MdjPaymentShell | Use Payments category |

---

## Slot contract

| Slot | Optional | i18n |
|------|----------|------|
| header | ○ | titleKey |
| footer | ○ | action keys |
| default | ✅ | content via children keys |

---

## Layout composition

```
MdjContainer
  → MdjStack (vertical)
    → MdjPageHeader (organism ADR portal)
    → MdjCard
      → content
```

Grid alignment — LAYOUT-GRID via MdjGrid/MdjStack.

---

## Event bubbling (conceptual)

UI events stop at component boundary — portal handles business. Component emits `onClose` not `ORDER_SUBMIT`.

---

*COMPOSITION-RULES v1.0 — TICKET-V2-SHARED-CORE-017*
