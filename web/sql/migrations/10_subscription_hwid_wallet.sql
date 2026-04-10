-- Miami DJ Beat — Subscription, HWID, wallet, search priority
-- Run in Supabase SQL Editor after stripe_columns.sql (referral_code / subscriptions).
-- Idempotent: safe to re-run.

-- ── Core business columns on dj_profiles ───────────────────────────────────
ALTER TABLE dj_profiles
  ADD COLUMN IF NOT EXISTS is_premium          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hardware_token      text UNIQUE,
  ADD COLUMN IF NOT EXISTS referral_id         uuid REFERENCES dj_profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wallet_balance      numeric(12, 2) DEFAULT 0.00 NOT NULL;

COMMENT ON COLUMN dj_profiles.is_premium IS 'True when active paid tier; drives UI + search boost.';
COMMENT ON COLUMN dj_profiles.hardware_token IS 'Unique activation code for MDJPRO desktop app (show once; consider hashing in app layer).';
COMMENT ON COLUMN dj_profiles.referral_id IS 'Optional FK: which DJ referred this profile (attribution chain).';
COMMENT ON COLUMN dj_profiles.wallet_balance IS 'Artist withdrawable balance (commissions, tips net of platform).';

CREATE INDEX IF NOT EXISTS idx_dj_profiles_is_premium ON dj_profiles(is_premium) WHERE is_premium = true;
CREATE INDEX IF NOT EXISTS idx_dj_profiles_referral_id ON dj_profiles(referral_id);

-- ── One machine per activation: bind HWID to profile (anti-piracy) ───────────
CREATE TABLE IF NOT EXISTS dj_hardware_bindings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES dj_profiles(user_id) ON DELETE CASCADE,
  hwid_hash    text NOT NULL,
  activated_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  CONSTRAINT dj_hardware_bindings_hwid_unique UNIQUE (hwid_hash),
  CONSTRAINT dj_hardware_bindings_one_profile UNIQUE (user_id)
);

COMMENT ON TABLE dj_hardware_bindings IS 'Single HWID per DJ license; intransferible binding for external app.';

CREATE INDEX IF NOT EXISTS idx_dj_hardware_user ON dj_hardware_bindings(user_id);

ALTER TABLE dj_hardware_bindings ENABLE ROW LEVEL SECURITY;

-- Talent reads own binding only
CREATE POLICY "DJ reads own hardware binding"
  ON dj_hardware_bindings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Inserts/updates should be service_role or Edge Function only (no anon writes)
CREATE POLICY "Service role manages hardware bindings"
  ON dj_hardware_bindings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Keep is_premium aligned with subscription (optional sync) ──────────────
CREATE OR REPLACE FUNCTION public.sync_dj_is_premium()
RETURNS trigger AS $$
BEGIN
  NEW.is_premium := COALESCE(NEW.subscription_status, '') IN ('active', 'trialing')
    OR COALESCE(NEW.plan_type, '') IN ('pro_monthly', 'pro_annual', 'PRO')
    AND COALESCE(NEW.plan_status, 'inactive') = 'active';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_dj_is_premium ON dj_profiles;
CREATE TRIGGER trg_sync_dj_is_premium
  BEFORE INSERT OR UPDATE OF subscription_status, plan_type, plan_status
  ON dj_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_dj_is_premium();

-- Backfill existing rows
UPDATE dj_profiles SET is_premium = (
  COALESCE(subscription_status, '') IN ('active', 'trialing')
  OR (
    COALESCE(plan_type, '') IN ('pro_monthly', 'pro_annual', 'PRO')
    AND COALESCE(plan_status, 'inactive') = 'active'
  )
) WHERE is_premium IS DISTINCT FROM (
  COALESCE(subscription_status, '') IN ('active', 'trialing')
  OR (
    COALESCE(plan_type, '') IN ('pro_monthly', 'pro_annual', 'PRO')
    AND COALESCE(plan_status, 'inactive') = 'active'
  )
);
