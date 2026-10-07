-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · RECONFIGURAR EL SALÓN PRINCIPAL DE MOJITOS CALLE 8 (pedido del PO 2026-10-07; propuesta para que la vea ANTES de aplicarla).
-- Datos del PO: el salón lleva hileras de mesas de 4 en el medio y mesas de 2 contra las paredes; en el lateral izquierdo cabe una mesa más; falta una hilera más; las mesas redondas del VIP son chicas.
-- Cambia el PLANO BASE de la sala (no toca ventas, inventario, precios de eventos ya creados ni la sala pública). Cada evento ya creado guarda su propia copia del plano.
--
--   1) ESTIRAR: toda coordenada y >= 440 baja 120 (VIP, recepción, terraza con sus T01-T12, puertas y paredes de abajo, mesas del VIP); el salón (poly) crece de 432 a 552 de alto; la cocina se alarga
--      por abajo; la altura del plano pasa de 832 a 952. Se aplica al plano base y a la copia de cada evento NO cancelado. No se mueve nada que esté por encima de 440 (escenario, caja, baños, pasillo, barra).
--   2) REARMAR el salón en el plano base: salen las 15 mesas redondas de 6 (S01-S15) y entran 32 mesas nuevas, todas con la zona y el área «SALÓN PRINCIPAL»:
--        · P01-P08: hilera contra la pared de arriba, mesas de 2 (sillas a los lados), $160 sugerido.
--        · L01-L04: lateral izquierdo contra la pared, mesas de 2 (sillas arriba y abajo), $160 sugerido (una más que las 3 de antes).
--        · S01-S20: 4 hileras de 5 mesas de 4 en el medio (una hilera más que las 3 de antes), $300 sugerido.
--      Las redondas del VIP (V01-V05, 4 sillas) pasan a tamaño CHICO (radio 24); V06-V10 no cambian. Las posiciones cumplen las reglas del taller (nada sobre la estructura, nada encima de otra mesa).
--   Es idempotente: el paso 1 solo toca planos de altura 832; el paso 2 solo si S01 sigue en su lugar de siempre (y = 110).
-- Los eventos YA creados (como «Operación de hoy») conservan sus mesas; solo se estira el espacio. Las mesas nuevas viven en el plano base y entran en los eventos que se creen después.

