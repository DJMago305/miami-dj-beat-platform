# TICKET-V2-PHASE-6-MOD-005-RUNTIME-REGISTRY-DISCOVERY-001

## Estado

**DISCOVERY COMPLETADO — IMPLEMENTACIÓN NO AUTORIZADA**

| Campo | Valor |
|-------|-------|
| Modo | Solo lectura de código + documentación en `docs/V2/**` |
| Fecha discovery | 2026-07-11 |
| Rama analizada | `plan/v2-phase-4-api-client` |
| HEAD analizado | `3c53bc899a0cbbaf58574883f2a579c0b85f865b` |
| Commit Session Opaque Auth | `feat(v2-session): add opaque authorization reader` |
| Suite baseline | **465/465 PASS** · **45/45 files** |
| Autorización PO | Discovery únicamente — sin runtime, tests, commit, push, PR, merge, preview ni deploy |

---

## Problema

Tras cerrar **Session Opaque Authorization** (`3c53bc8`), MOD-005 API Client está **operativo en bootstrap** (`initializeApiForBoot` → `API_READY`) pero **no aparece** en el Runtime Registry de MOD-RUNTIME.

El laboratorio puede observar Auth (`MOD-001`) y Session (`MOD-002`) en `getRuntime().getRegistry()`, pero no el egress HTTP del Shared Core. Esto deja un hueco de **observabilidad boot-time**: debugging, auditorías de cadena de boot y futuras superficies de diagnóstico no pueden confirmar que MOD-005 alcanzó readiness antes de `initializeRuntime()`.

La deuda Event Bus history para Authorization está **cerrada**; el registry **no debe** compensar credenciales ni reintroducir acoplamiento con Session/Auth/Event Bus.

---

## Runtime Registry actual

### ¿Qué es?

**MOD-RUNTIME Registry** es un `Map` in-memory de registros **inmutables** (`RuntimeModuleRegistration`) poblado durante `initializeRuntime()`. Expone:

- `getRuntime().getRegistry()` — lista frozen de módulos registrados
- `getRuntimeState().registrySize` — conteo en `RuntimeSnapshot`
- `getRuntimeModule(moduleId)` — lookup puntual

**No** es un service locator, **no** es bus de eventos, **no** es caché de sesión ni de credenciales.

### Responsabilidad exacta

| Sí | No |
|----|-----|
| Snapshot **estático** del estado lifecycle de módulos Core al momento del boot | Sincronización dinámica post-boot |
| Observabilidad para tests, logs y diagnóstico lab | Fuente de verdad operativa para auth o HTTP |
| Correlación “¿qué módulos reportaron ready en boot?” | Almacenamiento de metadata sensible |

### Evidencia runtime

| Archivo | Símbolo | Comportamiento |
|---------|---------|----------------|
| `shared/runtime/registry.ts` | `registerRuntimeModule()` | `Map` con `{ moduleId, label, lifecycleState, registeredAt }` |
| `shared/runtime/types.ts` | `RuntimeModuleRegistration` | Cuatro campos únicamente — sin capabilities ni metadata extensible |
| `shared/runtime/types.ts` | `RuntimeModuleId` | Union: `MOD-006`, `MOD-004`, `MOD-010`, `MOD-014`, `MOD-001`, `MOD-002`, `MOD-007`, `MOD-RUNTIME` — **sin `MOD-005`** |
| `shared/runtime/runtime-service.ts` | `registerCoreModules()` | Registra 6 módulos + luego `MOD-RUNTIME` (total **7** entradas) |
| `shared/runtime/runtime-service.ts` | `initializeRuntime()` | Paso boot **después** de Session y **después** de API Client en `bootScaffold()` |
| `tests/unit/runtime-registry-auth.test.ts` | MOD-001 suite | Política aceptada: registry **stale** tras login/logout post-boot |

### Módulos registrados hoy

Orden canónico en guest boot (`runtime-registry-auth.test.ts`):

