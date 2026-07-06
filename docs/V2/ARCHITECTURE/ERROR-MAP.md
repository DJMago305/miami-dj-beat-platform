# ERROR-MAP.md

**Ticket:** TICKET-V2-ARCHITECTURE-HANDBOOK-001 · Reconciliado **PHASE-DOC-RECONCILIATION-001**  
**Tipo:** Índice maestro de errores — **sin copiar catálogos**

> Catálogos completos, severidades, recovery y reglas de log están en el **documento origen**. Normalización global: `shared/errors/ERROR-HANDLING-SPEC.md`.

---

## Sistema de códigos global

| Aspecto | Documento origen |
|---------|------------------|
| Formato `ERR-{NNNN}` | `errors/ERROR-CATALOG.md` |
| Rangos reservados por categoría | `errors/ERROR-CATALOG.md` §Rangos |
| Severidad y lifecycle | `errors/ERROR-SEVERITY.md`, `errors/ERROR-LIFECYCLE.md` |
| Normalización cross-module | `errors/ERROR-HANDLING-SPEC.md` |

**Catálogo global inicial:** ~40 códigos representativos en `ERROR-CATALOG.md` (ticket 008).

---

## Índice por módulo

| MOD | Módulo | Documento origen | Prefijo local | Cantidad | Banda ERR global |
|-----|--------|------------------|---------------|----------|------------------|
| MOD-006 | Configuration | `errors/ERROR-CATALOG.md` | CONFIG_* | 6 (+ ERR-0010) | ERR-0001–0099 |
| MOD-001 | Authentication | `auth/AUTH-ERRORS.md` | ERR-AUTH-xxx | **10** | ERR-0100–0199 |
| MOD-003 | Permissions | `errors/ERROR-CATALOG.md` | PERM_* | 4 | ERR-0200–0299 |
| MOD-002 | Session | `errors/ERROR-CATALOG.md` | SESSION_* | 4 | ERR-0300–0399 |
| MOD-005 | API Client | `api/API-ERRORS.md` | ApiErrorCode | **8** ERR-050x | ERR-0400–0599 |
| MOD-012 | Storage | `errors/ERROR-CATALOG.md` | STORAGE_* | 3 | ERR-0600–0699 |
| MOD-014 | Error Handler | `errors/ERROR-HANDLING-SPEC.md` | normalize all | — | ERR-0900–0999 |
| MOD-015 | Internationalization | `i18n/I18N-ERRORS.md` | ERR-I18N-xxx | **10** | ERR-0800 (futuro sync) |
| MOD-007 | Theme Manager | `theme/THEME-ERRORS.md` | ERR-THEME-xxx | **10** | Theme band ADR |
| MOD-013 | Feature Flags | `feature-flags/FLAG-ERRORS.md` | ERR-FLAG-xxx | **10** | Flag band ADR |
| MOD-009 | Components | `components/COMPONENT-ERRORS.md` | ERR-COMP-xxx | **10** | Component band ADR |
| MOD-016 | Responsive | `responsive/RESPONSIVE-ERRORS.md` | ERR-RESP-xxx | **10** | Responsive band ADR |
| MOD-008 | Design System | `design-system/DESIGN-SYSTEM-SPEC.md` §Errores | via Theme / ERR visual ADR | — | No runtime emisor |
| MOD-010 | Logging | `logging/LOG-REDACTION-RULES.md` | — | redaction rules | — |
| MOD-011 | Notifications | `notifications/NOTIFICATIONS-SPEC.md` | via Error Handler | — | userMessageKey |
| MOD-004 | Event Bus | `events/EVENT-BUS-SPEC.md` | EVENT_EMIT_REJECTED | log only | — |

---

## Mapping local → global (referencia)

| Módulo | Mapping documentado en |
|--------|-------------------------|
| MOD-001 Auth | `auth/AUTH-ERRORS.md` §Mapping ERR-AUTH → ERR-0100 |
| MOD-015 i18n | `i18n/I18N-ERRORS.md` §Normalización → ERR-080x |
| MOD-007 Theme | `theme/THEME-ERRORS.md` §Normalización |
| MOD-013 Flags | `feature-flags/FLAG-ERRORS.md` §Normalización |
| MOD-009 Components | `components/COMPONENT-ERRORS.md` §Normalización |
| MOD-016 Responsive | `responsive/RESPONSIVE-ERRORS.md` §Normalización |
| MOD-005 API | `api/API-ERRORS.md` §ERR-0500–0599 |

---

## Errores por categoría (puntero a ERROR-CATALOG)

| Rango | Categoría | Módulo authority |
|-------|-----------|------------------|
| ERR-0001–0099 | Configuration / System | MOD-006 |
| ERR-0100–0199 | Authentication | MOD-001 |
| ERR-0200–0299 | Authorization | MOD-003 |
| ERR-0300–0399 | Session | MOD-002 |
| ERR-0400–0499 | Network | MOD-005 |
| ERR-0500–0599 | API | MOD-005 |
| ERR-0600–0699 | Storage | MOD-012 |
| ERR-0700–0799 | Business Rule | Services / portales |
| ERR-0800–0899 | Validation | MOD-015 i18n |
| ERR-0900–0999 | Runtime / Unexpected | MOD-014 |

---

## Reglas transversales (referencia)

| Regla | Fuente |
|-------|--------|
| Error visual no rompe sesión | `theme/THEME-ERRORS.md`, `i18n/I18N-ERRORS.md`, DS rules |
| CONFIG FATAL blocks boot | `errors/ERROR-LIFECYCLE.md` |
| Staff gate → Auth forced signOut | `auth/AUTH-ERRORS.md` §Staff gate |
| HTTP ≠ 200 → ApiError | `api/API-ERRORS.md` |
| No log secrets / JWT / PII | `logging/LOG-REDACTION-RULES.md` |
| userMessageKey → i18n, never raw | `errors/ERROR-HANDLING-SPEC.md` |
| Flags/Responsive/Components local codes | Normalizados vía MOD-014 — ver `*-ERRORS.md` |

---

## Cómo agregar un error nuevo (proceso documental)

1. Registrar en catálogo del módulo (`*-ERRORS.md`)
2. Asignar banda ERR global en `ERROR-CATALOG.md` *(ticket separado si red zone)*
3. ADR si afecta permisos, auth o pagos
4. Actualizar este índice en ticket Handbook revision

---

*ERROR-MAP v2.0 — PHASE-DOC-RECONCILIATION-001 — 2026-07-05*
