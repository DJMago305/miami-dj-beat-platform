-- Miami DJ Beat — Referral attribution, first-purchase commission, Soundfortip ledger
-- Run after 10_subscription_hwid_wallet.sql

-- ── First-purchase commission when client was attributed via ?ref=DJ_UUID ─────
CREATE TABLE IF NOT EXISTS referral_sale_commissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref             text NOT NULL,
  client_user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referring_dj_user_id  uuid NOT NULL REFERENCES dj_profiles(user_id) ON DELETE CASCADE,
  gross_cents           bigint NOT NULL CHECK (gross_cents >= 0),
  commission_rate       numeric(5, 4) NOT NULL DEFAULT 0.1000,
  commission_cents      bigint NOT NULL CHECK (commission_cents >= 0),
  status                text NOT NULL DEFAULT 'pending', -- pending | escrow | paid | void
  escrow_release_at     timestamptz,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (order_ref)
);

CREATE INDEX IF NOT EXISTS idx_ref_sale_comm_ref_dj ON referral_sale_commissions(referring_dj_user_id);
CREATE INDEX IF NOT EXISTS idx_ref_sale_comm_status ON referral_sale_commissions(status);

COMMENT ON TABLE referral_sale_commissions IS '10% first-purchase commission to DJ when client entered with ?ref=dj_id.';

ALTER TABLE referral_sale_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DJ reads own referral commissions"
  ON referral_sale_commissions FOR SELECT TO authenticated
  USING (referring_dj_user_id = auth.uid());

CREATE POLICY "Service role manages referral commissions"
  ON referral_sale_commissions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Soundfortip: instant split 10% platform / 90% artist (session close releases) ──
CREATE TABLE IF NOT EXISTS soundfortip_splits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dj_user_id       uuid NOT NULL REFERENCES dj_profiles(user_id) ON DELETE CASCADE,
  session_id       text,
  gross_cents      bigint NOT NULL CHECK (gross_cents >= 0),
  platform_cents   bigint NOT NULL,
  artist_cents     bigint NOT NULL,
  status           text NOT NULL DEFAULT 'pending', -- pending | released
  released_at      timestamptz,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sft_splits_dj ON soundfortip_splits(dj_user_id);

COMMENT ON TABLE soundfortip_splits IS 'Per-tip breakdown; release to artist wallet after night session ends.';

ALTER TABLE soundfortip_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DJ reads own tip splits"
  ON soundfortip_splits FOR SELECT TO authenticated
  USING (dj_user_id = auth.uid());

CREATE POLICY "Service role manages tip splits"
  ON soundfortip_splits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Helper: compute split (mirrors web/monetization.js) ──────────────────────
CREATE OR REPLACE FUNCTION public.soundfortip_split_amounts(gross_cents bigint)
RETURNS TABLE(platform_cents bigint, artist_cents bigint) AS $$
  SELECT
    (gross_cents * 1000) / 10000,
    gross_cents - ((gross_cents * 1000) / 10000);
$$ LANGUAGE sql IMMUTABLE;
