# SESSION & AUTH WIRING V1 → V2 — Mapping Matrix (Read Model)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/SESSION-AUTH-WIRING-MATRIX.md` |
| **Fase** | Dominio Session & Auth Wiring V2 — **ciclo cerrado Pasos 1–6** |
| **Estado** | ✅ **SELLADO (lab read-only)** — ver [SESSION-AUTH-WIRING-CLOSURE.md](./SESSION-AUTH-WIRING-CLOSURE.md) |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Types lab** | `MiamiDJBeat-MigracionV2/shared/types/session.types.ts` |
| **Adapter lab** | `MiamiDJBeat-MigracionV2/shared/services/session-wiring/` |
| **Pilots** | `staff/session/` · `artist/session/` · `client/session/` |
| **Tipo** | Matriz canónica + cierre — **sin writers auth** · **sin SQL** · **sin commit** · **sin deploy** |
| **Suite ciclo Wiring** | **48/48 PASS** · global lab **1368/1368** |
| **Prerrequisitos** | [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md) · [BOOKINGS-CYCLE-CLOSURE.md](./BOOKINGS-CYCLE-CLOSURE.md) · [FINANCIAL-CYCLE-CLOSURE.md](./FINANCIAL-CYCLE-CLOSURE.md) · [WEATHER-CYCLE-CLOSURE.md](./WEATHER-CYCLE-CLOSURE.md) |
| **Jerarquía** | Constitución + Protocolo PO · MOD-002 Session SPEC · MOD-005 SessionReaderPort · Postgres `is_staff` / filas perfil (prod) |
| **Aislamiento** | **No** modificar V1 `web/` auth · `supabase/` · 4 dominios sellados · **no** mutar `auth.users` |

---

## 0. Lectura canónica aplicada

| Documento / evidencia | Uso |
|----------------------|-----|
| `shared/session/SESSION-SPEC.md` · `SESSION-STATE-MACHINE.md` | Estados sesión lab (INITIAL…ERROR); Session **no autentica** |
| `shared/session/runtime/types.ts` | `SessionSnapshot` · `AuthHandle` · `SessionAuthorizationState` |
| `shared/api/runtime/session-reader-port.ts` | `SessionReaderPort` · `createStaticSessionReader` (lab / tests) |
| `shared/api/runtime/types.ts` | `RequestContext` · `ActorType` |
| Domain services sellados | `requireSession` via `getAuthorizationHeader()` ≠ null |
| Perfiles V2 matriz | `mdj_access_snapshot` · ST-01 Postgres manda · JWT `app_metadata.role` **no** es verdad operativa |
| V1 (solo inventario) | `web/auth.js` · login hydrate `INITIAL_SESSION` vs `SIGNED_IN` · `mdj-identity.js` |

**Root de cableado futuro:** `MiamiDJBeat-MigracionV2/` — **no** tocar `web/` V1 ni RLS.

---

## 1. Principios de mapeo

1. **Session ≠ Auth writers.** Este ciclo define DTOs de **lectura** del contexto de sesión para inyectar en servicios read-only. Login / register / password reset / role mutation = **fuera de alcance**.
2. **Bearer presente = sesión “lista” para gates lab.** Los 4 servicios sellados hoy exigen `sessionReader.getAuthorizationHeader() !== null` (no validan firma JWT en lab).
3. **Rol de producto vs autoridad Postgres.** Labels `client` · `artist` · `staff` · `staff_seller` son **proyección de cableado**; en producción la verdad sigue `dj_profiles` / `client_profiles` + `is_staff` / `is_staff_management` (Constitución).
4. **Token never logged.** `AuthBearerHeaderDTO` expone presencia + preview redactado; **no** serializar access token en UI/logs.
5. **Lab isolation.** `createStaticSessionReader({ authorizationHeader: 'Bearer test' })` inyecta contexto **sin** credenciales productivas V1.
6. **Expired / anonymous ≠ crash portal.** Fallback: guest snapshot + `*_SESSION_REQUIRED` en fetch de dominio; UI sigue con fixtures sync.

---

## 2. Inventario de fuentes

### 2.1 Lab V2 (runtime existente)

| Artefacto | Rol | Notas discovery |
|-----------|-----|-----------------|
| `SessionSnapshot` | Foto de sesión (user, portal, roles[], expiresAt, state) | MOD-002 |
| `AuthHandle` | Handoff Auth→Session (userId, accessTokenRef, expiresAt) | Opaque refs |
| `getSessionAuthorizationHeader()` | Header `Authorization` opaco | MOD-005 composition |
| `getSessionAuthorizationState()` | `ready` \| `none` + reason (`anonymous`·`expired`·…) | Fallback matrix |
| `SessionReaderPort` | Puerto inyectable a API Client + domain services | Tests: static reader |
| `RequestContext` | requestId · correlationId · portal · sessionId · actorType | Metadata API |

