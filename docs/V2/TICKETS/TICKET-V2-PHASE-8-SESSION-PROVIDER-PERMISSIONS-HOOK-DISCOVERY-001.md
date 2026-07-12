# TICKET-V2-PHASE-8-SESSION-PROVIDER-PERMISSIONS-HOOK-DISCOVERY-001

## Estado

**DISCOVERY COMPLETADO — PENDIENTE AUTORIZACIÓN PO**

| Campo | Valor |
|-------|-------|
| Fase | V2 — Phase 8 |
| Modo | Auditoría técnica + diseño documental (sin wiring activo) |
| Fecha | 2026-07-12 |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD | `23136007e0ea65fd0f4381b17a379b2f61b77362` — `test(v2-permissions): integrate access permission orchestrator` |
| Suite baseline | **705/705 PASS** · **53/53 files** |
| Working tree | Limpio (salvo este doc untracked) |
| Implementación / wiring / boot / portales | ❌ No autorizado en este ticket |
| Egress real | ❌ Prohibido |
| Commit / push / PR / deploy | ❌ No autorizado |

### Decisiones PO heredadas (discovery previo — vigentes)

| Tema | Decisión |
|------|----------|
| Orchestrator standalone | ✅ Implementado + integrado (MemoryTransport) |
| `PERMISSIONS_PENDING` | Estado **interno privado**; no nuevo `SessionLifecycleState` público |
| Orchestrator v1 eventos | ❌ No publica `SESSION_READY` ni `PERMISSION_CHANGED` |
| Admin mapping | `admin` → `staff.manager` → `staff_manager` |
| Concurrencia orchestrator | `resolutionEpoch` + latest-wins + `AbortSignal` + single-flight por instancia |
| `defaultAuthenticatedProfile` | Intacto hasta wiring con feature flag ON |
| `sftOk` | Fuera de alcance v1 |

---

## 1. Objetivo

Diseñar formalmente el **hook de permisos en MOD-002 SessionProvider** que conecte el resultado del **Access Permission Orchestrator** (ya validado en integración) con el ciclo de vida de sesión, **sin implementar wiring activo** en este ticket.

Entregable de diseño:

```
AccessPermissionOrchestrator.resolve()
  → SessionProvider.applyResolvedPermissions()   [nuevo — privado]
  → SessionProvider.republishReadySnapshot()       [existente — privado L434–448]
  → SESSION_READY (emitido por SessionProvider, no por orchestrator)
```

Restricciones:

- Sin modificar runtime productivo en discovery.
- Sin SessionProvider wiring, bootstrap factory, feature flag activo, portales ni egress.
- Sin alterar MOD-003 core ni Error Bridge core.
- Sin nuevos eventos de bus.

---

## 2. Baseline

### 2.1 Verificación Git

| Verificación | Resultado |
|--------------|-----------|
| Rama | `plan/v2-phase-4-api-client` ✅ |
| HEAD | `23136007e0ea65fd0f4381b17a379b2f61b77362` ✅ |
| Commits Phase 8 completados | `408b9de` discovery · `b2b9c72` orchestrator · `2313600` integration ✅ |
| Suite | **705/705 PASS** · **53/53 files** ✅ |
| Working tree pre-doc | Limpio ✅ |

### 2.2 Documentos y código leídos

| Artefacto | Propósito |
|-----------|-----------|
| `TICKET-V2-PHASE-8-ACCESS-SNAPSHOT-PERMISSIONS-WIRING-DISCOVERY-001.md` | Arquitectura Option C, flujos, PO decisions |
| `TICKET-V2-PHASE-8-ACCESS-PERMISSION-ORCHESTRATOR-INTEGRATION-001.md` | Cadena integrada 27 tests, eventos |
| `shared/session/runtime/session-provider.ts` | Punto de inserción hook |
| `shared/session/runtime/session-service.ts` | Singleton facade |
| `shared/services/access-permissions/` | Orchestrator + tipos |
| `bootstrap/initialize-api.ts` | Logout cancel + SessionReader live |
| `bootstrap/boot.ts` | Orden CONFIG → … → SESSION → API |
| `tests/integration/access-permission-orchestrator.integration.test.ts` | Evidencia cadena |
| `tests/unit/session-permissions.test.ts` | Wire MOD-003 actual |