```
MOD-006  Configuration      → getConfigState()        (ej. FROZEN)
MOD-004  Event Bus          → getEventBusState()      (ej. BUS_READY)
MOD-010  Logging            → 'LOG_READY'             (literal)
MOD-014  Error Handler      → getErrorState()         (ej. ERR_READY)
MOD-001  Authentication     → getAuthService().getState()  (ej. UNAUTHENTICATED)
MOD-002  Session            → getSessionState()       (ej. SESSION_READY)
MOD-RUNTIME Runtime Orchestrator → RUNTIME_BOOTING → RUNTIME_READY
```

**Ausentes:** `MOD-005` API Client · `MOD-007` (reservado en tipo, no registrado) · Theme · Permissions · API transport metadata.

`registrySize` esperado hoy: **7**.

---

## Relación con MOD-001

### Cómo se registra MOD-001

```typescript
registerRuntimeModule('MOD-001', 'Authentication', getAuthService().getState());
```

- **Cuándo:** dentro de `registerCoreModules()` al llamar `initializeRuntime()`.
- **lifecycleState:** string opaco del Auth service en **instante boot** (`UNAUTHENTICATED`, `SESSION_HANDOFF_SUCCEEDED`, etc.).
- **Política:** sin listeners `USER_LOGIN` / `USER_LOGOUT`; sin re-registro post-boot.
- **Tests:** `runtime-registry-auth.test.ts` — 7 casos; `registrySize === 7`.

### Lección aplicable a MOD-005

MOD-005 debe seguir el **mismo patrón estático**: una línea en `registerCoreModules()` (o función hermana) leyendo `getApiClientState()` **después** de que `initializeApiForBoot()` haya tenido éxito en `bootScaffold()`.

---

## Relación con MOD-005

### Estado actual post-opaque-auth

| Componente | Estado |
|------------|--------|
| `initializeApiForBoot()` | ✅ Operativo en `boot.ts` fase `api-client` |
| `getApiClientState()` | ✅ `API_UNINITIALIZED` \| `API_BOOTING` \| `API_READY` \| `API_ERROR` |
| `getSessionAuthorizationHeader()` | ✅ Session-owned — **no** usado por registry |
| Registry entry MOD-005 | ❌ Ausente |
| Import Auth en API runtime | ❌ Prohibido y validado |

### Cómo debería aparecer MOD-005

| Campo | Valor recomendado |
|-------|-------------------|
| `moduleId` | `'MOD-005'` (añadir a `RuntimeModuleId`) |
| `label` | `'API Client'` |
| `lifecycleState` | `getApiClientState()` en instante `initializeRuntime()` |
| Posición en lista | **Después de `MOD-002`**, antes de `MOD-RUNTIME` (orden boot) |

### Estado esperado en boot exitoso

| Escenario | `getApiClientState()` en registry | Nota |
|-----------|-----------------------------------|------|
| Guest boot OK | `API_READY` | Sin Authorization en requests — eso es Session, no lifecycle API |
| Signed-in boot OK | `API_READY` | Igual — auth no cambia lifecycle del singleton |
| Boot falla fase `api-client` | N/A | `initializeRuntime()` **no** se ejecuta |
| `API_ERROR` durante init | N/A | Boot aborta antes de Runtime |

**Importante:** el registry **no** debe reflejar si hay `Authorization` activa; eso pertenece a Session (`getSessionAuthorizationHeader()`).

### Capacidades — qué exponer

Con el schema actual (`lifecycleState: string` únicamente), **no** hay campo `capabilities`. La implementación recomendada **no extiende** el schema en el primer ticket.

Si en el futuro se extiende el tipo, capacidades **no sensibles** permitidas:

| Capability | Permitido | Fuente |
|------------|-----------|--------|
| `supportsRequests` | ✅ (boolean derivado de `API_READY`) | `getApiClientState()` |
| `transportKind: 'memory'` | ✅ (lab) | boot config — sin URLs ni keys |
| `sessionReaderWired: true` | ✅ | wiring boot — no implica usuario autenticado |
| `supportsRealtime` | ✅ `false` (hasta ticket futuro) | producto |

