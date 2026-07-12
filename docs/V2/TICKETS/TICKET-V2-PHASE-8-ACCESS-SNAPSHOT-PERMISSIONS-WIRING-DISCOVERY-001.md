# TICKET-V2-PHASE-8-ACCESS-SNAPSHOT-PERMISSIONS-WIRING-DISCOVERY-001

## Estado

**DISCOVERY CORREGIDO — APTO PARA COMMIT (PENDIENTE AUTORIZACIÓN PO)**

| Campo | Valor |
|-------|-------|
| Fase | V2 — Phase 8 |
| Modo | Auditoría técnica + diseño documental + corrección QA |
| Corrección | `TICKET-V2-PHASE-8-ACCESS-SNAPSHOT-PERMISSIONS-WIRING-DISCOVERY-FIX-001` |
| Fecha | 2026-07-12 |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD | `682ca57611a9930b6633eec8ffd940d674fc5234` — `feat(v2-errors): add api and domain error bridge` |
| Suite baseline | **638/638 PASS** · **51/51 files** |
| Working tree | Limpio |
| Implementación / wiring / boot / portales | ❌ No autorizado en este ticket |
| Egress real | ❌ Prohibido |
| Commit / push / PR / deploy | ❌ No autorizado |

### Decisiones PO vinculantes (FIX-001)

| Tema | Decisión |
|------|----------|
| Arquitectura standalone | ✅ `AccessPermissionOrchestrator` aprobado |
| Wiring Session / boot / flag / portales | ❌ No aprobado aún |
| `PERMISSIONS_PENDING` | Interno privado; no lifecycle público |
| Admin mapping | `admin` → `staff.manager` → `staff_manager` |
| Concurrencia | `resolutionEpoch` + latest-wins + `AbortSignal` + single-flight |
| `SessionReaderPort` en input | ❌ Eliminado — solo `AccessSnapshotService` |
| Eventos orchestrator v1 | ❌ Ninguno |
| `sftOk` | Fuera de alcance v1 |
| `defaultAuthenticatedProfile` | Intacto en próximo ticket standalone |

---

## 1. Objetivo

Diseñar formalmente la integración controlada entre:

| Módulo | Rol en la integración |
|--------|------------------------|
| **Access Snapshot Domain Service** | Obtiene y valida RPC `mdj_access_snapshot`; mapea a `ProfileResolveInput` + `SnapshotFlags` |
| **MOD-014 Error Bridge** | Normaliza errores API y dominio sin doble publicación |
| **MOD-003 Permission Resolver** | Deriva `PermissionSnapshot` desde perfil + flags + portal |
| **MOD-002 Session Manager / SessionProvider** | Adjunta permisos al snapshot; emite eventos de sesión |

La integración futura debe **sustituir de forma segura** el perfil autenticado provisional (`defaultAuthenticatedProfile`) por un perfil resuelto desde `mdj_access_snapshot`, cumpliendo:

- Sin fallback silencioso a guest.
- Sin elevación de privilegios.
- Sin destruir sesión válida por error temporal (500/timeout).
- Sin egress real durante discovery.
- Sin modificar runtime en este ticket.

---

## 2. Baseline

### 2.1 Verificación Git (PASO 1)

| Verificación | Resultado |
|--------------|-----------|
| `pwd` | `/Users/djmago/Desktop/miami-dj-beat-platform` |
| Rama | `plan/v2-phase-4-api-client` ✅ |
| HEAD | `682ca57611a9930b6633eec8ffd940d674fc5234` ✅ |
| Working tree | 1 untracked (este doc) ✅ |
| Staging | Vacío ✅ |
| Untracked inesperados | Ninguno ✅ |

### 2.2 Commits recientes esperados

```
682ca57 feat(v2-errors): add api and domain error bridge
0e3bfdc feat(v2-api): wire access snapshot domain service
af0703a feat(v2-api): add supabase adapter
2e6a3bf docs(v2-api): add phase 7 supabase adapter discovery
```

### 2.3 Documentos leídos (PASO 2)

| Documento | Estado |
|-----------|--------|
| `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | Leído |
| `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Leído |
| `docs/V2/GOVERNANCE/AGENT-STARTUP-GATE.md` | Leído |
| `docs/V2/GOVERNANCE/AGENT-GOVERNANCE-PIPELINE.md` | Leído |
| `docs/V2/GOVERNANCE/AGENT-WORK-AUTHORIZATION-FORM.md` | Leído |
| `docs/V2/TICKETS/TICKET-V2-PHASE-7-SUPABASE-ADAPTER-DISCOVERY-001.md` | Leído |
| `docs/V2/TICKETS/TICKET-V2-PHASE-7-DOMAIN-SERVICE-WIRING-001.md` | Leído |
| `docs/V2/TICKETS/TICKET-V2-PHASE-8-MOD-014-ERROR-BRIDGE-IMPLEMENTATION-001.md` | Leído |
| `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` | Leído |
| `docs/V2/NOTA-DIARIA-LAB-001.md` | Leído |
| `docs/V2/README.md` | Leído |

---

## 3. Código auditado

### 3.1 MOD-002 Session (`MiamiDJBeat-MigracionV2/shared/session/`)

