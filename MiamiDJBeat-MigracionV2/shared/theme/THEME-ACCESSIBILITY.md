# THEME-ACCESSIBILITY.md

**TICKET-V2-SHARED-CORE-014 — Theme Manager Specification**

**Módulo:** MOD-007 · Accesibilidad documental  
**Versión:** 1.0

> Solo reglas documentales — **no** CSS · **no** implementación.

---

## Contraste mínimo

| Pair | Requirement |
|------|-------------|
| `text.primary` on `surface.base` | **WCAG AA** 4.5:1 normal text |
| `text.primary` on `surface.elevated` | **WCAG AA** 4.5:1 |
| `text.on-accent` on `brand.gold.primary` | **WCAG AA** 4.5:1 |
| Large text (≥18pt / 14pt bold) | **WCAG AA** 3:1 |

Failure → ERR-THEME-008 · activate `mdj-dark-gold-high-contrast`.

---

## Gold accent accessibility

| Rule | Detail |
|------|--------|
| G-01 | Gold **not** sole indicator of state — pair icon/shape |
| G-02 | Gold text only for short labels / accents — not long body |
| G-03 | Gold on dark must meet contrast — mute gold if fail |
| G-04 | Focus ring visible on gold controls — `border.focus` token |

---

## Focus states

| Requirement |
|-------------|
| Visible focus indicator all interactive components (DS) |
| Min 2px outline or equivalent `border.focus` |
| Focus contrast ≥ 3:1 against adjacent colors |

---

## Reduced motion

| `prefers-reduced-motion: reduce` | Action |
|----------------------------------|--------|
| Theme sets | `motion.duration.*` → 0 or minimal ADR |
| Disable | parallax, large transitions |
| Keep | essential opacity fades ADR |

Token: `motion.reduce.enabled` boolean resolved at theme apply.

---

## Color not sole indicator

Status success/warning/error/info **require** icon or text label — not color alone (Components + Theme status tokens).

---

## Legibilidad

| Rule |
|------|
| Min body size 16px equivalent mobile ADR |
| Line height ≥ 1.5 body |
| Max line length portal content — DS ticket |

---

## Mobile readability

| Rule |
|------|
| Touch targets ≥ 44×44px — Components MOD-009 |
| Sufficient padding via spacing tokens |
| Dark bg reduces glare — default dark theme |

---

## Dark mode accessibility

| Rule |
|------|
| Avoid pure #000 — use `brand.bg.deep` |
| Elevated surfaces distinguishable from base |
| Glass surfaces maintain text contrast |

---

## Status colors (semantic)

| Status | Token | Must pair with |
|--------|-------|----------------|
| success | `status.success` | icon + i18n label |
| warning | `status.warning` | icon + label |
| error | `status.error` | icon + label |
| info | `status.info` | icon + label |

---

*THEME-ACCESSIBILITY v1.0 — TICKET-V2-SHARED-CORE-014*
