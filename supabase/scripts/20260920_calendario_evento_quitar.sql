-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- ─────────────────────────────────────────────────────────────────────────────
-- Botón "X roja" del calendario (calendario-operacional-inteligente.html): quita
-- de la agenda un evento de elixis_agenda_eventos (cumpleaños/notas sincronizados
-- de Google, o eventos creados por ELIXIS). Baja suave: estado='cancelado', nunca
-- DELETE. No toca Google Calendar. El sync de Google no lo revive: al re-sincronizar
-- solo actualiza fechas/notas de las filas existentes, no su estado.
--
-- Permiso: staff (owner/admin/manager/seller) puede quitar cualquiera; un artista o
-- cliente solo las filas suyas (user_id = auth.uid()).

create or replace function public.calendario_evento_quitar(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.elixis_agenda_eventos where id = p_id and estado = 'activo';
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;

  if not (
    exists (select 1 from public.dj_profiles where user_id = auth.uid() and role in ('owner','admin','manager','seller'))
    or v_owner = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.elixis_agenda_eventos set estado = 'cancelado', updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.calendario_evento_quitar(uuid) from public;
grant execute on function public.calendario_evento_quitar(uuid) to authenticated;
