# TICKET-V2-PHASE-6-RPC-DISCOVERY-001

## Estado

**DISCOVERY COMPLETADO — IMPLEMENTACIÓN NO AUTORIZADA**

| Campo | Valor |
|-------|-------|
| Modo | Solo lectura de código + documentación en `docs/V2/**` |
| Fecha discovery | 2026-07-11 |
| Rama analizada | `plan/v2-phase-4-api-client` |
| HEAD commit analizado | `3b4f57255a82e17c264205f14f6cf7123591c86e` — `feat(v2-api): add invokeEdge facade` |
| Suite baseline (working tree) | **531/531 PASS** · **47/47 files** |
| `rpc()` runtime | ❌ **AUSENTE** — solo spec + `post('/rest/v1/rpc/...')` genérico posible |
| Autorización PO | Discovery únicamente — sin runtime, tests, commit, push, PR, merge, preview ni deploy |

### Nota de baseline

`git rev-parse HEAD` coincide con el esperado (`3b4f572`). El working tree **no** está limpio: cambios sin commit de Edge Header Policy (`supabase-invoke-headers.ts`, `api-client.ts`, tests) y documentación EOD. Este discovery **no** modifica runtime; inventario V2 incluye delta uncommitted relevante para reutilización header policy en `rpc()`.

---

## Problema

V1 ejecuta decenas de funciones Postgres vía `supabase.rpc()` con headers automáticos del SDK. V2 tiene `TransportPort`, `invokeEdge()`, normalización canónica y (en working tree) política Supabase headers — pero **no** existe facade `rpc(fn, params)`. Antes de migrar permisos snapshot, staff flows, artist/client data reads, hace falta definir contrato mínimo POST `/rest/v1/rpc/{name}` sin Supabase JS paralelo.

---

## A. Inventario V1 — cómo invoca RPC

### Mecanismo dominante

| Aspecto | V1 |
|---------|-----|
| Cliente | `@supabase/supabase-js` — `getSupabaseClient()` / `db.rpc(name, params)` |
| HTTP efectivo | `POST {SUPABASE_URL}/rest/v1/rpc/{function_name}` |
| Body | JSON object con parámetros (`p_*` naming convention) |
| Headers | SDK inyecta `apikey`, `Authorization` (sesión o anon), `Content-Type`, `Accept`, a veces `Prefer` |
| Errores | `{ data, error }` del SDK — **no** `ApiResponse` unificado |
| Timeouts | Ad hoc (`mdjFlowWithTimeout(..., 15000)` en `flow-handler.js`) |

**No** hay `fetch` manual a `/rest/v1/rpc/*` en `web/` — búsqueda repo: **0** coincidencias fuera de docs/spec.

### Funciones RPC referenciadas en browser V1 (subset inventario)

| Dominio | Funciones (ejemplos) |
|---------|----------------------|
| Auth / devices | `mdj_record_login_device`, `mdj_remove_login_device`, `mdj_resolve_email_for_login` |
| Identidad / MDJB | `mdjb_ensure_mine`, `mdj_identity_snapshot` |
| Cliente | `mdj_validate_discount_code`, `client_mark_event_zelle_sent` |
| Artista / DJ | `get_my_profile_visibility_stats`, `record_dj_profile_visit`, `mdjpro_license_snapshot`, SoundForTips bundle |
| Reviews públicas | `get_my_dj_public_review_for_dj`, `submit_dj_public_review`, `get_dj_public_review_bundle` |
| Staff | `staff_confirm_event_zelle_deposit`, `staff_release_event_dj_payout`, `staff_list_dj_public_reviews_recent`, `staff_hide_dj_public_review`, `booth_set_outcome` |
| Flow / economía | `refresh_my_dj_flow_rollups`, `get_my_flow_statement`, `get_my_flow_export_years`, `get_my_soundfortips_accepted_for_flow` |
| Booth / learning | `booth_track_event`, `booth_log_learning_interaction`, `booth_save_ai_interaction` |
| Búsqueda pública | `mdj_public_search_event_teasers` (`header-smart-search.js` — puede correr sin sesión explícita vía SDK) |

### Patrones de auth V1 (vía SDK, no manual)

