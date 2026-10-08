-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- CATÁLOGO · nuevo nombre del SKU pa_outdoor_400 (el PO precisó el 2026-10-08 que «400» son personas y que el paquete puede abarcar de 400 a 1,000 al aire libre, según el espacio).
-- Solo cambia el NOMBRE de esa fila (el precio, el SKU y todo lo demás quedan igual). Idempotente.

update public.service_catalog
   set nombre = 'Outdoor Large Event Sound Package (400 to 1,000 Guests)', updated_at = now()
 where sku = 'pa_outdoor_400' and nombre is distinct from 'Outdoor Large Event Sound Package (400 to 1,000 Guests)';

-- Comprobación (solo lectura): nombre nuevo, precio 3000 sin cambio.
select sku, nombre, precio_cliente_usd, activo from public.service_catalog where sku = 'pa_outdoor_400';
