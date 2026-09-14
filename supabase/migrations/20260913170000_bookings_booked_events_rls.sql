-- Entorno: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- Hallazgo de auditoría de solo-lectura (2026-09-13): public.bookings y
-- public.booked_events tenían relrowsecurity=false Y grants explícitos a
-- `anon` para SELECT/INSERT/UPDATE/DELETE/TRUNCATE (confirmado vía
-- information_schema.role_table_grants + pg_class.relrowsecurity). La
-- anon/publishable key ya vive en el bundle del cliente (web/supabase-config.js),
-- así que cualquiera podía leer, mutar o vaciar estas dos tablas sin ninguna
-- restricción de fila, sin pasar por ninguna UI.
--
-- bookings expone PII de cliente + datos financieros (client_name,
-- client_contact, event_date, event_type, assigned_dj_id, assigned_dj_name,
-- status, total_amount). booked_events expone agenda operativa (dj_id, venue,
-- city, start_time, end_time, status).
--
-- Se confirmó código real que SÍ usa `bookings` (grep de `.from('bookings')`
-- en web/*.html) antes de cerrar el candado -- el hallazgo original decía
-- "sin referencias", pero admin-dashboard.html y staff-admin.html sí
-- lo usan (Módulo 5: syncBookingFromLead/processInvoice hacen upsert;
-- Módulo 7: syncClientVipFromBooking hace select). Ambos archivos son
-- consola de staff y ya dependen de sesión real de Supabase Auth
-- (sb.auth.getSession() en uso extensivo) + public.is_staff(auth.uid())
-- en el resto de la plataforma -- por eso la policy de staff cubre ese
-- flujo sin romperlo. `booked_events` sí está huérfana de código (0 filas,
-- ninguna referencia en web/*.html ni web/*.js), pero el patrón se deja
-- igual de estricto por consistencia y porque no hay caso de uso anon.
--
-- Mismo patrón que ya usan public.leads (leads_select_client_email/
-- leads_select_assigned_dj/leads_select_admin) y public.dj_events
-- (auth.uid() = dj_user_id + policy de gestión): cero acceso anon,
-- staff con acceso total vía public.is_staff(), y el DJ asignado viendo
-- solo sus propias filas uniendo contra dj_profiles.
--
-- Verificado en vivo (solo lectura, auditoría forense 2026-09-13) antes de
-- escribir esta versión:
--   - bookings.assigned_dj_id NO tiene FK formal, pero la única fila real
--     hace match con dj_profiles.id (no con dj_profiles.user_id) -- y el
--     código de admin-dashboard.html arma el payload con dj.id de un
--     SELECT id FROM dj_profiles. Confirmado por dato real + código real.
--   - booked_events.dj_id SÍ tiene FK formal (booked_events_dj_id_fkey):
--     REFERENCES dj_profiles(user_id), no dj_profiles(id). Como
--     dj_profiles.user_id a su vez referencia auth.users(id)
--     (dj_profiles_user_id_fkey), booked_events.dj_id YA ES auth.users.id
--     por cadena de FK -- no hace falta unir contra dj_profiles en absoluto.
-- La primera versión de este archivo comparaba booked_events.dj_id contra
-- dj_profiles.id (el mismo patrón que bookings, por analogía incorrecta) --
-- defecto P0-1 encontrado en auditoría forense, corregido abajo antes de
-- aplicar nada a producción.
--
-- P2-1 (alcance de DELETE): is_staff() incluye 'seller'. Ningún flujo real
-- en el repo borra filas de bookings/booked_events (solo upsert/select) --
-- por decisión del PO, el DELETE queda restringido a is_staff_management()
-- (admin/owner/manager, sin seller); SELECT/INSERT/UPDATE se quedan en
-- is_staff() como estaba.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.bookings') IS NULL THEN
    RAISE EXCEPTION 'public.bookings no existe en este entorno -- abortando migración';
  END IF;
  IF to_regclass('public.booked_events') IS NULL THEN
    RAISE EXCEPTION 'public.booked_events no existe en este entorno -- abortando migración';
  END IF;
END $$;

-- ── public.bookings ─────────────────────────────────────────────────────
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookings', pol);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.bookings FROM PUBLIC;
REVOKE ALL ON TABLE public.bookings FROM anon;
REVOKE ALL ON TABLE public.bookings FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;

CREATE POLICY "bookings_select_staff"
  ON public.bookings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "bookings_insert_staff"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "bookings_update_staff"
  ON public.bookings FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "bookings_delete_management"
  ON public.bookings FOR DELETE TO authenticated
  USING (public.is_staff_management(auth.uid()));

CREATE POLICY "bookings_select_assigned_dj"
  ON public.bookings FOR SELECT TO authenticated
  USING (
    assigned_dj_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.dj_profiles dj
      WHERE dj.id = bookings.assigned_dj_id
        AND dj.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.bookings IS
  'RLS: sin acceso anon. Staff (public.is_staff) lee/inserta/actualiza; solo gestión (public.is_staff_management, sin seller) borra. DJ asignado ve solo sus propias filas (assigned_dj_id -> dj_profiles.id).';

-- ── public.booked_events ────────────────────────────────────────────────
ALTER TABLE public.booked_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'booked_events'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.booked_events', pol);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.booked_events FROM PUBLIC;
REVOKE ALL ON TABLE public.booked_events FROM anon;
REVOKE ALL ON TABLE public.booked_events FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booked_events TO authenticated;
GRANT ALL ON TABLE public.booked_events TO service_role;

CREATE POLICY "booked_events_select_staff"
  ON public.booked_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "booked_events_insert_staff"
  ON public.booked_events FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "booked_events_update_staff"
  ON public.booked_events FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "booked_events_delete_management"
  ON public.booked_events FOR DELETE TO authenticated
  USING (public.is_staff_management(auth.uid()));

-- dj_id referencia dj_profiles(user_id) [FK real: booked_events_dj_id_fkey],
-- y dj_profiles.user_id referencia auth.users(id) [FK real:
-- dj_profiles_user_id_fkey] -- por cadena de FK, dj_id YA ES auth.uid(),
-- sin necesidad de unir contra dj_profiles (a diferencia de bookings.assigned_dj_id,
-- que sí referencia dj_profiles.id).
CREATE POLICY "booked_events_select_own_dj"
  ON public.booked_events FOR SELECT TO authenticated
  USING (
    dj_id IS NOT NULL
    AND dj_id = auth.uid()
  );

COMMENT ON TABLE public.booked_events IS
  'RLS: sin acceso anon. Staff (public.is_staff) lee/inserta/actualiza; solo gestión (public.is_staff_management, sin seller) borra. DJ ve solo sus propias filas (dj_id = auth.uid(), vía FK a dj_profiles.user_id).';

-- ── Confirmación de esquema (falla el COMMIT si algo no calza) ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'bookings' AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS no quedó activo en public.bookings';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'booked_events' AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS no quedó activo en public.booked_events';
  END IF;
END $$;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('bookings', 'booked_events')
  AND grantee = 'anon';

NOTIFY pgrst, 'reload schema';

COMMIT;
