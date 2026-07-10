# REQUEST-RESPONSE-CONTRACT.md

**TICKET-V2-SHARED-CORE-010 — API Client Specification**

**Módulo:** MOD-005 · Contratos Request / Response  
**Versión:** 1.0

---

## Principio

Todo egress del Shared Core usa **exactamente** estos shapes. Adapters internos (Supabase, Edge, Stripe proxy) normalizan al contrato antes de retornar al caller.

---

## ApiRequest (estándar)

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `requestId` | string (UUID) | ✅ | Id único in-flight |
| `method` | enum | ✅ | `GET` \| `POST` \| `PUT` \| `PATCH` \| `DELETE` \| `RPC` \| `EDGE` |
| `path` | string | ✅ | Path relativo sin host; sin `/web/` prefix |
| `baseUrl` | string | ○ | Override; default desde Configuration |
| `headers` | Record<string, string> | ○ | Caller no incluye Authorization — API Client inyecta desde Session |
| `query` | Record<string, string \| number \| boolean> | ○ | Serializado URL-safe |
| `body` | JSON-serializable \| FormData | ○ | Omitido en GET |
| `timeoutMs` | number | ○ | Default config por method class |
| `retryPolicy` | RetryPolicy | ○ | Ver API-RETRY-TIMEOUT-RULES |
| `retrySafe` | boolean | ○ | Required true para retry en mutating methods |
| `correlationId` | string (UUID) | ○ | Propagado; generado si ausente |
| `signal` | AbortSignal | ○ | Cancelación |
| `adapter` | enum | ○ | `supabase` \| `edge` \| `stripe-proxy` \| `internal` \| `external` — default inferido |
| `meta` | Record | ○ | Opaque tags para logging (portal, feature) — no secrets |

### Method class defaults

| Class | Methods | Default timeoutMs |
|-------|---------|-------------------|
| Read | GET, HEAD | 15000 |
| Write | POST, PUT, PATCH, DELETE | 30000 |
| RPC | RPC | 15000 |
| Edge | EDGE | 30000 |

---

## Headers inyectados por API Client (no en caller body)

| Header | Fuente |
|--------|--------|
| `Authorization` | Session bearer (redacted in logs) |
| `Content-Type` | `application/json` unless FormData |
| `X-Correlation-Id` | `correlationId` |
| `X-Request-Id` | `requestId` |
| `X-Client-Portal` | `client` \| `artist` \| `staff` (from meta) |

Caller **prohibido** sobrescribir Authorization con secretos hardcoded.

---

## ApiResponse (estándar)

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `ok` | boolean | ✅ | `true` iff HTTP 2xx y parse success |
| `status` | number | ✅ | HTTP status code (0 si network fail) |
| `data` | unknown | ○ | Parsed body cuando `ok === true` |
| `error` | ApiError | ○ | Presente cuando `ok === false` |
| `headers` | Record<string, string> | ○ | Response headers safe subset |
| `durationMs` | number | ✅ | Round-trip timing |
| `requestId` | string | ✅ | Echo request |
| `correlationId` | string | ✅ | Echo correlation |
| `attempt` | number | ○ | 1-based retry attempt count |
| `adapter` | string | ○ | Adapter used |

### Success validation

```
ok = (status >= 200 && status < 300) && parseOk && !businessErrorFlag
```

Edge puede retornar HTTP 200 con `{ error: "..." }` → API Client fuerza `ok: false`.

---

## Response body parsing

| Content-Type | Behavior |
|--------------|----------|
| `application/json` | JSON.parse → `data` |
| `text/*` | string en `data.text` |
| empty | `data: null` |
| parse fail | `ok: false`, error `API_PARSE` → ERR-0501 |

---

## Edge Function invoke shape

**Request shortcut:**

| Campo | Valor |
|-------|-------|
| `method` | `EDGE` |
| `path` | `/functions/v1/{functionName}` |
| `body` | JSON payload |

**Expected error body (Edge convention):**

```json
{ "error": "human or code", "detail": "optional detail" }
```

Ambos campos pasan a `ApiError.detail` redacted.

---

## RPC invoke shape

| Campo | Valor |
|-------|-------|
| `method` | `RPC` |
| `path` | `/rest/v1/rpc/{functionName}` |
| `body` | params object |

---

## Ejemplos conceptuales (no código runtime)

### GET success

| Field | Value |
|-------|-------|
| ok | true |
| status | 200 |
| data | `{ "items": [...] }` |
| durationMs | 142 |

### Edge rejection

| Field | Value |
|-------|-------|
| ok | false |
| status | 400 |
| error.code | `API_EDGE_REJECTED` |
| error.detail | from body.detail |

---

## Versionado

| Campo | Regla |
|-------|-------|
| Contract version | `v1` implicit in spec |
| Breaking change | ADR + bump major in runtime module |

---

*REQUEST-RESPONSE-CONTRACT v1.0 — TICKET-V2-SHARED-CORE-010*
