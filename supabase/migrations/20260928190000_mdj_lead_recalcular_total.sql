-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- ═══════════════════════════════════════════════════════════════════════════
-- Registro histórico: ya se creó directamente en producción vía MCP
-- (execute_sql) el 2026-09-28. `mdj_lead_recalcular_total(lead_id)`, la
-- pieza de Capa B2 documentada en docs/plan-dinero-de-leads-dueno-servidor.md
-- §3 punto 2 -- ver también la memoria `project_service_catalog_capa_b2`.
--
-- Replica byte a byte la fórmula de `computePortalCartTotals()`
-- (web/client-portal.js:1434) para poder comparar (test de paridad) el total
-- que calcula el navegador contra el que calcula el servidor:
--   subtotal (mismo orden de fuentes que loadLeadItems(): primero
--   event_builder_orders.lines más reciente, si no hay, leads.notes.
--   selected_services -- notes es jsonb pero su valor es un STRING con JSON
--   escapado adentro, de ahí el doble parseo `(notes #>> '{}')::jsonb`)
--   − crédito de referido ($30 si client_profiles.source_ref existe y
--   discount_eligible no es false)
--   − 5% lealtad (si client_profiles.total_events_booked > 0)
--   − bono de reserva ($75 si no está PAID, balance_paid=0, pasaron >=48h
--   desde created_at, y notes.reservation_bonus_opt_out no es true)
--   − cupón ya cobrado (leads.coupon_discount_cents)
--   (el descuento total se recorta para no superar el subtotal)
--   × 1.07 de impuesto de Florida.
--
-- Deliberadamente SIN conectar a ningún consumidor todavía (ni
-- create-event-payment, ni el portal) -- mismo patrón que la Fase 1 del
-- motor de comisiones: construir y verificar aislado primero, cablear
-- después. Acceso restringido a staff financiero (`can_read_financial`) o
-- `service_role`, igual que `calcular_comision_venta`.

create or replace function public.mdj_lead_recalcular_total(p_lead_id uuid)
returns table (
  sub numeric,
  discount numeric,
  tax numeric,
  total numeric,
  discount_note text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_notes jsonb;
  v_items jsonb;
  v_client record;
  v_sub numeric := 0;
  v_discount numeric := 0;
  v_note text := '';
  v_referral_credit numeric := 0;
  v_loyalty numeric := 0;
  v_bonus numeric := 0;
  v_coupon numeric := 0;
  v_hours numeric;
  v_reservation_opt_out boolean := false;
  v_tax numeric;
  v_total numeric;
begin
  -- auth.uid()/auth.role(), nunca current_user -- dentro de una función
  -- security definer, current_user SIEMPRE es el dueño (postgres), nunca
  -- el llamador real (lección ya pagada en calcular_comision_venta,
  -- ver docs/ESTADO_MAESTRO.md 2026-09-23).
  if not (public.can_read_financial(auth.uid()) or auth.role() = 'service_role') then
    raise exception 'forbidden: solo staff financiero puede recalcular el total de un lead';
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    raise exception 'lead % no encontrado', p_lead_id;
  end if;

  begin
    v_notes := (v_lead.notes #>> '{}')::jsonb;
  exception when others then
    v_notes := '{}'::jsonb;
  end;

  -- Items: event_builder_orders.lines (más reciente) primero -- mismo orden que loadLeadItems() en client-portal.js
  select eb.lines into v_items
  from public.event_builder_orders eb
  where eb.lead_id = p_lead_id
  order by eb.created_at desc
  limit 1;

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    v_items := coalesce(v_notes -> 'selected_services', '[]'::jsonb);
  end if;

  select coalesce(sum(
    coalesce((item->>'unit_price_usd')::numeric, (item->>'price')::numeric, 0)
    * coalesce((item->>'quantity')::int, (item->>'qty')::int, 1)
  ), 0) into v_sub
  from jsonb_array_elements(v_items) as item;

  select * into v_client from public.client_profiles where user_id = v_lead.client_user_id;

  if v_client.source_ref is not null and v_client.source_ref <> '' and coalesce(v_client.discount_eligible, true) is distinct from false then
    v_referral_credit := 30;
    v_note := v_note || '• Crédito referido MDJ (1ª compra): -$30.00' || chr(10);
  end if;

  if coalesce(v_client.total_events_booked, 0) > 0 then
    v_loyalty := v_sub * 0.05;
    v_note := v_note || '• Beneficio Cliente Oficial (5%): -$' || to_char(v_loyalty, 'FM999999990.00') || chr(10);
  end if;

  if coalesce(v_lead.payment_status, 'UNPAID') <> 'PAID' and coalesce(v_lead.balance_paid, 0) <= 0 then
    v_hours := extract(epoch from (now() - v_lead.created_at)) / 3600.0;
    v_reservation_opt_out := coalesce((v_notes ->> 'reservation_bonus_opt_out')::boolean, false);
    if v_hours >= 48 and not v_reservation_opt_out then
      v_bonus := 75;
      v_note := v_note || '• Bono de reserva: -$75.00' || chr(10);
    end if;
  end if;

  v_coupon := coalesce(v_lead.coupon_discount_cents, 0) / 100.0;
  if v_coupon > 0 then
    v_note := v_note || '• Cupón aplicado: -$' || to_char(v_coupon, 'FM999999990.00') || chr(10);
  end if;

  v_discount := v_referral_credit + v_loyalty + v_bonus + v_coupon;
  if v_discount > v_sub then
    v_discount := v_sub;
  end if;

  v_tax := (v_sub - v_discount) * 0.07;
  v_total := v_sub - v_discount + v_tax;

  return query select v_sub, v_discount, v_tax, v_total, v_note;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación de paridad, ya corrida el 2026-09-28 contra 2 leads reales +
-- 1 caso sintético (dentro de una transacción revertida, sin dejar rastro):
--
--   lead a81679dc (sub=$4,750 real de event_builder_orders.lines, sin
--   referido/lealtad/cupón, bono de reserva aplica) →
--   sub=4750, discount=75, tax=327.25, total=5002.25
--   -- coincide byte a byte con trazar computePortalCartTotals() a mano
--   con los mismos datos reales.
--
--   lead 932fe157 (sub=$1,925, mismas condiciones) →
--   sub=1925, discount=75, tax=129.50, total=1979.50 -- coincide igual.
--
--   Mismo lead 932fe157, DENTRO de una transacción revertida, con
--   client_profiles.source_ref/total_events_booked y
--   leads.coupon_discount_cents puestos temporalmente para ejercitar las
--   4 rutas de descuento juntas (referido + lealtad + bono + cupón) →
--   sub=1925, discount=206.25 ($30+$96.25+$75+$5), tax=120.3125,
--   total=1839.0625 -- coincide con la fórmula trazada a mano.
--   Confirmado después: client_profiles y leads.coupon_discount_cents
--   volvieron exactos a su estado original (ROLLBACK).
--
--   Bloqueo de seguridad probado con una sesión simulada no-staff
--   (set_config('request.jwt.claims', ...) + SET LOCAL ROLE authenticated,
--   dentro de una transacción revertida): rechazada con
--   "forbidden: solo staff financiero..." -- confirma que auth.uid()/
--   auth.role() se usan correctamente (nunca current_user, que dentro de
--   una función security definer siempre es el dueño de la función).
-- ═══════════════════════════════════════════════════════════════════════════
