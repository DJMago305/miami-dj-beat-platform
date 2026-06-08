-- MiamiDJBeat Permanent User ID — Fase F5a SQL DRAFT
-- Identificador público permanente MDB-XXX-000001 (paralelo a auth.users, mdjb_account_ids, MDJPRO).
-- NO reemplaza UUID Supabase, MDJB, licencias MDJPRO, Stripe ni username.
-- NO aplicar automáticamente. NO ejecutar backfill hasta autorización manual.

-- ── 0) Secuencias independientes por prefijo ───────────────────────────────────
-- Nunca decrementan; huecos permitidos si hay bajas. No reciclar números.

CREATE SEQUENCE IF NOT EXISTS public.mdj_uid_seq_own START 1 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.mdj_uid_seq_mgr START 1 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.mdj_uid_seq_slr START 1 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.mdj_uid_seq_dj  START 1 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.mdj_uid_seq_art START 1 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.mdj_uid_seq_mus START 1 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.mdj_uid_seq_mc  START 1 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.mdj_uid_seq_cli START 1 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- ── 1) Tabla maestra ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mdj_user_ids (
  user_id       uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  mdj_user_id   text NOT NULL,
  prefix        text NOT NULL
    CHECK (prefix IN ('OWN', 'MGR', 'SLR', 'DJ', 'ART', 'MUS', 'MC', 'CLI')),
  seq_number    integer NOT NULL CHECK (seq_number > 0),
  profile_kind  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_mdj_user_ids_public UNIQUE (mdj_user_id),
  CONSTRAINT uq_mdj_user_ids_prefix_seq UNIQUE (prefix, seq_number),
  CONSTRAINT chk_mdj_user_ids_format CHECK (
    mdj_user_id ~ '^MDB-(OWN|MGR|SLR|DJ|ART|MUS|MC|CLI)-[0-9]{6}$'
  )
);

COMMENT ON TABLE public.mdj_user_ids IS
  'MiamiDJBeat ID permanente (MDB-XXX-000001). Prefijo congelado en primera emisión; no sustituye mdjb_account_ids ni auth.users.id.';
COMMENT ON COLUMN public.mdj_user_ids.prefix IS
  'Prefijo congelado en la primera emisión; no cambia aunque el rol evolucione.';
COMMENT ON COLUMN public.mdj_user_ids.profile_kind IS
  'Clasificación al emitir (owner, manager, dj, client, artist, etc.). Informativo; mdj_user_id no se reescribe.';

CREATE INDEX IF NOT EXISTS idx_mdj_user_ids_public
  ON public.mdj_user_ids (mdj_user_id);

-- ── 2) updated_at ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mdj_user_ids_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_mdj_user_ids_updated_at ON public.mdj_user_ids;
CREATE TRIGGER trg_mdj_user_ids_updated_at
  BEFORE UPDATE ON public.mdj_user_ids
  FOR EACH ROW
  EXECUTE FUNCTION public.mdj_user_ids_set_updated_at();

-- ── 3) Helpers internos ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mdj_uid_next_seq(p_prefix text)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $fn$
BEGIN
  CASE upper(trim(p_prefix))
    WHEN 'OWN' THEN RETURN nextval('public.mdj_uid_seq_own')::integer;
    WHEN 'MGR' THEN RETURN nextval('public.mdj_uid_seq_mgr')::integer;
    WHEN 'SLR' THEN RETURN nextval('public.mdj_uid_seq_slr')::integer;
    WHEN 'DJ'  THEN RETURN nextval('public.mdj_uid_seq_dj')::integer;
    WHEN 'ART' THEN RETURN nextval('public.mdj_uid_seq_art')::integer;
    WHEN 'MUS' THEN RETURN nextval('public.mdj_uid_seq_mus')::integer;
    WHEN 'MC'  THEN RETURN nextval('public.mdj_uid_seq_mc')::integer;
    WHEN 'CLI' THEN RETURN nextval('public.mdj_uid_seq_cli')::integer;
    ELSE RAISE EXCEPTION 'mdj_user_id: invalid prefix %', p_prefix;
  END CASE;
END
$fn$;

