# TICKET-V2-PHASE-7-SUPABASE-ADAPTER-DISCOVERY-001

## Estado

**DISCOVERY COMPLETADO — IMPLEMENTACIÓN NO AUTORIZADA**

| Campo | Valor |
|-------|-------|
| Fase | V2 — Phase 7 |
| Modo | Auditoría técnica + diseño documental (solo lectura de runtime) |
| Fecha discovery | 2026-07-12 |
| Rama analizada | `plan/v2-phase-4-api-client` |
| HEAD commit analizado | `7f1339f281f4ed71fe54c460564bf6b78c50485d` — `docs(v2-api): sync post-rpc phase 6 documentation` |
| Suite baseline | **559/559 PASS** · **48/48 files** (`npm test` / Vitest) |
| Working tree al inicio | ✅ Limpio — staging vacío |
| Supabase adapter runtime | ❌ **AUSENTE** — superficie parcial en MOD-005 (`invokeEdge`, `rpc`, header policy) |
| Autorización PO | Discovery únicamente — sin runtime, tests, commit, push, PR, merge, preview ni deploy |

---

## 1. Objetivo

Diseñar formalmente el **Supabase Adapter** de Miami DJ Beat V2 que consumirá las capacidades ya implementadas en **MOD-005 API Client**, sin duplicar transporte, headers, retry, timeout, cancelación ni normalización de errores.

El adapter debe quedar **especificado** antes de cualquier implementación. Fase 6 cerró con `invokeEdge()`, `rpc()`, Edge Header Policy, `FetchTransport`, `api.transportMode` y `normalizeApiError()` operativos en boot con `MemoryTransport` por defecto.

---

## 2. Baseline

### Git (Paso 1 — verificado 2026-07-12)

| Verificación | Resultado |
|--------------|-----------|
| `pwd` | `/Users/djmago/Desktop/miami-dj-beat-platform` |
| Rama | `plan/v2-phase-4-api-client` ✅ |
| HEAD | `7f1339f281f4ed71fe54c460564bf6b78c50485d` ✅ |
| Working tree | Limpio ✅ |
| Staging | Vacío ✅ |
| Untracked inesperados | Ninguno ✅ |

### Commits relevantes (cadena MOD-005)

| Commit | Mensaje |
|--------|---------|
| `7f1339f` | `docs(v2-api): sync post-rpc phase 6 documentation` |
| `50fa2f5` | `feat(v2-api): add rpc facade` |
| `92895b7` | `docs(v2-api): close edge header and rpc discovery` |
| `d4d9803` | `feat(v2-api): add invokeEdge supabase header policy` |
| `3b4f572` | `feat(v2-api): add invokeEdge facade` |
| `6dbf8d0` | `feat(v2-api): wire fetch transport through canonical config` |
| `e6578a5` | `feat(v2-api): add fetch transport adapter` |

### Tests

| Métrica | Valor |
|---------|-------|
| Archivos test | 48/48 PASS |
| Tests totales | 559/559 PASS |
| Egress real | ❌ No ejecutado (boot default `memory`) |

---

## 3. Estado actual

### MOD-005 — implementado

| Capacidad | Archivo(s) | Estado |
|-----------|------------|--------|
| `request()` / verbos HTTP | `shared/api/runtime/api-client.ts` | ✅ |
| `invokeEdge()` | `api-client.ts` → `POST /functions/v1/{name}` | ✅ |
| `rpc()` | `api-client.ts` → `POST /rest/v1/rpc/{name}` | ✅ |
| `cancel()` / `cancelAll()` | `api-client.ts` | ✅ |
| `normalizeApiError()` | `shared/api/runtime/errors.ts` | ✅ |
| `resolveSupabaseInvokeHeaders` | `shared/api/runtime/supabase-invoke-headers.ts` | ✅ |
| `mergeSupabaseInvokeCallerHeaders` | `supabase-invoke-headers.ts` | ✅ |
| `MemoryTransport` | `shared/api/runtime/memory-transport.ts` | ✅ |
| `FetchTransport` | `shared/api/runtime/fetch-transport.ts` | ✅ |
| `TransportPort` | `shared/api/runtime/transport-port.ts` | ✅ |
| `SessionReaderPort` | `shared/api/runtime/session-reader-port.ts` | ✅ |
| Boot wiring | `bootstrap/initialize-api.ts` | ✅ |
| Runtime singleton | `shared/api/runtime/api-service.ts` | ✅ |
| Logout → `cancelAll()` | `bootstrap/initialize-api.ts` | ✅ |

### MOD-005 — no implementado (gaps)

| Gap | Detalle |
|-----|---------|
| Clase `SupabaseAdapter` / `SupabaseRestAdapter` | Solo spec en `API-CLIENT-SPEC.md` §12 |
| `@supabase/supabase-js` | No instalado; no referenciado en runtime |
| MOD-014 Error Bridge | `ApiError` → `NormalizedError` ausente |
| `apikey` en REST genérico | Solo `invokeEdge`/`rpc`; `get/post` no inyectan Supabase headers |
| Timeouts config-driven | `api.timeout.*` spec-only; RPC hardcoded 15s; write 30s |
| Supabase Auth provider | `AuthProvider = 'supabase'` tipado; solo mock operativo |
| `mdj_access_snapshot` RPC | Permissions usa matriz local, no DB snapshot |
| Domain services consumidores | Ningún portal llama `invokeEdge`/`rpc` aún |
| `FetchTransport` en boot | Inactivo por defecto (`api.transportMode = 'memory'`) |

