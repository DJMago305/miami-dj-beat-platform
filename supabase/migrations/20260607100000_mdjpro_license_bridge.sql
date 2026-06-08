-- MDJPRO License Bridge — Fase 1 SQL DRAFT
-- Puente MiamiDJBeat Artist PRO / MDJPRO Standalone ↔ MDJPRO desktop (activate/heartbeat en Fase 2+).
-- NO genera license keys aquí. NO toca stripe-webhook. NO aplica automáticamente hasta deploy manual.
--
-- Regla de negocio (resumen):
--   MDJPRO PREMIUM si MiamiDJBeat Artist PRO activo OR licencia standalone activa.
--   Suspendido cuando ninguna fuente activa (evaluación en mdjpro_effective_status).

-- ── 0) Enums ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mdjpro_license_status') THEN
    CREATE TYPE public.mdjpro_license_status AS ENUM (
      'active',
      'suspended',
      'expired',
      'revoked'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mdjpro_plan_source') THEN
    CREATE TYPE public.mdjpro_plan_source AS ENUM (
      'miamidjbeat_pro',
      'mdjpro_standalone',
      'manual',
      'bundle'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mdjpro_lease_status') THEN
    CREATE TYPE public.mdjpro_lease_status AS ENUM (
      'active',
      'revoked',
      'expired'
    );
  END IF;
END
$$;

COMMENT ON TYPE public.mdjpro_license_status IS 'Estado operativo de la licencia MDJPRO desktop.';
COMMENT ON TYPE public.mdjpro_plan_source IS 'Origen de la licencia: Artist PRO incluida, standalone, manual, bundle.';
COMMENT ON TYPE public.mdjpro_lease_status IS 'Estado de un lease/dispositivo vinculado a la licencia.';

-- ── 1) mdjpro_license_keys ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mdjpro_license_keys (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  dj_profile_user_id         uuid REFERENCES public.dj_profiles (user_id) ON DELETE SET NULL,

  key_prefix                 text NOT NULL,
  key_hash                   text NOT NULL,
  key_last4                  text NOT NULL,

  status                     public.mdjpro_license_status NOT NULL DEFAULT 'active',
  tier                       text NOT NULL DEFAULT 'PREMIUM',

  plan_source                public.mdjpro_plan_source NOT NULL,
  seats_allowed              smallint NOT NULL DEFAULT 2
    CHECK (seats_allowed >= 1 AND seats_allowed <= 5),

  stripe_customer_id         text,
  stripe_subscription_id     text,
  mdb_stripe_subscription_id text,

  issued_at                  timestamptz NOT NULL DEFAULT now(),
  activated_at               timestamptz,
  suspended_at               timestamptz,
  revoked_at                 timestamptz,
  expires_at                 timestamptz,
  last_heartbeat_at          timestamptz,

  plaintext_shown_at         timestamptz,
  recovery_token_hash        text,

  metadata                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mdjpro_license_keys_one_per_user UNIQUE (user_id),
  CONSTRAINT mdjpro_license_keys_key_hash_unique UNIQUE (key_hash),
  CONSTRAINT mdjpro_license_keys_key_prefix_len CHECK (char_length(key_prefix) >= 2),
  CONSTRAINT mdjpro_license_keys_key_last4_len CHECK (char_length(key_last4) >= 4)
);

COMMENT ON TABLE public.mdjpro_license_keys IS
  'Licencia MDJPRO desktop por usuario. key_hash nunca expuesto al browser; usar mdjpro_license_snapshot().';
COMMENT ON COLUMN public.mdjpro_license_keys.key_hash IS
  'SHA-256(normalized_key + server pepper). Solo Edge/service_role en Fase 2+.';
COMMENT ON COLUMN public.mdjpro_license_keys.mdb_stripe_subscription_id IS
  'Referencia a dj_profiles.subscription_id cuando plan_source=miamidjbeat_pro.';
COMMENT ON COLUMN public.mdjpro_license_keys.expires_at IS
  'NULL = vigente mientras la fuente Stripe/sub activa lo mantenga.';

CREATE INDEX IF NOT EXISTS idx_mdjpro_license_keys_status
  ON public.mdjpro_license_keys (status);

CREATE INDEX IF NOT EXISTS idx_mdjpro_license_keys_plan_source
  ON public.mdjpro_license_keys (plan_source);

CREATE INDEX IF NOT EXISTS idx_mdjpro_license_keys_stripe_subscription_id
  ON public.mdjpro_license_keys (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mdjpro_license_keys_mdb_stripe_subscription_id
  ON public.mdjpro_license_keys (mdb_stripe_subscription_id)
  WHERE mdb_stripe_subscription_id IS NOT NULL;

-- ── 2) mdjpro_device_leases ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mdjpro_device_leases (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id           uuid NOT NULL REFERENCES public.mdjpro_license_keys (id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  lease_id             text NOT NULL,
  device_fingerprint   text NOT NULL,
  device_label         text,
  hwid_hash            text,

  status               public.mdjpro_lease_status NOT NULL DEFAULT 'active',
  valid_until          timestamptz NOT NULL,

  app_version          text,
  os_version           text,
  last_seen_at         timestamptz NOT NULL DEFAULT now(),
  revoked_at           timestamptz,
  revoke_reason        text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mdjpro_device_leases_lease_id_unique UNIQUE (lease_id),
  CONSTRAINT mdjpro_device_leases_license_fingerprint_unique
    UNIQUE (license_id, device_fingerprint)
);

COMMENT ON TABLE public.mdjpro_device_leases IS
  'Dispositivos activos por licencia MDJPRO. seats_allowed en mdjpro_license_keys (default 2).';

CREATE INDEX IF NOT EXISTS idx_mdjpro_device_leases_license_id
  ON public.mdjpro_device_leases (license_id);

CREATE INDEX IF NOT EXISTS idx_mdjpro_device_leases_user_id
  ON public.mdjpro_device_leases (user_id);

CREATE INDEX IF NOT EXISTS idx_mdjpro_device_leases_active
  ON public.mdjpro_device_leases (license_id)
  WHERE status = 'active';

-- ── 3) Tablas auxiliares ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mdjpro_activation_attempts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ip                   inet,
  device_fingerprint   text,
  success              boolean NOT NULL,
  error_code           text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mdjpro_activation_attempts IS
  'Auditoría y rate-limit de intentos mdj-activate (Edge Fase 2).';

CREATE INDEX IF NOT EXISTS idx_mdjpro_activation_attempts_created_at
  ON public.mdjpro_activation_attempts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mdjpro_activation_attempts_fingerprint
  ON public.mdjpro_activation_attempts (device_fingerprint, created_at DESC)
  WHERE device_fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mdjpro_license_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id           uuid REFERENCES public.mdjpro_license_keys (id) ON DELETE SET NULL,
  event_type           text NOT NULL,
  source               text NOT NULL,
  payload              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mdjpro_license_events IS
  'Historial: issued, suspended, revoked, reactivated, seat_added (webhook/Edge/admin).';

CREATE INDEX IF NOT EXISTS idx_mdjpro_license_events_license_id
  ON public.mdjpro_license_events (license_id, created_at DESC);

-- ── 4) updated_at triggers ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mdjpro_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_mdjpro_license_keys_updated_at ON public.mdjpro_license_keys;
CREATE TRIGGER trg_mdjpro_license_keys_updated_at
  BEFORE UPDATE ON public.mdjpro_license_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.mdjpro_set_updated_at();

