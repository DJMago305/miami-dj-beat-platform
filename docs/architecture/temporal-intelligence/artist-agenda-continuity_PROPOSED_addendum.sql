-- ─────────────────────────────────────────────────────────────────────────────
-- PROPUESTA (NO aplicada) · Parte 2 — Memoria de eventos y CONTINUIDAD (engagement)
-- Depende de: artist-agenda-matrix_PROPOSED_migration.sql (Parte 1).
--
-- Clasificación (directriz V1→V2): A) Permanente / V2-prep.
--
-- Objetivo: al asignar un evento a un artista queda como MEMORIA de eventos para
-- que el sistema inteligente lea continuidad y engagement año a año.
--
-- REGLA DE NEGOCIO CLAVE — NO PUNITIVA (fail-safe benigno):
--   · Recontratar al mismo DJ en una ocasión recurrente  → SUMA popularidad (positivo).
--   · Vacío de continuidad (no se pidió servicio, o el cliente cambió de DJ):
--       - Si el manager NOTARIZA la razón (recomendado pero ocupado / vacaciones /
--         enfermo / otro evento) → queda PROTEGIDO: no baja la popularidad y se
--         conserva el registro de por qué.
--       - Si NADIE notariza (olvido/accidente) → NO se toma ninguna acción negativa
--         ni baja calificación: SIMPLEMENTE SE PASA POR ALTO (neutral).
--   · La popularidad SOLO acumula (nunca resta). Ningún vacío la reduce.
--   · Ante un PROBLEMA, la notarización se marca para "desarrollo y entrenamiento
--     del sistema" (note_kind='incidente_aprendizaje', for_training=true): es dato
--     de aprendizaje para el sistema inteligente, NO una sanción al DJ.
--
-- GOBERNANZA / USO RESTRINGIDO de las notas:
--   · Solo para uso y desarrollo INTERNO de la empresa.
--   · NO es de uso personal, NO se usa para bullying, NO se toman medidas contra
--     ningún artista. Es material operativo/analítico, no disciplinario.
--   · Notarización: solo el manager (is_staff_management). El Manager IA solo puede
--     crear la nota con una ORDEN EXPLÍCITA del owner (owner_order_ref, obligatoria).
--     El DJ puede LEER las notas sobre sí mismo (transparencia).
--
-- Nombre sugerido al promover:
--   supabase/migrations/20260810121000_artist_agenda_continuity_memory.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) MEMORIA DE OCASIÓN — enlaza eventos recurrentes año a año
-- ═══════════════════════════════════════════════════════════════════════════
-- occasion_key: clave estable de la ocasión recurrente (p.ej. "fiesta-priv:clienteX").
-- Dos eventos con el mismo occasion_key en años distintos = la misma ocasión anual.
ALTER TABLE public.artist_agenda_events
    ADD COLUMN IF NOT EXISTS occasion_key           text,
    ADD COLUMN IF NOT EXISTS is_recurring_occasion  boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_occasion ON public.artist_agenda_events (occasion_key);

COMMENT ON COLUMN public.artist_agenda_events.occasion_key IS
  'Clave de ocasión recurrente para medir continuidad año a año (misma fiesta/cliente/fecha).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) LEDGER DE NOTARIZACIÓN — el manager explica un vacío para PROTEGER al DJ
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.dj_continuity_notes (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- DJ protegido
    occasion_key                text,                 -- ocasión recurrente que se explica
    reference_date              date,                 -- fecha/edición explicada
    reference_event_id          uuid REFERENCES public.artist_agenda_events(id) ON DELETE SET NULL,
    reason                      text NOT NULL
                                CHECK (reason IN ('no_disponible','otro_evento','vacaciones','enfermo','decision_cliente','problema','otro')),
    detail                      text,
    -- Propósito de la nota: proteger popularidad, o registrar un problema para
    -- el desarrollo y entrenamiento del sistema (aprendizaje, NO punitivo):
    note_kind                   text NOT NULL DEFAULT 'proteccion_popularidad'
                                CHECK (note_kind IN ('proteccion_popularidad','incidente_aprendizaje')),
    for_training                boolean NOT NULL DEFAULT true,   -- alimenta desarrollo/entrenamiento del sistema
    -- Procedencia: manager humano, o Manager IA por orden explícita del owner:
    author_kind                 text NOT NULL DEFAULT 'manager'
                                CHECK (author_kind IN ('manager','manager_ia')),
    owner_order_ref             text,   -- orden explícita del owner (obligatoria si author_kind='manager_ia')
    -- El DJ fue recomendado pero no pudo tomar el evento (sigue "en demanda"):
    recommended_but_unavailable boolean NOT NULL DEFAULT true,
    -- Blindaje explícito: esta nota impide que el vacío afecte la popularidad.
    protects_popularity         boolean NOT NULL DEFAULT true,
    notarized_by                uuid NOT NULL REFERENCES auth.users(id),  -- manager que notariza
    notarized_at                timestamptz NOT NULL DEFAULT now(),
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    -- El Manager IA solo puede notarizar con una orden explícita del owner:
    CONSTRAINT ck_ia_requires_owner_order
        CHECK (author_kind <> 'manager_ia' OR owner_order_ref IS NOT NULL)
);

