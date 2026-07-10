# FEATURE-FLAGS-SPEC.md

**TICKET-V2-SHARED-CORE-015 — Feature Flags Specification**

**Módulo:** MOD-013 Feature Flags  
**Ticket:** TICKET-V2-SHARED-CORE-015  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Autoridad única para **definir, resolver y distribuir Feature Flags** en MiamiDJBeat-MigracionV2.  
> **No** activa funcionalidades en runtime · **No** sustituye Configuration · **No** decide permisos.

---

## 1. Propósito

Centralizar toggles controlados por Product Owner para cutover modular, experimentos, mantenimiento y rollback sin redeploy completo (cuando infra lo permita). Flags documentan **qué puede estar encendido**; Permissions documentan **quién puede actuar**.

---

## 2. Scope

| Incluye | Descripción |
|---------|-------------|
| Flag registry conceptual | Tipos, categorías, naming — FLAG-CONTRACT.md |
| Resolución | env → config → cache → default |
| Lifecycle | 9 estados — FEATURE-FLAGS-LIFECYCLE.md |
| Eventos | FLAGS_* — FLAG-EVENTS.md |
| Storage rules | `mdj_v2_flag_*` — FLAG-STORAGE-RULES.md |
| Errores | ERR-FLAG-001–010 — FLAG-ERRORS.md |
| Seguridad documental | No bypass red zone |
| Bootstrap position | Post-Config · pre-portal features |

---

## 3. Non-scope

| Excluye | Responsable |
|---------|-------------|
| Permisos / capabilities | MOD-003 Permissions |
| Auth / identity | MOD-001 Authentication |
| Session state | MOD-002 Session Manager |
| Env keys base | MOD-006 Configuration *(Flags consume, no duplican)* |
| Event transport | MOD-004 Event Bus |
| Theme / tokens | MOD-007 Theme Manager |
| Traducciones | MOD-015 i18n |
| Componentes / CSS / HTML | MOD-008 · MOD-009 |
| Lógica de negocio Orders/Payments | Services / portales |
| SDK runtime | Futuro ticket implementación |
| Backend Supabase flags table | Futuro ADR — no en este ticket |
| `web/` V1 | Prohibido |

---

## 4. Responsabilidades

| Hace | No hace |
|------|---------|
| Define contrato de flag | Implementa `isEnabled()` runtime |
| Resuelve `enabled: boolean` por key + context | Bypass `hasCapability()` |
| Emite FLAGS_READY / FLAGS_UPDATED | Autentica usuarios |
| Cache TTL documentado | Escribe theme prefs |
| Fallback seguro (default false red zone) | Contiene Translation Keys |
| Rollback rules documentadas | Renderiza UI |
| Invalidación post CONFIG_UPDATED | Decide portal access |

---

## 5. Tipos de Feature Flags

Detalle ampliado: **FLAG-CATEGORIES.md**

| Tipo | Uso | Default típico |
|------|-----|----------------|
| **Release Flags** | Gradual rollout módulo catalogado | `false` hasta PO cutover |
| **Experimental Flags** | Features no productivas | `false` |
| **Development Flags** | Solo lab / dev env | `false` en prod ADR |
| **Emergency Flags** | Kill-switch incidente | `false` = feature off |
| **Portal Flags** | Shell Client · Artist · Staff | por portal |
| **Module Flags** | Boundary MOD-xxx | `false` hasta spec+PO |
| **Infrastructure Flags** | Bus, logging verbosity ADR | conservador |
| **Maintenance Flags** | Modo mantenimiento read-only | `false` |

---

## 6. Categorías de resolución

| Categoría | Scope resolución |
|-----------|------------------|
| **Global** | Todo lab V2 |
| **Portal** | `client` \| `artist` \| `staff` |
| **Module** | MOD-xxx boundary |
| **Feature** | Sub-capacidad dentro de módulo |
| **Experiment** | Cohort / % futuro ADR |
| **Environment** | dev · staging · prod |
| **User Preference** | Opt-in UI futuro — **no** permisos |
| **Emergency** | Override PO — audit obligatorio |

---

## 7. Resolución

Orden de precedencia (mayor gana salvo Emergency ADR):

```
1. Emergency override (PO ticket)
2. Environment lock (prod deny experimental)
3. Runtime remote refresh (futuro — API ADR)
4. Config static (MOD-006)
5. Env var MDJ_V2_FLAG_*
6. Registry default
7. Hard fallback: false (features nuevas · red zone)
```

