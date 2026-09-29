-- PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Nuevo sku real, aditivo.
--
-- Láser Chauvet Scorpion Storm RGX -- el PO tiene 2 unidades en storage y
-- puede subcontratar más si hace falta. Precio confirmado explícitamente por
-- el PO (2026-09-29): $150/unidad, precio AL CLIENTE (no costo de
-- subcontratista). Se renta por unidad, mismo patrón que Moving Heads.
insert into public.service_catalog (sku, nombre, bucket, categoria, precio_cliente_usd, alias, activo)
values ('light_laser', 'Laser Light (Chauvet Scorpion Storm RGX)', 'equipment', 'lighting', 150, array[]::text[], true)
on conflict (sku) do update set
    nombre = excluded.nombre,
    categoria = excluded.categoria,
    precio_cliente_usd = excluded.precio_cliente_usd,
    activo = excluded.activo;
