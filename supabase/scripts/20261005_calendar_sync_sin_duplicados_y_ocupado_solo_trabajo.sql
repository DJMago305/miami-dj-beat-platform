-- ENTORNO: PRODUCCION (hkuvuqupbxwkiykxvqdr)
-- Calendario sincronizado (Google/Apple) en elixis_agenda_eventos: duplicados y vista «Ocupado».
--
-- Causas demostradas en producción (2026-10-05):
--  (a) Sin índice único sobre (user_id, external_event_id): si el webhook corre dos veces a la vez, inserta
--      el mismo evento varias veces (un cumpleaños quedó con 21 copias idénticas).
--  (b) Un mismo cumpleaños llega por dos calendarios (el de cumpleaños -> 'cumpleanos' y el principal -> 'nota')
--      con external_event_id distinto: quedaba doble (14 casos).
--  (c) elixis_agenda_eventos_ocupado (vista de Performance/vendedores) incluía cumpleaños y notas de «todo el día»:
--      un cumpleaños aparecía como «Ocupado» y, guardado a medianoche UTC, caía un día antes (8 PM del día anterior).
--      Los eventos de todo el día se guardan a medianoche UTC por convención (lo leen así otros lectores): NO se
--      migra el almacenamiento; la vista de «ocupado» simplemente deja de incluirlos.
--
-- Esto NO borra datos que no sean copias exactas: los gemelos entre calendarios se marcan 'cancelado' (reversible).

-- 1) Copias exactas (mismo usuario y mismo external_event_id): se conserva la más antigua.
DELETE FROM public.elixis_agenda_eventos e
USING (
  SELECT id, row_number() OVER (PARTITION BY user_id, external_event_id ORDER BY created_at, id) AS rn
    FROM public.elixis_agenda_eventos
   WHERE external_event_id IS NOT NULL
) d
WHERE e.id = d.id AND d.rn > 1;

-- 2) Gemelos entre calendarios (mismo usuario, mismo instante, mismo texto): queda uno, 'cumpleanos' gana a 'nota'.
UPDATE public.elixis_agenda_eventos e
   SET estado = 'cancelado', updated_at = now()
  FROM (
    SELECT id, row_number() OVER (
             PARTITION BY user_id, fecha_inicio, lower(btrim(notas))
             ORDER BY (tipo = 'cumpleanos') DESC, created_at, id) AS rn
      FROM public.elixis_agenda_eventos
     WHERE agent_id = 'calendar-sync' AND estado = 'activo' AND NULLIF(btrim(coalesce(notas, '')), '') IS NOT NULL
  ) d
 WHERE e.id = d.id AND d.rn > 1;

-- 3) A partir de ahora no pueden repetirse las copias exactas.
CREATE UNIQUE INDEX IF NOT EXISTS elixis_agenda_eventos_user_external_uq
  ON public.elixis_agenda_eventos (user_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

-- 4) Ni los gemelos entre calendarios: al insertar un evento sincronizado que ya existe con otro id, no se duplica.
CREATE OR REPLACE FUNCTION public.elixis_agenda_evento_sin_gemelos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gemelo uuid;
  v_tipo   text;
BEGIN
  IF NEW.agent_id IS DISTINCT FROM 'calendar-sync' OR NEW.estado <> 'activo'
     OR NULLIF(btrim(coalesce(NEW.notas, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT g.id, g.tipo INTO v_gemelo, v_tipo
    FROM public.elixis_agenda_eventos g
   WHERE g.user_id = NEW.user_id AND g.agent_id = 'calendar-sync' AND g.estado = 'activo'
     AND g.fecha_inicio = NEW.fecha_inicio
     AND lower(btrim(g.notas)) = lower(btrim(NEW.notas))
     AND g.external_event_id IS DISTINCT FROM NEW.external_event_id
   ORDER BY g.created_at
   LIMIT 1;

  IF v_gemelo IS NULL THEN
    RETURN NEW;
  END IF;

  -- el cumpleaños gana a la nota: se retira la nota y entra el cumpleaños
  IF NEW.tipo = 'cumpleanos' AND v_tipo <> 'cumpleanos' THEN
    UPDATE public.elixis_agenda_eventos SET estado = 'cancelado', updated_at = now() WHERE id = v_gemelo;
    RETURN NEW;
  END IF;

  RETURN NULL;  -- ya existe: no se inserta la copia
END
$$;

REVOKE ALL ON FUNCTION public.elixis_agenda_evento_sin_gemelos() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_elixis_agenda_evento_sin_gemelos ON public.elixis_agenda_eventos;
CREATE TRIGGER trg_elixis_agenda_evento_sin_gemelos
  BEFORE INSERT ON public.elixis_agenda_eventos
  FOR EACH ROW EXECUTE FUNCTION public.elixis_agenda_evento_sin_gemelos();

-- 5) «Ocupado» solo con trabajo: sin cumpleaños y sin notas de todo el día (medianoche UTC en ambos extremos).
CREATE OR REPLACE VIEW public.elixis_agenda_eventos_ocupado AS
 SELECT id, dj_nombre, fecha_inicio, fecha_fin, tipo
   FROM public.elixis_agenda_eventos
  WHERE estado = 'activo'
    AND es_confidencial_staff = false
    AND is_staff(auth.uid())
    AND tipo <> 'cumpleanos'
    AND NOT (tipo = 'nota'
             AND (fecha_inicio AT TIME ZONE 'UTC')::time = TIME '00:00'
             AND (fecha_fin    AT TIME ZONE 'UTC')::time = TIME '00:00');
