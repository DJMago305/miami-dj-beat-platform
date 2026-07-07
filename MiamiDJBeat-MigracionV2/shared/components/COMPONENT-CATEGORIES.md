# COMPONENT-CATEGORIES.md

**TICKET-V2-SHARED-CORE-017 — Components Library Specification**

**Módulo:** MOD-009 · Clasificación  
**Versión:** 1.0

> Categorías oficiales del inventario. **No** diseño visual — solo taxonomía.

---

## Jerarquía atomic

| Nivel | Descripción | Ejemplos |
|-------|-------------|----------|
| **Atom** | Indivisible UI unit | Icon, Badge, Spinner |
| **Molecule** | Atoms combined | Button, Input, Alert |
| **Organism** | Complex pattern | DataTable, Modal, Tabs |
| **Template** | Layout slot pattern | FormSection, PageHeader — portal composes |

Shared Core inventory covers **Atom → Organism**. Templates mostly portal — documented when reusable.

---

## Categorías oficiales

| Categoría | Propósito | Atomic level |
|-----------|-----------|--------------|
| **Foundation** | Primitives | Atom |
| **Layout** | Structure without business | Atom–Molecule |
| **Navigation** | Nav patterns — **not** portal `#mainNav` | Molecule–Organism |
| **Forms** | Form structure | Organism |
| **Inputs** | Data entry controls | Molecule |
| **Buttons** | Actions | Molecule |
| **Cards** | Content containers | Molecule |
| **Tables** | Tabular data display | Organism |
| **Lists** | Vertical collections | Molecule–Organism |
| **Dialogs** | Focus-trap overlays | Organism |
| **Drawers** | Side panels | Organism |
| **Modals** | Center overlays | Organism |
| **Tabs** | Section switching | Organism |
| **Badges** | Status labels | Atom |
| **Alerts** | Inline messages | Molecule |
| **Notifications** | Toast/banner shells — pairs MOD-011 | Molecule |
| **Media** | Image/video containers | Molecule |
| **Charts** | Data viz shells — no chart engine | Organism |
| **Scheduling** | Calendar/date UI shells | Organism |
| **Payments** | Payment UI shells — no PCI logic | Organism |
| **Uploads** | File picker shells | Molecule |
| **Utilities** | VisuallyHidden, Portal, FocusTrap | Atom–Molecule |

---

## Reglas por categoría

| Regla | Detalle |
|-------|---------|
| CAT-01 | Foundation has no business props |
| CAT-02 | Navigation excludes site 10-pillar nav — portal |
| CAT-03 | Payments/Uploads — presentation only; tokenization portal/Edge |
| CAT-04 | Notifications UI ≠ MOD-011 orchestration |
| CAT-05 | Charts — container + a11y; library ADR separate |
| CAT-06 | Scheduling — no booking logic in Core |

---

## Portal vs Core boundary

| Core Components | Portal-only (NOT in inventory) |
|-----------------|--------------------------------|
| Button, Modal, Table | `#mainNav`, owner-tabs strip |
| Breadcrumb pattern | Staff CRM panels |
| Generic PageHeader | Portal dashboard layouts |

---

*COMPONENT-CATEGORIES v1.0 — TICKET-V2-SHARED-CORE-017*
