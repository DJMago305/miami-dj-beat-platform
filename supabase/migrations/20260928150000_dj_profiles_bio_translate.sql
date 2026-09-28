-- 🔴 PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- 2026-09-28: Pieza 1 del ticket "Auto-traducción con IA" (docs/tickets/
-- 2026-09-27-auto-traduccion-ia-bio-y-ui.md).
--
-- ⚠️ Bug real encontrado y corregido en el mismo paso: web/jobs.html
-- mandaba `bio_auto_translate` y `bio_language` en su UPDATE a
-- dj_profiles -- NINGUNA de las dos columnas existía (la real es
-- `auto_translate`, sin el prefijo `bio_`; `bio_language` nunca se creó).
-- PostgREST rechaza el UPDATE completo si algún campo del payload no
-- existe -- ese bloque vivía en un try/catch silencioso ("columns may not
-- exist yet... ok"), así que bio_short/bio_long/auto_translate NUNCA se
-- guardaron desde jobs.html, para ningún DJ, nunca. Sin bio_language
-- como columna real, esta pieza (que necesita saber en qué idioma
-- escribió el DJ para traducir en la dirección correcta) tampoco podía
-- funcionar. Se agrega la columna que faltaba; el fix del nombre en el
-- payload de jobs.html va en el mismo commit de este ticket (frontend).
--
-- Aditivo/idempotente: solo ADD COLUMN IF NOT EXISTS, nada se borra ni se
-- renombra (auto_translate ya existía y se deja intacta).

ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS bio_language text NOT NULL DEFAULT 'es';

COMMENT ON COLUMN public.dj_profiles.bio_language IS
  'Idioma en el que el DJ escribió bio/bio_short/bio_long -- "es" o "en". Antes intentado desde web/jobs.html con un nombre de columna que nunca existió (nunca se guardó, corregido 2026-09-28).';

-- Borrador de traducción (2026-09-28, Pieza 1 del ticket de auto-traducción):
-- la Edge Function dj-bio-translate escribe AQUÍ, nunca en bio_en (la real,
-- pública) -- "el modelo propone, nunca publica directo". Un humano (el DJ,
-- o staff/owner para perfiles administrados) aprueba desde jobs.html antes
-- de que el texto pase a bio_en de verdad.
ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS bio_en_draft text,
  ADD COLUMN IF NOT EXISTS bio_en_draft_generated_at timestamptz;

COMMENT ON COLUMN public.dj_profiles.bio_en_draft IS
  'Traducción propuesta por IA (dj-bio-translate), pendiente de aprobación humana -- NUNCA se lee en find-dj.html/dj-profile.html (esos leen bio_en, la real). Se limpia (NULL) al aprobar o descartar.';
COMMENT ON COLUMN public.dj_profiles.bio_en_draft_generated_at IS
  'Cuándo se generó el borrador actual de bio_en_draft, para que la pantalla de aprobación pueda mostrar "propuesto hace X".';
