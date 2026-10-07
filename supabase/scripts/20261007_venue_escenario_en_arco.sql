-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · ESCENARIO EN ARCO (pedido del PO 2026-10-07: «el escenario de Mojitos no es redondo pero tampoco rectangular: traza un ángulo semi curveado, estilo arco, de una punta de la pared a la otra»).
-- El escenario deja de ser un rectángulo y pasa a ser un ARCO suave: parte de la pared de arriba (x = 296), baja en curva suave hasta la pared de la izquierda (y = 160) y cierra por las dos paredes.
-- El arco es un tramo de círculo con una flecha de ~46 px sobre una cuerda de ~326 px (mucho más suave que un cuarto de círculo). Se dibuja como figura libre de 16 puntos (la misma que ya entienden el
-- portal, la sala pública y el editor de planos: no hace falta desplegar código nuevo) con el nombre «ESCENARIO», relleno dorado y marcada como estructura que no se pisa (bloquea), igual que antes.
-- Solo cambia la forma de ESE escenario (id ipie6q1y) en el plano base y en la copia de cada evento NO cancelado, y solo si hoy es el rectángulo de 288 x 152. No toca mesas, precios, ventas ni nada más.

create or replace function public.venue_tmp_escenario_arco(p_layout jsonb)
returns jsonb language plpgsql set search_path to 'public' as $$
declare v jsonb := p_layout; i integer; j integer; it jsonb;
begin
  if v is null or jsonb_typeof(v -> 'maps') is distinct from 'array' then return p_layout; end if;
  for i in 0 .. jsonb_array_length(v -> 'maps') - 1 loop
    if jsonb_typeof(v -> 'maps' -> i -> 'shapes') = 'array' then
      for j in 0 .. jsonb_array_length(v -> 'maps' -> i -> 'shapes') - 1 loop
        it := v -> 'maps' -> i -> 'shapes' -> j;
        if it ->> 'id' = 'ipie6q1y' and it ->> 'k' = 'stage' and (it ->> 'w')::numeric = 288 and (it ->> 'h')::numeric = 152 and (it ->> 'x')::numeric = 152 and (it ->> 'y')::numeric = 84 then
          v := jsonb_set(v, array['maps', i::text, 'shapes', j::text],
            '{"k": "poly", "id": "ipie6q1y", "label": "ESCENARIO", "relleno": "dorado", "bloquea": true, "pts": [[8, 8], [296, 8], [283, 28], [268, 48], [251, 66], [234, 83], [215, 98], [194, 112], [173, 124], [151, 135], [128, 144], [105, 151], [81, 156], [57, 159], [32, 161], [8, 160]]}'::jsonb);
        end if;
      end loop;
    end if;
  end loop;
  return v;
end $$;

update public.venue_rooms set layout = public.venue_tmp_escenario_arco(layout), updated_at = now()
 where layout is not null and layout is distinct from public.venue_tmp_escenario_arco(layout);
update public.venue_events set layout = public.venue_tmp_escenario_arco(layout), updated_at = now()
 where status <> 'cancelled' and layout is not null and layout is distinct from public.venue_tmp_escenario_arco(layout);
drop function public.venue_tmp_escenario_arco(jsonb);

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: tipo=poly, puntos=16, primer_punto=[8, 8], punta_pared_arriba=[296, 8], punta_pared_izquierda=[8, 160], mesas=22, sin funciones temporales ──
select max((select p ->> 'k' from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'id' = 'ipie6q1y')) as tipo,
       max((select jsonb_array_length(p -> 'pts') from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'id' = 'ipie6q1y')) as puntos,
       max((select (p -> 'pts' -> 0)::text from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'id' = 'ipie6q1y')) as primer_punto,
       max((select (p -> 'pts' -> 1)::text from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'id' = 'ipie6q1y')) as punta_pared_arriba,
       max((select (p -> 'pts' -> -1)::text from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'id' = 'ipie6q1y')) as punta_pared_izquierda,
       max(jsonb_array_length(r.layout -> 'maps' -> 0 -> 'tables')) as mesas,
       (select count(*) from pg_proc where proname like 'venue_tmp_%') as funciones_temporales
  from public.venue_rooms r;
