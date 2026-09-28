-- 🔴 PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- 2026-09-27: primer paso real del ticket grande "experiencia por tipo de
-- venue" (docs/tickets/2026-09-27-experiencia-real-por-venue-y-calificacion-
-- publica.md, pregunta abierta #1). Confirmado hoy con SQL directo:
-- financial_venues y financial_venue_agreements NO tienen ninguna columna de
-- categoría comercial -- no es un dato oculto que faltaba consultar, no
-- existe todavía. El PO confirmó: staff la asigna al dar de alta el venue
-- (vocabulario controlado, no texto libre), no se infiere de scraping.
--
-- Aditivo/idempotente: ADD COLUMN IF NOT EXISTS, backfill solo por nombre
-- exacto de los 3 venues reales ya en producción (confirmados uno por uno
-- con el PO antes de escribir esto -- ninguna categoría inventada).

ALTER TABLE public.financial_venues
  ADD COLUMN IF NOT EXISTS category text;

COMMENT ON COLUMN public.financial_venues.category IS
  'Categoría comercial del venue (ej. sundowner, restaurante_musica, club, fiesta_privada) -- asignada por staff al dar de alta, vocabulario controlado. Ver docs/tickets/2026-09-27-experiencia-real-por-venue-y-calificacion-publica.md.';

UPDATE public.financial_venues
   SET category = 'restaurante_musica'
 WHERE name = 'Mojitos Calle 8'
   AND category IS NULL;

UPDATE public.financial_venues
   SET category = 'sundowner'
 WHERE name = 'Sundowner Key Largo'
   AND category IS NULL;

UPDATE public.financial_venues
   SET category = 'restaurante'
 WHERE name = 'El Valle Restaurante'
   AND category IS NULL;