### Documentos leídos (Paso 2)

| Documento | Estado lectura |
|-----------|----------------|
| `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | ✅ |
| `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | ✅ |
| `docs/V2/GOVERNANCE/AGENT-STARTUP-GATE.md` | ✅ |
| `docs/V2/GOVERNANCE/AGENT-GOVERNANCE-PIPELINE.md` | ✅ |
| `docs/V2/GOVERNANCE/AGENT-WORK-AUTHORIZATION-FORM.md` | ✅ |
| `docs/V2/NOTA-DIARIA-LAB-001.md` | ✅ (incl. § Continuidad 2026-07-12) |
| `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` | ✅ (incl. baseline 559/559) |
| `docs/V2/README.md` | ✅ |
| `docs/V2/SESSION-SUMMARIES/2026-07-11-PHASE-6-END-OF-DAY.md` | ✅ |
| Tickets Fase 6 relacionados | ✅ FetchTransport · invokeEdge · Edge Header · RPC · normalizeApiError · logout cancellation |

---

## 4. Hallazgos

### H-01 — Superficie Supabase ya descompuesta en MOD-005

`invokeEdge()` y `rpc()` **ya son** thin facades Supabase sobre `request()`. Header policy, sanitización de nombres y `authMode: 'session' | 'anon'` están implementados. Un adapter que reimplemente HTTP, headers o retry **duplicaría** MOD-005.

### H-02 — Transporte no es responsabilidad del adapter

`TransportPort` + `MemoryTransport`/`FetchTransport` resuelven I/O. El adapter debe delegar al singleton `getApiClient()` — no introducir `transportMode: 'supabase'`.

### H-03 — Config existente suficiente para v1 del adapter

`MDJ_V2_API_PUBLIC_URL`, `MDJ_V2_API_ANON_KEY`, `MDJ_V2_API_TRANSPORT` cubren URL base, anon key y modo de transporte. No se requieren nuevas variables para Edge/RPC v1.

### H-04 — Session opaque auth ya cableada

Boot crea `SessionReaderPort` con `getSessionSnapshot()` + `getSessionAuthorizationHeader()`. Tokens son refs opacos (`Bearer {accessTokenRef}`), no JWT expuestos al adapter.

### H-05 — Permissions ⊥ API Client (by design)

`API-CLIENT-SPEC.md` declara MOD-003 ⊥ MOD-005. El adapter **no** debe gatear RPC/Edge internamente; el caller verifica `hasCapability()` antes de invocar.

### H-06 — MOD-014 bridge es ticket separado

MOD-014 existe (`normalizeError`, `normalizeAuthError`). No hay `api-normalize.ts`. El adapter retorna `ApiResponse<T>`; bridge a `NormalizedError` es posterior u opcional en capa UI.

### H-07 — V1 usa SDK; V2 eligió HTTP plano

V1: `db.rpc()` / Edge vía `@supabase/supabase-js`. V2: `TransportPort` + paths canónicos. Migración gradual posible sin SDK.

### H-08 — Doc drift menor en config

`MDJ_V2_API_TRANSPORT` implementado en `validate.ts` pero ausente en `.env.example` y `CONFIG-SPEC.md` §3. No bloquea adapter; sync documental en ticket aparte.

### H-09 — Generic PostgREST table access fuera de scope v1

Si dominio necesita `GET /rest/v1/{table}` con `apikey`, eso **no** está en `invokeEdge`/`rpc`. Adapter v1 se limita a Edge + RPC; REST tabular = ticket futuro o extensión explícita.

### H-10 — Tests unitarios sin red por diseño

`MemoryTransport` + asserts de path/headers/body en `invoke-edge.test.ts` y `rpc.test.ts` (28 tests RPC). Patrón replicable para adapter tests.

---

## 5. Arquitectura recomendada

### Decisión: **E controlada — A (wrapper ApiClient) + D (gateway Edge/RPC)**

| Opción evaluada | Veredicto |
|-----------------|-----------|
| **A. Wrapper de ApiClient** | ✅ **Núcleo** — delega transporte, headers, errores, cancel |
| **B. Facades especializadas** | ✅ **Superficie pública** — métodos `invokeEdge` / `invokeRpc` tipados |
| **C. Registry de operaciones** | ❌ Descartado v1 — sobre-ingeniería; RPC names son strings dinámicos |
| **D. Gateway Edge + RPC** | ✅ **Alcance funcional** — únicos targets Supabase del adapter v1 |
| **E. Combinación controlada** | ✅ **Recomendación final** |

### Forma concreta

```
Domain Service
        │
        ▼
createSupabaseAdapter({ apiClient })   ← factory v1; sin singleton global
        │
        ▼
  SupabaseAdapter  (MOD-005 consumer — thin)
        │
        ▼
  apiClient (inyectado — típicamente getApiClient() en composition root)
        │
        ├── invokeEdge()  ──► TransportPort (memory | fetch)
        └── rpc()         ──► invokeRpc() del adapter delega aquí
```

**No** es un transporte nuevo. **No** es el SDK. **No** es singleton global. Es una **capa de composición** que:

