-- ═══════════════════════════════════════════════════════════
-- Miami DJ Beat — Supabase SQL Setup
-- Run in SQL Editor: supabase.com → Project → SQL Editor
-- ═══════════════════════════════════════════════════════════
--
-- DEPLOY COMMANDS (run in terminal):
--
--   supabase functions deploy send-certificate
--   supabase functions deploy admin-update
--
--   supabase secrets set RESEND_API_KEY=re_xxxxx
--   supabase secrets set FROM_EMAIL="Miami DJ Beat <no-reply@yourdomain.com>"
--   supabase secrets set ADMIN_PASS="your-strong-password"
--   supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
--
-- PLACEHOLDERS TO REPLACE:
--   YOUR_PROJECT_ID  → your Supabase project ID (Settings → General)
--   YOUR_PUBLIC_ANON_KEY → Settings → API → anon public
--
-- CORS: Supabase → Settings → API → Add allowed origin:
--   https://miamidjbeat.vercel.app
-- ═══════════════════════════════════════════════════════════


-- 1. Certificates table
create table if not exists public.certificates (
  id              uuid primary key default gen_random_uuid(),
  cert_id         text unique not null,     -- MDB-YYYYMMDD-XXXX
  dj_name         text not null,
  email           text,
  theory_score    int not null,
  theory_pct      int not null,
  pre_graduated   boolean not null default false,
  practical_score int,
  practical_pct   int,
  graduated       boolean default false,
  instructor      text,
  venue           text,
  created_at      timestamp with time zone default now(),
  verify_hits     int not null default 0,   -- incremented on each verification lookup
  revoked         boolean not null default false,
  suspended       boolean not null default false,
  revoked_reason  text,
  revoked_at      timestamp with time zone,
  expires_at      timestamp with time zone default (now() + interval '12 months'),  -- set at INSERT; update to extend
  -- Public profile (optional, shown in directory — email is NOT exposed)
  city            text,
  genres          text,        -- e.g. "Reggaeton, House, Salsa"
  instagram       text,        -- "@djname" or URL
  photo_url       text,        -- https://...
  headline        text         -- e.g. "Open Format | Latin | Weddings"
);

-- 2. RLS
alter table public.certificates enable row level security;

-- Allow INSERT from anon (exam submit)
create policy "Allow insert anon"
  on public.certificates for insert to anon
  with check (true);

-- Allow SELECT for verification
create policy "Allow select by cert_id"
  on public.certificates for select to anon
  using (true);

-- UPDATE is blocked for anon. Only service_role (via Edge Function) can update.

-- ── Column-level email protection ───────────────────────────
-- anon and authenticated can SELECT rows but CANNOT read the email column.
-- service_role retains full access (Edge Functions continue to work).
revoke select (email) on table public.certificates from anon;
revoke select (email) on table public.certificates from authenticated;


-- ───────────────────────────────────────────────────────────
-- 3. Email trigger (pg_net)
-- ───────────────────────────────────────────────────────────

-- Enable net extension
create extension if not exists pg_net;

