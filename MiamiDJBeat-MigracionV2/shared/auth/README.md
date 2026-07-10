# auth/

Módulo **MOD-001 Authentication** · Shared Core.

## Documentación — TICKET-V2-SHARED-CORE-012 — Authentication Specification

| Archivo | Contenido |
|---------|-----------|
| **AUTH-SPEC.md** | Propósito, scope, reglas, relaciones, criterios |
| **AUTH-LIFECYCLE.md** | 12 estados · tabla transiciones |
| **AUTH-PROVIDER-CONTRACT.md** | Proveedor futuro conceptual (sin Supabase) |
| **AUTH-SESSION-BOUNDARY.md** | AuthHandle · IdentitySnapshot · handoff |
| **AUTH-ERRORS.md** | ERR-AUTH-001–010 |
| **../CONTRACTS.md** | §1 Contrato Auth (ticket 002) |
| **../session/SESSION-SPEC.md** | §10 Auth ↔ Session |

## Estado

| Campo | Valor |
|-------|-------|
| **Documentación** | **DOCUMENTACIÓN COMPLETA** |
| **Implementación** | **PENDIENTE** |
| **Ticket** | TICKET-V2-SHARED-CORE-012 |

## Regla central

Auth **identifica**. Session **administra estado**. Permissions **decide capacidades**.

## Dependencias permitidas

Configuration · Logging · Error Handling · Event Bus

## Dependencias prohibidas

Permissions (direct) · Portales · V1 `web/` · Components · Supabase SDK (este ticket) · API Client direct en sign-in UI

## Límites

- No permisos · no roles · no UI · no refresh plain · no tokens en logs
- Entrega AuthHandle a Session; Permissions fetch propio

## Próximo paso

Aprobación PO → **TICKET-V2-SHARED-CORE-014** (MOD-007 Theme o MOD-013 Feature Flags).
