# TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-DISCOVERY-001

## Estado

**DISCOVERY COMPLETADO — IMPLEMENTACIÓN NO AUTORIZADA**

| Campo | Valor |
|-------|-------|
| Modo | Solo lectura de código + documentación en `docs/V2/**` |
| Fecha discovery | 2026-07-11 |
| Rama analizada | `plan/v2-phase-4-api-client` |
| HEAD analizado | `e7390b6e5d16f95ede02a0e241ea426bb87947d2` |
| Commit logout cancellation | `5ab93af` — `feat(v2-api): cancel in-flight requests on logout` |
| Suite baseline | **479/479 PASS** · **45/45 files** |
| Autorización PO | Discovery únicamente — sin runtime, tests, commit, push, PR, merge, preview ni deploy |

---

## Problema

MOD-005 produce errores vía **funciones granulares** (`normalizeHttpStatusError`, `normalizeNetworkFailure`, etc.) pero **no existe** `normalizeApiError()` como contrato único de entrada/salida.

La especificación (`API-ERRORS.md`) documenta un pipeline hacia MOD-014 (`ErrorHandling.normalizeApiError(apiError)`) que **tampoco está implementado** en runtime.

Antes de FetchTransport, `invokeEdge()`, `rpc()` o adaptador Supabase, hace falta un contrato canónico que cualquier transporte futuro pueda alimentar con el mismo shape de error.

---

## Evidencia actual

| Archivo | Símbolo | Evidencia |
|---------|---------|-----------|
| `shared/api/runtime/types.ts` | `ApiError` | `{ code, message, details, status }` — 4 campos frozen |
| `shared/api/runtime/types.ts` | `ApiErrorCode` | 9 códigos: `API_NETWORK`, `API_HTTP_ERROR`, `API_PARSE_ERROR`, `API_TIMEOUT`, `API_EDGE_REJECTED`, `API_CANCELLED`, `API_CONFIG_ERROR`, `API_INVALID_PAYLOAD`, `API_UNKNOWN` |
| `shared/api/runtime/errors.ts` | `createApiError()` | Factory frozen — sin `retryable`, `cause`, `errCode` |
| `shared/api/runtime/errors.ts` | `normalizeHttpStatusError()` | 400–409, 401–404, 422, 5xx — mayoría → `API_HTTP_ERROR`; 422 → `API_EDGE_REJECTED` |
| `shared/api/runtime/errors.ts` | `normalizeNetworkFailure()` | → `API_NETWORK`, status `0` |
| `shared/api/runtime/errors.ts` | `normalizeTimeoutFailure()` | → `API_TIMEOUT`, status `0` |
| `shared/api/runtime/errors.ts` | `normalizeCancellationFailure()` | → `API_CANCELLED`, status `0` |
| `shared/api/runtime/errors.ts` | `normalizeParseFailure()` | → `API_PARSE_ERROR` |
| `shared/api/runtime/errors.ts` | `isRetryableError()` | Lógica separada — no campo en `ApiError` |
| `shared/api/runtime/errors.ts` | `ApiClientError` | Class extends Error — **no** usada en flujo `ApiResponse` |
| `shared/api/runtime/api-client.ts` | `mapTransportException()` | `TransportCancelledError` + `signal.reason === 'timeout'` → `API_TIMEOUT`; otro abort → `API_CANCELLED` |
| `shared/api/runtime/api-client.ts` | `failureResponse()` | `requestId`/`correlationId` en `metadata`, no en `ApiError` |
| `shared/api/runtime/transport-port.ts` | `TransportNetworkError` / `TransportCancelledError` | Excepciones transporte — sin Supabase |
| `shared/api/API-ERRORS.md` | `normalizeApiError` | Documentado en MOD-014 pipeline — **no implementado** |
| `shared/api/API-ERRORS.md` | ERR-0506 | `API_RATE_LIMITED` en catálogo — **sin** `ApiErrorCode` runtime |
| `shared/errors/runtime/auth-normalize.ts` | `normalizeAuthError()` | Precedente MOD-014 — patrón a espejar para API |
| `tests/unit/api-client-foundation.test.ts` | maps HTTP 400/401/403/404/409/422/500 | Cubre códigos actuales; sin 429/502/503/504 dedicados |

