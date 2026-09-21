-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- YA APLICADO el 2026-09-21 (a pedido del PO, "soluciona esa primero").
-- Cierra el hueco #1 de la auditoría de funciones SECURITY DEFINER abiertas a anon: encolar_recordatorio
-- aceptaba llamadas SIN sesión, con teléfono y nombre libres -> cualquiera con un enlace de firma podía
-- programar SMS "de Miami DJ Beat" a cualquier número, con texto propio dentro del nombre.
--
-- Ahora: (1) exige sesión de STAFF (owner/admin/manager/seller); (2) el envío debe existir y seguir PENDING;
-- (3) el teléfono debe coincidir (últimos 10 dígitos) con el del contrato; (4) canal sms|whatsapp y retraso 0-168 h;
-- (5) el nombre se limpia a letras/espacios/apóstrofe/guion, máx 60 (sin puntos: "bit.ly" se vuelve enlace en el SMS);
-- (6) se guarda created_by = auth.uid(). Firma y tipo de retorno idénticos: contracts-engine.html no cambia.
--
-- LECCIÓN: `revoke ... from anon` NO basta si PUBLIC tiene EXECUTE (default de Postgres en funciones): anon lo
-- hereda. Hay que `revoke ... from public` y volver a dar el permiso a authenticated/service_role. Verificar
-- siempre con has_function_privilege('anon', ...).

create or replace function public.encolar_recordatorio(
  p_contract_send_id uuid,
  p_recipient_phone text,
  p_recipient_name text default null,
  p_channel text default 'sms',
  p_delay_hours numeric default 24
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_envio record;
  v_tel_pedido text := regexp_replace(coalesce(p_recipient_phone, ''), '\D', '', 'g');
  v_nombre text;
  v_id uuid;
begin
  if v_uid is null or not exists (
    select 1 from public.dj_profiles
    where user_id = v_uid and lower(trim(role)) in ('owner','admin','manager','seller')
  ) then
    raise exception 'forbidden: solo el staff puede programar recordatorios' using errcode = '42501';
  end if;

  select id, recipient, status into v_envio from public.contract_sends where id = p_contract_send_id;
  if v_envio.id is null then raise exception 'envio_no_encontrado'; end if;
  if upper(coalesce(v_envio.status, '')) <> 'PENDING' then raise exception 'envio_no_pendiente'; end if;

  if length(v_tel_pedido) < 10
     or right(v_tel_pedido, 10) is distinct from right(regexp_replace(coalesce(v_envio.recipient, ''), '\D', '', 'g'), 10) then
    raise exception 'telefono_no_coincide_con_el_envio';
  end if;

  if p_channel is null or p_channel not in ('sms', 'whatsapp') then raise exception 'canal_invalido'; end if;
  if p_delay_hours is null or p_delay_hours < 0 or p_delay_hours > 168 then raise exception 'retraso_invalido'; end if;

  v_nombre := nullif(left(trim(regexp_replace(coalesce(p_recipient_name, ''), '[^[:alpha:] ''-]', '', 'g')), 60), '');

  insert into public.reminder_queue (contract_send_id, channel, recipient_phone, recipient_name, scheduled_at, created_by)
  values (p_contract_send_id, p_channel, p_recipient_phone, v_nombre, now() + (p_delay_hours * interval '1 hour'), v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.encolar_recordatorio(uuid, text, text, text, numeric) from public;
revoke execute on function public.encolar_recordatorio(uuid, text, text, text, numeric) from anon;
grant execute on function public.encolar_recordatorio(uuid, text, text, text, numeric) to authenticated, service_role;
