-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · CORRECCIÓN DE ARQUITECTURA DEL PLANO DE MOJITOS CALLE 8 (pedido del PO 2026-10-07: «corrige los errores y que todo quede cuadrado; veo cosas salidas de lugar»).
-- Solo GEOMETRÍA del plano base y de la copia de cada evento NO cancelado: alinear a una cuadrícula de 8 px, empalmar paredes y recintos que quedaban a medias, poner cada puerta SOBRE su pared,
-- quitar decimales y recintos que se salían del borde, centrar las mesas de la terraza y del VIP, y alargar la barra hasta la pared del VIP. NO agrega ni quita nada, no cambia mesas (sillas, precios, llaves),
-- ventas, inventario ni la sala pública. Cada cambio es por «id» y SOLO si el valor de hoy es el esperado (idempotente: volver a correrlo no cambia nada, y lo que el PO movió a mano no se pisa).

create or replace function public.venue_tmp_corregir_plano(p_layout jsonb)
returns jsonb language plpgsql set search_path to 'public' as $$
declare
  ed jsonb := '[{"id": "iw2c6w3k", "if": {"pts": [[0, 560], [880, 560], [880, 760], [0, 760]]}, "set": {"pts": [[248, 560], [880, 560], [880, 760], [248, 760]]}}, {"id": "igknynbm", "if": {"pts": [[0, 760], [1280, 760], [1280, 952], [0, 952]]}, "set": {"pts": [[8, 760], [1272, 760], [1272, 944], [8, 944]]}}, {"id": "azhwi6x", "if": {"pts": [[880, 169.6], [1272, 169.6], [1272, 233.6], [880, 233.6]]}, "set": {"pts": [[880, 168], [1272, 168], [1272, 240], [880, 240]]}}, {"id": "agx60n5", "if": {"pts": [[888, 12.8], [955.2, 12.8], [955.2, 160], [888, 160]]}, "set": {"pts": [[888, 8], [952, 8], [952, 168], [888, 168]]}}, {"id": "ile0h28j", "if": {"y": 84}, "set": {"y": 88}}, {"id": "inks6z5o", "if": {"y": 84}, "set": {"y": 88}}, {"id": "ipie6q1y", "if": {"x": 52, "y": 52}, "set": {"x": 60, "y": 60}}, {"id": "i60bb972", "if": {"x": 757.6, "y": 340, "h": 200}, "set": {"x": 760, "y": 400, "h": 320}}, {"id": "irwjmcy0", "if": {"x2": 872}, "set": {"x2": 880}}, {"id": "i3536bl4", "if": {"x1": 800, "x2": 952}, "set": {"x1": 796, "x2": 960}}, {"id": "iom7cgn8", "if": {"x1": 1048}, "set": {"x1": 1040}}, {"id": "ij4ibf37", "if": {"x": 864}, "set": {"x": 880}}, {"id": "ihk9uget", "if": {"y": 728}, "set": {"y": 760}}, {"id": "i620h6h9", "if": {"y": 856}, "set": {"y": 852}}, {"id": "icqn3q7i", "if": {"x": 1280}, "set": {"x": 1272}}, {"id": "idwg22gx", "if": {"x": 1280}, "set": {"x": 1272}}, {"id": "izmdketh", "if": {"x": 960, "y": 256, "rot": 90}, "set": {"x": 980, "y": 240, "rot": 180}}, {"id": "is4jaccl", "if": {"x": 1024, "y": 240}, "set": {"x": 1020}}, {"id": "i26rs0mv", "if": {"y": 144, "rot": 270}, "set": {"y": 168, "rot": 0}}, {"id": "icq5e4q4", "if": {"y": 144, "rot": 270}, "set": {"y": 168, "rot": 0}}, {"id": "iew9graa", "if": {"x": 120}, "set": {"x": 128}}, {"id": "i8ut33i7", "if": {"x": 520}, "set": {"x": 560}}, {"id": "mT10ay", "if": {"x": 250, "y": 825}, "set": {"x": 240, "y": 824}}, {"id": "mT2zee", "if": {"x": 410, "y": 825}, "set": {"x": 400, "y": 824}}, {"id": "mT3t90", "if": {"x": 570, "y": 825}, "set": {"x": 560, "y": 824}}, {"id": "mT4jan", "if": {"x": 730, "y": 825}, "set": {"x": 720, "y": 824}}, {"id": "mT551f", "if": {"x": 890, "y": 825}, "set": {"x": 880, "y": 824}}, {"id": "mT6xow", "if": {"x": 1050, "y": 825}, "set": {"x": 1040, "y": 824}}, {"id": "mT7cns", "if": {"x": 250, "y": 905}, "set": {"x": 240, "y": 904}}, {"id": "mT8k0j", "if": {"x": 410, "y": 905}, "set": {"x": 400, "y": 904}}, {"id": "mT97ea", "if": {"x": 570, "y": 905}, "set": {"x": 560, "y": 904}}, {"id": "mT100nt", "if": {"x": 730, "y": 905}, "set": {"x": 720, "y": 904}}, {"id": "mT117ej", "if": {"x": 890, "y": 905}, "set": {"x": 880, "y": 904}}, {"id": "mT12rvv", "if": {"x": 1050, "y": 905}, "set": {"x": 1040, "y": 904}}, {"id": "V01", "if": {"x": 310}, "set": {"x": 360}}, {"id": "V06", "if": {"x": 310}, "set": {"x": 360}}, {"id": "V02", "if": {"x": 410}, "set": {"x": 460}}, {"id": "V07", "if": {"x": 410}, "set": {"x": 460}}, {"id": "V03", "if": {"x": 510}, "set": {"x": 560}}, {"id": "V08", "if": {"x": 510}, "set": {"x": 560}}, {"id": "V04", "if": {"x": 610}, "set": {"x": 660}}, {"id": "V09", "if": {"x": 610}, "set": {"x": 660}}, {"id": "V05", "if": {"x": 710}, "set": {"x": 760}}, {"id": "V10", "if": {"x": 710}, "set": {"x": 760}}]'::jsonb;
  v jsonb := p_layout; i integer; j integer; k text; arr text; el jsonb; x jsonb; ok boolean; kv record;
