-- Event notes operativas (manager → DJ) — inbox Agenda / notify-event-note.
-- Estado: APROBADO (Tickets A/B). Aplicar en Supabase tras revisión final de este archivo completo.
-- Post-apply: supabase/scripts/audit_event_notes_rls.sql (5 pruebas RLS).
-- Requiere: public.is_staff_management(uuid) (migraciones 30300000+). Escritura/lectura staff = gestión (no seller).
-- Cliente: web/js/event-weather.js (fetchAndRenderEventNotes, realtime dj_uuid filter).
-- Webhook email: supabase/functions/notify-event-note (type = 'manager', dj_uuid = auth.users.id).

-- ── Tabla ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  dj_uuid uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'manager',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'normal',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_notes_priority_check
    CHECK (priority IN ('low', 'normal', 'high')),
  CONSTRAINT event_notes_type_check
    CHECK (type IN ('manager', 'info', 'urgent'))
);

COMMENT ON TABLE public.event_notes IS
  'Notas operativas del manager hacia el DJ. event_id = public.leads.id o public.mdj_event_flows.id (sin FK única: referencia polimórfica acordada con agenda-engine / Ticket B). dj_uuid = auth.users.id del DJ destinatario (no dj_profiles.id).';

COMMENT ON COLUMN public.event_notes.event_id IS
  'UUID del evento operativo: leads.id o mdj_event_flows.id según origen en Agenda.';

COMMENT ON COLUMN public.event_notes.dj_uuid IS
  'auth.users.id del DJ asignado; usado por RLS, realtime (filter dj_uuid=eq.) y notify-event-note (.eq(user_id, note.dj_uuid) en dj_profiles).';

COMMENT ON COLUMN public.event_notes.type IS
  'notify-event-note solo envía email cuando type = ''manager''.';

-- ── Índices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_event_notes_event_id
  ON public.event_notes (event_id);

CREATE INDEX IF NOT EXISTS idx_event_notes_dj_uuid_created
  ON public.event_notes (dj_uuid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_notes_unread_dj
  ON public.event_notes (dj_uuid)
  WHERE is_read = false;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_notes ENABLE ROW LEVEL SECURITY;

-- Lectura: DJ dueño de la nota
DROP POLICY IF EXISTS event_notes_dj_select ON public.event_notes;
CREATE POLICY event_notes_dj_select
  ON public.event_notes FOR SELECT TO authenticated
  USING (dj_uuid = auth.uid());

-- Lectura: gestión (owner / manager / admin — no seller)
DROP POLICY IF EXISTS event_notes_staff_select ON public.event_notes;
CREATE POLICY event_notes_staff_select
  ON public.event_notes FOR SELECT TO authenticated
  USING (public.is_staff_management(auth.uid()));

-- Escritura: gestión inserta notas hacia un DJ
DROP POLICY IF EXISTS event_notes_staff_insert ON public.event_notes;
CREATE POLICY event_notes_staff_insert
  ON public.event_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_management(auth.uid()));

-- Escritura: gestión actualiza notas (contenido, prioridad, etc.)
DROP POLICY IF EXISTS event_notes_staff_update ON public.event_notes;
CREATE POLICY event_notes_staff_update
  ON public.event_notes FOR UPDATE TO authenticated
  USING (public.is_staff_management(auth.uid()))
  WITH CHECK (public.is_staff_management(auth.uid()));

-- Escritura: DJ solo puede tocar filas propias (columnas restringidas vía trigger abajo)
DROP POLICY IF EXISTS event_notes_dj_update_own ON public.event_notes;
CREATE POLICY event_notes_dj_update_own
  ON public.event_notes FOR UPDATE TO authenticated
  USING (dj_uuid = auth.uid())
  WITH CHECK (dj_uuid = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.event_notes TO authenticated;

-- ── Trigger: DJ no staff solo puede cambiar is_read ───────────────────────────
CREATE OR REPLACE FUNCTION public.event_notes_enforce_dj_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_staff_management(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.dj_uuid THEN
    RAISE EXCEPTION 'event_notes: DJ solo puede actualizar notas propias';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.dj_uuid IS DISTINCT FROM OLD.dj_uuid
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'event_notes: DJ solo puede marcar is_read';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_notes_enforce_dj_update_scope ON public.event_notes;
CREATE TRIGGER trg_event_notes_enforce_dj_update_scope
  BEFORE UPDATE ON public.event_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.event_notes_enforce_dj_update_scope();

COMMENT ON FUNCTION public.event_notes_enforce_dj_update_scope() IS
  'Con RLS OR en UPDATE: is_staff_management edita todo; DJ autenticado solo puede cambiar is_read en filas con dj_uuid = auth.uid(). Seller (is_staff sin gestión) no escribe vía políticas de gestión.';

-- Realtime (Supabase): publicar tabla si el proyecto usa postgres_changes en event_notes.
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.event_notes;

NOTIFY pgrst, 'reload schema';
