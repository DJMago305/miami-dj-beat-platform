# DESIGN-SYSTEM-SPEC.md

**TICKET-V2-SHARED-CORE-016 — Design System Specification**

**Módulo:** MOD-008 Design System  
**Ticket:** TICKET-V2-SHARED-CORE-016  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Define el **lenguaje visual oficial** de MiamiDJBeat-MigracionV2: principios, escalas, jerarquía, estados e interacción documentales.  
> **No** CSS · **No** HTML · **No** componentes · **No** páginas · **No** runtime.

---

## 1. Objetivos

| Objetivo | Descripción |
|----------|-------------|
| **Unificar identidad** | Dark · Gold · Premium · Glass en todos los portales |
| **Traducir tokens a lenguaje** | Theme (MOD-007) → reglas visuales consumibles por Components (MOD-009) |
| **Escalas consistentes** | Grid, spacing, type, elevation — una sola gramática |
| **Estados predecibles** | Focus · hover · error · success — documentados antes de UI |
| **Accesibilidad by design** | Contraste, focus, motion — alineado Theme a11y |
| **Preparar Responsive** | Grid y breakpoints conceptuales para MOD-016 |

---

## 2. Scope

| Incluye | Documento |
|---------|-----------|
| Principios de diseño | DESIGN-PRINCIPLES.md |
| Reglas y anti-patterns | DESIGN-RULES.md |
| Mapeo tokens → lenguaje visual | VISUAL-TOKENS.md |
| Grid y layout base | LAYOUT-GRID.md |
| Tipografía | TYPOGRAPHY.md |
| Iconografía | ICONOGRAPHY.md |
| Espaciado | SPACING-SYSTEM.md |
| Superficies y elevación | SURFACE-HIERARCHY.md |
| Estados de interacción | INTERACTION-STATES.md |
| Motion guidelines | DESIGN-RULES.md §Motion |
| Glass / Premium / Dark-Gold | DESIGN-PRINCIPLES.md |

---

## 3. Non-scope

| Excluye | Responsable |
|---------|-------------|
| Botones, cards, inputs, tables, nav | MOD-009 Components Library |
| CSS files · stylesheets | Runtime ADR post-spec |
| HTML / DOM | Portales + Components |
| Layouts finales de portal | Portal shells MOD-101+ |
| Breakpoints runtime | MOD-016 Responsive Engine |
| Token registry authority | MOD-007 Theme Manager |
| Translation strings | MOD-015 i18n |
| Permisos | MOD-003 |
| Feature toggles UI | MOD-013 Flags |
| `web/styles.css` V1 | Prohibido |

---

## 4. Responsabilidades

| Hace | No hace |
|------|---------|
| Define principios y reglas visuales | Implementa componentes |
| Documenta escalas (space, type, radius) | Emite CSS custom properties |
| Jerarquía surface / elevation | Renderiza UI |
| Estados visuales genéricos | Lógica de negocio |
| Referencia tokens Theme | Duplica token registry |
| Motion guidelines documentales | Animaciones runtime |
| Glass / premium philosophy | Decide idioma o permisos |

---

## 5. Identidad visual

| Pilar | Expresión documental |
|-------|---------------------|
| **Dark** | Fondos profundos · texto alto contraste · superficies glass |
| **Gold** | Acento premium · CTAs · estados activos · uso moderado |
| **Premium** | Espaciado generoso · tipografía display · sombras sutiles |
| **Glass** | Capas translúcidas · blur · bordes finos luminosos |
| **Modern luxury** | Minimal clutter · jerarquía clara · motion suave |

→ Detalle: **DESIGN-PRINCIPLES.md**

---

## 6. Lenguaje visual

Gramática del producto — **no** componentes:

```
Theme tokens (MOD-007)
  → Design System scales + rules (MOD-008)
  → Components apply patterns (MOD-009)
  → Portal shells compose pages (MOD-101+)
```

