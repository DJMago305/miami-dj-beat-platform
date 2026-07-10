# DESIGN-PRINCIPLES.md

**TICKET-V2-SHARED-CORE-016 — Design System Specification**

**Módulo:** MOD-008 · Principios  
**Versión:** 1.0

---

## Principios fundacionales

| # | Principio | Significado |
|---|-----------|-------------|
| P-01 | **Token-first** | Todo valor visual referencia Theme — nunca literal en UI spec |
| P-02 | **Dark foundation** | Dark mode es base MVP; light ADR futuro |
| P-03 | **Gold with restraint** | Gold = premium accent · no relleno masivo |
| P-04 | **Glass with purpose** | Glass eleva jerarquía — no decoración gratuita |
| P-05 | **Clarity over ornament** | Legibilidad y contraste antes que efecto |
| P-06 | **Consistent rhythm** | Spacing scale única en Client · Artist · Staff |
| P-07 | **Accessible by default** | Focus · contrast · motion — no optional afterthought |
| P-08 | **Portal unity** | Misma gramática visual · portal accents opcionales |
| P-09 | **Documentation before pixels** | Spec completa antes CSS runtime |
| P-10 | **Components consume — DS defines** | DS no implementa Button |

---

## Dark Philosophy

| Regla | Aplicación |
|-------|------------|
| Deep backgrounds | `brand.bg.deep` · `surface.base` |
| Layered depth | Elevated surfaces más claras que base — no flat gray slabs |
| Text contrast | `text.primary` WCAG AA mínimo — Theme a11y authority |
| Avoid pure black `#000` | Rich dark tones — eye comfort premium |
| Dividers subtle | `border.default` low contrast |

Nightclub luxury aesthetic — **legible** en desktop y mobile.

---

## Gold Philosophy

| Uso permitido | Uso prohibido |
|---------------|---------------|
| Primary CTA accent | Body paragraphs gold |
| Active nav indicator | Large gold backgrounds |
| Focus ring accent variant | Error states gold-only |
| Premium badges · crowns VIP ADR | Gold on gold (no contrast) |
| Subtle border highlight glass | Decorative gold gradients everywhere |

Gold communicates **Miami DJ Beat premium** — not cheap flash.

---

## Glass Philosophy

| Capa | Glass level |
|------|-------------|
| Base page | Solid dark — **no** glass |
| Cards · panels | `surface.elevated` + `brand.glass.blur` |
| Modals | Glass + `surface.overlay` scrim |
| Nav header | Semi-solid glass — legibility priority |

| Regla | Detalle |
|-------|---------|
| G-01 | Blur documentado en tokens — no arbitrary `backdrop-filter` values |
| G-02 | Border 1px subtle luminance on glass edges |
| G-03 | Content behind glass must maintain readable contrast |
| G-04 | Reduce glass on low-end mobile ADR — solid fallback |

---

## Premium Philosophy

| Atributo | Manifestación |
|----------|---------------|
| Generous whitespace | spacing scale lg+ for section gaps |
| Display typography | Playfair / Cinzel class display — TYPOGRAPHY.md |
| Subtle motion | motion.duration.normal — no bounce circus |
| Refined shadows | `shadow.sm` · `shadow.gold-glow` sparingly |
| Alignment discipline | LAYOUT-GRID.md |
| Quality empty states | INTERACTION-STATES.md Empty |

Premium = **confidence and restraint**, not density.

---

## Identidad cross-portal

| Portal | Accent overlay (optional) |
|--------|---------------------------|
| Client | `portal.client.accent` extends semantic |
| Artist | `portal.artist.accent` |
| Staff | `portal.staff.accent` |

**Regla:** Portal accent **never** replaces brand gold primary globally.

---

## Motion philosophy (summary)

Full guidelines → **DESIGN-RULES.md**

- Purposeful · short · respect `prefers-reduced-motion`
- No autoplay decorative loops
- State transitions clarify — not distract

---

*DESIGN-PRINCIPLES v1.0 — TICKET-V2-SHARED-CORE-016*
