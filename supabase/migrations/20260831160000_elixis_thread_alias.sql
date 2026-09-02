-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Aplicada ya vía MCP el 2026-08-31
-- (ticket "MENÚ DE HERRAMIENTAS DE HILOS (3 PUNTOS)"); este archivo la deja
-- versionada en el repo, no la vuelve a aplicar.
--
-- elixis_session_threads NO tiene columna de título -- modo_enfoque ES el
-- hilo (una fila-bucket por especialidad, no threads independientes con id
-- propio). "Renombrar" un modo fijo (Legal, General...) no tiene sentido
-- tocando esa tabla; en vez de eso, esta tabla chica aparte guarda un alias
-- opcional por (usuario, modo) que SOLO cambia el nombre mostrado en la
-- lista de "Hilos guardados" -- no toca modo_enfoque, EW_CONTEXTOS ni
-- ningún comportamiento real del modo.

create table if not exists public.elixis_thread_alias (
  user_id uuid not null references auth.users(id) on delete cascade,
  modo_enfoque text not null default 'general',
  alias text not null check (char_length(alias) between 1 and 60),
  updated_at timestamptz not null default now(),
  primary key (user_id, modo_enfoque)
);

alter table public.elixis_thread_alias enable row level security;

revoke all on public.elixis_thread_alias from public, anon, authenticated;

drop policy if exists elixis_thread_alias_select_own on public.elixis_thread_alias;
create policy elixis_thread_alias_select_own on public.elixis_thread_alias
  for select to authenticated using (user_id = auth.uid());

-- Sin política de insert/update/delete directa a propósito: la única vía de
-- escritura es esta función SECURITY DEFINER (mismo criterio que
-- elixis_thread_append para la tabla principal).
create or replace function public.elixis_thread_rename(p_modo_enfoque text, p_alias text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'forbidden: requiere sesion autenticada';
  end if;
  if p_alias is null or char_length(trim(p_alias)) = 0 then
    raise exception 'alias_vacio';
  end if;
  insert into public.elixis_thread_alias (user_id, modo_enfoque, alias, updated_at)
  values (auth.uid(), coalesce(p_modo_enfoque, 'general'), trim(p_alias), now())
  on conflict (user_id, modo_enfoque) do update
    set alias = excluded.alias, updated_at = now();
end;
$$;

revoke all on function public.elixis_thread_rename(text, text) from public, anon;
grant execute on function public.elixis_thread_rename(text, text) to authenticated;

-- elixis_get_user_threads (de 20260831150000_elixis_thread_read_rpcs.sql) se
-- reemplaza para sumar la columna alias -- cambia el tipo de retorno, hace
-- falta dropear la función antes de recrearla (Postgres no deja cambiar
-- columnas OUT con CREATE OR REPLACE).
drop function if exists public.elixis_get_user_threads();

create function public.elixis_get_user_threads()
returns table (
  modo_enfoque    text,
  alias           text,
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
    a.alias as alias,
    (array_agg(t.contenido order by t.created_at desc))[1] as ultimo_mensaje,
    (array_agg(t.rol order by t.created_at desc))[1] as ultimo_rol,
    max(t.created_at) as ultima_actividad,
    count(*) as total_mensajes
  from public.elixis_session_threads t
  left join public.elixis_thread_alias a
    on a.user_id = t.user_id and a.modo_enfoque = coalesce(t.modo_enfoque, 'general')
  where t.user_id = auth.uid()
    and t.expires_at > now()
  group by coalesce(t.modo_enfoque, 'general'), a.alias
  order by max(t.created_at) desc;
$$;

revoke all on function public.elixis_get_user_threads() from public, anon;
grant execute on function public.elixis_get_user_threads() to authenticated;

notify pgrst, 'reload schema';
