# ERROR-CATALOG.md

**TICKET-V2-SHARED-CORE-008 — Error Handling Specification**

**Módulo:** MOD-014 · Catálogo oficial ERR-xxxx  
**Versión:** 1.0

---

## Estructura de código

```
ERR-{NNNN}
```

| Parte | Regla |
|-------|-------|
| Prefijo | `ERR-` fijo |
| Dígitos | 4 numeric, zero-padded |
| Unicidad | Global en plataforma V2 |
| Nuevo código | Entrada aquí antes de runtime |

---

## Rangos reservados

| Rango | Categoría | Reservado para |
|-------|-----------|----------------|
| ERR-0001–0099 | Configuration / System | MOD-006, Core boot |
| ERR-0100–0199 | Authentication | MOD-001 |
| ERR-0200–0299 | Authorization | MOD-003 Permissions |
| ERR-0300–0399 | Session | MOD-002 |
| ERR-0400–0499 | Network | Transport |
| ERR-0500–0599 | API | MOD-005 API Client |
| ERR-0600–0699 | Storage | MOD-012 Storage / session persist |
| ERR-0700–0799 | Business Rule | Services / portales |
| ERR-0800–0899 | Validation | Forms / input |
| ERR-0900–0949 | Runtime | Contracts, state machine |
| ERR-0950–0999 | Unexpected | Fallback |

**Prohibido** usar códigos fuera de rango para la categoría declarada.

---

## Catálogo inicial (representativo)

### Configuration / System (0001–0099)

| Código | Nombre | Severity | Recovery |
|--------|--------|----------|----------|
| ERR-0001 | CONFIG_INVALID_ENV | FATAL | fatal |
| ERR-0002 | CONFIG_MISSING_KEY | FATAL | fatal |
| ERR-0003 | CONFIG_FORBIDDEN_KEY | FATAL | fatal |
| ERR-0004 | CONFIG_INVALID_URL | FATAL | fatal |
| ERR-0005 | CONFIG_V1_PATH_DETECTED | FATAL | fatal |
| ERR-0010 | SYSTEM_NOT_READY | CRITICAL | retryable |

### Authentication (0100–0199)

| Código | Nombre | Severity | Recovery |
|--------|--------|----------|----------|
| ERR-0100 | AUTH_INVALID_CREDENTIALS | INFO | recoverable |
| ERR-0101 | AUTH_SESSION_EXPIRED | WARNING | recoverable |
| ERR-0102 | AUTH_PROVIDER_UNAVAILABLE | ERROR | retryable |
| ERR-0103 | AUTH_FORCED_SIGNOUT | WARNING | fatal |

### Authorization (0200–0299)

| Código | Nombre | Severity | Recovery |
|--------|--------|----------|----------|
| ERR-0200 | PERM_DENIED | INFO | recoverable |
| ERR-0201 | PERM_STAFF_GATE_FAILED | WARNING | fatal |
| ERR-0202 | PERM_MANAGEMENT_REQUIRED | INFO | recoverable |
| ERR-0203 | PERM_SNAPSHOT_UNAVAILABLE | ERROR | retryable |

### Session (0300–0399)

| Código | Nombre | Severity | Recovery |
|--------|--------|----------|----------|
| ERR-0300 | SESSION_HYDRATE_FAILED | ERROR | retryable |
| ERR-0301 | SESSION_REFRESH_FAILED | WARNING | recoverable |
| ERR-0302 | SESSION_STORAGE_CORRUPT | WARNING | recoverable |
| ERR-0303 | SESSION_ILLEGAL_TRANSITION | CRITICAL | fatal |

### Network (0400–0499)

| Código | Nombre | Severity | Recovery |
|--------|--------|----------|----------|
| ERR-0400 | NET_OFFLINE | WARNING | retryable |
| ERR-0401 | NET_TIMEOUT | WARNING | retryable |
| ERR-0402 | NET_DNS_FAILURE | ERROR | retryable |

### API (0500–0599)

| Código | Nombre | Severity | Recovery |
|--------|--------|----------|----------|
| ERR-0500 | API_HTTP_ERROR | ERROR | varies |
| ERR-0501 | API_PARSE_ERROR | ERROR | retryable |
| ERR-0502 | API_TIMEOUT | WARNING | retryable |
| ERR-0503 | API_EDGE_REJECTED | ERROR | recoverable |

### Storage (0600–0699)

| Código | Nombre | Severity | Recovery |
|--------|--------|----------|----------|
| ERR-0600 | STORAGE_QUOTA_EXCEEDED | ERROR | recoverable |
| ERR-0601 | STORAGE_READ_FAILED | ERROR | retryable |
| ERR-0602 | STORAGE_WRITE_FAILED | ERROR | retryable |

### Business Rule (0700–0799)

| Código | Nombre | Severity | Recovery |
|--------|--------|----------|----------|
| ERR-0700 | BIZ_ORDER_CLOSED | INFO | recoverable |
| ERR-0701 | BIZ_SFT_NOT_ELIGIBLE | INFO | recoverable |
| ERR-0702 | BIZ_CHECKOUT_INVALID_STATE | WARNING | recoverable |

### Validation (0800–0899)

| Código | Nombre | Severity | Recovery |
|--------|--------|----------|----------|
| ERR-0800 | VAL_REQUIRED_FIELD | INFO | recoverable |
| ERR-0801 | VAL_FORMAT_INVALID | INFO | recoverable |
| ERR-0802 | VAL_OUT_OF_RANGE | INFO | recoverable |

### Runtime / Unexpected (0900–0999)

| Código | Nombre | Severity | Recovery |
|--------|--------|----------|----------|
| ERR-0900 | RT_EVENT_HANDLER_THROW | ERROR | ignorable |
| ERR-0901 | RT_CONTRACT_VIOLATION | CRITICAL | fatal |
| ERR-0950 | UNEXPECTED_ERROR | CRITICAL | varies |
| ERR-0999 | UNKNOWN_ERROR | CRITICAL | fatal |

**Códigos documentados en catálogo inicial:** **40**

---

## Registro de nuevos códigos

1. Elegir rango por categoría  
2. Asignar siguiente número libre en rango  
3. Definir severity + recovery + userMessageKey  
4. Actualizar ERROR-CATALOG + ADR si red zone  

---

*ERROR-CATALOG v1.0 — TICKET-V2-SHARED-CORE-008*
