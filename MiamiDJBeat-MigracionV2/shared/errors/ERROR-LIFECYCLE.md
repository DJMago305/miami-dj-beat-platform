# ERROR-LIFECYCLE.md

**TICKET-V2-SHARED-CORE-008 — Error Handling Specification**

**Módulo:** MOD-014 · Ciclo de vida del error  
**Versión:** 1.0

---

## Pipeline

```
┌─────────────────┐
│ Error Detectado │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Clasificación   │  category C-01…C-10
└────────┬────────┘
         ▼
┌─────────────────┐
│ Normalización   │  NormalizedError + ERR-xxxx
└────────┬────────┘
         ▼
┌─────────────────┐
│ Registro        │  Logging (redactado)
└────────┬────────┘
         ▼
┌─────────────────┐
│ Publicación     │  Event Bus (SYSTEM_ERROR, domain)
└────────┬────────┘
         ▼
┌─────────────────┐
│ Presentación    │  userMessageKey → i18n / Notifications
│ segura          │  NO stack prod · NO secrets
└────────┬────────┘
         ▼
┌─────────────────┐
│ Recuperación o  │  recover / retry / fatal / ignore
│ Terminación     │
└─────────────────┘
```

---

## 1. Error Detectado

| Fuente | Input típico |
|--------|--------------|
| try/catch | unknown throw |
| API Client | `{ ok: false, status, error }` |
| Configuration | CONFIG_ERROR_* |
| Permissions | PERM_* |
| Session | illegal transition |
| Event Bus | handler throw |
| Validation | field errors |

Entrada siempre pasa por **único** normalizer entry point (runtime futuro).

---

## 2. Clasificación

| Paso | Acción |
|------|--------|
| Map known codes | Direct category |
| Map HTTP status | API category rules |
| Map prefix PERM_/AUTH_/CONFIG_ | Category |
| Unknown | C-10 Unexpected → ERR-0950 |

---

## 3. Normalización

Output `NormalizedError`:

- `code`, `category`, `severity`, `recovery`
- `userMessageKey` (safe i18n)
- `logMessage` (technical, redacted)
- `correlationId`, `moduleId`
- `cause` optional chained code only

Strip: tokens, SQL, stack from user fields.

---

## 4. Registro (Logging)

| Severity | Log level |
|----------|-----------|
| INFO | info |
| WARNING | warn |
| ERROR | error |
| CRITICAL | error |
| FATAL | fatal |

Logging **never** receives pre-normalized raw throws.

---

## 5. Publicación (Event Bus)

| Condición | Evento |
|-----------|--------|
| severity ≥ ERROR | `SYSTEM_ERROR` payload `{ code, correlationId }` |
| PERM staff gate | + Session logout chain |
| CONFIG FATAL | blocks SYSTEM_READY |

No payload secrets en evento.

---

## 6. Presentación segura

| Entorno | User ve |
|---------|---------|
| local | userMessageKey + optional debug panel code |
| staging | userMessageKey + code |
| production | userMessageKey; **no** stack |

Notifications MOD-011 may toast `userMessageKey`.

Portales **no** formatean mensajes desde `error.message` raw.

---

## 7. Recuperación o Terminación

| recovery | Acción |
|----------|--------|
| recoverable | UX prompt; user retry |
| retryable | API Client retry policy |
| fatal | Session destroy / Core abort |
| ignorable | continue; log only |

---

## Errores en el propio lifecycle

| Situación | Código |
|-----------|--------|
| normalize fail | ERR-0999 |
| classify ambiguous | ERR-0950 + CRITICAL log |

---

*ERROR-LIFECYCLE v1.0 — TICKET-V2-SHARED-CORE-008*
