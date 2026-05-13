-- Elimina políticas RLS huérfanas en public.event_notes (dejar solo las 5 canónicas).
-- Ejecutar en PRODUCTION solo si audit_event_notes_rls.sql marca policies_count = FAIL.
-- Canónicas: migración 20260513120000_event_notes_operational_inbox.sql
--
-- Legacy duplicadas (roles {public}, pre-migración 20260513120000) — BORRAR:
--   • "DJs can view their own event notes"
--   • "DJs can update their own event notes"

-- 0) Drop explícito de policies viejas por nombre
DROP POLICY IF EXISTS "DJs can view their own event notes" ON public.event_notes;
DROP POLICY IF EXISTS "DJs can update their own event notes" ON public.event_notes;

-- 1) Ver políticas actuales
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'event_notes'
ORDER BY policyname;

-- 2) Borrar cualquier política que NO sea una de las 5 canónicas
DO $$
DECLARE
  pol record;
  canonical text[] := ARRAY[
    'event_notes_dj_select',
    'event_notes_staff_select',
    'event_notes_staff_insert',
    'event_notes_staff_update',
    'event_notes_dj_update_own'
  ];
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_notes'
      AND policyname <> ALL (canonical)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.event_notes', pol.policyname);
    RAISE NOTICE 'Dropped orphan policy: %', pol.policyname;
  END LOOP;
END $$;

-- 3) Re-crear canónicas (idempotente; mismas reglas que la migración)
DROP POLICY IF EXISTS event_notes_dj_select ON public.event_notes;
CREATE POLICY event_notes_dj_select
  ON public.event_notes FOR SELECT TO authenticated
  USING (dj_uuid = auth.uid());

DROP POLICY IF EXISTS event_notes_staff_select ON public.event_notes;
CREATE POLICY event_notes_staff_select
  ON public.event_notes FOR SELECT TO authenticated
  USING (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS event_notes_staff_insert ON public.event_notes;
CREATE POLICY event_notes_staff_insert
  ON public.event_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS event_notes_staff_update ON public.event_notes;
CREATE POLICY event_notes_staff_update
  ON public.event_notes FOR UPDATE TO authenticated
  USING (public.is_staff_management(auth.uid()))
  WITH CHECK (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS event_notes_dj_update_own ON public.event_notes;
CREATE POLICY event_notes_dj_update_own
  ON public.event_notes FOR UPDATE TO authenticated
  USING (dj_uuid = auth.uid())
  WITH CHECK (dj_uuid = auth.uid());

NOTIFY pgrst, 'reload schema';

-- 4) Volver a correr: supabase/scripts/audit_event_notes_rls.sql
