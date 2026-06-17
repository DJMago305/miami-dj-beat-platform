# TICKET-COMMS-001 — Sistema de Comunicaciones MDJ

**Fecha de apertura:** 2026-06-16  
**Abierto por:** CEO DJMago305  
**Estado:** ABIERTO — en planificación  
**Prioridad:** 🔴 ALTA — identificado como la necesidad más urgente de la plataforma  

---

## PROBLEMA IDENTIFICADO (palabras del CEO)

> "El web está funcional y solamente necesita pequeños cambios de comunicación entre compras y el staff porque no nos enteramos todavía cuando alguien se subscribe o cuando alguien quiere contratar algún servicio. Debemos trabajar en las siguientes secciones para crear un método de trabajo sólido y sobre todo con mucha información — que todo el equipo se entere de cuando alguien quiere comprar, cuando alguien se subscribe como cliente o como artista. Miami DJ Beat está pobre de comunicación ahora mismo."

---

## GAPS DE COMUNICACIÓN ACTUALES

| Evento | ¿Staff se entera? | ¿Cómo? |
|--------|------------------|--------|
| Cliente nuevo se registra | ❌ No | Solo via Supabase Auth (manual) |
| Artista nuevo se registra | ❌ No | Solo via Supabase Auth (manual) |
| Lead nuevo (solicitud de evento) | ⚠️ Parcial | Solo si van al Admin Dashboard |
| Orden Event Builder creada | ❌ No | Solo si van a la sección Órdenes |
| Compra en Shop | ❌ No | Solo via Stripe dashboard (manual) |
| Artista asignado a evento | ❌ No | Solo si el artista entra al dashboard |

---

## PLAN DE TRABAJO — 3 FASES

### FASE A — Inbox Interno (Costo: $0 · Tiempo: 1-2 sesiones)

Usar la tabla `platform_inbox_messages` que ya existe y ya está conectada al Admin Dashboard (badge 🔔).

**Eventos a capturar:**

| Trigger | Quién lo genera | Destinatario |
|---------|----------------|--------------|
| Nuevo registro cliente | Trigger Postgres en `client_profiles` | Staff management |
| Nuevo registro artista | Trigger Postgres en `dj_profiles` | Staff management |
| Nuevo lead | Trigger Postgres en `leads` | Staff management |
| Nueva orden Event Builder | Trigger Postgres en `event_builder_orders` | Staff management |

**Implementación:**
1. Crear función Postgres `notify_inbox_on_event()` 
2. Crear triggers en cada tabla
3. Admin Dashboard ya muestra el badge — sin cambios de UI necesarios
4. Agregar columna "tipo" en inbox para filtrar por categoría (signup / lead / order)

**Archivos a tocar:**
- `supabase/migrations/[fecha]_comms_inbox_triggers.sql` (nuevo)
- `web/admin-dashboard.html` (pequeño ajuste para mostrar tipo de mensaje)

---

### FASE B — Email al Staff (Costo: ~$0-20/mes · Tiempo: 2-3 sesiones)

Requiere: cuenta en **Resend** (gratis hasta 3,000 emails/mes) o **SendGrid**.

**Emails automáticos:**

| Evento | Para quién | Contenido |
|--------|-----------|-----------|
| Nuevo lead | Manager + Owner | Nombre cliente, tipo evento, fecha, teléfono, total estimado |
| Nueva orden EB confirmada | Manager | ORDEN #, cliente, servicios, total, depósito |
| Nuevo cliente registrado | Owner | Nombre, email, fecha registro |
| Nuevo artista registrado | Owner | Nombre artístico, especialidad, email |
| Artista asignado a evento | Artista | Nombre evento, fecha, contacto cliente |

**Implementación:**
- Edge Functions: `notify-staff-new-lead`, `notify-staff-new-signup`, `notify-client-order`
- Templates HTML para emails
- Secrets en Supabase: `RESEND_API_KEY`

---

### FASE C — WhatsApp/SMS (Costo: ~$50+/mes · Tiempo: 3-4 sesiones)

Requiere: **Twilio** o **WhatsApp Business API**.

**Mensajes automáticos:**

| Evento | Para quién | Canal |
|--------|-----------|-------|
| Nuevo lead urgente (evento en < 30 días) | Manager | WhatsApp |
| Orden confirmada | Cliente | WhatsApp/SMS |
| Artista asignado | Artista | WhatsApp |
| Recordatorio de evento (48h antes) | Cliente + Artista | WhatsApp |

---

## RECOMENDACIÓN DE INICIO

**Empezar por FASE A.** Razones:
1. Costo cero — usa infraestructura ya existente
2. El Admin Dashboard ya tiene el inbox funcionando (badge 🔔 en campanita)
3. No requiere servicios externos ni secrets
4. Resuelve el problema inmediato: staff ve actividad sin revisar manualmente cada tabla
5. Fundación para las fases B y C

---

## ESTRUCTURA DE MENSAJE INBOX (propuesta)

```json
{
  "type": "new_client" | "new_artist" | "new_lead" | "new_order" | "new_purchase",
  "title": "Nuevo cliente registrado",
  "body": "María García se registró como cliente",
  "metadata": {
    "user_id": "uuid",
    "email": "email",
    "amount": 0,
    "url": "/admin-dashboard.html#leads"
  },
  "created_at": "timestamp",
  "is_read": false
}
```

---

## APROBACIÓN REQUERIDA PARA EJECUTAR FASE A

El Capitán debe decir: **"Autorizo TICKET-COMMS-001 Fase A"**

Alcance exacto:
- `supabase/migrations/[fecha]_comms_inbox_triggers.sql` (nuevo)
- `web/admin-dashboard.html` (solo sección inbox — ajuste de tipo de mensaje)
- Sin tocar auth, leads logic, ni otros módulos

---
ESTADO: DOCUMENTADO — ESPERANDO AUTORIZACIÓN DEL CAPITÁN PARA FASE A.
