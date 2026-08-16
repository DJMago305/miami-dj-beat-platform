# Cotizaciones ELIXIS — Miami DJ Beat LLC

**Marca:** Miami DJ Beat LLC  
**Estado:** flujo completo en producción. ELIXIS solo escribe el draft; staff convierte y cobra.

## Qué es

Presupuesto de staff. ELIXIS no inventa dólares: el servidor resuelve SKUs del catálogo, calcula líneas y persiste un draft en `event_quotes`. La conversión a orden formal y el checkout Stripe los dispara staff, no el modelo ni el cliente.

## Piezas

| Pieza | Rol |
|---|---|
| `public.event_quotes` | Draft comercial. `status`: `draft` \| `converted` \| `expired` \| `void`. Columna `ebo_id` tras convertir. RLS: staff `SELECT`. Sin INSERT/UPDATE de cliente. |
| `event_quote_record` | RPC `service_role`. Recalcula `line = unit × qty`, tax 7% y depósito 30% sobre el subtotal. |
| `get_public_event_quote` | RPC público (`anon` + `authenticated`). Vista de 45 días. Omite internos (staff, lead, hours, source, agent, sku). |
| `event_quote_convert_to_order` | RPC `service_role`. Recalcula, inserta `event_builder_orders` (`draft_id = QTE-<8>`), idempotente. `lead_id` obligatorio. |
| `event-quote-catalog.ts` | Matriz canónica de SKUs + overlay `platform_settings.rentals_catalog_prices`. |
| `consultar_catalogo_precios` | Tool read. Gate `policy: none`. |
| `generar_cotizacion_evento` | Tool write. Gate `auto_staff` → `event_quote_record` → `agent_action_log_write` → `ai_kpi`. No llama Stripe ni escribe EBO. |
| `web/quote.html` | Vista pública. `?id=<uuid>` → `get_public_event_quote`. Aceptar del cliente apagado (v1 staff-only). |
| `create-quote-deposit` | Edge staff (JWT + rol owner/admin/manager/seller). Convierte vía RPC y abre Stripe Checkout. Monto solo de la DB. |
| `stripe-webhook` | Rama aditiva `metadata.source=quote`: EBO `deposit_paid` / `paid_full` + `leads.balance_paid`. |
| `web/js/production-module.js` | Panel Producción: lista `event_quotes`, POST `{ quote_id, lead_id }` a `create-quote-deposit`, abrir Stripe o copiar link. |

## Motor de precios

1. Overlay del catálogo owner; si falta la clave, fallback estático.
2. SKU desconocido → error. El modelo no manda montos.
3. `tipo_evento` opcional elige el paquete DJ (wedding/corporate 5 h, private/clubs/family 4 h, holiday 5 h). Hora extra DJ = `dj_extra_hour` a $100/h.
4. Totales persistidos solo en el RPC. Depósito canónico: 30% del subtotal.

## Flujo

1. Staff autenticado pide cotización a ELIXIS → draft en `event_quotes`.
2. Cliente ve `/quote.html?id=<uuid>` sin sesión.
3. Staff en Producción genera el depósito → `event_quote_convert_to_order` + Stripe.
4. Webhook marca el cobro en EBO y el balance del lead.

## Decisiones cerradas (v1)

- Conversión y checkout: solo staff. El botón Aceptar de `quote.html` permanece apagado.
- `lead_id` es obligatorio para convertir.
- El cliente del navegador no envía dólares a `create-quote-deposit`.