---

## 3. Estado actual (post-integración)

### 3.1 Cadena de permisos hoy

| Capa | Comportamiento actual |
|------|----------------------|
| Auth handoff (`ingestAuthHandle` L688–690) | Si `permissionProfile.kind === 'guest'` → `defaultAuthenticatedProfile(portal)` |
| Restore (`applyRestoredRecord` L607) | Asigna `defaultAuthenticatedProfile(portal)` antes de `SESSION_READY` |
| `attachPermissions` (L220–240) | Invoca `resolvePermissionSnapshot` con `permissionProfile` + `permissionFlags` almacenados |
| `publishSessionSnapshot('SESSION_READY')` | Enriquece snapshot con roles/capabilities MOD-003 |
| RPC `mdj_access_snapshot` | **No** invocado desde SessionProvider |
| Orchestrator | Existe, probado en unit + integration; **no** registrado en boot ni SessionProvider |

### 3.2 Métodos SessionProvider relevantes (existentes)

| Método | Visibilidad | Rol en wiring futuro |
|--------|-------------|----------------------|
| `defaultAuthenticatedProfile` | privado L207–217 | Reemplazado cuando flag ON |
| `attachPermissions` | privado L220–240 | **Se conserva** — única vía MOD-003 en snapshot |
| `publishSessionSnapshot` | privado L275–289 | Conservado |
| `republishReadySnapshot` | privado L434–448 | **Reutilizar** tras apply |
| `handlePermissionChangedEvent` | público vía listeners L413–432 | Escucha `PERMISSION_CHANGED` **externo**; no es el hook RPC |
| `setPermissionProfileForTests` | test hook L195–197 | Conservar para tests flag OFF |

### 3.3 Orchestrator — contrato validado

```typescript
// Éxito
{ ok: true, stage: 'complete', profile, flags, permissions, resolutionEpoch }

// Fallo
{ ok: false, stage: 'snapshot'|'mapping'|'permissions'|'cancelled'|'stale', retryable, normalizedError?, cancelled?, stale? }
```

- No emite eventos (probado: `SESSION_READY` y `PERMISSION_CHANGED` en cero en integration).
- MOD-014 publica `SYSTEM_ERROR` cuando severity ≥ ERROR vía bridge invocado por orchestrator.

### 3.4 Orden boot (restricción estructural)

```
CONFIG → BUS → LOG → ERROR → AUTH(register) → SESSION → AUTH(activate) → API_CLIENT → RUNTIME
```

El hook **no puede** invocar orchestrator durante `initializeSession()` — API aún no existe. La resolución RPC ocurre **post `API_READY`**, en triggers de sesión autenticada (login, restore con userId, futuro refresh).

---

## 4. Hallazgos clave

### H-01 — `applyResolvedPermissions` debe ser privado y mínimo

El hook **solo** muta `permissionProfile` y `permissionFlags` e invalida `enrichedSnapshot`. No debe:

- Invocar RPC directamente.
- Llamar `resolvePermissionSnapshot` (eso queda en `attachPermissions`).
- Publicar eventos (lo hace `republishReadySnapshot` / `publishSessionSnapshot`).

### H-02 — Doble resolución MOD-003 es intencional y aceptable

Tras apply, `republishReadySnapshot` → `attachPermissions` vuelve a ejecutar `resolvePermissionSnapshot`. El resultado debe ser **idéntico** al `permissions` del orchestrator si `profile`, `flags`, `portal`, `userId` y `snapshotVersion` coinciden. Ventaja: una sola vía de enriquecimiento de snapshot en SessionProvider.