| Artefacto | Ruta · líneas |
|-----------|----------------|
| `SessionProvider` | `runtime/session-provider.ts` — clase principal |
| `SessionReaderPort` (consumidor API) | `shared/api/runtime/session-reader-port.ts` |
| `createSessionReaderFromSnapshot` | `shared/api/runtime/session-reader-port.ts` |
| `initializeSession` / `getSessionSnapshot` | `runtime/session-service.ts` |
| `getSessionAuthorizationHeader` | `runtime/session-service.ts:55` |
| Estados lifecycle (`SessionLifecycleState`) | `SESSION_UNINITIALIZED` · `INITIAL_SESSION` · `SIGNED_OUT` · `SIGNED_IN` · `SESSION_READY` · `SESSION_EXPIRED` (`types.ts:40–46`) |
| `SESSION_ERROR` | Existe como **evento/código de error** (`publishSessionEvent('SESSION_ERROR')`), **no** como `SessionLifecycleState` |
| `defaultAuthenticatedProfile` | `session-provider.ts:207–217` |
| `attachPermissions` | `session-provider.ts:220–240` |
| `publishSessionSnapshot` | `session-provider.ts:275–289` |
| Restore autenticado | `applyRestoredRecord` → L607 asigna `defaultAuthenticatedProfile` |
| `ingestAuthHandle` | L642–717; L688–690 asigna provisional si `permissionProfile.kind === 'guest'` |
| Anonymous ready | `completeAnonymousReady` L507–566 — `permissionProfile = { kind: 'guest' }` |
| Logout / destroy | `signOut` / `destroySession` — limpia credenciales; republica guest |
| Refresh | `SessionRefreshPort` — single-flight vía provider |
| Test hooks permisos | `setSessionPermissionProfileForTests` / `setSessionPermissionFlagsForTests` — `session-service.ts:115+` |

### 3.2 MOD-003 Permissions (`MiamiDJBeat-MigracionV2/shared/permissions/`)

| Artefacto | Ruta |
|-----------|------|
| `ProfileResolveInput`, `SnapshotFlags`, `PermissionSnapshot` | `runtime/types.ts` |
| `resolvePermissionSnapshot` | `runtime/permission-resolver.ts` |
| Matriz staff | `profile-matrix.ts:51–55` — `staff.owner`→`staff_owner`, `staff.manager`→`staff_manager`, `staff.seller`→`staff_seller` |
| Tests resolver | `tests/unit/permission-resolver.test.ts` |
| Tests session wire | `tests/unit/session-permissions.test.ts` |

### 3.3 Access Snapshot Service

| Artefacto | Ruta |
|-----------|------|
| Tipos + validación payload | `shared/services/access-snapshot/access-snapshot-types.ts` |
| Servicio + mapper | `shared/services/access-snapshot/access-snapshot-service.ts` |
| Factory pública | `shared/services/access-snapshot/index.ts` |
| Tests | `tests/unit/access-snapshot-service.test.ts` |

### 3.4 MOD-014 Error Bridge

| Artefacto | Ruta |
|-----------|------|
| `normalizeApiClientError` | `shared/errors/runtime/api-normalize.ts` |
| `normalizeDomainError` | `shared/errors/runtime/domain-normalize.ts` |
| `recordNormalizedError` / handler | `shared/errors/runtime/error-handler-service.ts` |
| Catálogo | `shared/errors/runtime/catalog.ts` |
| Tests | `tests/unit/api-error-bridge.test.ts` |

### 3.5 Bootstrap

| Artefacto | Ruta · notas |
|-----------|--------------|
| Orden boot | `bootstrap/boot.ts:117–145` — CONFIG → BUS → LOG → ERROR → AUTH → **SESSION** → API → RUNTIME |
| API init + SessionReader live | `bootstrap/initialize-api.ts:26–31, 91–96` |
| Cancelación logout API | `initialize-api.ts:55–75` — `USER_LOGOUT` + `SESSION_DESTROYED` → `cancelAll()` |

---

## 4. Estado actual

### 4.1 Flujo autenticado hoy

1. Boot: `initializeSession({ portal })` → anonymous `SESSION_READY` con perfil `guest`.
2. Auth handoff: `ingestAuthHandle` valida handle, asigna usuario, y si `permissionProfile.kind === 'guest'` aplica **`defaultAuthenticatedProfile(portal)`** (provisional por portal).
3. Restore: si hay `userId` en persistencia, asigna **`defaultAuthenticatedProfile(portal)`** antes de `SESSION_READY`.
4. `publishSessionSnapshot('SESSION_READY')` → `attachPermissions` → `resolvePermissionSnapshot` → snapshot enriquecido congelado.
5. **No existe** llamada a `mdj_access_snapshot` en runtime de sesión.
6. **No existe** consumidor de `normalizeApiClientError` / `normalizeDomainError` fuera de tests.

### 4.2 Perfil provisional actual (`defaultAuthenticatedProfile`)

| Portal | Perfil asignado |
|--------|-----------------|
| `client` | `{ kind: 'client', profileId: 'client.regular' }` |
| `staff` | `{ kind: 'staff', profileId: 'staff.seller' }` |
| `artist` | `{ kind: 'artist', profileId: 'artist.dj', tier: 'Lite' }` |

**Riesgo conocido:** usuario autenticado puede recibir capacidades de un perfil que no coincide con su identidad real hasta que exista wiring RPC.

### 4.3 Compatibilidad mapper ↔ MOD-003

