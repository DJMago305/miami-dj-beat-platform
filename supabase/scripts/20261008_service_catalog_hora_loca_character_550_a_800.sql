-- ═════════════════════════════════════════════════════════════════
-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- ═════════════════════════════════════════════════════════════════
-- Hora Loca Character: $550 → $800 (orden del PO 2026-10-08: «no creo que 550 exista alguna hora loca»; lo confirmado por el PO el 2026-09-28
-- es Basic $800 y Premium $1,200). Alinea el catálogo con las páginas hora-loca.html y la ficha de Google, que ya dicen $800.
--
-- Solo toca UNA fila de public.service_catalog (sku = 'hl_character'). Robot ($650) y Hadas ($750) NO se tocan: siguen pendientes de la decisión del PO.
-- No recalcula nada hacia atrás: los totales de los leads existentes quedan congelados desde el primer pago; este precio rige para cotizaciones nuevas.
-- Idempotente: si ya está en 800 no hace nada (el UPDATE solo corre cuando el precio actual es 550).
--
-- Fotografía ($350), Videografía ($500), Cabina 360 ($450), Dron ($250) y Magic Mirror ($350) YA están así en el catálogo: no hace falta SQL para Captura y Visuales.
begin;

update public.service_catalog
   set precio_cliente_usd = 800,
       notas = 'Corregido 2026-10-08 por el PO: el precio de $550 no existe para ninguna Hora Loca; el mínimo confirmado es $800 (Basic). Antes: 550.'
 where sku = 'hl_character'
   and precio_cliente_usd = 550;

commit;

-- Verificación (corre aparte): debe devolver 800 y la nota nueva.
-- select sku, nombre, precio_cliente_usd, notas from public.service_catalog where sku in ('hl_character','hl_robot','hl_hadas','hl_basic','hl_cubana','hl_brasil','hl_premium') order by precio_cliente_usd;
