# Cierre Fase 6 — MOD-005 API Bootstrap Wiring

**Proyecto:** MiamiDJBeat-MigracionV2
**Ticket:** TICKET-V2-PHASE-6-MOD-005-API-BOOTSTRAP-WIRING-001
**Fecha:** 2026-07-10
**Tipo:** Cierre técnico local — bootstrap wiring lab-only
**Entorno:** localhost únicamente (`http://localhost:5173`)
**Rama:** `plan/v2-phase-4-api-client`
**HEAD:** `990010bc7ba123b2bc456471440f1ad89441998a`
**Commit:** `feat(v2-api): wire API client into bootstrap`

---

## 1. Objetivo

Integrar MOD-005 API Client en `bootScaffold()` como único egress del Shared Core en laboratorio, con:

- singleton frozen post-boot;
- `MemoryTransport` únicamente (sin red real);
- `SessionReaderPort` live indirecto vía Session + Event Bus;
- inicialización después de Auth activate y Session;
- disponibilidad antes de Runtime;
- boot síncrono preservado;
- cero import directo de Auth en `shared/api/runtime/`.

---

## 2. Estado inicial

| Campo | Valor |
|-------|-------|
| HEAD previo | `c5c949f5b275bb11a2527a788c69635f7298e80d` |
| Foundation Fase 4 | ✅ `36ae1bc` — `createApiClient`, transports, retry/timeout/cancel |
| Discovery Fase 5 | ✅ Arquitectura E+D aprobada |
| Bootstrap wiring | ❌ Ausente |
| Suite baseline | 429/429 PASS · 43/43 files |
| Auth / Session / Runtime Registry | Congelados — sin cambios en este ticket |

---

## 3. Arquitectura aprobada

**Opción E + D** (heredada de discovery Fase 5):

- **D:** API Client = único egress HTTP/RPC/Edge del Shared Core.
- **E:** Adapters desacoplados vía `TransportPort` (`MemoryTransport` hoy; `FetchTransport` / Supabase futuro).

| Regla | Decisión implementada |
|-------|----------------------|
| Auth | **Indirecto** — sin `getAuthService()` en API runtime |
| Session | Lectura snapshot público + correlación Event Bus |
| Runtime | Sin dependencia directa API → Runtime |
| Lab transport | `MemoryTransport` exclusivo |
| Producción | **No autorizada** en este cierre |

---

## 4. Cadena final del boot

```
1. initializeConfiguration()     → Config FROZEN
2. initializeEventBus()          → BUS_READY
3. initializeLogging()           → LOG_READY
4. initializeErrorHandler()      → ERR_READY
5. registerAuthForBoot()         → MockAuthProvider + AuthService
6. initializeSession({ portal }) → SESSION_READY
7. activateAuthForBoot(portal)   → restore mock · USER_LOGIN opcional
8. initializeApiForBoot(portal)  → API_READY (MOD-005)
9. initializeRuntime({ portal }) → RUNTIME_READY
10. emitSystemReady()            → SYSTEM_READY (×1)
11. bootIntegrateTheme()         → THEME_READY
```

**`bootScaffold(envOverrides?, portal): BootResult`** — síncrono, sin cambio de firma.

---

## 5. Contrato de `api-service.ts`

| Función | Firma / comportamiento |
|---------|-------------------------|
| `initializeApiClient(deps)` | `(deps) => ApiClientPublicApi` — delega en `createApiClient()` |
| `getApiClient()` | Devuelve singleton frozen; throw si no `API_READY` |
| `getApiClientState()` | `API_UNINITIALIZED` \| `API_BOOTING` \| `API_READY` \| `API_ERROR` |
| `resetApiClientForTests()` | Limpia singleton — solo tests |

**Segunda init en `API_READY`:** idempotente — misma referencia.

**Freeze:** `Object.freeze` en API pública delegada por `createApiClient()`.

---

## 6. SessionReaderPort

Implementado en `bootstrap/initialize-api.ts` vía `createSessionReaderFromSnapshot()`:

```text
getSessionSnapshot()
  → si user == null → null (guest)
  → si signed-in → getEventBus().getHistory() (reverse)
    → entry.name === 'USER_LOGIN'
    → parseUserLoginPayload(entry)
    → payload.userId === snapshot.user.userId
    → Bearer <accessTokenRef>
```

**Limitación documentada:** `UserRef` en snapshot público **no** expone `accessTokenRef`. El token opaco se correlaciona desde historial `USER_LOGIN` publicado por Auth durante handoff event-bus-only.

---

## 7. Integración indirecta con Auth

```
Auth (MockAuthProvider restore)
  → publish USER_LOGIN (accessTokenRef en payload)
  → Session listeners ingest handle
  → getSessionSnapshot().user (userId)
  → SessionReader correlaciona USER_LOGIN por userId
  → API Client inyecta Authorization en transport
```

