-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- PREPARADO, NO APLICADO (se aplica antes de desplegar la fase 2/3, con visto bueno del PO).
-- CUPONES, OPCIÓN B, FASE 3 de 3 (parte base de datos).
--
-- Problema que resuelve: el cliente paga el depósito CON cupón (Stripe cobra menos), pero leads.total_amount sigue con el total
-- SIN cupón, así que el webhook nunca llegaría a marcar PAID (balance_paid < total_amount). Además el portal recalcula
-- total_amount desde el carrito y lo reescribe en cada cambio, borrando cualquier ajuste. Solución:
--   1) leads.coupon_discount_cents: descuento de cupón YA COBRADO (lo escribe solo el servidor). El portal lo resta del carrito.
--   2) discount_confirm_y_ajustar_total(session): en UNA transacción confirma el canje (sube uses) y baja total_amount
--      en descuento × (1 + 7 % de impuesto) — el cupón resta antes del impuesto. Idempotente ante reintentos del webhook.
--   3) barrido horario de reservas vencidas (>26 h) con pg_cron.

alter table public.leads add column if not exists coupon_discount_cents bigint not null default 0 check (coupon_discount_cents >= 0);
comment on column public.leads.coupon_discount_cents is 'Descuento de cupón ya cobrado (antes de impuesto). Lo escribe SOLO discount_confirm_y_ajustar_total; el portal lo resta del carrito para que el recalculo de total_amount no lo pierda.';

create or replace function public.discount_confirm_y_ajustar_total(p_stripe_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_r public.discount_redemptions%rowtype;
  v_baja numeric;
begin
  if p_stripe_session_id is null or trim(p_stripe_session_id) = '' then return jsonb_build_object('ok', false, 'error', 'sin_sesion'); end if;
  select * into v_r from public.discount_redemptions where stripe_session_id = p_stripe_session_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'sin_reserva'); end if;
  if v_r.status = 'redeemed' then return jsonb_build_object('ok', true, 'ya_confirmado', true, 'redemption_id', v_r.id); end if;

  update public.discount_redemptions set status = 'redeemed', redeemed_at = now(), released_at = null where id = v_r.id;
  update public.discount_codes set uses = uses + 1 where id = v_r.discount_code_id;

  v_baja := round(v_r.discount_cents * 1.07) / 100.0;   -- el cupón resta antes del impuesto (7 %)
  update public.leads
     set coupon_discount_cents = coupon_discount_cents + v_r.discount_cents,
         total_amount = greatest(coalesce(total_amount, 0) - v_baja, 0)
   where id = v_r.lead_id;

  return jsonb_build_object('ok', true, 'redemption_id', v_r.id, 'discount_cents', v_r.discount_cents, 'total_reducido_usd', v_baja);
end;
$$;
revoke execute on function public.discount_confirm_y_ajustar_total(text) from public, anon, authenticated;
grant execute on function public.discount_confirm_y_ajustar_total(text) to service_role;

-- Barrido horario: libera reservas de >26 h (sesión de Stripe vencida sin aviso).
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'discount_release_stale_hourly') then
    perform cron.schedule('discount_release_stale_hourly', '17 * * * *', $c$select public.discount_release_stale(26)$c$);
  end if;
end $$;