1. Expone API semántica Supabase (`invokeEdge`, `invokeRpc`) con tipos adapter-specific.
2. Acepta `authMode` **por request** (ver §7 — regla authMode); default `'session'`; anon solo con opt-in explícito.
3. Propaga `context` opcional (`portal`, `requestId`, `correlationId`); si el caller no aporta IDs, **ApiClient** los genera — el adapter no crea una segunda identidad.
4. Opcionalmente valida precondiciones locales (`requireSession`, payload inválido) **sin** sustituir RLS.
5. **No** reimplementa headers, retry, timeout, parse, normalize.
6. **No** se registra en boot ni mantiene estado global adicional en v1.

### HTTP existente vs Supabase JS SDK

| Criterio | HTTP (ApiClient) | `@supabase/supabase-js` |
|----------|------------------|-------------------------|
| Paridad con MOD-005 actual | ✅ Total | ❌ Segundo stack auth/headers |
| Bundle size | ✅ Cero deps nuevas | ❌ Dependencia adicional |
| Session opaque refs | ✅ Compatible | ❌ Espera JWT real / refresh SDK |
| Test sin red | ✅ MemoryTransport | ❌ Mock SDK complejo |
| Header policy unificada | ✅ `resolveSupabaseInvokeHeaders` | ❌ Lógica SDK paralela |
| Realtime / Storage | ❌ No cubierto | ✅ SDK nativo |
| Auth OAuth / refresh | ⏳ Session mock hoy | ✅ SDK futuro candidato |

**Recomendación única:** Adapter **basado en HTTP existente** (ApiClient). SDK reservado para ticket futuro de **Supabase Auth provider** (MOD-001), no para Edge/RPC egress.

---

## 6. Alternativas descartadas

| Alternativa | Motivo descarte |
|-------------|-----------------|
| Adapter como `TransportPort` implementación | Duplica FetchTransport; paths Supabase ya en ApiClient |
| `transportMode: 'supabase'` | Confunde producto; fetch/memory ya cubren egress |
| Reimplementar header policy en adapter | Violación DRY; policy probada en 28+ tests RPC/Edge |
| SDK para Edge/RPC únicamente | Dos modelos de auth; session opaque incompatible |
| Registry estático de todas las RPC V1 | 40+ funciones; mantenimiento alto; strings dinámicos suficientes |
| Adapter con gates MOD-003 internos | Contradice `API-CLIENT-SPEC.md`; mezcla UI auth con HTTP |
| service_role en browser | Prohibido constitución + `validate.ts` forbidden patterns |
| Fetch activo por defecto en boot | Riesgo egress accidental; PO debe autorizar explícitamente |
| `getSupabaseAdapter()` singleton global | PO v1: solo `createSupabaseAdapter()`; factory por servicio de dominio |
| Boot wiring / registry adapter | DIFERIDO — no forma parte de adapter v1 |
| REST tabular `GET /rest/v1/{table}` | Fuera scope v1 — solo `invokeEdge` + `rpc` (PO Q-03) |
| Alias tsconfig nuevo | PO Q-09: convención imports existente; `index.ts` local |

---

## 7. Contratos propuestos (informe — sin archivos)

### 7.1 `SupabaseAuthContext`

Snapshot **read-only** de sesión — alineado con `SessionReaderPort` actual. **No** incluye `authMode` (eso es opción por request). **No** incluye roles ni capabilities (pertenecen a MOD-003 Permissions o capa dominio).

```typescript
type SupabaseAuthContext = {
  readonly hasSession: boolean;
  readonly sessionId: string | null;
  readonly portal: 'client' | 'artist' | 'staff' | null;
  readonly actorType: 'guest' | 'authenticated';
};
```

Resuelto por adapter leyendo `SessionReaderPort` — **read-only**. `actorType` refleja únicamente `guest` | `authenticated` según presencia de `snapshot.user`; no infiere `staff` ni `system`.

### 7.2 `SupabaseRequestOptions`

```typescript
type SupabaseRequestOptions = {
  readonly authMode?: 'session' | 'anon';       // default: 'session'
  readonly timeoutMs?: number;                 // delegate to ApiClient
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  readonly retrySafe?: boolean;
  readonly context?: Partial<RequestContext>;   // portal, requestId, correlationId — opcional
  readonly requireSession?: boolean;           // adapter pre-check; default false
};
```

**`context` e identidad:** `context` es opcional. Si el caller no aporta `requestId` ni `correlationId`, **ApiClient** los genera vía `nextRequestId()` / `nextCorrelationId()`. El adapter **no** genera una segunda identidad paralela. `metadata` en la respuesta no debe contener tokens, payloads sensibles ni PII innecesaria (hereda redacción MOD-005).

### Regla authMode (contrato v1)

| Regla | Comportamiento |
|-------|----------------|
| Pertenencia | `authMode` pertenece a **cada request** (`SupabaseRequestOptions`), no al snapshot de sesión |
| Default | `invokeEdge()` e `invokeRpc()` usan `authMode: 'session'` si el caller no especifica |
| Anon | Requiere **opt-in explícito** `authMode: 'anon'` |
| Sin sesión | **Nunca** inferir anon por ausencia de sesión |
| Prohibido | Fallback silencioso session → anon |
| Con sesión activa | MOD-005 ignora `authMode: 'anon'` si hay `sessionAuthorization` |

### 7.3 `SupabaseEdgeRequest`

```typescript
type SupabaseEdgeRequest<TBody = unknown> = {
  readonly functionName: string;
  readonly body?: TBody;
  readonly options?: SupabaseRequestOptions;
};
```

### 7.4 `SupabaseRpcRequest`

