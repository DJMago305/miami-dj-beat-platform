-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- CATÁLOGO · NUEVO SKU pa_outdoor_400 «Outdoor Large Event Sound Package (400+ Guests)» (orden del PO 2026-10-07, relevada por GEO·SEO·IA; página web/pro-audio-dj.html).
-- Alta del paquete de sonido al aire libre para más de 400 personas: precio al cliente $3,000 (sonido completo con operador, montaje y desmontaje). Es un paquete NUEVO: no cambia ningún SKU ni precio existente.
-- La página (data-sku + data-price) toma el precio en vivo de esta fila vía mdj_catalog_precios_vigentes (service_catalog_public): si la fila no existe, la página muestra el precio fijo del HTML ($3,000) y el carrito lo usa igual.
-- Aquí va SOLO el precio de venta al cliente. El costo del proveedor y la utilidad NO se guardan en esta fila ni en el sitio (decisión del PO: interno, no publicar nunca).
-- Idempotente: si el SKU ya existe no lo toca (si el PO cambia el precio después desde staff, no se pisa).

insert into public.service_catalog (sku, nombre, bucket, precio_cliente_usd, activo, alias, notas, categoria)
values ('pa_outdoor_400', 'Outdoor Large Event Sound Package (400+ Guests)', 'equipment', 3000, true, '{}'::text[],
        'Alta 2026-10-08 por orden del PO (relevo GEO·SEO·IA). Paquete de servicio completo: line array de 8 bocinas, 4 subwoofers, 4 micrófonos, mezcladora, operador dedicado, montaje y desmontaje, seguro de responsabilidad civil incluido. Generador +$500, certificado de seguro y cubierta de lluvia aparte.',
        'audio')
on conflict (sku) do nothing;

-- ── Comprobación (solo lectura). Esperado: sku=pa_outdoor_400, precio=3000, activo=true, categoria=audio, publico=3000 (lo que ve la página), pa_large_sigue=1800, sound_operator_sigue=300 ──
select sc.sku, sc.precio_cliente_usd as precio, sc.activo, sc.categoria,
       (select p.precio_efectivo_usd from public.service_catalog_public p where p.sku = 'pa_outdoor_400') as publico,
       (select precio_cliente_usd from public.service_catalog where sku = 'pa_large') as pa_large_sigue,
       (select precio_cliente_usd from public.service_catalog where sku = 'sound_operator') as sound_operator_sigue
  from public.service_catalog sc where sc.sku = 'pa_outdoor_400';
