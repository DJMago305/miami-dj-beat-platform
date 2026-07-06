# EVENT-MAP.md

**Ticket:** TICKET-V2-ARCHITECTURE-HANDBOOK-001 · Reconciliado **PHASE-DOC-RECONCILIATION-001**  
**Tipo:** Índice maestro de eventos — **sin copiar payloads**

> Payloads, campos requeridos y reglas de emit/listen están en el **documento origen** de cada módulo. Envelope global: `shared/events/EVENT-BUS-SPEC.md` §1.

---

## Convenciones

| Campo | Fuente |
|-------|--------|
| Formato envelope | `events/EVENT-BUS-SPEC.md` |
| Nomenclatura | `events/EVENT-NAMING-STANDARD.md` |
| Scope `internal` vs `public` | `events/EVENT-BUS-SPEC.md` §8–9 |
| Catálogo público base | `events/EVENT-BUS-SPEC.md` §9 |

---

## Índice por módulo

### MOD-004 Event Bus (infraestructura)

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `events/EVENT-BUS-SPEC.md` | `SYSTEM_READY` | — (bus core) |
| `events/EVENT-LIFECYCLE.md` | Bus state transitions | Boot orchestration |

---

### MOD-001 Authentication

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `auth/AUTH-SPEC.md` | `USER_LOGIN`, `USER_LOGOUT` | — |
| `auth/AUTH-LIFECYCLE.md` | Auth state transitions (internal ADR) | `ForceLogout` from Permissions |

→ `shared/CONTRACTS.md` §1

---

### MOD-002 Session Manager

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `session/SESSION-SPEC.md` | `SESSION_CREATED`, `SESSION_READY`, `SESSION_REFRESH`, `SESSION_EXPIRED`, `SESSION_DESTROYED`, `SESSION_ERROR` | `USER_LOGIN`, `PERMISSION_CHANGED`, `ForceLogout` |
| `session/SESSION-LIFECYCLE.md` | — | Auth handoff signals |

→ `shared/CONTRACTS.md` §2

---

### MOD-003 Permissions

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `permissions/PERMISSIONS-SPEC.md` | `ROLE_CHANGED`, `PERMISSION_CHANGED` | `SESSION_CREATED` |
| `events/EVENT-BUS-SPEC.md` §8 | `PERMISSION_CHANGED` (internal) | — |

→ `shared/CONTRACTS.md` §3

---

### MOD-005 API Client

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `api/API-CLIENT-SPEC.md` | `SYSTEM_ERROR` (via Error path) | `SESSION_EXPIRED` (401 ADR) |
| `errors/ERROR-LIFECYCLE.md` | Normalized API errors | — |

---

### MOD-006 Configuration

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `config/CONFIG-LIFECYCLE.md` | `CONFIG_UPDATED` (ADR) | — |
| `errors/ERROR-LIFECYCLE.md` | `CONFIG_ERROR_*` → Error Handler | — |

---