```typescript
type SupabaseRpcRequest<TParams = Record<string, unknown>> = {
  readonly functionName: string;
  readonly params?: TParams;
  readonly options?: SupabaseRequestOptions;
};
```

### 7.5 `SupabaseAdapterResult<T>`

Alias semántico — **no** nuevo shape; reexporta MOD-005:

```typescript
type SupabaseAdapterResult<T> = ApiResponse<T>;
// ApiSuccess<T> | ApiFailure — normalizeApiError ya aplicado
```

### 7.6 `SupabaseAdapter`

```typescript
interface SupabaseAdapter {
  /** POST /functions/v1/{functionName} */
  invokeEdge<TResponse = unknown, TBody = unknown>(
    request: SupabaseEdgeRequest<TBody>,
  ): Promise<SupabaseAdapterResult<TResponse>>;

  /**
   * POST /rest/v1/rpc/{functionName}
   * Fachada semántica — delega directamente en apiClient.rpc(...) sin lógica HTTP adicional.
   */
  invokeRpc<TResponse = unknown, TParams = Record<string, unknown>>(
    request: SupabaseRpcRequest<TParams>,
  ): Promise<SupabaseAdapterResult<TResponse>>;

  /** Read-only auth snapshot for callers */
  getAuthContext(): SupabaseAuthContext;

  /** Delegate — same singleton as MOD-005 */
  cancel(requestId: string): void;
  cancelAll(): void;
}
```

### Factory v1 (única forma autorizada — PO Q-01)

```typescript
type CreateSupabaseAdapterInput = {
  readonly apiClient: ApiClientPublicApi;     // inyectado por servicio de dominio
  readonly sessionReader?: SessionReaderPort; // opcional; default desde ApiClient deps en tests
};

function createSupabaseAdapter(input: CreateSupabaseAdapterInput): SupabaseAdapter;
```

**Descartado v1:** `getSupabaseAdapter()`, singleton global, registro en boot, estado global adicional. Los futuros servicios de dominio crean el adapter mediante `createSupabaseAdapter({ apiClient: getApiClient() })` en su composition root.

### Errores

Adapter **no** define códigos nuevos. Propaga `ApiFailure.error` con códigos MOD-005 existentes: `API_HTTP_ERROR`, `API_EDGE_REJECTED`, `API_TIMEOUT`, `API_CANCELLED`, `API_INVALID_PAYLOAD`, `API_NETWORK`, `API_RATE_LIMITED`, `API_UNKNOWN`.

**Pre-check local v1 (decisión fijada):** cualquier fallo de pre-check del adapter (config/payload inválido local, `requireSession: true` sin sesión) usa **`API_INVALID_PAYLOAD`** — código canónico ya existente más cercano. **No** introducir `API_CONFIG_ERROR` desde el adapter. Errores de configuración de boot siguen bajo MOD-006 / gate `initializeApiForBoot`.

---

## 8. Flujos

| # | Flujo | Origen | Componentes | Headers | Resultado | Error esperado | Eventos | Sin egress |
|---|-------|--------|-------------|---------|-----------|----------------|---------|------------|
| 1 | Edge con sesión | Domain → `adapter.invokeEdge` | Adapter → ApiClient → MemoryTransport | `apikey` + `Authorization: Bearer ref` | `ApiSuccess<T>` | — | Ninguno obligatorio | MemoryTransport encola respuesta |
| 2 | Edge anónima | Guest flow `authMode:'anon'` | Adapter → ApiClient | `apikey` + `Authorization: Bearer {anonKey}` | `ApiSuccess<T>` | — | — | Igual |
| 3 | RPC con sesión | Permissions snapshot futuro | Adapter → `rpc()` | Igual Edge policy | `ApiSuccess<T>` | — | — | MemoryTransport |
| 4 | RPC anónima | Búsqueda pública | `authMode:'anon'` | Anon bearer | `ApiSuccess<T>` | 401 si RLS deny | — | MemoryTransport |
| 5 | Sin sesión + `authMode:'session'` | Portal guest | ApiClient policy | Solo `apikey` | Depende RLS | 401 `API_HTTP_ERROR` | — | MemoryTransport |
| 6 | Sesión expirada | `SESSION_EXPIRED` | Session reader → null auth | Solo `apikey` (session mode) | 401 backend | `API_HTTP_ERROR` Unauthorized | `SESSION_EXPIRED` (MOD-002) | MemoryTransport |
| 7 | Token ausente | `requireSession:true` | Adapter pre-check | — | Falla local | `API_INVALID_PAYLOAD` | — | **Sin transport** |
| 8 | Error HTTP 4xx/5xx | PostgREST/Edge | normalizeApiError | — | `ApiFailure` | `API_HTTP_ERROR` / `API_EDGE_REJECTED` | Opcional `SYSTEM_ERROR` (no impl.) | MemoryTransport devuelve status |
| 9 | Error Supabase body | `{ error: "..." }` en 200/422 | hasBusinessErrorFlag | — | `ApiFailure` | `API_EDGE_REJECTED` | — | MemoryTransport |
| 10 | Timeout | RPC 15s / Edge 30s | AbortController | — | `ApiFailure` | `API_TIMEOUT` | — | Timer abort |
| 11 | Cancelación logout | `USER_LOGOUT` | Boot → `cancelAll()` | — | In-flight → `API_CANCELLED` | `API_CANCELLED` | `USER_LOGOUT` | Abort sin red |
| 12 | Bloqueado permisos UI | Caller sin `hasCapability` | **Caller** no invoca adapter | — | — | — | — | — |
| 13 | Transport memory | Boot default | MemoryTransport | — | Cola test/mock | `API_NETWORK` si cola vacía | — | **Cero egress** |
| 14 | Transport fetch | `MDJ_V2_API_TRANSPORT=fetch` | FetchTransport | Headers policy | HTTP real | Errores red/HTTP | — | Egress real — **solo QA autorizado** |

