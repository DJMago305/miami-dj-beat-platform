# errors/

Módulo **MOD-014 Error Handler** · Shared Core.

## Documentación — TICKET-V2-SHARED-CORE-008 — Error Handling Specification

| Archivo | Contenido |
|---------|-----------|
| **ERROR-HANDLING-SPEC.md** | Responsabilidad, reglas, recovery, runtime prep |
| **ERROR-CATALOG.md** | ERR-xxxx rangos + 40 códigos iniciales |
| **ERROR-LIFECYCLE.md** | Detect → Terminate pipeline |
| **ERROR-SEVERITY.md** | INFO · WARNING · ERROR · CRITICAL · FATAL |
| **../CONTRACTS.md** | Contrato §7 (MOD-014) |

## Métricas spec

| Métrica | Valor |
|---------|-------|
| Categorías error | 10 |
| Niveles severidad | 5 |
| Códigos catalogados | 40 (rangos ERR-0001–0999) |

## Estado

| Campo | Valor |
|-------|-------|
| **Documentación** | **DOCUMENTACIÓN COMPLETA** |
| **Implementación** | **PENDIENTE** |
| **Ticket** | TICKET-V2-SHARED-CORE-008 |

## Reglas clave

- Autoridad única normalización · código único ERR-xxxx
- No secrets · no tokens · no SQL · no stack prod UI
- Desacoplado: portales usan `presentError(normalized)` facade

## Dependencias (runtime futuro)

Logging · Event Bus · i18n (userMessageKey) · Configuration

## Prohibido

Auth logic, Supabase, API impl, UI components, V1 patterns
