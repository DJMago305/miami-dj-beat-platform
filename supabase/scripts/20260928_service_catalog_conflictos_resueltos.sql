-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- ═══════════════════════════════════════════════════════════════════════════
-- Registro histórico: ya se aplicó directamente vía MCP (execute_sql) el
-- 2026-09-28. Este archivo documenta el cambio real, no es un pendiente por
-- correr -- el propio PO resolvió los 23 conflictos de docs/inventario-
-- precios.md §3 en conversación, sin usar el formulario de Artifact
-- (sus respuestas viven en localStorage del PO, invisibles para Claude).
--
-- Ver docs/ESTADO_MAESTRO.md y la memoria `project_service_catalog_capa_b2`
-- para el detalle completo de cada decisión.

begin;

-- 1-11: gana el precio de staff-order.html (regla general dictada por el PO)
update public.service_catalog set precio_cliente_usd = 400, notas = 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general).' where sku = 'fx_co2';
update public.service_catalog set precio_cliente_usd = 300, notas = 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general).' where sku = 'fx_sparks';
update public.service_catalog set precio_cliente_usd = 200, notas = 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general).' where sku = 'fx_confetti';
update public.service_catalog set precio_cliente_usd = 150, notas = 'Resuelto 2026-09-28 por el PO: fog y smoke son el mismo producto, gana precio de staff-order.html.' where sku = 'fx_fog';
update public.service_catalog set precio_cliente_usd = 400, notas = 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general).' where sku = 'moving_heads';
update public.service_catalog set precio_cliente_usd = 350, notas = 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general).' where sku = 'uplighting_pack';
update public.service_catalog set precio_cliente_usd = 800, notas = 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general).' where sku = 'led_video_small';
update public.service_catalog set precio_cliente_usd = 600, notas = 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general).' where sku = 'pa_large';
update public.service_catalog set precio_cliente_usd = 75,  notas = 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general).' where sku = 'wireless_mic';
update public.service_catalog set precio_cliente_usd = 100, notas = 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general).' where sku = 'dj_monitor';
update public.service_catalog set precio_cliente_usd = 600, notas = 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general).' where sku = 'live_sax';

-- Fotografía/Video: quedan separados (no se venden juntos por $800), precio de ELIXIS
update public.service_catalog set notas = 'Resuelto 2026-09-28 por el PO: sigue separado de Video (no se vende junto por $800 como en staff-order.html). Precio de ELIXIS.' where sku = 'visuals_photo';
update public.service_catalog set notas = 'Resuelto 2026-09-28 por el PO: sigue separado de Fotografía. Precio de ELIXIS.' where sku = 'visuals_video';

-- Cantante/Percusión: sin precio en staff-order.html -- gana el más caro (web)
update public.service_catalog set precio_cliente_usd = 600, notas = 'Resuelto 2026-09-28 por el PO: gana el precio más caro (web).' where sku = 'live_singer';
update public.service_catalog set precio_cliente_usd = 350, notas = 'Resuelto 2026-09-28 por el PO: gana el precio más caro (web).' where sku = 'live_percussion';

-- MC: los 2 tipos siguen existiendo (precios ya correctos, solo se limpia la nota)
update public.service_catalog set notas = 'Resuelto 2026-09-28 por el PO: siguen existiendo los 2 tipos (maestro y host), cada uno con su precio.' where sku in ('mc_maestro','mc_host');

-- Payasos: 4 productos distintos, cada uno con su propio precio (no se colapsan)
update public.service_catalog set notas = 'Resuelto 2026-09-28 por el PO: son 4 productos distintos, cada uno con su propio precio -- no se colapsan a uno solo.' where sku in ('payaso_circo','payaso_gif','payaso_santa','payaso_show');

-- Personal de evento: cada rol mantiene su propio precio (no se unifica a un precio parejo)
update public.service_catalog set notas = 'Resuelto 2026-09-28 por el PO: cada rol mantiene su propio precio -- no se unifican a un precio parejo por persona.' where sku in ('staff_bartender','staff_bartender_flair','staff_chef','staff_meseros');

-- Productos nuevos que no existían en el catálogo
insert into public.service_catalog (sku, nombre, bucket, precio_cliente_usd, notas) values
  ('fx_bubbles', 'Bubble Machine', 'equipment', 100, 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general). No existía en el catálogo, sembrado nuevo.'),
  ('water_slide', 'Water Slide', 'equipment', 350, 'Resuelto 2026-09-28 por el PO: gana precio de staff-order.html (regla general). No existía en el catálogo, sembrado nuevo.'),
  ('linens_basic', 'Linens', 'equipment', 12, 'Resuelto 2026-09-28 por el PO: producto distinto de Custom Linen Package. No existía en el catálogo, sembrado nuevo (precio de web).'),
  ('linens_custom_pkg', 'Custom Linen Package', 'equipment', 200, 'Resuelto 2026-09-28 por el PO: producto distinto de Linens básico. No existía en el catálogo, sembrado nuevo (precio de staff-order.html).'),
  ('tent_20x20', 'Tent 20x20', 'equipment', 500, 'Resuelto 2026-09-28: tamaño real de staff-order.html, distinto de las variantes clear/white de web (atributo distinto, no mismo producto). Sembrado nuevo.'),
  ('tent_20x40', 'Tent 20x40', 'equipment', 800, 'Resuelto 2026-09-28: tamaño real de staff-order.html, distinto de las variantes clear/white de web (atributo distinto, no mismo producto). Sembrado nuevo.'),
  ('tent_40x40', 'Tent 40x40', 'equipment', 1200, 'Resuelto 2026-09-28: tamaño real de staff-order.html, distinto de las variantes clear/white de web (atributo distinto, no mismo producto). Sembrado nuevo.'),
  ('hl_premium', 'Hora Loca Premium', 'talent', 1200, 'Confirmado real por el PO 2026-09-28 (panel de staff). El precio varía según cuántas personas bailan -- no es un monto fijo garantizado, queda anotado aquí hasta que se diseñe esa variable.'),
  ('hl_basic', 'Hora Loca Basic', 'talent', 800, 'Confirmado real por el PO 2026-09-28 (panel de staff). El precio varía según cuántas personas bailan -- no es un monto fijo garantizado, queda anotado aquí hasta que se diseñe esa variable.')
on conflict (sku) do nothing;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Decisión aparte, sin cambio de datos: la tarifa por hora del DJ
-- (dj_profiles.hourly_rate_usd, vacía en los 12 DJs) NO entra al precio del
-- paquete -- el precio del DJ sigue siendo el de su categoría (boda/privada/
-- club/familiar/etc.), sin importar el DJ elegido. Confirma el diseño ya
-- existente en `dj_weddings`/`dj_private`/etc., ninguna migración necesaria.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación (solo lectura, ya corrida el 2026-09-28):
--   select count(*) from public.service_catalog;  -- 61 (52 originales + 9 nuevos)
--   select * from public.service_catalog_public where sku in ('fx_bubbles','hl_premium');
-- ═══════════════════════════════════════════════════════════════════════════
