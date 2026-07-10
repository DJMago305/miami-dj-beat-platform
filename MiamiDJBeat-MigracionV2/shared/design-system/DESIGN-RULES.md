# DESIGN-RULES.md

**TICKET-V2-SHARED-CORE-016 — Design System Specification**

**Módulo:** MOD-008 · Reglas · motion · cumplimiento  
**Versión:** 1.0

---

## Reglas de cumplimiento

| ID | Regla |
|----|-------|
| R-01 | Consume Theme tokens only — no literal colors |
| R-02 | Use spacing scale only — SPACING-SYSTEM.md |
| R-03 | Use type scale only — TYPOGRAPHY.md |
| R-04 | Respect surface hierarchy — SURFACE-HIERARCHY.md |
| R-05 | All interactive states documented — INTERACTION-STATES.md |
| R-06 | Focus always visible |
| R-07 | Status never color-only |
| R-08 | Gold accent restrained — DESIGN-PRINCIPLES.md |
| R-09 | Glass on L2+ only — not page ground |
| R-10 | No component specs in DS — MOD-009 |
| R-11 | No CSS/HTML in spec docs |
| R-12 | No i18n strings in DS |
| R-13 | No permission logic |
| R-14 | Portal accents extend — never replace brand |
| R-15 | Layout shift prohibited on state change (nav stability) |

---

## Motion guidelines

### Durations

| Token | ms | Uso |
|-------|-----|-----|
| `motion.duration.instant` | 0 | Reduced motion |
| `motion.duration.fast` | 150 | Hover · press |
| `motion.duration.normal` | 250 | Panel open |
| `motion.duration.slow` | 400 | Page transition ADR |

### Easing

| Token | Uso |
|-------|-----|
| `motion.ease.standard` | Default |
| `motion.ease.enter` | Enter animations |
| `motion.ease.exit` | Exit animations |

### Motion rules

| # | Regla |
|---|-------|
| M-01 | Respect `prefers-reduced-motion: reduce` — instant or fade only |
| M-02 | No autoplay decorative animation |
| M-03 | Transitions clarify state — max `normal` for UI chrome |
| M-04 | Modal enter/exit — `normal` · overlay fade |
| M-05 | Loading spinners — continuous OK · respect reduced motion static ADR |
| M-06 | Parallax / scroll-jacking **prohibited** |
| M-07 | Nav bar: **no** animation that changes item width (anti-brincho V1 lesson) |

→ `../theme/THEME-ACCESSIBILITY.md` §Reduced motion

---

## Glass rules (summary)

| # | Regla |
|---|-------|
| GL-01 | Max 2 glass layers stacked visible |
| GL-02 | Text on glass: min contrast AA |
| GL-03 | Fallback solid when blur unsupported |
| GL-04 | No glass on `status.error` fields |

→ **DESIGN-PRINCIPLES.md** §Glass

---

## Premium rules (summary)

| # | Regla |
|---|-------|
| PR-01 | Whitespace > cramming |
| PR-02 | One display type moment per viewport |
| PR-03 | Gold glow max one element per screen ADR |
| PR-04 | Photography/video — portal content ADR — not DS |

---

## Dark / Gold rules (summary)

| # | Regla |
|---|-------|
| DG-01 | Dark base always — light theme separate ADR |
| DG-02 | Gold for accent paths only |
| DG-03 | VIP crown gold — Components + i18n label |
| DG-04 | High contrast text default |

---

## Review checklist (pre-runtime)

| Check | Pass |
|-------|------|
| All colors map to token ids? | ☐ |
| Spacing from scale? | ☐ |
| Focus states defined? | ☐ |
| Status paired with icon? | ☐ |
| Motion respects reduced preference? | ☐ |
| No component markup in DS? | ☐ |
| Theme THEME_CHANGED handled ADR? | ☐ |

---

## Violations

| Severity | Action |
|----------|--------|
| Token bypass | Block PR / runtime ADR |
| a11y fail | Block until THEME-ACCESSIBILITY satisfied |
| Component in DS doc | Move to MOD-009 ticket |

Log dev violations → MOD-010 ADR optional.

---

*DESIGN-RULES v1.0 — TICKET-V2-SHARED-CORE-016*
