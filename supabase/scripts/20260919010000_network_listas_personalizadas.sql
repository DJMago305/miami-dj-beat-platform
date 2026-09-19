-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO: "Listas"
--   personalizadas en el sidebar de Network (referencia: la app nativa
--   de Listas de contactos que mostró -- botón + para crear, menú de
--   "..." con Renombrar/Eliminar, y al editar un contacto se le pone
--   el nombre del grupo y aparece ahí solo).
-- ============================================================
--
-- Por qué una tabla nueva y no reusar las categorías existentes: las
-- categorías (Artistas/DJ/Cliente Personal/etc.) se DERIVAN de datos
-- reales (artist_specialty, is_commercial) -- no son algo que el staff
-- pueda crear o nombrar libremente. Esto es distinto: listas
-- LIBRES, creadas y nombradas por el staff, que pueden mezclar
-- contactos de client_profiles Y dj_profiles en la misma lista (por
-- eso la tabla de miembros guarda "fuente" -- no hay un id único de
-- "contacto" que abarque las dos tablas).

CREATE TABLE IF NOT EXISTS public.network_lists (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    created_by  uuid REFERENCES auth.users(id),
    created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.network_lists IS 'Listas personalizadas del Network (staff), libres -- no derivadas de datos como las categorías automáticas.';

CREATE TABLE IF NOT EXISTS public.network_list_members (
    list_id      uuid NOT NULL REFERENCES public.network_lists(id) ON DELETE CASCADE,
    fuente       text NOT NULL CHECK (fuente IN ('client', 'dj')),
    contacto_id  uuid NOT NULL,
    added_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (list_id, fuente, contacto_id)
);
COMMENT ON TABLE public.network_list_members IS 'Membresía de contactos (client_profiles o dj_profiles) en una network_lists.';

ALTER TABLE public.network_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_list_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS network_lists_staff_all ON public.network_lists;
CREATE POLICY network_lists_staff_all
  ON public.network_lists FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS network_list_members_staff_all ON public.network_list_members;
CREATE POLICY network_list_members_staff_all
  ON public.network_list_members FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ── Crear lista ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.network_list_crear(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id   uuid;
  v_name text := NULLIF(trim(p_name), '');
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_only');
  END IF;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nombre_vacio');
  END IF;

  INSERT INTO public.network_lists (name, created_by) VALUES (v_name, auth.uid())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'name', v_name);
END;
$$;

-- ── Renombrar lista ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.network_list_renombrar(p_id uuid, p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := NULLIF(trim(p_name), '');
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_only');
  END IF;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nombre_vacio');
  END IF;

  UPDATE public.network_lists SET name = v_name WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lista_no_encontrada');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Eliminar lista (y su membresía, vía ON DELETE CASCADE) ─────────────
CREATE OR REPLACE FUNCTION public.network_list_eliminar(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_only');
  END IF;

  DELETE FROM public.network_lists WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lista_no_encontrada');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Asignar contacto a una lista, por NOMBRE (crea la lista si no existe
--    -- "se le pone el nombre del grupo y automáticamente aparece ahí") ──
CREATE OR REPLACE FUNCTION public.network_list_asignar_por_nombre(
    p_list_name  text,
    p_fuente     text,
    p_contacto_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name    text := NULLIF(trim(p_list_name), '');
  v_list_id uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_only');
  END IF;
  IF p_fuente NOT IN ('client', 'dj') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'fuente_invalida');
  END IF;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nombre_vacio');
  END IF;

  SELECT id INTO v_list_id FROM public.network_lists WHERE lower(name) = lower(v_name) LIMIT 1;
  IF v_list_id IS NULL THEN
    INSERT INTO public.network_lists (name, created_by) VALUES (v_name, auth.uid())
    RETURNING id INTO v_list_id;
  END IF;

  INSERT INTO public.network_list_members (list_id, fuente, contacto_id)
  VALUES (v_list_id, p_fuente, p_contacto_id)
  ON CONFLICT (list_id, fuente, contacto_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'list_id', v_list_id, 'list_name', v_name);
END;
$$;

-- ── Quitar contacto de una lista ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.network_list_quitar(
    p_list_id     uuid,
    p_fuente      text,
    p_contacto_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_only');
  END IF;

  DELETE FROM public.network_list_members
   WHERE list_id = p_list_id AND fuente = p_fuente AND contacto_id = p_contacto_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.network_list_crear(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_list_renombrar(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_list_eliminar(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_list_asignar_por_nombre(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_list_quitar(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_list_crear(text) FROM anon;
REVOKE ALL ON FUNCTION public.network_list_renombrar(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.network_list_eliminar(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.network_list_asignar_por_nombre(text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.network_list_quitar(uuid, text, uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.network_list_crear(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.network_list_renombrar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.network_list_eliminar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.network_list_asignar_por_nombre(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.network_list_quitar(uuid, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
