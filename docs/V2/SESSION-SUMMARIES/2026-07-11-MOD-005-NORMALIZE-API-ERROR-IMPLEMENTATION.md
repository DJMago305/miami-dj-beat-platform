# Cierre Fase 6 — MOD-005 Normalize API Error

**Proyecto:** MiamiDJBeat-MigracionV2
**Ticket:** TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-IMPLEMENTATION-001
**Fecha:** 2026-07-11
**Tipo:** Cierre técnico local — facade canónica de errores MOD-005
**Entorno:** localhost únicamente (`http://localhost:5173`)
**Rama:** `plan/v2-phase-4-api-client`
**HEAD:** `24b7da85ca3df0d1332dd2f45447eea84139904b`
**Commit:** `feat(v2-api): add canonical api error normalization`

---

## 1. Baseline inicial

| Campo | Valor |
|-------|-------|
| HEAD pre-implementación | `d7af312942d91d18a45805a9297c621fce93ac98` |
| Discovery | ✅ `TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-DISCOVERY-001` |
| Suite pre-implementación | **479/479 PASS** |
| Deuda | Sin `normalizeApiError()`; gaps 429, 408/504, business 200 |

---

## 2. Discovery previo

**Opción B + C aprobada** — facade única en `errors.ts` delegando a normalizadores existentes:

```
Transport / HTTP / parse / cancel
  → normalizeApiError(input)
  → ApiError frozen plain object
```

Rechazadas: class canónica (A), MOD-014 posee toda normalización (D), solo status HTTP (E).

**Documentación discovery:** `docs/V2/TICKETS/TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-DISCOVERY-001.md`

---

## 3. Contrato implementado

```ts
normalizeApiError(input: NormalizeApiErrorInput): ApiError
```

| Regla | Decisión |
|-------|----------|
| `NormalizeApiErrorInput` | Discriminated union por `kind` |
| `API_NETWORK` | Preservado (código histórico) |
| `API_RATE_LIMITED` | Aditivo — HTTP 429 |
| 408/504 | → `API_TIMEOUT` |
| Business 200 `{ error }` | → `API_EDGE_REJECTED` |
| `API_INVALID_PAYLOAD` | Fuera de facade |
| `cause` | Solo input interno — no en `ApiError` |

---

## 4. Delegación en api-client.ts

Todas las rutas de error del request path delegan a `normalizeApiError()`:

- cancelación (`API_CANCELLED`)
- timeout transport (`API_TIMEOUT`)
- fallos HTTP no-2xx
- parse / bad-response
- network / exhausted retry
- `mapTransportException()`

**Sin cambios** en request loop, retry policy, timeout client, cancelación, Authorization ni transporte.

---

## 5. Archivos del commit

| # | Archivo |
|---|---------|
| 1 | `shared/api/runtime/types.ts` |
| 2 | `shared/api/runtime/errors.ts` |
| 3 | `shared/api/runtime/api-client.ts` |
| 4 | `shared/api/runtime/index.ts` |
| 5 | `tests/unit/api-client-foundation.test.ts` |

**Diff:** +262 / −21 líneas · 5 archivos

---

## 6. Pruebas

| Capa | Resultado |
|------|-----------|
| Suite unitaria | **491/491 PASS** · **45/45 files** |
| Pruebas nuevas | **11** (facade + 429 integration) |
| Regresiones | **0** |

Escenarios: cancelled, timeout, 504, network, 429, 408/504, parse, business 200, unknown, idempotencia, 429 request path.

---

## 7. Validación visual PO

| Portal | HTTP | Visual |
|--------|------|--------|
| Client | 200 OK | ✅ Aprobado |
| Artist | 200 OK | ✅ Aprobado |
| Staff | 200 OK | ✅ Aprobado |

Pills en ready — sin regresiones visibles.

---

## 8. Commit y estado Git

| Campo | Valor |
|-------|-------|
| Hash | `24b7da85ca3df0d1332dd2f45447eea84139904b` |
| Mensaje | `feat(v2-api): add canonical api error normalization` |
| Working tree post-commit técnico | Limpio |
| Push / PR / merge / deploy | ❌ NO |

---

## 9. Deuda cerrada

| Deuda | Estado |
|-------|--------|
| `normalizeApiError()` ausente en MOD-005 | ✅ **CERRADA** |
| HTTP 429 sin `API_RATE_LIMITED` | ✅ **CERRADA** |
| HTTP 408/504 sin `API_TIMEOUT` | ✅ **CERRADA** |
| Business 200 → código incorrecto | ✅ **CERRADA** |
| `api-client.ts` sin facade | ✅ **CERRADA** |

---

## 10. Deuda pendiente (canónica — sin inventar)

| Ítem | Estado |
|------|--------|
| `FetchTransport` | ⏳ PENDIENTE — Discovery **no abierto** |
| MOD-014 bridge (`ApiError` → `NormalizedError`) | ⏳ PENDIENTE |
| Supabase adapter | ⏳ FUERA DE ALCANCE |
| `invokeEdge()` / `rpc()` | ⏳ PENDIENTE |
| Push / PR / merge / deploy | ❌ NO AUTORIZADO |
| Producción V1 | ✅ Intacta |

---

## 11. Publicación bloqueada

Sin push · sin PR · sin merge · sin preview · sin deploy.

---

## 12. Siguiente paso recomendado

Sujeto aprobación PO — candidato canónico:

- **FetchTransport** (egress HTTP real) — discovery todavía no abierto

---

## 13. Referencias

- Ticket implementación: `docs/V2/TICKETS/TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-IMPLEMENTATION-001.md`
- Discovery: `docs/V2/TICKETS/TICKET-V2-PHASE-6-MOD-005-NORMALIZE-API-ERROR-DISCOVERY-001.md`

---

*Acta de cierre · 2026-07-11 · commit `24b7da8`*
