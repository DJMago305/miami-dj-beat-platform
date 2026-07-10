# BREAKPOINT-STRATEGY.md

**TICKET-V2-SHARED-CORE-018 — Responsive Engine Specification**

**Módulo:** MOD-016 · Breakpoints conceptuales  
**Versión:** 1.0

> **No** media query CSS · **no** px values as runtime constants — conceptual names only.

---

## Estrategia oficial: Mobile First

1. Document base experience at **mobile portrait**  
2. Enhance at each **min-width** step  
3. Never remove mobile-critical affordances on desktop (logout visible ADR)

---

## Breakpoints conceptuales

| Token | Min width (doc ADR) | Alias | Grid cols (DS) |
|-------|---------------------|-------|----------------|
| `bp.base` | 0 | mobile portrait | 4 effective |
| `bp.sm` | 480px | mobile landscape | 4–6 |
| `bp.md` | 768px | tablet portrait | 8 |
| `bp.lg` | 1024px | tablet landscape / laptop | 12 |
| `bp.xl` | 1280px | desktop | 12 + max-width |
| `bp.2xl` | 1440px | wide desktop | 12 centered |
| `bp.ultra` | 1920px | ultrawide | 12 + margins |
| `bp.tv` | 2560px | TV future | ADR future |

Aligns `../design-system/LAYOUT-GRID.md` — Responsive is **authority** for when steps apply.

---

## Orientation

| Event | Behavior |
|-------|----------|
| Portrait → Landscape | Re-evaluate `bp.sm` vs `bp.md` |
| Keyboard open mobile | Viewport resize — avoid layout break ADR portal |
| `ORIENTATION_CHANGED` | RESPONSIVE-EVENTS.md |

Orientation **does not** change i18n locale.

---

## Viewport

| Concept | Rule |
|---------|------|
| **Layout viewport** | Breakpoint source |
| **Visual viewport** | Safe for fixed elements ADR |
| **100vw caution** | Document scrollbars cause horizontal bleed — portal CSS ADR |
| **Zoom to 200%** | Content reflow — a11y requirement |

---

## Density

| Density | Trigger | Effect |
|---------|---------|--------|
| Comfortable | default | DS spacing 100% |
| Compact | `bp.lg`+ staff tables ADR | −1 spacing step padding only |
| Touch | `< bp.lg` | 44px targets |

---

## Desktop First (comparativa — no adoptar)

Legacy pattern: start `@media max-width` from desktop. V2 **rejects** as primary strategy — causes mobile as afterthought.

---

*BREAKPOINT-STRATEGY v1.0 — TICKET-V2-SHARED-CORE-018*