### Regla authMode en wire (heredada MOD-005 — ver también §7.2)

1. Si `sessionAuthorization` presente → usa sesión (**ignora** `authMode: 'anon'`).
2. Si no hay sesión y `authMode: 'anon'` (opt-in explícito) → `Bearer {anonKey}`.
3. Si no hay sesión y `authMode: 'session'` (default) → solo `apikey`.

**Prohibido:** inferir anon por ausencia de sesión; fallback silencioso session → anon.

---

## 9. Seguridad

### Reglas obligatorias

| Regla | Implementación |
|-------|----------------|
| Nunca `service_role` en frontend | `validate.ts` `FORBIDDEN_KEY_PATTERNS` |
| No persistir tokens en logs | `redactHeaders` / `redactRequestMeta` MOD-005 |
| Anon key solo vía config pública | `getConfig().api.anonKey` |
| Caller headers no sobrescriben protegidos | `mergeSupabaseInvokeCallerHeaders` elimina `apikey`/`Authorization` |
| No fallback session → anon | Policy explícita en `resolveSupabaseInvokeHeaders` |
| Fetch no activo por defecto | `api.transportMode` default `memory` |
| Tests unitarios sin red | MemoryTransport obligatorio en CI |
| Permisos UI ≠ autorización backend | Caller `hasCapability`; RLS manda en Postgres |
| Capability frontend no sustituye RLS | Documentar en adapter README |
| No registrar payloads sensibles | Redaction MOD-005; adapter no loguea body |

### Amenazas identificadas

| Amenaza | Mitigación propuesta |
|---------|---------------------|
| Header injection | `mergeSupabaseInvokeCallerHeaders` + reserved list |
| Token leakage | Opaque refs; no export JWT; redact logs |
| Bypass authMode | Policy centralizada; tests por escenario |
| RPC arbitrario | `sanitizeRpcFunctionName` — regex `[a-zA-Z0-9_-]+` |
| Edge Function arbitraria | `sanitizeEdgeFunctionName` — no `..`, no URLs |
| Function name injection | Sanitización pre-transport → `API_INVALID_PAYLOAD` |
| Replay | Fuera scope adapter; Session credentialVersion futuro |
| Stale session | Session store expiry; 401 → caller refresh flow |
| Race logout/request | `cancelAll()` en `USER_LOGOUT` / `SESSION_DESTROYED` |
| Error data leakage | `details` truncado 512 chars en normalize |

---

## 10. Errores

### Pipeline

```
Transport error → normalizeApiError (MOD-005) → ApiFailure
Adapter pre-check → ApiFailure (`API_INVALID_PAYLOAD`) sin transport
Future: ApiFailure → MOD-014 NormalizedError (ticket separado)
```

### Mapeo Supabase-specific

| Origen | HTTP | Código ApiError |
|--------|------|-----------------|
| PostgREST permission | 401 | `API_HTTP_ERROR` |
| PostgREST not found | 404 | `API_HTTP_ERROR` |
| PostgREST validation | 400 | `API_HTTP_ERROR` |
| Edge rejection | 422 | `API_EDGE_REJECTED` |
| Business `{ error }` en 2xx | 200 | `API_EDGE_REJECTED` |
| Rate limit | 429 | `API_RATE_LIMITED` |
| Gateway timeout | 504 | `API_TIMEOUT` |
| Abort logout | — | `API_CANCELLED` |
| Abort timeout | — | `API_TIMEOUT` |
| Cola memory vacía | — | `API_NETWORK` |

---

## 11. Test plan (diseño — sin implementación)

### A. Unit tests — `tests/unit/supabase-adapter.test.ts`

| Caso | Assert |
|------|--------|
| `invokeEdge` delega a `apiClient.invokeEdge` | Spy/mock ApiClient |
| `invokeRpc` delega a `apiClient.rpc` | Spy/mock ApiClient |
| `authMode` default `session` | Options pasadas |
| `authMode: 'anon'` propagado | Options pasadas |
| `requireSession: true` sin sesión | Falla antes de transport |
| `getAuthContext()` snapshot | guest vs authenticated |
| `cancel` / `cancelAll` delegados | Spy |
| Config sin `publicUrl` | Pre-check error |
| No instancia FetchTransport | MemoryTransport en test |

### B. Contract tests

| Caso | Assert |
|------|--------|
| Result shape = `ApiResponse<T>` | Type + runtime |
| Errores usan códigos MOD-005 | No códigos adapter-specific |
| Headers policy no duplicada | ApiClient mock recibe headers merged |

### C. Integration — MemoryTransport

| Caso | Assert |
|------|--------|
| Edge path `/functions/v1/{name}` | Transport `calls[0].url` |
| RPC path `/rest/v1/rpc/{name}` | Transport `calls[0].url` |
| Session headers en Edge | `apikey` + `Authorization` |
| Anon headers | `Bearer anonKey` |
| RPC body `{}` default | `bodyText` |
| Sanitización nombre inválido | `API_INVALID_PAYLOAD` |

