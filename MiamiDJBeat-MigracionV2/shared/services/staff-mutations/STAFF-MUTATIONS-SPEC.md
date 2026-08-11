# Staff Mutations Domain — SPEC (Writers Phase · Slice 3 · Paso 2)

| Campo | Valor |
|-------|--------|
| **Módulo** | `shared/services/staff-mutations` |
| **Matriz** | `docs/V2/STAFF-MUTATIONS-MATRIX.md` |
| **Types** | `shared/types/staff.mutations.types.ts` |
| **Estado** | Lab adapter + shared idempotency store + mappers — **sin Supabase prod** · **sin commit** |
| **Lab** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Prerrequisitos** | Staff Mutations Paso 1 · Session Wiring · Client/Artist stores compartidos |

## Métodos públicos (adapter)

| Método | Rol |
|--------|-----|
| `reviewOfflinePayment({ payload, session, paymentExists? })` | APPROVE/REJECT proof · gate staff/seller · idempotencia · lab record |
| `assignArtistToBooking({ payload, session, bookingExists? })` | Asigna DJ · `BOOKING_NOT_FOUND` si ausente |
| `seedLabPayment` / `seedLabBooking` | Registra ids en registry lab (cuando `known*Ids` configurado) |
| `getLabRecord(id)` / `listLabRecords()` | Lectura del store lab simulado |
| `getIdempotencyStore()` | Acceso al store de idempotencia (tests) |
| `clearLabState()` | Reset lab (tests) |

**Prohibido:** `supabase.from().insert|update` · Edge Auth writers · mutar Read Models sellados · Client/Artist UI.

## Persistencia lab

| Pieza | Archivo | Notas |
|-------|---------|-------|
| Idempotency | `../client-mutations/lab-idempotency.store.ts` | Scope `(actorUserId, mutationKind, idempotencyKey)` — **compartido** |
| Records | Map interno del adapter | `approved_lab` · `rejected_lab` · `assigned_lab` — **no** Postgres |
| Existence | `knownPaymentIds` / `knownBookingIds` + overrides | `PAYMENT_NOT_FOUND` / `BOOKING_NOT_FOUND` |
| Fingerprints | `staff-mutations.map-rows.ts` | Conflict → `IDEMPOTENCY_CONFLICT` |

## Resultados

| Status | Cuándo |
|--------|--------|
| `SUCCESS` | Primera aceptación o replay same payload (`replayed: true`) |
| `VALIDATION_ERROR` | Validadores Paso 1 / scope mismatch / REJECT sin razón |
| `UNAUTHORIZED_ROLE` | Rol ≠ staff/staff_seller · anonymous · expired |
| `PAYMENT_NOT_FOUND` | Payment id ausente en registry / override |
| `BOOKING_NOT_FOUND` | Booking id ausente en registry / override |
| `IDEMPOTENCY_CONFLICT` | Misma key · fingerprint distinto |

## Tests

`tests/unit/staff-mutations.service.spec.ts`

## Siguiente paso (requiere OK PO)

Paso 3 — UI `/staff/` wire — **aún sin** Supabase productivo salvo ticket explícito.
