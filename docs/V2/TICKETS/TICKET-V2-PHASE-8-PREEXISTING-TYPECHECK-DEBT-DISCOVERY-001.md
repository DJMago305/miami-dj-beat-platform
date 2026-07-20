# TICKET-V2-PHASE-8-PREEXISTING-TYPECHECK-DEBT-DISCOVERY-001

## Estado

**REMEDIACIÓN COMPLETADA — APTO PARA QA FINAL**

| Campo | Valor |
|-------|-------|
| Fase | V2 — Phase 8 |
| Modo | Remediation de deuda TypeScript preexistente |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD (sin mover) | `671e0c0758ff6b3fcb7ed76a3c7336522fcf0acf` |
| Remediation ticket | `TICKET-V2-PHASE-8-PREEXISTING-TYPECHECK-DEBT-REMEDIATION-001` |
| Session wiring | ❌ No modificado |
| Boot / flag ON | ❌ Prohibido y no tocado |
| Commit / push | ❌ No autorizado |

---

## 1. Errores originales (Discovery)

`npm run typecheck` antes de remediation: **exit 2**, **17 errores**.

Ninguno introducido por `feat(v2-session): wire access permissions resolution` — `git diff 671e0c0` sobre los 17 archivos con error estaba vacío en discovery.

| Cluster | Archivo | Errores | Código |
|---------|---------|---------|--------|
| A | `supabase-adapter.ts` | 1 | TS2345 |
| B | `auth-service.ts` | 2 | TS2339 |
| C | `api-normalize.ts` | 1 | TS6196 |
| D | `access-permission-orchestrator-types.ts` | 1 | TS2724 |
| E | `access-snapshot-service.ts` | 5 | TS2345 |
| F | `access-permission-orchestrator.integration.test.ts` | 1 | TS2322 |
| G | `access-snapshot-service.test.ts` | 5 | TS2352/2769/2339/6133/2322 |
| H | `session-authorization.test.ts` | 1 | TS6133 |

---

## 2. Root cause por cluster

### A — Supabase RPC generics

`invokeRpc` pasaba `TParams | undefined` a `apiClient.rpc()` que exige `Record<string, unknown> | undefined`.

### B — Auth mock boot view

Intersección `MockAuthProvider & { unavailable, failRestore }` colisionaba con campos **privados** homónimos en `MockAuthProvider` → tipo `never`.

### C — Unused import

`ApiFailure` importado sin uso en `api-normalize.ts`.

### D — Orchestrator import

`resolvePermissionSnapshot` importado desde `permissions/runtime/types`; la función vive en `permissions/runtime` (reexport desde `permission-resolver.ts`).

### E — Access snapshot mapping

`mappingFailure()` usaba conditional type sobre union `AccessSnapshotMappingResult` → parámetro `code` inferido como `never`.

### F — Log source test

Test usaba `source: 'integration'` fuera de `LogSource` (`boot | core | portal | test`).

### G — Access snapshot tests

Mocks no alineados con `SupabaseAdapter`; narrowing insuficiente en `MdjAccessSnapshotPayload`; helper compile-time `expectTypeOf` mal tipado.

### H — Unused import test

`refreshSession` importado sin uso en `session-authorization.test.ts`.

---

## 3. Estrategia de remediation (REMEDIATION-001)

| Cluster | Estrategia |
|---------|------------|
| A | Bridge explícito `request.params as Record<string, unknown>` solo en el límite adapter → apiClient |
| B | Interfaz `MockAuthProviderBootStateReader` + lectura vía `unknown` (boot-only, sin tocar mock-auth-provider) |
| C | Eliminar import `ApiFailure` |
| D | Import valor `resolvePermissionSnapshot` desde `../../permissions/runtime` |
| E | Tipar `mappingFailure(code: AccessSnapshotMappingCode)` |
| F | `source: 'test'` en integration test (sin ampliar `LogSource`) |
| G | Mock adapter `as unknown as SupabaseAdapter`; narrow `result.data.ok`; assert compile-time inline |
| H | Quitar import `refreshSession` |

---

## 4. Archivos modificados

- `MiamiDJBeat-MigracionV2/shared/api/supabase/supabase-adapter.ts`
- `MiamiDJBeat-MigracionV2/shared/auth/runtime/auth-service.ts`
- `MiamiDJBeat-MigracionV2/shared/errors/runtime/api-normalize.ts`
- `MiamiDJBeat-MigracionV2/shared/services/access-permissions/access-permission-orchestrator-types.ts`
- `MiamiDJBeat-MigracionV2/shared/services/access-snapshot/access-snapshot-service.ts`
- `MiamiDJBeat-MigracionV2/tests/integration/access-permission-orchestrator.integration.test.ts`
- `MiamiDJBeat-MigracionV2/tests/unit/access-snapshot-service.test.ts`
- `MiamiDJBeat-MigracionV2/tests/unit/session-authorization.test.ts`

**No modificados:** SessionProvider, session-service, session-lifecycle, config, tsconfig, package.json, boot, portales, feature flags.

---

## 5. Validaciones

| Run | Resultado |
|-----|-----------|
| `access-snapshot-service.test.ts` | **26/26 PASS** |
| `access-permission-orchestrator.integration.test.ts` | **27/27 PASS** |
| `session-authorization.test.ts` | **14/14 PASS** |
| Suite completa | **747/747 PASS** (54 files) |
| `npm run typecheck` | **exit 0** |

---

## 6. Confirmaciones de alcance

| Verificación | Estado |
|--------------|--------|
| Session wiring (`671e0c0`) intacto | ✅ |
| `MDJ_V2_FEATURE_ACCESS_SNAPSHOT_PERMISSIONS` default false | ✅ |
| Boot factory sin wiring de port | ✅ |
| Solo archivos autorizados en diff | ✅ |
| HEAD sin mover | ✅ |
| Staging vacío | ✅ |

---

## 7. Estado final

**REMEDIACIÓN COMPLETADA — APTO PARA QA FINAL**

Deuda TypeScript preexistente eliminada. Typecheck verde y suite completa verde sin alterar lógica de permisos ni Session wiring.

---

## Resolución final — 2026-07-20

**Ticket cierre:** `TICKET-V2-PHASE-8-9-SEPARATED-COMMITS-2026-07-20-001` · documentación `TICKET-V2-DOCUMENTATION-CLOSE-PHASE-8-9-2026-07-20-001`

> Las secciones 1–7 arriba conservan el registro de discovery y remediation al 2026-07-12 (HEAD `671e0c0`, suite **747/747**, commit pendiente).

### Remediation confirmada y committeada

| Campo | Valor |
|-------|-------|
| **Commit A** | `77e969d01b0ca8575cfbcc6f718e9839de10461e` |
| **Mensaje** | `fix(v2-types): resolve preexisting typecheck debt` |
| **Archivos** | 8 — Grupo A (misma lista §4) |
| **`npm run typecheck`** | exit 0 |
| **`npm test`** | **756/756 PASS** · **55/55 files** |
| **Session wiring `671e0c0`** | Intacto — sin alteración de lógica de permisos |
| **Push / deploy** | ❌ NO |

### Estado del ticket

**CERRADO LOCALMENTE** — deuda TypeScript preexistente resuelta y committeada en Commit A separado.

*Resolución documentada — 2026-07-20 — sin commit en este paso*
