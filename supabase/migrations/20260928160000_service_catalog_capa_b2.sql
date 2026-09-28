-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) — correr en el SQL Editor
-- (el clasificador de esta sesión bloquea aplicar migraciones vía MCP; el PO
-- corre el SQL directamente, mismo patrón que el resto de esta sesión).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Catálogo de precios (Capa B2, primer paso) -- docs/plan-dinero-de-leads-dueno-servidor.md §3,
-- docs/inventario-precios.md §6. Objetivo final: que el servidor recalcule el
-- total de un lead desde UN catálogo, no desde lo que arma el navegador.
--
-- ESTE PASO es solo la tabla + la vista pública -- la pieza que NO depende de
-- que el PO resuelva los conflictos de precio. `mdj_lead_recalcular_total()`
-- y la migración del carrito a "por referencia" (selected_services -> sku+qty)
-- quedan para después, cuando: (a) el PO pegue la respuesta del formulario de
-- conflictos de precio, y (b) se diseñe con cuidado el carrito por referencia
-- (toca la cotización real, riesgo alto de regresión -- ver plan §3 B2).
--
-- Sembrado desde supabase/functions/_shared/event-quote-catalog.ts
-- (CATALOG_FALLBACK, la fuente canónica que ELIXIS ya usa para cobrar hoy) +
-- 3 ítems de mobiliario que solo viven en web/js/rentals.js (ac_unit,
-- f_chairs, f_cocktail). NINGÚN precio nuevo se inventa aquí -- son los
-- mismos números que ya están en producción hoy, solo que ahora en una tabla
-- real en vez de repetidos a mano en varios archivos.
--
-- Separación pago_dj_usd / precio_cliente_usd (decisión del PO 2026-09-21,
-- plan §10): los 7 SKU de tipo "dj_*" en CATALOG_FALLBACK son en realidad lo
-- que se le PAGA al DJ, no el precio al cliente -- quedan sembrados como
-- pago_dj_usd, con precio_cliente_usd en NULL ("Call para cotización") hasta
-- que el PO diga el precio del paquete completo (formulario de conflictos,
-- fila "pkgcliente").
--
-- 8 ítems marcados "sin conflicto" (coinciden en ELIXIS/web/staff hoy):
-- pa_small, pa_medium, stage_small, stage_medium, truss_box_full, ac_unit,
-- f_chairs, f_cocktail. El resto queda con el precio que ELIXIS ya cobra hoy,
-- marcado en `notas` como pendiente de la decisión del PO (docs/inventario-precios.md §3).

