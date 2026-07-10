# TOKEN-CONTRACT.md

**TICKET-V2-SHARED-CORE-014 — Theme Manager Specification**

**Módulo:** MOD-007 · Contrato de tokens  
**Versión:** 1.0

---

## Principio

> **Tokens son la fuente única visual.**  
> Componentes consumen tokens. CSS final se define después. **No** hardcoded values outside contract.

---

## Tipos oficiales

brand · semantic · surface · text · border · shadow · motion · spacing · radius · z-index · status · portal

---

## Catálogo representativo

| Token | Tipo | Descripción | Permitido | Prohibido | Consumidor esperado |
|-------|------|-------------|-----------|-----------|---------------------|
| `brand.gold.primary` | brand | Accent gold Miami DJ Beat | hex/rgb ADR | gradient text copy | semantic.accent |
| `brand.bg.deep` | brand | Deep dark base | color value | image url secrets | surface.base |
| `brand.glass.blur` | brand | Glass luxury blur | px/rem | — | surface.elevated |
| `semantic.color.bg.primary` | semantic | Main background | ref brand/surface | hardcoded in component | Components |
| `semantic.color.text.primary` | semantic | Body text on bg | ref text | i18n string | Components |
| `semantic.color.accent` | semantic | Interactive accent | ref brand.gold | — | Components, DS |
| `surface.base` | surface | Default panel | rgba/hex | — | Components |
| `surface.elevated` | surface | Card glass layer | glass token | — | Components |
| `surface.overlay` | surface | Modal scrim | alpha | — | Components |
| `text.primary` | text | High emphasis | color | translated text | Components |
| `text.secondary` | text | Muted | color | — | Components |
| `text.on-accent` | text | On gold buttons | color | — | Components |
| `border.default` | border | Subtle divider | color 1px | — | Components |
| `border.focus` | border | Focus ring | color | — | a11y |
| `shadow.sm` | shadow | Elevation 1 | box-shadow vals | — | Components |
| `shadow.gold-glow` | shadow | Premium glow | shadow | — | brand surfaces |
| `motion.duration.fast` | motion | 150ms ADR | ms | — | Components |
| `motion.duration.normal` | motion | 250ms | ms | — | Components |
| `motion.ease.standard` | motion | easing fn name | — | — | Components |
| `spacing.xs` … `spacing.xl` | spacing | 4px scale ADR | rem | arbitrary px | DS, Components |
| `radius.sm` … `radius.full` | radius | Border radius | rem | — | Components |
| `z-index.dropdown` | z-index | Layer order | int | — | Components |
| `z-index.modal` | z-index | Modal layer | int | — | Components |
| `status.success` | status | Success color | semantic ref | text message | Components + a11y icon |
| `status.warning` | status | Warning | color | — | Components |
| `status.error` | status | Error | color | — | Components |
| `status.info` | status | Info | color | — | Components |
| `portal.client.accent` | portal | Client overlay optional | extends semantic | replace brand | Client shell ADR |
| `portal.artist.accent` | portal | Artist overlay | extends | — | Artist shell ADR |
| `portal.staff.accent` | portal | Staff overlay | extends | — | Staff shell ADR |

---

## Dark / Gold base mapping

| Layer | Dark | Gold accent |
|-------|------|---------------|
| Background | `brand.bg.deep` | — |
| Surface glass | `surface.elevated` + glass | border subtle gold |
| CTA primary | `semantic.color.accent` | `brand.gold.primary` |
| Text | `text.primary` high contrast | gold sparingly |

---

## Reglas

| # | Regla |
|---|-------|
| T-01 | Components **solo** semantic + approved portal tokens |
| T-02 | **No** duplicar tokens por portal sin ADR |
| T-03 | **No** valores hardcoded fuera registry |
| T-04 | Tokens soportan **dark/gold** base MVP |
| T-05 | Light theme tokens separate namespace ADR |
| T-06 | Token rename → version bump + migration ADR |

---

## TokenMap output (conceptual)

```json
{
  "version": "1.0",
  "themeId": "mdj-dark-gold",
  "tokens": { "semantic.color.accent": "#C9A227" }
}
```

Runtime applies as CSS custom properties — **not in this ticket**.

---

*TOKEN-CONTRACT v1.0 — TICKET-V2-SHARED-CORE-014*
