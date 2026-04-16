-- billing_settings: Zelle payout identity per auth user (dashboard → Supabase).
-- RLS: only the row owner can SELECT / INSERT / UPDATE.

CREATE TABLE IF NOT EXISTS public.billing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  zelle_email text,
  zelle_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_settings_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_settings_user_id ON public.billing_settings (user_id);

COMMENT ON TABLE public.billing_settings IS
  'Per-user payout prefs: Zelle email/phone and display name (SoundForTips / billing UI).';

CREATE OR REPLACE FUNCTION public.set_billing_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_settings_updated_at ON public.billing_settings;
CREATE TRIGGER trg_billing_settings_updated_at
  BEFORE UPDATE ON public.billing_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_billing_settings_updated_at();

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_settings_select_own" ON public.billing_settings;
CREATE POLICY "billing_settings_select_own"
  ON public.billing_settings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "billing_settings_insert_own" ON public.billing_settings;
CREATE POLICY "billing_settings_insert_own"
  ON public.billing_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "billing_settings_update_own" ON public.billing_settings;
CREATE POLICY "billing_settings_update_own"
  ON public.billing_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
