# TICKET-V2-PHASE-6-FETCH-TRANSPORT-DISCOVERY-001

## Estado

**DISCOVERY COMPLETADO — IMPLEMENTACIÓN NO AUTORIZADA**

| Campo | Valor |
|-------|-------|
| Modo | Solo lectura de código + documentación en `docs/V2/**` |
| Fecha discovery | 2026-07-11 |
| Rama analizada | `plan/v2-phase-4-api-client` |
| HEAD analizado | `b83e06f64819d3fda76bfcab5d691aba268d1f27` — `docs(v2-api): close canonical api error normalization` |
| Commit normalizeApiError | `24b7da8` — `feat(v2-api): add canonical api error normalization` |
| Suite baseline | **491/491 PASS** · **45/45 files** |
| Transport productivo en boot | ❌ `MemoryTransport` únicamente |
| Autorización PO | Discovery únicamente — sin runtime, tests, commit, push, PR, merge, preview ni deploy |

---

## Problema

MOD-005 ya define un **port de transporte** (`TransportPort`) y un cliente que orquesta retry, timeout, cancelación y normalización, pero **no existe** implementación HTTP real con `fetch()`. Bootstrap inyecta `MemoryTransport` — cola FIFO sin red.

Antes de `invokeEdge()`, `rpc()`, adaptador Supabase o egress productivo, hace falta definir **FetchTransport** como implementación canónica del port existente, sin duplicar responsabilidades del API Client ni romper `cancelAll()` / `normalizeApiError()`.

---

## Evidencia actual

| Archivo | Símbolo | Evidencia |
|---------|---------|-----------|
| `shared/api/runtime/transport-port.ts` | `TransportPort` | `execute(input: TransportInput): Promise<TransportResult>` |
| `shared/api/runtime/transport-port.ts` | `TransportInput` | `requestId`, `correlationId`, `method`, `url`, `headers`, `bodyText`, `signal?` |
| `shared/api/runtime/transport-port.ts` | `TransportResult` | `status`, `headers`, `bodyText`, `durationMs` — **no** `Response` nativo |
| `shared/api/runtime/transport-port.ts` | `TransportNetworkError` / `TransportCancelledError` | Excepciones transport-level |
| `shared/api/runtime/memory-transport.ts` | `MemoryTransport` | Implementación test/lab — cola + delay + respeta `signal` |
| `shared/api/runtime/mock-transport.ts` | `MockTransport` | Handler programable para tests |
| `shared/api/runtime/api-client.ts` | `request()` | Loop retry · timeout · inFlight · delega `transport.execute()` |
| `shared/api/runtime/api-client.ts` | `cancel` / `cancelAll` | Abort en `operationAbort` + `inFlight` — no llama transport directamente |
| `shared/api/runtime/api-client.ts` | `mapTransportException` | `Transport*` → `normalizeApiError()` |
| `shared/api/runtime/request-pipeline.ts` | `buildUrl`, `serializeBody`, `parseJsonBody` | Pipeline **fuera** del transport |
| `shared/api/runtime/errors.ts` | `normalizeApiError()` | Facade canónica post-transport |
| `bootstrap/initialize-api.ts` | `createMemoryTransport()` | Boot productivo lab usa MemoryTransport |
| `shared/api/API-CLIENT-SPEC.md` | Adapters futuros | Supabase / Edge / Stripe — spec only |
| `shared/api/API-RETRY-TIMEOUT-RULES.md` | Retry / timeout | Timer en API Client; transport obedece `AbortSignal` |
| `tests/unit/api-client-foundation.test.ts` | MemoryTransport | 491 tests sin red real |
| `tests/unit/boot-api-wiring.test.ts` | boot transport | Wiring Session + MemoryTransport |

**Nota:** No existe carpeta `shared/api/spec/` — especificación vive en `shared/api/*.md`.

**Búsqueda `fetch(` en runtime MOD-005:** **0 coincidencias** en `shared/api/runtime/`. Único `fetch` en `scripts/localhost-module-check.mjs` (fuera de MOD-005).

---

