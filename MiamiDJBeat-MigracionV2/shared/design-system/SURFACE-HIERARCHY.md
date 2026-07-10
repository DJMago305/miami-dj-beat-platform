# SURFACE-HIERARCHY.md

**TICKET-V2-SHARED-CORE-016 — Design System Specification**

**Módulo:** MOD-008 · Superficies · elevación · bordes · radios · sombras  
**Versión:** 1.0

---

## Surface hierarchy

| Level | Token | Descripción | Glass |
|-------|-------|-------------|-------|
| **L0 Ground** | `semantic.color.bg.primary` | Page canvas | No |
| **L1 Base** | `surface.base` | Default content panel | Optional subtle |
| **L2 Elevated** | `surface.elevated` | Cards · popovers | Yes — primary glass |
| **L3 Overlay** | `surface.overlay` | Modal scrim | N/A (alpha) |
| **L4 Modal** | `surface.elevated` + highest z | Dialog content | Yes |

**Regla SH-01:** Each level visually distinct — lighter/brighter toward user on dark base.

---

## Elevations

| Elevation | Shadow token | Z-index ref | Uso |
|-----------|--------------|-------------|-----|
| E0 | none | base | Flat on L1 |
| E1 | `shadow.sm` | default | Cards |
| E2 | `shadow.md` ADR | dropdown | Menus |
| E3 | `shadow.lg` ADR | modal | Dialogs |
| Premium | `shadow.gold-glow` | — | Featured CTA container sparingly |

---

## Borders

| Token | Width | Uso |
|-------|-------|-----|
| `border.default` | 1px | Dividers · glass edge |
| `border.strong` ADR | 1px | Emphasis containers |
| `border.focus` | 2px | Focus ring |
| Gold accent border | `semantic.color.accent` 1px | Active card ADR — sparingly |

**Regla SH-02:** Borders on glass — low opacity luminance, not harsh white.

---

## Border radius

| Token | rem ADR | Uso |
|-------|---------|-----|
| `radius.none` | 0 | Tables full-bleed ADR |
| `radius.sm` | 0.25 | Chips |
| `radius.md` | 0.5 | Buttons · inputs — Components |
| `radius.lg` | 0.75 | Cards |
| `radius.xl` | 1.0 | Modals |
| `radius.full` | 9999px | Pills · avatars |

**Regla SH-03:** Consistent radius within component family — Components MOD-009 enforce.

---

## Shadows (documental)

| Token | Caracter | Uso |
|-------|----------|-----|
| `shadow.sm` | Soft dark lift | E1 |
| `shadow.md` | Deeper | Menus |
| `shadow.lg` | Modal depth | Dialogs |
| `shadow.gold-glow` | Gold ambient | Premium feature highlight |

Values live in Theme token registry — DS assigns **semantic role**.

---

## Glass surface recipe (conceptual)

```
surface.elevated
+ brand.glass.blur
+ border.default (1px subtle)
+ optional shadow.sm
```

Fallback solid `surface.base` when blur unsupported — Feature Flag ADR.

---

## Z-index layers

| Token | Order (conceptual) |
|-------|-------------------|
| `z-index.base` | 0 |
| `z-index.dropdown` | 100 |
| `z-index.sticky` | 200 |
| `z-index.modal` | 300 |
| `z-index.toast` | 400 |

Components must use tokens — no arbitrary `z-index: 9999`.

---

*SURFACE-HIERARCHY v1.0 — TICKET-V2-SHARED-CORE-016*
