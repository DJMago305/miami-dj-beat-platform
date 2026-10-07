-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · AUTORIZACIONES DEL OWNER (pedido del PO 2026-10-07):
--   «El owner —la primera cuenta que se crea— es la única persona que entra a CONFIG y desde ahí autoriza quién puede VENDER tickets y quién puede EDITAR/CONFIGURAR
--    la sala. Cada autorización es un interruptor por persona (el mismo interruptor del resto del portal).»
--
-- Qué hace:
--   1) venue_staff gana DOS interruptores por persona: can_sell_tickets (venta telefónica / manual, apartar y liberar mesas) y can_edit_room (diseñar y mover mesas, crear eventos, agregar/editar/quitar mesas y sillas,
--      cerrar/reabrir entradas, abrir la venta de mesas). Solo la primera vez: las filas que ya existen CONSERVAN lo que podían hacer hasta hoy (owner/manager/team venden; owner/manager editan).
--      Una persona NUEVA entra con los dos interruptores APAGADOS: el owner la autoriza a propósito. Escanear y ver la lista de la puerta lo puede cualquier miembro del local (porteros).
--   2) can_sell_venue(local) = owner O miembro con can_sell_tickets.  can_manage_venue_layout(local) = owner O miembro con can_edit_room.
--      Estas dos funciones ya las usan todas las acciones de SALAS (vender, mover, crear evento, mesas, entradas…): al cambiarlas, TODAS obedecen a los interruptores.
--   3) venue_team_set_permissions(local, persona, can_sell_tickets, can_edit_room): SOLO el owner de ese local (o admin de la plataforma). No se puede cambiar al owner (siempre tiene todo).
--   4) venue_team(local): ahora solo la ve el OWNER (antes también quien podía editar la sala) y devuelve los dos interruptores. Cambia la forma de la respuesta: se recrea.
--   5) La política de lectura de venue_staff deja de abrir la lista de personas a quien edita la sala: solo cada quien su fila, el owner y Miami DJ Beat.
--   6) Mover mesas (venue_event_move_tables) pasa a depender de can_edit_room; la lectura del inventario de mesas se abre a can_sell_tickets Y a can_edit_room.
--   7) venue_door_summary: «puede cerrar entradas» ahora sigue el mismo permiso que venue_event_set_doors (can_manage_venue_layout).
-- Si algún día se vuelve a correr 20261007_venue_salas_seguridad_y_crear_evento.sql, corre ESTE script después (aquel redefine venue_door_summary con la regla anterior).

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'venue_staff' and column_name = 'can_sell_tickets') then
    alter table public.venue_staff add column can_sell_tickets boolean not null default false;
    alter table public.venue_staff add column can_edit_room boolean not null default false;
    update public.venue_staff set can_sell_tickets = true where role in ('owner', 'manager', 'team');         -- lo que ya podían hacer, se conserva
    update public.venue_staff set can_edit_room = true where role in ('owner', 'manager');
  end if;
end $$;

create or replace function public.can_sell_venue(p_venue_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.venue_role(p_venue_id) = 'owner'
                  or exists (select 1 from public.venue_staff s where s.venue_id = p_venue_id and s.user_id = auth.uid() and s.can_sell_tickets), false);
$$;

create or replace function public.can_manage_venue_layout(p_venue_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.venue_role(p_venue_id) = 'owner'
                  or exists (select 1 from public.venue_staff s where s.venue_id = p_venue_id and s.user_id = auth.uid() and s.can_edit_room), false);
$$;

drop function if exists public.venue_team(uuid);
create function public.venue_team(p_venue_id uuid)
returns table (user_id uuid, role text, full_name text, email text, created_at timestamptz, can_sell_tickets boolean, can_edit_room boolean)
language sql stable security definer set search_path to 'public' as $$
  select s.user_id, s.role, c.full_name, c.email, s.created_at, (s.role = 'owner' or s.can_sell_tickets), (s.role = 'owner' or s.can_edit_room)
    from public.venue_staff s
    left join public.client_profiles c on c.user_id = s.user_id
   where s.venue_id = p_venue_id
     and (public.is_platform_admin(auth.uid()) or public.is_venue_owner(p_venue_id))
   order by case s.role when 'owner' then 0 when 'manager' then 1 else 2 end, s.created_at;
