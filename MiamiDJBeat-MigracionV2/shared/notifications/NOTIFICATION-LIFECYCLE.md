# NOTIFICATION-LIFECYCLE.md

**TICKET-V2-SHARED-CORE-009 — Notifications Specification**

**Módulo:** MOD-011 · Ciclo de vida  
**Versión:** 1.0

---

## Pipeline

```
Create → Queue → Deliver → Display → Acknowledge → Dismiss → Archive
```

---

## 1. Create

| Paso | Acción |
|------|--------|
| Input | `NotificationSpec` (type, channel, messageKey, portal, …) |
| Validate | schema, i18n key exists, no forbidden content scan |
| Permissions pre-check | `requiresCapability` if set |
| Dedupe | same `dedupeKey` active → return existing id |
| Emit | `NOTIFICATION_CREATED` |
| Output | `notificationId` |

Fuentes: portales, Error Handling facade, Event Bus listeners (domain events).

---

## 2. Queue

| Regla | Detalle |
|-------|---------|
| Priority order | Critical > High > Normal > Low |
| Portal scope | queue per portal instance |
| Session bind | notifications tied sessionId |
| Max size | 100 pending per portal (config) |
| Overflow | drop Low Background first + log warn |

Estado interno: `queued`.

---

## 3. Deliver

| Paso | Acción |
|------|--------|
| Select | next by priority + channel rules |
| Permissions | re-check capability (snapshot may have changed) |
| Route | portal subscriber channel |
| Emit | `NOTIFICATION_DELIVERED` (internal) |
| Estado | `delivered` |

If deny → skip Display + log info; optional `NOTIFICATION_UPDATED` suppressed.

---

## 4. Display

| Responsable | Acción |
|-------------|--------|
| Portal UI | Render toast/banner/modal/in-app |
| Notifications | **no** DOM — only callback payload |

Estado: `displayed`. Progress type updates via `NOTIFICATION_UPDATED`.

---

## 5. Acknowledge

| Tipo | Acción |
|------|--------|
| Confirmation | user confirms action |
| Critical | user read required |
| Others | optional skip |

Estado: `acknowledged`. Emit `NOTIFICATION_UPDATED`.

---

## 6. Dismiss

| Trigger | Acción |
|---------|--------|
| User close | manual dismiss |
| TTL expiry | auto dismiss toast/info |
| Logout | dismiss all ephemeral |
| Replace dedupe | dismiss previous |

Emit `NOTIFICATION_DISMISSED`. Estado: `dismissed`.

---

## 7. Archive

| Condición | Acción |
|-----------|--------|
| In-App history | move to archive list |
| TTL archive policy | 30d default ADR |
| Logout | optional clear inbox per PO |

Emit `NOTIFICATION_ARCHIVED` (internal). Estado terminal: `archived`.

---

## State machine (resumen)

```
queued → delivered → displayed → acknowledged? → dismissed → archived
                  ↘ dismissed (TTL)
create → suppressed (perm deny) → archived
```

---

## Eventos lifecycle

| Fase | Evento |
|------|--------|
| Create | NOTIFICATION_CREATED |
| Update progress/ack | NOTIFICATION_UPDATED |
| Deliver | NOTIFICATION_DELIVERED |
| Dismiss | NOTIFICATION_DISMISSED |
| Archive | NOTIFICATION_ARCHIVED |

---

## Session logout flow

```
USER_LOGOUT / SESSION_DESTROYED
  → dismiss toast/banner/modal
  → archive or clear In-App per config
  → empty queue
```

---

*NOTIFICATION-LIFECYCLE v1.0 — TICKET-V2-SHARED-CORE-009*
