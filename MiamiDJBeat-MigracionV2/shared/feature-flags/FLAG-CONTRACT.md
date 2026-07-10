# FLAG-CONTRACT.md

**TICKET-V2-SHARED-CORE-015 — Feature Flags Specification**

**Módulo:** MOD-013 · Contrato de Flag  
**Versión:** 1.0

> Contrato de **definición y resolución** de una Feature Flag. Runtime futuro debe conformarse a este documento.

---

## Estructura de una Flag

| Campo | Req | Tipo | Descripción |
|-------|-----|------|-------------|
| `key` | ✅ | string | Naming rules §Naming |
| `default` | ✅ | boolean | Valor si no resuelve |
| `type` | ✅ | enum | Release · Experimental · … — FLAG-CATEGORIES.md |
| `category` | ✅ | enum | Global · Portal · Module · … |
| `scope` | ✅ | enum | `global` \| `portal` \| `module` |
| `description` | ✅ | string | Ticket ref + propósito |
| `owner` | ✅ | string | PO o architect |
| `moduleId` | ○ | MOD-xxx | Si scope module |
| `portal` | ○ | client \| artist \| staff | Si scope portal |
| `metadata` | ○ | object | Ver §Metadata |
| `expiration` | ○ | ISO date | Auto-fallback post fecha |
| `dependencies` | ○ | string[] | Otras keys requeridas true |
| `version` | ✅ | integer | Schema registry — inicia 1 |
| `environmentRules` | ○ | object | Ver §Environment Rules |
| `rollbackRules` | ○ | object | Ver §Rollback Rules |

---

## Qué puede contener una Flag

| Permitido | Ejemplo |
|-----------|---------|
| Boolean enable/disable | `enabled: true` |
| Ticket reference | `ticket: TICKET-V2-...` |
| Module ID | `moduleId: MOD-202` |
| Portal scope | `portal: artist` |
| Owner PO | `owner: Product Owner` |
| Expiration date | `expiration: 2026-12-31` |
| Dependency keys | `requires: ['flag.MOD-003.snapshot-v2']` |
| Environment allowlist | `prod: false, dev: true` |
| Non-sensitive metadata | `rolloutPhase: beta` |

---

## Qué nunca puede contener

| Prohibido | Razón |
|-----------|-------|
| Passwords · API keys · JWT | Seguridad |
| Role matrix · capabilities list | MOD-003 authority |
| Theme tokens · CSS | MOD-007 |
| Translation strings | MOD-015 |
| PII (email, phone, legal name) | Privacy |
| Payment amounts · card refs | Red zone |
| SQL · HTML · JS source | No runtime en spec |
| Bypass permission directive | `ignoreCapabilities: true` **prohibido** |
| V1 path references | `web/` cutover rules |

---

## Metadata

| Campo metadata | Permitido | Prohibido |
|----------------|-----------|-----------|
| `ticket` | ✅ | — |
| `adr` | ✅ | — |
| `rolloutPhase` | ✅ | user segments PII |
| `notes` | ✅ texto corto | secretos |
| `createdAt` | ✅ ISO | — |
| `updatedAt` | ✅ ISO | — |

---

## Owner

- Toda flag **debe** tener owner PO o architect nombrado.
- Cambio de default en prod → ticket PO + entrada changelog ADR.
- Emergency flags owner = PO únicamente.

---

## Expiration

| Regla | Comportamiento |
|-------|----------------|
| Flag expirada | Resuelve a `default` |
| Log | WARN + `ERR-FLAG-006` si override activo post-expiry |
| Renovación | Nuevo ticket extiende `expiration` |

---

## Dependencies

```
flag.B requires flag.A === true
  → if A false, B resolves false regardless of B config
```

- Dependencias circulares **prohibidas** en registry CI ADR.
- Dependencies **no** sustituyen Permissions.

---

## Default Value

| Contexto | Default |
|----------|---------|
| Feature nueva no released | `false` |
| Infra observability opt-in | `false` |
| Maintenance kill-switch | `false` (= normal ops) |
| Red zone (staff write, billing) | **`false`** — sin excepción |
| Flag desconocida | `false` + WARN |

---

## Environment Rules

| Entorno | Regla |
|---------|-------|
| **dev** | Experimental/Development flags permitidos si registry |
| **staging** | Release flags PO-approved only |
| **prod** | Release + Emergency only; Experimental **false** lock |

Env override: `MDJ_V2_FLAG_{KEY}` — normalizado en CONFIG ENVIRONMENT-RULES ADR.

---

## Rollback Rules

| Escenario | Acción |
|-----------|--------|
| Incident post-enable | Emergency flag → `false` |
| Bad rollout | Release flag → `false` + PO ticket |
| Registry corrupt | FALLBACK all defaults — FLAGS_FALLBACK |
| Remote stale | FLAGS_INVALIDATED → refresh |

Rollback **no** revierte Permissions ni Session — solo feature visibility.

---

## Naming Rules

Formato canónico:

```
flag.{MOD-xxx}.{feature-slug}
flag.global.{name}
flag.portal.{client|artist|staff}.{name}
flag.emergency.{name}
```

| Regla | Detalle |
|-------|---------|
| Lowercase | `flag.mod-202.artist-nav` — slug kebab-case |
| MOD prefix | Module flags incluyen MOD-xxx |
| Sin espacios | UPPER env vars mapean a key |
| Unicidad | Global registry — no duplicar portal-local keys |
| Prohibido | `v1_`, `web_`, `bypass_` prefixes |

---

## Versioning

| Cambio | Acción |
|--------|--------|
| Add optional metadata | `version` igual |
| Change default | `version++` + ADR + PO |
| Rename key | New key + deprecate old — ADR |
| Breaking scope | `version++` + migrate consumers ticket |

Registry export incluye `version` por entry.

---

## Resolución API conceptual (futuro)

```
resolveFlag(key, context?) → { enabled, source, version }
```

- `source`: `env` \| `config` \| `cache` \| `default` \| `emergency`
- Idempotente para mismo boot correlationId

---

*FLAG-CONTRACT v1.0 — TICKET-V2-SHARED-CORE-015*
