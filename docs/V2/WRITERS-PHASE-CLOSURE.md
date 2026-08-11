# WRITERS PHASE V2 — Cycle Closure (Slices 1–3 · Mutaciones Lab)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/WRITERS-PHASE-CLOSURE.md` |
| **Fase** | Writers Phase V2 — **cierre documental** (Slices 1 Client · 2 Artist · 3 Staff) |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Tipo** | Auditoría documental — **sin SQL** · **sin commit** · **sin deploy** · **sin writers productivos Supabase** |
| **Prerrequisitos** | Read Models sellados (Perfiles · Agenda · Finanzas · Weather) · [SESSION-AUTH-WIRING-CLOSURE.md](./SESSION-AUTH-WIRING-CLOSURE.md) |
| **Matrices** | [CLIENT-MUTATIONS-MATRIX.md](./CLIENT-MUTATIONS-MATRIX.md) · [ARTIST-MUTATIONS-MATRIX.md](./ARTIST-MUTATIONS-MATRIX.md) · [STAFF-MUTATIONS-MATRIX.md](./STAFF-MUTATIONS-MATRIX.md) |
| **Suite mutaciones dedicada (Vitest)** | **58/58 PASS** (6 files — service + UI × 3 slices) |
| **Typecheck** | `tsc --noEmit` exit 0 (lab) |
| **Portales** | `/client/` · `/artist/` · `/staff/` → HTTP **200** · mutation slices montados |
| **Rama local** | `plan/v2-artist-agenda-matrix` — artefactos `M` / `??` — **sin commit** |

> **Nota de conteo:** el ticket de cierre PO citaba **67/67** como superficie combinada de mutación + cableado. El recuento **exclusivo** de specs `*mutations*` en lab es **58/58**. La diferencia corresponde a asserts de slot/dashboard/wiring colaterales (no archivos `*-mutations*.spec.ts`).

---

## 1. Veredicto

La **Fase de Escritura V2 (Writers Phase)** queda **cerrada en laboratorio** para los tres portales: contratos → adapters lab + store de idempotencia compartido → UI forms aisladas.

| Criterio | Estado |
|----------|--------|
| Slice 1 Client (Pasos 1–3) | ✅ Sellado |
| Slice 2 Artist (Pasos 1–3) | ✅ Sellado |
| Slice 3 Staff (Pasos 1–3) | ✅ Sellado |
| Store idempotencia unificado | ✅ `lab-idempotency.store.ts` (actorUserId scope) |
| UI `/client/` · `/artist/` · `/staff/` | ✅ Montada · lab only |
| Documentación + índices (este cierre) | ✅ |
| `supabase.from().insert\|update` productivo | ❌ Prohibido / no implementado |
| Edge Auth writers · password · login forms | ❌ Fuera de alcance |
| V1 `web/` · `supabase/` · OFTL `finance/` | ✅ **Intactos** |
| Read Models sellados | ✅ **Intactos** (no mutados) |
| Commit / push / deploy | ❌ No |

---

## 2. Modelo de mutación unificado

```text
SessionContextDTO (rol · userId · expiry)
        │
        ├─ assert*MutationAuthorized (puro)
        ├─ validate*DTO → { ok:true, dto } | { ok:false, VALIDATION_ERROR }
        ├─ domain gates (assignment / existence)
        │
        └─ *MutationsAdapter
              │
              ├─ fingerprint(dto)
              ├─ lab-idempotency.store
              │     scope = (actorUserId, mutationKind, idempotencyKey)
              │     same payload → SUCCESS replayed:true
              │     different payload → IDEMPOTENCY_CONFLICT
              │
              └─ Map lab records (status_*_lab) — in-memory only
```

### 2.1 Idempotencia lab (compartida)

| Pieza | Ruta |
|-------|------|
| Store | `MiamiDJBeat-MigracionV2/shared/services/client-mutations/lab-idempotency.store.ts` |
| Scope key | `` `${actorUserId}::${mutationKind}::${idempotencyKey}` `` |
| Consumers | Client · Artist · Staff adapters (re-export en barrels) |
| Kinds union | `ClientMutationKind \| ArtistMutationKind \| StaffMutationKind` |

**Reglas:** key 8–64 · `[A-Za-z0-9_-]+` · primera aceptación `replayed: false` · replay same fingerprint `replayed: true` · fingerprint distinto → `IDEMPOTENCY_CONFLICT`.

### 2.2 Discriminante `ok` (contratos)

| Validación | Forma |
|------------|--------|
| Fail | `{ ok: false, status: 'VALIDATION_ERROR', issues[] }` |
| Pass | `{ ok: true, dto }` |
| Auth / domain gates | Status discriminants (`UNAUTHORIZED_ROLE`, `GIG_NOT_ASSIGNED`, `PAYMENT_NOT_FOUND`, …) · success `{ ok: true }` |

Adapters usan `if (!validated.ok)` (no `'ok' in validated`).

### 2.3 Mutaciones por slice

