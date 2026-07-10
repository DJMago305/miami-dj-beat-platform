# CONFIG-SPEC.md

**TICKET-V2-SHARED-CORE-006 — Configuration Specification**

**Módulo:** MOD-006 Configuration  
**Ticket:** TICKET-V2-SHARED-CORE-006  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

---

## 1. Responsabilidad del módulo Configuration

Configuration es el **único proveedor de configuración validada** del Shared Core V2.

| Hace | No hace |
|------|---------|
| Define entornos `local`, `staging`, `production` | **No autentica** |
| Expone schema `AppConfig` (conceptual) | **No consulta Supabase** |
| Valida variables al boot | **No renderiza UI** |
| Documenta keys permitidas / prohibidas | **No decide permisos** |
| Coordina defaults y fallbacks | **No contiene secretos en texto plano** en repo |
| Provee hooks a Feature Flags globales de entorno | **No implementa lógica de negocio** |

Todo módulo Core (Auth, Session, API Client, Logging, Theme, Feature Flags) **lee** config; ninguno parsea env directamente salvo ADR.

---

## 2. Entornos oficiales

| Entorno | ID | Uso |
|---------|-----|-----|
| **local** | `local` | Desarrollo lab `MiamiDJBeat-MigracionV2/` · sin tocar V1 prod |
| **staging** | `staging` | Preview V2 aislado · datos no prod o staging Supabase (ADR infra) |
| **production** | `production` | Cutover módulos V2 autorizados PO |

Detalle: **ENVIRONMENT-RULES.md**

Reglas:

- Un build/deploy = **un** entorno activo
- `MDJ_V2_ENV` es la variable canónica de selección
- Prohibido mezclar URLs staging/prod en mismo bundle sin flag explícito

---

## 3. Variables permitidas

Variables **públicas** (safe en `.env.example` y client bundle):

| Variable | Tipo | Entornos | Descripción |
|----------|------|----------|-------------|
| `MDJ_V2_ENV` | enum | all | `local` \| `staging` \| `production` |
| `MDJ_V2_APP_NAME` | string | all | Identificador app lab |
| `MDJ_V2_DEPLOY_ROOT` | path | all | Raíz pública URLs (**sin** `/web/` V1) |
| `MDJ_V2_PORTAL_CLIENT_URL` | url | all | Base portal client |
| `MDJ_V2_PORTAL_ARTIST_URL` | url | all | Base portal artist |
| `MDJ_V2_PORTAL_STAFF_URL` | url | all | Base portal staff |
| `MDJ_V2_DEFAULT_LOCALE` | enum | all | `en` (canónico) |
| `MDJ_V2_DEFAULT_THEME` | enum | all | `dark` |
| `MDJ_V2_LOG_LEVEL` | enum | all | `debug` local · `info` staging/prod |
| `MDJ_V2_API_PUBLIC_URL` | url | all | Supabase project URL (**anon** endpoint base) |
| `MDJ_V2_API_ANON_KEY` | string | all | Supabase **anon** key (pública por diseño Supabase) |
| `MDJ_V2_SESSION_STORAGE` | enum | all | `local` \| `session` \| `cookie` (ADR) |
| `MDJ_V2_REFRESH_BEFORE_MS` | number | all | Umbral refresh Session |
| `MDJ_V2_FEATURE_*` | boolean | per env | Flags globales entorno (ver §6) |

Constantes derivadas (no env, computed at validate):

- `portalIds`: `client`, `artist`, `staff`
- `sessionStorageKeys` prefix: `mdj_v2_session_*`
- `eventBusCatalogVersion`: `1`

---

## 4. Variables prohibidas

| Variable / patrón | Motivo |
|-------------------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; nunca client |
| `*_SECRET`, `*_PRIVATE_KEY` | Secretos |
| Passwords, DB connection strings | Infra |
| `V1_*` overrides | Mezcla V1/V2 |
| URLs con prefijo `/web/` hardcoded | Deploy Vercel root |
| JWT signing secrets | Server Edge only |
| Commits de `.env` con valores reales prod | Gobernanza |

Configuration **rechaza** boot si detecta variables prohibidas en client config load.

---

## 5. Manejo de secretos

| Regla | Detalle |
|-------|---------|
| S-01 | Secretos **nunca** en repo git |
| S-02 | Secretos **nunca** en CONFIG-SPEC valores reales |
| S-03 | Client V2 solo `anon key` — service role solo Edge/server tickets |
| S-04 | `.env.example` — keys sin valores prod; placeholders `YOUR_*` |
| S-05 | CI inject secrets; local `.env.local` gitignored (ticket futuro) |
| S-06 | Log de config al boot **redacta** keys sensibles |
| S-07 | Configuration valida **presencia** de anon key en runtime, no almacena service role |

Flujo conceptual:

```
Env inject (CI/host) → Configuration validate → AppConfig immutable → consumers read
```

