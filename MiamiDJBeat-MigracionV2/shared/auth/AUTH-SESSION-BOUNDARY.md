# AUTH-SESSION-BOUNDARY.md

**TICKET-V2-SHARED-CORE-012 — Authentication Specification**

**Módulo:** MOD-001 — Auth / Session Boundary  
**Versión:** 1.0

> **Regla principal:** Auth prueba identidad. Session decide si el estado de sesión queda activo. Permissions decide capacidades.

---

## 1. Qué entrega Auth a Session

| Artefacto | Contenido |
|-----------|-----------|
| **AuthHandle** | Token refs opacos + userId + expiresAt + provider |
| **IdentitySnapshot** | Metadatos identidad allow-list |
| **handoffId** | UUID correlación handoff |
| **portalContext** | Portal que inició sign-in (informative) |

Entrega vía contrato `Session.ingestAuthHandle(handle, identity)` — no import circular.

---

## 2. Qué NO entrega Auth a Session

| Prohibido |
|-----------|
| password |
| refresh_token plain |
| service_role |
| raw provider secrets |
| payment data |
| capabilities[] |
| role matrix |
| portal destination / post-login route |
| private Supabase internals |
| JWT parsed role claims |
| `app_metadata.role` as authority |

---

## 3. AuthHandle (conceptual)

| Campo | Req | Descripción |
|-------|-----|-------------|
| `handoffId` | ✅ | UUID |
| `userId` | ✅ | UUID |
| `accessTokenRef` | ✅ | Opaque — Session never parses for roles |
| `refreshTokenRef` | ○ | Opaque conceptual |
| `expiresAt` | ✅ | ISO 8601 |
| `provider` | ✅ | `supabase` (future) |
| `issuedAt` | ✅ | ISO 8601 |

Alineado con SESSION-SPEC §10.

---

## 4. IdentitySnapshot (conceptual)

| Campo | Permitido |
|-------|-----------|
| `user_id` | ✅ |
| `email` | ✅ |
| `display_name` | ✅ |
| `avatar_url` | ✅ |
| `auth_provider` | ✅ |
| `email_verified` | ✅ |
| `created_at` | ✅ |
| `last_sign_in_at` | ✅ |
| `auth_status` | ✅ enum lifecycle |

Session may copy non-secret fields into SessionSnapshot user ref — **not** capabilities.

---

## 5. Session handoff

```
Auth: SESSION_HANDOFF_PENDING
  → Session.ingestAuthHandle(handle, identity)
Session: validate shape + expiry sanity
  → accept: SESSION_HANDOFF_SUCCEEDED (Auth) + LOADING (Session)
  → reject: ERR-AUTH-009 + Auth → FAILED + Session ANONYMOUS
Session: requestCapabilities(userId)  // Permissions — not Auth
  → SESSION_READY
```

Auth **no** blocks on Permissions.

---

## 6. Session rejection

| Causa | Auth state | Session state |
|-------|------------|---------------|
| Invalid handle shape | FAILED | ANONYMOUS |
| expiresAt past | EXPIRED | clear storage |
| userId mismatch storage | FAILED | corrupt clear |
| handoff timeout ADR | FAILED | ANONYMOUS |

Emit ERR-AUTH-009. No partial AUTHENTICATED in Session.

---

## 7. Restore flow

```
Boot → Auth CHECKING_EXISTING_AUTH
  → provider.restore() from Session-stored auth_ref chain
  → if valid: AUTHENTICATED_IDENTITY_RECEIVED → handoff
  → if invalid: UNAUTHENTICATED → Session ANONYMOUS
```

Auth **reads** restore signal via contract event from Session — **not** Storage direct (Session orchestrates read).

---

## 8. Logout flow

```
User signOut OR Permissions staff_gate OR Session expiry policy
  → Auth LOGGING_OUT
  → Session notified first (clear in-progress handoff)
  → provider.signOut()
  → USER_LOGOUT { reason }
  → Auth LOGGED_OUT → Session DESTROYED
```

---

## 9. Expiration flow

```
Token expiry detected (Auth timer OR Session policy)
  → Auth EXPIRED
  → invalidate active handoffId
  → USER_LOGOUT { reason: expired }
  → Attempt refresh OR UNAUTHENTICATED
  → Session clear auth_ref via Storage facade
```

Expired **invalidates** SESSION_HANDOFF_PENDING in flight.

---

## 10. Anti-circular dependency rules

| Regla | Detalle |
|-------|---------|
| AC-01 | Auth **must not** import Session implementation |
| AC-02 | Session **must not** import Auth implementation |
| AC-03 | Coordination via **facade interfaces** + Event Bus |
| AC-04 | Auth calls `sessionHandoffPort.deliver()` — injected at bootstrap |
| AC-05 | Session calls `authPort.requestLogout()` — injected at bootstrap |
| AC-06 | No Auth → Permissions path |
| AC-07 | Permissions forced signOut → Auth port only |

### Bootstrap order

```
Configuration → Logging → Error Handling → Storage → Event Bus
  → Auth (facade) → Session (facade wired) → Permissions
```

---

*AUTH-SESSION-BOUNDARY v1.0 — TICKET-V2-SHARED-CORE-012*
