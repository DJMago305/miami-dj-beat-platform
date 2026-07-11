# TICKET-V2-PHASE-6-INVOKE-EDGE-DISCOVERY-001

## Estado

**DISCOVERY COMPLETADO — IMPLEMENTACIÓN NO AUTORIZADA**

| Campo | Valor |
|-------|-------|
| Modo | Solo lectura de código + documentación en `docs/V2/**` |
| Fecha discovery | 2026-07-11 |
| Rama analizada | `plan/v2-phase-4-api-client` |
| HEAD analizado | `6dbf8d00c82e372a569abcd2481881b7390aa2b5` — `feat(v2-api): wire fetch transport through canonical config` |
| Suite baseline | **509/509 PASS** · **46/46 files** |
| `invokeEdge()` runtime | ❌ **AUSENTE** — solo spec + `post('/functions/v1/...')` genérico |
| Transport productivo en boot | `memory` por defecto · `fetch` vía `getConfig().api.transportMode` |
| Autorización PO | Discovery únicamente — sin runtime, tests, commit, push, PR, merge, preview ni deploy |

---

## Problema

MOD-005 ya puede ejecutar HTTP vía `request()` / `post()` sobre paths arbitrarios (incl. `/functions/v1/*`), con `normalizeApiError()` y `FetchTransport` cableado al contrato MOD-006. **No existe** el facade dedicado `invokeEdge(name, body)` prometido en `API-CLIENT-SPEC.md`.

V1 invoca ~20 Edge Functions con `fetch()` directo o `mdbSupabaseFunctionUrl()` + headers manuales, sin contrato unificado ni cancelación centralizada. Antes de migrar dominios (checkout, billing, staff) a V2, hace falta definir **`invokeEdge()`** como wrapper mínimo sobre `request()` — sin duplicar transport, retry, timeout, Session ni normalización.

---

## Evidencia actual (MOD-005 runtime)

| Archivo | Símbolo | Evidencia |
|---------|---------|-----------|
| `shared/api/API-CLIENT-SPEC.md` | `invokeEdge(name, body, opts?)` | Facade conceptual — **sin implementación** |
| `shared/api/REQUEST-RESPONSE-CONTRACT.md` | Edge invoke shape | `method: EDGE`, `path: /functions/v1/{name}`, body JSON |
| `shared/api/API-ERRORS.md` | `API_EDGE_REJECTED` | Edge 4xx business reject → ERR-0503 |
| `shared/api/API-RETRY-TIMEOUT-RULES.md` | EDGE timeout | Default **30000ms** — key `api.timeout.edgeMs` (spec; **no** en `AppConfig` hoy) |
| `shared/api/runtime/types.ts` | `ApiClientPublicApi` | `request/get/post/put/delete/cancel/cancelAll` — **sin** `invokeEdge` |
| `shared/api/runtime/api-client.ts` | `createApiClient()` | Frozen facade sin `invokeEdge` |
| `shared/api/runtime/api-client.ts` | `buildHeaders()` | `Authorization` desde `SessionReaderPort`; `X-Correlation-Id`, `X-Request-Id`, `X-Client-Portal` |
| `shared/api/runtime/api-client.ts` | `resolveClientConfig()` | Solo extrae `baseUrl` de `AppConfig` — **no** usa `api.anonKey` |
| `shared/api/runtime/errors.ts` | `normalizeHttpStatusError()` | **422** → `API_EDGE_REJECTED`; HTTP **200** + `{ error: string }` → `API_EDGE_REJECTED` |
| `shared/api/runtime/errors.ts` | `extractErrorDetails()` | Lee `error` + `detail`/`details` del body Edge |
| `shared/api/runtime/request-pipeline.ts` | `resolveTimeoutMs()` | POST default **30s** (coincide con spec EDGE); sin rama `EDGE` explícita |
| `shared/api/runtime/request-pipeline.ts` | `buildUrl()` | `{publicUrl}/functions/v1/{name}` válido |
| `bootstrap/initialize-api.ts` | `createBootTransport()` | Lee `getConfig().api.transportMode` |
| `shared/config/runtime/types.ts` | `api.publicUrl`, `api.anonKey` | Anon key en config — **no** cableada a headers API Client |
| `tests/unit/api-client-foundation.test.ts` | `/functions/v1/*` | 422, business-200, 400 mapeados vía `post()` genérico |
| `shared/services/README.md` | domain services | Sin consumidores V2 de Edge aún |

