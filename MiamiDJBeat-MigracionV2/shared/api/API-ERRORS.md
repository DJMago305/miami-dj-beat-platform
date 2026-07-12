# API-ERRORS.md

**TICKET-V2-SHARED-CORE-010 — API Client Specification**

**Módulo:** MOD-005 · Formato estándar de Error  
**Versión:** 1.0

---

## ApiError (estándar)

Presente en `ApiResponse.error` cuando `ok === false`.

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `code` | ApiErrorCode | ✅ | Transport-level code |
| `errCode` | string | ○ | Platform code ERR-05xx post-normalize |
| `message` | string | ○ | Human-safe optional (no stack) |
| `detail` | string | ○ | Edge `error` / `detail` — **obligatorio surfacing** al usuario vía i18n map |
| `status` | number | ○ | HTTP status |
| `retryable` | boolean | ○ | Hint for retry policy |
| `recoverable` | boolean | ○ | User can fix and retry |
| `correlationId` | string | ○ | Debug support |
| `requestId` | string | ○ | In-flight id |

---

## ApiErrorCode (transport)

| Code | HTTP / condición | ERR map |
|------|------------------|---------|
| `API_NETWORK` | fetch failed, offline, CORS block | ERR-0400 family → normalized |
| `API_HTTP_ERROR` | status not 2xx | ERR-0500 |
| `API_PARSE_ERROR` | invalid JSON/body | ERR-0501 |
| `API_TIMEOUT` | abort timeout | ERR-0502 |
| `API_EDGE_REJECTED` | Edge 4xx business reject | ERR-0503 |
| `API_CANCELLED` | AbortSignal user/logout | ERR-0504 (reserved) |
| `API_CONFIG_ERROR` | missing baseUrl / adapter | ERR-0505 (reserved) |

---

## Mapping HTTP status → behavior

| Status | ApiError.code | retryable default |
|--------|---------------|-------------------|
| 0 (network) | API_NETWORK | true (GET) |
| 408, 504 | API_TIMEOUT | true |
| 401 | API_HTTP_ERROR | false (→ Session refresh ADR) |
| 403 | API_HTTP_ERROR | false |
| 404 | API_HTTP_ERROR | false |
| 409 | API_HTTP_ERROR | false |
| 422 | API_EDGE_REJECTED | false |
| 429 | API_HTTP_ERROR | true (backoff) |
| 500–599 | API_HTTP_ERROR | true (GET only) |

401/403 **no** auto-retry salvo flow coordinado Session refresh (ADR Auth).

---

## Normalización → Error Handling

```
ApiResponse (ok: false)
  → ErrorHandling.normalizeApiError(apiError)
  → NormalizedError { errCode, severity, userMessageKey, retryable, correlationId }
  → optional Notifications via presentError()
  → Logging (redacted)
  → Event Bus SYSTEM_ERROR (internal, severity ≥ ERROR)
```

| ApiError.code | Normalized severity | userMessageKey namespace |
|---------------|---------------------|--------------------------|
| API_TIMEOUT | WARNING | `error.api.timeout` |
| API_PARSE_ERROR | ERROR | `error.api.parse` |
| API_EDGE_REJECTED | ERROR | `error.api.edge` + detail map |
| API_HTTP_ERROR | ERROR | `error.api.http.{status}` |
| API_NETWORK | WARNING | `error.network.unavailable` |
| API_CANCELLED | INFO | (suppress toast default) |
| API_INVALID_PAYLOAD | INFO (ERR-0800) | `error.api.invalid_payload` via `normalizeApiClientError()` |

**MOD-014 bridge v1** (`normalizeApiClientError`) maps only: `API_HTTP_ERROR`, `API_PARSE_ERROR`, `API_TIMEOUT`, `API_CANCELLED`, `API_INVALID_PAYLOAD`. Other `ApiErrorCode` values fall back to `ERR-0999` until a future ticket authorizes them.

---

## Edge error surfacing (regla crítica)

HTTP ≠ 200 **o** body `{ error }`:

1. Parse `error` y `detail` del body.
2. Nunca asumir `{ url }` u otro success shape.
3. Pasar `detail` a Error Handling — **no** raw body a UI.
4. Log solo status + codes — no full body prod.

---

## Prohibiciones en ApiError

| Prohibido | Motivo |
|-----------|--------|
| Stack traces | N-04 Notifications / security |
| SQL fragments | N-03 |
| Tokens / JWT raw | Security |
| service_role hints | Client leak |
| PII de terceros | Privacy |
| RLS policy text | Info disclosure |

---

## ERR-0500–0599 catalog (API Client authority)

| Código | Nombre | Severity | Recovery |
|--------|--------|----------|----------|
| ERR-0500 | API_HTTP_ERROR | ERROR | varies |
| ERR-0501 | API_PARSE_ERROR | ERROR | retryable |
| ERR-0502 | API_TIMEOUT | WARNING | retryable |
| ERR-0503 | API_EDGE_REJECTED | ERROR | recoverable |
| ERR-0504 | API_CANCELLED | INFO | none |
| ERR-0505 | API_CONFIG_ERROR | CRITICAL | none |
| ERR-0506 | API_RATE_LIMITED | WARNING | retryable |
| ERR-0507 | API_ADAPTER_UNKNOWN | CRITICAL | none |

Extensiones 0508–0599 vía ADR; no inventar en runtime sin catalog update.

---

## Dangerous operations error rule

Mutations que fallan mid-flight:

- **No** auto-retry unless `retrySafe: true` + idempotency key ADR.
- Surface `recoverable: false` por default en POST payment/checkout.

---

*API-ERRORS v1.0 — TICKET-V2-SHARED-CORE-010*
