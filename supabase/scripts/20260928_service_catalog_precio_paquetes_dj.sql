-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- ═══════════════════════════════════════════════════════════════════════════
-- Registro histórico: ya se aplicó directamente vía MCP (execute_sql) el
-- 2026-09-28. Resuelve el precio al cliente de los 7 paquetes de DJ
-- (`service_catalog`, bucket 'talent', sku dj_*), la pieza "pkgcliente" que
-- quedó pendiente al sembrar el catálogo (PR #554) y al resolver los 23
-- conflictos de docs/inventario-precios.md §3 (ver
-- 20260928_service_catalog_conflictos_resueltos.sql).
--
-- Regla dictada por el PO en conversación: precio al cliente = horas del
-- evento × $100/h (piso básico por DJ), equipo y extras se suman aparte
-- desde el resto del catálogo (ya resuelto). EXCEPCIÓN real encontrada en el
-- camino: Weddings, Holiday & Special Events y Seasonal Parties pagan más
-- al DJ ($1,500 / $1,500 / $900) que ese piso -- el PO confirmó que esos 3
-- se cobran más y se cotizan/negocian directo en staff/con el DJ, sin
-- precio fijo de catálogo (mismo criterio que quinceañeras, Christmas y
-- fiestas temáticas). Clubs & Nightlife y Private Parties también pagan
-- $500 al DJ (por encima del piso de $400), pero el PO confirmó que esos
-- SÍ se quedan con el piso fijo -- el equipo/extras que se suman después
-- cubren la diferencia.

begin;

-- Se cotizan/negocian directo, sin precio fijo de catálogo
update public.service_catalog set precio_cliente_usd = null, horas_base = null, hora_extra_usd = null,
  notas = 'Pago al DJ (dictado por el PO 2026-09-21). Precio al cliente 2026-09-28: sin precio fijo -- se cobra más y se cotiza directo en staff (mismo criterio que quinceañeras, días especiales/Christmas y fiestas temáticas). No lleva el piso de $100/h.'
  where sku = 'dj_weddings';

update public.service_catalog set precio_cliente_usd = null, horas_base = null, hora_extra_usd = null,
  notas = 'Pago al DJ (dictado por el PO 2026-09-21). Precio al cliente 2026-09-28: sin precio fijo -- se cobra más y se cotiza directo en staff (mismo criterio que Weddings/quinceañeras/fiestas temáticas). No lleva el piso de $100/h.'
  where sku = 'dj_holiday';

update public.service_catalog set precio_cliente_usd = null, horas_base = null, hora_extra_usd = null,
  notas = 'Pago al DJ (dictado por el PO 2026-09-21). Precio al cliente 2026-09-28: sin precio fijo -- se negocia directo con el DJ (mismo criterio que Weddings/Holiday), no lleva el piso de $100/h.'
  where sku = 'dj_seasonal_parties';

-- Piso fijo: horas del evento × $100/h, equipo/extras se suman aparte
update public.service_catalog set horas_base = 4, hora_extra_usd = 100, precio_cliente_usd = 400,
  notas = notas || ' | Precio al cliente 2026-09-28: piso $100/h x 4h = $400 (varía por venue). Equipo/extras se suman aparte del catálogo.'
  where sku = 'dj_clubs';

update public.service_catalog set horas_base = 4, hora_extra_usd = 100, precio_cliente_usd = 400,
  notas = notas || ' | Precio al cliente 2026-09-28: piso $100/h x 4h = $400. Equipo/extras se suman aparte del catálogo.'
  where sku = 'dj_private';

update public.service_catalog set horas_base = 4, hora_extra_usd = 100, precio_cliente_usd = 400,
  notas = notas || ' | Precio al cliente 2026-09-28: piso $100/h x 4h = $400. Equipo/extras se suman aparte del catálogo.'
  where sku = 'dj_family';

-- Hora extra: mismo piso, $100
update public.service_catalog set precio_cliente_usd = 100,
  notas = notas || ' | Precio al cliente 2026-09-28: $100/h, mismo piso que la hora base.'
  where sku = 'dj_extra_hour';

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación (solo lectura, ya corrida el 2026-09-28):
--   select sku, nombre, pago_dj_usd, precio_cliente_usd, horas_base
--   from public.service_catalog where sku like 'dj_%' order by sku;
-- ═══════════════════════════════════════════════════════════════════════════
