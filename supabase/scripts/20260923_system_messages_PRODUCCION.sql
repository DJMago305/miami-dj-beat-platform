-- ═══════════════════════════════════════════════════════════════════════════
--  ⚠️  ENTORNO: PRODUCCION  ·  ref hkuvuqupbxwkiykxvqdr
--  Confirma el ref en la URL antes de pulsar Run.
--
--  Mensajes del Sistema — Fase 1 (bandeja de entrada real + envío 1-a-1 + plantillas)
--
--  POR QUE UNA TABLA UNICA PARA ENTRANTE Y SALIENTE:
--  El historial necesita mostrar la conversación completa (lo que mandamos +
--  lo que respondieron) en un solo orden cronológico. Separarlas en dos tablas
--  solo complica el JOIN sin ganar nada — el campo `direccion` alcanza.
--
--  POR QUE NO REUTILIZAR elixis_sms_pending:
--  Esa cola es EXCLUSIVA del patrón "IA encola, humano aprueba" (ELIXIS nunca
--  envía sola). Este módulo es lo opuesto: un miembro de staff ya autenticado
--  decide y envía directo, sin cola de aprobación de por medio — son dos
--  flujos de permisos distintos, no la misma tabla con una columna más.
--
--  Fase 2 (envío masivo/publicidad) NO vive aquí — exige registro A2P 10DLC,
--  manejo de STOP/HELP y consentimiento, y se construye aparte cuando el PO
--  lo pida explícitamente.
--
--  Idempotente. Sin marcadores que reemplazar.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── Conversación (entrante + saliente en una sola tabla) ───────────────────
create table if not exists public.system_messages (
    id                   uuid        primary key default gen_random_uuid(),

    direccion            text        not null check (direccion in ('entrante','saliente')),

    telefono             text        not null check (telefono ~ '^\+[1-9][0-9]{1,14}$'),
    destinatario_id      uuid,                 -- si se pudo resolver contra dj_profiles/clientes
    destinatario_nombre  text,

    cuerpo               text        not null check (char_length(cuerpo) between 1 and 1600),
    -- Preparado para Fase 2 (fotos/flyers vía MMS) -- no se usa todavía en Fase 1.
    media_url            text,

    -- entrante: 'recibido' siempre. saliente: 'enviado' | 'fallido'.
    estado               text        not null default 'recibido'
                         check (estado in ('recibido','enviado','fallido')),

    twilio_sid           text,
    error                text,

    leido                boolean     not null default false,
    leido_por            uuid        references auth.users(id),
    leido_en             timestamptz,

    enviado_por          uuid        references auth.users(id),  -- null si es entrante

    creado_en            timestamptz not null default now()
);

create index if not exists system_messages_creado_idx
    on public.system_messages (creado_en desc);
create index if not exists system_messages_telefono_idx
    on public.system_messages (telefono, creado_en desc);
create index if not exists system_messages_no_leidos_idx
    on public.system_messages (direccion, leido) where direccion = 'entrante' and leido = false;
create unique index if not exists system_messages_twilio_sid_idx
    on public.system_messages (twilio_sid) where twilio_sid is not null;  -- Twilio puede reintentar el mismo webhook

comment on table public.system_messages is
    'Mensajes del Sistema: conversación real por SMS (entrante+saliente) entre Miami DJ Beat, clientes y artistas.';

-- ── Marcar leído (RPC — no se expone UPDATE directo de la tabla) ───────────
create or replace function public.system_messages_marcar_leido(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_n integer;
begin
    if not exists (
        select 1 from public.dj_profiles p
         where p.user_id = auth.uid()
           and lower(coalesce(p.role,'')) in ('owner','admin','manager','seller')
    ) then
        raise exception 'forbidden';
    end if;

    update public.system_messages
       set leido = true, leido_por = auth.uid(), leido_en = now()
     where id = p_id and direccion = 'entrante' and leido = false;
    get diagnostics v_n = row_count;
    return coalesce(v_n,0) > 0;
end;
$fn$;

revoke execute on function public.system_messages_marcar_leido(uuid) from public, anon;
grant  execute on function public.system_messages_marcar_leido(uuid) to authenticated;

-- ── Plantillas reutilizables (pestaña "Plantillas") ────────────────────────
create table if not exists public.system_messages_templates (
    id           uuid        primary key default gen_random_uuid(),
    nombre       text        not null check (char_length(nombre) between 2 and 80),
    cuerpo       text        not null check (char_length(cuerpo) between 2 and 1500),
    creado_por   uuid        references auth.users(id),
    creado_en    timestamptz not null default now()
);

comment on table public.system_messages_templates is
    'Plantillas de texto reutilizables para Mensajes del Sistema — atajos, no auto-envío.';

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.system_messages enable row level security;
alter table public.system_messages_templates enable row level security;

drop policy if exists system_messages_staff_select on public.system_messages;
create policy system_messages_staff_select on public.system_messages
    for select to authenticated using (
        exists (select 1 from public.dj_profiles p
                 where p.user_id = auth.uid()
                   and lower(coalesce(p.role,'')) in ('owner','admin','manager','seller'))
    );

drop policy if exists system_messages_templates_staff on public.system_messages_templates;
create policy system_messages_templates_staff on public.system_messages_templates
    for all to authenticated using (
        exists (select 1 from public.dj_profiles p
                 where p.user_id = auth.uid()
                   and lower(coalesce(p.role,'')) in ('owner','admin','manager','seller'))
    ) with check (
        exists (select 1 from public.dj_profiles p
                 where p.user_id = auth.uid()
                   and lower(coalesce(p.role,'')) in ('owner','admin','manager','seller'))
    );

-- Nadie escribe la conversación con su propio JWT: solo las Edge Functions
-- (service_role) — una para el webhook entrante, otra para el envío saliente.
revoke insert, update, delete on public.system_messages from authenticated, anon;

commit;

-- ── COMPROBACION ───────────────────────────────────────────────────────────
select
  (select count(*) from public.system_messages)            as mensajes_totales,
  (select count(*) from public.system_messages_templates)  as plantillas,
  '+13055551234' ~ '^\+[1-9][0-9]{1,14}$'                   as acepta_e164_bueno,
  '3055551234'   ~ '^\+[1-9][0-9]{1,14}$'                   as rechaza_sin_prefijo;
