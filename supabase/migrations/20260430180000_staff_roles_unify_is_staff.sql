-- Fase 1: Unificar dj_profiles.role en minúsculas, seller oficial, función is_staff() para RLS.

-- ── 1) Normalizar valores existentes ─────────────────────────────
UPDATE public.dj_profiles
SET role = lower(trim(role))
WHERE role IS NOT NULL
  AND role <> lower(trim(role));

COMMENT ON COLUMN public.dj_profiles.role IS
  'Staff: admin | manager | seller (lowercase). Artist/client rows may use client or other legacy values.';

-- ── 2) Función central para políticas RLS ────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dj_profiles d
    WHERE d.user_id = p_uid
      AND lower(trim(coalesce(d.role, ''))) IN ('admin', 'manager', 'seller')
  );
$$;

COMMENT ON FUNCTION public.is_staff(uuid) IS
  'True when dj_profiles.role is admin, manager, or seller (normalized). Used by RLS instead of inline string checks.';

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO service_role;

-- ── 3) leads: reemplazar comparaciones por is_staff(auth.uid()) ──
DROP POLICY IF EXISTS "leads_select_admin" ON public.leads;
DROP POLICY IF EXISTS "leads_update_admin" ON public.leads;

CREATE POLICY "leads_select_admin"
  ON public.leads FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "leads_update_admin"
  ON public.leads FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ── 4) AI booth learning: alinear con is_staff (antes solo MANAGER mayúsculas) ──
DROP POLICY IF EXISTS ai_booth_learning_examples_select_manager ON public.ai_booth_learning_examples;

CREATE POLICY ai_booth_learning_examples_select_staff
  ON public.ai_booth_learning_examples FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- ── 5) Storage installers: staff (no solo MANAGER mayúsculas) ───
DROP POLICY IF EXISTS "Managers can upload installers" ON storage.objects;
DROP POLICY IF EXISTS "Managers can update installers" ON storage.objects;

CREATE POLICY "Staff can upload installers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'installers'
    AND public.is_staff(auth.uid())
  );

CREATE POLICY "Staff can update installers"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'installers'
    AND public.is_staff(auth.uid())
  );

NOTIFY pgrst, 'reload schema';
