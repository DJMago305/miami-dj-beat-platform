# AUTH-LIFECYCLE.md

**TICKET-V2-SHARED-CORE-012 — Authentication Specification**

**Módulo:** MOD-001 Authentication — Lifecycle  
**Versión:** 1.0

---

## Estados oficiales (12)

1. UNKNOWN  
2. CHECKING_EXISTING_AUTH  
3. UNAUTHENTICATED  
4. AUTHENTICATING  
5. AUTHENTICATED_IDENTITY_RECEIVED  
6. SESSION_HANDOFF_PENDING  
7. SESSION_HANDOFF_SUCCEEDED  
8. REFRESHING  
9. EXPIRED  
10. LOGGING_OUT  
11. LOGGED_OUT  
12. FAILED  

---

## Tabla de transiciones

| Estado | Entrada | Salida | Evento esperado | Error posible | Módulo siguiente |
|--------|---------|--------|-----------------|---------------|------------------|
| **UNKNOWN** | Boot Core | CHECKING_EXISTING_AUTH | `SYSTEM_READY` | ERR-AUTH-001 | Configuration |
| **CHECKING_EXISTING_AUTH** | restore probe | UNAUTHENTICATED \| AUTHENTICATING | — | ERR-AUTH-004 | Provider / Session storage |
| **UNAUTHENTICATED** | no session / logout done | AUTHENTICATING | — | — | Portal signIn UI |
| **AUTHENTICATING** | signIn(credentials) | AUTHENTICATED_IDENTITY_RECEIVED \| FAILED | — | ERR-AUTH-002, ERR-AUTH-006 | Provider |
| **AUTHENTICATED_IDENTITY_RECEIVED** | provider OK | SESSION_HANDOFF_PENDING | `USER_LOGIN` `{ userId }` | ERR-AUTH-005 | — |
| **SESSION_HANDOFF_PENDING** | emit handle | SESSION_HANDOFF_SUCCEEDED \| FAILED | Session accept/reject | ERR-AUTH-009 | **Session** |
| **SESSION_HANDOFF_SUCCEEDED** | Session OK | REFRESHING \| LOGGING_OUT \| EXPIRED | `SESSION_READY` (Session) | — | **Session** → Permissions |
| **REFRESHING** | expiry near | SESSION_HANDOFF_SUCCEEDED \| EXPIRED \| FAILED | refresh event | ERR-AUTH-008 | Provider |
| **EXPIRED** | token invalid | UNAUTHENTICATED \| AUTHENTICATING | `USER_LOGOUT` `{ reason: expired }` | ERR-AUTH-007 | Session clear |
| **LOGGING_OUT** | signOut request | LOGGED_OUT | `USER_LOGOUT` | ERR-AUTH-003 | Session |
| **LOGGED_OUT** | cleanup done | UNAUTHENTICATED | — | — | — |
| **FAILED** | any fatal | UNAUTHENTICATED | — | ERR-AUTH-* | Error Handling |

---

## Diagrama (resumen)

```
UNKNOWN → CHECKING_EXISTING_AUTH
  → UNAUTHENTICATED ↔ AUTHENTICATING → AUTHENTICATED_IDENTITY_RECEIVED
  → SESSION_HANDOFF_PENDING → SESSION_HANDOFF_SUCCEEDED
  → (Session + Permissions path)
REFRESHING ↔ SESSION_HANDOFF_SUCCEEDED
EXPIRED → UNAUTHENTICATED
LOGGING_OUT → LOGGED_OUT → UNAUTHENTICATED
Any fatal → FAILED → UNAUTHENTICATED (no partial session)
```

---

## Reglas de transición

| # | Regla |
|---|-------|
| L-01 | **No** saltar UNAUTHENTICATED → SESSION_HANDOFF_SUCCEEDED |
| L-02 | **No** saltar AUTHENTICATING → Permissions — Session first |
| L-03 | Session **debe** aceptar o rechazar handoff |
| L-04 | EXPIRED **invalida** handoff activo |
| L-05 | Logout **notifica** Session antes de LOGGED_OUT |
| L-06 | FAILED **no** deja sesión parcial activa — Session clear |
| L-07 | AUTHENTICATED_IDENTITY_RECEIVED **siempre** antes de handoff |
| L-08 | REFRESHING **no** emite USER_LOGIN duplicate — update handle only |

---

## Flujos por operación

### signIn

```
UNAUTHENTICATED → AUTHENTICATING → provider
  → AUTHENTICATED_IDENTITY_RECEIVED → USER_LOGIN
  → SESSION_HANDOFF_PENDING → Session.ingestAuthHandle
  → SESSION_HANDOFF_SUCCEEDED | FAILED
```

### restore (boot)

```
UNKNOWN → CHECKING_EXISTING_AUTH
  → provider.restore() | no tokens → UNAUTHENTICATED
  → valid → AUTHENTICATED_IDENTITY_RECEIVED → handoff path
```

### refresh

```
SESSION_HANDOFF_SUCCEEDED → REFRESHING → provider.refresh()
  → new handle → SESSION_HANDOFF_PENDING → SESSION_HANDOFF_SUCCEEDED
  → fail → EXPIRED | FAILED
```

### signOut

```
SESSION_HANDOFF_SUCCEEDED → LOGGING_OUT
  → notify Session → provider.signOut()
  → LOGGED_OUT → UNAUTHENTICATED
```

---

## Coordinación Session (post-handoff)

Auth **termina** en SESSION_HANDOFF_SUCCEEDED. Session continúa:

```
Session → Permissions snapshot → AUTHENTICATED → SESSION_READY
```

Auth **no** espera SESSION_READY para retornar signIn promise — portal escucha Event Bus (futuro ADR).

---

## Eventos Auth

| Fase | Evento |
|------|--------|
| Identity confirmed | USER_LOGIN |
| Logout / expired | USER_LOGOUT |
| Failed security | USER_LOGOUT `{ reason: forced }` |

---

*AUTH-LIFECYCLE v1.0 — 12 states — TICKET-V2-SHARED-CORE-012*
