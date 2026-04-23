-- Suscripciones / facturación separada:
-- - Artista (MDJ Pro, roster, get-pro): SOLO public.dj_profiles (stripe_* existentes).
-- - Comprador / portal VIP / pagos de evento como cliente: public.client_profiles (nuevas columnas).

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS buyer_stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS buyer_billing_tier text NOT NULL DEFAULT 'none';

COMMENT ON COLUMN public.client_profiles.buyer_stripe_customer_id IS
  'Customer de Stripe del rol comprador (portal, depósitos, suscripciones de cliente). Independiente de dj_profiles.stripe_customer_id (artista/MDJ Pro).';

COMMENT ON COLUMN public.client_profiles.buyer_billing_tier IS
  'Nivel de facturación del comprador: none | vip (ampliar según producto). No es plan PRO de artista.';

COMMENT ON COLUMN public.dj_profiles.stripe_customer_id IS
  'Solo producto Artista / MDJ Pro (LITE→PRO, roster). No reutilizar para el rol «comprador»; ver client_profiles.buyer_stripe_customer_id.';

COMMENT ON COLUMN public.dj_profiles.subscription_id IS
  'Suscripción recurring MDJ Pro / artista; nunca mezclar con billing de eventos o VIP de portal cliente.';

NOTIFY pgrst, 'reload schema';
