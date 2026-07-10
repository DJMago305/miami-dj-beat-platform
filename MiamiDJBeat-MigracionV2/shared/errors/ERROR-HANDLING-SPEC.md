# ERROR-HANDLING-SPEC.md

**TICKET-V2-SHARED-CORE-008 — Error Handling Specification**

**Módulo:** MOD-014 Error Handler  
**Ticket:** TICKET-V2-SHARED-CORE-008  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Autoridad única para clasificación, normalización, propagación y presentación segura de errores V2.  
> Alineado con `CONTRACTS.md` §7 (MOD-014).

---

## 1. Responsabilidad del módulo

| Hace | No hace |
|------|---------|
| Clasifica errores en categorías oficiales | **No autentica** |
| Asigna código único `ERR-xxxx` | **No consulta Supabase** |
| Normaliza `unknown` → `NormalizedError` | **No implementa API calls** |
| Delega registro a Logging | **No decide permisos** (clasifica Authorization) |
| Publica eventos vía Event Bus | **No renderiza UI** (provee `userMessageKey`) |
| Define presentación segura (sin secrets/stack prod) | **No silencia críticos** |
| Indica recoverability | **No contiene lógica de negocio** |

Portales **consumen** `NormalizedError`; no construyen errores ad hoc.

---

## 2. Clasificación oficial de errores

**Total categorías:** **10**

| ID | Categoría | Descripción | Rango códigos |
|----|-----------|-------------|---------------|
| C-01 | **Validation** | Input usuario/form inválido | ERR-0800–0899 |
| C-02 | **Authentication** | Identidad / credenciales | ERR-0100–0199 |
| C-03 | **Authorization** | Capability / permiso denegado | ERR-0200–0299 |
| C-04 | **Configuration** | Config boot / env | ERR-0001–0099 |
| C-05 | **Network** | Offline, DNS, timeout transport | ERR-0400–0499 |
| C-06 | **API** | HTTP/RPC/Edge respuesta error | ERR-0500–0599 |
| C-07 | **Storage** | Persistencia client/storage | ERR-0600–0699 |
| C-08 | **Business Rule** | Regla dominio rechazada | ERR-0700–0799 |
| C-09 | **Runtime** | Bug contrato, state machine illegal | ERR-0900–0949 |
| C-10 | **Unexpected** | No clasificado / throw raw | ERR-0950–0999 |

Todo error **debe** mapear a una categoría — si no, C-10 + log CRITICAL.

---

## 3. Severidad

**Total niveles:** **5** — detalle **ERROR-SEVERITY.md**

| Severidad | Uso |
|-----------|-----|
| **INFO** | Deny esperado, validation user |
| **WARNING** | Degradación, retry posible |
| **ERROR** | Fallo funcional |
| **CRITICAL** | Integridad subsystems |
| **FATAL** | Abort Core / session |

Mapping severidad → Logging level en spec Logging (007).

---

## 4. Lifecycle

Detalle: **ERROR-LIFECYCLE.md**

```
Error Detectado → Clasificación → Normalización → Registro (Logging)
  → Publicación (Event Bus) → Presentación segura → Recuperación o Terminación
```

---

## 5. Catálogo oficial de códigos

Detalle: **ERROR-CATALOG.md**

Estructura: `ERR-{4 digits}` — único global.

| Rango | Reservado |
|-------|-----------|
| 0001–0099 | Configuration / System |
| 0100–0199 | Authentication |
| 0200–0299 | Authorization |
| 0300–0399 | Session |
| 0400–0499 | Network |
| 0500–0599 | API |
| 0600–0699 | Storage |
| 0700–0799 | Business Rule |
| 0800–0899 | Validation |
| 0900–0999 | Runtime / Unexpected |

---

## 6. Relación con otros módulos

| Módulo | Relación |
|--------|----------|
| **Configuration** MOD-006 | Emite CONFIG_* → normalize ERR-000x |
| **Session** MOD-002 | SESSION_* → ERR-03xx; force logout paths |
| **Permissions** MOD-003 | PERM_* → ERR-02xx Authorization |
| **Logging** MOD-010 | Recibe normalized entry; no bypass |
| **Event Bus** MOD-004 | `SYSTEM_ERROR`, domain events con code |
| **API Client** MOD-005 | HTTP≠200 → ERR-05xx + detail redacted |
| **Notifications** MOD-011 | Toast userMessageKey opcional |

---

## 7. Reglas

| # | Regla |
|---|-------|
| E-01 | Error **nunca** expone información sensible |
| E-02 | **Nunca** contiene secretos |
| E-03 | **Nunca** contiene tokens |
| E-04 | **Nunca** contiene SQL |
| E-05 | **Nunca** stack trace en **production** user surface |
| E-06 | Todo error **clasificable** |
| E-07 | Todo error **código único** ERR-xxxx |
| E-08 | `detail` Edge permitido en user msg solo si PO whitelist |
| E-09 | Normalización idempotente |
| E-10 | Módulos externos solo vía `normalizeError(input)` contract |

---

## 8. Recuperación

| Clase | Significado | Ejemplo |
|-------|-------------|---------|
| **Recoverable** | Usuario corrige y reintenta | Validation |
| **Retryable** | Sistema reintenta N veces | Network timeout |
| **Fatal** | Termina flujo / Core boot | CONFIG fatal |
| **Ignorable** | Log only; UX continúa | Analytics fail silent |

Campo `NormalizedError.recovery: recoverable | retryable | fatal | ignorable`

---

## 9. Errores prohibidos

| Prohibido | Alternativa |
|-----------|-------------|
| throw anonymous Error() | ERR-0950 Unexpected |
| throw string | normalize → coded |
| object sin code | reject en dev strict |
| swallow critical | log FATAL + Event Bus |
| `catch {}` empty | normalize + log |
| pass raw API body to UI | userMessageKey |

---

## 10. Preparación para Runtime (consumo desacoplado)

### Contrato `NormalizedError` (conceptual)

| Campo | Descripción |
|-------|-------------|
| `code` | ERR-xxxx |
| `category` | C-01…C-10 |
| `severity` | INFO…FATAL |
| `recovery` | recoverable \| retryable \| fatal \| ignorable |
| `userMessageKey` | i18n key safe |
| `logMessage` | técnico redactado |
| `correlationId` | traza |
| `cause` | chain opaca sin secrets |

### Consumidores

| Consumidor | Uso |
|------------|-----|
| Auth | Map AUTH_* → ERR-01xx; no UI |
| API Client | Map HTTP → ERR-05xx; pass to normalize |
| Session | ERR-03xx; trigger logout on fatal auth |
| Permissions | ERR-02xx; no elevation |
| Portal Client/Artist/Staff | Read userMessageKey; **no** import normalize internals |

Desacoplamiento: portales import solo `presentError(normalized)` facade — implementación 009+.

---

## Referencias

- `ERROR-CATALOG.md`
- `ERROR-LIFECYCLE.md`
- `ERROR-SEVERITY.md`
- `../logging/LOGGING-SPEC.md`
- `../CONTRACTS.md` §7 Error Handling

---

*ERROR-HANDLING-SPEC v1.0 — TICKET-V2-SHARED-CORE-008*
