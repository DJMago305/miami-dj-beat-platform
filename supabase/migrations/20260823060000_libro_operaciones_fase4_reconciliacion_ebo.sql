-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo (rtbsovavmtnjpbbpwsin)                    ║
-- ║  NO EJECUTAR EN PRODUCCIÓN SIN AUTORIZACIÓN EXPRESA DEL PO                ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  Libro de Operaciones IA · Fase 4 — Reconciliación contra                 ║
-- ║  event_builder_orders (SSOT de reserva, decisión PO 2026-08-22)           ║
-- ║  Requiere: Fase 1 + Fase 2A (libro_operaciones, libro_operaciones_reportar) ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- QUÉ ES
--   Vincula (opcionalmente) cada fila de libro_operaciones con la orden
--   comercial real en event_builder_orders, y da a staff una vista que
--   contrasta el autorreporte del artista (monto_facturado_usd) contra el
--   total oficial de esa orden (total_usd). Nunca corrige ni borra — Fase 1
--   selló la inmutabilidad de la tabla base y esta migración no la toca.
--
-- POR QUÉ NO ES OBLIGATORIO EL VÍNCULO
--   El artista reporta incidentes sobre residencias y eventos anteriores a
--   esta tabla que jamás pasaron por Event Builder. Forzar el vínculo
--   convertiría esos reportes legítimos en imposibles de guardar. La columna
--   es nullable a propósito; una fila sin vínculo no es un error, es
--   "fuera de sistema" y queda fuera de la reconciliación automática.
--
-- QUÉ NO HACE
--   · No corrige monto_facturado_usd ni ninguna otra columna de Fase 1.
--   · No construye UI — el widget del artista (Fase 2A) y la página de
--     staff (Fase 2B) son trabajo aparte, no tocado en esta migración.
--   · No decide qué pasa cuando hay diferencia — solo la señala. La acción
--     sobre una discrepancia queda para quien lea la vista (staff).

BEGIN;

-- ── 1 · Columna de vínculo, nullable ─────────────────────────────────────
ALTER TABLE public.libro_operaciones
  ADD COLUMN IF NOT EXISTS event_builder_order_id uuid
    REFERENCES public.event_builder_orders (id);

COMMENT ON COLUMN public.libro_operaciones.event_builder_order_id IS
  'Vínculo opcional a la orden comercial real (SSOT de reserva, event_builder_orders). NULL cuando el reporte no corresponde a una orden EBO (residencia, evento previo a esta tabla) — esperado, no un error.';

CREATE INDEX IF NOT EXISTS idx_libro_operaciones_ebo
  ON public.libro_operaciones (event_builder_order_id)
  WHERE event_builder_order_id IS NOT NULL;

-- ── 2 · RPC de escritura: se reemplaza por completo con el parámetro nuevo ──
-- La firma vigente (Fase 1 + Fase 2A, ver 20260821030000) termina en
-- p_acepta_aviso_legal boolean. Postgres identifica funciones por la lista
-- de tipos de sus parámetros: agregar un noveno parámetro con CREATE OR
-- REPLACE NO reemplaza la firma de 8 — crea una función sobrecargada
-- aparte, y Supabase/PostgREST puede resolver mal cuál invocar cuando dos
-- funciones comparten nombre. Por eso el DROP explícito de la firma vieja
-- antes de crear la nueva: una sola función, un solo contrato, siguiendo la
-- ley "un patrón por función".
DROP FUNCTION IF EXISTS public.libro_operaciones_reportar(text,text,text,numeric,text,text,text,boolean);

