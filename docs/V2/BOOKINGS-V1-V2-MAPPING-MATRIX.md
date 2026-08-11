# BOOKINGS / AGENDA V1 → V2 — Mapping Matrix (DTO Read Model)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/BOOKINGS-V1-V2-MAPPING-MATRIX.md` |
| **Fase** | Dominio Agenda V2 — **Paso 1** (discovery) · ciclo lectura **cerrado** (Pasos 1–6) |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Types lab** | `MiamiDJBeat-MigracionV2/shared/types/bookings.types.ts` |
| **Tipo** | Documentación discovery — **sin writers** · **sin SQL** · **sin commit** · **sin deploy** |
| **Prerrequisito** | Ciclo Perfiles V2 cerrado ([PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md)) |
| **Estado ciclo** | Pasos 1–5 **cerrados en lab** — ver [BOOKINGS-CYCLE-CLOSURE.md](./BOOKINGS-CYCLE-CLOSURE.md) (Paso 6) |
| **Suite consolidada** | **93/93 PASS** (Perfiles + Agenda) |
| **Jerarquía** | Constitución + Protocolo PO · [MODULE-CATALOG](./MiamiDJBeat-V2-MODULE-CATALOG.md) MOD-109 / 113 / 206 / 207 / 305 / 308 / 312 |

---

## 0. Lectura canónica aplicada

| Documento / evidencia | Uso |
|----------------------|-----|
| `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` | MOD-109 Bookings · MOD-113 Client Calendar · MOD-206 Availability · MOD-207 Calendar · MOD-305/308/312 staff |
| `docs/V2/MIAMI-DJ-BEAT-V1-TO-V2-MIGRATION-BLUEPRINT.md` | FullCalendar → MOD-207 · client portal → MOD-109 |
| `docs/architecture/MASTER-WIRING-AUDIT-V1.md` | Writers / RPCs leads |
| Migrations `supabase/migrations/*leads*`, `*event_flows*`, `*event_builder*`, `*events_and_communication*` | Inventario columnas / RLS |
| `web/js/agenda-engine.js` · `web/client-portal.js` | Runtime V1 (solo lectura para discovery) |

**Root de implementación futura:** `MiamiDJBeat-MigracionV2/` — **no** tocar `web/` V1.

---

## 1. Principios de mapeo

1. **No existe tabla `bookings` / `slots` / `occurrences` en V1.** El hub comercial es **`public.leads`**.
2. **Agenda artista ≠ solo leads.** FullCalendar combina JSON de `dj_profiles` (`weekly_schedule`, `availability_schedule`, vacaciones) + leads asignados + (opcional) `mdj_event_flows`.
3. **Snapshot ≠ detalle.** `BookingSnapshotDTO` es lista/calendario; `EventDetailReadDTO` es ficha; `CalendarSlotDTO` es celda/bloque visual (puede ser virtual).
4. **Postgres manda.** V2 no inventa tablas en este paso; DTOs proyectan fuentes existentes.
5. **Identidad ya cerrada.** Visibilidad por rol se alinea a Perfiles V2 (`client.*` / `artist.*` / `staff.*`) + RLS V1 documentada.
6. **Estados V2 canónicos** (producto Paso 1): `Draft` · `Confirmed` · `InProgress` · `Completed` · `Cancelled` — mapeados desde strings V1 (sin CHECK único en `leads.status`).
7. **Zona roja:** leads / facturación / asignación DJ — discovery only; cero writers.

---

## 2. Inventario de fuentes V1

### 2.1 Hub comercial — `public.leads`

| Área | Columnas clave (reconstruidas) |
|------|--------------------------------|
| Identidad | `id`, `email`, `client_user_id`, `full_name`, `phone` |
| Evento | `event_type`, `event_date`, `event_start_time`, `event_end_time`, `location`, `budget`, `notes` |
| Pipeline | `status`, `lead_outcome`, `lead_outcome_reason`, `lead_outcome_at` |
| Asignación | `assigned_dj_id` → `dj_profiles.id`, `assigned_dj_name`, `assigned_staff_id`, `assigned_staff_name` |
| Dinero (detalle; PII/ops) | `total_amount`, `balance_paid`, `payment_status`, depósitos Stripe/Zelle, `dj_agreed_payout_usd`, … |
| Cierre | `event_completed_at`, `event_completed_by` |
| Meta | `created_at` |

