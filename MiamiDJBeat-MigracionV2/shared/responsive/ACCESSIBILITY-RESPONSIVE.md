# ACCESSIBILITY-RESPONSIVE.md

**TICKET-V2-SHARED-CORE-018 — Responsive Engine Specification**

**Módulo:** MOD-016 · Accesibilidad responsive  
**Versión:** 1.0

> Complementa `../theme/THEME-ACCESSIBILITY.md` y `../components/ACCESSIBILITY-GUIDELINES.md`.

---

## Principios

| # | Principio |
|---|-----------|
| AR-01 | Reflow at 320px width without horizontal scroll (except data tables scroll region) |
| AR-02 | Zoom 200% — no loss of content |
| AR-03 | Touch targets 44px mobile |
| AR-04 | Focus visible all breakpoints |
| AR-05 | Orientation change preserves focus context ADR |
| AR-06 | Reduced motion — no required breakpoint animations |
| AR-07 | Color contrast unchanged by breakpoint — Theme authority |

---

## Responsive Typography a11y

| Rule | Detail |
|------|--------|
| Min body 16px mobile | TYPOGRAPHY + RESPONSIVE |
| No text shrink below caption for critical actions | — |
| ES longer strings wrap — no truncation critical legal ADR |

---

## Navigation a11y mobile

| Rule | Detail |
|------|--------|
| Hamburger exposes nav — focus trap in drawer ADR |
| Logout/Login remain reachable | Constitución parity |
| Skip to content link portal |

---

## Tables mobile

| Rule | Detail |
|------|--------|
| Scroll region keyboard accessible | — |
| Headers associated — Components MOD-009 |

---

## Safe area + notches

Document inset requirements — portal implements `env(safe-area-inset-*)`.

---

*ACCESSIBILITY-RESPONSIVE v1.0 — TICKET-V2-SHARED-CORE-018*
