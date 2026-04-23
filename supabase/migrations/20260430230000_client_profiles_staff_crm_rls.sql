-- CRM Admin: staff lee todos los client_profiles; cualquier usuario sigue viendo la propia fila.
-- Coexiste con la política clásica "Users can view their own client profile" (OR en RLS).
-- Requiere public.is_staff(uuid) (20260430180000_staff_roles_unify_is_staff.sql).

DROP POLICY IF EXISTS client_profiles_staff_select_all ON public.client_profiles;
CREATE POLICY client_profiles_staff_select_all
  ON public.client_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS client_profiles_staff_update_all ON public.client_profiles;
CREATE POLICY client_profiles_staff_update_all
  ON public.client_profiles FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

COMMENT ON POLICY client_profiles_staff_select_all ON public.client_profiles IS
  'SELECT: fila propia (auth.uid = user_id) o todo el CRM si is_staff(auth.uid()).';

COMMENT ON POLICY client_profiles_staff_update_all ON public.client_profiles IS
  'Staff: sync VIP / tier desde bookings u otras herramientas admin.';

NOTIFY pgrst, 'reload schema';