Design System **interpreta** tokens en reglas (ej. “accent gold solo en primary CTA y active nav”).

---

## 7. Relación con Theme (MOD-007)

| Theme | Design System |
|-------|---------------|
| Define **tokens** (brand, semantic, surface…) | Define **cómo usar** tokens |
| TOKEN-CONTRACT authority | VISUAL-TOKENS mapping |
| THEME_CHANGED event | DS invalidates cached scale refs ADR |
| Dark/gold base | Dark/Gold philosophy rules |

**Regla DS-01:** Design System **nunca** redefine valores hex — solo referencia token ids.

**Regla DS-02:** Listen `THEME_CHANGED` en runtime futuro — no hardcode colors.

→ `../theme/THEME-SPEC.md` · `../theme/TOKEN-CONTRACT.md`

---

## 8. Relación con Components (MOD-009)

| Design System | Components |
|---------------|------------|
| Escalas · estados · reglas | Implementación Button, Card, Input… |
| “Primary button uses semantic.accent + text.on-accent” | DOM + ARIA + props |
| Spacing scale | Padding/margin en componente |

Components **deben** conformarse a DESIGN-RULES.md — violaciones = PR reject ADR.

---

## 9. Relación con Responsive (MOD-016)

| Design System | Responsive |
|---------------|------------|
| Grid conceptual 12-col | Breakpoint application |
| Spacing scale (fixed rem) | Density shifts per breakpoint ADR |
| Type scale steps | Fluid type optional ADR |

DS documenta **base grid**; MOD-016 documenta **cuándo** cambia layout.

---

## 10. Relación con Accessibility

| Área | Fuente |
|------|--------|
| Contraste mínimo | `../theme/THEME-ACCESSIBILITY.md` |
| Focus visible | INTERACTION-STATES.md |
| Reduced motion | DESIGN-RULES.md §Motion |
| Color not sole indicator | ICONOGRAPHY.md + INTERACTION-STATES |

Design System **aplica** reglas a11y Theme a escalas y estados — no reemplaza THEME-ACCESSIBILITY.

---

## 11. Relación con i18n (MOD-015)

| Permitido | Prohibido |
|-----------|-----------|
| Type scale para longitud texto EN/ES | Translation keys en DS docs |
| Line-height para párrafos bilingües | Hardcoded UI copy |
| Icon + text pattern (conceptual) | Locale-specific colors |

Copy vive en i18n; DS solo define **espacio** y **tipografía** para contener copy.

---

## 12. Dependencias permitidas

| Módulo | Uso |
|--------|-----|
| MOD-007 Theme | Token source |
| MOD-006 Configuration | DS version flag ADR |
| MOD-013 Feature Flags | DS experimental patterns ADR |
| MOD-010 Logging | Spec violations dev ADR |

---

## 13. Dependencias prohibidas

| Módulo | Razón |
|--------|-------|
| MOD-009 Components | DS precede Components — no import |
| MOD-003 Permissions | No UI gates in DS |
| MOD-015 i18n strings | Copy separada |
| Portales | DS es Shared Core |
| `web/` V1 | Cutover rules |

---

## 14. Anti-patterns

| Anti-pattern | Razón |
|--------------|-------|
| Hardcoded `#C9A227` in component spec | Use `semantic.color.accent` |
| New spacing `13px` arbitrary | Use spacing scale |
| Button/card spec in DS | MOD-009 |
| Full page mockups in DS | Portal scope |
| CSS in markdown spec | Runtime ticket |
| Gold body text paragraphs | Legibility — accent sparingly |
| Glass on every surface | Hierarchy — see SURFACE-HIERARCHY |

---

## 15. Criterios de aceptación documental

- [x] 11 documentos en `shared/design-system/`
- [x] Principios Dark/Gold/Glass/Premium
- [x] Estados interacción documentados
- [x] Sin componentes · sin CSS · sin V1

---

*DESIGN-SYSTEM-SPEC v1.0 — TICKET-V2-SHARED-CORE-016*
