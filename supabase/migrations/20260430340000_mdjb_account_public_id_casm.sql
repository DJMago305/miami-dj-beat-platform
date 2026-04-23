-- Identificador público: MDJB-XXXX-XXXX-SUFIJO
-- SUFIJO: C=Customer, A=Artista, S=Staff (vendedor), M=Manager/Owner/Admin (pleno, mismo desbloqueo de gestión).
-- stem fijo; el sufijo se recalcula con roles (suscripción / filas de perfil).

CREATE TABLE IF NOT EXISTS public.mdjb_account_ids (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  stem text NOT NULL
    CHECK (char_length(stem) >= 12),
  class char(1) NOT NULL
    CHECK (class IN ('C', 'A', 'S', 'M')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_mdjb_stem UNIQUE (stem)
);

COMMENT ON TABLE public.mdjb_account_ids IS
  'Código MDJB. M = dueño, owner, admin, manager (acceso pleno). S = vendedor. C/A = comprador / artista.';

CREATE OR REPLACE FUNCTION public._mdjb_make_stem()
RETURNS text
LANGUAGE plpgsql
AS $x$
DECLARE
  s text;
  i int;
BEGIN
  FOR i IN 1..30 LOOP
    s := 'MDJB-' || upper(substr(md5(random()::text || i::text || random()::text), 1, 4)) || '-' ||
         upper(substr(md5(clock_timestamp()::text || random()::text || i::text), 1, 4));
    IF NOT EXISTS (SELECT 1 FROM public.mdjb_account_ids a WHERE a.stem = s) THEN
      RETURN s;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'mdjb: could not allocate unique stem';
END
$x$;

REVOKE ALL ON FUNCTION public._mdjb_make_stem() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.compute_mdjb_letter(p_uid uuid)
RETURNS char(1)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $c$
DECLARE
  dr text;
  fd boolean;
  fc boolean;
BEGIN
  IF p_uid IS NULL THEN
    RETURN 'C';
  END IF;
  fd := EXISTS (SELECT 1 FROM public.dj_profiles d WHERE d.user_id = p_uid);
  fc := EXISTS (SELECT 1 FROM public.client_profiles c WHERE c.user_id = p_uid);
  dr := nullif(
    (SELECT lower(trim(d.role::text)) FROM public.dj_profiles d WHERE d.user_id = p_uid), '');
  /* M: pleno = admin + dueño + manager (igual que owner en desbloqueo) */
  IF dr IS NOT NULL AND dr IN ('admin', 'owner', 'manager') THEN
    RETURN 'M';
  END IF;
  IF dr = 'seller' THEN
    RETURN 'S';
  END IF;
  IF dr IN ('client', 'cliente') THEN
    RETURN 'C';
  END IF;
  IF NOT fd AND fc THEN
    RETURN 'C';
  END IF;
  IF fd AND (dr IS NULL OR dr = '' OR dr NOT IN (
    'admin', 'owner', 'manager', 'seller', 'client', 'cliente'
  ))
  THEN
    RETURN 'A';
  END IF;
  RETURN 'C';
END
$c$;

REVOKE ALL ON FUNCTION public.compute_mdjb_letter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_mdjb_letter(uuid) TO authenticated, service_role;

/* No exponer a la API con uid arbitrario: solo core + snapshot + triggers. */
CREATE OR REPLACE FUNCTION public.mdjb_ensure_code_core(p_uid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $e$
DECLARE
  l char(1);
  st text;
  full_id text;
BEGIN
  IF p_uid IS NULL THEN
    RETURN NULL;
  END IF;
  l := public.compute_mdjb_letter(p_uid);
  SELECT a.stem INTO st FROM public.mdjb_account_ids a WHERE a.user_id = p_uid;
  IF st IS NULL THEN
    st := public._mdjb_make_stem();
    INSERT INTO public.mdjb_account_ids (user_id, stem, class)
    VALUES (p_uid, st, l)
    ON CONFLICT (user_id) DO UPDATE
      SET
        class = EXCLUDED.class,
        updated_at = now();
  ELSE
    UPDATE public.mdjb_account_ids
    SET class = l, updated_at = now()
    WHERE user_id = p_uid;
  END IF;
  SELECT a.stem || '-' || a.class
  INTO full_id
  FROM public.mdjb_account_ids a
  WHERE a.user_id = p_uid;
  RETURN full_id;
END
$e$;

REVOKE ALL ON FUNCTION public.mdjb_ensure_code_core(uuid) FROM PUBLIC;

/* Solo el propio uid (no modificar códigos ajenos). */
CREATE OR REPLACE FUNCTION public.mdjb_ensure_mine()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mdjb_ensure_code_core((SELECT auth.uid()));
$$;

REVOKE ALL ON FUNCTION public.mdjb_ensure_mine() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjb_ensure_mine() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_mdjb_ensure_dj()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $g$
BEGIN
  PERFORM public.mdjb_ensure_code_core(NEW.user_id);
  RETURN NEW;
END
$g$;

CREATE OR REPLACE FUNCTION public.trg_mdjb_ensure_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $h$
BEGIN
  PERFORM public.mdjb_ensure_code_core(NEW.user_id);
  RETURN NEW;
END
$h$;

REVOKE ALL ON FUNCTION public.trg_mdjb_ensure_dj() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_mdjb_ensure_client() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_mdjb_ensure_dj() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.trg_mdjb_ensure_client() TO authenticated, anon, service_role;

DROP TRIGGER IF EXISTS trg_mdjb_after_dj ON public.dj_profiles;
CREATE TRIGGER trg_mdjb_after_dj
  AFTER INSERT OR UPDATE OF role, plan, subscription_status, is_premium
  ON public.dj_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_mdjb_ensure_dj();

DROP TRIGGER IF EXISTS trg_mdjb_after_client ON public.client_profiles;
CREATE TRIGGER trg_mdjb_after_client
  AFTER INSERT
  ON public.client_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_mdjb_ensure_client();

DROP TRIGGER IF EXISTS trg_mdjb_after_client_upd ON public.client_profiles;
CREATE TRIGGER trg_mdjb_after_client_upd
  AFTER UPDATE OF buyer_billing_tier
  ON public.client_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_mdjb_ensure_client();

ALTER TABLE public.mdjb_account_ids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mdjb_ids_select_self_or_staff ON public.mdjb_account_ids;
CREATE POLICY mdjb_ids_select_self_or_staff
  ON public.mdjb_account_ids FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_staff((SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.mdj_access_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid uuid := auth.uid();
  d public.dj_profiles%rowtype;
  c public.client_profiles%rowtype;
  r text;
  pk text;
  st smallint;
  bvip boolean;
  found_d boolean;
  found_c boolean;
  v_mdjb text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_session');
  END IF;

  v_mdjb := public.mdjb_ensure_code_core(v_uid);

  SELECT * INTO d FROM public.dj_profiles WHERE user_id = v_uid;
  found_d := FOUND;
  SELECT * INTO c FROM public.client_profiles WHERE user_id = v_uid;
  found_c := FOUND;

  bvip := false;
  IF found_c AND c.buyer_billing_tier IS NOT NULL THEN
    bvip := lower(trim(c.buyer_billing_tier::text)) = 'vip';
  END IF;

  IF found_d THEN
    r := nullif(lower(trim(d.role::text)), '');
  ELSE
    r := NULL;
  END IF;

  IF found_d AND r IS NOT NULL AND r IN ('admin', 'owner', 'manager', 'seller') THEN
    IF r = 'seller' THEN
      pk := 'staff_seller';
    ELSE
      pk := 'staff_full';
    END IF;
    st := NULL;
  ELSIF NOT found_d AND found_c THEN
    pk := 'buyer';
    st := NULL;
  ELSIF found_d AND (r = 'client' OR r = 'cliente') THEN
    pk := 'buyer';
    st := NULL;
  ELSIF found_d THEN
    pk := 'artist';
    st := public.mdj_artist_commercial_tier(v_uid);
  ELSE
    RETURN jsonb_build_object(
      'ok', true,
      'profile_kind', 'unknown',
      'auth_uid', v_uid::text,
      'mdjb_id', to_jsonb(v_mdjb)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'profile_kind', pk,
    'artist_tier', to_jsonb(st),
    'buyer_vip', bvip,
    'role', to_jsonb(r),
    'mdjb_id', to_jsonb(v_mdjb)
  );
END
$func$;

COMMENT ON FUNCTION public.mdj_access_snapshot() IS
  'Foto de acceso + mdjb_id (formato MDJB-…-C|A|S|M).';

REVOKE ALL ON FUNCTION public.mdj_access_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_access_snapshot() TO authenticated, service_role;

-- Backfill
INSERT INTO public.mdjb_account_ids (user_id, stem, class)
SELECT
  t.user_id,
  public._mdjb_make_stem(),
  public.compute_mdjb_letter(t.user_id)
FROM (
  SELECT user_id FROM public.dj_profiles
  UNION
  SELECT user_id FROM public.client_profiles
) t
ON CONFLICT (user_id) DO UPDATE
  SET
    class = public.compute_mdjb_letter(mdjb_account_ids.user_id),
    updated_at = now();

UPDATE public.mdjb_account_ids a
SET class = public.compute_mdjb_letter(a.user_id), updated_at = now();

NOTIFY pgrst, 'reload schema';
