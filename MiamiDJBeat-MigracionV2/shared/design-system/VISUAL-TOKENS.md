# VISUAL-TOKENS.md

**TICKET-V2-SHARED-CORE-016 — Design System Specification**

**Módulo:** MOD-008 · Tokens semánticos en lenguaje DS  
**Versión:** 1.0

> **Authority de valores:** `../theme/TOKEN-CONTRACT.md` (MOD-007).  
> Este documento define **cómo Design System consume y combina** tokens — no nuevos hex.

---

## Capas de token

```
brand.*     → identidad raw (Theme)
semantic.*  → significado funcional (Theme → DS rules)
surface.*   → capas UI (DS hierarchy)
text.*      → énfasis tipográfico color
status.*    → feedback states
portal.*    → overlays opcionales
```

---

## Mapeo DS — color

| Rol visual DS | Token Theme | Uso DS |
|---------------|-------------|--------|
| Page background | `semantic.color.bg.primary` | Shell base |
| Panel default | `surface.base` | Content areas |
| Card / elevated | `surface.elevated` | Glass cards |
| Scrim | `surface.overlay` | Modals |
| Body text | `text.primary` | Default copy container |
| Muted text | `text.secondary` | Meta · captions |
| Interactive accent | `semantic.color.accent` | Links · primary actions |
| On-accent text | `text.on-accent` | Text on gold buttons |
| Divider | `border.default` | Section splits |
| Focus ring | `border.focus` | Keyboard nav |

---

## Mapeo DS — dimension

| Rol DS | Token Theme | Referencia doc |
|--------|-------------|----------------|
| Inline gap xs–xl | `spacing.xs` … `spacing.xl` | SPACING-SYSTEM.md |
| Corner soft | `radius.sm` … `radius.full` | SURFACE-HIERARCHY.md |
| Elevation 1–3 | `shadow.sm`, custom ADR | SURFACE-HIERARCHY.md |
| Gold glow | `shadow.gold-glow` | Premium highlights |
| Duration | `motion.duration.*` | DESIGN-RULES.md |
| Easing | `motion.ease.standard` | DESIGN-RULES.md |
| Layer order | `z-index.*` | SURFACE-HIERARCHY.md |

---

## Status tokens (feedback)

| Estado | Token | DS rule |
|--------|-------|---------|
| Success | `status.success` | Icon + text · never color alone |
| Warning | `status.warning` | Pair with icon |
| Error | `status.error` | Sufficient contrast on dark |
| Info | `status.info` | Distinct from accent gold |

→ Estados completos: **INTERACTION-STATES.md**

---

## Semantic combinations (allowed)

| Pattern | Tokens |
|---------|--------|
| Primary action surface | `semantic.color.accent` + `text.on-accent` + `radius.md` |
| Glass card | `surface.elevated` + `brand.glass.blur` + `border.default` |
| Muted section | `surface.base` + `text.secondary` |
| Active nav | `semantic.color.accent` underline ADR + `text.primary` |

---

## Semantic combinations (prohibited)

| Pattern | Razón |
|---------|-------|
| `status.error` as CTA primary | Semantic confusion |
| `text.secondary` on `surface.overlay` without contrast check | a11y fail |
| Portal accent replacing `brand.gold.primary` globally | Brand drift |
| Hardcoded rgba outside token map | T-03 TOKEN-CONTRACT |

---

## THEME_CHANGED consumption (futuro)

1. Receive `{ themeId, mode }`
2. Reload token map reference
3. DS scale docs unchanged — values resolve from Theme
4. Components re-bind CSS vars ADR

Design System spec **stable** across theme switches — values dynamic.

---

*VISUAL-TOKENS v1.0 — TICKET-V2-SHARED-CORE-016*
