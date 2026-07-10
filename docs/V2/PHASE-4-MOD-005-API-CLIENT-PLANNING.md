# Fase 4 — MOD-005 API Client — Planificación Arquitectónica

**Ticket:** TICKET-V2-PHASE-4-MOD-005-PLANNING-001  
**Proyecto:** MiamiDJBeat-MigracionV2  
**Fecha:** 2026-07-10  
**Tipo:** Planificación documental — **sin implementación**  
**Rama local:** `plan/v2-phase-4-api-client`  
**Base commit:** `45b8b6a7abeecfce1a3c1161b03a4b3f7a006e3b` (Fase 3 MOD-002 cerrada)

---

## 1. Resumen ejecutivo

MOD-005 **API Client** es el único egress HTTP/RPC/Edge autorizado del Shared Core V2. Hoy existe **especificación documental completa** (TICKET-V2-SHARED-CORE-010) pero **cero runtime**, **cero tests** y **cero alias de paquete** (`@mdj/shared/api`).

Fase 3 (MOD-002 Session Manager) quedó cerrada localmente. Fase 4 abre **solo planificación** para MOD-005 foundation: contratos tipados, pipeline de request, transports mock/memory, timeout, cancelación, retry policy, normalización de errores HTTP y tests unitarios — **sin Supabase real, sin Edge real, sin credenciales live, sin cambios en portales ni V1**.

**Recomendación técnica única:** implementar **MOD-005 foundation antes de MOD-001 Authentication real** (Ruta A), usando `SessionReader` con token opaco/mock ya compatible con el boundary Auth↔Session existente.

**Este ticket NO autoriza implementación, commit, push, PR, Preview, merge ni deploy.**

---

## 2. Estado actual

### Gobernanza de partida

| Elemento | Estado |
|----------|--------|
| Fase 2 Bootstrap Runtime | ✅ Cerrada — congelada |
| Fase 3 MOD-002 Session Manager | ✅ Cerrada localmente (`45b8b6a`) |
| Rama planificación | `plan/v2-phase-4-api-client` (local, sin push) |
| PR #117 remoto | `d847e19` — intacto |
| `origin/main` | `13bb4c4` — intacto |
| V1 / producción | Congeladas |

### MOD-005 en catálogo

| Campo | Valor actual |
|-------|--------------|
| Estado documental | ✅ DOCUMENTADO |
| Estado runtime | ⏳ PENDIENTE |
| Validación | ⏳ PENDIENTE |
| Ticket spec | TICKET-V2-SHARED-CORE-010 |
| Ubicación | `MiamiDJBeat-MigracionV2/shared/api/` |

### Hallazgo principal

`shared/api/` contiene **únicamente 5 archivos Markdown**. No existe `shared/api/runtime/`, no hay entrada en `bootstrap/boot.ts`, no hay tests `api*.test.ts`, no hay export en `tsconfig`/`vite` aliases.

---

## 3. Inventario

### 3.1 Documentación MOD-005

| Archivo | Responsabilidad | Documental | Runtime | Tests | Dependencias | Deuda |
|---------|-----------------|------------|---------|-------|--------------|-------|
| `shared/api/README.md` | Índice módulo | DOCUMENTADO | — | — | CONTRACTS §5 | — |
| `shared/api/API-CLIENT-SPEC.md` | Responsabilidad, reglas, adapters futuros, init order | DOCUMENTADO | — | — | MOD-006, MOD-002, MOD-010, MOD-014, MOD-004 | Adapters Supabase/Edge spec-only |
| `shared/api/REQUEST-RESPONSE-CONTRACT.md` | `ApiRequest` / `ApiResponse` shapes | DOCUMENTADO | — | — | Configuration defaults | Sin tipos TS runtime |
| `shared/api/API-ERRORS.md` | `ApiError`, ERR-05xx mapping | DOCUMENTADO | — | — | MOD-014 | `normalizeApiError` no implementado |
| `shared/api/API-RETRY-TIMEOUT-RULES.md` | Timeout, retry, cancel, correlationId | DOCUMENTADO | — | — | MOD-006 keys `api.timeout.*` | Keys timeout no en `AppConfig` runtime |

### 3.2 Contratos transversales