**Búsqueda `invokeEdge` en `MiamiDJBeat-MigracionV2/`:** **0** implementaciones runtime (solo spec + auth contract).

---

## Evidencia V1 (patrones a migrar)

| Archivo | Patrón | Notas |
|---------|--------|-------|
| `web/supabase-config.js` | `mdbSupabaseFunctionUrl(name)` | `{MDB_SUPABASE_URL}/functions/v1/{name}` — análogo a `buildUrl(publicUrl, '/functions/v1/'+name)` |
| `web/supabase-config.js` | `mdjSupabaseAnonInvokeHeaders()` | `Authorization: Bearer {anon}`, `apikey: {anon}`, `Content-Type: application/json` |
| `web/courses.html` | `fetch(fnCourse, { method:'POST', headers: anonHeaders, body })` | Checkout guest — anon bearer + apikey |
| `web/admin-dashboard.html` | `fetch(.../create-platform-account, { Authorization: Bearer {userJwt} })` | Staff autenticado — **sin** `apikey` explícito |
| `web/client-portal.js` | `mdbSupabaseFunctionUrl('create-event-payment')` | Pagos evento |
| `web/js/production-module.js` | `staff-create-client-account`, `create-event-payment` | Staff producción |
| `web/auth.js` | `notify-new-device-login`, `send-subscription-welcome` | Post-login / welcome |
| V1 error handling | `!res.ok \|\| data.error` | Manual — no `ApiResponse` ni `API_EDGE_REJECTED` |

### Edge Functions desplegadas en repo (`supabase/functions/` — 30)

`admin-update`, `booth-chat`, `booth-tts`, `create-buyer-billing-portal`, `create-checkout`, `create-course-checkout`, `create-event-payment`, `create-platform-account`, `create-sft-tip-checkout`, `get-buyer-payment-methods`, `mdj-activate`, `mdj-heartbeat`, `mdjpro-activate-handoff`, `mdjpro-install-handoff`, `notify-account-profile-change`, `notify-dj-assignment`, `notify-dj-sms`, `notify-event-note`, `notify-new-device-login`, `notify-new-lead`, `notify-photo-rejection`, `notify-portal-message`, `register-sft-fan-request`, `send-certificate`, `send-marketing-campaign`, `send-sft-client-sms`, `send-subscription-welcome`, `settle-sft-manual-platform-fee`, `staff-create-client-account`, `stripe-webhook`, `verify-client-billing-unlock`

### V1 — funciones referenciadas desde browser (subset activo UI)

`create-checkout`, `create-course-checkout`, `create-event-payment`, `create-platform-account`, `create-portal-session`*, `staff-create-client-account`, `verify-client-billing-unlock`, `notify-*`, `send-marketing-campaign`, `admin-update`, `booth-tts`, `booth-chat`*

\* `create-portal-session` referenciado en V1 pero **no** aparece en `supabase/functions/` del repo — posible función remota / legacy / renombrada.

### Convención de respuesta Edge (muestra `create-checkout`)

| Caso | Status | Body típico |
|------|--------|-------------|
| Sin JWT | 401 | `{ "error": "No authorization token" }` |
| JWT inválido | 401 | `{ "error": "Unauthorized", "detail": "..." }` |
| Rate limit | 429 | `{ "error": "Too many requests..." }` |
| Validación negocio | 400/422 | `{ "error": "...", "detail": "..." }` |
| Éxito checkout | 200 | `{ "ok": true, "url": "https://checkout.stripe.com/..." }` |
| Éxito genérico | 200 | shape variable por función |

CORS: manejado en cada Edge Function (`Access-Control-Allow-Origin`, `authorization, x-client-info, apikey, content-type`).

---

