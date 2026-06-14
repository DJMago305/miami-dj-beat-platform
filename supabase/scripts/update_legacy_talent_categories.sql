-- supabase/scripts/update_legacy_talent_categories.sql
-- Script para limpiar y migrar las categorías antiguas de talento a las nuevas categorías maestras.

BEGIN;

-- 1. Reemplazos directos en la columna `roles`
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'HORA_LOCA', 'Hora Loca Experience');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'CANTANTE', 'Músicos en Vivo');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'LIVE_BAND', 'Músicos en Vivo');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'PERCUSIONISTA', 'Músicos en Vivo');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'SAXOFONISTA', 'Músicos en Vivo');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'VIOLINISTA', 'Músicos en Vivo');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'PAYASO', 'Payasos');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'BARTENDER', 'Staff');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'MESERO', 'Staff');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'FOTO_BOOTH_360', 'Captura y Visuales');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'MANAGER_ARTISTICO', 'Staff');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'PRODUCTOR_MUSICAL', 'DJ');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'INFLUENCER_PROMOTOR', 'MC y Presentadores');

-- 2. Reemplazos directos en la columna `artist_specialty`
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'HORA_LOCA', 'Hora Loca Experience');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'CANTANTE', 'Músicos en Vivo');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'LIVE_BAND', 'Músicos en Vivo');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'PERCUSIONISTA', 'Músicos en Vivo');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'SAXOFONISTA', 'Músicos en Vivo');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'VIOLINISTA', 'Músicos en Vivo');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'PAYASO', 'Payasos');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'BARTENDER', 'Staff');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'MESERO', 'Staff');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'FOTO_BOOTH_360', 'Captura y Visuales');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'MANAGER_ARTISTICO', 'Staff');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'PRODUCTOR_MUSICAL', 'DJ');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'INFLUENCER_PROMOTOR', 'MC y Presentadores');

-- 3. Limpieza de duplicados generados por la convergencia de categorías
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'Músicos en Vivo, Músicos en Vivo', 'Músicos en Vivo');
UPDATE public.dj_profiles SET roles = REPLACE(roles, 'Músicos en Vivo, Músicos en Vivo', 'Músicos en Vivo'); -- Por si había 3
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'Músicos en Vivo · Músicos en Vivo', 'Músicos en Vivo');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'Músicos en Vivo · Músicos en Vivo', 'Músicos en Vivo');

UPDATE public.dj_profiles SET roles = REPLACE(roles, 'Staff, Staff', 'Staff');
UPDATE public.dj_profiles SET artist_specialty = REPLACE(artist_specialty, 'Staff · Staff', 'Staff');

COMMIT;
