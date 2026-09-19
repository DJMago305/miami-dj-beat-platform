-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO: importar
--   su base de datos externa de contactos (proveedores, artistas,
--   clientes potenciales, familia) que NO tienen cuenta real en la
--   plataforma -- "estos contactos no tienen cuenta con nosotros,
--   solo son parte de nuestra base de datos para publicidad".
-- ============================================================
--
-- Por qué una tabla nueva y no client_profiles/dj_profiles: dj_profiles
-- exige user_id NOT NULL (cuenta real vinculada a auth.users) -- no se
-- puede insertar ahí sin inventar una cuenta falsa. client_profiles
-- permite user_id nulo, pero mezclar "cliente real con historial de
-- reservas" con "contacto de publicidad sin relación aún" ensuciaría
-- esa tabla y cualquier lógica que asuma que una fila ahí es un cliente
-- real. Se modela aparte, honesto sobre lo que es: un directorio de
-- referencia, no una cuenta.
--
-- network_list_members.fuente tenía CHECK (fuente IN ('client','dj'))
-- -- se amplía a 'referencia' para que estos contactos puedan vivir
-- dentro de las mismas categorías (personalizadas o "Todos") que ya
-- usan los contactos con cuenta real.

CREATE TABLE IF NOT EXISTS public.network_referencia_contactos (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      text NOT NULL,
    telefono    text,
    email       text,
    empresa     text,
    notas       text,
    origen_csv  text,                    -- qué archivo/formulario lo trajo (auditoría de import, no dato del contacto)
    created_by  uuid REFERENCES auth.users(id),
    created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.network_referencia_contactos IS 'Contactos de referencia del Network SIN cuenta real en la plataforma (proveedores, prospectos, familia) -- base de datos de publicidad/relaciones, importada 2026-09-19. Distinto de client_profiles/dj_profiles, que representan cuentas reales.';

ALTER TABLE public.network_referencia_contactos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS network_referencia_contactos_staff_all ON public.network_referencia_contactos;
CREATE POLICY network_referencia_contactos_staff_all
  ON public.network_referencia_contactos FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Amplía el CHECK de network_list_members para admitir la nueva fuente.
ALTER TABLE public.network_list_members DROP CONSTRAINT IF EXISTS network_list_members_fuente_check;
ALTER TABLE public.network_list_members ADD CONSTRAINT network_list_members_fuente_check
  CHECK (fuente IN ('client', 'dj', 'referencia'));

-- ── Actualizar teléfono/email de un contacto de referencia ──────────
-- Mismo criterio que network_contacto_actualizar (staff-only,
-- auditado), pero mucho más simple: esta tabla no tiene columnas de
-- negocio (plan/tier/etc.), solo datos de contacto.
CREATE OR REPLACE FUNCTION public.network_referencia_actualizar(
    p_id      uuid,
    p_phone   text DEFAULT NULL,
    p_email   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes jsonb;
  v_phone text := NULLIF(trim(p_phone), '');
  v_email text := NULLIF(trim(p_email), '');
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_only');
  END IF;

  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_invalido');
  END IF;

  SELECT to_jsonb(r) INTO v_antes FROM public.network_referencia_contactos r WHERE r.id = p_id;
  IF v_antes IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contacto_no_encontrado');
  END IF;

  UPDATE public.network_referencia_contactos
     SET telefono = COALESCE(v_phone, telefono),
         email    = COALESCE(v_email, email)
   WHERE id = p_id;

  BEGIN
    PERFORM public.mdj_auditar(
      p_accion        => 'network_referencia_actualizar',
      p_recurso_tabla => 'network_referencia_contactos',
      p_recurso_id    => p_id::text,
      p_antes         => jsonb_build_object('telefono', v_antes->>'telefono', 'email', v_antes->>'email'),
      p_despues       => jsonb_build_object('telefono', COALESCE(v_phone, v_antes->>'telefono'), 'email', COALESCE(v_email, v_antes->>'email')),
      p_origen        => 'network'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.network_referencia_actualizar(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_referencia_actualizar(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.network_referencia_actualizar(uuid, text, text) TO authenticated;
COMMENT ON FUNCTION public.network_referencia_actualizar(uuid, text, text) IS
  'Staff-only (is_staff): actualiza phone/email de un contacto de referencia (network_referencia_contactos, sin cuenta real). Auditado vía mdj_auditar.';

NOTIFY pgrst, 'reload schema';