**Nota:** No existe carpeta `shared/api/spec/` — especificación vive en `shared/api/*.md`.

---

## Respuestas obligatorias (21 preguntas)

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 1 | ¿Existe tipo `ApiError` canónico? | **Sí** — `types.ts` `ApiError` frozen en `ApiFailure.error` |
| 2 | ¿Existe `normalizeApiError()`? | **No** — solo funciones granulares + doc aspiracional MOD-014 |
| 3 | ¿Qué errores produce `api-client.ts`? | Transport (network/cancel/timeout), HTTP no-2xx, parse, invalid payload, business `{error}` en 200, exhausted retry |
| 4 | ¿Shape? | `{ code: ApiErrorCode, message: string, details: string\|Record\|null, status: number }` |
| 5 | Distinción actual | Cancel: `API_CANCELLED` · Timeout: `API_TIMEOUT` (abort reason `timeout`) · 4xx: `API_HTTP_ERROR`/`API_EDGE_REJECTED` · 5xx: `API_HTTP_ERROR` · Red: `API_NETWORK` · Parse: `API_PARSE_ERROR` · Unknown: `API_UNKNOWN`/`API_NETWORK` fallback |
| 6 | Campos hoy | `code` ✅ · `message` ✅ · `status` ✅ · `retryable` ❌ (función aparte) · `requestId` ❌ (en metadata) · `cause` ❌ · `details` ✅ · `timestamp` ❌ |
| 7 | Campos públicos | `code`, `message`, `details`, `status` en `ApiResponse.error`; `metadata` separado con `requestId`, `correlationId`, `attempt`, `durationMs` |
| 8 | Internos | `signal.reason`, stack traces, body crudo completo, headers, tokens — deben quedar fuera de `ApiError` público |
| 9 | Información sensible | `details` puede incluir `bodyText.slice(0,512)` o objeto parseado con `error`/`detail` — riesgo tokens/PII si body no redactado |
| 10 | Mapeo HTTP | Ver tabla taxonomía § abajo — hoy 429/502/503/504 caen en reglas genéricas |
| 11 | Retryable | `API_NETWORK`, `API_TIMEOUT` (policy default); GET 5xx; 429 (spec); no 401/403/404/409/422 |
| 12 | Nunca retry | `API_CANCELLED`, `API_INVALID_PAYLOAD`, 401/403/404/409/422; mutations sin `retrySafe` |
| 13 | `API_CANCELLED` | Código dedicado; status `0`; no retry; severity INFO; no convertir a unknown |
| 14 | `API_TIMEOUT` | Código dedicado; status `0` en client timer; HTTP 408/504 deberían normalizarse igual (gap) |
| 15 | ¿Preservar `cause`? | **Recomendado interno opcional** — no en shape público serializable |
| 16 | ¿Preservar body? | **Sí parcial** — `details` redactado; nunca body completo ni headers |
| 17 | ¿safeMessage vs debugMessage? | **Recomendado** — `message` = safe; debug solo logging redacted |
| 18 | ¿Serializable? | **Sí** — frozen plain object; sin Error nativo en respuesta |
| 19 | ¿`transportKind`? | **Opcional interno** — útil para Fetch/Memory/Supabase; no obligatorio en `ApiError` público v1 |
| 20 | ¿`operation`/`endpoint`? | **En metadata/context** — ya `path` en logs; no duplicar en `ApiError` |
| 21 | Integración futura | Transport devuelve `TransportResult` o lanza `Transport*Error` → `normalizeApiError({ kind, status, bodyText, signalReason })` → mismo `ApiError`; Edge/RPC/Supabase son paths HTTP con reglas de body |

---

## Taxonomía evaluada

### Comparación propuesta vs runtime actual

