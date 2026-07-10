# Shared Core — Contratos Internos

**Ticket:** TICKET-V2-SHARED-CORE-002  
**Proyecto:** MiamiDJBeat-MigracionV2  
**Versión:** 1.1 · Sync **PHASE-DOC-RECONCILIATION-001** (§2 Session)  
**Estado:** Especificación — **sin implementación**  
**Referencia:** Module Catalog MOD-001–016 · System Blueprint · Constitución V2

> Este documento define **contratos escritos** entre módulos del Shared Core.  
> No contiene código, funciones, clases ni servicios reales.

---

## Convenciones globales

| Campo | Significado |
|-------|-------------|
| **Input** | Datos o señales que el módulo consume |
| **Output** | Datos o señales que el módulo produce |
| **Estados** | Valores discretos del ciclo de vida |
| **Errores** | Códigos/conceptos de fallo normalizados → `errors/` |
| **Límites** | Qué queda explícitamente fuera del módulo |

Tipos se describen en pseudoespecificación legible, no en código ejecutable.

---

## 1. Contrato de Auth

**Módulo:** MOD-001 · **Ubicación futura:** `shared/auth/`

### Responsabilidad

Coordinar **identificación** del usuario ante el proveedor de identidad (futuro Supabase Auth): iniciar sesión, cerrar sesión y notificar al Session Manager. **No** decide permisos de negocio ni renderiza UI.

### Input esperado

| Input | Descripción |
|-------|-------------|
| `SignInCredentials` | Email/password, OAuth provider id, o token one-time (según método autorizado) |
| `SignOutRequest` | Opcional: `reason` (`user` \| `forced` \| `staff_gate`) |
| `AuthProviderConfig` | Desde `config/`: url, anon key ref, redirect URLs |
| `PortalContext` | `client` \| `artist` \| `staff` — portal que inició auth |

### Output esperado

| Output | Descripción |
|--------|-------------|
| `AuthResult` | `success` + `sessionHandle` **o** `failure` + `AuthError` |
| `AuthEvent` | Emisión hacia Event Bus: `USER_LOGIN`, `USER_LOGOUT` |
| `SessionDelegate` | Delegación a Session Manager con payload mínimo (user id, tokens ref) |

### Estados posibles

| Estado | Descripción |
|--------|-------------|
| `UNAUTHENTICATED` | Sin sesión válida |
| `AUTHENTICATING` | Operación sign-in en curso |
| `AUTHENTICATED` | Proveedor confirmó identidad; Session Manager aún puede hidratar |
| `SIGNING_OUT` | Limpieza en curso |
| `AUTH_ERROR` | Fallo recuperable o fatal documentado |

### Errores posibles

| Código | Significado |
|--------|-------------|
| `AUTH_INVALID_CREDENTIALS` | Credenciales rechazadas |
| `AUTH_PROVIDER_UNAVAILABLE` | Red / proveedor caído |
| `AUTH_SESSION_EXPIRED` | Token expirado en sign-in refresh |
| `AUTH_PORTAL_MISMATCH` | Portal no autorizado para flujo |
| `AUTH_FORCED_SIGNOUT` | Staff gate o seguridad |

### Qué NO debe hacer Auth

- Resolver rol operativo (`owner`, `seller`, buyer VIP) — → Permissions
- Redirigir a rutas de portal sin Session hidratada
- Confiar `app_metadata.role` sin snapshot DB
- Renderizar HTML de login
- Escribir en Supabase profiles
- Emitir `SIGNED_IN` antes de Session Manager confirmar hydrate

### Límites

Solo identidad. Permisos y navegación post-login son Session + Permissions + portal shell.

---

## 2. Contrato de Session

**Módulo:** MOD-002 · **Ubicación futura:** `shared/session/`  
**Spec canónica:** `session/SESSION-SPEC.md` · Reconciliado **PHASE-DOC-RECONCILIATION-001**

### Responsabilidad

Mantener **estado de sesión en memoria** del cliente V2: usuario actual, portal activo, capabilities ref, expiración, refresh y logout coordinado con Auth y Permissions.

### Input esperado

