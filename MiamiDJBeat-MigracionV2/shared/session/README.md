# session/

Módulo **MOD-002 Session Manager** · Shared Core.

## Documentación — TICKET-V2-SHARED-CORE-005 — Session Manager Specification

| Archivo | Contenido |
|---------|-----------|
| **SESSION-SPEC.md** | Responsabilidad, estados, snapshot, eventos, Auth prep |
| **SESSION-LIFECYCLE.md** | Boot → Destroy |
| **SESSION-STATE-MACHINE.md** | 9 estados, transiciones válidas |
| **SESSION-STORAGE.md** | Persistencia restore |
| **../CONTRACTS.md** | Contrato §2 Session (TICKET-V2-SHARED-CORE-002) |

## Métricas spec

| Métrica | Valor |
|---------|-------|
| Estados | 9 |
| Eventos emitidos | 6 |
| Eventos escuchados | 5 |
| Eventos total | 11 |

## Secuencia tickets Shared Core

| Ticket | Entregable |
|--------|------------|
| 001–004 | Scaffold, Contratos, Event Bus, Permissions |
| **005** | **Session Manager specification** |
| 006 | Pendiente PO |

## Reglas clave

- NO autentica · NO Supabase · NO UI
- Administra solo estado de sesión
- Auth alimenta vía `AuthHandle` desacoplado

## Estado

**Especificación completada** — sin implementación · sin código

## Dependencias permitidas (runtime futuro)

Event Bus · Permissions · Configuration · Logging

## Dependencias prohibidas

Supabase directo, API Client directo, portales, UI, Auth circular import
