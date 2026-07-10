# EVENT-NAMING-STANDARD.md

**TICKET-V2-SHARED-CORE-003 — Event Bus Specification**

**Módulo:** MOD-004 Event Bus  
**Ticket:** TICKET-V2-SHARED-CORE-003  
**Versión:** 1.0

---

## Propósito

Estándar **obligatorio** de nombres de eventos V2. Un nombre = un significado en catálogo.

---

## Formato

```
DOMAIN_ACTION
```

| Parte | Regla |
|-------|-------|
| **DOMAIN** | Sustantivo singular o compuesto en UPPER_SNAKE |
| **ACTION** | Pasado/participio o estado (`CREATED`, `UPDATED`, `READY`, `CHANGED`, `DESTROYED`, `COMPLETED`, `CLOSED`, `ERROR`) |
| Separador | `_` único entre segmentos |
| Charset | `[A-Z0-9_]` |

---

## Dominios reservados

| Prefijo | Dominio |
|---------|---------|
| `SYSTEM_` | Core boot / salud |
| `USER_` | Identidad auth-level |
| `SESSION_` | Session Manager |
| `ROLE_` | Permissions rol |
| `PERMISSION_` | Permissions capabilities |
| `ORDER_` | Operations Core orden |
| `PAYMENT_` | Pagos |
| `PROFILE_` | Perfiles |
| `NOTIFICATION_` | Notificaciones |
| `THEME_` | Theme |
| `LANGUAGE_` | i18n |
| `PORTAL_` | Portal shell / surface |
| `DASHBOARD_` | Dashboard feature |

Nuevo dominio → ADR + entrada catálogo **antes** del primer emit.

---

## Reglas

| # | Regla |
|---|-------|
| N-01 | Todo en `UPPER_SNAKE` |
| N-02 | Mínimo dos segmentos (`DOMAIN_ACTION`) |
| N-03 | No abreviaturas opacas (`ORD_UPD`) — usar `ORDER_UPDATED` |
| N-04 | No verbo presente (`ORDER_UPDATE`) — usar pasado `ORDER_UPDATED` |
| N-05 | `READY` solo para surface/lifecycle completo, no datos parciales |
| N-06 | Un nombre no reutiliza significados distintos por portal |
| N-07 | Variante portal va en **payload** (`portal`), no en nombre (`CLIENT_ORDER_CREATED` prohibido salvo ADR) |
| N-08 | Sufijos `_V2` prohibidos — versionado en campo `version` |
| N-09 | Prefijos `V1_`, `MDJ_`, `WINDOW_` prohibidos |
| N-10 | Eventos deprecated mantienen nombre; flag en catálogo |

---

## Ejemplos válidos

| Nombre | Notas |
|--------|-------|
| `ORDER_CREATED` | ✅ |
| `PORTAL_READY` | ✅ surface en payload |
| `SYSTEM_ERROR` | ✅ |
| `PERMISSION_CHANGED` | ✅ |

---

## Ejemplos inválidos

| Nombre | Motivo |
|--------|--------|
| `orderCreated` | No camelCase |
| `UPDATE` | Sin dominio |
| `NAV_POLL` | Prohibido — poll |
| `ARTIST_NAV_READY` | Deprecado → usar `PORTAL_READY` + `surface: nav` (ADR catálogo) |
| `OWNER_STRIP_READY` | Deprecado → `PORTAL_READY` unificado |

*Migración nombres V1 conceptuales → catálogo V2 unificado en implementación.*

---

## Registro

Todo nombre nuevo:

1. Entrada en `EVENT-BUS-SPEC.md` catálogo
2. Emisor autorizado (MOD-xxx)
3. Payload v1 documentado
4. Scope `internal` | `public`

Sin registro → **emit rechazado** en runtime (TICKET-V2-SHARED-CORE-005+).

---

*EVENT-NAMING-STANDARD v1.0 — TICKET-V2-SHARED-CORE-003*
