-- SoundForTips: instrucciones de pago manual visibles al fan (texto plano; el front escapa y enlaza URLs).

ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS sft_pay_zelle_instructions text,
  ADD COLUMN IF NOT EXISTS sft_pay_venmo_instructions text,
  ADD COLUMN IF NOT EXISTS sft_pay_paypal_instructions text;

COMMENT ON COLUMN public.dj_profiles.sft_pay_zelle_instructions IS 'SFT: texto para Zelle (email/tel negocio, memo). Opcional; si null, copy por defecto de marca.';
COMMENT ON COLUMN public.dj_profiles.sft_pay_venmo_instructions IS 'SFT: texto o URL Venmo (ej. https://venmo.com/u/handle). Opcional.';
COMMENT ON COLUMN public.dj_profiles.sft_pay_paypal_instructions IS 'SFT: PayPal / PayPal.me. Opcional.';