El mapper `mapAccessSnapshotToProfileResolveInput` (access-snapshot-service) produce tipos que MOD-003 acepta **cuando el mapping es `ok: true`**:

| Payload RPC (`profile_kind`) | `ProfileResolveInput` | `SnapshotFlags` | MOD-003 role |
|------------------------------|----------------------|-----------------|--------------|
| `buyer` + VIP | `client.vip` o `client.regular` | `clientVip: true` solo si VIP | `buyer` |
| `artist` + tier | `artist.dj` + `tier` Lite/Pro/Elite | — | `artist_*` |
| `staff_seller` | `staff.seller` | — | `staff_seller` |
| `staff_full` + owner | `staff.owner` | — | `staff_owner` |
| `staff_full` + admin/manager | `staff.manager` | — | `staff_manager` |

**Hallazgos de compatibilidad (no asumir solo por TS):**

| Caso | Resultado |
|------|-----------|
| VIP | Requiere **ambos**: `profileId: 'client.vip'` **y** `flags.clientVip === true` (`session-permissions.test.ts:100–116`) |
| `staff_admin` documentado | Existe en `role-matrix.ts` pero **no** es salida directa del mapper; SQL `admin` → `staff.manager` → `staff_manager` |
| Mapping `ok: false` | Códigos `ACCESS_SNAPSHOT_*` — **no** debe llamarse `resolvePermissionSnapshot` con guest |
| Guest | Solo para sesión anónima explícita; mapper rechaza `no_session` |
| `sftOk` | `SnapshotFlags.sftOk` **no** está disponible en `mdj_access_snapshot` v1 — fuera de alcance orchestrator; no inferir SoundForTips desde este RPC |

### 4.4 Eventos existentes vs. especificación del ticket

| Evento solicitado en diseño | ¿Existe en catálogo? |
|----------------------------|----------------------|
| `SESSION_READY` | ✅ `events/runtime/catalog.ts` |
| `SESSION_EXPIRED` | ✅ |
| `PERMISSION_CHANGED` | ✅ |
| `SYSTEM_ERROR` | ✅ |
| `API_CANCELLED` | ❌ No como evento de bus; es `ApiErrorCode` bridge → `ERR-0504` |
| `PERMISSIONS_READY` | ❌ **No existe** |
| `PROFILE_RESOLVED` | ❌ **No existe** |

**Conclusión:** orchestrator standalone v1 **no emite eventos**. Integración futura SessionProvider puede republicar `SESSION_READY` (método privado `republishReadySnapshot` ya existe) sin crear evento nuevo. `PERMISSION_CHANGED` queda autorizado a MOD-003 en catálogo; SessionProvider no lo emite hoy.

---

## 5. Hallazgos clave

### H-01 — SessionProvider no debe ejecutar RPC directamente

`SessionProvider` ya concentra máquina de estados, persistencia, auth boundary, refresh y publicación de snapshots. Añadir fetch RPC aquí:

- Mezcla transporte/API con lifecycle de sesión.
- Dificulta tests unitarios de sesión vs. dominio.
- Aumenta riesgo de dependencia circular (sesión → API → SessionReader → sesión).

### H-02 — Boot ordena SESSION antes de API_CLIENT

`boot.ts` inicializa sesión **antes** del API client. El orchestrator debe invocarse **después** de `API_READY` y solo cuando exista sesión autenticada con credencial válida.

### H-03 — Cancelación logout ya cableada en API layer

`initialize-api.ts` cancela requests in-flight en `USER_LOGOUT` / `SESSION_DESTROYED`. El orchestrator debe tratar `API_CANCELLED` como **no error operativo** si el motivo es logout.

### H-04 — `defaultAuthenticatedProfile` es fallback silencioso de facto

Se aplica en restore e ingest sin señalización al usuario ni al bus. Sustituir por estado intermedio explícito antes de eliminar el helper.

### H-05 — Error bridge listo pero sin consumidor de sesión

`normalizeApiClientError` y `normalizeDomainError` publican vía `recordNormalizedError`. El orchestrator debe ser el **único** punto que normaliza errores de esta cadena (evitar doble normalización en SessionProvider).

### H-06 — Permission resolver es puro y síncrono

`resolvePermissionSnapshot` no hace I/O. El orchestrator lo invoca **solo** tras mapping exitoso. Puede **lanzar** `PermissionError` (`profile-matrix.ts`) — el orchestrator debe capturarlo y devolver `{ ok: false, stage: 'permissions', retryable: false }` sin guest ni permisos provisionales.

### H-07 — Concurrencia

Dos llamadas concurrentes requieren **single-flight** por instancia, `resolutionEpoch` monotónico, **latest-wins**, `AbortSignal`, y descarte de respuestas stale. Ver §14. Comparación de `sessionId` pertenece al futuro SessionProvider wiring.

---

## 6. Arquitecturas comparadas

### A — SessionProvider ejecuta AccessSnapshotService directamente

| Criterio | Evaluación |
|----------|------------|
| Separación responsabilidades | ❌ Mala — mezcla MOD-002 con MOD-005/ dominio |
| Testabilidad | ❌ Tests de sesión requieren mock RPC |
| Dependencia circular | ⚠️ Alta — SessionProvider → ApiClient → SessionReader → snapshot |
| Orden boot | ⚠️ Requiere lazy init API dentro de SessionProvider |
| Cancelación / logout race | ⚠️ Difícil aislar |
| Error handling | ⚠️ Mezcla normalizeError de sesión con bridge API |
| Retry | ⚠️ Acoplado al lifecycle |
| Integración futura | ❌ Frágil |

