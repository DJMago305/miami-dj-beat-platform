# DEPENDENCY-MAP.md

**Ticket:** TICKET-V2-ARCHITECTURE-HANDBOOK-001 · Reconciliado **PHASE-DOC-RECONCILIATION-001**  
**Tipo:** Mapa de dependencias conceptuales — **sin implementación**

> Para cada módulo: qué **puede** y **no puede** depender. Detalle contractual en `shared/CONTRACTS.md` y specs individuales.

---

## Reglas globales

| Regla | Detalle |
|-------|---------|
| **D-01** | Shared Core **nunca** importa desde `client/`, `artist/`, `staff/` |
| **D-02** | Portales consumen Shared Core; no al revés |
| **D-03** | Boot sin ciclos de import: Config → Event Bus READY → Auth → Session (ver `BOOT-SEQUENCE.md`) |
| **D-04** | Permissions es única fuente operativa de capabilities |
| **D-05** | API Client es único egress HTTP/Edge |
| **D-06** | Theme e i18n no se importan mutuamente |

---

## Dependencias circulares prohibidas

| Par prohibido | Razón |
|-------------|-------|
| Auth ↔ Permissions | Auth identidad; Permissions snapshot post-Session |
| Session ↔ Auth (circular) | Session consume handle Auth; Auth delega, no lee Session state |
| Theme ↔ i18n | Concerns separados; coordinación vía Event Bus / Session pref ADR |
| Components → Permissions direct | UI usa capability guards; no lee ROLE-MATRIX |
| Portal → Supabase direct | Todo vía API Client MOD-005 |
| Error Handler → Business modules | Error Handler normaliza; no conoce dominio Orders |

---

## Acoplamiento documental permitido (no import circular runtime)

| Par | Mecanismo | Notas |
|-----|-----------|-------|
| **MOD-008 Design System ↔ MOD-016 Responsive** | Referencia cruzada en specs; coordinación vía `BREAKPOINT_CHANGED` / grid intent | DS define **intent** grid/spacing; Responsive define **authority** breakpoints runtime. **Prohibido** import directo mutuo en código futuro — solo Event Bus + docs. |

---

## Mapa por módulo

### MOD-001 Authentication

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-006 Configuration | MOD-003 Permissions |
| MOD-010 Logging | MOD-009 Components |
| MOD-004 Event Bus (emit) | Portales |
| Provider contract (futuro Supabase) | Session state directo |

→ `auth/AUTH-SPEC.md` · `auth/AUTH-SESSION-BOUNDARY.md`

---

### MOD-002 Session Manager

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-001 Auth (handle) | MOD-003 sin snapshot contract |
| MOD-006 Configuration | UI / Components |
| MOD-012 Storage (persist ref) | Permissions matrix directa |
| MOD-004 Event Bus | API Client (salvo ADR) |

→ `session/SESSION-SPEC.md`

---

### MOD-003 Permissions

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-001, MOD-002 | MOD-009 Components |
| MOD-005 API Client (snapshot RPC) | Theme · i18n |
| MOD-004 Event Bus | Portal shells |

→ `permissions/PERMISSIONS-SPEC.md`

---

### MOD-004 Event Bus

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-006 Configuration | Cualquier portal |
| MOD-010 Logging | Business domain logic |
| MOD-002 (session context meta) | Supabase direct |

→ `events/EVENT-BUS-SPEC.md`

---

### MOD-005 API Client

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-006 Configuration | MOD-003 Permissions (auth header vía Session ADR) |
| MOD-010 Logging | fetch directo fuera del client |
| MOD-014 Error Handler (normalize) | Portal modules |

→ `api/API-CLIENT-SPEC.md`

---

### MOD-006 Configuration

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| — (root config) | Cualquier otro MOD en boot |
| MOD-010 Logging (fatal report) | Session · Auth · Permissions |

→ `config/CONFIG-SPEC.md`

---

