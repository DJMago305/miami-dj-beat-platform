# TICKET-V2-PHASE-8-MOD-014-ERROR-BRIDGE-IMPLEMENTATION-001

## Estado

**CONTRACT FIX APLICADO — PENDIENTE VALIDACIÓN PO**

| Campo | Valor |
|-------|-------|
| Fase | V2 — Phase 8 |
| Módulo | MOD-014 Error Handler |
| Corrección | `TICKET-V2-PHASE-8-MOD-014-ERROR-BRIDGE-CONTRACT-FIX-001` |
| Bootstrap / portales / SessionProvider | ❌ Sin cambios |
| Egress real | ❌ Prohibido |

---

## 1. Objetivo

Conectar errores del API Client y del dominio access-snapshot al Error Handler canónico:

| Fuente | Función bridge |
|--------|----------------|
| MOD-005 `ApiError` / `ApiFailure` | `normalizeApiClientError()` |
| Dominio `ACCESS_SNAPSHOT_*` | `normalizeDomainError()` |

### Alcance API v1 (PO vinculante)

Únicamente estos cinco `ApiErrorCode`:

| ApiErrorCode | ERR global | userMessageKey |
|--------------|------------|----------------|
| `API_HTTP_ERROR` | `ERR-0500` | `error.api.http.{status}` |
| `API_PARSE_ERROR` | `ERR-0501` | `error.api.parse` |
| `API_TIMEOUT` | `ERR-0502` | `error.api.timeout` |
| `API_CANCELLED` | `ERR-0504` | `error.api.cancelled` |
| `API_INVALID_PAYLOAD` | `ERR-0800` | `error.api.invalid_payload` |

**No autorizado en v1:** `API_EDGE_REJECTED`, `API_NETWORK`, `API_RATE_LIMITED`, `API_UNKNOWN` — fallback `ERR-0999` si llegan al bridge.

### Dominio access-snapshot (PO vinculante)

| Código dominio | Condición | ERR | userMessageKey |
|----------------|-----------|-----|----------------|
| `ACCESS_SNAPSHOT_REJECTED` | `reason === 'no_session'` | `ERR-0300` | `error.session.hydrate_failed` |
| `ACCESS_SNAPSHOT_REJECTED` | otro reason | `ERR-0999` | `error.access_snapshot.rejected` |
| `ACCESS_SNAPSHOT_UNKNOWN_PROFILE` | siempre | `ERR-0999` | `error.access_snapshot.unknown_profile` |
| `ACCESS_SNAPSHOT_UNRESOLVED_STAFF` | siempre | `ERR-0999` | `error.access_snapshot.unresolved_staff` |
| `ACCESS_SNAPSHOT_INVALID_PAYLOAD` | siempre | `ERR-0501` | `error.api.parse` |

**Reglas explícitas:**

- `UNKNOWN_PROFILE` ≠ permission denied (`ERR-0200` prohibido).
- `UNRESOLVED_STAFF` ≠ staff gate failed (`ERR-0201` prohibido).
- No crear nuevos códigos ERR en este ticket.

---

## 2. Catálogo runtime

Entradas API en `ERROR_CATALOG` tras contract fix:

| Código | Estado |
|--------|--------|
| `ERR-0500` | Preexistente HEAD |
| `ERR-0501` | Añadido — parse/contract |
| `ERR-0502` | Preexistente HEAD |
| `ERR-0504` | Añadido — cancellation INFO |
| `ERR-0800` | Preexistente — validación |

**Retirados del runtime:** `ERR-0503`, `ERR-0505`, `ERR-0506`, `ERR-0507` (prospectivos sin consumidor).

---

## 3. Event Bus

| Severidad | SYSTEM_ERROR |
|-----------|--------------|
| `API_HTTP_ERROR` (ERROR) | ✅ Publica |
| `API_TIMEOUT` (WARNING) | ❌ No publica |
| `API_CANCELLED` (INFO) | ❌ No publica |
| `ACCESS_SNAPSHOT_INVALID_PAYLOAD` (ERROR) | ✅ Publica |

---

## 4. Investigación test inicial (QA)

| Hallazgo | Detalle |
|----------|---------|
| Fallo inicial | `unsubscribe is not a function` + expectativa incorrecta en UNKNOWN_PROFILE |
| Causa | `subscribe()` devuelve `subscriptionId`, no función; `ERR-0200` era INFO |
| Corrección | Solo tests — sin cambio productivo para ese fallo |
| Estabilidad | Suites aisladas consecutivas PASS |

---

## 5. Archivos

| Archivo | Acción |
|---------|--------|
| `shared/errors/runtime/api-normalize.ts` | Contract fix |
| `shared/errors/runtime/domain-normalize.ts` | Contract fix |
| `shared/errors/runtime/catalog.ts` | Retiro prospectivos |
| `shared/errors/runtime/error-handler-service.ts` | Sin cambio contract |
| `shared/errors/runtime/index.ts` | Exports actualizados |
| `tests/unit/api-error-bridge.test.ts` | Tests ampliados |

---

## 6. Próximo ticket

- Wiring boot/portal: consumir bridge tras `fetchSnapshot` / permisos reales MOD-003.

---

*Phase 8 — MOD-014 Error Bridge v1 + Contract Fix*
