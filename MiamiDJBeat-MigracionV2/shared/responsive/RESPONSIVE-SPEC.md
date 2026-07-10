# RESPONSIVE-SPEC.md

**TICKET-V2-SHARED-CORE-018 — Responsive Engine Specification**

**Módulo:** MOD-016 Responsive Engine  
**Ticket:** TICKET-V2-SHARED-CORE-018  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Autoridad de **reglas arquitectónicas de adaptación visual** para Client · Artist · Staff.  
> **No** CSS · **No** media queries runtime · **No** layouts finales · **No** componentes.

---

## 1. Objetivos

| Objetivo | Descripción |
|----------|-------------|
| **Adaptación unificada** | Un motor conceptual para todos los portales V2 |
| **Mobile-first policy** | Documentar estrategia oficial MVP |
| **Breakpoint authority** | Una fuente para MOD-008 grid y MOD-009 components |
| **Input modality** | Touch · pointer · keyboard · safe areas |
| **Anti layout-shift** | Nav stability parity Constitución (12ch desktop ADR portal) |
| **Performance doc** | Reglas before runtime CSS |
| **a11y responsive** | Typography/spacing legibility cross viewport |

---

## 2. Scope

| Incluye | Documento |
|---------|-----------|
| Breakpoint strategy | BREAKPOINT-STRATEGY.md |
| Device categories | DEVICE-CATEGORIES.md |
| Layout adaptation rules | LAYOUT-ADAPTATION.md |
| Responsive rules per form factor | RESPONSIVE-RULES.md |
| Events | RESPONSIVE-EVENTS.md |
| Errors | RESPONSIVE-ERRORS.md |
| a11y responsive | ACCESSIBILITY-RESPONSIVE.md |
| Performance guidelines | PERFORMANCE-GUIDELINES.md |

---

## 3. Non-scope

| Excluye | Responsable |
|---------|-------------|
| CSS / media queries / `@media` | Runtime ADR |
| HTML / DOM | Components · portales |
| JS/TS matchMedia impl | Runtime |
| Component markup | MOD-009 |
| Grid/type/spacing scales | MOD-008 Design System |
| Token values | MOD-007 Theme |
| Portal `#mainNav` markup | MOD-101+ shells |
| i18n strings | MOD-015 |
| Permissions | MOD-003 |
| Business layouts (dashboards) | Portales |

---

## 4. Principios Responsive

| # | Principio |
|---|-----------|
| RP-01 | **Mobile-first documentation** — base rules target smallest viewport |
| RP-02 | **Progressive enhancement** — desktop adds columns · never breaks mobile |
| RP-03 | **Fluid where safe** — typography/spacing tokens scale within bands |
| RP-04 | **Stepped breakpoints** — layout jumps at documented widths only |
| RP-05 | **No layout shift on auth/nav** — login/logout visibility preserved |
| RP-06 | **Touch-first targets** — 44px minimum interactive |
| RP-07 | **Content order stable** — reorder documented · not implicit CSS hack |
| RP-08 | **Performance budget** — PERFORMANCE-GUIDELINES.md |
| RP-09 | **Theme tokens unchanged** — Responsive applies layout rules only |
| RP-10 | **Documentation only** — zero runtime in this ticket |

---

## 5. Mobile First vs Desktop First

| Estrategia | V2 official | Notas |
|------------|-------------|-------|
| **Mobile First** | ✅ **MVP default** | Base spec written for mobile portrait |
| **Desktop First** | ❌ Not official | Comparativa histórica V1 — no replicate blindly |

Desktop-first comparison (documentary only):

| Aspect | Desktop First (legacy risk) | Mobile First (V2) |
|--------|----------------------------|-------------------|
| Base CSS | Wide layout default | Narrow default |
| Breakpoints | `max-width` shrink | `min-width` enhance |
| Nav | Desktop nav born first | Hamburger contract first |
| QA | Desktop tested last | Mobile tested first |

---

## 6. Adaptive vs Fluid Layout

| Tipo | V2 usage |
|------|----------|
| **Adaptive (stepped)** | Grid columns · nav mode · sidebar collapse at breakpoints |
| **Fluid (banded)** | Container max-width · optional type step between breakpoints |
| **Hybrid** | Official — stepped layout + fluid spacing within step |

---

## 7. Relación con Theme (MOD-007)

| Rule | Detail |
|------|--------|
| Responsive **no** defines tokens | Consumes breakpoints as conceptual names only |
| THEME_CHANGED | Does not alter breakpoint definitions |
| Dark/gold identity | Unchanged across viewports |

---

## 8. Relación con Design System (MOD-008)

| DS | Responsive |
|----|------------|
| LAYOUT-GRID.md | Breakpoints apply grid columns |
| TYPOGRAPHY.md | Responsive type steps optional ADR |
| SPACING-SYSTEM.md | Density modes per breakpoint |
| INTERACTION-STATES | Touch/hover split |

Responsive **implements when** — DS **defines what**.

---

## 9. Relación con Components (MOD-009)

| Pattern | Detail |
|---------|--------|
| `responsiveBehavior` in COMPONENT-CONTRACT | Must align RESPONSIVE-RULES |
| MdjDataTable | Horizontal scroll mobile ADR |
| Overlays | Full-screen mobile · centered desktop |
| Nav components | Not site `#mainNav` — patterns only |

---

## 10. Relación con Accessibility

→ ACCESSIBILITY-RESPONSIVE.md + `../theme/THEME-ACCESSIBILITY.md`

---

## 11. Relación con i18n (MOD-015)

| Rule | Detail |
|------|--------|
| Same breakpoints EN/ES | No locale-specific widths |
| Longer ES strings | Line wrap · container min-width rules |
| No translated content in Responsive specs | — |

---

## 12. Relación con Portal Shell

| Shell | Responsive |
|-------|------------|
| Applies breakpoint listeners runtime ADR | Supplies rules |
| Mobile nav drawer contract | RESPONSIVE-RULES mobile |
| `PORTAL_READY` after responsive context resolved ADR | — |

---

## 13. Dependencias permitidas

MOD-008 Design System · MOD-009 Components (behavior refs) · MOD-006 Configuration · MOD-010 Logging · MOD-004 Event Bus

---

## 14. Dependencias prohibidas

Portales · Supabase · V1 `web/` · Theme token registry · Permissions · i18n catalog

---

## 15. Criterios aceptación documental

- [x] 10 documentos `shared/responsive/`
- [x] 16/16 Shared Core spec complete
- [x] Sin código · sin V1

---

*RESPONSIVE-SPEC v1.0 — TICKET-V2-SHARED-CORE-018*
