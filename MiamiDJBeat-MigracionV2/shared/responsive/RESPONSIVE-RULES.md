# RESPONSIVE-RULES.md

**TICKET-V2-SHARED-CORE-018 — Responsive Engine Specification**

**Módulo:** MOD-016 · Reglas por form factor  
**Versión:** 1.0

---

## Mobile Portrait (`bp.base`)

| Regla | Detalle |
|-------|---------|
| MP-01 | Single column primary content |
| MP-02 | Hamburger nav — portal shell contract |
| MP-03 | `#header-login-btn` / Logout **visible** — never hidden by responsive CSS |
| MP-04 | Full-width buttons primary actions ADR |
| MP-05 | Modals full viewport |
| MP-06 | Tables horizontal scroll wrapper |
| MP-07 | body-md min 16px |

---

## Mobile Landscape (`bp.sm`)

| Regla | Detalle |
|-------|---------|
| ML-01 | Inherit portrait + optional two-column micro regions ADR |
| ML-02 | Reduce vertical hero height |
| ML-03 | Maintain touch targets |

---

## Tablet Portrait (`bp.md`)

| Regla | Detalle |
|-------|---------|
| TP-01 | 8-column grid available |
| TP-02 | Side drawer nav optional ADR |
| TP-03 | Split form label/input horizontal optional |

---

## Tablet Landscape (`bp.lg`)

| Regla | Detalle |
|-------|---------|
| TL-01 | 12-column grid |
| TL-02 | Sidebar + main split allowed |
| TL-03 | Nav horizontal if portal ADR — **not** `#mainNav` 10-pillar spec here |
| TL-04 | Hover states permitted with pointer |

---

## Laptop (`bp.xl`)

| Regla | Detalle |
|-------|---------|
| LP-01 | Max content width container centered |
| LP-02 | Compact density optional staff |
| LP-03 | Multi-column dashboards portal |

---

## Desktop (`bp.2xl`)

| Regla | Detalle |
|-------|---------|
| DT-01 | Same as laptop + increased section whitespace |
| DT-02 | Desktop nav min item width **12ch** — portal Constitución parity |
| DT-03 | **Prohibido** `min-width: 0` on desktop nav links ADR portal |
| DT-04 | Gold underline active nav always reserved space — anti-brincho |

---

## UltraWide (`bp.ultra`)

| Regla | Detalle |
|-------|---------|
| UW-01 | Content max-width — no infinite line length |
| UW-02 | Margins increase — not stretch cards full 3440px |
| UW-03 | Optional tertiary column staff ADR |

---

## TV (preparación futura)

| Regla | Detalle |
|-------|---------|
| TV-01 | 10-foot UI scale ADR — larger type step |
| TV-02 | Focus visible mandatory — remote navigation |
| TV-03 | Reduced density — fewer columns |

---

## Reglas transversales

| ID | Regla |
|----|-------|
| X-01 | **No layout shift** on auth header controls |
| X-02 | Feature flags may disable responsive variant — MOD-013 |
| X-03 | i18n string length must not break container min-width |
| X-04 | Reduced motion — no breakpoint transition animations required |
| X-05 | Offline banner stacks full width all breakpoints |

---

*RESPONSIVE-RULES v1.0 — TICKET-V2-SHARED-CORE-018*
