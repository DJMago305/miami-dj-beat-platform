# TICKET-V2-PHASE-6-EDGE-HEADER-POLICY-DISCOVERY-001

## Estado

**DISCOVERY COMPLETADO — IMPLEMENTACIÓN NO AUTORIZADA**

| Campo | Valor |
|-------|-------|
| Modo | Solo lectura de código + documentación en `docs/V2/**` |
| Fecha discovery | 2026-07-11 |
| Rama analizada | `plan/v2-phase-4-api-client` |
| HEAD analizado | `3b4f57255a82e17c264205f14f6cf7123591c86e` — `feat(v2-api): add invokeEdge facade` |
| Suite baseline | **521/521 PASS** · **47/47 files** |
| `invokeEdge()` runtime | ✅ Facade delgada — **sin** política Supabase headers |
| Autorización PO | Discovery únicamente — sin runtime, tests, commit, push, PR, merge, preview ni deploy |

### Nota de baseline

Al iniciar el ticket, `git rev-parse HEAD` coincidía con el esperado, pero el working tree **no** estaba limpio: persistían cambios documentales sin commit del cierre EOD (`NOTA-DIARIA-LAB-001.md`, `MODULE-CATALOG.md`, session summary y ticket EOD). **No se modificó runtime.** Este discovery añade **solo** el presente archivo.

---

## Problema

`invokeEdge()` ya enruta POST a `/functions/v1/{name}` vía `request()`, pero **no define** la política canónica de headers Supabase (`Authorization`, `apikey`, guest anon). V1 resuelve esto de forma **ad hoc** por pantalla. Antes de egress real, `rpc()` o adaptador Supabase, hace falta un contrato único que no duplique secretos ni rompa Session/Auth.

---

## A. Inventario V1 — cómo construye headers

### Helpers canónicos (`web/supabase-config.js`)

| Helper | Propósito | Headers producidos |
|--------|-----------|-------------------|
| `mdbSupabaseOrigin()` | Base URL sin slash | — |
| `mdbSupabaseFunctionUrl(name)` | `{MDB_SUPABASE_URL}/functions/v1/{name}` | — |
| `mdjSupabaseAnonInvokeHeaders()` | Checkout / flujos **guest** sin sesión JWT | `Content-Type: application/json`, `Authorization: Bearer {MDB_SUPABASE_ANON_KEY}`, `apikey: {MDB_SUPABASE_ANON_KEY}` |

Clave pública V1: `window.MDB_SUPABASE_ANON_KEY` (publishable anon — explícitamente **no** service_role).

### Patrón 1 — Edge autenticada (usuario/staff con sesión Supabase)

**Evidencia:** `web/auth.js` (welcome, notify-new-device-login), `web/dj-tools.html`, `web/jobs.html`, `web/dj-profile.html`, `web/account-settings.html`, `web/js/production-module.js` (`staff-create-client-account`), `web/js/downloads.js`, `web/js/client-account.js`.