## Respuestas obligatorias (16 preguntas)

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 1 | ¿Existe hoy una interfaz de transporte? | **Sí** — `TransportPort` + `TransportInput` / `TransportResult` en `transport-port.ts` |
| 2 | ¿Dónde vive la ejecución real de requests? | **API Client** orquesta; ejecución concreta en implementación `TransportPort` inyectada. Hoy: `MemoryTransport.execute()` — **sin** `fetch` |
| 3 | ¿api-client.ts llama fetch directamente? | **No** — `await this.transport.execute({...})` línea ~107 |
| 4 | ¿Qué parte pertenece a API Client? | URL build, serialize body, headers (incl. Authorization), retry loop, timeout timer, inFlight/cancelAll, parse JSON, business flag, `normalizeApiError`, metadata, logging redactado |
| 5 | ¿Qué parte pertenece a transporte? | Una ejecución HTTP: enviar method/url/headers/bodyText, honrar `AbortSignal`, leer status/headers/body como texto, medir `durationMs`, lanzar `Transport*Error` en fallo red/cancel |
| 6 | Matriz de responsabilidades | Ver tabla § abajo |
| 7 | ¿Retries en API Client o FetchTransport? | **API Client** — loop `for (attempt)` en `request()`; transport **no** reintenta |
| 8 | ¿Quién crea AbortController? | **API Client** — `operationController` (cancel/cancelAll) + `controller` por attempt (timeout) + `mergeAbortSignals` con `options.signal` externo |
| 9 | ¿cancelAll() y transporte? | Client aborta controllers → `signal` merged llega abortado a `transport.execute()` → Fetch debe pasar signal a `fetch()` y rechazar/lanzar `TransportCancelledError` |
| 10 | Escenarios edge | Ver matriz escenarios § abajo |
| 11 | ¿Qué devuelve FetchTransport? | **Envelope propio** `TransportResult` (recomendado) — ya es el contrato; **no** exponer `Response` nativo al API Client |
| 12 | ¿Datos con secretos? | `Authorization`, `apikey`, tokens en headers; query con PII; body con credenciales — transport **recibe** headers ya armados; **no** almacena |
| 13 | ¿Headers visibles? | Transport devuelve headers response en `TransportResult`; logs usan `redactHeaders()` — Authorization siempre redactado |
| 14 | ¿URLs con query sensible? | `buildUrl()` en client — logging usa `path` + meta redactada; transport recibe URL final; no loguear query crudo con tokens |
| 15 | ¿Test sin internet? | `MemoryTransport` + `MockTransport` existentes; FetchTransport testeable con `vi.stubGlobal('fetch')` en ticket separado |
| 16 | API mínima invokeEdge/rpc/Supabase | Wrappers sobre `request()` con paths fijos; mismo `TransportPort` — ver § integración futura |

---

## Matriz de responsabilidades (propuesta canónica)

| Responsabilidad | Propietario | Evidencia hoy |
|-----------------|-------------|---------------|
| Construir URL (`baseUrl` + path + query) | **API Client** (`buildUrl`) | `request-pipeline.ts` |
| Headers (`Authorization`, `X-*`, `Content-Type`) | **API Client** (`buildHeaders`) | `api-client.ts` |
| Serializar body request | **API Client** (`serializeBody`) | Pre-transport |
| AbortController operación + attempt | **API Client** | `operationAbort`, `inFlight` |
| Timeout client timer | **API Client** | `setTimeout(() => controller.abort('timeout'))` |
| Merge external `AbortSignal` | **API Client** | `mergeAbortSignals()` |
| Retry + backoff | **API Client** | `retry-policy.ts` + loop |
| `fetch()` / HTTP wire | **FetchTransport** | ❌ AUSENTE |
| Leer body response como texto | **FetchTransport** | MemoryTransport ya devuelve `bodyText` |
| Parse JSON | **API Client** (`parseJsonBody`) | Post-transport |
| Status HTTP → error code | **API Client** (`normalizeApiError`) | Post-transport |
| Business `{error}` en 200 | **API Client** (`hasBusinessErrorFlag`) | Post-transport |
| `cancel` / `cancelAll` | **API Client** | No método en `TransportPort` |
| Credenciales / Session | **API Client** vía `SessionReaderPort` | Transport ignora Session |

---

## Matriz de escenarios

