# feature-flags/

Módulo **MOD-013 Feature Flags** · Shared Core · **Nivel 1 (Infraestructura)**

## Documentación — TICKET-V2-SHARED-CORE-015 — Feature Flags Specification

| Archivo | Contenido |
|---------|-----------|
| **FEATURE-FLAGS-SPEC.md** | Propósito, scope, resolución, seguridad |
| **FEATURE-FLAGS-LIFECYCLE.md** | 9 estados · transiciones |
| **FLAG-CONTRACT.md** | Definición flag · naming · rollback |
| **FLAG-CATEGORIES.md** | 8 tipos · 8 categorías |
| **FLAG-EVENTS.md** | 8 eventos FLAGS_* |
| **FLAG-ERRORS.md** | ERR-FLAG-001–010 |
| **FLAG-STORAGE-RULES.md** | `mdj_v2_flag_*` |
| **../CONTRACTS.md** | §8 Contrato Feature Flags |

## Estado

| Campo | Valor |
|-------|-------|
| **Documentación** | **DOCUMENTACIÓN COMPLETA** |
| **Implementación** | **PENDIENTE** |
| **Ticket** | TICKET-V2-SHARED-CORE-015 |

## Responsabilidad

Única autoridad para **definir, resolver y distribuir Feature Flags**. Cutover modular · experimentos · emergency kill-switch — sin bypass Permissions.

## Reglas clave

- **No** permisos · **No** auth · **No** theme · **No** i18n · **No** UI
- Flag true + capability false → **capability wins**
- Unknown flag → default `false` + WARN
- Red zone flags default **false**

## Dependencias (runtime futuro)

Configuration · Storage · Event Bus · Logging · Error Handling

## Prohibido

Portales duplicando registry · V1 `web/` · SDK en este ticket · Supabase en este ticket

## Próximo paso

Aprobación PO → **TICKET-V2-SHARED-CORE-016** (candidato: **MOD-008 Design System** — Nivel 2 UI Foundation)
