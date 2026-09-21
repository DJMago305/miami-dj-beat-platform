-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- YA APLICADO el 2026-09-21 (a pedido del PO, "arranca con la fase 1").
-- CUPONES, OPCIÓN B, FASE 1 de 3: solo base de datos. INERTE: ningún código la llama todavía y no cambia ningún cobro.
--
-- Contexto: los cupones eran DECORATIVOS. El portal muestra "-$25" pero payDepositStripe() manda a Stripe el depósito
-- completo, y mdj_redeem_discount_code nunca se llamaba (uses = 0). Para que un cupón sea real, el SERVIDOR debe calcular
-- el descuento, Stripe cobrar el monto final, y el uso contarse SOLO cuando Stripe confirma el pago.
--
-- Diseño (independiente de las 4 decisiones de negocio aún abiertas con el PO):
--   reserved  = el cliente abrió el pago con el cupón (cuenta para el tope, NO gasta el uso)
--   redeemed  = Stripe confirmó el pago (aquí y solo aquí sube discount_codes.uses)
--   released  = la sesión de pago venció o se canceló (devuelve el cupo)
--   Índice único (lead_id, discount_code_id) entre reserved/redeemed: el MISMO cupón no se aplica dos veces al mismo evento
--   (no impide acumular cupones distintos: eso queda como decisión del PO).
--   Reintentos del cliente = idempotentes. Tope: usos confirmados + reservas vivas (no se vende de más un cupón limitado).
--   La cuenta del descuento es idéntica a mdj_validate_discount_code (lo que ya ve la pantalla).
--   Escritura solo por funciones service_role; el staff puede LEER los canjes (RLS).
-- Fase 2 (pendiente, requiere decisiones del PO): create-event-payment llama discount_reserve y cobra el monto final.
-- Fase 3 (pendiente): stripe-webhook llama discount_confirm / discount_release + barrido discount_release_stale.

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references public.discount_codes(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete cascade,
  order_cents bigint not null check (order_cents >= 0),
  discount_cents bigint not null check (discount_cents >= 0),
  status text not null default 'reserved' check (status in ('reserved','redeemed','released')),
  stripe_session_id text,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  released_at timestamptz
);
create unique index if not exists discount_redemptions_uno_activo_por_lead_y_codigo
  on public.discount_redemptions (lead_id, discount_code_id) where status in ('reserved','redeemed');
create index if not exists discount_redemptions_por_sesion on public.discount_redemptions (stripe_session_id) where stripe_session_id is not null;
create index if not exists discount_redemptions_por_estado on public.discount_redemptions (status, created_at);

alter table public.discount_redemptions enable row level security;
drop policy if exists "Staff ve los canjes de cupones" on public.discount_redemptions;
create policy "Staff ve los canjes de cupones" on public.discount_redemptions for select to authenticated
  using (exists (select 1 from public.dj_profiles where user_id = auth.uid() and lower(trim(role)) in ('owner','admin','manager','seller')));
revoke all on table public.discount_redemptions from public, anon;
revoke insert, update, delete, truncate, references, trigger on table public.discount_redemptions from authenticated;

comment on table public.discount_redemptions is 'Canje de cupones por evento. reserved = cliente abrió el pago; redeemed = Stripe confirmó (aquí y solo aquí sube discount_codes.uses); released = sesión vencida/cancelada. Escritura solo vía discount_reserve/confirm/release (service_role).';

