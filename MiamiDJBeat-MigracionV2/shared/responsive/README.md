# responsive/

Módulo **MOD-016 Responsive Engine** · Shared Core · **Nivel 2 (UI Foundation)**

## Documentación — TICKET-V2-SHARED-CORE-018 — Responsive Engine Specification

| Archivo | Contenido |
|---------|-----------|
| **RESPONSIVE-SPEC.md** | Objetivos · scope · relaciones |
| **BREAKPOINT-STRATEGY.md** | Mobile-first · bp tokens |
| **LAYOUT-ADAPTATION.md** | Grid · type · components behavior |
| **DEVICE-CATEGORIES.md** | Touch · pointer · safe areas · foldables |
| **RESPONSIVE-RULES.md** | Reglas por form factor |
| **RESPONSIVE-EVENTS.md** | 8 eventos |
| **RESPONSIVE-ERRORS.md** | ERR-RESP-001–010 |
| **ACCESSIBILITY-RESPONSIVE.md** | a11y cross viewport |
| **PERFORMANCE-GUIDELINES.md** | Performance doc |

## Estado

| Campo | Valor |
|-------|-------|
| **Documentación** | **DOCUMENTACIÓN COMPLETA** |
| **Implementación** | **PENDIENTE** |
| **Ticket** | TICKET-V2-SHARED-CORE-018 |
| **Shared Core spec** | **16/16 — 100%** |

## Reglas clave

- Define **reglas arquitectónicas** de adaptación — no CSS · no media queries runtime
- Mobile-first · anti layout-shift nav/auth
- Authority breakpoints — DS grid + Components behavior conform
- **No** Theme tokens · **No** i18n · **No** permisos · **No** negocio

## Dependencias (documentales)

MOD-008 Design System · MOD-009 Components · MOD-006 Configuration · MOD-004 Event Bus · MOD-010 Logging

## Próxima fase (post Shared Core spec)

Aprobación PO → **Fase Runtime Shared Core** o **Portal Shell MOD-101** spec — ticket separado · Documentation First gate intacto
