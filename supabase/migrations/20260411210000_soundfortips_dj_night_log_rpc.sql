-- Registro nocturno SOUNDFORTIPS para el DJ: lista de peticiones (pendiente / aceptada / rechazada)
-- sin exponer client_phone ni client_email (solo vía SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.get_my_soundfortips_night_log(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  sender_label text,
  song text,
  artist text,
  tip_usd numeric,
  poster_url text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fr.id, fr.sender_label, fr.song, fr.artist, fr.tip_usd, fr.poster_url, fr.status, fr.created_at
  FROM public.soundfortips_fan_requests fr
  WHERE fr.dj_user_id = (SELECT auth.uid())
    AND (p_since IS NULL OR fr.created_at >= p_since)
  ORDER BY fr.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_soundfortips_night_log(p_since timestamptz DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  DELETE FROM public.soundfortips_fan_requests
  WHERE dj_user_id = (SELECT auth.uid())
    AND (p_since IS NULL OR created_at >= p_since);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_soundfortips_night_log(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_soundfortips_night_log(timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_my_soundfortips_night_log IS 'DJ: backlog de peticiones SOUNDFORTIPS (sin PII de contacto).';
COMMENT ON FUNCTION public.delete_my_soundfortips_night_log IS 'DJ: borra filas de su registro (opcionalmente desde p_since).';
