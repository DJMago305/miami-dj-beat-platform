# NOTIFICATIONS-SPEC.md

**TICKET-V2-SHARED-CORE-009 — Notifications Specification**

**Módulo:** MOD-011 Notifications  
**Ticket:** TICKET-V2-SHARED-CORE-009  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Autoridad única para **toda comunicación dirigida al usuario** dentro de la plataforma V2.  
> UI-agnostic en Core; render en portales vía contratos.

---

## 1. Responsabilidad del módulo

| Hace | No hace |
|------|---------|
| Define tipos, canales, prioridades | **No autentica** |
| Orquesta lifecycle Create → Archive | **No consulta Supabase** directamente |
| Enruta notificaciones por portal/capability | **No envía Email/SMS/Push** (futuro Edge) |
| Emite/escucha eventos Event Bus | **No implementa API Client** |
| Provee `NotificationPayload` + i18n keys | **No renderiza UI** (portals/components) |
| Integra Error Handling `userMessageKey` → toast | **No bypass Permissions** |

CRM staff messaging interno → `staff/crm`, no Notifications Core.

---

## 2. Tipos oficiales

**Total:** **9** — detalle **NOTIFICATION-TYPES.md**

Information · Success · Warning · Error · Critical · Confirmation · Progress · System · Background

---

## 3. Canales

**Total documentados:** **8** — detalle **DELIVERY-CHANNELS.md**

| Activo V2 MVP | Futuro |
|---------------|--------|
| In-App, Toast, Banner, Modal | Email, Push, SMS, Webhook |

---

## 4. Prioridades

| Prioridad | Valor | Uso |
|-----------|-------|-----|
| **Low** | 10 | Background, analytics |
| **Normal** | 20 | Information, Success |
| **High** | 30 | Warning, Error user-facing |
| **Critical** | 40 | Critical, System blocking |

Mayor prioridad gana en colisión mismo canal. Critical puede preempt Normal toast.

---

## 5. Lifecycle

Detalle: **NOTIFICATION-LIFECYCLE.md**

```
Create → Queue → Deliver → Display → Acknowledge → Dismiss → Archive
```

---

## 6. Relación con otros módulos

| Módulo | Relación |
|--------|----------|
| **Configuration** MOD-006 | Feature flags notificaciones; env channel enable |
| **Session** MOD-002 | Scope userId, portal; clear queue on logout |
| **Permissions** MOD-003 | Filter por capability antes Display |
| **Logging** MOD-010 | Log delivery meta redacted |
| **Error Handling** MOD-014 | Error/Critical types from NormalizedError |
| **Event Bus** MOD-004 | NOTIFICATION_* events |

**Orden init (runtime):** Configuration → Logging → Event Bus → Session → Permissions → Notifications

---

## 7. Reglas

| # | Regla |
|---|-------|
| N-01 | Notificación **nunca** contiene secretos |
| N-02 | **Nunca** contiene tokens |
| N-03 | **Nunca** contiene SQL |
| N-04 | **Nunca** muestra stack traces |
| N-05 | **Nunca** revela información restringida (red zone, otros users data) |
| N-06 | **Internacionalizable** — `messageKey` + params, EN canonical |
| N-07 | **Respeta permisos** — deny → no Display |
| N-08 | Un `notificationId` único global |
| N-09 | Idempotent create con mismo `dedupeKey` |
| N-10 | Logout → dismiss ephemeral + archive inbox optional |

---

## 8. Eventos relacionados

| Evento | Scope | Emisor |
|--------|-------|--------|
| `NOTIFICATION_CREATED` | public | Notifications |
| `NOTIFICATION_UPDATED` | public | Notifications |
| `NOTIFICATION_DELIVERED` | internal | Notifications |
| `NOTIFICATION_DISMISSED` | public | Notifications / user |
| `NOTIFICATION_ARCHIVED` | internal | Notifications |

Registrar extensiones en Event Bus catálogo vía ADR al implementar runtime.

### Payload v1 común

| Campo | Req |
|-------|-----|
| `notificationId` | ✅ |
| `type` | ✅ |
| `priority` | ✅ |
| `channel` | ✅ |
| `portal` | ✅ |
| `messageKey` | ✅ |
| `params` | ○ |
| `dedupeKey` | ○ |

---

## 9. Preparación para Runtime (sin dependencias circulares)

### Contrato consumo

```
Notifications.create(spec) → notificationId
Notifications.dismiss(id)
Notifications.subscribe(handler)  // portals
Notifications.present(spec)       // facade: create+queue+deliver
```

### Por consumidor

| Consumidor | Dirección | Acoplamiento |
|------------|-----------|--------------|
| **Auth** | Error toast via Error Handler only | no import Notifications direct |
| **API Client** | API fail → Error Handler → optional toast | unidirectional |
| **Session** | listen logout → clear queue | Session emits, Notifications listens |
| **Permissions** | capability check before display | Permissions snapshot read-only |
| **Error Handling** | `presentError()` → Notification type Error | Error → Notifications |
| **Portal Client/Artist/Staff** | subscribe + render components | portal imports facade only |

**Prohibido:** Notifications → Portal, Notifications → Auth, Notifications → API Client.

Circular prevention: Notifications **solo escucha** Session/Permissions events; **nunca** muta Session.

---

## NotificationPayload (conceptual)

| Campo | Descripción |
|-------|-------------|
| `notificationId` | UUID |
| `type` | enum 9 tipos |
| `priority` | low \| normal \| high \| critical |
| `channel` | toast \| banner \| modal \| in-app \| … |
| `portal` | client \| artist \| staff |
| `messageKey` | i18n |
| `params` | interpolación safe |
| `actions` | optional confirm/cancel keys |
| `ttlMs` | auto dismiss |
| `requiresCapability` | optional guard |
| `dedupeKey` | optional |
| `createdAt` | ISO 8601 |

---

## Referencias

- `NOTIFICATION-TYPES.md`
- `DELIVERY-CHANNELS.md`
- `NOTIFICATION-LIFECYCLE.md`
- `../events/EVENT-BUS-SPEC.md`
- `../errors/ERROR-HANDLING-SPEC.md`

---

*NOTIFICATIONS-SPEC v1.0 — TICKET-V2-SHARED-CORE-009*
