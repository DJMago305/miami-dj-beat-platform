-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- ═══════════════════════════════════════════════════════════════════════════
-- Paso chico del carrito por referencia, sub-paso "usar el sku para precios en
-- vivo" (docs/plan-dinero-de-leads-dueno-servidor.md §3 B2, punto 4). El PO
-- eligió explícitamente "solo lectura, nada cambia todavía" -- esta función
-- NO se conecta a ningún carrito ni consumidor real. Es la pieza de lectura
-- que un futuro paso (comparar precio guardado vs. precio vigente) usaría,
-- construida y verificada de forma aislada primero -- mismo patrón que
-- mdj_lead_recalcular_total() (2026-09-28): construir y probar antes de
-- cablear, cablear es una decisión de diseño aparte.
--
-- Por qué una función y no una consulta directa a service_catalog_public:
-- esa vista ya es pública y de lectura libre, pero un futuro consumidor
-- necesita mandar el arreglo de skus de UN carrito y recibir de vuelta
-- exactamente esos, en el mismo orden que existen hoy en el catálogo
-- (incluyendo los que ya no existen o están inactivos, para poder detectar
-- ese caso) -- una función da un contrato estable en vez de que cada
-- consumidor repita el mismo WHERE sku = ANY(...).
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
security invoker
as $$
    select
        s.sku,
        scp.nombre,
        scp.bucket,
        scp.precio_efectivo_usd,
        coalesce(scp.activo, false) as activo
    from unnest(p_skus) as s(sku)
    left join public.service_catalog_public scp on scp.sku = s.sku;
$$;

comment on function public.mdj_catalog_precios_vigentes(text[]) is
    'Lectura pública: precio vigente de un lote de skus (service_catalog_public). '
    'activo=false o precio_efectivo_usd NULL para un sku que no aparece en el '
    'catálogo hoy (borrado/desactivado) o que está en "Call para cotización". '
    'Deliberadamente sin conectar a ningún carrito todavía -- ver '
    'docs/plan-dinero-de-leads-dueno-servidor.md §3 B2 punto 4.';

-- security invoker: hereda los permisos de quien llama, igual que
-- service_catalog_public (lectura pública ya existente) -- no se amplía
-- ningún permiso nuevo, solo se empaqueta la misma lectura en lote.
grant execute on function public.mdj_catalog_precios_vigentes(text[]) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación sugerida (solo lectura, correr después de aplicar):
--   select * from public.mdj_catalog_precios_vigentes(
--     array['dj_weddings', 'dj_clubs', 'fx_co2', 'sku_que_no_existe']
--   );
--   -- Esperado: dj_weddings con precio_efectivo_usd NULL (Call para
--   -- cotización), dj_clubs y fx_co2 con su precio real, y el sku
--   -- inventado con activo=false y todo lo demás NULL.
