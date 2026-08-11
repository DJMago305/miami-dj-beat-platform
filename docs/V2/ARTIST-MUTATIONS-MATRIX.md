# ARTIST MUTATIONS V2 — Mapping Matrix (Writers Phase · Slice 2 · Paso 1)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/ARTIST-MUTATIONS-MATRIX.md` |
| **Fase** | Writers Phase V2 — **Slice 2 (Artist) · Paso 1** (contratos) |
| **Estado** | 🟡 **Contratos tipados** — sin adapter persistente · sin Supabase writers |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Types lab** | `MiamiDJBeat-MigracionV2/shared/types/artist.mutations.types.ts` |
| **Tipo** | Contratos + validadores puros — **cero** `supabase.from().insert/update` · **cero** commit/deploy |
| **Prerrequisitos** | 5 Dominios Read Model sellados · Session Wiring · **Slice 1 Client** sellado (Pasos 1–3) |
| **Aislamiento** | No tocar V1 `web/` · `supabase/` · OFTL · Read Models · Client Slice 1 · Staff writers |

---

## 0. Alcance de este paso

| Incluido | Excluido |
|----------|----------|
| DTOs de mutación artist | Persistencia Supabase / Edge |
| Validadores puros (sanitize · redact · payload limits) | UI forms en `/artist/` |
| Matriz de estados `SUCCESS` · `VALIDATION_ERROR` · `UNAUTHORIZED_ROLE` · `GIG_NOT_ASSIGNED` | Payout ledger writers productivos |
| Scope `assigned_dj_id` == session `userId` | Mutaciones client/staff |
| Idempotency key contract | Commit / push / deploy |

**Root de writers futuros:** adapters lab en Pasos 2+ — **no** en Paso 1.

---

## 1. Principios de escritura controlada

1. **Contracts before adapters.** Ningún `insert`/`update` productivo hasta OK PO del Paso 2+.
2. **Assignment scope manda.** `assignedDjId` del payload (y del gig en adapter) debe coincidir con `SessionContextDTO.userId` (rol `artist`). Mismatch → `GIG_NOT_ASSIGNED` (no filtrar filas ajenas como éxito).
3. **Idempotencia obligatoria.** Toda mutación lleva `idempotencyKey` (8–64 chars, `[A-Za-z0-9_-]+`). Replay → `SUCCESS` + `replayed: true` (store futuro).
4. **PII never logged raw.** Usar proyecciones `*RedactedDTO` / `maskArtistMutationUserId`.
5. **Payload limits.** Tope `maxPayloadChars = 8192` + límites por campo (`ARTIST_MUTATION_PAYLOAD_LIMITS`).
6. **DECLINE requiere nota.** `RespondGigAssignmentDTO` con `decision: 'DECLINE'` exige `rejectionNotes` no vacío.
7. **Read models intactos.** `BookingSnapshotDTO` / payouts financieros siguen read-only; writers no los mutan en este paso.

---

## 2. Mutaciones registradas

### 2.1 `RespondGigAssignmentDTO` (`respond_gig_assignment`)

Aceptación o rechazo de un gig asignado al artista.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `mutationKind` | literal | `'respond_gig_assignment'` |
| `artistUserId` | string | Required · debe == session `userId` |
| `idempotencyKey` | string | Required · 8–64 · pattern |
| `bookingId` | string | Required · gig / booking / lead id |
| `assignedDjId` | string | Required · **aislamiento** · == `artistUserId` |
| `decision` | enum | `'ACCEPT'` \| `'DECLINE'` |
| `rejectionNotes` | string \| null | Required (non-empty) when `DECLINE` · ≤500 · sanitized · null/ignored on `ACCEPT` |
| `responseNotes` | string \| null | Optional · ≤500 · sanitized (ACCEPT comments) |

**Validador:** `validateRespondGigAssignment(input)` → `{ ok: true, dto }` \| `{ ok: false, status: 'VALIDATION_ERROR', … }`  
**Redacción:** `redactRespondGigAssignment(dto)`  
**Scope (puro):** `assertGigAssignedToArtist({ assignedDjId, artistUserId })` → `{ ok: true }` \| `GIG_NOT_ASSIGNED`

### 2.2 `AcknowledgePayoutDTO` (`acknowledge_payout`)

Confirmación de recepción de honorarios (payout).

| Campo | Tipo | Reglas |
|-------|------|--------|
| `mutationKind` | literal | `'acknowledge_payout'` |
| `artistUserId` | string | Required · scope session |
| `idempotencyKey` | string | Required · 8–64 · pattern |
| `payoutId` | string | Required · opaque payout / receipt id |
| `acknowledged` | boolean | Required · must be `true` to confirm receipt |
| `feedback` | string \| null | Optional · ≤500 · sanitized |
| `assignedDjId` | string \| null | Optional · when present must == `artistUserId` |

**Validador:** `validateAcknowledgePayout(input)` → `{ ok: true, dto }` \| `{ ok: false, status: 'VALIDATION_ERROR', … }`  
**Redacción:** `redactAcknowledgePayout(dto)`

---

## 3. Validaciones transversales

### 3.1 Input sanitization

| Función | Comportamiento |
|---------|----------------|
| `sanitizeArtistMutationText` | trim · collapse whitespace · strip control chars |
| Field max lengths | Ver `ARTIST_MUTATION_PAYLOAD_LIMITS` |
| Payload size | `JSON.stringify` length ≤ 8192 |

### 3.2 PII / id redaction

| Señal | Redacción |
|-------|-----------|
| `artistUserId` / `assignedDjId` | `maskArtistMutationUserId` → `0000…0001` |
| `rejectionNotes` / `responseNotes` / `feedback` | Solo flags `has*` en DTO redactado |

