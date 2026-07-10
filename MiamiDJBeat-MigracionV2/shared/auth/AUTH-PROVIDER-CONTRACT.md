# AUTH-PROVIDER-CONTRACT.md

**TICKET-V2-SHARED-CORE-012 — Authentication Specification**

**Módulo:** MOD-001 — Provider Contract  
**Versión:** 1.0

> Contrato **conceptual** con proveedor futuro. **Sin** Supabase SDK, migrations, Edge Functions ni clients en este ticket.

---

## 1. Provider conceptual

| Campo | Descripción |
|-------|-------------|
| `providerId` | `supabase` \| `oauth_google` \| ADR future |
| `configRef` | Desde Configuration — URL, anon key **ref** |
| `adapter` | Implementación futura behind Auth facade |

Supabase **puede** ser proveedor futuro; este documento **no** lo implementa.

---

## 2. Operaciones futuras permitidas

| Operación | Input | Output |
|-----------|-------|--------|
| **signIn** | `SignInCredentials`, `PortalContext` | `ProviderResult` success + identity + token refs |
| **signOut** | `SignOutRequest` | void / ack |
| **restore** | storage/session probe | identity + refs \| null |
| **refresh** | `refreshTokenRef` opaque | new token refs + expiresAt |
| **getIdentity** | `userId` or active session | `IdentitySnapshot` |

---

## 3. Operaciones prohibidas

| Prohibido | Motivo |
|-----------|--------|
| `updateProfile` | Not identity core |
| `assignRole` | Permissions / server |
| `queryRLS` | Server |
| `invokeEdge` direct | API Client |
| `serviceRoleSignIn` | Never client |
| `persistCapabilities` | Permissions |

---

## 4. Inputs permitidos

| Input | Descripción |
|-------|-------------|
| `SignInCredentials` | email/password \| oauthProviderId \| otp |
| `PortalContext` | `client` \| `artist` \| `staff` |
| `SignOutRequest.reason` | `user` \| `forced` \| `staff_gate` \| `expired` |
| `AuthProviderConfig` | from Configuration |
| opaque `refreshTokenRef` | from Session storage chain |

---

## 5. Outputs permitidos

| Output | Descripción |
|--------|-------------|
| `IdentitySnapshot` | allow-list AUTH-SESSION-BOUNDARY |
| `accessTokenRef` | opaque handle |
| `refreshTokenRef` | opaque handle — **not** plain in Storage |
| `expiresAt` | ISO timestamp |
| `providerSessionId` | opaque optional |

---

## 6. Outputs prohibidos

| Prohibido |
|-----------|
| Raw JWT string to Storage |
| service_role key |
| Provider admin API responses |
| Full provider error stack |
| `capabilities[]` |
| `app_metadata.role` as authority |
| SQL error text |
| Payment / billing objects |

---

## 7. Error normalization

Provider raw errors → Auth internal code → ERR-AUTH-* → Error Handling ERR-0100 band.

| Provider signal | Auth code |
|-----------------|-----------|
| invalid login | ERR-AUTH-002 |
| network down | ERR-AUTH-006 |
| token expired | ERR-AUTH-007 |
| refresh fail | ERR-AUTH-008 |
| malformed identity | ERR-AUTH-005 |

Auth **never** surfaces provider stack to UI.

---

## 8. Provider independence

| Regla | Detalle |
|-------|---------|
| P-01 | Auth facade stable — swap adapter without portal changes |
| P-02 | No Supabase types leak to Session |
| P-03 | Multiple providers ADR — one active per env |
| P-04 | Provider calls **may** use API Client adapter layer (future) |

---

## 9. Reglas de seguridad

| # | Regla |
|---|-------|
| S-01 | No service_role in browser |
| S-02 | No log tokens or secrets |
| S-03 | TLS only production/staging |
| S-04 | Redirect URLs allowlist from Configuration |
| S-05 | PKCE / OAuth ADR before Google provider |
| S-06 | Rate limit signIn ADR infra |

---

## 10. Criterios para implementación futura

| # | Gate |
|---|------|
| I-01 | AUTH spec PO approved |
| I-02 | Session + Storage auth_ref ADR |
| I-03 | ADR Supabase adapter + httpOnly refresh if prod |
| I-04 | Error catalog ERR-0100 sync PR (separate ticket) |
| I-05 | No V1 auth.js copy without ADR |
| I-06 | E2E signIn/signOut lab staging |

**Este ticket:** ninguno de los gates de implementación se ejecuta.

---

*AUTH-PROVIDER-CONTRACT v1.0 — conceptual only — TICKET-V2-SHARED-CORE-012*