create or replace function public.discount_reserve(p_code text, p_lead_id uuid, p_order_cents bigint, p_stripe_session_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.discount_codes%rowtype;
  v_now timestamptz := now();
  v_disc bigint := 0;
  v_reservados int;
  v_existente public.discount_redemptions%rowtype;
  v_id uuid;
begin
  if p_code is null or trim(p_code) = '' then return jsonb_build_object('ok', false, 'error', 'sin_codigo'); end if;
  if p_lead_id is null then return jsonb_build_object('ok', false, 'error', 'sin_evento'); end if;
  if p_order_cents is null or p_order_cents < 0 then return jsonb_build_object('ok', false, 'error', 'monto_invalido'); end if;

  -- Bloquea la fila del cupón: serializa el conteo de topes entre dos pagos simultáneos.
  select * into v_row from public.discount_codes
   where upper(trim(code)) = upper(trim(p_code)) and active = true
     and (valid_from is null or valid_from <= v_now) and (valid_until is null or valid_until >= v_now)
   for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'codigo_invalido_o_vencido'); end if;

  if v_row.min_order_cents is not null and p_order_cents < v_row.min_order_cents then
    return jsonb_build_object('ok', false, 'error', 'pedido_minimo', 'min_order_cents', v_row.min_order_cents);
  end if;

  -- Misma cuenta que mdj_validate_discount_code (lo que ve la pantalla del cliente).
  if v_row.discount_type = 'fixed' and v_row.amount_cents is not null then
    v_disc := least(v_row.amount_cents, greatest(p_order_cents, 0));
  elsif v_row.discount_type = 'percent' and v_row.percent is not null then
    v_disc := floor(p_order_cents * v_row.percent / 100.0);
  end if;
  if v_disc <= 0 then return jsonb_build_object('ok', false, 'error', 'sin_descuento'); end if;

  -- ¿Ya hay un canje activo de ESTE cupón en ESTE evento? (reintentos del cliente = idempotente)
  select * into v_existente from public.discount_redemptions
   where lead_id = p_lead_id and discount_code_id = v_row.id and status in ('reserved','redeemed');
  if found then
    if v_existente.status = 'redeemed' then return jsonb_build_object('ok', false, 'error', 'ya_canjeado_en_este_evento'); end if;
    update public.discount_redemptions set stripe_session_id = coalesce(p_stripe_session_id, stripe_session_id),
      order_cents = p_order_cents, discount_cents = v_disc where id = v_existente.id;
    return jsonb_build_object('ok', true, 'redemption_id', v_existente.id, 'discount_cents', v_disc, 'code', v_row.code, 'label', coalesce(v_row.label, v_row.code), 'reintento', true);
  end if;

  -- Tope: usos ya confirmados + reservas vivas (para no vender de más un cupón limitado).
  if v_row.max_uses is not null then
    select count(*) into v_reservados from public.discount_redemptions where discount_code_id = v_row.id and status = 'reserved';
    if v_row.uses + v_reservados >= v_row.max_uses then return jsonb_build_object('ok', false, 'error', 'cupon_agotado'); end if;
  end if;

  begin
    insert into public.discount_redemptions (discount_code_id, lead_id, order_cents, discount_cents, stripe_session_id)
    values (v_row.id, p_lead_id, p_order_cents, v_disc, p_stripe_session_id) returning id into v_id;
  exception when foreign_key_violation then
    return jsonb_build_object('ok', false, 'error', 'evento_no_encontrado');
  end;
  return jsonb_build_object('ok', true, 'redemption_id', v_id, 'discount_cents', v_disc, 'code', v_row.code, 'label', coalesce(v_row.label, v_row.code));
end;
$$;

create or replace function public.discount_confirm(p_stripe_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_r public.discount_redemptions%rowtype;
begin
  if p_stripe_session_id is null or trim(p_stripe_session_id) = '' then return jsonb_build_object('ok', false, 'error', 'sin_sesion'); end if;
  select * into v_r from public.discount_redemptions where stripe_session_id = p_stripe_session_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'sin_reserva'); end if;
  if v_r.status = 'redeemed' then return jsonb_build_object('ok', true, 'ya_confirmado', true, 'redemption_id', v_r.id); end if;
  -- reserved o released: el pago YA ocurrió con el descuento aplicado, así que cuenta igual (sin revalidar tope).
  update public.discount_redemptions set status = 'redeemed', redeemed_at = now(), released_at = null where id = v_r.id;
  update public.discount_codes set uses = uses + 1 where id = v_r.discount_code_id;
  return jsonb_build_object('ok', true, 'redemption_id', v_r.id, 'discount_cents', v_r.discount_cents);
end;
$$;

create or replace function public.discount_release(p_stripe_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_n int;
begin
  update public.discount_redemptions set status = 'released', released_at = now()
   where stripe_session_id = p_stripe_session_id and status = 'reserved';
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'liberadas', v_n);
end;
$$;

create or replace function public.discount_release_stale(p_hours int default 26)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_n int;
begin
  update public.discount_redemptions set status = 'released', released_at = now()
   where status = 'reserved' and created_at < now() - make_interval(hours => greatest(p_hours, 1));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.discount_reserve(text, uuid, bigint, text) from public, anon, authenticated;
revoke execute on function public.discount_confirm(text) from public, anon, authenticated;
revoke execute on function public.discount_release(text) from public, anon, authenticated;
revoke execute on function public.discount_release_stale(int) from public, anon, authenticated;
grant execute on function public.discount_reserve(text, uuid, bigint, text) to service_role;
grant execute on function public.discount_confirm(text) to service_role;
grant execute on function public.discount_release(text) to service_role;
grant execute on function public.discount_release_stale(int) to service_role;
