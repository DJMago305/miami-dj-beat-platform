-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS (Paso 2): seguridad por rol + crear un evento nuevo desde la plantilla de la sala.
-- Requiere los scripts 20261006_venue_ticket_guests.sql y 20261006_venue_guest_door_actions.sql ya aplicados.
--
-- Qué hace (aditivo e idempotente, salvo los dos cambios de permiso marcados con ⚠️):
--   1) ⚠️ venue_ticket_guests y venue_ticket_scan_logs: la lectura DIRECTA queda para Miami DJ Beat (is_staff) y para dueño/manager de ESE local.
--      Antes la tenía cualquier rol del local, incluido «team», y la tabla guarda teléfono y correo de los invitados.
--   2) venue_door_guests(p_event_id): la lista de la puerta para TODO el equipo del local (y staff de Miami DJ Beat), por función:
--      dueño y manager reciben nombre, mesa/asiento, teléfono, correo y estado; «team» recibe lo mismo con teléfono y correo en NULL.
--      Solo del evento pedido y solo si el evento es de un local del usuario.
--   3) ⚠️ venue_room_set_layout: el PLANO de la sala (la arquitectura del local) solo lo cambia Miami DJ Beat (is_platform_admin: admin/owner de la plataforma).
--      Antes también podían dueño y manager del local. Las mesas y sillas de CADA EVENTO se siguen moviendo desde SALAS (venue_event_move_tables, sin cambios).
--   4) venue_event_create(sala, nombre, fecha): dueño o manager crea un evento NUEVO desde la plantilla de su sala (el plano único) y, con p_open = true,
--      abre sus mesas en el mismo paso (venue_event_open_tables). Valida nombre (3–120), fecha (hoy o futura, máx. 2 años), duplicados y un tope de eventos activos.
--      Si la sala no tiene plano todavía, TODO se deshace con el error 'sin_mapa' (el plano lo dibuja Miami DJ Beat).
--   5) ⚠️ venue_ticket_scan: el escáner SOLO valida el evento del día (día de negocio 6:00–6:00, hora de Miami); fechas pasadas o futuras → 'wrong_date'.
--   6) «Cerrar entradas»: venue_events.doors_closed_at + venue_event_set_doors(evento, cerrar) (dueño/manager del local o staff de Miami DJ Beat);
--      con las entradas cerradas el escáner rechaza todo con 'doors_closed'. venue_door_summary(evento): cuántos entraron / faltan (para el contador de la puerta).

-- ── 1) Lectura directa de invitados y del registro: solo staff de Miami DJ Beat y dueño/manager de ESE local ──
drop policy if exists venue_ticket_guests_staff_read on public.venue_ticket_guests;
create policy venue_ticket_guests_staff_read
  on public.venue_ticket_guests
  for select
  to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1
        from public.venue_events e
        join public.venue_rooms r on r.id = e.room_id
        join public.venue_staff vs on vs.venue_id = r.venue_id
       where e.id = venue_ticket_guests.event_id
         and vs.user_id = auth.uid()
         and vs.role in ('owner', 'manager')
    )
  );

drop policy if exists venue_ticket_scan_logs_read on public.venue_ticket_scan_logs;
create policy venue_ticket_scan_logs_read
  on public.venue_ticket_scan_logs
  for select
  to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1
        from public.venue_events e
        join public.venue_rooms r on r.id = e.room_id
        join public.venue_staff vs on vs.venue_id = r.venue_id
       where e.id = venue_ticket_scan_logs.event_id
         and vs.user_id = auth.uid()
         and vs.role in ('owner', 'manager')
    )
  );

