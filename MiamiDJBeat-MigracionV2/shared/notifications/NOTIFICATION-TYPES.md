# NOTIFICATION-TYPES.md

**TICKET-V2-SHARED-CORE-009 — Notifications Specification**

**Módulo:** MOD-011 · Tipos oficiales  
**Versión:** 1.0  
**Total tipos:** **9**

---

## Catálogo

| # | Tipo | Propósito | Prioridad default | Canal default |
|---|------|-----------|-------------------|---------------|
| 1 | **Information** | Info neutral | Normal | Toast / In-App |
| 2 | **Success** | Acción completada | Normal | Toast |
| 3 | **Warning** | Atención requerida | High | Banner / Toast |
| 4 | **Error** | Fallo user-facing | High | Toast / Modal |
| 5 | **Critical** | Riesgo / integridad UX | Critical | Modal / Banner |
| 6 | **Confirmation** | Decisión usuario | High | Modal |
| 7 | **Progress** | Operación en curso | Normal | Banner / In-App |
| 8 | **System** | Mensaje plataforma | Normal–Critical | Banner |
| 9 | **Background** | Sin interrupción UI | Low | In-App inbox only |

---

## Mapping Error Handling → Notification type

| NormalizedError severity | Notification type |
|--------------------------|-------------------|
| INFO | Information |
| WARNING | Warning |
| ERROR | Error |
| CRITICAL | Critical |
| FATAL | Critical + System |

---

## Reglas por tipo

| Tipo | Auto-dismiss | Ack required |
|------|--------------|--------------|
| Information | ✅ ~5s | no |
| Success | ✅ ~4s | no |
| Warning | optional | no |
| Error | manual | optional |
| Critical | manual | yes |
| Confirmation | manual | yes (action) |
| Progress | on complete | no |
| System | varies | optional |
| Background | n/a | no |

---

## i18n

Cada tipo usa `messageKey` namespace:

- `notification.info.*`
- `notification.success.*`
- `notification.warning.*`
- `notification.error.*`
- etc.

EN first; params escapados.

---

## Prohibiciones por tipo

Ningún tipo puede incluir: tokens, SQL, stack, PII de terceros, datos red zone staff en portal client/artist.

---

*NOTIFICATION-TYPES v1.0 — 9 types — TICKET-V2-SHARED-CORE-009*
