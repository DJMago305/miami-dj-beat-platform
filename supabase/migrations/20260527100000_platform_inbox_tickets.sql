-- ── Platform Inbox: Tickets + Messages ──────────────────────────────────────
-- Propósito: Mesa de soporte interno — staff (owner/manager/seller) + clientes
--            y artistas pueden abrir/responder tickets. Cualquier staff lee todo.
-- Requires: public.is_staff(uuid) (migraciones anteriores).
-- Cliente: web/account-settings.html (panel Notifications — loadInboxPanel).
-- Soft-delete: deleted_by uuid[] — cuando el uid del lector está en el array,
--              el hilo se oculta para él. DELETE físico solo si ambas partes borraron.

-- ── Tabla de tickets (cabecera del hilo) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_tickets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject      text        NOT NULL DEFAULT '',
  created_by   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open', 'closed')),
  deleted_by   uuid[]      NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_tickets IS
  'Cabecera de cada hilo de soporte/venta. Soft-delete por uid en deleted_by[].';

-- ── Tabla de mensajes del hilo ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_inbox_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid        NOT NULL REFERENCES public.platform_tickets(id) ON DELETE CASCADE,
  from_uid     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_role    text        NOT NULL DEFAULT 'staff'
                             CHECK (from_role IN ('owner','manager','seller','artist','client')),
  from_name    text        NOT NULL DEFAULT '',
  body         text        NOT NULL DEFAULT '',
  is_read      boolean     NOT NULL DEFAULT false,
  deleted_by   uuid[]      NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_inbox_messages IS
  'Mensajes de cada hilo. from_name se resuelve en cliente desde dj_profiles/client_profiles al insertar.';

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plt_tickets_created_by
  ON public.platform_tickets (created_by);

CREATE INDEX IF NOT EXISTS idx_plt_tickets_status
  ON public.platform_tickets (status);

CREATE INDEX IF NOT EXISTS idx_plt_msgs_ticket_id
  ON public.platform_inbox_messages (ticket_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_plt_msgs_from_uid
  ON public.platform_inbox_messages (from_uid);

-- ── RLS: platform_tickets ─────────────────────────────────────────────────────
ALTER TABLE public.platform_tickets ENABLE ROW LEVEL SECURITY;

-- Staff ve todos los tickets (owner/manager/seller)
DROP POLICY IF EXISTS plt_tickets_staff_select ON public.platform_tickets;
CREATE POLICY plt_tickets_staff_select
  ON public.platform_tickets FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Creador (cliente/artista/staff) ve su propio ticket
DROP POLICY IF EXISTS plt_tickets_own_select ON public.platform_tickets;
CREATE POLICY plt_tickets_own_select
  ON public.platform_tickets FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Cualquier autenticado puede abrir un ticket
DROP POLICY IF EXISTS plt_tickets_insert ON public.platform_tickets;
CREATE POLICY plt_tickets_insert
  ON public.platform_tickets FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Staff puede actualizar estado (open/closed) y deleted_by
DROP POLICY IF EXISTS plt_tickets_staff_update ON public.platform_tickets;
CREATE POLICY plt_tickets_staff_update
  ON public.platform_tickets FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Creador puede actualizar deleted_by (para soft-delete propio)
DROP POLICY IF EXISTS plt_tickets_own_update ON public.platform_tickets;
CREATE POLICY plt_tickets_own_update
  ON public.platform_tickets FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ── RLS: platform_inbox_messages ─────────────────────────────────────────────
ALTER TABLE public.platform_inbox_messages ENABLE ROW LEVEL SECURITY;

-- Staff lee todos los mensajes
DROP POLICY IF EXISTS plt_msgs_staff_select ON public.platform_inbox_messages;
CREATE POLICY plt_msgs_staff_select
  ON public.platform_inbox_messages FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Remitente lee sus propios mensajes
DROP POLICY IF EXISTS plt_msgs_own_select ON public.platform_inbox_messages;
CREATE POLICY plt_msgs_own_select
  ON public.platform_inbox_messages FOR SELECT TO authenticated
  USING (from_uid = auth.uid());

-- Cualquier autenticado puede insertar mensajes
DROP POLICY IF EXISTS plt_msgs_insert ON public.platform_inbox_messages;
CREATE POLICY plt_msgs_insert
  ON public.platform_inbox_messages FOR INSERT TO authenticated
  WITH CHECK (from_uid = auth.uid());

-- Staff puede marcar is_read y actualizar deleted_by
DROP POLICY IF EXISTS plt_msgs_staff_update ON public.platform_inbox_messages;
CREATE POLICY plt_msgs_staff_update
  ON public.platform_inbox_messages FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Remitente puede actualizar deleted_by en sus mensajes
DROP POLICY IF EXISTS plt_msgs_own_update ON public.platform_inbox_messages;
CREATE POLICY plt_msgs_own_update
  ON public.platform_inbox_messages FOR UPDATE TO authenticated
  USING (from_uid = auth.uid())
  WITH CHECK (from_uid = auth.uid());

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.platform_tickets         TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.platform_inbox_messages  TO authenticated;

-- ── Trigger: updated_at en tickets ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.plt_tickets_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plt_tickets_updated_at ON public.platform_tickets;
CREATE TRIGGER trg_plt_tickets_updated_at
  BEFORE UPDATE ON public.platform_tickets
  FOR EACH ROW EXECUTE FUNCTION public.plt_tickets_set_updated_at();

-- ── Realtime (habilitar si el proyecto usa postgres_changes) ──────────────────
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_tickets;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_inbox_messages;

NOTIFY pgrst, 'reload schema';