-- ── 2) Lista de la puerta por función (contacto oculto para «team») ──
create or replace function public.venue_door_guests(p_event_id uuid)
returns table (
  guest_id      uuid,
  seq           integer,
  label         text,
  guest_name    text,
  guest_phone   text,
  guest_email   text,
  status        text,
  checked_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_venue uuid;
  v_role  text;
  v_staff boolean;
begin
  if v_uid is null then
    raise exception 'venue_door_guests_not_authenticated';
  end if;
  v_staff := public.is_staff(v_uid);
  select r.venue_id into v_venue
    from public.venue_events e join public.venue_rooms r on r.id = e.room_id
   where e.id = p_event_id;
  if v_venue is null then
    return;                                                   -- evento inexistente: lista vacía, sin pistas
  end if;
  select vs.role into v_role from public.venue_staff vs where vs.venue_id = v_venue and vs.user_id = v_uid;
  if not v_staff and v_role is null then
    raise exception 'venue_door_guests_not_allowed';          -- no es de ese local
  end if;
  return query
    select g.id, g.seq, g.label, g.guest_name,
           case when v_staff or v_role in ('owner', 'manager') then g.guest_phone end,
           case when v_staff or v_role in ('owner', 'manager') then g.guest_email end,
           g.status, g.checked_in_at
      from public.venue_ticket_guests g
     where g.event_id = p_event_id
     order by g.guest_name nulls last, g.seq;
end;
$function$;

revoke all on function public.venue_door_guests(uuid) from public, anon;
grant execute on function public.venue_door_guests(uuid) to authenticated;

-- ── 3) El plano de la sala (arquitectura) solo lo cambia Miami DJ Beat ──
CREATE OR REPLACE FUNCTION public.venue_room_set_layout(p_room_id uuid, p_layout jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_venue uuid; v_total integer; v_unicas integer; t jsonb; m jsonb; s jsonb; v_ids text[]; v_areas text[]; a jsonb;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not public.is_platform_admin(auth.uid()) then raise exception 'no_autorizado'; end if;   -- el PLANO (arquitectura) solo lo cambia Miami DJ Beat

  if p_layout is null or jsonb_typeof(p_layout) is distinct from 'object' or jsonb_typeof(p_layout -> 'tables') is distinct from 'array' then
    raise exception 'mapa_invalido';
  end if;
  if length(p_layout::text) > 1500000 then raise exception 'mapa_invalido'; end if;                       -- tope de tamano del archivo guardado
  if p_layout ? 'maps' and jsonb_typeof(p_layout -> 'maps') is distinct from 'array' then raise exception 'mapa_invalido'; end if;   -- el dibujo, si viene, debe ser una lista
  v_total := jsonb_array_length(p_layout -> 'tables');
  if v_total < 1 or v_total > 300 then raise exception 'mapa_invalido'; end if;

  for t in select * from jsonb_array_elements(p_layout -> 'tables') loop
    if jsonb_typeof(t) is distinct from 'object'
       or jsonb_typeof(t -> 'key') is distinct from 'string' or length(btrim(t ->> 'key')) = 0 or length(t ->> 'key') > 20
       or jsonb_typeof(t -> 'price_cents') is distinct from 'number'
       or (t ->> 'price_cents')::numeric <> trunc((t ->> 'price_cents')::numeric)
       or (t ->> 'price_cents')::numeric not between 0 and 1000000
       or (t ? 'seats' and (jsonb_typeof(t -> 'seats') is distinct from 'number'
                            or (t ->> 'seats')::numeric <> trunc((t ->> 'seats')::numeric)
                            or (t ->> 'seats')::numeric not between 1 and 40)) then
      raise exception 'mapa_invalido';
    end if;
  end loop;
  select count(distinct x ->> 'key') into v_unicas from jsonb_array_elements(p_layout -> 'tables') x;
  if v_unicas <> v_total then raise exception 'mapa_invalido'; end if;   -- llaves repetidas

  -- Areas de venta (opcional): catalogo [{id, label?, siempre?}] de hasta 24, ids unicos; cada mesa puede decir su area (debe existir en el catalogo)
  v_areas := '{}';
  if p_layout ? 'areas' then
    if jsonb_typeof(p_layout -> 'areas') is distinct from 'array' or jsonb_array_length(p_layout -> 'areas') > 24 then raise exception 'mapa_invalido'; end if;
    for a in select * from jsonb_array_elements(p_layout -> 'areas') loop
      if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(a -> 'id') is distinct from 'string' or length(a ->> 'id') not between 1 and 24 or (a ->> 'id') = any (v_areas)
         or (a ? 'label' and (jsonb_typeof(a -> 'label') is distinct from 'string' or length(a ->> 'label') > 60))
         or (a ? 'siempre' and jsonb_typeof(a -> 'siempre') is distinct from 'boolean') then raise exception 'mapa_invalido'; end if;
      v_areas := v_areas || (a ->> 'id');
    end loop;
  end if;
  for t in select * from jsonb_array_elements(p_layout -> 'tables') loop
    if t ? 'area' and (jsonb_typeof(t -> 'area') is distinct from 'string' or not ((t ->> 'area') = any (v_areas))) then raise exception 'mapa_invalido'; end if;
  end loop;

  -- Planos: hasta 12; cada uno con su tamano (300..2000) y sus figuras (hasta 400, ids unicos, todas validas)
  if jsonb_typeof(p_layout -> 'maps') = 'array' then
    if jsonb_array_length(p_layout -> 'maps') > 12 then raise exception 'mapa_invalido'; end if;
    for m in select * from jsonb_array_elements(p_layout -> 'maps') loop
      if jsonb_typeof(m) is distinct from 'object' then raise exception 'mapa_invalido'; end if;
      if m ? 'siempre' and jsonb_typeof(m -> 'siempre') is distinct from 'boolean' then raise exception 'mapa_invalido'; end if;
      if m ? 'room' and not (jsonb_typeof(m -> 'room') = 'object' and public.venue_plano_num(m -> 'room' -> 'w', 300, 2000) and public.venue_plano_num(m -> 'room' -> 'h', 300, 2000)) then raise exception 'mapa_invalido'; end if;
      if m ? 'shapes' then
        if jsonb_typeof(m -> 'shapes') is distinct from 'array' or jsonb_array_length(m -> 'shapes') > 400 then raise exception 'mapa_invalido'; end if;
        v_ids := '{}';
        for s in select * from jsonb_array_elements(m -> 'shapes') loop
          if not public.venue_plano_figura_valida(s) or (s ->> 'id') = any (v_ids) then raise exception 'mapa_invalido'; end if;
          v_ids := v_ids || (s ->> 'id');
        end loop;
      end if;
    end loop;
  end if;

  update public.venue_rooms set layout = p_layout, updated_at = now() where id = p_room_id;
  return v_total;
end $function$;

-- ── 4) Crear un evento nuevo desde la plantilla de la sala ──
create or replace function public.venue_event_create(p_room_id uuid, p_title text, p_event_date date, p_open boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_venue  uuid;
  v_title  text := nullif(btrim(p_title), '');
  v_today  date := (now() at time zone 'America/New_York')::date;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'venue_event_create_not_authenticated';
  end if;
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id and coalesce(r.active, true);
  if v_venue is null then
    raise exception 'sala_no_existe';
  end if;
  if not (public.is_platform_admin(v_uid) or public.can_manage_venue_layout(v_venue)) then
    raise exception 'no_autorizado';
  end if;
  if v_title is null or length(v_title) < 3 or length(v_title) > 120 then
    return jsonb_build_object('ok', false, 'error', 'titulo_invalido');
  end if;
  if p_event_date is null or p_event_date < v_today or p_event_date > v_today + 730 then
    return jsonb_build_object('ok', false, 'error', 'fecha_invalida');
  end if;
  if (select count(*) from public.venue_events e join public.venue_rooms r on r.id = e.room_id
       where r.venue_id = v_venue and e.status in ('waitlist', 'announced') and e.event_date >= v_today) >= 60 then
    return jsonb_build_object('ok', false, 'error', 'demasiados_eventos');
  end if;
  if exists (select 1 from public.venue_events e where e.room_id = p_room_id and e.event_date = p_event_date
                and lower(btrim(e.title)) = lower(v_title) and e.status <> 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'evento_duplicado');
  end if;

  insert into public.venue_events (room_id, title, event_date, status, tables_open, layout)
  values (p_room_id, v_title, p_event_date, 'announced', false, '{}'::jsonb)
  returning id into v_id;

  if coalesce(p_open, true) then
    perform public.venue_event_open_tables(v_id, null);       -- copia la plantilla de la sala; 'sin_mapa' deshace TODO
  end if;
  return jsonb_build_object('ok', true, 'event_id', v_id);
end;
$function$;

revoke all on function public.venue_event_create(uuid, text, date, boolean) from public, anon;
grant execute on function public.venue_event_create(uuid, text, date, boolean) to authenticated;


-- ── 5) EL ESCÁNER SOLO VALIDA EL EVENTO DEL DÍA (regla del PO 2026-10-07) ──
--   «Si se abre el escáner el viernes en Concierto Ruddy La Scala, solo se escanean los QR de ese día: no lee tickets de fechas pasadas ni futuras.»
--   · venue_business_day(): el día de negocio en Miami va de las 6:00 a las 6:00 (un evento que pasa de medianoche sigue valiendo hasta las 6 de la mañana).
--   · venue_ticket_scan: si el evento elegido no es el del día de negocio (o no tiene fecha) devuelve 'wrong_date' sin validar nada y lo deja en el registro;
--     si el pase/orden es de OTRO evento devuelve 'invalid_event' y ahora dice de qué evento y fecha es (ticket_event_title / ticket_event_date).
--   · El registro acepta el resultado nuevo 'wrong_date'.
alter table public.venue_ticket_scan_logs drop constraint if exists venue_ticket_scan_logs_result_check;
alter table public.venue_ticket_scan_logs
  add constraint venue_ticket_scan_logs_result_check
  check (scan_result in ('success', 'already_used', 'invalid_event', 'cancelled', 'order_not_found', 'manual_in', 'manual_undo', 'wrong_date', 'doors_closed'));

