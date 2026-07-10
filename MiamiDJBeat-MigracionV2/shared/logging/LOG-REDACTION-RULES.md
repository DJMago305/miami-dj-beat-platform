# LOG-REDACTION-RULES.md

**TICKET-V2-SHARED-CORE-007 — Logging Specification**

**Módulo:** MOD-010 · Redacción obligatoria  
**Versión:** 1.0

---

## Principio

> **Todo dato sensible se redacta antes de persistir o emitir un log.**  
> En duda → redactar.

---

## Campos redactados automáticamente

| Patrón key (case insensitive) | Reemplazo |
|---------------------------------|-----------|
| `password`, `passwd`, `pwd` | `[REDACTED]` |
| `token`, `accessToken`, `refreshToken` | `[REDACTED]` |
| `authorization`, `authHeader` | `[REDACTED]` |
| `secret`, `apiKey`, `serviceRole` | `[REDACTED]` |
| `cookie`, `set-cookie` | `[REDACTED]` |
| `ssn`, `socialSecurity` | `[REDACTED]` |
| `cvv`, `cvc`, `cardNumber`, `pan` | `[REDACTED]` |
| `creditCard`, `bankAccount` | `[REDACTED]` |

---

## Valores parciales permitidos

| Dato | Formato log permitido |
|------|----------------------|
| userId | UUID completo (opaco) |
| sessionId | opaco |
| orderId | opaco business id |
| email | `j***@domain.com` (ADR) o hash |
| phone | `***-***-1234` last4 only |
| mdjbId | `MDJB-****-****-X` masked mid |
| IP | `/24` truncated staging+ |

**Prohibido:** email + phone + full_name en mismo log entry.

---

## URL redaction

| Regla | Ejemplo |
|-------|---------|
| Strip query `token`, `code`, `access_token` | `?token=…` → `?token=[REDACTED]` |
| Strip hash fragments with secrets | `#access_token=…` redact |
| Log path only for API errors | `/rest/v1/orders` OK |

---

## Body redaction (API Client → Logging)

| Content-Type | Log rule |
|--------------|----------|
| JSON | keys redact list applied; max depth 3 |
| Form | never log raw body prod |
| Binary | `[BINARY_OMITTED]` |

HTTP status + `error`/`detail` code from Edge OK; no full response body prod.

---

## Meta object rules

| Regla | Detalle |
|-------|---------|
| Max depth | 4 niveles |
| Max keys | 32 por entry |
| Max string len | 512 chars post-redact |
| Arrays | max 10 items logged |
| Circular | drop branch `[CIRCULAR]` |

---

## Eventos prohibidos (refuerzo)

Nunca loggear, incluso redactado parcial:

- Refresh token raw value
- Service role key
- Magic link URLs completas
- Invoice line items with PII bundle
- Chat message content CRM

---

## Proceso de redacción (conceptual)

```
1. Serialize meta attempt
2. Walk keys → apply pattern redaction
3. Truncate size limits
4. Emit log entry
5. On failure → LOG_ERROR_REDACTION_FAIL minimal entry
```

---

## Entorno

| Entorno | Redacción |
|---------|-----------|
| local | Misma reglas; debug may show **redacted** preview only |
| staging | Full rules + remote sink |
| production | Full rules; zero exception |

---

## Auditoría

Redaction rules versioned con Logging spec. Change → ADR + bump version in log entry `redactionVersion: 1`.

---

*LOG-REDACTION-RULES v1.0 — TICKET-V2-SHARED-CORE-007*
