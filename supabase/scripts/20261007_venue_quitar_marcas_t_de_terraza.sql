-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · QUITAR LOS CUADROS DE MARCA T01-T12 DE LA TERRAZA (pedido del PO 2026-10-07: «en la terraza, por debajo de las mesas, nunca se quitaron los cuadros de marca como si existieran mesas; corrígelo»).
-- Contexto: en «Operación de hoy» el PO puso mesas reales en la terraza (X36-X49) y debajo quedaron los 12 cuadros grises T01-T12 de la plantilla (eran figuras de dibujo, no mesas: no tienen inventario ni venta).
-- Qué hace: en cada evento NO cancelado cuyo plano YA tiene mesas reales en la terraza (alguna mesa con y > 880), borra SOLO esas figuras: forma «shape» rectangular gris de 54 x 54 con rótulo T + número.
-- NO toca: la plantilla de la sala (ahí la terraza todavía no tiene mesas reales y esas marcas son lo único que dibuja), eventos cancelados, el resto de figuras (paredes, puertas, la zona TERRAZA), mesas, precios, ventas ni inventario.
-- Idempotente: volver a correrlo no cambia nada.

create or replace function public.venue_tmp_quitar_marcas_terraza(p_layout jsonb)
returns jsonb language plpgsql set search_path to 'public' as $$
declare v jsonb := p_layout; i integer; keep jsonb; hay boolean;
begin
  if v is null or jsonb_typeof(v -> 'maps') is distinct from 'array' then return p_layout; end if;
  for i in 0 .. jsonb_array_length(v -> 'maps') - 1 loop
    if jsonb_typeof(v -> 'maps' -> i -> 'shapes') is distinct from 'array' or jsonb_typeof(v -> 'maps' -> i -> 'tables') is distinct from 'array' then continue; end if;
    select exists (select 1 from jsonb_array_elements(v -> 'maps' -> i -> 'tables') t where coalesce((t ->> 'y')::numeric, 0) > 880) into hay;
    if not hay then continue; end if;
    select coalesce(jsonb_agg(s order by ord), '[]'::jsonb) into keep
      from jsonb_array_elements(v -> 'maps' -> i -> 'shapes') with ordinality as x(s, ord)
     where not (s ->> 'k' = 'shape' and coalesce(s ->> 'sub', 'rect') = 'rect' and coalesce(s ->> 'label', '') ~ '^T[0-9]{1,3}$'
                and (s ->> 'relleno') is not distinct from 'gris' and (s ->> 'w')::numeric = 54 and (s ->> 'h')::numeric = 54);
    v := jsonb_set(v, array['maps', i::text, 'shapes'], keep);
  end loop;
  return v;
end $$;

update public.venue_events set layout = public.venue_tmp_quitar_marcas_terraza(layout), updated_at = now()
 where status <> 'cancelled' and layout is not null and layout is distinct from public.venue_tmp_quitar_marcas_terraza(layout);
drop function public.venue_tmp_quitar_marcas_terraza(jsonb);

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: evento_marcas_t=0, evento_mesas_terraza=14, evento_mesas=60, plantilla_marcas_t=12 (no se toca), cancelados_con_marcas>=0 (no se tocan), funciones_temporales=0 ──
select (select count(*) from public.venue_events e, jsonb_array_elements(e.layout -> 'maps' -> 0 -> 'shapes') s where e.status <> 'cancelled' and s ->> 'label' ~ '^T[0-9]{1,3}$') as evento_marcas_t,
       (select count(*) from public.venue_events e, jsonb_array_elements(e.layout -> 'maps' -> 0 -> 'tables') t where e.status = 'operation' and (t ->> 'y')::numeric > 880) as evento_mesas_terraza,
       (select jsonb_array_length(e.layout -> 'maps' -> 0 -> 'tables') from public.venue_events e where e.status = 'operation') as evento_mesas,
       (select count(*) from public.venue_rooms r, jsonb_array_elements(r.layout -> 'maps' -> 0 -> 'shapes') s where s ->> 'label' ~ '^T[0-9]{1,3}$') as plantilla_marcas_t,
       (select count(*) from public.venue_events e, jsonb_array_elements(e.layout -> 'maps' -> 0 -> 'shapes') s where e.status = 'cancelled' and s ->> 'label' ~ '^T[0-9]{1,3}$') as cancelados_con_marcas,
       (select count(*) from pg_proc where proname like 'venue_tmp_%') as funciones_temporales;
