-- ══════════════════════════════════════════════════════════════════════════════
-- CLIENT PROFILES — Campos B2B / Cliente Comercial
-- Extiende client_profiles con campos para dueños de venues y empresas
-- que rentan servicios de producción (discotecas, salones, hoteles, etc.)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS is_commercial  BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_name   TEXT,
  ADD COLUMN IF NOT EXISTS venue_type     TEXT;

-- Índice para filtrar clientes comerciales vs. personales
CREATE INDEX IF NOT EXISTS idx_client_profiles_commercial
  ON public.client_profiles (is_commercial)
  WHERE is_commercial = true;

COMMENT ON COLUMN public.client_profiles.is_commercial IS
  'true = Cliente Comercial B2B (dueño de discoteca, venue, empresa de producción). false = cliente personal.';

COMMENT ON COLUMN public.client_profiles.company_name IS
  'Nombre del negocio o venue (solo clientes comerciales).';

COMMENT ON COLUMN public.client_profiles.venue_type IS
  'Tipo de local: nightclub | lounge | banquet_hall | rooftop | hotel | restaurant | venue_rental | other';