| Archivo | Responsabilidad | Documental | Runtime | Tests | Clasificación |
|---------|-----------------|------------|---------|-------|---------------|
| `shared/CONTRACTS.md` §5 | Resumen API Client | DOCUMENTADO | PARCIAL (spec vs runtime) | — | DOCUMENTADO |
| `docs/V2/ARCHITECTURE/ERROR-MAP.md` | ERR-0500–0599 authority | DOCUMENTADO | PARCIAL (catalog parcial en errors runtime) | error-handler tests | DOCUMENTADO |
| `docs/V2/ARCHITECTURE/DEPENDENCY-MAP.md` | MOD-005 deps | DOCUMENTADO | — | — | DOCUMENTADO |
| `docs/V2/ARCHITECTURE/BOOT-SEQUENCE.md` | API Client post-Config | DOCUMENTADO | AUSENTE en boot chain | boot-config tests | DOCUMENTADO / runtime AUSENTE |

### 3.3 Módulos relacionados (runtime existente)

| Archivo / área | Responsabilidad | Documental | Runtime | Tests | Dependencia MOD-005 |
|----------------|-----------------|------------|---------|-------|---------------------|
| `shared/config/runtime/` | Env, `api.publicUrl`, `api.anonKey` | DOCUMENTADO | IMPLEMENTADO | `config.test.ts` | **Obligatoria** foundation |
| `shared/session/runtime/` | Snapshot, `accessTokenRef` opaco | DOCUMENTADO | IMPLEMENTADO | 21+ session tests | **Obligatoria** (read-only token injection) |
| `shared/logging/runtime/` | Logs estructurados redactados | DOCUMENTADO | IMPLEMENTADO | `logging.test.ts` | **Obligatoria** post-request meta |
| `shared/errors/runtime/` | `normalizeError`, ERR catalog | DOCUMENTADO | IMPLEMENTADO | `error-handler.test.ts` | **Obligatoria** — falta rama ApiError |
| `shared/events/runtime/` | Event Bus, `SYSTEM_ERROR` | DOCUMENTADO | IMPLEMENTADO | `event-bus.test.ts` | **Opcional** fatal transport |
| `shared/auth/` (6 MD) | Auth spec, provider contract | DOCUMENTADO | AUSENTE | `session-auth-boundary.test.ts` (mock) | **Futura** — no bloquea foundation |
| `bootstrap/boot.ts` | Cadena boot F2/F3 | DOCUMENTADO | IMPLEMENTADO | `boot-config.test.ts`, `runtime.test.ts` | **Futura** wire API init — congelado F2/F3 |
| `shared/runtime/` | Registry, `SYSTEM_READY` | DOCUMENTADO | IMPLEMENTADO | `runtime.test.ts` | **Sin acoplamiento** directo foundation |

### 3.4 Clasificación por capa (A–J)

| Capa | Estado | Evidencia |
|------|--------|-----------|
| **A. API Client genérico** | AUSENTE | No `ApiClient` class, no `createApiClient` |
| **B. Transporte HTTP** | AUSENTE | No `fetch` wrapper, no transport interface |
| **C. Supabase Client** | DOCUMENTADO / AUSENTE runtime | `SupabaseRestAdapter` solo en spec §12 |
| **D. Edge Functions** | DOCUMENTADO / AUSENTE runtime | `EdgeInvokeAdapter` spec-only; **FUERA DE ALCANCE** foundation |
| **E. Error normalization** | PARCIAL | ERR-0500/0502 en `errors/runtime/catalog.ts`; sin `normalizeApiError` |
| **F. Retry / timeout / cancellation** | DOCUMENTADO / AUSENTE runtime | Reglas completas en MD; sin código |
| **G. Request context** | DOCUMENTADO / AUSENTE runtime | `correlationId`, `requestId`, `meta` en contract MD |
| **H. Logging** | IMPLEMENTADO (genérico) | Sin hooks API-specific; LOG-REDACTION-RULES documenta body redaction |
| **I. Session integration** | PARCIAL | `accessTokenRef` opaco en Session; sin `SessionReader` port para API |
| **J. Runtime integration** | AUSENTE | Boot no inicializa API Client; spec orden: post Error Handler |

### 3.5 Tests existentes relacionados