**Input conceptual:** `{ key, portal?, moduleId?, env? }`  
**Output conceptual:** `{ enabled: boolean, source, version? }`

---

## 8. Bootstrap

Posición en boot (Architecture Handbook `BOOT-SEQUENCE.md`):

```
Configuration READY
  → Feature Flags LOADING
  → RESOLVING (env + config registry)
  → FLAGS_READY
  → Event Bus accepts portal feature gates
```

Flags **no** bloquean Auth/Session/Permissions si fallan — fallback + warn log.

---

## 9. Configuración

| Fuente | Ejemplo | Authority |
|--------|---------|-----------|
| Env | `MDJ_V2_FLAG_MOD_202_ARTIST_NAV=true` | MOD-006 keys |
| Config bundle | `flags.registry[]` | CONFIG-SPEC ADR |
| Remote | Futuro Edge — ticket separado | PO + ADR |

Configuration define **keys y defaults**; Feature Flags **resuelve** lectura unificada.

---

## 10. Storage

→ **FLAG-STORAGE-RULES.md**  
Namespace `mdj_v2_flag_*` · cache local TTL 60s default · sin secretos.

---

## 11. Eventos

→ **FLAG-EVENTS.md** — 8 eventos FLAGS_*  
`FLAGS_READY` gate para portal modules que consultan flags en boot.

---

## 12. Errores

→ **FLAG-ERRORS.md** — ERR-FLAG-001–010  
Normalización hacia MOD-014 Error Handler — banda reservada ERR-000x ext ADR.

---

## 13. Seguridad

| Regla | Detalle |
|-------|---------|
| S-01 | Flag **nunca** grant staff write sin Permissions |
| S-02 | Red zone flags default **false** |
| S-03 | No PII en flag payload / metadata |
| S-04 | No secretos en flag values |
| S-05 | Emergency flag change → log CRITICAL + ticket ref |
| S-06 | Unknown flag → default + WARN — no throw boot |
| S-07 | Flag true + capability false → **capability wins** |

---

## 14. Dependencias permitidas

| Módulo | Uso |
|--------|-----|
| MOD-006 Configuration | Registry defaults · env keys |
| MOD-010 Logging | WARN/ERROR resolution |
| MOD-004 Event Bus | Emit FLAGS_* |
| MOD-012 Storage | Cache persist optional |
| MOD-014 Error Handler | Normalize ERR-FLAG |

---

## 15. Dependencias prohibidas

| Módulo | Razón |
|--------|-------|
| MOD-003 Permissions | Capability authority separada |
| MOD-001 Auth | Identidad separada |
| MOD-007 Theme | Concern visual |
| MOD-015 i18n | Copy separada |
| Portales definiendo flags duplicados | Single registry |
| `web/` | V1 |

---

## 16. Anti-patterns prohibidos

| Anti-pattern | Por qué |
|--------------|---------|
| `if (flag) skip hasCapability()` | Red zone breach |
| Flag en HTML/CSS | No UI en Core |
| Hardcoded flag map en portal | Duplicación registry |
| Flag true por defecto en pagos/staff | Seguridad |
| Usar flag como i18n locale | MOD-015 authority |
| Usar flag como theme mode | MOD-007 authority |
| Poll flag cada render | Cache + event FLAGS_UPDATED |
| V1 feature toggle en `web/` | Cutover documentado V2 only |

---

## 17. Integración futura

| Consumidor | Patrón |
|------------|--------|
| Portal Shell | `isEnabled('flag.MOD-101.client-shell')` post-FLAGS_READY |
| Module features | Check module flag before lazy load ADR |
| Design System | Optional infra flag — no tokens |
| Remote config | API Client fetch — ticket + ADR |
| CI | Lint unknown keys vs registry |

Runtime implementation → ticket separado post-PO gate.

---

## 18. Relación con CONTRACTS.md

Alineado `shared/CONTRACTS.md` §8. Este spec **expande** el contrato transversal sin modificar CONTRACTS en este ticket.

---

## 19. Criterios de aceptación documental

- [x] 8 documentos en `shared/feature-flags/`
- [x] 9 lifecycle states tabulados
- [x] 8 eventos documentados
- [x] 10 errores ERR-FLAG
- [x] Sin código · sin V1 · sin Supabase

---

*FEATURE-FLAGS-SPEC v1.0 — TICKET-V2-SHARED-CORE-015*
