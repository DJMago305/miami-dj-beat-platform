-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- Lista de precios: primeras cifras REALES que ya tenemos (el resto lo captura el owner/manager en la pantalla «Lista de precios»).
--   1) Paquete de sonido al aire libre (400–1,000 personas): proveedor Alfredo Machado. Cifras dichas por el PO el 2026-10-07/08 (cotización Proske).
--      Costo $2,200 (el sonidista descuenta $300 sobre $2,500). Venta $3,000 = el MÍNIMO que dice el sonidista → piso manual $3,000.
--      Utilidad $800: cubre a los ayudantes del montaje. Generador +$500 si el lugar no da los 40 amperes.
--      Techo de mercado: SIN DATO todavía (no se inventa).
--   2) Hora Loca Robot: costo ESTIMADO con el precio público de lista de Special Memories FL (robot LED $490 + cañón de CO₂ $150 = $640), SIN descuento de socio.
--      Es una estimación: se reemplaza con la cotización real cuando respondan los 8 proveedores a los que se pidió tarifa el 2026-10-09.
--      Piso = costo ÷ (1 − 40 %) = $1,067 (lo calcula la pantalla).
-- Este script lo corre el dueño de la base (SQL Editor): escribe directo en service_price_guide, que no tiene permisos para el navegador.
begin;
set local lock_timeout = '5s';

insert into public.service_price_guide as g
  (sku, costo_proveedor_usd, proveedor, margen_minimo_pct, piso_usd, techo_mercado_usd, fuente_mercado, nota, actualizado_en)
values
  ('pa_outdoor_400', 2200, 'Alfredo Machado', 40, 3000, null, null,
   'Costo $2,200 (descuento de $300 sobre $2,500). $3,000 es el mínimo que dice el sonidista; la utilidad de $800 cubre a los ayudantes. Generador +$500 si el lugar no da 40 amperes. Antes de cotizar: espacio, personas y si es ambientación o fiesta.', now()),
  ('hl_robot', 640, 'Special Memories FL (precio de lista, estimado)', 40, null, null, 'Estimado: precio público de lista, sin descuento de socio',
   'ESTIMADO: robot LED $490 + cañón de CO₂ $150. Reemplazar con la cotización real del proveedor.', now())
on conflict (sku) do update set
  costo_proveedor_usd = excluded.costo_proveedor_usd, proveedor = excluded.proveedor,
  margen_minimo_pct = excluded.margen_minimo_pct, piso_usd = excluded.piso_usd,
  techo_mercado_usd = excluded.techo_mercado_usd, fuente_mercado = excluded.fuente_mercado,
  nota = excluded.nota, actualizado_en = now();

-- Verificación: 2 filas con sus cifras
select sku, costo_proveedor_usd, proveedor, piso_usd, techo_mercado_usd from public.service_price_guide where sku in ('pa_outdoor_400', 'hl_robot') order by sku;
commit;
