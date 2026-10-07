-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · SUBIR LA PARED DE ARRIBA + ESCENARIO A TAMAÑO REAL (pedido del PO 2026-10-07: «esa pared debe subir hasta darle espacio a otra hilera de mesas en el centro; se estiran los baños y la caja;
-- entra una fila contra la pared de mesas de dos sillas y una en el centro de mesas largas; el escenario crece como es de verdad: no es redondo, es un poquito redondeado y la pata de la derecha es más larga»).
-- Solo GEOMETRÍA del plano base y de la copia de cada evento NO cancelado (+ quita P01 y P02 del plano base, que quedan debajo del escenario nuevo). No cambia llaves, sillas, precios, ventas, inventario ni la sala pública.
--   1) La pared de arriba queda donde está (y = 8) y lo de abajo baja 112: se abre un espacio de 112 entre lo que va pegado a esa pared (escenario y hilera de pared) y lo que estaba debajo. Altura del plano 952 → 1064.
--      · SE ESTIRAN (siguen pegados a la pared de arriba y llegan hasta el pasillo, que baja): Caja (8 a 280) y Baños (8 a 280); las puertas de los baños bajan a su pared de abajo (y = 280).
--      · BAJAN 112: pasillo, cocina, Recepción, VIP, barra (sigue pegada a la pared del VIP: 352 a 672), terraza con T01-T12, paredes, puertas (la del salón a la Caja NO baja: queda en la parte de arriba) y las mesas
--        con x >= 100 salvo la hilera de pared P01-P08.
--      · El borde de arriba del salón sigue en y = 8; el de abajo baja a 672.
--   2) ESCENARIO: rectángulo de esquinas apenas redondeadas (ya no es un cuarto de círculo), de 288 de largo (x 8 a 296, la pata de la derecha estirada) por 152 de fondo (y 8 a 160), pegado a la esquina.
--   3) Lateral izquierdo (mesas con x < 100: L01-L04 en el plano base, X01-X03 en un evento): bajan 80 para no quedar debajo del escenario nuevo.
--   4) P01 y P02 (x = 170 y 260, y = 48) quedarían dentro del escenario nuevo: se quitan del plano base (lista y dibujo). P03-P08 se quedan.
-- Idempotente: solo toca un plano que mida 952 de alto y cuyo salón termine en y = 560.

create or replace function public.venue_tmp_subir_pared(p_layout jsonb, p_d numeric)
returns jsonb language plpgsql set search_path to 'public' as $$
declare v jsonb := p_layout; i integer; j integer; k integer; it jsonb; pt jsonb; np jsonb; yv numeric; esal boolean; keep jsonb;
begin
  if v is null or jsonb_typeof(v -> 'maps') is distinct from 'array' then return p_layout; end if;
  for i in 0 .. jsonb_array_length(v -> 'maps') - 1 loop
    if (v -> 'maps' -> i -> 'room' ->> 'h')::numeric is distinct from 952 then continue; end if;
    esal := false;
    if jsonb_typeof(v -> 'maps' -> i -> 'shapes') = 'array' then
      for j in 0 .. jsonb_array_length(v -> 'maps' -> i -> 'shapes') - 1 loop
        it := v -> 'maps' -> i -> 'shapes' -> j;
        if it ->> 'id' = 'i3s27djd' and it ->> 'k' = 'poly' and (it -> 'pts' -> 2 ->> 1)::numeric = 560 then esal := true; end if;
      end loop;
    end if;
    if not esal then continue; end if;
    v := jsonb_set(v, array['maps', i::text, 'room', 'h'], to_jsonb(952 + p_d));
    -- mesas
    if jsonb_typeof(v -> 'maps' -> i -> 'tables') = 'array' then
      for j in 0 .. jsonb_array_length(v -> 'maps' -> i -> 'tables') - 1 loop
        it := v -> 'maps' -> i -> 'tables' -> j;
        if (it ->> 'x')::numeric < 100 then
          v := jsonb_set(v, array['maps', i::text, 'tables', j::text, 'y'], to_jsonb((it ->> 'y')::numeric + 80));
        elsif it ->> 'id' !~ '^P[0-9]' then
          v := jsonb_set(v, array['maps', i::text, 'tables', j::text, 'y'], to_jsonb((it ->> 'y')::numeric + p_d));
        end if;
      end loop;
    end if;
    -- figuras
    for j in 0 .. jsonb_array_length(v -> 'maps' -> i -> 'shapes') - 1 loop
      it := v -> 'maps' -> i -> 'shapes' -> j;
      if it ->> 'k' = 'poly' and jsonb_typeof(it -> 'pts') = 'array' then
        np := '[]'::jsonb;
        for k in 0 .. jsonb_array_length(it -> 'pts') - 1 loop
          pt := it -> 'pts' -> k; yv := (pt ->> 1)::numeric;
          np := np || jsonb_build_array(jsonb_build_array(pt -> 0, to_jsonb(
                  case when it ->> 'id' = 'i3s27djd' and yv <= 8 then yv              -- el salón: arriba se queda
                       when it ->> 'id' = 'agx60n5' and yv <= 8 then yv                -- la caja: arriba se queda y abajo llega al pasillo
                       else yv + p_d end)));
        end loop;
        v := jsonb_set(v, array['maps', i::text, 'shapes', j::text, 'pts'], np);
      elsif it ->> 'k' = 'wall' then
        v := jsonb_set(v, array['maps', i::text, 'shapes', j::text, 'y1'], to_jsonb((it ->> 'y1')::numeric + p_d));
        v := jsonb_set(v, array['maps', i::text, 'shapes', j::text, 'y2'], to_jsonb((it ->> 'y2')::numeric + p_d));
      elsif it ->> 'k' = 'stage' then
        v := jsonb_set(v, array['maps', i::text, 'shapes', j::text], (it - 'shape') || '{"x": 152, "y": 84, "w": 288, "h": 152}'::jsonb);
      elsif it ->> 'id' in ('ile0h28j', 'inks6z5o') then                                -- baños: se estiran (8 a 280)
        v := jsonb_set(v, array['maps', i::text, 'shapes', j::text], it || '{"y": 144, "h": 272}'::jsonb);
      elsif it ->> 'id' = 'iv655rke' then
        null;                                                                           -- puerta del salón a la caja: se queda arriba
      elsif it ? 'y' then
        v := jsonb_set(v, array['maps', i::text, 'shapes', j::text, 'y'], to_jsonb((it ->> 'y')::numeric + p_d));
      end if;
    end loop;
    if (v -> 'maps' -> i -> 'focal' ->> 'x')::numeric = 60 and (v -> 'maps' -> i -> 'focal' ->> 'y')::numeric = 60 then
      v := jsonb_set(v, array['maps', i::text, 'focal'], '{"x": 152, "y": 84}'::jsonb);
    end if;
    -- P01 y P02 (dentro del escenario nuevo): fuera de la lista y del dibujo
    select coalesce(jsonb_agg(t order by ord), '[]'::jsonb) into keep from jsonb_array_elements(v -> 'maps' -> i -> 'tables') with ordinality as x(t, ord)
     where not (t ->> 'id' in ('P01', 'P02') and (t ->> 'y')::numeric = 48);
    v := jsonb_set(v, array['maps', i::text, 'tables'], keep);
  end loop;
  if jsonb_typeof(v -> 'tables') = 'array' then
    -- la lista de mesas pierde P01/P02 solo si ya no existen en el dibujo (así un evento sin esas mesas no se toca)
    select coalesce(jsonb_agg(t order by ord), '[]'::jsonb) into keep from jsonb_array_elements(v -> 'tables') with ordinality as x(t, ord)
     where not (t ->> 'key' in ('P01', 'P02') and not exists (select 1 from jsonb_array_elements(v -> 'maps' -> 0 -> 'tables') g where g ->> 'id' = t ->> 'key'));
    v := jsonb_set(v, '{tables}', keep);
  end if;
  return v;
