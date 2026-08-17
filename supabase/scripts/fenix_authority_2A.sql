-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: 🧪 PRUEBA  (mdjb-ensayo · rtbsovavmtnjpbbpwsin)  ← CORRER AQUÍ PRIMERO
--          El MISMO script se corre en 🔴 PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) al aprobar.
--
-- FÉNIX / MIAMI DJ BEAT — BLOQUE 2A · CIMENTACIÓN
-- Autoridad Única + Entitlements + Consentimientos + Consumo IA + OAuth + Auditoría + Verificación.
--
-- SEGURIDAD Y ALCANCE (regla del PO):
--   • ADITIVO puro: solo CREATE ... IF NOT EXISTS / CREATE OR REPLACE / (DROP POLICY IF EXISTS→CREATE).
--   • NO borra tablas, NO altera/borra columnas existentes, NO toca datos reales. Idempotente.
--   • RLS estricta + DENY-BY-DEFAULT en todo.
--   • Los TOKENS se guardan YA CIFRADOS por la Edge Function (clave en Deno.env), NUNCA en claro aquí.
--   • Los CÓDIGOS de verificación se guardan HASHEADOS, nunca en claro.
--   • El PO revisa y corre este SQL en el SQL Editor de Supabase. Claude NO toca la base.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0) COLUMNA DE PLAN en dj_profiles = FUENTE DE VERDAD del plan (ADITIVA) ──
-- Hallazgo (PRUEBA 2026-08-17): dj_profiles NO tenía columna de plan; el plan no vivía en la base.
-- Se añade explícita: todas las filas EXISTENTES quedan en 'free' (no borra ni cambia datos).
-- Es el hogar oficial del plan que lee fenix_can(). Al conectar Stripe: set plan='pro' aquí.
alter table public.dj_profiles add column if not exists plan text not null default 'free';

-- ── 1) PLAN → ENTITLEMENTS (nunca chequear el string "PRO" en código; consultar esto) ──
create table if not exists public.plan_entitlements (
  plan                text primary key,               -- 'free' | 'pro' | 'super'
  ai_tier             text    not null default 'basic',-- 'basic' | 'advanced'
  monthly_ai_capacity integer not null default 0,      -- unidades internas de IA
  gmail_read          boolean not null default false,
  gmail_compose       boolean not null default false,
  gmail_send          boolean not null default false,
  calendar_read       boolean not null default false,
  calendar_write      boolean not null default false,
  campaign_prepare    boolean not null default false,
  automation_level    integer not null default 0,
  updated_at          timestamptz not null default now()
);
-- Semillas base (ajustables SIN tocar roles). SUPER queda preparado para el futuro.
insert into public.plan_entitlements
  (plan,  ai_tier,   monthly_ai_capacity, gmail_read,gmail_compose,gmail_send, calendar_read,calendar_write, campaign_prepare, automation_level)
values
  ('free', 'basic',     50, false,false,false, false,false, false, 0),
  ('pro',  'advanced', 1000, true, true, true,  true, true,  true,  1),
  ('super','advanced', 5000, true, true, true,  true, true,  true,  2)
on conflict (plan) do nothing;
alter table public.plan_entitlements enable row level security;
drop policy if exists ent_read on public.plan_entitlements;
create policy ent_read on public.plan_entitlements for select to authenticated using (true);
-- Escritura solo backend (service_role bypassa RLS).

-- ── 2) CONSENTIMIENTOS FÉNIX (capa APARTE del OAuth scope del proveedor) ──
create table if not exists public.fenix_consents (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,        -- 'availability.read' | 'marketing.use_calendar_dates' | ...
  granted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.fenix_consents enable row level security;
drop policy if exists consent_self on public.fenix_consents;
create policy consent_self on public.fenix_consents
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 3) OAUTH CONNECTIONS (tokens YA cifrados por la Edge Function; nunca en claro) ──
create table if not exists public.oauth_connections (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  provider                text not null,               -- 'google'
  provider_account_id     text,
  scopes                  text[] not null default '{}',
  encrypted_access_token  text,                         -- CIPHERTEXT (Edge Function)
  encrypted_refresh_token text,                         -- CIPHERTEXT (Edge Function)
  expires_at              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  revoked_at              timestamptz,
  unique (user_id, provider)
);
alter table public.oauth_connections enable row level security;
-- El usuario ve la METADATA de SUS conexiones (la app nunca expone los tokens al frontend).
drop policy if exists oauth_self_read on public.oauth_connections;
create policy oauth_self_read on public.oauth_connections
  for select to authenticated using (auth.uid() = user_id);
-- Insert/update/delete: SOLO backend (sin policy de escritura para 'authenticated' → denegado).

