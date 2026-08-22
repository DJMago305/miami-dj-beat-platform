-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo (rtbsovavmtnjpbbpwsin)                    ║
-- ║  NO EJECUTAR EN PRODUCCIÓN SIN AUTORIZACIÓN EXPRESA DEL PO                ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  Libro de Operaciones IA · Fase 1 — Esquema y Candado                    ║
-- ║  Requiere: M1 (profile_id), M2 (mdj_profile_de_usuario), is_staff()       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- COMPROBAR ANTES DE CORRER — no asumir por notas de otra sesión
--   SELECT to_regclass('public.libro_operaciones');
--   -- Si NO da null → esta migración YA CORRIÓ. No repetir.
--   SELECT to_regprocedure('public.mdj_profile_de_usuario(uuid)');
--   -- Si da null → falta M2 antes de esta.
--
-- QUÉ ES
--   El registro central e inmutable de incidentes y facturación de toda la
--   corporación (Constitución del Libro de Operaciones IA, artifact 55cf2cd5,
--   capítulo 2.1). Un artista reporta sobre sí mismo; nadie —ni él mismo, ni
--   un visitante sin sesión— puede leer la tabla base directamente. La única
--   puerta es una función que agrega una fila y nunca corrige ni borra.
--
-- EL CANDADO (mismo molde que 20260814130000_residency_pay_confidentiality.sql,
-- más estricto: allí el equipo SÍ podía leer la tabla base; aquí nadie puede)
--   1) RLS activo, CERO políticas — ni para anon ni para authenticated. Eso ya
--      basta para bloquear toda lectura y escritura directa.
--   2) La única entrada es libro_operaciones_reportar(): SECURITY DEFINER,
--      resuelve la identidad de quien llama con mdj_profile_de_usuario(auth.uid())
--      — nunca acepta esa identidad como parámetro, para que nadie pueda
--      reportar en nombre de otro.
--   3) La única salida hoy es libro_operaciones_staff: vista SECURITY DEFINER
--      filtrada por is_staff(auth.uid()) — ve todo, agregado. La ventana de
--      lectura puntual del artista (gerente/propietario autorizan caso por
--      caso) es una pieza aparte: Fase 2A, no esta migración.
--
-- QUÉ NO HACE
--   · No define el catálogo cerrado de tipos de incidente — PENDIENTE que el
--     Capitán lo entregue. tipo_incidente queda como texto libre, sin
--     restricción, con un comentario que marca la deuda; una migración
--     posterior añade el CHECK en cuanto exista la lista.
--   · No decide el nivel de cifrado adicional sobre los datos — PENDIENTE,
--     no se resuelve aquí.
--   · No construye la concesión puntual de lectura del artista (Fase 2A) ni
--     la herramienta de ELIXIS (Fase 3) — cada una es su propia migración.
--   · No purga filas por antigüedad: la retención de 5 años es un mínimo de
--     conservación, no un borrado automático — borrar violaría la
--     inmutabilidad que sostiene su valor como evidencia (capítulo 4.1).

BEGIN;

-- ── 1 · La tabla base ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.libro_operaciones (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reportado_por_profile_id text NOT NULL REFERENCES public.dj_profiles (profile_id),
  nombre_artistico        text NOT NULL,      -- copia al momento del reporte; no sigue cambios futuros del perfil
  tipo_incidente          text NOT NULL,      -- PENDIENTE: sin CHECK hasta que el Capitán entregue el catálogo cerrado
  lugar                   text,
  con_quien_se_trabajo    text,
  monto_facturado_usd     numeric(10,2),      -- SOLO la parte del artista — nunca el margen de la empresa
  clima                   text,
  sucesos_extraordinarios text,
  relato_libre            text,
  created_at              timestamptz NOT NULL DEFAULT now()  -- momento del guardado; no editable después
);

COMMENT ON TABLE public.libro_operaciones IS
  'Libro de Operaciones IA · Fase 1. Registro central inmutable. Sin políticas RLS para nadie — la única entrada es libro_operaciones_reportar(), la única salida hoy es libro_operaciones_staff. Retención mínima: 5 años, sin purga automática.';

COMMENT ON COLUMN public.libro_operaciones.tipo_incidente IS
  'PENDIENTE — el Capitán debe entregar el catálogo cerrado antes de agregar el CHECK. Hasta entonces, texto libre.';

-- ── 2 · El candado: RLS activo, sin ninguna política ────────────────────────
ALTER TABLE public.libro_operaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.libro_operaciones FROM anon;
REVOKE ALL ON public.libro_operaciones FROM authenticated;
-- Deliberadamente no se crea ninguna política: RLS activo + cero políticas
-- deniega toda lectura y escritura a anon y a authenticated por igual, sin
-- excepción para el propio autor de una fila.