### H-03 — `PERMISSION_CHANGED` no es emisor del hook RPC

| Fuente | Emite `PERMISSION_CHANGED` |
|--------|---------------------------|
| Orchestrator v1 | ❌ |
| Hook `applyResolvedPermissions` | ❌ (diseño) |
| MOD-003 (catálogo) | Autorizado — consumo externo futuro |
| `handlePermissionChangedEvent` | **Receptor** — republish `SESSION_READY` |

El wiring RPC republica **`SESSION_READY`** con `reason` trazable (`access-snapshot-resolved`, `access-snapshot-retry`, etc.). No crear evento nuevo.

### H-04 — `PERMISSIONS_PENDING` evita capacidades provisionales con flag ON

Con flag ON, **no** asignar `defaultAuthenticatedProfile` antes de RPC OK. Estado interno privado:

```typescript
type PermissionsResolutionPhase = 'idle' | 'pending' | 'resolved' | 'failed';
```

- `pending`: RPC en vuelo; no publicar `SESSION_READY` con perfil elevado provisional.
- `resolved`: apply + republish permitido.
- `failed` + `retryable`: sesión autenticada conservada; política UI → Q-02.

No exponer en `SessionLifecycleState` público.

### H-05 — Logout ya cancela API in-flight

`initialize-api.ts` suscribe `USER_LOGOUT` y `SESSION_DESTROYED` → `cancelAll()`. El hook debe propagar `AbortSignal` al orchestrator y tratar `cancelled`/`stale` sin apply ni `SYSTEM_ERROR` operativo adicional.

### H-06 — SessionProvider ya tiene single-flight en refresh

`refreshInFlight` (L146, L782–791). El hook de permisos debe tener **single-flight propio** (`permissionsResolveInFlight`) separado del refresh, delegando concurrencia de RPC al orchestrator (epoch/latest-wins).

### H-07 — Tests actuales dependen de `defaultAuthenticatedProfile`

`session-permissions.test.ts` y `session-provider.test.ts` asumen perfil provisional tras login. Wiring ticket requerirá tests con flag ON/OFF y fixtures explícitos.

---

## 5. Arquitecturas comparadas (ubicación del hook)

### A — `applyResolvedPermissions` público en `SessionPublicApi`

| Criterio | Evaluación |
|----------|------------|
| Encapsulación | ❌ Expone mutación interna a portales |
| Orden de llamadas | ❌ Portal podría apply sin orchestrator |
| Testabilidad | ⚠️ |

**Veredicto:** Rechazada.

### B — Método privado + coordinador interno `resolveAndCommitAccessPermissions`

| Criterio | Evaluación |
|----------|------------|
| Encapsulación | ✅ |
| Orchestrator inyectado vía port | ✅ |
| Eventos | ✅ Solo vía métodos existentes |
| Flag OFF | ✅ Bypass total — comportamiento actual |

**Veredicto:** **Recomendada.**

### C — Boot script aplica permisos fuera de SessionProvider

| Criterio | Evaluación |
|----------|------------|
| Cohesión lifecycle | ❌ Boot no conoce SIGNED_IN / SESSION_READY |
| Re-login / restore | ❌ |
| PERMISSIONS_PENDING | ❌ |

**Veredicto:** Rechazada.

### D — SessionProvider llama `AccessSnapshotService` directamente

| Criterio | Evaluación |
|----------|------------|
| Separación | ❌ Duplica orchestrator |
| Error bridge | ❌ Doble normalización |

**Veredicto:** Rechazada (alineado con discovery previo H-01).

---

## 6. Arquitectura recomendada

**Opción B** — coordinador interno en SessionProvider con port inyectado.