-- ── 4) LEDGER DE CONSUMO IA (para cuotas, Cost Governor y rentabilidad) ──
create table if not exists public.ai_usage_events (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users(id) on delete set null,
  profile_id           uuid,
  plan                 text,
  request_id           text,
  model                text,
  input_tokens         integer default 0,
  output_tokens        integer default 0,
  tool_calls           integer default 0,
  estimated_cost_cents integer default 0,
  created_at           timestamptz not null default now()
);
alter table public.ai_usage_events enable row level security;
drop policy if exists usage_self_read on public.ai_usage_events;
create policy usage_self_read on public.ai_usage_events
  for select to authenticated using (auth.uid() = user_id);
-- Escritura: SOLO backend.
create index if not exists idx_ai_usage_user_time on public.ai_usage_events (user_id, created_at);

-- ── 5) AUDITORÍA (acciones sensibles: permisos, conexiones, financiero, aprobaciones, ejecuciones) ──
create table if not exists public.audit_events (
  id                  uuid primary key default gen_random_uuid(),
  actor               uuid,
  action              text not null,
  resource            text,
  owner               uuid,
  result              text,                 -- 'allow' | 'deny' | 'executed' | 'prepared' | ...
  verification_method text,                 -- 'email' | 'sms' | 'totp' | null
  meta                jsonb,
  created_at          timestamptz not null default now()
);
alter table public.audit_events enable row level security;
drop policy if exists audit_staff_read on public.audit_events;
create policy audit_staff_read on public.audit_events for select to authenticated
  using (exists (select 1 from public.dj_profiles p
                 where p.user_id = auth.uid()
                   and p.role in ('owner','admin','manager','seller')));
-- Escritura: SOLO backend.

-- ── 6) CÓDIGOS DE VERIFICACIÓN (cambios sensibles) — HASH, un solo uso, expiran, con intentos ──
create table if not exists public.verification_codes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  purpose      text not null,          -- 'password'|'email'|'phone'|'payout'|'ownership'|...
  code_hash    text not null,          -- HASH del código (nunca en claro)
  channel      text,                   -- 'email'|'sms'
  attempts     integer not null default 0,
  max_attempts integer not null default 5,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.verification_codes enable row level security;
-- SIN policies para 'authenticated' → deny-by-default. Todo pasa por Edge Function (service_role).
create index if not exists idx_verif_user_purpose on public.verification_codes (user_id, purpose, created_at);

-- ── 7) AUTORIDAD ÚNICA: fenix_can(user, action, resource, context) → allow/deny ─────────
-- Compone rol + plan + entitlement (y crecerá a consentimiento + cuota). DENY-BY-DEFAULT.
-- La llaman las Edge Functions (y, opcionalmente, RLS). SECURITY DEFINER para leer las capas.
create or replace function public.fenix_can(
  p_user     uuid,
  p_action   text,
  p_resource text  default null,
  p_context  jsonb default '{}'::jsonb
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_plan text;
  v_ent  public.plan_entitlements%rowtype;
begin
  if p_user is null or p_action is null then return false; end if;   -- deny-by-default
  select role, lower(coalesce(plan, 'free'))     -- dj_profiles.plan (sección 0); default 'free'
    into v_role, v_plan
    from public.dj_profiles where user_id = p_user;
  if not found then return false; end if;                            -- sin perfil → deny
  select * into v_ent from public.plan_entitlements where plan = v_plan;
  if not found then select * into v_ent from public.plan_entitlements where plan = 'free'; end if;

  return case p_action
    -- Capacidades por PLAN/ENTITLEMENT (nunca por el string del plan):
    when 'gmail.read'         then coalesce(v_ent.gmail_read, false)
    when 'gmail.compose'      then coalesce(v_ent.gmail_compose, false)
    when 'gmail.send'         then coalesce(v_ent.gmail_send, false)
    when 'calendar.read'      then coalesce(v_ent.calendar_read, false)
    when 'calendar.write'     then coalesce(v_ent.calendar_write, false)
    when 'campaign.prepare'   then coalesce(v_ent.campaign_prepare, false)
    -- Sistema / staff (por ROL, no por plan):
    when 'staff.read_all'     then v_role in ('owner','admin','manager','seller')
    when 'financial.read'     then v_role in ('owner','admin','manager')
    when 'financial.execute'  then v_role = 'owner'   -- ejecución financiera: solo owner
    -- Perfil propio (dueño de su fila) o staff con permiso:
    when 'profile.bio.update' then
      coalesce((p_context->>'target_user')::uuid, p_user) = p_user or v_role in ('owner','admin')
    else false                                                       -- acción desconocida → DENY
  end;
end;
$$;
revoke all on function public.fenix_can(uuid,text,text,jsonb) from public;
grant execute on function public.fenix_can(uuid,text,text,jsonb) to authenticated, service_role;

-- ── Verificación (opcional) ──
-- select * from public.plan_entitlements;
-- select public.fenix_can(auth.uid(), 'gmail.read');       -- según tu plan
-- select public.fenix_can(auth.uid(), 'financial.execute');-- true solo si owner

notify pgrst, 'reload schema';