**Nota:** no hay `CREATE TABLE leads` en migrations del repo — baseline preexistente; columnas vía ALTER + JS.

### 2.2 Agenda artista (JSON en `dj_profiles`)

| Campo | Rol en agenda |
|-------|----------------|
| `weekly_schedule` | Residencia / turnos semanales · `__busy_days` |
| `availability_schedule` | Bloques por fecha · recurring · vacation_* |
| `active_days` / `vacation_*` | Señal UI |
| `current_venue` / `venue_schedule` / `is_resident` | Residencia |

### 2.3 Producción — `public.mdj_event_flows`

| Campo | Notas |
|-------|--------|
| `lead_id`, `client_user_id`, `event_date`, `title`, `venue` | Timeline producción |
| `event_type` CHECK | `wedding\|quinceanera\|runway\|live_show\|custom` |
| `status` CHECK | `draft\|ready\|sent\|archived` |
| `blocks` / `meta` JSONB | No es calendario FullCalendar primario |

### 2.4 Event Builder — `public.event_builder_orders`

| Campo | Notas |
|-------|--------|
| `lead_id`, `user_id`, `event_date`, `event_name`, `lines` | Carrito → lead |
| `order_status` | `pending\|in_review\|confirmed\|cancelled` |
| `payment_status` | `unpaid\|deposit_paid\|paid_full` |

Sync documentado EBO → `leads.status`: `pending→NEW`, `in_review→MATCHED`, `confirmed→CONFIRMED`, `cancelled→CANCELLED`.

### 2.5 Legacy / paralelo (no SSOT agenda actual)

| Tabla | Uso |
|-------|-----|
| `dj_events` | Schema temprano; status `CONFIRMED\|CANCELLED\|RESIDENT` — **no** alimenta `agenda-engine.js` hoy |
| `event_notes` | Inbox ops; `event_id` polimórfico (lead **o** flow) |
| `event_show_plans` | Fashion/show blueprints |

**Ausente en V1:** tablas `bookings`, `calendar_slots`, `occurrences`, `venues` (como entidad), `gigs`.

---

## 3. DTOs V2 (contrato conceptual Paso 1)

### 3.1 `BookingSnapshotDTO` — lista / chip calendario (MOD-109 / MOD-207)

Proyección mínima de un **lead comercial** (o bridge EBO) para grids y portales.

| Campo DTO | Fuente V1 | Notas |
|-----------|-----------|-------|
| `bookingId` | `leads.id` | UUID string |
| `clientUserId` | `client_user_id` | |
| `assignedArtistProfileId` | `assigned_dj_id` | id fila `dj_profiles` |
| `assignedArtistUserId` | join `dj_profiles.user_id` | opcional enrichment |
| `assignedStaffUserId` | `assigned_staff_id` | |
| `title` | `event_type` / EBO `event_name` / flow `title` | display |
| `eventDate` | `event_date` | ISO date |
| `startTime` / `endTime` | `event_start_time` / `event_end_time` | |
| `locationLabel` | `location` | free text (no VenueId) |
| `lifecycleStatus` | map §4 desde `leads.status` | enum V2 |
| `paymentStatus` | `payment_status` | opcional en snapshot; staff/client policy |
| `mdjbClientId` / `mdjbArtistId` | enrichment profiles | opcional |
| `sourceKind` | `lead` \| `event_builder` \| `legacy_dj_event` | trazabilidad |

### 3.2 `CalendarSlotDTO` — celda / bloque agenda (MOD-206 / MOD-207)

**Virtual:** no hay tabla slots. Un slot puede originarse en lead, residencia, bloqueo o vacación.