**Prohibido y verificado:** `shared/api/runtime/` no importa `shared/auth/runtime/`.

---

## 8. Integración con Session

- Session runtime **sin modificaciones**.
- `initializeApiForBoot` solo **lee** `getSessionSnapshot()` y `parseUserLoginPayload()`.
- Tests confirman snapshot JSON inmutable tras init API.
- **Deuda:** no existe API pública Session para resolver Authorization opaca sin Event Bus history.

---

## 9. Integración con Runtime

- API init **antes** de `initializeRuntime()`.
- Runtime Registry **sin** entrada MOD-005 (pendiente ticket futuro).
- `SYSTEM_READY` solo tras API_READY exitoso.
- Fallo api-client → `BootFailure` fase `api-client` · sin Runtime · sin SYSTEM_READY.

---

## 10. Resultado guest

| Criterio | Resultado |
|----------|-----------|
| `getApiClientState()` | `API_READY` |
| Authorization header | Ausente (`undefined` en transport) |
| Boot | ✅ `ok: true` |
| `SYSTEM_READY` | 1× |
| Runtime / Theme | ✅ ready |

---

## 11. Resultado signed-in

| Criterio | Resultado |
|----------|-----------|
| Restore mock válido | Session `userId` presente |
| `getApiClientState()` | `API_READY` |
| Authorization | `Bearer mock-<userId>-access` (desde USER_LOGIN history) |
| Import Auth directo | ❌ ausente |
| Boot | ✅ `ok: true` |

---

## 12. Validación de tests

| Suite | Resultado |
|-------|-----------|
| `boot-api-wiring.test.ts` | ✅ 19/19 PASS |
| Suite global | ✅ 448/448 PASS |
| Test files | ✅ 44/44 PASS |

### Tests implementados (19)

1. API después de Auth activate
2. API antes de Runtime
3. Guest: API_READY, sin Authorization, boot OK, SYSTEM_READY×1
4. Signed-in: API_READY, Authorization desde SessionReaderPort
5. Sin import Auth en API runtime (grep estático)
6. Singleton misma referencia + frozen
7. `getApiClient()` antes de init → throw
8. `resetApiClientForTests()` limpia estado
9–11. Portales client / artist / staff boot OK
12. Runtime ready post-boot
13. Theme ready post-boot
14. SYSTEM_READY solo después de API init (cadena manual)
15. MemoryTransport sin llamadas `fetch`
16. Session snapshot inmutable
17. Auth state inmutable
18. BootFailure api-client bloquea SYSTEM_READY
19. Infra flags guest boot

### Tests pendientes (no bloqueantes commit técnico)

- Logout + historial USER_LOGIN conservado → sin token
- Relogin mismo userId → token más reciente
- USER_LOGIN de otro userId → no tomar token incorrecto

---

## 13. Riesgos abiertos

| Riesgo | Severidad | Mitigación actual |
|--------|-----------|-------------------|
| Event Bus history como lookup de credencial | Alta (arquitectura) | Guard `snapshot.user`; filtro userId; solo lab |
| Sin API Session para token opaco | Media | Correlación USER_LOGIN temporal |
| Historial vacío con Session signed-in | Media | Request sin Authorization; boot OK |
| Sin validar expiresAt/handoffId/portal | Baja lab | Session ya validó en ingest |
| Registry MOD-005 ausente | Baja observabilidad | Ticket futuro |

**Esta solución está aprobada únicamente para laboratorio local. No está autorizada para merge, preview ni producción.**

---

## 14. Deudas aceptadas

- Event Bus history usado temporalmente para `accessTokenRef`.
- No existe API pública Session para Authorization opaca.
- Runtime Registry MOD-005 pendiente.
- `USER_LOGOUT` → `cancelAll()` pendiente.
- `resetApiClientForTests()` no ejecuta `cancelAll()`.
- `normalizeApiError()` pendiente.
- `FetchTransport` pendiente.
- `invokeEdge()` / `rpc()` pendientes.
- Supabase adapter fuera de alcance.
- Tests stale-token / relogin / wrong-userId pendientes.

**Solución futura recomendada:** API pública segura de Session para resolver Authorization opaca, sin usar historial como almacenamiento.

---

## 15. Próximo ticket recomendado (sin abrir)

**Opción A — Observabilidad:** `TICKET-V2-PHASE-6-MOD-005-RUNTIME-REGISTRY-001` — registro estático MOD-005 en Runtime Registry.

**Opción B — Hardening SessionReader:** ticket Session public opaque Authorization API + tests stale-token antes de merge.

**Opción C — Logout hygiene:** `USER_LOGOUT` → `apiClient.cancelAll()` con autorización PO explícita.

*Sin apertura automática · Sin push · Sin producción*
