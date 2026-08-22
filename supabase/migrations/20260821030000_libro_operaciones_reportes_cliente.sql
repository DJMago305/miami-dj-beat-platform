-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo (rtbsovavmtnjpbbpwsin)                    ║
-- ║  NO EJECUTAR EN PRODUCCIÓN SIN AUTORIZACIÓN EXPRESA DEL PO                ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  Libro de Operaciones IA · Reporte del Cliente                          ║
-- ║  Requiere: Fase 1 (candado del libro), M1/M2 (profile_id + resolución)   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- COMPROBAR ANTES DE CORRER — no asumir por notas de otra sesión
--   SELECT to_regclass('public.libro_operaciones_reportes_cliente');
--   -- Si NO da null → esta migración YA CORRIÓ. No repetir.
--
-- QUÉ ES
--   El artista reporta sobre sí mismo (Fase 1/2A). El cliente reporta sobre el
--   EVENTO que vivió — satisfacción o incidente, corto, del estilo "¿cómo salió
--   tu pedido?" de una plataforma de compras. Nunca una narrativa larga: la
--   nota tiene un límite duro de 280 caracteres a nivel de columna, no solo de
--   sugerencia en la pantalla.
--
-- MISMO CANDADO QUE LA FASE 1, TABLA APARTE
--   Campos distintos (el cliente no factura nada, no reporta clima de un
--   evento que no armó) ameritan una tabla propia, no columnas nulas forzadas
--   en libro_operaciones. Misma familia, mismo candado: sin políticas para
--   nadie, única entrada vía función que resuelve identidad en el servidor.
--
-- DE DÓNDE SALE EL EVENTO
--   El cliente ya navega sus eventos por `leads.id` en client-portal — no se
--   inventa una referencia nueva. La función valida que el lead sea del
--   cliente que llama (leads.client_user_id = auth.uid()) antes de aceptar
--   el reporte.
--
-- QUÉ NO HACE
--   · No decide si ELIXIS (Fase 3/5) también lee estos reportes — eso es una
--     extensión futura, no esta migración.
--   · No construye la pantalla del cliente — eso es la pieza de interfaz,
--     aparte.

BEGIN;

