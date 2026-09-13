-- Entorno: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
--
-- Registro de paridad repo/base de datos -- esta columna ya fue aplicada
-- manualmente en el SQL Editor de producción por el owner (confirmado en
-- vivo: information_schema.columns ya la lista como
-- "exam_retry_after | timestamp with time zone"). Este archivo solo deja
-- el cambio versionado en el repositorio; `IF NOT EXISTS` la hace segura
-- de re-ejecutar sin efecto si la migración corre de nuevo.
--
-- Causa real: web/courses.html (initExam()/submitExam()) lee y escribe
-- dj_profiles.exam_retry_after (cooldown de 30 días tras reprobar el
-- examen), columna que nunca existió en la tabla real -- provocaba un
-- 400 (Bad Request, error 42703 "column does not exist") en cada carga
-- de la página para cualquier usuario con sesión.

ALTER TABLE public.dj_profiles
ADD COLUMN IF NOT EXISTS exam_retry_after timestamp with time zone DEFAULT null;
