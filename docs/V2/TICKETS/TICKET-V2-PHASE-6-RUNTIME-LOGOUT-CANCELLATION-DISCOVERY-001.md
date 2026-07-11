# TICKET-V2-PHASE-6-RUNTIME-LOGOUT-CANCELLATION-DISCOVERY-001

## Estado

**DISCOVERY COMPLETADO — IMPLEMENTACIÓN NO AUTORIZADA**

| Campo | Valor |
|-------|-------|
| Modo | Solo lectura de código + documentación en `docs/V2/**` |
| Fecha discovery | 2026-07-11 |
| Rama analizada | `plan/v2-phase-4-api-client` |
| HEAD analizado | `d43573241f88821702a4d8b4b05febda3e0969a4` |
| Suite baseline | **471/471 PASS** · **45/45 files** |
| Autorización PO | Discovery únicamente — sin runtime, tests, commit, push, PR, merge, preview ni deploy |

---

## Problema

MOD-005 API Client **implementa** `cancelAll()` y la especificación documenta que logout / `SESSION_DESTROYED` deben invocarlo. En el runtime actual **no existe cableado de producción** que conecte `USER_LOGOUT` (ni `destroySession`) con `cancelAll()`.

Consecuencia: al cerrar sesión, Session invalida credenciales y Auth emite `USER_LOGOUT`, pero las requests HTTP in-flight pueden seguir hasta completarse. Un caller que aplique la respuesta sin comprobar sesión puede observar datos del usuario anterior. La deuda es **integración lifecycle**, no ausencia del método.

---

## Evidencia actual

| Archivo | Símbolo | Evidencia |
|---------|---------|-----------|
| `shared/api/runtime/api-client.ts` | `cancelAll()` | Aborta todos los `operationAbort` e `inFlight` con razón `'cancel-all'`; limpia ambos `Map` |
| `shared/api/runtime/api-client.ts` | `cancel(requestId)` | Aborta una operación y sus intentos `_aN` |
| `shared/api/runtime/api-client.ts` | `inFlight` | `Map<string, { controller: AbortController }>` — un controller por intento |
| `shared/api/runtime/api-client.ts` | `operationAbort` | `Map<string, AbortController>` — un controller por `requestId` lógico |
| `shared/api/runtime/api-client.ts` | `request()` | Crea `operationController` + `controller` por intento; registra en maps; `mergeAbortSignals` |
| `shared/api/runtime/types.ts` | `ApiClientPublicApi.cancelAll` | Firma pública congelada en facade |
| `shared/api/runtime/api-service.ts` | `resetApiClientForTests()` | Solo `frozenClient = null` + `API_UNINITIALIZED` — **no** llama `cancelAll()` |
| `shared/api/API-CLIENT-SPEC.md` | `cancelAll` | Documentado como `// logout hook` |
| `shared/api/API-RETRY-TIMEOUT-RULES.md` | §3 Cancel | `Session SESSION_DESTROYED / logout → cancelAll mandatory` |
| `shared/auth/runtime/auth-service.ts` | `signOut()` | Emite `USER_LOGOUT` vía `emitUserLogout()`; no toca API Client |
| `shared/auth/runtime/auth-service.ts` | `emitUserLogout()` | `publishAuthEvent('USER_LOGOUT', { reason, userId })` |
| `shared/session/runtime/session-listeners.ts` | `USER_LOGOUT` subscribe | Delega a `handlers.onUserLogout` — sin cancelación de red |
| `shared/session/runtime/session-provider.ts` | `handleUserLogoutEvent()` | `clearSession(logout.reason)` si `frozenApi` y no `logoutInProgress` |
| `shared/session/runtime/session-provider.ts` | `clearSession()` | Limpia credential/identity; `refreshInFlight = null`; rebootstrap anónimo |
| `shared/session/runtime/session-provider.ts` | `destroySession()` | Emite `SESSION_DESTROYED`; invalida store — sin cancelación de red |
| `shared/session/runtime/session-provider.ts` | `rebootstrapAnonymousMachine()` | Emite `SESSION_DESTROYED` tras logout normal |
| `bootstrap/boot.ts` | `bootScaffold()` | CONFIG → BUS → … → Session → Auth activate → **API** → Runtime — sin listener logout→cancel |
| `bootstrap/initialize-api.ts` | `initializeApiForBoot()` | Crea singleton + `sessionReader`; sin suscripción a `USER_LOGOUT` |
| `shared/runtime/runtime-service.ts` | `registerCoreModules()` | Registry estático; **no** coordina cancelaciones |
| `shared/runtime/event-wiring.ts` | `wireRuntimeEventBus()` | Observa readiness; **no** `USER_LOGOUT` ni `SESSION_DESTROYED` |
| `shared/events/runtime/event-bus-service.ts` | `dispatchToListeners()` | Handlers en orden FIFO de suscripción (snapshot síncrono) |
| `tests/unit/api-client-foundation.test.ts` | `cancelAll aborts in-flight` | Único test de `cancelAll` — instancia directa, no boot/logout |
| `tests/unit/boot-api-wiring.test.ts` | post-logout Authorization | Valida header omitido tras `signOut()`; **no** in-flight durante logout |
| `tests/unit/session-authorization.test.ts` | `clearSession` / `destroySession` | Valida slot Authorization; sin API in-flight |