## Respuestas obligatorias (16 preguntas)

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 1 | ¿Existe `invokeEdge()` en runtime V2? | **No** — solo en `API-CLIENT-SPEC.md` |
| 2 | ¿Se puede invocar Edge hoy sin `invokeEdge()`? | **Sí** — `getApiClient().post('/functions/v1/{name}', body)` sobre `MemoryTransport` o `FetchTransport` |
| 3 | ¿Path canónico? | **POST** `{api.publicUrl}/functions/v1/{functionName}` — sin slash inicial en `name` |
| 4 | ¿Quién construye URL? | **API Client** — `buildUrl(baseUrl, path)`; `baseUrl` = `config.api.publicUrl` |
| 5 | ¿Headers Supabase requeridos? | V1 usa `Content-Type: application/json` + `Authorization` (user JWT **o** anon bearer) + frecuentemente `apikey` (anon). V2 **solo** inyecta `Authorization` vía Session — **no** `apikey` ni anon fallback |
| 6 | ¿`api.anonKey` en MOD-006 se usa en API Client? | **No** — presente en `AppConfig` pero `resolveClientConfig()` ignora `anonKey` |
| 7 | ¿Mapeo errores Edge en runtime? | **Parcial** — 422 + business `{error}` en 200 → `API_EDGE_REJECTED`; 401/400/403/404 → `API_HTTP_ERROR`; 429 → `API_RATE_LIMITED` |
| 8 | ¿Spec vs runtime en status Edge reject? | **DISCREPANCIA** — `REQUEST-RESPONSE-CONTRACT` ejemplo status **400** + `API_EDGE_REJECTED`; runtime mapea **400** → `API_HTTP_ERROR` (solo **422** explícito) |
| 9 | ¿Timeout Edge? | Spec **30s**; runtime POST ya default **30s** vía `resolveTimeoutMs` — equivalente funcional, sin key `api.timeout.edgeMs` en config |
| 10 | ¿Retry en invoke Edge? | **No** por defecto — POST sin `retrySafe: true`; `API_EDGE_REJECTED` / 422 no retryable (`isRetryableError`) |
| 11 | ¿Cancelación / logout? | **Sí** — `cancelAll()` en bootstrap ya cableado; `invokeEdge` heredaría vía `request()` |
| 12 | ¿Diferencia `invokeEdge` vs `rpc()`? | Edge → `/functions/v1/{name}` POST JSON; RPC → `/rest/v1/rpc/{fn}` POST params — **mismo** `TransportPort`, tickets separados |
| 13 | ¿Adaptador `EdgeInvokeAdapter` vs método facade? | Spec menciona adapter; implementación mínima recomendada: **método** `invokeEdge()` en `ApiClient` (thin wrapper) — sin clase adapter separada en v1 |
| 14 | ¿Consumidores V2 actuales? | **Ninguno** — `shared/services/` vacío de implementación |
| 15 | ¿Tests sin red para invokeEdge? | Patrón existente: `MemoryTransport.enqueue()` + `post('/functions/v1/...')`; futuro: assert path/method/headers en `transport.calls` |
| 16 | ¿Secuencia PO post-discovery? | **`invokeEdge()` implementation** → tests unit → (opcional) `apikey`/anon header policy → domain services → bootstrap egress con `transportMode=fetch` en entornos autorizados |

---

## Matriz de responsabilidades (propuesta `invokeEdge` v1)

| Responsabilidad | Propietario | Hoy |
|-----------------|-------------|-----|
| Path `/functions/v1/{name}` | **`invokeEdge()`** wrapper | Caller arma path manualmente |
| Sanitizar `name` (no `..`, no URL absoluta) | **`invokeEdge()`** | ❌ |
| Método HTTP POST | **`invokeEdge()`** | Caller usa `post()` |
| Body JSON | **API Client** `serializeBody` | ✅ |
| `Authorization` (session JWT) | **API Client** `buildHeaders` + Session | ✅ si sesión activa |
| `apikey` + anon `Authorization` (guest) | **Gap** — candidato `invokeEdge` o `buildSupabaseHeaders` | ❌ en V2 |
| Timeout 30s Edge | **API Client** `resolveTimeoutMs` POST | ✅ implícito |
| Retry | **API Client** | POST sin retry por defecto ✅ |
| Transport wire | **FetchTransport** / MemoryTransport | ✅ |
| `error`/`detail` → `ApiError.details` | **normalizeApiError** | ✅ |
| 422 / business-200 → `API_EDGE_REJECTED` | **normalizeApiError** | ✅ |
| UI / checkout redirect | **Portal / domain service** — **no** API Client | V1 hace `window.location` en caller |

