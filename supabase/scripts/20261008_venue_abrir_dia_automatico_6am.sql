-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · «OPERACIÓN DE HOY» SE ABRE SOLA A LAS 6:00 A. M. (hora de Miami) (pedido del PO 2026-10-07: «abre el día automático a las 6am»).
-- Hoy alguien tiene que apretar ▶ cada mañana. Con esto, a las 6:00 de Miami el sistema abre el día de cada sala activa con el diseño de su PLANTILLA (el diseño del día normal), igual que el botón ▶.
-- Qué hace:
--   1) venue_open_day_core(sala): la lógica de abrir el día, SIN revisar permisos (solo la usan el botón y el trabajo programado). venue_open_day(sala) —el botón ▶ de siempre— conserva su revisión de permisos
--      y su respuesta, y ahora llama a esa misma lógica: un solo camino para abrir el día.
--   2) venue_open_day_auto(): recorre las salas activas con plano y abre el día de cada una. Idempotente (si ya está abierto, no hace nada: tampoco duplica si alguien apretó ▶ antes). Una sala con problema
--      no frena a las demás. Solo actúa entre las 6:00 y las 9:59 de Miami (el día de negocio cambia a las 6:00); fuera de esa ventana no crea nada. Devuelve un resumen (sala, creada o ya abierta, o el error).
--   3) Trabajo programado (pg_cron, que corre en hora GMT): a las 10:01 y 11:01 GMT, con un reintento a los :31, cubre las 6:01 de Miami en verano (EDT) y en invierno (EST). El que cae antes de las 6:00 de Miami no crea nada.
-- NO toca: la plantilla, eventos existentes, mesas, precios ni ventas. Si ya hay «Operación de hoy», no se vuelve a crear (el día se identifica por sala y día de negocio).
-- Para apagarlo: select cron.unschedule('venue_abrir_dia_6am');

create or replace function public.venue_open_day_core(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_layout jsonb; v_day date := public.venue_business_day(); v_ev uuid; v_total integer; v_unicas integer;
begin
  select r.layout into v_layout from public.venue_rooms r where r.id = p_room_id and coalesce(r.active, true);
  if not found then raise exception 'sala_no_existe'; end if;
  perform pg_advisory_xact_lock(hashtext('open_day:' || p_room_id::text || v_day::text));            -- dos aperturas a la vez no crean dos operaciones
  select e.id into v_ev from public.venue_events e where e.room_id = p_room_id and e.status = 'operation' and e.event_date = v_day limit 1;
  if v_ev is not null then return jsonb_build_object('ok', true, 'event_id', v_ev, 'created', false); end if;
  if v_layout is null or jsonb_typeof(v_layout -> 'tables') is distinct from 'array' or jsonb_array_length(v_layout -> 'tables') = 0 then raise exception 'sin_mapa'; end if;
  select count(*), count(distinct t ->> 'key') into v_total, v_unicas from jsonb_array_elements(v_layout -> 'tables') t;
  if v_unicas <> v_total or exists (select 1 from jsonb_array_elements(v_layout -> 'tables') t where coalesce(t ->> 'key', '') = '' or (t ->> 'price_cents') is null) then raise exception 'mapa_invalido'; end if;
  insert into public.venue_events (room_id, title, event_date, status, tables_open, layout) values (p_room_id, 'Operación de hoy', v_day, 'operation', true, v_layout) returning id into v_ev;
  insert into public.venue_event_tables (event_id, table_key, label, seats, zone_name, price_cents)
    select v_ev, t ->> 'key', coalesce(nullif(t ->> 'label', ''), t ->> 'key'), coalesce((t ->> 'seats')::integer, 4), t ->> 'zone', (t ->> 'price_cents')::integer
      from jsonb_array_elements(v_layout -> 'tables') t
    on conflict (event_id, table_key) do nothing;
  return jsonb_build_object('ok', true, 'event_id', v_ev, 'created', true);
end $$;

create or replace function public.venue_open_day(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_venue uuid;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id and coalesce(r.active, true);
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_sell_venue(v_venue) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;
  return public.venue_open_day_core(p_room_id);
end $$;

create or replace function public.venue_open_day_auto(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_hora integer := extract(hour from (p_now at time zone 'America/New_York'))::integer; v_room record; v_res jsonb; v_out jsonb := '[]'::jsonb;
begin
  if v_hora < 6 or v_hora > 9 then return jsonb_build_object('ok', true, 'accion', 'fuera_de_ventana', 'hora_miami', v_hora); end if;
  for v_room in select r.id from public.venue_rooms r where coalesce(r.active, true) and r.layout is not null order by r.created_at nulls last, r.id loop
    begin
      v_res := public.venue_open_day_core(v_room.id);
      v_out := v_out || jsonb_build_array(jsonb_build_object('sala', v_room.id, 'creada', v_res -> 'created', 'evento', v_res -> 'event_id'));
    exception when others then
      v_out := v_out || jsonb_build_array(jsonb_build_object('sala', v_room.id, 'error', sqlerrm));
    end;
  end loop;
  return jsonb_build_object('ok', true, 'hora_miami', v_hora, 'salas', v_out);
end $$;

revoke all on function public.venue_open_day_core(uuid) from public, anon, authenticated;
revoke all on function public.venue_open_day_auto(timestamptz) from public, anon, authenticated;
revoke all on function public.venue_open_day(uuid) from public, anon, authenticated;
grant execute on function public.venue_open_day(uuid) to authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'venue_abrir_dia_6am') then perform cron.unschedule('venue_abrir_dia_6am'); end if;
  perform cron.schedule('venue_abrir_dia_6am', '1,31 10,11 * * *', 'select public.venue_open_day_auto();');
end $$;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: trabajo=1 con horario '1,31 10,11 * * *', activo=true, anon_o_authenticated_en_core_y_auto=0, boton_sigue_para_authenticated=true, funciones_temporales=0 ──
select (select count(*) from cron.job where jobname = 'venue_abrir_dia_6am') as trabajo,
       (select schedule from cron.job where jobname = 'venue_abrir_dia_6am') as horario,
       (select active from cron.job where jobname = 'venue_abrir_dia_6am') as activo,
       (select count(*) from pg_proc where proname in ('venue_open_day_core', 'venue_open_day_auto') and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute'))) as anon_o_authenticated_en_core_y_auto,
       (select has_function_privilege('authenticated', 'public.venue_open_day(uuid)', 'execute') and not has_function_privilege('anon', 'public.venue_open_day(uuid)', 'execute')) as boton_sigue_para_authenticated,
       (select count(*) from pg_proc where proname like 'venue_tmp_%') as funciones_temporales;
