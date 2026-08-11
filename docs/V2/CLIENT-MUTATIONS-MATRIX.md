# CLIENT MUTATIONS V2 — Mapping Matrix (Writers Phase · Slice 1 · Paso 1)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/CLIENT-MUTATIONS-MATRIX.md` |
| **Fase** | Writers Phase V2 — **Slice 1 (Client) · Paso 1** (contratos) |
| **Estado** | 🟡 **Contratos tipados** — sin adapter persistente · sin Supabase writers |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Types lab** | `MiamiDJBeat-MigracionV2/shared/types/client.mutations.types.ts` |
| **Tipo** | Contratos + validadores puros — **cero** `supabase.from().insert/update` · **cero** commit/deploy |
| **Prerrequisitos** | 5 Dominios Read Model sellados · Session & Auth Wiring [SESSION-AUTH-WIRING-CLOSURE.md](./SESSION-AUTH-WIRING-CLOSURE.md) |
| **Aislamiento** | No tocar V1 `web/` · `supabase/` · OFTL · Read Models sellados · Artist/Staff writers (otros slices) |

---

## 0. Alcance de este paso

| Incluido | Excluido |
|----------|----------|
| DTOs de mutación client | Persistencia Supabase / Edge |
| Validadores puros (sanitize · PII redact · payload limits) | UI forms productivos en `/client/` |
| Matriz de estados `SUCCESS` · `VALIDATION_ERROR` · `UNAUTHORIZED_ROLE` | Stripe / card capture writers |
| Idempotency key contract | Mutaciones artist/staff |
| Barrel export `shared/types` | Commit / push / deploy |

**Root de writers futuros:** adapters lab en pasos posteriores — **no** en Paso 1.

---

## 1. Principios de escritura controlada

1. **Contracts before adapters.** Ningún `insert`/`update` productivo hasta OK PO del Paso 2+.
2. **Session scope manda.** `clientUserId` del payload debe coincidir con `SessionContextDTO.userId` (rol `client`) cuando exista adapter; contrato ya exige `clientUserId`.
3. **Idempotencia obligatoria.** Toda mutación lleva `idempotencyKey` (8–64 chars, `[A-Za-z0-9_-]+`). Replay → `SUCCESS` + `replayed: true` (store futuro).
4. **PII never logged raw.** Usar proyecciones `*RedactedDTO` / `maskEmailForLog` / `maskPhoneForLog`.
5. **Payload limits.** Tope `maxPayloadChars = 8192` + límites por campo (`CLIENT_MUTATION_PAYLOAD_LIMITS`).
6. **Offline payment ≠ card writer.** `SubmitOfflinePaymentProofDTO` acepta Zelle/Cash/BankTransfer/Check/Other — **no** `StripeCard` en Slice 1.
7. **Read models intactos.** `BookingSnapshotDTO` / `PaymentReceiptReadDTO` siguen read-only; writers no los mutan en este paso.

---

## 2. Mutaciones registradas

### 2.1 `CreateBookingRequestDTO` (`create_booking_request`)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `mutationKind` | literal | `'create_booking_request'` |
| `clientUserId` | string | Required · scope session |
| `idempotencyKey` | string | Required · 8–64 · pattern |
| `title` | string | Required · ≤120 · sanitized |
| `eventDate` | string | Required · `YYYY-MM-DD` |
| `startTime` / `endTime` | string \| null | Optional · `HH:MM` |
| `locationLabel` | string \| null | ≤200 |
| `notes` | string \| null | ≤1000 · newlines allowed (sanitized) |
| `preferredArtistProfileId` | string \| null | Optional opaque id |
| `contactName` | string \| null | ≤80 |
| `contactEmail` | string \| null | ≤120 · loose email |
| `contactPhone` | string \| null | ≤32 |

**Validador:** `validateCreateBookingRequest(input)`  
**Redacción:** `redactCreateBookingRequest(dto)`

### 2.2 `SubmitOfflinePaymentProofDTO` (`submit_offline_payment_proof`)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `mutationKind` | literal | `'submit_offline_payment_proof'` |
| `clientUserId` | string | Required · scope session |
| `idempotencyKey` | string | Required · 8–64 · pattern |
| `bookingId` | string | Required · target booking/lead |
| `amountMinorUnits` | number | int · 1 … 5_000_000 ($50k) |
| `currencyCode` | `'USD'` | Solo USD en Slice 1 |
| `paymentMethod` | enum offline | Zelle · Cash · BankTransfer · Check · Other |
| `proofReference` | string \| null | ≤120 · sanitized (no log raw) |
| `proofNotes` | string \| null | ≤500 |
| `paidAt` | string \| null | ISO / `YYYY-MM-DD` |