| Código propuesto | Runtime hoy | Veredicto |
|------------------|-------------|-----------|
| `API_CANCELLED` | ✅ `API_CANCELLED` | Mantener |
| `API_TIMEOUT` | ✅ `API_TIMEOUT` | Mantener; extender a HTTP 408/504 |
| `API_NETWORK_ERROR` | `API_NETWORK` | **Renombrar alias** — mantener `API_NETWORK` (breaking evitable) |
| `API_BAD_REQUEST` | `API_HTTP_ERROR` @400 | **Añadir** código semántico o subcódigo `status` |
| `API_UNAUTHORIZED` | `API_HTTP_ERROR` @401 | **Añadir** — crítico para refresh ADR |
| `API_FORBIDDEN` | `API_HTTP_ERROR` @403 | **Añadir** |
| `API_NOT_FOUND` | `API_HTTP_ERROR` @404 | **Añadir** |
| `API_CONFLICT` | `API_HTTP_ERROR` @409 | **Añadir** |
| `API_VALIDATION_ERROR` | `API_EDGE_REJECTED` @422 | Mantener `API_EDGE_REJECTED` (Edge) + alias doc |
| `API_RATE_LIMITED` | `API_HTTP_ERROR` @429 | **Añadir** — alinea ERR-0506 |
| `API_SERVER_ERROR` | `API_HTTP_ERROR` @5xx | **Añadir** o conservar genérico + status |
| `API_BAD_RESPONSE` | `API_PARSE_ERROR` + business 200 | Cubrir con `API_PARSE_ERROR` + regla `{error}` en 200 |
| `API_UNKNOWN_ERROR` | `API_UNKNOWN` | Mantener `API_UNKNOWN` |

### Tabla canónica recomendada (post-implementación)

| code | Condición | HTTP status | retryable default | safe message | metadata permitida |
|------|-----------|-------------|-------------------|--------------|-------------------|
| `API_CANCELLED` | Abort user/logout/cancel | 0 | false | Request was cancelled. | none |
| `API_TIMEOUT` | Timer client o 408/504 | 0 o 408/504 | true (GET) | Request timed out. | none |
| `API_NETWORK` | Transport network fail | 0 | true (GET) | Network unavailable. | none |
| `API_HTTP_ERROR` | 4xx/5xx sin código dedicado | varies | por status | HTTP request failed. | `details` redacted |
| `API_EDGE_REJECTED` | Edge 422 / business reject | 422 | false | Edge rejected the request. | `error`, `detail` strings |
| `API_PARSE_ERROR` | JSON/body inválido | 0 | true | Response could not be parsed. | none |
| `API_INVALID_PAYLOAD` | Body request no serializable | 0 | false | Invalid request payload. | none |
| `API_RATE_LIMITED` | HTTP 429 | 429 | true (backoff) | Too many requests. | `retryAfter` si presente |
| `API_CONFIG_ERROR` | baseUrl/adaptador | 0 | false | API configuration error. | none |
| `API_UNKNOWN` | Fallback | varies | false | Unknown API error. | none |

**Códigos semánticos HTTP (fase 2 opcional):** `API_UNAUTHORIZED`, `API_FORBIDDEN`, `API_NOT_FOUND`, `API_CONFLICT`, `API_BAD_REQUEST` — pueden introducirse sin romper callers si `normalizeApiError()` también acepta inputs legacy.

---

## Alternativas evaluadas

### A. Error class canónica (`class ApiError extends Error`)

| Criterio | Evaluación |
|----------|------------|
| Acoplamiento | Bajo en MOD-005 |
| Encapsulación | Media — hoy `ApiResponse` no throw |
| Compatibilidad | `ApiClientError` ya existe pero no es path principal |
| Regresión | Alta si se migra de plain object a throw |

**Veredicto:** Rechazada como shape primario — mantener plain frozen object en `ApiResponse`.

### B. Facade única `normalizeApiError(input): ApiError`

| Criterio | Evaluación |
|----------|------------|
| Acoplamiento | Bajo — punto único para Fetch/Edge/RPC |
| Testabilidad | Alta — tabla entrada/salida |
| Arquitectura | Alineada con `API-ERRORS.md` y precedente `normalizeAuthError` |
| Costo | Medio — consolidar rutas en `errors.ts` |

**Veredicto:** **Recomendada (núcleo).**

