# FLAG-EVENTS.md

**TICKET-V2-SHARED-CORE-015 — Feature Flags Specification**

**Módulo:** MOD-013 · Eventos  
**Versión:** 1.0

> Regla: eventos Flags **no** incluyen secretos, permisos, capabilities, tokens sensibles ni datos de pago.  
> Envelope: `shared/events/EVENT-BUS-SPEC.md` §1.

---

## Catálogo

| Evento | Emisor | Consumidores esperados | Payload permitido | Payload prohibido | Observaciones |
|--------|--------|------------------------|-------------------|-------------------|---------------|
| **FLAGS_LOADING** | Feature Flags | Logging | `{ correlationId? }` | secrets | internal · boot |
| **FLAGS_READY** | Feature Flags | Portal Shell, modules, Logging | `{ registryVersion, flagCount }` | flag values dump | **public** · boot gate |
| **FLAGS_UPDATED** | Feature Flags | Modules listening key ADR | `{ key, enabled, source }` | PII | **public** post-stable |
| **FLAGS_INVALIDATED** | Feature Flags / Config listener | Feature Flags | `{ reason: config \| ttl \| manual }` | — | internal |
| **FLAGS_REFRESH** | Feature Flags | Logging | `{ phase: start \| done }` | remote credentials | internal |
| **FLAGS_FALLBACK** | Feature Flags | Error Handling, Logging | `{ reason, keysAffected? }` | — | warn level |
| **FLAGS_ERROR** | Feature Flags | Error Handling | `{ code: ERR-FLAG-xxx }` | stack raw | internal |
| **FLAGS_RELOADED** | Feature Flags | Portal features | `{ registryVersion }` | full registry JSON | public after CONFIG_UPDATED |

---

## FLAGS_READY (canonical public)

Emit **after** RESOLVING → READY stable.

| Campo | Tipo |
|-------|------|
| `registryVersion` | integer |
| `flagCount` | integer |
| `portal` | optional `client` \| `artist` \| `staff` |

Portal modules **must not** evaluate flags for user-facing gates before FLAGS_READY (salvo ADR bootstrap exception).

---

## FLAGS_UPDATED

Emit when single or batch flag value changes post-READY.

| Campo | Tipo |
|-------|------|
| `key` | string |
| `enabled` | boolean |
| `source` | `env` \| `config` \| `cache` \| `default` \| `emergency` |
| `previousEnabled` | optional boolean |

Consumers invalidate local memoization — **no** re-fetch Permissions.

---

## Eventos escuchados (Feature Flags)

| Evento | Emisor | Acción |
|--------|--------|--------|
| `CONFIG_UPDATED` | Configuration | INVALID → RESOLVING → FLAGS_RELOADED |
| `SYSTEM_READY` | Event Bus | Optional late bind ADR |

Feature Flags **no** escucha Auth, Permissions, Theme, i18n events.

---

## Registration ADR

Extended internal diagnostics → `scope: internal` until EVENT-BUS catalog update ticket.

Public minimum for portales: **FLAGS_READY**, **FLAGS_UPDATED**.

---

*FLAG-EVENTS v1.0 — 8 events — TICKET-V2-SHARED-CORE-015*
