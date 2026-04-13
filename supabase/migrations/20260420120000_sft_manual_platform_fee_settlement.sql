-- Liquidación comisión plataforma (10%) sobre propinas manuales aceptadas; cargo Stripe al DJ.

ALTER TABLE public.soundfortips_fan_requests
  ADD COLUMN IF NOT EXISTS manual_platform_fee_settled_at timestamptz;

COMMENT ON COLUMN public.soundfortips_fan_requests.manual_platform_fee_settled_at IS 'Cuándo se cobró la comisión MDB sobre esta fila (payment_channel=manual).';

CREATE INDEX IF NOT EXISTS idx_sft_fan_req_unsettled_manual_fee
  ON public.soundfortips_fan_requests (dj_user_id)
  WHERE payment_channel = 'manual' AND status = 'accepted' AND manual_platform_fee_settled_at IS NULL;

ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS sft_manual_fee_pending_cents integer NOT NULL DEFAULT 0;

ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS soundfortips_platform_fee_blocked boolean NOT NULL DEFAULT false;

ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS sft_platform_fee_last_error text;

COMMENT ON COLUMN public.dj_profiles.sft_manual_fee_pending_cents IS 'Centavos USD acumulados cuando el fee total aún no alcanza el mínimo de cargo Stripe.';
COMMENT ON COLUMN public.dj_profiles.soundfortips_platform_fee_blocked IS 'True: cargo de comisión falló; bloquear nuevas peticiones SFT hasta regularizar.';
COMMENT ON COLUMN public.dj_profiles.sft_platform_fee_last_error IS 'Último mensaje de error Stripe al liquidar comisión manual.';
