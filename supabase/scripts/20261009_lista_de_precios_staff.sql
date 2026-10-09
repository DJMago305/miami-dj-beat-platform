-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- Lista de precios interna (solo staff): costo del proveedor, piso de negociación y techo de mercado por producto.
--   · Tabla service_price_guide: SIN políticas y SIN permisos para anon/authenticated → solo se toca por las 2 funciones de abajo.
--   · price_guide_list():  lectura para owner/admin/manager/seller (is_staff).
--   · price_guide_save():  escritura solo para owner/admin/manager (is_staff_management). El vendedor NO escribe.
--   · Costo = el de la guía; si no hay, el pago_dj_usd que ya tiene el catálogo (si es > 0).
--   · Piso = el que se escriba a mano; si no, costo ÷ (1 − margen mínimo %) redondeado hacia arriba. Margen mínimo por defecto 40 %.
--   · Techo de mercado: lo escribe el equipo; vacío = «sin dato» (no se inventa).
begin;
set local lock_timeout = '5s';

create table if not exists public.service_price_guide (
  sku                 text primary key,
  costo_proveedor_usd numeric(10,2) check (costo_proveedor_usd is null or costo_proveedor_usd >= 0),
  proveedor           text,
  margen_minimo_pct   numeric(5,2) not null default 40 check (margen_minimo_pct >= 0 and margen_minimo_pct < 95),
  piso_usd            numeric(10,2) check (piso_usd is null or piso_usd >= 0),
  techo_mercado_usd   numeric(10,2) check (techo_mercado_usd is null or techo_mercado_usd >= 0),
  fuente_mercado      text,
  nota                text,
  actualizado_en      timestamptz not null default now(),
  actualizado_por     uuid
);
alter table public.service_price_guide enable row level security;
revoke all on public.service_price_guide from anon, authenticated;
comment on table public.service_price_guide is 'Lista de precios interna (solo staff). Acceso únicamente por price_guide_list() y price_guide_save().';

create or replace function public.price_guide_list()
returns table (
  sku text, nombre text, categoria text, activo boolean,
  precio_cliente_usd numeric, horas_base numeric, hora_extra_usd numeric,
  costo_usd numeric, costo_origen text, proveedor text,
  margen_minimo_pct numeric, piso_usd numeric, piso_calculado boolean,
  techo_mercado_usd numeric, fuente_mercado text, nota text, actualizado_en timestamptz
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
         g.techo_mercado_usd, g.fuente_mercado, g.nota, g.actualizado_en
  from public.service_catalog c
  left join public.service_catalog_public p on p.sku = c.sku
  left join public.service_price_guide g on g.sku = c.sku
  cross join lateral (select coalesce(g.costo_proveedor_usd, nullif(c.pago_dj_usd, 0)) as costo) x
  order by 3, c.nombre;
end;
$$;

create or replace function public.price_guide_save(
  p_sku text, p_costo numeric, p_proveedor text, p_margen numeric,
  p_piso numeric, p_techo numeric, p_fuente text, p_nota text
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
    (sku, costo_proveedor_usd, proveedor, margen_minimo_pct, piso_usd, techo_mercado_usd, fuente_mercado, nota, actualizado_en, actualizado_por)
  values
    (p_sku, p_costo, nullif(btrim(p_proveedor), ''), coalesce(p_margen, 40), p_piso, p_techo, nullif(btrim(p_fuente), ''), nullif(btrim(p_nota), ''), now(), auth.uid())
  on conflict (sku) do update set
    costo_proveedor_usd = excluded.costo_proveedor_usd, proveedor = excluded.proveedor,
    margen_minimo_pct = excluded.margen_minimo_pct, piso_usd = excluded.piso_usd,
    techo_mercado_usd = excluded.techo_mercado_usd, fuente_mercado = excluded.fuente_mercado,
    nota = excluded.nota, actualizado_en = now(), actualizado_por = auth.uid();
end;
$$;

revoke all on function public.price_guide_list() from public, anon;
revoke all on function public.price_guide_save(text, numeric, text, numeric, numeric, numeric, text, text) from public, anon;
grant execute on function public.price_guide_list() to authenticated;
grant execute on function public.price_guide_save(text, numeric, text, numeric, numeric, numeric, text, text) to authenticated;

-- Verificación (solo lectura): tabla y funciones creadas, sin permisos para anon.
select
  (select count(*) from pg_class where relname = 'service_price_guide' and relnamespace = 'public'::regnamespace) as tabla,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('price_guide_list', 'price_guide_save')) as funciones,
  has_function_privilege('anon', 'public.price_guide_list()', 'execute') as anon_puede_leer,
  has_function_privilege('authenticated', 'public.price_guide_list()', 'execute') as auth_puede_ejecutar;
commit;
