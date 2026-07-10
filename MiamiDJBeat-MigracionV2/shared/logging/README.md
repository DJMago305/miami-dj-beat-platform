# logging/

Módulo **MOD-010 Logging** · Shared Core.

## Documentación — TICKET-V2-SHARED-CORE-007 — Logging Specification

| Archivo | Contenido |
|---------|-----------|
| **LOGGING-SPEC.md** | Responsabilidad, contexto, correlationId, relaciones, errores |
| **LOG-LEVELS.md** | debug · info · warn · error · fatal |
| **LOG-REDACTION-RULES.md** | Redacción obligatoria PII/secrets |
| **../config/CONFIG-SPEC.md** | `MDJ_V2_LOG_LEVEL` por entorno |

## Niveles oficiales

**5:** debug · info · warn · error · fatal

## Reglas clave

- NO auth · NO permisos · NO Supabase · NO tokens · NO PII sensible · NO UI
- Solo eventos técnicos permitidos y redactados
- Init after Configuration

## Secuencia tickets Shared Core

| Ticket | Entregable |
|--------|------------|
| 001–006 | … Configuration |
| **007** | **Logging specification** |
| 008 | Pendiente PO |

## Estado

**Especificación completada** — sin implementación · sin código

## Dependencias permitidas (runtime futuro)

`../config/` únicamente

## Prohibido

Portales, V1 console patches, Supabase direct, guard logic
