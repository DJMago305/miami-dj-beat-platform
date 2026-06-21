# TICKET: Notificaciones de Orden — Cliente + DJ
**Estado:** 🟡 PENDIENTE — próxima sesión  
**Fecha creación:** 2026-06-21  
**Capitán:** DJMago305  
**Archivos en scope:** Edge Function nueva, `web/staff-order.html` (disparo)

---

## OBJETIVO

Cuando el staff modifica, aprueba o agrega algo en una orden, el sistema debe notificar automáticamente a las partes involucradas.

---

## NOTIFICACIÓN 1 — CLIENTE

**Cuándo dispara:**
- Cambio de estado de la orden (Pendiente → En Revisión → Confirmado → Cancelado)
- Modificación de línea de servicio (agregar / editar)
- Actualización de horario (Time In / Time Out)
- Actualización de ubicación

**Canal:** Email + SMS ✅ (ambos obligatorios)

**Contenido del mensaje:**
- Nombre del cliente
- Tipo de evento + fecha
- Estado actual de la orden
- Link directo: `client-portal.html?lead=<id>` (acceso completo a su portal)

**Datos disponibles en `leads`:**
- `leads.email` ✅
- `leads.phone` ✅
- `leads.event_type` ✅
- `leads.event_date` ✅
- `leads.status` ✅

---

## NOTIFICACIÓN 2 — DJ ASIGNADO

**Cuándo dispara:**
- Cuando el staff asigna un DJ a la orden (`assigned_dj_id` se puebla)

**Canal:** Email + SMS

**Contenido del mensaje (SOLO informativo — sin acceso a contrato ni precio):**
- Nombre del evento (tipo)
- Fecha del evento
- Time In / Time Out
- Dirección / Ubicación
- Nombre del cliente de contacto
- Teléfono del cliente — **SOLO si `payment_status = PARTIAL` o `PAID`** (depósito realizado) ✅

**PROHIBIDO incluir en el mensaje del DJ:**
- ❌ Precio / presupuesto
- ❌ Link al contrato
- ❌ Monto de pago / comisión
- ❌ Notas internas del staff

**Datos disponibles:**
- `leads.assigned_dj_id` / `leads.assigned_dj_name` ✅
- `dj_profiles.email` (por `assigned_dj_id`) — query en Edge Function
- `leads.event_start_time` / `leads.event_end_time` ✅
- `leads.location` ✅
- `leads.event_type` / `leads.event_date` ✅

---

## ARQUITECTURA TÉCNICA

| Capa | Detalle |
|---|---|
| Edge Function cliente | `notify-client-order-update` — Resend / SendGrid + Twilio |
| Edge Function DJ | `notify-dj-assignment` — mismo stack |
| Disparo cliente | `staff-order.html` → Save → si hubo cambio de status o líneas |
| Disparo DJ | `staff-order.html` → asignación de DJ (`assigned_dj_id` cambia) |
| Templates | HTML email + texto SMS por tipo (created / updated / confirmed / cancelled) |

---

## PASOS PARA LA PRÓXIMA SESIÓN

```
PASO 1 — ✅ RESUELTO: cliente recibe Email + SMS
PASO 2 — ✅ RESUELTO: DJ recibe teléfono del cliente SOLO después del depósito
          Condición: leads.payment_status IN ('PARTIAL', 'PAID') o
                     event_builder_orders.payment_status IN ('deposit_paid', 'paid_full')
PASO 3 — Crear Edge Functions (notify-client + notify-dj)
PASO 4 — Cablear disparo en staff-order.html → Save + asignación DJ
PASO 5 — Test real: modificar orden → verificar email/SMS llega
```

---

## NOTAS DE DISEÑO
- El DJ recibe SOLO información logística del evento — sin precios, sin contrato, sin acceso al portal
- El cliente recibe link a su portal completo (`client-portal.html?lead=<id>`)
- Si el teléfono tiene formato raw (ej: `3054235812`), la Edge Function lo normaliza antes de enviar al SMS
