# Cierre Fase 5 — MOD-001 Auth Bootstrap Wiring

**Proyecto:** MiamiDJBeat-MigracionV2
**Tickets:** TICKET-V2-PHASE-5-MOD-001-AUTH-BOOTSTRAP-WIRING-001 · TICKET-V2-PHASE-5-MOD-001-AUTH-BOOTSTRAP-WIRING-DISCOVERY-001 · TICKET-V2-PHASE-5-MOD-001-AUTH-BOOTSTRAP-WIRING-DOCS-001
**Fecha:** 2026-07-10
**Tipo:** Cierre técnico local — bootstrap wiring mock-only
**Entorno:** localhost únicamente (`http://localhost:5173`)
**Rama:** `plan/v2-phase-4-api-client`

---

## 1. Contexto

Tras cerrar MOD-001 Authentication Foundation (`ded41b6`) y MOD-014 Auth Error Normalization (`6784307`), el laboratorio V2 integró **MOD-001 en la cadena de boot** mediante wiring controlado: MockAuthProvider, handoff exclusivo por Event Bus, Session Manager congelado intacto.

Discovery previo (`AUTH BOOTSTRAP WIRING LISTO PARA APERTURA`) definió: registrar Auth tras `ERR_READY`, activar restore **después** de `initializeSession()` (listeners `USER_LOGIN` activos), `bootScaffold()` síncrono preservado.

---

## 2. Objetivo

Integrar MOD-001 en `bootScaffold()` con:

- `bootstrap/initialize-auth.ts` (composición boot);
- `registerAuthForBoot()` + `activateAuthForBoot(portal)`;
- handoff **Event Bus únicamente** (`USER_LOGIN`);
- degradación guest en fallos recuperables;
- 12 tests de wiring;
- **sin** Supabase · **sin** Storage · **sin** UI · **sin** `SessionHandoffPort`.

---

## 3. Alcance autorizado

| Incluido | Excluido |
|----------|----------|
| `bootstrap/initialize-auth.ts` (nuevo) | `shared/session/runtime/` |
| `bootstrap/boot.ts`, `bootstrap/index.ts` | API Client · Theme · Event Bus catalog |
| `shared/auth/runtime/` (port, service, index) | MOD-014 runtime |
| `tests/unit/boot-auth-wiring.test.ts` | V1 · Supabase · docs (ticket separado) |

---

## 4. Implementación

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `bootstrap/initialize-auth.ts` | Creado | Registro mock + activación sync post-Session |
| `bootstrap/boot.ts` | Modificado | Cadena boot Auth register → Session → Auth activate |
| `bootstrap/index.ts` | Modificado | Re-exports wiring helpers |
| `auth-port.ts` | Modificado | `initialize({ portal? })` + `initializeForBoot(portal)` |
| `auth-service.ts` | Modificado | Restore sync mock · fix state machine restore · `applyRestoreResult` |
| `auth/runtime/index.ts` | Modificado | Export `AuthInitializeOptions` |
| `boot-auth-wiring.test.ts` | Creado | 12 casos wiring |

**Commit técnico:** `0866d19575dd63c5127a958f2cecacee293cf626` — `feat(v2-auth): wire authentication into bootstrap`

**Total:** 7 archivos · +543 / −5 líneas

---

## 5. Cadena de boot implementada

```
1. initializeConfiguration()     → Config FROZEN
2. initializeEventBus()          → BUS_READY
3. initializeLogging()           → LOG_READY
4. initializeErrorHandler()      → ERR_READY
5. registerAuthForBoot()         → MockAuthProvider + AuthService (sin restore)
6. initializeSession({ portal }) → listeners USER_LOGIN · SESSION_READY guest
7. activateAuthForBoot(portal)   → initializeForBoot · restore · USER_LOGIN opcional
8. initializeRuntime({ portal }) → RUNTIME_READY
9. emitSystemReady()             → SYSTEM_READY (×1)
10. bootIntegrateTheme()         → THEME_READY
```

**`bootScaffold()` permanece síncrono** — entrypoints `client|artist|staff/main.ts` sin cambios.

---

## 6. Política de handoff

| Regla | Estado |
|-------|--------|
| Ruta única | Event Bus `USER_LOGIN` |
| `SessionHandoffPort` | **Ausente** — no inyectado en bootstrap |
| Entrega directa Session | **No** — sin `deliverAuthHandoff()` desde bootstrap |
| Doble handoff | **Evitado** — un evento por restore exitoso |

---

## 7. Comportamiento

### Sin sesión (mock vacío)

- Auth → `UNAUTHENTICATED`
- Session → guest
- 0× `USER_LOGIN`
- Boot → `ok: true` · `authReady: true`
- `SYSTEM_READY` → exactamente 1×

### Restore válido (mock seeded)

- 1× `USER_LOGIN`
- Session → signed-in / `SESSION_READY`
- Auth → `SESSION_HANDOFF_SUCCEEDED`
- `SYSTEM_READY` posterior al handoff

### Fallos recuperables

Restore vacío · restore failed · token expirado · provider unavailable (código): degradación guest, boot continúa cuando el contrato lo permite.

### Fallos no recuperables

`AuthError` no recuperable (p. ej. publish Event Bus) → `BootFailure { phase: 'auth' }` — sin `SYSTEM_READY`.

---

## 8. Validación

| Métrica | Valor |
|---------|-------|
| Tests wiring | 12/12 PASS (`boot-auth-wiring.test.ts`) |
| Suite global | 422/422 PASS |
| Test files | 42/42 PASS |
| Working tree post-commit | Limpio |
| V2 Staff localhost | HTTP 200 |

---

## 9. Módulos congelados intactos

Session Manager Fase 3 · API Client Fase 4 · Theme Fase 2 · MOD-014 · Event Bus catalog · V1 · PR #117 · `origin/main` (`13bb4c4`).

---

## 10. Deuda registrada (no bloqueante)

1. `initializeForBoot()` acoplado a `MockAuthProvider` (`instanceof`).
2. Restore síncrono duplicado parcialmente (`restoreMockAuthProviderSync`).
3. `provider unavailable` sin test dedicado.
4. `BootFailure phase: 'auth'` sin test dedicado no recuperable.
5. MOD-001 no registrado en Runtime Registry.
6. Portal no viaja en payload `USER_LOGIN` (solo Auth snapshot / `portalContext` interno).
7. Estado global `bootMockProvider` en bootstrap.
8. Supabase / wiring real requerirá boot async futuro.

---

## 11. Pendiente explícito

- Registry MOD-001 en `runtime-service.ts`
- SupabaseAuthAdapter
- MOD-001 ↔ MOD-014 wiring en AuthService
- MOD-012 Storage para restore real
- UI login portales
- Publicación remota (sin push / PR / deploy sin PO)

---

## 12. Gobernanza

Sin push · sin PR · sin Preview · sin merge · sin deploy · sin producción.

**Documentación:** `docs/V2/TICKETS/TICKET-V2-PHASE-5-MOD-001-AUTH-BOOTSTRAP-WIRING-001.md`

*Pendiente commit documental · Detenerse hasta orden PO*
