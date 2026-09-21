-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- APLICADO el 2026-09-21 a pedido del PO ("sí, aplica la capa A"); probado antes en transacción deshecha.
-- CAPA A del plan "el servidor es dueño del dinero de leads" (docs/plan-dinero-de-leads-dueno-servidor.md).
--
-- Hueco: la política leads_update_client_email + los permisos de columna dejan que un cliente con sesión (y cualquier no-staff
-- con permiso de UPDATE, p. ej. el DJ asignado) escriba balance_paid / payment_status / deposit_required_usd / stripe_* de su
-- evento: puede marcarse PAID sin pagar. Tampoco hay nada en INSERT (anon puede insertar un lead ya "pagado").
--
-- Solución: un disparador BEFORE INSERT OR UPDATE que, SOLO cuando quien escribe es el rol `authenticated` o `anon` a través de
-- la API y NO es staff, deja esas columnas como estaban (UPDATE) o en su valor de fábrica (INSERT). Es un REVERT SILENCIOSO a
-- propósito: el portal reescribe el lead completo en cada cambio (syncLead) y un error rompería todas sus guardadas.
--   * No afecta al staff (is_staff), a service_role (webhook, create-event-payment) ni a funciones SECURITY DEFINER
--     (p. ej. client_mark_event_zelle_sent): dentro de ellas current_user es el dueño de la función, no `authenticated`.
--   * Cada intento real de tocar dinero deja un WARNING 'LEADS_DINERO_BLOQUEADO' en los logs de Postgres (query_logs) para ver si
--     alguien lo intenta. (No hay tabla: el disparador corre con el rol del cliente, que no puede escribir en una tabla de auditoría.)
--   * NO protege total_amount (el portal lo calcula legítimamente desde el carrito): eso es la CAPA B del plan.

-- Columna que también usa la fase 3 de cupones (misma definición, idempotente).
alter table public.leads add column if not exists coupon_discount_cents bigint not null default 0 check (coupon_discount_cents >= 0);

create or replace function public.leads_proteger_columnas_de_dinero()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_cambios jsonb := '{}'::jsonb;
begin
  -- Solo vigila a quien escribe directo por la API con rol de cliente. service_role, postgres y las funciones
  -- SECURITY DEFINER (current_user = su dueño) pasan sin tocar.
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if auth.uid() is not null and public.is_staff(auth.uid()) then return new; end if;

  if tg_op = 'INSERT' then
    if coalesce(new.balance_paid, 0) <> 0 then v_cambios := v_cambios || jsonb_build_object('balance_paid', new.balance_paid); end if;
    if new.payment_status is not null and upper(new.payment_status) not in ('UNPAID', 'PENDING') then v_cambios := v_cambios || jsonb_build_object('payment_status', new.payment_status); end if;
    if new.deposit_required_usd is not null then v_cambios := v_cambios || jsonb_build_object('deposit_required_usd', new.deposit_required_usd); end if;
    if coalesce(new.coupon_discount_cents, 0) <> 0 then v_cambios := v_cambios || jsonb_build_object('coupon_discount_cents', new.coupon_discount_cents); end if;
    new.balance_paid := 0;
    new.payment_status := 'UNPAID';
    new.deposit_required_usd := null;
    new.coupon_discount_cents := 0;
    new.stripe_session_id := null;
    new.stripe_customer_id := null;
  else
    if new.balance_paid is distinct from old.balance_paid then v_cambios := v_cambios || jsonb_build_object('balance_paid', new.balance_paid); end if;
    if new.payment_status is distinct from old.payment_status then v_cambios := v_cambios || jsonb_build_object('payment_status', new.payment_status); end if;
    if new.deposit_required_usd is distinct from old.deposit_required_usd then v_cambios := v_cambios || jsonb_build_object('deposit_required_usd', new.deposit_required_usd); end if;
    if new.coupon_discount_cents is distinct from old.coupon_discount_cents then v_cambios := v_cambios || jsonb_build_object('coupon_discount_cents', new.coupon_discount_cents); end if;
    new.balance_paid := old.balance_paid;
    new.payment_status := old.payment_status;
    new.deposit_required_usd := old.deposit_required_usd;
    new.coupon_discount_cents := old.coupon_discount_cents;
    new.stripe_session_id := old.stripe_session_id;
    new.stripe_customer_id := old.stripe_customer_id;
  end if;

  if v_cambios <> '{}'::jsonb then
    raise warning 'LEADS_DINERO_BLOQUEADO op=% lead=% actor=% rol=% cambios=%', tg_op, new.id, auth.uid(), current_user, v_cambios;
  end if;
  return new;
end;
$$;
revoke execute on function public.leads_proteger_columnas_de_dinero() from public, anon, authenticated;

drop trigger if exists trg_leads_proteger_columnas_de_dinero on public.leads;
create trigger trg_leads_proteger_columnas_de_dinero
  before insert or update on public.leads
  for each row execute function public.leads_proteger_columnas_de_dinero();