$$;
revoke all on function public.venue_team(uuid) from public, anon;
grant execute on function public.venue_team(uuid) to authenticated;

create or replace function public.venue_team_set_permissions(p_venue_id uuid, p_user_id uuid, p_can_sell_tickets boolean default null, p_can_edit_room boolean default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r public.venue_staff%rowtype;
begin
  if auth.uid() is null then raise exception 'no_autorizado'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.is_venue_owner(p_venue_id)) then raise exception 'no_autorizado'; end if;       -- solo el owner autoriza
  if p_can_sell_tickets is null and p_can_edit_room is null then return jsonb_build_object('ok', false, 'error', 'sin_cambios'); end if;
  select * into r from public.venue_staff where venue_id = p_venue_id and user_id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'persona_no_existe'); end if;
  if r.role = 'owner' then return jsonb_build_object('ok', false, 'error', 'no_se_puede_cambiar_al_owner'); end if;                      -- el owner siempre tiene todo
  update public.venue_staff set can_sell_tickets = coalesce(p_can_sell_tickets, can_sell_tickets), can_edit_room = coalesce(p_can_edit_room, can_edit_room)
   where venue_id = p_venue_id and user_id = p_user_id returning * into r;
  return jsonb_build_object('ok', true, 'can_sell_tickets', r.can_sell_tickets, 'can_edit_room', r.can_edit_room);