| Slice | Portal | DTOs | Adapter métodos | Lab statuses |
|-------|--------|------|-----------------|--------------|
| **1 Client** | `/client/` | `CreateBookingRequestDTO` · `SubmitOfflinePaymentProofDTO` | `submitBookingRequest` · `submitOfflinePaymentProof` | `accepted_lab` |
| **2 Artist** | `/artist/` | `RespondGigAssignmentDTO` · `AcknowledgePayoutDTO` | `respondGigAssignment` · `acknowledgePayout` | `accepted_lab` · `declined_lab` · `acknowledged_lab` |
| **3 Staff** | `/staff/` | `ReviewOfflinePaymentDTO` · `AssignArtistToBookingDTO` | `reviewOfflinePayment` · `assignArtistToBooking` | `approved_lab` · `rejected_lab` · `assigned_lab` |

### 2.4 Role / scope gates

| Slice | Roles | Scope / existencia |
|-------|-------|--------------------|
| Client | `client` | `clientUserId` == session `userId` |
| Artist | `artist` | `assigned_dj_id` == session `userId` · `GIG_NOT_ASSIGNED` |
| Staff | `staff` \| `staff_seller` | `PAYMENT_NOT_FOUND` · `BOOKING_NOT_FOUND` (registry lab) |

---

## 3. Integración UI (tres portales)

| Portal | Slot dashboard | Package UI | Feedback |
|--------|----------------|------------|----------|
| **Client** | `data-mdj-client-section="client-mutations"` | `client/mutations/` | `labRecordId` · validation errors · disable-on-submit |
| **Artist** | `data-mdj-artist-section="artist-mutations"` | `artist/mutations/` | `accepted_lab` / `declined_lab` / `acknowledged_lab` |
| **Staff** | `data-mdj-staff-section="staff-mutations"` | `staff/mutations/` | `approved_lab` / `rejected_lab` / `assigned_lab` |

**Contrato UI común:** adapter lab only · auto `idempotencyKey` · botones disabled durante submit · gate de sesión (slice `--gated` si rol inválido) · **cero** `fetch` / Supabase.

**Wire:** `*/main.ts` crea `create*MutationsAdapter()` · `render-*-dashboard-mvp.ts` reserva slot · `mount-*-mutations-slice.ts` hidrata.

---

## 4. Cobertura de pruebas

### 4.1 Suite dedicada mutaciones (**58/58**)

| File | Tests | Cubre |
|------|------:|-------|
| `client-mutations.service.spec.ts` | 11 | Adapter client · auth · idempotencia · validation |
| `client-mutations-ui.spec.ts` | 9 | DOM forms · duplicate submit · mount gate |
| `artist-mutations.service.spec.ts` | 10 | ACCEPT/DECLINE · `GIG_NOT_ASSIGNED` · idempotencia |
| `artist-mutations-ui.spec.ts` | 9 | Accept/Decline UI · decline notes · mount gate |
| `staff-mutations.service.spec.ts` | 10 | APPROVE/REJECT · assign · not-found · seller role |
| `staff-mutations-ui.spec.ts` | 9 | Approve/Reject UI · assign · mount gate |
| **Total** | **58** | |

### 4.2 Artefactos de servicio (referencia)

| Package | SPEC |
|---------|------|
| `shared/services/client-mutations/` | `CLIENT-MUTATIONS-SPEC.md` |
| `shared/services/artist-mutations/` | `ARTIST-MUTATIONS-SPEC.md` |
| `shared/services/staff-mutations/` | `STAFF-MUTATIONS-SPEC.md` |
| Types | `shared/types/{client,artist,staff}.mutations.types.ts` · barrel `shared/types/index.ts` |

### 4.3 HTTP lab (smoke)

| URL | Esperado |
|-----|----------|
| `http://localhost:5173/client/` | 200 |
| `http://localhost:5173/artist/` | 200 |
| `http://localhost:5173/staff/` | 200 |

---

## 5. Fuera de alcance (post-ciclo / requiere ticket + OK PO)

- Persistencia productiva (`supabase.from().insert|update`)
- Edge Functions de mutación · webhooks Stripe charge
- Login / register / password / JWT verify writers
- RLS / SQL migrations
- Commit · push · merge · deploy producción
- Reabrir Read Models sellados

---

## 6. Mapa documental

| Documento | Rol |
|-----------|-----|
| Este cierre | Auditoría Writers Phase |
| `CLIENT-MUTATIONS-MATRIX.md` | Slice 1 contratos |
| `ARTIST-MUTATIONS-MATRIX.md` | Slice 2 contratos |
| `STAFF-MUTATIONS-MATRIX.md` | Slice 3 contratos |
| `SESSION-AUTH-WIRING-CLOSURE.md` | Prerrequisito session pilots |
| `docs/V2/README.md` | Continuidad lab |
| `docs/MASTER-DOCUMENTATION-INDEX.md` | Índice maestro |

---

## 7. Checklist de sellado PO

| Ítem | Estado |
|------|--------|
| Tres slices Pasos 1–3 sellados en Continuidad README | ✅ |
| Store compartido documentado | ✅ |
| UI tres portales documentada | ✅ |
| Vitest mutaciones 58/58 | ✅ |
| `tsc --noEmit` OK | ✅ |
| Sin commit / deploy en este cierre | ✅ |
| Reporte de Arquitectura listo para presentación PO | ✅ |

---

*Writers Phase V2 — closure — 2026-08-11 — documentation only — no commit — branch `plan/v2-artist-agenda-matrix`*
