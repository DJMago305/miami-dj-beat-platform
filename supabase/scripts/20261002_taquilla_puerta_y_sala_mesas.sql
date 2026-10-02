-- 🔴 PRODUCCIÓN (proyecto hkuvuqupbxwkiykxvqdr). Aditivo e idempotente.
-- YA APLICADO en producción el 2026-10-02 por el PO y verificado (3 columnas, función con permiso solo para authenticated,
-- layout_mode='tickets' en todas las salas, botones +/- de la puerta probados con una orden real).
-- Taquilla de salas: control de entrada en la puerta. Agrega a venue_ticket_orders cuántas
-- entradas de la orden ya pasaron por la puerta y una función para sumar/restar de a una,
-- que solo puede ejecutar el staff y nunca deja pasar más entradas de las compradas.
-- Además: venue_rooms.layout_mode ('tickets' = entradas, 'tables' = sala de mesas con hero de publicidad y plano).
-- Orden de despliegue: 1) este SQL, 2) la página staff-merch-orders.html (vista Entradas).

alter table public.venue_ticket_orders
  add column if not exists checked_in_qty integer not null default 0,
  add column if not exists checked_in_at  timestamptz,
  add column if not exists checked_in_by  uuid;

alter table public.venue_ticket_orders
  drop constraint if exists venue_ticket_orders_checked_in_qty_nonneg;
alter table public.venue_ticket_orders
  add constraint venue_ticket_orders_checked_in_qty_nonneg check (checked_in_qty >= 0);

create or replace function public.venue_ticket_checkin(p_order_id uuid, p_delta integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_total integer;
  v_new   integer;
begin
  if v_uid is null or not public.is_staff(v_uid) then
    raise exception 'venue_ticket_checkin_not_staff';
  end if;
  if p_delta is null or p_delta not in (-1, 1) then
    raise exception 'venue_ticket_checkin_invalid_delta';
  end if;

  -- Entradas compradas = suma de qty de los renglones de la orden.
  select coalesce(sum(coalesce((it->>'qty')::integer, 0)), 0)
    into v_total
    from public.venue_ticket_orders o, jsonb_array_elements(o.items) it
   where o.id = p_order_id;

  if not exists (select 1 from public.venue_ticket_orders where id = p_order_id) then
    raise exception 'venue_ticket_checkin_order_not_found';
  end if;

  update public.venue_ticket_orders
     set checked_in_qty = greatest(0, least(v_total, checked_in_qty + p_delta)),
         checked_in_at  = case when greatest(0, least(v_total, checked_in_qty + p_delta)) > 0 then now() else null end,
         checked_in_by  = v_uid
   where id = p_order_id
  returning checked_in_qty into v_new;

  return jsonb_build_object('checked_in_qty', v_new, 'total_qty', v_total);
end;
$$;

revoke all on function public.venue_ticket_checkin(uuid, integer) from public, anon;
grant execute on function public.venue_ticket_checkin(uuid, integer) to authenticated;

-- Sala de mesas (plano interactivo, EN DESARROLLO). Por defecto todas las salas siguen igual ('tickets').
alter table public.venue_rooms
  add column if not exists layout_mode text not null default 'tickets';
alter table public.venue_rooms
  drop constraint if exists venue_rooms_layout_mode_check;
alter table public.venue_rooms
  add constraint venue_rooms_layout_mode_check check (layout_mode in ('tickets','tables'));