| Input | Descripción |
|-------|-------------|
| `SessionHandle` | Desde Auth tras sign-in |
| `HydrateRequest` | Boot app: `INITIAL_SESSION` probe |
| `RefreshRequest` | Token próximo a expirar |
| `PortalSwitch` | Cambio explícito de portal (solo si PO autoriza multi-portal same tab) |
| `ForceLogout` | Desde Permissions staff gate |

### Output esperado

| Output | Descripción |
|--------|-------------|
| `SessionSnapshot` | Vista inmutable para consumidores |
| `SessionEvent` | `SESSION_CREATED`, `SESSION_READY`, `SESSION_REFRESH`, `SESSION_EXPIRED`, `SESSION_DESTROYED`, `SESSION_ERROR` |
| `CurrentUserRef` | `userId`, `email?`, `mdjbId?` |

> **Nota reconciliación:** `SESSION_HYDRATED` no es evento canónico — usar `SESSION_CREATED` (internal) + `SESSION_READY` (public gate).

### Campos del SessionSnapshot

| Campo | Tipo conceptual | Descripción |
|-------|-----------------|-------------|
| `user` | `UserRef \| null` | Usuario actual (Auth handle) |
| `portal` | `client \| artist \| staff` | Portal activo en shell |
| `role` | `RoleRef[]` | Etiquetas post-Permissions — **no** usar para gates |
| `capabilities` | `string[]` | **Fuente para guards** (`hasCapability`) |
| `locale` | `en \| es` | Pref i18n sincronizado |
| `theme` | `dark \| light` | Pref theme sincronizado |
| `featureFlags` | `Record<string, boolean>` | Subset efectivo sesión |
| `sessionId` | `string` | Correlación interna |
| `expiresAt` | `timestamp \| null` | Expiración access token |
| `hydrationPhase` | `initial \| signed_in \| none` | Distingue INITIAL_SESSION vs SIGNED_IN |
| `state` | S-01…S-09 | Estado máquina — ver `SESSION-STATE-MACHINE.md` |
| `snapshotVersion` | integer | Bump en `PERMISSION_CHANGED` |
| `updatedAt` | ISO 8601 | Última mutación snapshot |

### Estados posibles

Estados discretos **S-01…S-09** documentados en `session/SESSION-STATE-MACHINE.md`. Resumen legacy: `EMPTY` → `HYDRATING` → `ACTIVE` → `REFRESHING` → `EXPIRED` → `TERMINATED`.

### Refresh

- Input: umbral configurable (`refreshBeforeExpiryMs`)
- Output: nuevo `expiresAt` o `SESSION_EXPIRED`
- **Un solo refresh concurrente**; demás callers esperan mismo resultado
- Fallo refresh → `EXPIRED` + evento; no loop infinito

### Logout

- Input: `LogoutReason`
- Output: estado terminal, `SESSION_DESTROYED`, limpieza storage session
- Staff gate failure → logout **obligatorio** + redirect contract to portal config

### Errores posibles

| Código | Significado |
|--------|-------------|
| `SESSION_HYDRATE_FAILED` | No se pudo leer sesión inicial |
| `SESSION_REFRESH_FAILED` | Refresh rechazado |
| `SESSION_ROLE_PENDING` | User ok; Permissions snapshot aún no cargado |

### Límites

- No cachear permisos de negocio más allá de snapshot version id
- No almacenar service role keys
- No decidir UI routes — portales consumen snapshot

---

## 3. Contrato de Permissions

**Módulo:** MOD-003 · **Ubicación futura:** `shared/permissions/`

### Responsabilidad

Traducir identidad + datos DB (snapshot RPC) en **capabilities** por portal. **Denegación por defecto.**

### Input esperado

| Input | Descripción |
|-------|-------------|
| `userId` | Desde Session |
| `portal` | Portal activo |
| `AccessSnapshotRequest` | Opcional: force refresh |
| `ActionDescriptor` | `{ resource, action, context? }` para guard puntual |

### Output esperado

| Output | Descripción |
|--------|-------------|
| `AccessSnapshot` | Roles, tiers, flags staff, mdjb id |
| `GuardResult` | `allow` \| `deny` + `reasonCode` |
| `CapabilityList` | Set resuelto para UI (ocultar vs deshabilitar — decisión portal) |

### Roles (conceptual)

| Rol | Principal | MDJB suffix |
|-----|-----------|-------------|
| Buyer | `buyer` | C |
| Performer | `performer` | A |
| Staff seller | `staff` | S |
| Staff management | `staff` + management flag | M |

