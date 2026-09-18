-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-18
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- Ticket: "Base de clientes · Matrix" (calendario) -- el botón "Eliminar" y
-- el campo "Estado" (Potencial/Activo/VIP) eran 100% decorativos: nunca
-- existió una columna para ninguno de los dos, así que un refresh siempre
-- los perdía. Este script agrega ambos de verdad, sobre dj_client_affiliations
-- (la relación DJ↔cliente, NO master_clients -- un mismo cliente puede tener
-- distinto estado/actividad con cada DJ afiliado, y desactivarlo aquí solo
-- saca a ESE DJ de su propia lista, nunca borra la identidad del cliente
-- para los demás DJs que también lo tengan).
--
-- "Eliminar" = soft-delete (active=false), mismo criterio que ya usa
-- residency_schedule (nunca DELETE real, siempre reversible).
--
-- get_master_calendar_events() ya tenía una guardia real de "solo staff" --
-- la función nueva de abajo usa la MISMA guardia, mismo criterio de
-- seguridad ya establecido en esta fase (find_or_create_master_client no la
-- tiene porque no lee nada sensible, pero desactivar/reactivar sí debe
-- quedar limitado a staff, igual que la lectura del calendario maestro).

-- ── 1) Columnas nuevas en dj_client_affiliations ──────────────────────────
ALTER TABLE public.dj_client_affiliations
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS estado text;

ALTER TABLE public.dj_client_affiliations DROP CONSTRAINT IF EXISTS dj_client_affiliations_estado_check;
ALTER TABLE public.dj_client_affiliations ADD CONSTRAINT dj_client_affiliations_estado_check
  CHECK (estado IS NULL OR estado IN ('Potencial','Activo','VIP'));

COMMENT ON COLUMN public.dj_client_affiliations.active IS
  'Soft-delete: false = ese DJ ya no ve a este cliente en su "Base de clientes". Nunca se borra la fila ni master_clients.';
COMMENT ON COLUMN public.dj_client_affiliations.estado IS
  'Potencial/Activo/VIP -- propio de la relación DJ↔cliente, no de la identidad canónica en master_clients.';

-- ── 2) RPC: desactivar/reactivar/cambiar estado de UNA afiliación ─────────
-- Solo staff (mismo candado que get_master_calendar_events) -- hoy un
-- artista normal ni siquiera puede LEER este calendario maestro, así que no
-- tiene sentido dejarlo escribir en él tampoco.
CREATE OR REPLACE FUNCTION public.dj_client_affiliation_modificar(
  p_master_client_id uuid,
  p_dj_id            uuid,
  p_accion           text,
  p_estado           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_accion text := lower(trim(coalesce(p_accion, '')));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.dj_profiles
    WHERE dj_profiles.user_id = auth.uid()
      AND dj_profiles.role IN ('owner','admin','manager','seller')
  ) THEN
    RAISE EXCEPTION 'forbidden: solo staff puede modificar el calendario maestro';
  END IF;

  IF v_accion NOT IN ('desactivar', 'reactivar', 'actualizar_estado') THEN
    RAISE EXCEPTION 'accion_invalida';
  END IF;
  IF p_estado IS NOT NULL AND p_estado NOT IN ('Potencial','Activo','VIP') THEN
    RAISE EXCEPTION 'estado_invalido';
  END IF;

  SELECT id INTO v_id FROM public.dj_client_affiliations
   WHERE master_client_id = p_master_client_id AND dj_id = p_dj_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'afiliacion_no_encontrada';
  END IF;

  IF v_accion = 'desactivar' THEN
    UPDATE public.dj_client_affiliations SET active = false WHERE id = v_id;
  ELSIF v_accion = 'reactivar' THEN
    UPDATE public.dj_client_affiliations SET active = true WHERE id = v_id;
  ELSE
    UPDATE public.dj_client_affiliations SET estado = p_estado WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.dj_client_affiliation_modificar(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dj_client_affiliation_modificar(uuid, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.dj_client_affiliation_modificar(uuid, uuid, text, text) TO authenticated;

-- ── 3) get_master_calendar_events(): agrega estado + respeta active=false ─
-- Simplificación consciente: un cliente puede estar afiliado a varios DJs a
-- la vez, cada uno con su propio "estado" -- pero la tabla de "Base de
-- clientes" pinta UNA fila por cliente (igual que ya hacía con dj_ids[0]
-- como "owner" del lado del cliente). Se toma el estado de esa MISMA
-- afiliación (primer dj_id del array), no un promedio ni todos.
DROP FUNCTION IF EXISTS public.get_master_calendar_events();

CREATE OR REPLACE FUNCTION public.get_master_calendar_events()
RETURNS TABLE (
  master_client_id uuid,
  client_name      text,
  client_phone     text,
  estado           text,
  event_type       text,
  event_date       date,
  dj_ids           uuid[],
  dj_names         text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.dj_profiles
    WHERE dj_profiles.user_id = auth.uid()
      AND dj_profiles.role IN ('owner','admin','manager','seller')
  ) THEN
    RAISE EXCEPTION 'forbidden: solo staff puede leer el calendario maestro';
  END IF;

  RETURN QUERY
    SELECT
      mc.id,
      mc.name,
      mc.normalized_phone,
      (array_agg(dca.estado ORDER BY dca.created_at))[1],
      'birthday'::text,
      mc.birthday,
      array_agg(DISTINCT dca.dj_id),
      array_agg(DISTINCT coalesce(dp.dj_name, dp.stage_name, dp.full_name))
    FROM public.master_clients mc
    JOIN public.dj_client_affiliations dca ON dca.master_client_id = mc.id AND dca.active = true
    LEFT JOIN public.dj_profiles dp ON dp.id = dca.dj_id
    WHERE mc.birthday IS NOT NULL
    GROUP BY mc.id, mc.name, mc.normalized_phone, mc.birthday

    UNION ALL

    SELECT
      mc.id,
      mc.name,
      mc.normalized_phone,
      (array_agg(dca.estado ORDER BY dca.created_at))[1],
      'wedding_anniversary'::text,
      mc.wedding_anniversary,
      array_agg(DISTINCT dca.dj_id),
      array_agg(DISTINCT coalesce(dp.dj_name, dp.stage_name, dp.full_name))
    FROM public.master_clients mc
    JOIN public.dj_client_affiliations dca ON dca.master_client_id = mc.id AND dca.active = true
    LEFT JOIN public.dj_profiles dp ON dp.id = dca.dj_id
    WHERE mc.wedding_anniversary IS NOT NULL
    GROUP BY mc.id, mc.name, mc.normalized_phone, mc.wedding_anniversary;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_master_calendar_events() TO authenticated;

NOTIFY pgrst, 'reload schema';
