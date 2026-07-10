# LOG-LEVELS.md

**TICKET-V2-SHARED-CORE-007 — Logging Specification**

**Módulo:** MOD-010 · Niveles de log  
**Versión:** 1.0

---

## Niveles definidos (oficial)

| # | Nivel | Severidad | Propósito |
|---|-------|-----------|-----------|
| 1 | **debug** | 10 | Diagnóstico desarrollo; verbose |
| 2 | **info** | 20 | Operación normal; auditoría técnica light |
| 3 | **warn** | 30 | Anomalía recuperable; degradación |
| 4 | **error** | 40 | Fallo requiere atención; funcionalidad afectada |
| 5 | **fatal** | 50 | Integridad Core; boot/security abort |

---

## Filtrado

Logger emite entrada si: `entry.level >= configuredMinLevel`

| Config `MDJ_V2_LOG_LEVEL` | Emite |
|---------------------------|-------|
| `debug` | all |
| `info` | info, warn, error, fatal |
| `warn` | warn, error, fatal |
| `error` | error, fatal |
| `fatal` | fatal only |

**Excepción:** `fatal` siempre se procesa (security/config abort).

---

## Guía de uso por módulo

| Situación | Nivel |
|-----------|-------|
| State transition Session | debug |
| SESSION_READY | info |
| PERM_DENIED guard | info |
| API 4xx expected | info o warn |
| API 5xx | error |
| CONFIG_ERROR fatal | fatal |
| EVENT_HANDLER_THROW | error |
| Refresh token expiring soon | debug |
| Staff gate logout | info |
| Redaction applied | debug |

---

## Mapping Error Handler → Logging

| Error category | Log level |
|----------------|-----------|
| User validation | info (Error Handler UX) |
| Permission deny | info |
| Network timeout | warn |
| API 5xx | error |
| Config fatal | fatal |
| Unhandled throw | error (+ stack local debug) |

---

## Entorno × nivel default

| Entorno | Default min | debug permitido |
|---------|-------------|-----------------|
| local | debug | ✅ |
| staging | info | ❌ sink |
| production | info | ❌ sink |

Override solo vía Configuration — no hardcode portal.

---

## Anti-patterns

| Anti-pattern | Correcto |
|--------------|----------|
| `log.error` for deny normal | `log.info` |
| `log.fatal` for single API fail | `log.error` |
| `debug` en production remote sink | metadata info max |
| Log sin level | reject en runtime |

---

*LOG-LEVELS v1.0 — 5 niveles — TICKET-V2-SHARED-CORE-007*
