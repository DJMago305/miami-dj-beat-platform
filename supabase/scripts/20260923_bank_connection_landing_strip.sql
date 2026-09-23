-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- "Pista de aterrizaje" para conectar la cuenta real de Chase (vía Teller) a
-- Cash Flow Master -- preparado ANTES de tener el Application ID/certificado
-- de Teller, para que conectar el banco real sea solo "pegar las llaves" una
-- vez que Teller responda la solicitud de acceso developer.
--
-- Esto es dinero REAL de la EMPRESA (no de un DJ individual) -- separado por
-- completo de dj_ledger/dj_flow_* (que son personales, por dj_user_id). Solo
-- staff de gestión puede ver esto, nunca un artista.
--
-- El access_token de Teller NUNCA se expone al navegador: cero GRANT para
-- anon/authenticated en ninguna de las dos tablas. Solo lo toca la función
-- Edge (service_role), igual que el patrón ya usado para
-- mdjpro_license_keys.key_hash ("nunca expuesto al browser").

create table if not exists public.bank_accounts (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null default 'teller',
  enrollment_id     text not null,
  teller_account_id text not null unique,
  institution_name  text,
  account_name      text,
  account_type      text,
  last4             text,
  access_token      text not null,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.bank_accounts is
  'Cuentas bancarias reales de la empresa conectadas vía Teller. access_token nunca se lee desde el navegador -- solo Edge Functions (service_role).';

create table if not exists public.bank_transactions (
  id                    uuid primary key default gen_random_uuid(),
  bank_account_id       uuid not null references public.bank_accounts(id) on delete cascade,
  teller_transaction_id text not null unique,
  posted_date           date not null,
  description           text,
  amount_cents          bigint not null,
  direction             text not null check (direction in ('credit', 'debit')),
  category              text,
  raw                   jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists idx_bank_transactions_account_date
  on public.bank_transactions (bank_account_id, posted_date desc);

comment on table public.bank_transactions is
  'Movimientos reales importados de Teller. amount_cents siempre positivo; direction indica si fue ingreso o gasto real de la cuenta.';

alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;

-- Nadie del lado cliente escribe directo -- solo Edge Functions (service_role,
-- que ignora RLS). Solo gestión puede LEER (nunca un artista individual).
revoke all on public.bank_accounts from public, anon, authenticated;
revoke all on public.bank_transactions from public, anon, authenticated;
grant select on public.bank_accounts to authenticated;
grant select on public.bank_transactions to authenticated;

create policy bank_accounts_select_management on public.bank_accounts
  for select to authenticated
  using (public.is_staff_management(auth.uid()));

create policy bank_transactions_select_management on public.bank_transactions
  for select to authenticated
  using (public.is_staff_management(auth.uid()));

-- Vista segura para el cliente: nunca expone access_token, aunque alguien
-- intentara seleccionarlo directo (defensa en profundidad además del RLS).
create or replace view public.bank_accounts_safe as
  select id, provider, institution_name, account_name, account_type, last4, active, created_at
  from public.bank_accounts;

grant select on public.bank_accounts_safe to authenticated;
