-- Public handle for VIP header + login alias (legal name remains in full_name / stage brand separate)
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

COMMENT ON COLUMN public.client_profiles.username IS 'Public @handle (no spaces). Header VIP display; full_name remains legal/private where required.';
COMMENT ON COLUMN public.dj_profiles.username IS 'Public @handle for artists; stage_name remains stage brand.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_profiles_username_norm
  ON public.client_profiles (lower(trim(username)))
  WHERE username IS NOT NULL AND length(trim(username)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dj_profiles_username_norm
  ON public.dj_profiles (lower(trim(username)))
  WHERE username IS NOT NULL AND length(trim(username)) > 0;

CREATE OR REPLACE FUNCTION public.enforce_username_unique_across_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm text;
BEGIN
  IF NEW.username IS NULL OR length(trim(NEW.username)) = 0 THEN
    RETURN NEW;
  END IF;
  norm := lower(trim(NEW.username));
  IF TG_TABLE_NAME = 'client_profiles' THEN
    IF EXISTS (
      SELECT 1 FROM public.dj_profiles d
      WHERE d.username IS NOT NULL AND length(trim(d.username)) > 0
        AND lower(trim(d.username)) = norm
        AND d.user_id IS DISTINCT FROM NEW.user_id
    ) THEN
      RAISE EXCEPTION 'username_already_taken' USING ERRCODE = '23505';
    END IF;
  ELSIF TG_TABLE_NAME = 'dj_profiles' THEN
    IF EXISTS (
      SELECT 1 FROM public.client_profiles c
      WHERE c.username IS NOT NULL AND length(trim(c.username)) > 0
        AND lower(trim(c.username)) = norm
        AND c.user_id IS DISTINCT FROM NEW.user_id
    ) THEN
      RAISE EXCEPTION 'username_already_taken' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_profiles_username_cross ON public.client_profiles;
CREATE TRIGGER trg_client_profiles_username_cross
  BEFORE INSERT OR UPDATE OF username ON public.client_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_username_unique_across_profiles();

DROP TRIGGER IF EXISTS trg_dj_profiles_username_cross ON public.dj_profiles;
CREATE TRIGGER trg_dj_profiles_username_cross
  BEFORE INSERT OR UPDATE OF username ON public.dj_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_username_unique_across_profiles();

-- Anon-safe: resolve auth email for signInWithPassword (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.mdj_resolve_email_for_login(p_identity text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v text := trim(p_identity);
  norm text;
  em text;
BEGIN
  IF v IS NULL OR v = '' THEN
    RETURN NULL;
  END IF;
  -- Treat as email whenever @ is present (Supabase Auth accepts the string as-is after lower).
  IF position('@' in v) > 0 THEN
    RETURN lower(v);
  END IF;
  norm := lower(trim(regexp_replace(v, '^@+', '')));
  IF norm = '' THEN
    RETURN NULL;
  END IF;

  SELECT c.email INTO em FROM public.client_profiles c
  WHERE c.email IS NOT NULL
    AND c.username IS NOT NULL AND length(trim(c.username)) > 0
    AND lower(trim(c.username)) = norm
  LIMIT 1;
  IF em IS NOT NULL THEN
    RETURN lower(trim(em));
  END IF;

  SELECT d.email INTO em FROM public.dj_profiles d
  WHERE d.email IS NOT NULL
    AND d.username IS NOT NULL AND length(trim(d.username)) > 0
    AND lower(trim(d.username)) = norm
  LIMIT 1;
  IF em IS NOT NULL THEN
    RETURN lower(trim(em));
  END IF;

  SELECT d.email INTO em FROM public.dj_profiles d
  WHERE d.email IS NOT NULL
    AND (
      (d.stage_name IS NOT NULL AND lower(trim(d.stage_name)) = norm)
      OR (d.dj_name IS NOT NULL AND lower(trim(d.dj_name)) = norm)
    )
  LIMIT 1;
  IF em IS NOT NULL THEN
    RETURN lower(trim(em));
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.mdj_resolve_email_for_login(text) IS 'Login: resolve email from username/handle for signInWithPassword (anon RPC).';

GRANT EXECUTE ON FUNCTION public.mdj_resolve_email_for_login(text) TO anon;
GRANT EXECUTE ON FUNCTION public.mdj_resolve_email_for_login(text) TO authenticated;
