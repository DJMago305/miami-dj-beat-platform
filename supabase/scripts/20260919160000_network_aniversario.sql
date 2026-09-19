-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO: crear un
--   campo de Aniversario (dos nombres + fecha), mismo sistema de
--   selects que el de cumpleaños.
-- ============================================================
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS aniversario jsonb;
ALTER TABLE public.dj_profiles
  ADD COLUMN IF NOT EXISTS aniversario jsonb;
ALTER TABLE public.network_referencia_contactos
  ADD COLUMN IF NOT EXISTS aniversario jsonb;

COMMENT ON COLUMN public.client_profiles.aniversario IS 'Aniversario de pareja: {nombre1, nombre2, fecha (YYYY-MM-DD)}. NULL = no aplica/no capturado.';
COMMENT ON COLUMN public.dj_profiles.aniversario IS 'Aniversario de pareja: {nombre1, nombre2, fecha (YYYY-MM-DD)}. NULL = no aplica/no capturado.';
COMMENT ON COLUMN public.network_referencia_contactos.aniversario IS 'Aniversario de pareja: {nombre1, nombre2, fecha (YYYY-MM-DD)}. NULL = no aplica/no capturado.';

-- network_contacto_actualizar y network_referencia_actualizar extendidos
-- con p_aniversario jsonb (mismo patron COALESCE que phones_extra/emails_extra).
-- Ver historial de apply_migration "network_aniversario" para el cuerpo completo.
