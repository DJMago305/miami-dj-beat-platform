# TICKET-V2-PHASE-6-SESSION-OPAQUE-AUTHORIZATION-IMPLEMENTATION-001

## Estado

**IMPLEMENTADO, PROBADO, APROBADO POR PRODUCT OWNER Y COMMITTEADO LOCALMENTE**

| Campo | Valor |
|-------|-------|
| Rama | `plan/v2-phase-4-api-client` |
| Commit implementación | `3c53bc899a0cbbaf58574883f2a579c0b85f865b` |
| Mensaje commit | `feat(v2-session): add opaque authorization reader` |
| Discovery de referencia | `9160978bb35a9d2e645d41e2aa6388e2cfdc2ab2` — `docs(v2-session): close opaque authorization discovery` |
| QA coverage | `TICKET-V2-PHASE-6-SESSION-OPAQUE-AUTHORIZATION-QA-COVERAGE-001` — 5 tests adicionales matriz 9 estados |
| Suite final | **465/465 PASS** · **45/45 files** |
| Validación visual localhost | ✅ Aprobada PO (`http://localhost:5173` — client / artist / staff) |
| Push / PR / merge / preview / deploy | ❌ NO AUTORIZADO |

---

## Objetivo

Eliminar la dependencia del historial del Event Bus para resolver `Authorization` en MOD-005 API Client bootstrap.

Session pasa a ser la **única fuente canónica** de la credencial opaca activa. El Event Bus deja de actuar como almacén indirecto de tokens para requests HTTP.

---

## Arquitectura anterior

```
Auth → Session → Event Bus history → API Client
```

- `initialize-api.ts` llamaba `getEventBus().getHistory()`.
- Reverse-scan de eventos `USER_LOGIN` vía `parseUserLoginPayload()`.
- Correlación por `userId` con `snapshot.user`.
- Riesgos: historial vacío/contaminado, token obsoleto, acoplamiento MOD-005 → MOD-004.

---

## Arquitectura nueva

```
Auth → Session → getSessionAuthorizationHeader() → API Client
```

- `initialize-api.ts` pasa `() => getSessionAuthorizationHeader()` a `createSessionReaderFromSnapshot()`.
- Slot privado en `SessionStore` (`accessTokenRef`, `boundUserId`, `credentialVersion`).
- `ingestAuthHandle()` captura credencial; `clearSession()` / `destroySession()` la limpian.
- Refresh Session lee slot interno; reemplaza o conserva según política documentada en discovery.

---

## Archivos modificados

Exactamente los **8 archivos** del commit `3c53bc8`:

