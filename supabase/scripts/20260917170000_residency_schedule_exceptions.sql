-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-17 (actualizado el mismo día: agrega "eliminar solo esta
-- fecha", pedido explícito del PO tras ver la primera versión del panel)
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- Ticket: "eliminar/reasignar residencias directo en el calendario". Dos
-- necesidades sobre UNA sola ocurrencia de una residencia (la regla semanal
-- completa sigue intacta):
--   1. Reemplazar el DJ solo esa fecha (dj_name/dj_id distinto de la regla).
--   2. Eliminar esa fecha por completo (ese día la residencia NO ocurre,
--      la regla sigue viva para las demás semanas).
-- Ninguna de las dos existía: residency_schedule es la regla entera, y
-- calendario-operacional-inteligente.html la expande en 1 evento por semana
-- durante todo el año (loadResidencies()) sin guardar excepciones.
--
-- skip=true  → la ocurrencia de exception_date NO se dibuja en el calendario
--              (dj_name puede ir vacío -- no hay a quién reasignar, se borró).
-- skip=false → la ocurrencia SÍ se dibuja pero con dj_name/dj_id distinto al
--              de la regla (reemplazo de DJ solo esa fecha).
-- Reemplazar/eliminar "esta y todas las futuras" NO usa esta tabla -- eso ya
-- se resuelve con residency_schedule_modificar(accion:'actualizar'/'desactivar'),
-- que cambia la regla completa. loadResidencies() debe leer esta tabla y
-- aplicarla al expandir cada regla.
--
-- dj_id se deja opcional a propósito -- residency_schedule.dj_id ya se
-- demostró huérfano/no confiable en las filas reales (ver comentario de
-- 20260901130000_residency_schedule_modificar.sql); dj_name es el campo
-- confiable, igual que en la tabla base.

CREATE TABLE IF NOT EXISTS public.residency_schedule_exceptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residency_id    uuid NOT NULL REFERENCES public.residency_schedule(id) ON DELETE CASCADE,
  exception_date  date NOT NULL,
  skip            boolean NOT NULL DEFAULT false,
  dj_name         text,
  dj_id           uuid REFERENCES public.dj_profiles(id),
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (residency_id, exception_date),
  CONSTRAINT residency_exceptions_dj_o_skip CHECK (skip = true OR (dj_name IS NOT NULL AND btrim(dj_name) <> ''))
);

-- Reintento seguro si la tabla ya existía de una corrida anterior de este
-- mismo script (antes de agregar "skip") -- ALTER idempotente, no destruye nada.
ALTER TABLE public.residency_schedule_exceptions ADD COLUMN IF NOT EXISTS skip boolean NOT NULL DEFAULT false;
ALTER TABLE public.residency_schedule_exceptions ALTER COLUMN dj_name DROP NOT NULL;
ALTER TABLE public.residency_schedule_exceptions DROP CONSTRAINT IF EXISTS residency_exceptions_dj_o_skip;
ALTER TABLE public.residency_schedule_exceptions ADD CONSTRAINT residency_exceptions_dj_o_skip
  CHECK (skip = true OR (dj_name IS NOT NULL AND btrim(dj_name) <> ''));

COMMENT ON TABLE public.residency_schedule_exceptions IS
  'Excepción puntual a una regla de residency_schedule para UNA fecha: skip=true la elimina ese día, skip=false reemplaza el DJ ese día. No toca la regla -- loadResidencies() la aplica solo sobre exception_date.';

-- ── RLS: mismo candado que residency_schedule (solo staff/owner) ───────────
ALTER TABLE public.residency_schedule_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS residency_exceptions_staff_all ON public.residency_schedule_exceptions;
CREATE POLICY residency_exceptions_staff_all ON public.residency_schedule_exceptions
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.residency_schedule_exceptions TO authenticated;
GRANT ALL ON public.residency_schedule_exceptions TO service_role;

CREATE INDEX IF NOT EXISTS idx_residency_exceptions_residency_date
  ON public.residency_schedule_exceptions (residency_id, exception_date);

NOTIFY pgrst, 'reload schema';