end $$;

update public.venue_rooms set layout = public.venue_tmp_subir_pared(layout, 112), updated_at = now()
 where layout is not null and layout is distinct from public.venue_tmp_subir_pared(layout, 112);
update public.venue_events set layout = public.venue_tmp_subir_pared(layout, 112), updated_at = now()
 where status <> 'cancelled' and layout is not null and layout is distinct from public.venue_tmp_subir_pared(layout, 112);
drop function public.venue_tmp_subir_pared(jsonb, numeric);

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: alto=1064, salon=8-672, escenario=8-296 x 8-160, p_mesas=6 (P03-P08), x01_y=232, pared_gris_y=280, caja=8-280, banos=8-280, barra=352-672, l01_y=250, mesas=22, sin funciones temporales ──
select max((r.layout -> 'maps' -> 0 -> 'room' ->> 'h')::numeric) as alto,
       max((select (p -> 'pts' -> 0 ->> 1)::numeric || '-' || (p -> 'pts' -> 2 ->> 1)::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'SALÓN PRINCIPAL')) as salon,
       max((select ((p ->> 'x')::numeric - (p ->> 'w')::numeric / 2)::text || '-' || ((p ->> 'x')::numeric + (p ->> 'w')::numeric / 2)::text || ' x ' || ((p ->> 'y')::numeric - (p ->> 'h')::numeric / 2)::text || '-' || ((p ->> 'y')::numeric + (p ->> 'h')::numeric / 2)::text from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'k' = 'stage')) as escenario,
       max((select count(*) from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'tables') t where t ->> 'id' ~ '^P')) as p_mesas,
       max((select (t ->> 'y')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'tables') t where t ->> 'id' = 'X01')) as x01_y,
       max((select (p ->> 'y1')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'id' = 'irwjmcy0')) as pared_gris_y,
       max((select (p -> 'pts' -> 0 ->> 1)::numeric || '-' || (p -> 'pts' -> 2 ->> 1)::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'CAJA')) as caja,
       max((select ((p ->> 'y')::numeric - (p ->> 'h')::numeric / 2)::text || '-' || ((p ->> 'y')::numeric + (p ->> 'h')::numeric / 2)::text from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'id' = 'ile0h28j')) as banos,
       max((select ((p ->> 'y')::numeric - (p ->> 'h')::numeric / 2)::text || '-' || ((p ->> 'y')::numeric + (p ->> 'h')::numeric / 2)::text from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'sub' = 'barra')) as barra,
       max((select (t ->> 'y')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'tables') t where t ->> 'id' = 'L01')) as l01_y,
       max(jsonb_array_length(r.layout -> 'maps' -> 0 -> 'tables')) as mesas,
       (select count(*) from pg_proc where proname like 'venue_tmp_%') as funciones_temporales
  from public.venue_rooms r;
