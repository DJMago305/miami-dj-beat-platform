-- Referral + subscription columns for dj_profiles
-- Run in Supabase SQL Editor

-- Stripe subscription fields
ALTER TABLE dj_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id  text,
  ADD COLUMN IF NOT EXISTS subscription_id     text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS next_renewal        date,
  ADD COLUMN IF NOT EXISTS billing_period      text DEFAULT 'monthly',
  -- Founding member tracking (first 10 PRO subscribers)
  ADD COLUMN IF NOT EXISTS is_founder          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_number       integer;  -- 1–10 = founder, 11+ = regular

-- Card reference (no real card data stored)
ALTER TABLE dj_profiles
  ADD COLUMN IF NOT EXISTS card_last4          text,
  ADD COLUMN IF NOT EXISTS card_brand          text,
  ADD COLUMN IF NOT EXISTS card_holder         text,
  ADD COLUMN IF NOT EXISTS card_expiry         text;

-- Referral system
ALTER TABLE dj_profiles
  ADD COLUMN IF NOT EXISTS referral_code       text UNIQUE,
  ADD COLUMN IF NOT EXISTS referral_credits    numeric(10,2) DEFAULT 0.00;

-- Auto-generate referral code for existing DJs (DJ- + first 6 chars of user_id uppercase)
UPDATE dj_profiles
SET referral_code = 'DJ-' || UPPER(SUBSTRING(user_id::text, 1, 6))
WHERE referral_code IS NULL;

-- ── Referrals tracking table ─────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id     uuid REFERENCES dj_profiles(user_id) ON DELETE SET NULL,
  referred_id     uuid REFERENCES dj_profiles(user_id) ON DELETE SET NULL,
  referral_code   text NOT NULL,
  discount_given  numeric(10,2) DEFAULT 20.00,  -- $20 off for new subscriber
  credit_earned   numeric(10,2) DEFAULT 10.00,  -- $10 credit for referrer
  status          text DEFAULT 'pending',        -- pending | paid | redeemed
  created_at      timestamptz DEFAULT now(),
  paid_at         timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dj_profiles_subscription_id   ON dj_profiles(subscription_id);
CREATE INDEX IF NOT EXISTS idx_dj_profiles_stripe_customer   ON dj_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_dj_profiles_referral_code     ON dj_profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer            ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred            ON referrals(referred_id);

-- RLS: DJs can read their own referrals, admins can see all
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DJ sees own referrals" ON referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- ── Atomic credit increment function ────────────────────────
-- Prevents race conditions when multiple referrals are processed simultaneously
CREATE OR REPLACE FUNCTION increment_referral_credits(uid uuid, amount numeric)
RETURNS void AS $$
  UPDATE dj_profiles
  SET referral_credits = COALESCE(referral_credits, 0) + amount
  WHERE user_id = uid;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Platform settings table ───────────────────────────────────
-- Admin-editable key-value store. Read by the public site (prices, labels).
CREATE TABLE IF NOT EXISTS platform_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Allow the public (unauthenticated) to read settings
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read settings" ON platform_settings
  FOR SELECT TO public USING (true);

-- Only service_role (admin) can write
CREATE POLICY "Only service role can write settings" ON platform_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Default PRO plan pricing ─────────────────────────────────
INSERT INTO platform_settings (key, value) VALUES
  ('pro_price_monthly',   '80'),
  ('pro_price_semestral', '400'),
  ('pro_price_annual',    '720'),
  ('pro_label_monthly',   'Founder Price'),
  ('pro_label_semestral', '1 mes gratis'),
  ('pro_label_annual',    '3 meses gratis')
ON CONFLICT (key) DO NOTHING;