COMMENT ON TABLE public.dj_continuity_notes IS
  'Notarización del manager (o Manager IA por orden del owner) que explica y PROTEGE un vacío de continuidad del DJ. '
  'Sin nota = se pasa por alto (nunca penaliza). USO RESTRINGIDO: solo para uso y desarrollo interno de la empresa; '
  'no es de uso personal, no se usa para bullying ni para tomar medidas contra ningún artista.';

CREATE INDEX IF NOT EXISTS idx_continuity_notes_dj       ON public.dj_continuity_notes (artist_user_id);
CREATE INDEX IF NOT EXISTS idx_continuity_notes_occasion ON public.dj_continuity_notes (occasion_key);

DROP TRIGGER IF EXISTS trg_continuity_notes_updated ON public.dj_continuity_notes;
CREATE TRIGGER trg_continuity_notes_updated BEFORE UPDATE ON public.dj_continuity_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) RLS — el DJ LEE lo suyo (transparencia); solo GESTIÓN notariza
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.dj_continuity_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dj or management reads continuity notes" ON public.dj_continuity_notes;
CREATE POLICY "dj or management reads continuity notes"
    ON public.dj_continuity_notes FOR SELECT TO authenticated
    USING (auth.uid() = artist_user_id OR public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS "management notarizes continuity notes" ON public.dj_continuity_notes;
CREATE POLICY "management notarizes continuity notes"
    ON public.dj_continuity_notes FOR INSERT TO authenticated
    WITH CHECK (public.is_staff_management(auth.uid()) AND notarized_by = auth.uid());

DROP POLICY IF EXISTS "management edits continuity notes" ON public.dj_continuity_notes;
CREATE POLICY "management edits continuity notes"
    ON public.dj_continuity_notes FOR UPDATE TO authenticated
    USING (public.is_staff_management(auth.uid()))
    WITH CHECK (public.is_staff_management(auth.uid()));

DROP POLICY IF EXISTS "management deletes continuity notes" ON public.dj_continuity_notes;
CREATE POLICY "management deletes continuity notes"
    ON public.dj_continuity_notes FOR DELETE TO authenticated
    USING (public.is_staff_management(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) LECTURA: historia de ocasión (respeta RLS del invocador)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_occasion_history
WITH (security_invoker = true) AS
SELECT occasion_key,
       EXTRACT(year FROM COALESCE(starts_at::date, created_at::date))::int AS yr,
       artist_user_id,
       min(COALESCE(starts_at, created_at)) AS when_ts,
       count(*)                              AS events
FROM public.artist_agenda_events
WHERE occasion_key IS NOT NULL
GROUP BY occasion_key, yr, artist_user_id;

COMMENT ON VIEW public.v_occasion_history IS
  'Qué DJ atendió cada ocasión recurrente por año. Base de la medición de continuidad.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) VACÍOS ABIERTOS (para que el manager pueda notarizar — OPCIONAL, no obliga)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.continuity_open_gaps(p_artist uuid)
RETURNS TABLE (occasion_key text, last_year int, note_missing boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (p_artist = auth.uid()
          OR public.is_staff_management(auth.uid())
          OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  RETURN QUERY
  WITH occ AS (
    SELECT DISTINCT occasion_key
    FROM public.artist_agenda_events
    WHERE artist_user_id = p_artist AND occasion_key IS NOT NULL
  ),
  years AS (
    SELECT h.occasion_key, h.yr, bool_or(h.artist_user_id = p_artist) AS had_dj
    FROM public.v_occasion_history h
    JOIN occ USING (occasion_key)
    GROUP BY h.occasion_key, h.yr
  ),
  gaps AS (  -- la ocasión ocurrió pero SIN este DJ
    SELECT y.occasion_key, y.yr FROM years y WHERE NOT y.had_dj
  )
  SELECT g.occasion_key, max(g.yr)::int,
         NOT EXISTS (SELECT 1 FROM public.dj_continuity_notes n
                     WHERE n.artist_user_id = p_artist
                       AND n.occasion_key = g.occasion_key
                       AND n.protects_popularity) AS note_missing
  FROM gaps g
  GROUP BY g.occasion_key;
END;
$$;

COMMENT ON FUNCTION public.continuity_open_gaps(uuid) IS
  'Vacíos de continuidad del DJ. note_missing=true = sin notarizar (benigno: se pasa por alto, NO penaliza).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6) RESUMEN DE POPULARIDAD / ENGAGEMENT — SOLO SUMA (nunca resta)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.dj_engagement_summary(p_artist uuid DEFAULT auth.uid())
RETURNS TABLE (
    rebookings        int,   -- recontrataciones en ocasiones recurrentes (positivo)
    protected_gaps    int,   -- vacíos notarizados/protegidos (recomendado pero no disponible)
    ignored_gaps      int,   -- vacíos sin nota → se pasan por alto (NEUTRAL, no penalizan)
    popularity_points int    -- = rebookings + protected_gaps   (jamás disminuye)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (p_artist = auth.uid()
          OR public.is_staff_management(auth.uid())
          OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  RETURN QUERY
  WITH occ AS (
    SELECT DISTINCT occasion_key
    FROM public.artist_agenda_events
    WHERE artist_user_id = p_artist AND occasion_key IS NOT NULL
  ),
  years AS (
    SELECT h.occasion_key, h.yr, bool_or(h.artist_user_id = p_artist) AS had_dj
    FROM public.v_occasion_history h
    JOIN occ USING (occasion_key)
    GROUP BY h.occasion_key, h.yr
  ),
  gaps AS (
    SELECT y.occasion_key, y.yr FROM years y WHERE NOT y.had_dj
  ),
  gaps_flag AS (
    SELECT g.occasion_key, g.yr,
           EXISTS (SELECT 1 FROM public.dj_continuity_notes n
                   WHERE n.artist_user_id = p_artist
                     AND n.occasion_key = g.occasion_key
                     AND n.protects_popularity) AS protected
    FROM gaps g
  )
  SELECT
    (SELECT count(*)::int FROM years WHERE had_dj),
    (SELECT count(*)::int FROM gaps_flag WHERE protected),
    (SELECT count(*)::int FROM gaps_flag WHERE NOT protected),
    ((SELECT count(*) FROM years WHERE had_dj)
      + (SELECT count(*) FROM gaps_flag WHERE protected))::int;
END;
$$;

COMMENT ON FUNCTION public.dj_engagement_summary(uuid) IS
  'Popularidad no punitiva: solo suma recontrataciones + vacíos protegidos. Los vacíos sin nota se ignoran.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6b) SEÑALES DE ENTRENAMIENTO — problemas notarizados para el sistema inteligente
--     No punitivo: son datos de aprendizaje, no afectan la popularidad del DJ.
--     RLS del invocador: gestión ve todo; el DJ ve lo suyo; service_role (pipeline
--     de entrenamiento) lee sin restricción.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_continuity_training_signals
WITH (security_invoker = true) AS
SELECT id, artist_user_id, occasion_key, reference_date, reference_event_id,
       reason, detail, note_kind, recommended_but_unavailable,
       notarized_by, notarized_at
FROM public.dj_continuity_notes
WHERE for_training;

COMMENT ON VIEW public.v_continuity_training_signals IS
  'Incidentes/notas notarizadas marcadas para desarrollo y entrenamiento del sistema. No punitivo.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 7) GRANTS
-- ═══════════════════════════════════════════════════════════════════════════
GRANT SELECT ON public.v_occasion_history           TO authenticated;
GRANT SELECT ON public.v_continuity_training_signals TO authenticated;
GRANT EXECUTE ON FUNCTION public.continuity_open_gaps(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.dj_engagement_summary(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