| Archivo | Relación MOD-005 | Estado |
|---------|------------------|--------|
| `tests/unit/error-handler.test.ts` | ERR-05xx catalog entries | Indirecto — no ApiError |
| `tests/unit/config.test.ts` | `MDJ_V2_API_PUBLIC_URL`, `MDJ_V2_API_ANON_KEY` | Config only |
| `tests/unit/session-auth-boundary.test.ts` | Mock AuthHandle — futuro bearer source | Boundary mock |
| `tests/unit/api*.test.ts` | — | **AUSENTE** |

**Suite actual:** 325/325 PASS — ningún test cubre MOD-005.

---

## 4. Dependencias

| Dependencia | Foundation MOD-005 | Notas |
|-------------|-------------------|-------|
| **MOD-006 Configuration** | Obligatoria · ya operativa | `api.publicUrl`, `api.anonKey` existen; `api.timeout.*` **pendiente** en `AppConfig` |
| **MOD-002 Session Manager** | Obligatoria · ya operativa | Read-only `SessionReader` para `Authorization`; `cancelAll` en logout — **sin modificar** session-provider en foundation si port interface basta |
| **MOD-010 Logging** | Obligatoria · ya operativa | Meta redacted post-request |
| **MOD-014 Error Handler** | Obligatoria · parcial | Extender con `normalizeApiError` o branch en `normalizeError` — ticket acotado |
| **MOD-004 Event Bus** | Opcional | `SYSTEM_ERROR` en fatal transport — ADR |
| **MOD-003 Permissions** | Prohibida en API Client | Caller valida `hasCapability()` — spec A-02 |
| **MOD-001 Authentication** | Futura para adapter real | **No obligatoria** para foundation con mock transport |
| **Supabase SDK / REST** | Futura · prohibida foundation | Adapter spec-only |
| **Edge Functions reales** | Futura · prohibida foundation | Mock transport simula status/body |
| **MOD-007 Theme** | Sin dependencia | Congelado Fase 2 |
| **Portales / bootstrap** | Futura wire | Congelado F2/F3 salvo ticket explícito |

### Init order documentado (spec)

```
Configuration → Logging → Event Bus → Session → Permissions → Error Handling → API Client
```

Boot actual (`boot.ts`) termina en Session → Runtime → SYSTEM_READY → Theme. **API Client no está cableado** — wire en ticket futuro separado con autorización PO.

---

## 5. Comparación MOD-005 vs MOD-001

### RUTA A — MOD-005 API Client antes de MOD-001 Authentication

| Criterio | Evaluación |
|----------|------------|
| Acoplamiento | Bajo — foundation usa `SessionReader` + mock token ref |
| Testabilidad | Alta — `MemoryTransport` / `MockTransport` sin red |
| Riesgo | Bajo — sin credenciales, sin egress real |
| Dependencias | MOD-006, MOD-010, MOD-014 operativos; MOD-001 no requerido |
| Mocks | Transport inyectable; respuestas determinísticas |
| Impacto Session | Mínimo — interface read-only; `cancelAll` hook documentado |
| Impacto Configuration | Menor — opcional extender `api.timeout.*` |
| Supabase futuro | Adapter implementa mismo `ApiRequest`→`ApiResponse` |

### RUTA B — MOD-001 Authentication antes de MOD-005 API Client

| Criterio | Evaluación |
|----------|------------|
| Acoplamiento | Alto — Auth provider contract prevé usar API Client para Edge/OAuth |
| Testabilidad | Media — Auth sin transport requiere duplicar fetch o violar single egress |
| Riesgo | Alto — Supabase Auth implica secretos, redirects, refresh flows |
| Dependencias | Auth bloquea en proveedor externo antes de tener egress normalizado |
| Mocks | Auth mock ya existe en session boundary; no sustituye transport layer |
| Impacto Session | Auth handoff ya operativo con mock — no aporta transport |
| Violación arquitectura | Auth adapter sin API Client rompe regla single egress (AUTH-SPEC §10) |

### Decisión recomendada

**RUTA A — MOD-005 foundation antes de MOD-001 Authentication real.**

Fundamento:

1. `API-CLIENT-SPEC.md` y `AUTH-SPEC.md` establecen que Auth **no expone HTTP** y su adapter futuro **puede usar** API Client — el transporte es prerrequisito infra, no dependiente de Auth.
2. `DEPENDENCY-MAP.md` lista MOD-005 dependiendo de MOD-006/MOD-010/MOD-014 — **no** MOD-001.
3. Foundation con mock/memory transport valida contratos y pipeline sin Supabase.
4. MOD-001 real introduce Supabase Auth, refresh, OAuth — scope separado y mayor riesgo; no bloquea tests de timeout/retry/cancel.
5. Session ya expone `accessTokenRef` opaco compatible con inyección mock de `Authorization`.

