# BOOT-SEQUENCE.md

**Ticket:** TICKET-V2-ARCHITECTURE-HANDBOOK-001 · Reconciliado **PHASE-DOC-RECONCILIATION-001**  
**Tipo:** **Fuente oficial única** del orden de boot — sin implementación

> **Regla de precedencia:** Si un `*-SPEC.md` de módulo describe un orden distinto, **este documento manda** para boot global. Los specs de módulo detallan lifecycle interno; no redefinen el orden Core.

---

## Diagrama canónico

```
Configuration
  (+ Error Handler · Logging — registro temprano)
      ↓
Event Bus READY · SYSTEM_READY
      ↓
Authentication
      ↓
Session
      ↓
Permissions
      ↓
Theme  ∥  Internationalization  ∥  Feature Flags
      ↓
Storage  ∥  API Client
      ↓
Responsive  ∥  Components registry
      ↓
Notifications
      ↓
Portal Shell
      ↓
Client / Artist / Staff
```

---

## Fase 0 — Configuration (gate fatal)

| Orden | Módulo | Hito | Fuente detalle |
|-------|--------|------|----------------|
| 0.1 | **Configuration** | Env válido · keys · URLs | `config/CONFIG-LIFECYCLE.md` |
| 0.2 | **Error Handler** | Normalización CONFIG fatal | `errors/ERROR-LIFECYCLE.md` |
| 0.3 | **Logging** | Nivel `MDJ_V2_LOG_LEVEL` | `logging/LOGGING-SPEC.md` |

**Gate:** ERR-0001–ERR-0005 → boot Core abortado.

---

## Fase 1 — Event Bus (antes de emits de dominio)

| Orden | Módulo | Hito | Fuente |
|-------|--------|------|--------|
| 1.1 | **Event Bus** | `BUS_UNINITIALIZED → BUS_READY` | `events/EVENT-BUS-SPEC.md` |
| 1.2 | — | Emite **`SYSTEM_READY`** (internal) | `events/EVENT-LIFECYCLE.md` |

**Regla B-BUS:** Ningún módulo emite eventos de dominio antes de `BUS_READY` (`EVENT-LIFECYCLE.md` P-02).

---

## Fase 2 — Identidad y acceso

| Orden | Módulo | Hito | Fuente |
|-------|--------|------|--------|
| 2.1 | **Authentication** | Probe · restore · ANONYMOUS | `auth/AUTH-LIFECYCLE.md` |
| 2.2 | **Session** | Hydrate · `INITIAL_SESSION` vs `SIGNED_IN` | `session/SESSION-LIFECYCLE.md` |
| 2.3 | **Permissions** | Snapshot capabilities · staff gate | `permissions/PERMISSIONS-SPEC.md` |

**Gate público:** **`SESSION_READY`** antes de surfaces portal (`session/SESSION-SPEC.md`).

Session escucha **`SYSTEM_READY`** antes de restore (`session/SESSION-SPEC.md` §7).

---

## Fase 3 — Preferencias transversales (paralelo permitido)

| Módulo | Hito | Evento gate |
|--------|------|-------------|
| **Theme** | THEME_READY → `THEME_CHANGED` | `theme/THEME-LIFECYCLE.md` |
| **Internationalization** | LANGUAGE READY → `LANGUAGE_CHANGED` | `i18n/LANGUAGE-LIFECYCLE.md` |
| **Feature Flags** | FLAGS_READY | `feature-flags/FEATURE-FLAGS-LIFECYCLE.md` |

**Orden preferido PO:** Theme → i18n → Flags (evita doble re-render shell).  
**Paralelo:** permitido post-`SESSION_READY` si Storage keys no colisionan.

Feature Flags requiere **Event Bus READY** para emitir `FLAGS_*` (`feature-flags/FLAG-EVENTS.md`).

---

## Fase 4 — Persistencia y egress

| Módulo | Hito | Notas |
|--------|------|-------|
| **Storage** | Namespaces `mdj_v2_*` · keys Session | Escucha `SESSION_CREATED` / `SESSION_DESTROYED` |
| **API Client** | Adapter post-Config | Único egress HTTP |

Storage **después** de Session identity estable (keys Session); **no** antes de Fase 2.

---

## Fase 5 — UI Foundation registry

| Módulo | Hito | Fuente |
|--------|------|--------|
| **Responsive** | `RESPONSIVE_READY` | `responsive/RESPONSIVE-SPEC.md` |
| **Components** | `COMPONENT_REGISTRY_READY` | `components/COMPONENT-LIFECYCLE.md` |

Design System (MOD-008) es **documentación de reglas** — no subsistema boot runtime.

---

## Fase 6 — Notifications

| Módulo | Hito |
|--------|------|
| **Notifications** | Suscripción post-`BUS_READY` · `NOTIFICATION_CREATED` |

---

## Fase 7 — Portal

| Superficie | Hito | Evento |
|------------|------|--------|
| **Portal Shell** | Layout · nav · auth gates | `PORTAL_READY` |
| **Features** | Dashboard hidratado | `DASHBOARD_READY` |

**Cadena surface-ready:**

```
SESSION_READY → THEME_CHANGED + LANGUAGE_CHANGED + FLAGS_READY
  → RESPONSIVE_READY → PORTAL_READY → DASHBOARD_READY
```

---

## Reglas transversales

| # | Regla |
|---|-------|
| B-01 | CONFIG fatal → no boot |
| B-02 | Event Bus READY antes de emits dominio |
| B-03 | `SESSION_READY` antes de `PORTAL_READY` |
| B-04 | Error visual Theme/i18n no rompe sesión |
| B-05 | Staff gate → forced signOut (Auth + Session) |
| B-06 | Flags post-Config; emit post-Bus |
| B-07 | Storage post-Session identity |

---

*BOOT-SEQUENCE v2.0 — fuente oficial — PHASE-DOC-RECONCILIATION-001 — 2026-07-05*