```
┌─────────────────────────────────────────────────────────────┐
│ SessionProvider (MOD-002)                                   │
│                                                             │
│  ingestAuthHandle / applyRestoredRecord / [futuro refresh]  │
│       │ flag ON + authenticated                             │
│       ▼                                                     │
│  resolveAndCommitAccessPermissions()  [nuevo — privado]       │
│       │                                                     │
│       ├── AccessPermissionResolutionPort.resolve()          │
│       │        └── Orchestrator (factory boot — ticket 5)   │
│       │                                                     │
│       ├── ok → applyResolvedPermissions(profile, flags)     │
│       │        └── republishReadySnapshot(reason)           │
│       │             └── SESSION_READY                       │
│       │                                                     │
│       └── fail → política Q-02/Q-06 (sin guest, sin apply)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Contratos propuestos (documentación únicamente)

### 7.1 Port de resolución (inyectado post API_READY)

```typescript
import type {
  AccessPermissionOrchestrator,
  AccessPermissionResolutionOptions,
  AccessPermissionResolutionResult,
} from '@mdj/shared/services/access-permissions';

/** Port mínimo — SessionProvider no conoce AccessSnapshotService ni ApiClient */
export type AccessPermissionResolutionPort = Pick<
  AccessPermissionOrchestrator,
  'resolve'
>;

export type RegisterAccessPermissionResolutionPort = (
  port: AccessPermissionResolutionPort | null,
) => void;
```

Registro futuro en `session-service.ts` (singleton):

```typescript
export function registerAccessPermissionResolutionPort(
  port: AccessPermissionResolutionPort | null,
): void;
```

### 7.2 Hook interno SessionProvider

```typescript
/** Solo muta estado de permisos — sin eventos, sin MOD-003 directo */
private applyResolvedPermissions(
  profile: ProfileResolveInput,
  flags: SnapshotFlags,
): void {
  this.permissionProfile = profile; // congelar según convención existente
  this.permissionFlags = Object.freeze({ ...flags });
  this.enrichedSnapshot = null;
}

