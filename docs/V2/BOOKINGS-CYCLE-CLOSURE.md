# BOOKINGS / AGENDA V2 — Cycle Closure (Pasos 1–5)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/BOOKINGS-CYCLE-CLOSURE.md` |
| **Fase** | Dominio Agenda V2 — **Paso 6** (documentación + cierre de ciclo) |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Tipo** | Auditoría documental — **sin SQL** · **sin commit** · **sin deploy** · **sin writers** |
| **Jerarquía** | Constitución + Protocolo PO · matriz [BOOKINGS-V1-V2-MAPPING-MATRIX.md](./BOOKINGS-V1-V2-MAPPING-MATRIX.md) · prerrequisito [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md) |
| **Suite consolidada (Vitest)** | **93/93 PASS** (ciclo Perfiles 55 + Agenda servicio/UI 38) |
| **Typecheck** | `tsc --noEmit` exit 0 (lab) |
| **Portales** | `/client/` · `/artist/` · `/staff/` → HTTP **200** |

---

## 1. Veredicto

El ciclo de **Read Model de Agenda / Bookings V2** (discovery → contratos → servicio → UI Slice 2 en tres portales) queda **cerrado en laboratorio** bajo gobernanza read-only.

| Criterio | Estado |
|----------|--------|
| Matriz DTO canónica (Paso 1) | ✅ |
| Types + BookingsService read-only (Paso 2) | ✅ |
| MOD-301 Slice 2 Staff Master Calendar (Paso 3) | ✅ |
| MOD-204 Slice 2 Artist Schedule (Paso 4) | ✅ |
| MOD-103 Slice 2 Client Bookings (Paso 5) | ✅ |
| Documentación + índices (Paso 6) | ✅ (este documento) |
| Writers / SQL / RLS / commit / deploy | ❌ Fuera de alcance (prohibido) |

---

## 2. Arquitectura Read Model (resumen)

```text
public.leads (+ dj_profiles JSON schedule)
        │
        ├─ map → BookingSnapshotDTO     ──► listas / filtros lifecycle
        ├─ map → CalendarSlotDTO        ──► celdas virtuales (master / artist)
        └─ map → EventDetailReadDTO     ──► ficha read-only (+ redact by audience)
                    │
                    ├─ fetchMasterSchedule  ──► staff/calendar/   (MOD-301 S2)
                    ├─ fetchArtistSchedule  ──► artist/schedule/  (MOD-204 S2)
                    └─ fetchOwnBookings     ──► client/bookings/  (MOD-103 S2)
```

### 2.1 DTOs canónicos

| DTO | Origen V1 (proyección) | Consumo lab | Notas |
|-----|------------------------|-------------|-------|
| **BookingSnapshotDTO** | `public.leads` (hub; no tabla `bookings`) | Listas client/staff; filtros lifecycle | Snapshot ≠ detalle; `paymentStatus` separado del lifecycle |
| **CalendarSlotDTO** | Leads + JSON `dj_profiles` (`weekly_schedule`, `availability_schedule`, vacations) | Master / Artist schedule grids | `slotId` sintético (G1); kind = booking \| residency \| availability \| vacation |
| **EventDetailReadDTO** | Lead + enrichment opcional (`mdj_event_flows`, notes) | Tarjetas detalle read-only | PII vía `redactEventDetailForAudience` (`client_own` · `artist_assigned` · `staff_seller` · `staff_full`) |

**Lifecycle V2 canónico:** `Draft` · `Confirmed` · `InProgress` · `Completed` · `Cancelled` — vía `mapV1StatusToLifecycle()`.

**Barrel / spec lab:** `MiamiDJBeat-MigracionV2/shared/services/bookings/` · `BOOKINGS-SPEC.md` · types `shared/types/bookings.types.ts`

### 2.2 Servicio (Paso 2) — solo lectura

| Método | Audiencia |
|--------|-----------|
| `fetchOwnBookings({ clientUserId })` | Cliente — propios |
| `fetchArtistSchedule({ artistUserId })` | Artista — slots JSON + assigned |
| `fetchMasterSchedule({ audience })` | Staff — master leads (+ PII seller vs full) |
| `fetchEventDetail(id, { audience })` | Detalle + redact |

**Prohibido:** `insert` · `update` · `upsert` · `delete` · cancel · pay · assign writers.

### 2.3 Gaps heredados (no “cerrados” por magia)

Documentados en la matriz §7 — siguen abiertos a ticket futuro: slots virtuales (G1), ambigüedad InProgress/MATCHED (G2), `dj_events` legacy (G3), venue free-text (G4), CREATE leads ausente en migrations (G5), payment vs lifecycle (G6), Weather/Finanzas ortogonales (G7).

---

## 3. Integración portales (`localhost:5173`)

| Portal | Módulo | Slot dashboard | Artefactos UI |
|--------|--------|----------------|---------------|
| **Staff** `/staff/` | MOD-301 Slice 2 | `data-mdj-staff-section="master-calendar"` | `staff/calendar/*` |
| **Artist** `/artist/` | MOD-204 Slice 2 | `data-mdj-artist-section="artist-schedule"` | `artist/schedule/*` |
| **Client** `/client/` | MOD-103 Slice 2 | `data-mdj-client-section="client-bookings"` | `client/bookings/*` |

