-- Header smart search: anonymous teaser lookup (no PII in the result set).
-- Returns only id + public-facing title (from event_type) + event_date.

CREATE OR REPLACE FUNCTION public.mdj_public_search_event_teasers(p_query text)
RETURNS TABLE (
  id uuid,
  title text,
  event_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    COALESCE(NULLIF(trim(l.event_type), ''), 'Event')::text AS title,
    l.event_date::date
  FROM public.leads l
  WHERE length(trim(coalesce(p_query, ''))) >= 2
    AND (
      l.event_type ILIKE '%' || trim(p_query) || '%'
      OR (
        l.contact_person IS NOT NULL
        AND trim(l.contact_person) <> ''
        AND l.contact_person ILIKE '%' || trim(p_query) || '%'
      )
      OR (
        l.event_date IS NOT NULL
        AND l.event_date::text ILIKE '%' || trim(p_query) || '%'
      )
    )
  ORDER BY l.event_date DESC NULLS LAST
  LIMIT 15;
$$;

GRANT EXECUTE ON FUNCTION public.mdj_public_search_event_teasers(text) TO anon, authenticated;

COMMENT ON FUNCTION public.mdj_public_search_event_teasers(text) IS
  'Public header search: id, event type title, date only — never email/phone/location/budget.';

NOTIFY pgrst, 'reload schema';