MOD-001 seguirá en cola **después** de MOD-005 foundation aprobada por PO, en ticket dedicado con adapter que consume `ApiClient`.

---

## 6. Alcance propuesto — ticket futuro MOD-005 foundation

### Incluye (localhost lab únicamente)

| Entregable | Descripción |
|------------|-------------|
| Contratos tipados | `ApiRequest`, `ApiResponse`, `ApiError`, `RetryPolicy` en `shared/api/runtime/types.ts` |
| `ApiClient` | `createApiClient(config, deps)` — factory por portal (spec A-10) |
| Request pipeline | Headers inject, correlationId, parse, success validation, error normalize |
| `TransportPort` | Interface `execute(request): Promise<TransportResult>` |
| `MockTransport` | Respuestas programables status/body/delay/fail |
| `MemoryTransport` | Cola FIFO de respuestas para tests |
| Timeout | `AbortController` + `API_TIMEOUT` / ERR-0502 |
| Cancellation | `cancel(requestId)`, `cancelAll()`, `AbortSignal` |
| Retry policy | Eligibility matrix spec §2 — GET default, mutations `retrySafe` |
| HTTP error normalization | Map status → `ApiError` → Error Handler |
| Request context | `requestId`, `correlationId`, `durationMs`, `attempt` |
| Tests unitarios | `tests/unit/api-client-foundation.test.ts` — matriz §8 |
| Test resets | `resetApiClientForTests()` — patrón session/events |

### Excluye explícitamente

- Supabase client / REST real
- Edge Functions reales
- Stripe proxy
- Credenciales live / service_role
- `fetch` a APIs externas en CI default
- Persistencia real
- Cambios en `client/`, `artist/`, `staff/` shells
- Cambios en `bootstrap/boot.ts` (wire init) — ticket separado post-foundation
- Cambios en `web/` V1
- Producción

### Extensiones mínimas permitidas en módulos congelados (ticket implementación futuro)

| Módulo | Cambio | Justificación |
|--------|--------|---------------|
| MOD-014 Error Handler | `normalizeApiError()` o branch ApiError | Spec API-ERRORS.md § Normalización |
| MOD-006 Configuration | `api.timeout.readMs` etc. (opcional) | Spec API-RETRY-TIMEOUT-RULES §6 — defaults hardcoded si PO rechaza config touch |
| `tsconfig` / `vite` / `vitest` | Alias `@mdj/shared/api` | Patrón otros módulos shared |

**MOD-002 Session:** preferir **interface nueva** `SessionReaderPort` en `shared/api/runtime/` que lea snapshot existente — evitar editar `session-provider.ts` si PO mantiene Fase 3 congelada.

---

## 7. Archivos propuestos

### 7.1 Existentes — podrían modificarse (ticket implementación futuro)

| Archivo | Cambio potencial | Congelamiento |
|---------|------------------|---------------|
| `MiamiDJBeat-MigracionV2/shared/errors/runtime/error-handler-service.ts` | Rama ApiError | Fase 2 operativo — cambio acotado con ticket |
| `MiamiDJBeat-MigracionV2/shared/errors/runtime/types.ts` | Tipos ApiError input | Idem |
| `MiamiDJBeat-MigracionV2/shared/errors/runtime/index.ts` | Export `normalizeApiError` | Idem |
| `MiamiDJBeat-MigracionV2/shared/config/runtime/types.ts` | `api.timeout.*` opcional | Fase 0 — cambio mínimo |
| `MiamiDJBeat-MigracionV2/tsconfig.json` | Path alias `@mdj/shared/api` | Infra lab |
| `MiamiDJBeat-MigracionV2/vite.config.ts` | Alias resolve | Infra lab |
| `MiamiDJBeat-MigracionV2/vitest.config.ts` | Alias resolve | Infra lab |

### 7.2 Nuevos — podrían crearse

