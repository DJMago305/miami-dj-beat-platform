# INTERACTION-STATES.md

**TICKET-V2-SHARED-CORE-016 — Design System Specification**

**Módulo:** MOD-008 · Estados visuales  
**Versión:** 1.0

> Estados **genéricos** — aplicación en Button/Input/etc. → MOD-009 Components.

---

## Estados universales

| Estado | Descripción |
|--------|-------------|
| **Default** | Resting appearance |
| **Hover** | Pointer over interactive |
| **Pressed / Active** | Mouse down or toggled on |
| **Focus** | Keyboard focus visible |
| **Disabled** | Non-interactive |
| **Loading** | Async in progress |
| **Empty** | No data surface |
| **Error** | Validation / failure |
| **Success** | Confirmation |
| **Warning** | Caution |
| **Info** | Neutral information |

---

## Default

| Propiedad | Rule |
|-----------|------|
| Surface | Per component role — VISUAL-TOKENS |
| Text | `text.primary` or role-specific |
| Border | `border.default` if bordered |
| Cursor | default / pointer per interactivity |

---

## Hover

| Regla | Detalle |
|-------|---------|
| H-01 | Subtle brightness +4–8% ADR or border accent |
| H-02 | Primary: deepen gold accent slightly |
| H-03 | Duration `motion.duration.fast` |
| H-04 | **No** layout shift on hover (anti-brincho) |
| H-05 | Touch devices: hover styles optional ADR |

---

## Pressed / Active

| Regla | Detalle |
|-------|---------|
| P-01 | Slightly darker than hover |
| P-02 | Active nav: gold underline or accent bar ADR |
| P-03 | Toggle: persistent active state distinct from hover |
| P-04 | Scale transform **prohibited** if causes layout shift |

---

## Focus

| Regla | Detalle |
|-------|---------|
| F-01 | Visible focus ring mandatory — `border.focus` 2px |
| F-02 | WCAG 2.4.7 — never `outline: none` without replacement |
| F-03 | Gold accent ring on dark surfaces ADR |
| F-04 | Focus distinct from hover simultaneously |
| F-05 | Skip links ADR — portal shell |

→ `../theme/THEME-ACCESSIBILITY.md`

---

## Disabled

| Propiedad | Rule |
|-----------|------|
| Opacity | 0.5 ADR — or `text.secondary` |
| Pointer | none |
| Accent | desaturated — no gold CTA |
| Contrast | still readable where possible |

---

## Loading

| Pattern | Rule |
|---------|------|
| Spinner | `icon.md` · `text.secondary` |
| Skeleton | `surface.elevated` pulse ADR — reduced motion respect |
| Button loading | Disabled + spinner — label may hide ADR |
| Page loading | Center spinner — not block auth gates |

**Regla LD-01:** Loading never removes focus management from prior element ADR.

---

## Empty

| Element | Rule |
|---------|------|
| Icon | `icon.xl` · muted |
| Title | `heading-sm` |
| Body | `body-md` · `text.secondary` |
| Action | Optional primary CTA |
| Tone | Premium calm — not alarming |

Copy via i18n keys in Components — DS defines **visual structure** only.

---

## Error

| Element | Token |
|---------|-------|
| Border / indicator | `status.error` |
| Text | `status.error` + `body-sm` |
| Icon | error icon — ICONOGRAPHY |
| Background | subtle error tint ADR on field |

**Regla E-01:** Error never gold-only · always icon or text.

---

## Success

| Element | Token |
|---------|-------|
| Indicator | `status.success` |
| Icon | checkmark |
| Background tint | subtle success ADR |

---

## Warning

| Element | Token |
|---------|-------|
| Indicator | `status.warning` |
| Use | Non-blocking caution |

---

## Info

| Element | Token |
|---------|-------|
| Indicator | `status.info` |
| Distinct | From accent gold — not confused with CTA |

---

## State matrix (interactive control)

| State | Opacity | Border | Background | Motion |
|-------|---------|--------|------------|--------|
| Default | 1 | default | role surface | — |
| Hover | 1 | accent subtle | lighten | fast |
| Pressed | 1 | accent | darken | fast |
| Focus | 1 | focus 2px | — | — |
| Disabled | 0.5 | muted | muted | — |
| Loading | 0.8 | default | same | spinner |

Components MOD-009 implement — DS defines targets.

---

*INTERACTION-STATES v1.0 — TICKET-V2-SHARED-CORE-016*