### C. Granulares actuales + thin router `normalizeApiError`

| Criterio | Evaluación |
|----------|------------|
| Regresión | **Baja** — reutiliza funciones existentes |
| Migración | Incremental — `api-client.ts` delega al router |
| Deuda | Cierra gap sin reescribir `mapTransportException` |

**Veredicto:** **Recomendada (implementación)** — combinar con B.

### D. MOD-014 posee toda la normalización API

| Criterio | Evaluación |
|----------|------------|
| Frontera | Viola ticket — `normalizeApiError()` pertenece a MOD-005 |
| Acoplamiento | API Client dependería de Errors para producir `ApiError` |

**Veredicto:** Rechazada para producción de `ApiError`; MOD-014 solo consume `ApiError` → `NormalizedError` (ticket separado).

### E. Solo status HTTP sin códigos semánticos

| Criterio | Evaluación |
|----------|------------|
| Simplicidad | Alta |
| Retry/policy | Baja expresividad — `isRetryableError` ya usa code+status |
| FetchTransport | Insuficiente para red/timeout/cancel sin status |

**Veredicto:** Rechazada — mantener `ApiErrorCode` transport-level.

---

## Diseño recomendado

**Opción B + C** — una sola función facade en MOD-005:

### Propietario

`shared/api/runtime/errors.ts` — `normalizeApiError()`

### Firma conceptual (no implementar aquí)

```
normalizeApiError(input: {
  kind: 'transport' | 'http' | 'parse' | 'payload' | 'cancel' | 'timeout' | 'unknown';
  status?: number;
  bodyText?: string;
  parsedBody?: unknown;
  message?: string;
  signalReason?: string;
}): ApiError
```

### Comportamiento

1. Delega a funciones granulares existentes donde aplique.
2. Mapea HTTP 408/504 → `API_TIMEOUT` (cierra gap spec).
3. Mapea HTTP 429 → `API_RATE_LIMITED` (nuevo `ApiErrorCode` + ERR-0506).
4. Aplica `extractErrorDetails()` con redacción antes de `details`.
5. **No** transforma `API_CANCELLED` en `API_UNKNOWN`.
6. Calcula `retryable` vía `isRetryableError()` — campo opcional futuro en `ApiError` o solo en MOD-014 bridge.
7. `api-client.ts` reemplaza llamadas directas por `normalizeApiError()` gradualmente.

### Orden vs otros módulos

```
TransportPort → api-client.request()
  → normalizeApiError() [MOD-005]
  → ApiResponse { error: ApiError, metadata }
  → (futuro) MOD-014 normalizeApiErrorToGlobal(apiError) → NormalizedError
```

### Integración futura

| Consumidor | Contrato |
|------------|----------|
| FetchTransport | Lanza `Transport*Error` o devuelve status+body → mismo input facade |
| `invokeEdge()` | Path `/functions/v1/*` — HTTP + `API_EDGE_REJECTED` en 422 |
| `rpc()` | POST Supabase RPC — mismo parser HTTP |
| Supabase adapter | Implementa `TransportPort` — sin tipos Supabase en `ApiError` |

---

## Contrato conceptual `ApiError` (target)

| Campo | Público | Notas |
|-------|---------|-------|
| `code` | ✅ | `ApiErrorCode` transport-level |
| `message` | ✅ | Human-safe, sin stack |
| `status` | ✅ | HTTP cuando aplica; `0` transport-local |
| `details` | ✅ | Redactado; strings `error`/`detail` Edge |
| `retryable` | ○ futuro | Hint; hoy vía `isRetryableError()` |
| `errCode` | ○ MOD-014 | ERR-05xx — no producir en MOD-005 v1 |
| `requestId` | ❌ | Permanece en `ApiMetadata` |
| `correlationId` | ❌ | Permanece en `ApiMetadata` |
| `cause` | ❌ | Solo debug interno |
| `transportKind` | ❌ público | Opcional log interno |
| body crudo / headers | ❌ | Prohibido |

---

## Riesgos confirmados

