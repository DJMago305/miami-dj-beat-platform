# Cómo probar los pagos (depósito 50 %, total aprobado, cupones) sin cobrar de más — 2026-09-21

## 1. Por qué no se puede probar con tarjeta de pruebas en producción
`STRIPE_SECRET_KEY` de producción (`hkuvuqupbxwkiykxvqdr`) es **de producción** (verificado: una sesión de Checkout creada empezó por `cs_live_`). Una tarjeta de prueba (4242…) es rechazada por Stripe en modo live, y cambiar la clave a `sk_test_` rompería los cobros reales de eventos, cursos y suscripciones (la usan 13 funciones).

## 2. Estado real del proyecto de PRUEBA (`rtbsovavmtnjpbbpwsin`, «mdjb-ensayo») — NO es viable hoy
Revisado en solo lectura desde esta sesión:
- Está `ACTIVE_HEALTHY`, pero **la base de datos no responde desde aquí** (todas las consultas terminan en «Connection terminated due to connection timeout»), así que no pude comprobar qué tablas tiene.
- Solo tiene desplegada **una** función (`financial-engine`, v3). Ninguna de las funciones de cobro.
- Los pagos dependen de decenas de tablas y funciones de producción (`leads`, `client_profiles`, `discount_*`, `event_builder_orders`, `mdj_staff_manual_invoices`, avisos, auditoría…). Convertirlo en una copia fiel de producción exige llevar el esquema completo (y hay deriva: producción recibió muchos cambios por scripts manuales, no solo por migraciones), poner claves de pruebas (`sk_test_…`, `whsec_…` de un webhook nuevo apuntando a ese proyecto) y probar todo otra vez. Es un trabajo de horas o días, no una preparación.
- **Si el PO quiere ir por ahí de todos modos**, lo mínimo: (a) que la base responda (revisar en el panel de Supabase si el proyecto está pausado o con la red restringida); (b) llevar el esquema con `supabase db push` desde las migraciones y luego los scripts `supabase/scripts/20260921_*.sql`; (c) el PO pone `STRIPE_SECRET_KEY` (sk_test) y `STRIPE_WEBHOOK_SECRET` (whsec del webhook de prueba) en **Settings → Edge Functions → Secrets del proyecto de PRUEBA** (nunca en el chat); (d) desplegar las 4 funciones con `--project-ref rtbsovavmtnjpbbpwsin` (`elixis-chat` con `--no-verify-jwt`); (e) crear en Stripe (modo de pruebas) un webhook hacia `https://rtbsovavmtnjpbbpwsin.supabase.co/functions/v1/stripe-webhook` con los eventos `checkout.session.completed` y `checkout.session.expired`.

## 3. Alternativa recomendada: cobro real mínimo con tu propia tarjeta y reembolso
Se prueba **todo el recorrido real** (función → Stripe → webhook → base de datos) con un evento de prueba de $100 cuyo depósito se fija en **$0.50** (el mínimo que Stripe acepta). Se paga con la tarjeta del PO y se reembolsa. Costo aproximado: la comisión fija de Stripe (~$0.30 por cobro) no se devuelve.
- Yo no puedo poner datos de tarjeta: **el pago lo hace el PO** en la página de Stripe.
- El evento de prueba se crea con `supabase/scripts/20260921_prueba_pago_evento_de_prueba.sql` (PREPARADO, NO APLICADO). Al insertarse dispara el aviso normal de «lead nuevo» (llegará un correo/aviso al staff).

### Prueba A — depósito sin cupón
1. Se aplica la sección «CREAR» del script (crea el evento A: total $100, depósito $0.50, aprobado por el servidor).
2. Yo llamo `create-event-payment` con `{lead_id: A, kind: "deposit"}` y verifico: sesión `cs_live_…` por **50 centavos**.
3. El PO abre la URL y paga $0.50 con su tarjeta.
4. Yo verifico en la base: `balance_paid = 0.50`, `payment_status = PARTIAL`, `total_amount` sin cambio, y que un cliente ya no puede bajar el total (congelado).

### Prueba B — depósito con cupón BODA25
1. Sección «CREAR» del script para el evento B (mismo formato).
2. Yo llamo con `{lead_id: B, kind: "deposit", coupon_code: "BODA25"}`: debe reservar el cupón (`discount_redemptions.status = reserved`, `uses` sigue en 0) y crear la sesión por 50 centavos.
3. El PO paga $0.50.
4. Yo verifico: el cupón queda `redeemed`, `discount_codes.uses = 1`, `total_amount` baja $26.75 (de $100 a $73.25), `coupon_discount_cents = 2500`, total aprobado acompaña, y que reintentar el aviso no descuenta dos veces.

### Cierre
- El PO reembolsa los dos cobros desde el panel de Stripe (Payments → cada cobro → Refund).
- Se aplica la sección «LIMPIAR» del script: cancela los dos eventos de prueba y devuelve `BODA25.uses` a 0.
- **Riesgos:** el pago es real (centavos) y a tu propia tarjeta; las sesiones sin pagar vencen solas; el uso del cupón queda contado hasta la limpieza; si el aviso `checkout.session.expired` no está suscrito en el webhook de Stripe, el barrido horario libera las reservas a las 26 h.

## 4. Decisión pendiente
Elegir A (proyecto de PRUEBA, trabajo grande y hoy bloqueado por la conexión) o B (cobro real mínimo, recomendado).