### 2.2 Domain services (consumidores sellados)

| Servicio | Gate sesión | Subject IDs |
|----------|-------------|-------------|
| `ProfilesService` | `PROFILES_SESSION_REQUIRED` | userId / profile ids |
| `BookingsService` | `BOOKINGS_SESSION_REQUIRED` | clientUserId · artistUserId |
| `FinancialService` | `FINANCIAL_SESSION_REQUIRED` | clientUserId · artistUserId · staff audience |
| `WeatherService` | `WEATHER_SESSION_REQUIRED` | clientUserId · artistUserId · staff audience |

### 2.3 V1 productivo (solo referencia — no editar)

| Señal | Uso V1 | Mapeo V2 lab |
|-------|--------|--------------|
| Supabase access_token | Bearer en fetches | `AuthBearerHeaderDTO` |
| `auth.uid()` | RLS | `SessionContextDTO.userId` |
| `dj_profiles.role` | Staff / artist | `sessionRole` projection |
| `app_metadata.role` | **No confiar** (ST-01) | No inventar verdad desde JWT alone |
| `INITIAL_SESSION` vs `SIGNED_IN` | No redirigir invitados prematuro | `hydrationPhase` / `isAnonymous` |

---

## 3. DTOs V2 de lectura (Paso 1)

### 3.1 `SessionContextDTO` — contexto de sesión para cableado

| Campo DTO | Fuente / proyección | Notas |
|-----------|---------------------|-------|
| `sessionId` | `SessionSnapshot.sessionId` | Correlación lab |
| `userId` | `user.userId` \| null | Auth uid |
| `portal` | `client` \| `artist` \| `staff` \| null | Portal shell |
| `sessionRole` | `SessionWiringRole` | Ver §4 |
| `actorType` | `guest` \| `authenticated` \| `staff` \| `system` | RequestContext |
| `expiresAt` | ISO \| null | Token / session expiry |
| `isExpired` | derived | `expiresAt` past \| auth state `expired` |
| `isAnonymous` | derived | no user **or** auth state anonymous |
| `authorizationKind` | `ready` \| `none` | From authorization state |
| `authorizationNoneReason` | `anonymous`\|`expired`\|`destroyed`\|`error`\|`cleared`\|`unbound`\|null | Fallback |
| `rolesRaw` | `SessionSnapshot.roles` | Labels; **not** Postgres gate |
| `mdjbId` | identity optional | Account code if present |
| `hydrationPhase` | `initial`\|`signed_in`\|`none` | V1 parity INITIAL vs SIGNED_IN |

### 3.2 `AuthBearerHeaderDTO` — header Authorization (read)

| Campo DTO | Fuente / proyección | Notas |
|-----------|---------------------|-------|
| `present` | header ≠ null/empty | Gate services |
| `scheme` | `Bearer` \| `Unknown` \| `None` | |
| `headerValue` | full `Authorization` string \| null | **Lab only**; never log |
| `redactedPreview` | `Bearer ab…xy` \| `—` | Safe for diagnostics |
| `credentialVersion` | optional int | From auth state ready |

**Prohibido en DTO:** refresh token plaintext · password · service_role key.

---

## 4. Roles de cableado (`SessionWiringRole`)

| Role | Portal típico | Significado lab | Postgres prod (recordatorio) |
|------|---------------|----------------|------------------------------|
| `client` | `/client/` | Comprador / cliente | `client_profiles` |
| `artist` | `/artist/` | Performer | `dj_profiles` artist tier |
| `staff` | `/staff/` | Staff pleno (owner/manager) | `is_staff_management` |
| `staff_seller` | `/staff/` | Staff limitado | `is_staff` sin management |
| `guest` | any | Anónimo / pre-login | no row |

**Nota:** `staff_seller` aísla redacciones (ej. Financial seller); **no** implica writers.

---

## 5. Propagación a servicios read-only sellados

```text
SessionSnapshot / AuthHandle (lab)
        │
        ├─► SessionContextDTO
        ├─► AuthBearerHeaderDTO
        │
        └─► SessionReaderPort.getAuthorizationHeader()
                    │
        ┌───────────┼───────────┬─────────────┬─────────────┐
        ▼           ▼           ▼             ▼             ▼
   Profiles    Bookings    Financial     Weather      API Client
   requireSession (Bearer present) → fetch* subject-scoped reads
```

| Dominio | Qué inyecta la sesión | Qué **no** hace |
|---------|----------------------|-----------------|
| Perfiles | Bearer + userId para snapshot/perfil propio | Mutar `dj_profiles.role` |
| Agenda | Bearer + client/artist subject | Create/cancel booking |
| Finanzas | Bearer + audience staff_seller/full | Charge/refund/release |
| Weather | Bearer + owned/assigned lead filter | Cancel/reschedule event |

