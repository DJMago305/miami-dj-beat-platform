-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- SALAS · TABURETE DE BARRA MÁS CHICO (pedido del PO 2026-10-07: «ninguna banqueta es así de grande»). Requiere 20261007_venue_taburetes_de_barra.sql ya aplicado.
-- Solo cambia dos números en dos funciones internas (misma firma): radio del taburete 18 → 13 px (queda a ~1/3 de una mesa estándar, como en la vida real)
-- y margen a la estructura 20 → 16 px (sigue pudiendo ir pegado a la barra, nunca encima). Dos taburetes ahora pueden quedar a 34 px entre centros (antes 44).
-- No mueve ni cambia ningún taburete que ya exista.

create or replace function public.venue_mesa_radio(p_t text, p_seats integer, p_w numeric default null, p_h numeric default null)
returns numeric language sql immutable set search_path to 'public' as $$
  select case p_t
    when 'stool'  then 13::numeric
    when 'square' then coalesce(p_w, 54) / 2
    when 'rect'   then greatest(coalesce(p_w, 108), coalesce(p_h, 54)) / 2
    else case when coalesce(p_seats, 4) <= 2 then 24::numeric when coalesce(p_seats, 4) <= 6 then 36::numeric else 48::numeric end end;
$$;
create or replace function public.venue_mesa_margen(p_t text, p_seats integer)
returns numeric language sql immutable set search_path to 'public' as $$
  select case p_t when 'stool' then 16::numeric when 'square' then 22::numeric when 'rect' then 22::numeric else public.venue_mesa_radio(p_t, p_seats) end;
$$;

revoke all on function public.venue_mesa_radio(text, integer, numeric, numeric) from public, anon, authenticated;
revoke all on function public.venue_mesa_margen(text, integer) from public, anon, authenticated;
notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: radios=13,24,36,48 · margen_taburete=16 · anon_alguna=false ──
select concat_ws(',', public.venue_mesa_radio('stool', 1), public.venue_mesa_radio('round', 2), public.venue_mesa_radio('round', 6), public.venue_mesa_radio('round', 10)) as radios,
       public.venue_mesa_margen('stool', 1) as margen_taburete,
       (select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('venue_mesa_radio', 'venue_mesa_margen')) as anon_alguna;
