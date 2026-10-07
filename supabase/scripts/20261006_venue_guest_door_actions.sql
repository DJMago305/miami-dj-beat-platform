-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- Fase 2 (PR 2/2) de la boletería: acciones de la PUERTA sobre los pases individuales (requiere 20261006_venue_ticket_guests.sql ya aplicado).
--
-- Qué agrega (aditivo e idempotente):
--   1) venue_guest_set_checkin(p_guest_id, p_checked_in): el personal marca o DESHACE el ingreso de UN pase desde la lista de invitados (error de puerta, persona
--      que entró y no se escaneó…). Mismo permiso que el escáner (is_staff, o venue_staff del local del evento). Una sola sentencia atómica por pase; mantiene
--      sincronizado el contador de la orden (checked_in_qty) y deja su fila en el registro (venue_ticket_scan_logs: 'manual_in' / 'manual_undo').
--   2) El registro de escaneos acepta los dos resultados nuevos ('manual_in', 'manual_undo').
--   3) venue_ticket_checkin (los botones +/− de la vista Entradas) se NEGA en órdenes que ya tienen pases: el ingreso se marca por pase, para no desfasar el inventario.
--      Las órdenes sin pases siguen exactamente igual.

-- ── 2) Resultados nuevos en el registro ──
alter table public.venue_ticket_scan_logs drop constraint if exists venue_ticket_scan_logs_result_check;
alter table public.venue_ticket_scan_logs
  add constraint venue_ticket_scan_logs_result_check
  check (scan_result in ('success', 'already_used', 'invalid_event', 'cancelled', 'order_not_found', 'manual_in', 'manual_undo'));

