-- ENTORNO: PRODUCCION (hkuvuqupbxwkiykxvqdr)
-- Detalle del contacto al abrir un cumpleaños en el calendario.
--
-- El evento sincronizado de Google solo trae el NOMBRE («🎂 Sahily Guzman»): ni teléfono, ni correo, ni nota
-- (no hay conexión a la API de contactos de Google). Lo que sí existe es el Network (network_referencia_contactos)
-- y los clientes (client_profiles). Esta función busca por nombre (sin acentos ni mayúsculas) y devuelve hasta 3
-- coincidencias con lo que haya: teléfono, correo, extras, empresa, notas, redes, dirección, cumpleaños.
--
-- Es SECURITY INVOKER a propósito: respeta el RLS de cada tabla (hoy solo staff ve el Network), así que una
-- cuenta sin permiso recibe [] y no se filtra nada. No inventa datos: si no hay nada, devuelve lo que haya o [].

CREATE OR REPLACE FUNCTION public.staff_contacto_de_cumpleanos(
  p_nombre text,
  p_mes    integer DEFAULT NULL,
  p_dia    integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH n AS (
    SELECT lower(translate(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')),
                           'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) AS q
  ),
  red AS (
    SELECT 'network'::text AS fuente, c.nombre, c.telefono, c.email, c.empresa, c.notas,
           to_jsonb(c.phones_extra) AS phones_extra, to_jsonb(c.emails_extra) AS emails_extra,
           c.birth_date, c.birth_date_year_conocido AS anio_conocido,
           to_jsonb(c.redes_sociales) AS redes_sociales, to_jsonb(c.direccion) AS direccion,
           c.photo_url, c.created_at
      FROM public.network_referencia_contactos c, n
     WHERE n.q <> ''
       AND lower(translate(btrim(regexp_replace(coalesce(c.nombre, ''), '\s+', ' ', 'g')),
                           'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) = n.q
  ),
  cli AS (
    SELECT 'cliente'::text AS fuente, c.full_name AS nombre, c.phone AS telefono, c.email, c.company_name AS empresa,
           NULL::text AS notas,
           to_jsonb(c.phones_extra) AS phones_extra, to_jsonb(c.emails_extra) AS emails_extra,
           c.birth_date, true AS anio_conocido,
           NULL::jsonb AS redes_sociales, NULL::jsonb AS direccion,
           NULL::text AS photo_url, now() AS created_at
      FROM public.client_profiles c, n
     WHERE n.q <> ''
       AND lower(translate(btrim(regexp_replace(coalesce(c.full_name, ''), '\s+', ' ', 'g')),
                           'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) = n.q
  ),
  todos AS (SELECT * FROM red UNION ALL SELECT * FROM cli),
  ranq AS (
    SELECT t.*,
           ( (CASE WHEN nullif(btrim(coalesce(t.telefono, '')), '') IS NOT NULL
                     OR nullif(btrim(coalesce(t.email, '')), '') IS NOT NULL THEN 2 ELSE 0 END)
           + (CASE WHEN nullif(btrim(coalesce(t.notas, '')), '') IS NOT NULL THEN 1 ELSE 0 END)
           + (CASE WHEN p_mes IS NOT NULL AND p_dia IS NOT NULL AND t.birth_date IS NOT NULL
                     AND extract(month FROM t.birth_date) = p_mes AND extract(day FROM t.birth_date) = p_dia
                   THEN 3 ELSE 0 END) ) AS puntaje
      FROM todos t
     ORDER BY puntaje DESC, t.created_at
     LIMIT 3
  )
  SELECT coalesce(jsonb_agg(to_jsonb(r) - 'puntaje' - 'created_at' ORDER BY r.puntaje DESC, r.created_at), '[]'::jsonb)
    FROM ranq r;
$$;

REVOKE ALL ON FUNCTION public.staff_contacto_de_cumpleanos(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_contacto_de_cumpleanos(text, integer, integer) TO authenticated;
