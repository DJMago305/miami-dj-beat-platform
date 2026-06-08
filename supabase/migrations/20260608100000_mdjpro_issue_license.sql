-- MDJPRO License Bridge — Fase 2 SQL DRAFT
-- Emisión segura de license keys MDJPRO para usuarios con PREMIUM efectivo.
-- NO aplicar automáticamente. NO ejecutar INSERT de prueba hasta validación manual.
--
-- Depende de: 20260607100000_mdjpro_license_bridge.sql (tablas + mdjpro_effective_status).

-- Supabase installs pgcrypto in schema extensions; digest() must be schema-qualified
-- when helper functions use SET search_path = public.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── Helpers internos (no API pública) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mdjpro_license_pepper()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(trim(current_setting('app.settings.mdjpro_license_pepper', true)), ''),
    'mdjpro_fase2_dev_pepper_CHANGE_BEFORE_PROD'
  )
$$;

REVOKE ALL ON FUNCTION public._mdjpro_license_pepper() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_license_pepper() TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_random_key_segment(p_len integer DEFAULT 4)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $fn$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_out      text := '';
  v_i        integer;
  v_idx      integer;
BEGIN
  IF p_len IS NULL OR p_len < 1 THEN
    RAISE EXCEPTION 'invalid segment length';
  END IF;

  FOR v_i IN 1..p_len LOOP
    v_idx := 1 + floor(random() * length(v_alphabet))::integer;
    v_out := v_out || substr(v_alphabet, v_idx, 1);
  END LOOP;

  RETURN v_out;
END
$fn$;

