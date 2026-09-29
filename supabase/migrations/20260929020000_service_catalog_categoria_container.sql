-- PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Aplicado directo: es aditivo (columna
-- nullable + backfill), no borra filas con impacto real ni toca RLS.
--
-- Origen: el PO señaló que "luces" y "pantallas LED" viven mezcladas como si
-- fueran una sola cosa -- en el HTML ya se separaron en dos páginas
-- (lighting-dj.html / led-screens-dj.html), pero en la base de datos NUNCA
-- existió un contenedor por categoría: service_catalog solo tenía `bucket`
-- (talent|equipment), un cajón único para TODO el equipo (luces, carpas,
-- inflables, audio, mobiliario, efectos, pantallas, escenarios).
--
-- Esta migración agrega `categoria`, poblada con las mismas categorías que
-- ya usa el frontend (category_key en rentals.js/staff-order.html), para que
-- "luces" y "pantallas" (y el resto) sean containers reales, no solo una
-- convención de nombres de archivo.
--
-- Filas de bucket='equipment' que NO se pudieron mapear con confianza a
-- ninguna página de categoría real hoy (paquetes temáticos legacy:
-- d_babyshower, d_genderreveal, d_halloween, d_kidsparty, d_nye, d_quince,
-- d_wedding) se dejan con categoria NULL a propósito -- no se adivina,
-- reportado al PO aparte.
alter table public.service_catalog
    add column if not exists categoria text null;

-- Iluminación (moving heads + uplighting; el láser todavía no tiene sku
-- propio, pendiente de confirmar costo-vs-precio con el PO antes de crearlo)
update public.service_catalog set categoria = 'lighting'
    where sku in ('moving_heads', 'uplighting_pack');

-- Carpas
update public.service_catalog set categoria = 'tents'
    where sku in ('ac_unit', 'tent_20x20', 'tent_20x40', 'tent_40x40', 'tent_clear', 'tent_white');

-- Escenarios y truss
update public.service_catalog set categoria = 'stages'
    where sku in ('stage_small', 'stage_medium', 'stage_large', 'truss_arch', 'truss_box_full', 'truss_ultra');

-- Inflables
update public.service_catalog set categoria = 'inflatables'
    where sku in ('castle_lite', 'castle_basic', 'castle_big', 'castle_combo', 'castle_waterslide', 'water_slide');

-- Mobiliario y decoración
update public.service_catalog set categoria = 'furniture'
    where sku in ('f_backdrop', 'f_chairs', 'f_cocktail', 'f_dining', 'f_floral', 'f_led', 'f_linens', 'f_tables', 'linens_basic', 'linens_custom_pkg');

-- Efectos especiales
update public.service_catalog set categoria = 'fx'
    where sku in ('fx_bubble', 'fx_bubbles', 'fx_co2', 'fx_confetti', 'fx_fog', 'fx_smoke', 'fx_snow', 'fx_sparks');

-- Audio profesional
update public.service_catalog set categoria = 'audio'
    where sku in ('audio_mixer', 'dj_monitor', 'pa_large', 'pa_medium', 'pa_small', 'sound_operator', 'wireless_mic');

-- Captura y visuales
update public.service_catalog set categoria = 'visuals'
    where sku in ('visuals_booth360', 'visuals_drone', 'visuals_magic_mirror', 'visuals_photo', 'visuals_video');

-- Pantallas LED: contenedor nuevo y separado de lighting. El renglón viejo
-- led_video_small ($800, sin ninguna referencia real en el sitio -- nunca se
-- cobró, la página siempre mostró "Custom by Size" sin sku) se retira y se
-- reemplaza por 3 tiers reales confirmados por el PO (2026-09-29): pequeña
-- $600, mediana $1200, grande $2500, "desde" -- montajes complejos de
-- estructura se cobran aparte. Se conserva como alias por si algo viejo
-- todavía lo referencia por ese nombre.
delete from public.service_catalog where sku = 'led_video_small';

insert into public.service_catalog (sku, nombre, bucket, categoria, precio_cliente_usd, alias, activo)
values
    ('led_small',  'LED Wall (Small)',  'equipment', 'led_screens', 600,  array['led_video_small'], true),
    ('led_medium', 'LED Wall (Medium)', 'equipment', 'led_screens', 1200, array[]::text[],          true),
    ('led_large',  'LED Wall (Large)',  'equipment', 'led_screens', 2500, array[]::text[],          true)
on conflict (sku) do update set
    nombre = excluded.nombre,
    categoria = excluded.categoria,
    precio_cliente_usd = excluded.precio_cliente_usd,
    alias = excluded.alias,
    activo = excluded.activo;
