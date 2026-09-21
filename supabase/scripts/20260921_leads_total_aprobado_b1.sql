-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- APLICADO el 2026-09-21 ("sigue con B1"; el congelado desde el primer pago, "congela el total desde el primer pago"); probado antes en transacción deshecha.
-- CAPA B1 del plan docs/plan-dinero-de-leads-dueno-servidor.md: "el servidor es dueño de total_amount".
--
-- Idea: el total que arma el navegador NO es de confianza. Un total solo se puede COBRAR cuando el staff (o el servidor) lo aprobó.
-- La aprobación queda atada al MONTO (total_aprobado_usd): si alguien cambia total_amount después, deja de coincidir con lo
-- aprobado y el cobro se rechaza solo (sin lógica de "reseteo" que pueda olvidarse).
--   * Staff que escribe un total (INSERT o cambio de total_amount) => queda aprobado con ese monto.
--   * Servidor (service_role / webhook, sin auth.uid()) => INSERT aprobado; si cambia el total de un lead que YA estaba aprobado
--     (p. ej. el ajuste de un cupón cobrado) la aprobación acompaña al nuevo total. Un lead sin aprobar sigue sin aprobar.
--   * Cliente (o función definer que actúa por un cliente, p. ej. mdj_client_create_event_lead) => NUNCA aprueba; sus
--     total_aprobado_* se revierten igual que el resto del dinero (Capa A).
--   * RPC lead_aprobar_total(lead, total_visto): solo staff; aprueba SOLO si el total actual es el que el staff vio en pantalla
--     (si el cliente lo cambió entre tanto → 'el_total_cambio', no aprueba nada que el staff no haya revisado).

alter table public.leads add column if not exists coupon_discount_cents bigint not null default 0 check (coupon_discount_cents >= 0);
alter table public.leads add column if not exists total_aprobado_usd numeric;
alter table public.leads add column if not exists total_aprobado_at timestamptz;
alter table public.leads add column if not exists total_aprobado_por uuid;
comment on column public.leads.total_aprobado_usd is 'Monto de total_amount que el staff/servidor aprobó. Se puede cobrar solo si es igual a total_amount. Lo escribe el disparador o lead_aprobar_total; el cliente no puede.';

create or replace function public.leads_proteger_columnas_de_dinero()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_cambios jsonb := '{}'::jsonb;
  v_staff boolean;
  v_total_cambia boolean;
