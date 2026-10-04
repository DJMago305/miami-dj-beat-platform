-- ============================================================================
-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - *** NO APLICADO *** (preparado el 2026-10-03)
-- Quien lo aplica: el PO, en el SQL Editor de Supabase. Reemplaza UNA funcion (la version simple de venue_room_set_layout); no cambia ni borra datos.
-- Requiere 20261003_equipo_del_local_roles.sql (can_manage_venue_layout) y 20261003_sala_mesas_inventario_por_evento.sql.
-- ============================================================================
-- ⚠️ ORDEN: la función venue_room_set_layout de este script fue ampliada por 20261004_plano_formas.sql (figuras del editor de planos). Si vuelves a correr este
-- script, corre ese DESPUÉS para no volver a la versión anterior.
-- BOTON «FIJAR EL MAPA DE LA SALA» (pantalla Mesas del portal comercial)
-- public.venue_room_set_layout(p_room_id, p_layout) guarda la PLANTILLA de mesas de una sala (venue_rooms.layout).
--   · Quien puede: dueno y manager del local (can_manage_venue_layout) y admin de la plataforma. El equipo NO.
--   · Valida antes de guardar (todo o nada): objeto con "tables" (1 a 300 mesas); cada mesa con "key" unica y no vacia (max 20 caracteres),
--     "price_cents" entero 0..1000000 y, si trae "seats", entero 1..40. "maps" (la geometria del plano), si viene, debe ser una lista y se conserva tal cual; las demas claves tambien.
--   · Los eventos que YA abrieron su venta conservan su propia copia del mapa (venue_events.layout): cambiar la plantilla nunca altera una venta en curso.
--     Los eventos aun sin abrir toman la plantilla nueva al abrir la venta.
--   · Devuelve cuantas mesas quedaron fijadas.
-- ============================================================================
-- La version simple que ya existe en produccion (de 20261003_sala_mesas_inventario_por_evento.sql) devolvia void y solo revisaba que el mapa fuera un objeto:
-- Postgres no deja cambiar el tipo de retorno con CREATE OR REPLACE, asi que se reemplaza (nada mas la usa: la pantalla Mesas es quien la va a llamar).
drop function if exists public.venue_room_set_layout(uuid, jsonb);
create or replace function public.venue_room_set_layout(p_room_id uuid, p_layout jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid; v_total integer; v_unicas integer; t jsonb;
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;

  if p_layout is null or jsonb_typeof(p_layout) is distinct from 'object' or jsonb_typeof(p_layout -> 'tables') is distinct from 'array' then
    raise exception 'mapa_invalido';
  end if;
  if p_layout ? 'maps' and jsonb_typeof(p_layout -> 'maps') is distinct from 'array' then raise exception 'mapa_invalido'; end if;   -- el dibujo del plano, si viene, debe ser una lista
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

  update public.venue_rooms set layout = p_layout, updated_at = now() where id = p_room_id;
  return v_total;
end $$;

revoke all on function public.venue_room_set_layout(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_room_set_layout(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- Comprobacion: debe devolver 1 fila (la funcion existe y solo la ejecuta "authenticated").
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_puede, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'venue_room_set_layout';
