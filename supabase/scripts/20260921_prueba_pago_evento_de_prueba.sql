-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- PREPARADO, NO APLICADO. Se aplica solo cuando el PO diga que empieza la prueba de pago.
-- Prueba de pago REAL de centavos con la tarjeta del propio PO (ver docs/prueba-pago-stripe.md, sección 3).
-- STRIPE_SECRET_KEY de producción es LIVE: el depósito de estos eventos se fija en $0.50 (mínimo de Stripe) para que la prueba cueste centavos.
-- Al insertar cada evento se dispara el aviso normal de «lead nuevo» (notify-new-lead): llegará un aviso al staff.
-- Se inserta como servidor (sin sesión): el disparador leads_proteger_columnas_de_dinero deja el total APROBADO con su monto.

-- ═════════ CREAR (aplicar al empezar la prueba) ═════════
insert into public.leads (id, email, contact_person, event_type, event_date, status, source, total_amount, deposit_required_usd, payment_status, balance_paid)
values
  ('00000000-0000-4000-8000-0000000000a5', 'miamidjbeat@gmail.com', 'PRUEBA DE PAGO A (borrar)', 'PRUEBA DE PAGO — depósito sin cupón', current_date + 30, 'NEW', 'prueba_pago_stripe', 100, 0.50, 'UNPAID', 0),
  ('00000000-0000-4000-8000-0000000000b5', 'miamidjbeat@gmail.com', 'PRUEBA DE PAGO B (borrar)', 'PRUEBA DE PAGO — depósito con cupón', current_date + 30, 'NEW', 'prueba_pago_stripe', 100, 0.50, 'UNPAID', 0)
on conflict (id) do nothing;

-- Comprobación tras crear: ambos con total 100, depósito 0.50 y total aprobado = 100.
-- select left(id::text,8), total_amount, deposit_required_usd, total_aprobado_usd, payment_status from public.leads where source = 'prueba_pago_stripe';

-- ═════════ LIMPIAR (aplicar al terminar y después de reembolsar en Stripe) ═════════
-- update public.leads set status = 'CANCELLED' where source = 'prueba_pago_stripe';
-- update public.discount_codes set uses = 0 where code = 'BODA25' and uses = 1;   -- el cupón se gastó solo en la prueba B
-- (los canjes quedan en discount_redemptions como registro de la prueba)
