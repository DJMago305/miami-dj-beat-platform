# SESSION-STORAGE.md

**TICKET-V2-SHARED-CORE-005 — Session Manager Specification**

**Módulo:** MOD-002 · Persistencia de sesión  
**Versión:** 1.0

---

## Propósito

Definir **qué** se persiste entre recargas del browser para Restore phase — sin implementar código ni Supabase.

Session Manager lee/escribe storage; Auth provee tokens vía handle; **no** almacenar secrets en plain text en prod spec sin ADR.

---

## Principios

| # | Regla |
|---|-------|
| ST-01 | Persistir **mínimo** necesario para restore |
| ST-02 | No persistir `capabilities[]` — re-fetch Permissions on restore |
| ST-03 | No persistir refresh token en localStorage en prod (prefer httpOnly cookie path — ADR infra) |
| ST-04 | `sessionId` rota en cada SESSION_CREATED |
| ST-05 | Clear all on DESTROYED |
| ST-06 | Storage keys namespaced `mdj_v2_session_*` |

---

## Artefactos persistidos (conceptual)

| Key | Contenido | Restore use |
|-----|-----------|-------------|
| `mdj_v2_session_id` | sessionId | Integrity check |
| `mdj_v2_portal` | active portal | Shell context |
| `mdj_v2_locale` | en \| es | i18n boot |
| `mdj_v2_theme` | dark \| light | theme boot |
| `mdj_v2_expires_at` | ISO timestamp | Validate expiry |
| `mdj_v2_user_id` | uuid \| null | Restore user ref |
| `mdj_v2_auth_ref` | opaque token ref | Hand off Auth validate |

**No persistir:** capabilities, role arrays completos, feature flags dinámicos (re-resolve), raw refresh token (salvo ADR secure storage).

---

## Storage backends (prioridad futura)

| Backend | Uso |
|---------|-----|
| `sessionStorage` | Tab session-only (dev/lab option) |
| `localStorage` | Persist cross-tab — solo non-secret fields |
| Secure cookie | Refresh token (Auth + infra ADR) |
| Memory | Snapshot runtime authoritative |

Lab V2 documenta contrato; elección backend → ticket infra 006+.

---

## Restore algorithm (conceptual)

```
1. Read keys from configured backend
2. If missing → ANONYMOUS path
3. If expires_at past → EXPIRED path (clear or re-auth)
4. If auth_ref present → request Auth validate (event, not Supabase direct)
5. Request Permissions snapshot for user_id
6. Merge into SessionSnapshot → AUTHENTICATED or ANONYMOUS
```

---

## Write points

| Lifecycle phase | Write action |
|-----------------|--------------|
| SESSION_CREATED | Persist id, user, portal, expires, auth_ref |
| SESSION_READY | Persist locale, theme if changed |
| REFRESH done | Update expires_at, auth_ref |
| LOGGING_OUT | — |
| DESTROYED | **Clear all** mdj_v2_session_* |

---

## Corruption handling

| Condición | Acción |
|-----------|--------|
| Parse error | Clear storage → ANONYMOUS |
| sessionId mismatch | Clear → LOADING fresh |
| Partial keys | Treat as corrupt → clear |

Log `SESSION_STORAGE_CORRUPT` — no throw to UI.

---

## Multi-tab (future)

| Event | Behavior |
|-------|----------|
| Tab B login | Broadcast PERMISSION_CHANGED / SESSION_READY |
| Tab A logout | All tabs → LOGGING_OUT (storage event) |

ADR required before implement.

---

## Dependencias

- **Configuration** MOD-006 — key names, backend selection
- **Logging** MOD-010 — corrupt / clear events

**Prohibido:** Supabase session API directo desde storage layer.

---

*SESSION-STORAGE v1.0 — TICKET-V2-SHARED-CORE-005*
