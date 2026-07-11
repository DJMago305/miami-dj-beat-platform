# TICKET-V2-PHASE-6-MOD-005-RUNTIME-REGISTRY-001

## Estado

**IMPLEMENTADO, PROBADO, APROBADO POR PRODUCT OWNER Y COMMITTEADO LOCALMENTE**

| Campo | Valor |
|-------|-------|
| Rama | `plan/v2-phase-4-api-client` |
| Commit implementación | `35c35ff4b7071194c097587ac7479d33a9c8d61b` |
| Mensaje commit | `feat(v2-runtime): register MOD-005 in runtime registry` |
| Discovery de referencia | `0cfc5ba` — `docs(v2): close session auth implementation and registry discovery` |
| Diseño | Opción A — registry mínimo estático |
| Suite final | **471/471 PASS** · **45/45 files** |
| Validación visual localhost | ✅ Aprobada PO (`http://localhost:5173` — client / artist / staff) |
| Push / PR / merge / preview / deploy | ❌ NO AUTORIZADO |

---

## Objetivo

Registrar MOD-005 API Client dentro del Runtime Registry como **snapshot mínimo y estático** observable en boot-time.

---

## Problema anterior

MOD-005 estaba inicializado en bootstrap (`initializeApiForBoot` → `API_READY`) pero **no aparecía** en Runtime Registry.

Registry canónico (7 entradas):

```
MOD-006 → MOD-004 → MOD-010 → MOD-014 → MOD-001 → MOD-002 → MOD-RUNTIME
```

Hueco de observabilidad: imposible confirmar vía `getRuntime().getRegistry()` que el egress HTTP del Shared Core alcanzó readiness antes de `initializeRuntime()`.

---

## Arquitectura implementada

Opción A aprobada en discovery — mirror MOD-001 (`2405b20`).

```typescript
registerRuntimeModule('MOD-005', 'API Client', getApiClientState());
```

En `registerCoreModules()` dentro de `initializeRuntime()`, **después** de que `bootScaffold()` haya ejecutado `initializeApiForBoot()` con éxito.

### Orden registry posterior

```
MOD-006 → MOD-004 → MOD-010 → MOD-014 → MOD-001 → MOD-002 → MOD-005 → MOD-RUNTIME
```

`registrySize`: **8** (+1 entrada)

### Política

| Regla | Implementación |
|-------|----------------|
| Snapshot estático boot-time | ✅ `getApiClientState()` en instante `initializeRuntime()` |
| Sin sync post-login/logout/refresh | ✅ Política stale aceptada (igual MOD-001) |
| Sin credenciales | ✅ Solo 4 campos del schema |
| Sin Session / Auth / Event Bus | ✅ No consulta `getSessionAuthorizationHeader()` ni historial |

---

## Archivos modificados

Exactamente los **4 archivos** del commit `35c35ff`:

| Archivo | Cambio |
|---------|--------|
| `MiamiDJBeat-MigracionV2/shared/runtime/types.ts` | `'MOD-005'` en `RuntimeModuleId` |
| `MiamiDJBeat-MigracionV2/shared/runtime/runtime-service.ts` | Registro MOD-005 + import `getApiClientState` |
| `MiamiDJBeat-MigracionV2/tests/unit/runtime-registry-auth.test.ts` | Orden canónico 8 · 6 tests MOD-005 |
| `MiamiDJBeat-MigracionV2/tests/unit/runtime.test.ts` | Helper con `initializeApiForBoot` · expectativas MOD-005 |

**Estadísticas:** 4 files changed, 110 insertions(+), 3 deletions(-)

---

## Contrato implementado

### Snapshot MOD-005

| Campo | Valor |
|-------|-------|
| `moduleId` | `MOD-005` |
| `label` | `API Client` |
| `lifecycleState` | `API_READY` (guest y signed-in en boot exitoso) |
| `registeredAt` | `number` — timestamp boot |

### Datos prohibidos (no registrados)

- Authorization / Bearer
- `accessTokenRef` / `refreshTokenRef`
- `userId`
- `credentialVersion`
- `expiresAt`
- SessionSnapshot
- Event Bus history
- Headers HTTP / bodies / errores de red / secretos

---

## Comportamiento por ciclo de vida

| Evento | Registry MOD-005 |
|--------|------------------|
| Login post-boot | **Sin cambio** (stale) |
| Logout post-boot | **Sin cambio** |
| Refresh | **Sin cambio** |
| Destroy | **Sin cambio** |
| Restart / re-boot | Snapshot recreado en nuevo `initializeRuntime()` |

---

## Tests

| Suite | Resultado |
|-------|-----------|
| Global `npm test` | **471/471 PASS** · exit 0 |
| `runtime-registry-auth.test.ts` | +6 tests MOD-005 |
| `runtime.test.ts` | Expectativas actualizadas (MOD-005, size ≥ 8) |

### Escenarios cubiertos

1. MOD-005 presente en registry
2. `moduleId`, `label`, `lifecycleState` correctos
3. Guest y signed-in → mismo `API_READY`
4. Sin Authorization ni credenciales en JSON serializado
5. `registrySize === 8`
6. Orden MOD-005 entre MOD-002 y MOD-RUNTIME
7. Post-boot `signIn` → lifecycleState sin cambio

---

## Alcance explícitamente NO modificado

- `shared/session/**`
- `shared/auth/**`
- `shared/api/runtime/api-client.ts`
- `shared/events/**`
- `initialize-api.ts` / `boot.ts` (sin cambio runtime)
- UI · Supabase · producción V1
- Push / PR / merge / deploy

---

## Deuda pendiente (fuera de este ticket)

| Ítem | Estado |
|------|--------|
| `USER_LOGOUT` → `cancelAll()` | ⏳ PENDIENTE |
| `normalizeApiError()` | ⏳ PENDIENTE |
| `FetchTransport` / Supabase | ⏳ PENDIENTE |
| Registry dinámico post-boot | ❌ Fuera de alcance (política rechazada) |

---

## Referencias

| Documento | Rol |
|-----------|-----|
| `TICKET-V2-PHASE-6-MOD-005-RUNTIME-REGISTRY-DISCOVERY-001.md` | Diseño Opción A |
| `2026-07-11-MOD-005-RUNTIME-REGISTRY-IMPLEMENTATION.md` | Acta de cierre |
| `2026-07-11-SESSION-OPAQUE-AUTHORIZATION-IMPLEMENTATION.md` | Contexto post-opaque-auth |

---

## Próximo paso

Documentación de cierre completada. Push, PR, merge y deploy continúan **no autorizados** hasta orden explícita PO.

---

*Implementación · TICKET-V2-PHASE-6-MOD-005-RUNTIME-REGISTRY-001 · 2026-07-11*
*Commit · `35c35ff4b7071194c097587ac7479d33a9c8d61b` · `feat(v2-runtime): register MOD-005 in runtime registry`*
