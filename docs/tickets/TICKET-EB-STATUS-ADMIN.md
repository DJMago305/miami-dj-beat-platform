# TICKET-EB-STATUS-ADMIN — Gestión de órdenes del Event Builder desde Admin Dashboard

## Descripción
Cuando un cliente construye su evento en `rentals.html` y presiona "ADD TO MY EVENT",
esa orden debe persistir en Supabase con su número único (`draft_id`) para que el staff
pueda gestionarla desde el Admin Dashboard.

## Número de orden / invoice — llave universal

**Un solo número para todo:**
- Número de orden (cliente)
- Número de invoice / factura (documento formal)
- Referencia de pago (depósito, balance, Stripe)
- ID de búsqueda en Admin Dashboard
- Referencia en comunicaciones (email, WhatsApp, llamada)
- Notas internas del staff

**Formato visible:** `MDJB-2026-A3F2B891`
- `MDJB` — marca Miami DJ Beat
- `2026` — año del evento (no de la creación)
- `A3F2B891` — primeros 8 chars del `draft_id` UUID (único)

**Ejemplo:** `MDJB-2026-A3F2B891`

**Dónde aparece:**
- Header del Event Cart en `rentals.html` (ya implementado, actualizar formato)
- PDF / invoice imprimible (Fase 2)
- Email de confirmación al cliente
- Panel del staff en Admin Dashboard
- Tabla `event_builder_orders.invoice_number` (columna generada)

## Flujo completo

```
Cliente en rentals.html
  → Construye carrito (líneas con precios, artistas asignados)
  → Ve: ORDEN #A3F2B891 + estado COTIZADO en cada línea
  → Presiona "ADD TO MY EVENT"
        ↓ (PERSISTENCIA EN SUPABASE — a implementar)
  → Se guarda en tabla `event_builder_orders` con:
      draft_id, user_id, lines (JSONB), created_at, event_date, event_name

Staff en Admin Dashboard → sección "Órdenes Event Builder"
  → Busca/filtra por ORDEN #A3F2B891 o por fecha de evento
  → Ve el mismo desglose de líneas con cajones
  → Puede:
      - Cambiar estado de cada línea: COTIZADO → EN PROCESO → CONFIRMADO / NO DISPONIBLE
      - Cambiar artista asignado (si el original no está disponible)
      - Agregar notas internas por línea
      - Confirmar disponibilidad de equipos en inventario
      - Enviar propuesta alternativa al cliente (por escrito / llamada)
```

## Vista del staff — datos obligatorios por orden

### Bloque 1 — Datos del cliente (análisis y contacto)
| Campo | Fuente |
|---|---|
| Nombre completo | `client_profiles.full_name` |
| Teléfono | `client_profiles.phone` |
| Email | `auth.users.email` |
| Dirección / Ciudad | `client_profiles.address` / `city` |
| Perfil VIP | `client_profiles.vip_status` (crown + VIP badge si aplica) |
| Historial de eventos | count de órdenes anteriores del mismo `user_id` |

### Bloque 2 — Resumen financiero de la orden
| Concepto | Valor |
|---|---|
| Subtotal | suma de líneas |
| Sales Tax (7%) | subtotal × 0.07 |
| **Total** | subtotal + tax |
| **Depósito 30%** | total × 0.30 |
| **Pagado** | monto confirmado recibido (manual o Stripe) |
| **Saldo pendiente** | total − pagado |
| Estado de pago | Sin pago / Depósito recibido / Pagado completo |

> El campo "Pagado" lo actualiza el staff manualmente o queda sincronizado con Stripe
> si el cliente pagó en línea. El saldo pendiente es la diferencia automática.

## Tabla Supabase necesaria

```sql
CREATE TABLE public.event_builder_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id        UUID NOT NULL UNIQUE,           -- llave compartida cliente ↔ staff (ORDEN #XXXXXXXX)
  user_id         UUID REFERENCES auth.users(id),
  event_name      TEXT,
  event_date      DATE,
  lines           JSONB NOT NULL DEFAULT '[]',    -- snapshot de state.lines completo (con line_status por línea)
  order_status    TEXT NOT NULL DEFAULT 'pending',-- pending / in_review / confirmed / cancelled
  staff_notes     TEXT,
  -- Financiero
  subtotal_usd    NUMERIC(10,2),
  tax_usd         NUMERIC(10,2),
  total_usd       NUMERIC(10,2),
  deposit_usd     NUMERIC(10,2),                  -- 30% del total
  amount_paid_usd NUMERIC(10,2) DEFAULT 0,        -- lo que el cliente ha pagado (depósito o total)
  payment_status  TEXT DEFAULT 'unpaid',          -- unpaid / deposit_paid / paid_full
  stripe_pi_id    TEXT,                           -- Stripe PaymentIntent si pagó en línea
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Vista enriquecida para el staff (une con datos del cliente)
CREATE VIEW public.event_builder_orders_staff AS
SELECT
  o.*,
  o.total_usd - COALESCE(o.amount_paid_usd, 0) AS balance_usd,
  cp.full_name   AS client_name,
  cp.phone       AS client_phone,
  cp.address     AS client_address,
  cp.city        AS client_city,
  cp.vip_status  AS client_vip,
  u.email        AS client_email
FROM public.event_builder_orders o
LEFT JOIN public.client_profiles cp ON cp.user_id = o.user_id
LEFT JOIN auth.users u ON u.id = o.user_id;
```

## Tickets relacionados
- **TICKET-EB-AVAILABILITY** — Filtrar artistas por disponibilidad en la fecha del evento
- **TICKET-EB-UNIVERSAL** — Cart universal en todas las páginas

## Prioridad
Alta — sin esto el staff no puede gestionar las órdenes entrantes.

## Archivos a tocar (Fase 2)
- `web/js/mdj-event-builder.js` — `commitAddToMyEvent()` debe hacer INSERT a Supabase
- `web/admin-dashboard.html` — nueva sección "Órdenes / Event Builder"
- `supabase/migrations/` — crear tabla `event_builder_orders`
- Edge Function o RPC para actualizar `line_status` por línea desde el staff