---

## Matriz de escenarios Edge

| Escenario | V1 hoy | V2 con `post()` genérico | `invokeEdge()` esperado |
|-----------|--------|--------------------------|-------------------------|
| Usuario autenticado | `Bearer {access_token}` | SessionReader → Authorization | Igual |
| Guest / checkout público | `mdjSupabaseAnonInvokeHeaders()` | Sin Authorization si no hay sesión — **falla JWT gate** | Debe policy anon (ver gap) |
| Edge 401 sin token | `throw Error(data.error)` | `API_HTTP_ERROR` 401 | Igual — caller decide re-login |
| Edge 422 validación | manual | `API_EDGE_REJECTED` | Igual |
| Edge 200 `{ error: "..." }` | `data.error` check | `API_EDGE_REJECTED` | Igual |
| Edge 200 `{ ok:true, url }` | redirect caller | `ok: true`, `data` tipado | Igual |
| Edge 429 | manual | `API_RATE_LIMITED` | Igual |
| CORS failure | alert genérico | `API_NETWORK` | Igual |
| Logout mid-flight | sin cancel central | `cancelAll()` → `API_CANCELLED` | Igual |
| `stripe-webhook` | server-only | **Fuera de alcance** browser | N/A |

---

## Arquitectura actual vs target

```
HOY (sin invokeEdge)
────────────────────
Portal / test
  → getApiClient().post('/functions/v1/create-checkout', body)
  → ApiClient.request()
  → TransportPort.execute()
  → normalizeApiError() / ApiResponse

TARGET (invokeEdge v1)
──────────────────────
Domain service / portal adapter
  → getApiClient().invokeEdge('create-checkout', body, opts?)
  → ApiClient.request({ method:'POST', path:'/functions/v1/create-checkout', ... })
  → (opcional) headers Supabase: apikey + anon Authorization policy
  → mismo pipeline transport + errors
```

---

## API mínima propuesta (implementación futura — no autorizada)

```ts
type InvokeEdgeOptions = Omit<ApiRequestOptions, 'path' | 'method' | 'body'> & {
  /** When true and no session JWT, use anon key for Authorization + apikey (Supabase guest invoke). */
  readonly allowAnon?: boolean;
};

invokeEdge<T>(
  functionName: string,
  body?: unknown,
  options?: InvokeEdgeOptions,
): Promise<ApiResponse<T>>;
```

| Regla | Valor |
|-------|-------|
| HTTP method | `POST` fijo |
| Path | `/functions/v1/${sanitizeEdgeFunctionName(functionName)}` |
| Default `timeoutMs` | `30_000` (o override explícito) |
| Default `retrySafe` | `false` |
| `sanitizeEdgeFunctionName` | Rechazar vacío, `/`, `..`, URLs absolutas; trim slashes |

### Política headers Supabase (decisión PO requerida)

| Modo | Authorization | apikey |
|------|---------------|--------|
| Sesión activa | `Bearer {userJwt}` (Session) | `{anonKey}` desde `getConfig().api.anonKey` |
| `allowAnon: true` sin sesión | `Bearer {anonKey}` | `{anonKey}` |
| Sin sesión y sin `allowAnon` | Sin Authorization | `{anonKey}` mínimo gateway — **validar contra Supabase real en ticket QA** |

---

## Archivos potenciales (implementación futura)

### Necesarios

| Archivo | Cambio conceptual |
|---------|-------------------|
| `shared/api/runtime/types.ts` | `InvokeEdgeOptions`; extender `ApiClientPublicApi` |
| `shared/api/runtime/api-client.ts` | `invokeEdge()` + export en `createApiClient` |
| `shared/api/runtime/index.ts` | Re-export si aplica |
| `tests/unit/api-client-foundation.test.ts` | Path, headers, 422, business-200, sanitización nombre |
| `tests/unit/invoke-edge.test.ts` | Opcional — suite dedicada si crece |

### Posibles

