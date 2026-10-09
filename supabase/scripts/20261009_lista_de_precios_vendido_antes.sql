-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- Lista de precios: referencia de «a cuánto se vendió antes» cada producto (pedido del PO 2026-10-09).
--   · 2 columnas nuevas en service_price_guide: vendido_antes_usd (cifra) y vendido_antes_nota (dónde/cuándo, texto libre).
--   · price_guide_list() devuelve también esas 2; price_guide_save() recibe 2 parámetros más.
--   · Se reemplazan las dos funciones (cambia la forma de lo que devuelven/reciben). Los permisos quedan igual:
--     lectura owner/admin/manager/seller · escritura solo owner/admin/manager · anon sin acceso.
begin;
set local lock_timeout = '5s';

alter table public.service_price_guide
  add column if not exists vendido_antes_usd  numeric(10,2) check (vendido_antes_usd is null or vendido_antes_usd >= 0),
  add column if not exists vendido_antes_nota text;

drop function if exists public.price_guide_list();
drop function if exists public.price_guide_save(text, numeric, text, numeric, numeric, numeric, text, text);

create function public.price_guide_list()
returns table (
  sku text, nombre text, categoria text, activo boolean,
  precio_cliente_usd numeric, horas_base numeric, hora_extra_usd numeric,
  costo_usd numeric, costo_origen text, proveedor text,
  margen_minimo_pct numeric, piso_usd numeric, piso_calculado boolean,
  techo_mercado_usd numeric, fuente_mercado text, nota text, actualizado_en timestamptz,
  vendido_antes_usd numeric, vendido_antes_nota text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then
    raise exception 'forbidden: la lista de precios es solo para staff';
  end if;
  return query
  select c.sku, c.nombre,
         coalesce(c.categoria, case when c.bucket = 'talent' then 'talent' else 'packages' end) as categoria,
         c.activo,
         coalesce(p.precio_efectivo_usd, c.precio_cliente_usd) as precio_cliente_usd,
         c.horas_base, c.hora_extra_usd,
         x.costo,
         case when g.costo_proveedor_usd is not null then 'guia' when c.pago_dj_usd > 0 then 'catalogo' end as costo_origen,
         g.proveedor,
         coalesce(g.margen_minimo_pct, 40) as margen_minimo_pct,
         case when g.piso_usd is not null then g.piso_usd
              when x.costo is not null then ceil(x.costo / (1 - coalesce(g.margen_minimo_pct, 40) / 100.0)) end as piso_usd,
         (g.piso_usd is null and x.costo is not null) as piso_calculado,
         g.techo_mercado_usd, g.fuente_mercado, g.nota, g.actualizado_en,
         g.vendido_antes_usd, g.vendido_antes_nota
  from public.service_catalog c
  left join public.service_catalog_public p on p.sku = c.sku
  left join public.service_price_guide g on g.sku = c.sku
  cross join lateral (select coalesce(g.costo_proveedor_usd, nullif(c.pago_dj_usd, 0)) as costo) x
  order by 3, c.nombre;
end;
$$;

create function public.price_guide_save(
  p_sku text, p_costo numeric, p_proveedor text, p_margen numeric,
  p_piso numeric, p_techo numeric, p_fuente text, p_nota text,
  p_vendido numeric, p_vendido_nota text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_staff_management(auth.uid()) then
    raise exception 'forbidden: solo owner, admin o manager pueden editar la lista de precios';
  end if;
  if not exists (select 1 from public.service_catalog where sku = p_sku) then
    raise exception 'sku inexistente en el catálogo: %', p_sku;
  end if;
  insert into public.service_price_guide as g
    (sku, costo_proveedor_usd, proveedor, margen_minimo_pct, piso_usd, techo_mercado_usd, fuente_mercado, nota,
     vendido_antes_usd, vendido_antes_nota, actualizado_en, actualizado_por)
  values
    (p_sku, p_costo, nullif(btrim(p_proveedor), ''), coalesce(p_margen, 40), p_piso, p_techo, nullif(btrim(p_fuente), ''), nullif(btrim(p_nota), ''),
     p_vendido, nullif(btrim(p_vendido_nota), ''), now(), auth.uid())
  on conflict (sku) do update set
    costo_proveedor_usd = excluded.costo_proveedor_usd, proveedor = excluded.proveedor,
    margen_minimo_pct = excluded.margen_minimo_pct, piso_usd = excluded.piso_usd,
    techo_mercado_usd = excluded.techo_mercado_usd, fuente_mercado = excluded.fuente_mercado,
    nota = excluded.nota, vendido_antes_usd = excluded.vendido_antes_usd, vendido_antes_nota = excluded.vendido_antes_nota,
    actualizado_en = now(), actualizado_por = auth.uid();
end;
$$;

revoke all on function public.price_guide_list() from public, anon;
revoke all on function public.price_guide_save(text, numeric, text, numeric, numeric, numeric, text, text, numeric, text) from public, anon;
grant execute on function public.price_guide_list() to authenticated;
grant execute on function public.price_guide_save(text, numeric, text, numeric, numeric, numeric, text, text, numeric, text) to authenticated;

-- Verificación: columnas nuevas 2, funciones 2, anon sin acceso
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'service_price_guide' and column_name in ('vendido_antes_usd', 'vendido_antes_nota')) as columnas_nuevas,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('price_guide_list', 'price_guide_save')) as funciones,
  has_function_privilege('anon', 'public.price_guide_list()', 'execute') as anon_puede_leer;
commit;