begin
  if v is null or jsonb_typeof(v -> 'maps') is distinct from 'array' then return p_layout; end if;
  for i in 0 .. jsonb_array_length(v -> 'maps') - 1 loop
    foreach arr in array array['shapes', 'tables'] loop
      if jsonb_typeof(v -> 'maps' -> i -> arr) = 'array' then
        for j in 0 .. jsonb_array_length(v -> 'maps' -> i -> arr) - 1 loop
          el := v -> 'maps' -> i -> arr -> j;
          for x in select * from jsonb_array_elements(ed) loop
            if x ->> 'id' = el ->> 'id' then
              ok := true;
              for kv in select * from jsonb_each(x -> 'if') loop
                if (el -> kv.key) is distinct from kv.value then ok := false; end if;
              end loop;
              if ok then
                el := el || (x -> 'set');
                v := jsonb_set(v, array['maps', i::text, arr, j::text], el);
              end if;
            end if;
          end loop;
        end loop;
      end if;
    end loop;
    if (v -> 'maps' -> i -> 'focal' ->> 'x')::numeric = 52 and (v -> 'maps' -> i -> 'focal' ->> 'y')::numeric = 52 then
      v := jsonb_set(v, array['maps', i::text, 'focal'], '{"x": 60, "y": 60}'::jsonb);
    end if;
  end loop;
  return v;
end $$;

update public.venue_rooms set layout = public.venue_tmp_corregir_plano(layout), updated_at = now()
 where layout is not null and layout is distinct from public.venue_tmp_corregir_plano(layout);
update public.venue_events set layout = public.venue_tmp_corregir_plano(layout), updated_at = now()
 where status <> 'cancelled' and layout is not null and layout is distinct from public.venue_tmp_corregir_plano(layout);
drop function public.venue_tmp_corregir_plano(jsonb);

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: vip_x=248, terraza_x=8, terraza_y_fin=944, pasillo_y=168-240, caja=8-168, banos_y=88, escenario=60, barra_y=400, barra_h=320, mesas=24, v01_x=360, t01_x=240, sin funciones temporales ──
select max((select (p -> 'pts' -> 0 ->> 0)::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'VIP')) as vip_x,
       max((select (p -> 'pts' -> 0 ->> 0)::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'TERRAZA')) as terraza_x,
       max((select (p -> 'pts' -> 2 ->> 1)::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'TERRAZA')) as terraza_y_fin,
       max((select (p -> 'pts' -> 0 ->> 1)::numeric || '-' || (p -> 'pts' -> 2 ->> 1)::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'PASILLO')) as pasillo_y,
       max((select (p -> 'pts' -> 0 ->> 1)::numeric || '-' || (p -> 'pts' -> 2 ->> 1)::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'CAJA')) as caja,
       max((select max((p ->> 'y')::numeric) from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'BAÑOS')) as banos_y,
       max((select (p ->> 'x')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'ESCENARIO')) as escenario,
       max((select (p ->> 'y')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'sub' = 'barra')) as barra_y,
       max((select (p ->> 'h')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'sub' = 'barra')) as barra_h,
       max(jsonb_array_length(r.layout -> 'maps' -> 0 -> 'tables')) as mesas,
       max((select (t ->> 'x')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'tables') t where t ->> 'id' = 'V01')) as v01_x,
       max((select (p ->> 'x')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'T01')) as t01_x,
       (select count(*) from pg_proc where proname like 'venue_tmp_%') as funciones_temporales
  from public.venue_rooms r;
