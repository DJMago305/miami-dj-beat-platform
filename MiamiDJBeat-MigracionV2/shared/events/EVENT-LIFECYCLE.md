# EVENT-LIFECYCLE.md

**TICKET-V2-SHARED-CORE-003 — Event Bus Specification**

**Módulo:** MOD-004 Event Bus  
**Ticket:** TICKET-V2-SHARED-CORE-003  
**Versión:** 1.0

---

## Propósito

Define el **ciclo de vida** de publicación y suscripción — comportamiento esperado del bus sin código.

---

## Fases del bus

```
BOOT → REGISTER_CATALOG → BUS_READY (SYSTEM_READY)
  → RUNTIME (emit/listen)
  → SHUTDOWN (BUS_SHUTDOWN)
```

| Fase | Acciones permitidas |
|------|---------------------|
| BOOT | Cargar catálogo desde spec |
| REGISTER | Validar duplicados, versiones |
| READY | Emit + subscribe |
| RUNTIME | Operación normal |
| SHUTDOWN | Unsubscribe all; reject new emits |

---

## Ciclo de publicación (emit)

```
┌─────────────┐
│ Gate check  │  ¿Emisor autorizado? ¿Evento en catálogo?
└──────┬──────┘
       │ fail → EVENT_EMIT_REJECTED + log
       ▼
┌─────────────┐
│ Build envelope │ name, version, timestamp, emitter, scope, payload
└──────┬──────┘
       ▼
┌─────────────┐
│ Validate payload │ schema v1 per name
└──────┬──────┘
       │ fail → EVENT_PAYLOAD_INVALID
       ▼
┌─────────────┐
│ Set catch-up flag │ __mdjV2Emitted[name] = true (once-eligible)
└──────┬──────┘
       ▼
┌─────────────┐
│ Dispatch sync │ listeners in registration order
└──────┬──────┘
       ▼
┌─────────────┐
│ Log (info) │ correlationId, name — no payload secrets
└─────────────┘
```

### Emit once-eligible

Eventos marcados `onceEligible` en catálogo:

- `PORTAL_READY` (nav reorder)
- `DASHBOARD_READY`

Reglas:

- Primera entrega efectiva → listeners `once: true` no reciben duplicados
- Re-emit mismo `correlationId` → ignorado + log warn

---

## Ciclo de suscripción (listen)

```
┌─────────────┐
│ Subscribe   │ on(name, handler, { once?, version? })
└──────┬──────┘
       ▼
┌─────────────┐
│ Catch-up?   │ if __mdjV2Emitted[name] → invoke handler once
└──────┬──────┘
       ▼
┌─────────────┐
│ Wait emit   │
└──────┬──────┘
       ▼
┌─────────────┐
│ Handler     │ idempotent; no cross-portal mutation
└──────┬──────┘
       ▼
┌─────────────┐
│ once?       │ yes → auto-unsubscribe
└─────────────┘
```

### Orden listener vs emit (race)

| Escenario | Comportamiento |
|-----------|----------------|
| Subscribe **antes** emit | Handler en dispatch normal |
| Emit **antes** subscribe | Catch-up flag dispara handler una vez al subscribe |
| Emit **antes** bus READY | Rechazado; emitter debe reintent post SYSTEM_READY |

Este patrón reemplaza poll V1 (owner strip C6).

---

## Surface-ready lifecycle (PORTAL_READY)

Aplicable a nav y shells de portal:

| Paso | Responsable |
|------|-------------|
| 1 | Portal/surface: auth + data + DOM gates cumplidos |
| 2 | Surface emite `PORTAL_READY` `{ portal, surface: 'nav' }` |
| 3 | Shared navigation listener `{ once: true }` |
| 4 | Handler: reorder/patch nav; clear visual blocker |
| 5 | No poll, no MutationObserver para orden primario |

Equivalente conceptual V1: `OWNER_STRIP_READY` → unificado en `PORTAL_READY`.

---

## SESSION / AUTH lifecycle (eventos relacionados)

```
USER_LOGIN (public)
  → SESSION_CREATED (internal)
  → PERMISSION_CHANGED (internal) [post snapshot]
  → PORTAL_READY (public, portal shell)

USER_LOGOUT (public)
  → SESSION_DESTROYED (internal)
```

`ROLE_CHANGED` puede seguir a snapshot refresh sin logout.

---

## ORDER lifecycle (Operations Core)

```
ORDER_CREATED
  → ORDER_UPDATED (0..n)
  → PAYMENT_CREATED (optional)
  → PAYMENT_COMPLETED (optional)
  → ORDER_CLOSED
```

Proyecciones Client / Artist / Staff consumen mismos eventos; UI distinta por portal.

---

## Errores en lifecycle

| Código | Cuándo |
|--------|--------|
| `EVENT_UNKNOWN` | name no en catálogo |
| `EVENT_UNAUTHORIZED_EMITTER` | MOD no autorizado |
| `EVENT_PAYLOAD_INVALID` | schema fail |
| `EVENT_HANDLER_THROW` | handler error |
| `EVENT_DUPLICATE_ONCE` | re-emit once-eligible |
| `EVENT_BUS_NOT_READY` | pre SYSTEM_READY |

Todos → `../logging/` + `SYSTEM_ERROR` si crítico.

---

## Teardown

| Acción | Orden |
|--------|-------|
| Portal unmount | Unsubscribe portal handlers |
| Session destroy | Emit SESSION_DESTROYED |
| App shutdown | BUS_SHUTDOWN; reject emits |

---

## Implementación futura (005+)

Runtime debe cumplir este lifecycle sin desviaciones. Tests de contrato validan catch-up y once.

---

*EVENT-LIFECYCLE v1.0 — TICKET-V2-SHARED-CORE-003 — Especificación únicamente.*
