-- ══════════════════════════════════════════════════════════════════════════════
-- EVENT SHOW PLANS — Vinculación a cuenta de cliente
-- Añade client_profile_id y assigned_client_email para asignar guiones
-- a órdenes / cuentas de clientes existentes en client_profiles.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.event_show_plans
  ADD COLUMN IF NOT EXISTS client_profile_id     UUID    REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_client_email TEXT;

-- Índice para búsquedas por cliente (ej. todos los guiones de un cliente)
CREATE INDEX IF NOT EXISTS idx_event_show_plans_client
  ON public.event_show_plans (client_profile_id)
  WHERE client_profile_id IS NOT NULL;

COMMENT ON COLUMN public.event_show_plans.client_profile_id IS
  'Cuenta de cliente vinculada a este guion. NULL = sin asignar.';

COMMENT ON COLUMN public.event_show_plans.assigned_client_email IS
  'Email del cliente asignado (desnormalizado para display rápido sin JOIN).';
