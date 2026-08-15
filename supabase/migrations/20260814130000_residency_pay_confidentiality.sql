-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIDENCIALIDAD ECONÓMICA — residency_schedule  (candado a nivel base de datos)
-- ───────────────────────────────────────────────────────────────────────────
-- Problema: el artista NO debe poder leer `venue_pay_usd` (lo que el venue paga a
-- MDJ = revela el margen de la empresa), NI SIQUIERA con una consulta propia.
-- RLS controla FILAS, no COLUMNAS → una política "el artista lee sus propias filas"
-- expone TODAS las columnas, incluida venue_pay_usd. Esa es la fuga.
--
-- Solución (patrón estándar Postgres):
--   1) La TABLA BASE queda accesible SOLO para staff/owner (RLS is_staff). El artista
--      no puede leerla directamente.
--   2) Una VISTA SEGURA `residency_schedule_secure` (SECURITY DEFINER) es la única
--      puerta para el frontend: expone venue_pay_usd SOLO si el que consulta es staff
--      (is_staff), y filtra filas por rol (staff: todas; artista: solo las suyas).
--   3) El frontend (calendario + clima) lee la VISTA, nunca la tabla base.
--
-- Reversible. Idempotente. El service_role (ELIXIS Edge Function) no se afecta.
-- Confirmado por el Capitán (2026-08-14).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0) Asegurar la columna dj_id (agregada ad-hoc antes; la fijamos idempotente) ──
ALTER TABLE public.residency_schedule
  ADD COLUMN IF NOT EXISTS dj_id uuid REFERENCES public.dj_profiles(id);

-- ── 1) Tabla base: RLS SOLO staff/owner. Quitamos CUALQUIER política previa
--       (incluida la ad-hoc que dejaba al artista leer sus propias filas con venue_pay). ──
ALTER TABLE public.residency_schedule ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'residency_schedule'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.residency_schedule', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY residency_staff_all ON public.residency_schedule
  FOR ALL TO authenticated
  USING      (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- El artista ya NO puede leer la tabla base (RLS lo bloquea). Staff mantiene lectura/
-- escritura vía RLS. anon fuera.
REVOKE SELECT ON public.residency_schedule FROM anon;

-- ── 2) Vista segura: única puerta de lectura del frontend ──
--    SECURITY DEFINER (default de vistas): corre como su dueño (postgres), que es
--    dueño de la tabla → puede leerla; el gateo de columna/fila va EN el SQL de la vista.
--    `auth.uid()` sigue siendo el del que consulta (claim del JWT, no del dueño).
CREATE OR REPLACE VIEW public.residency_schedule_secure AS
SELECT
  s.id, s.day_of_week, s.shift, s.venue, s.dj_name,
  s.start_time, s.end_time, s.dj_id, s.dj_pay_usd, s.active, s.notes,
  -- venue_pay_usd SOLO para staff; el artista lo recibe NULL:
  CASE WHEN public.is_staff(auth.uid()) THEN s.venue_pay_usd ELSE NULL END AS venue_pay_usd
FROM public.residency_schedule s
WHERE
  s.active = true
  AND (
    public.is_staff(auth.uid())                                    -- staff/owner: todas las residencias
    OR s.dj_id = (SELECT p.id FROM public.dj_profiles p            -- artista: SOLO las suyas
                  WHERE p.user_id = auth.uid())
  );

COMMENT ON VIEW public.residency_schedule_secure IS
  'Puerta segura de residency_schedule. venue_pay_usd visible SOLO para staff (is_staff); el artista ve solo sus residencias y venue_pay_usd = NULL. El frontend lee ESTA vista, no la tabla base.';

-- Solo usuarios autenticados leen la vista (no anon). service_role no la necesita.
REVOKE ALL ON public.residency_schedule_secure FROM anon;
GRANT SELECT ON public.residency_schedule_secure TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- SMOKE TEST (opcional — correr como el artista y como staff para comprobar):
--   -- Como STAFF/OWNER: venue_pay_usd viene con valor.
--   SELECT venue, dj_pay_usd, venue_pay_usd FROM public.residency_schedule_secure;
--   -- Como ARTISTA: venue_pay_usd viene NULL, y solo sus residencias.
--   -- Intento de fuga directo (debe dar 0 filas / permiso denegado para el artista):
--   SELECT venue_pay_usd FROM public.residency_schedule;
-- ═══════════════════════════════════════════════════════════════════════════
