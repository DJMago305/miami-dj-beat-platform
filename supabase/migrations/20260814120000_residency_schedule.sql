-- ═══════════════════════════════════════════════════════════════════════════
-- MÓDULO DE AGENDA — Residencias recurrentes de Miami DJ Beat LLC
-- Fuente de verdad de la agenda semanal: venue, turno, horario, DJ, tarifas.
-- Reemplaza el contexto hardcodeado de ELIXIS (BUSINESS_CONTEXT).
-- Confirmado por el Capitán (2026-08-14).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.residency_schedule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=domingo … 6=sábado
  shift         text NOT NULL CHECK (shift IN ('dia','noche')),
  venue         text NOT NULL,
  dj_name       text NOT NULL DEFAULT 'DJMago305',
  start_time    time NOT NULL,
  end_time      time NOT NULL,                -- si end < start, cruza medianoche
  venue_pay_usd numeric(10,2) NOT NULL DEFAULT 0,   -- lo que paga el venue a MDJ
  dj_pay_usd    numeric(10,2) NOT NULL DEFAULT 250, -- lo que cobra el DJ por evento
  active        boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.residency_schedule IS
  'Agenda de residencias recurrentes (fuente de verdad de horarios y tarifas por venue). Margen MDJ por evento = venue_pay_usd - dj_pay_usd cuando se asigna otro DJ.';

-- ── RLS: solo staff/owner ────────────────────────────────────────────────────
ALTER TABLE public.residency_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS residency_staff_all ON public.residency_schedule;
CREATE POLICY residency_staff_all ON public.residency_schedule
  FOR ALL TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.dj_profiles d
               WHERE d.user_id = auth.uid() AND lower(coalesce(d.role,'')) = 'owner')
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.dj_profiles d
               WHERE d.user_id = auth.uid() AND lower(coalesce(d.role,'')) = 'owner')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.residency_schedule TO authenticated;
GRANT ALL ON public.residency_schedule TO service_role;

-- ── Semilla: agenda confirmada del Capitán ───────────────────────────────────
-- day_of_week: 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
INSERT INTO public.residency_schedule (day_of_week, shift, venue, start_time, end_time, venue_pay_usd, dj_pay_usd) VALUES
  (4, 'noche', 'Sundowner Key Largo',  '17:00', '21:30', 300, 250),  -- Jueves
  (5, 'dia',   'Sundowner Key Largo',  '12:00', '17:00', 350, 250),  -- Viernes día
  (5, 'noche', 'Mojitos Calle 8',      '19:00', '00:30', 475, 250),  -- Viernes noche
  (6, 'dia',   'Sundowner Key Largo',  '12:00', '17:00', 350, 250),  -- Sábado día
  (6, 'noche', 'El Valle Restaurante', '20:00', '02:00', 350, 250),  -- Sábado noche
  (0, 'dia',   'Sundowner Key Largo',  '12:00', '17:00', 350, 250);  -- Domingo día

-- Verificación rápida (opcional):
-- SELECT day_of_week, shift, venue, start_time, end_time, venue_pay_usd, dj_pay_usd FROM public.residency_schedule ORDER BY day_of_week, start_time;