### MOD-007 Theme Manager

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `theme/THEME-EVENTS.md` | `THEME_LOAD_*`, `THEME_DEFAULT_RESOLVED`, `THEME_USER_PREFERENCE_*`, `THEME_SYSTEM_PREFERENCE_FOUND`, `THEME_SWITCH_*`, **`THEME_CHANGED`**, `THEME_FALLBACK_ACTIVATED` | `THEME_SWITCH_REQUESTED` |
| `events/EVENT-BUS-SPEC.md` §9 | **`THEME_CHANGED`** (public #16) | — |

**Consumidores esperados de `THEME_CHANGED`:** Portal Shell, Design System (MOD-008), Components (MOD-009)

---

### MOD-008 Design System

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `design-system/DESIGN-SYSTEM-SPEC.md` | — (reglas visuales; no emisor dominio) | `THEME_CHANGED` (token sync ADR) |

---

### MOD-009 Components Library

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `components/COMPONENT-EVENTS.md` | `COMPONENT_REGISTRY_*`, `COMPONENT_ADDED`, `COMPONENT_DEPRECATED`, `COMPONENT_REMOVED` (internal) | `THEME_CHANGED`, `LANGUAGE_CHANGED`, `FLAGS_UPDATED`, `BREAKPOINT_CHANGED`, `RESPONSIVE_READY` |
| `components/COMPONENT-LIFECYCLE.md` | `COMPONENT_REGISTRY_READY` (internal gate) | — |

---

### MOD-013 Feature Flags

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `feature-flags/FLAG-EVENTS.md` | **`FLAGS_READY`**, **`FLAGS_UPDATED`**, `FLAGS_LOADING`, `FLAGS_INVALIDATED`, `FLAGS_REFRESH`, `FLAGS_FALLBACK`, `FLAGS_ERROR`, `FLAGS_RELOADED` | `CONFIG_UPDATED`, `SYSTEM_READY` |
| `events/EVENT-BUS-SPEC.md` §11 | **`FLAGS_READY`**, **`FLAGS_UPDATED`** (public) | — |

**Gate portal:** no evaluar flags user-facing antes de `FLAGS_READY`.

---

### MOD-016 Responsive Engine

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `responsive/RESPONSIVE-EVENTS.md` | **`RESPONSIVE_READY`**, **`BREAKPOINT_CHANGED`**, **`ORIENTATION_CHANGED`**, `RESPONSIVE_INIT_STARTED`, `VIEWPORT_RESIZED`, `INPUT_MODALITY_CHANGED`, `FOLD_STATE_CHANGED`, `RESPONSIVE_ERROR` | `CONFIG_UPDATED`, `FLAGS_UPDATED`, `PORTAL_READY` (ADR) |
| `events/EVENT-BUS-SPEC.md` §11 | **`RESPONSIVE_READY`**, **`BREAKPOINT_CHANGED`**, **`ORIENTATION_CHANGED`** (public) | — |

---

### MOD-010 Logging

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `logging/LOGGING-SPEC.md` | — (escribe logs, no domain events) | Boot + error events (subscribe ADR) |
| `logging/LOG-LEVELS.md` | — | `SESSION_READY`, `CONFIG_ERROR` |

---

### MOD-011 Notifications

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `notifications/NOTIFICATIONS-SPEC.md` | `NOTIFICATION_CREATED` | Error surface, domain events (via callers) |
| `events/EVENT-BUS-SPEC.md` §9 | `NOTIFICATION_CREATED` (public) | — |
| `notifications/NOTIFICATION-LIFECYCLE.md` | Lifecycle internal events ADR | `LANGUAGE_CHANGED` (re-display ADR) |

---

### MOD-012 Storage

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `storage/STORAGE-LIFECYCLE.md` | `STORAGE_WRITE`, `STORAGE_INVALIDATE`, `STORAGE_QUOTA_WARN` | `SESSION_CREATED`, `SESSION_READY`, `SESSION_DESTROYED` |

---

### MOD-014 Error Handler

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `errors/ERROR-HANDLING-SPEC.md` | `SYSTEM_ERROR`, normalized error surface | All module error signals |
| `errors/ERROR-LIFECYCLE.md` | — | `CONFIG_*`, `PERM_*`, API errors |

---

### MOD-015 Internationalization

| Documento origen | Eventos publicados | Eventos consumidos |
|------------------|-------------------|-------------------|
| `i18n/I18N-EVENTS.md` | **`LANGUAGE_CHANGED`** (public) | `SESSION_READY`, `CONFIG_UPDATED` |
| `events/EVENT-BUS-SPEC.md` §9 | **`LANGUAGE_CHANGED`** (#17) | — |

**No consume:** Permissions, Auth, Theme events.

---

## Eventos públicos cross-portal (catálogo Blueprint)

| Evento | Emisor típico | Documento autoritativo |
|--------|---------------|------------------------|
| `USER_LOGIN` / `USER_LOGOUT` | Auth | `events/EVENT-BUS-SPEC.md` §9 |
| `SESSION_READY` | Session | `session/SESSION-SPEC.md` |
| `SESSION_EXPIRED` | Session | `session/SESSION-SPEC.md` |
| `FLAGS_READY` | Feature Flags | `feature-flags/FLAG-EVENTS.md` |
| `FLAGS_UPDATED` | Feature Flags | `feature-flags/FLAG-EVENTS.md` |
| `RESPONSIVE_READY` | Responsive | `responsive/RESPONSIVE-EVENTS.md` |
| `BREAKPOINT_CHANGED` | Responsive | `responsive/RESPONSIVE-EVENTS.md` |
| `ORIENTATION_CHANGED` | Responsive | `responsive/RESPONSIVE-EVENTS.md` |
| `THEME_CHANGED` | Theme | `theme/THEME-EVENTS.md` |
| `LANGUAGE_CHANGED` | i18n | `i18n/I18N-EVENTS.md` |
| `NOTIFICATION_CREATED` | Notifications | `notifications/NOTIFICATIONS-SPEC.md` |
| `PORTAL_READY` | Portal shell | `events/EVENT-BUS-SPEC.md` §9 |
| `DASHBOARD_READY` | Portal feature | `events/EVENT-BUS-SPEC.md` §9 |
| `ORDER_*` / `PAYMENT_*` | Services (futuro) | Blueprint Operations Core |

---

## Eventos prohibidos (referencia)

→ `events/EVENT-BUS-SPEC.md` §10 — poll pseudo-events, DOM events, credentials in payload.

**Catálogo maestro:** `shared/events/EVENT-BUS-SPEC.md` (fuente oficial única).

---

*EVENT-MAP v2.0 — PHASE-DOC-RECONCILIATION-001 — 2026-07-05*
