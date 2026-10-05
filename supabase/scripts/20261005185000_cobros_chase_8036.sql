-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - COBROS REALES de la empresa en la cuenta Chase 8036: 3 cheques QuickDeposit (financial_payments, INFLOW)
-- Fuente: avisos de Chase vistos por el PO el 2026-10-05 (no dicen cliente ni concepto). Estado PENDING: el aviso dice "recibido", no "acreditado"; pasar a CONFIRMED cuando el banco lo acredite.
-- Idempotente: cada fila lleva su idempotency_key fija; correrlo dos veces no duplica. NO mezcla con residencias ni con el libro de los DJ. Los Zelle NO se incluyen (falta confirmar cuenta y concepto).
insert into public.financial_payments (idempotency_key, direction, amount_cents, currency, method, account, reference, payment_date, status) values
  ('48c4fc5f-fdd3-5804-a69a-71c7e84e2621', 'INFLOW', 47500, 'USD', 'CHECK', 'Chase 8036', 'Cheque QuickDeposit 2026-10-03 01:08 ET - sin cliente ni concepto todavia', date '2026-10-03', 'PENDING'),
  ('74ad313b-2d39-58e7-a0ac-d6402653cf90', 'INFLOW', 35000, 'USD', 'CHECK', 'Chase 8036', 'Cheque QuickDeposit 2026-10-04 03:32 ET - sin cliente ni concepto todavia', date '2026-10-04', 'PENDING'),
  ('a04f999e-2c94-5a6c-8488-703133685bf0', 'INFLOW', 105000, 'USD', 'CHECK', 'Chase 8036', 'Cheque QuickDeposit 2026-10-04 20:13 ET - sin cliente ni concepto todavia', date '2026-10-04', 'PENDING')
on conflict (idempotency_key) do nothing;

-- Comprobacion: deben ser 3 filas y 187500 centavos ($1,875.00) en total.
select count(*) as filas, sum(amount_cents) as total_centavos, min(payment_date) as desde, max(payment_date) as hasta
  from public.financial_payments where account = 'Chase 8036' and direction = 'INFLOW';
