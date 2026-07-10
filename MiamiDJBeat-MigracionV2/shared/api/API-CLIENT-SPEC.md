# API-CLIENT-SPEC.md

**TICKET-V2-SHARED-CORE-010 — API Client Specification**

**Módulo:** MOD-005 API Client  
**Ticket:** TICKET-V2-SHARED-CORE-010  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Capa **única** de comunicación entre V2 Shared Core y servicios externos / endpoints futuros.  
> Transporta requests y responses **normalizados**. No autentica, no decide permisos, no renderiza UI.

---

## 1. Responsabilidad del módulo

| Hace | No hace |
|------|---------|
| Normaliza Request / Response / Error | **No autentica** (Auth inyecta bearer vía Session) |
| Aplica timeout, retry, cancelación | **No decide permisos** (Permissions upstream) |
| Propaga `correlationId` | **No renderiza UI** (→ Notifications vía Error Handling) |
| Mapea HTTP/RPC/Edge → `ApiError` → Error Handling | **No guarda secretos** (→ Configuration refs only) |
| Log estructurado redactado | **No habla directamente con portales** |
| Reserva adapters futuros (Supabase, Stripe, …) | **No SQL directo** desde consumidores |

**Autoridad de transporte:** todo egress HTTP/RPC/Edge del Shared Core pasa por este módulo.

---

## 2–4. Contratos

| Documento | Contenido |
|-----------|-----------|
| **REQUEST-RESPONSE-CONTRACT.md** | Request + Response estándar |
| **API-ERRORS.md** | Error estándar + mapping ERR-05xx |
| **API-RETRY-TIMEOUT-RULES.md** | Timeout, retry, cancelación, correlationId |

---

## 5–8. Operación transversal

Detalle completo en **API-RETRY-TIMEOUT-RULES.md**:

| Tema | Resumen |
|------|---------|
| **Timeout** | Default 30s Edge · 15s RPC · configurable vía Configuration |
| **Retry** | Idempotent GET / `retrySafe: true` only · backoff 100→300→900ms · max 3 |
| **Cancelación** | `AbortSignal` por request · logout cancela in-flight |
| **Correlation ID** | UUID v4 · header `X-Correlation-Id` · Session → API → Logging → Error |

---

## 9. Relación con otros módulos

| Módulo | Relación | Dirección |
|--------|----------|-----------|
| **Configuration** MOD-006 | base URLs, timeout defaults, env flags | Config → API Client |
| **Session** MOD-002 | bearer token ref, sessionId, logout cancel | Session → API Client (read-only token) |
| **Permissions** MOD-003 | **no** gate en API Client; caller validates capability | Permissions ⊥ API Client |
| **Logging** MOD-010 | HTTP meta redacted post-request | API Client → Logging |
| **Error Handling** MOD-014 | `ApiError` → `NormalizedError` ERR-05xx | API Client → Errors |
| **Event Bus** MOD-004 | `SYSTEM_ERROR` on fatal transport (optional internal metrics ADR) | API Client → Event Bus |
| **Notifications** MOD-011 | **no** direct; Errors → optional toast | unidirectional |

**Orden init (runtime):** Configuration → Logging → Event Bus → Session → Permissions → Error Handling → **API Client**

---

## 10. Reglas operativas

| # | Regla |
|---|-------|
| A-01 | API Client **NO autentica** — recibe token ya resuelto por Auth/Session |
| A-02 | API Client **NO decide permisos** — caller debe `hasCapability()` antes de invoke |
| A-03 | API Client **NO renderiza UI** |
| A-04 | API Client **NO guarda secretos** — keys vía Configuration runtime injection |
| A-05 | API Client **NO habla directamente con portales** — solo Shared Core / services layer |
| A-06 | Solo transporta requests/responses **normalizados** |
| A-07 | HTTP ≠ 200 → **nunca** asumir shape success (`{ url }`, etc.) sin validar |
| A-08 | URLs sin prefijo `/web/` — deploy root desde Configuration |
| A-09 | Edge body errors: surface `error` + `detail` al Error Handling |
| A-10 | Una instancia factory por portal shell — no singleton global cross-portal |

---

## 11. Seguridad

| Regla | Detalle |
|-------|---------|
| No tokens en logs | Authorization header redacted — LOG-REDACTION-RULES |
| No service role en client | **Prohibido** — browser/client solo anon/user JWT |
| Datos sensibles redactados | Request/response body keys en deny list antes de log |
| No retry peligroso | POST/PUT/PATCH/DELETE sin `retrySafe: true` explícito ADR |
| TLS only | production/staging — no plain HTTP |
| CORS | server concern; client no bypass |

---

## 12. Preparación futura (adapters — spec only)

| Backend | Adapter | Notas |
|---------|---------|-------|
| **Supabase client** | `SupabaseRestAdapter` | REST + RPC wrapper; anon key from Config |
| **Edge Functions** | `EdgeInvokeAdapter` | POST `/functions/v1/{name}`; parse error/detail |
| **Stripe endpoints** | `StripeProxyAdapter` | **Nunca** secret key client — solo Checkout Session via Edge |
| **Internal API** | `InternalApiAdapter` | Staff/manager routes futuras; same error contract |
| **External API** | `ExternalApiAdapter` | Third-party con allowlist host en Config |

Todos los adapters implementan el mismo contrato `ApiRequest` → `ApiResponse`.

---

## Facade API (conceptual — runtime futuro)

```
createApiClient(config, sessionReader) → ApiClient

ApiClient.request(spec: ApiRequest): Promise<ApiResponse>
ApiClient.invokeEdge(name, body, opts?): Promise<ApiResponse>
ApiClient.rpc(fn, params, opts?): Promise<ApiResponse>
ApiClient.cancel(requestId): void
ApiClient.cancelAll(): void  // logout hook
```

Portales **no** importan `ApiClient` — consumen vía domain services en `shared/services/` (ticket futuro).

---

## Prevención dependencias circulares

```
Configuration ──→ API Client ──→ Logging
                      │
                      ├──→ Error Handling ──→ Notifications
Session ──→ (token read) API Client
Auth ──→ Session (not API Client direct)

PROHIBIDO: API Client → Portal, API Client → Auth, API Client → Notifications
```

---

## Referencias

- `REQUEST-RESPONSE-CONTRACT.md`
- `API-ERRORS.md`
- `API-RETRY-TIMEOUT-RULES.md`
- `../CONTRACTS.md` §5
- `../errors/ERROR-CATALOG.md` ERR-0500–0599
- `../logging/LOG-REDACTION-RULES.md`

---

*API-CLIENT-SPEC v1.0 — TICKET-V2-SHARED-CORE-010*