/** Orquesta RPC + apply + republish — flag ON únicamente */
private async resolveAndCommitAccessPermissions(
  trigger: 'auth-handoff' | 'restore' | 'refresh' | 'permission-changed-external',
  signal?: AbortSignal,
): Promise<SessionSnapshot | null> {
  // 1. Verificar AUTHENTICATED + credential
  // 2. permissionsPhase = 'pending'
  // 3. port.resolve({ portal, userId, sessionId, snapshotVersion, signal })
  // 4. ok → applyResolvedPermissions → republishReadySnapshot
  // 5. fail → permissionsPhase = 'failed'; política conservación
  // 6. cancelled/stale → noop apply
}
```

### 7.3 Feature flag (config futura)

| Propuesta | Valor |
|-----------|-------|
| Env | `MDJ_V2_FEATURE_ACCESS_SNAPSHOT_PERMISSIONS` |
| Config path | `config.features.accessSnapshotPermissions` |
| Default wiring ticket | **`false`** (flag OFF — comportamiento actual) |
| Default egress QA posterior | Solo tras evidencia PO |

### 7.4 Estado interno `PERMISSIONS_PENDING`

| Campo privado | Tipo |
|---------------|------|
| `permissionsResolutionPhase` | `'idle' \| 'pending' \| 'resolved' \| 'failed'` |
| `permissionsResolveInFlight` | `Promise<...> \| null` |
| `lastResolvedEpoch` | `number` (opcional — descartar stale apply) |

**No** añadir a `SessionLifecycleState` ni `SessionStateMachineState`.

---

## 8. Flujo de éxito (flag ON)

### 8.1 `ingestAuthHandle`

```
1. Validar handle → setUser → setCredential → SIGNED_IN (sin SESSION_READY final aún)
2. [flag ON] NO asignar defaultAuthenticatedProfile
3. resolveAndCommitAccessPermissions('auth-handoff')
4. orchestrator.resolve() → ok:true
5. applyResolvedPermissions(profile, flags)
6. republishReadySnapshot('access-snapshot-resolved')
7. SESSION_READY con capabilities RPC-derived
```

### 8.2 `applyRestoredRecord` (userId presente)

Misma secuencia; trigger `'restore'`. Sustituye L607 `defaultAuthenticatedProfile` cuando flag ON.

### 8.3 Flag OFF (default hasta wiring validado)

Comportamiento **idéntico al actual** — `defaultAuthenticatedProfile` + `SESSION_READY` inmediato.

### 8.4 Refresh (diferido — Q-04)

Con flag ON, `finalizeRefreshSuccess` **podría** re-disparar `resolveAndCommitAccessPermissions('refresh')`. **No decidir en este discovery** — ticket wiring v1 puede omitir refresh re-fetch.

---

## 9. Flujos de fallo (SessionProvider + orchestrator)

| # | Escenario | Apply | SESSION_READY | Sesión auth | Notas |
|---|-----------|-------|---------------|-------------|-------|
| 1 | Flag OFF | N/A | Actual + provisional | ✅ | Sin cambio |
| 2 | Flag ON + RPC ok | ✅ | Republicado con RPC caps | ✅ | Flujo canónico |
| 3 | 401 / expired | ❌ | No elevar; Session Mgr | ✅→expired | Delegar `handleSessionExpiry` |
| 4 | 403 | ❌ | Conservar último válido → Q-02 | ✅ | No sign-out auto → Q-06 |
| 5 | 500 / timeout | ❌ | Conservar → Q-02 | ✅ | No destruir sesión |
| 6 | mapping fail | ❌ | Sin guest autenticado | ✅ | `SYSTEM_ERROR` vía bridge |
| 7 | PermissionError | ❌ | Sin apply | ✅ | stage `permissions` |
| 8 | cancelled / logout | ❌ | Guest tras teardown | logout | API cancelAll + abort |
| 9 | stale (epoch) | ❌ | Ignorar resultado | ✅ | Latest-wins orchestrator |

**Reglas obligatorias:**

- ❌ No convertir fallo RPC en `permissionProfile.kind === 'guest'` con sesión autenticada.
- ❌ No usar `defaultAuthenticatedProfile` cuando flag ON.
- ❌ No doble normalización en SessionProvider (orchestrator ya normalizó).
- ✅ SessionProvider interpreta `retryable` para reintento UI/backoff (futuro).

---

## 10. Eventos y logging

| Evento | Quién emite tras hook RPC |
|--------|---------------------------|
| `SESSION_READY` | SessionProvider vía `republishReadySnapshot` / `publishSessionSnapshot` |
| `PERMISSION_CHANGED` | ❌ Hook no emite; receptor existente para eventos MOD-003 externos |
| `SESSION_EXPIRED` | SessionProvider en 401/expiry path |
| `SYSTEM_ERROR` | MOD-014 (ya invocado por orchestrator en fallos severos) |
| `SESSION_DESTROYED` | Logout existente |

Logs SessionProvider: incluir `trigger`, `resolutionEpoch`, `permissionsResolutionPhase`; **sin** JWT, Authorization, apikey ni payload RPC crudo (alineado con integration tests).

---

## 11. Concurrencia (capa SessionProvider)

| Regla | Implementación propuesta |
|-------|--------------------------|
| Single-flight hook | `permissionsResolveInFlight` — segunda llamada await la misma Promise |
| Orchestrator epoch | Delegar en instancia factory; no duplicar epoch en SessionProvider |
| Logout durante RPC | `AbortSignal` + `cancelAll` → resultado `cancelled` → sin apply |
| `handlePermissionChangedEvent` concurrente | Comparar `userId`; bump `snapshotVersion`; puede disparar nuevo resolve |
| Stale apply | Si `result.resolutionEpoch < lastResolvedEpoch` → noop |

Escenarios profundos **fuera de alcance** (riesgo R-04 documentado en integration): transport ignora abort en vuelo; abort externo durante segunda resolución concurrente.

---

## 12. Test plan (diseño — no implementar en discovery)

### A. Unit — SessionProvider hook (futuro `session-provider-permissions-hook.test.ts`)

| Caso | Flag | Esperado |
|------|------|----------|
| Login exitoso | ON | apply + SESSION_READY sin `defaultAuthenticatedProfile` |
| Login RPC fail retryable | ON | sin apply; sesión auth; phase `failed` |
| Login mapping fail | ON | sin guest; sin elevación |
| Restore autenticado | ON | mismo que login |
| Flag OFF login | OFF | `defaultAuthenticatedProfile` intacto |
| Logout durante RPC | ON | cancelled; guest final |
| PERMISSION_CHANGED externo | ON | `handlePermissionChangedEvent` no roto |
| Doble MOD-003 | ON | attachPermissions coherente con orchestrator `permissions` |

### B. Integration — SessionProvider + Orchestrator + MemoryTransport

- Cadena login simulado → RPC enqueue → SESSION_READY con `client.vip.benefits` cuando payload VIP.
- Sin egress.

### C. Regresión

- `session-permissions.test.ts` — flag OFF baseline.
- Suite completa 705+ con flag OFF default.

---

## 13. Mapa de archivos futuro

### Modificaciones (ticket wiring `SESSION-PROVIDER-PERMISSIONS-WIRING-001`)

| Archivo | Cambio |
|---------|--------|
| `session-provider.ts` | `applyResolvedPermissions`, `resolveAndCommitAccessPermissions`, estado interno, triggers flag ON |
| `session-service.ts` | `registerAccessPermissionResolutionPort`, export si necesario |
| `session/runtime/index.ts` | Re-export registro |
| `shared/config/runtime/types.ts` + `validate.ts` | Feature flag (default false) |
| `tests/unit/session-provider-permissions-hook.test.ts` | Nuevo |
| `tests/unit/session-permissions.test.ts` | Ajustes flag OFF regression |

### Tickets separados (no en wiring mínimo)

| Archivo | Ticket |
|---------|--------|
| `bootstrap/initialize-access-permissions.ts` | `BOOT-ACCESS-PERMISSIONS-FACTORY-001` |
| `bootstrap/boot.ts` | Registro post API_READY |
| Portales | `PORTAL-PERMISSIONS-VALIDATION-001` |

### Prohibido

| Archivo | Razón |
|---------|-------|
| `access-permission-orchestrator.ts` | Ya completado |
| `permission-resolver.ts` | MOD-003 core |
| `api-normalize.ts` / `domain-normalize.ts` | MOD-014 core |

---

## 14. Riesgos

| ID | Riesgo | Mitigación |
|----|--------|------------|
| R-01 | `SESSION_READY` doble con distintos permisos | Single-flight hook + epoch |
| R-02 | UI bloqueada en `PERMISSIONS_PENDING` prolongado | Timeout UI + retry policy Q-02 |
| R-03 | Regresión 705 tests con flag OFF | Default false; tests explícitos ON |
| R-04 | Concurrencia profunda no cubierta en integration | Ticket futuro; no bloqueante wiring v1 |
| R-05 | Refresh sin re-fetch deja permisos stale | Q-04 diferido |
| R-06 | 403 en staff mal interpretado | Q-06 — no auto sign-out |

---

## 15. Criterios de aceptación (implementación wiring futura)

1. Flag OFF → comportamiento byte-identical a pre-wiring en login/restore.
2. Flag ON + RPC ok → sin `defaultAuthenticatedProfile`; capabilities desde RPC.
3. Flag ON + mapping fail → sin guest autenticado ni elevación.
4. 500/timeout → sesión autenticada preservada; sin apply (política Q-02 documentada).
5. Logout durante RPC → cancelled; sin apply; guest tras teardown.
6. `SESSION_READY` emitido por SessionProvider; orchestrator sin eventos.
7. Hook no emite `PERMISSION_CHANGED`.
8. Tests unit hook + regresión suite verde con flag OFF default.

---

## 16. Alcance permitido (próximo ticket wiring)

- Implementar métodos privados hook en SessionProvider.
- Registrar port (sin boot factory completo si port mock en tests).
- Feature flag default OFF.
- Tests unit MemoryTransport / mock port.

---

## 17. Alcance prohibido

- Boot factory producción activa (ticket separado).
- Egress real / fetch transport ON por defecto.
- SessionProvider en portales.
- Nuevos eventos bus.
- MOD-003 / MOD-014 core changes.
- Eliminar `defaultAuthenticatedProfile` sin flag ON.
- Implementar refresh re-fetch (Q-04) sin decisión PO.

---

## 18. Preguntas abiertas (PO)

| ID | Pregunta | Estado |
|----|----------|--------|
| Q-02 | ¿Tras 500/timeout, conservar último snapshot RPC válido o bloquear UI? | **Abierta** |
| Q-04 | ¿Re-fetch en cada token refresh? | **Abierta** — diferida wiring v1 |
| Q-05 | ¿Nombre flag `MDJ_V2_FEATURE_ACCESS_SNAPSHOT_PERMISSIONS`? | **Propuesta** — confirmar PO |
| Q-06 | ¿403 en snapshot fuerza sign-out en portal staff? | **Abierta** |
| Q-07 | ¿Publicar `SIGNED_IN` intermedio mientras `PERMISSIONS_PENDING` o retener hasta RPC OK? | **Nueva** — recomendación: `SIGNED_IN` sin capabilities elevadas, `SESSION_READY` solo tras apply |

---

## 19. Secuencia de tickets

| # | Ticket | Estado |
|---|--------|--------|
| 1 | `ACCESS-PERMISSION-ORCHESTRATOR-001` | ✅ Completado |
| 2 | `ACCESS-PERMISSION-ORCHESTRATOR-INTEGRATION-001` | ✅ Completado |
| 3 | `SESSION-PROVIDER-PERMISSIONS-HOOK-DISCOVERY-001` | ✅ Este documento |
| 4 | `SESSION-PROVIDER-PERMISSIONS-WIRING-001` | Siguiente implementación |
| 5 | `BOOT-ACCESS-PERMISSIONS-FACTORY-001` | Factory post API_READY |
| 6 | `ACCESS-SNAPSHOT-EGRESS-QA-001` | Lab egress |
| 7 | `PORTAL-PERMISSIONS-VALIDATION-001` | Playwright / manual PO |

---

## 20. Próximo ticket recomendado

**`TICKET-V2-PHASE-8-SESSION-PROVIDER-PERMISSIONS-WIRING-001`**

| Incluido | Excluido |
|----------|----------|
| `applyResolvedPermissions` (privado) | Boot producción activo |
| `resolveAndCommitAccessPermissions` (privado) | Egress real |
| `registerAccessPermissionResolutionPort` | Portales |
| Feature flag default OFF | Refresh re-fetch (Q-04) |
| Triggers: `ingestAuthHandle`, `applyRestoredRecord` | Eliminar `defaultAuthenticatedProfile` globalmente |
| Tests unit mock port + flag ON/OFF | MOD-003 / MOD-014 core |

---

## Validación discovery

| Comando | Resultado esperado |
|---------|-------------------|
| `git diff --check` | Sin conflictos |
| `git status --short` | `?? docs/V2/TICKETS/TICKET-V2-PHASE-8-SESSION-PROVIDER-PERMISSIONS-HOOK-DISCOVERY-001.md` |
| `git rev-parse HEAD` | `23136007e0ea65fd0f4381b17a379b2f61b77362` |
| Suite | 705/705 PASS (sin cambios runtime) |

**Estado final:** **APTO PARA COMMIT DEL DISCOVERY** — PENDIENTE AUTORIZACIÓN EXPLÍCITA DEL PRODUCT OWNER