### MOD-007 Theme Manager

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-006 Configuration | MOD-015 i18n |
| MOD-012 Storage (pref) | MOD-003 Permissions |
| MOD-004 Event Bus | MOD-009 Components |
| MOD-010 · MOD-014 | `hasCapability()` |

→ `theme/THEME-SPEC.md`

---

### MOD-008 Design System

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-007 Theme (tokens) | Portales |
| MOD-016 Responsive (referencia doc ADR) | Permissions |
| MOD-004 Event Bus (listen `THEME_CHANGED`) | Component render |

→ `design-system/DESIGN-SYSTEM-SPEC.md` · `theme/TOKEN-CONTRACT.md`

---

### MOD-009 Components Library

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-008 Design System | MOD-003 direct |
| MOD-007 tokens (consume) | Supabase |
| MOD-015 i18n keys (render) | Business logic |
| MOD-016 Responsive (layout signals) | Permissions matrix |

→ `components/COMPONENTS-SPEC.md`

---

### MOD-010 Logging

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-006 Configuration | Permissions decisions |
| — | PII sin redacción |

→ `logging/LOGGING-SPEC.md` · `logging/LOG-REDACTION-RULES.md`

---

### MOD-011 Notifications

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-004 Event Bus | Auth direct |
| MOD-005 (indirect via callers) | Supabase direct |
| MOD-014 Error Handler | Permissions bypass |
| MOD-015 i18n keys | UI render |

→ `notifications/NOTIFICATIONS-SPEC.md`

---

### MOD-012 Storage

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-005 (indirect) | Secretos · role matrix |
| MOD-006 namespace config | Payment data |
| Event Bus (listen SESSION_*) | Permissions |

→ `storage/STORAGE-SPEC.md`

---

### MOD-013 Feature Flags

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-006 Configuration | Portales |
| MOD-004 Event Bus | Permissions matrix |
| MOD-012 Storage (cache ADR) | Auth direct |

→ `feature-flags/FEATURE-FLAGS-SPEC.md` · `shared/CONTRACTS.md` §8

---

### MOD-014 Error Handler

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-010 Logging | Business modules |
| MOD-006 Configuration | Portal UI |
| MOD-011 Notifications (surface) | Auth provider |

→ `errors/ERROR-HANDLING-SPEC.md`

---

### MOD-015 Internationalization

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-006 Configuration | MOD-007 Theme |
| MOD-012 Storage (pref ADR) | MOD-003 Permissions |
| MOD-004 Event Bus | Hardcoded UI copy in Core |

→ `i18n/I18N-SPEC.md`

---

### MOD-016 Responsive Engine

| Puede depender de | No puede depender de |
|-------------------|----------------------|
| MOD-008 Design System (grid intent ref) | Permissions |
| MOD-007 tokens (breakpoints ADR) | Portal-specific layout |
| MOD-006 Configuration | Auth / Session direct |
| MOD-004 Event Bus | DOM |

→ `responsive/RESPONSIVE-SPEC.md`

---

## Relaciones transversales

| Relación | Mecanismo | Prohibido |
|----------|-----------|-----------|
| Auth → Session | SessionHandle handoff | Auth lee capabilities |
| Session → Permissions | Trigger snapshot load | Session evalúa staff gate |
| Permissions → Auth | Force signOut signal | Permissions render UI |
| Theme ↔ Shell | `THEME_CHANGED` event | Theme import portal CSS |
| i18n ↔ Shell | `LANGUAGE_CHANGED` event | i18n decide locale sin Session/Config |
| Flags ↔ Shell | `FLAGS_READY`, `FLAGS_UPDATED` | Flags bypass Permissions |
| Responsive ↔ Components | `BREAKPOINT_CHANGED`, `RESPONSIVE_READY` | Responsive evalúa capabilities |
| API → Session | 401 refresh ADR | API Client checks roles |
| Errors → Notifications | userMessageKey | Raw stack to user |
| Storage ↔ Session | Namespace lifecycle | Cross-portal storage |

---

*DEPENDENCY-MAP v2.0 — PHASE-DOC-RECONCILIATION-001 — 2026-07-05*