**Veredicto:** Rechazada.

### B — Permission Resolver ejecuta el RPC

| Criterio | Evaluación |
|----------|------------|
| Separación | ❌ MOD-003 debe permanecer puro (constitución Phase 7) |
| Testabilidad | ❌ Rompe contrato actual del resolver |
| Dependencia circular | ❌ Permissions → API → Session |
| PO Q-02 | ❌ Explícitamente prohibido modificar MOD-003 core |

**Veredicto:** Rechazada.

### C — `AccessPermissionOrchestrator` delgado (factory, sin red propia)

```
AccessSnapshotService.fetchSnapshot()   [encapsula SessionReader]
  → mapper (en servicio)
  → resolvePermissionSnapshot()         [MOD-003, sync; catch PermissionError]
  → Error Bridge en fallos
  → resultado explícito al caller
  [futuro wiring] SessionProvider.applyResolvedPermissions() + republishReadySnapshot() privado
```

| Criterio | Evaluación |
|----------|------------|
| Separación | ✅ Cada módulo mantiene ownership |
| Testabilidad | ✅ Orchestrator unit + MemoryTransport |
| Dependencia circular | ✅ Inyección unidireccional |
| Orden boot | ✅ Se registra post API_READY |
| Cancelación | ✅ Reutiliza cancelAll + AbortSignal opcional |
| Error handling | ✅ Un solo normalizador por fallo |
| Retry | ✅ Política centralizada |
| Integración futura | ✅ Feature flag en factory boot |

**Veredicto:** **Recomendada.**

### D — Boot wiring coordina todo directamente

| Criterio | Evaluación |
|----------|------------|
| Separación | ⚠️ boot.ts crece con lógica de dominio |
| Testabilidad | ❌ Lógica de resolución no reusable fuera de boot |
| Refresh / re-login | ❌ Boot no es el lugar para re-disparar RPC |

**Veredicto:** Boot solo **registra factory** del orchestrator (composición), no implementa la cadena.

---

## 7. Arquitectura recomendada

**Opción C — `AccessPermissionOrchestrator` delgado** — **aprobado PO** para implementación standalone.

| Ámbito | Estado PO |
|--------|-----------|
| Orchestrator standalone + factory + tests | ✅ Aprobado |
| SessionProvider wiring | ❌ No aprobado aún |
| Bootstrap wiring | ❌ No aprobado aún |
| Feature flag | ❌ No aprobado aún |
| Portales / egress real | ❌ No aprobado aún |
| Eventos nuevos | ❌ Prohibido |

Principios:

1. Orchestrator **no** posee red; delega en `AccessSnapshotService` (sin `SessionReaderPort` redundante en input).
2. Orchestrator **no** muta máquina de estados de sesión; solo retorna resultado explícito.
3. Orchestrator **no emite eventos** en v1.
4. SessionProvider conserva `attachPermissions` y publicación de `SESSION_READY` (ticket futuro).
5. Error Bridge se invoca **una vez** por fallo; `SYSTEM_ERROR` lo publica MOD-014 cuando corresponda.
6. Logout concurrente → `API_CANCELLED` → sin `SYSTEM_ERROR`.

---

## 8. Ownership

| Paso | Propietario |
|------|-------------|
| Confirmar sesión autenticada + credencial | MOD-002 SessionProvider (futuro wiring); verificación sesión vía `AccessSnapshotService` |
| `fetchSnapshot()` RPC | Access Snapshot Domain Service |
| Validación payload | Access Snapshot Domain Service |
| Mapping a ProfileResolveInput + flags | Access Snapshot Domain Service |
| `resolvePermissionSnapshot` | MOD-003 (sin cambios core); orchestrator captura `PermissionError` |
| Adjuntar perfil + flags al provider | MOD-002 — futuro `applyResolvedPermissions()` (**nuevo**) |
| Republicar snapshot enriquecido | MOD-002 — `republishReadySnapshot()` **ya existe** (privado L434–448); wiring futuro lo reutiliza |
| Normalización errores | MOD-014 bridge (orchestrator invoca; no publica eventos directamente) |
| Concurrencia / stale | Orchestrator (`resolutionEpoch`, latest-wins, AbortSignal) |
| Registro factory + flag | Bootstrap — ticket futuro |
| Cancelación in-flight | MOD-005 API + eventos logout existentes |

---

## 9. Flujo de éxito

Secuencia canónica (**futuro Session wiring**, post feature-flag ON):

```
1. Trigger: ingestAuthHandle OK | restore autenticado | refresh re-hydrate (futuro)
2. SessionProvider confirma: máquina AUTHENTICATED, accessTokenRef presente
3. Orchestrator.resolve({ portal, userId, sessionId, snapshotVersion, correlationId?, signal? })
4. AccessSnapshotService.fetchSnapshot() — authMode session sellado
5. ApiSuccess → validateMdjAccessSnapshotPayload
6. mapAccessSnapshotToProfileResolveInput → { ok:true, profile, flags }
7. resolvePermissionSnapshot({ profile, flags, portal, userId, snapshotVersion })
8. SessionProvider.applyResolvedPermissions(profile, flags)   [futuro]
9. SessionProvider.republishReadySnapshot(reason)             [privado existente]
10. SESSION_READY emitido por SessionProvider (no por orchestrator)
11. Return orchestrator: { ok: true, profile, flags, permissions, correlationId, resolutionEpoch }
```