### D. Integration — FetchTransport mockeado

| Caso | Assert |
|------|--------|
| `fetchFn` injectable | Sin red real |
| AbortSignal propagado | Cancel test |
| 401 response | `API_HTTP_ERROR` |

### E. Egress QA manual (futuro — ticket separado)

- `MDJ_V2_API_TRANSPORT=fetch` + proyecto Supabase staging
- PO visual + hard refresh
- **No** en CI default

### F. Playwright (futuro)

- Solo tras domain wiring en portales
- Fuera scope adapter unitario

### Cobertura mínima adicional

- Header precedence (caller vs policy)
- Protected headers stripping
- RPC params serialization
- invokeEdge body serialization
- Name sanitization edge + rpc
- Timeout RPC 15s
- Timeout Edge 30s (write class)
- normalizeApiError en failure paths
- Logout cancellation wiring (boot integration test existente)
- Transport memory default
- Transport fetch opt-in
- No network by default en `npm test`
- Typed results `ApiSuccess<T>`
- Malformed JSON response → `API_PARSE_ERROR`

---

## 12. Archivos futuros

### Mapa mínimo definitivo (autorizado — PO v1)

```
MiamiDJBeat-MigracionV2/shared/api/supabase/
  supabase-adapter-types.ts
  supabase-adapter.ts
  index.ts                     # exports locales; convención imports existente del repo

MiamiDJBeat-MigracionV2/tests/unit/
  supabase-adapter.test.ts
```

**No incluir en v1:** `supabase-adapter-errors.ts` (usa `normalizeApiError` MOD-005), cambios en `api-client.ts`, cambios en `tsconfig`, SDK Supabase, `@supabase/supabase-js`.

### Boot wiring — DIFERIDO (no forma parte de adapter v1)

La implementación v1 **no modificará:**

- `bootstrap/`
- `bootstrap/initialize-api.ts`
- registry global / singleton adapter

Los servicios de dominio instancian `createSupabaseAdapter({ apiClient })` tras `API_READY` en su propio composition root.

### Sin modificar en v1

- `api-client.ts`
- `supabase-invoke-headers.ts`
- `fetch-transport.ts` / `memory-transport.ts`
- `shared/api/runtime/index.ts` (sin re-export obligatorio)
- Portales (`client/`, `artist/`, `staff/`)
- `package.json` / `tsconfig`
- `.env` / `.env.example` (sync transport doc = ticket aparte)

### Documentación futura (post-implementación)

- `docs/V2/SESSION-SUMMARIES/2026-07-XX-SUPABASE-ADAPTER-IMPLEMENTATION.md`
- Actualización `MiamiDJBeat-V2-MODULE-CATALOG.md` § MOD-005 anexo
- `NOTA-DIARIA-LAB-001.md` § implementación

### Prohibidos

- `web/` (V1 producción)
- `supabase/` migrations sin ticket
- Edge Functions deploy
- Instalar `@supabase/supabase-js` sin ADR

---

## 13. Dependencias y orden de implementación

| Módulo | Clasificación | Notas |
|--------|---------------|-------|
| **MOD-006 Config** | Requerida **antes** | `publicUrl`, `anonKey`, `transportMode` ya operativos |
| **MOD-005 API Client** | Requerida **antes** | `invokeEdge`, `rpc`, headers, transport — ✅ completo |
| **MOD-002 Session** | Requerida **durante** | `getSessionAuthorizationHeader()` — ✅ opaque auth |
| **MOD-003 Permissions** | Opcional | Pre-check en **caller**, no en adapter |
| **MOD-004 Event Bus** | Opcional | Logout cancel ya cableado en boot |
| **MOD-014 Error Bridge** | **Posterior** | No bloquea adapter v1 |
| **MOD-001 Auth Supabase** | Posterior | Provider real para refresh JWT |

### MOD-014 — antes o después del adapter?

**Después del adapter (recomendado).**

Motivo: adapter delega errores MOD-005; UI puede consumir `ApiFailure` directamente en fase transitoria. Bridge MOD-014 beneficia **toda** la app, no solo Supabase. Secuencia PO documentada: adapter → domain wiring → MOD-014 bridge → egress QA.

### Orden tickets sugerido

1. `TICKET-V2-PHASE-7-SUPABASE-ADAPTER-IMPLEMENTATION-001` — adapter thin wrapper + tests
2. `TICKET-V2-PHASE-7-DOMAIN-SERVICE-WIRING-001` — primer consumidor (ej. permissions snapshot RPC)
3. `TICKET-V2-PHASE-7-MOD-014-ERROR-BRIDGE-001` — `ApiError` → `NormalizedError`
4. `TICKET-V2-PHASE-7-FETCH-EGRESS-QA-001` — QA manual con `transportMode=fetch`
5. `TICKET-V2-PHASE-7-SUPABASE-AUTH-PROVIDER-001` — MOD-001 provider real (futuro)

---

