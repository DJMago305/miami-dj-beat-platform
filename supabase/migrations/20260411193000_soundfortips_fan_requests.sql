-- SOUNDFORTIPS: contacto del fan (email/tel) solo para Miami DJ Beat (promos, SMS vía Edge).
-- RLS activado sin políticas → anon/authenticated no leen/escriben; solo service_role (Edge Functions).

CREATE TABLE IF NOT EXISTS public.soundfortips_fan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dj_user_id uuid NOT NULL REFERENCES public.dj_profiles(user_id) ON DELETE CASCADE,
  sender_label text NOT NULL,
  song text NOT NULL DEFAULT '',
  artist text NOT NULL DEFAULT '',
  tip_usd numeric(12, 2) NOT NULL CHECK (tip_usd > 0),
  poster_url text,
  client_phone text,
  client_email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sft_fan_req_dj ON public.soundfortips_fan_requests(dj_user_id);
CREATE INDEX IF NOT EXISTS idx_sft_fan_req_created ON public.soundfortips_fan_requests(created_at DESC);

ALTER TABLE public.soundfortips_fan_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.soundfortips_fan_requests IS 'Fan contact for SOUNDFORTIPS: phone/email for Miami DJ Beat only; DJs do not query this table from the client.';