create or replace function public.venue_tmp_estirar_salon(p_layout jsonb, p_y0 numeric, p_d numeric)
returns jsonb language plpgsql set search_path to 'public' as $$
declare v jsonb := p_layout; i integer; j integer; k integer; it jsonb; pt jsonb; np jsonb; yv numeric; r jsonb;
begin
  if v is null or jsonb_typeof(v -> 'maps') is distinct from 'array' then return p_layout; end if;
  for i in 0 .. jsonb_array_length(v -> 'maps') - 1 loop
    if (v -> 'maps' -> i -> 'room' ->> 'h')::numeric is distinct from 832 then continue; end if;
    v := jsonb_set(v, array['maps', i::text, 'room', 'h'], to_jsonb(832 + p_d));
    if jsonb_typeof(v -> 'maps' -> i -> 'tables') = 'array' then
      for j in 0 .. jsonb_array_length(v -> 'maps' -> i -> 'tables') - 1 loop
        yv := (v -> 'maps' -> i -> 'tables' -> j ->> 'y')::numeric;
        if yv >= p_y0 then v := jsonb_set(v, array['maps', i::text, 'tables', j::text, 'y'], to_jsonb(yv + p_d)); end if;
      end loop;
    end if;
    if jsonb_typeof(v -> 'maps' -> i -> 'fixed') = 'array' then
      for j in 0 .. jsonb_array_length(v -> 'maps' -> i -> 'fixed') - 1 loop
        r := v -> 'maps' -> i -> 'fixed' -> j -> 'r';
        if jsonb_typeof(r) = 'array' and jsonb_array_length(r) = 4 and (r ->> 1)::numeric >= p_y0 then
          v := jsonb_set(v, array['maps', i::text, 'fixed', j::text, 'r'], jsonb_build_array(r -> 0, to_jsonb((r ->> 1)::numeric + p_d), r -> 2, r -> 3));
        end if;
      end loop;
    end if;
    if jsonb_typeof(v -> 'maps' -> i -> 'shapes') = 'array' then
      for j in 0 .. jsonb_array_length(v -> 'maps' -> i -> 'shapes') - 1 loop
        it := v -> 'maps' -> i -> 'shapes' -> j;
        if it ->> 'k' = 'poly' and jsonb_typeof(it -> 'pts') = 'array' then
          np := '[]'::jsonb;
          for k in 0 .. jsonb_array_length(it -> 'pts') - 1 loop
            pt := it -> 'pts' -> k; yv := (pt ->> 1)::numeric;
            np := np || jsonb_build_array(jsonb_build_array(pt -> 0, to_jsonb(case when yv >= p_y0 then yv + p_d else yv end)));
          end loop;
          v := jsonb_set(v, array['maps', i::text, 'shapes', j::text, 'pts'], np);
        elsif it ->> 'k' = 'wall' then
          if (it ->> 'y1')::numeric >= p_y0 then v := jsonb_set(v, array['maps', i::text, 'shapes', j::text, 'y1'], to_jsonb((it ->> 'y1')::numeric + p_d)); end if;
          if (it ->> 'y2')::numeric >= p_y0 then v := jsonb_set(v, array['maps', i::text, 'shapes', j::text, 'y2'], to_jsonb((it ->> 'y2')::numeric + p_d)); end if;
        elsif it ? 'y' and (it ->> 'y')::numeric >= p_y0 then
          v := jsonb_set(v, array['maps', i::text, 'shapes', j::text, 'y'], to_jsonb((it ->> 'y')::numeric + p_d));
        end if;
      end loop;
    end if;
  end loop;
  return v;
end $$;

