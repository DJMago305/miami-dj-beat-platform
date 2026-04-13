-- Cabina SOUNDFORTIPS: peticiones pendientes desde otro dispositivo (sin client_phone / client_email).

CREATE OR REPLACE FUNCTION public.get_my_soundfortips_pending_requests()
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
    AND fr.status = 'pending'
    AND public.dj_soundfortips_plan_ok((SELECT auth.uid()))
  ORDER BY fr.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_my_soundfortips_pending_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_soundfortips_pending_requests() TO authenticated;

COMMENT ON FUNCTION public.get_my_soundfortips_pending_requests IS 'DJ cabina: pending SOUNDFORTIPS rows for merge into live queue (no fan contact PII).';
