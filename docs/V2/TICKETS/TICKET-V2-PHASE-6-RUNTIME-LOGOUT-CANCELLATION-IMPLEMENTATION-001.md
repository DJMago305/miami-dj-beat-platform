# TICKET-V2-PHASE-6-RUNTIME-LOGOUT-CANCELLATION-IMPLEMENTATION-001

## Estado

**IMPLEMENTADO, PROBADO, APROBADO POR PRODUCT OWNER Y COMMITTEADO LOCALMENTE**

| Campo | Valor |
|-------|-------|
| Rama | `plan/v2-phase-4-api-client` |
| Commit implementación | `5ab93afb93f79b1dfa2624dff194bfe3f6f875d2` |
| Mensaje commit | `feat(v2-api): cancel in-flight requests on logout` |
| Discovery de referencia | `3b08c52` — `docs(v2-runtime): close logout cancellation discovery` |
| Diseño | Opción B — bootstrap composition root |
| Suite final | **479/479 PASS** · **45/45 files** |
| Validación visual localhost | ✅ Aprobada PO (`http://localhost:5173` — client / artist / staff) |
| Push / PR / merge / preview / deploy | ❌ NO AUTORIZADO |

---

## Objetivo

Conectar el ciclo de logout y destrucción de Session con la cancelación de requests activas del API Client.

---

## Arquitectura anterior

```
Auth
  → USER_LOGOUT
  → Session
  → clearSession()

API Client:
  sin cancelación automática de requests activas
```

---

## Arquitectura nueva

```
Auth
  → USER_LOGOUT
  → Session
  → clearSession()

Bootstrap
  → USER_LOGOUT
  → apiClient.cancelAll()

SESSION_DESTROYED
  → apiClient.cancelAll()
```

---

## Propiedad de cancelAll()

| Regla | Implementación |
|-------|----------------|
| `cancelAll()` ya existía en MOD-005 API Client | ✅ Sin nuevo contrato |
| Bootstrap actúa como composition root | ✅ `initialize-api.ts` |
| Session no importa API Client | ✅ Sin cambios en MOD-002 |
| Auth no importa API Client | ✅ Sin cambios en MOD-001 |
| Runtime Registry no coordina cancelaciones | ✅ Sin cambios en MOD-RUNTIME |

Implementación en `wireApiClientLogoutCancellation()`:

- Suscripción idempotente a `USER_LOGOUT` y `SESSION_DESTROYED`
- Handler síncrono `cancelAllInFlightApiRequests()` → `getApiClient().cancelAll()`
- `resetBootApiWiringForTests()` desuscribe listeners

---

## Recursos cancelados

| Recurso | Mecanismo |
|---------|-----------|
| Requests HTTP in-flight | `inFlight` Map → `AbortController.abort('cancel-all')` |
| `operationAbort` | Map limpiado tras abort |
| Retries pendientes | `operationSignal` abortado — sin nuevo intento |
| Timeouts asociados | `clearTimeout` al abort en `request()` |
| Requests del usuario anterior | Abortadas antes de relogin |

---

## resetApiClientForTests()

| Antes | Después |
|-------|---------|
| Solo `frozenClient = null` | `frozenClient?.cancelAll()` **antes** de null |
| Promises pendientes podían quedar vivas | Abort explícito — aislamiento reproducible |

---

## Archivos modificados

Exactamente los **4 archivos** del commit `5ab93af`:

| Archivo | Cambio |
|---------|--------|
| `MiamiDJBeat-MigracionV2/bootstrap/initialize-api.ts` | Wiring `USER_LOGOUT` + `SESSION_DESTROYED` → `cancelAll()` |
| `MiamiDJBeat-MigracionV2/shared/api/runtime/api-service.ts` | `resetApiClientForTests()` invoca `cancelAll()` primero |
| `MiamiDJBeat-MigracionV2/tests/unit/api-client-foundation.test.ts` | +1 test reset con request pendiente |
| `MiamiDJBeat-MigracionV2/tests/unit/boot-api-wiring.test.ts` | +7 tests logout cancellation wiring |

**Estadísticas:** 4 files changed, 232 insertions(+)

---

## Datos explícitamente excluidos

El wiring **no** lee ni expone:

- Authorization
- accessTokenRef
- userId
- credentialVersion
- expiresAt
- SessionSnapshot
- headers
- bodies
- secretos
- credenciales reales

---

## Tests

| Métrica | Resultado |
|---------|-----------|
| Test files | **45/45 PASS** |
| Tests | **479/479 PASS** |
| Pruebas nuevas logout cancellation | **8** |
| Regresiones | **0** |

### Escenarios cubiertos

| # | Escenario |
|---|-----------|
| 1 | `USER_LOGOUT` dispara `cancelAll()` |
| 2 | `SESSION_DESTROYED` dispara `cancelAll()` |
| 3 | `resetApiClientForTests()` cancela pendientes |
| 4 | Logout durante request activa |
| 5 | Múltiples requests activas canceladas |
| 6 | Relogin no hereda requests previas |
| 7 | `cancelAll()` repetido sin fallo |
| 8 | Respuestas tardías canceladas (`API_CANCELLED`) |

---

## Validación Product Owner

| Portal | Resultado |
|--------|-----------|
| Client | ✅ Aprobado visualmente |
| Artist | ✅ Aprobado visualmente |
| Staff | ✅ Aprobado visualmente |
| Pills en ready | ✅ Sin regresiones visibles |

---

## Commit

| Campo | Valor |
|-------|-------|
| Hash completo | `5ab93afb93f79b1dfa2624dff194bfe3f6f875d2` |
| Mensaje | `feat(v2-api): cancel in-flight requests on logout` |

---

## Publicación

- No push.
- No PR.
- No merge.
- No preview.
- No deploy.

---

## Fuera de alcance

- FetchTransport
- Supabase
- UI
- Runtime Registry dinámico
- Session internals
- Auth internals
- Producción V1

---

*Implementación · HEAD `5ab93afb93f79b1dfa2624dff194bfe3f6f875d2` · 479/479 PASS*