create or replace function public.venue_tmp_rearmar_salon(p_layout jsonb)
returns jsonb language plpgsql set search_path to 'public' as $$
declare v jsonb := p_layout; i integer; j integer; v_hay boolean := false; nuevas jsonb := '[{"key": "P01", "label": "P01", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "P02", "label": "P02", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "P03", "label": "P03", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "P04", "label": "P04", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "P05", "label": "P05", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "P06", "label": "P06", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "P07", "label": "P07", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "P08", "label": "P08", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "L01", "label": "L01", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "L02", "label": "L02", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "L03", "label": "L03", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "L04", "label": "L04", "seats": 2, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 16000}, {"key": "S01", "label": "S01", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S02", "label": "S02", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S03", "label": "S03", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S04", "label": "S04", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S05", "label": "S05", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S06", "label": "S06", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S07", "label": "S07", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S08", "label": "S08", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S09", "label": "S09", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S10", "label": "S10", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S11", "label": "S11", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S12", "label": "S12", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S13", "label": "S13", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S14", "label": "S14", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S15", "label": "S15", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S16", "label": "S16", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S17", "label": "S17", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S18", "label": "S18", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S19", "label": "S19", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}, {"key": "S20", "label": "S20", "seats": 4, "zone": "SALÓN PRINCIPAL", "area": "i3s27djd", "price_cents": 30000}]'::jsonb; geo jsonb := '[{"t": "square", "x": 170, "y": 48, "id": "P01", "seats": 2, "w": 54, "chairs": {"t": 0, "b": 0, "l": 1, "r": 1}}, {"t": "square", "x": 260, "y": 48, "id": "P02", "seats": 2, "w": 54, "chairs": {"t": 0, "b": 0, "l": 1, "r": 1}}, {"t": "square", "x": 350, "y": 48, "id": "P03", "seats": 2, "w": 54, "chairs": {"t": 0, "b": 0, "l": 1, "r": 1}}, {"t": "square", "x": 440, "y": 48, "id": "P04", "seats": 2, "w": 54, "chairs": {"t": 0, "b": 0, "l": 1, "r": 1}}, {"t": "square", "x": 530, "y": 48, "id": "P05", "seats": 2, "w": 54, "chairs": {"t": 0, "b": 0, "l": 1, "r": 1}}, {"t": "square", "x": 620, "y": 48, "id": "P06", "seats": 2, "w": 54, "chairs": {"t": 0, "b": 0, "l": 1, "r": 1}}, {"t": "square", "x": 710, "y": 48, "id": "P07", "seats": 2, "w": 54, "chairs": {"t": 0, "b": 0, "l": 1, "r": 1}}, {"t": "square", "x": 800, "y": 48, "id": "P08", "seats": 2, "w": 54, "chairs": {"t": 0, "b": 0, "l": 1, "r": 1}}, {"t": "square", "x": 52, "y": 170, "id": "L01", "seats": 2, "w": 54, "chairs": {"t": 1, "b": 1, "l": 0, "r": 0}}, {"t": "square", "x": 52, "y": 265, "id": "L02", "seats": 2, "w": 54, "chairs": {"t": 1, "b": 1, "l": 0, "r": 0}}, {"t": "square", "x": 52, "y": 360, "id": "L03", "seats": 2, "w": 54, "chairs": {"t": 1, "b": 1, "l": 0, "r": 0}}, {"t": "square", "x": 52, "y": 455, "id": "L04", "seats": 2, "w": 54, "chairs": {"t": 1, "b": 1, "l": 0, "r": 0}}, {"t": "round", "x": 210, "y": 150, "id": "S01", "seats": 4}, {"t": "round", "x": 320, "y": 150, "id": "S02", "seats": 4}, {"t": "round", "x": 430, "y": 150, "id": "S03", "seats": 4}, {"t": "round", "x": 540, "y": 150, "id": "S04", "seats": 4}, {"t": "round", "x": 650, "y": 150, "id": "S05", "seats": 4}, {"t": "round", "x": 210, "y": 262, "id": "S06", "seats": 4}, {"t": "round", "x": 320, "y": 262, "id": "S07", "seats": 4}, {"t": "round", "x": 430, "y": 262, "id": "S08", "seats": 4}, {"t": "round", "x": 540, "y": 262, "id": "S09", "seats": 4}, {"t": "round", "x": 650, "y": 262, "id": "S10", "seats": 4}, {"t": "round", "x": 210, "y": 374, "id": "S11", "seats": 4}, {"t": "round", "x": 320, "y": 374, "id": "S12", "seats": 4}, {"t": "round", "x": 430, "y": 374, "id": "S13", "seats": 4}, {"t": "round", "x": 540, "y": 374, "id": "S14", "seats": 4}, {"t": "round", "x": 650, "y": 374, "id": "S15", "seats": 4}, {"t": "round", "x": 210, "y": 486, "id": "S16", "seats": 4}, {"t": "round", "x": 320, "y": 486, "id": "S17", "seats": 4}, {"t": "round", "x": 430, "y": 486, "id": "S18", "seats": 4}, {"t": "round", "x": 540, "y": 486, "id": "S19", "seats": 4}, {"t": "round", "x": 650, "y": 486, "id": "S20", "seats": 4}]'::jsonb; keep_t jsonb; keep_g jsonb; g jsonb;
begin
  if v is null or jsonb_typeof(v -> 'maps') is distinct from 'array' or jsonb_typeof(v -> 'tables') is distinct from 'array' then return p_layout; end if;
  for i in 0 .. jsonb_array_length(v -> 'maps') - 1 loop
    if jsonb_typeof(v -> 'maps' -> i -> 'tables') = 'array' then
      for j in 0 .. jsonb_array_length(v -> 'maps' -> i -> 'tables') - 1 loop
        if v -> 'maps' -> i -> 'tables' -> j ->> 'id' = 'S01' and (v -> 'maps' -> i -> 'tables' -> j ->> 'y')::numeric = 110 then v_hay := true; end if;
      end loop;
    end if;
  end loop;
  if not v_hay then return p_layout; end if;
  -- fuera las mesas S01-S15 de siempre (lista y dibujo); dentro las nuevas; las redondas del VIP (V01-V05) pasan a radio 24
  select coalesce(jsonb_agg(t order by ord), '[]'::jsonb) into keep_t from jsonb_array_elements(v -> 'tables') with ordinality as x(t, ord) where t ->> 'key' !~ '^S[0-9]+$';
  v := jsonb_set(v, '{tables}', keep_t || nuevas);
  for i in 0 .. jsonb_array_length(v -> 'maps') - 1 loop
    if jsonb_typeof(v -> 'maps' -> i -> 'tables') = 'array' then
      select coalesce(jsonb_agg(case when t ->> 'id' ~ '^V0[1-5]$' and t ->> 't' = 'round' then t || '{"r":24}'::jsonb else t end order by ord), '[]'::jsonb) into keep_g
        from jsonb_array_elements(v -> 'maps' -> i -> 'tables') with ordinality as x(t, ord) where t ->> 'id' !~ '^S[0-9]+$';
      v := jsonb_set(v, array['maps', i::text, 'tables'], keep_g || geo);
    end if;
  end loop;
  return v;
