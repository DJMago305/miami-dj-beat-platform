# Diseño — Calendario de Cliente, Fase 2 (2026-09-04)

> Estado: **DISEÑO, nada construido todavía.** Continúa el trabajo de
> [Fase 1](../CLAUDE.md) (toggle de Google Calendar en Config, calendario visual
> en MI PORTAL) documentado en la memoria `project_client_portal_roadmap`.
> Pedido por el PO: "diseña las 3 piezas" — login de amigos vía Google,
> alerta automática al comprar una fecha, memoria anual + libro de eventos + IA.

Antes de diseñar se revisó el esquema REAL de Supabase (proyecto prod
`hkuvuqupbxwkiykxvqdr`, solo lectura). Hay más infraestructura de la que
parecía a simple vista — varias tablas ya existen, con 0 filas: construidas
para algo, pero no conectadas todavía. El diseño de abajo reutiliza esas
tablas en vez de inventar nuevas donde ya hay una equivalente.

## Tablas reales relevantes (ya existen)

| Tabla | Filas | Para qué sirve hoy |
|---|---|---|
| `master_clients` | 2 | Registro maestro de personas: `normalized_email`, `normalized_phone`, `name`, `birthday`, `wedding_anniversary` — **esto ya es la fila de deduplicación** que pedía el spec original. |
| `dj_client_affiliations` | 2 | Une un `dj_id` a un `master_client_id`, guardando `original_contact_name` — así el mismo `master_clients.id` puede estar afiliado a varios DJs sin duplicarse. |
| `client_profiles` | 6 | Ya tiene `birth_date` y `wedding_anniversary` propios del cliente. |
| `leads` | 7 | El booking real: `event_date`, `event_start_time`, `payment_status`, `event_completed_at`, `client_user_id`. |
| `user_calendar_integrations` | 0 | El OAuth de Google que ya construimos (Fase 1) — tiene `sync_token`, `channel_id`, `channel_expires_at`: ya preparada para webhooks push de Google, no solo polling. |
| `event_reminders_queue` | 0 | Cola de recordatorios: `dj_id`, `event_id`, `scheduled_for`, `reminder_type`, `status`, `provider_message_id` — existe, vacía, sin nada que la llene todavía. |
| `event_notes` | 0 | Notas por evento: `dj_uuid`, `event_id`, `type`, `title`, `body`, `priority` — candidata natural para el "libro" de eventos. |
| `elixis_agenda_eventos` | 0 | Eventos de calendario con `agent_id` y `external_event_id` — sugiere que ya se pensó en que ELIXIS participe y en sincronizar con un calendario externo (Google), pero está vacía. |
| `portal_messages` | 12 | Canal cliente↔staff ya en uso (el mismo que abre "Soporte·Tickets"). |

**Nota**: `event_reminders_queue` y `event_notes` están **scoped a `dj_id`/`dj_uuid`**,
no a `client_user_id`. Para que un cliente tenga su propia cola/libro hace falta
una migración aditiva (agregar columna nullable), no usarlas tal cual.

---

## Pieza 1 — Login de Google Calendar de los amigos del cliente

**Objetivo del PO**: el cliente conecta su Google Calendar, y no solo el
suyo — también las fechas de cumpleaños/aniversarios de SUS amigos, para que
Miami DJ Beat pueda ayudarles a dar seguimiento.

**Cómo se lee eso de Google, técnicamente**: Google Calendar tiene un
calendario especial de solo lectura, `addressbook#contacts@group.v.calendar.google.com`
("Cumpleaños"), que se llena automáticamente con los contactos de la cuenta de
Google del usuario. **Sin verificar todavía**: si el scope ya aprobado
(`calendar.events`) alcanza para LEER ese calendario especial, o si además
hace falta `calendar.calendarlist.readonly` para poder listarlo. Antes de
construir esto hay que probarlo contra una cuenta de Google real — no asumir.

**Esquema propuesto**:
- Generalizar `dj_client_affiliations` en vez de duplicarla: agregar
  `owner_type text` (`'dj'` | `'client'`) y `owner_id uuid` en lugar de
  `dj_id` fijo — o, más simple y menos riesgoso, crear una tabla hermana
  `client_contact_affiliations (client_user_id, master_client_id, original_contact_name, created_at)`
  con la misma forma. Cualquiera de las dos evita duplicar la lógica de
  deduplicación que `master_clients` ya resuelve.
- Ingesta: extender `calendar-sync-webhook` (ya existe) para que, además de
  `primary`, también lea el calendario de Cumpleaños. Por cada entrada:
  normalizar nombre y (si existe) email/teléfono → buscar match en
  `master_clients` por `normalized_email`/`normalized_phone` → si no existe,
  crear la fila → enlazar via la tabla de afiliación de arriba.
