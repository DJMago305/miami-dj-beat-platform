# services/

Capa de **servicios de dominio** · Shared Core (MOD-409 Orders Core y módulos relacionados).

## Responsabilidad

Orquestar acceso a datos de negocio compartidos entre portales: órdenes, perfiles, notificaciones de dominio — **proyección Operations Core**, una orden, múltiples vistas.

## Alcance

- Módulos de servicio por entidad (orders, profiles, bookings…)
- Coordinación con API Client; sin SQL embebido en portales

## Qué podrá contener

- Interfaces `OrdersService`, `ProfileService` (futuro)
- Mappers DTO ↔ UI model
- Reglas de proyección por rol (lectura)
- Tests de contrato servicio (futuro)

## Qué no podrá contener

- Pantallas o rutas de portal
- Writes staff red zone sin guard permissions
- Duplicación de lógica ya en portal
- Migraciones Supabase

## Dependencias permitidas

- `../api/`, `../config/`, `../permissions/`
- `../errors/`, `../logging/`, `../events/`

## Dependencias prohibidas

- `../../client/`, `../../artist/`, `../../staff/`
- Import circular con `../components/`
- V1 (`web/client-portal.js`, etc.)

## Estado

Arquitectura física — **sin implementación** (TICKET-V2-SHARED-CORE-001).
