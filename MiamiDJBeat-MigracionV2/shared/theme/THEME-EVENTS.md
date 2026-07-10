# THEME-EVENTS.md

**TICKET-V2-SHARED-CORE-014 — Theme Manager Specification**

**Módulo:** MOD-007 · Eventos  
**Versión:** 1.0

> Regla: eventos Theme **no** incluyen secretos, permisos, tokens sensibles ni datos de pago.

---

## Catálogo

| Evento | Emisor | Consumidores esperados | Payload permitido | Payload prohibido | Observaciones |
|--------|--------|------------------------|-------------------|-------------------|---------------|
| `THEME_LOAD_STARTED` | Theme | Logging | `{ correlationId? }` | secrets | internal |
| `THEME_LOAD_SUCCEEDED` | Theme | Logging | `{ themeId, version }` | token values | internal |
| `THEME_LOAD_FAILED` | Theme | Error Handling | `{ code, themeId? }` | stack | internal |
| `THEME_DEFAULT_RESOLVED` | Theme | Logging | `{ themeId }` | — | internal |
| `THEME_USER_PREFERENCE_FOUND` | Theme | Session ADR | `{ mode: dark\|light\|system }` | userId PII | internal |
| `THEME_USER_PREFERENCE_MISSING` | Theme | Logging | `{}` | — | internal |
| `THEME_SYSTEM_PREFERENCE_FOUND` | Theme | Logging | `{ scheme: dark\|light }` | — | internal |
| `THEME_SWITCH_REQUESTED` | Theme / portal | Theme | `{ targetThemeId, source }` | — | pre-validate |
| `THEME_SWITCH_SUCCEEDED` | Theme | Logging | `{ themeId }` | — | internal |
| `THEME_SWITCH_FAILED` | Theme | Error Handling | `{ code, themeId? }` | — | internal |
| **`THEME_CHANGED`** | Theme | **Portals, Components, DS** | `{ mode, themeId }` | secrets, roles | **public** · EVENT-BUS #16 |
| `THEME_FALLBACK_ACTIVATED` | Theme | Logging, Error Handling | `{ fromThemeId, fallbackId }` | — | warn level |

---

## THEME_CHANGED (canonical public)

Alineado `EVENT-BUS-SPEC.md`:

| Campo | Tipo |
|-------|------|
| `mode` | `dark` \| `light` |
| `themeId` | string |
| `portal` | optional `client` \| `artist` \| `staff` |

Emit **after** tokens validated and THEME_READY.

---

## Registration ADR

Extended events (`THEME_LOAD_*`, etc.) → internal scope until catalog update ticket.

---

*THEME-EVENTS v1.0 — 12 events — TICKET-V2-SHARED-CORE-014*
