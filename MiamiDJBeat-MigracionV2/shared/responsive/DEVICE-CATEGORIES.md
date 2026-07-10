# DEVICE-CATEGORIES.md

**TICKET-V2-SHARED-CORE-018 — Responsive Engine Specification**

**Módulo:** MOD-016 · Categorías de dispositivo  
**Versión:** 1.0

---

## Categorías oficiales

| Categoría | Typical width | Primary breakpoint | Input |
|-----------|---------------|-------------------|-------|
| **Mobile Portrait** | 320–479 | `bp.base` | Touch |
| **Mobile Landscape** | 480–767 | `bp.sm` | Touch |
| **Tablet Portrait** | 768–1023 | `bp.md` | Touch + optional keyboard |
| **Tablet Landscape** | 1024–1279 | `bp.lg` | Touch + pointer |
| **Laptop** | 1280–1439 | `bp.xl` | Pointer + keyboard |
| **Desktop** | 1440–1919 | `bp.2xl` | Pointer + keyboard |
| **UltraWide** | 1920+ | `bp.ultra` | Pointer + keyboard |
| **TV** *(futuro)* | 2560+ | `bp.tv` | D-pad / pointer remote ADR |
| **Foldable** *(futuro)* | dual viewport | `FOLD_STATE_*` ADR | Touch |

---

## Touch

| Regla | Detalle |
|-------|---------|
| T-01 | Min target 44×44px `< bp.lg` |
| T-02 | Spacing sm+ between adjacent targets |
| T-03 | No hover-only actions |
| T-04 | `:hover` styles optional enhancement only |

---

## Pointer

| Regla | Detalle |
|-------|---------|
| P-01 | Hover states active `bp.lg+` with fine pointer ADR |
| P-02 | Tooltips on hover desktop — keyboard focus too |
| P-03 | Dense tables allowed laptop+ compact density |

---

## Keyboard

| Regla | Detalle |
|-------|---------|
| K-01 | All interactive reachable Tab order |
| K-02 | Mobile external keyboard → same as tablet |
| K-03 | Skip links portal shell |

---

## Safe Areas

| Area | Rule |
|------|------|
| iOS notch | `env(safe-area-inset-*)` portal ADR — document insets |
| Home indicator | Bottom padding base |
| Fixed header | Top safe area |

Responsive documents **requirement** — CSS in portal runtime.

---

## Foldables (preparación futura)

| Concept | Future ADR |
|---------|------------|
| `FOLD_STATE_FLAT` | Single pane |
| `FOLD_STATE_HALF` | Dual pane optional |
| Spanning layout | Portal feature — not Core v1 |

Placeholder events — RESPONSIVE-EVENTS.md.

---

## Orientation by category

| Category | Portrait | Landscape |
|----------|----------|-----------|
| Mobile | default | `bp.sm` |
| Tablet | `bp.md` | `bp.lg` |

---

*DEVICE-CATEGORIES v1.0 — TICKET-V2-SHARED-CORE-018*
