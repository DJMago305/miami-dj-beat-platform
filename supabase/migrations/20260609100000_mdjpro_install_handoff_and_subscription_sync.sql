-- CASO-A-001: Install handoff (web Pro → Mac) + subscription lapse sync (pause/revoke on non-payment).
-- Deploy manually in Supabase; Edge: mdjpro-install-handoff, mdjpro-activate-handoff.

-- Supabase: pgcrypto lives in schema extensions; digest() must be schema-qualified (search_path = public).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── Handoff tokens (one-time, short-lived) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mdjpro_install_handoffs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash      text NOT NULL UNIQUE,
  email           text NOT NULL,
  stage_name      text,
  license_display text,
  expires_at      timestamptz NOT NULL,
  consumed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mdjpro_install_handoffs_user_created
  ON public.mdjpro_install_handoffs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mdjpro_install_handoffs_expires
  ON public.mdjpro_install_handoffs (expires_at)
  WHERE consumed_at IS NULL;

COMMENT ON TABLE public.mdjpro_install_handoffs IS
  'One-time MDJPRO desktop install handoff tokens. Plaintext token never stored; hash only.';

ALTER TABLE public.mdjpro_install_handoffs ENABLE ROW LEVEL SECURITY;

-- No direct client access; RPC + service_role only.