---

## Flujo actual de logout

### Auth → Session → Event Bus → Runtime/API

```
Usuario / caller
  → AuthService.signOut() | requestLogout()
      → (opcional) provider.signOut()
      → emitUserLogout(reason, userId)
          → Event Bus publish USER_LOGOUT
              → [único subscriber productivo hoy]
              → SessionProvider.handleUserLogoutEvent()
                  → clearSession(reason)
                      → store.clearCredential() / clearIdentity()
                      → rebootstrapAnonymousMachine()
                          → SESSION_DESTROYED (Event Bus)
                      → snapshot ANONYMOUS ready
      → Auth clearIdentity() + UNAUTHENTICATED

API Client (paralelo — sin listener):
  → in-flight requests continúan hasta settle o timeout
  → nuevas requests leen sessionReader ya sin Authorization
```

### Destroy (sin USER_LOGOUT)

```
destroySession(reason)
  → clearCredential()
  → SESSION_DESTROYED
  → invalidateSnapshot() / frozenApi = null
  → API Client singleton sigue vivo; in-flight no canceladas
```

### Reset de tests

```
resetApiClientForTests()
  → descarta referencia singleton sin cancelAll()
  → riesgo de promises huérfanas si tests dejaron requests pendientes
```

---

## Recursos cancelables

| Recurso | Propietario | Registro | Cancelación hoy | Debe cancelarse en logout |
|---------|-------------|----------|-----------------|---------------------------|
| HTTP in-flight (transport) | MOD-005 | `inFlight` Map | `cancel` / `cancelAll` | **Sí** |
| Operación lógica (retry loop) | MOD-005 | `operationAbort` Map | `cancel` / `cancelAll` | **Sí** |
| Timeout por intento | MOD-005 | `setTimeout` en `request()` | `clearTimeout` al abort/settle | Automático si abort |
| Session `refreshInFlight` | MOD-002 | campo privado | `clearSession` pone `null` | **Sí** (ya parcial) |
| Event Bus subscriptions | MOD-004 | `listenerRegistry` | `unsubscribe` / test resets | **No** en logout normal |
| Runtime Registry | MOD-RUNTIME | Map estático boot | N/A | **No** — snapshot boot-time |
| Auth provider signOut | MOD-001 | async provider | independiente | **No** sustituye cancelAll |
| Timers globales / UI | fuera V2 lab | — | — | Fuera de alcance ticket |

---

## Riesgos confirmados

| Riesgo | Clasificación | Evidencia |
|--------|---------------|-----------|
| Request in-flight completa tras `signOut()` si nadie llama `cancelAll()` | **CONFIRMADO** | `cancelAll` existe pero no está cableado; `boot-api-wiring` no prueba in-flight |
| Respuesta tardía entregada al caller (Promise resuelve con `ok: true`) post-logout | **CONFIRMADO** | Transport async sin abort; caller puede mutar estado local |
| Header Authorization de request ya despachada sigue siendo el del usuario anterior | **CONFIRMADO** | `buildHeaders()` corre al inicio de `request()` — diseño esperado |
| Nuevas requests post-`clearSession` omiten Authorization | **CONFIRMADO** | `boot-api-wiring.test.ts` «omits Authorization after logout» |
| `resetApiClientForTests()` no aborta in-flight | **CONFIRMADO** | `api-service.ts` líneas 61–64 |
| `destroySession()` no cancela red | **CONFIRMADO** | `destroySession` sin referencia a MOD-005 |
| Registry MOD-005 stale tras logout | **NO OBSERVADO** como bug | Política estática aceptada (`runtime-registry-auth`) |
| Event Bus almacena credenciales | **NO OBSERVADO** | Payload `USER_LOGOUT` = `{ reason, userId }` |
| Memory leak por maps `inFlight`/`operationAbort` | **POSIBLE** | `finally` limpia `operationAbort`; abort debería limpiar intentos — sin cancelAll en logout maps pueden quedar hasta settle |
| Relogin hereda requests del usuario anterior | **POSIBLE** | Mismo singleton API; sin cancelAll requests del user A pueden resolver tras login user B |
| Refresh Session concurrente durante logout | **POSIBLE** | `clearSession` anula `refreshInFlight`; Auth `refresh()` separado no auditado aquí |