end $$;
revoke all on function public.venue_team_set_permissions(uuid, uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.venue_team_set_permissions(uuid, uuid, boolean, boolean) to authenticated;

drop policy if exists venue_staff_select on public.venue_staff;
create policy venue_staff_select on public.venue_staff for select
  using (public.is_platform_admin(auth.uid()) or user_id = auth.uid() or public.is_venue_owner(venue_id));

create or replace function public.venue_door_summary(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_uid uuid := auth.uid(); v_venue uuid; v_role text; v_title text; v_date date; v_closed timestamptz; v_total integer; v_in integer;
begin
  if v_uid is null then raise exception 'venue_door_summary_not_authenticated'; end if;
  select r.venue_id, e.title, e.event_date, e.doors_closed_at into v_venue, v_title, v_date, v_closed
    from public.venue_events e join public.venue_rooms r on r.id = e.room_id where e.id = p_event_id;
  if v_venue is null then return jsonb_build_object('ok', false); end if;
  select vs.role into v_role from public.venue_staff vs where vs.venue_id = v_venue and vs.user_id = v_uid;
  if not public.is_staff(v_uid) and v_role is null then raise exception 'venue_door_summary_not_allowed'; end if;
  select count(*) filter (where g.status <> 'void'), count(*) filter (where g.status = 'checked_in') into v_total, v_in
    from public.venue_ticket_guests g where g.event_id = p_event_id;
  return jsonb_build_object('ok', true, 'title', v_title, 'event_date', v_date, 'is_today', (v_date = public.venue_business_day()),
    'total', v_total, 'inside', v_in, 'pending', v_total - v_in, 'doors_closed_at', v_closed, 'closed', v_closed is not null,
    'can_close', (public.is_staff(v_uid) or public.can_manage_venue_layout(v_venue)));
end;
$function$;

-- Mover mesas es parte de DISEÑAR la sala: ahora lo permite el interruptor can_edit_room (antes: cualquiera que pudiera vender). Misma función de siempre; solo cambia la comprobación de permiso.
create or replace function public.venue_event_move_tables(p_event_id uuid, p_moves jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid := public.venue_event_venue_id(p_event_id);
  v_layout jsonb; v_total integer; mv jsonb; v_key text; v_x numeric; v_y numeric; r public.venue_event_tables%rowtype;
  i integer; j integer; v_hecho boolean; n integer := 0; v_vistas text[] := '{}';
begin
  if v_venue is null then raise exception 'evento_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  if p_moves is null or jsonb_typeof(p_moves) <> 'array' then raise exception 'movimiento_invalido'; end if;
  v_total := jsonb_array_length(p_moves);
  if v_total < 1 or v_total > 40 then raise exception 'movimiento_invalido'; end if;

  select layout into v_layout from public.venue_events where id = p_event_id for update;     -- serializa dos movimientos a la vez
  if v_layout is null or jsonb_typeof(v_layout -> 'maps') is distinct from 'array' or jsonb_array_length(v_layout -> 'maps') = 0 then raise exception 'sin_plano'; end if;

  for mv in select * from jsonb_array_elements(p_moves) loop
    if jsonb_typeof(mv) is distinct from 'object' or jsonb_typeof(mv -> 'key') is distinct from 'string'
       or jsonb_typeof(mv -> 'x') is distinct from 'number' or jsonb_typeof(mv -> 'y') is distinct from 'number' then raise exception 'movimiento_invalido'; end if;
    v_key := mv ->> 'key'; v_x := (mv ->> 'x')::numeric; v_y := (mv ->> 'y')::numeric;
    if v_x < 0 or v_x > 2000 or v_y < 0 or v_y > 2000 or v_key = any (v_vistas) then raise exception 'movimiento_invalido'; end if;
    v_vistas := v_vistas || v_key;

    select * into r from public.venue_event_tables where event_id = p_event_id and table_key = v_key for update;
    if not found then raise exception 'mesa_no_existe'; end if;
    if r.status = 'sold' or (r.status = 'held' and r.held_until >= now()) then raise exception 'mesa_no_se_puede_mover'; end if;

    v_hecho := false;
    for i in 0 .. jsonb_array_length(v_layout -> 'maps') - 1 loop
      if jsonb_typeof(v_layout -> 'maps' -> i -> 'tables') = 'array' then
        for j in 0 .. jsonb_array_length(v_layout -> 'maps' -> i -> 'tables') - 1 loop
          if v_layout -> 'maps' -> i -> 'tables' -> j ->> 'id' = v_key then
            -- el limite es el tamano de ESE plano (maps[i].room; 800 x 520 si no trae)
            if v_x > coalesce((v_layout -> 'maps' -> i -> 'room' ->> 'w')::numeric, 800) or v_y > coalesce((v_layout -> 'maps' -> i -> 'room' ->> 'h')::numeric, 520) then raise exception 'movimiento_invalido'; end if;
            if public.venue_plano_bloquea(v_layout -> 'maps' -> i, v_x, v_y) then raise exception 'mesa_sobre_estructura'; end if;
            v_layout := jsonb_set(v_layout, array['maps', i::text, 'tables', j::text, 'x'], to_jsonb(round(v_x)));
            v_layout := jsonb_set(v_layout, array['maps', i::text, 'tables', j::text, 'y'], to_jsonb(round(v_y)));
            v_hecho := true;
          end if;
        end loop;
      end if;
    end loop;
    if not v_hecho then raise exception 'mesa_sin_dibujo'; end if;
    n := n + 1;
  end loop;

  update public.venue_events set layout = v_layout, updated_at = now() where id = p_event_id;
  return n;
end $$;
revoke all on function public.venue_event_move_tables(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_event_move_tables(uuid, jsonb) to authenticated;

-- Quien puede DISEÑAR la sala (can_edit_room) tiene que poder VER el inventario de mesas aunque no venda: la lectura se abre a los dos permisos.
drop policy if exists venue_event_tables_staff_read on public.venue_event_tables;
create policy venue_event_tables_staff_read on public.venue_event_tables for select
  using (public.is_platform_admin(auth.uid()) or public.can_sell_venue(public.venue_event_venue_id(event_id)) or public.can_manage_venue_layout(public.venue_event_venue_id(event_id)));

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: columnas=2, owner_con_todo=true, set_permisos=true, set_permisos_anon=false, team_con_interruptores=true, politica_solo_owner=true ──
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'venue_staff' and column_name in ('can_sell_tickets', 'can_edit_room')) as columnas,
  (select bool_and(can_sell_tickets and can_edit_room) from public.venue_staff where role = 'owner')                                                                       as owner_con_todo,
  (to_regprocedure('public.venue_team_set_permissions(uuid,uuid,boolean,boolean)') is not null)                                                                    as set_permisos,
  has_function_privilege('anon', 'public.venue_team_set_permissions(uuid,uuid,boolean,boolean)', 'execute')                                                        as set_permisos_anon,
  (select position('can_edit_room' in pg_get_function_result('public.venue_team(uuid)'::regprocedure)) > 0)                                                        as team_con_interruptores,
  (select qual like '%is_venue_owner%' and qual not like '%can_manage%' from pg_policies where tablename = 'venue_staff' and policyname = 'venue_staff_select')    as politica_solo_owner;