-- ── 1) Marcar / deshacer el ingreso de un pase ──
create or replace function public.venue_guest_set_checkin(p_guest_id uuid, p_checked_in boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid := auth.uid();
  gp        record;
  v_allowed boolean := false;
  v_code    text;
  v_result  text;
begin
  if v_uid is null then
    raise exception 'venue_guest_checkin_not_authenticated';
  end if;
  if p_guest_id is null or p_checked_in is null then
    raise exception 'venue_guest_checkin_invalid';
  end if;

  select g.id, g.order_id, g.event_id, g.status, o.status as ostatus
    into gp
    from public.venue_ticket_guests g
    join public.venue_ticket_orders o on o.id = g.order_id
   where g.id = p_guest_id
     for update of g;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_allowed := public.is_staff(v_uid)
    or exists (
      select 1
        from public.venue_events e
        join public.venue_rooms r on r.id = e.room_id
        join public.venue_staff vs on vs.venue_id = r.venue_id
       where e.id = gp.event_id and vs.user_id = v_uid
    );
  if not v_allowed then
    raise exception 'venue_guest_checkin_not_allowed';
  end if;

  if p_checked_in then
    if gp.status = 'void' or gp.ostatus like 'cancelled%' or gp.ostatus like '%refund%' or gp.ostatus like '%conflict%' then
      v_code := 'cancelled';
    elsif gp.status = 'checked_in' then
      v_code := 'already_used';
    else
      update public.venue_ticket_guests
         set status = 'checked_in', checked_in_at = now(), checked_in_by = v_uid
       where id = gp.id;
      update public.venue_ticket_orders
         set checked_in_qty = checked_in_qty + 1, checked_in_at = now(), checked_in_by = v_uid
       where id = gp.order_id;
      v_code := 'success';
      v_result := 'manual_in';
    end if;
  else
    if gp.status <> 'checked_in' then
      v_code := 'not_checked_in';
    else
      update public.venue_ticket_guests
         set status = 'issued', checked_in_at = null, checked_in_by = null
       where id = gp.id;
      update public.venue_ticket_orders
         set checked_in_at  = case when checked_in_qty - 1 > 0 then checked_in_at else null end,
             checked_in_qty = greatest(0, checked_in_qty - 1)
       where id = gp.order_id;
      v_code := 'success';
      v_result := 'manual_undo';
    end if;
  end if;

  if v_result is not null then
    insert into public.venue_ticket_scan_logs (order_id, event_id, scanned_by, scan_result, qty, guest_id)
    values (gp.order_id, gp.event_id, v_uid, v_result, 1, gp.id);
  end if;

  return jsonb_build_object(
    'ok',     (v_code = 'success'),
    'code',   v_code,
    'status', (select status from public.venue_ticket_guests where id = gp.id)
  );
end;
$function$;

revoke all on function public.venue_guest_set_checkin(uuid, boolean) from public, anon;
grant execute on function public.venue_guest_set_checkin(uuid, boolean) to authenticated;

-- ── 3) Los botones +/− no tocan órdenes con pases ──
create or replace function public.venue_ticket_checkin(p_order_id uuid, p_delta integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
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
  if exists (select 1 from public.venue_ticket_guests where order_id = p_order_id) then
    raise exception 'venue_ticket_checkin_use_passes';
  end if;
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
$function$;

-- (los permisos de venue_ticket_checkin ya existentes se conservan con CREATE OR REPLACE)

-- ── 4) El escáner distingue un PASE: la respuesta de venue_ticket_scan añade pass=true, guest_id y checked_in_at (la hora del ingreso, para mostrar
--      «ya ingresó a las 11:28» cuando se rechaza un pase repetido). Es la misma función del script anterior con SOLO esos tres campos más en la rama del pase. ──
create or replace function public.venue_ticket_scan(
  p_order_id uuid,
  p_event_id uuid,
  p_qty      integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid      uuid := auth.uid();
  v_venue    uuid;
  v_event_ok boolean := false;
  v_allowed  boolean := false;
  o          public.venue_ticket_orders%rowtype;
  v_found    boolean := false;
  v_total    integer := 0;
  v_new      integer;
  v_code     text;
  gp         record;
  v_gfound   boolean := false;
begin
  if v_uid is null then
    raise exception 'venue_ticket_scan_not_authenticated';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'venue_ticket_scan_invalid_qty';
  end if;

  select r.venue_id into v_venue
    from public.venue_events e
    join public.venue_rooms r on r.id = e.room_id
   where e.id = p_event_id;
  v_event_ok := found;

  v_allowed := public.is_staff(v_uid)
    or (v_event_ok and exists (select 1 from public.venue_staff vs where vs.venue_id = v_venue and vs.user_id = v_uid));
  if not v_allowed then
    raise exception 'venue_ticket_scan_not_allowed';
  end if;

  -- 1) ¿Lo escaneado es un PASE individual? (una sola fila bloqueada: dos escaneos simultáneos no pasan los dos)
  select g.id as gid, g.order_id, g.event_id as g_event, g.status as gstatus, g.guest_name, g.label,
         o2.status as ostatus, o2.reservation_name as rname
    into gp
    from public.venue_ticket_guests g
    join public.venue_ticket_orders o2 on o2.id = g.order_id
   where g.id = p_order_id
     for update of g;
  v_gfound := found;

  if v_gfound then
    if not v_event_ok or gp.g_event is distinct from p_event_id then
      v_code := 'invalid_event';
    elsif gp.gstatus = 'void' or gp.ostatus like 'cancelled%' or gp.ostatus like '%refund%' or gp.ostatus like '%conflict%' then
      v_code := 'cancelled';
    elsif gp.gstatus = 'checked_in' then
      v_code := 'already_used';
    else
      update public.venue_ticket_guests
         set status = 'checked_in', checked_in_at = now(), checked_in_by = v_uid
       where id = gp.gid;
      update public.venue_ticket_orders
         set checked_in_qty = checked_in_qty + 1, checked_in_at = now(), checked_in_by = v_uid
       where id = gp.order_id;
      v_code := 'success';
    end if;

    select checked_in_qty into v_new from public.venue_ticket_orders where id = gp.order_id;
    select count(*) into v_total from public.venue_ticket_guests where order_id = gp.order_id and status <> 'void';

    insert into public.venue_ticket_scan_logs (order_id, event_id, scanned_by, scan_result, qty, guest_id)
    values (gp.order_id, case when v_event_ok then p_event_id else null end, v_uid, v_code, 1, gp.gid);

    return jsonb_build_object(
      'ok',               (v_code = 'success'),
      'code',             v_code,
      'checked_in_qty',   v_new,
      'total_qty',        v_total,
      'reservation_name', coalesce(nullif(btrim(gp.guest_name), ''), gp.rname),
      'items',            jsonb_build_array(jsonb_build_object('label', gp.label, 'qty', 1)),
      'pass',             true,
      'guest_id',         gp.gid,
      'checked_in_at',    (select g2.checked_in_at from public.venue_ticket_guests g2 where g2.id = gp.gid)
    );
  end if;

  -- 2) Es el id de una ORDEN (QR de la compra completa): comportamiento de siempre.
  select * into o from public.venue_ticket_orders where id = p_order_id for update;
  v_found := found;

  if v_found then
    select coalesce(sum(coalesce((it->>'qty')::integer, 0)), 0)
      into v_total
      from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) it;
  end if;

  if not v_found then
    v_code := 'order_not_found';
  elsif not v_event_ok or o.event_id is distinct from p_event_id then
    v_code := 'invalid_event';
  elsif o.status like 'cancelled%' or o.status like '%refund%' or o.status like '%conflict%' then
    v_code := 'cancelled';
  elsif o.checked_in_qty + p_qty > v_total then
    v_code := 'already_used';
  else
    v_code := 'success';
  end if;

  if v_code = 'success' then
    update public.venue_ticket_orders
       set checked_in_qty = checked_in_qty + p_qty,
           checked_in_at  = now(),
           checked_in_by  = v_uid
     where id = p_order_id
    returning checked_in_qty into v_new;
    -- Si la orden ya tiene pases, entrar por el QR de la orden marca los siguientes pases pendientes.
    update public.venue_ticket_guests
       set status = 'checked_in', checked_in_at = now(), checked_in_by = v_uid
     where id in (select g.id from public.venue_ticket_guests g where g.order_id = p_order_id and g.status = 'issued' order by g.seq limit p_qty);
  elsif v_found then
    v_new := o.checked_in_qty;
  end if;

  insert into public.venue_ticket_scan_logs (order_id, event_id, scanned_by, scan_result, qty)
  values (
    case when v_found then p_order_id else null end,
    case when v_event_ok then p_event_id else null end,
    v_uid,
    v_code,
    p_qty
  );

  return jsonb_build_object(
    'ok',               (v_code = 'success'),
    'code',             v_code,
    'checked_in_qty',   v_new,
    'total_qty',        case when v_found then v_total else null end,
    'reservation_name', case when v_found then o.reservation_name else null end,
    'items',            case when v_found then coalesce(o.items, '[]'::jsonb) else null end
  );