**Notas:**

- Orchestrator standalone (próximo ticket) ejecuta pasos 3–7 y retorna resultado; **no** toca SessionProvider.
- No emitir `PERMISSIONS_READY` ni `PROFILE_RESOLVED` (no existen).
- `correlationId`: propagar desde `ApiMetadata` en fallos; incluir en resultado de éxito.
- Cancelación: `{ ok: false, stage: 'snapshot', retryable: true, cancelled: true, resolutionEpoch }` sin `SYSTEM_ERROR` operativo.

---

## 10. Flujos de fallo

Leyenda: columna **Orchestrator** = resultado retornado · **Session wiring futuro** = apply/conservación · **Portal** = UI.

| # | Escenario | Orchestrator | Session wiring futuro | Evento (wiring) | Retry | Destruir sesión |
|---|-----------|--------------|----------------------|-----------------|-------|-----------------|
| 1 | Sin sesión / anon | `stage:'session'` o mapping `no_session` → ERR-0300 | No invocar en anon | — | No | No |
| 2 | Sesión expirada antes RPC | `stage:'session'` | Delegar Session Mgr | `SESSION_EXPIRED` | No | No auto |
| 3 | Sesión expira durante RPC | 401 → normalizeApiClientError | Session Mgr | `SESSION_EXPIRED` | Sí post re-login | No auto |
| 4 | HTTP 401 | `stage:'snapshot'`, retryable | Session Mgr → expired | `SESSION_EXPIRED` | Sí | No |
| 5 | HTTP 403 | fallo explícito, retryable:false | **No** aplicar nuevos permisos; política conservación → Q-06 | `SYSTEM_ERROR` | Manual | **No** |
| 6 | HTTP 500 | fallo explícito, retryable:true | política conservación → **Q-02** (diferido) | `SYSTEM_ERROR` | Sí backoff | **No** |
| 7 | Timeout | ERR-0502, retryable:true, sin SYSTEM_ERROR | política conservación → Q-02 | Log only | Sí | **No** |
| 8 | Cancelación logout | `cancelled:true`, API_CANCELLED | guest final | `SESSION_DESTROYED` | No | Ya en logout |
| 9 | Payload malformado | normalizeApiClientError / domain | no apply | `SYSTEM_ERROR` | Limitado | No |
| 10 | `{ ok:false, reason:'no_session' }` | ERR-0300 domain | guest si anon | `SYSTEM_ERROR` | No | No |
| 11 | Perfil desconocido | ERR-0999, retryable:false | no apply; **flag ON: sin provisional** | `SYSTEM_ERROR` | No | No |
| 12 | Staff no resoluble | ERR-0999, retryable:false | no apply; **flag ON: sin provisional** | `SYSTEM_ERROR` | No | No |
| 13 | `PermissionError` | `stage:'permissions'`, retryable:false | no apply | `SYSTEM_ERROR` | No | No |
| 14 | Event Bus no ready | resultado local OK/fail | wiring decide apply | Bridge puede omitir publish | Sí | No |
| 15 | Error Handler no ready | `NormalizedError` retornado | wiring decide apply | Ninguno | Sí | No |

### Política flag futuro (Session wiring — no orchestrator standalone)

| Flag | Comportamiento |
|------|----------------|
| **OFF** | `defaultAuthenticatedProfile` provisional actual se conserva hasta wiring explícito |
| **ON** | No usar `defaultAuthenticatedProfile` como fallback silencioso; fallo RPC → no apply; conservación de último snapshot válido → **Q-02** |

### Reglas obligatorias aplicadas

- ❌ No convertir errores en guest autenticado.
- ❌ No usar `defaultAuthenticatedProfile` como fallback silencioso cuando flag ON.
- ❌ No destruir sesión válida por 500/timeout.
- ❌ Orchestrator no conserva ni aplica permisos antiguos (solo retorna resultado).
- ✅ 401/expired → Session Manager (wiring futuro).
- ✅ 403 ≠ sesión expirada automáticamente.

---

## 11. Política de sesión

| Regla | Decisión |
|-------|----------|
| `PERMISSIONS_PENDING` | **Estado interno privado** futuro (SessionProvider o integración). **No** nuevo `SessionLifecycleState` público — decisión PO |
| Sesión autenticada sin snapshot | Con flag ON futuro: no publicar capacidades elevadas hasta RPC OK |
| Restore con userId | Disparar orchestrator antes de `SESSION_READY` final cuando flag ON (wiring futuro) |
| `ingestAuthHandle` | Misma regla; no asignar `defaultAuthenticatedProfile` si flag ON |
| Error 500/timeout | Sesión permanece autenticada en wiring; política de permisos → Q-02 |
| Logout | Cancelar resolución in-flight; limpiar `permissionProfile` → guest (SessionProvider) |
| Refresh token | Re-fetch condicional → **Q-04** (diferido) |

---

## 12. Política de permisos

