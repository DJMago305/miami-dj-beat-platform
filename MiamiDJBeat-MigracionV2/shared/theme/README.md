# theme/

Módulo **MOD-007 Theme Manager** · Shared Core · **Nivel 1 (Infraestructura)**

## Documentación — TICKET-V2-SHARED-CORE-014 — Theme Manager Specification

| Archivo | Contenido |
|---------|-----------|
| **THEME-SPEC.md** | Propósito, tokens, relaciones, reglas |
| **THEME-LIFECYCLE.md** | 11 estados · transiciones |
| **TOKEN-CONTRACT.md** | brand · semantic · portal tokens |
| **THEME-EVENTS.md** | 12 eventos incl. THEME_CHANGED |
| **THEME-ERRORS.md** | ERR-THEME-001–010 |
| **THEME-STORAGE-RULES.md** | `mdj_v2_theme_*` |
| **THEME-ACCESSIBILITY.md** | WCAG · motion · gold rules |
| **../CONTRACTS.md** | §9 Contrato Theme |

## Estado

| Campo | Valor |
|-------|-------|
| **Documentación** | **DOCUMENTACIÓN COMPLETA** |
| **Implementación** | **PENDIENTE** |
| **Ticket** | TICKET-V2-SHARED-CORE-014 |

## Identidad base

Dark · Gold · Premium · Glass · alto contraste · desktop/mobile · Client · Artist · Staff

## Reglas clave

- Define **tokens**, no componentes · no CSS final · no UI
- **No** i18n · **No** permisos · **No** `hasCapability()`
- **No** V1 `styles.css`

## Dependencias (runtime futuro)

Configuration · Storage · Event Bus · Logging · Error Handling · Session (pref orchestration)

## Prohibido

Portales direct · Components impl · i18n strings · Auth · Permissions · Supabase · V1 CSS

## Próximo paso

Aprobación PO → **TICKET-V2-SHARED-CORE-015** (candidato: **MOD-013 Feature Flags** o **MOD-008 Design System**)
