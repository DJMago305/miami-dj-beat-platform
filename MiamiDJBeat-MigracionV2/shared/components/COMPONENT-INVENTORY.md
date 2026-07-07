# COMPONENT-INVENTORY.md

**TICKET-V2-SHARED-CORE-017 — Components Library Specification**

**Módulo:** MOD-009 · Inventario conceptual  
**Versión:** 1.0

> **Estado:** `documented` = spec en este ticket · **sin implementación**.  
> Columnas: Nombre · Categoría · Propósito · Consumidores · Dependencias · Estado · Observaciones

---

## Foundation

| Nombre | Categoría | Propósito | Consumidores | Dependencias | Estado | Observaciones |
|--------|-----------|-----------|--------------|--------------|--------|---------------|
| MdjIcon | Foundation | Icono tokenizado | all | icon scale, status.* | documented | Pair text a11y |
| MdjText | Foundation | Tipografía roles | all | type.*, text.* | documented | No raw strings |
| MdjSpacer | Foundation | Spacing utility | all | spacing.* | documented | Layout aid |
| MdjDivider | Foundation | Separador visual | all | border.default | documented | — |
| MdjSpinner | Foundation | Loading indicator | all | icon.md, motion | documented | reduced motion ADR |

---

## Layout

| Nombre | Categoría | Propósito | Consumidores | Dependencias | Estado | Observaciones |
|--------|-----------|-----------|--------------|--------------|--------|---------------|
| MdjContainer | Layout | Max-width wrapper | all | layout grid, spacing.lg | documented | MOD-016 breakpoints |
| MdjStack | Layout | Flex stack | all | spacing.md | documented | vertical default |
| MdjGrid | Layout | Grid columns | all | LAYOUT-GRID | documented | 12-col |
| MdjFlex | Layout | Flex row/column | all | spacing | documented | — |
| MdjVisuallyHidden | Utilities | Screen reader only | all | — | documented | a11y |

---

## Navigation

| Nombre | Categoría | Propósito | Consumidores | Dependencias | Estado | Observaciones |
|--------|-----------|-----------|--------------|--------------|--------|---------------|
| MdjBreadcrumb | Navigation | Path hierarchy | all | MdjText, MdjIcon | documented | Not #mainNav |
| MdjNavItem | Navigation | Single nav link pattern | all | MdjButton ghost | documented | Portal supplies href |
| MdjNavGroup | Navigation | Group label + items | artist, staff | MdjStack | documented | — |
| MdjPagination | Navigation | Page controls | all | MdjButton | documented | — |
| MdjStepper | Navigation | Multi-step progress | client, artist | MdjBadge | documented | Wizard shells |

---

## Forms · Inputs · Buttons

| Nombre | Categoría | Propósito | Consumidores | Dependencias | Estado | Observaciones |
|--------|-----------|-----------|--------------|--------------|--------|---------------|
| MdjForm | Forms | Form layout wrapper | all | MdjStack, MdjAlert | documented | No validation logic |
| MdjFormField | Forms | Label+input+error slot | all | MdjText, inputs | documented | — |
| MdjInput | Inputs | Text input | all | surface, border, focus | documented | labelKey required |
| MdjTextarea | Inputs | Multiline input | all | MdjInput patterns | documented | — |
| MdjSelect | Inputs | Dropdown select | all | MdjInput, MdjModal list ADR | documented | — |
| MdjCheckbox | Inputs | Boolean toggle | all | MdjText | documented | — |
| MdjRadio | Inputs | Single select group | all | MdjText | documented | — |
| MdjSwitch | Inputs | On/off toggle | all | semantic.accent | documented | — |
| MdjDatePicker | Inputs | Date selection shell | all | Scheduling | documented | No timezone logic |
| MdjButton | Buttons | Action trigger | all | accent, radius, states | documented | Variants DS |
| MdjIconButton | Buttons | Icon-only action | all | MdjButton, ariaLabelKey | documented | — |
| MdjButtonGroup | Buttons | Grouped actions | all | MdjButton | documented | — |

---

## Cards · Lists · Tables

| Nombre | Categoría | Propósito | Consumidores | Dependencias | Estado | Observaciones |
|--------|-----------|-----------|--------------|--------------|--------|---------------|
| MdjCard | Cards | Content container glass | all | surface.elevated, radius.lg | documented | — |
| MdjList | Lists | Vertical list | all | MdjStack | documented | — |
| MdjListItem | Lists | Single row | all | MdjText, MdjIcon | documented | selectable variant |
| MdjDataTable | Tables | Tabular data | all | MdjSkeleton, MdjBadge | documented | Sort UI only |
| MdjTableRow | Tables | Row pattern | all | MdjDataTable | documented | — |
| MdjEmptyState | Lists | Empty content | all | MdjIcon, MdjButton | documented | i18n keys |