| Campo DTO | Fuente V1 | Notas |
|-----------|-----------|-------|
| `slotId` | sintético estable (`lead:{id}` · `weekly:{dow}` · `avail:{date}:{key}`) | lab |
| `slotKind` | `booking` \| `residency` \| `availability` \| `busy` \| `vacation` \| `hold` | |
| `ownerArtistUserId` | `dj_profiles.user_id` | artista |
| `date` / `startTime` / `endTime` | schedule JSON o lead times | |
| `label` | venue / event_type / “Vacation” | |
| `lifecycleStatus` | §4 si `slotKind=booking`; else `null` | |
| `bookingId` | `leads.id` si aplica | |
| `visibility` | §5 | |

### 3.3 `EventDetailReadDTO` — ficha read-only (MOD-109 / MOD-308)

| Campo DTO | Fuente V1 | Capas |
|-----------|-----------|-------|
| Todo `BookingSnapshotDTO` | leads | base |
| `clientDisplayName` | `full_name` / client_profiles | client+staff; artist policy |
| `clientEmail` / `clientPhone` | leads / profiles | **PII** — staff/client own; no público |
| `notes` | `notes` | staff / assigned artist policy |
| `budgetLabel` | `budget` | staff / client |
| `leadOutcome` | `lead_outcome` | staff |
| `productionFlowId` | `mdj_event_flows.id` | si existe |
| `productionStatus` | flow `status` | draft/ready/sent/archived |
| `eventBuilderOrderId` | EBO `id` | opcional |
| `completedAt` | `event_completed_at` | |

**Fuera de Slice read inicial:** mutators, payouts writers, Stripe session create.

---

## 4. Mapeo de estados (lifecycle)

### 4.1 Enum V2 canónico

```text
Draft | Confirmed | InProgress | Completed | Cancelled
```

### 4.2 `leads.status` → V2 `BookingLifecycleStatus`

| V1 `leads.status` (case-insensitive) | V2 | Notas |
|--------------------------------------|-----|-------|
| `NEW` / `new` | **Draft** | Alta portal / RPC |
| `OPEN` | **Draft** | Pipeline temprano |
| `MATCHED` | **InProgress** | “En revisión” / matching — **gap semántico** (§7 G2) |
| `CONFIRMED` | **Confirmed** | Reserva contratada |
| `COMPLETED` | **Completed** | Cierre DJ/ops |
| `CANCELLED` | **Cancelled** | |
| (desconocido) | **Draft** + flag `statusUnmapped` | no inventar SQL |

### 4.3 Event Builder `order_status` → V2

| EBO | V2 |
|-----|-----|
| `pending` | Draft |
| `in_review` | InProgress |
| `confirmed` | Confirmed |
| `cancelled` | Cancelled |

### 4.4 `mdj_event_flows.status` (producción — ortogonal)

| Flow | Relación con booking lifecycle |
|------|--------------------------------|
| `draft` / `ready` / `sent` / `archived` | Campo `productionStatus` en detalle — **no** sustituye `leads.status` |

### 4.5 Slots no-booking

Residencia / vacation / busy → `lifecycleStatus: null`; UI usa `slotKind`.

---

## 5. Visibilidad por rol (read)

Alineado a RLS V1 + taxonomía Perfiles V2.

| Rol portal | Qué puede leer (objetivo V2) | Fuente V1 |
|------------|------------------------------|-----------|
| **Client** (`client.*`) | Sus bookings (`client_user_id` / email match); calendario propio MOD-113 | leads SELECT own · EBO own |
| **Artist** (`artist.*`) | Slots propios (JSON perfil) + bookings donde `assigned_dj_id` = su perfil | agenda-engine · leads assigned DJ |
| **Staff seller** | Leads pipeline (staff SELECT); **sin** writes management | `is_staff` |
| **Staff full** (owner/manager) | Leads + flows + notes ops; detalle PII | `is_staff` / `is_staff_management` |
| **Público / anon** | **No** EventDetail PII; availability pública solo vía `public_dj_profiles` residency fields | vista pública |

### 5.1 Gaps de visibilidad heredados

| Gap | Impacto |
|-----|---------|
| DJ **sin** policy SELECT dedicada en `mdj_event_flows` | Enrichment producción puede fallar en agenda V1 |
| `leads.status` sin CHECK + case `new` vs `NEW` | Mapper debe normalizar |
| `event_notes.event_id` polimórfico | No FK; detalle notes = ticket futuro |