-- ── 1 · La tabla ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.libro_operaciones_reportes_cliente (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reportado_por_profile_id text NOT NULL REFERENCES public.client_profiles (profile_id),
  lead_id                 uuid NOT NULL REFERENCES public.leads (id),
  tipo                    text NOT NULL CHECK (tipo IN ('satisfaccion', 'incidente')),
  calificacion            smallint CHECK (calificacion BETWEEN 1 AND 5),
  nota                    text CHECK (nota IS NULL OR char_length(nota) <= 280),
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.libro_operaciones_reportes_cliente IS
  'Libro de Operaciones IA · reporte corto del cliente sobre un evento (satisfacción o incidente). Nota limitada a 280 caracteres a nivel de columna — el libro solo escribe lo importante.';

-- ── 2 · El candado: RLS activo, sin ninguna política ───────────────────────
ALTER TABLE public.libro_operaciones_reportes_cliente ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.libro_operaciones_reportes_cliente FROM anon;
REVOKE ALL ON public.libro_operaciones_reportes_cliente FROM authenticated;

-- ── 3 · Única puerta de entrada ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.libro_operaciones_reportar_cliente(
  p_lead_id      uuid,
  p_tipo         text,
  p_calificacion smallint DEFAULT NULL,
  p_nota         text     DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id text;
  v_lead_owner uuid;
  v_nuevo_id   uuid;
BEGIN
  IF p_tipo NOT IN ('satisfaccion', 'incidente') THEN
    RAISE EXCEPTION 'libro_operaciones_reportar_cliente: tipo debe ser satisfaccion o incidente';
  END IF;
  IF p_nota IS NOT NULL AND char_length(p_nota) > 280 THEN
    RAISE EXCEPTION 'libro_operaciones_reportar_cliente: la nota no puede pasar de 280 caracteres — el libro solo escribe lo importante';
  END IF;

  v_profile_id := public.mdj_profile_de_usuario(auth.uid());
  IF v_profile_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.client_profiles WHERE profile_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'libro_operaciones_reportar_cliente: esta sesión no corresponde a un cliente';
  END IF;

  SELECT client_user_id INTO v_lead_owner FROM public.leads WHERE id = p_lead_id;
  IF v_lead_owner IS NULL OR v_lead_owner <> auth.uid() THEN
    RAISE EXCEPTION 'libro_operaciones_reportar_cliente: ese evento no pertenece a esta sesión';
  END IF;

  INSERT INTO public.libro_operaciones_reportes_cliente (
    reportado_por_profile_id, lead_id, tipo, calificacion, nota
  ) VALUES (
    v_profile_id, p_lead_id, p_tipo, p_calificacion, p_nota
  )
  RETURNING id INTO v_nuevo_id;

  RETURN v_nuevo_id;
END;
$$;

COMMENT ON FUNCTION public.libro_operaciones_reportar_cliente(uuid,text,smallint,text) IS
  'Libro de Operaciones IA · el cliente reporta satisfacción o un incidente corto sobre SU evento. Valida que el evento le pertenezca antes de aceptar el reporte.';

REVOKE ALL ON FUNCTION public.libro_operaciones_reportar_cliente(uuid,text,smallint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.libro_operaciones_reportar_cliente(uuid,text,smallint,text) TO authenticated;

-- ── 4 · Lectura del equipo, misma vía que la Fase 2B ────────────────────────
CREATE OR REPLACE VIEW public.libro_operaciones_reportes_cliente_staff AS
SELECT
  c.id, c.reportado_por_profile_id, c.lead_id, c.tipo, c.calificacion, c.nota, c.created_at,
  l.event_name, l.event_date
FROM public.libro_operaciones_reportes_cliente c
LEFT JOIN public.leads l ON l.id = c.lead_id
WHERE public.is_staff(auth.uid());

COMMENT ON VIEW public.libro_operaciones_reportes_cliente_staff IS
  'Libro de Operaciones IA · vista de staff de los reportes de clientes, con el nombre y fecha del evento ya resueltos.';

REVOKE ALL ON public.libro_operaciones_reportes_cliente_staff FROM anon;
GRANT SELECT ON public.libro_operaciones_reportes_cliente_staff TO authenticated;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- V1 · Una nota de más de 280 caracteres se rechaza
--   SELECT public.libro_operaciones_reportar_cliente('<lead_id>', 'satisfaccion', 5, repeat('a', 300));
--   -- ESPERADO: excepción — 'la nota no puede pasar de 280 caracteres'.
--
-- V2 · Un cliente no puede reportar sobre el evento de otro
--   -- sesión de un cliente distinto al dueño del lead:
--   SELECT public.libro_operaciones_reportar_cliente('<lead_id_de_otro>', 'satisfaccion', 5, 'Todo bien');
--   -- ESPERADO: excepción — 'ese evento no pertenece a esta sesión'.
--
-- V3 · Un cliente reporta sobre su propio evento
--   SELECT public.libro_operaciones_reportar_cliente('<mi_lead_id>', 'satisfaccion', 5, 'Excelente el DJ, llegó a tiempo.');
--   -- ESPERADO: devuelve un uuid nuevo.
--
-- V4 · Ni el cliente ni un visitante leen la tabla base directamente
--   SELECT * FROM public.libro_operaciones_reportes_cliente;
--   -- ESPERADO: 0 filas o error de permiso.
--
-- ── REVERSIÓN ──
-- BEGIN;
--   DROP VIEW IF EXISTS public.libro_operaciones_reportes_cliente_staff;
--   DROP FUNCTION IF EXISTS public.libro_operaciones_reportar_cliente(uuid,text,smallint,text);
--   DROP TABLE IF EXISTS public.libro_operaciones_reportes_cliente;
-- COMMIT;
-- ADVERTENCIA: revertir borra cualquier reporte de cliente ya guardado.
