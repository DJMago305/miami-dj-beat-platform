# TICKET-V2-PHASE-8-SESSION-PROVIDER-PERMISSIONS-WIRING-001

## Estado

**CORRECCIÓN COMPLETADA (FIX-001) — PENDIENTE VALIDACIÓN DEL PRODUCT OWNER**

| Campo | Valor |
|-------|-------|
| Fase | V2 — Phase 8 |
| Modo | Session hook wiring inactivo por defecto + tests unitarios |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD (sin mover) | `7dd515d24965a6118c9724bfea8294be02506c3b` |
| Boot / portales / egress | ❌ No autorizado |
| Commit / push / deploy | ❌ No autorizado |
| Fix aplicado | `TICKET-V2-PHASE-8-SESSION-PROVIDER-PERMISSIONS-WIRING-FIX-001` |

---

## 1. Baseline

| Verificación | Resultado |
|--------------|-----------|
| Rama | `plan/v2-phase-4-api-client` ✅ |
| HEAD | `7dd515d` — `docs(v2-session): add permissions hook discovery` ✅ |
| Staging | Vacío ✅ |
| Suite pre-wiring | 705/705 PASS |
| Suite post-wiring | **747/747 PASS** (54 files) |

Baseline retenida (4 archivos auditados pre-implementación):

- `MiamiDJBeat-MigracionV2/.env.example`
- `MiamiDJBeat-MigracionV2/shared/config/runtime/types.ts`
- `MiamiDJBeat-MigracionV2/shared/config/runtime/validate.ts`
- `MiamiDJBeat-MigracionV2/shared/session/runtime/access-permission-resolution-port.ts`

---

## 2. Decisiones PO vinculantes

| # | Decisión |
|---|----------|
| 1 | Feature flag `MDJ_V2_FEATURE_ACCESS_SNAPSHOT_PERMISSIONS`, default **false** |
| 2 | 500/timeout: nunca logout; conservar sesión; último snapshot válido o permisos mínimos |
| 3 | Refresh v1: `refreshSession()` no dispara resolución nueva |
| 4 | 403: nunca logout; phase `failed`; conservar último válido |
| 5 | 401: no inventar política; preservar semántica Session Manager |
| 6 | Pending privado; `SIGNED_IN` sin capacidades elevadas; sin `SESSION_READY` guest intermedio |
| 7 | `SESSION_READY` autenticado solo tras resolución exitosa (flag ON) |
| 8 | Sin eventos nuevos; SessionProvider no emite `PERMISSION_CHANGED` |

---

## 3. Feature flag

**Nombre:** `MDJ_V2_FEATURE_ACCESS_SNAPSHOT_PERMISSIONS`
**Config:** `features.accessSnapshotPermissions`
**Default:** `false`

---

## 4. Flag OFF

Comportamiento histórico intacto:

- `defaultAuthenticatedProfile` provisional en login/restore
- `attachPermissions` vía MOD-003
- `SESSION_READY` inmediato tras handoff/restore
- Resolution port **no** invocado
- Phase privada permanece `idle`

---

## 5. Flag ON

- Omite `defaultAuthenticatedProfile` provisional
- `applyMinimumPermissions()` (guest / mínimos)
- Lifecycle `SIGNED_IN` hasta éxito de resolución
- `await resolveAndCommitAccessPermissions(trigger)`
- `SESSION_READY` autenticado **solo** en success
- Sin `PERMISSION_CHANGED`
- Sin logout automático en 403/500/timeout

---

## 6. Estado pending privado

```typescript
permissionsResolutionPhase: 'idle' | 'pending' | 'resolved' | 'failed'
```

Almacenamiento privado (scoped por identidad):

- `lastValidPermissionIdentity` — `{ userId, sessionId, portal }`
- `lastValidPermissionProfile` — clon/freeze
- `lastValidPermissionFlags` — clon/freeze
- `lastValidPermissionSnapshot` — clon/freeze

`applyFailurePolicy` reutiliza last valid **solo** si la identidad activa coincide exactamente. Handoff/restore con identidad distinta invalida el cache antes de resolver.

No serializado en session storage. Limpiado en logout/destroy/reset.

---

## 7a. Contrato async (FIX-001)

**Alias canónico:** `SessionAuthOutcome = SessionSnapshot | Promise<SessionSnapshot>` (`types.ts`)

Superficies alineadas (sin cast):

- `SessionPublicApi.ingestAuthHandle`
- `session-service.ingestAuthHandle` / `deliverAuthHandoff` / `hydrateSession`
- `SessionProvider.ingestAuthHandle` / `runHydrationRestore` / `hydrateSession`

