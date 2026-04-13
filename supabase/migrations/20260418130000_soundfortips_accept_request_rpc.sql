-- DJ marca petición SOUNDFORTIPS como aceptada en BD (Cash Flow / informes).
-- La notificación SMS puede ir aparte vía send-sft-client-sms.

CREATE OR REPLACE FUNCTION public.accept_my_soundfortips_request(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.soundfortips_fan_requests fr
  SET status = 'accepted'
  WHERE fr.id = p_request_id
    AND fr.dj_user_id = (SELECT auth.uid())
    AND fr.status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_my_soundfortips_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_my_soundfortips_request(uuid) TO authenticated;

COMMENT ON FUNCTION public.accept_my_soundfortips_request IS 'DJ: pending → accepted for Cash Flow; SMS sigue en send-sft-client-sms.';