Staff operativo: `is_staff()` · Escritura producción: `is_staff_management()`.

### Capabilities (ejemplos)

| Capability | Portales |
|------------|----------|
| `client.orders.read` | client |
| `artist.profile.write.own` | artist |
| `artist.sft.use` | artist + PRO gate |
| `staff.leads.read` | staff |
| `staff.invoices.write` | staff management only |

### Reglas por portal

| Portal | Regla base |
|--------|------------|
| **client** | Solo recursos buyer; nunca staff write |
| **artist** | Recursos performer propios; SFT requiere capability PRO |
| **staff** | Non-staff → deny all + force logout contract |

### Denegación por defecto

- Sin snapshot cargado → **deny** acciones protegidas
- Acción no listada en capability map → **deny**
- Conflicto JWT vs snapshot → snapshot gana; log `PERM_SNAPSHOT_CONTRADICTION`

### Errores posibles

| Código | Significado |
|--------|-------------|
| `PERM_SNAPSHOT_UNAVAILABLE` | RPC/red falló |
| `PERM_DENIED` | Guard deny normal |
| `PERM_STAFF_GATE_FAILED` | No staff en staff portal |
| `PERM_MANAGEMENT_REQUIRED` | Seller intentó write management |

### Límites

- No mutar RLS ni DB
- No renderizar UI
- Red zone writes UI solo si `is_staff_management` true en snapshot

---

## 4. Contrato de Event Bus

**Módulo:** MOD-004 · **Ubicación futura:** `shared/events/`

### Responsabilidad

Transporte **tipado** de eventos internos V2 con contrato emit/listen, idempotencia donde aplique, catch-up si emit precede listener.

### Formato estándar de evento

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `name` | ✅ | string UPPER_SNAKE (catálogo Blueprint) |
| `payload` | ✅ | objeto serializable; schema por evento |
| `emitter` | ✅ | `{ moduleId, portal? }` |
| `timestamp` | ✅ | ISO 8601 UTC |
| `correlationId` | opcional | traza cross-module |
| `version` | ✅ | `1` inicial; breaking → ADR |

### Emisor

- Debe registrar evento en catálogo antes de emitir (Blueprint + Module Catalog)
- **Un emisor autorizado por evento** salvo ADR
- Surface-ready events (`ARTIST_NAV_READY`): emit **solo** cuando gates del emisor cumplen

### Listener

- Registro: `on(name, handler, options?)`
- Options: `once: true` para reorder/nav único
- Catch-up: si `__mdjV2EventEmitted[name]` antes de register → invocar handler una vez
- Handler idempotente cuando `once` no aplica

### Payload (reglas)

- Sin funciones, DOM nodes, secrets
- Máximo tamaño documentado por evento (default 64KB conceptual)
- PII mínima necesaria

### Timestamps

- Generados en emit; no confiar reloj listener para orden crítico — usar sequence si necesario (ADR)

### Errores posibles

| Código | Significado |
|--------|-------------|
| `EVENT_UNKNOWN` | Nombre no catalogado |
| `EVENT_PAYLOAD_INVALID` | Schema fail |
| `EVENT_HANDLER_THROW` | Handler error; log + no silenciar en dev |
| `EVENT_DUPLICATE_EMIT` | Violación once contract |

### Límites

- **Prohibido** poll/MutationObserver para nav reorder — usar eventos surface-ready
- No eventos cross-portal que muten otro portal directamente
- No reemplazar API request/response síncronos por eventos sin ADR

---

## 5. Contrato de API Client

**Módulo:** MOD-005 · **Ubicación futura:** `shared/api/`

### Responsabilidad

Único punto de **salida HTTP/RPC/Edge** del Shared Core hacia backend (futuro Supabase). Normaliza request/response/error.

### Request

| Campo | Descripción |
|-------|-------------|
| `method` | GET \| POST \| RPC \| EDGE |
| `path` | Sin prefijo `/web/`; deploy root desde config |
| `headers` | Auth bearer desde Session; content-type |
| `body` | JSON serializable |
| `timeoutMs` | Default desde config |
| `retryPolicy` | Opcional; ver retry |

### Response