| Header | Valor típico |
|--------|--------------|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {session.access_token}` |
| `apikey` | `MDB_SUPABASE_ANON_KEY` (presente en la mayoría; a veces condicional `key ? { apikey: key }`) |

### Patrón 2 — Guest / checkout público (sin JWT de usuario)

**Evidencia:** `web/courses.html` (`create-course-checkout`), `web/client-portal.js` (`create-event-payment` depósito Stripe), `web/js/production-module.js` (mismo `create-event-payment` con `mdjSupabaseAnonInvokeHeaders()`).

| Header | Valor |
|--------|-------|
| `Authorization` | `Bearer {anon_key}` |
| `apikey` | `{anon_key}` |

El Edge Function valida JWT vía `getUser(jwt)` — con anon bearer el gateway acepta la invocación; la función puede exigir usuario real o permitir flujo público según implementación.

### Patrón 3 — Autenticado **sin** `apikey` explícito (inconsistente)

**Evidencia:**

| Archivo | Función | Headers observados |
|---------|---------|-------------------|
| `web/admin-dashboard.html` | `create-platform-account` | `Authorization: Bearer {token}` solo |
| `web/admin-dashboard.html` | `notify-dj-assignment` | `Authorization` + `Content-Type` — **sin** `apikey` |
| `web/account-settings.html` | `create-portal-session` | `Authorization` + `Content-Type` — **sin** `apikey` |

Riesgo: puede funcionar en algunos entornos Supabase pero **no** es el patrón dominante ni el más seguro/documentado.

### Patrón 4 — RPC (no Edge)

**Evidencia:** `supabase.rpc(...)` en `dj-profile.html`, `client-portal.js`, `flow-handler.js`, `admin-dashboard.html`, etc.

| Aspecto | Comportamiento |
|---------|----------------|
| Transporte | Supabase JS client — no `fetch` manual a `/functions/v1` |
| Path | `/rest/v1/rpc/{functionName}` (interno SDK) |
| Headers | SDK inyecta `apikey` + `Authorization` desde cliente inicializado con anon key + sesión |
| V2 target | `rpc()` futuro vía API Client — misma política de headers que Edge |

### Patrón 5 — Webhooks / server-only (fuera browser)

**Evidencia:** `supabase/functions/stripe-webhook/index.ts`, otras Edge con `SUPABASE_SERVICE_ROLE_KEY` en Deno env.

| Aspecto | Detalle |
|---------|---------|
| Invocación | Stripe → Edge URL pública; **no** browser |
| Auth | Service role **solo** servidor; prohibido en client V1 (`supabase-config.js` comentario explícito) |
| Alcance V2 invokeEdge | **N/A** — no replicar en API Client browser |

### Patrón 6 — Infra SQL / cron (referencia)

`web/sql/migrations/09_inbox_email_infra.sql` — ejemplo `Authorization: Bearer [SUPABASE_ANON_KEY]` en job HTTP. Patrón infra, no UI.

---

## B. Dónde aparecen hoy los identificadores

| Identificador | V1 | V2 |
|---------------|----|----|
| `Authorization` | Manual por `fetch` o SDK session | `SessionReaderPort` → `buildHeaders()` si sesión válida |
| `apikey` | Manual `MDB_SUPABASE_ANON_KEY` | ❌ **No inyectado** |
| `anonKey` / publishable | `MDB_SUPABASE_ANON_KEY` global | `getConfig().api.anonKey` (`MDJ_V2_API_ANON_KEY`) — **no** llega a headers |
| Bearer user JWT | `session.access_token` | `accessTokenRef` opaco en SessionStore → `Bearer ${ref}` |
| Session token | Supabase Auth JWT | Mismo rol — slot privado MOD-002 |
| `service_role` | Solo servidor / SQL / Edge env | Prohibido en config client (`FORBIDDEN_KEY_PATTERNS`) |

---

## C. Información ya disponible en V2

### MOD-006 Configuration

| Campo | Fuente | Uso actual API Client |
|-------|--------|----------------------|
| `config.api.publicUrl` | `MDJ_V2_API_PUBLIC_URL` | `baseUrl` en `resolveClientConfig()` → `buildUrl()` |
| `config.api.anonKey` | `MDJ_V2_API_ANON_KEY` | Parseado y frozen en `AppConfig` — **ignorado** por `api-client.ts` |
| `config.api.transportMode` | `MDJ_V2_API_TRANSPORT` | Bootstrap transport only |

### MOD-002 Session runtime

| API | Comportamiento |
|-----|----------------|
| `getSessionAuthorizationHeader()` | `Bearer {accessTokenRef}` si usuario, credencial bound, no expirado, máquina de estados permite |
| `getSessionAuthorizationState()` | `authorized` \| `anonymous` \| `denied` + reason |
| Slot privado | `accessTokenRef` + `boundUserId` — no en snapshot público |
| Guest / signed-out | `null` — sin Authorization |

Evidencia tests: `boot-api-wiring.test.ts` — guest sin `Authorization`; signed-in con `Bearer mock-...`.

### MOD-001 Auth runtime

| Rol | Relación headers |
|-----|------------------|
| `ingestAuthHandle()` | Pobla slot Session vía `accessTokenRef` |
| Auth **no** expone header directo a API Client | Frontera respetada |
| Logout | Session limpia credencial → Authorization ausente |

### MOD-005 API Client (`buildHeaders` hoy)

| Header | Fuente |
|--------|--------|
| `Accept` | `application/json` |
| `Content-Type` | `application/json` (default) |
| `Authorization` | SessionReader si presente y caller no sobrescribió |
| `X-Correlation-Id` | pipeline |
| `X-Request-Id` | pipeline |
| `X-Client-Portal` | context portal |
| `apikey` | ❌ ausente |
| `x-client-info` (SDK Supabase) | ❌ ausente |

`invokeEdge()` delega a `request()` → **misma** política que `post()`.

### Spec existente (`REQUEST-RESPONSE-CONTRACT.md`)

Documenta inyección de `Authorization` desde Session. **No** documenta `apikey` ni modo guest anon — gap spec.

---

## D. Casos mínimos que debe soportar la política futura

| # | Escenario | V1 referencia | V2 hoy | Necesidad futura |
|---|-----------|---------------|--------|------------------|
| 1 | Usuario autenticado (client/artist) | Bearer JWT + apikey | Bearer Session; sin apikey | apikey + Bearer user |
| 2 | Usuario invitado (sin sesión) | Sin Edge o falla JWT gate | Sin Authorization | Definir si Edge guest permitido |
| 3 | Checkout público (guest) | anon Bearer + apikey | ❌ Bloqueado | Paridad V1 `mdjSupabaseAnonInvokeHeaders` |
| 4 | Staff autenticado | Bearer staff JWT + apikey (mayoría) | Bearer Session staff portal | Igual #1 con actor staff |
| 5 | Jobs internos futuros | N/A browser | N/A | Misma política; sin service_role |
| 6 | `rpc()` futuro | SDK auto-headers | Sin `rpc()` | Mismos headers en `/rest/v1/rpc/*` |

---

## Tabla comparativa V1 vs V2

| Dimensión | V1 | V2 (2026-07-11) |
|-----------|----|-----------------|
| URL Edge | `mdbSupabaseFunctionUrl` | `invokeEdge(name)` → `/functions/v1/{name}` |
| Base URL | `MDB_SUPABASE_URL` | `config.api.publicUrl` |
| Anon key storage | `window.MDB_SUPABASE_ANON_KEY` | `config.api.anonKey` (no cableada a HTTP) |
| Auth header autenticado | `session.access_token` manual | `getSessionAuthorizationHeader()` |
| apikey header | Manual, inconsistente | Ausente |
| Guest checkout | `mdjSupabaseAnonInvokeHeaders()` | No soportado |
| Centralización | Por archivo HTML/JS | API Client único (parcial) |
| Cancelación logout | No central | `cancelAll()` bootstrap |
| Errores | Manual `!res.ok \|\| data.error` | `normalizeApiError` / `ApiResponse` |
| Service role browser | Prohibido explícito | Prohibido en MOD-006 validate |

---

## Matriz de headers por escenario (propuesta discovery — no implementada)

| Escenario | Authorization | apikey | Content-Type | Notas |
|-----------|---------------|--------|--------------|-------|
| Autenticado — invokeEdge default | `Bearer {userJwt}` (Session) | `{anonKey}` (Config) | `application/json` | Alinea patrón V1 dominante |
| Guest — checkout público | `Bearer {anonKey}` | `{anonKey}` | `application/json` | Requiere flag explícito PO (ej. `allowAnon`) — no default |
| Invitado sin flag | — o rechazo preflight | `{anonKey}` mínimo gateway | `application/json` | **Decisión PO:** ¿apikey solo basta sin Bearer? |
| Staff producción Edge | Igual autenticado | `{anonKey}` | `application/json` | Mismo mecanismo; portal `staff` en `X-Client-Portal` |
| rpc() futuro | Igual Edge | `{anonKey}` | `application/json` | Path distinto; headers iguales |
| Webhook / server | Service role (servidor) | N/A browser | N/A | Fuera invokeEdge browser |
| Caller override `Authorization` | Spec: prohibido secretos hardcoded | Spec: silencioso hoy | Caller puede pasar headers | Riesgo si no se valida |

Headers MDJ ya presentes (mantener): `X-Correlation-Id`, `X-Request-Id`, `X-Client-Portal`.

Header Supabase SDK opcional futuro: `x-client-info` — **no** usado en V1 raw fetch; decisión PO si hace falta paridad SDK.

---

## Riesgos de seguridad

| Riesgo | Clasificación | Evidencia |
|--------|---------------|-----------|
| Service role en browser | **CRÍTICO — prohibido** | V1 comment; MOD-006 `FORBIDDEN_KEY_PATTERNS` |
| Guest anon sin gate explícito | **ALTO** | Cualquier caller podría invocar Edge públicas |
| V1 omite `apikey` en algunos fetch | **CONFIRMADO** | `admin-dashboard` create-platform-account, notify-dj-assignment |
| V2 guest sin Authorization falla JWT Edge | **CONFIRMADO** | `create-checkout` Edge exige JWT (`create-checkout/index.ts`) — guest anon solo en funciones que lo permiten |
| `anonKey` en logs | **MITIGADO** | `redact.ts` redacta `apikey`, `Authorization`, `anonKey` |
| Caller pasa `headers.Authorization` manual | **POSIBLE** | `buildHeaders` no sobrescribe si caller ya puso Authorization |
| Copiar V1 ciegamente | **CONFIRMADO** | Inconsistencia apikey; errores manuales; sin cancelación |
| Mezclar anon bearer con user JWT | **ALTO** | Política debe priorizar Session cuando existe |
| Token stale post-logout | **MITIGADO** | Session niega header; tests boot-api-wiring |

---

## Decisiones pendientes del Product Owner

| # | Decisión | Opciones |
|---|----------|----------|
| 1 | ¿`apikey` en **toda** invocación Supabase browser? | Siempre vs solo Edge vs nunca |
| 2 | ¿Modo guest explícito? | Flag `allowAnon` / `authMode: 'session' \| 'anon' \| 'none'` |
| 3 | ¿Guest usa anon en **Authorization** además de apikey? | V1 sí en checkout; alinear |
| 4 | ¿Prioridad Session sobre anon si ambos disponibles? | Recomendado: Session gana |
| 5 | ¿Caller puede pasar `headers.apikey`? | Prohibido vs ignorado vs merge |
| 6 | ¿Alcance política? | Solo `invokeEdge` vs todo `request()` a `publicUrl` |
| 7 | ¿HTTP 400 con `{error}` → `API_EDGE_REJECTED`? | Ticket separado normalize; no header |
| 8 | ¿Validar con FetchTransport real antes de prod? | QA manual con `MDJ_V2_API_TRANSPORT=fetch` — fuera discovery |

---

## Propuesta mínima compatible con `invokeEdge()` (conceptual — NO implementación)

```
invokeEdge(name, body, opts?)
  → resolveSupabaseInvokeHeaders({ authMode, session, config })
  → request({ POST, /functions/v1/{name}, headers merged, ... })
```

| Regla conceptual | Valor |
|------------------|-------|
| Propietario anon key | `getConfig().api.anonKey` únicamente |
| Propietario user JWT | Session `getSessionAuthorizationHeader()` únicamente |
| Default authMode | `session` — sin anon implícito |
| Guest checkout | `authMode: 'anon'` explícito en opts (opt-in) |
| apikey | Siempre `{anonKey}` cuando política Supabase activa (pendiente PO #1) |
| Prohibido | service_role, anon en caller headers, leer key de DOM/window V1 |
| Sin cambio | retry, timeout, transport, sanitize, normalize |

**No** crear cliente Supabase JS paralelo. **No** mover lógica a FetchTransport.

---

## Dependencias futuras

| Consumidor | Relación con header policy |
|------------|---------------------------|
| `invokeEdge()` IMPLEMENTATION-002 (headers) | Primer consumidor — extiende opts + header builder |
| `rpc()` | Misma política; path `/rest/v1/rpc/{fn}`; posible método hermano |
| Supabase adapter | Wrapper sobre invokeEdge + rpc; no duplicar headers |
| Domain services (checkout, billing) | Eligen `authMode` por caso de negocio |
| MOD-014 bridge | Errores 401 — no headers |
| FetchTransport egress QA | Validar combinaciones reales **después** de policy impl |
| `.env` / Vite | `MDJ_V2_API_ANON_KEY` ya en config — no nuevos secretos browser |

---

## Archivos estudiados (solo lectura)

| Área | Archivos |
|------|----------|
| V1 headers | `web/supabase-config.js`, `web/auth.js`, `web/courses.html`, `web/client-portal.js`, `web/admin-dashboard.html`, `web/js/production-module.js`, `web/jobs.html` |
| V2 config | `shared/config/runtime/{types,validate}.ts` |
| V2 session | `shared/session/runtime/{session-store,session-service}.ts` |
| V2 API | `shared/api/runtime/{api-client,request-pipeline}.ts`, `REQUEST-RESPONSE-CONTRACT.md` |
| V2 boot | `bootstrap/initialize-api.ts` |
| Edge server | `supabase/functions/create-checkout/index.ts`, `stripe-webhook/index.ts` |
| Tests evidencia | `tests/unit/boot-api-wiring.test.ts`, `tests/unit/api-client-foundation.test.ts` |
| Discovery previo | `TICKET-V2-PHASE-6-INVOKE-EDGE-DISCOVERY-001.md` |

---

## Criterios de aceptación (implementación futura — no autorizada)

1. Política documentada y aprobada por PO (este discovery).
2. Implementación acotada — ticket separado — sin tocar Session/Auth internals.
3. `apikey` + modo guest solo tras decisión PO explícita.
4. Tests MemoryTransport assert headers por escenario — sin red.
5. Suite ≥ 521 baseline verde.
6. Sin service_role en client paths.

---

## Fuera de alcance

- Implementación header builder
- Cambios `invokeEdge()`, `api-client.ts`, `fetch-transport.ts`
- `rpc()` runtime
- Supabase SDK en browser
- UI / V1
- `.env` / `.env.example`
- Egress HTTP real
- push / PR / merge / deploy

---

## Secuencia PO recomendada

```
EDGE HEADER POLICY DISCOVERY (este ticket)
  → PO decide matriz § Decisiones pendientes
  → EDGE HEADER POLICY IMPLEMENTATION
  → QA FetchTransport stub/real (lab autorizado)
  → rpc() DISCOVERY + IMPLEMENTATION
  → domain services
```

---

*Discovery cerrado 2026-07-11 — TICKET-V2-PHASE-6-EDGE-HEADER-POLICY-DISCOVERY-001 — implementación no autorizada.*
