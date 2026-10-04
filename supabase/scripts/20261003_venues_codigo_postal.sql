-- ============================================================================
-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - CODIGO POSTAL DEL LOCAL (preparado el 2026-10-03)
-- Agrega venues.postal_code (aditivo, nulo por defecto) y fija el de Mojitos Calle 8: 33144 (el mismo que usa el enlace de Google Maps de events.html).
-- Lo lee el correo de compra de mesas (stripe-webhook) para escribir la direccion completa: "8000 SW 8th St, Miami, FL 33144".
-- No cambia address ni city, asi que las demas paginas se ven igual.
-- ============================================================================
alter table public.venues add column if not exists postal_code text;

update public.venues set postal_code = '33144' where slug = 'mojitos-calle-8' and postal_code is null;

-- Comprobacion: debe devolver 1 fila con postal_code = 33144.
select slug, address, city, postal_code from public.venues where slug = 'mojitos-calle-8';

notify pgrst, 'reload schema';