---

## 6. Feature flags globales

Flags de **entorno** (distintos de MOD-013 runtime flags):

| Flag env | Default local | Default prod | Descripción |
|----------|---------------|--------------|-------------|
| `MDJ_V2_FEATURE_EVENT_BUS` | true | true | Habilita bus |
| `MDJ_V2_FEATURE_STRICT_CONFIG` | true | true | Fail boot on invalid |
| `MDJ_V2_FEATURE_DEBUG_PANEL` | true | false | Dev only |
| `MDJ_V2_FEATURE_CUTOVER_*` | false | per module | Cutover olas |

Configuration **expone** valores parseados; MOD-013 Feature Flags **consume** para runtime product toggles. No duplicar semántica — env flags = infra; MOD-013 = producto.

---

## 7. Validación de configuración

Al boot (CONFIG-LIFECYCLE):

| Check | Fail action |
|-------|-------------|
| `MDJ_V2_ENV` válido | `CONFIG_ERROR_INVALID_ENV` |
| URLs well-formed | `CONFIG_ERROR_INVALID_URL` |
| Deploy root sin `/web/` | `CONFIG_ERROR_V1_PATH` |
| Required keys present | `CONFIG_ERROR_MISSING_KEY` |
| Prohibited keys absent | `CONFIG_ERROR_FORBIDDEN_KEY` |
| Log level enum | `CONFIG_ERROR_INVALID_LOG_LEVEL` |
| Cross-portal URLs unique per env | warn |

**Strict mode** (`MDJ_V2_FEATURE_STRICT_CONFIG=true`): fail closed → app no boot Core.

---

## 8. Fallbacks

| Key | Fallback |
|-----|----------|
| `MDJ_V2_DEFAULT_LOCALE` | `en` |
| `MDJ_V2_DEFAULT_THEME` | `dark` |
| `MDJ_V2_LOG_LEVEL` | `info` (prod/staging) · `debug` (local) |
| `MDJ_V2_REFRESH_BEFORE_MS` | `300000` (5 min) |
| Missing optional portal URL | derive from `MDJ_V2_DEPLOY_ROOT` + portal path ADR |

Fallback **no** aplica a: `MDJ_V2_ENV`, `MDJ_V2_API_PUBLIC_URL`, `MDJ_V2_API_ANON_KEY` en staging/production — missing = error.

---

## 9. Errores de configuración

| Código | Severidad | UX |
|--------|-----------|-----|
| `CONFIG_ERROR_INVALID_ENV` | fatal | Core no boot |
| `CONFIG_ERROR_MISSING_KEY` | fatal | Core no boot |
| `CONFIG_ERROR_FORBIDDEN_KEY` | fatal | Core no boot |
| `CONFIG_ERROR_INVALID_URL` | fatal | Core no boot |
| `CONFIG_ERROR_V1_PATH` | fatal | Core no boot |
| `CONFIG_ERROR_INVALID_LOG_LEVEL` | recoverable | fallback info + warn |
| `CONFIG_WARN_DERIVED_URL` | warn | log only |

Emit (futuro Event Bus): `SYSTEM_ERROR` con code CONFIG_* en strict mode.

---

## 10. Relación con otros módulos

| Módulo | Relación |
|--------|----------|
| **Auth** MOD-001 | Lee `API_PUBLIC_URL`, redirect URLs; no escribe config |
| **Session** MOD-002 | Lee storage backend, refresh TTL, portal URLs |
| **API Client** MOD-005 | Lee base URL, anon key ref, timeout defaults |
| **Logging** MOD-010 | Lee `LOG_LEVEL`, app name, env |
| **Feature Flags** MOD-013 | Lee env flags + pasa `AppConfig` context |
| **Theme** MOD-007 | Lee `DEFAULT_THEME`; user override vía Session |
| **Permissions** MOD-003 | **Sin** dependencia config permisos — solo env para strict |

Configuration boot **antes** de Session, Event Bus, Auth en orden Core:

```
Configuration validate → SYSTEM_READY path → Event Bus → Session → …
```

---

## AppConfig (conceptual output)

| Sección | Campos |
|---------|--------|
| `env` | local \| staging \| production |
| `deploy` | root, portal URLs |
| `api` | publicUrl, anonKeyRef |
| `session` | storage, refreshBeforeMs |
| `i18n` | defaultLocale |
| `theme` | defaultMode |
| `logging` | level |
| `features` | env flags map |

Read-only después de validate; reload solo en hot-reload local explícito (ADR).

---

## Referencias

- `ENVIRONMENT-RULES.md`
- `CONFIG-LIFECYCLE.md`
- `../CONTRACTS.md` § Configuration (MOD-006)
- Constitución — no deploy sin `APROBADO DEPLOY PRODUCCIÓN`

---

*CONFIG-SPEC v1.0 — TICKET-V2-SHARED-CORE-006 — Sin implementación.*
