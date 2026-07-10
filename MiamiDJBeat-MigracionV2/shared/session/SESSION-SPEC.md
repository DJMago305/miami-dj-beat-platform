# SESSION-SPEC.md

**TICKET-V2-SHARED-CORE-005 — Session Manager Specification**

**Módulo:** MOD-002 Session Manager  
**Ticket:** TICKET-V2-SHARED-CORE-005  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

---

## 1. Responsabilidad del Session Manager

El Session Manager es la **única fuente de verdad del estado de sesión en memoria** del cliente V2.

| Hace | No hace |
|------|---------|
| Administra estado de sesión | **No autentica** (→ Auth MOD-001) |
| Expone `SessionSnapshot` inmutable | **No consulta Supabase** (→ API Client futuro vía Auth) |
| Orquesta restore / refresh / logout / destroy | **No renderiza UI** |
| Coordina portal, locale, theme refs de sesión | **No resuelve capabilities** (→ Permissions MOD-003) |
| Emite eventos de ciclo de vida | **No decide rutas** (→ portales) |

Auth **alimenta** handles; Permissions **inyecta** capabilities en snapshot; Session **mantiene** el estado coherente.

---

## 2. Estados oficiales de una sesión

| ID | Estado | Descripción |
|----|--------|-------------|
| S-01 | **INITIAL** | Módulo cargado; aún no restore |
| S-02 | **LOADING** | Restore / validate en curso |
| S-03 | **AUTHENTICATED** | Usuario identificado; snapshot listo |
| S-04 | **ANONYMOUS** | Sin usuario; sesión guest válida |
| S-05 | **EXPIRED** | Token/sesión inválida; re-auth requerida |
| S-06 | **REFRESHING** | Renovación en curso |
| S-07 | **LOGGING_OUT** | Teardown logout en curso |
| S-08 | **DESTROYED** | Sesión eliminada; estado terminal |
| S-09 | **ERROR** | Fallo irrecuperable documentado |

**Total estados documentados:** **9**

Ver transiciones: **SESSION-STATE-MACHINE.md**

---

## 3. Información administrada por la sesión

Campos del **SessionSnapshot** (vista de lectura para consumidores):

| Campo | Tipo conceptual | Fuente | Notas |
|-------|-----------------|--------|-------|
| **Current User** | `UserRef \| null` | Auth handle | `userId`, `email?`, `mdjbId?` |
| **Current Portal** | `client \| artist \| staff` | Config + shell | Portal activo |
| **Current Role** | `RoleRef[]` | Permissions | Etiquetas; **no** usar para gates |
| **Current Capabilities** | `string[]` | Permissions | **Fuente para guards** |
| **Locale** | `en \| es` | i18n pref / user | Sincroniza LANGUAGE_CHANGED |
| **Theme** | `dark \| light` | Theme pref | Sincroniza THEME_CHANGED |
| **Feature Flags** | `Record<string, boolean>` | Config + flags svc | Subset efectivo sesión |
| **Session Id** | `string` | Generado en SESSION_CREATED | Correlación interna |
| **Expiration** | `timestamp \| null` | Auth handle | Access token expiry |
| **Refresh Token** | `opaque ref \| null` | Auth handle | **Conceptual** — nunca loggear valor |

### SessionSnapshot meta

| Campo | Descripción |
|-------|-------------|
| `state` | Estado actual S-01…S-09 |
| `sessionId` | ID interno |
| `snapshotVersion` | Bump en PERMISSION_CHANGED |
| `hydrationPhase` | `initial` \| `signed_in` \| `none` — distingue INITIAL_SESSION vs login real |
| `updatedAt` | ISO 8601 |

---

## 4. State Machine

Documentación completa: **SESSION-STATE-MACHINE.md**

Regla: **ningún estado cambia arbitrariamente** — solo transiciones listadas.

---

## 5. Lifecycle

Documentación completa: **SESSION-LIFECYCLE.md**

```
Boot → Restore → Validate → Ready → Refresh → Logout → Destroy
```

---

## 6. Eventos que emite

| Evento | Scope | Cuándo | Payload v1 |
|--------|-------|--------|------------|
| `SESSION_CREATED` | internal | Primera sesión estable post-validate | `{ sessionId, userId? }` |
| `SESSION_READY` | public | Snapshot listo para portales | `{ sessionId, portal, state }` |
| `SESSION_REFRESH` | internal | Refresh iniciado/completado | `{ sessionId, phase: start\|done }` |
| `SESSION_EXPIRED` | public | Expiración confirmada | `{ sessionId, reason }` |
| `SESSION_DESTROYED` | internal | Post destroy | `{ sessionId, reason }` |
| `SESSION_ERROR` | internal | Estado ERROR | `{ sessionId, code }` |