| Escenario | Comportamiento actual | FetchTransport esperado |
|-----------|----------------------|---------------------------|
| Request activa | `inFlight` Map + attempt controller | `fetch` con `signal`; abort → `TransportCancelledError` |
| Múltiples requests | Maps independientes por `requestId` | Sin estado global en transport |
| Timeout | Client abort attempt con reason `timeout` → `API_TIMEOUT` | `fetch` abortado; mismo mapping |
| `cancelAll()` | Abort all `operationAbort` + `inFlight` | Signals abortados; no completar body |
| Logout | Bootstrap → `cancelAll()` | Igual — transport passive |
| Relogin | Nuevas requests nuevos IDs; cancelAll previo | Sin estado usuario en transport |
| Body vacío | `parseJsonBody('')` → `data: null` | `bodyText: ''` |
| JSON inválido | `API_PARSE_ERROR` vía `normalizeApiError` | Transport devuelve texto crudo |
| HTTP 204 | Success `data: null` | `bodyText: ''`, status 204 |
| HTTP 429 | `API_RATE_LIMITED`; retry si policy | Status 429 en envelope |
| HTTP 500 | `API_HTTP_ERROR`; retry GET | Status 500 en envelope |
| Red caída | `TransportNetworkError` → `API_NETWORK` | `fetch` throw → wrap `TransportNetworkError` |

---

## Arquitectura actual

```
SessionReaderPort ──► API Client.request()
                         │
                         ├─ buildUrl / serializeBody / buildHeaders
                         ├─ retry loop + timeout + cancel maps
                         │
                         ▼
                    TransportPort.execute(TransportInput)
                         │
                         ├─ MemoryTransport (boot + tests)
                         ├─ MockTransport (tests)
                         └─ FetchTransport ❌ AUSENTE
                         │
                         ▼
                    TransportResult { status, headers, bodyText, durationMs }
                         │
                         ▼
                    parseJsonBody + normalizeApiError → ApiResponse
```

---

## Arquitectura objetivo (post-implementación)

```
Bootstrap.initializeApiForBoot()
  → createFetchTransport()   // reemplaza MemoryTransport en prod path
  → initializeApiClient({ transport, sessionReader, config })

API Client — sin cambio de frontera pública
FetchTransport — implementa TransportPort existente
```

**Lab/tests:** conservar `MemoryTransport` / `MockTransport` — no eliminar.

---

## Alternativas evaluadas

### A. Transport devuelve `Response` nativo

```ts
interface ApiTransport {
  execute(request: TransportRequest): Promise<Response>;
}
```

| Criterio | Evaluación |
|----------|------------|
| Alineación runtime | **Rompe** contrato actual `TransportResult` |
| Regresión | Alta — refactor `api-client.ts` + todos los tests |
| Testabilidad | Media — mock Response más verboso |
| Duración / headers mínimos | Client debe re-leer body; duplica lógica |

**Veredicto:** **Rechazada** — contrato envelope ya establecido en Fase 4.

### B. Envelope `TransportResult` (estado actual + `createFetchTransport`)

```ts
type TransportPort = {
  execute(input: TransportInput): Promise<TransportResult>;
};
```

| Criterio | Evaluación |
|----------|------------|
| Regresión | **Baja** — solo nueva implementación del port |
| MemoryTransport | Reutilizable en tests |
| normalizeApiError | Sin cambio — errores siguen en client |
| cancelAll / timeout | Sin cambio — signal-driven |

**Veredicto:** **Recomendada (núcleo).**

### C. FetchTransport posee timeout propio

| Criterio | Evaluación |
|----------|------------|
| Duplicación | **Alta** — client ya aborta por timeout |
| Divergencia | Dos fuentes de `API_TIMEOUT` |
| Spec | `API-RETRY-TIMEOUT-RULES.md` asigna timer al client |

**Veredicto:** **Rechazada** — timeout permanece en API Client; transport solo obedece `signal`.

### D. FetchTransport implementa retries

| Criterio | Evaluación |
|----------|------------|
| Duplicación | **Alta** — loop en `request()` |
| Policy | `retryPolicy` vive en client options |
| Idempotencia | Decisiones `retrySafe` en client |

**Veredicto:** **Rechazada** — retries **solo** en API Client.

### E. Transport conoce Session / Auth