| Archivo | Cambio |
|---------|--------|
| `MiamiDJBeat-MigracionV2/bootstrap/initialize-api.ts` | Elimina scan Event Bus; usa `getSessionAuthorizationHeader()` |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-store.ts` | Slot privado + `resolveAuthorizationHeader()` |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-provider.ts` | `setCredential` / `clearCredential` en ingest, logout, destroy, refresh |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-service.ts` | Facade pública de autorización |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/types.ts` | `SessionAuthorizationState`, `SessionAuthorizationReaderPort` |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/index.ts` | Re-exports |
| `MiamiDJBeat-MigracionV2/tests/unit/boot-api-wiring.test.ts` | Wiring sin Event Bus; logout; relogin |
| `MiamiDJBeat-MigracionV2/tests/unit/session-authorization.test.ts` | **Nuevo** — 14 tests matriz autorización |

**Estadísticas commit:** 8 files changed, 529 insertions(+), 40 deletions(-)

---

## Contrato implementado

### API mínima obligatoria (producción / MOD-005)

```typescript
getSessionAuthorizationHeader(): string | null
```

- Devuelve header preformado `Bearer <opaque>` o `null`.
- **No** expone `accessTokenRef` en `SessionSnapshot` ni en snapshot público.
- Pull síncrono compatible con `SessionReaderPort` / `api-client.ts`.

### API opcional (lab / diagnóstico)

```typescript
getSessionAuthorizationState(): SessionAuthorizationState
createSessionAuthorizationReader(): SessionAuthorizationReaderPort
```

---

## Matriz de autorización — 9 estados oficiales

Comportamiento de `getSessionAuthorizationHeader()`:

| Estado | Resultado | Test dedicado |
|--------|-----------|---------------|
| `INITIAL` | `null` | ✅ |
| `LOADING` | `null` | ✅ |
| `AUTHENTICATED` | `Bearer …` si slot válido, bind y `expiresAt` futuro | ✅ |
| `ANONYMOUS` | `null` | ✅ |
| `EXPIRED` | `null` aunque `user` y slot existan | ✅ |
| `REFRESHING` | Conserva última credencial válida | ✅ |
| `LOGGING_OUT` | `null` | ✅ |
| `DESTROYED` | `null` (vía `destroySession`) | ✅ |
| `ERROR` | `null` | ✅ |

### Defensas adicionales

| Regla | Implementación | Test |
|-------|----------------|------|
| `expiresAt` vencido antes de transición formal `EXPIRED` | `null` | ✅ |
| `boundUserId` ≠ `currentUser.userId` | `null` (interno) | — |
| Logout / clear | `clearCredential()` | ✅ |
| Destroy | `clearCredential()` explícito | ✅ |
| Refresh sin nuevo `accessTokenRef` | Conserva slot; sin bump `credentialVersion` | ✅ |
| Refresh con nuevo `accessTokenRef` | Reemplaza slot; bump `credentialVersion` | ✅ |
| Relogin otro usuario | Reemplazo atómico credencial | ✅ |

---

## Ciclo de vida credencial

| Evento | Acción en slot |
|--------|----------------|
| `ingestAuthHandle()` | `setCredential(accessTokenRef, userId)` |
| `clearSession()` / logout | `clearCredential()` |
| `destroySession()` | `clearCredential()` |
| `refreshSession()` éxito sin token | Conserva slot |
| `refreshSession()` éxito con token | `updateCredentialAccessToken()` |
| `expireSession()` | Máquina `EXPIRED` → reader `null` (slot puede permanecer hasta clear) |

---

## Tests

| Suite | Resultado |
|-------|-----------|
| Global `npm test` | **465/465 PASS** · exit 0 |
| `session-authorization.test.ts` | **14 tests** |
| `boot-api-wiring.test.ts` | 22 tests (incl. sin Event Bus, logout, relogin) |

### Escenarios boot críticos

- Guest boot: sin `Authorization` aunque bus vacío.
- Signed-in boot: `Authorization: Bearer mock-mock-user-client-1-access` desde Session.
- Post-logout: request sin `Authorization` aunque `USER_LOGIN` permanezca en historial.
- Relogin otro usuario: header actualizado sin reutilizar credencial anterior.

---

## Alcance explícitamente NO modificado

- `shared/auth/**`
- `shared/api/runtime/api-client.ts`
- `shared/events/**`
- `shared/runtime/**`
- `boot.ts`
- UI / Supabase / producción V1
- Push / PR / merge / preview / deploy

---

## Referencias

| Documento | Rol |
|-----------|-----|
| `TICKET-V2-PHASE-6-SESSION-OPAQUE-AUTHORIZATION-DISCOVERY-001.md` | Diseño aprobado (Opción B) |
| `2026-07-11-SESSION-OPAQUE-AUTHORIZATION-IMPLEMENTATION.md` | Acta de cierre técnico |
| `2026-07-10-MOD-005-BOOTSTRAP-WIRING.md` | Wiring MOD-005 previo (deuda cerrada) |

---

## Próximo paso

Documentación de cierre completada. Push, PR, merge y deploy continúan **no autorizados** hasta orden explícita PO.

---

*Implementación · TICKET-V2-PHASE-6-SESSION-OPAQUE-AUTHORIZATION-IMPLEMENTATION-001 · 2026-07-11*
*Commit · `3c53bc899a0cbbaf58574883f2a579c0b85f865b` · `feat(v2-session): add opaque authorization reader`*