- **Advertencia de privacidad, la misma señalada el 2026-09-03, ahora con más
  peso**: estos son datos de TERCEROS (los amigos) que nunca dieron su propio
  consentimiento a Miami DJ Beat. Recomendación: un texto de consentimiento
  SEPARADO y explícito para esta parte específica (no agrupado dentro del
  switch general de "Sincronizar Calendario de Google"), algo como *"al
  activar esto, compartes con Miami DJ Beat los cumpleaños/aniversarios de tus
  contactos de Google, para ayudarte a planear sus celebraciones"* — y
  considerar guardar el mínimo necesario (nombre + fecha), no el email/teléfono
  del contacto si Google no lo expone en ese calendario especial.

---

## Pieza 2 — Alerta automática al comprar una fecha de evento

**Objetivo del PO**: cuando el cliente compra/reserva un evento, debe
reflejarse solo en su calendario, con una alerta personalizada.

**La mitad de esto ya funciona sin tocar nada**: `client-portal.js` lee
`leads` fresco cada vez que carga la página — en cuanto un lead del cliente
tiene `event_date`, ya aparece como chip en el calendario del Portal (Fase 1,
hoy). Lo que falta es la ALERTA, no el reflejo visual.

**Trigger real, pendiente de confirmar**: hace falta identificar el punto
exacto del flujo de checkout/pago donde un `lead` pasa a estar confirmado —
candidatos en el esquema: `leads.payment_status`, o el momento en que se
llena `leads.event_completed_at` / se asigna `assigned_dj_id`. No asumir cuál
es sin leer el código del checkout primero.

**Esquema propuesto** (reutiliza `event_reminders_queue`, no inventa una tabla
nueva):
- Migración aditiva: agregar `client_user_id uuid` (nullable) a
  `event_reminders_queue`, para que pueda apuntar a un cliente en vez de (o
  además de) a un DJ.
- En el punto de confirmación del lead (trigger de Postgres sobre `leads`, o
  código explícito en el edge function de checkout): insertar una fila con
  `reminder_type='booking_confirmed'`, `client_user_id`, `event_id=lead.id`,
  `scheduled_for=now()`.
- Un worker (edge function con cron, o el mismo webhook que ya procesa la
  cola para DJs) recoge las filas `status='pending'` y las entrega. Canal de
  entrega más simple y ya construido: insertar en `portal_messages` como
  mensaje de `sender_role='system'` — aparece directo en la bandeja del
  cliente sin construir un sistema de notificación nuevo desde cero.

---

## Pieza 3 — Memoria anual + "libro" de eventos + IA

**Objetivo del PO**: que el sistema recuerde año a año qué eventos se hicieron
con cada cliente, documentados con detalle, para ayudar a personalizar el
próximo — usando la IA que ya existe (ELIXIS) para llevarlo "a otro nivel".

**El "libro"**: extender `event_notes` (ya existe) con `client_user_id uuid`
nullable, para que una nota de evento pueda pertenecer a un cliente además
de/en vez de a un DJ. Cada evento pasado (`leads` con `event_completed_at` no
nulo) puede tener N filas en `event_notes` — tipo, detalle, quién la escribió.
Esto es literalmente el "libro con detalles" que describe el PO, solo que
hoy es una tabla vacía sin nadie escribiéndole.

**La memoria anual**: una función programada (Supabase cron / pg_cron, diaria)
que compara `leads.event_date` (años anteriores) y `client_profiles.birth_date`/
`wedding_anniversary` contra la fecha de hoy + N días — si hay una coincidencia
de mes/día de un año anterior, inserta una fila en `event_reminders_queue`
(`reminder_type='yearly_recall'`) dirigida a STAFF (para que el equipo dé
seguimiento) y opcionalmente una al propio cliente ("¿celebramos otra vez este
[tipo de evento]?").

**La capa de IA**: `elixis-chat` (el edge function real de ELIXIS, confirmado
en `docs/ESTADO_MAESTRO.md`) puede recibir como contexto el historial de
`leads` + `event_notes` de un cliente para REDACTAR el texto de la alerta
personalizada (Pieza 2) o la sugerencia de recordatorio anual (Pieza 3) — es
trabajo de armar el contexto y el prompt, no un sistema de IA nuevo.
`elixis_agenda_eventos` ya tiene columnas `agent_id`/`external_event_id` que
sugieren que esta idea ya se había planteado antes en algún punto — vale la
pena preguntar si alguien más ya empezó a construir sobre esa tabla antes de
asumir que está libre.

---

## Orden recomendado, si se construye

1. **Pieza 2 primero** — es la más chica, reutiliza `event_reminders_queue` +
   `portal_messages` (ambas ya existen), y no toca datos de terceros. Requiere
   solo: 1 columna nueva, 1 trigger/hook en el checkout, 1 worker de entrega.
2. **Pieza 3 después** — el "libro" es una columna nueva en `event_notes` +
   disciplina de que alguien (staff o IA) efectivamente lo llene. La memoria
   anual es una función programada sencilla sobre datos que ya existen.
3. **Pieza 1 al final** — es la que toca datos de terceros sin su
   consentimiento directo; necesita resolver la pregunta de privacidad y
   confirmar el scope real de Google antes de escribir una sola línea.

Nada de esto se construye sin que el PO decida por cuál empezar.