| Escenario | Comportamiento típico |
|-----------|----------------------|
| Usuario autenticado | JWT en `Authorization` + `apikey` anon |
| Invitado / sin sesión | SDK usa anon key; RLS en Postgres decide acceso |
| Staff | Mismo mecanismo — rol en JWT + RLS |
| RPC “público” | `mdj_public_search_event_teasers` — sin check de sesión en caller; depende RLS/función |

### Webhooks / server RPC

Edge Functions y SQL server usan `supabase.rpc()` con **service role** en Deno — **fuera** del browser. No es target de `ApiClient.rpc()` V2.

---

## B. Inventario V2 — estado actual

| Componente | HEAD `3b4f572` | Working tree (uncommitted) |
|------------|----------------|----------------------------|
| `ApiClient.rpc()` | ❌ Ausente | ❌ Ausente |
| `ApiClientPublicApi` | `request/get/post/put/delete/invokeEdge/cancel/cancelAll` | Igual |
| Path canónico spec | `/rest/v1/rpc/{functionName}` | Spec sin cambio |
| `post('/rest/v1/rpc/...')` genérico | ✅ Posible vía `request()` | ✅ Igual |
| Headers Supabase en `invokeEdge` | ❌ Solo Session `Authorization` | ✅ `resolveSupabaseInvokeHeaders` + `authMode` |
| Headers en `post()` genérico | Session only; sin `apikey` | Igual |
| `config.api.anonKey` | En `AppConfig`; parcial en client config | `resolveAnonKey()` en invokeEdge |
| `sanitizeEdgeFunctionName` | ✅ Edge only | ✅ Reutilizable concepto para RPC |
| Timeout RPC 15s (spec) | ❌ `resolveTimeoutMs` trata RPC POST como write **30s** | Igual |
| Error RPC → `API_EDGE_REJECTED` | ❌ 422 → Edge only; RPC PostgREST ≠ Edge | Igual |
| Tests `/rest/v1/rpc` | **0** | **0** |
| MOD-003 Permissions snapshot RPC | Planificado en spec; **sin** runtime | Igual |

Evidencia `invokeEdge` en HEAD:

```ts
// POST /functions/v1/{sanitizedName} — thin wrapper request()
```

Evidencia header policy (working tree, no en HEAD):

```ts
resolveSupabaseInvokeHeaders({ authMode, anonKey, sessionAuthorization })
mergeSupabaseInvokeCallerHeaders(callerHeaders, policyHeaders)
```

---

## C. Tabla comparativa V1 vs V2

| Dimensión | V1 | V2 hoy |
|-----------|----|--------|
| Invocación | `db.rpc(name, params)` | `post('/rest/v1/rpc/name', params)` manual o futuro `rpc()` |
| URL base | `MDB_SUPABASE_URL` | `config.api.publicUrl` |
| Headers | SDK automático | `buildHeaders()` + policy solo en `invokeEdge` (WT) |
| Params body | Objeto JSON | `serializeBody()` — igual si se usa `request()` |
| Errores | `error` Supabase shape | `normalizeApiError` / `ApiResponse` |
| Cancelación logout | No central | `cancelAll()` bootstrap |
| Retry | No central | Policy en API Client — POST sin retry por defecto |
| Timeout RPC | 15s ad hoc en algunos callers | Spec 15s — runtime default POST 30s |
| Tipado respuesta | Genérico SDK | `ApiResponse<T>` |
| Acoplamiento Supabase JS | Alto | Ninguno en MOD-005 (HTTP plano) |

---

