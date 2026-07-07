# COMPONENT-EVENTS.md

**TICKET-V2-SHARED-CORE-017 — Components Library Specification**

**Módulo:** MOD-009 · Eventos  
**Versión:** 1.0

> Eventos **subsistema registry** + patrones UI component-level. Envelope: `../events/EVENT-BUS-SPEC.md`.  
> **No** domain ORDER_* / PAYMENT_* in Core.

---

## Registry events (subsistema)

| Evento | Emisor | Consumidores | Payload permitido | Payload prohibido | Scope |
|--------|--------|--------------|-------------------|-------------------|-------|
| **COMPONENT_REGISTRY_LOADING** | Components | Logging | `{ correlationId? }` | — | internal |
| **COMPONENT_REGISTRY_READY** | Components | Portal Shell | `{ version, count }` | — | internal |
| **COMPONENT_REGISTRY_INVALID** | Components | Error Handling | `{ code }` | — | internal |
| **COMPONENT_REGISTRY_ERROR** | Components | Error Handling | `{ code: ERR-COMP-* }` | stack | internal |
| **COMPONENT_ADDED** | Components | Logging | `{ id, version }` | — | internal |
| **COMPONENT_DEPRECATED** | Components | Logging | `{ id, sunsetDate }` | — | internal |
| **COMPONENT_REMOVED** | Components | Logging | `{ id }` | — | internal |

---

## UI pattern events (per-component runtime ADR)

Emit from component instance — **not** duplicated in global catalog until registered.

| Patrón | Evento ejemplo | Payload permitido |
|--------|----------------|-------------------|
| Overlay open | `UI_OVERLAY_OPENED` | `{ componentId, overlayId }` |
| Overlay close | `UI_OVERLAY_CLOSED` | `{ componentId, overlayId, reason }` |
| Form submit UI | `UI_FORM_SUBMIT` | `{ formId }` — **no** field values PII |
| Selection change | `UI_SELECTION_CHANGED` | `{ componentId, selectedId }` |

**Prohibido:** passwords, tokens, payment data, capabilities, full form payloads.

---

## Eventos escuchados (Components subsistema)

| Evento | Emisor | Acción |
|--------|--------|--------|
| `THEME_CHANGED` | Theme | Invalidate styled component cache ADR |
| `LANGUAGE_CHANGED` | i18n | Re-render label slots ADR |
| `FLAGS_UPDATED` | Feature Flags | Register/unregister gated components |
| `CONFIG_UPDATED` | Configuration | Registry reload ADR |

Components **no** escucha Auth, Permissions, Session directly.

---

## Relación MOD-011 Notifications

| Component | Event |
|-----------|-------|
| MdjToastShell | Displays NOTIFICATION_CREATED — MOD-011 emits |
| MdjAlert | Inline — portal triggered |

---

## Registration ADR

`UI_*` events require catalog entry before runtime emit — ticket per batch.

---

*COMPONENT-EVENTS v1.0 — TICKET-V2-SHARED-CORE-017*