### 3.3 Role / scope gate (puro)

`assertArtistMutationAuthorized({ sessionRole, artistUserId, isAnonymous, isExpired })`

| Condición | Resultado |
|-----------|-----------|
| `sessionRole !== 'artist'` | `UNAUTHORIZED_ROLE` · `role_not_artist` |
| anonymous / missing artistUserId | `UNAUTHORIZED_ROLE` · `anonymous` / `missing_artist_scope` |
| expired | `UNAUTHORIZED_ROLE` · `expired` |
| artist ready | `{ ok: true }` |

### 3.4 Assignment isolation

`assertGigAssignedToArtist({ assignedDjId, artistUserId, bookingId?, mutationKind?, idempotencyKey? })`

| Condición | Resultado |
|-----------|-----------|
| missing ids | `GIG_NOT_ASSIGNED` · `missing_assignment` |
| `assignedDjId !== artistUserId` | `GIG_NOT_ASSIGNED` · `assigned_dj_mismatch` |
| match | `{ ok: true }` |

---

## 4. Estados de respuesta

```text
ArtistMutationResult
  ├─ SUCCESS              → acceptedAt · idempotencyKey · replayed · labRecordId
  ├─ VALIDATION_ERROR     → ok:false · issues[] (field · code · message)
  ├─ UNAUTHORIZED_ROLE    → reason (role_not_artist · anonymous · expired · missing_artist_scope)
  ├─ GIG_NOT_ASSIGNED     → reason (assigned_dj_mismatch · missing_assignment · booking_not_found*)
  └─ IDEMPOTENCY_CONFLICT → existingLabRecordId (adapter Paso 2+)
```

\* `booking_not_found` reserved for adapter lookup — not emitted by Paso 1 pure validators.

| Status | Cuándo |
|--------|--------|
| **SUCCESS** | Validación OK (+ futura persistencia idempotente) · `toArtistMutationSuccessResult` |
| **VALIDATION_ERROR** | Campos inválidos · payload too large · DECLINE sin notes · `acknowledged !== true` |
| **UNAUTHORIZED_ROLE** | Rol ≠ artist · sesión anónima/expirada · sin scope |
| **GIG_NOT_ASSIGNED** | `assigned_dj_id` ≠ session artist · assignment missing |
| **IDEMPOTENCY_CONFLICT** | Tipado para Paso 2+ (mismo key, payload distinto) |

**Issue codes:** `required` · `too_long` · `too_short` · `invalid_format` · `out_of_range` · `payload_too_large` · `forbidden_role` · `scope_mismatch` · `invalid_decision` · `decline_notes_required` · `ack_must_be_true`

**Discriminante `ok` (Paso 1):**

| Resultado | Forma |
|-----------|--------|
| Validation fail | `{ ok: false, status: 'VALIDATION_ERROR', … }` |
| Validation pass | `{ ok: true, dto }` |
| Auth / assignment gates | status discriminants (`UNAUTHORIZED_ROLE` / `GIG_NOT_ASSIGNED`) · success gate `{ ok: true }` |

---

## 5. Idempotencia (contrato)

| Regla | Detalle |
|-------|---------|
| Key required | Toda mutación |
| Uniqueness scope (futuro) | `(artistUserId, mutationKind, idempotencyKey)` |
| First accept | Persist + `SUCCESS` · `replayed: false` |
| Duplicate key same payload | `SUCCESS` · `replayed: true` (Paso 2+ store) |
| Duplicate key different payload | `IDEMPOTENCY_CONFLICT` (Paso 2+) |

Paso 1 **no** implementa store; solo tipa `replayed` en `ArtistMutationSuccessResult`.

---

## 6. Mapa a Read Models (referencia — no mutar)

| Writer DTO | Read model relacionado | Notas |
|------------|------------------------|-------|
| RespondGigAssignment | `BookingSnapshotDTO` · calendar slots | Futuro: status accept/decline en assignment |
| AcknowledgePayout | Financial payout / receipt read | Futuro: flagged acknowledged by artist |

---

## 7. Fuera de alcance (Paso 1)

- `supabase.from(…).insert` / `.update` productivos
- Edge Functions / RLS changes
- UI forms en `artist/` portal
- Client Slice 1 / Staff writers
- Commit / push / deploy

---

## 8. Siguiente paso (requiere OK PO)

| Paso | Estado |
|------|--------|
| **Slice 2 · Paso 1** | ✅ Contratos + validadores puros |
| **Slice 2 · Paso 2** | ✅ Lab adapter + shared idempotency store — `shared/services/artist-mutations/` |
| **Slice 2 · Paso 3** | ✅ UI `/artist/` wire — `artist/mutations/` |

---

## 9. Referencias

| Recurso | Ruta |
|---------|------|
| Types | `MiamiDJBeat-MigracionV2/shared/types/artist.mutations.types.ts` |
| Barrel | `MiamiDJBeat-MigracionV2/shared/types/index.ts` |
| Client Slice 1 (sellado) | `docs/V2/CLIENT-MUTATIONS-MATRIX.md` |
| Session wiring | `docs/V2/SESSION-AUTH-WIRING-CLOSURE.md` |
| Bookings read | `docs/V2/BOOKINGS-CYCLE-CLOSURE.md` |
| Financial read | `docs/V2/FINANCIAL-CYCLE-CLOSURE.md` |

---

*Writers Phase · Slice 2 · Paso 1 — Artist mutation contracts — 2026-08-11 — documentation + types only — no commit*
