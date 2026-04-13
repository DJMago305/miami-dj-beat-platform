-- Cash Flow: propinas SOUNDFORTIPS aceptadas (sin PII de contacto del fan).

CREATE OR REPLACE FUNCTION public.get_my_soundfortips_accepted_for_flow(p_since timestamptz)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  tip_usd numeric,
  song text,
  artist text,
  sender_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fr.id, fr.created_at, fr.tip_usd, fr.song, fr.artist, fr.sender_label
  FROM public.soundfortips_fan_requests fr
  WHERE fr.dj_user_id = (SELECT auth.uid())
    AND fr.status = 'accepted'
    AND fr.created_at >= p_since
  ORDER BY fr.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_soundfortips_accepted_for_flow(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_soundfortips_accepted_for_flow(timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_my_soundfortips_accepted_for_flow IS 'DJ Cash Flow: accepted SoundForTips rows since p_since (no client_phone/email).';