---

## Alternativas evaluadas

### A. Listener directo de USER_LOGOUT en API Client

| Criterio | Evaluación |
|----------|------------|
| Acoplamiento | **Alto** — MOD-005 importaría Event Bus + conocería `USER_LOGOUT` |
| Encapsulación | Baja — API Client deja de ser egress puro |
| Orden logout | Session ya suscrito primero; API segundo si se registra en boot |
| Testabilidad | Media |
| Circular imports | Riesgo MOD-005 ↔ events |
| Arquitectura actual | **Violación** frontera («API Client no importa Session internals» extensible a no orquestar auth) |
| Costo | Bajo líneas |
| Regresión | Media |

**Veredicto:** Rechazada.

### B. Composition root conecta USER_LOGOUT → apiClient.cancelAll()

| Criterio | Evaluación |
|----------|------------|
| Acoplamiento | **Bajo** — solo `bootstrap/initialize-api.ts` conoce ambos |
| Encapsulación | Alta — Session/Auth sin importar MOD-005 |
| Orden logout | Session subscriber primero (boot order); `cancelAll` mismo tick síncrono después |
| Testabilidad | Alta — test boot puede asertar abort durante `signOut()` |
| Idempotencia | `cancelAll` vacío es no-op |
| Impacto boot | Mínimo — suscripción tras `initializeApiClient` |
| Arquitectura | **Alineada** con `BOOT-SEQUENCE.md` y opaque-auth |
| Costo | Bajo |
| Regresión | Baja |

**Veredicto:** **Recomendada (núcleo).**

### C. Session lifecycle hook inyectado en bootstrap

| Criterio | Evaluación |
|----------|------------|
| Acoplamiento | Bajo — Session recibe callback opaco `preClearHook` |
| Orden logout | **Óptimo** — `cancelAll` antes de `clearSession` |
| Testabilidad | Alta |
| Costo | Medio — tocar MOD-002 types + provider + bootstrap |
| Arquitectura | Válida pero más invasiva que B para mismo resultado en tick síncrono |

**Veredicto:** Opcional como mejora de orden; no requerida si B garantiza mismo event dispatch.

### D. Runtime coordinator central

| Criterio | Evaluación |
|----------|------------|
| Acoplamiento | MOD-RUNTIME orquestaría cancelaciones |
| Arquitectura | **Prohibida** por ticket — «Runtime Registry no coordina cancelaciones» |
| Costo | Alto |

**Veredicto:** Rechazada.

### E. Solo resetApiClientForTests() hace cancelAll() — anti-pattern

| Criterio | Evaluación |
|----------|------------|
| Producción | **Sin protección** en logout real |
| Tests | Mejora parcial aislamiento |
| Arquitectura | Insuficiente |

**Veredicto:** Complemento test-only; no sustituye B.

---

## Diseño recomendado

**Opción B** como arquitectura única, con extensiones mínimas:

1. **Propietario de `cancelAll()`:** MOD-005 API Client (implementación ya existe).
2. **Invocador:** composition root — `bootstrap/initialize-api.ts` (función dedicada p. ej. `wireApiClientLogoutCancellation()`).
3. **Señal primaria:** `USER_LOGOUT` (logout usuario / `signOut` / `requestLogout`).
4. **Señal secundaria:** `SESSION_DESTROYED` (idempotente) para `destroySession()` sin pasar por `USER_LOGOUT`.
5. **Registry / Runtime:** sin cambios.
6. **Tests:** `resetApiClientForTests()` debe invocar `cancelAll()` si `frozenClient` existe antes de null (E como complemento).

---

## Contrato conceptual

