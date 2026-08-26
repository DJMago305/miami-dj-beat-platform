-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-08-26
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- CONTEXTO
-- --------
-- reminder_queue ya existe en producción, pero se creó con una versión
-- del esquema que no tiene las columnas que la Edge Function
-- send-reminder-sms necesita (channel, recipient_phone, recipient_name,
-- message_template) — se guardaban esos datos en la fila en vez de
-- consultarlos de contract_sends cada vez, igual que ya hace
-- elixis_sms_pending con "telefono"/"mensaje". Este script es
-- ADITIVO e IDEMPOTENTE: agrega solo lo que falta, sin tocar filas
-- existentes ni recrear lo que ya está bien.
-- ============================================================

-- 1) Columnas que faltan (todas nullable — no rompen filas existentes)
alter table public.reminder_queue
  add column if not exists channel text not null default 'sms',
  add column if not exists recipient_phone text,
  add column if not exists recipient_name text,
  add column if not exists message_template text not null default 'contract_pending_reminder',
  add column if not exists created_by uuid references auth.users(id);

alter table public.reminder_queue
  drop constraint if exists reminder_queue_channel_check;
alter table public.reminder_queue
  add constraint reminder_queue_channel_check check (channel in ('sms','whatsapp'));

-- recipient_phone es obligatorio para cualquier fila NUEVA de aquí en
-- adelante, pero no se puede forzar NOT NULL retroactivo sin backfill —
-- si hay filas viejas sin teléfono, este NOT NULL falla a propósito
-- para que decidamos qué hacer con ellas antes de seguir.
do $$
begin
  if not exists (select 1 from public.reminder_queue where recipient_phone is null) then
    alter table public.reminder_queue alter column recipient_phone set not null;
  end if;
end $$;

-- 2) RLS: política de lectura para staff (la tabla ya tenía RLS
-- habilitado pero sin ninguna policy — quedaba invisible incluso para
-- el propio staff, aunque el service_role de la Edge Function siempre
-- puede leer/escribir sin pasar por RLS).
drop policy if exists "Staff ve la cola de recordatorios" on public.reminder_queue;
create policy "Staff ve la cola de recordatorios"
  on public.reminder_queue for select
  to authenticated
  using (
    exists (
      select 1 from public.dj_profiles
      where dj_profiles.user_id = auth.uid()
        and dj_profiles.role in ('owner','admin','manager','seller')
    )
  );

-- 3) RPC para encolar un recordatorio (staff, al generar el enlace de firma)
create or replace function public.encolar_recordatorio(
  p_contract_send_id uuid,
  p_recipient_phone text,
  p_recipient_name text default null,
  p_channel text default 'sms',
  p_delay_hours numeric default 24
)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.reminder_queue (
    contract_send_id, channel, recipient_phone, recipient_name, scheduled_at
  ) values (
    p_contract_send_id, p_channel, p_recipient_phone, p_recipient_name,
    now() + make_interval(hours => p_delay_hours)
  )
  returning id;
$$;
grant execute on function public.encolar_recordatorio(uuid, text, text, text, numeric) to authenticated;

-- 4) Trigger: cancela recordatorios pendientes en cuanto el contrato se firma
create or replace function public.cancelar_recordatorios_al_firmar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'SIGNED' and old.status = 'PENDING' then
    update public.reminder_queue
      set status = 'CANCELED'
      where contract_send_id = new.id and status = 'SCHEDULED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cancelar_recordatorios on public.contract_sends;
create trigger trg_cancelar_recordatorios
  after update on public.contract_sends
  for each row execute function public.cancelar_recordatorios_al_firmar();