## D. Respuestas obligatorias (16 preguntas)

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 1 | ¿Existe `rpc()` en runtime V2? | **No** — solo `API-CLIENT-SPEC.md` |
| 2 | ¿Se puede invocar RPC hoy sin facade? | **Sí** — `post('/rest/v1/rpc/{fn}', params)` sobre MemoryTransport/FetchTransport |
| 3 | ¿Path canónico? | **POST** `{api.publicUrl}/rest/v1/rpc/{functionName}` |
| 4 | ¿Body? | JSON params object (vacío `{}` o omitido si sin args) |
| 5 | ¿Headers requeridos? | Mismo patrón Supabase que Edge: `apikey` + `Authorization` (session o anon explícito) |
| 6 | ¿Reutilizar header policy de invokeEdge? | **Recomendado** — renombrar conceptualmente a `resolveSupabaseRestHeaders` o compartir módulo existente |
| 7 | ¿Guest / anon en RPC? | V1 delega a RLS; búsqueda pública sin sesión existe — **opt-in** `authMode: 'anon'` como Edge |
| 8 | ¿Session prioriza sobre anon? | **Sí** — misma regla que Edge Header Policy |
| 9 | ¿Timeout default? | Spec **15s** (`api.timeout.rpcMs`) — facade debe pasar `timeoutMs: 15_000` o extender `resolveTimeoutMs` |
| 10 | ¿Retry default? | POST → **sin** retry; spec permite retry en RPC read-only con ADR/`retrySafe` futuro |
| 11 | ¿Mapeo errores RPC? | PostgREST: 400/404/401 → `API_HTTP_ERROR`; body PG error text en `details`; **no** usar `API_EDGE_REJECTED` salvo business `{error}` en 200 |
| 12 | ¿Sanitizar nombre función? | **Sí** — misma clase que Edge (`snake_case`, no `..`, no URL absoluta) |
| 13 | ¿Headers `Prefer` PostgREST? | V1 SDK los gestiona; V2 v1 **no** requiere para lecturas — decisión PO si mutations necesitan `return=representation` |
| 14 | ¿Consumidores V2 planificados? | MOD-003 permissions snapshot, domain services, migración gradual V1 |
| 15 | ¿Tests sin red? | Patrón `MemoryTransport` + assert path/method/headers/body — como `invoke-edge.test.ts` |
| 16 | ¿Secuencia PO? | Commit header policy → **rpc() IMPLEMENTATION** → domain services → egress fetch QA |

---

## Matriz de headers por escenario (propuesta — no implementada)

Reutiliza política Edge Header Policy (working tree):

| Escenario | Authorization | apikey | authMode |
|-----------|---------------|--------|----------|
| RPC autenticado (mayoría V1) | `Bearer {userJwt}` Session | `{anonKey}` | `session` (default) |
| RPC sin sesión (RLS público) | — o anon si PO exige | `{anonKey}` | `session` default; `anon` solo opt-in |
| Staff RPC | Igual autenticado | `{anonKey}` | `session` |
| Guest checkout Edge | N/A RPC | — | Edge usa `anon`; RPC distinto |
| Caller override `Authorization`/`apikey` | **Strip** — igual invokeEdge | — | — |

Headers MDJ (mantener): `X-Correlation-Id`, `X-Request-Id`, `X-Client-Portal`.

---

## Matriz invokeEdge vs rpc (target)

| Campo | `invokeEdge()` | `rpc()` propuesto |
|-------|----------------|-------------------|
| Path | `/functions/v1/{name}` | `/rest/v1/rpc/{name}` |
| Método | POST | POST |
| Body | Payload Edge arbitrario | Params RPC (`p_*`) |
| Timeout default | 30s (POST write) | **15s** (spec RPC) |
| Header policy | Supabase invoke (WT) | **Mismo builder** |
| Error 422 | `API_EDGE_REJECTED` | `API_HTTP_ERROR` (típico PostgREST) |
| Guest anon | `authMode: 'anon'` | Mismo flag si aplica |
| Retry | Desactivado default | Desactivado default |

---

## Riesgos de seguridad

| Riesgo | Clasificación |
|--------|---------------|
| Bypass RLS vía anon mal configurado | **ALTO** — política guest debe ser opt-in |
| Service role en browser | **CRÍTICO — prohibido** |
| RPC mutation con retry accidental | **ALTO** — POST default sin retry |
| Caller inyecta headers Supabase | **MITIGADO** si se reusa merge strip de invokeEdge |
| Exponer detalle SQL en `details` | **POSIBLE** — redacción logs ya cubre tokens |
| Duplicar Supabase SDK | **CONFIRMADO** si no se usa facade único |
| Timeout 30s en RPC sensibles | **POSIBLE** — gap spec vs `resolveTimeoutMs` |

---

## Decisiones pendientes del Product Owner

