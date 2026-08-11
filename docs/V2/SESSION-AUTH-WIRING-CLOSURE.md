# SESSION & AUTH WIRING V2 — Cycle Closure (Pasos 1–6)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/SESSION-AUTH-WIRING-CLOSURE.md` |
| **Fase** | Dominio Session & Auth Wiring V2 — **Paso 6** (documentación + cierre de ciclo) |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Tipo** | Auditoría documental — **sin SQL** · **sin commit** · **sin deploy** · **sin Auth writers** |
| **Jerarquía** | Constitución + Protocolo PO · matriz [SESSION-AUTH-WIRING-MATRIX.md](./SESSION-AUTH-WIRING-MATRIX.md) · prerrequisitos [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md) · [BOOKINGS-CYCLE-CLOSURE.md](./BOOKINGS-CYCLE-CLOSURE.md) · [FINANCIAL-CYCLE-CLOSURE.md](./FINANCIAL-CYCLE-CLOSURE.md) · [WEATHER-CYCLE-CLOSURE.md](./WEATHER-CYCLE-CLOSURE.md) |
| **Suite ciclo Wiring (Vitest)** | **48/48 PASS** (adapter 15 + staff pilot 11 + artist pilot 11 + client pilot 11) |
| **Suite sesión lab (MOD-002 + wiring)** | **204/204 PASS** (17 files — foundation Session Manager + injection pilots) |
| **Suite global lab (referencia)** | **1368/1368 PASS** (109 files) al cierre Paso 5/6 |
| **Typecheck** | `tsc --noEmit` exit 0 (lab) |
| **Portales** | `/staff/` · `/artist/` · `/client/` → HTTP **200** · Session Injection Pilot active |
| **Rama local** | `plan/v2-artist-agenda-matrix` — artefactos `M` / `??` — **sin commit** |

---

## 1. Veredicto

El ciclo de **Read Model de Session & Auth Wiring V2** (discovery → adapter → inyección read-only en tres portales) queda **cerrado en laboratorio** bajo gobernanza read-only.

| Criterio | Estado |
|----------|--------|
| Matriz discovery + DTOs (Paso 1) | ✅ |
| `session-wiring.adapter.ts` + mappers/mocks (Paso 2) | ✅ |
| MOD-301 Staff Session Injection Pilot (Paso 3) | ✅ |
| MOD-204 Artist Session Injection Pilot (Paso 4) | ✅ |
| MOD-103 Client Session Injection Pilot (Paso 5) | ✅ |
| Documentación + índices (Paso 6) | ✅ (este documento) |
| Login / password / Auth writers / SQL / RLS / commit / deploy | ❌ Fuera de alcance (prohibido) |
| V1 `web/` auth · `supabase/` · OFTL `finance/` | ✅ **Intactos** |
| Dominios sellados Perfiles / Agenda / Finanzas / Weather | ✅ **Intactos** (solo params opcionales `sessionWiring`) |

---

## 2. Arquitectura Read Model (resumen)

```text
Lab fixtures / SessionReaderPort / JWT-like claims (read-only)
        │
        ├─ map → SessionContextDTO     ──► role · portal · userId · expiry · mdjbId
        └─ map → AuthBearerHeaderDTO   ──► present · scheme · redactedPreview
                    │
                    └─ session-wiring.adapter.ts
                         getLabSessionContext()
                         validateBearerTokenHeader()
                         verifyDomainAccessWithSession({ domain, enforcePortalMatch })
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
           staff/session/    artist/session/   client/session/
           Staff Pilot       Artist Pilot      Client Pilot
           (MOD-301-SW)      (MOD-204-SW)      (MOD-103-SW)
                    │               │               │
                    ▼               ▼               ▼
           profiles·bookings·financial·weather mounts (gated + scoped)
```

### 2.1 DTOs canónicos

| DTO | Origen / proyección | Consumo lab | Notas |
|-----|---------------------|-------------|-------|
| **SessionContextDTO** | Snapshot / JWT claims row | Adapter + 3 pilots | Roles `guest\|client\|artist\|staff\|staff_seller`; `authorizationKind` ready/none |
| **AuthBearerHeaderDTO** | Authorization header | Adapter + badges | Preview **redactado**; nunca loguear `headerValue` en prod |