**Callers internos corregidos** (Promise observada vía `commitSessionAuthOutcome`):

- `handleUserLoginEvent`
- `initialize` → `runHydrationRestore`
- `handleSystemReadyEvent` → `runHydrationRestore`

`trackSessionAuthOutcome` registra in-flight solo cuando el outcome es `Promise`; errores async capturados con `.catch()` (sin unhandled rejection). Flag OFF permanece síncrono.

---

## 7. Login (`ingestAuthHandle` / auth-handoff)

**Flag OFF:** flujo histórico (`ingestAuthHandleFlagOff`).

**Flag ON:** `ingestAuthHandleFlagOn`:

1. Validar handoff
2. Transición máquina → `AUTHENTICATED`
3. `SIGNED_IN` + permisos mínimos
4. `bumpSessionPermissionGeneration()`
5. `await resolveAndCommitAccessPermissions('auth-handoff')`
6. Success → `applyResolvedPermissions` + `publishAuthenticatedSessionReady`
7. Failure → `applyFailurePolicy`; sesión permanece `SIGNED_IN`

---

## 8. Restore (`applyRestoredRecord`)

**Flag OFF:** `applyRestoredRecordFlagOff` (histórico).

**Flag ON:** `applyRestoredRecordFlagOn` (async):

- Restaura identidad
- `SIGNED_IN` + mínimos
- `await resolveAndCommitAccessPermissions('restore')`
- `SESSION_READY` solo en success

---

## 9. SESSION_READY

| Contexto | Emisión |
|----------|---------|
| Boot anónimo | Sin cambio (baseline PO 2026-07-06) |
| Flag OFF auth/restore | Inmediata (sin cambio) |
| Flag ON auth/restore | **Una vez** tras resolución exitosa |
| Flag ON pending/failure | **No** emite autenticado nuevo |
| `republishReadySnapshot` flag ON | Bloqueado salvo `phase === 'resolved'` |

---

## 10. Failure policy

| Código / caso | Acción |
|---------------|--------|
| 403 / mapping / permission | `phase = failed`; no logout; no permisos nuevos; último válido o mínimos |
| 500 / timeout / throw | Igual; nunca logout |
| 401 | Propagado al caller; sin guest silencioso en hook |
| cancelled / stale | No aplicar; `phase = idle`; sin `SESSION_READY` |
| Port ausente | `phase = failed`; sin `SESSION_READY` autenticado |

---

## 11. Last valid snapshot

`applyResolvedPermissions` persiste último resultado válido con identidad `{ userId, sessionId, portal }` y clones frozen (sin referencias mutables al orchestrator).

`applyFailurePolicy` restaura last valid solo si identidad coincide; si no, `clearLastValidPermissionCache()` + `applyMinimumPermissions()`.

Handoff/restore con usuario distinto: `invalidateLastValidUnlessSameIdentity()` antes de resolver — **sin herencia cross-user**.

`lastPermissionResolutionFailure` almacena el último fallo del port (p. ej. 401 con `normalizedError`) — expuesto en tests vía `getLastPermissionResolutionFailureForTests()`.

---

## 12–14. 403 / 500-timeout / 401

Ver tabla §10. Sin logout automático en 403/500/timeout. 401 preserva semántica Session Manager.

---

## 15–16. Logout race y concurrencia

- `sessionPermissionGeneration` incrementado en login/restore autorizado
- Invalidado en logout/destroy/clear
- `permissionsResolveInFlightGeneration` — single-flight solo misma generation
- Nueva generation aborta in-flight anterior (`AbortController`)
- Respuesta stale descartada si generation/sessionId/machine no coinciden

---

## 17. Eventos

- Sin eventos nuevos
- SessionProvider no emite `PERMISSION_CHANGED`
- Orchestrator sin Event Bus (sin cambio)
- `SESSION_READY` owner: SessionProvider únicamente

---

## 18. Tests

**Archivo:** `tests/unit/session-provider-permissions-hook.test.ts`
**Casos:** **42 tests** (flag OFF, success, restore, failures, concurrencia, eventos, refresh, 401, cross-user, async callers, republish externo, destroy race)

| Run | Resultado |
|-----|-----------|
| Focalizado #1 | **42/42 PASS** |
| Focalizado #2 | **42/42 PASS** |
| `session-provider.test.ts` | **10/10 PASS** |
| `session-permissions.test.ts` | **8/8 PASS** |
| `session*.test.ts` (12 files) | **152/152 PASS** |
| Suite completa | **747/747 PASS** |

Cobertura FIX-001 explícita:

