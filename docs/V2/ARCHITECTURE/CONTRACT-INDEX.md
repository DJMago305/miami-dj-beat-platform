# CONTRACT-INDEX.md

**Ticket:** TICKET-V2-ARCHITECTURE-HANDBOOK-001 · Reconciliado **PHASE-DOC-RECONCILIATION-001**  
**Tipo:** Índice maestro de contratos — **sin duplicar cláusulas**

> Los contratos escritos son la fuente de verdad para interfaces entre módulos. Contenido completo solo en documento origen.

---

## Contrato transversal principal

| Documento | Ticket | Alcance |
|-----------|--------|---------|
| **`MiamiDJBeat-MigracionV2/shared/CONTRACTS.md`** | TICKET-V2-SHARED-CORE-002 · sync PHASE-DOC-RECONCILIATION-001 | Contratos MOD-001–016 inter-módulo |

### Secciones de CONTRACTS.md

| § | Contrato | MOD | Spec detallada |
|---|----------|-----|----------------|
| 1 | Auth | MOD-001 | `auth/AUTH-SPEC.md` |
| 2 | Session | MOD-002 | `session/SESSION-SPEC.md` |
| 3 | Permissions | MOD-003 | `permissions/PERMISSIONS-SPEC.md` |
| 4 | Event Bus | MOD-004 | `events/EVENT-BUS-SPEC.md` |
| 5 | API Client | MOD-005 | `api/API-CLIENT-SPEC.md` |
| 6 | Logging | MOD-010 | `logging/LOGGING-SPEC.md` |
| 7 | Error Handling | MOD-014 | `errors/ERROR-HANDLING-SPEC.md` |
| 8 | Feature Flags | MOD-013 | `feature-flags/FEATURE-FLAGS-SPEC.md` · `feature-flags/FLAG-CONTRACT.md` |
| 9 | Theme | MOD-007 | `theme/THEME-SPEC.md` |
| 10 | i18n | MOD-015 | `i18n/I18N-SPEC.md` |

---

## Contratos de módulo (especializados)

| Documento | MOD | Ticket | Propósito |
|-----------|-----|--------|-----------|
| `auth/AUTH-PROVIDER-CONTRACT.md` | MOD-001 | 012 | Proveedor identidad (Supabase futuro) |
| `auth/AUTH-SESSION-BOUNDARY.md` | MOD-001 ↔ MOD-002 | 012 | Límite Auth/Session handoff |
| `api/REQUEST-RESPONSE-CONTRACT.md` | MOD-005 | 010 | Shape request/response HTTP/Edge |
| `theme/TOKEN-CONTRACT.md` | MOD-007 | 014 | brand · semantic · portal tokens |
| `i18n/TRANSLATION-CONTRACT.md` | MOD-015 | 013 | Translation keys · namespaces |
| `feature-flags/FLAG-CONTRACT.md` | MOD-013 | 015 | Flag key schema · scope · fallback |
| `components/COMPONENT-CONTRACT.md` | MOD-009 | 017 | Props contract · registry |
| `design-system/VISUAL-TOKENS.md` | MOD-008 | 016 | Token consumption rules |
| `responsive/RESPONSIVE-RULES.md` | MOD-016 | 018 | Breakpoint · layout contract |

---

## Contratos de política (reglas, no interfaces)

| Documento | MOD | Tema |
|-----------|-----|------|
| **`docs/V2/PROFILE-TAXONOMY.md`** | pre-003 | Client · Staff · Artist subtipos recuperables (TICKET-V2-PROFILE-TAXONOMY-001) |
| `permissions/ACCESS-RULES.md` | MOD-003 | Guards y capability checks |
| `permissions/ROLE-MATRIX.md` | MOD-003 | Matriz roles (referencia DB) |
| `permissions/CAPABILITY-CATALOG.md` | MOD-003 | Catálogo capabilities |
| `storage/STORAGE-NAMESPACE-RULES.md` | MOD-012 | Namespaces `mdj_v2_*` |
| `storage/CACHE-POLICY.md` | MOD-012 | TTL e invalidación |
| `theme/THEME-STORAGE-RULES.md` | MOD-007 | Pref storage `mdj_v2_theme_*` |
| `feature-flags/FLAG-STORAGE-RULES.md` | MOD-013 | Cache flags · invalidación |
| `i18n/LOCALE-RULES.md` | MOD-015 | Locale resolution rules |
| `i18n/FALLBACK-STRATEGY.md` | MOD-015 | EN canonical · ES fallback |
| `config/ENVIRONMENT-RULES.md` | MOD-006 | Env keys por entorno |
| `logging/LOG-REDACTION-RULES.md` | MOD-010 | PII / secrets prohibidos en log |
| `events/EVENT-NAMING-STANDARD.md` | MOD-004 | Nomenclatura eventos |
| `api/API-RETRY-TIMEOUT-RULES.md` | MOD-005 | Retry/timeout policy |
| `notifications/DELIVERY-CHANNELS.md` | MOD-011 | Canales de entrega |
| `notifications/NOTIFICATION-TYPES.md` | MOD-011 | Tipos oficiales |
| `theme/THEME-ACCESSIBILITY.md` | MOD-007 | Reglas contraste / motion |
| `design-system/DESIGN-RULES.md` | MOD-008 | Reglas visuales transversales |
| `responsive/BREAKPOINT-STRATEGY.md` | MOD-016 | Breakpoints authority |

---

## Jerarquía de resolución de conflictos

```
Constitución > ADR (DECISIONS.md) > Blueprint > CONTRACTS.md > *-CONTRACT.md módulo > README
```

→ `MIAMIDJBEAT-PROYECTO-CONSTITUCION.md`

---

## Relación con Architecture Handbook

| Handbook doc | Contratos que indexa |
|--------------|---------------------|
| DEPENDENCY-MAP | Interfaces implícitas en CONTRACTS |
| EVENT-MAP | Event Bus + *-EVENTS.md |
| ERROR-MAP | Error Handling + *-ERRORS.md |
| BOOT-SEQUENCE | Orden de activación contractual — **fuente oficial boot** |

---

*CONTRACT-INDEX v2.0 — PHASE-DOC-RECONCILIATION-001 — 2026-07-05*