| Regla | Decisión |
|-------|----------|
| Fuente de verdad perfil | RPC `mdj_access_snapshot` mapeado |
| VIP | `client.vip` + `flags.clientVip === true` |
| Staff admin SQL | `admin` → `staff.manager` → `staff_manager` — **no** crear `staff_admin` — decisión PO |
| `sftOk` / SoundForTips | Fuera de alcance orchestrator v1; RPC actual no expone flag |
| Mapping failure | No llamar MOD-003; no guest substitute |
| Versión snapshot | `snapshotVersion` en `PermissionResolverInput` |
| Cambio perfil (wiring futuro) | Republicar `SESSION_READY` vía `republishReadySnapshot` privado; no emitir desde orchestrator |

---

## 13. Política de errores (MOD-014)

| Pregunta | Respuesta |
|----------|-----------|
| ¿Cuándo `normalizeApiClientError`? | `ApiFailure` de `fetchSnapshot` (HTTP, parse, timeout, cancelled, invalid payload) |
| ¿Cuándo `normalizeDomainError`? | `AccessSnapshotMappingResult` con `ok: false` |
| `PermissionError` | Capturar en orchestrator; normalizar vía `normalizeError()` (no existe `normalizePermissionError` dedicado) → `stage:'permissions'`, `retryable:false` |
| ¿Qué publica `SYSTEM_ERROR`? | MOD-014 Error Handler vía `recordNormalizedError` cuando severity ≥ ERROR |
| ¿Qué no publica? | `API_CANCELLED` (INFO), `API_TIMEOUT` (WARNING) |
| Orchestrator y eventos | Orchestrator **no** publica `SYSTEM_ERROR` directamente; invoca bridge |
| `correlationId` | Tomar de `ApiMetadata`; pasar en `NormalizeContext` y resultado |
| Evitar doble normalización | Un call bridge por error en orchestrator |
| Handler no ready | Retornar `NormalizedError` al caller |
| ¿Retornar error además de normalizar? | **Sí** — rama `ok: false` del resultado |

---

## 14. Política de concurrencia y stale responses

Aplica al **orchestrator standalone** (obligatorio en próximo ticket):

| Regla | Implementación |
|-------|----------------|
| `resolutionEpoch` | Contador monotónico **por instancia** de orchestrator; incrementa al iniciar cada `resolve()` |
| Política de victoria | **Latest-wins** — solo la resolución con epoch más alto puede completar con éxito |
| Single-flight | Una sola resolución activa por instancia; nueva llamada cancela la anterior vía `AbortController` interno |
| `AbortSignal` | `options.signal` opcional propagado a `fetchSnapshot()`; respetar `signal.aborted` antes de apply |
| Descarte por epoch | Si al completar `completionEpoch !== currentEpoch`, descartar resultado (`cancelled` o noop) |
| Descarte por abort | Si `signal.aborted` al completar, retornar `{ ok: false, cancelled: true }` sin side effects |
| Sin resultados stale | Orchestrator **no** aplica permisos ni muta sesión — solo retorna resultado o fallo |
| Sin estado global | Epoch y AbortController viven en la instancia factory-created |
| Comparación `sessionId` | **Diferido** — pertenece al futuro SessionProvider wiring, no al standalone |

**Retry:** orchestrator marca `retryable` en el resultado; el caller (futuro Session hook) decide reintento. Orchestrator no conserva permisos previos.

---

## 15. `defaultAuthenticatedProfile` — decisión recomendada

**Decisión PO — próximo ticket standalone:**

| Componente | Decisión |
|------------|----------|
| `TICKET-V2-PHASE-8-ACCESS-PERMISSION-ORCHESTRATOR-001` | **`defaultAuthenticatedProfile` permanece totalmente intacto** |
| Eliminación / reemplazo | Requiere ticket separado de Session wiring |
| Feature flag | **No** aplica al standalone |
| Flag ON (futuro) | Reemplazar provisional por RPC + estado interno `PERMISSIONS_PENDING` |
| Flag OFF (futuro) | Mantener comportamiento actual |
| Tests | Fixtures explícitos (`setSessionPermissionProfileForTests`) |

---

## 16. Contratos propuestos (documentación únicamente)

```typescript
import type { NormalizedError, normalizeApiClientError, normalizeDomainError, normalizeError } from '@mdj/shared/errors';
import type {
  PermissionSnapshot,
  ProfileResolveInput,
  SnapshotFlags,
  resolvePermissionSnapshot,
} from '@mdj/shared/permissions';
import type { AccessSnapshotService } from '@mdj/shared/services/access-snapshot';
import type { PortalId } from '@mdj/shared/config';

export type AccessPermissionResolutionStage =
  | 'session'
  | 'snapshot'
  | 'mapping'
  | 'permissions';

export type AccessPermissionResolutionResult =
  | {
      readonly ok: true;
      readonly profile: ProfileResolveInput;
      readonly flags: SnapshotFlags;
      readonly permissions: PermissionSnapshot;
      readonly correlationId: string;
      readonly resolutionEpoch: number;
    }
  | {
      readonly ok: false;
      readonly stage: AccessPermissionResolutionStage;
      readonly normalizedError: NormalizedError;
      readonly retryable: boolean;
      readonly resolutionEpoch: number;
      readonly cancelled?: boolean;
      readonly correlationId?: string;
    };

export type AccessPermissionResolutionOptions = {
  readonly portal: PortalId;
  readonly userId: string;
  readonly sessionId: string;
  readonly snapshotVersion: number;
  readonly correlationId?: string;
  readonly signal?: AbortSignal;
};

export type CreateAccessPermissionOrchestratorInput = {
  readonly accessSnapshotService: AccessSnapshotService;
  readonly resolvePermissions: typeof resolvePermissionSnapshot;
  readonly normalizeApiClientError: typeof normalizeApiClientError;
  readonly normalizeDomainError: typeof normalizeDomainError;
  readonly normalizeError: typeof normalizeError;
  readonly moduleId?: string;
};

export type AccessPermissionOrchestrator = {
  readonly resolve: (
    options: AccessPermissionResolutionOptions,
  ) => Promise<AccessPermissionResolutionResult>;
};

/** Session hook (futuro MOD-002 — no implementar en standalone) */
export type ApplyResolvedPermissionsPort = {
  readonly applyResolvedPermissions: (
    profile: ProfileResolveInput,
    flags: SnapshotFlags,
  ) => void;
  /** republishReadySnapshot() ya existe como método privado en SessionProvider */
};
```

