# TYPOGRAPHY.md

**TICKET-V2-SHARED-CORE-016 — Design System Specification**

**Módulo:** MOD-008 · Tipografía  
**Versión:** 1.0

> Escala tipográfica documental — **no** `@font-face` · **no** CSS. Fuentes referenciadas como tokens Theme futuros.

---

## Objetivos

| Objetivo | Detalle |
|----------|---------|
| Hierarchy | Display · heading · body · caption |
| Bilingual | EN canonical · ES — line-height accommodates longer strings |
| Premium | Display serif + clean body sans |
| Legibility | Min sizes mobile — THEME-ACCESSIBILITY alignment |

---

## Familias (conceptual)

| Rol | Familia documentada | Token futuro |
|-----|---------------------|--------------|
| **Display / Brand** | Cinzel-class serif | `--mdj-font-display` |
| **Editorial accent** | Playfair italic-class | hero titles ADR |
| **Body** | System UI sans / Inter-class | `--mdj-font-body` |
| **Mono** | Monospace data only | `--mdj-font-mono` |

Runtime font loading → ticket separado. DS define **roles**, not CDN URLs.

---

## Type scale

| Step | Token | Size (rem ADR) | Line height | Weight | Uso |
|------|-------|----------------|-------------|--------|-----|
| display-xl | `type.display.xl` | 3.0 | 1.1 | 400 | Hero marketing |
| display-lg | `type.display.lg` | 2.25 | 1.15 | 400 | Page titles |
| heading-lg | `type.heading.lg` | 1.75 | 1.2 | 600 | Section headers |
| heading-md | `type.heading.md` | 1.375 | 1.25 | 600 | Card titles |
| heading-sm | `type.heading.sm` | 1.125 | 1.3 | 600 | Subsections |
| body-lg | `type.body.lg` | 1.0625 | 1.5 | 400 | Lead paragraphs |
| body-md | `type.body.md` | 1.0 | 1.5 | 400 | Default UI copy |
| body-sm | `type.body.sm` | 0.875 | 1.45 | 400 | Secondary |
| caption | `type.caption` | 0.75 | 1.4 | 400 | Meta · labels |
| overline | `type.overline` | 0.6875 | 1.3 | 600 | Eyebrows · uppercase ADR |

---

## Color pairing

| Level | Text token |
|-------|------------|
| Display / headings on dark | `text.primary` |
| Body | `text.primary` |
| Muted / caption | `text.secondary` |
| On gold surface | `text.on-accent` |
| Error inline | `status.error` + icon |

**Prohibido:** gold display text on gold background.

---

## Bilingual rules (i18n MOD-015)

| Regla | Detalle |
|-------|---------|
| TY-01 | Same scale EN/ES — no separate font sizes per locale |
| TY-02 | Allow +10% line-height for ES paragraphs ADR |
| TY-03 | Truncation rules in Components — DS defines min readable size |
| TY-04 | Legal/official strings may use body-md minimum |
| TY-05 | No translated text in DS docs — pattern only |

---

## Emphasis

| Style | Rule |
|-------|------|
| Bold | weight 600 — sparing |
| Italic | editorial quotes · Playfair contexts only ADR |
| Uppercase | overline + letter-spacing token ADR |
| Underline | links only — not headings |

---

## Minimum sizes (mobile)

| Element | Min |
|---------|-----|
| Body | 16px equivalent (`body-md`) |
| Caption | 12px equivalent — avoid for critical actions |
| Touch labels | 14px+ recommended |

→ `../theme/THEME-ACCESSIBILITY.md`

---

*TYPOGRAPHY v1.0 — TICKET-V2-SHARED-CORE-016*