## 14. Riesgos

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-01 | Duplicar lógica MOD-005 en adapter | Alta | Wrapper estricto; code review checklist |
| R-02 | Activar fetch accidental en CI/prod | Alta | Default memory; egress ticket separado |
| R-03 | Asumir permisos UI = RLS | Alta | Documentar; tests no mockean autorización falsa |
| R-04 | SDK creep | Media | ADR explícito antes de `@supabase/supabase-js` |
| R-05 | Adapter se convierte en god-object | Media | Limitar v1 a Edge + RPC; REST tabular = futuro |
| R-06 | Session mock vs Supabase real | Media | Ticket Auth provider antes de egress prod |
| R-07 | Timeouts hardcoded vs config | Baja | Alinear RPC 15s con spec; config ticket MOD-006 |
| R-08 | Sin MOD-014, UI inconsistente | Media | Bridge ticket en paralelo post-adapter |
| R-09 | Domain services saltan adapter | Baja | Convención: import adapter, no `getApiClient` directo en portales |
| R-10 | Doc drift `.env.example` | Baja | Ticket doc sync transport |

---

## 15. Criterios de aceptación (implementación futura)

| # | Criterio |
|---|----------|
| AC-01 | `createSupabaseAdapter()` delega 100% a `ApiClient.invokeEdge` / `rpc` |
| AC-02 | Cero lógica duplicada de headers (reutiliza MOD-005) |
| AC-03 | Tests unitarios ≥ 20 casos; suite total sigue 559+ PASS |
| AC-04 | `npm test` sin egress (memory default) |
| AC-05 | No nuevas dependencias npm |
| AC-06 | No modifica `bootstrap/`, `initialize-api.ts` ni registry global |
| AC-07 | `git diff --check` limpio |
| AC-08 | Documentación SESSION-SUMMARY + MODULE-CATALOG actualizados |
| AC-09 | PO visual localhost 5173 — tres portales HTTP 200 |
| AC-10 | Working tree limpio post-commit |

---

## 16. Alcance permitido de implementación (futuro)

- Crear `shared/api/supabase/` (3 archivos: types, adapter, index)
- Tests unitarios `supabase-adapter.test.ts`
- `createSupabaseAdapter({ apiClient })` — factory única; inyección desde servicios de dominio
- Imports vía convención existente del repo + `shared/api/supabase/index.ts` local
- Documentación en `docs/V2/`

---

## 17. Alcance prohibido (futuro)

- Instalar `@supabase/supabase-js`
- `getSupabaseAdapter()` / singleton global / estado global adapter
- Modificar `bootstrap/`, `initialize-api.ts`, registry global
- Modificar `tsconfig` / añadir alias nuevo
- `GET /rest/v1/{table}`, CRUD tabular, query builder, Realtime, Storage
- Activar `MDJ_V2_API_TRANSPORT=fetch` en boot default
- Modificar `api-client.ts` header policy sin ticket
- Egress real en tests CI
- Gates MOD-003 dentro del adapter
- `service_role` en cualquier capa frontend
- Modificar portales V2
- Modificar V1 `web/`
- Deploy Edge Functions / migraciones SQL
- `supabase-adapter-errors.ts` (usar MOD-005 `normalizeApiError`)
- MOD-014 bridge en mismo ticket que adapter (salvo PO expanda)

---

## 18. Preguntas abiertas (Product Owner)

### Resueltas por PO (2026-07-12 — TICKET-V2-PHASE-7-SUPABASE-ADAPTER-DISCOVERY-FIX-001)

| # | Pregunta | Decisión |
|---|----------|----------|
| Q-01 | ¿Adapter singleton (`getSupabaseAdapter`) o factory por portal? | **RESUELTA:** solo `createSupabaseAdapter(...)`; sin singleton, sin boot registry |
| Q-03 | ¿Adapter v1 incluye `GET /rest/v1/{table}` o solo Edge + RPC? | **RESUELTA:** solo `invokeEdge()` + `rpc()`; sin REST tabular, Realtime, Storage, SDK |
| Q-09 | ¿Convención de import: alias tsconfig nuevo? | **RESUELTA:** no modificar tsconfig; convención imports existente; `index.ts` local |

### Diferidas

| # | Pregunta | Cuándo |
|---|----------|--------|
| Q-02 | ¿Primer consumidor dominio: `mdj_access_snapshot` u otro RPC? | Domain wiring |
| Q-04 | ¿Egress QA staging antes o después domain wiring? | Egress QA |
| Q-05 | ¿Añadir `x-client-info` header? | Implementación — default **NO** salvo necesidad demostrada |
| Q-06 | ¿Sync `.env.example` con `MDJ_V2_API_TRANSPORT`? | Ticket documental/config separado |
| Q-07 | ¿Timeouts config-driven (`api.timeout.rpcMs`)? | MOD-006 posterior |
| Q-08 | ¿MOD-014 bridge bloquea UI work? | Paralelo posterior |
| Q-10 | ¿Supabase Auth provider prerequisito egress prod? | Antes de egress productivo |

---

## 19. Recomendación final

Implementar un **Supabase Adapter delgado** como wrapper HTTP sobre **ApiClient inyectado** vía `createSupabaseAdapter({ apiClient })`, exponiendo `invokeEdge` y `invokeRpc` (esta última delega en `apiClient.rpc()` sin lógica HTTP adicional). **No** singleton global. **No** boot wiring v1. **No** instalar SDK. **No** crear transporte nuevo. **No** duplicar header policy.

Alcance v1: **solo Edge + RPC**. La Fase 6 ya entregó el comportamiento wire en MOD-005; la Fase 7 agrega **composición semántica + contrato estable para domain services**.

Secuencia: **Adapter implementation → Domain wiring (1 RPC piloto) → MOD-014 bridge (paralelo posible) → Fetch egress QA → Supabase Auth provider**.

---