**Métodos orchestrator:**

- `resolve(options)` — único entry; sin estado global; `resolutionEpoch` + latest-wins + single-flight por instancia.
- Sin tokens, session handles ni `SessionReaderPort` en input (encapsulado en `AccessSnapshotService`).

---

## 17. Eventos

| Evento | Emisor actual | Orchestrator v1 |
|--------|---------------|-----------------|
| `SESSION_READY` | SessionProvider | ❌ No emite |
| `SESSION_EXPIRED` | SessionProvider | ❌ No emite |
| `PERMISSION_CHANGED` | MOD-003 (catálogo `authorizedEmitters`) | ❌ No emite; `attachPermissions()` tampoco emite hoy |
| `SYSTEM_ERROR` | MOD-014 Error Handler | ❌ No emite directamente; invoca bridge |
| `USER_LOGOUT` | Auth service (`auth-service.ts`) | ❌ No emite |
| `SESSION_DESTROYED` | SessionProvider | ❌ No emite |

**Wiring futuro:** SessionProvider puede republicar `SESSION_READY` vía `republishReadySnapshot()` privado existente. Sin eventos nuevos.

---

## 18. Test plan (diseño — no implementar en discovery)

### A. Unit — orchestrator (`access-permission-orchestrator.test.ts`)

- buyer regular / VIP + flags
- artist Lite / Pro / Elite
- staff seller / owner / manager
- `no_session`, 401, 403, 500, timeout, cancelled
- malformed payload, unknown profile, unresolved staff
- no fallback guest, no privilege escalation
- `PermissionError` → stage permissions, retryable false
- resolutionEpoch + latest-wins + stale discard
- controlled retry
- `SYSTEM_ERROR` solo cuando corresponde
- MemoryTransport only — no network default

### B. Contract — AccessSnapshotService

- Reutilizar fixtures de `access-snapshot-service.test.ts`

### C. Integration — MemoryTransport + API client

- Cadena completa fetch → map → resolve

### D. Session integration

- Flag ON: ingest sin `defaultAuthenticatedProfile`
- `PERMISSIONS_PENDING` behavior

### E. Error Bridge integration

- Verificar un solo `recordNormalizedError` por fallo

### F. Logout / refresh race

- Logout durante RPC → cancelled, guest final
- Refresh durante RPC → definir en ticket refresh

### G. Playwright futuro

- Portal client autenticado muestra capacidades RPC

### H. Egress QA futuro

- RPC real en lab con feature flag; sin anon

---

## 19. Mapa de archivos futuro

### Nuevos (v1 implementación)

| Archivo | Clasificación |
|---------|---------------|
| `shared/services/access-permissions/access-permission-orchestrator-types.ts` | Obligatorio v1 |
| `shared/services/access-permissions/access-permission-orchestrator.ts` | Obligatorio v1 |
| `shared/services/access-permissions/index.ts` | Obligatorio v1 |
| `tests/unit/access-permission-orchestrator.test.ts` | Obligatorio v1 |

### Modificaciones existentes (tickets posteriores)

| Archivo | Clasificación | Notas |
|---------|---------------|-------|
| `session-provider.ts` | Obligatorio wiring | `applyResolvedPermissions`, hook orchestrator, flag |
| `session-service.ts` | Obligatorio wiring | Export hook / register |
| `session/types` | Opcional wiring | `PERMISSIONS_PENDING` solo interno privado — no lifecycle público |
| `bootstrap/initialize-api.ts` o `initialize-access-permissions.ts` | Obligatorio wiring | Factory + flag |
| `bootstrap/boot.ts` | Diferido | Solo registro post-API — ticket explícito |
| `permission-resolver.ts` | **Prohibido** | MOD-003 core |
| Portales `client/artist/staff` | Diferido | Tras Egress QA |

---

## 20. Riesgos

| ID | Riesgo | Mitigación |
|----|--------|------------|
| R-01 | Perfil provisional eleva privilegios antes de RPC | `PERMISSIONS_PENDING` + flag |
| R-02 | Doble `SESSION_READY` con distintos permisos | Single-flight orchestrator |
| R-03 | Stale RPC tras logout | `resolutionEpoch` + `AbortSignal` + latest-wins (§14) |
| R-04 | 403 interpretado como logout | Política explícita — no destruir sesión |
| R-05 | admin SQL → `staff_manager` | **Cerrado PO:** mantener; no `staff_admin` |
| R-06 | Boot SESSION antes API | Orchestrator solo post `API_READY` |
| R-07 | Tests 638 regressions | Flag OFF por defecto hasta suite actualizada |

