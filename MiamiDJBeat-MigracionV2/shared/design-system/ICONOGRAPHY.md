# ICONOGRAPHY.md

**TICKET-V2-SHARED-CORE-016 — Design System Specification**

**Módulo:** MOD-008 · Iconografía  
**Versión:** 1.0

> Reglas de iconos — **no** SVG assets · **no** icon library implementation.

---

## Objetivos

| Objetivo | Detalle |
|----------|---------|
| Consistency | Single stroke weight · size scale |
| Accessibility | Icon + text · not color alone |
| Premium | Minimal · purposeful — no clip-art |
| Status clarity | Distinct success/error/warning shapes |

---

## Size scale

| Token | Size | Uso |
|-------|------|-----|
| `icon.xs` | 12px | Inline meta |
| `icon.sm` | 16px | Inline with body text |
| `icon.md` | 20px | Default UI |
| `icon.lg` | 24px | Nav · prominent actions |
| `icon.xl` | 32px | Empty states |
| `icon.2xl` | 48px | Hero empty · onboarding ADR |

---

## Style rules

| Regla | Detalle |
|-------|---------|
| IC-01 | Outline style default — filled for active state ADR |
| IC-02 | Stroke 1.5px ADR at md size |
| IC-03 | Color from tokens — `text.secondary` default · `semantic.color.accent` active |
| IC-04 | Status icons use `status.*` tokens |
| IC-05 | Gold icons sparingly — not every nav item |

---

## Icon + text pattern

| Context | Rule |
|---------|------|
| Nav primary | Icon + label (i18n key in Components) |
| Icon-only button | **Requires** aria-label — Components MOD-009 |
| Status toast | Icon + message text |
| Decorative | `aria-hidden="true"` — Components |

**Regla IC-06:** Color never sole indicator — pair icon shape + text/color.

---

## Status icon mapping (conceptual)

| Estado | Icon role | Token color |
|--------|-----------|-------------|
| Success | checkmark circle | `status.success` |
| Warning | alert triangle | `status.warning` |
| Error | x circle / alert | `status.error` |
| Info | info circle | `status.info` |
| Loading | spinner | `text.secondary` |

Asset choice in Components — DS defines **semantic mapping**.

---

## Prohibited

| Prohibido | Razón |
|-----------|-------|
| Emoji as system icons | Inconsistent cross-platform |
| Mixed icon families | Visual noise |
| Gold-only error indicator | a11y |
| Text inside icons | i18n in Components |

---

*ICONOGRAPHY v1.0 — TICKET-V2-SHARED-CORE-016*
