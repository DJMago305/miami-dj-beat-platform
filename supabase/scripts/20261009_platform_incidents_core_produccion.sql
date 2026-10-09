-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- PLATFORM INCIDENTS · NÚCLEO — llevarlo a PRODUCCIÓN (9-oct-2026).
-- Por qué: el botón flotante «Reportar incidente» de staff.html llama al RPC platform_incidents_reportar, pero esta migración (contrato aprobado por el PO el
-- 22-ago-2026, escrita para PRUEBA) nunca se aplicó en producción (verificado 2026-10-09: ni la tabla ni la función existen) y el botón fallaba con error.
-- Contenido: IDÉNTICO a supabase/migrations/20260823000000_platform_incidents_core.sql (tabla inmutable + RPC solo staff + vista de staff). Requiere is_staff(uuid): existe en producción.
-- Antes de correr: select to_regclass('public.platform_incidents');  -- si NO da null, ya corrió; no repetir.
-- No toca nada existente (no confundir con company_incident_log, que es otra bitácora y sigue igual).

BEGIN;

-- ── 1 · La tabla base ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_incidents (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reportado_por_user_id   uuid NOT NULL REFERENCES auth.users (id),
  reportado_por_nombre    text NOT NULL,      -- copia al momento del reporte; no sigue cambios futuros del perfil
  dominio                 text NOT NULL,      -- PENDIENTE: sin CHECK hasta que el Capitán entregue el catálogo cerrado
  severidad               text NOT NULL,      -- PENDIENTE: sin CHECK hasta que el Capitán entregue el catálogo cerrado
  componente_afectado     text NOT NULL,      -- ej. "staff.html?vista=agenda", "weather-experience/hero.js"
  que_paso                text NOT NULL,
  como_se_soluciono       text,               -- nullable — se puede reportar antes de tener la solución
  pr_commit_referencia    text,               -- nullable — link al PR/commit que lo arregló
  created_at              timestamptz NOT NULL DEFAULT now()  -- momento del guardado; no editable después
);

COMMENT ON TABLE public.platform_incidents IS
  'Platform Incidents · Núcleo. Registro inmutable de incidentes técnicos/UI. Sin políticas RLS para nadie — la única entrada es platform_incidents_reportar(), la única salida es platform_incidents_staff. Distinta de libro_operaciones (diario financiero del artista) — no mezclar.';

COMMENT ON COLUMN public.platform_incidents.dominio IS
  'PENDIENTE — el Capitán debe entregar el catálogo cerrado antes de agregar el CHECK. Hasta entonces, texto libre (ej. elixis-voice, bfi, road-master-map, weather-ui, gobernanza).';

COMMENT ON COLUMN public.platform_incidents.severidad IS
  'PENDIENTE — el Capitán debe entregar el catálogo cerrado antes de agregar el CHECK. Hasta entonces, texto libre.';

-- ── 2 · El candado: RLS activo, sin ninguna política ────────────────────────
ALTER TABLE public.platform_incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_incidents FROM anon;
REVOKE ALL ON public.platform_incidents FROM authenticated;
-- Deliberadamente no se crea ninguna política: RLS activo + cero políticas
-- deniega toda lectura y escritura a anon y a authenticated por igual, sin
-- excepción para el propio autor de una fila.

