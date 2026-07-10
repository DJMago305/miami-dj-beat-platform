# AUTH-ERRORS.md

**TICKET-V2-SHARED-CORE-012 — Authentication Specification**

**Módulo:** MOD-001 — Errors  
**Versión:** 1.0

> Catálogo Auth local **ERR-AUTH-xxx**. Alineación conceptual con `shared/errors/` ERR-0100–0199 — **sin modificar** ERROR-CATALOG en este ticket.

---

## Mapping conceptual ERR-AUTH → ERR-0100 band

| ERR-AUTH | ERR-0100 band (future sync) |
|----------|----------------------------|
| ERR-AUTH-002 | ERR-0100 AUTH_INVALID_CREDENTIALS |
| ERR-AUTH-007 | ERR-0101 AUTH_SESSION_EXPIRED |
| ERR-AUTH-006 | ERR-0102 AUTH_PROVIDER_UNAVAILABLE |
| ERR-AUTH-010 | ERR-0103 AUTH_FORCED_SIGNOUT |

---

## Catálogo mínimo

| Código | Nombre | Severidad | Causa | Acción sistema | Mensaje usuario | Log permitido | Log prohibido |
|--------|--------|-----------|-------|----------------|-----------------|---------------|---------------|
| ERR-AUTH-001 | UNKNOWN_AUTH_STATE | WARNING | Boot/state corrupt | Reset → CHECKING_EXISTING_AUTH | `error.auth.unknown_state` | state name, correlationId | tokens, email full |
| ERR-AUTH-002 | LOGIN_FAILED | INFO | Bad credentials / provider reject | → FAILED → UNAUTHENTICATED | `error.auth.login_failed` | provider code, portal | password, token |
| ERR-AUTH-003 | LOGOUT_FAILED | WARNING | Provider signOut fail | Force local clear + log | `error.auth.logout_failed` | userId opaco | session body |
| ERR-AUTH-004 | RESTORE_FAILED | WARNING | Invalid stored auth_ref | Clear Session storage path | `error.auth.restore_failed` | restore phase | auth_ref value |
| ERR-AUTH-005 | IDENTITY_INVALID | ERROR | Malformed identity payload | → FAILED, no handoff | `error.auth.identity_invalid` | validation field | provider raw JSON |
| ERR-AUTH-006 | PROVIDER_UNAVAILABLE | ERROR | Network / provider down | Retry policy ADR | `error.auth.provider_unavailable` | HTTP status 0 | Authorization header |
| ERR-AUTH-007 | TOKEN_EXPIRED | WARNING | Access token past expiresAt | → EXPIRED → refresh or logout | `error.auth.token_expired` | expiresAt | JWT |
| ERR-AUTH-008 | TOKEN_REFRESH_FAILED | ERROR | Refresh rejected | → EXPIRED → UNAUTHENTICATED | `error.auth.refresh_failed` | attempt count | refresh token |
| ERR-AUTH-009 | SESSION_HANDOFF_FAILED | ERROR | Session rejected handle | Auth FAILED, Session ANONYMOUS | `error.auth.handoff_failed` | handoffId | handle contents |
| ERR-AUTH-010 | SECURITY_VIOLATION | CRITICAL | service_role attempt, token in log, forbidden persist | Force signOut all tabs ADR | `error.auth.security` | violation code enum | any secret |

---

## Normalización → Error Handling

```
AuthError { code: ERR-AUTH-xxx, detail?, correlationId? }
  → ErrorHandling.normalizeAuthError()
  → NormalizedError { errCode, severity, userMessageKey, retryable }
  → Logging (redacted)
  → optional Notifications via presentError() — portal policy
```

Auth module **never** renders error UI.

---

## Retry hints

| Código | retryable |
|--------|-----------|
| ERR-AUTH-006 | true (bounded) |
| ERR-AUTH-008 | false |
| ERR-AUTH-002 | false |
| ERR-AUTH-010 | false — fatal |

---

## Log rules

| Permitido | Prohibido |
|-----------|-----------|
| ERR-AUTH code | tokens |
| userId UUID | password |
| portal context | refresh_token |
| correlationId | Authorization |
| provider enum | service_role |
| durationMs | full email + phone pair |

Ver LOG-REDACTION-RULES.md.

---

## Staff gate

Permissions `PERM_STAFF_GATE_FAILED` → Auth receives forced signOut → ERR-AUTH-010 or ERR-AUTH-003 with `reason: staff_gate` — **not** Auth deciding permission.

---

*AUTH-ERRORS v1.0 — 10 codes — TICKET-V2-SHARED-CORE-012*