REVOKE ALL ON FUNCTION public._mdj_uid_next_seq(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdj_uid_next_seq(text) TO service_role;

CREATE OR REPLACE FUNCTION public._mdj_format_user_id(p_prefix text, p_seq integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'MDB-' || upper(trim(p_prefix)) || '-' || lpad(p_seq::text, 6, '0')
$$;

REVOKE ALL ON FUNCTION public._mdj_format_user_id(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdj_format_user_id(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public._mdj_resolve_prefix_and_kind(p_uid uuid)
RETURNS TABLE (out_prefix text, out_profile_kind text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_dr   text;
  v_fd   boolean := false;
  v_fc   boolean := false;
BEGIN
  IF p_uid IS NULL THEN
    out_prefix := 'ART';
    out_profile_kind := 'unknown';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.dj_profiles d WHERE d.user_id = p_uid) INTO v_fd;
  SELECT EXISTS (SELECT 1 FROM public.client_profiles c WHERE c.user_id = p_uid) INTO v_fc;

  v_dr := nullif(
    (SELECT lower(trim(d.role::text)) FROM public.dj_profiles d WHERE d.user_id = p_uid),
    ''
  );

  IF v_dr IN ('owner', 'admin') THEN
    out_prefix := 'OWN';
    out_profile_kind := v_dr;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_dr = 'manager' THEN
    out_prefix := 'MGR';
    out_profile_kind := 'manager';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_dr = 'seller' THEN
    out_prefix := 'SLR';
    out_profile_kind := 'seller';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_dr = 'dj' THEN
    out_prefix := 'DJ';
    out_profile_kind := 'dj';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_dr IN ('client', 'cliente') THEN
    out_prefix := 'CLI';
    out_profile_kind := 'client';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_dr = 'musician' THEN
    out_prefix := 'MUS';
    out_profile_kind := 'musician';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_dr = 'mc' THEN
    out_prefix := 'MC';
    out_profile_kind := 'mc';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_dr IN ('artist', 'artista') THEN
    out_prefix := 'ART';
    out_profile_kind := 'artist';
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT v_fd AND v_fc THEN
    out_prefix := 'CLI';
    out_profile_kind := 'client';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_fd THEN
    out_prefix := 'ART';
    out_profile_kind := 'artist';
    RETURN NEXT;
    RETURN;
  END IF;

  out_prefix := 'ART';
  out_profile_kind := 'unknown';
  RETURN NEXT;
END
$fn$;

REVOKE ALL ON FUNCTION public._mdj_resolve_prefix_and_kind(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdj_resolve_prefix_and_kind(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._mdj_role_label(p_prefix text, p_profile_kind text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE upper(trim(coalesce(p_prefix, '')))
    WHEN 'OWN' THEN 'Owner'
    WHEN 'MGR' THEN 'Manager'
    WHEN 'SLR' THEN 'Seller'
    WHEN 'DJ'  THEN 'DJ'
    WHEN 'ART' THEN 'Artist'
    WHEN 'MUS' THEN 'Musician'
    WHEN 'MC'  THEN 'MC'
    WHEN 'CLI' THEN 'Client'
    ELSE initcap(coalesce(nullif(trim(p_profile_kind), ''), 'Unknown'))
  END
$$;

REVOKE ALL ON FUNCTION public._mdj_role_label(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdj_role_label(text, text) TO service_role;

-- ── 4) RPC: generate_mdj_user_id ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.generate_mdj_user_id(uuid);

CREATE OR REPLACE FUNCTION public.generate_mdj_user_id(p_uid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_existing     text;
  v_prefix       text;
  v_kind         text;
  v_seq          integer;
  v_public_id    text;
  v_attempts     integer := 0;
  v_max_attempts constant integer := 8;
BEGIN
  IF p_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT m.mdj_user_id
  INTO v_existing
  FROM public.mdj_user_ids m
  WHERE m.user_id = p_uid;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_uid) THEN
    RAISE EXCEPTION 'mdj_user_id: user_not_found %', p_uid;
  END IF;

  SELECT r.out_prefix, r.out_profile_kind
  INTO v_prefix, v_kind
  FROM public._mdj_resolve_prefix_and_kind(p_uid) r
  LIMIT 1;

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > v_max_attempts THEN
      RAISE EXCEPTION 'mdj_user_id: allocation_failed for %', p_uid;
    END IF;

    v_seq := public._mdj_uid_next_seq(v_prefix);
    v_public_id := public._mdj_format_user_id(v_prefix, v_seq);

    BEGIN
      INSERT INTO public.mdj_user_ids (user_id, mdj_user_id, prefix, seq_number, profile_kind)
      VALUES (p_uid, v_public_id, v_prefix, v_seq, v_kind);

      RETURN v_public_id;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT m.mdj_user_id
        INTO v_existing
        FROM public.mdj_user_ids m
        WHERE m.user_id = p_uid;

        IF v_existing IS NOT NULL THEN
          RETURN v_existing;
        END IF;
        -- Colisión prefix+seq_number extremadamente rara: reintentar con nuevo nextval.
    END;
  END LOOP;
END
$fn$;

COMMENT ON FUNCTION public.generate_mdj_user_id(uuid) IS
  'Emite MiamiDJBeat ID permanente una sola vez. Prefijo congelado; nunca UPDATE de mdj_user_id.';

REVOKE ALL ON FUNCTION public.generate_mdj_user_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_mdj_user_id(uuid) TO service_role;

-- ── 5) RPC: mdj_identity_snapshot ────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.mdj_identity_snapshot(uuid);

CREATE OR REPLACE FUNCTION public.mdj_identity_snapshot(p_uid uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid          uuid := coalesce(p_uid, auth.uid());
  v_caller       uuid := auth.uid();
  v_is_service   boolean := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  ) = 'service_role';
  v_row          public.mdj_user_ids%rowtype;
  v_mdj_user_id  text;
  v_role_label   text;
  v_status       text := 'Active';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_uid');
  END IF;

  IF NOT v_is_service AND (v_caller IS NULL OR v_caller <> v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'user_not_found', 'user_id', v_uid::text);
  END IF;

  v_mdj_user_id := public.generate_mdj_user_id(v_uid);

  SELECT *
  INTO v_row
  FROM public.mdj_user_ids m
  WHERE m.user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'issue_failed', 'user_id', v_uid::text);
  END IF;

  v_role_label := public._mdj_role_label(v_row.prefix, v_row.profile_kind);

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_uid::text,
    'mdj_user_id', v_row.mdj_user_id,
    'prefix', v_row.prefix,
    'profile_kind', v_row.profile_kind,
    'role_label', v_role_label,
    'account_status', v_status
  );
END
$fn$;

COMMENT ON FUNCTION public.mdj_identity_snapshot(uuid) IS
  'Snapshot seguro MiamiDJBeat ID para CONFIG → Cuenta / Productos. Lazy-issue vía generate_mdj_user_id().';

REVOKE ALL ON FUNCTION public.mdj_identity_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_identity_snapshot(uuid) TO authenticated, service_role;

-- ── 6) RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.mdj_user_ids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mdj_user_ids_select_own ON public.mdj_user_ids;
CREATE POLICY mdj_user_ids_select_own
  ON public.mdj_user_ids
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS mdj_user_ids_service_all ON public.mdj_user_ids;
CREATE POLICY mdj_user_ids_service_all
  ON public.mdj_user_ids
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.mdj_user_ids FROM PUBLIC;
GRANT SELECT ON TABLE public.mdj_user_ids TO authenticated;
GRANT ALL ON TABLE public.mdj_user_ids TO service_role;

-- ── 7) Backfill (NO EJECUTAR hasta autorización) ─────────────────────────────
-- Orden recomendado: auth.users.created_at ASC por bucket de prefijo.
-- 1) Aplicar esta migración (DDL only).
-- 2) Por cada usuario sin fila en mdj_user_ids:
--      SELECT public.generate_mdj_user_id(u.id) FROM auth.users u
--      WHERE NOT EXISTS (SELECT 1 FROM public.mdj_user_ids m WHERE m.user_id = u.id)
--      ORDER BY u.created_at;
-- 3) Sincronizar secuencias (ejemplo DJ):
--      SELECT setval('public.mdj_uid_seq_dj',
--        coalesce((SELECT max(seq_number) FROM public.mdj_user_ids WHERE prefix = 'DJ'), 0) + 1,
--        false);
--    Repetir para OWN, MGR, SLR, ART, MUS, MC, CLI.
-- 4) Validar:
--      SELECT prefix, count(*), min(seq_number), max(seq_number)
--      FROM public.mdj_user_ids GROUP BY prefix ORDER BY prefix;

-- ── 8) Pruebas manuales (NO EJECUTAR hasta aplicar migración) ─────────────────
-- SELECT public.generate_mdj_user_id('3f5d5196-273c-458e-a4af-6b3545422177'::uuid);
-- SELECT public.mdj_identity_snapshot('3f5d5196-273c-458e-a4af-6b3545422177'::uuid);
-- Browser (sesión propia): await sb.rpc('mdj_identity_snapshot')

NOTIFY pgrst, 'reload schema';