**No** codificar `supportsAuth` como “usuario logueado” — confundiría Registry con Session.

---

## Fronteras arquitectónicas

```
┌─────────────┐     AuthHandle      ┌──────────────┐     getSessionAuthorizationHeader()
│   MOD-001   │ ──────────────────► │   MOD-002    │ ───────────────────────────────► MOD-005 requests
│    Auth     │                     │   Session    │        (pull por request)
└─────────────┘                     └──────────────┘
       │                                    │                      │
       │ getState()                         │ getSessionState()    │ getApiClientState()
       ▼                                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MOD-RUNTIME Registry (snapshot boot-time)                 │
│   Observabilidad únicamente — NO credenciales — NO reemplaza módulos fuente  │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Frontera | Registry | Fuente canónica |
|----------|----------|-----------------|
| **Registry ↔ Session** | Puede registrar `SESSION_READY` string | Session posee slot opaco, `expiresAt`, máquina 9 estados, header |
| **Registry ↔ Auth** | Puede registrar `SESSION_HANDOFF_SUCCEEDED` etc. | Auth posee handoff, provider, refresh Auth-side |
| **Registry ↔ API Client** | Puede registrar `API_READY` | API Client posee transport, pipeline, cancel, retry |
| **Registry ↔ Event Bus** | Sin relación de lectura | Bus no almacena credenciales post-`3c53bc8` |
| **Registry ↔ Bootstrap** | Poblado en `initializeRuntime()` | `bootScaffold()` garantiza API antes de Runtime |

---

## Datos permitidos

| Dato | ¿En registry? | Evidencia / razón |
|------|---------------|-------------------|
| `moduleId` | ✅ | `MOD-005` |
| `label` | ✅ | `'API Client'` |
| `lifecycleState` | ✅ | `getApiClientState()` — mismo patrón MOD-001 |
| `registeredAt` | ✅ | Timestamp boot — ya en schema |
| Versión runtime scaffold | ✅ | Ya en `RuntimeSnapshot` / meta — no duplicar en entry |
| Readiness booleano implícito | ✅ | `lifecycleState === 'API_READY'` |
| Transport kind (no secret) | ⚠️ Futuro — solo si se extiende schema | `'memory'` en lab |

---

## Datos prohibidos

| Dato | ¿En registry? | Razón |
|------|---------------|-------|
| `Authorization` activa | ❌ | Session — secreto opaco |
| `accessTokenRef` | ❌ | Secreto — slot privado Session |
| `refreshTokenRef` | ❌ | Secreto — Auth/Session |
| `userId` | ❌ | Identidad — Session/Auth |
| `credentialVersion` | ❌ | Interno Session |
| `expiresAt` | ❌ | Interno Session |
| `MDJ_V2_API_ANON_KEY` | ❌ | Config secreta |
| API public URL completa con tokens | ❌ | Config |
| Request/response bodies | ❌ | API Client runtime |
| Historial Event Bus | ❌ | No fuente de credenciales |
| Snapshot Session completo | ❌ | Registry no es mirror de Session |

---

## Alternativas evaluadas

### A. Registry mínimo (RECOMENDADA)

- `moduleId`, `label`, `lifecycleState`, `registeredAt`
- Mirror exacto de MOD-001
- **Pros:** cero schema change; bajo riesgo; alineado con tests existentes; `registrySize` pasa de 7 → 8
- **Contras:** no distingue guest vs signed-in (correcto — eso no es lifecycle API)

### B. Registry con capacidades

- Añadir `capabilities: { supportsAuth, supportsRequests, supportsRealtime }`
- **Pros:** más expresivo para UI diagnóstico futuro
- **Contras:** requiere extender `RuntimeModuleRegistration`; riesgo de interpretar `supportsAuth` como “token presente”; fuera de alcance mínimo

### C. Registry con snapshot operativo

- metadata, último error API, timestamps de request
- **Pros:** debugging rico
- **Contras:** acercamiento a caché global; requiere sincronización dinámica; viola política MOD-001 stale-accepted

### D. Registry excesivo (ANTI-PATTERN)

- Almacenar `accessTokenRef`, userId, headers, historial USER_LOGIN, estado Session machine
- **Por qué evitar:** replica Session; reintroduce deuda Event Bus; superficie de fuga; convierte Registry en segundo store de credenciales; rompe fronteras post-opaque-auth

---

## Diseño recomendado

**Opción A — Registry mínimo estático**, réplica del patrón MOD-001 (`2405b20`).

### Cambios conceptuales (implementación futura)

1. Añadir `'MOD-005'` a `RuntimeModuleId` en `shared/runtime/types.ts`.
2. En `registerCoreModules()`:

   ```typescript
   registerRuntimeModule('MOD-005', 'API Client', getApiClientState());
   ```

3. Importar `getApiClientState` desde `shared/api/runtime/api-service.ts` (mismo patrón que `getAuthService()`).
4. Actualizar orden canónico en tests: 8 entradas (`MOD-005` entre `MOD-002` y `MOD-RUNTIME`).
5. **Sin** listeners post-boot · **sin** lectura de `getSessionAuthorizationHeader()` · **sin** metadata de transport en v1.

### Post-opaque-auth — implicaciones

- El registry **nunca** consultó Event Bus para MOD-001; MOD-005 **tampoco** debe hacerlo.
- La eliminación de `getHistory()` en `initialize-api.ts` **no cambia** el contrato del registry: solo confirma que observabilidad de credenciales **no** pertenece al registry.
- `lifecycleState: 'API_READY'` es compatible con guest y signed-in.

---

## Contrato conceptual

```typescript
// Existente — sin cambio de forma en Opción A
type RuntimeModuleRegistration = {
  readonly moduleId: RuntimeModuleId;  // + 'MOD-005'
  readonly label: string;              // 'API Client'
  readonly lifecycleState: string;      // getApiClientState() snapshot
  readonly registeredAt: number;
};