**Helpers (types):** `toSessionContextDTO` · `parseAuthBearerHeader` · `sessionAllowsDomainRead` · `mapLabelsToSessionWiringRole`

**Barrel / spec lab:** `MiamiDJBeat-MigracionV2/shared/services/session-wiring/` · `SESSION-WIRING-SPEC.md` · types `shared/types/session.types.ts`

**Regla producto:** Session Wiring **no autentica**, **no escribe** roles, **no muta** `auth.users`. Postgres (`is_staff` / filas perfil) sigue siendo autoridad en producción (Constitución ST-01).

### 2.2 Adapter (Paso 2) — solo lectura

| Método | Uso |
|--------|-----|
| `getLabSessionContext()` | Contexto + Bearer desde fixtures / reader lab |
| `validateBearerTokenHeader(header)` | Parse + redact |
| `verifyDomainAccessWithSession({ domain, context, bearer, enforcePortalMatch })` | Gate `profiles` · `bookings` · `financial` · `weather` |

**Prohibido:** signIn · signUp · password reset · refresh writers · role mutation · SQL/RLS.

### 2.3 Aislamiento por sujeto (Pasos 3–5)

| Portal | Rol requerido | Scope ID | Regla |
|--------|---------------|----------|-------|
| Staff | `staff` \| `staff_seller` | N/A (audiencia staff_*) | Domain gate + portal match |
| Artist | `artist` | `assigned_dj_id` = `context.userId` | Override foráneo **ignorado** en live fetch |
| Client | `client` | `client_id` = `context.userId` | Override foráneo **ignorado** en live fetch |

---

## 3. Integración portales (`localhost:5173`)

| Portal | Módulo | Slot dashboard | Artefactos |
|--------|--------|----------------|------------|
| **Staff** `/staff/` | MOD-301-SW | `data-mdj-staff-section="session-wiring"` | `staff/session/*` · badge rol + Bearer redactado |
| **Artist** `/artist/` | MOD-204-SW | `data-mdj-artist-section="session-wiring"` | `artist/session/*` · badge `ARTIST` + DJ ID enmascarado |
| **Client** `/client/` | MOD-103-SW | `data-mdj-client-section="session-wiring"` | `client/session/*` · badge `CLIENT` + Client ID enmascarado |

Patrón común:

1. `resolve*SessionWiringPilot(variant)` → injection DTO
2. Badge DOM read-only (cero forms login/password)
3. Mount async/sync reciben `sessionWiring?` → `*DomainAccessAllowed` + annotate `sourceLabel`
4. Live service **solo** si portal ready + domain allowed; else lab mock
5. Spec Vitest dedicado por portal

| Boot | Wire |
|------|------|
| `staff/main.ts` | `resolveStaffSessionWiringPilot('staff')` → dashboard + 4 mounts |
| `artist/main.ts` | `resolveArtistSessionWiringPilot('artist')` → dashboard + 4 mounts |
| `client/main.ts` | `resolveClientSessionWiringPilot('client')` → dashboard + 4 mounts |

---

## 4. Cobertura de pruebas

### 4.1 Ciclos prerrequisito (sellados)

| Ciclo | Tests (histórico consolidado) | Cierre |
|-------|------------------------------:|--------|
| Perfiles V2 | 55 | [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md) |
| Agenda / Bookings V2 | 38+ | [BOOKINGS-CYCLE-CLOSURE.md](./BOOKINGS-CYCLE-CLOSURE.md) |
| Finanzas & Pagos V2 | 40+ | [FINANCIAL-CYCLE-CLOSURE.md](./FINANCIAL-CYCLE-CLOSURE.md) |
| Weather Engine V2 | 46 | [WEATHER-CYCLE-CLOSURE.md](./WEATHER-CYCLE-CLOSURE.md) |

### 4.2 Ciclo Session & Auth Wiring — **48/48 PASS**

