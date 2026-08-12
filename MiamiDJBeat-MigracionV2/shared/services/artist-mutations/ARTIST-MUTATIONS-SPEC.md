# Artist Mutations Domain — SPEC (Writers Phase · Slice 2 · Paso 2)

| Campo | Valor |
|-------|--------|
| **Módulo** | `shared/services/artist-mutations` |
| **Matriz** | `docs/V2/ARTIST-MUTATIONS-MATRIX.md` |
| **Types** | `shared/types/artist.mutations.types.ts` |
| **Estado** | Lab adapter + shared idempotency store + mappers — **sin Supabase prod** · **sin commit** |
| **Lab** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Prerrequisitos** | Artist Mutations Paso 1 (contratos) · Session Wiring · Client Slice 1 store compartido |

## Métodos públicos (adapter)

| Método | Rol |
|--------|-----|
| `respondGigAssignment({ payload, session, gigAssignedDjId? })` | Valida · gate rol `artist` · `assigned_dj_id` · idempotencia · lab record |
| `acknowledgePayout({ payload, session })` | Confirmación de honorarios · lab `acknowledged_lab` |
| `getLabRecord(id)` / `listLabRecords()` | Lectura del store lab simulado |
| `getIdempotencyStore()` | Acceso al store de idempotencia (tests) |
| `clearLabState()` | Reset lab (tests) |

**Prohibido:** `supabase.from().insert|update` · Edge Auth writers · mutar Read Models sellados · Client Slice 1 UI.

## Persistencia lab

| Pieza | Archivo | Notas |
|-------|---------|-------|
| Idempotency | `../client-mutations/lab-idempotency.store.ts` | Scope `(actorUserId, mutationKind, idempotencyKey)` — **compartido** Client/Artist |
| Records | Map interno del adapter | `accepted_lab` · `declined_lab` · `acknowledged_lab` — **no** Postgres |
| Fingerprints | `artist-mutations.map-rows.ts` | Conflict si misma key + payload distinto → `IDEMPOTENCY_CONFLICT` |

## Resultados

| Status | Cuándo |
|--------|--------|
| `SUCCESS` | Primera aceptación o replay same payload (`replayed: true`) |
| `VALIDATION_ERROR` | Validadores Paso 1 / scope mismatch / DECLINE sin notes |
| `UNAUTHORIZED_ROLE` | Rol ≠ artist · anonymous · expired |
| `GIG_NOT_ASSIGNED` | `assigned_dj_id` ≠ session artist · `gigAssignedDjId` mismatch |
| `IDEMPOTENCY_CONFLICT` | Misma key · fingerprint distinto |

## Tests

`tests/unit/artist-mutations.service.spec.ts` (adapter) + `tests/unit/artist-mutations-ui.spec.ts` (UI wiring)

## Paso 3 — UI `/artist/` wire — **COMPLETADO/CERRADO** (2026-08-11)

`respondGigAssignment` y `acknowledgePayout` están cableados a formularios reales en `artist/mutations/` (`artist-gig-decision-form.ts`, `artist-payout-ack-form.ts`), montados una sola vez desde `artist/main.ts` vía `mountArtistMutationsSlice()`. Verificado end-to-end por `artist-mutations-ui.spec.ts`.

Sigue vigente para cualquier paso futuro: **aún sin** Supabase productivo — el adapter permanece in-memory (lab records), sin escritura real a base de datos, salvo ticket explícito que autorice esa siguiente fase.
