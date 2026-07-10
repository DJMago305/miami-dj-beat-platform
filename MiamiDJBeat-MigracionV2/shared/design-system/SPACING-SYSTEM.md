# SPACING-SYSTEM.md

**TICKET-V2-SHARED-CORE-016 — Design System Specification**

**Módulo:** MOD-008 · Espaciado  
**Versión:** 1.0

> Escala única — referencia tokens `spacing.*` en Theme. **No** arbitrary margins.

---

## Base unit

| Propiedad | Valor |
|-----------|-------|
| Base | 4px |
| Scale | Multiples of 4 |
| Token authority | `../theme/TOKEN-CONTRACT.md` |

---

## Spacing scale

| Token | rem (ADR) | px | Uso típico |
|-------|-----------|-----|------------|
| `spacing.2xs` | 0.125 | 2 | Hairline gaps |
| `spacing.xs` | 0.25 | 4 | Tight inline |
| `spacing.sm` | 0.5 | 8 | Icon-text gap |
| `spacing.md` | 1.0 | 16 | Default component padding |
| `spacing.lg` | 1.5 | 24 | Section inner padding |
| `spacing.xl` | 2.0 | 32 | Section gaps |
| `spacing.2xl` | 3.0 | 48 | Major section separation |
| `spacing.3xl` | 4.0 | 64 | Hero vertical rhythm |

---

## Application rules

| Regla | Detalle |
|-------|---------|
| SP-01 | Padding inside components uses sm–lg |
| SP-02 | Gap between siblings uses sm–md |
| SP-03 | Gap between sections uses xl–2xl |
| SP-04 | Page margin uses lg (desktop) / md (mobile) |
| SP-05 | **No** values outside scale |

---

## Density modes (ADR — Responsive MOD-016)

| Mode | Scale modifier |
|------|----------------|
| Comfortable (default) | 100% |
| Compact (staff tables ADR) | −1 step on padding only |

Design System documents comfortable default.

---

## Stack vs inline

| Layout | Gap token |
|--------|-----------|
| Vertical stack (form fields) | `spacing.md` |
| Horizontal inline (buttons) | `spacing.sm` |
| Card grid gutter | `spacing.lg` |
| List items | `spacing.sm`–`spacing.md` |

---

## Relation to grid

Gutter = `spacing.md` — see **LAYOUT-GRID.md**.

---

*SPACING-SYSTEM v1.0 — TICKET-V2-SHARED-CORE-016*
