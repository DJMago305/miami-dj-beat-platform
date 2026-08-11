# STAFF MUTATIONS V2 — Mapping Matrix (Writers Phase · Slice 3 · Paso 1)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/STAFF-MUTATIONS-MATRIX.md` |
| **Fase** | Writers Phase V2 — **Slice 3 (Staff) · Paso 1** (contratos) |
| **Estado** | 🟡 **Contratos tipados** — sin adapter persistente · sin Supabase writers |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Types lab** | `MiamiDJBeat-MigracionV2/shared/types/staff.mutations.types.ts` |
| **Tipo** | Contratos + validadores puros — **cero** `supabase.from().insert/update` · **cero** commit/deploy |
| **Prerrequisitos** | 5 Dominios Read Model sellados · Session Wiring · **Slice 1 Client** + **Slice 2 Artist** sellados |
| **Aislamiento** | No tocar V1 `web/` · `supabase/` · OFTL · Read Models · Client/Artist writers |

---

## 0. Alcance de este paso

| Incluido | Excluido |
|----------|----------|
| DTOs de mutación staff | Persistencia Supabase / Edge |
| Validadores puros (sanitize · redact · payload limits) | UI forms en `/staff/` |
| Matriz de estados `SUCCESS` · `VALIDATION_ERROR` · `UNAUTHORIZED_ROLE` · `PAYMENT_NOT_FOUND` · `BOOKING_NOT_FOUND` | Invoice writers productivos · RLS |
| Gating rol `staff` \| `staff_seller` | Mutaciones client/artist |
| Idempotency key contract | Commit / push / deploy |

**Root de writers futuros:** adapters lab en Pasos 2+ — **no** en Paso 1.

---

## 1. Principios de escritura controlada

1. **Contracts before adapters.** Ningún `insert`/`update` productivo hasta OK PO del Paso 2+.
2. **Staff role gate.** Solo `sessionRole === 'staff'` o `'staff_seller'` (Session Wiring). Seller limitado puede operar estas mutaciones en lab; product rules futuras pueden estrechar.
3. **Idempotencia obligatoria.** Toda mutación lleva `idempotencyKey` (8–64 chars, `[A-Za-z0-9_-]+`). Replay → `SUCCESS` + `replayed: true` (store futuro).
4. **PII never logged raw.** Usar proyecciones `*RedactedDTO` / `maskStaffMutationUserId`.
5. **Payload limits.** Tope `maxPayloadChars = 8192` + límites por campo (`STAFF_MUTATION_PAYLOAD_LIMITS`).
6. **REJECT requiere razón.** `ReviewOfflinePaymentDTO` con `decision: 'REJECT'` exige `rejectionReason` no vacío.
7. **Not-found es status propio.** Targets ausentes → `PAYMENT_NOT_FOUND` / `BOOKING_NOT_FOUND` (no silent SUCCESS). Emitidos por gates puros + adapter Paso 2+.
8. **Read models intactos.** Receipts / bookings siguen read-only; writers no los mutan en este paso.

---

## 2. Mutaciones registradas

### 2.1 `ReviewOfflinePaymentDTO` (`review_offline_payment`)

Aprobación o rechazo de un comprobante de pago offline (Zelle/Cash/…).

| Campo | Tipo | Reglas |
|-------|------|--------|
| `mutationKind` | literal | `'review_offline_payment'` |
| `staffUserId` | string | Required · session staff `userId` |
| `idempotencyKey` | string | Required · 8–64 · pattern |
| `paymentId` | string | Required · target proof / receipt id |
| `decision` | enum | `'APPROVE'` \| `'REJECT'` |
| `rejectionReason` | string \| null | Required (non-empty) when `REJECT` · ≤500 · sanitized · null on `APPROVE` |
| `reviewNotes` | string \| null | Optional · ≤500 · sanitized |

**Validador:** `validateReviewOfflinePayment(input)` → `{ ok: true, dto }` \| `{ ok: false, status: 'VALIDATION_ERROR', … }`  
**Redacción:** `redactReviewOfflinePayment(dto)`  
**Existence (puro):** `assertOfflinePaymentFound({ paymentId, found })` → `{ ok: true }` \| `PAYMENT_NOT_FOUND`

### 2.2 `AssignArtistToBookingDTO` (`assign_artist_to_booking`)

Asignación / reasignación de DJ a un booking / evento.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `mutationKind` | literal | `'assign_artist_to_booking'` |
| `staffUserId` | string | Required · session staff `userId` |
| `idempotencyKey` | string | Required · 8–64 · pattern |
| `bookingId` | string | Required · target booking / lead id |
| `artistUserId` | string | Required · DJ to assign (`assigned_dj_id`) |
| `notes` | string \| null | Optional · ≤500 · sanitized |
| `replaceExisting` | boolean | Optional · default `true` (lab: reassignment allowed) |

**Validador:** `validateAssignArtistToBooking(input)` → `{ ok: true, dto }` \| `{ ok: false, status: 'VALIDATION_ERROR', … }`  
**Redacción:** `redactAssignArtistToBooking(dto)`  
**Existence (puro):** `assertBookingFound({ bookingId, found })` → `{ ok: true }` \| `BOOKING_NOT_FOUND`

---

## 3. Validaciones transversales

### 3.1 Input sanitization

| Función | Comportamiento |
|---------|----------------|
| `sanitizeStaffMutationText` | trim · collapse whitespace · strip control chars |
| Field max lengths | Ver `STAFF_MUTATION_PAYLOAD_LIMITS` |
| Payload size | `JSON.stringify` length ≤ 8192 |

### 3.2 Id redaction

