# RESPONSIVE-EVENTS.md

**TICKET-V2-SHARED-CORE-018 — Responsive Engine Specification**

**Módulo:** MOD-016 · Eventos  
**Versión:** 1.0

> Envelope: `../events/EVENT-BUS-SPEC.md`. **No** secrets · **no** PII · **no** permissions.

---

## Catálogo

| Evento | Emisor | Consumidores | Payload permitido | Payload prohibido | Scope |
|--------|--------|--------------|-------------------|-------------------|-------|
| **RESPONSIVE_INIT_STARTED** | Responsive | Logging | `{ correlationId? }` | — | internal |
| **RESPONSIVE_READY** | Responsive | Portal Shell, Components | `{ activeBp, width }` | exact geo PII | public |
| **BREAKPOINT_CHANGED** | Responsive | Components, DS cache ADR | `{ from, to, width }` | — | public |
| **ORIENTATION_CHANGED** | Responsive | Portal Shell | `{ orientation: portrait \| landscape }` | — | public |
| **VIEWPORT_RESIZED** | Responsive | Logging | `{ width, height }` | — | internal |
| **INPUT_MODALITY_CHANGED** | Responsive | Components ADR | `{ touch, pointer, keyboard }` | — | internal |
| **FOLD_STATE_CHANGED** | Responsive | Portal ADR future | `{ state }` | — | internal |
| **RESPONSIVE_ERROR** | Responsive | Error Handling | `{ code: ERR-RESP-* }` | — | internal |

---

## BREAKPOINT_CHANGED (canonical public)

Emit when active breakpoint token changes after debounce ADR.

| Campo | Tipo |
|-------|------|
| `from` | bp token \| null |
| `to` | bp token |
| `width` | integer px |

Components invalidate layout memoization — **not** Permissions.

---

## Eventos escuchados

| Evento | Emisor | Acción |
|--------|--------|--------|
| `CONFIG_UPDATED` | Configuration | Reload breakpoint config ADR |
| `FLAGS_UPDATED` | Feature Flags | Enable experimental bp ADR |
| `PORTAL_READY` | Portal | Optional bind ADR |

Responsive **no** escucha Auth, Theme, i18n directly.

---

*RESPONSIVE-EVENTS v1.0 — 8 events — TICKET-V2-SHARED-CORE-018*
