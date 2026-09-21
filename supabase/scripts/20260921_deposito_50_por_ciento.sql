-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- APLICADO el 2026-09-21 a pedido del PO ("cambia el depósito a 50%").
-- El depósito de reserva pasa de 30 % a 50 % del total (mínimo $150 se mantiene). Recomendación de la investigación de mercado
-- (docs/propuesta-precios-luxury.md): las marcas de lujo cobran 50 % para reservar la fecha.
-- Cambia el 0.30 por 0.50 dentro de las tres funciones que calculan el depósito, sin tocar permisos (CREATE OR REPLACE los conserva)
-- y el valor por defecto de event_quotes.deposit_rate. Los eventos y cotizaciones YA existentes conservan el depósito que ya tenían.
--   * mdj_event_deposit_required_usd(total)  -> GREATEST(total * 0.50, 150)   (la usan los cobros Zelle/staff)
--   * event_quote_record(...)                -> v_deposit = subtotal * 0.50, deposit_rate 0.50
--   * event_quote_convert_to_order(...)      -> v_deposit = subtotal * 0.50, deposit_rate = 0.50
-- Probado antes en transacción deshecha: total $1,000 -> depósito $500; total $200 -> $150 (mínimo); 0 restos de 0.30 en las funciones.
do $t$
declare r record; d text;
begin
  for r in select oid, proname from pg_proc where pronamespace='public'::regnamespace and proname in ('event_quote_record','event_quote_convert_to_order','mdj_event_deposit_required_usd') loop
    d := pg_get_functiondef(r.oid);
    d := replace(d, '* 0.30', '* 0.50');
    d := replace(d, 'deposit_rate = 0.30', 'deposit_rate = 0.50');
    d := replace(d, 'v_deposit, 0.30, v_total', 'v_deposit, 0.50, v_total');
    execute d;
  end loop;
  alter table public.event_quotes alter column deposit_rate set default 0.50;
end $t$;

-- RECÁLCULO DE PENDIENTES al 50 % (aplicado el 2026-09-21, "recalcula los pendientes al 50%"). Solo lo que estaba sin pagar y no cancelado:
--   lead a81679dc (activo, sin pagos)      : deposit_required_usd 324.00  -> 2541.25  (50 % de $5,082.50; el 324 era un valor manual sin relación con ninguna fórmula)
--   lead 932fe157 (activo, sin pagos)      : deposit_required_usd NULL     -> sin cambio (el cálculo automático ya da 50 % = $802.50)
--   orden del constructor a2e6f7fc         : deposit_usd 1425.00 -> 2375.00 (50 % del subtotal $4,750)
--   orden del constructor 70896da3         : deposit_usd  481.50 ->  802.50 (50 % del total $1,605, misma base que el lead)
--   cotización en borrador 9a8649ef        : deposit_usd  465.00 ->  775.00, deposit_rate 0.50 (50 % del subtotal $1,550)
-- NO tocados: los 5 leads CANCELLED (bd53ceb0, 59ccc6de, a771a059, 9a20c7ae, 59e37ec0). Ningún evento tiene pagos.
-- REVERTIDO por el PO ("deja el 324 como estaba", 2026-09-21): lead a81679dc vuelve a deposit_required_usd = 324.00 (acuerdo manual conservado).
