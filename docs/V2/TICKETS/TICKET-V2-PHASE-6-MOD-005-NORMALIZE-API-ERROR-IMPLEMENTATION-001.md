# TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-IMPLEMENTATION-001

## Estado

**IMPLEMENTADO, PROBADO, APROBADO POR PRODUCT OWNER Y COMMITTEADO LOCALMENTE**

| Campo | Valor |
|-------|-------|
| Rama | `plan/v2-phase-4-api-client` |
| Commit implementación | `24b7da85ca3df0d1332dd2f45447eea84139904b` |
| Mensaje commit | `feat(v2-api): add canonical api error normalization` |
| HEAD pre-implementación | `d7af312942d91d18a45805a9297c621fce93ac98` — `docs(v2-api): close runtime logout cancellation` |
| Discovery de referencia | `TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-DISCOVERY-001` |
| Diseño | Opción B + C — facade en `errors.ts` delegando a normalizadores existentes |
| Suite final | **491/491 PASS** · **45/45 files** |
| Validación visual localhost | ✅ Aprobada PO (`http://localhost:5173` — client / artist / staff) |
| Push / PR / merge / preview / deploy | ❌ NO AUTORIZADO |

---

## Objetivo

Implementar una fachada canónica de normalización de errores para MOD-005 API Client, unificando todas las rutas de fallo bajo `normalizeApiError()` sin alterar el shape público de `ApiError`.

---

## Arquitectura anterior

```
Transport / HTTP / parse / cancel / timeout
  → llamadas directas a normalizadores granulares en api-client.ts
  → ApiResponse { error: ApiError }
```

| Gap | Comportamiento previo |
|-----|----------------------|
| Facade única | ❌ `normalizeApiError()` ausente |
| HTTP 429 | Caía en `API_HTTP_ERROR` |
| HTTP 408/504 | No mapeaban a `API_TIMEOUT` |
| HTTP 200 + `{ error }` | `API_UNKNOWN` |
| `API_RATE_LIMITED` | ❌ Ausente en `ApiErrorCode` |

---

## Arquitectura nueva

```
Transport / HTTP / parse / cancel / timeout
  → normalizeApiError(NormalizeApiErrorInput)   [MOD-005 errors.ts]
  → delega a normalizadores granulares existentes
  → ApiResponse { error: ApiError }
```

| Regla | Implementación |
|-------|----------------|
| Punto único de entrada | ✅ `normalizeApiError()` en `errors.ts` |
| `api-client.ts` | Solo delega rutas existentes — sin cambio de request loop |
| `ApiError` | Plain object frozen — `{ code, message, details, status }` |
| `cause` | Opcional en input — **no** expuesto en `ApiError` |
| `API_INVALID_PAYLOAD` | Permanece fuera de la facade (pre-request path) |
| `API_NETWORK` | Código histórico preservado — sin renombrar |

---

## Contrato implementado

```ts
normalizeApiError(input: NormalizeApiErrorInput): ApiError
```

### `NormalizeApiErrorInput` — discriminated union

```ts
type NormalizeApiErrorInput =
  | { kind: 'cancelled'; cause?: unknown; message?: string }
  | { kind: 'timeout'; status?: number; cause?: unknown; message?: string }
  | { kind: 'network'; cause?: unknown; message?: string }
  | { kind: 'http'; status: number; bodyText?: string; parsedBody?: unknown; cause?: unknown; message?: string }
  | { kind: 'bad-response'; status?: number; bodyText?: string; parsedBody?: unknown; cause?: unknown; message?: string }
  | { kind: 'unknown'; cause?: unknown; message?: string };
```

### Routing canónico

| Entrada | `ApiError.code` |
|---------|-----------------|
| `kind: 'cancelled'` | `API_CANCELLED` |
| `kind: 'timeout'` | `API_TIMEOUT` |
| `kind: 'network'` | `API_NETWORK` |
| HTTP 408 / 504 | `API_TIMEOUT` |
| HTTP 429 | `API_RATE_LIMITED` |
| HTTP 200 + business `{ error }` | `API_EDGE_REJECTED` |
| `kind: 'bad-response'` sin business flag | `API_PARSE_ERROR` |
| `kind: 'unknown'` | `API_UNKNOWN` |
| Otros HTTP | `normalizeHttpStatusError()` (reglas existentes) |

### Cambios de código aprobados por PO