REVOKE ALL ON FUNCTION public._mdjpro_random_key_segment(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_random_key_segment(integer) TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_generate_license_key()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $fn$
BEGIN
  RETURN 'MDJP-'
    || public._mdjpro_random_key_segment(4) || '-'
    || public._mdjpro_random_key_segment(4) || '-'
    || public._mdjpro_random_key_segment(4) || '-'
    || public._mdjpro_random_key_segment(4);
END
$fn$;

REVOKE ALL ON FUNCTION public._mdjpro_generate_license_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_generate_license_key() TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_normalize_license_key(p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT upper(regexp_replace(coalesce(p_key, ''), '[^A-Z0-9]', '', 'g'))
$$;

REVOKE ALL ON FUNCTION public._mdjpro_normalize_license_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_normalize_license_key(text) TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_hash_license_key(p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(
    extensions.digest(
      public._mdjpro_normalize_license_key(p_key) || public._mdjpro_license_pepper(),
      'sha256'::text
    ),
    'hex'
  )
$$;

REVOKE ALL ON FUNCTION public._mdjpro_hash_license_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_hash_license_key(text) TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_mask_license_key(p_key text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  v_norm text := public._mdjpro_normalize_license_key(p_key);
BEGIN
  IF length(v_norm) < 4 THEN
    RETURN 'MDJP-****-****-****-????';
  END IF;

  RETURN 'MDJP-****-****-****-' || right(v_norm, 4);
END
$fn$;

REVOKE ALL ON FUNCTION public._mdjpro_mask_license_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_mask_license_key(text) TO service_role;

-- ── RPC: mdjpro_issue_license ───────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.mdjpro_issue_license(uuid, public.mdjpro_plan_source);

CREATE OR REPLACE FUNCTION public.mdjpro_issue_license(
  p_uid uuid,
  p_plan_source public.mdjpro_plan_source DEFAULT 'miamidjbeat_pro'::public.mdjpro_plan_source
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller              uuid := auth.uid();
  v_is_service          boolean := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  ) = 'service_role';
  v_effective           jsonb;
  v_user_exists         boolean := false;
  v_existing            public.mdjpro_license_keys%rowtype;
  v_has_existing        boolean := false;
  v_plaintext           text;
  v_normalized          text;
  v_key_hash            text;
  v_key_prefix          text := 'MDJP';
  v_key_last4           text;
  v_masked              text;
  v_license_id          uuid;
  v_dj_user_id          uuid;
  v_mdb_subscription_id text;
  v_attempts            integer := 0;
  v_max_attempts        constant integer := 12;
BEGIN
  IF p_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'null_uid');
  END IF;

  IF NOT v_is_service
     AND (v_caller IS NULL OR NOT public.is_staff_management(v_caller)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_uid)
  INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'user_not_found', 'user_id', p_uid::text);
  END IF;

  v_effective := public.mdjpro_effective_status(p_uid);

  IF coalesce((v_effective ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'effective_status_failed',
      'user_id', p_uid::text,
      'effective', v_effective
    );
  END IF;

  IF p_plan_source = 'miamidjbeat_pro'::public.mdjpro_plan_source THEN
    IF coalesce((v_effective ->> 'miamidjbeat_pro_active')::boolean, false) IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'not_eligible_miamidjbeat_pro',
        'user_id', p_uid::text,
        'effective', v_effective
      );
    END IF;
  ELSIF p_plan_source = 'manual'::public.mdjpro_plan_source THEN
    NULL;
  ELSE
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'unsupported_plan_source',
      'plan_source', p_plan_source::text
    );
  END IF;

  SELECT d.user_id, d.subscription_id
  INTO v_dj_user_id, v_mdb_subscription_id
  FROM public.dj_profiles d
  WHERE d.user_id = p_uid
  LIMIT 1;

  SELECT *
  INTO v_existing
  FROM public.mdjpro_license_keys lk
  WHERE lk.user_id = p_uid
  LIMIT 1;

  v_has_existing := FOUND;

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > v_max_attempts THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'key_generation_failed');
    END IF;

    v_plaintext := public._mdjpro_generate_license_key();
    v_normalized := public._mdjpro_normalize_license_key(v_plaintext);
    v_key_hash := public._mdjpro_hash_license_key(v_plaintext);
    v_key_last4 := right(v_normalized, 4);
    v_masked := public._mdjpro_mask_license_key(v_plaintext);

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.mdjpro_license_keys lk2
      WHERE lk2.key_hash = v_key_hash
    );
  END LOOP;

  IF v_has_existing THEN
    UPDATE public.mdjpro_license_keys lk
    SET
      key_prefix = v_key_prefix,
      key_hash = v_key_hash,
      key_last4 = v_key_last4,
      status = 'active'::public.mdjpro_license_status,
      tier = 'PREMIUM',
      plan_source = p_plan_source,
      seats_allowed = 2,
      dj_profile_user_id = v_dj_user_id,
      mdb_stripe_subscription_id = CASE
        WHEN p_plan_source = 'miamidjbeat_pro'::public.mdjpro_plan_source THEN v_mdb_subscription_id
        ELSE lk.mdb_stripe_subscription_id
      END,
      issued_at = now(),
      activated_at = NULL,
      suspended_at = NULL,
      revoked_at = NULL,
      expires_at = NULL,
      plaintext_shown_at = NULL,
      updated_at = now()
    WHERE lk.user_id = p_uid
    RETURNING lk.id INTO v_license_id;
  ELSE
    INSERT INTO public.mdjpro_license_keys (
      user_id,
      dj_profile_user_id,
      key_prefix,
      key_hash,
      key_last4,
      status,
      tier,
      plan_source,
      seats_allowed,
      mdb_stripe_subscription_id,
      issued_at
    )
    VALUES (
      p_uid,
      v_dj_user_id,
      v_key_prefix,
      v_key_hash,
      v_key_last4,
      'active'::public.mdjpro_license_status,
      'PREMIUM',
      p_plan_source,
      2,
      CASE
        WHEN p_plan_source = 'miamidjbeat_pro'::public.mdjpro_plan_source THEN v_mdb_subscription_id
        ELSE NULL
      END,
      now()
    )
    RETURNING id INTO v_license_id;
  END IF;

  INSERT INTO public.mdjpro_license_events (
    license_id,
    event_type,
    source,
    payload
  )
  VALUES (
    v_license_id,
    CASE WHEN v_has_existing THEN 'reissued' ELSE 'issued' END,
    'mdjpro_issue_license',
    jsonb_build_object(
      'user_id', p_uid::text,
      'plan_source', p_plan_source::text,
      'caller_uid', v_caller::text,
      'service_role', v_is_service,
      'key_prefix', v_key_prefix,
      'key_last4', v_key_last4
    )
  );

  -- license_key_plaintext MUST be shown to the user exactly once; never store plaintext in DB.
  RETURN jsonb_build_object(
    'ok', true,
    'license_key_plaintext', v_plaintext,
    'masked_key', v_masked,
    'user_id', p_uid::text,
    'status', 'active',
    'seats_allowed', 2,
    'plan_source', p_plan_source::text,
    'license_id', v_license_id::text,
    'reissued', v_has_existing
  );
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_issue_license(uuid, public.mdjpro_plan_source) IS
  'Emite o re-emite licencia MDJPRO. license_key_plaintext en la respuesta JSON solo debe mostrarse UNA vez al usuario; no se persiste en DB.';

REVOKE ALL ON FUNCTION public.mdjpro_issue_license(uuid, public.mdjpro_plan_source) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_issue_license(uuid, public.mdjpro_plan_source) TO service_role;

-- ── Prueba manual (NO ejecutar hasta aplicar migración y autorizar emisión) ───
-- SELECT public.mdjpro_issue_license('3f5d5196-273c-458e-a4af-6b3545422177'::uuid, 'miamidjbeat_pro');
--
-- Verificar snapshot en browser (sesión del usuario):
--   mdjpro_license_snapshot → license ya no null; license_display enmascarado.
-- Guardar license_key_plaintext fuera de DB; no volver a pedir plaintext desde snapshot.
