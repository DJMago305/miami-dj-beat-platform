# components/

Módulo **MOD-009 Components Library** · Shared Core · **Nivel 2 (UI Foundation)**

## Documentación — TICKET-V2-SHARED-CORE-017 — Components Library Specification

| Archivo | Contenido |
|---------|-----------|
| **COMPONENTS-SPEC.md** | Objetivos · arquitectura · relaciones |
| **COMPONENT-CATEGORIES.md** | 22 categorías · atomicidad |
| **COMPONENT-INVENTORY.md** | 52 componentes conceptuales |
| **COMPONENT-CONTRACT.md** | Plantilla props · variants |
| **COMPONENT-LIFECYCLE.md** | Registry lifecycle |
| **COMPONENT-STATES.md** | 13 estados comunes |
| **COMPOSITION-RULES.md** | Slots · composición |
| **NAMING-CONVENTIONS.md** | Mdj* ids |
| **ACCESSIBILITY-GUIDELINES.md** | WCAG · keyboard · ARIA |
| **COMPONENT-EVENTS.md** | Registry + UI patterns |
| **COMPONENT-ERRORS.md** | ERR-COMP-001–010 |

## Estado

| Campo | Valor |
|-------|-------|
| **Documentación** | **DOCUMENTACIÓN COMPLETA** |
| **Implementación** | **PENDIENTE** |
| **Ticket** | TICKET-V2-SHARED-CORE-017 |
| **Inventario** | 52 componentes · 0 runtime |

## Reglas clave

- Define **qué componentes existen** — no HTML · no CSS · no JS/TS
- Consume **Design System** + **Theme tokens** + **i18n keys**
- **No** permisos · **No** negocio · **No** `#mainNav` / owner strip
- Portal Shell **compone** — no define Core inventory

## Dependencias (documentales)

MOD-008 Design System · MOD-007 Theme · MOD-015 i18n · MOD-013 Flags · MOD-016 Responsive · MOD-004 Event Bus

## Próximo paso

Aprobación PO → **MOD-016 Responsive Engine** (TICKET-V2-SHARED-CORE-018) — cierra Nivel 2 y **16/16** spec Shared Core
