-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - OPINIONES DEL ARTISTA: pagina de resenas PROPIAS con orden (mas recientes / mas antiguas)
-- Motivo: get_my_review_summary() solo devuelve las 12 mas recientes; para ordenar "mas antiguas" cuando haya mas de 12 hace falta pedirlas al servidor, paginadas.
-- Solo lee lo del usuario autenticado (auth.uid() dentro de la funcion, igual que get_my_review_summary); sin sesion devuelve []. Solo escribe la funcion; idempotente.
create or replace function public.get_my_reviews_page(p_order text default 'recent', p_limit integer default 6, p_offset integer default 0)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    from (
      select r.id, r.rating,
             nullif(btrim(coalesce(r.comment, '')), '') as comment,
             coalesce(nullif(btrim(r.reviewer_display_name), ''), nullif(btrim(cp.full_name), ''), 'Cliente') as reviewer,
             r.created_at,
             (r.source_lead_id is not null) as verified
        from public.dj_public_reviews r
        left join public.client_profiles cp on cp.user_id = r.reviewer_user_id
       where r.dj_user_id = auth.uid() and r.status = 'published'
       order by (case when lower(coalesce(p_order, 'recent')) = 'oldest' then r.created_at end) asc nulls last,
                r.created_at desc, r.id
       limit greatest(1, least(coalesce(p_limit, 6), 50))
      offset greatest(0, coalesce(p_offset, 0))
    ) t;
$$;
revoke all on function public.get_my_reviews_page(text, integer, integer) from public, anon;
grant execute on function public.get_my_reviews_page(text, integer, integer) to authenticated;

-- Comprobacion: debe dar  true / false
select has_function_privilege('authenticated', 'public.get_my_reviews_page(text, integer, integer)', 'execute') as authenticated_ejecuta,
       has_function_privilege('anon', 'public.get_my_reviews_page(text, integer, integer)', 'execute') as anon_ejecuta;