| Bloque | Archivo(s) | Tests |
|--------|------------|------:|
| Paso 2 adapter / mappers | `tests/unit/session-wiring.service.spec.ts` | 15 |
| Paso 3 Staff pilot | `tests/unit/staff-session-wiring-read.spec.ts` | 11 |
| Paso 4 Artist pilot | `tests/unit/artist-session-wiring-read.spec.ts` | 11 |
| Paso 5 Client pilot | `tests/unit/client-session-wiring-read.spec.ts` | 11 |
| **Total ciclo Wiring** | | **48** |

### 4.3 Sesión lab relacionada (MOD-002 foundation + wiring)

| Conjunto | Tests |
|----------|------:|
| MOD-002 Session Manager + handoff + permissions wire (specs `session*.ts` / `auth-session-handoff`) + pilots Wiring | **204/204** |
| Suite global lab al cierre | **1368/1368** (109 files) |

> Nota: el ticket de Paso 6 refería ~197 tests de sesión; la medición lab al cierre es **204** (foundation + wiring) y **48** estrictamente del ciclo de inyección Pasos 2–5.

---

## 5. Evidencia de cierre (checklist)

| Check | Estado |
|-------|--------|
| `tsc --noEmit` | ✅ |
| Session Wiring cycle 48/48 | ✅ |
| Suite global 1368/1368 | ✅ |
| `/staff/` `/artist/` `/client/` HTTP 200 | ✅ |
| Badges sin form/password/submit | ✅ |
| Scope assigned_dj_id / client_id enforced in mounts | ✅ |
| V1 `web/` auth · `supabase/` · OFTL · 4 dominios sellados | ✅ Intactos |
| Commit / push / deploy | ❌ No ejecutados |

---

## 6. Inventario de rutas clave

| Área | Ruta |
|------|------|
| Matriz discovery | `docs/V2/SESSION-AUTH-WIRING-MATRIX.md` |
| Este cierre | `docs/V2/SESSION-AUTH-WIRING-CLOSURE.md` |
| Spec servicio | `MiamiDJBeat-MigracionV2/shared/services/session-wiring/SESSION-WIRING-SPEC.md` |
| Types | `…/shared/types/session.types.ts` |
| Adapter / mappers / mocks | `session-wiring.adapter.ts` · `session-wiring.map-rows.ts` · `session-wiring.mocks.ts` |
| Staff pilot | `MiamiDJBeat-MigracionV2/staff/session/` |
| Artist pilot | `MiamiDJBeat-MigracionV2/artist/session/` |
| Client pilot | `MiamiDJBeat-MigracionV2/client/session/` |
| MOD-002 Session (referencia) | `…/shared/session/` — **no** reabierto como writers |

---

## 7. Fuera de alcance (post-ciclo)

Requieren **ticket + OK PO** explícito:

- Login / register / logout UI writers · password reset · token rotation productiva
- Validación firma JWT / refresh Edge en lab gates
- Mutar `auth.users` · `app_metadata` · RLS / SQL
- Extender `SessionReaderPort` con userId/role productivo (G2 residual)
- Reabrir Perfiles / Agenda / Finanzas / Weather beyond optional `sessionWiring`
- Commit / push / merge / deploy
- Cambio MODULE-CATALOG PLANIFICADO → PRODUCCIÓN (producto)

---

## 8. Hoja de ruta Pasos 1–6

| Paso | Entregable | Estado |
|------|------------|--------|
| 1 | Discovery matrix + `SessionContextDTO` / `AuthBearerHeaderDTO` | ✅ |
| 2 | `session-wiring` adapter + Vitest | ✅ 15 tests |
| 3 | Staff Session Injection Pilot (`/staff/`) | ✅ +11 |
| 4 | Artist Session Injection Pilot (`/artist/`) + assigned_dj_id | ✅ +11 |
| 5 | Client Session Injection Pilot (`/client/`) + client_id | ✅ +11 |
| 6 | Documentación cierre | ✅ |

**Suite ciclo Session Wiring al cierre:** **48/48 PASS**.  
**Portales:** **3 × 200 OK** con Session Injection Pilot. **tsc:** OK.  
**Suite global:** **1368/1368 PASS**.

---

*Paso 6 — cierre documental ciclo Session & Auth Wiring V2 — 2026-08-11 — documentation only — no commit*
