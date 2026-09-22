-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- El DJ solo puede LEER sus filas de dj_notifications (política "DJs can see own notifications"), no modificarlas.
-- Esta función deja marcar como leídos SOLO sus propios avisos, sin abrir UPDATE directo sobre la tabla.
create or replace function public.dj_marcar_avisos_leidos()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  if auth.uid() is null then return 0; end if;
  update public.dj_notifications set read = true where dj_user_id = auth.uid() and read = false;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.dj_marcar_avisos_leidos() from public, anon;
grant execute on function public.dj_marcar_avisos_leidos() to authenticated;
