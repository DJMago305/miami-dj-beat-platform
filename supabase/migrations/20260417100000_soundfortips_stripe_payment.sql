-- SOUNDFORTIPS: cobro real con Stripe (Tarjeta) vs manual (Zelle / etc.).

ALTER TABLE public.soundfortips_fan_requests
  DROP CONSTRAINT IF EXISTS soundfortips_fan_requests_status_check;

ALTER TABLE public.soundfortips_fan_requests
  ADD CONSTRAINT soundfortips_fan_requests_status_check
  CHECK (status IN ('awaiting_payment', 'pending', 'accepted', 'denied'));

ALTER TABLE public.soundfortips_fan_requests
  ADD COLUMN IF NOT EXISTS payment_channel text NOT NULL DEFAULT 'manual';

ALTER TABLE public.soundfortips_fan_requests
  DROP CONSTRAINT IF EXISTS soundfortips_fan_requests_payment_channel_check;

ALTER TABLE public.soundfortips_fan_requests
  ADD CONSTRAINT soundfortips_fan_requests_payment_channel_check
  CHECK (payment_channel IN ('manual', 'stripe'));

ALTER TABLE public.soundfortips_fan_requests
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

ALTER TABLE public.soundfortips_fan_requests
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

COMMENT ON COLUMN public.soundfortips_fan_requests.payment_channel IS 'manual = honor-system / Zelle path; stripe = Checkout completed before DJ sees request.';
COMMENT ON COLUMN public.soundfortips_fan_requests.stripe_payment_intent_id IS 'Set when Checkout completes; used for refunds on deny.';

CREATE INDEX IF NOT EXISTS idx_sft_fan_req_checkout_session ON public.soundfortips_fan_requests(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- Cabina: solo pending y cobrado (manual siempre; stripe solo tras webhook).
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
    AND (
      fr.payment_channel = 'manual'
      OR (fr.payment_channel = 'stripe' AND fr.stripe_payment_intent_id IS NOT NULL)
    )
  ORDER BY fr.created_at ASC;
$$;

-- Registro nocturno: no listar abandonos de Checkout.
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
    AND fr.status <> 'awaiting_payment'
    AND (p_since IS NULL OR fr.created_at >= p_since)
  ORDER BY fr.created_at DESC;
$$;