| Campo | Descripción |
|-------|-------------|
| `ok` | boolean |
| `status` | HTTP code |
| `data` | parsed body si ok |
| `error` | normalized `ApiError` si !ok |
| `durationMs` | métrica |

### Error

| Campo | Descripción |
|-------|-------------|
| `code` | `API_NETWORK` \| `API_HTTP` \| `API_PARSE` \| `API_TIMEOUT` |
| `message` | human optional |
| `detail` | desde body Edge (`error`, `detail`) — **obligatorio surfacing** |
| `status` | HTTP si aplica |

HTTP ≠ 200 → **nunca** asumir `{ url }` u otro shape sin validar.

### Retry

- Solo idempotent GET o métodos marcados `retrySafe: true` en ADR
- Backoff: 100ms, 300ms, 900ms (max 3) default
- No retry en 401/403 salvo refresh session flow coordinado

### Timeout

- Default 30s Edge; 15s RPC (configurable)
- Timeout → `API_TIMEOUT`; no hang infinito

### Límites

- No SQL directo desde portales — solo vía API Client
- No anon key en logs
- No bypass Permissions para staff writes

---

## 6. Contrato de Logging

**Módulo:** MOD-010 · **Ubicación futura:** `shared/logging/`

### Responsabilidad

Registro estructurado para diagnóstico y audit trail cliente (no reemplaza staff audit server).

### Niveles

| Nivel | Uso |
|-------|-----|
| `debug` | Dev/diag only |
| `info` | Flujos normales |
| `warn` | Degradación recuperable |
| `error` | Fallo requiere atención |
| `critical` | Seguridad / integridad |

### Contexto

Cada entrada incluye:

| Campo | Descripción |
|-------|-------------|
| `level` | Nivel |
| `moduleId` | MOD-xxx |
| `portal` | si aplica |
| `correlationId` | si aplica |
| `message` | string |
| `meta` | objeto redacted |

### Eventos críticos (siempre log)

- `PERM_STAFF_GATE_FAILED`
- `AUTH_FORCED_SIGNOUT`
- `API_HTTP` 5xx en red zone call
- `EVENT_HANDLER_THROW`
- Contradicción JWT vs snapshot

### Eventos prohibidos (nunca log)

- Passwords, tokens completos, service keys
- PAN tarjetas, CVV
- Contenido completo PII innecesario

Redacción automática de campos `password`, `token`, `authorization`.

### Límites

- No UI
- No sustituir Error Handler user messages
- Prod default level `info`; `debug` off

---

## 7. Contrato de Error Handling

**Módulo:** MOD-014 · **Ubicación futura:** `shared/errors/`

### Responsabilidad

Clasificar errores y definir **superficie segura** hacia usuario vs diagnóstico interno.

### Errores técnicos

| Tipo | Usuario ve | Log |
|------|------------|-----|
| Bug / throw | Mensaje genérico i18n | stack + correlationId |
| Config missing | "Service unavailable" | critical |

### Errores de usuario

| Tipo | Usuario ve | Log |
|------|------------|-----|
| Validación form | Mensaje específico | info |
| Credenciales | Auth message | warn |

### Errores de permisos

| Tipo | Usuario ve | Acción |
|------|------------|--------|
| Deny normal | "Not allowed" / redirect | info |
| Staff gate | Sign out + public entry | warn + forced logout |

### Errores de red

| Tipo | Usuario ve | Retry |
|------|------------|-------|
| Offline | Offline message | portal decide |
| Timeout | Timeout message | API Client retry policy |
| 5xx | Generic + detail si Edge provee | limitado |

### Input / Output

- **Input:** `unknown` error + `ErrorContext`
- **Output:** `NormalizedError` { `category`, `userMessageKey`, `logEntry`, `recoverable` }

### Límites

- No tragar errores silenciosamente
- No exponer stack en prod UI
- Siempre preferir `detail` Edge cuando exista (checkout, etc.)

---

## 8. Contrato de Feature Flags

**Módulo:** MOD-013 · **Ubicación futura:** `shared/feature-flags/`

### Responsabilidad

Toggles controlados PO para módulos, cutover y rollback sin redeploy completo (cuando infra lo permita).

### Definición

