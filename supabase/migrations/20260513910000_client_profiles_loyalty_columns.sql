-- Loyalty / VIP columns referenced by client-portal.js and mdj-shared-header.js
-- (defined in client_profiles_schema.sql but missing on some production installs).

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_events_booked integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_ref text;

COMMENT ON COLUMN public.client_profiles.loyalty_points IS 'VIP loyalty score; portal + header badge.';
COMMENT ON COLUMN public.client_profiles.total_events_booked IS 'Completed/booked events count for tier badge.';
COMMENT ON COLUMN public.client_profiles.discount_eligible IS 'Referral / promo discount flag.';
COMMENT ON COLUMN public.client_profiles.source_ref IS 'Referral code or QR origin tag.';

NOTIFY pgrst, 'reload schema';
