-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Ticket "envío de email real a
-- clientes" (2026-09-01, ampliación de alcance del PO, ver visión ELIXIS
-- "empleado de oficina real"). Mismo patrón EXACTO que elixis_sms_pending +
-- elixis_sms_encolar/elixis_sms_cerrar (mismas columnas de auditoría, mismo
-- candado de "no se reenvía lo ya resuelto") -- se copió su definición real
-- de producción antes de escribir esto, no se adivinó.
--
-- RLS activo, CERO políticas a propósito (igual que elixis_sms_pending y
-- platform_incidents): solo service_role, vía las dos RPCs de abajo.
--
-- Decisión del PO (2026-09-01): envío AUTÓNOMO, igual que SMS -- ELIXIS
-- encola y despacha en el mismo turno, sin esperar un clic humano. El
-- candado real (destinatario SOLO desde buscar_cliente/client_profiles,
-- nunca un correo dictado) vive en elixis-chat, no aquí.

CREATE TABLE IF NOT EXISTS public.elixis_email_pending (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitado_por       uuid        NOT NULL,
  destinatario_id      uuid,
  destinatario_nombre  text        NOT NULL DEFAULT '(sin nombre)',
  destinatario_email   text        NOT NULL,
  asunto               text        NOT NULL CHECK (char_length(btrim(asunto)) BETWEEN 1 AND 200),
  cuerpo               text        NOT NULL CHECK (char_length(btrim(cuerpo)) BETWEEN 1 AND 4000),
  estado               text        NOT NULL DEFAULT 'pendiente'
                                    CHECK (estado IN ('pendiente', 'enviado', 'cancelado', 'fallido')),
  resend_id            text,
  error                text,
  creado_en            timestamptz NOT NULL DEFAULT now(),
  resuelto_en          timestamptz,
  resuelto_por         uuid
);

COMMENT ON TABLE public.elixis_email_pending IS
  'Cola/auditoría de emails que ELIXIS envía a clientes reales. Mismo patrón que elixis_sms_pending. Despacho autónomo vía elixis-email-dispatch.';

ALTER TABLE public.elixis_email_pending ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.elixis_email_pending FROM PUBLIC;
REVOKE ALL ON TABLE public.elixis_email_pending FROM anon;
REVOKE ALL ON TABLE public.elixis_email_pending FROM authenticated;
GRANT ALL ON TABLE public.elixis_email_pending TO service_role;

DROP FUNCTION IF EXISTS public.elixis_email_encolar(uuid, uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.elixis_email_encolar(
  p_solicitante uuid,
  p_dest_id     uuid,
  p_nombre      text,
  p_email       text,
  p_asunto      text,
  p_cuerpo      text
)
RETURNS TABLE(id uuid, email text, nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF coalesce(btrim(p_asunto), '') = '' THEN
    RAISE EXCEPTION 'asunto vacio';
  END IF;
  IF coalesce(btrim(p_cuerpo), '') = '' THEN
    RAISE EXCEPTION 'cuerpo vacio';
  END IF;
  IF p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'email invalido';
  END IF;

  INSERT INTO public.elixis_email_pending
         (solicitado_por, destinatario_id, destinatario_nombre, destinatario_email, asunto, cuerpo)
  VALUES (p_solicitante, p_dest_id, coalesce(nullif(btrim(p_nombre), ''), '(sin nombre)'),
          btrim(p_email), substring(btrim(p_asunto) from 1 for 200), substring(btrim(p_cuerpo) from 1 for 4000))
  RETURNING elixis_email_pending.id INTO v_id;

  RETURN QUERY SELECT v_id, p_email, p_nombre;
END;
$$;

REVOKE ALL ON FUNCTION public.elixis_email_encolar(uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.elixis_email_encolar(uuid, uuid, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.elixis_email_encolar(uuid, uuid, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.elixis_email_encolar(uuid, uuid, text, text, text, text) TO service_role;

DROP FUNCTION IF EXISTS public.elixis_email_cerrar(uuid, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.elixis_email_cerrar(
  p_id        uuid,
  p_por       uuid,
  p_estado    text,
  p_resend_id text DEFAULT NULL,
  p_error     text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_estado NOT IN ('enviado', 'cancelado', 'fallido') THEN
    RAISE EXCEPTION 'estado invalido: %', p_estado;
  END IF;
  UPDATE public.elixis_email_pending
     SET estado = p_estado, resend_id = p_resend_id, error = p_error,
         resuelto_en = now(), resuelto_por = p_por
   WHERE id = p_id AND estado = 'pendiente'; -- nunca se reenvia lo ya resuelto
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN coalesce(v_n, 0) > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.elixis_email_cerrar(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.elixis_email_cerrar(uuid, uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.elixis_email_cerrar(uuid, uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.elixis_email_cerrar(uuid, uuid, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
