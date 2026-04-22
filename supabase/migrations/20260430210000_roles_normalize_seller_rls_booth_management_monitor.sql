-- Orden final Bestia:
-- 1) Normalizar: todas las columnas public.*.role (text) → minúsculas (idempotente).
-- 2) Oficializar seller: reafirmar leads SELECT/UPDATE staff vía is_staff() (admin | manager | seller).
-- 3) Booth: cierres IA (ai_booth_interactions) solo monitoreo dueño/manager — is_staff_management(); no SELECT directo vendedor.
--
-- Requiere aplicadas antes: 20260430180000 (is_staff), 20260430190000 (trigger role), 20260430200000 (GRANT interactions).

-- ── 1) Minúsculas en todas las tablas base con columna `role` (text / varchar) ─────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
     AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'role'
      AND c.data_type IN ('text', 'character varying')
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET role = lower(trim(role)) WHERE role IS NOT NULL AND role <> lower(trim(role))',
      r.table_schema,
      r.table_name
    );
  END LOOP;
END $$;

-- ── 2) Dueño / Manager (sin vendedor): monitoreo operativo + cierres Booth ─────────────
CREATE OR REPLACE FUNCTION public.is_staff_management(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dj_profiles d
    WHERE d.user_id = p_uid
      AND lower(trim(coalesce(d.role, ''))) IN ('admin', 'manager')
  );
$$;

COMMENT ON FUNCTION public.is_staff_management(uuid) IS
  'True cuando dj_profiles.role es admin o manager (dueño / gestión). Monitoreo Booth y datos de cierre IA vinculados a leads.';

GRANT EXECUTE ON FUNCTION public.is_staff_management(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_management(uuid) TO service_role;

COMMENT ON FUNCTION public.is_staff(uuid) IS
  'Staff operativo: admin | manager | seller (normalizado). Incluye vendedor en leads, learning e installers; los cierres raw en ai_booth_interactions usan is_staff_management().';

-- ── 3) Leads: políticas staff con seller oficial (idempotente) ───────────────────────
DROP POLICY IF EXISTS "leads_select_admin" ON public.leads;
DROP POLICY IF EXISTS "leads_update_admin" ON public.leads;

CREATE POLICY "leads_select_admin"
  ON public.leads FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "leads_update_admin"
  ON public.leads FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ── 4) Booth cierres: SELECT solo management (reemplaza política «all staff») ─────────
GRANT SELECT ON TABLE public.ai_booth_interactions TO authenticated;

DROP POLICY IF EXISTS ai_booth_interactions_select_staff ON public.ai_booth_interactions;
DROP POLICY IF EXISTS ai_booth_interactions_select_management ON public.ai_booth_interactions;

CREATE POLICY ai_booth_interactions_select_management
  ON public.ai_booth_interactions
  FOR SELECT
  TO authenticated
  USING (public.is_staff_management(auth.uid()));

COMMENT ON POLICY ai_booth_interactions_select_management ON public.ai_booth_interactions IS
  'Dueño y manager leen cierres IA (vinculación operativa con leads por lead_id); vendedor no accede a esta tabla vía API.';

COMMENT ON TABLE public.ai_booth_interactions IS
  'Cierre de conversación Booth: radar en session_context, resumen, outcome, reflexión IA. Monitoreo: admin/manager; inserts vía booth_save_ai_interaction (anon).';

NOTIFY pgrst, 'reload schema';