---

## Overlays

| Nombre | Categoría | Propósito | Consumidores | Dependencias | Estado | Observaciones |
|--------|-----------|-----------|--------------|--------------|--------|---------------|
| MdjModal | Modals | Center dialog | all | focus trap, overlay | documented | a11y critical |
| MdjDialog | Dialogs | Alert/confirm dialog | all | MdjModal simplified | documented | — |
| MdjDrawer | Drawers | Side panel | all | MdjModal patterns | documented | — |
| MdjPopover | Dialogs | Anchored popover | all | MdjCard small | documented | — |
| MdjTooltip | Utilities | Hover/focus hint | all | MdjText caption | documented | keyboard access |

---

## Tabs · Badges · Alerts · Notifications

| Nombre | Categoría | Propósito | Consumidores | Dependencias | Estado | Observaciones |
|--------|-----------|-----------|--------------|--------------|--------|---------------|
| MdjTabs | Tabs | Section tabs | all | MdjNavItem patterns | documented | roving tabindex |
| MdjTabPanel | Tabs | Panel content | all | MdjTabs | documented | — |
| MdjBadge | Badges | Status label | all | status.*, radius.full | documented | VIP crown portal ADR |
| MdjChip | Badges | Removable tag | all | MdjBadge | documented | — |
| MdjAlert | Alerts | Inline message | all | status.*, MdjIcon | documented | — |
| MdjToastShell | Notifications | Toast container UI | all | MOD-011 payload | documented | Orchestration MOD-011 |
| MdjBanner | Notifications | Top banner | all | MdjAlert | documented | — |

---

## Media · Charts · Scheduling · Payments · Uploads

| Nombre | Categoría | Propósito | Consumidores | Dependencias | Estado | Observaciones |
|--------|-----------|-----------|--------------|--------------|--------|---------------|
| MdjMedia | Media | Image/video frame | all | surface, radius | documented | No CDN logic |
| MdjAvatar | Media | User avatar circle | all | MdjMedia, radius.full | documented | — |
| MdjChartShell | Charts | Chart container | staff, artist | MdjCard | documented | Chart lib ADR |
| MdjCalendarShell | Scheduling | Calendar grid UI | client, artist | MdjGrid | documented | No booking logic |
| MdjTimeSlot | Scheduling | Slot picker row | client, artist | MdjButton | documented | — |
| MdjPaymentShell | Payments | Payment form layout | client | MdjForm | documented | **No PCI** — Edge |
| MdjPriceDisplay | Payments | Formatted amount UI | client, staff | MdjText | documented | Format portal/i18n |
| MdjFileUpload | Uploads | File picker UI | artist, staff | MdjButton, progress | documented | Upload API portal |

---

## Utilities · System

| Nombre | Categoría | Propósito | Consumidores | Dependencias | Estado | Observaciones |
|--------|-----------|-----------|--------------|--------------|--------|---------------|
| MdjFocusTrap | Utilities | Focus containment | all | — | documented | Used by overlays |
| MdjPortal | Utilities | DOM portal mount | all | — | documented | Runtime ADR |
| MdjSkeleton | Utilities | Loading placeholder | all | surface.elevated | documented | COMPONENT-STATES |
| MdjOfflineBanner | Utilities | Offline indicator | all | MdjBanner | documented | Offline state |
| MdjProgressBar | Utilities | Progress indicator | all | semantic.accent | documented | — |
| MdjSearchInput | Inputs | Search field pattern | all | MdjInput, MdjIcon | documented | — |

---

## Resumen inventario

| Métrica | Valor |
|---------|-------|
| Componentes documentados | **52** |
| Implementación runtime | **0** |
| Categorías cubiertas | **22/22** |

---

## Exclusiones explícitas (portal scope)

| Elemento | Razón |
|----------|-------|
| `#mainNav` site nav | Locked portal · not Core |
| `#owner-tabs` artist strip | dj-profile frozen |
| Staff CRM panels | MOD-3xx portal |
| Client portal dashboard layout | MOD-101 |

---

*COMPONENT-INVENTORY v1.0 — 52 components conceptual — TICKET-V2-SHARED-CORE-017*
