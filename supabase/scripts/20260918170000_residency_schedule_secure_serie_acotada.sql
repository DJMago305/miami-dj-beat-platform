-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-18
-- Autor: Hilo Maestro (Claude), encontrado en una prueba de solidez pedida
-- por el PO para "serie acotada + rotación de DJ" antes de darlo por cerrado
-- ============================================================
--
-- Hallazgo: 20260918150000_residency_schedule_series_acotada.sql agregó
-- start_date/end_date/series_name a la TABLA residency_schedule, pero el
-- frontend (loadResidencies() en calendario-operacional-inteligente.html)
-- lee esas columnas a través de la VISTA residency_schedule_secure
-- (20260814130000_residency_pay_confidentiality.sql, columnas explícitas
-- por diseño -- oculta venue_pay_usd al artista). Una vista con columnas
-- explícitas NO hereda columnas nuevas de su tabla base automáticamente.
--
-- Consecuencia real (encontrada probando 12 eventos simultáneos, no en
-- teoría): cada carga de calendario intentaba la vista con las 3 columnas
-- nuevas, fallaba con 400 (columna inexistente), reintentaba la vista sin
-- ellas, fallaba de nuevo, y recién en el TERCER intento caía a la tabla
-- base cruda. Funcionaba (el fallback ya existía y es real), pero
-- desperdiciaba 2 peticiones fallidas en cada carga -- no es la "solidez"
-- que se pidió verificar.
--
-- Fix: agregar las 3 columnas nuevas a la vista, al FINAL del select (Postgres
-- exige que CREATE OR REPLACE VIEW mantenga la posición de las columnas
-- existentes -- agregar al medio rompe con "cannot change name of view
-- column"). Sin tocar la lógica de seguridad: venue_pay_usd sigue oculto
-- para el artista, el filtro de fila (staff ve todas, artista solo las
-- suyas) sigue igual. start_date/end_date/series_name no son datos
-- sensibles -- no necesitan enmascararse.

CREATE OR REPLACE VIEW public.residency_schedule_secure AS
SELECT
  s.id, s.day_of_week, s.shift, s.venue, s.dj_name,
  s.start_time, s.end_time, s.dj_id, s.dj_pay_usd, s.active, s.notes,
  CASE WHEN public.is_staff(auth.uid()) THEN s.venue_pay_usd ELSE NULL END AS venue_pay_usd,
  s.start_date, s.end_date, s.series_name
FROM public.residency_schedule s
WHERE
  s.active = true
  AND (
    public.is_staff(auth.uid())
    OR s.dj_id = (SELECT p.id FROM public.dj_profiles p
                  WHERE p.user_id = auth.uid())
  );

COMMENT ON VIEW public.residency_schedule_secure IS
  'Puerta segura de residency_schedule. venue_pay_usd visible SOLO para staff (is_staff); el artista ve solo sus residencias y venue_pay_usd = NULL. start_date/end_date/series_name (serie acotada, 2026-09-18) van sin filtrar -- no son datos sensibles. El frontend lee ESTA vista, no la tabla base.';

GRANT SELECT ON public.residency_schedule_secure TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICACIÓN -- ya corrida en producción antes de este commit:
--   SELECT id,day_of_week,shift,venue,dj_name,start_time,end_time,
--          start_date,end_date,series_name,dj_pay_usd,dj_id
--   FROM residency_schedule_secure WHERE active=true;
--   -- ESPERADO: 200, sin error de columna inexistente.
-- ============================================================