| Criterio | Evaluación |
|----------|------------|
| Acoplamiento | Viola frontera MOD-005 |
| Authorization | Ya inyectado en `TransportInput.headers` por client |

**Veredicto:** **Rechazada**.

---

## Diseño recomendado

**Opción B** — `createFetchTransport(): TransportPort` implementando el contrato existente.

### Firma propuesta (implementación futura)

```ts
export type FetchTransportOptions = {
  readonly fetchFn?: typeof fetch; // injectable for tests
};

export function createFetchTransport(options?: FetchTransportOptions): TransportPort;
```

### Comportamiento FetchTransport

1. Recibe `TransportInput` **completo** (URL final, headers, bodyText, signal).
2. Invoca `fetch(url, { method, headers, body: bodyText ?? undefined, signal })`.
3. Mide `durationMs` con `performance.now()` o `Date.now()`.
4. Lee `response.text()` — **siempre** texto crudo (no JSON.parse en transport).
5. Copia headers response a `Record<string, string>` plano.
6. Si `signal.aborted` antes/durante → `TransportCancelledError`.
7. Si `fetch` lanza TypeError/network → `TransportNetworkError`.
8. **No** interpreta status HTTP — devuelve status tal cual (incluso 4xx/5xx).
9. **No** retry, **no** timeout timer, **no** Session, **no** logging con secretos.

### Cambio bootstrap (ticket implementación separado)

```ts
// initialize-api.ts — futuro
import { createFetchTransport } from '../shared/api/runtime';

initializeApiClient({
  transport: createFetchTransport(),
  sessionReader: createLiveSessionReader(),
  config,
});
```

`MemoryTransport` permanece para tests via `getBootMemoryTransportForTests()` solo si boot test lo requiere — decisión en ticket wiring.

---

## Integración con `normalizeApiError()`

| Origen | Input facade |
|--------|--------------|
| HTTP 4xx/5xx | `{ kind: 'http', status, bodyText, parsedBody }` — **client** |
| Network fail | `{ kind: 'network' }` — tras `TransportNetworkError` |
| Cancel | `{ kind: 'cancelled' }` — tras abort / `TransportCancelledError` |
| Timeout | `{ kind: 'timeout' }` — `signal.reason === 'timeout'` en client |
| Parse fail | `{ kind: 'bad-response' }` — client post `parseJsonBody` |

FetchTransport **no** llama `normalizeApiError()` — mantiene separación transport / dominio API.

---

## Integración futura: invokeEdge / rpc / Supabase

| API futura | Path / método | Transport |
|------------|---------------|-----------|
| `invokeEdge(name, body)` | `POST /functions/v1/${name}` | Mismo `TransportPort` |
| `rpc(fn, params)` | `POST /rest/v1/rpc/${fn}` | Mismo `TransportPort` |
| Supabase REST | `/rest/v1/...` | FetchTransport + headers anon key desde Config (inyectados por client) |

**Regla:** adapters son **helpers de path/body** sobre `ApiClient.request()` — no nuevos transports por backend salvo ADR (ej. WebSocket).

Headers Supabase (`apikey`, `Authorization`) los arma **API Client** desde Configuration + Session — FetchTransport transporta opaco.

---

## Seguridad y redacción

| Dato | Riesgo | Mitigación |
|------|--------|------------|
| `Authorization` en `TransportInput.headers` | Token en memoria transport | No persistir; no loguear — `redactHeaders` en client logs |
| `apikey` header Supabase | Anon key exposure | Config injection; redact en logs |
| Query `?token=` | PII en URL | `redactRequestMeta` — path sin query en logs preferido |
| Response `Set-Cookie` | Session leak | Redact si algún log incluye response headers |
| Body crudo en `details` | PII | `extractErrorDetails` + slice — ya en `errors.ts` |

FetchTransport **no** debe implementar logging propio con headers — delegar a API Client.

---

## Estrategia de pruebas (sin red real)

| Capa | Herramienta |
|------|-------------|
| Unit API Client | `MemoryTransport` / `MockTransport` — **sin cambio** |
| Unit FetchTransport | `fetchFn` injectable + stub responses |
| Boot wiring | Opcional: flag env `MDJ_V2_API_TRANSPORT=memory` para tests e2e |
| Integración red | **Fuera** de este ticket — staging manual PO |