-- «Cerrar entradas»: cuando todos ya entraron, el dueño/manager cierra la puerta del evento y el escáner deja de validar (se puede reabrir).
alter table public.venue_events add column if not exists doors_closed_at timestamptz;

create or replace function public.venue_business_day()
returns date
language sql
stable
as $function$
  select ((now() at time zone 'America/New_York') - interval '6 hours')::date;
$function$;

CREATE OR REPLACE FUNCTION public.venue_ticket_scan(p_order_id uuid, p_event_id uuid, p_qty integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_date     date;
  v_closed   timestamptz;
  v_hoy      date := public.venue_business_day();
  v_tdate    date;
  v_ttitle   text;
begin
  if v_uid is null then
    raise exception 'venue_ticket_scan_not_authenticated';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'venue_ticket_scan_invalid_qty';
  end if;

  select r.venue_id, e.event_date, e.doors_closed_at into v_venue, v_date, v_closed
    from public.venue_events e
    join public.venue_rooms r on r.id = e.room_id
   where e.id = p_event_id;
  v_event_ok := found;

  v_allowed := public.is_staff(v_uid)
    or (v_event_ok and exists (select 1 from public.venue_staff vs where vs.venue_id = v_venue and vs.user_id = v_uid));
  if not v_allowed then
    raise exception 'venue_ticket_scan_not_allowed';
  end if;

  -- EL ESCÁNER SOLO VALIDA EL EVENTO DEL DÍA: si el evento elegido no es el del día de negocio (6:00 a 6:00, hora de Miami), nada se valida.
  if v_event_ok and v_date is distinct from v_hoy then
    insert into public.venue_ticket_scan_logs (order_id, event_id, scanned_by, scan_result, qty)
    values (null, p_event_id, v_uid, 'wrong_date', 1);
    return jsonb_build_object('ok', false, 'code', 'wrong_date', 'event_date', v_date, 'today', v_hoy);
  end if;

  -- ENTRADAS CERRADAS: el dueño/manager ya cerró la puerta de este evento (todos entraron); nada se valida hasta que la reabra.
  if v_event_ok and v_closed is not null then
    insert into public.venue_ticket_scan_logs (order_id, event_id, scanned_by, scan_result, qty)
    values (null, p_event_id, v_uid, 'doors_closed', 1);
    return jsonb_build_object('ok', false, 'code', 'doors_closed', 'closed_at', v_closed);
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
      select e2.event_date, e2.title into v_tdate, v_ttitle from public.venue_events e2 where e2.id = gp.g_event;
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
      'ticket_event_date', v_tdate,
      'ticket_event_title', v_ttitle,
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
    select e2.event_date, e2.title into v_tdate, v_ttitle from public.venue_events e2 where e2.id = o.event_id;
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
    'items',            case when v_found then coalesce(o.items, '[]'::jsonb) else null end,
    'ticket_event_date', v_tdate,
    'ticket_event_title', v_ttitle
  );
