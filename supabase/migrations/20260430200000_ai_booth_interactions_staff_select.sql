-- AI Booth: permitir que staff (admin | manager | seller) lea cierres en ai_booth_interactions.
-- Requiere: public.is_staff(uuid) (20260430180000_staff_roles_unify_is_staff.sql).

GRANT SELECT ON TABLE public.ai_booth_interactions TO authenticated;

DROP POLICY IF EXISTS ai_booth_interactions_select_staff ON public.ai_booth_interactions;

CREATE POLICY ai_booth_interactions_select_staff
  ON public.ai_booth_interactions
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

COMMENT ON POLICY ai_booth_interactions_select_staff ON public.ai_booth_interactions IS
  'Staff puede ver resumen de negociación, outcome y reflexión IA (sin insert directo; inserts vía booth_save_ai_interaction).';

NOTIFY pgrst, 'reload schema';