begin
  v_staff := auth.uid() is not null and public.is_staff(auth.uid());
  v_total_cambia := (tg_op = 'INSERT') or (new.total_amount is distinct from old.total_amount);

  -- ── Cliente por la API: dinero protegido (Capa A) + nunca aprueba (B1) ──
  if current_user in ('authenticated', 'anon') and not v_staff then
    if tg_op = 'INSERT' then
      if coalesce(new.balance_paid, 0) <> 0 then v_cambios := v_cambios || jsonb_build_object('balance_paid', new.balance_paid); end if;
      if new.payment_status is not null and upper(new.payment_status) not in ('UNPAID', 'PENDING') then v_cambios := v_cambios || jsonb_build_object('payment_status', new.payment_status); end if;
      if new.deposit_required_usd is not null then v_cambios := v_cambios || jsonb_build_object('deposit_required_usd', new.deposit_required_usd); end if;
      if coalesce(new.coupon_discount_cents, 0) <> 0 then v_cambios := v_cambios || jsonb_build_object('coupon_discount_cents', new.coupon_discount_cents); end if;
      if new.total_aprobado_usd is not null then v_cambios := v_cambios || jsonb_build_object('total_aprobado_usd', new.total_aprobado_usd); end if;
      new.balance_paid := 0; new.payment_status := 'UNPAID'; new.deposit_required_usd := null; new.coupon_discount_cents := 0;
      new.stripe_session_id := null; new.stripe_customer_id := null;
      new.total_aprobado_usd := null; new.total_aprobado_at := null; new.total_aprobado_por := null;
    else
      if new.balance_paid is distinct from old.balance_paid then v_cambios := v_cambios || jsonb_build_object('balance_paid', new.balance_paid); end if;
      if new.payment_status is distinct from old.payment_status then v_cambios := v_cambios || jsonb_build_object('payment_status', new.payment_status); end if;
      if new.deposit_required_usd is distinct from old.deposit_required_usd then v_cambios := v_cambios || jsonb_build_object('deposit_required_usd', new.deposit_required_usd); end if;
      if new.coupon_discount_cents is distinct from old.coupon_discount_cents then v_cambios := v_cambios || jsonb_build_object('coupon_discount_cents', new.coupon_discount_cents); end if;
      if new.total_aprobado_usd is distinct from old.total_aprobado_usd then v_cambios := v_cambios || jsonb_build_object('total_aprobado_usd', new.total_aprobado_usd); end if;
      new.balance_paid := old.balance_paid; new.payment_status := old.payment_status; new.deposit_required_usd := old.deposit_required_usd;
      new.coupon_discount_cents := old.coupon_discount_cents; new.stripe_session_id := old.stripe_session_id; new.stripe_customer_id := old.stripe_customer_id;
      new.total_aprobado_usd := old.total_aprobado_usd; new.total_aprobado_at := old.total_aprobado_at; new.total_aprobado_por := old.total_aprobado_por;
      -- CONGELADO (decisión del PO, 2026-09-21): desde el primer pago el total pactado ya no lo puede cambiar el cliente.
      -- Solo el staff puede reabrirlo (escribe el total y queda aprobado con el nuevo monto).
      if coalesce(old.balance_paid, 0) > 0 and new.total_amount is distinct from old.total_amount then
        v_cambios := v_cambios || jsonb_build_object('total_amount_congelado', new.total_amount);
        new.total_amount := old.total_amount;
      end if;
    end if;
    if v_cambios <> '{}'::jsonb then
      raise warning 'LEADS_DINERO_BLOQUEADO op=% lead=% actor=% rol=% cambios=%', tg_op, new.id, auth.uid(), current_user, v_cambios;
    end if;
    return new;
  end if;

  -- ── Staff: lo que escribe como total queda aprobado ──
  if v_staff then
    if v_total_cambia then
      new.total_aprobado_usd := new.total_amount; new.total_aprobado_at := now(); new.total_aprobado_por := auth.uid();
    end if;
    return new;
  end if;

  -- ── Servidor (service_role / webhook / SQL sin sesión) ──
  if auth.uid() is null then
    if tg_op = 'INSERT' then
      if new.total_aprobado_usd is null then
        new.total_aprobado_usd := new.total_amount; new.total_aprobado_at := now();
      end if;
    elsif v_total_cambia and old.total_aprobado_usd is not distinct from old.total_amount and old.total_aprobado_usd is not null then
      -- la aprobación acompaña al ajuste del servidor (p. ej. cupón cobrado); un lead sin aprobar sigue sin aprobar
      new.total_aprobado_usd := new.total_amount; new.total_aprobado_at := now();
    end if;
  end if;
  -- (función definer que actúa por un cliente: no toca la aprobación)
  return new;
end;
$$;
revoke execute on function public.leads_proteger_columnas_de_dinero() from public, anon, authenticated;

drop function if exists public.lead_aprobar_total(uuid);
create or replace function public.lead_aprobar_total(p_lead_id uuid, p_total_visto numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_total numeric;
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'no_autorizado');
  end if;
  select total_amount into v_total from public.leads where id = p_lead_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'evento_no_encontrado'); end if;
  if coalesce(v_total, 0) <= 0 then return jsonb_build_object('ok', false, 'error', 'total_vacio'); end if;
  if p_total_visto is null or abs(v_total - p_total_visto) > 0.005 then
    return jsonb_build_object('ok', false, 'error', 'el_total_cambio', 'total_actual', v_total);
  end if;
  update public.leads set total_aprobado_usd = v_total, total_aprobado_at = now(), total_aprobado_por = auth.uid() where id = p_lead_id;
  return jsonb_build_object('ok', true, 'total_aprobado_usd', v_total);
end;
$$;
revoke execute on function public.lead_aprobar_total(uuid, numeric) from public, anon;
grant execute on function public.lead_aprobar_total(uuid, numeric) to authenticated, service_role;

-- Backfill: los eventos armados por el staff (staff_production) ya eran suyos → aprobados con su monto actual.
-- Los de cliente (bottom_form) quedan SIN aprobar hasta que el staff los revise.
update public.leads set total_aprobado_usd = total_amount, total_aprobado_at = now()
 where source = 'staff_production' and total_aprobado_usd is null and coalesce(total_amount, 0) > 0;