-- ── 3 · Única puerta de entrada: agregar, nunca corregir ni borrar ─────────
CREATE OR REPLACE FUNCTION public.platform_incidents_reportar(
  p_dominio               text,
  p_severidad             text,
  p_componente_afectado   text,
  p_que_paso              text,
  p_como_se_soluciono     text DEFAULT NULL,
  p_pr_commit_referencia  text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre   text;
  v_nuevo_id uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'platform_incidents_reportar: solo staff puede reportar un incidente de plataforma';
  END IF;

  IF p_dominio IS NULL OR btrim(p_dominio) = '' THEN
    RAISE EXCEPTION 'platform_incidents_reportar: dominio es obligatorio';
  END IF;
  IF p_severidad IS NULL OR btrim(p_severidad) = '' THEN
    RAISE EXCEPTION 'platform_incidents_reportar: severidad es obligatoria';
  END IF;
  IF p_componente_afectado IS NULL OR btrim(p_componente_afectado) = '' THEN
    RAISE EXCEPTION 'platform_incidents_reportar: componente_afectado es obligatorio';
  END IF;
  IF p_que_paso IS NULL OR btrim(p_que_paso) = '' THEN
    RAISE EXCEPTION 'platform_incidents_reportar: que_paso es obligatorio';
  END IF;

  -- Nombre de quien reporta: perfil de dj_profiles si existe (staff también
  -- vive ahí, por rol), si no, el email de auth.users, si no, un marcador.
  -- Se resuelve aquí, del lado del servidor — nunca llega como parámetro.
  SELECT coalesce(
           nullif(btrim(dp.stage_name), ''),
           nullif(btrim(dp.dj_name), ''),
           nullif(btrim(u.email), ''),
           '(sin nombre)'
         )
    INTO v_nombre
    FROM auth.users u
    LEFT JOIN public.dj_profiles dp ON dp.user_id = u.id
   WHERE u.id = auth.uid();

  INSERT INTO public.platform_incidents (
    reportado_por_user_id, reportado_por_nombre, dominio, severidad,
    componente_afectado, que_paso, como_se_soluciono, pr_commit_referencia
  ) VALUES (
    auth.uid(), coalesce(v_nombre, '(sin nombre)'), btrim(p_dominio), btrim(p_severidad),
    btrim(p_componente_afectado), btrim(p_que_paso), p_como_se_soluciono, p_pr_commit_referencia
  )
  RETURNING id INTO v_nuevo_id;

  RETURN v_nuevo_id;
END;
$$;

COMMENT ON FUNCTION public.platform_incidents_reportar(text,text,text,text,text,text) IS
  'Platform Incidents · Núcleo. Única puerta de escritura: agrega una fila, nunca corrige ni borra. Exige is_staff(auth.uid()) y resuelve la identidad del llamante en el servidor — no se puede reportar en nombre de otro.';

REVOKE ALL ON FUNCTION public.platform_incidents_reportar(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_incidents_reportar(text,text,text,text,text,text)
  TO authenticated;
-- Nótese: sin GRANT a anon. Sin UPDATE ni DELETE en ningún lado de este archivo — no existe ese camino.
-- El GRANT a `authenticated` no abre la puerta a cualquiera: la función misma
-- rechaza con RAISE EXCEPTION a quien no sea staff, antes de tocar la tabla.

-- ── 4 · Única puerta de salida: el equipo interno, fila por fila ───────────
CREATE OR REPLACE VIEW public.platform_incidents_staff AS
SELECT
  id, reportado_por_user_id, reportado_por_nombre, dominio, severidad,
  componente_afectado, que_paso, como_se_soluciono, pr_commit_referencia,
  created_at
FROM public.platform_incidents
WHERE public.is_staff(auth.uid());

COMMENT ON VIEW public.platform_incidents_staff IS
  'Platform Incidents · Núcleo. Única puerta de lectura, solo para staff (is_staff). No hay excepción de lectura puntual para no-staff — a diferencia de libro_operaciones, aquí no aplica (el reportante YA es staff).';

REVOKE ALL ON public.platform_incidents_staff FROM anon;
GRANT SELECT ON public.platform_incidents_staff TO authenticated;
-- La vista es SELECT solamente: no expone ninguna vía de escritura.

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- V1 · Un usuario de staff con sesión puede reportar un incidente
--   SELECT public.platform_incidents_reportar(
--     'weather-ui', 'media', 'staff.html?vista=agenda',
--     'Canvas del clima encogido a ancho de escritorio.',
--     'ResizeObserver + cache-busting en hero.js (PR #232).', 'PR #232'
--   );
--   -- ESPERADO: devuelve un uuid nuevo, sin error.
--
-- V2 · Un usuario SIN sesión de staff no puede reportar
--   SELECT public.platform_incidents_reportar('x','x','x','x');
--   -- ESPERADO: error "solo staff puede reportar...".
--
-- V3 · Nadie puede leer la tabla base directamente, ni siquiera staff
--   SELECT * FROM public.platform_incidents;
--   -- ESPERADO: 0 filas o error de permiso.
--
-- V4 · Un usuario de staff SÍ ve todo por la vista
--   SELECT count(*) FROM public.platform_incidents_staff;
--   -- ESPERADO: cuenta todas las filas existentes, incluida la de V1.
--
-- V5 · Un usuario que NO es staff no ve nada por la vista
--   SELECT count(*) FROM public.platform_incidents_staff;
--   -- ESPERADO: 0 (la vista filtra por is_staff(auth.uid()), no por fila).
--
-- V6 · No existe ningún camino de corrección o borrado
--   UPDATE public.platform_incidents SET que_paso = 'editado' WHERE true;
--   DELETE FROM public.platform_incidents WHERE true;
--   -- ESPERADO: ambas fallan por permiso — no hay política que las permita,
--   -- y no existe ninguna función que las exponga.
--
-- ── REVERSIÓN ──
-- BEGIN;
--   DROP VIEW IF EXISTS public.platform_incidents_staff;
--   DROP FUNCTION IF EXISTS public.platform_incidents_reportar(text,text,text,text,text,text);
--   DROP TABLE IF EXISTS public.platform_incidents;
-- COMMIT;
-- ADVERTENCIA: revertir borra cualquier reporte ya guardado. Exportar antes
-- si algún dato de prueba importa conservarse.