DROP TRIGGER IF EXISTS trg_mdjpro_device_leases_updated_at ON public.mdjpro_device_leases;
CREATE TRIGGER trg_mdjpro_device_leases_updated_at
  BEFORE UPDATE ON public.mdjpro_device_leases
  FOR EACH ROW
  EXECUTE FUNCTION public.mdjpro_set_updated_at();

-- ── 5) Helpers internos (no API pública) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mdjpro_miamidjbeat_pro_active(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_uid IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.dj_profiles d
      WHERE d.user_id = p_uid
        AND lower(coalesce(d.subscription_status, '')) IN ('active', 'trialing')
        AND (
          coalesce(d.is_premium, false) = true
          OR upper(trim(coalesce(d.plan::text, ''))) IN ('PRO', 'ELITE')
          OR coalesce(public.mdj_artist_commercial_tier(p_uid), 0) >= 1
        )
    )
  END
$$;

REVOKE ALL ON FUNCTION public._mdjpro_miamidjbeat_pro_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_miamidjbeat_pro_active(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_standalone_active(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_uid IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.mdjpro_license_keys lk
      WHERE lk.user_id = p_uid
        AND lk.plan_source = 'mdjpro_standalone'::public.mdjpro_plan_source
        AND lk.status = 'active'::public.mdjpro_license_status
    )
  END
$$;

REVOKE ALL ON FUNCTION public._mdjpro_standalone_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_standalone_active(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._mdjpro_count_active_leases(p_license_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(count(*)::integer, 0)
  FROM public.mdjpro_device_leases dl
  WHERE dl.license_id = p_license_id
    AND dl.status = 'active'::public.mdjpro_lease_status
$$;

REVOKE ALL ON FUNCTION public._mdjpro_count_active_leases(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_count_active_leases(uuid) TO service_role;

-- ── 6) RPC: mdjpro_effective_status ───────────────────────────────────────────

DROP FUNCTION IF EXISTS public.mdjpro_effective_status(uuid);

CREATE OR REPLACE FUNCTION public.mdjpro_effective_status(p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_mdb_active       boolean;
  v_standalone_active boolean;
  v_premium          boolean;
  v_lk               public.mdjpro_license_keys%rowtype;
  v_has_license      boolean := false;
  v_seats_allowed    smallint := 2;
  v_seats_used       integer := 0;
  v_status           public.mdjpro_license_status;
  v_sources          jsonb := '[]'::jsonb;
  v_expires_policy   text;
BEGIN
  IF p_uid IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'null_uid'
    );
  END IF;

  v_mdb_active := public._mdjpro_miamidjbeat_pro_active(p_uid);
  v_standalone_active := public._mdjpro_standalone_active(p_uid);
  v_premium := v_mdb_active OR v_standalone_active;

  IF v_mdb_active THEN
    v_sources := v_sources || jsonb_build_array('miamidjbeat_pro');
  END IF;
  IF v_standalone_active THEN
    v_sources := v_sources || jsonb_build_array('mdjpro_standalone');
  END IF;

  SELECT *
  INTO v_lk
  FROM public.mdjpro_license_keys lk
  WHERE lk.user_id = p_uid
  LIMIT 1;

  v_has_license := FOUND;

  IF v_has_license THEN
    v_seats_allowed := v_lk.seats_allowed;
    v_seats_used := public._mdjpro_count_active_leases(v_lk.id);

    IF v_premium THEN
      v_status := CASE
        WHEN v_lk.status = 'revoked'::public.mdjpro_license_status THEN 'revoked'::public.mdjpro_license_status
        ELSE 'active'::public.mdjpro_license_status
      END;
    ELSE
      v_status := CASE
        WHEN v_lk.status = 'revoked'::public.mdjpro_license_status THEN 'revoked'::public.mdjpro_license_status
        WHEN v_lk.status = 'expired'::public.mdjpro_license_status THEN 'expired'::public.mdjpro_license_status
        ELSE 'suspended'::public.mdjpro_license_status
      END;
    END IF;
  ELSE
    v_status := CASE
      WHEN v_premium THEN 'active'::public.mdjpro_license_status
      ELSE 'suspended'::public.mdjpro_license_status
    END;
  END IF;

  IF v_mdb_active AND v_standalone_active THEN
    v_expires_policy := 'while_miamidjbeat_pro_or_standalone_active';
  ELSIF v_mdb_active THEN
    v_expires_policy := 'while_miamidjbeat_pro_active';
  ELSIF v_standalone_active THEN
    v_expires_policy := 'while_mdjpro_standalone_active';
  ELSE
    v_expires_policy := 'none';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_uid::text,
    'effective_premium', v_premium,
    'license_status', v_status::text,
    'plan_sources_active', v_sources,
    'miamidjbeat_pro_active', v_mdb_active,
    'mdjpro_standalone_active', v_standalone_active,
    'seats_allowed', v_seats_allowed,
    'seats_used', v_seats_used,
    'expires_policy', v_expires_policy,
    'has_license_row', v_has_license
  );
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_effective_status(uuid) IS
  'Evalúa PREMIUM efectivo MDJPRO desktop (Artist PRO OR standalone). Sin exponer key_hash.';

REVOKE ALL ON FUNCTION public.mdjpro_effective_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_effective_status(uuid) TO authenticated, service_role;

-- ── 7) RPC: mdjpro_license_snapshot ───────────────────────────────────────────

DROP FUNCTION IF EXISTS public.mdjpro_license_snapshot(uuid);

CREATE OR REPLACE FUNCTION public.mdjpro_license_snapshot(p_uid uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid              uuid := coalesce(p_uid, auth.uid());
  v_caller           uuid := auth.uid();
  v_is_service       boolean := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  ) = 'service_role';
  v_effective        jsonb;
  v_lk               public.mdjpro_license_keys%rowtype;
  v_has_license      boolean := false;
  v_license_display  text;
  v_devices          jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_uid');
  END IF;

  IF NOT v_is_service AND (v_caller IS NULL OR v_caller <> v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  v_effective := public.mdjpro_effective_status(v_uid);

  SELECT *
  INTO v_lk
  FROM public.mdjpro_license_keys lk
  WHERE lk.user_id = v_uid
  LIMIT 1;

  v_has_license := FOUND;

  IF v_has_license THEN
    v_license_display := trim(both FROM coalesce(v_lk.key_prefix, 'MDJP'))
      || '-****-****-****-'
      || coalesce(v_lk.key_last4, '????');

    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'lease_id', dl.lease_id,
        'device_label', dl.device_label,
        'status', dl.status::text,
        'last_seen_at', dl.last_seen_at,
        'valid_until', dl.valid_until
      )
      ORDER BY dl.last_seen_at DESC
    ), '[]'::jsonb)
    INTO v_devices
    FROM public.mdjpro_device_leases dl
    WHERE dl.license_id = v_lk.id
      AND dl.status = 'active'::public.mdjpro_lease_status;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_uid::text,
    'effective', v_effective,
    'license', CASE
      WHEN NOT v_has_license THEN NULL
      ELSE jsonb_build_object(
        'id', v_lk.id::text,
        'status', v_lk.status::text,
        'tier', v_lk.tier,
        'plan_source', v_lk.plan_source::text,
        'license_display', v_license_display,
        'key_prefix', v_lk.key_prefix,
        'key_last4', v_lk.key_last4,
        'seats_allowed', v_lk.seats_allowed,
        'seats_used', coalesce((v_effective ->> 'seats_used')::integer, 0),
        'issued_at', v_lk.issued_at,
        'activated_at', v_lk.activated_at,
        'expires_at', v_lk.expires_at,
        'plaintext_shown_at', v_lk.plaintext_shown_at,
        'last_heartbeat_at', v_lk.last_heartbeat_at
      )
    END,
    'devices', v_devices
  );