**Validador:** `validateSubmitOfflinePaymentProof(input)`  
**Redacción:** `redactSubmitOfflinePaymentProof(dto)`

---

## 3. Validaciones transversales

### 3.1 Input sanitization

| Función | Comportamiento |
|---------|----------------|
| `sanitizeClientMutationText` | trim · collapse whitespace · strip control chars |
| Field max lengths | Ver `CLIENT_MUTATION_PAYLOAD_LIMITS` |
| Payload size | `JSON.stringify` length ≤ 8192 |

### 3.2 PII redaction

| Señal | Redacción |
|-------|-----------|
| `clientUserId` | `maskClientMutationUserId` → `0000…0001` |
| `contactEmail` | `maskEmailForLog` → `ab***@domain` |
| `contactPhone` | `maskPhoneForLog` → `***1234` |
| `proofReference` / notes | Solo flags `has*` en DTO redactado |

### 3.3 Role / scope gate (puro)

`assertClientMutationAuthorized({ sessionRole, clientUserId, isAnonymous, isExpired })`

| Condición | Resultado |
|-----------|-----------|
| `sessionRole !== 'client'` | `UNAUTHORIZED_ROLE` · `role_not_client` |
| anonymous / missing clientUserId | `UNAUTHORIZED_ROLE` · `anonymous` / `missing_client_scope` |
| expired | `UNAUTHORIZED_ROLE` · `expired` |
| client ready | `{ ok: true }` |

---

## 4. Estados de respuesta

```text
ClientMutationResult
  ├─ SUCCESS              → acceptedAt · idempotencyKey · replayed
  ├─ VALIDATION_ERROR     → issues[] (field · code · message)
  └─ UNAUTHORIZED_ROLE    → reason (role_not_client · anonymous · expired · missing_client_scope)
```

| Status | Cuándo |
|--------|--------|
| **SUCCESS** | Validación OK (+ futura persistencia idempotente) · `toClientMutationSuccessResult` |
| **VALIDATION_ERROR** | Campos inválidos · payload too large · método no offline |
| **UNAUTHORIZED_ROLE** | Rol ≠ client · sesión anónima/expirada · sin scope |

**Issue codes:** `required` · `too_long` · `too_short` · `invalid_format` · `out_of_range` · `payload_too_large` · `forbidden_role` · `scope_mismatch` · `unsupported_method`

---

## 5. Idempotencia (contrato)

| Regla | Detalle |
|-------|---------|
| Key required | Toda mutación |
| Uniqueness scope (futuro) | `(clientUserId, mutationKind, idempotencyKey)` |
| First accept | Persist + `SUCCESS` · `replayed: false` |
| Duplicate key same payload | `SUCCESS` · `replayed: true` (Paso 2+ store) |
| Duplicate key different payload | Adapter futuro → conflict (fuera Paso 1) |

Paso 1 **no** implementa store; solo tipa `replayed` en `ClientMutationSuccessResult`.

---

## 6. Mapa a Read Models (referencia — no mutar)

| Writer DTO | Read model relacionado | Notas |
|------------|------------------------|-------|
| CreateBookingRequest | `BookingSnapshotDTO` | Futuro: draft lead / request row |
| SubmitOfflinePaymentProof | `PaymentReceiptReadDTO` · `TransactionHistoryDTO` | Futuro: receipt Pending → Verified por staff |

---

## 7. Fuera de alcance (Paso 1)

- `supabase.from('leads').insert` / payment tables update
- Edge Functions / RLS changes
- UI forms en `client/` portal
- Stripe Checkout / Connect
- Artist payout writers · Staff invoice writers
- Commit / push / deploy

---

## 8. Siguiente paso (requiere OK PO)

| Paso | Estado |
|------|--------|
| **Slice 1 · Paso 1** | ✅ Contratos + validadores puros |
| **Slice 1 · Paso 2** | ✅ Lab adapter + idempotency store — `shared/services/client-mutations/` · Vitest `client-mutations.service.spec.ts` |
| **Slice 1 · Paso 3 (propuesto)** | UI `/client/` wire — **sin** Supabase productivo salvo ticket |

---

## 9. Referencias

| Recurso | Ruta |
|---------|------|
| Types | `MiamiDJBeat-MigracionV2/shared/types/client.mutations.types.ts` |
| Barrel | `MiamiDJBeat-MigracionV2/shared/types/index.ts` |
| Session wiring | `docs/V2/SESSION-AUTH-WIRING-CLOSURE.md` |
| Bookings read | `docs/V2/BOOKINGS-CYCLE-CLOSURE.md` |
| Financial read | `docs/V2/FINANCIAL-CYCLE-CLOSURE.md` |

---

*Writers Phase · Slice 1 · Paso 1 — Client mutation contracts — 2026-08-11 — documentation + types only — no commit*