-- ── 3 · Única puerta de entrada: agregar, nunca corregir ni borrar ─────────
CREATE OR REPLACE FUNCTION public.libro_operaciones_reportar(
  p_tipo_incidente          text,
  p_lugar                   text DEFAULT NULL,
  p_con_quien_se_trabajo    text DEFAULT NULL,
  p_monto_facturado_usd     numeric(10,2) DEFAULT NULL,
  p_clima                   text DEFAULT NULL,
  p_sucesos_extraordinarios text DEFAULT NULL,
  p_relato_libre            text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id text;
  v_nombre     text;
  v_nuevo_id   uuid;
BEGIN
  IF p_tipo_incidente IS NULL OR btrim(p_tipo_incidente) = '' THEN
    RAISE EXCEPTION 'libro_operaciones_reportar: tipo_incidente es obligatorio';
  END IF;

  -- La identidad de quien reporta se resuelve aquí, del lado del servidor —
  -- nunca llega como parámetro. Así nadie puede reportar en nombre de otro.
  v_profile_id := public.mdj_profile_de_usuario(auth.uid());
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'libro_operaciones_reportar: no se encontró un perfil para esta sesión';
  END IF;

  SELECT coalesce(nullif(btrim(stage_name), ''), nullif(btrim(dj_name), ''), '(sin nombre)')
    INTO v_nombre
    FROM public.dj_profiles
   WHERE profile_id = v_profile_id;

  INSERT INTO public.libro_operaciones (
    reportado_por_profile_id, nombre_artistico, tipo_incidente, lugar,
    con_quien_se_trabajo, monto_facturado_usd, clima,
    sucesos_extraordinarios, relato_libre
  ) VALUES (
    v_profile_id, v_nombre, btrim(p_tipo_incidente), p_lugar,
    p_con_quien_se_trabajo, p_monto_facturado_usd, p_clima,
    p_sucesos_extraordinarios, p_relato_libre
  )
  RETURNING id INTO v_nuevo_id;

  RETURN v_nuevo_id;
END;
$$;

COMMENT ON FUNCTION public.libro_operaciones_reportar(text,text,text,numeric,text,text,text) IS
  'Libro de Operaciones IA · Fase 1. Única puerta de escritura: agrega una fila, nunca corrige ni borra. Resuelve la identidad del llamante en el servidor — no se puede reportar en nombre de otro.';

REVOKE ALL ON FUNCTION public.libro_operaciones_reportar(text,text,text,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.libro_operaciones_reportar(text,text,text,numeric,text,text,text)
  TO authenticated;
-- Nótese: sin GRANT a anon. Sin UPDATE ni DELETE en ningún lado de este archivo — no existe ese camino.

-- ── 4 · Única puerta de salida hoy: el equipo interno, agregado ─────────────
CREATE OR REPLACE VIEW public.libro_operaciones_staff AS
SELECT
  id, reportado_por_profile_id, nombre_artistico, tipo_incidente, lugar,
  con_quien_se_trabajo, monto_facturado_usd, clima,
  sucesos_extraordinarios, relato_libre, created_at
FROM public.libro_operaciones
WHERE public.is_staff(auth.uid());

COMMENT ON VIEW public.libro_operaciones_staff IS
  'Libro de Operaciones IA · Fase 2B. Única puerta de lectura para el equipo interno (is_staff). El artista no tiene una vista propia — su excepción puntual es Fase 2A, no esta vista.';

REVOKE ALL ON public.libro_operaciones_staff FROM anon;
GRANT SELECT ON public.libro_operaciones_staff TO authenticated;
-- La vista es SELECT solamente: no expone ninguna vía de escritura.

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- V1 · Un artista con sesión puede reportar sobre sí mismo
--   SELECT public.libro_operaciones_reportar('tipo_de_prueba', 'Venue de prueba');
--   -- ESPERADO: devuelve un uuid nuevo, sin error.
--
-- V2 · Ese mismo artista NO puede leer la tabla base directamente
--   SELECT * FROM public.libro_operaciones;
--   -- ESPERADO: 0 filas o error de permiso — nunca las filas de otro, ni
--   -- siquiera la suya propia.
--
-- V3 · Ese mismo artista tampoco puede leer la vista de staff
--   SELECT * FROM public.libro_operaciones_staff;
--   -- ESPERADO: 0 filas (is_staff(auth.uid()) es false para un artista).
--
-- V4 · Un usuario de staff SÍ ve todo, agregado
--   SELECT count(*) FROM public.libro_operaciones_staff;
--   -- ESPERADO: cuenta todas las filas existentes, incluida la de V1.
--
-- V5 · No existe ningún camino de corrección o borrado
--   UPDATE public.libro_operaciones SET relato_libre = 'editado' WHERE true;
--   DELETE FROM public.libro_operaciones WHERE true;
--   -- ESPERADO: ambas fallan por permiso — no hay política que las permita,
--   -- y no existe ninguna función que las exponga.
--
-- ── REVERSIÓN ──
-- BEGIN;
--   DROP VIEW IF EXISTS public.libro_operaciones_staff;
--   DROP FUNCTION IF EXISTS public.libro_operaciones_reportar(text,text,text,numeric,text,text,text);
--   DROP TABLE IF EXISTS public.libro_operaciones;
-- COMMIT;
-- ADVERTENCIA: revertir borra cualquier reporte ya guardado. Exportar antes
-- si algún dato de prueba importa conservarse.
