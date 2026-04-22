-- Rechazo manual en BD sin depender solo de la Edge (SMS/Stripe sigue en send-sft-client-sms).
-- Stripe: esta RPC no toca filas (payment_channel = 'manual' only); refund va en la Edge.

CREATE OR REPLACE FUNCTION public.deny_my_soundfortips_request(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.soundfortips_fan_requests fr
  SET status = 'denied'
  WHERE fr.id = p_request_id
    AND fr.dj_user_id = (SELECT auth.uid())
    AND fr.status = 'pending'
    AND fr.payment_channel = 'manual';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.deny_my_soundfortips_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deny_my_soundfortips_request(uuid) TO authenticated;

COMMENT ON FUNCTION public.deny_my_soundfortips_request IS 'DJ: pending → denied for manual SFT; Stripe deny + refund stays in send-sft-client-sms.';
