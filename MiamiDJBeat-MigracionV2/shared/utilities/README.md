# utilities/

Helpers genéricos · Shared Core.

## Responsabilidad

Utilidades puras sin dominio de negocio: formatters, guards de tipo, helpers URL, debounce, id generators.

## Alcance

- Funciones sin side effects preferidas
- Sin dependencia de Supabase

## Qué podrá contener

- `encodeUri`, `clamp`, `safeJsonParse` (futuro)
- Helpers testables unitarios

## Qué no podrá contener

- Lógica orders, permissions, auth
- Globals `window.__mdj*`
- Copia de helpers V1 monolíticos sin ADR

## Dependencias permitidas

- Ninguna obligatoria; evitar imports pesados

## Dependencias prohibidas

- `../services/`, portales
- Circular imports con auth/api

## Estado

Arquitectura física — **sin implementación** (TICKET-V2-SHARED-CORE-001).