Matriz mínima FetchTransport (implementación futura):

| # | Escenario |
|---|-----------|
| 1 | 200 JSON → `bodyText` + status |
| 2 | 204 → `bodyText: ''` |
| 3 | 500 → status sin throw |
| 4 | Network TypeError → `TransportNetworkError` |
| 5 | Abort signal → `TransportCancelledError` |
| 6 | Abort mid-read → cancel limpio |
| 7 | Headers response copiados |
| 8 | `durationMs` > 0 |

---

## Archivos potenciales (implementación futura)

### Necesarios

| Archivo | Cambio |
|---------|--------|
| `shared/api/runtime/fetch-transport.ts` | **Nuevo** — `createFetchTransport()` |
| `shared/api/runtime/index.ts` | Export fetch transport |
| `tests/unit/fetch-transport.test.ts` | **Nuevo** — stub fetch |
| `bootstrap/initialize-api.ts` | Swap Memory → Fetch (ticket wiring separado) |

### Posibles

| Archivo | Cambio |
|---------|--------|
| `tests/unit/boot-api-wiring.test.ts` | Assert transport tipo en boot |
| `shared/api/API-CLIENT-SPEC.md` | Alinear “Fetch productivo implementado” |

### Prohibidos en implementación

| Área | Razón |
|------|-------|
| Retry en transport | Duplica client |
| Session/Auth imports en fetch-transport | Frontera |
| `normalizeApiError` en transport | Dominio client |
| Supabase SDK en transport | Acoplamiento — HTTP plano primero |
| UI / V1 | Fuera alcance |

---

## Riesgos confirmados

| Riesgo | Clasificación |
|--------|---------------|
| Boot usa MemoryTransport — sin egress real | **CONFIRMADO** |
| Doble timeout si se implementa en transport | **POSIBLE** si se ignora diseño |
| `fetch` en SSR/test sin polyfill | **POSIBLE** — inject `fetchFn` |
| CORS / mixed content | **POSIBLE** en browser — config URLs |
| Body grande en memory | **POSIBLE** — `response.text()` carga completa; streaming fuera v1 |

---

## Criterios de aceptación (implementación futura — no autorizada)

1. Existe `createFetchTransport()` que implementa `TransportPort` sin romper tests existentes.
2. API Client **sin** cambios de frontera en retry/timeout/cancel/normalize.
3. `cancelAll()` aborta fetch in-flight vía `AbortSignal`.
4. Bootstrap puede inyectar FetchTransport (ticket wiring separado).
5. Tests FetchTransport sin red real (stub `fetch`).
6. Suite ≥ 491 baseline verde + tests transport nuevos.
7. Session / Auth / Runtime Registry **sin** importar fetch-transport.

---

## Fuera de alcance

- Implementación `fetch-transport.ts`
- Cambio bootstrap producción
- `invokeEdge()` / `rpc()` runtime
- Supabase SDK adapter
- MOD-014 bridge
- UI
- Producción V1
- push / PR / merge / deploy

---

## Recomendación final

**Sí** — puede abrirse ticket acotado:

**`TICKET-V2-PHASE-6-FETCH-TRANSPORT-IMPLEMENTATION-001`**

Secuencia PO recomendada: **FetchTransport (MOD-005)** → tests stub fetch → **bootstrap wiring** (Memory vs Fetch por env) → **después** `invokeEdge()` / `rpc()` → **después** MOD-014 bridge.

---

## Referencias

| Documento | Rol |
|-----------|-----|
| `TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-IMPLEMENTATION-001.md` | Prerequisito cerrado |
| `2026-07-11-MOD-005-NORMALIZE-API-ERROR-IMPLEMENTATION.md` | Acta normalize |
| `PHASE-4-MOD-005-CLOSURE.md` | Foundation TransportPort |
| `shared/api/API-CLIENT-SPEC.md` | Adapters futuros |
| `BOOT-SEQUENCE.md` | API Client Fase 4 egress |

---

*Discovery · TICKET-V2-PHASE-6-FETCH-TRANSPORT-DISCOVERY-001 · 2026-07-11*
*HEAD · `b83e06f64819d3fda76bfcab5d691aba268d1f27` · 491/491 PASS*