```
MiamiDJBeat-MigracionV2/shared/api/runtime/
  index.ts
  types.ts
  errors.ts
  transport-port.ts
  mock-transport.ts
  memory-transport.ts
  retry-policy.ts
  request-pipeline.ts
  api-client.ts
  api-service.ts          # singleton/factory + resetSessionForTests pattern
  session-reader-port.ts  # read-only token/sessionId
  redact.ts               # header/body deny list (align LOG-REDACTION-RULES)

MiamiDJBeat-MigracionV2/tests/unit/
  api-client-foundation.test.ts
```

### 7.3 Congelados — no tocar sin ticket PO explícito

| Área | Motivo |
|------|--------|
| `bootstrap/boot.ts` | Fase 2 cerrada — wire API init = ticket aparte |
| `shared/session/runtime/session-provider.ts` | Fase 3 cerrada |
| `shared/session/runtime/session-registry.ts` | Fase 3 cerrada |
| `shared/events/runtime/catalog.ts` | Fase 2 MOD-004 validado PO |
| `shared/theme/runtime/` | Fase 2 MOD-007 validado PO |
| `client/`, `artist/`, `staff/` | Sin cambios portales en foundation |
| `web/` V1 | Producción congelada |
| `supabase/` | Fuera de alcance lab |
| PR #117 branch | Intacto |

### 7.4 Documentos a actualizar al cierre de implementación (futuro)

| Documento | Actualización |
|-----------|---------------|
| `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` | MOD-005 runtime + validación |
| `docs/V2/NOTA-DIARIA-LAB-001.md` | Entrada Fase 4 implementación |
| `docs/V2/SESSION-SUMMARIES/2026-07-10-PHASE-4-MOD-005-CLOSURE.md` | Cierre (nombre tentativo) |
| `docs/V2/SHARED-CORE-PROGRESS.md` | MOD-005 IMPLEMENTADO |

**Este ticket de planificación solo crea el presente documento.**

---

## 8. Matriz de pruebas futuras

Archivo propuesto: `tests/unit/api-client-foundation.test.ts`

| # | Caso | Método / condición | Expectativa mínima |
|---|------|-------------------|-------------------|
| 1 | GET success | GET 200 JSON | `ok: true`, `data` parsed |
| 2 | POST success | POST 201 | `ok: true` |
| 3 | PUT success | PUT 200 | `ok: true` |
| 4 | DELETE success | DELETE 204 | `ok: true` |
| 5 | HTTP 400 | status 400 | `ok: false`, `API_HTTP_ERROR` o `API_EDGE_REJECTED` |
| 6 | HTTP 401 | status 401 | `ok: false`, no auto-retry |
| 7 | HTTP 403 | status 403 | `ok: false`, no auto-retry |
| 8 | HTTP 404 | status 404 | `ok: false`, no retry |
| 9 | HTTP 409 | status 409 | `ok: false`, no retry |
| 10 | HTTP 422 | status 422 | `API_EDGE_REJECTED`, `detail` surfaced |
| 11 | HTTP 500 | status 500 GET | retry si eligible; final `ok: false` |
| 12 | Timeout | delay > timeoutMs | `API_TIMEOUT` / ERR-0502 |
| 13 | Cancellation | AbortSignal abort | `API_CANCELLED`, no retry |
| 14 | cancel(requestId) | in-flight abort | `API_CANCELLED` |
| 15 | cancelAll() | múltiples in-flight | todos cancelled |
| 16 | Network failure | transport throws | `API_NETWORK` |
| 17 | Retry permitido | GET + network fail | `attempt` > 1, mismo correlationId |
| 18 | Retry prohibido | POST sin retrySafe | single attempt |
| 19 | Retry prohibido | 401 | single attempt |
| 20 | Payload inválido | body no serializable | error pre-flight |
| 21 | Response inválida | malformed JSON | `API_PARSE_ERROR` |
| 22 | Edge 200 + `{error}` | business error flag | `ok: false` |
| 23 | Request context | any request | `requestId`, `correlationId`, `durationMs` present |
| 24 | Header injection | authenticated session mock | `Authorization` from SessionReader |
| 25 | Redacción sensibles | log meta | no Authorization en log fields |
| 26 | Sin Supabase real | MockTransport only | zero real HTTP |
| 27 | Sin llamadas externas | MemoryTransport | deterministic queue |
| 28 | Error normalization | ApiError | ERR-05xx via Error Handler |
| 29 | Config missing baseUrl | adapter config error | `API_CONFIG_ERROR` |
| 30 | Logout cancelAll hook | simulate SESSION_DESTROYED | in-flight cleared |

