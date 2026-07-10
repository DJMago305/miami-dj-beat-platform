# events/

Módulo **MOD-004 Event Bus** · Shared Core.

## Responsabilidad

Bus de eventos explícitos del sistema: registro tipado emit/listen, contratos `once`, catch-up flags, catálogo oficial V2.

## Documentación — TICKET-V2-SHARED-CORE-003 — Event Bus Specification

| Archivo | Contenido |
|---------|-----------|
| **EVENT-BUS-SPEC.md** | Formato, estados, payload, versionado, catálogo 19 eventos, internal/public/prohibited |
| **EVENT-NAMING-STANDARD.md** | Reglas UPPER_SNAKE, dominios reservados |
| **EVENT-LIFECYCLE.md** | Emit/listen, catch-up, once, surface-ready |
| **../CONTRACTS.md** | Contrato §4 Event Bus (TICKET-V2-SHARED-CORE-002) |

## Alcance

- Especificación del Event Bus V2 — **TICKET-V2-SHARED-CORE-003**
- Implementación runtime → **TICKET-V2-SHARED-CORE-005+** (pendiente PO)
- Prohibición de poll para nav primario — solo `PORTAL_READY` + listen once

## Qué podrá contener (futuro 005+)

- Runtime dispatcher (sin EventEmitter V1 copy)
- Registro catálogo validado contra EVENT-BUS-SPEC.md
- Tests catch-up / once

## Qué no podrá contener

- setTimeout / poll para reorder navegación
- Referencias a client/, artist/, staff/ en implementación Core
- Supabase, Auth real, API real, UI, DOM
- Código copiado desde `web/`

## Dependencias permitidas

- `../config/` (futuro)
- `../logging/` (futuro)
- `../utilities/` (futuro)

## Dependencias prohibidas

- Portales (`../../client/`, `../../artist/`, `../../staff/`)
- `../components/`, Supabase, API runtime
- V1 scripts

## Secuencia tickets Shared Core

| Ticket | Entregable |
|--------|------------|
| 001 | Scaffold carpetas |
| 002 | CONTRACTS.md |
| **003** | **Event Bus — especificación (este módulo)** |
| 004 | Permissions — specification |
| 005+ | Runtime modules (pendiente PO) |

## Estado

**Especificación oficial completada** — TICKET-V2-SHARED-CORE-003  
**Implementación:** ninguna · **Código:** ninguno