-- Trigger function
create or replace function public.notify_certificate()
returns trigger as $$
begin
  -- Only email if email is present
  if NEW.email is not null and length(NEW.email) > 3 then
    perform net.http_post(
      url     := 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/send-certificate',
      headers := jsonb_build_object('Content-Type', 'application/json'),
        body    := jsonb_build_object(
        'email',           NEW.email,
        'dj_name',         NEW.dj_name,
        'cert_id',         NEW.cert_id,
        'public_year',     NEW.public_year,
        'public_seq',      NEW.public_seq,
        'status',          case when NEW.pre_graduated then 'PRE-GRADUADO' else 'NOT CERTIFIED' end,
        'verify_base_url', 'https://miamidjbeat.vercel.app/verify.html'
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists certificate_email on public.certificates;

create trigger certificate_email
  after insert on public.certificates
  for each row
  execute function public.notify_certificate();

-- ───────────────────────────────────────────────────────────
-- 4. verify_hits RPC (anon-callable, SECURITY DEFINER)
-- ───────────────────────────────────────────────────────────
-- Allows anon to increment verify_hits without opening UPDATE on the table.

create or replace function public.increment_verify_hits(p_cert_id text)
returns void as $$
begin
  update public.certificates
     set verify_hits = verify_hits + 1
   where cert_id = p_cert_id;
end;
$$ language plpgsql security definer;

grant execute on function public.increment_verify_hits(text) to anon;

-- ───────────────────────────────────────────────────────────
-- 5. expires_at BEFORE INSERT trigger (null-safe, Option B)
-- ───────────────────────────────────────────────────────────
-- Ensures expires_at is always set, even if NULL is passed explicitly at INSERT.

create or replace function public.set_certificate_expiry()
returns trigger as $$
begin
  if NEW.expires_at is null then
    NEW.expires_at := now() + interval '12 months';
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists certificate_expiry on public.certificates;

create trigger certificate_expiry
  before insert on public.certificates
  for each row
  execute function public.set_certificate_expiry();

-- ───────────────────────────────────────────────────────────
-- 6. Public registry number (YYYY-000001, resets each year)
-- ───────────────────────────────────────────────────────────

-- 6a. Add year + seq columns to certificates
alter table public.certificates
  add column if not exists public_year int,
  add column if not exists public_seq  int;

create unique index if not exists certificates_public_year_seq_unique
  on public.certificates(public_year, public_seq);

-- 6b. Annual counter table (one row per year, incremented atomically)
create table if not exists public.certificate_counters (
  year     int primary key,
  last_seq int not null default 0
);

-- Allow the trigger function to write counters (runs as SECURITY DEFINER / postgres)
grant insert, update, select on public.certificate_counters to postgres;

-- 6c. Concurrency-safe trigger — assigns public_year + public_seq on INSERT
create or replace function public.assign_public_registry()
returns trigger as $$
declare
  y        int := extract(year from now())::int;
  next_seq int;
begin
  -- Skip if already set (manual override path)
  if NEW.public_year is not null and NEW.public_seq is not null then
    return NEW;
  end if;

  -- Lock row for this year (safe INSERT, no-op if exists)
  insert into public.certificate_counters(year, last_seq)
  values (y, 0)
  on conflict (year) do nothing;

  -- Increment and fetch
  update public.certificate_counters
  set last_seq = last_seq + 1
  where year = y
  returning last_seq into next_seq;

  NEW.public_year := y;
  NEW.public_seq  := next_seq;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists certificate_public_registry on public.certificates;

create trigger certificate_public_registry
  before insert on public.certificates
  for each row
  execute function public.assign_public_registry();

-- ─────────────────────────────────────────────────────────────
-- Backfill (run once manually if rows already exist in 2026):
-- Step 1: assign year+seq from created_at
-- ─────────────────────────────────────────────────────────────
-- with ordered as (
--   select id,
--          extract(year from created_at)::int as y,
--          row_number() over (
--            partition by extract(year from created_at)::int
--            order by created_at asc
--          ) as rn
--   from public.certificates
--   where public_year is null or public_seq is null
-- )
-- update public.certificates c
-- set public_year = o.y,
--     public_seq  = o.rn
-- from ordered o
-- where c.id = o.id;

-- Step 2: sync counters so new INSERTs continue from the right seq
-- insert into public.certificate_counters(year, last_seq)
-- select public_year, max(public_seq)
-- from public.certificates
-- group by public_year
-- on conflict (year) do update set last_seq = excluded.last_seq;

-- ─────────────────────────────────────────────────────────────
-- 7. Photo Moderation — dj_profiles
-- Run this in Supabase SQL Editor after the initial setup.
-- ─────────────────────────────────────────────────────────────
-- photo_status values: 'pending' | 'approved' | 'rejected'
alter table public.dj_profiles
  add column if not exists photo_status          text not null default 'pending',
  add column if not exists photo_rejected_reason text;

-- Admin Edge Function (notify-photo-rejection) uses service_role via SUPABASE_SERVICE_ROLE_KEY.
-- No additional RLS policy needed — anon/authenticated cannot write these columns directly.
-- Deploy command:
--   supabase functions deploy notify-photo-rejection
