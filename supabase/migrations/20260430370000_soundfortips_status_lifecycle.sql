-- SoundForTips: ciclo de estados explícito (sin confundir "recibido" con pago real).
-- pending_payment          = Checkout creado, fan aún no paga (solo tarjeta / Stripe).
-- paid_pending_acceptance   = Stripe confirmó cobro; DJ debe aceptar/rechazar.
-- manual_pending_verification = Registro manual (Zelle/Venmo/PayPal); dinero NO verificado por la web.
-- accepted | rejected       = decisión DJ (antes denied → rejected).

ALTER TABLE public.soundfortips_fan_requests
  DROP CONSTRAINT IF EXISTS soundfortips_fan_requests_status_check;

UPDATE public.soundfortips_fan_requests
SET status = 'pending_payment'
WHERE status = 'awaiting_payment';

UPDATE public.soundfortips_fan_requests
SET status = 'paid_pending_acceptance'
WHERE status = 'pending'
  AND payment_channel = 'stripe'
  AND stripe_payment_intent_id IS NOT NULL;

UPDATE public.soundfortips_fan_requests
SET status = 'manual_pending_verification'
WHERE status = 'pending'
  AND payment_channel = 'manual';

UPDATE public.soundfortips_fan_requests
SET status = 'manual_pending_verification'
WHERE status = 'pending';

UPDATE public.soundfortips_fan_requests
SET status = 'rejected'
WHERE status = 'denied';

ALTER TABLE public.soundfortips_fan_requests
  ADD CONSTRAINT soundfortips_fan_requests_status_check
  CHECK (
    status IN (
      'pending_payment',
      'paid_pending_acceptance',
      'manual_pending_verification',
      'accepted',
      'rejected'
    )
  );

COMMENT ON COLUMN public.soundfortips_fan_requests.status IS
  'pending_payment=cobro Stripe pendiente | paid_pending_acceptance=pagado Stripe esperando DJ | manual_pending_verification=manual sin verificación automática | accepted/rejected';

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
    AND fr.status IN ('paid_pending_acceptance', 'manual_pending_verification');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

COMMENT ON FUNCTION public.accept_my_soundfortips_request(uuid) IS
  'DJ: solo desde paid_pending_acceptance o manual_pending_verification → accepted.';

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
  SET status = 'rejected'
  WHERE fr.id = p_request_id
    AND fr.dj_user_id = (SELECT auth.uid())
    AND fr.status = 'manual_pending_verification'
    AND fr.payment_channel = 'manual';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

COMMENT ON FUNCTION public.deny_my_soundfortips_request(uuid) IS
  'DJ: manual_pending_verification → rejected (Stripe refund vía send-sft-client-sms).';

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
    AND fr.status IN ('paid_pending_acceptance', 'manual_pending_verification')
    AND public.dj_soundfortips_plan_ok((SELECT auth.uid()))
  ORDER BY fr.created_at ASC;
$$;

COMMENT ON FUNCTION public.get_my_soundfortips_pending_requests() IS
  'Cabina: filas donde el DJ debe decidir (pagado Stripe o manual pendiente verificación).';

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
    AND public.dj_soundfortips_plan_ok((SELECT auth.uid()))
    AND fr.status <> 'pending_payment'
    AND (p_since IS NULL OR fr.created_at >= p_since)
  ORDER BY fr.created_at DESC;
$$;

COMMENT ON FUNCTION public.get_my_soundfortips_night_log(timestamptz) IS
  'Historial DJ: excluye abandonos de Checkout (pending_payment).';

NOTIFY pgrst, 'reload schema';