| Mapping | Veredicto PO |
|---------|--------------|
| `API_NETWORK` preservado | ✅ Histórico compatible |
| `API_RATE_LIMITED` aditivo | ✅ Alinea ERR-0506 |
| 408/504 → `API_TIMEOUT` | ✅ Aprobado |
| 429 → `API_RATE_LIMITED` | ✅ Aprobado |
| Business 200 → `API_EDGE_REJECTED` | ✅ Aprobado |
| `api-client.ts` delega a facade | ✅ Necesario y mínimo |

`isRetryableError()` actualizado para incluir `API_RATE_LIMITED` / status 429.

---

## Alcance explícitamente NO modificado

| Área | Estado |
|------|--------|
| Request loop | Sin cambio |
| Retry policy | Sin cambio |
| Timeout client | Sin cambio |
| Cancelación / `cancelAll()` | Sin cambio |
| Authorization / headers | Sin cambio |
| Transport (`MemoryTransport`) | Sin cambio |
| Parsing body | Sin cambio |
| Session / Auth imports | Sin cambio |
| MOD-014 bridge | Fuera de alcance |
| FetchTransport | Fuera de alcance |

---

## Datos explícitamente excluidos

La facade **no** expone en `ApiError`:

- `cause` interno
- bodies completos
- headers
- tokens
- secretos
- `requestId` / `correlationId` (permanecen en `ApiMetadata`)

---

## Archivos modificados

Exactamente los **5 archivos** del commit `24b7da8`:

| Archivo | Cambio |
|---------|--------|
| `MiamiDJBeat-MigracionV2/shared/api/runtime/types.ts` | `NormalizeApiErrorInput` + `API_RATE_LIMITED` en `ApiErrorCode` |
| `MiamiDJBeat-MigracionV2/shared/api/runtime/errors.ts` | Facade `normalizeApiError()` + mappings 408/504/429 + business 200 |
| `MiamiDJBeat-MigracionV2/shared/api/runtime/api-client.ts` | Delegación de rutas de error a facade |
| `MiamiDJBeat-MigracionV2/shared/api/runtime/index.ts` | Export `normalizeApiError`, `NormalizeApiErrorInput` |
| `MiamiDJBeat-MigracionV2/tests/unit/api-client-foundation.test.ts` | +11 tests facade + integración HTTP 429 |

**Estadísticas:** 5 files changed, 262 insertions(+), 21 deletions(-)

---

## Tests

| Métrica | Resultado |
|---------|-----------|
| Test files | **45/45 PASS** |
| Tests | **491/491 PASS** |
| Pruebas nuevas normalizeApiError | **11** |
| Regresiones | **0** |

### Escenarios cubiertos

| # | Escenario |
|---|-----------|
| 1 | `cancelled` → `API_CANCELLED` |
| 2 | `timeout` client → `API_TIMEOUT` |
| 3 | `timeout` + status 504 → `API_TIMEOUT` @504 |
| 4 | `network` → `API_NETWORK` |
| 5 | HTTP 429 facade → `API_RATE_LIMITED` |
| 6 | HTTP 408/504 → `API_TIMEOUT` |
| 7 | `bad-response` sin business flag → `API_PARSE_ERROR` |
| 8 | HTTP 200 + business `{ error }` → `API_EDGE_REJECTED` |
| 9 | `unknown` → `API_UNKNOWN` |
| 10 | Idempotencia mismo input |
| 11 | HTTP 429 vía request path cliente |

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
| Hash completo | `24b7da85ca3df0d1332dd2f45447eea84139904b` |
| Mensaje | `feat(v2-api): add canonical api error normalization` |

---

## Publicación

- No push.
- No PR.
- No merge.
- No preview.
- No deploy.

---

## Fuera de alcance

- FetchTransport implementación
- MOD-014 `NormalizedError` bridge
- Supabase adapter
- `invokeEdge()` / `rpc()`
- UI
- Producción V1

---

## Referencias

| Documento | Rol |
|-----------|-----|
| `TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-DISCOVERY-001.md` | Diseño aprobado (Opción B + C) |
| `2026-07-11-MOD-005-NORMALIZE-API-ERROR-IMPLEMENTATION.md` | Acta de cierre técnico |

---

## Próximo paso

Documentación de cierre completada. **FetchTransport Discovery todavía no está abierto.** Push, PR, merge y deploy continúan **no autorizados** hasta orden explícita PO.

---

*Implementación · TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-IMPLEMENTATION-001 · 2026-07-11*
*Commit · `24b7da85ca3df0d1332dd2f45447eea84139904b` · `feat(v2-api): add canonical api error normalization`*
