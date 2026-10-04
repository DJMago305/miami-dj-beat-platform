-- ============================================================================
-- ENTORNO: PRODUCCIÓN (proyecto hkuvuqupbxwkiykxvqdr) — *** NO APLICADO *** (preparado el 2026-10-04)
-- Quién lo aplica: el PO, en el SQL Editor de Supabase. Reemplaza (CREATE OR REPLACE, mismo tipo de retorno) DOS funciones que ya existen y crea DOS ayudantes;
-- no cambia ni borra datos. Requiere 20261003_sala_mesas_inventario_por_evento.sql, 20261003_fijar_mapa_de_la_sala.sql y 20261003_mesas_armar_grupo.sql.
-- ============================================================================
-- EDITOR DE PLANOS (venue-floor-builder.html): el dueño dibuja la arquitectura de la sala con figuras (escenario, áreas, puertas, rectángulos, elipses,
-- triángulos, paredes y texto). Se guardan en venue_rooms.layout -> maps[i].shapes (lista de figuras) y el dibujo completo de edición en layout.builder.
--   · venue_room_set_layout ahora también valida las figuras: tipos, medidas y posiciones dentro del plano, textos cortos, ids únicos, máx. 400 por plano y
--     12 planos; el tamaño del plano (maps[i].room) entre 300 y 2000. Todo o nada, igual que antes.
--   · venue_plano_bloquea ahora también cuenta las figuras que bloquean (escenario, barra, baños y paredes por defecto, o las marcadas «bloquea»): una mesa
--     movida con «Armar grupo» no puede quedar encima de la arquitectura. Cuenta figuras giradas, elipses y paredes (margen de 22 px).
-- Las mismas reglas están en web/js/mdj-plan-shapes.js (el navegador avisa antes; esta base es la que lo exige de verdad).
-- ============================================================================
create or replace function public.venue_plano_num(p_v jsonb, p_lo numeric, p_hi numeric)
returns boolean language sql immutable set search_path to 'public' as $$
  select case when jsonb_typeof(p_v) = 'number' then (p_v #>> '{}')::numeric between p_lo and p_hi else false end     -- un campo que falta o no es número = falso (nunca nulo)
$$;

create or replace function public.venue_plano_figura_valida(p_it jsonb)
returns boolean language plpgsql immutable set search_path to 'public' as $$
declare k text;
begin
  if jsonb_typeof(p_it) is distinct from 'object' then return false; end if;
  if jsonb_typeof(p_it -> 'id') is distinct from 'string' or length(p_it ->> 'id') not between 1 and 24 then return false; end if;
  k := p_it ->> 'k';
  if k is null or k not in ('stage', 'zone', 'door', 'shape', 'wall', 'text', 'chair') then return false; end if;
  if k = 'wall' then
    if not (public.venue_plano_num(p_it -> 'x1', -100, 1700) and public.venue_plano_num(p_it -> 'y1', -100, 1700)
            and public.venue_plano_num(p_it -> 'x2', -100, 1700) and public.venue_plano_num(p_it -> 'y2', -100, 1700)) then return false; end if;
    if p_it ? 'th' and not public.venue_plano_num(p_it -> 'th', 1, 40) then return false; end if;
  else
    if not (public.venue_plano_num(p_it -> 'x', -100, 1700) and public.venue_plano_num(p_it -> 'y', -100, 1700)) then return false; end if;
    if k in ('door', 'chair') then
      if not public.venue_plano_num(p_it -> 'w', 4, 400) then return false; end if;
    elsif k <> 'text' then
      if not (public.venue_plano_num(p_it -> 'w', 4, 1700) and public.venue_plano_num(p_it -> 'h', 4, 1700)) then return false; end if;
    end if;
  end if;
  if p_it ? 'rot' and not public.venue_plano_num(p_it -> 'rot', -360, 720) then return false; end if;
  if k = 'stage' and p_it ? 'shape' and (jsonb_typeof(p_it -> 'shape') is distinct from 'string' or (p_it ->> 'shape') not in ('rect', 'halfround', 'corner', 'oval', 'trapezoid')) then return false; end if;
  if p_it ? 'sub' then
    if jsonb_typeof(p_it -> 'sub') is distinct from 'string' then return false; end if;
    if k = 'zone' and (p_it ->> 'sub') not in ('barra', 'bano', 'pista', 'otro') then return false; end if;
    if k = 'door' and (p_it ->> 'sub') not in ('entrada', 'artistas', 'exit', 'puerta') then return false; end if;
    if k = 'shape' and (p_it ->> 'sub') not in ('rect', 'ellipse', 'triangle') then return false; end if;
  end if;
  if k = 'shape' and not (p_it ? 'sub') then return false; end if;
  if k = 'text' then
    if jsonb_typeof(p_it -> 'text') is distinct from 'string' or length(btrim(p_it ->> 'text')) = 0 then return false; end if;
    if p_it ? 'size' and not public.venue_plano_num(p_it -> 'size', 8, 80) then return false; end if;
  end if;
  if p_it ? 'label' and (jsonb_typeof(p_it -> 'label') is distinct from 'string' or length(p_it ->> 'label') > 60) then return false; end if;
  if k <> 'text' and p_it ? 'text' and (jsonb_typeof(p_it -> 'text') is distinct from 'string' or length(p_it ->> 'text') > 60) then return false; end if;
  if k = 'text' and length(p_it ->> 'text') > 60 then return false; end if;
  if p_it ? 'bloquea' and jsonb_typeof(p_it -> 'bloquea') is distinct from 'boolean' then return false; end if;
  if p_it ? 'relleno' and (jsonb_typeof(p_it -> 'relleno') is distinct from 'string' or (p_it ->> 'relleno') not in ('ninguno', 'gris', 'dorado', 'verde', 'rojo')) then return false; end if;
  return true;
end $$;

-- Mapa de la sala (plantilla): lo fija el dueño o el manager (valida todo o nada; devuelve cuántas mesas fijó)
create or replace function public.venue_room_set_layout(p_room_id uuid, p_layout jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_venue uuid; v_total integer; v_unicas integer; t jsonb; m jsonb; s jsonb; v_ids text[];
begin
  select r.venue_id into v_venue from public.venue_rooms r where r.id = p_room_id;
  if v_venue is null then raise exception 'sala_no_existe'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.can_manage_venue_layout(v_venue)) then raise exception 'no_autorizado'; end if;

  if p_layout is null or jsonb_typeof(p_layout) is distinct from 'object' or jsonb_typeof(p_layout -> 'tables') is distinct from 'array' then
    raise exception 'mapa_invalido';
  end if;
  if length(p_layout::text) > 1500000 then raise exception 'mapa_invalido'; end if;                       -- tope de tamaño del archivo guardado
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

  -- Planos: hasta 12; cada uno con su tamaño (300..2000) y sus figuras (hasta 400, ids únicos, todas válidas)
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
end $$;

-- La arquitectura de la sala NO cambia; solo se reordenan las mesas. Una mesa no puede quedar encima de una estructura: el escenario y los elementos fijos
-- «bano»/«barra» del formato anterior, y las figuras (maps[i].shapes) que bloquean (escenario, barra, baños y paredes por defecto, o «bloquea»: true;
-- «bloquea»: false lo anula). Margen de 22 px alrededor, por el tamaño de la mesa. La pista, el texto y las sillas sueltas no cuentan.
create or replace function public.venue_plano_bloquea(p_map jsonb, p_x numeric, p_y numeric)
returns boolean language plpgsql immutable set search_path to 'public' as $$
declare r jsonb; f jsonb; it jsonb; k text; a numeric; dx numeric; dy numeric; lx numeric; ly numeric; ea numeric; eb numeric; l2 numeric; tt numeric; cx numeric; cy numeric; blk boolean; elip boolean;
begin
  r := p_map -> 'focal' -> 'rect';
  if jsonb_typeof(r) = 'array' and jsonb_array_length(r) = 4
     and p_x between (r ->> 0)::numeric - 22 and (r ->> 0)::numeric + (r ->> 2)::numeric + 22
     and p_y between (r ->> 1)::numeric - 22 and (r ->> 1)::numeric + (r ->> 3)::numeric + 22 then return true; end if;
  if jsonb_typeof(p_map -> 'fixed') = 'array' then
    for f in select * from jsonb_array_elements(p_map -> 'fixed') loop
      r := f -> 'r';
      if (f ->> 'k') in ('bano', 'barra') and jsonb_typeof(r) = 'array' and jsonb_array_length(r) = 4
         and p_x between (r ->> 0)::numeric - 22 and (r ->> 0)::numeric + (r ->> 2)::numeric + 22
         and p_y between (r ->> 1)::numeric - 22 and (r ->> 1)::numeric + (r ->> 3)::numeric + 22 then return true; end if;
    end loop;
  end if;
  if jsonb_typeof(p_map -> 'shapes') = 'array' then
    for it in select * from jsonb_array_elements(p_map -> 'shapes') loop
      continue when not public.venue_plano_figura_valida(it);
      k := it ->> 'k';
      blk := case when it ->> 'bloquea' = 'true' then true when it ->> 'bloquea' = 'false' then false
                  else (k in ('stage', 'wall') or (k = 'zone' and (it ->> 'sub') in ('barra', 'bano'))) end;
      continue when not blk or k in ('text', 'chair');
      if k = 'wall' then
        dx := (it ->> 'x2')::numeric - (it ->> 'x1')::numeric; dy := (it ->> 'y2')::numeric - (it ->> 'y1')::numeric; l2 := dx * dx + dy * dy;
        tt := case when l2 = 0 then 0 else greatest(0, least(1, ((p_x - (it ->> 'x1')::numeric) * dx + (p_y - (it ->> 'y1')::numeric) * dy) / l2)) end;
        cx := (it ->> 'x1')::numeric + tt * dx; cy := (it ->> 'y1')::numeric + tt * dy;
        if sqrt((p_x - cx) * (p_x - cx) + (p_y - cy) * (p_y - cy)) <= 22 + coalesce((it ->> 'th')::numeric, 6) / 2 then return true; end if;
      else
        a := coalesce((it ->> 'rot')::numeric, 0) * pi() / 180; dx := p_x - (it ->> 'x')::numeric; dy := p_y - (it ->> 'y')::numeric;
        lx := dx * cos(a) + dy * sin(a); ly := -dx * sin(a) + dy * cos(a);
        if k = 'door' then
          if abs(lx) <= (it ->> 'w')::numeric / 2 + 22 and abs(ly) <= 3.5 + 22 then return true; end if;
        else
          elip := (k = 'shape' and it ->> 'sub' = 'ellipse') or (k = 'stage' and it ->> 'shape' = 'oval');
          if elip then
            ea := (it ->> 'w')::numeric / 2 + 22; eb := (it ->> 'h')::numeric / 2 + 22;
            if (lx * lx) / (ea * ea) + (ly * ly) / (eb * eb) <= 1 then return true; end if;
          elsif abs(lx) <= (it ->> 'w')::numeric / 2 + 22 and abs(ly) <= (it ->> 'h')::numeric / 2 + 22 then return true; end if;
        end if;
      end if;
    end loop;
  end if;
  return false;
end $$;

revoke all on function public.venue_plano_num(jsonb, numeric, numeric) from public, anon, authenticated;
revoke all on function public.venue_plano_figura_valida(jsonb) from public, anon, authenticated;
revoke all on function public.venue_plano_bloquea(jsonb, numeric, numeric) from public, anon, authenticated;
revoke all on function public.venue_room_set_layout(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.venue_room_set_layout(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- Comprobación: 4 filas (las cuatro funciones existen; solo venue_room_set_layout la ejecuta "authenticated").
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_puede, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('venue_plano_num', 'venue_plano_figura_valida', 'venue_plano_bloquea', 'venue_room_set_layout') order by p.proname;
