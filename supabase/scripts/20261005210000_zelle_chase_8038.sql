-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - COBROS REALES de la empresa en la cuenta Chase 8038 (Membresia / pagos web): 2 Zelle recibidos (financial_payments, INFLOW)
-- Fuente: avisos de Chase vistos por el PO; el PO confirmo el 2026-10-05 que entran y que cayeron en la cuenta 8038. Los avisos no dicen concepto ni servicio.
-- Estado CONFIRMED: un Zelle recibido se deposita al instante (no hay periodo "por acreditar" como en un cheque).
-- Idempotente: cada fila lleva su idempotency_key fija; correrlo dos veces no duplica. NO mezcla con residencias ni con el libro de los DJ.
insert into public.financial_payments (idempotency_key, direction, amount_cents, currency, method, account, reference, payment_date, status) values
  ('4753d0d0-8748-56a5-8984-34ab5afff535', 'INFLOW', 12000, 'USD', 'ZELLE', 'Chase 8038', 'Zelle de MARIA ALEXANDRA GONZALEZ - transaccion 31070748368 - sin concepto todavia', date '2026-10-03', 'CONFIRMED'),
  ('fac2645f-5c3b-56c5-8000-25ef886457b9', 'INFLOW', 4000, 'USD', 'ZELLE', 'Chase 8038', 'Zelle de ALEJANDRO CAAL - sin concepto todavia', date '2026-09-29', 'CONFIRMED')
on conflict (idempotency_key) do nothing;

-- Comprobacion: deben ser 2 filas por 16000 centavos ($160.00) en Chase 8038; y en total 5 cobros por 203500 centavos ($2,035.00).
select (select count(*) from public.financial_payments where account = 'Chase 8038' and direction = 'INFLOW') as zelle_filas,
       (select coalesce(sum(amount_cents), 0) from public.financial_payments where account = 'Chase 8038' and direction = 'INFLOW') as zelle_centavos,
       (select count(*) from public.financial_payments where direction = 'INFLOW') as cobros_total,
       (select coalesce(sum(amount_cents), 0) from public.financial_payments where direction = 'INFLOW') as total_centavos;