| Aspecto | Contrato |
|---------|----------|
| Propietario | MOD-005 — método `cancelAll()` ya en `ApiClientPublicApi` |
| Invocador | Bootstrap composition root — **no** Session, **no** Auth, **no** MOD-RUNTIME |
| Firma conceptual | `cancelAll(): void` — síncrono, idempotente, reentrante seguro |
| Momento | Al recibir `USER_LOGOUT` y `SESSION_DESTROYED` (mismo proceso sync del bus) |
| Orden vs `clearSession` | Aceptable: Session primero (suscripción existente), `cancelAll` inmediatamente después en el mismo dispatch; credencial ya invalidada + red abortada en un tick |
| Orden vs `USER_LOGOUT` | Listener bootstrap registrado tras Session — segundo handler del evento |
| Requests nuevas durante logout | Tras `clearSession`, `sessionReader` sin Authorization; tras `cancelAll`, in-flight abortadas |
| Errores | Abort → `API_CANCELLED` / ERR-0504; **no** retry; ignorar errores del transport al abort; no propagar a Session |
| Observabilidad | Log `info` existente en cancel path; sin tokens en payload |
| Secretos | `cancelAll` no lee ni expone credenciales |
| Destroy | `SESSION_DESTROYED` dispara `cancelAll` idempotente |
| Reset tests | `cancelAll` + drop singleton |
| Relogin | Singleton conservado; maps vacíos tras cancelAll — sin herencia in-flight |

---

## Orden de lifecycle

```
signOut()
  1. Auth provider signOut (async I/O)
  2. emit USER_LOGOUT
  3. [handler 1] Session handleUserLogoutEvent → clearSession (credential null)
  4. [handler 2 — PROPUESTO] bootstrap → getApiClient().cancelAll()
  5. SESSION_DESTROYED (desde rebootstrap)
  6. [handler 3 — PROPUESTO opcional] cancelAll idempotente si solo destroy path

destroySession() sin USER_LOGOUT:
  1. clearCredential + SESSION_DESTROYED
  2. [PROPUESTO] cancelAll vía listener SESSION_DESTROYED
```

---

## Archivos potenciales

### Necesarios (implementación futura)

| Archivo | Cambio conceptual |
|---------|-------------------|
| `bootstrap/initialize-api.ts` | Suscripción `USER_LOGOUT` + `SESSION_DESTROYED` → `getApiClient().cancelAll()` |
| `shared/api/runtime/api-service.ts` | `resetApiClientForTests()` llama `cancelAll()` antes de null |
| `tests/unit/boot-api-wiring.test.ts` | Caso in-flight abortado en `signOut()` |
| `tests/unit/api-client-foundation.test.ts` | Caso `resetApiClientForTests` con request pendiente (opcional) |

### Posibles

| Archivo | Cambio |
|---------|--------|
| `bootstrap/boot.ts` | Invocar wire explícito si se separa de `initializeApiForBoot` |
| `docs/V2/ARCHITECTURE/BOOT-SEQUENCE.md` | Nota lifecycle cancelación post-PO |

### Prohibidos

| Área | Razón |
|------|-------|
| `shared/session/runtime/*` imports API | Frontera Session ↛ API Client |
| `shared/auth/runtime/*` imports API | Frontera Auth ↛ API Client |
| `shared/runtime/registry.ts` coordinación | Registry solo observabilidad |
| `web/**` UI V1 | Fuera de alcance |
| FetchTransport / Supabase | No requeridos para cancelAll |
| Producción V1 | Intacta |

### Tests (futuro)

| Suite | Escenarios |
|-------|------------|
| `boot-api-wiring.test.ts` | Logout durante request; relogin; destroy |
| `api-client-foundation.test.ts` | Idempotencia `cancelAll` ×2 |
| `session.test.ts` | Sin duplicar — integración vía boot |

### Docs

| Archivo | Estado |
|---------|--------|
| Este ticket | ✅ Discovery |
| `NOTA-DIARIA-LAB-001.md` | ✅ Sección discovery |
| `MiamiDJBeat-V2-MODULE-CATALOG.md` | ✅ Entrada discovery |

---

## Matriz de pruebas futura

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| 1 | `cancelAll` sin requests | No-op; maps vacíos; sin throw |
| 2 | Una request activa + `cancelAll` | `API_CANCELLED`; transport abort |
| 3 | Múltiples requests activas + logout | Todas `API_CANCELLED` |
| 4 | Logout durante request | `signOut()` → abort antes de settle |
| 5 | Logout repetido | Idempotente; Session `logoutInProgress` + `cancelAll` vacío |
| 6 | `destroySession` | `SESSION_DESTROYED` → `cancelAll` |
| 7 | Relogin otro usuario | Sin responses pendientes del user A |
| 8 | Request nueva durante logout | Sin Authorization si post-`clearSession` |
| 9 | `resetApiClientForTests` con in-flight | Abort antes de null singleton |
| 10 | `AbortError` / cancel reason | `API_CANCELLED`, no retry |
| 11 | Respuesta tardía (sin wire) | Test falla hasta implementar — documenta deuda |
| 12 | Request completada antes del logout | `ok: true` legítimo |
| 13 | Refresh Session concurrente + logout | `refreshInFlight` cleared; sin deadlock |
| 14 | Event Bus sin historial de credenciales | Payload logout sin tokens |

