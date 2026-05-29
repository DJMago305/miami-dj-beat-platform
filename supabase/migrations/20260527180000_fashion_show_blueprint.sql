-- ══════════════════════════════════════════════════════════════════════════════
-- FASHION SHOW BLUEPRINT — Miami DJ Beat
-- Tablas: event_show_plans · show_cue_blocks · runway_lineup
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. TABLA MAESTRA DEL PLAN ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_show_plans (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificación del evento
  event_type        TEXT        NOT NULL DEFAULT 'fashion_show',
  event_name        TEXT,
  designer_brand    TEXT,
  producer_director TEXT,

  -- Logística
  event_date_text   TEXT,                 -- "Sábado 14 jun 2026" (human-readable)
  schedule          TEXT,                 -- "6:00 PM – 11:00 PM"
  venue             TEXT,
  dj_name           TEXT,
  mc_name           TEXT,
  music_format      TEXT,

  -- Escaleteado — tiempos clave
  backstage_gate    TEXT,
  mua_start         TEXT,
  sound_check       TEXT,
  first_look        TEXT,
  doors_open        TEXT,
  show_start        TEXT,
  show_end          TEXT,
  afterparty        TEXT,
  load_out          TEXT,
  general_notes     TEXT,

  -- Cue-to-Cue y Runway Lineup como JSON (estructura editable, sin schema forzado)
  -- Alternativa relacional: show_cue_blocks y runway_lineup (ver tablas 2 y 3)
  cue_blocks        JSONB,
  runway_lineup     JSONB,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice por usuario + nombre de evento (base para upsert)
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_show_plans_user_name
  ON public.event_show_plans (user_id, event_name)
  WHERE event_name IS NOT NULL;

-- Índice para filtrar por tipo de evento
CREATE INDEX IF NOT EXISTS idx_event_show_plans_type ON public.event_show_plans (event_type);

-- ── 2. TABLA RELACIONAL: CUE BLOCKS (Minuto a Minuto) ───────────────────────
CREATE TABLE IF NOT EXISTS public.show_cue_blocks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID        NOT NULL REFERENCES public.event_show_plans(id) ON DELETE CASCADE,
  sort_order      SMALLINT    NOT NULL DEFAULT 0,

  time_start      TEXT,                  -- "03:00" (MM:SS o HH:MM)
  time_end        TEXT,                  -- "03:30"

  block_name      TEXT,                  -- "Blackout & Opening"
  audio_cue       TEXT,                  -- "CUE 1: Corte seco → voz en off…"
  lighting_visual TEXT,                  -- "Apagón 3 seg → strobo blanco…"
  backstage_action TEXT,                 -- "Diseñador 1 / Modelo 1 en punto de salida"
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_show_cue_blocks_plan ON public.show_cue_blocks (plan_id, sort_order);

-- ── 3. TABLA RELACIONAL: RUNWAY LINEUP (Hoja de Salidas) ────────────────────
CREATE TABLE IF NOT EXISTS public.runway_lineup (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID        NOT NULL REFERENCES public.event_show_plans(id) ON DELETE CASCADE,
  sort_order       SMALLINT    NOT NULL DEFAULT 0,

  designer_name    TEXT,
  collection_name  TEXT,
  number_of_looks  SMALLINT    DEFAULT 6,

  music_track      TEXT,                 -- Track / playlist para esta colección
  lighting_preset  TEXT,                 -- "Pasarela limpia · luces blancas"
  video_wall_asset TEXT,                 -- URL de video o descripción del asset
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runway_lineup_plan ON public.runway_lineup (plan_id, sort_order);

-- ── 4. FUNCIÓN: updated_at automático ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_show_plans_updated_at ON public.event_show_plans;
CREATE TRIGGER trg_event_show_plans_updated_at
  BEFORE UPDATE ON public.event_show_plans
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

-- ── 5. RLS (Row Level Security) ───────────────────────────────────────────────
ALTER TABLE public.event_show_plans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.show_cue_blocks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runway_lineup     ENABLE ROW LEVEL SECURITY;

-- event_show_plans: el dueño del plan lo puede ver y editar; staff puede ver todo
DROP POLICY IF EXISTS "plan_owner_all" ON public.event_show_plans;
CREATE POLICY "plan_owner_all" ON public.event_show_plans
  FOR ALL USING (
    auth.uid() = user_id
    OR public.is_staff(auth.uid())
  );

-- show_cue_blocks: acceso vía plan_id vinculado al dueño
DROP POLICY IF EXISTS "cue_owner_all" ON public.show_cue_blocks;
CREATE POLICY "cue_owner_all" ON public.show_cue_blocks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.event_show_plans p
      WHERE p.id = plan_id
        AND (p.user_id = auth.uid() OR public.is_staff(auth.uid()))
    )
  );

-- runway_lineup: acceso vía plan_id vinculado al dueño
DROP POLICY IF EXISTS "lineup_owner_all" ON public.runway_lineup;
CREATE POLICY "lineup_owner_all" ON public.runway_lineup
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.event_show_plans p
      WHERE p.id = plan_id
        AND (p.user_id = auth.uid() OR public.is_staff(auth.uid()))
    )
  );

-- ── 6. GRANT (Supabase service role ya tiene acceso; esto es para anon/authed) ─
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_show_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.show_cue_blocks  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.runway_lineup    TO authenticated;

-- ── COMENTARIOS DE DISEÑO ─────────────────────────────────────────────────────
COMMENT ON TABLE public.event_show_plans IS
  'Plan maestro de eventos de producción (Fashion Show, Show, etc.). Los campos cue_blocks y runway_lineup almacenan el estado del editor como JSONB para guardado rápido. Las tablas relacionales show_cue_blocks y runway_lineup permiten consultas por bloque o lookup avanzado.';

COMMENT ON TABLE public.show_cue_blocks IS
  'Filas del Minuto a Minuto técnico (Cue-to-Cue). Cada fila es un bloque de tiempo con cue de audio, luces y acción de backstage.';

COMMENT ON TABLE public.runway_lineup IS
  'Hoja de salidas del desfile. Cada fila es una colección con su diseñador, número de looks, track y preset técnico.';
