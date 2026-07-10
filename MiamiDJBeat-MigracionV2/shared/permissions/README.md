# permissions/

Módulo **MOD-003 Permissions** · Shared Core.

## Documentación — TICKET-V2-SHARED-CORE-004 — Permissions Specification

| Archivo | Contenido |
|---------|-----------|
| **PERMISSIONS-SPEC.md** | Roles, flow, portal restrictions, reglas capability-first |
| **ROLE-MATRIX.md** | Matriz completa 10 roles × 51 capabilities |
| **CAPABILITY-CATALOG.md** | Catálogo oficial capabilities |
| **ACCESS-RULES.md** | Deny-default, least privilege, inheritance, override |
| **../CONTRACTS.md** | Contrato §3 (TICKET-V2-SHARED-CORE-002) |

## Responsabilidad

Resolver snapshot → **capabilities**; guards `hasCapability()`. Denegación por defecto.

## Secuencia tickets Shared Core

| Ticket | Entregable |
|--------|------------|
| 001 | Scaffold |
| 002 | CONTRACTS.md |
| 003 | Event Bus specification |
| **004** | **Permissions specification (este módulo)** |
| 005 | Pendiente PO |

## Estado

**Especificación completada** — TICKET-V2-SHARED-CORE-004  
**Implementación:** ninguna · **Código:** ninguno

## Dependencias prohibidas

- Portales, V1, Supabase runtime, Auth real, API real, UI
