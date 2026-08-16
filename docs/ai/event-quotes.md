# Cotizaciones ELIXIS — Miami DJ Beat LLC

**Marca:** Miami DJ Beat LLC  
**Estado:** runtime en producción (`event_quotes` + tools ELIXIS). Sin vista pública ni conversión a orden formal.

## Qué es

Presupuesto de staff en borrador. ELIXIS no inventa dólares: el servidor resuelve SKUs del catálogo, calcula líneas y persiste un draft. No escribe `event_builder_orders`, no cobra y no envía el documento al cliente.

## Piezas

| Pieza | Rol |
|---|---|
| `public.event_quotes` | Tabla append-only. `status = draft`. RLS: staff `SELECT`. Sin INSERT/UPDATE de cliente. |
| `event_quote_record` | RPC `service_role`. Recalcula `line = unit × qty`, tax 7% y depósito 30% sobre el subtotal. |
| `event-quote-catalog.ts` | Matriz canónica de SKUs + overlay `platform_settings.rentals_catalog_prices`. |
| `consultar_catalogo_precios` | Tool read. Gate `policy: none`. |
| `generar_cotizacion_evento` | Tool write. Gate `auto_staff` → RPC → `agent_action_log_write` → `ai_kpi`. |

## Motor de precios

1. Overlay del catálogo owner; si falta la clave, fallback estático.
2. SKU desconocido → error. El modelo no manda montos.
3. `tipo_evento` opcional elige el paquete DJ (wedding/corporate 5 h, private/clubs/family 4 h, holiday 5 h). Hora extra DJ = `dj_extra_hour` a $100/h.
4. Totales persistidos solo en el RPC.

## Fuera de este módulo

Vista pública `/quote.html`, aceptación del cliente, y Quote → Checkout / Stripe. Esas líneas son tickets posteriores, no un hueco de este mapa.
