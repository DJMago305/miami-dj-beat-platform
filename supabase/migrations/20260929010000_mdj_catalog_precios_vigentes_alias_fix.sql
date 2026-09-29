-- Corrige mdj_catalog_precios_vigentes (20260929000000): el join original solo
-- resolvía por el sku primario contra service_catalog_public, que no expone
-- la columna alias. Cualquier sku de página de categoría que en realidad es
-- un alias (ej. light_moving_heads, light_uplighting, fx_moving_heads,
-- fx_uplighting) resolvía silenciosamente a activo:false / precio null: el
-- fetch del navegador no fallaba, simplemente no encontraba coincidencia, y
-- la página se quedaba con el precio estático viejo sin aviso.
--
-- Fix: primero resolver contra la tabla base service_catalog (sc.sku = s.sku
-- OR s.sku = ANY(sc.alias)) para encontrar el sku canónico, luego unir contra
-- service_catalog_public por ese sku canónico. Como alias vive en la tabla
-- base protegida por RLS (no en la vista pública), la función pasa a
-- security definer con search_path fijo.
create or replace function public.mdj_catalog_precios_vigentes(p_skus text[])
returns table (
    sku text,
    nombre text,
    bucket text,
    precio_efectivo_usd numeric,
    activo boolean
)
language sql
stable
security definer
set search_path = public
as $$
    -- security definer (2026-09-29, corrección real): el sku pedido puede ser
    -- un ALIAS (ej. light_moving_heads -> moving_heads), y service_catalog_public
    -- no expone la columna alias -- hace falta leer la tabla base para resolver,
    -- que tiene RLS de solo-staff. No se expone ninguna columna nueva: el join
    -- final sigue siendo contra service_catalog_public (lectura ya pública),
    -- esto solo arregla CUÁL fila es la correcta.
    select
        s.sku,
        scp.nombre,
        scp.bucket,
        scp.precio_efectivo_usd,
        coalesce(scp.activo, false) as activo
    from unnest(p_skus) as s(sku)
    left join public.service_catalog sc
        on sc.sku = s.sku or s.sku = any(sc.alias)
    left join public.service_catalog_public scp
        on scp.sku = sc.sku;
$$;
