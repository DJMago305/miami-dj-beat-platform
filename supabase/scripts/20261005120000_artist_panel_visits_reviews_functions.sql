-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - YA APLICADO por el PO el 2026-10-04/05. Respaldo en Git de las funciones de lectura del panel del artista
-- (visitas al perfil + QR de SoundForTips, y resenas reales), tomado de pg_get_functiondef de produccion para que el codigo no viva solo en la base.
-- Cada una filtra por auth.uid() dentro de la base y no la ejecuta anon.

CREATE OR REPLACE FUNCTION public.get_my_profile_visits_daily(p_days integer DEFAULT 120)
 RETURNS TABLE(day date, profile_visits bigint, sft_qr_visits bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.mdj_flow_tz_bucket_date(v.visited_at) as day,
         count(*) filter (where v.visit_source = 'profile')::bigint as profile_visits,
         count(*) filter (where v.visit_source = 'sft_qr')::bigint as sft_qr_visits
    from public.dj_profile_visits v
   where v.dj_user_id = auth.uid()
     and v.visited_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 120), 800)))
   group by 1
   order by 1;
$function$;
revoke all on function public.get_my_profile_visits_daily(p_days integer) from public, anon;
grant execute on function public.get_my_profile_visits_daily(p_days integer) to authenticated;

CREATE OR REPLACE FUNCTION public.get_my_review_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'review_count', count(*)::integer,
    'verified_count', (count(*) filter (where source_lead_id is not null))::integer,
    'avg_rating', case when count(*) > 0 then round(avg(rating)::numeric, 2) else null end,
    'reviews', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc)
        from (
          select r.id, r.rating,
                 nullif(btrim(coalesce(r.comment, '')), '') as comment,
                 coalesce(nullif(btrim(r.reviewer_display_name), ''), nullif(btrim(cp.full_name), ''), 'Cliente') as reviewer,
                 r.created_at,
                 (r.source_lead_id is not null) as verified
            from public.dj_public_reviews r
            left join public.client_profiles cp on cp.user_id = r.reviewer_user_id
           where r.dj_user_id = auth.uid() and r.status = 'published'
           order by r.created_at desc
           limit 12
        ) t
    ), '[]'::jsonb))
  from public.dj_public_reviews
  where dj_user_id = auth.uid() and status = 'published';
$function$;
revoke all on function public.get_my_review_summary() from public, anon;
grant execute on function public.get_my_review_summary() to authenticated;
