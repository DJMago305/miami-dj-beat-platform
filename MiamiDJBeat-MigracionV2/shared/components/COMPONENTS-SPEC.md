# COMPONENTS-SPEC.md

**TICKET-V2-SHARED-CORE-017 — Components Library Specification**

**Módulo:** MOD-009 Components Library  
**Ticket:** TICKET-V2-SHARED-CORE-017  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Catálogo y contratos de **componentes UI reutilizables** — qué existen, cómo se clasifican, nombran y componen.  
> **No** HTML · **No** CSS · **No** JS/TS · **No** React · **No** runtime.

---

## 1. Objetivos

| Objetivo | Descripción |
|----------|-------------|
| **Inventario único** | Una biblioteca Shared Core para Client · Artist · Staff |
| **Reutilización** | Evitar duplicación portal-local de Button, Modal, Table… |
| **Contratos claros** | Props conceptuales, estados, a11y antes de código |
| **Consumo DS/Theme** | Componentes aplican Design System — no redefinen tokens |
| **Separación negocio** | Sin Orders, Payments, Permissions en Core components |
| **Preparar runtime** | Spec completa gate DECISION-V2-002 |

---

## 2. Scope

| Incluye | Documento |
|---------|-----------|
| Clasificación y categorías | COMPONENT-CATEGORIES.md |
| Inventario conceptual | COMPONENT-INVENTORY.md |
| Contrato por componente | COMPONENT-CONTRACT.md |
| Naming | NAMING-CONVENTIONS.md |
| Estados | COMPONENT-STATES.md |
| Composición | COMPOSITION-RULES.md |
| Accesibilidad | ACCESSIBILITY-GUIDELINES.md |
| Lifecycle subsistema | COMPONENT-LIFECYCLE.md |
| Eventos | COMPONENT-EVENTS.md |
| Errores | COMPONENT-ERRORS.md |

---

## 3. Non-scope

| Excluye | Responsable |
|---------|-------------|
| Implementación DOM/framework | Runtime ticket post-PO |
| HTML/CSS/JS/TS source | Prohibido en este ticket |
| Portal shells · `#mainNav` · owner strip | MOD-101+ portales |
| Lógica negocio Orders/Payments | Services / portales |
| Permisos · `hasCapability()` | MOD-003 — portal wraps |
| Translation catalog | MOD-015 — keys only in contract |
| Token registry | MOD-007 Theme |
| Visual scales/principles | MOD-008 Design System |
| Breakpoints runtime | MOD-016 Responsive |
| `web/` V1 components | Prohibido copy |

---

## 4. Arquitectura

```
Theme tokens (MOD-007)
  → Design System rules (MOD-008)
  → Components Library contracts (MOD-009)  ← este módulo
  → Portal Shell composes (MOD-101+)
  → Feature modules use components + business logic
```

| Capa | Rol |
|------|-----|
| **Foundation** | Primitives — Icon, Text, Spacer |
| **Layout** | Grid, Stack, Container |
| **Patterns** | Button, Input, Card, Modal… |
| **Domain-adjacent** | Scheduling, Payments UI shells — **presentation only** |

**Atomicidad:** Foundation → Layout → Pattern → Composition (portal).

---

## 5. Responsabilidades

| Hace | No hace |
|------|---------|
| Define inventario y contratos | Render UI |
| Documenta estados y a11y | Auth gates |
| Naming y categorías | i18n string values |
| Composition rules | Theme token values |
| Event/error contracts component-level | Business validation rules |

---

## 6. Reutilización

| Regla | Detalle |
|-------|---------|
| R-01 | Portal **importa** component spec compliance — no fork Button |
| R-02 | Variants documentados en CONTRACT — no one-off portal CSS |
| R-03 | Shared Core components **never** import from `client/` `artist/` `staff/` |
| R-04 | New component → inventory entry + ticket before runtime |

---

## 7. Relación con Design System (MOD-008)

| DS | Components |
|----|------------|
| Spacing · type · surfaces | Applied per COMPONENT-CONTRACT |
| INTERACTION-STATES | Mapped in COMPONENT-STATES |
| DESIGN-RULES | Compliance mandatory |
| No component names in DS | DS stays grammar — CL names patterns |

---

## 8. Relación con Theme (MOD-007)

| Regla | Detalle |
|-------|---------|
| Colors/spacing/radius | Token refs only — TOKEN-CONTRACT |
| THEME_CHANGED | Components re-bind vars runtime ADR |
| Components **no** define tokens | Consume semantic.* |

---

## 9. Relación con Responsive (MOD-016)

| Components | Responsive |
|------------|------------|
| Document `responsiveBehavior` per component | Breakpoint authority |
| Mobile-first props conceptual | Density shifts |
| Nav components defer geometry | MOD-016 mobile nav contract |

---

## 10. Relación con i18n (MOD-015)

| Permitido | Prohibido |
|-----------|-----------|
| `labelKey`, `ariaLabelKey` in contract | Hardcoded EN/ES strings |
| `t(key)` pattern documented runtime | i18n logic in component Core |
| Placeholder keys | Business copy in Shared Core |

---

## 11. Relación con Feature Flags (MOD-013)

| Pattern | Detalle |
|---------|---------|
| Optional component variant | Gated by `flag.mod-009.*` ADR |
| Flag false | Component not registered runtime |
| Never bypass capability with flag | S-07 Flags spec |

---

## 12. Relación con Event Bus (MOD-004)

| Pattern | Detalle |
|---------|---------|
| Component emits UI events | COMPONENT-EVENTS.md |
| `scope: internal` default | Portal orchestration |
| No domain ORDER_* in Core | Business in services |

---

## 13. Relación con Portal Shell

| Portal Shell | Components |
|--------------|------------|
| Composes layout + nav slots | Supplies Button, Modal, etc. |
| Portal-specific chrome | **Outside** inventory — ticket portal |
| `PORTAL_READY` after components registry ADR | Boot order |

Shell **uses** library — does not **define** Core components.

---

## 14. Dependencias permitidas

| Módulo | Uso |
|--------|-----|
| MOD-008 Design System | Rules reference |
| MOD-007 Theme | Token refs |
| MOD-015 i18n | Key names in contract |
| MOD-013 Feature Flags | Optional registration |
| MOD-016 Responsive | Behavior notes |
| MOD-010 Logging | Violation dev ADR |
| MOD-014 Error Handler | ERR-COMP normalize |

---

## 15. Dependencias prohibidas

| Módulo | Razón |
|--------|-------|
| MOD-003 Permissions | Portal wrapper |
| MOD-005 API Client | No fetch in components |
| MOD-001/002 Auth | Portal concern |
| Portales | Import direction one-way |
| Supabase | Prohibido |
| `web/styles.css` | V1 |

---

## 16. Anti-patterns

| Anti-pattern | Razón |
|--------------|-------|
| Staff dashboard panel in Core | Portal MOD-301 |
| `#mainNav` in Components | Locked V1/V2 portal |
| Permission check inside Button | Capability at portal |
| Inline styles hardcoded | Token violation |
| Duplicate Modal per portal | Inventory breach |

---

## 17. Criterios de aceptación documental

- [x] 12 documentos en `shared/components/`
- [x] Inventario conceptual multi-categoría
- [x] Sin código · sin V1

---

*COMPONENTS-SPEC v1.0 — TICKET-V2-SHARED-CORE-017*