---

## Respuestas obligatorias (18 preguntas)

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 1 | ¿Existe `cancelAll()`? | **Sí** — `ApiClient.cancelAll()` / facade congelada |
| 2 | ¿Dónde vive / qué cancela / quién invoca / prod vs tests? | `api-client.ts`; aborta `operationAbort` + `inFlight`; hoy solo tests llaman directamente (`api-client-foundation`); producción **no** invoca |
| 3 | Si no cableado — mecanismos parciales | `cancel(requestId)`; `AbortSignal` caller; `clearSession` anula `refreshInFlight`; timeout abort por intento |
| 4 | ¿API Client crea AbortController por request? | **Sí** — uno por operación + uno por intento retry |
| 5 | ¿Registro central requests activas? | **Sí** — `inFlight` + `operationAbort` en instancia singleton |
| 6 | ¿`resetApiClientForTests()` limpia requests? | **No** — solo null singleton |
| 7 | ¿Logout Session/Auth notifica API Client? | **No** |
| 8 | ¿`USER_LOGOUT` llega a listener de cancelación? | **No** — solo Session `handleUserLogoutEvent` |
| 9 | ¿`destroySession`/`destroyAuth` cancelan red? | **No** |
| 10 | ¿Puede completarse request después del logout? | **Sí** — **CONFIRMADO** sin wire |
| 11 | ¿Respuesta tardía muta estado usuario anterior? | **POSIBLE** en caller; API Client no muta Session — solo devuelve Promise |
| 12 | Escenarios concurrentes | Múltiples requests aisladas por `requestId`; logout no aborta hoy; refresh Session single-flight cleared en `clearSession`; relogin reusa singleton; destroy no cancela; reset tests orphan promises |
| 13 | ¿Dónde debe vivir `cancelAll()`? | Implementación **API Client**; orquestación **bootstrap** |
| 14 | ¿Fuente de señal logout? | **Auth** emite `USER_LOGOUT`; Session consume; bootstrap debe escuchar el mismo evento |
| 15 | ¿Integración? | **Combinación:** listener `USER_LOGOUT` + `SESSION_DESTROYED` en composition root (B); no DI en Session salvo mejora futura C |
| 16 | ¿Síncrono/async/idempotente/reentrante? | **Síncrono** `void`; **idempotente**; **reentrante** seguro (maps vacíos) |
| 17 | ¿Errores? | Ignorar fallos transport al abort; surfacing `API_CANCELLED` al caller de la request; no propagar a Session/Auth |
| 18 | ¿Cómo probar? | Mock transport con delay + `signOut()` en `boot-api-wiring`; assert `API_CANCELLED` y maps vacíos |

---

## Criterios de aceptación (implementación futura — no autorizada)

1. `signOut()` aborta todas las requests in-flight del singleton API Client.
2. `destroySession()` dispara la misma cancelación vía `SESSION_DESTROYED`.
3. Session y Auth **no** importan MOD-005.
4. `cancelAll` idempotente — doble logout sin throw.
5. Nuevas requests post-logout sin `Authorization` (regresión existente preservada).
6. `resetApiClientForTests()` no deja promises colgadas.
7. Suite baseline ≥ 471 tests verdes + casos nuevos de matriz § arriba.
8. Sin credenciales en Event Bus ni logs de cancelación.

---

## Fuera de alcance

- FetchTransport
- Supabase
- UI / `web/**`
- Registry dinámico post-logout
- Producción V1
- push / PR / merge / deploy
- Implementación en este ticket

---

## Recomendación final

**Sí** — puede abrirse un ticket de implementación acotado tras validación PO:

**`TICKET-V2-PHASE-6-RUNTIME-LOGOUT-CANCELLATION-IMPLEMENTATION-001`** (nombre sugerido)

Alcance mínimo: wire bootstrap `USER_LOGOUT` + `SESSION_DESTROYED` → `getApiClient().cancelAll()`; endurecer `resetApiClientForTests()`; 3–5 tests integración boot.

La deuda no es crear `cancelAll()` — es **cerrar el circuito lifecycle** `USER_LOGOUT → cancelAll()` respetando fronteras MOD-001 / MOD-002 / MOD-005 / bootstrap.

---

*Discovery · HEAD `d43573241f88821702a4d8b4b05febda3e0969a4` · 471/471 PASS · sin cambios runtime*
