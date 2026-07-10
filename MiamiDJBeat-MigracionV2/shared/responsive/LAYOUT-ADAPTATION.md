# LAYOUT-ADAPTATION.md

**TICKET-V2-SHARED-CORE-018 — Responsive Engine Specification**

**Módulo:** MOD-016 · Adaptación de layout  
**Versión:** 1.0

---

## Objetivos adaptación

| Objetivo | Regla |
|----------|-------|
| Readable line length | Content max ~80ch at `bp.xl` |
| Stack on narrow | Sidebar below main `< bp.lg` |
| Full bleed heroes | Allowed all breakpoints — portal |
| Tables | Scroll container mobile · full grid desktop |
| Modals | Full viewport mobile · max-width desktop |

---

## Responsive Grid (conceptual)

| Breakpoint | Page margin | Gutter | Primary content span |
|------------|-------------|--------|----------------------|
| base | spacing.md | spacing.sm | 12 (4 col) |
| md | spacing.md | spacing.md | 8–12 |
| lg | spacing.lg | spacing.md | 8–10 |
| xl | spacing.lg | spacing.md | 8 centered |

Source scale: `../design-system/LAYOUT-GRID.md`

---

## Responsive Spacing

| Context | base | lg+ |
|---------|------|-----|
| Section gap | spacing.xl | spacing.2xl |
| Card padding | spacing.md | spacing.lg |
| Inline gap | spacing.sm | spacing.sm |

Compact density staff — RESPONSIVE-RULES Desktop/Laptop.

---

## Responsive Typography

| Step | base | md+ | xl+ |
|------|------|-----|-----|
| display-lg | display-md scale down ADR | display-lg | display-lg |
| body-md | body-md min 16px | body-md | body-md |
| caption | caption | caption | caption |

No new type tokens — apply DS scale **which step** per breakpoint.

---

## Responsive Components (behavior rules)

| Component | Mobile | Desktop |
|-----------|--------|---------|
| MdjDataTable | horizontal scroll | full columns |
| MdjModal | full screen | max-width xl |
| MdjDrawer | full width | fixed width ADR |
| MdjTabs | scroll horizontal | inline |
| MdjButtonGroup | stack vertical | row |
| MdjSidebar layout | hidden → drawer | visible |

Implementation MOD-009 — rules here.

---

## Responsive Images (conceptual)

| Rule | Detail |
|------|--------|
| IMG-01 | `srcset` sizes documented portal — not Core runtime |
| IMG-02 | Art direction breakpoint ADR marketing |
| IMG-03 | Lazy load below fold — PERFORMANCE-GUIDELINES |
| IMG-04 | MdjMedia aspect ratio preserved — no layout shift |

---

## Fluid layout bands

Between `bp.md` and `bp.lg`, container width **fluid** 100% with max-width token ADR — no fixed px widths.

---

## Adaptive layout patterns

| Pattern | Breakpoint switch |
|---------|-------------------|
| Single column → two column | `bp.lg` |
| Hamburger → horizontal nav | portal shell `bp.lg` |
| Collapsed filters → expanded | `bp.md` |

---

*LAYOUT-ADAPTATION v1.0 — TICKET-V2-SHARED-CORE-018*
