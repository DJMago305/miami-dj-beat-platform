-- Si en producción se probó otra firma (p. ej. SETOF soundfortips_fan_requests), CREATE OR REPLACE
-- falla con 42P13 "cannot change return type". Este bloque fuerza el estado correcto.
-- Columnas explícitas: sin PII (email/tel) en la cabina.

DROP FUNCTION IF EXISTS public.get_my_soundfortips_pending_requests();

CREATE FUNCTION public.get_my_soundfortips_pending_requests()
RETURNS TABLE (
  id uuid,
  sender_label text,
  song text,
  artist text,
  tip_usd numeric,
  poster_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fr.id, fr.sender_label, fr.song, fr.artist, fr.tip_usd, fr.poster_url, fr.created_at
  FROM public.soundfortips_fan_requests fr
  WHERE fr.dj_user_id = (SELECT auth.uid())
    AND fr.status IN ('paid_pending_acceptance', 'manual_pending_verification')
  ORDER BY fr.created_at ASC;
$$;

COMMENT ON FUNCTION public.get_my_soundfortips_pending_requests() IS
  'Cabina: paid_pending_acceptance o manual_pending_verification para auth.uid() = DJ. Sin PII.';

REVOKE ALL ON FUNCTION public.get_my_soundfortips_pending_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_soundfortips_pending_requests() TO authenticated;

NOTIFY pgrst, 'reload schema';