| Campo | Descripción |
|-------|-------------|
| `key` | `flag.MOD-202.artist-nav` |
| `default` | boolean |
| `scope` | `global` \| `portal` \| `module` |
| `description` | ticket ref |
| `owner` | PO |

### Lectura

- Input: `key`, optional `{ portal, userId }`
- Output: `enabled: boolean`
- Cache TTL corto (60s default); invalidate on config change

### Scope

- Global: afecta todo V2 lab
- Portal: solo client | artist | staff shell
- Module: MOD-xxx boundary

### Fallback

- Flag desconocido → **default** documentado (usualmente `false` para features nuevas)
- Flag service down → **default** + log warn; no crash app
- **Nunca** fallback true para red zone staff writes

### Límites

- No bypass Permissions
- Nuevo flag requiere entrada catálogo o ADR
- No flags V1 en `web/`

---

## 9. Contrato de Theme

**Módulo:** MOD-007 · **Ubicación futura:** `shared/theme/`

### Responsabilidad

Tokens visuales Miami DJ Beat V2 lab: dark surfaces, gold accent, tipografía de marca — sin layouts de portal.

### Tokens

| Categoría | Ejemplos conceptuales |
|-----------|----------------------|
| Color | `--mdj-bg`, `--mdj-gold`, `--mdj-text` |
| Space | `--mdj-space-sm` … `--mdj-space-xl` |
| Type | `--mdj-font-display`, `--mdj-font-body` |
| Radius / shadow | `--mdj-radius`, `--mdj-shadow` |

### Modo

| Modo | Estado inicial |
|------|----------------|
| `dark` | Default brand |
| `light` | Solo si ADR + PO |

Cambio → evento `THEME_CHANGED`.

### Branding

- Alineado identidad Miami DJ Beat
- No import `web/styles.css` / `header-unified.css`

### Accesibilidad

- Contraste mínimo WCAG AA para texto primary on bg
- Focus visible en componentes Design System
- No depender solo de color para estado error

### Input / Output

- **Input:** `setMode`, `applyTokens`
- **Output:** CSS variables map / token object; evento theme

### Límites

- No nav geometry (12ch, underline) — responsive + portal nav tickets
- No page-specific overrides aquí

---

## 10. Contrato de i18n

**Módulo:** MOD-015 · **Ubicación futura:** `shared/i18n/`

### Responsabilidad

Localización: **inglés canónico**, español secundario, fallback entre locales, keys compartidas Core.

### Idioma actual

- Input: `setLocale(locale)` · browser detect on boot
- Output: `activeLocale: 'en' | 'es'`
- Persist: localStorage key documentado (futuro)
- Cambio → `LANGUAGE_CHANGED`

### Fallback

1. Key en `activeLocale`
2. Key en `en`
3. Key string literal o `[missing:key]` en dev

### Keys

- Formato: `snake_case` dot notation: `error.network.timeout`
- EN first en catálogo; ES sigue
- Core keys solo transversales; copy de portal en portal bundles

### Interpolación

- Placeholders: `{name}`, `{count}`
- Escapar HTML en output default
- Plural rules documentadas por ADR si necesario

### Input / Output

- **Input:** `key`, `params?`, `locale?`
- **Output:** `string` traducida

### Límites

- No legal copy sin revisión PO
- Shell HTML hardcoded labels (anti empty nav flash) vive en portal tickets, no reemplazado solo por i18n async
- No copiar `translations.js` V1

---

## Matriz de dependencias entre contratos

```
config ──► auth ──► session ──► permissions
              │         │
              └────┬────┘
                   ▼
              event bus ◄── theme, i18n
                   │
              api client ◄── logging, errors
                   │
              services (futuro)
```

---

## Reglas de implementación futura (TICKET-V2-SHARED-CORE-005+)

1. Implementar **un contrato por ticket** referenciando MOD-xxx.
2. Tests de contrato antes de integrar portales.
3. Romper contrato → ADR + bump `version` en eventos afectados.
4. Sin código en este documento hasta ticket explícito.

---

*Shared Core Contracts v1.0 — 2026-07-05 — TICKET-V2-SHARED-CORE-002*

*Sin implementación funcional. Event Bus spec → TICKET-V2-SHARED-CORE-003. Permissions spec → TICKET-V2-SHARED-CORE-004. Runtime → TICKET-V2-SHARED-CORE-005+.*