| Archivo | Cambio |
|---------|--------|
| `shared/api/runtime/request-pipeline.ts` | `sanitizeEdgeFunctionName()` |
| `shared/api/runtime/api-client.ts` | `buildSupabaseInvokeHeaders()` usando `anonKey` |
| `shared/config/runtime/types.ts` | `api.timeout.edgeMs` si PO exige config explícita |
| `shared/api/API-CLIENT-SPEC.md` | Alinear ejemplo status 400 vs 422 post-impl |

### Prohibidos (mismo ticket)

| Área | Razón |
|------|-------|
| `rpc()` runtime | Ticket separado |
| Supabase JS SDK en API Client | Acoplamiento — HTTP plano |
| Domain services con checkout real | Después de facade |
| UI / V1 / `web/**` | Fuera alcance V2 |
| Egress HTTP en CI | Stub transport only |
| MOD-014 bridge | Ticket separado |
| Session / Auth internals | Solo lectura headers existente |

---

## Riesgos confirmados

| Riesgo | Clasificación |
|--------|---------------|
| `invokeEdge()` ausente — callers deben conocer path Supabase | **CONFIRMADO** |
| `api.anonKey` no cableada a headers | **CONFIRMADO** — bloquea paridad guest V1 |
| V1 inconsistente: algunos fetch sin `apikey` | **CONFIRMADO** — validar en QA con FetchTransport |
| Spec 400 → `API_EDGE_REJECTED` vs runtime 400 → `API_HTTP_ERROR` | **CONFIRMADO** — muchas Edge devuelven 400 con `{error}` |
| `create-portal-session` referenciada en V1 sin función en repo | **CONFIRMADO** — deuda inventario |
| Checkout V1 asume `{ ok, url }` sin validar HTTP status primero | **CONFIRMADO** — V2 es más estricto (`ok` solo 2xx sin business flag) |
| CORS / mixed content en browser | **POSIBLE** — URLs desde `MDJ_V2_API_PUBLIC_URL` |
| Secretos en body Edge | **POSIBLE** — redacción logs ya cubre `apikey`/`authorization` |

---

## Criterios de aceptación (implementación futura — no autorizada)

1. Existe `invokeEdge(name, body, opts?)` en `ApiClientPublicApi` frozen facade.
2. Implementación es **thin wrapper** sobre `request()` — sin lógica retry/timeout/transport duplicada.
3. Nombre de función sanitizado; path siempre `/functions/v1/{name}`.
4. Tests unitarios sin red (MemoryTransport) cubren éxito, 422, business-200, nombre inválido.
5. Suite ≥ **509** baseline verde + tests nuevos.
6. Política headers Supabase documentada y testeada (sesión vs anon).
7. Session / Auth / Transport / Registry **sin** imports nuevos cruzados prohibidos.

---

## Fuera de alcance

- Implementación `invokeEdge()` runtime
- `rpc()` runtime
- Domain services (checkout, billing, staff)
- Migración V1 `fetch()` → V2
- Bootstrap cambio default `transportMode` a `fetch`
- MOD-014 `normalizeApiErrorToGlobal`
- push / PR / merge / deploy
- Tráfico HTTP real / QA contra Supabase prod

---

## Secuencia PO recomendada

```
invokeEdge DISCOVERY (este ticket)
  → invokeEdge IMPLEMENTATION
  → header policy (anonKey / apikey) si PO aprueba
  → rpc() DISCOVERY + IMPLEMENTATION
  → domain services (checkout, payments)
  → egress fetch en entornos no-lab (ticket wiring prod)
  → MOD-014 bridge
```

---

## Referencias

- `docs/V2/TICKETS/TICKET-V2-PHASE-6-FETCH-TRANSPORT-DISCOVERY-001.md`
- `docs/V2/TICKETS/TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-DISCOVERY-001.md`
- `MiamiDJBeat-MigracionV2/shared/api/API-CLIENT-SPEC.md`
- `MiamiDJBeat-MigracionV2/shared/api/REQUEST-RESPONSE-CONTRACT.md`
- `web/supabase-config.js` — `mdbSupabaseFunctionUrl`, `mdjSupabaseAnonInvokeHeaders`

---

*Discovery cerrado 2026-07-11 — TICKET-V2-PHASE-6-INVOKE-EDGE-DISCOVERY-001 — implementación no autorizada.*
