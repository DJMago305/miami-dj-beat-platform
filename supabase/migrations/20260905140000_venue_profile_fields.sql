-- Entorno: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
--
-- Rediseno del panel de Venues (Fase 2, UI/UX) -- el formulario profesional
-- pedido por el PO necesita estos campos que no existian: categoria del
-- local, codigo postal, telefono de contacto/reservas, restriccion de edad
-- e imagen de portada/flyer. Aditivo, no toca nada existente.

alter table public.venues
  add column if not exists category text,
  add column if not exists zip_code text,
  add column if not exists phone text,
  add column if not exists age_restriction text,
  add column if not exists cover_image_url text;

comment on column public.venues.category is
  'Categoria del local: nightclub | restaurant_bar | lounge | rooftop.';
comment on column public.venues.age_restriction is
  'Restriccion de edad del venue, ej. "21+" o "All Ages".';