| # | Decisión |
|---|----------|
| 1 | ¿Commit primero Edge Header Policy antes de `rpc()` impl? |
| 2 | ¿Renombrar `supabase-invoke-headers` → `supabase-rest-headers` o mantener nombre? |
| 3 | ¿`authMode: 'anon'` permitido en `rpc()` o solo session? |
| 4 | ¿Nuevo código error `API_RPC_REJECTED` o solo `API_HTTP_ERROR`? |
| 5 | ¿Header `Prefer` para RPC mutating? |
| 6 | ¿Retry read-only RPC con flag explícito en v1 o ADR posterior? |
| 7 | ¿`api.timeout.rpcMs` en MOD-006 o constante en facade? |
| 8 | ¿Sanitización nombre idéntica a Edge o permitir schema-qualified? |

---

## Propuesta mínima compatible (conceptual — NO implementación)

```ts
type RpcOptions = Omit<ApiRequestOptions, 'path' | 'method' | 'body'> & {
  readonly authMode?: SupabaseInvokeAuthMode; // default 'session'
};

rpc<T>(
  functionName: string,
  params?: Record<string, unknown>,
  options?: RpcOptions,
): Promise<ApiResponse<T>>;
```

| Regla | Valor |
|-------|-------|
| Implementación | Thin wrapper `request()` — espejo `invokeEdge()` |
| Path | `/rest/v1/rpc/${sanitizeRpcFunctionName(name)}` |
| Default `timeoutMs` | `15_000` |
| Default `retrySafe` | `false` |
| Headers | `resolveSupabaseInvokeHeaders` + `mergeSupabaseInvokeCallerHeaders` |
| Prohibido | Supabase JS SDK, service_role, lógica en FetchTransport |

---

## Dependencias futuras

| Consumidor | Relación |
|------------|----------|
| Edge Header Policy IMPLEMENTATION | **Prerequisito recomendado** — commit working tree |
| `rpc()` IMPLEMENTATION | Este discovery |
| MOD-003 Permissions | Snapshot RPC — primer consumidor de negocio |
| Domain services | Reemplazo gradual `db.rpc` V1 |
| Supabase adapter | `invokeEdge` + `rpc` wrappers |
| MOD-014 bridge | Errores 401/403 — independiente |
| FetchTransport egress QA | Después de rpc + headers en lab |

---

## Archivos estudiados (solo lectura)

| Área | Archivos |
|------|----------|
| Spec MOD-005 | `API-CLIENT-SPEC.md`, `REQUEST-RESPONSE-CONTRACT.md`, `API-RETRY-TIMEOUT-RULES.md` |
| V2 runtime HEAD+WT | `api-client.ts`, `types.ts`, `request-pipeline.ts`, `supabase-invoke-headers.ts`, `errors.ts` |
| V1 RPC callers | `auth.js`, `client-portal.js`, `dj-profile.html`, `admin-dashboard.html`, `flow-handler.js`, `header-smart-search.js`, `production-module.js`, `account-settings.html` |
| Discovery previos | `INVOKE-EDGE-DISCOVERY-001`, `EDGE-HEADER-POLICY-DISCOVERY-001` |

**Búsqueda `rpc(` en `MiamiDJBeat-MigracionV2/` runtime:** **0** implementaciones (solo markdown spec).

---

## Criterios de aceptación (implementación futura — no autorizada)

1. Existe `rpc(name, params?, opts?)` en `ApiClientPublicApi`.
2. Thin wrapper sobre `request()` — sin SDK Supabase.
3. Path `/rest/v1/rpc/{sanitizedName}`; timeout default 15s.
4. Reutiliza política headers Supabase (mismo módulo que invokeEdge).
5. Tests MemoryTransport sin red — auth, anon opt-in, params body, sanitización.
6. Suite ≥ 531 baseline verde + tests nuevos.
7. Session/Auth/FetchTransport sin cambios de frontera prohibidos.

---

## Fuera de alcance

- Implementación `rpc()` runtime
- Cambios Session/Auth/Permissions runtime
- Supabase adapter completo
- Migración V1 `db.rpc` → V2
- UI / `.env`
- Egress HTTP real
- push / PR / merge / deploy

---

## Secuencia PO recomendada

```
RPC DISCOVERY (este ticket)
  → commit Edge Header Policy (si PO aprueba)
  → RPC IMPLEMENTATION
  → MOD-003 snapshot wiring (ticket separado)
  → domain services
  → Supabase adapter (opcional)
```

---

*Discovery cerrado 2026-07-11 — TICKET-V2-PHASE-6-RPC-DISCOVERY-001 — implementación no autorizada.*
