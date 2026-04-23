-- Modelo de acceso (candado en datos; el HTML se puede forzar, Postgres no):
--  • Comprador (perfil usuario / client_profiles) — gratis; VIP = lealtad (buyer_billing_tier).
--  • Artista — 1 base gratis (LITE), 2 de pago: 1=PRO, 2=ELITE (dj_profiles; ver mdj_artist_commercial_tier).
--  • Vendedor (seller) — staff, gratis, acceso acotado (is_staff, no is_staff_management).
--  • Admin / owner / manager — staff, gratis, acceso pleno (is_staff_management) en módulos sensibles.
--
-- RPC mdj_access_snapshot() — lectura para la sesión (SECURITY DEFINER) sin confiar en JWT.
-- RLS: mdj_event_flows y mdj_staff_manual_invoices — vendedor solo SELECT; escritura = gestión.

-- ── 1) Tier comercial de artista (0=LITE, 1=PRO vía pago, 2=ELITE) ───────────
-- Staff y rol client en dj_profiles: sin tier comercial (NULL = no aplica).
CREATE OR REPLACE FUNCTION public.mdj_artist_commercial_tier(p_uid uuid)
RETURNS smallint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_uid IS NULL THEN NULL::smallint
    WHEN NOT EXISTS (SELECT 1 FROM public.dj_profiles d WHERE d.user_id = p_uid) THEN 0::smallint
    WHEN (
      SELECT lower(trim(coalesce(d.role, '')))
      FROM public.dj_profiles d
      WHERE d.user_id = p_uid
    ) IN ('admin', 'owner', 'manager', 'seller', 'client') THEN NULL::smallint
    WHEN (SELECT upper(trim(coalesce(d.plan::text, '')))
          FROM public.dj_profiles d WHERE d.user_id = p_uid) = 'ELITE' THEN 2::smallint
    WHEN public.dj_soundfortips_plan_ok(p_uid) THEN 1::smallint
    ELSE 0::smallint
  END
$$;

COMMENT ON FUNCTION public.mdj_artist_commercial_tier(uuid) IS
  '0=LITE gratis, 1=PRO de pago, 2=ELITE. NULL si staff o rol client (comprador). Alineado a dj_soundfortips_plan_ok + plan ELITE.';

REVOKE ALL ON FUNCTION public.mdj_artist_commercial_tier(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_artist_commercial_tier(uuid) TO authenticated, service_role;

-- ── 2) Retorno JSON para el cliente (solo el usuario de la sesión) ───────────
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_session');
  END IF;

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
    RETURN jsonb_build_object('ok', true, 'profile_kind', 'unknown', 'auth_uid', v_uid::text);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'profile_kind', pk,
    'artist_tier', to_jsonb(st),
    'buyer_vip', bvip,
    'role', to_jsonb(r)
  );
END
$func$;

COMMENT ON FUNCTION public.mdj_access_snapshot() IS
  'Foto de acceso: profile_kind, artist_tier (0/1/2), buyer_vip. Solo filas de auth.uid(); use en UI, no reemplaza RLS.';

REVOKE ALL ON FUNCTION public.mdj_access_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_access_snapshot() TO authenticated, service_role;

-- ── 3) Producción: vendedor lee; solo gestión escribe (facturas y flows) ───
DROP POLICY IF EXISTS mdj_event_flows_staff_all ON public.mdj_event_flows;
DROP POLICY IF EXISTS mdj_event_flows_staff_read ON public.mdj_event_flows;
DROP POLICY IF EXISTS mdj_event_flows_mgmt_insert ON public.mdj_event_flows;
DROP POLICY IF EXISTS mdj_event_flows_mgmt_update ON public.mdj_event_flows;
DROP POLICY IF EXISTS mdj_event_flows_mgmt_delete ON public.mdj_event_flows;

CREATE POLICY mdj_event_flows_staff_read
  ON public.mdj_event_flows FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY mdj_event_flows_mgmt_insert
  ON public.mdj_event_flows FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_management(auth.uid()));

CREATE POLICY mdj_event_flows_mgmt_update
  ON public.mdj_event_flows FOR UPDATE TO authenticated
  USING (public.is_staff_management(auth.uid()))
  WITH CHECK (public.is_staff_management(auth.uid()));

CREATE POLICY mdj_event_flows_mgmt_delete
  ON public.mdj_event_flows FOR DELETE TO authenticated
  USING (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS mdj_staff_manual_invoices_staff_all ON public.mdj_staff_manual_invoices;
DROP POLICY IF EXISTS mdj_staff_manual_invoices_staff_read ON public.mdj_staff_manual_invoices;
DROP POLICY IF EXISTS mdj_staff_manual_invoices_mgmt_insert ON public.mdj_staff_manual_invoices;
DROP POLICY IF EXISTS mdj_staff_manual_invoices_mgmt_update ON public.mdj_staff_manual_invoices;
DROP POLICY IF EXISTS mdj_staff_manual_invoices_mgmt_delete ON public.mdj_staff_manual_invoices;

CREATE POLICY mdj_staff_manual_invoices_staff_read
  ON public.mdj_staff_manual_invoices FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY mdj_staff_manual_invoices_mgmt_insert
  ON public.mdj_staff_manual_invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_management(auth.uid()));

CREATE POLICY mdj_staff_manual_invoices_mgmt_update
  ON public.mdj_staff_manual_invoices FOR UPDATE TO authenticated
  USING (public.is_staff_management(auth.uid()))
  WITH CHECK (public.is_staff_management(auth.uid()));

CREATE POLICY mdj_staff_manual_invoices_mgmt_delete
  ON public.mdj_staff_manual_invoices FOR DELETE TO authenticated
  USING (public.is_staff_management(auth.uid()));

GRANT EXECUTE ON FUNCTION public.is_staff_management(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