end;
$function$;


-- ── 6) Puerta: cerrar/reabrir entradas y contador (dentro / faltan) ──
create or replace function public.venue_event_set_doors(p_event_id uuid, p_closed boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_venue uuid;
  v_at    timestamptz;
begin
  if v_uid is null then
    raise exception 'venue_event_set_doors_not_authenticated';
  end if;
  select r.venue_id into v_venue
    from public.venue_events e join public.venue_rooms r on r.id = e.room_id
   where e.id = p_event_id;
  if v_venue is null then
    raise exception 'evento_no_existe';
  end if;
  if not (public.is_staff(v_uid) or public.can_manage_venue_layout(v_venue)) then
    raise exception 'no_autorizado';                           -- cerrar la puerta: dueño/manager de ESE local o Miami DJ Beat (el equipo solo escanea)
  end if;
  update public.venue_events
     set doors_closed_at = case when coalesce(p_closed, false) then now() else null end
   where id = p_event_id
  returning doors_closed_at into v_at;
  return jsonb_build_object('ok', true, 'closed', v_at is not null, 'doors_closed_at', v_at);
end;
$function$;

revoke all on function public.venue_event_set_doors(uuid, boolean) from public, anon;
grant execute on function public.venue_event_set_doors(uuid, boolean) to authenticated;

create or replace function public.venue_door_summary(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_venue  uuid;
  v_role   text;
  v_title  text;
  v_date   date;
  v_closed timestamptz;
  v_total  integer;
  v_in     integer;
begin
  if v_uid is null then
    raise exception 'venue_door_summary_not_authenticated';
  end if;
  select r.venue_id, e.title, e.event_date, e.doors_closed_at into v_venue, v_title, v_date, v_closed
    from public.venue_events e join public.venue_rooms r on r.id = e.room_id
   where e.id = p_event_id;
  if v_venue is null then
    return jsonb_build_object('ok', false);
  end if;
  select vs.role into v_role from public.venue_staff vs where vs.venue_id = v_venue and vs.user_id = v_uid;
  if not public.is_staff(v_uid) and v_role is null then
    raise exception 'venue_door_summary_not_allowed';
  end if;
  select count(*) filter (where g.status <> 'void'), count(*) filter (where g.status = 'checked_in')
    into v_total, v_in
    from public.venue_ticket_guests g where g.event_id = p_event_id;
  return jsonb_build_object(
    'ok', true, 'title', v_title, 'event_date', v_date, 'is_today', (v_date = public.venue_business_day()),
    'total', v_total, 'inside', v_in, 'pending', v_total - v_in,
    'doors_closed_at', v_closed, 'closed', v_closed is not null,
    'can_close', (public.is_staff(v_uid) or v_role in ('owner', 'manager')));
end;
$function$;

revoke all on function public.venue_door_summary(uuid) from public, anon;
grant execute on function public.venue_door_summary(uuid) to authenticated;

-- ── Comprobación (solo lectura): todo en una fila. Esperado: lista_puerta=true, lista_anon=false, lista_auth=true, crear_anon=false, crear_auth=true,
--    plano_solo_admin=true, pol_guests_solo_owner_manager=true, pol_logs_solo_owner_manager=true, dia_de_negocio=true, escaner_solo_del_dia=true, escaneo_anon=false,
--    puerta_cerrar=true, cerrar_anon=false, resumen_puerta=true, resumen_anon=false, escaner_respeta_cierre=true, columna_cierre=true ──
select
  (to_regprocedure('public.venue_door_guests(uuid)') is not null)                                                          as lista_puerta,
  has_function_privilege('anon',          'public.venue_door_guests(uuid)', 'execute')                                     as lista_anon,
  has_function_privilege('authenticated', 'public.venue_door_guests(uuid)', 'execute')                                     as lista_auth,
  has_function_privilege('anon',          'public.venue_event_create(uuid,text,date,boolean)', 'execute')                  as crear_anon,
  has_function_privilege('authenticated', 'public.venue_event_create(uuid,text,date,boolean)', 'execute')                  as crear_auth,
  (select position('can_manage_venue_layout' in prosrc) = 0 from pg_proc where proname = 'venue_room_set_layout' and pronamespace = 'public'::regnamespace) as plano_solo_admin,
  (select qual like '%manager%' and qual not like '%team%' from pg_policies where policyname = 'venue_ticket_guests_staff_read')  as pol_guests_solo_owner_manager,
  (select qual like '%manager%' and qual not like '%team%' from pg_policies where policyname = 'venue_ticket_scan_logs_read')     as pol_logs_solo_owner_manager,
  (to_regprocedure('public.venue_business_day()') is not null)                                                             as dia_de_negocio,
  (select position('wrong_date' in prosrc) > 0 from pg_proc where proname = 'venue_ticket_scan' and pronamespace = 'public'::regnamespace) as escaner_solo_del_dia,
  has_function_privilege('anon', 'public.venue_ticket_scan(uuid,uuid,integer)', 'execute')                                 as escaneo_anon,
  (to_regprocedure('public.venue_event_set_doors(uuid,boolean)') is not null)                                              as puerta_cerrar,
  has_function_privilege('anon', 'public.venue_event_set_doors(uuid,boolean)', 'execute')                                  as cerrar_anon,
  (to_regprocedure('public.venue_door_summary(uuid)') is not null)                                                         as resumen_puerta,
  has_function_privilege('anon', 'public.venue_door_summary(uuid)', 'execute')                                             as resumen_anon,
  (select position('doors_closed' in prosrc) > 0 from pg_proc where proname = 'venue_ticket_scan' and pronamespace = 'public'::regnamespace) as escaner_respeta_cierre,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'venue_events' and column_name = 'doors_closed_at') as columna_cierre,
  public.venue_business_day()                                                                                                as hoy_de_negocio;
