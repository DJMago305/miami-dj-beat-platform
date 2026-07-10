# LOGGING-SPEC.md

**TICKET-V2-SHARED-CORE-007 — Logging Specification**

**Módulo:** MOD-010 Logging  
**Ticket:** TICKET-V2-SHARED-CORE-007  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

---

## 1. Responsabilidad del módulo Logging

Logging es el **único canal estructurado** de registro técnico del Shared Core V2 en cliente.

| Hace | No hace |
|------|---------|
| Registra eventos técnicos permitidos y **redactados** | **No autentica** |
| Aplica niveles y filtros por entorno | **No decide permisos** |
| Adjunta contexto mínimo + correlationId | **No consulta Supabase** directamente |
| Integra con Error Handler y Event Bus | **No guarda tokens** |
| Redacta datos sensibles automáticamente | **No registra PII sensible** en claro |
| Expone API conceptual `log.debug/info/warn/error/fatal` | **No renderiza UI** |

Staff audit UI (MOD-316) **consume** logs server-side — no vive en Logging module.

---

## 2. Niveles oficiales

| Nivel | Uso | Prod default |
|-------|-----|--------------|
| **debug** | Diagnóstico detallado dev | off |
| **info** | Flujos normales | on |
| **warn** | Degradación recuperable | on |
| **error** | Fallo operativo | on |
| **fatal** | Integridad / boot abort | on |

Detalle: **LOG-LEVELS.md**

Orden severidad: `debug < info < warn < error < fatal`

---

## 3. Eventos que se pueden registrar

| Categoría | Ejemplos | Nivel típico |
|-----------|----------|--------------|
| Core boot | Config frozen, SYSTEM_READY | info |
| Session lifecycle | state transition (sin tokens) | info / debug |
| Permission | PERM_DENIED (sin user email) | info |
| Event Bus | emit/listen name, handler throw | debug / error |
| API Client | HTTP status, duration, code (sin body secrets) | warn / error |
| Error Handler | normalized code, category | error |
| Config | CONFIG_ERROR_* codes | fatal / error |
| Feature flags | flag key, enabled bool | debug |
| Performance | durationMs thresholds | warn |

Solo **códigos y metadatos** — no payloads completos de negocio salvo ADR.

---

## 4. Eventos prohibidos

| Prohibido | Motivo |
|-----------|--------|
| Passwords, OTP, magic links | Secreto |
| Access/refresh tokens completos | Secreto |
| Service role keys | Secreto |
| PAN, CVV, bank account | PCI |
| Government IDs completos | PII |
| Email + phone + name juntos | PII bundle |
| Contenido CRM/leads | Red zone data |
| Request/response bodies sin redactar | Leak |
| Stack traces a usuario final | UX — ok en log **local** debug only |
| `console.log` ad hoc en portales | Bypass Logging |
| V1 log format injection | Mezcla |

---

## 5. Redacción obligatoria

Detalle: **LOG-REDACTION-RULES.md**

Resumen: campos matching `password`, `token`, `authorization`, `secret`, `key`, `ssn`, etc. → `[REDACTED]`. URLs query params sensibles stripped.

---

## 6. Contexto mínimo de cada log

Cada entrada **debe** incluir:

| Campo | Req | Descripción |
|-------|-----|-------------|
| `timestamp` | ✅ | ISO 8601 UTC |
| `level` | ✅ | debug \| info \| warn \| error \| fatal |
| `message` | ✅ | string corto |
| `moduleId` | ✅ | MOD-xxx emisor |
| `env` | ✅ | local \| staging \| production |
| `correlationId` | ○ | Si disponible en contexto |
| `sessionId` | ○ | Opaco; no user id obligatorio |
| `portal` | ○ | client \| artist \| staff |
| `code` | ○ | Error/event code |
| `meta` | ○ | Objeto **redactado** |

Prohibido log sin `level` o `moduleId`.

---

## 7. Correlation ID

| Regla | Detalle |
|-------|---------|
| Generación | UUID v4 al boot Session o primer API call |
| Propagación | Session → API Client → Error Handler → Event Bus |
| Header futuro | `X-Correlation-Id` en API Client (spec only) |
| Formato | `corr-{uuid}` |
| Persist | sessionStorage opcional local debug |
| Unicidad | Por user journey tab; nuevo en login |

Todos los logs de una operación comparten `correlationId` cuando contexto lo provee.

---

## 8. Relación con otros módulos

| Módulo | Relación |
|--------|----------|
| **Configuration** MOD-006 | Lee `LOG_LEVEL`, `env`, `appName`; boot order: Config before Logging init |
| **Session** MOD-002 | Provee `sessionId`; Logging **no** lee snapshot capabilities |
| **API Client** MOD-005 | Emite HTTP logs redactados; recibe correlationId |
| **Error Handler** MOD-014 | Delega `log.error/fatal`; user message separado |
| **Event Bus** MOD-004 | `EVENT_HANDLER_THROW`, `SYSTEM_ERROR` → log error |

Logging **no** importa Session/Permissions para filtrar — solo contexto pasivo.

Orden init:

```
Configuration → Logging init → Event Bus → Session → …
```

---

## 9. Reglas por entorno

| Entorno | Min level | Sinks | debug body |
|---------|-----------|-------|------------|
| **local** | debug | console | permitido redactado |
| **staging** | info | console + remote ADR | metadata only |
| **production** | info | remote ADR | metadata only; no stack to remote |

`fatal` siempre emite independiente de min level filter.

Desde Configuration: `MDJ_V2_LOG_LEVEL` override con validación CONFIG-SPEC.

---

## 10. Errores de logging

| Código | Cuándo | Acción |
|--------|--------|--------|
| `LOG_ERROR_SINK_FAILURE` | Remote sink caído | fallback console + warn |
| `LOG_ERROR_REDACTION_FAIL` | Payload no serializable | log meta error only |
| `LOG_ERROR_CIRCULAR` | meta circular ref | drop meta, keep message |
| `LOG_ERROR_LEVEL_INVALID` | level desconocido | coerce info + warn |
| `LOG_FATAL_BOOT` | cannot init | Core abort |

Logging failures **nunca** throw to user UI.

---

## API conceptual (sin código)

```
log.debug(message, meta?)
log.info(message, meta?)
log.warn(message, meta?)
log.error(message, meta?)
log.fatal(message, meta?)
log.withContext({ moduleId, correlationId, portal }) → child logger
```

---

## Referencias

- `LOG-LEVELS.md`
- `LOG-REDACTION-RULES.md`
- `../config/CONFIG-SPEC.md`
- `../CONTRACTS.md` §6 Logging

---

*LOGGING-SPEC v1.0 — TICKET-V2-SHARED-CORE-007 — Sin implementación.*