CREATE OR REPLACE FUNCTION public.libro_operaciones_reportar(
  p_tipo_incidente          text,
  p_lugar                   text DEFAULT NULL,
  p_con_quien_se_trabajo    text DEFAULT NULL,
  p_monto_facturado_usd     numeric(10,2) DEFAULT NULL,
  p_clima                   text DEFAULT NULL,
  p_sucesos_extraordinarios text DEFAULT NULL,
  p_relato_libre            text DEFAULT NULL,
  p_acepta_aviso_legal      boolean DEFAULT false,
  p_event_builder_order_id  uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id text;
  v_nombre     text;
  v_nuevo_id   uuid;
  v_order_user uuid;
BEGIN
  IF p_tipo_incidente IS NULL OR btrim(p_tipo_incidente) = '' THEN
    RAISE EXCEPTION 'libro_operaciones_reportar: tipo_incidente es obligatorio';
  END IF;

  v_profile_id := public.mdj_profile_de_usuario(auth.uid());
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'libro_operaciones_reportar: no se encontró un perfil para esta sesión';
  END IF;

  -- Primera vez: sin aceptación registrada, no hay reporte posible (Fase 2A).
  IF NOT EXISTS (
    SELECT 1 FROM public.libro_operaciones_aviso_aceptado WHERE profile_id = v_profile_id
  ) THEN
    IF NOT p_acepta_aviso_legal THEN
      RAISE EXCEPTION 'aviso_legal_pendiente'
        USING HINT = 'Debe mostrarse y aceptarse la cláusula legal antes del primer reporte.';
    END IF;
    INSERT INTO public.libro_operaciones_aviso_aceptado (profile_id) VALUES (v_profile_id);
  END IF;

  -- Si se pasa un event_builder_order_id, confirmar que la orden pertenece
  -- a quien reporta — nadie puede vincular su reporte a la orden de otro.
  IF p_event_builder_order_id IS NOT NULL THEN
    SELECT user_id INTO v_order_user
      FROM public.event_builder_orders
     WHERE id = p_event_builder_order_id;

    IF v_order_user IS NULL THEN
      RAISE EXCEPTION 'libro_operaciones_reportar: event_builder_order_id no existe';
    END IF;
    IF v_order_user IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'libro_operaciones_reportar: esa orden no pertenece a quien reporta';
    END IF;
  END IF;

  SELECT coalesce(nullif(btrim(stage_name), ''), nullif(btrim(dj_name), ''), '(sin nombre)')
    INTO v_nombre
    FROM public.dj_profiles
   WHERE profile_id = v_profile_id;

  INSERT INTO public.libro_operaciones (
    reportado_por_profile_id, nombre_artistico, tipo_incidente, lugar,
    con_quien_se_trabajo, monto_facturado_usd, clima,
    sucesos_extraordinarios, relato_libre, event_builder_order_id
  ) VALUES (
    v_profile_id, v_nombre, btrim(p_tipo_incidente), p_lugar,
    p_con_quien_se_trabajo, p_monto_facturado_usd, p_clima,
    p_sucesos_extraordinarios, p_relato_libre, p_event_builder_order_id
  )
  RETURNING id INTO v_nuevo_id;

  RETURN v_nuevo_id;
END;
$$;

COMMENT ON FUNCTION public.libro_operaciones_reportar(text,text,text,numeric,text,text,text,boolean,uuid) IS
  'Libro de Operaciones IA · Fase 1 + 2A + 4. Única puerta de escritura. Exige aceptación del aviso legal la primera vez; el vínculo a event_builder_order_id es opcional y se valida contra el dueño de la orden antes de aceptarlo.';

REVOKE ALL ON FUNCTION public.libro_operaciones_reportar(text,text,text,numeric,text,text,text,boolean,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.libro_operaciones_reportar(text,text,text,numeric,text,text,text,boolean,uuid)
  TO authenticated;

-- NOTA PARA QUIEN TERMINE LA UI DE FASE 2A/2B: el widget del artista
-- (web/libro-operaciones-widget.js) llama hoy a libro_operaciones_reportar
-- con 8 argumentos nombrados (sin p_event_builder_order_id). Como el nuevo
-- parámetro tiene DEFAULT NULL y la llamada usa argumentos nombrados (no
-- posicionales), el widget sigue funcionando sin cambios — pero no ofrece
-- todavía la opción de vincular una orden. Cablear ese selector en el
-- formulario es trabajo de UI, fuera del alcance de esta migración.

-- ── 3 · Vista de reconciliación, solo-staff ──────────────────────────────
-- Mismo candado que libro_operaciones_staff (Fase 1): SECURITY DEFINER,
-- filtrada por is_staff(). Nunca corrige — solo señala la diferencia.
CREATE OR REPLACE VIEW public.libro_operaciones_reconciliacion_staff AS
SELECT
  lo.id                                     AS libro_operaciones_id,
  lo.reportado_por_profile_id,
  lo.nombre_artistico,
  lo.tipo_incidente,
  lo.monto_facturado_usd                    AS autorreporte_usd,
  lo.event_builder_order_id,
  ebo.total_usd                             AS orden_total_usd,
  ebo.payment_status                        AS orden_payment_status,
  CASE WHEN lo.event_builder_order_id IS NOT NULL
       THEN lo.monto_facturado_usd - ebo.total_usd
       ELSE NULL
  END                                        AS diferencia_usd,
  lo.created_at
FROM public.libro_operaciones lo
LEFT JOIN public.event_builder_orders ebo
  ON ebo.id = lo.event_builder_order_id
WHERE public.is_staff(auth.uid());

COMMENT ON VIEW public.libro_operaciones_reconciliacion_staff IS
  'Libro de Operaciones IA · Fase 4. Solo-staff (is_staff). Contrasta el autorreporte del artista contra event_builder_orders.total_usd cuando hay vínculo. Filas sin event_builder_order_id muestran orden_total_usd/diferencia_usd en NULL — fuera de sistema, no un error. Nunca corrige ni borra la tabla base.';

REVOKE ALL ON public.libro_operaciones_reconciliacion_staff FROM anon;
GRANT SELECT ON public.libro_operaciones_reconciliacion_staff TO authenticated;
-- La vista es SELECT solamente: no expone ninguna vía de escritura.

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- V1 · Un artista reporta vinculando su propia orden
--   SELECT public.libro_operaciones_reportar('tipo_de_prueba', 'Venue de prueba',
--     NULL, 500.00, NULL, NULL, NULL, true, '<id_de_una_orden_propia>');
--   -- ESPERADO: devuelve un uuid nuevo, sin error.
--
-- V2 · Un artista NO puede vincular la orden de otro
--   SELECT public.libro_operaciones_reportar('tipo_de_prueba', NULL, NULL, NULL,
--     NULL, NULL, NULL, true, '<id_de_orden_de_otro_usuario>');
--   -- ESPERADO: excepción 'esa orden no pertenece a quien reporta'.
--
-- V3 · Un artista sigue pudiendo reportar sin vincular ninguna orden
--   SELECT public.libro_operaciones_reportar('tipo_de_prueba', NULL, NULL, NULL,
--     NULL, NULL, NULL, true);
--   -- ESPERADO: devuelve un uuid nuevo (p_event_builder_order_id usa su DEFAULT NULL).
--
-- V4 · Staff ve la reconciliación con la diferencia calculada
--   SELECT * FROM public.libro_operaciones_reconciliacion_staff
--   WHERE event_builder_order_id IS NOT NULL;
--   -- ESPERADO: fila de V1 con diferencia_usd = autorreporte_usd - orden_total_usd.
--
-- V5 · Un artista (no-staff) no ve la vista de reconciliación
--   SELECT * FROM public.libro_operaciones_reconciliacion_staff;
--   -- ESPERADO: 0 filas (is_staff(auth.uid()) es false).
--
-- ── REVERSIÓN ──
-- BEGIN;
--   DROP VIEW IF EXISTS public.libro_operaciones_reconciliacion_staff;
--   DROP FUNCTION IF EXISTS public.libro_operaciones_reportar(text,text,text,numeric,text,text,text,boolean,uuid);
--   -- Restaura la firma de 8 parámetros (Fase 1 + 2A) corriendo de nuevo el
--   -- bloque "0b" de 20260821030000_libro_operaciones_reportes_cliente.sql.
--   DROP INDEX IF EXISTS idx_libro_operaciones_ebo;
--   ALTER TABLE public.libro_operaciones DROP COLUMN IF EXISTS event_builder_order_id;
-- COMMIT;
-- ADVERTENCIA: revertir la columna borra cualquier vínculo ya guardado
-- (no borra las filas de libro_operaciones en sí, solo el vínculo).