Patrón común (paridad con Perfiles Slice 1):

1. ViewModel puro (DTO → display)
2. Renderer DOM read-only (filtros display-only; cero forms / cancel / pay / edit)
3. Mount sync (lab mock) + async opcional (`BookingsService`)
4. Spec Vitest dedicado

| Portal | Filtros UI |
|--------|------------|
| Staff master | All + Draft · Confirmed · InProgress · Completed · Cancelled |
| Artist schedule | All · Confirmed · InProgress · Completed |
| Client bookings | All · Draft/Requested · Confirmed · InProgress · Completed · Cancelled |

---

## 4. Cobertura de pruebas (suite consolidada 93/93)

### 4.1 Ciclo Perfiles (prerrequisito sellado) — 55

Ver [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md) §4.

### 4.2 Ciclo Agenda — +38

| Bloque | Archivo(s) | Tests |
|--------|------------|------:|
| Paso 2 service | `tests/unit/bookings.service.spec.ts` | 13 |
| Paso 3 staff calendar | `tests/unit/staff-calendar-read-view.spec.ts` | 9 |
| Paso 4 artist schedule | `tests/unit/artist-schedule-read-view.spec.ts` | 8 |
| Paso 5 client bookings | `tests/unit/client-bookings-read-view.spec.ts` | 8 |
| **Subtotal Agenda** | | **38** |
| **Total consolidado (Perfiles + Agenda)** | | **93** |

Comando de verificación (lab):

```bash
cd MiamiDJBeat-MigracionV2
npx vitest run \
  tests/unit/profiles.spec.ts \
  tests/unit/profiles.service.spec.ts \
  tests/unit/profiles.identity-map.spec.ts \
  tests/unit/artist-profile-read-view.spec.ts \
  tests/unit/artist-dashboard-mvp.test.ts \
  tests/unit/artist-schedule-read-view.spec.ts \
  tests/unit/client-profile-read-view.spec.ts \
  tests/unit/client-dashboard-mvp.test.ts \
  tests/unit/client-bookings-read-view.spec.ts \
  tests/unit/staff-identity-read-view.spec.ts \
  tests/unit/staff-dashboard-mvp.test.ts \
  tests/unit/staff-calendar-read-view.spec.ts \
  tests/unit/bookings.service.spec.ts
npx tsc --noEmit
# curl localhost:5173/{client,artist,staff}/ → 200
```

---

## 5. Gobernanza respetada

| Barrera | Cumplimiento |
|---------|--------------|
| Read-only UI + service | ✅ |
| Cero DDL/DML / RLS | ✅ |
| Cero commit / push / deploy | ✅ (artefactos `M` / `??` locales) |
| V1 `web/` · Weather · Centro Financiero | ✅ Intactos |
| Ciclo Perfiles sellado (no reabrir) | ✅ |
| Portales cruzados no regresivos | ✅ `/client/` `/artist/` `/staff/` 200 |

---

## 6. Inventario de rutas clave

| Área | Ruta |
|------|------|
| Matriz discovery | `docs/V2/BOOKINGS-V1-V2-MAPPING-MATRIX.md` |
| Este cierre | `docs/V2/BOOKINGS-CYCLE-CLOSURE.md` |
| Spec servicio | `MiamiDJBeat-MigracionV2/shared/services/bookings/BOOKINGS-SPEC.md` |
| Types | `…/shared/types/bookings.types.ts` |
| Service / mappers / mocks | `…/bookings.service.ts` · `bookings.map-rows.ts` · `bookings.mocks.ts` |
| Staff UI | `MiamiDJBeat-MigracionV2/staff/calendar/` |
| Artist UI | `MiamiDJBeat-MigracionV2/artist/schedule/` |
| Client UI | `MiamiDJBeat-MigracionV2/client/bookings/` |
| Cierre perfiles (prerreq.) | `docs/V2/PROFILES-CYCLE-CLOSURE.md` |

---

## 7. Fuera de alcance (post-ciclo)

Requieren **ticket + OK PO** explícito:

- Writers (create / update / cancel booking · payments · assign DJ)
- Persistencia real de slots/occurrences (G1) o deprecation formal `dj_events` (G3)
- FullCalendar productivo en lab (V1 `agenda-engine.js` intacto)
- Acoplar Weather Engine o Centro Financiero al read model de Agenda
- Wiring productivo de `BookingsService` a sesión auth real en boot
- Commit / push / merge / deploy
- Cambio de status MODULE-CATALOG PLANIFICADO → PRODUCCIÓN (producto)

---

## 8. Hoja de ruta Pasos 1–6

| Paso | Entregable | Estado |
|------|------------|--------|
| 1 | Discovery matrix + types DTO | ✅ |
| 2 | BookingsService read-only + Vitest | ✅ 13 tests |
| 3 | MOD-301 Staff Master Calendar UI | ✅ +9 |
| 4 | MOD-204 Artist Schedule UI | ✅ +8 |
| 5 | MOD-103 Client Bookings UI | ✅ +8 |
| 6 | Documentación cierre | ✅ |

**Suite consolidada al cierre:** **93/93 PASS**.

---

*Paso 6 — cierre documental ciclo Agenda / Bookings V2 — 2026-08-11 — documentation only — no commit*
