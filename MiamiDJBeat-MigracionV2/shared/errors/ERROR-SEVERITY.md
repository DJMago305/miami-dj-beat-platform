# ERROR-SEVERITY.md

**TICKET-V2-SHARED-CORE-008 — Error Handling Specification**

**Módulo:** MOD-014 · Severidad  
**Versión:** 1.0

---

## Niveles oficiales

**Total:** **5**

| # | Severidad | Descripción | User impact |
|---|-----------|-------------|-------------|
| 1 | **INFO** | Esperado; flujo alternativo | Mensaje informativo |
| 2 | **WARNING** | Anomalía recuperable | Advertencia |
| 3 | **ERROR** | Funcionalidad falló | Error claro |
| 4 | **CRITICAL** | Subsystem comprometido | Error grave; soporte |
| 5 | **FATAL** | No continuar safe | Stop / reload |

---

## Mapping severidad → categoría (guía)

| Categoría | Severidad típica |
|-----------|------------------|
| Validation | INFO |
| Authentication (bad password) | INFO |
| Authentication (provider down) | ERROR |
| Authorization deny | INFO |
| Authorization staff gate | WARNING → FATAL flow |
| Configuration | FATAL |
| Network timeout | WARNING |
| API 5xx | ERROR |
| Storage | ERROR |
| Business Rule | INFO / WARNING |
| Runtime contract | CRITICAL |
| Unexpected | CRITICAL |

---

## Mapping severidad → Logging (MOD-010)

| Severity | Log level |
|----------|-----------|
| INFO | info |
| WARNING | warn |
| ERROR | error |
| CRITICAL | error |
| FATAL | fatal |

---

## Mapping severidad → Event Bus

| Severity | Emit SYSTEM_ERROR |
|----------|-------------------|
| INFO | no |
| WARNING | optional ADR |
| ERROR | yes |
| CRITICAL | yes |
| FATAL | yes + Core abort |

---

## Mapping severidad → presentación

| Severity | production UI |
|----------|---------------|
| INFO | inline field / toast info |
| WARNING | toast warn |
| ERROR | toast/modal error |
| CRITICAL | modal + support hint |
| FATAL | full screen safe fail |

---

## Escalation rules

- Same root cause 3+ ERROR in 60s → escalate log to CRITICAL (rate burst)
- FATAL never downgraded
- INFO never upgraded to FATAL without reclassification

---

*ERROR-SEVERITY v1.0 — 5 severities — TICKET-V2-SHARED-CORE-008*
