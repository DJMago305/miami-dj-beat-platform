-- One-time DJ course purchases (Stripe Checkout), recorded via stripe-webhook
CREATE TABLE IF NOT EXISTS public.course_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_session_id text NOT NULL UNIQUE,
    stripe_payment_intent text,
    customer_email text NOT NULL,
    amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
    currency text NOT NULL DEFAULT 'usd',
    product text NOT NULL DEFAULT 'dj_professional_course',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_purchases_email ON public.course_purchases (customer_email);
CREATE INDEX IF NOT EXISTS idx_course_purchases_created ON public.course_purchases (created_at DESC);

COMMENT ON TABLE public.course_purchases IS 'Stripe one-time payments for MDJPRO DJ course; written by stripe-webhook (metadata.product=miami_dj_course).';

ALTER TABLE public.course_purchases ENABLE ROW LEVEL SECURITY;