---

## 6. Módulos V2 consumidores

| MOD | Nombre | DTO primario |
|-----|--------|--------------|
| MOD-109 | Bookings (client) | BookingSnapshotDTO · EventDetailReadDTO |
| MOD-113 | Client Calendar | CalendarSlotDTO (kind=booking) |
| MOD-206 | Availability | CalendarSlotDTO (residency/availability/vacation) |
| MOD-207 | Artist Calendar | CalendarSlotDTO + BookingSnapshotDTO |
| MOD-305 / 308 | Production / Events Ops | EventDetailReadDTO + production* |
| MOD-312 | Leads | Staff list → BookingSnapshotDTO (red-zone UI) |

---

## 7. Gaps bloqueantes / abiertos

| # | Gap | Impacto | Resolución futura (ticket) |
|---|-----|---------|------------------------------|
| G1 | Sin tabla slots/occurrences | `CalendarSlotDTO.slotId` sintético | Producto: ¿persistir slots o mantener virtual? |
| G2 | `MATCHED` ≠ “evento en curso” | InProgress ambiguo | Regla: MATCHED=pipeline **o** InProgress solo si `event_date=today` + CONFIRMED |
| G3 | Dual modelo `dj_events` legacy | Confusión SSOT | Declarar **deprecated** para V2 read model |
| G4 | Venue free-text | No `VenueId` | DWL VenueId futuro ≠ location string |
| G5 | CREATE leads ausente en migrations | Inventario incompleto | Introspección DB / seed doc |
| G6 | Payment vs lifecycle | Snapshot no debe mezclar cobro con Draft/Confirmed sin policy | Campo `paymentStatus` separado |
| G7 | Weather / Finanzas | Ortogonales | **No** acoplar en Paso 1 |

---

## 8. Fuera de alcance (ciclo lectura)

- Writers (create/update/cancel booking · payments · assign)
- SQL / RLS / RPC nuevas
- UI FullCalendar productiva en lab (V1 `agenda-engine.js` intacto)
- Weather Engine · Centro Financiero · reabrir Perfiles sellados
- Commit / push / deploy

Detalle de cierre: [BOOKINGS-CYCLE-CLOSURE.md](./BOOKINGS-CYCLE-CLOSURE.md).

---

## 9. Hoja de ruta ciclo lectura (cerrada)

| Paso | Entregable | Estado |
|------|------------|--------|
| 1 | Discovery matrix + types DTO | ✅ (este documento) |
| 2 | `shared/services/bookings/` read-only + Vitest | ✅ |
| 3 | MOD-301 Staff Master Calendar UI | ✅ `staff/calendar/` |
| 4 | MOD-204 Artist Schedule UI | ✅ `artist/schedule/` |
| 5 | MOD-103 Client Bookings UI | ✅ `client/bookings/` |
| 6 | Documentación cierre | ✅ [BOOKINGS-CYCLE-CLOSURE.md](./BOOKINGS-CYCLE-CLOSURE.md) |

**Post-ciclo** (writers, slots persistidos, wiring auth productivo): requiere ticket + OK PO — ver cierre §7.

---

## 10. Referencias

| Recurso | Ruta |
|---------|------|
| Types | `MiamiDJBeat-MigracionV2/shared/types/bookings.types.ts` |
| Spec servicio | `MiamiDJBeat-MigracionV2/shared/services/bookings/BOOKINGS-SPEC.md` |
| **Cierre ciclo** | `docs/V2/BOOKINGS-CYCLE-CLOSURE.md` |
| Perfiles cierre | `docs/V2/PROFILES-CYCLE-CLOSURE.md` |
| Catálogo MOD | `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` |
| Agenda V1 | `web/js/agenda-engine.js` (no modificar) |
| Leads RLS | `supabase/migrations/20260415160000_leads_rls_client_dj_segmentation.sql` |

---

*Agenda V2 — matriz discovery + cierre ciclo lectura Pasos 1–6 — 2026-08-11 — documentation only — no commit*
