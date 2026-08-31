-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Aplicada ya vía MCP el 2026-08-31
-- (ticket "AUTORIZACIÓN DE MIGRACIÓN SUPABASE Y CONSTRUCCIÓN DE MEMORIA DE
-- HILOS"); este archivo la deja versionada en el repo, no la vuelve a aplicar.
--
-- RPCs de lectura/gestión complementarias a elixis_thread_append (escritura,
-- ver 20260826200000_elixis_session_threads.sql). Todas SECURITY DEFINER,
-- todas ancladas a auth.uid() -- nadie lee ni archiva el hilo de otro usuario.

create or replace function public.elixis_get_user_threads()
returns table (
  modo_enfoque    text,
  ultimo_mensaje  text,
  ultimo_rol      text,
  ultima_actividad timestamptz,
  total_mensajes  bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(t.modo_enfoque, 'general') as modo_enfoque,
    (array_agg(t.contenido order by t.created_at desc))[1] as ultimo_mensaje,
    (array_agg(t.rol order by t.created_at desc))[1] as ultimo_rol,
    max(t.created_at) as ultima_actividad,
    count(*) as total_mensajes
  from public.elixis_session_threads t
  where t.user_id = auth.uid()
    and t.expires_at > now()
  group by coalesce(t.modo_enfoque, 'general')
  order by max(t.created_at) desc;
$$;

revoke all on function public.elixis_get_user_threads() from public, anon;
grant execute on function public.elixis_get_user_threads() to authenticated;

create or replace function public.elixis_get_thread_history(p_modo_enfoque text default 'general')
returns table (
  id          uuid,
  rol         text,
  contenido   text,
  created_at  timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.rol, t.contenido, t.created_at
  from public.elixis_session_threads t
  where t.user_id = auth.uid()
    and t.expires_at > now()
    and coalesce(t.modo_enfoque, 'general') = coalesce(p_modo_enfoque, 'general')
  order by t.created_at asc;
$$;

revoke all on function public.elixis_get_thread_history(text) from public, anon;
grant execute on function public.elixis_get_thread_history(text) to authenticated;

-- Archiva (TTL lógico, no borra -- mismo criterio que ya declara el header de
-- 20260826200000_elixis_session_threads.sql) el hilo de un modo: pone
-- expires_at = now() en sus filas vigentes. Las filas quedan en la tabla
-- para la política de auditoría de management (elixis_session_threads_
-- select_management), solo dejan de contar como "hilo activo".
create or replace function public.elixis_archivar_hilo(p_modo_enfoque text default 'general')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas integer;
begin
  if auth.uid() is null then
    raise exception 'forbidden: requiere sesion autenticada';
  end if;
  update public.elixis_session_threads
  set expires_at = now()
  where user_id = auth.uid()
    and coalesce(modo_enfoque, 'general') = coalesce(p_modo_enfoque, 'general')
    and expires_at > now();
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

revoke all on function public.elixis_archivar_hilo(text) from public, anon;
grant execute on function public.elixis_archivar_hilo(text) to authenticated;

notify pgrst, 'reload schema';
