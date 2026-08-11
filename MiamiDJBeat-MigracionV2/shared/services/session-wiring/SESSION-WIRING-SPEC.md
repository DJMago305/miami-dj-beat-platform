# Session & Auth Wiring Domain — SPEC (Paso 2)

| Campo | Valor |
|-------|--------|
| **Módulo** | `shared/services/session-wiring` |
| **Matriz** | `docs/V2/SESSION-AUTH-WIRING-MATRIX.md` |
| **Types** | `shared/types/session.types.ts` |
| **Estado** | Read-only mappers + adapter + mocks — **sin login/refresh writers** · **sin SQL** · **sin commit** |
| **Lab** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Prerrequisitos** | Session Paso 1 sellado · Perfiles + Agenda + Finanzas + Weather sellados |

## Métodos públicos (adapter)

| Método | Rol |
|--------|-----|
| `getLabSessionContext(input?)` | Proyecta snapshot / JWT claims / SessionReader → `SessionContextDTO` + bearer |
| `validateBearerTokenHeader(raw)` | Valida presencia + scheme `Bearer` (sin crypto verify) |
| `verifyDomainAccessWithSession({ domain, context, bearer })` | Gate read-only hacia profiles/bookings/financial/weather |

**Prohibido:** login · register · refresh token · set cookie · mutate claims · alter `auth.users`.

## Mappers

| Función | Salida |
|---------|--------|
| `mapSessionSnapshotToContext` | `SessionContextDTO` |
| `mapBearerTokenToHeader` | `AuthBearerHeaderDTO` |
| `mapJwtClaimsRowToContext` | `SessionContextDTO` (lab claims, no signature verify) |
| `evaluateDomainAccessWithSession` | `DomainAccessVerdict` |

## Fixtures

Client · Artist · Staff · Staff seller · Anonymous · Expired — `session-wiring.mocks.ts`.

## Tests

`tests/unit/session-wiring.service.spec.ts` — headers, expiry, roles, domain gating, superficie read-only.

## Siguiente paso (requiere OK PO)

Paso 3+ — inyección del adapter en mounts de dominio / boot lab (sin Auth writers).
