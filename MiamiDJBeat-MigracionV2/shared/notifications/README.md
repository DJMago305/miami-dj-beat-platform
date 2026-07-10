# notifications/

Módulo **MOD-011 Notifications** · Shared Core.

## Documentación — TICKET-V2-SHARED-CORE-009 — Notifications Specification

| Archivo | Contenido |
|---------|-----------|
| **NOTIFICATIONS-SPEC.md** | Responsabilidad, reglas, eventos, runtime prep |
| **NOTIFICATION-TYPES.md** | 9 tipos oficiales |
| **DELIVERY-CHANNELS.md** | 8 canales (4 MVP + 4 futuro) |
| **NOTIFICATION-LIFECYCLE.md** | Create → Archive |
| **../events/EVENT-BUS-SPEC.md** | NOTIFICATION_CREATED (+ extensiones) |

## Estado

| Campo | Valor |
|-------|-------|
| **Documentación** | **DOCUMENTACIÓN COMPLETA** |
| **Implementación** | **PENDIENTE** |
| **Ticket** | TICKET-V2-SHARED-CORE-009 |

## Reglas clave

- Autoridad única comunicación usuario · UI-agnostic
- i18n · permissions · no secrets/tokens/SQL/stack
- Sin dependencias circulares hacia Auth/API/Portales

## Dependencias (runtime futuro)

Configuration · Session · Permissions · Logging · Error Handling · Event Bus · i18n

## Prohibido

Supabase direct, Auth impl, CRM staff msgs, V1 hacks, portal imports from internals