---

## 6. Matriz de fallback (tokens expirados / anónimos)

| Condición | `authorizationKind` | Portales `/client` `/artist` `/staff` | Domain fetch | UI lab |
|-----------|---------------------|----------------------------------------|--------------|--------|
| Bearer ready + userId | `ready` | Shell autenticado | OK (si subject válido) | Live service **o** mock |
| Sin user / guest | `none` · `anonymous` | Shell guest permitido | `*_SESSION_REQUIRED` (401) | Mount **sync fixtures** |
| Token expired | `none` · `expired` | Mostrar re-auth placeholder (futuro); **no** crash | 401 session required | Fixtures; no writers re-login |
| Destroyed / error | `none` · `destroyed`/`error` | Degradar a anonymous | 401 | Empty + note read-only |
| Unbound user mismatch | `none` · `unbound` | Clear local context (futuro) | 401 | Fixtures |

**Regla lab Paso 1:** dashboards actuales montan slices con **lab mock** aunque no haya Bearer real — el cableado productivo Session→Service queda para Pasos siguientes (sin login writers).

---

## 7. Aislamiento respecto a V1

| Barrera | Cumplimiento |
|---------|--------------|
| No editar `web/auth.js` / login.html / supabase-config | ✅ |
| No DDL/DML `auth.users` / RLS | ✅ |
| No service_role / prod keys en lab DTOs | ✅ |
| Static SessionReader en Vitest | ✅ (`Bearer test`) |
| 4 dominios sellados | ✅ Solo **consumen** sesión; no se reabren |

---

## 8. Gaps / abiertos

| # | Gap | Impacto | Resolución futura (ticket) |
|---|-----|---------|------------------------------|
| G1 | Domain mounts sin Session live | ✅ Mitigado Pasos 3–5 | Pilots inyectan `sessionWiring` + gate; live sigue opcional |
| G2 | `SessionReaderPort` no expone userId/role | Services reciben subject por arg / scope session | Extender port — **post-ciclo** ticket |
| G3 | JWT signature/expiry not verified in lab gates | Solo presencia Bearer + fixtures expiry | Edge/API validation — **post-ciclo** |
| G4 | Role labels vs Postgres | Seller/full confusion | Always re-check `mdj_access_snapshot` / is_staff (prod) |
| G5 | No productive refresh in UI | Expired stays mock / gated | Auth MOD-001 refresh — **no** writers en este ciclo |
| G6 | V1 INITIAL_SESSION redirects | Guest bounce | Preserve hydrate distinction — **fuera** V1 `web/` |

---

## 9. Fuera de alcance (ciclo cerrado — residual post-ciclo)

- Login / register / logout UI writers · password reset · token rotation endpoints
- Mutar roles en BD · JWT `app_metadata` updates
- SQL / RLS / Edge Auth deploy
- Reabrir Perfiles / Agenda / Finanzas / Weather beyond optional `sessionWiring`
- Commit / push / deploy

---

## 10. Cierre oficial (Paso 6)

El ciclo Session & Auth Wiring V2 (Pasos 1–6) está **sellado en laboratorio**.  
Registro de auditoría: **[SESSION-AUTH-WIRING-CLOSURE.md](./SESSION-AUTH-WIRING-CLOSURE.md)**.

| Paso | Entregable | Estado |
|------|------------|--------|
| 1 | Discovery + DTOs | ✅ |
| 2 | `session-wiring` adapter | ✅ 15 tests |
| 3 | Staff Session Pilot | ✅ 11 tests |
| 4 | Artist Session Pilot + `assigned_dj_id` | ✅ 11 tests |
| 5 | Client Session Pilot + `client_id` | ✅ 11 tests |
| 6 | Documentación cierre | ✅ |

**Post-ciclo** (JWT verify productivo, Auth writers, SessionReaderPort enrichment) requiere **ticket + OK PO** nuevo — no improvisar.

---

## 11. Referencias

| Recurso | Ruta |
|---------|------|
| Types | `MiamiDJBeat-MigracionV2/shared/types/session.types.ts` |
| Session Wiring | `…/shared/services/session-wiring/` |
| Staff / Artist / Client pilots | `…/staff|artist|client/session/` |
| Session runtime (MOD-002) | `…/shared/session/runtime/` |
| SessionReaderPort | `…/shared/api/runtime/session-reader-port.ts` |
| Cierre ciclo | `docs/V2/SESSION-AUTH-WIRING-CLOSURE.md` |
| Weather cierre | `docs/V2/WEATHER-CYCLE-CLOSURE.md` |
| Profiles matriz | `docs/V2/PROFILES-V1-V2-MAPPING-MATRIX.md` |

---

*Session & Auth Wiring V2 — ciclo cerrado Pasos 1–6 — 2026-08-11 — documentation only — no commit*
