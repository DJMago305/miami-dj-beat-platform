-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Ticket "HERRAMIENTA DE
-- RESIDENCIAS Y EFEMÉRIDES (P4)" (2026-09-01) -- Problema 2 diferido desde
-- el ticket original de agendas: "no hay tool para editar residency_schedule,
-- solo eventos únicos en artist_agenda". El PO eligió entonces "ticket
-- aparte" -- este es ese ticket.
--
-- residency_schedule YA EXISTE (6 filas reales: Sundowner Key Largo, Mojitos
-- Calle 8, El Valle Restaurante) con RLS activo y una política real
-- (residency_staff_all, is_staff() en ALL) -- este RPC no cambia RLS, solo
-- agrega un punto de escritura validado y auditable para que ELIXIS no
-- escriba directo a la tabla con el cliente ADMIN sin ninguna validación.
--
-- Nota real encontrada auditando la tabla antes de escribir esto: la columna
-- dj_id de las 6 filas reales apunta a un user_id que NO existe en
-- dj_profiles (fila huérfana o de otra fuente) -- dj_name (texto) es el
-- campo confiable, dj_id se deja NULL en las filas nuevas en vez de inventar
-- una resolución que ya se demostró poco confiable en los datos existentes.
--
-- Dinero en USD (numeric), NO en *_cents -- se respeta la convención YA
-- existente de esta tabla, no la de las tablas nuevas de hoy.

CREATE OR REPLACE FUNCTION public.residency_schedule_modificar(
  p_accion         text,
  p_dia_semana     smallint,
  p_turno          text,
  p_venue          text,
  p_dj_nombre      text DEFAULT 'DJMago305',
  p_hora_inicio    time DEFAULT NULL,
  p_hora_fin       time DEFAULT NULL,
  p_venue_pay_usd  numeric DEFAULT NULL,
  p_dj_pay_usd     numeric DEFAULT NULL,
  p_notas          text DEFAULT NULL,
  p_staff_user_id  uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_accion text := lower(trim(coalesce(p_accion, '')));
  v_venue  text := btrim(coalesce(p_venue, ''));
  v_turno  text := btrim(coalesce(p_turno, ''));
  v_notas  text := NULLIF(btrim(coalesce(p_notas, '')), '');
BEGIN
  IF v_accion NOT IN ('crear', 'actualizar', 'desactivar', 'reactivar') THEN
    RAISE EXCEPTION 'accion_invalida';
  END IF;
  IF p_dia_semana IS NULL OR p_dia_semana < 0 OR p_dia_semana > 6 THEN
    RAISE EXCEPTION 'dia_semana_invalido';
  END IF;
  IF v_venue = '' THEN
    RAISE EXCEPTION 'venue_requerido';
  END IF;
  IF v_turno = '' THEN
    RAISE EXCEPTION 'turno_requerido';
  END IF;

  IF v_accion = 'crear' THEN
    IF p_hora_inicio IS NULL OR p_hora_fin IS NULL THEN
      RAISE EXCEPTION 'horario_requerido';
    END IF;
    INSERT INTO public.residency_schedule (
      day_of_week, shift, venue, dj_name, start_time, end_time,
      venue_pay_usd, dj_pay_usd, notes, active
    ) VALUES (
      p_dia_semana, v_turno, v_venue, coalesce(nullif(btrim(p_dj_nombre), ''), 'DJMago305'),
      p_hora_inicio, p_hora_fin, coalesce(p_venue_pay_usd, 0), coalesce(p_dj_pay_usd, 250),
      v_notas, true
    )
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- actualizar/desactivar/reactivar: localiza la fila real por
  -- dia+turno+venue -- la misma combinacion que ya distingue las 6 filas
  -- reales de hoy. Nunca inventa una fila que no existe.
  SELECT r.id INTO v_id
    FROM public.residency_schedule r
   WHERE r.day_of_week = p_dia_semana
     AND lower(btrim(r.shift)) = lower(v_turno)
     AND lower(btrim(r.venue)) = lower(v_venue)
   ORDER BY r.updated_at DESC
   LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'residencia_no_encontrada';
  END IF;

  IF v_accion = 'desactivar' THEN
    UPDATE public.residency_schedule SET active = false, updated_at = now() WHERE id = v_id;
    RETURN v_id;
  END IF;

  IF v_accion = 'reactivar' THEN
    UPDATE public.residency_schedule SET active = true, updated_at = now() WHERE id = v_id;
    RETURN v_id;
  END IF;

  -- actualizar
  UPDATE public.residency_schedule
     SET dj_name        = coalesce(nullif(btrim(p_dj_nombre), ''), dj_name),
         start_time     = coalesce(p_hora_inicio, start_time),
         end_time       = coalesce(p_hora_fin, end_time),
         venue_pay_usd  = coalesce(p_venue_pay_usd, venue_pay_usd),
         dj_pay_usd     = coalesce(p_dj_pay_usd, dj_pay_usd),
         notes          = coalesce(v_notas, notes),
         updated_at     = now()
   WHERE id = v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.residency_schedule_modificar(text, smallint, text, text, text, time, time, numeric, numeric, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.residency_schedule_modificar(text, smallint, text, text, text, time, time, numeric, numeric, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.residency_schedule_modificar(text, smallint, text, text, text, time, time, numeric, numeric, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.residency_schedule_modificar(text, smallint, text, text, text, time, time, numeric, numeric, text, uuid) TO service_role;

COMMENT ON FUNCTION public.residency_schedule_modificar(text, smallint, text, text, text, time, time, numeric, numeric, text, uuid) IS
  'Escritura validada de residency_schedule para el tool gestionar_residency_schedule. EXECUTE solo service_role. Localiza filas existentes por (dia_semana, turno, venue).';

NOTIFY pgrst, 'reload schema';
