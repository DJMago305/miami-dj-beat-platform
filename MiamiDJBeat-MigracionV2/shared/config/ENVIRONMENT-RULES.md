# ENVIRONMENT-RULES.md

**TICKET-V2-SHARED-CORE-006 — Configuration Specification**

**Módulo:** MOD-006 · Reglas por entorno  
**Versión:** 1.0

---

## Entornos definidos

| # | Entorno | Propósito |
|---|---------|-----------|
| 1 | **local** | Desarrollo en máquina; lab V2 aislado de V1 prod |
| 2 | **staging** | Preview integrado; QA PO pre-cutover |
| 3 | **production** | Usuarios reales en módulos V2 migrados |

Variable selector: **`MDJ_V2_ENV`**

---

## local

| Aspecto | Regla |
|---------|-------|
| V1 | **No modificar** `web/` prod; local V1 en puerto 8080 separado de lab V2 |
| Supabase | Proyecto dev/staging recomendado — no prod writes sin PO |
| Log level | `debug` permitido |
| Secrets | `.env.local` gitignored (ticket futuro) |
| URLs | `http://localhost:*` paths lab ADR |
| Feature flags | `DEBUG_PANEL=true` default |
| Strict config | `true` recomendado |

---

## staging

| Aspecto | Regla |
|---------|-------|
| Deploy | URL preview Vercel/host separada de miamidjbeat.com V1 |
| Supabase | Staging project o read-only prod — ADR infra |
| Log level | `info` |
| Secrets | CI/CD inject only |
| Cutover rehearsal | `MDJ_V2_FEATURE_CUTOVER_*` toggles QA |
| PO UAT | Obligatorio antes prod cutover |

---

## production

| Aspecto | Regla |
|---------|-------|
| Deploy | Solo con **`APROBADO DEPLOY PRODUCCIÓN`** |
| V1 coexistence | V1 sigue en rutas no migradas |
| Log level | `info`; `debug` prohibido |
| Secrets | Host env only; audit access |
| Config change | Ticket + ADR si afecta URLs o flags globales |
| Rollback | Env flags + DNS revert plan |

---

## Matriz entorno × variable

| Variable | local | staging | production |
|----------|-------|---------|------------|
| `MDJ_V2_API_PUBLIC_URL` | dev project | staging project | prod project |
| `MDJ_V2_DEPLOY_ROOT` | `/` lab | preview prefix | prod root |
| `MDJ_V2_LOG_LEVEL` | debug | info | info |
| `MDJ_V2_FEATURE_DEBUG_PANEL` | true | false | false |
| Service role | **never client** | **never client** | **never client** |

---

## Prohibiciones cross-env

| # | Prohibición |
|---|-------------|
| E-01 | Apuntar local a prod Supabase con writes sin PO |
| E-02 | Bundle staging con keys production |
| E-03 | Mezclar deploy root V1 `/web/` en V2 config |
| E-04 | Auto-detect env from hostname sin `MDJ_V2_ENV` en prod |
| E-05 | Silent downgrade strict config en production |

---

## Detección de entorno (runtime futuro)

Orden resolución:

1. `MDJ_V2_ENV` explícito (obligatorio staging/prod)
2. Build-time inject `import.meta.env` / equivalent (ticket stack ADR)
3. **No** inferir prod from URL alone

---

*ENVIRONMENT-RULES v1.0 — 3 entornos — TICKET-V2-SHARED-CORE-006*