## 20. Próximo ticket propuesto

**`TICKET-V2-PHASE-7-SUPABASE-ADAPTER-IMPLEMENTATION-001`** — directamente; sin ticket intermedio de decisiones (Q-01, Q-03, Q-09 resueltas).

| Campo | Valor |
|-------|-------|
| Objetivo | Implementar `createSupabaseAdapter({ apiClient })` + tests unitarios MemoryTransport |
| Archivos | `shared/api/supabase/supabase-adapter-types.ts`, `supabase-adapter.ts`, `index.ts`; `tests/unit/supabase-adapter.test.ts` |
| Factory | Solo `createSupabaseAdapter` — sin `getSupabaseAdapter`, sin boot, sin singleton |
| Alcance | Solo `invokeEdge` + `invokeRpc` → `apiClient.rpc()` |
| Imports | Convención existente; sin alias tsconfig nuevo |
| Baseline esperado | HEAD post-discovery commit documental |
| Tests target | +20–30 tests; suite ≥ 579 PASS |
| Prohibido | SDK, fetch egress, portales, boot, MOD-014, `supabase-adapter-errors.ts` |
| Validación | PO técnico + localhost 5173 |

---

## Auditoría de código — rutas exactas (Paso 3)

| # | Elemento | Ruta |
|---|----------|------|
| 1 | API pública | `MiamiDJBeat-MigracionV2/shared/api/runtime/index.ts` |
| 2 | Tipos públicos | `MiamiDJBeat-MigracionV2/shared/api/runtime/types.ts` |
| 3 | Contrato transport | `MiamiDJBeat-MigracionV2/shared/api/runtime/transport-port.ts` |
| 4 | MemoryTransport | `MiamiDJBeat-MigracionV2/shared/api/runtime/memory-transport.ts` |
| 5 | FetchTransport | `MiamiDJBeat-MigracionV2/shared/api/runtime/fetch-transport.ts` |
| 6 | Boot wiring | `MiamiDJBeat-MigracionV2/bootstrap/initialize-api.ts`, `boot.ts` |
| 7 | Header policy | `MiamiDJBeat-MigracionV2/shared/api/runtime/supabase-invoke-headers.ts` |
| 8 | invokeEdge | `MiamiDJBeat-MigracionV2/shared/api/runtime/api-client.ts` |
| 9 | rpc | `MiamiDJBeat-MigracionV2/shared/api/runtime/api-client.ts` |
| 10 | normalizeApiError | `MiamiDJBeat-MigracionV2/shared/api/runtime/errors.ts` |
| 11 | Session integration | `MiamiDJBeat-MigracionV2/shared/api/runtime/session-reader-port.ts` |
| 12 | Permissions | ❌ Sin integración — `shared/permissions/` ⊥ API |
| 13 | Cancel | `api-client.ts` + `bootstrap/initialize-api.ts` |
| 14 | Tests | `tests/unit/api-client-foundation.test.ts`, `invoke-edge.test.ts`, `rpc.test.ts`, `fetch-transport.test.ts`, `boot-api-wiring.test.ts` |

---

## Auditoría configuración Supabase (Paso 4)

| Variable | Tipo | Default (local) | Validación | Consumidor |
|----------|------|-----------------|------------|------------|
| `MDJ_V2_API_PUBLIC_URL` | URL string | placeholder local | Required staging/prod; no `/web/` | ApiClient baseUrl |
| `MDJ_V2_API_ANON_KEY` | string | placeholder | Required staging/prod; no service_role | Header policy `apikey` |
| `MDJ_V2_API_TRANSPORT` | `'memory' \| 'fetch'` | `'memory'` | Solo `'fetch'` explícito activa fetch | `initialize-api.ts` |
| `MDJ_V2_SESSION_STORAGE` | enum | `'session'` | Enum válido | Session persistence |
| `MDJ_V2_REFRESH_BEFORE_MS` | number | `300000` | > 0 | Session refresh threshold |
| `MDJ_V2_ENV` | enum | — | Required | Placeholder rules |

**Conclusión:** Adapter v1 **no requiere** nuevas variables. Timeouts config = mejora MOD-006 posterior.

---

## Ownership matrix (Paso 5)

| Responsabilidad | Owner |
|-----------------|-------|
| HTTP wire | `TransportPort` (MOD-005) |
| URL paths Supabase | `ApiClient.invokeEdge` / `rpc` |
| Headers `apikey`/`Authorization` | `resolveSupabaseInvokeHeaders` (MOD-005) |
| Auth token | MOD-002 Session (`getSessionAuthorizationHeader`) |
| Token refresh | MOD-002 (mock hoy; Supabase futuro) |
| Errores HTTP → ApiError | `normalizeApiError` (MOD-005) |
| Errores → UI NormalizedError | MOD-014 (pendiente) |
| Timeouts / retry | MOD-005 `request()` |
| Cancel / logout | MOD-005 + boot Event Bus |
| Telemetría | MOD-010 Logging (request meta redacted) |
| Capability gate | Caller + MOD-003 (pre-invoke) |
| Semántica Supabase pública | **Supabase Adapter (nuevo)** |

---

*Discovery generado 2026-07-12 — TICKET-V2-PHASE-7-SUPABASE-ADAPTER-DISCOVERY-001 — corrección mínima 2026-07-12 TICKET-V2-PHASE-7-SUPABASE-ADAPTER-DISCOVERY-FIX-001 — sin cambios runtime.*