// Lectura pública (ya existe)
getRuntime().getRegistry(): readonly RuntimeModuleRegistration[];
getRuntimeState().registrySize: number;  // 8 tras implementación
```

**Invariantes:**

- Registry se escribe **una vez** por módulo durante `initializeRuntime()`.
- `lifecycleState` es opaco string del módulo fuente — no parsear en consumidores.
- Fallo boot `api-client` → Runtime no init → MOD-005 ausente del registry (correcto).

---

## Archivos potenciales (implementación futura — NO autorizada)

| Archivo | Cambio tentativo |
|---------|------------------|
| `shared/runtime/types.ts` | Añadir `MOD-005` a `RuntimeModuleId` |
| `shared/runtime/runtime-service.ts` | `registerRuntimeModule('MOD-005', ...)` + import `getApiClientState` |
| `tests/unit/runtime-registry-api.test.ts` | **Nuevo** — mirror `runtime-registry-auth.test.ts` |
| `tests/unit/runtime-registry-auth.test.ts` | Actualizar `registrySize` 7 → 8 y orden canónico |
| `tests/unit/runtime.test.ts` | Ajustar expectativas `registrySize` si aplica |

**Fuera de alcance implementación:** `api-client.ts`, `session-store.ts`, `initialize-api.ts`, `boot.ts` (salvo si boot falla antes de runtime — sin cambio necesario).

---

## Riesgos

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-01 | Registry stale tras login/logout (igual MOD-001) | Baja | Documentar política; no sincronizar dinámicamente |
| R-02 | Confundir `API_READY` con “usuario autenticado” | Media | Docs + tests que verifican guest y signed-in ambos `API_READY` |
| R-03 | Import circular runtime ↔ api | Baja | Verificado: `shared/api` no importa `shared/runtime` |
| R-04 | Extender schema con capabilities sensibles | Alta | Rechazar en v1; revisión PO si se abre Option B |
| R-05 | Registry leyendo Session header | Alta | Prohibido explícito en ticket implementación |
| R-06 | `initializeRuntime()` sin API previo (tests manuales) | Baja | Test debe usar `bootScaffold` canónico |

---

## Fuera de alcance

- Registry dinámico post-boot
- `USER_LOGOUT` → `cancelAll()` (ticket separado)
- `normalizeApiError()`, FetchTransport, Supabase
- UI pills nuevas en portal shell (boot pills usan `BootResult`, no registry entries)
- Producción V1 · push · PR · merge · deploy
- Reapertura Event Bus history para observabilidad

---

## Plan futuro

| Orden | Ticket sugerido | Alcance |
|-------|-----------------|---------|
| 1 | `TICKET-V2-PHASE-6-MOD-005-RUNTIME-REGISTRY-001` | Implementación Opción A |
| 2 | `TICKET-V2-PHASE-6-MOD-005-RUNTIME-REGISTRY-DOCS-001` | Cierre documental post-commit |
| 3 (opcional PO) | `USER_LOGOUT` → `cancelAll()` | Hardening API Client |
| 4 (opcional PO) | Registry capabilities (Option B) | Solo con schema review |

---

## Matriz de pruebas requerida (implementación futura)

| # | Escenario | Expectativa |
|---|-----------|-------------|
| T-01 | Guest `bootScaffold` + `initializeRuntime` | MOD-005 presente, label `API Client`, state `API_READY` |
| T-02 | Signed-in restore válido | MOD-005 state sigue `API_READY` (no `SESSION_HANDOFF_SUCCEEDED`) |
| T-03 | `registrySize === 8` | Una entrada MOD-005 |
| T-04 | Orden canónico | `MOD-005` después de `MOD-002`, antes de `MOD-RUNTIME` |
| T-05 | Post-boot `signIn` | MOD-005 `lifecycleState` **sin cambio** (stale policy) |
| T-06 | Post-boot `signOut` | MOD-005 `lifecycleState` **sin cambio** |
| T-07 | `resetRuntimeForTests` | MOD-005 eliminado del registry |
| T-08 | Boot falla `api-client` | MOD-005 ausente; Runtime no ready |
| T-09 | No import Session authorization en runtime registry code | Grep estático |
| T-10 | Core modules MOD-001…MOD-006 preservados | Sin regresión `runtime-registry-auth.test.ts` |

---

## Criterios de aceptación (discovery)

| # | Criterio | Estado |
|---|----------|--------|
| D-01 | Registry actual documentado con evidencia | ✅ |
| D-02 | MOD-001 patrón replicable para MOD-005 | ✅ |
| D-03 | Fronteras Session/Auth/API definidas | ✅ |
| D-04 | Datos prohibidos listados (post-opaque-auth) | ✅ |
| D-05 | Alternativas A–D comparadas | ✅ |
| D-06 | Opción A recomendada | ✅ |
| D-07 | Sin cambios runtime en discovery | ✅ |
| D-08 | Plan implementación y tests definidos | ✅ |

---

## Recomendación final

**APROBAR** apertura de `TICKET-V2-PHASE-6-MOD-005-RUNTIME-REGISTRY-001` con **Opción A (registry mínimo estático)**.

MOD-005 debe registrarse en `registerCoreModules()` leyendo `getApiClientState()` en el instante de `initializeRuntime()`, **después** de opaque authorization, **sin** almacenar credenciales ni consultar Session/Auth/Event Bus más allá del lifecycle string ya expuesto por el singleton API.

El registry sigue siendo **observabilidad boot-time**, no fuente de verdad de Authorization.

---

*Discovery · TICKET-V2-PHASE-6-MOD-005-RUNTIME-REGISTRY-DISCOVERY-001 · 2026-07-11*
*Contexto · Session Opaque Authorization `3c53bc8` · baseline 465/465*