end $$;

update public.venue_rooms set layout = public.venue_tmp_estirar_salon(layout, 440, 120), updated_at = now()
 where layout is not null and (layout -> 'maps' -> 0 -> 'room' ->> 'h')::numeric = 832;
update public.venue_events set layout = public.venue_tmp_estirar_salon(layout, 440, 120), updated_at = now()
 where status <> 'cancelled' and layout is not null and (layout -> 'maps' -> 0 -> 'room' ->> 'h')::numeric = 832;
update public.venue_rooms set layout = public.venue_tmp_rearmar_salon(layout), updated_at = now()
 where layout is not null and layout is distinct from public.venue_tmp_rearmar_salon(layout);
drop function public.venue_tmp_estirar_salon(jsonb, numeric, numeric);
drop function public.venue_tmp_rearmar_salon(jsonb);

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: alto=952, salon_abajo=560, vip_arriba=560, terraza_arriba=760, v01_y=630, t01_y=825, escenario_y=52, barra_y=340, mesas=42 (8 P + 4 L + 20 S + 10 V), mesas_p=8, mesas_l=4, mesas_s=20, v01_radio=24 ──
select max((r.layout -> 'maps' -> 0 -> 'room' ->> 'h')::numeric) as alto,
       max((select (p -> 'pts' -> 2 ->> 1)::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'SALÓN PRINCIPAL')) as salon_abajo,
       max((select (p -> 'pts' -> 0 ->> 1)::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'VIP')) as vip_arriba,
       max((select (p -> 'pts' -> 0 ->> 1)::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'TERRAZA')) as terraza_arriba,
       max((select (t ->> 'y')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'tables') t where t ->> 'id' = 'V01')) as v01_y,
       max((select (p ->> 'y')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'T01')) as t01_y,
       max((select (p ->> 'y')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'ESCENARIO')) as escenario_y,
       max((select (p ->> 'y')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') p where p ->> 'label' = 'BARRA')) as barra_y,
       max(jsonb_array_length(r.layout -> 'tables')) as mesas,
       max((select count(*) from jsonb_array_elements(r.layout -> 'tables') t where t ->> 'key' ~ '^P')) as mesas_p,
       max((select count(*) from jsonb_array_elements(r.layout -> 'tables') t where t ->> 'key' ~ '^L')) as mesas_l,
       max((select count(*) from jsonb_array_elements(r.layout -> 'tables') t where t ->> 'key' ~ '^S')) as mesas_s,
       max((select (t ->> 'r')::numeric from jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'tables') t where t ->> 'id' = 'V01')) as v01_radio
  from public.venue_rooms r;