**Eventos emitidos documentados:** **6**

Registrar en Event Bus catálogo vía ADR al implementar runtime (extiende EVENT-BUS-SPEC.md).

---

## 7. Eventos que escucha

| Evento | Origen | Acción Session |
|--------|--------|----------------|
| `USER_LOGIN` | Auth MOD-001 | Recibir handle → LOADING → validate → AUTHENTICATED |
| `USER_LOGOUT` | Auth / user | LOGGING_OUT → DESTROYED |
| `ROLE_CHANGED` | Permissions | Actualizar role refs; bump snapshotVersion |
| `PERMISSION_CHANGED` | Permissions | Reemplazar capabilities[]; emit SESSION_READY si ready |
| `SYSTEM_READY` | Event Bus | Permitir boot restore |

**Eventos escuchados documentados:** **5**

**Total eventos Session (emit + listen):** **11**

---

## 8. Reglas

| # | Regla |
|---|-------|
| SM-01 | Session Manager **NO autentica** |
| SM-02 | Session Manager **NO consulta Supabase** |
| SM-03 | Session Manager **NO renderiza UI** |
| SM-04 | Administra **únicamente** estado de sesión |
| SM-05 | Distinguir `INITIAL_SESSION` (restore) vs `SIGNED_IN` (login real) en `hydrationPhase` |
| SM-06 | Un solo refresh concurrente |
| SM-07 | Staff gate fail → Permissions solicita logout → Session LOGGING_OUT |
| SM-08 | Snapshot inmutable por lectura; updates = nuevo objeto |
| SM-09 | Capabilities siempre desde Permissions — Session no calcula matriz |
| SM-10 | Secrets (refresh token raw) nunca en snapshot expuesto a portales |

---

## 9. Dependencias

| Dependencia | Uso |
|-------------|-----|
| **Event Bus** MOD-004 | Emit / listen |
| **Permissions** MOD-003 | Capabilities + ROLE/PERMISSION_CHANGED |
| **Configuration** MOD-006 | Portal ids, TTLs, storage keys |
| **Logging** MOD-010 | Diagnóstico sin PII |

**Prohibido en dependencias:** Auth implementation directa circular, API Client directo, Supabase, portales, UI components.

---

## 10. Preparación para Auth (MOD-001)

Auth y Session se acoplan **solo por contrato**, no por import circular.

### Flujo Auth → Session

```
Auth.signInSuccess(handle: AuthHandle)
        ↓
Session.ingestAuthHandle(handle)   // no llama Auth de vuelta
        ↓
Session → LOADING → validate handle locally
        ↓
Session.requestCapabilities(userId)  // evento/contrato a Permissions
        ↓
Permissions → capabilities[]
        ↓
Session → AUTHENTICATED → emit SESSION_READY
```

### AuthHandle (conceptual input)

| Campo | Descripción |
|-------|-------------|
| `userId` | UUID |
| `accessTokenRef` | Opaque; Session no parsea JWT claims para roles |
| `refreshTokenRef` | Opaque conceptual |
| `expiresAt` | Timestamp |
| `provider` | `supabase` (futuro) |

Auth **entrega** handle; Session **no** valida contra Supabase — Auth garantiza handle válido al entregar. Re-validate en refresh vía evento Auth → Session, no Supabase directo.

### Boot sin Auth

```
SYSTEM_READY → Session INITIAL → restore storage → LOADING
  → si tokens válidos: pedir Auth validate event (futuro)
  → si no: ANONYMOUS → SESSION_READY
```

Desacoplamiento: Session expone `ingestAuthHandle`, `requestLogout`, `getSnapshot()` — Auth expone sign-in/out únicamente.

---

## Referencias

- `SESSION-LIFECYCLE.md`
- `SESSION-STATE-MACHINE.md`
- `SESSION-STORAGE.md`
- `../CONTRACTS.md` §2 Session
- `../permissions/PERMISSIONS-SPEC.md`
- `../events/EVENT-BUS-SPEC.md`

---

*Session Spec v1.0 — TICKET-V2-SHARED-CORE-005 — Sin implementación.*
