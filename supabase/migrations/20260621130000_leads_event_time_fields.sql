-- ── leads: add event start/end time columns ──────────────────────────────────
-- Time In = hora de inicio del evento
-- Time Out = hora de cierre del evento

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS event_start_time TIME WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS event_end_time   TIME WITHOUT TIME ZONE;

NOTIFY pgrst, 'reload schema';