**Gate suite:** foundation tests + regresión 325 existentes + typecheck + build.

---

## 9. Riesgos

| # | Riesgo | Severidad | Mitigación |
|---|--------|-----------|------------|
| R-01 | Tocar módulos congelados F2/F3 (boot, session-provider) | Alta | Port interfaces; wire boot en ticket separado |
| R-02 | Scope creep hacia Supabase real | Alta | Contract tests + MockTransport only en foundation |
| R-03 | `normalizeApiError` diverge de API-ERRORS.md | Media | Tests tabla status → code → ERR |
| R-04 | Config sin `api.timeout.*` | Baja | Defaults inline matching spec; config extend opcional |
| R-05 | Singleton cross-portal | Media | Factory per portal (spec A-10); tests aislamiento |
| R-06 | Retry peligroso en mutations | Alta | Tests explícitos POST sin retrySafe |
| R-07 | Scripts `mdj-alias-loader.mjs` | Baja | Deuda documentada Fase 2/3 — ticket separado |
| R-08 | Implementar antes de aprobación PO | Alta | **Este ticket bloquea implementación** |

---

## 10. Restricciones de gobernanza

| Regla | Estado |
|-------|--------|
| Solo localhost lab | ✅ |
| Sin commit en planning ticket | ✅ |
| Sin push / PR / Preview / merge / deploy | ✅ |
| No tocar V1 `web/` | ✅ |
| No modificar PR #117 | ✅ |
| No reabrir Fase 2 ni Fase 3 | ✅ |
| No abrir implementación MOD-005 sin ticket PO | ✅ |
| No abrir MOD-001 en paralelo sin orden PO | ✅ |
| Documento único autorizado | `docs/V2/PHASE-4-MOD-005-API-CLIENT-PLANNING.md` |

---

## 11. Criterios de entrada para implementación

El Product Owner debe aprobar explícitamente un ticket de implementación (ej. `TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001`) que confirme:

| # | Criterio |
|---|----------|
| E-01 | Aceptación de **Ruta A** (MOD-005 antes de MOD-001 real) o override documentado |
| E-02 | Lista exacta de archivos autorizados (§7) |
| E-03 | Congelamiento F2/F3 respetado — boot wire opcional en ticket separado |
| E-04 | Mock/Memory transport únicamente — sin Supabase/Edge/Stripe real |
| E-05 | Matriz de pruebas §8 como gate mínimo |
| E-06 | Regresión 325/325 + typecheck + build |
| E-07 | Validación visual PO en portales **no requerida** para foundation (sin UI change) |
| E-08 | Autorización de extensión mínima MOD-014 (`normalizeApiError`) |
| E-09 | Rama de trabajo propuesta: `feat/v2-phase-4-api-client` desde `45b8b6a` o descendiente |
| E-10 | Sin push hasta frase `APROBADO PUSH` del Capitán |

---

## Referencias

| Documento | Ruta |
|-----------|------|
| API Client spec | `MiamiDJBeat-MigracionV2/shared/api/API-CLIENT-SPEC.md` |
| Request/Response | `MiamiDJBeat-MigracionV2/shared/api/REQUEST-RESPONSE-CONTRACT.md` |
| API Errors | `MiamiDJBeat-MigracionV2/shared/api/API-ERRORS.md` |
| Retry/Timeout | `MiamiDJBeat-MigracionV2/shared/api/API-RETRY-TIMEOUT-RULES.md` |
| Dependency map | `docs/V2/ARCHITECTURE/DEPENDENCY-MAP.md` |
| Module catalog | `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` |
| Fase 3 closure | `docs/V2/SESSION-SUMMARIES/2026-07-10-PHASE-3-MOD-002-CLOSURE.md` |
| Auth spec §10 | `MiamiDJBeat-MigracionV2/shared/auth/AUTH-SPEC.md` |

---

*FASE 4 — MOD-005 API CLIENT — PLANIFICACIÓN COMPLETA — PENDIENTE DE APROBACIÓN DEL PRODUCT OWNER.*

*NO IMPLEMENTAR · NO COMMIT · NO PUSH*