END
$fn$;

COMMENT ON FUNCTION public.mdjpro_license_snapshot(uuid) IS
  'Snapshot seguro para CONFIG → Productos. Nunca devuelve key_hash ni license key completa.';

REVOKE ALL ON FUNCTION public.mdjpro_license_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdjpro_license_snapshot(uuid) TO authenticated, service_role;

-- ── 8) RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.mdjpro_license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mdjpro_device_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mdjpro_activation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mdjpro_license_events ENABLE ROW LEVEL SECURITY;

-- mdjpro_license_keys: sin SELECT directo para authenticated (key_hash protegido).
-- Lectura vía mdjpro_license_snapshot() únicamente.
DROP POLICY IF EXISTS mdjpro_license_keys_service_all ON public.mdjpro_license_keys;
CREATE POLICY mdjpro_license_keys_service_all
  ON public.mdjpro_license_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- mdjpro_device_leases: usuario lee sus propios leases activos/histórico.
DROP POLICY IF EXISTS mdjpro_device_leases_select_own ON public.mdjpro_device_leases;
CREATE POLICY mdjpro_device_leases_select_own
  ON public.mdjpro_device_leases
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS mdjpro_device_leases_service_all ON public.mdjpro_device_leases;
CREATE POLICY mdjpro_device_leases_service_all
  ON public.mdjpro_device_leases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- mdjpro_activation_attempts: solo service_role (Edge mdj-activate Fase 2).
