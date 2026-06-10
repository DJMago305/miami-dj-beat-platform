-- Close public API exposure on Stripe webhook idempotency table (Supabase advisor: rls_disabled_in_public).
-- service_role (stripe-webhook Edge) keeps full access; anon/authenticated get no policies.

ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.processed_webhooks FROM PUBLIC;
GRANT ALL ON TABLE public.processed_webhooks TO service_role;

COMMENT ON TABLE public.processed_webhooks IS
  'Stripe webhook event IDs already processed. RLS on, no client policies — service_role only.';