create table if not exists public.service_catalog (
  sku text primary key,
  nombre text not null,
  bucket text not null check (bucket in ('talent', 'equipment')),
  precio_cliente_usd numeric null,
  pago_dj_usd numeric null,
  horas_base numeric null,
  hora_extra_usd numeric null,
  activo boolean not null default true,
  alias text[] not null default '{}',
  notas text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.service_catalog is
  'Catálogo único de precios (Capa B2). Reemplaza a CATALOG_FALLBACK (event-quote-catalog.ts) como lista maestra -- ese archivo sigue siendo el fallback si esta tabla no responde. precio_cliente_usd/pago_dj_usd en NULL = sin decidir, se publica "Call para cotización".';
comment on column public.service_catalog.alias is
  'Otros ids históricos usados por otros canales para el mismo producto (ver docs/inventario-precios.md §4) -- para cuando se unifiquen los consumidores.';

alter table public.service_catalog enable row level security;

drop policy if exists service_catalog_public_read on public.service_catalog;
create policy service_catalog_public_read on public.service_catalog
  for select to anon, authenticated using (true);

drop policy if exists service_catalog_owner_write on public.service_catalog;
create policy service_catalog_owner_write on public.service_catalog
  for all to authenticated
  using (exists (select 1 from public.dj_profiles d where d.user_id = auth.uid() and lower(trim(coalesce(d.role, ''))) in ('owner', 'admin')))
  with check (exists (select 1 from public.dj_profiles d where d.user_id = auth.uid() and lower(trim(coalesce(d.role, ''))) in ('owner', 'admin')));

insert into public.service_catalog (sku, nombre, bucket, precio_cliente_usd, pago_dj_usd, horas_base, hora_extra_usd, activo, alias, notas) values
  ('dj_weddings', 'Weddings & Corporate', 'talent', null, 1500, 5, 100, true, '{}', 'Pago al DJ (dictado por el PO 2026-09-21). Precio al cliente del paquete completo: pendiente (formulario de conflictos, fila ''pkgcliente'').'),
  ('dj_private', 'Private Parties', 'talent', null, 500, 4, 100, true, '{}', 'Pago al DJ (dictado por el PO 2026-09-21). Precio al cliente del paquete completo: pendiente (formulario de conflictos, fila ''pkgcliente'').'),
  ('dj_clubs', 'Clubs & Nightlife', 'talent', null, 500, 4, 100, true, '{}', 'Pago al DJ (dictado por el PO 2026-09-21). Precio al cliente del paquete completo: pendiente (formulario de conflictos, fila ''pkgcliente'').'),
  ('dj_family', 'Family Events', 'talent', null, 350, 4, 100, true, '{}', 'Pago al DJ (dictado por el PO 2026-09-21). Precio al cliente del paquete completo: pendiente (formulario de conflictos, fila ''pkgcliente'').'),
  ('dj_seasonal_parties', 'Seasonal Parties', 'talent', null, 900, null, 100, true, '{}', 'Pago al DJ (dictado por el PO 2026-09-21). Precio al cliente del paquete completo: pendiente (formulario de conflictos, fila ''pkgcliente'').'),
  ('dj_holiday', 'Holiday & Special Events', 'talent', null, 1500, 5, 100, true, '{}', 'Pago al DJ (dictado por el PO 2026-09-21). Precio al cliente del paquete completo: pendiente (formulario de conflictos, fila ''pkgcliente'').'),
  ('dj_extra_hour', 'Hora extra DJ', 'talent', null, 100, null, null, true, '{}', 'Pago al DJ (dictado por el PO 2026-09-21). Precio al cliente del paquete completo: pendiente (formulario de conflictos, fila ''pkgcliente'').'),
  ('live_sax', 'Live Saxophone', 'talent', 400, null, null, null, true, array['mus_sax']::text[], 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('live_percussion', 'Live Percussion', 'talent', 300, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('live_singer', 'Live Singer', 'talent', 500, null, null, null, true, array['mus_singer']::text[], 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('mc_maestro', 'Maestro de Ceremonias', 'talent', 450, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('mc_host', 'Club Host', 'talent', 350, null, null, null, true, array['mc_club_host']::text[], 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('hl_robot', 'Hora Loca Robot', 'talent', 650, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('hl_brasil', 'Hora Loca Brasil', 'talent', 850, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('hl_cubana', 'Hora Loca Cubana', 'talent', 800, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('hl_character', 'Hora Loca Character', 'talent', 550, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('hl_hadas', 'Hora Loca Hadas', 'talent', 750, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('staff_bartender', 'Bartender Pro', 'talent', 250, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('staff_bartender_flair', 'Flair Bartender (Show)', 'talent', 1200, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('staff_meseros', 'Mesero / Waiter', 'talent', 200, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('staff_chef', 'Chef / Catering', 'talent', 400, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('payaso_gif', 'GIF / Energy', 'talent', 250, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('payaso_show', 'Clown Show', 'talent', 350, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('payaso_circo', 'Circus Acts', 'talent', 450, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('payaso_santa', 'Santa & Seasonal', 'talent', 300, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('visuals_photo', 'Photography', 'equipment', 350, null, null, null, true, array['vis_photo']::text[], 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('visuals_video', 'Videography', 'equipment', 500, null, null, null, true, array['vis_video']::text[], 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('visuals_drone', 'Drone Coverage', 'equipment', 250, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('visuals_booth360', '360 Photo Booth', 'equipment', 450, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('visuals_magic_mirror', 'Magic Mirror', 'equipment', 350, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('fx_sparks', 'Cold Sparks (x2)', 'equipment', 250, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('fx_fog', 'Fog Machine', 'equipment', 60, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('fx_co2', 'CO2 Jets (x2)', 'equipment', 300, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('fx_confetti', 'Confetti Cannon', 'equipment', 120, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('moving_heads', 'Moving Heads', 'equipment', 150, null, null, null, true, array['light_moving_heads', 'fx_moving_heads']::text[], 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('led_video_small', 'LED Wall (Small)', 'equipment', 500, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('uplighting_pack', 'Uplighting Pack', 'equipment', 200, null, null, null, true, array['light_uplighting', 'fx_uplighting']::text[], 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('stage_small', 'Small DJ Stage', 'equipment', 300, null, null, null, true, '{}', 'Coincide en los 3 canales (ELIXIS/web/staff) -- sin conflicto.'),
  ('stage_medium', 'Medium Event Stage', 'equipment', 600, null, null, null, true, '{}', 'Coincide en los 3 canales (ELIXIS/web/staff) -- sin conflicto.'),
  ('stage_large', 'Large Concert Stage', 'equipment', 1200, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('truss_arch', 'Goal Post Truss', 'equipment', 350, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('truss_box_full', 'Full Box Truss', 'equipment', 1800, null, null, null, true, '{}', 'Coincide en los 3 canales (ELIXIS/web/staff) -- sin conflicto.'),
  ('truss_ultra', 'Ultra Truss System', 'equipment', 3500, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('pa_small', 'Small PA System', 'equipment', 150, null, null, null, true, '{}', 'Coincide en los 3 canales (ELIXIS/web/staff) -- sin conflicto.'),
  ('pa_medium', 'Medium PA System', 'equipment', 350, null, null, null, true, '{}', 'Coincide en los 3 canales (ELIXIS/web/staff) -- sin conflicto.'),
  ('pa_large', 'Large PA System', 'equipment', 750, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('wireless_mic', 'Wireless Mic', 'equipment', 65, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('dj_monitor', 'DJ Monitor', 'equipment', 95, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('audio_mixer', 'Audio Mixer', 'equipment', 120, null, null, null, true, '{}', 'Precio de hoy (ELIXIS) sin cambios -- en el formulario de conflictos de precio, pendiente de la decision del PO.'),
  ('ac_unit', 'Portable A/C Unit', 'equipment', 250, null, null, null, true, '{}', 'Coincide en los 3 canales (ELIXIS/web/staff) -- sin conflicto.'),
  ('f_chairs', 'Premium Seating', 'equipment', 6, null, null, null, true, '{}', 'Coincide en los 3 canales (ELIXIS/web/staff) -- sin conflicto.'),
  ('f_cocktail', 'High-Top Cocktail Tables', 'equipment', 20, null, null, null, true, '{}', 'Coincide en los 3 canales (ELIXIS/web/staff) -- sin conflicto.')
on conflict (sku) do nothing;

-- Vista pública: precio efectivo = overlay platform_settings.rentals_catalog_prices (si existe
-- una entrada para ese sku) ?? precio_cliente_usd del catálogo. Mismo criterio que ya usa
-- mergeCatalog() en event-quote-catalog.ts -- no se inventa un mecanismo nuevo de overlay.
create or replace view public.service_catalog_public as
select
  sc.sku,
  sc.nombre,
  sc.bucket,
  coalesce(
    (select (ps.value::jsonb ->> sc.sku)::numeric
       from public.platform_settings ps
      where ps.key = 'rentals_catalog_prices'),
    sc.precio_cliente_usd
  ) as precio_efectivo_usd,
  sc.horas_base,
  sc.hora_extra_usd,
  sc.activo
from public.service_catalog sc
where sc.activo = true;

comment on view public.service_catalog_public is
  'Lo que debe leer cualquier página/carrito público. precio_efectivo_usd en NULL = "Call para cotización".';

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación sugerida (solo lectura, correr después de aplicar):
--   select sku, nombre, precio_cliente_usd, pago_dj_usd, notas from public.service_catalog order by bucket, sku;
--   select * from public.service_catalog_public where sku = 'pa_small';  -- debe dar 150
--
-- Pendiente explícito, NO hecho en esta migración (a propósito):
--   1. mdj_lead_recalcular_total(lead_id) -- espera la respuesta del formulario de
--      conflictos de precio (los SKU dj_* siguen sin precio_cliente_usd) y el
--      diseño del carrito por referencia (riesgo alto, plan §3 B2).
--   2. Migrar consumidores (staff-order.html, mdj-event-builder.js, páginas de
--      categoría, event_quote_record) a leer de esta tabla -- por ahora nadie
--      la consume todavía, así que esta migración no cambia ningún precio real
--      que se le cobre a nadie hoy.
-- ═══════════════════════════════════════════════════════════════════════════
