-- ───────────────────────────────────────────────────────────
-- Lead Notification Trigger (pg_net)
-- ───────────────────────────────────────────────────────────

-- Enable net extension if not already enabled
create extension if not exists pg_net;

-- Trigger function to notify manager of new lead
create or replace function public.notify_new_lead_trigger()
returns trigger as $$
begin
  perform net.http_post(
    url     := 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/notify-new-lead',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
      -- Note: No Authorization header needed if notify-new-lead is deployed with --no-verify-jwt
    ),
    body    := jsonb_build_object(
      'lead_id',    NEW.id,
      'event_type', coalesce(NEW.event_type, '—'),
      'event_date', coalesce(NEW.event_date::text, '—'),
      'location',   coalesce(NEW.event_location, '—'),
      'email',      coalesce(NEW.client_email, '—'),
      'phone',      coalesce(NEW.client_phone, '—'),
      'budget',     coalesce(NEW.budget_estimate, '—')
    )
  );
  return NEW;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if it exists
drop trigger if exists on_lead_inserted on public.leads;

-- Create the trigger
create trigger on_lead_inserted
  after insert on public.leads
  for each row
  execute function public.notify_new_lead_trigger();
