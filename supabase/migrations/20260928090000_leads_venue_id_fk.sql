-- 🔴 PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- 2026-09-28: prerrequisito real para las preguntas abiertas #2 y #3 del
-- ticket de experiencia por venue (docs/tickets/2026-09-27-experiencia-
-- real-por-venue-y-calificacion-publica.md). Confirmado con SQL directo
-- antes de diseñar vocabulario/fórmula: los 7 leads reales tienen
-- `venue`/`event_location` vacíos (texto libre, nunca llenado) y NINGUNA
-- relación con financial_venues (donde ya vive la categoría real, desde
-- 20260927170000). Sin esta columna, ningún evento futuro podría calcular
-- "este DJ trabajó en un venue de categoría X" -- el prerrequisito no es
-- decidir el texto de una insignia, es tener el dato que la alimente.
--
-- Aditivo/idempotente: columna nueva nullable, ningún lead existente se
-- toca (los 7 reales quedan igual que están, con venue_id NULL -- ninguno
-- tiene event_completed_at, así que no hay experiencia real que hubiera
-- que backfillear de todos modos).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.financial_venues(id);

COMMENT ON COLUMN public.leads.venue_id IS
  'Venue real y categorizado (financial_venues) de este evento, si el staff lo asignó a uno conocido -- distinto de venue/event_location (texto libre, sin estructura). Prerrequisito para calcular experiencia por categoría de venue, ver docs/tickets/2026-09-27-experiencia-real-por-venue-y-calificacion-publica.md.';

CREATE INDEX IF NOT EXISTS idx_leads_venue_id ON public.leads (venue_id) WHERE venue_id IS NOT NULL;
