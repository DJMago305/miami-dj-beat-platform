-- ─────────────────────────────────────────────────────────────────────────────
-- PROPUESTA (NO aplicada) · Opción A — Calendario Operacional Inteligente
-- Fundación de datos: herramienta del Artista (aislada) + Owner · Matrix.
--
-- Clasificación (directriz V1→V2): A) Permanente / V2-prep. Re-arquitectura de la
-- agenda del artista. NO es mantenimiento V1 ni componente transitorio.
--
-- Encaja con el esquema existente:
--   · Artistas = filas de public.dj_profiles (user_id → auth.users).
--   · Roles/gestión = public.is_staff_management(uuid)  [admin|owner|manager].
--   · Trigger reutilizado: public.update_updated_at_column().
--
-- Principio de seguridad (el corazón del diseño):
--   1) Cada artista solo ve SUS datos            → auth.uid() = artist_user_id
--   2) El Owner/Matrix ve TODO, pero SOLO de los
--      artistas que dieron consentimiento         → is_staff_management() + EXISTS(consent)
--   3) El envío de notificaciones / agente IA corre server-side (service_role),
--      pero la lectura del Matrix sigue filtrada por consentimiento.
--
-- Nombre sugerido al promover a migración:
--   supabase/migrations/20260810120000_artist_agenda_matrix_foundation.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) CONSENTIMIENTO (la "compuerta" — T&C, primer ingreso a la pestaña Agenda)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.artist_agenda_consent (
    artist_user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    accepted_at             timestamptz NOT NULL DEFAULT now(),
    terms_version           text        NOT NULL DEFAULT 'v1',
    allow_professional_use  boolean     NOT NULL DEFAULT true,   -- uso profesional de sus datos
    allow_publicity         boolean     NOT NULL DEFAULT true,   -- publicidad para conseguir eventos
    revoked_at              timestamptz,                          -- NULL = vigente
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.artist_agenda_consent IS
  'Consentimiento T&C del artista (una sola vez). Es el único paso por el que sus datos llegan al Matrix.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) CONTACTOS DEL ARTISTA (base de datos de clientes potenciales, aislada)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.artist_contacts (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- dueño del contacto
    full_name          text NOT NULL,
    email              text,
    phone              text,
    birthday           date,          -- fecha recurrente (se ignora el año)
    anniversary        date,          -- aniversario como cliente (se ignora el año)
    preferred_channel  text NOT NULL DEFAULT 'whatsapp'
                        CHECK (preferred_channel IN ('whatsapp','sms','email','instagram')),
    status             text NOT NULL DEFAULT 'potencial'
                        CHECK (status IN ('potencial','activo','vip')),
    notes              text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.artist_contacts IS
  'Contactos/leads personales de cada artista. Aislados: cada artista solo ve los suyos; el Owner ve todos (con consentimiento).';

CREATE INDEX IF NOT EXISTS idx_artist_contacts_owner   ON public.artist_contacts (artist_user_id);
CREATE INDEX IF NOT EXISTS idx_artist_contacts_status  ON public.artist_contacts (artist_user_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) EVENTOS DE AGENDA DEL ARTISTA (calendario personal / operativo)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.artist_agenda_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           text NOT NULL,
    category        text NOT NULL DEFAULT 'otro'
                     CHECK (category IN ('set','staff','prod','pago','clima','cliente','otro')),
    starts_at       timestamptz,
    ends_at         timestamptz,
    all_day         boolean NOT NULL DEFAULT false,
    venue           text,
    contact_id      uuid REFERENCES public.artist_contacts(id) ON DELETE SET NULL, -- origen: cumpleaños/aniversario
    source          text NOT NULL DEFAULT 'manual',   -- manual | booking | birthday | anniversary | ia
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.artist_agenda_events IS
  'Calendario operativo por artista. El Owner lo consolida en el Matrix (solo artistas con consentimiento).';

CREATE INDEX IF NOT EXISTS idx_artist_events_owner_time ON public.artist_agenda_events (artist_user_id, starts_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) TRIGGERS updated_at (reutiliza public.update_updated_at_column())
-- ═══════════════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_consent_updated  ON public.artist_agenda_consent;
CREATE TRIGGER trg_consent_updated  BEFORE UPDATE ON public.artist_agenda_consent
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_contacts_updated ON public.artist_contacts;
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.artist_contacts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_events_updated   ON public.artist_agenda_events;
CREATE TRIGGER trg_events_updated   BEFORE UPDATE ON public.artist_agenda_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) HELPER: próxima ocurrencia de una fecha recurrente (ignora el año)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.next_recurring_date(p_md date, p_from date DEFAULT current_date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE y int := EXTRACT(year FROM p_from)::int; d date;
BEGIN
  IF p_md IS NULL THEN RETURN NULL; END IF;
  BEGIN d := make_date(y,   EXTRACT(month FROM p_md)::int, EXTRACT(day FROM p_md)::int);
  EXCEPTION WHEN others THEN d := make_date(y,   3, 1); END;   -- 29-feb en año no bisiesto → 1-mar
  IF d < p_from THEN
    BEGIN d := make_date(y+1, EXTRACT(month FROM p_md)::int, EXTRACT(day FROM p_md)::int);
    EXCEPTION WHEN others THEN d := make_date(y+1, 3, 1); END;
  END IF;
  RETURN d;
END;
$$;

COMMENT ON FUNCTION public.next_recurring_date(date, date) IS
  'Próxima fecha (>= p_from) de un cumpleaños/aniversario, ignorando el año.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6) RLS — AISLAMIENTO POR ARTISTA + VISTA MATRIX SOLO OWNER/GESTIÓN
-- ═══════════════════════════════════════════════════════════════════════════

-- 6.1 Consentimiento -----------------------------------------------------------
ALTER TABLE public.artist_agenda_consent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist manages own consent" ON public.artist_agenda_consent;
CREATE POLICY "artist manages own consent"
    ON public.artist_agenda_consent FOR ALL TO authenticated
    USING (auth.uid() = artist_user_id)
    WITH CHECK (auth.uid() = artist_user_id);

DROP POLICY IF EXISTS "management reads consent" ON public.artist_agenda_consent;
CREATE POLICY "management reads consent"
    ON public.artist_agenda_consent FOR SELECT TO authenticated
    USING (public.is_staff_management(auth.uid()));

-- 6.2 Contactos ----------------------------------------------------------------
ALTER TABLE public.artist_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist owns contacts" ON public.artist_contacts;
CREATE POLICY "artist owns contacts"
    ON public.artist_contacts FOR ALL TO authenticated
    USING (auth.uid() = artist_user_id)
    WITH CHECK (auth.uid() = artist_user_id);

-- Owner/Matrix: SELECT de TODOS, pero SOLO artistas con consentimiento vigente.
DROP POLICY IF EXISTS "matrix reads consented contacts" ON public.artist_contacts;
CREATE POLICY "matrix reads consented contacts"
    ON public.artist_contacts FOR SELECT TO authenticated
    USING (
        public.is_staff_management(auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.artist_agenda_consent c
            WHERE c.artist_user_id = artist_contacts.artist_user_id
              AND c.revoked_at IS NULL
              AND c.allow_professional_use
        )
    );

-- 6.3 Eventos ------------------------------------------------------------------
ALTER TABLE public.artist_agenda_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist owns events" ON public.artist_agenda_events;
CREATE POLICY "artist owns events"
    ON public.artist_agenda_events FOR ALL TO authenticated
    USING (auth.uid() = artist_user_id)
    WITH CHECK (auth.uid() = artist_user_id);

DROP POLICY IF EXISTS "matrix reads consented events" ON public.artist_agenda_events;
CREATE POLICY "matrix reads consented events"
    ON public.artist_agenda_events FOR SELECT TO authenticated
    USING (
        public.is_staff_management(auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.artist_agenda_consent c
            WHERE c.artist_user_id = artist_agenda_events.artist_user_id
              AND c.revoked_at IS NULL
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 7) LECTURAS DE ALTO NIVEL
-- ═══════════════════════════════════════════════════════════════════════════

-- 7.1 Vista del artista: sus próximos recordatorios (security_invoker → aplica su RLS)
CREATE OR REPLACE VIEW public.v_my_agenda_reminders
WITH (security_invoker = true) AS
SELECT c.artist_user_id,
       c.id AS contact_id,
       c.full_name,
       k.kind,
       public.next_recurring_date(k.d)                     AS occurs_on,
       (public.next_recurring_date(k.d) - current_date)    AS days_until,
       c.status, c.preferred_channel, c.email, c.phone
FROM public.artist_contacts c
CROSS JOIN LATERAL (VALUES ('cumpleaños', c.birthday), ('aniversario', c.anniversary)) AS k(kind, d)
WHERE k.d IS NOT NULL;

COMMENT ON VIEW public.v_my_agenda_reminders IS
  'Recordatorios del artista autenticado (RLS del invocador). El artista solo ve los suyos.';

-- 7.2 Matrix / disparador: próximos cumpleaños-aniversarios de artistas con consentimiento.
--     Gate: owner/gestión (UI) o service_role (automatización server-side).
CREATE OR REPLACE FUNCTION public.matrix_upcoming_recurring(p_days int DEFAULT 30)
RETURNS TABLE (
    artist_user_id uuid, contact_id uuid, full_name text, kind text,
    occurs_on date, days_until int, status text, channel text, email text, phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT c.artist_user_id, c.id, c.full_name, k.kind,
           public.next_recurring_date(k.d),
           (public.next_recurring_date(k.d) - current_date),
           c.status, c.preferred_channel, c.email, c.phone
    FROM public.artist_contacts c
    JOIN public.artist_agenda_consent ac
      ON ac.artist_user_id = c.artist_user_id
     AND ac.revoked_at IS NULL
     AND ac.allow_professional_use
    CROSS JOIN LATERAL (VALUES ('cumpleaños', c.birthday), ('aniversario', c.anniversary)) AS k(kind, d)
    WHERE k.d IS NOT NULL
      AND (public.next_recurring_date(k.d) - current_date) BETWEEN 0 AND p_days
      AND (public.is_staff_management(auth.uid()) OR auth.role() = 'service_role')
    ORDER BY (public.next_recurring_date(k.d) - current_date);
$$;

COMMENT ON FUNCTION public.matrix_upcoming_recurring(int) IS
  'Motor de disparadores: próximas fechas recurrentes de artistas con consentimiento. Solo owner/gestión o service_role.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 8) GRANTS
-- ═══════════════════════════════════════════════════════════════════════════
GRANT SELECT ON public.v_my_agenda_reminders TO authenticated;
GRANT EXECUTE ON FUNCTION public.matrix_upcoming_recurring(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_recurring_date(date, date) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
