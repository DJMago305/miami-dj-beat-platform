# ACCESSIBILITY-GUIDELINES.md

**TICKET-V2-SHARED-CORE-017 — Components Library Specification**

**Módulo:** MOD-009 · Accesibilidad componentes  
**Versión:** 1.0

> Aplica reglas `../design-system/` y `../theme/THEME-ACCESSIBILITY.md` a **componentes**. Sin implementación ARIA runtime.

---

## Principios

| # | Principio |
|---|-----------|
| A-01 | WCAG 2.1 AA target |
| A-02 | Keyboard operable all interactive components |
| A-03 | Focus visible — DESIGN-RULES R-06 |
| A-04 | Color not sole indicator — icon + text |
| A-05 | Touch target min 44×44px mobile |
| A-06 | `prefers-reduced-motion` respected |
| A-07 | Screen reader labels via i18n keys |

---

## Por tipo de componente

| Tipo | Requisitos |
|------|------------|
| **Button** | role button · Space/Enter · ariaLabelKey if icon-only |
| **Input** | label associated · error announced · aria-invalid |
| **Modal/Dialog** | focus trap · Esc close · aria-modal · restore focus |
| **Drawer** | same as modal · aria-expanded |
| **Tabs** | roving tabindex · aria-selected |
| **Table** | th scope · caption optional key |
| **Alert** | role alert/status · not color-only |
| **Toast** | aria-live polite/assertive per severity MOD-011 pair |

---

## Focus management

| Pattern | Rule |
|---------|------|
| Open overlay | Move focus first focusable |
| Close overlay | Restore trigger focus |
| Nested modals | Stack focus ADR |
| Skip link | Portal shell — not Core component |

---

## Live regions

Pair with MOD-011 Notifications — Components supply **shell** only; live politeness in contract.

---

## Disabled vs aria-disabled

| State | Pattern |
|-------|---------|
| Disabled | `disabled` + no focus |
| Read-only | Not disabled — readable |

---

## Testing (futuro)

| Check | Ticket |
|-------|--------|
| axe automated | Runtime ADR |
| Keyboard walk | QA checklist |
| Screen reader spot | PO gate |

---

*ACCESSIBILITY-GUIDELINES v1.0 — TICKET-V2-SHARED-CORE-017*
