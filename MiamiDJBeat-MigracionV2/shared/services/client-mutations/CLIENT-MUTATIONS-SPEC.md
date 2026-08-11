# Client Mutations Domain — SPEC (Writers Phase · Slice 1 · Paso 2)

| Campo | Valor |
|-------|--------|
| **Módulo** | `shared/services/client-mutations` |
| **Matriz** | `docs/V2/CLIENT-MUTATIONS-MATRIX.md` |
| **Types** | `shared/types/client.mutations.types.ts` |
| **Estado** | Lab adapter + idempotency store + mappers — **sin Supabase prod** · **sin commit** |
| **Lab** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Prerrequisitos** | Client Mutations Paso 1 (contratos) · Session Wiring sellado |

## Métodos públicos (adapter)

| Método | Rol |
|--------|-----|
| `submitBookingRequest({ payload, session })` | Valida · gate rol `client` · idempotencia · persiste lab record |
| `submitOfflinePaymentProof({ payload, session })` | Idem para comprobante offline (Zelle/Cash/…) |
| `getLabRecord(id)` / `listLabRecords()` | Lectura del store lab simulado |
| `getIdempotencyStore()` | Acceso al store de idempotencia (tests) |
| `clearLabState()` | Reset lab (tests) |

**Prohibido:** `supabase.from().insert|update` · Edge Auth writers · Stripe charge · mutar Read Models sellados.

## Persistencia lab

| Pieza | Archivo | Notas |
|-------|---------|-------|
| Idempotency | `lab-idempotency.store.ts` | Scope `(actorUserId, mutationKind, idempotencyKey)` — shared with Artist Slice 2 + Staff Slice 3 |
| Records | Map interno del adapter | `status: accepted_lab` — **no** Postgres |
| Fingerprints | `client-mutations.map-rows.ts` | Conflict si misma key + payload distinto → `IDEMPOTENCY_CONFLICT` |

## Resultados

| Status | Cuándo |
|--------|--------|
| `SUCCESS` | Primera aceptación o replay same payload (`replayed: true`) |
| `VALIDATION_ERROR` | Validadores Paso 1 / scope mismatch |
| `UNAUTHORIZED_ROLE` | Rol ≠ client · anonymous · expired |
| `IDEMPOTENCY_CONFLICT` | Misma key · fingerprint distinto |

## Tests

`tests/unit/client-mutations.service.spec.ts`

## Siguiente paso (requiere OK PO)

Paso 3+ — UI client / wire portal — **aún sin** Supabase productivo salvo ticket explícito.