| Señal | Redacción |
|-------|-----------|
| `staffUserId` / `artistUserId` | `maskStaffMutationUserId` → `0000…0001` |
| `rejectionReason` / `reviewNotes` / `notes` | Solo flags `has*` en DTO redactado |

### 3.3 Role gate (puro)

`assertStaffMutationAuthorized({ sessionRole, staffUserId, isAnonymous, isExpired })`

| Condición | Resultado |
|-----------|-----------|
| `sessionRole` ∉ `{ staff, staff_seller }` | `UNAUTHORIZED_ROLE` · `role_not_staff` |
| anonymous / missing staffUserId | `UNAUTHORIZED_ROLE` · `anonymous` / `missing_staff_scope` |
| expired | `UNAUTHORIZED_ROLE` · `expired` |
| staff ready | `{ ok: true }` |

### 3.4 Target existence gates (puro — adapter injects `found`)

| Gate | Fail status | Reasons |
|------|-------------|---------|
| `assertOfflinePaymentFound` | `PAYMENT_NOT_FOUND` | `missing_payment_id` · `payment_absent` |
| `assertBookingFound` | `BOOKING_NOT_FOUND` | `missing_booking_id` · `booking_absent` |

---

## 4. Estados de respuesta

```text
StaffMutationResult
  ├─ SUCCESS              → acceptedAt · idempotencyKey · replayed · labRecordId
  ├─ VALIDATION_ERROR     → ok:false · issues[] (field · code · message)
  ├─ UNAUTHORIZED_ROLE    → reason (role_not_staff · anonymous · expired · missing_staff_scope)
  ├─ PAYMENT_NOT_FOUND    → paymentId · reason
  ├─ BOOKING_NOT_FOUND    → bookingId · reason
  └─ IDEMPOTENCY_CONFLICT → existingLabRecordId (adapter Paso 2+)
```

| Status | Cuándo |
|--------|--------|
| **SUCCESS** | Validación OK (+ futura persistencia idempotente) · `toStaffMutationSuccessResult` |
| **VALIDATION_ERROR** | Campos inválidos · payload too large · REJECT sin razón |
| **UNAUTHORIZED_ROLE** | Rol ≠ staff/staff_seller · anónimo/expirado · sin scope |
| **PAYMENT_NOT_FOUND** | Proof/receipt id ausente en lab/fixture |
| **BOOKING_NOT_FOUND** | Booking id ausente en lab/fixture |
| **IDEMPOTENCY_CONFLICT** | Tipado para Paso 2+ (mismo key, payload distinto) |

**Issue codes:** `required` · `too_long` · `too_short` · `invalid_format` · `out_of_range` · `payload_too_large` · `forbidden_role` · `scope_mismatch` · `invalid_decision` · `reject_reason_required`

**Discriminante `ok` (Paso 1):**

| Resultado | Forma |
|-----------|--------|
| Validation fail | `{ ok: false, status: 'VALIDATION_ERROR', … }` |
| Validation pass | `{ ok: true, dto }` |
| Auth / not-found gates | status discriminants · success gate `{ ok: true }` |

---

## 5. Idempotencia (contrato)

| Regla | Detalle |
|-------|---------|
| Key required | Toda mutación |
| Uniqueness scope (futuro) | `(staffUserId, mutationKind, idempotencyKey)` |
| First accept | Persist + `SUCCESS` · `replayed: false` |
| Duplicate key same payload | `SUCCESS` · `replayed: true` (Paso 2+ store) |
| Duplicate key different payload | `IDEMPOTENCY_CONFLICT` (Paso 2+) |

Paso 1 **no** implementa store; solo tipa `replayed` en `StaffMutationSuccessResult`.

---

## 6. Mapa a Read Models (referencia — no mutar)

| Writer DTO | Read model relacionado | Notas |
|------------|------------------------|-------|
| ReviewOfflinePayment | `PaymentReceiptReadDTO` · `TransactionHistoryDTO` | Futuro: Pending → Verified / Rejected |
| AssignArtistToBooking | `BookingSnapshotDTO` · calendar | Futuro: `assigned_dj_id` update |

---

## 7. Fuera de alcance (Paso 1)

- `supabase.from(…).insert` / `.update` productivos
- Edge Functions / RLS changes
- UI forms en `staff/` portal
- Client Slice 1 / Artist Slice 2 writers
- Commit / push / deploy

---

## 8. Siguiente paso (requiere OK PO)

| Paso | Estado |
|------|--------|
| **Slice 3 · Paso 1** | ✅ Contratos + validadores puros |
| **Slice 3 · Paso 2** | ✅ Lab adapter + shared idempotency store — `shared/services/staff-mutations/` |
| **Slice 3 · Paso 3** | ✅ UI `/staff/` wire — `staff/mutations/` |

---

## 9. Referencias

| Recurso | Ruta |
|---------|------|
| Types | `MiamiDJBeat-MigracionV2/shared/types/staff.mutations.types.ts` |
| Barrel | `MiamiDJBeat-MigracionV2/shared/types/index.ts` |
| Client Slice 1 | `docs/V2/CLIENT-MUTATIONS-MATRIX.md` |
| Artist Slice 2 | `docs/V2/ARTIST-MUTATIONS-MATRIX.md` |
| Session wiring | `docs/V2/SESSION-AUTH-WIRING-CLOSURE.md` |
| Financial read | `docs/V2/FINANCIAL-CYCLE-CLOSURE.md` |
| Bookings read | `docs/V2/BOOKINGS-CYCLE-CLOSURE.md` |

---

*Writers Phase · Slice 3 · Paso 1 — Staff mutation contracts — 2026-08-11 — documentation + types only — no commit*