| Riesgo | Clasificación |
|--------|---------------|
| Spec `API-ERRORS.md` promete campos no presentes en runtime (`errCode`, `retryable`) | **CONFIRMADO** |
| 429 sin `API_RATE_LIMITED` | **CONFIRMADO** |
| 408/504 HTTP no mapean a `API_TIMEOUT` | **CONFIRMADO** |
| `details` puede contener fragmentos de body sin redacción | **POSIBLE** |
| Dos `normalizeApiError` (MOD-005 vs MOD-014) sin naming claro | **POSIBLE** |
| MOD-014 bridge ausente | **CONFIRMADO** |

---

## Archivos potenciales (implementación futura)

### Necesarios

| Archivo | Cambio conceptual |
|---------|-------------------|
| `shared/api/runtime/errors.ts` | `normalizeApiError()` + `API_RATE_LIMITED` |
| `shared/api/runtime/types.ts` | Extender `ApiErrorCode` si aplica |
| `shared/api/runtime/api-client.ts` | Delegar normalización al facade |
| `tests/unit/api-client-foundation.test.ts` | Tabla status→code; 429; 408/504 |

### Posibles

| Archivo | Cambio |
|---------|--------|
| `shared/api/API-ERRORS.md` | Alinear spec con runtime post-impl |
| `shared/errors/runtime/api-normalize.ts` | Bridge MOD-014 (ticket separado) |

### Prohibidos

| Área | Razón |
|------|-------|
| Session / Auth imports en MOD-005 | Frontera |
| Runtime Registry | Sin coordinación errores |
| FetchTransport en mismo ticket | Secuencia PO |
| Supabase SDK en `ApiError` | Acoplamiento |
| UI / V1 | Fuera alcance |

### Tests futuros

| Escenario |
|-----------|
| `normalizeApiError` transport cancel vs timeout |
| HTTP 401/403/404/409/422/429/500/502/503/504 |
| Body `{ error, detail }` redacted |
| `API_CANCELLED` nunca retry |
| Business error HTTP 200 |
| Serializable/frozen shape |

---

## Matriz de pruebas futura

| # | Escenario | Esperado |
|---|-----------|----------|
| 1 | Network fail | `API_NETWORK`, status 0 |
| 2 | Client timeout | `API_TIMEOUT` |
| 3 | HTTP 504 | `API_TIMEOUT` |
| 4 | User abort | `API_CANCELLED` |
| 5 | Logout cancel | `API_CANCELLED` |
| 6 | HTTP 401 | `API_HTTP_ERROR` o `API_UNAUTHORIZED` |
| 7 | HTTP 429 | `API_RATE_LIMITED` |
| 8 | HTTP 422 Edge | `API_EDGE_REJECTED` |
| 9 | Invalid JSON | `API_PARSE_ERROR` |
| 10 | 200 + `{ error }` | `API_EDGE_REJECTED` o HTTP error |
| 11 | Sensitive body | `details` redacted |
| 12 | `normalizeApiError` idempotente | mismo input → mismo output |

---

## Criterios de aceptación (implementación futura — no autorizada)

1. Existe `normalizeApiError()` pública en MOD-005.
2. FetchTransport futuro puede usar solo el facade.
3. `API_CANCELLED` y `API_TIMEOUT` permanecen distintos.
4. HTTP 429 produce código rate-limit alineado ERR-0506.
5. Sin imports Session/Auth/Supabase en `errors.ts`.
6. Tests ≥ 479 baseline verdes + casos matriz.
7. Spec `API-ERRORS.md` coherente con runtime o ADR de divergencia.

---

## Fuera de alcance

- FetchTransport implementación
- Supabase adapter
- `invokeEdge()` / `rpc()`
- MOD-014 `NormalizedError` bridge
- UI
- Producción V1
- push / PR / merge / deploy

---

## Recomendación final

**Sí** — puede abrirse ticket acotado:

**`TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-IMPLEMENTATION-001`**

Secuencia PO recomendada: **normalizeApiError (MOD-005)** → tests → **después** FetchTransport → **después** bridge MOD-014.

---

*Discovery · HEAD `e7390b6e5d16f95ede02a0e241ea426bb87947d2` · 479/479 PASS · sin cambios runtime*
