# API-RETRY-TIMEOUT-RULES.md

**TICKET-V2-SHARED-CORE-010 — API Client Specification**

**Módulo:** MOD-005 · Timeout · Retry · Cancelación · Correlation ID  
**Versión:** 1.0

---

## 1. Timeout

### Defaults (Configuration override)

| Method class | Default `timeoutMs` | Config key |
|--------------|---------------------|------------|
| GET / HEAD | 15000 | `api.timeout.readMs` |
| POST / PUT / PATCH / DELETE | 30000 | `api.timeout.writeMs` |
| RPC | 15000 | `api.timeout.rpcMs` |
| EDGE | 30000 | `api.timeout.edgeMs` |

### Behavior

| Regla | Detalle |
|-------|---------|
| T-01 | Timer starts at fetch invoke |
| T-02 | Expiry → abort via `AbortController` |
| T-03 | Result → `API_TIMEOUT` / ERR-0502 |
| T-04 | **No hang infinito** — timeout mandatory |
| T-05 | Per-request override allowed; max ceiling 120s ADR |
| T-06 | Uploads large → separate ADR `api.timeout.uploadMs` |

### Entorno

| Env | Note |
|-----|------|
| local | may extend via config flag `api.debug.extendedTimeout` |
| staging | production parity |
| production | strict defaults |

---

## 2. Retry

### RetryPolicy shape

| Campo | Tipo | Default |
|-------|------|---------|
| `maxAttempts` | number | 3 |
| `backoffMs` | number[] | `[100, 300, 900]` |
| `retryOn` | ApiErrorCode[] | `[API_NETWORK, API_TIMEOUT]` + 429 |
| `jitter` | boolean | true ±20% |

### Eligibility matrix

| Condition | Retry allowed |
|-----------|---------------|
| GET / HEAD | ✅ default |
| RPC read-only ADR | ✅ |
| POST / PUT / PATCH / DELETE | ❌ unless `retrySafe: true` |
| Payment / checkout / Stripe | ❌ **never** auto-retry |
| 401 / 403 | ❌ |
| 404 | ❌ |
| 422 validation | ❌ |
| 500–599 on GET | ✅ |
| 500–599 on mutation | ❌ unless idempotency key ADR |

### Dangerous operations (explicit rule)

> **No retry automático en operaciones peligrosas sin regla explícita.**

| Operation tag | retrySafe required | Idempotency key |
|---------------|-------------------|-----------------|
| `checkout.create` | false | — |
| `payment.confirm` | false | — |
| `order.finalize` | false | — |
| `profile.update` | true + ADR | optional |
| `cart.sync` | true + ADR | recommended |

Tags via `ApiRequest.meta.operationTag` — catalog en ADR futuro.

### Backoff flow

```
attempt 1 → fail retryable
  → wait backoff[0] + jitter
attempt 2 → fail
  → wait backoff[1] + jitter
attempt 3 → fail
  → return final ApiResponse (ok: false, attempt: 3)
```

Log each retry at `warn` with correlationId — no body.

---

## 3. Cancelación

### Mechanisms

| Trigger | Action |
|---------|--------|
| `AbortSignal` caller | abort single request |
| `ApiClient.cancel(requestId)` | abort by id |
| `ApiClient.cancelAll()` | abort all in-flight |
| Session `SESSION_DESTROYED` / logout | **cancelAll** mandatory |
| Portal route unmount | caller abort pending |

### Cancel result

| Field | Value |
|-------|-------|
| ok | false |
| error.code | `API_CANCELLED` |
| error.errCode | ERR-0504 |
| retryable | false |

Cancelled requests **no** retry.

### In-flight registry

API Client mantiene `Map<requestId, AbortController>` — cleared on settle.

---

## 4. Correlation ID

### Propagation chain

```
Session (optional existing)
  → API Client generates if missing (UUID v4)
  → Header X-Correlation-Id on outbound
  → Logging every entry
  → ApiResponse.correlationId echo
  → Error Handling NormalizedError
  → Event Bus SYSTEM_ERROR payload
  → Support/debug tools (staff future)
```

### Rules

| # | Regla |
|---|-------|
| C-01 | One correlationId per user action chain recommended |
| C-02 | Retries **keep** same correlationId |
| C-03 | New requestId per attempt |
| C-04 | Never log correlationId with tokens in same entry |
| C-05 | Portals may pass via `meta.userActionId` — mapped by services layer |

---

## 5. Combined decision flow

```
Request received
  → inject headers + correlationId
  → register AbortController
  → attempt loop (1..maxAttempts)
      → fetch with timeout
      → if cancelled → API_CANCELLED exit
      → if timeout → retry if eligible
      → if HTTP error → parse body → retry if eligible
      → if ok → return success
  → normalize error → Error Handling
  → log durationMs + status (redacted)
```

---

## 6. Configuration keys (reference)

| Key | Purpose |
|-----|---------|
| `api.baseUrl` | Supabase project URL |
| `api.timeout.*` | See §1 |
| `api.retry.maxAttempts` | Global cap |
| `api.retry.backoffMs` | Override array |
| `api.adapters.enabled` | Feature flags per adapter |

---

## 7. Logging on retry/timeout

| Event | Level | Fields |
|-------|-------|--------|
| timeout | warn | requestId, correlationId, path, durationMs |
| retry | warn | attempt, code, backoffMs |
| exhausted | error | attempts, final code |
| cancel | info | requestId, reason |

No Authorization, no body.

---

*API-RETRY-TIMEOUT-RULES v1.0 — TICKET-V2-SHARED-CORE-010*
