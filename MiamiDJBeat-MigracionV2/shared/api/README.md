# api/

Módulo **MOD-005 API Client** · Shared Core.

## Documentación — TICKET-V2-SHARED-CORE-010 — API Client Specification

| Archivo | Contenido |
|---------|-----------|
| **API-CLIENT-SPEC.md** | Responsabilidad, reglas, seguridad, adapters futuros |
| **REQUEST-RESPONSE-CONTRACT.md** | ApiRequest · ApiResponse |
| **API-ERRORS.md** | ApiError · ERR-05xx mapping |
| **API-RETRY-TIMEOUT-RULES.md** | Timeout · retry · cancel · correlationId |
| **../CONTRACTS.md** | §5 Contrato API Client (resumen) |

## Contratos definidos

| Contrato | Documento |
|----------|-----------|
| `ApiRequest` | REQUEST-RESPONSE-CONTRACT.md |
| `ApiResponse` | REQUEST-RESPONSE-CONTRACT.md |
| `ApiError` | API-ERRORS.md |
| `RetryPolicy` | API-RETRY-TIMEOUT-RULES.md |

## Secuencia tickets Shared Core

| Ticket | Entregable |
|--------|------------|
| 001–009 | … Notifications |
| **010** | **API Client specification** |
| 011 | Pendiente PO |

## Reglas clave

- Único egress HTTP/RPC/Edge del Core
- No auth · no permissions · no UI · no secrets · no portal direct
- HTTP ≠ 200 → validar body; surface Edge error/detail
- Retry solo idempotent / retrySafe explícito

## Adapters futuros (spec)

Supabase · Edge Functions · Stripe proxy · Internal API · External API

## Estado

**Especificación completada** — sin implementación · sin API real · sin Supabase live

## Dependencias (runtime futuro)

Configuration · Session (token read) · Logging · Error Handling · Event Bus

## Prohibido

Auth impl, Permissions gate, portal imports, service_role client, V1 supabase-config copy, secrets in repo