- 401 API failure sin guest silencioso
- Cross-user: user B no hereda VIP de user A
- `handleUserLoginEvent` / `initialize` / `handleSystemReadyEvent` async tracked
- PERMISSION_CHANGED externo: flag OFF republish OK; flag ON resolved OK; pending bloqueado
- `destroySession` durante pending aborta y limpia identity

Mock de `AccessPermissionResolutionPort` — sin red, sin Supabase.

---

## 19. Archivos

### Modificados (wiring + FIX-001 + TYPECHECK ALIGNMENT)

- `MiamiDJBeat-MigracionV2/.env.example`
- `MiamiDJBeat-MigracionV2/shared/config/runtime/types.ts`
- `MiamiDJBeat-MigracionV2/shared/config/runtime/validate.ts`
- `MiamiDJBeat-MigracionV2/shared/session/runtime/index.ts`
- `MiamiDJBeat-MigracionV2/shared/session/runtime/session-lifecycle.ts`
- `MiamiDJBeat-MigracionV2/shared/session/runtime/session-provider.ts`
- `MiamiDJBeat-MigracionV2/shared/session/runtime/session-service.ts`
- `MiamiDJBeat-MigracionV2/shared/session/runtime/types.ts`
- `MiamiDJBeat-MigracionV2/tests/unit/session-phase3-foundation.test.ts`
- `MiamiDJBeat-MigracionV2/tests/unit/session-provider.test.ts`
- `MiamiDJBeat-MigracionV2/tests/unit/session.test.ts`

### Creados

- `MiamiDJBeat-MigracionV2/shared/session/runtime/access-permission-resolution-port.ts`
- `MiamiDJBeat-MigracionV2/tests/unit/session-provider-permissions-hook.test.ts`
- `docs/V2/TICKETS/TICKET-V2-PHASE-8-SESSION-PROVIDER-PERMISSIONS-WIRING-001.md`

---

## 20. Alcance prohibido (respetado)

No modificado: bootstrap, portales, `shared/api`, `shared/permissions`, orchestrator, access-snapshot, errors, package.json, tsconfig, vite/vitest config, `.env` real.

---

## 21. Riesgos restantes

| Riesgo | Mitigación actual |
|--------|-------------------|
| Boot factory no registra port | Wiring inactivo; flag OFF por defecto |
| Callers externos legacy sin `await` (fuera de tests históricos alineados) | `SessionAuthOutcome` en tipos públicos; flag OFF síncrono en runtime |
| PERMISSION_CHANGED externo con flag ON pending | Republish bloqueado hasta `resolved` |
| **Typecheck global rojo (17 errores preexistentes en HEAD)** | Ver §23 — no introducidos por wiring; pendiente decisión PO |

---

## 23. TYPECHECK ALIGNMENT — `TICKET-V2-PHASE-8-SESSION-AUTH-OUTCOME-TYPECHECK-ALIGNMENT-001`

### Contrato canónico

```typescript
export type SessionAuthOutcome = SessionSnapshot | Promise<SessionSnapshot>;
```

Helper público: `awaitSessionAuthOutcome(outcome)` en `session-service.ts` (exportado vía `index.ts`).

### APIs alineadas

| API | Retorno |
|-----|---------|
| `SessionPublicApi.ingestAuthHandle` | `SessionAuthOutcome` |
| `SessionLifecycleApi.hydrateSession` | `SessionAuthOutcome` |
| `session-service.hydrateSession` | `SessionAuthOutcome` |
| `session-service.ingestAuthHandle` | `SessionAuthOutcome` |
| `session-service.deliverAuthHandoff` | `SessionAuthOutcome` |
| `SessionProvider.runHydrationRestore` | `SessionAuthOutcome` |
| `initializeSession` | `SessionPublicApi` (async interno vía `commitSessionAuthOutcome`) |

Sin casts `as SessionSnapshot` en callers productivos autorizados.

### Callers productivos (async observado)

| Caller | Archivo | Línea | Mecanismo |
|--------|---------|-------|-----------|
| `handleUserLoginEvent` | `session-provider.ts` | ~744 | `commitSessionAuthOutcome(ingestAuthHandle(...))` |
| `handleSystemReadyEvent` | `session-provider.ts` | ~733 | `commitSessionAuthOutcome(runHydrationRestore())` |
| `initialize` | `session-provider.ts` | ~1510 | `commitSessionAuthOutcome(runHydrationRestore())` |
| `hydrateSession` (facade) | `session-service.ts` | ~196 | retorna `SessionAuthOutcome` al caller |
| `ingestAuthHandle` (facade) | `session-service.ts` | ~150 | retorna `SessionAuthOutcome` al caller |
| `deliverAuthHandoff` | `session-service.ts` | ~158 | delega a `ingestAuthHandle` |