end;
$function$;

revoke all on function public.venue_ticket_scan(uuid, uuid, integer) from public, anon;
grant execute on function public.venue_ticket_scan(uuid, uuid, integer) to authenticated;

-- ── Comprobación (solo lectura): f_marcar=true, marcar_anon=false, marcar_auth=true, checkin_auth=true, check_ok=true, guarda_pases=true ──
select
  (to_regprocedure('public.venue_guest_set_checkin(uuid,boolean)') is not null)                                  as f_marcar,
  has_function_privilege('anon',          'public.venue_guest_set_checkin(uuid,boolean)', 'execute')             as marcar_anon,
  has_function_privilege('authenticated', 'public.venue_guest_set_checkin(uuid,boolean)', 'execute')             as marcar_auth,
  has_function_privilege('authenticated', 'public.venue_ticket_checkin(uuid,integer)', 'execute')                as checkin_auth,
  (select pg_get_constraintdef(oid) like '%manual_undo%' from pg_constraint where conname = 'venue_ticket_scan_logs_result_check') as check_ok,
  (select position('venue_ticket_checkin_use_passes' in prosrc) > 0 from pg_proc where proname = 'venue_ticket_checkin' and pronamespace = 'public'::regnamespace) as guarda_pases,
  (select position('checked_in_at' in prosrc) > 0 and position('''pass'',' in prosrc) > 0 from pg_proc where proname = 'venue_ticket_scan' and pronamespace = 'public'::regnamespace) as scan_con_pass,
  has_function_privilege('anon', 'public.venue_ticket_scan(uuid,uuid,integer)', 'execute') as escaneo_anon;
