-- Entorno: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- Registra columnas para persistencia de evaluación del curso en dj_profiles

ALTER TABLE public.dj_profiles
ADD COLUMN IF NOT EXISTS certification_score integer DEFAULT null,
ADD COLUMN IF NOT EXISTS certification_date timestamp with time zone DEFAULT null;