CREATE OR REPLACE FUNCTION public._mdjpro_hash_handoff_token(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(
    extensions.digest(
      upper(trim(coalesce(p_token, ''))) || public._mdjpro_license_pepper(),
      'sha256'::text
    ),
    'hex'
  )
$$;

REVOKE ALL ON FUNCTION public._mdjpro_hash_handoff_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_hash_handoff_token(text) TO service_role;

-- ── RPC: mdjpro_create_install_handoff ────────────────────────────────────────

DROP FUNCTION IF EXISTS public.mdjpro_create_install_handoff(uuid);

CREATE OR REPLACE FUNCTION public.mdjpro_create_install_handoff(p_uid uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid            uuid := coalesce(p_uid, auth.uid());
  v_effective      jsonb;
  v_snap           jsonb;
  v_email          text;
  v_stage          text;
  v_display        text;
  v_token          text;
  v_token_hash     text;
  v_expires        timestamptz := now() + interval '15 minutes';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  v_effective := public.mdjpro_effective_status(v_uid);

  IF coalesce((v_effective ->> 'ok')::boolean, false) IS NOT TRUE
     OR coalesce((v_effective ->> 'effective_premium')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_premium');
  END IF;

  SELECT lower(trim(u.email))
  INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  SELECT nullif(trim(coalesce(d.stage_name, d.dj_name, d.full_name, '')), '')
  INTO v_stage
  FROM public.dj_profiles d
  WHERE d.user_id = v_uid
  LIMIT 1;

  v_snap := public.mdjpro_license_snapshot(v_uid);
  IF coalesce((v_snap ->> 'ok')::boolean, false) IS TRUE THEN
    v_display := nullif(trim(coalesce(v_snap -> 'license' ->> 'license_display', '')), '');
    IF v_display IS NULL THEN
      v_display := nullif(
        trim(
          coalesce(v_snap -> 'license' ->> 'key_prefix', '')
          || '-****-****-****-'
          || coalesce(v_snap -> 'license' ->> 'key_last4', '')
        ),
        '-****-****-****-'
      );
    END IF;
  END IF;

  -- Invalidate prior unconsumed handoffs for this user (single active token).
  UPDATE public.mdjpro_install_handoffs h
  SET consumed_at = coalesce(h.consumed_at, now())
  WHERE h.user_id = v_uid
    AND h.consumed_at IS NULL
    AND h.expires_at > now();

  v_token := upper(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));
  v_token_hash := public._mdjpro_hash_handoff_token(v_token);

  INSERT INTO public.mdjpro_install_handoffs (
    user_id,
    token_hash,
    email,
    stage_name,
    license_display,
    expires_at
  )
  VALUES (
    v_uid,
    v_token_hash,
    coalesce(v_email, ''),
    v_stage,
    v_display,
    v_expires
  );

  RETURN jsonb_build_object(
    'ok', true,
    'handoff_token', v_token,
    'email', coalesce(v_email, ''),
    'stage_name', v_stage,
    'license_display', v_display,
    'expires_at', v_expires
  );
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_create_install_handoff(uuid) IS
  'Pro MDJB user: mint one-time install handoff (15 min). Returns plaintext token once — never log it.';

REVOKE ALL ON FUNCTION public.mdjpro_create_install_handoff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_create_install_handoff(uuid) TO authenticated, service_role;

-- ── RPC: mdjpro_activate_device_for_user (handoff path — no license key in client) ─

DROP FUNCTION IF EXISTS public.mdjpro_activate_device_for_user(uuid, text, text, text, text, text, inet);

CREATE OR REPLACE FUNCTION public.mdjpro_activate_device_for_user(
  p_user_id            uuid,
  p_device_fingerprint text,
  p_hwid_hash          text DEFAULT NULL,
  p_device_label       text DEFAULT NULL,
  p_app_version        text DEFAULT NULL,
  p_os_version         text DEFAULT NULL,
  p_client_ip          inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_fp_norm        text;
  v_lk             public.mdjpro_license_keys%rowtype;
  v_existing_lease public.mdjpro_device_leases%rowtype;
  v_has_lease      boolean := false;
  v_effective      jsonb;
  v_gate_reason    text;
  v_seats_used     integer;
  v_new_lease_id   text;
  v_attempts       integer := 0;
  v_max_attempts   constant integer := 12;
  v_new_lease      public.mdjpro_device_leases%rowtype;
  v_reactivated    boolean := false;
  v_grace          interval := public._mdjpro_offline_grace_interval();
BEGIN
  IF NOT public._mdjpro_is_service_role() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'user_required');
  END IF;

  v_fp_norm := public._mdjpro_normalize_device_fingerprint(p_device_fingerprint);
  IF v_fp_norm IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_fingerprint');
  END IF;

  IF public._mdjpro_activation_rate_limited(v_fp_norm, p_client_ip) THEN
    PERFORM public._mdjpro_log_activation_attempt(p_user_id, v_fp_norm, p_client_ip, false, 'rate_limited');
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  SELECT *
  INTO v_lk
  FROM public.mdjpro_license_keys lk
  WHERE lk.user_id = p_user_id
  ORDER BY lk.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM public._mdjpro_log_activation_attempt(p_user_id, v_fp_norm, p_client_ip, false, 'invalid_key');
    RETURN jsonb_build_object('ok', false, 'reason', 'license_not_found');
  END IF;

  v_gate_reason := public._mdjpro_effective_license_gate(p_user_id, v_lk);
  IF v_gate_reason IS NOT NULL THEN
    RETURN public._mdjpro_activate_fail(
      p_user_id,
      v_fp_norm,
      p_client_ip,
      v_lk.id,
      v_gate_reason,
      'mdjpro_activate_device_for_user'
    );
  END IF;

  PERFORM public._mdjpro_expire_stale_leases(v_lk.id);

  SELECT *
  INTO v_existing_lease
  FROM public.mdjpro_device_leases dl
  WHERE dl.license_id = v_lk.id
    AND dl.device_fingerprint = v_fp_norm
  LIMIT 1;

  v_has_lease := FOUND;

  IF v_has_lease THEN
    UPDATE public.mdjpro_device_leases dl
    SET
      status = 'active'::public.mdjpro_lease_status,
      valid_until = now() + v_grace,
      last_seen_at = now(),
      hwid_hash = nullif(trim(coalesce(p_hwid_hash, dl.hwid_hash)), ''),
      device_label = coalesce(nullif(trim(p_device_label), ''), dl.device_label),
      app_version = nullif(trim(coalesce(p_app_version, '')), ''),
      os_version = nullif(trim(coalesce(p_os_version, '')), ''),
      revoked_at = NULL,
      revoke_reason = NULL,
      updated_at = now()
    WHERE dl.id = v_existing_lease.id
    RETURNING * INTO v_new_lease;

    v_reactivated := true;
  ELSE
    v_seats_used := public._mdjpro_count_active_leases(v_lk.id);

    IF v_seats_used >= v_lk.seats_allowed THEN
      RETURN public._mdjpro_activate_fail(
        p_user_id,
        v_fp_norm,
        p_client_ip,
        v_lk.id,
        'seats_exhausted',
        'mdjpro_activate_device_for_user'
      );
    END IF;

    LOOP
      v_attempts := v_attempts + 1;
      IF v_attempts > v_max_attempts THEN
        RETURN public._mdjpro_activate_fail(
          p_user_id,
          v_fp_norm,
          p_client_ip,
          v_lk.id,
          'lease_id_generation_failed',
          'mdjpro_activate_device_for_user'
        );
      END IF;

      v_new_lease_id := public._mdjpro_generate_lease_id();

      BEGIN
        INSERT INTO public.mdjpro_device_leases (
          license_id,
          user_id,
          lease_id,
          device_fingerprint,
          device_label,
          hwid_hash,
          status,
          valid_until,
          app_version,
          os_version,
          last_seen_at
        )
        VALUES (
          v_lk.id,
          p_user_id,
          v_new_lease_id,
          v_fp_norm,
          nullif(trim(p_device_label), ''),
          nullif(trim(p_hwid_hash), ''),
          'active'::public.mdjpro_lease_status,
          now() + v_grace,
          nullif(trim(coalesce(p_app_version, '')), ''),
          nullif(trim(coalesce(p_os_version, '')), ''),
          now()
        )
        RETURNING * INTO v_new_lease;

        EXIT;
      EXCEPTION
        WHEN unique_violation THEN
          SELECT *
          INTO v_existing_lease
          FROM public.mdjpro_device_leases dl3
          WHERE dl3.license_id = v_lk.id
            AND dl3.device_fingerprint = v_fp_norm
          LIMIT 1;

          IF FOUND THEN
            UPDATE public.mdjpro_device_leases dl
            SET
              status = 'active'::public.mdjpro_lease_status,
              valid_until = now() + v_grace,
              last_seen_at = now(),
              revoked_at = NULL,
              revoke_reason = NULL,
              updated_at = now()
            WHERE dl.id = v_existing_lease.id
            RETURNING * INTO v_new_lease;

            v_reactivated := true;
            EXIT;
          END IF;
      END;
    END LOOP;
  END IF;

  UPDATE public.mdjpro_license_keys lk
  SET
    activated_at = coalesce(lk.activated_at, now()),
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE lk.id = v_lk.id
  RETURNING * INTO v_lk;

  v_effective := public.mdjpro_effective_status(p_user_id);

  PERFORM public._mdjpro_log_activation_attempt(
    p_user_id,
    v_fp_norm,
    p_client_ip,
    true,
    NULL
  );

  PERFORM public._mdjpro_log_license_event(
    v_lk.id,
    CASE WHEN v_reactivated THEN 'device_reactivated' ELSE 'device_activated' END,
    'mdjpro_activate_device_for_user',
    jsonb_build_object(
      'lease_id', v_new_lease.lease_id,
      'device_fingerprint', left(v_fp_norm, 16),
      'handoff', true
    )
  );

  RETURN public._mdjpro_build_activation_ok(v_lk, v_new_lease, v_effective, v_reactivated);
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_activate_device_for_user(uuid, text, text, text, text, text, inet) IS
  'Activate MDJPRO desktop for MiamiDJBeat Pro user without client-side license key (install handoff). service_role only.';

REVOKE ALL ON FUNCTION public.mdjpro_activate_device_for_user(uuid, text, text, text, text, text, inet) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_activate_device_for_user(uuid, text, text, text, text, text, inet) TO service_role;

-- ── RPC: mdjpro_consume_install_handoff ───────────────────────────────────────

DROP FUNCTION IF EXISTS public.mdjpro_consume_install_handoff(text, text, text, text, text, inet);

CREATE OR REPLACE FUNCTION public.mdjpro_consume_install_handoff(
  p_handoff_token        text,
  p_device_fingerprint   text,
  p_hwid_hash            text DEFAULT NULL,
  p_device_label         text DEFAULT NULL,
  p_app_version          text DEFAULT NULL,
  p_os_version           text DEFAULT NULL,
  p_client_ip            inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_hash     text;
  v_row      public.mdjpro_install_handoffs%rowtype;
  v_activate jsonb;
BEGIN
  IF NOT public._mdjpro_is_service_role() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF coalesce(trim(p_handoff_token), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handoff_token_required');
  END IF;

  v_hash := public._mdjpro_hash_handoff_token(p_handoff_token);

  SELECT *
  INTO v_row
  FROM public.mdjpro_install_handoffs h
  WHERE h.token_hash = v_hash
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handoff_invalid');
  END IF;

  IF v_row.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handoff_already_used');
  END IF;

  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handoff_expired');
  END IF;

  v_activate := public.mdjpro_activate_device_for_user(
    v_row.user_id,
    p_device_fingerprint,
    p_hwid_hash,
    p_device_label,
    p_app_version,
    p_os_version,
    p_client_ip
  );

  IF coalesce((v_activate ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_activate;
  END IF;

  UPDATE public.mdjpro_install_handoffs h
  SET consumed_at = now()
  WHERE h.id = v_row.id;

  RETURN v_activate || jsonb_build_object(
    'email', v_row.email,
    'stage_name', v_row.stage_name,
    'license_display', v_row.license_display
  );
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_consume_install_handoff(text, text, text, text, text, text, inet) IS
  'Consume install handoff token + activate device for linked Pro user. service_role only.';

REVOKE ALL ON FUNCTION public.mdjpro_consume_install_handoff(text, text, text, text, text, text, inet) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_consume_install_handoff(text, text, text, text, text, text, inet) TO service_role;

-- ── RPC: subscription lapse / restore (Stripe webhook) ────────────────────────

DROP FUNCTION IF EXISTS public.mdjpro_apply_subscription_lapse(uuid, text);

CREATE OR REPLACE FUNCTION public.mdjpro_apply_subscription_lapse(
  p_uid  uuid,
  p_mode text DEFAULT 'pause'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_lk       public.mdjpro_license_keys%rowtype;
  v_mode     text := lower(trim(coalesce(p_mode, 'pause')));
  v_revoked  integer := 0;
BEGIN
  IF NOT public._mdjpro_is_service_role() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'null_uid');
  END IF;

  SELECT *
  INTO v_lk
  FROM public.mdjpro_license_keys lk
  WHERE lk.user_id = p_uid
    AND lk.plan_source = 'miamidjbeat_pro'::public.mdjpro_plan_source
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'no_miamidjbeat_pro_license');
  END IF;

  IF v_lk.status = 'revoked'::public.mdjpro_license_status THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_revoked');
  END IF;

  UPDATE public.mdjpro_license_keys lk
  SET
    status = 'suspended'::public.mdjpro_license_status,
    suspended_at = coalesce(lk.suspended_at, now()),
    updated_at = now()
  WHERE lk.id = v_lk.id;

  IF v_mode IN ('revoke', 'cancel', 'deleted') THEN
    UPDATE public.mdjpro_device_leases dl
    SET
      status = 'revoked'::public.mdjpro_lease_status,
      revoked_at = now(),
      revoke_reason = 'subscription_lapsed',
      updated_at = now()
    WHERE dl.license_id = v_lk.id
      AND dl.status = 'active'::public.mdjpro_lease_status;

    GET DIAGNOSTICS v_revoked = ROW_COUNT;
  END IF;

  PERFORM public._mdjpro_log_license_event(
    v_lk.id,
    CASE WHEN v_mode IN ('revoke', 'cancel', 'deleted') THEN 'subscription_revoked' ELSE 'subscription_suspended' END,
    'stripe-webhook',
    jsonb_build_object('mode', v_mode, 'leases_revoked', v_revoked)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'license_id', v_lk.id::text,
    'mode', v_mode,
    'leases_revoked', v_revoked
  );
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_apply_subscription_lapse(uuid, text) IS
  'Pause MDJPRO license on payment lapse; revoke active device leases on cancel. service_role only.';

REVOKE ALL ON FUNCTION public.mdjpro_apply_subscription_lapse(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_apply_subscription_lapse(uuid, text) TO service_role;

DROP FUNCTION IF EXISTS public.mdjpro_apply_subscription_restored(uuid);

CREATE OR REPLACE FUNCTION public.mdjpro_apply_subscription_restored(p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_lk public.mdjpro_license_keys%rowtype;
BEGIN
  IF NOT public._mdjpro_is_service_role() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'null_uid');
  END IF;

  IF NOT public._mdjpro_miamidjbeat_pro_active(p_uid) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'pro_not_active');
  END IF;

  SELECT *
  INTO v_lk
  FROM public.mdjpro_license_keys lk
  WHERE lk.user_id = p_uid
    AND lk.plan_source = 'miamidjbeat_pro'::public.mdjpro_plan_source
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'no_license_row');
  END IF;

  IF v_lk.status = 'revoked'::public.mdjpro_license_status THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'manual_revoked');
  END IF;

  UPDATE public.mdjpro_license_keys lk
  SET
    status = 'active'::public.mdjpro_license_status,
    suspended_at = NULL,
    updated_at = now()
  WHERE lk.id = v_lk.id;

  PERFORM public._mdjpro_log_license_event(
    v_lk.id,
    'subscription_reactivated',
    'stripe-webhook',
    jsonb_build_object('restored_at', now())
  );

  RETURN jsonb_build_object('ok', true, 'license_id', v_lk.id::text);
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_apply_subscription_restored(uuid) IS
  'Reactivate MDJPRO license row when Artist PRO subscription is paid/active again. service_role only.';

REVOKE ALL ON FUNCTION public.mdjpro_apply_subscription_restored(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_apply_subscription_restored(uuid) TO service_role;