---

## 21. Criterios de aceptación (implementación futura)

1. Con flag ON y sesión autenticada, permisos derivan de `mdj_access_snapshot` sin `defaultAuthenticatedProfile`.
2. Mapping failure no produce guest autenticado ni elevación.
3. 500/timeout no destruyen sesión autenticada.
4. Logout cancela RPC y limpia permisos.
5. 401 delega a Session Manager.
6. Error bridge invocado una vez por fallo con `correlationId`.
7. Suite unit orchestrator cubre matriz §18 incluyendo concurrencia §14.
8. Sin egress por defecto en CI.
9. PO valida Egress QA en ticket separado antes de flag default ON.

---

## 22. Alcance permitido (próximos tickets)

- Crear orchestrator standalone + tests unit MemoryTransport (sin SessionProvider, sin bootstrap, sin flag).
- Documentación y tickets hijos.

---

## 23. Alcance prohibido

- Modificar MOD-003 core, SessionProvider en este discovery.
- Boot wiring activo en producción.
- Egress real, `.env`, fetch transport default ON.
- Nuevos eventos de bus (`PERMISSIONS_READY`, `PROFILE_RESOLVED`).
- Eliminar `defaultAuthenticatedProfile` sin PO.
- Portales, SessionProvider core refactor, permissions core.

---

## 24. Preguntas abiertas (PO)

### Resueltas para orchestrator standalone

| ID | Pregunta | Decisión PO |
|----|----------|-------------|
| Q-01 | ¿`PERMISSIONS_PENDING` lifecycle público o interno? | **Interno privado** — no nuevo `SessionLifecycleState` |
| Q-03 | ¿`admin` → `staff_admin`? | **No** — `admin` → `staff.manager` → `staff_manager` |
| — | Concurrencia | `resolutionEpoch` + latest-wins + `AbortSignal` + single-flight |
| — | Feature flag en standalone | **No aplica** |

### Abiertas para Session wiring / boot / egress

| ID | Pregunta |
|----|----------|
| Q-02 | ¿Tras 500, conservar último snapshot RPC válido o bloquear UI completamente? |
| Q-04 | ¿Re-fetch snapshot en cada token refresh o solo login/restore? |
| Q-05 | ¿Nombre feature flag? Propuesta: `MDJ_V2_ACCESS_SNAPSHOT_PERMISSIONS_WIRE` |
| Q-06 | ¿403 en snapshot debe forzar sign-out en portal staff? |

---

## 25. Secuencia recomendada de tickets

| # | Ticket | Entregable |
|---|--------|------------|
| 1 | `TICKET-V2-PHASE-8-ACCESS-PERMISSION-ORCHESTRATOR-001` | Orchestrator standalone + unit tests + concurrencia §14 |
| 2 | `TICKET-V2-PHASE-8-ACCESS-PERMISSION-ORCHESTRATOR-INTEGRATION-001` | Contract tests MemoryTransport |
| 3 | `TICKET-V2-PHASE-8-SESSION-PROVIDER-PERMISSIONS-HOOK-DISCOVERY-001` | Diseño hook `applyResolvedPermissions` |
| 4 | `TICKET-V2-PHASE-8-SESSION-PROVIDER-PERMISSIONS-WIRING-001` | Wiring SessionProvider + flag OFF default |
| 5 | `TICKET-V2-PHASE-8-BOOT-ACCESS-PERMISSIONS-FACTORY-001` | Factory bootstrap post API_READY |
| 6 | `TICKET-V2-PHASE-8-ACCESS-SNAPSHOT-EGRESS-QA-001` | Lab egress + evidencia |
| 7 | `TICKET-V2-PHASE-8-PORTAL-PERMISSIONS-VALIDATION-001` | Playwright / manual PO |

**Commits:** separar orchestrator (1–2) de session wiring (4) y boot (5).

---

## 26. Próximo ticket

**`TICKET-V2-PHASE-8-ACCESS-PERMISSION-ORCHESTRATOR-001`**

Alcance exacto aprobado:

| Incluido | Excluido |
|----------|----------|
| Orchestrator standalone + factory + tipos | SessionProvider |
| Tests unit + MemoryTransport | Bootstrap |
| `resolutionEpoch` + latest-wins + `AbortSignal` | Feature flag |
| Error Bridge (`normalizeApiClientError`, `normalizeDomainError`, `normalizeError`) | Eventos |
| `resolvePermissionSnapshot` + catch `PermissionError` | Egress real |
| Sin `SessionReaderPort` en input | Modificar `defaultAuthenticatedProfile` |

---

## Validación discovery

| Comando | Resultado esperado |
|---------|-------------------|
| `git diff --check` | Sin conflictos |
| `git diff --stat` | Solo archivo nuevo doc (untracked) |
| `git status --short` | `?? docs/V2/TICKETS/TICKET-V2-PHASE-8-ACCESS-SNAPSHOT-PERMISSIONS-WIRING-DISCOVERY-001.md` |
| `git rev-parse HEAD` | `682ca57611a9930b6633eec8ffd940d674fc5234` |

**Estado final:** APTO PARA COMMIT DEL DISCOVERY — PENDIENTE AUTORIZACIÓN EXPLÍCITA DEL PRODUCT OWNER
