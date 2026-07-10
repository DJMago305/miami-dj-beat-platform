# TICKET-V2-PHASE-5-MOD-005-API-CLIENT-DISCOVERY-001

**Módulo:** MOD-005 API Client — Discovery arquitectónico
**Fase:** 5 — Planificación post-Foundation Fase 4
**Proyecto:** MiamiDJBeat-MigracionV2
**Rama:** `plan/v2-phase-4-api-client`
**Fecha apertura:** 2026-07-10
**Fecha cierre discovery:** 2026-07-10

---

## Estado

**COMPLETADO — DISCOVERY MOD-005 CERRADO**

| Dimensión | Estado |
|-----------|--------|
| Análisis arquitectónico | ✅ COMPLETADO |
| Implementación | ❌ NO AUTORIZADA — no realizada |
| Commit técnico | ❌ NO — discovery únicamente |
| Validación técnica baseline | ✅ 429/429 PASS (sin cambios) |
| Documentación cierre | ✅ TICKET-V2-END-OF-DAY-DOCUMENTATION-2026-07-10-002 |
| Publicación remota | ⛔ NO |

---

## Objetivo

Determinar arquitectura definitiva de MOD-005 API Client para V2: responsabilidades, contrato, lifecycle, integración Auth/Runtime, errores, retry, cancelación, Supabase futuro y alcance mínimo del primer ticket de implementación.

---

## Hallazgos principales

### Foundation Fase 4 — ya existe

| Entregable | Estado |
|------------|--------|
| `createApiClient()` | ✅ |
| `ApiClientPublicApi` | ✅ |
| `TransportPort` | ✅ |
| `MockTransport` / `MemoryTransport` | ✅ |
| Retry / timeout / cancel / `ApiFailure` | ✅ |
| Tests foundation | ✅ ~37 casos |

**Commit Foundation:** `36ae1bcd733c7e7b71caeda984bf8b553b218e59` — sin modificar en este discovery.

### Gap real

| Gap | Estado |
|-----|--------|
| Bootstrap wiring | ⏳ PENDIENTE |
| API singleton | ⏳ PENDIENTE |
| SessionReader live | ⏳ PENDIENTE |
| Runtime Registry MOD-005 | ⏳ PENDIENTE |
| `cancelAll()` en logout | ⏳ PENDIENTE |
| `normalizeApiError()` | ⏳ PENDIENTE |
| `invokeEdge` / `rpc` | ⏳ PENDIENTE |
| FetchTransport / Supabase | ⏳ PENDIENTE |

---

## Recomendación arquitectónica única

**Opción E + D:**

1. API Client como **único egress** del Shared Core.
2. **Transport adapters** desacoplados (`TransportPort`).
3. Auth **indirecto** vía `SessionReaderPort` — sin import Auth en core.
4. Runtime Registry **solo observabilidad estática**.
5. **`MemoryTransport`** para laboratorio; Fetch/Supabase futuros.

---

## Próximo ticket recomendado (sin abrir)

**`TICKET-V2-PHASE-6-MOD-005-API-BOOTSTRAP-WIRING-001`**

### Alcance tentativo

| Archivo | Rol |
|---------|-----|
| `shared/api/runtime/api-service.ts` | Singleton `initializeApiClient` / `getApiClient` |
| `bootstrap/initialize-api.ts` | MemoryTransport + SessionReader adapter |
| `bootstrap/boot.ts` | Fase `api-client` post-Auth activate |
| `bootstrap/index.ts` | Re-exports |
| `tests/unit/boot-api-wiring.test.ts` | Tests wiring |

### Opcional (PO explícito)

- Runtime Registry MOD-005
- `USER_LOGOUT` → `cancelAll()`

### Fuera de alcance inicial

Supabase real · FetchTransport · Storage · UI · portales · V1 · producción · `normalizeApiError()` · `invokeEdge()` · `rpc()`

---

## Criterios de aceptación del discovery

| # | Criterio | Evidencia |
|---|----------|-----------|
| D-01 | Foundation Fase 4 documentada como existente | `36ae1bc` + runtime `shared/api/` |
| D-02 | Gap wiring identificado | Informe discovery |
| D-03 | Arquitectura E+D recomendada | Informe §5–6 |
| D-04 | Auth indirecto vía SessionReader | AUTH-SPEC §10 + API-CLIENT-SPEC A-01 |
| D-05 | Sin implementación en discovery | Working tree sin cambios runtime |
| D-06 | Próximo ticket registrado sin abrir | Fase 6 wiring tentativo |
| D-07 | Veredicto LISTO PARA APERTURA | Informe final |

---

## Veredicto

**MOD-005 API CLIENT LISTO PARA APERTURA**

---

## Gobernanza

| Acción | Estado |
|--------|--------|
| Modificar runtime / tests / bootstrap | ❌ NO |
| Push / PR / Preview / merge / deploy | ❌ NO |
| V1 / producción | ✅ Intactas |

**Resumen:** `docs/V2/SESSION-SUMMARIES/2026-07-10-MOD-005-API-CLIENT-DISCOVERY.md`

*Discovery cerrado · Esperar ticket PO para Fase 6 wiring*