DROP POLICY IF EXISTS mdjpro_activation_attempts_service_all ON public.mdjpro_activation_attempts;
CREATE POLICY mdjpro_activation_attempts_service_all
  ON public.mdjpro_activation_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- mdjpro_license_events: usuario lee eventos de su licencia; escritura service_role.
DROP POLICY IF EXISTS mdjpro_license_events_select_own ON public.mdjpro_license_events;
CREATE POLICY mdjpro_license_events_select_own
  ON public.mdjpro_license_events
  FOR SELECT
  TO authenticated
  USING (
    license_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.mdjpro_license_keys lk
      WHERE lk.id = mdjpro_license_events.license_id
        AND lk.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS mdjpro_license_events_service_all ON public.mdjpro_license_events;
CREATE POLICY mdjpro_license_events_service_all
  ON public.mdjpro_license_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 9) Grants de tabla (mínimos) ─────────────────────────────────────────────

REVOKE ALL ON TABLE public.mdjpro_license_keys FROM PUBLIC;
REVOKE ALL ON TABLE public.mdjpro_device_leases FROM PUBLIC;
REVOKE ALL ON TABLE public.mdjpro_activation_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.mdjpro_license_events FROM PUBLIC;

GRANT SELECT ON TABLE public.mdjpro_device_leases TO authenticated;
GRANT SELECT ON TABLE public.mdjpro_license_events TO authenticated;

GRANT ALL ON TABLE public.mdjpro_license_keys TO service_role;
GRANT ALL ON TABLE public.mdjpro_device_leases TO service_role;
GRANT ALL ON TABLE public.mdjpro_activation_attempts TO service_role;
GRANT ALL ON TABLE public.mdjpro_license_events TO service_role;

-- Fin Fase 1 SQL draft
