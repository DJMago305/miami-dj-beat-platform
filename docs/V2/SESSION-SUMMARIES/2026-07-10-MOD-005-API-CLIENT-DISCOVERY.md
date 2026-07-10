# Cierre Fase 5 — MOD-005 API Client Discovery

**Proyecto:** MiamiDJBeat-MigracionV2
**Ticket:** TICKET-V2-PHASE-5-MOD-005-API-CLIENT-DISCOVERY-001
**Fecha:** 2026-07-10
**Tipo:** Discovery arquitectónico — análisis y planificación únicamente
**Entorno:** localhost únicamente (`http://localhost:5173`)
**Rama:** `plan/v2-phase-4-api-client`
**HEAD al cierre:** `2405b20eaaef4f1a41df00055a8a07a1629a1431`

---

## 1. Contexto

MOD-005 **API Client Foundation** quedó implementada y validada en Fase 4 (commit `36ae1bcd733c7e7b71caeda984bf8b553b218e59`). Tras cerrar la cadena Auth Fase 5 (Foundation · MOD-014 · Bootstrap Wiring · Runtime Registry MOD-001), el laboratorio ejecutó discovery para definir la **integración boot** y el alcance mínimo del siguiente ticket de implementación.

**Este discovery no autorizó ni realizó cambios de código.**

---

## 2. Objetivo

Determinar arquitectura definitiva de MOD-005 para V2:

- responsabilidades y límites del módulo;
- contrato público y lifecycle;
- integración Auth (indirecta) y Runtime (observabilidad);
- políticas de errores, retry y cancelación;
- compatibilidad futura Supabase;
- alcance mínimo del primer ticket de wiring.

---

## 3. Estado actual confirmado (Foundation Fase 4)

| Componente | Estado |
|------------|--------|
| `createApiClient()` / `ApiClientPublicApi` | ✅ Implementado |
| `TransportPort` | ✅ Implementado |
| `MockTransport` / `MemoryTransport` | ✅ Disponibles |
| Retry / timeout / cancel | ✅ Implementados |
| `ApiFailure` / normalización HTTP | ✅ Implementados |
| `SessionReaderPort` | ✅ Interface + helpers |
| Tests foundation | ✅ ~37 casos en `api-client-foundation.test.ts` |
| Bootstrap wire | ❌ Ausente |
| Singleton servicio | ❌ Ausente |
| Runtime Registry MOD-005 | ❌ Ausente |

---

## 4. Gap real identificado

| Gap | Descripción |
|-----|-------------|
| Bootstrap wiring | `initializeApiClient()` no existe en `boot.ts` |
| API singleton | Sin `getApiClient()` frozen post-boot |
| SessionReader live | Sin adapter boot que lea `getSessionSnapshot()` |
| Runtime Registry | MOD-005 no registrado |
| Logout cancel | Sin `USER_LOGOUT` → `cancelAll()` |
| `normalizeApiError()` | Pendiente en MOD-014 |
| `invokeEdge` / `rpc` | Spec sí; runtime no |
| FetchTransport / Supabase | Futuro — fuera de wiring v1 |

---

## 5. Arquitectura recomendada

**Opción única: E + D**

- **D:** API Client como **único egress** HTTP/RPC/Edge del Shared Core.
- **E:** Adapters desacoplados vía `TransportPort` (Memory/Mock hoy; Fetch/Supabase mañana).

### Reglas de integración

| Regla | Decisión |
|-------|----------|
| Auth | **Indirecto** — `SessionReaderPort` únicamente |
| Import Auth en core | **Prohibido** |
| Runtime Registry | **Observabilidad estática** — snapshot boot-time |
| Dependencia Runtime en API | **No** |
| Lab transport | `MemoryTransport` |
| Producción egress futuro | `FetchTransport` / `SupabaseRestAdapter` |

### Boot canónico propuesto

```
Config → Bus → Logging → Error
→ AUTH(register) → SESSION → AUTH(activate)
→ API_CLIENT(init)     ← nuevo
→ RUNTIME → SYSTEM_READY → THEME
```

---

## 6. Alcance explícitamente excluido (discovery)

- Implementación de wiring
- Supabase real / `FetchTransport`
- Storage · UI · portales · V1
- `normalizeApiError()` · `invokeEdge()` · `rpc()`
- Producción · publicación remota

---

## 7. Próximo ticket recomendado (sin abrir)

**`TICKET-V2-PHASE-6-MOD-005-API-BOOTSTRAP-WIRING-001`**

### Alcance tentativo obligatorio

- `shared/api/runtime/api-service.ts` (nuevo)
- `bootstrap/initialize-api.ts` (nuevo)
- `bootstrap/boot.ts`
- `bootstrap/index.ts`
- `tests/unit/boot-api-wiring.test.ts` (nuevo)

### Opcional (autorización PO explícita)

- Runtime Registry MOD-005
- `USER_LOGOUT` → `cancelAll()`

---

## 8. Veredicto

**MOD-005 API CLIENT LISTO PARA APERTURA** — ticket wiring Fase 6 pendiente de orden PO.

---

## 9. Gobernanza

| Acción | Estado |
|--------|--------|
| Commit técnico discovery | ❌ NO — análisis únicamente |
| Push / PR / Preview / merge / deploy | ❌ NO |
| V1 / producción | ✅ Intactas |
| `origin/main` / PR #117 | ✅ Intactos |

**Documentación:** `docs/V2/TICKETS/TICKET-V2-PHASE-5-MOD-005-API-CLIENT-DISCOVERY-001.md`

*Discovery cerrado · Detenerse hasta orden PO para wiring*
