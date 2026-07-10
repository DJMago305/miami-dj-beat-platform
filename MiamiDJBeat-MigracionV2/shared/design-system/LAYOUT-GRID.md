# LAYOUT-GRID.md

**TICKET-V2-SHARED-CORE-016 — Design System Specification**

**Módulo:** MOD-008 · Grid y layout base  
**Versión:** 1.0

> Grid **conceptual** — aplicación responsive en MOD-016. **No** CSS grid implementation.

---

## Objetivos del grid

| Objetivo | Detalle |
|----------|---------|
| Alignment | Contenido alineado a columnas consistentes |
| Rhythm | Gutters from spacing scale |
| Scalability | 12-column base — industry standard |
| Portal parity | Same grid grammar Client · Artist · Staff |

---

## Grid base — 12 column

| Propiedad | Valor conceptual | Token |
|-----------|------------------|-------|
| Columns | 12 | — |
| Gutter | `spacing.md` (16px ADR) | `spacing.md` |
| Margin (page) | `spacing.lg` desktop · `spacing.md` mobile ADR | spacing scale |
| Max content width | 1280px ADR | `layout.max-width` future token |
| Min page padding | `spacing.sm` | — |

---

## Breakpoints (referencia — authority MOD-016)

| Nombre | Min width | Column behavior |
|--------|-----------|-----------------|
| **mobile** | 0 | 4 effective · single column primary |
| **tablet** | 768px ADR | 8 effective |
| **desktop** | 1024px ADR | 12 full |
| **wide** | 1440px ADR | 12 · max-width centered |

Design System define **intent**; Responsive Engine define **implementation**.

---

## Layout regions (conceptual)

```
┌─────────────────────────────────────────┐
│  Header region (full bleed)              │
├─────────────────────────────────────────┤
│  │← margin │  12-col content  │ margin →│
│  │         │                  │         │
│  │         │  main + sidebar  │         │
│  │         │  (portal ADR)    │         │
├─────────────────────────────────────────┤
│  Footer region (optional)                │
└─────────────────────────────────────────┘
```

**Regla L-01:** Header/nav geometry final — portal shells · not DS page mocks.

---

## Column span guidelines

| Content type | Desktop span | Mobile |
|--------------|--------------|--------|
| Full bleed hero | 12 | 12 |
| Primary content | 8–10 | 12 |
| Sidebar | 3–4 | stack below ADR |
| Form narrow | 6 centered | 12 |
| Dashboard widgets | 3·4·6 combinations | 12 stack |

---

## Vertical rhythm

| Element | Spacing |
|---------|---------|
| Section gap | `spacing.xl` |
| Subsection gap | `spacing.lg` |
| Component stack | `spacing.md` |
| Inline related | `spacing.sm` |

→ **SPACING-SYSTEM.md**

---

## Alignment rules

| Regla | Detalle |
|-------|---------|
| L-02 | Text blocks left-align LTR (EN/ES) |
| L-03 | Numeric data right-align in tables — Components MOD-009 |
| L-04 | Center only heroes · empty states · modals |
| L-05 | No optical drift — snap to grid |

---

## Anti-patterns

- Arbitrary `width: 437px` outside scale
- Different gutter per portal without ADR
- Full-width text lines > 80ch readability — constrain content column

---

*LAYOUT-GRID v1.0 — TICKET-V2-SHARED-CORE-016*
