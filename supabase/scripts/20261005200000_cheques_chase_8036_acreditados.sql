-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - Los 3 cheques QuickDeposit de Chase 8036 YA ESTAN ACREDITADOS (el PO los vio en el banco el 2026-10-05): PENDING -> CONFIRMED
-- Solo toca las 3 filas cargadas el 2026-10-05 (por su idempotency_key) y solo si siguen en PENDING; correrlo dos veces no cambia nada mas. No toca ninguna otra fila ni tabla.
update public.financial_payments
   set status = 'CONFIRMED', updated_at = now()
 where idempotency_key in ('48c4fc5f-fdd3-5804-a69a-71c7e84e2621', '74ad313b-2d39-58e7-a0ac-d6402653cf90', 'a04f999e-2c94-5a6c-8488-703133685bf0')
   and direction = 'INFLOW' and account = 'Chase 8036' and status = 'PENDING';

-- Comprobacion: deben ser 3 filas CONFIRMED por 187500 centavos ($1,875.00) y 0 PENDING.
select count(*) filter (where status = 'CONFIRMED') as confirmados,
       coalesce(sum(amount_cents) filter (where status = 'CONFIRMED'), 0) as confirmado_centavos,
       count(*) filter (where status = 'PENDING') as pendientes,
       count(*) as total_filas
  from public.financial_payments where account = 'Chase 8036' and direction = 'INFLOW';