### Tests históricos actualizados

| Archivo | Cambio |
|---------|--------|
| `session-provider.test.ts` | 2 tests async + `awaitSessionAuthOutcome` |
| `session.test.ts` | 1 test async + `awaitSessionAuthOutcome` |
| `session-phase3-foundation.test.ts` | 4 tests async + `awaitSessionAuthOutcome` |
| `session-permissions.test.ts` | Sin cambio — no accede al retorno de `ingestAuthHandle` |
| `session-provider-permissions-hook.test.ts` | `completeAuth()` local (equivalente a `awaitSessionAuthOutcome`) |

### Typecheck — clasificación inicial (17 errores, exit 2)

| # | Archivo | Línea | Código | Relación SessionAuthOutcome | Origen |
|---|---------|-------|--------|----------------------------|--------|
| 1 | `shared/api/supabase/supabase-adapter.ts` | 111 | TS2345 | Independiente | **Preexistente HEAD** (`git diff HEAD` vacío) |
| 2–3 | `shared/auth/runtime/auth-service.ts` | 472, 480 | TS2339 | Independiente | **Preexistente HEAD** |
| 4 | `shared/errors/runtime/api-normalize.ts` | 3 | TS6196 | Independiente | **Preexistente HEAD** |
| 5 | `shared/services/access-permissions/access-permission-orchestrator-types.ts` | 8 | TS2724 | Independiente (`resolvePermissionSnapshot` import erróneo) | **Preexistente HEAD** — archivo sin diff vs wiring |
| 6–10 | `shared/services/access-snapshot/access-snapshot-service.ts` | 187–236 | TS2345 | Independiente | **Preexistente HEAD** |
| 11 | `tests/integration/access-permission-orchestrator.integration.test.ts` | 69 | TS2322 | Independiente | **Preexistente HEAD** |
| 12–16 | `tests/unit/access-snapshot-service.test.ts` | 88–562 | TS2352/2769/2339/6133/2322 | Independiente | **Preexistente HEAD** |
| 17 | `tests/unit/session-authorization.test.ts` | 16 | TS6133 | Independiente (import no usado) | **Preexistente HEAD** |

**Errores SessionAuthOutcome tras alineación: 0.**

Evidencia baseline: `git diff HEAD -- <cada archivo con error>` → sin cambios en los 17 archivos. El error del orchestrator **no fue introducido** por el wiring de SessionProvider (archivo fuera de alcance autorizado).

### Resultados de validación

| Run | Resultado |
|-----|-----------|
| Hook focalizado #1 | **42/42 PASS** |
| Hook focalizado #2 | **42/42 PASS** |
| `session-provider.test.ts` | **10/10 PASS** |
| `session-permissions.test.ts` | **8/8 PASS** |
| `session.test.ts` | **10/10 PASS** |
| `session-phase3-foundation.test.ts` | **21/21 PASS** |
| Suite completa | **747/747 PASS** (54 files) |
| `npm run typecheck` | **exit 2** — 17 errores preexistentes |

### Estado TYPECHECK ALIGNMENT

**BLOQUEADO POR ERROR PREEXISTENTE — PENDIENTE DECISIÓN PO**

La alineación `SessionAuthOutcome` en archivos autorizados está completa. El typecheck global ya estaba rojo en HEAD antes del wiring.

---

## 22. Próximo ticket (no autorizado)

**Boot factory wiring** — registrar `AccessPermissionOrchestrator` como port en bootstrap cuando PO autorice flag ON + egress. Fuera de alcance de este ticket.

---

## API de registro

```typescript
registerAccessPermissionResolutionPort(port | null)
```

- Sin boot automático
- Sin resolución en registro
- Delega al `SessionProvider` activo
- `null` para tests/reset

---

## Métodos privados (SessionProvider)

| Método | Rol |
|--------|-----|
| `applyMinimumPermissions` | Permisos guest/mínimos |
| `applyResolvedPermissions` | Profile + flags + MOD-003 attach + last valid |
| `applyFailurePolicy` | PO failure sin logout |
| `resolveAndCommitAccessPermissions` | Orquestación async con guards |
| `publishAuthenticatedSessionReady` | Único publisher flag ON success |
| `commitSessionAuthOutcome` | Observa Promise en callers void del Event Bus |
| `invalidateLastValidUnlessSameIdentity` | Previene herencia cross-user |
| `cloneProfileResolveInput` / `clonePermissionSnapshot` | Inmutabilidad last valid |
