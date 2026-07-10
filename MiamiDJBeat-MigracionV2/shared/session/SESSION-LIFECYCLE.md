# SESSION-LIFECYCLE.md

**TICKET-V2-SHARED-CORE-005 — Session Manager Specification**

**Módulo:** MOD-002 · Ciclo de vida  
**Versión:** 1.0

---

## Vista general

```
Boot
  ↓
Restore
  ↓
Validate
  ↓
Ready
  ↓
Refresh (loop while AUTHENTICATED)
  ↓
Logout
  ↓
Destroy
```

---

## Fase 1 — Boot

| Paso | Acción |
|------|--------|
| Trigger | `SYSTEM_READY` recibido |
| Estado | `INITIAL` |
| Acción | Cargar config storage keys, TTLs |
| Siguiente | Automático → Restore |

**Reglas:** No emit SESSION_READY antes de Validate completo.

---

## Fase 2 — Restore

| Paso | Acción |
|------|--------|
| Estado | `INITIAL` → `LOADING` |
| Acción | Leer persistencia (SESSION-STORAGE.md) |
| Si datos | Preparar candidato snapshot |
| Si vacío | Preparar ANONYMOUS |

**hydrationPhase:** `initial` durante restore (equivalente V1 `INITIAL_SESSION`).

---

## Fase 3 — Validate

| Paso | Acción |
|------|--------|
| Estado | `LOADING` |
| Validar | Expiration, sessionId integrity, portal allowlist |
| Auth | Si tokens presentes → contrato Auth validate (futuro); Session **no** Supabase |
| Permissions | Solicitar capabilities snapshot |
| Éxito auth | → `AUTHENTICATED` |
| Sin auth válido | → `ANONYMOUS` |
| Fallo fatal | → `ERROR` + `SESSION_ERROR` |

---

## Fase 4 — Ready

| Paso | Acción |
|------|--------|
| Estado | `AUTHENTICATED` o `ANONYMOUS` |
| Emit | `SESSION_CREATED` (si nueva sesión) |
| Emit | `SESSION_READY` (public) |
| Consumidores | Portales montan shell, nav, guards |

**SESSION_READY** = permiso para portal emitir `PORTAL_READY` downstream.

Orden obligatorio:

```
SESSION_READY → (portal gates) → PORTAL_READY
```

---

## Fase 5 — Refresh

| Paso | Acción |
|------|--------|
| Trigger | `expiresAt - now < refreshBeforeExpiryMs` o Auth signal |
| Estado | `AUTHENTICATED` → `REFRESHING` |
| Emit | `SESSION_REFRESH` `{ phase: start }` |
| Auth | Renueva handle (futuro); Session ingest |
| Éxito | → `AUTHENTICATED`; emit `{ phase: done }` |
| Fallo | → `EXPIRED`; emit `SESSION_EXPIRED` |

**Un solo refresh concurrente** — demás callers await mismo resultado.

---

## Fase 6 — Logout

| Paso | Acción |
|------|--------|
| Trigger | `USER_LOGOUT` o staff gate / user action |
| Estado | → `LOGGING_OUT` |
| Acción | Notificar Auth signOut (evento); clear capabilities refs |
| Persist | Clear storage (except audit correlationId opcional) |

---

## Fase 7 — Destroy

| Paso | Acción |
|------|--------|
| Estado | `LOGGING_OUT` → `DESTROYED` |
| Emit | `SESSION_DESTROYED` |
| Snapshot | Null user; ANONYMOUS-equivalent memory |
| Terminal | No transiciones salvo nuevo Boot cycle |

---

## Eventos por fase

| Fase | Emit | Listen |
|------|------|--------|
| Boot | — | SYSTEM_READY |
| Restore/Validate | SESSION_ERROR? | — |
| Ready | SESSION_CREATED, SESSION_READY | USER_LOGIN, PERMISSION_CHANGED |
| Refresh | SESSION_REFRESH, SESSION_EXPIRED | — |
| Logout/Destroy | SESSION_DESTROYED | USER_LOGOUT |
| Ongoing | — | ROLE_CHANGED, PERMISSION_CHANGED |

---

## Login real vs restore (V1 parity)

| Escenario | hydrationPhase | Redirect portal |
|-----------|----------------|-----------------|
| Restore cookie al cargar | `initial` | **No** redirect agresivo |
| Login usuario explícito | `signed_in` | Portal puede redirect post SESSION_READY |

Session Manager **propaga** fase; portales deciden UX — Session no redirige.

---

*SESSION-LIFECYCLE v1.0 — TICKET-V2-SHARED-CORE-005*
