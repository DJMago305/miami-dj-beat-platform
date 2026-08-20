-- ═══════════════════════════════════════════════════════════════════════════
--  ENTORNO: PRUEBA  ·  mdjb-ensayo  ·  ref rtbsovavmtnjpbbpwsin
--  Luego, SIN CAMBIOS, en PRODUCCION · ref hkuvuqupbxwkiykxvqdr
--  Verifica el ref en la URL del panel ANTES de ejecutar.
--
--  PASO 4 — Medidor de consumo de voz de ELIXIS
--  Decisiones del PO (2026-08-20), version final:
--    · Plan PRO $80/mes = 3 h insignia (10.800 s) + 5 h mini (18.000 s).
--    · Cadena de degradacion: insignia -> mini -> texto ilimitado.
--    · La bolsa mensual NO se acumula: se reinicia a cero cada 30 dias.
--    · Los top-ups SI se acumulan y no vencen; solo entran cuando la bolsa
--      mensual del nivel esta agotada.
--    · Owner Master: ilimitado, con fusible tecnico de 50 h/mes anti-bucle.
--
--  PERIODO DE 30 DIAS, NO MES NATURAL: el PO lo quiere atado al cobro del
--  plan. Cuando se conecte la suscripcion de Stripe, el ancla debe pasar a
--  ser current_period_start de la suscripcion; hasta entonces rueda desde el
--  ultimo reinicio.
--
--  POR QUE RESERVA Y NO COBRO AL CIERRE:
--  La Edge Function abre la sesion pero nunca ve su final: un WebRTC dura lo
--  que dura y el navegador puede desaparecer sin avisar. Si cobraramos solo al
--  cerrar, cerrar la pestana de golpe saldria gratis. Por eso se RESERVA un
--  bloque por adelantado y se LIQUIDA lo realmente usado. Si nadie liquida, la
--  reserva queda consumida: el error cae del lado de la casa, no del margen.
--
--  Guion idempotente: puede ejecutarse mas de una vez sin romper nada.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1 · BOLSA POR USUARIO — dos cubos por nivel de modelo
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.elixis_voice_quotas (
    user_id  uuid primary key references auth.users(id) on delete cascade,
    plan     text not null default 'none',   -- none | premium | founder | owner
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Columnas anadidas por separado para que el guion tambien sirva de upgrade
-- si una version anterior de esta tabla ya existe.
alter table public.elixis_voice_quotas
    add column if not exists is_unlimited              boolean     not null default false,
    add column if not exists safety_cap_seconds        integer,               -- null = sin tope
    add column if not exists flagship_monthly_seconds  integer     not null default 0,
    add column if not exists flagship_used_seconds     integer     not null default 0,
    add column if not exists flagship_topup_seconds    integer     not null default 0,
    add column if not exists mini_monthly_seconds      integer     not null default 0,
    add column if not exists mini_used_seconds         integer     not null default 0,
    add column if not exists mini_topup_seconds        integer     not null default 0,
    add column if not exists period_start              timestamptz not null default now(),
    add column if not exists period_end                timestamptz not null default (now() + interval '30 days');

alter table public.elixis_voice_quotas
    alter column period_start set default now(),
    alter column period_end   set default (now() + interval '30 days');

comment on table  public.elixis_voice_quotas is
    'Bolsa de segundos de voz en tiempo real de ELIXIS. Dos cubos: insignia y mini.';
comment on column public.elixis_voice_quotas.is_unlimited is
    'Cuenta Master: no se bloquea por saldo, pero SI por safety_cap_seconds. El consumo se mide siempre.';
comment on column public.elixis_voice_quotas.safety_cap_seconds is
    'Cortacircuitos tecnico anti-bucle de desarrollo. No es facturacion: es un fusible.';
comment on column public.elixis_voice_quotas.flagship_topup_seconds is
    'Saldo comprado. No expira ni se resetea con el periodo.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2 · LIBRO DE SESIONES  (el debe)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.elixis_voice_sessions (
    id                uuid        primary key default gen_random_uuid(),
    user_id           uuid        not null references auth.users(id) on delete cascade,
    opened_at         timestamptz not null default now(),
    last_seen_at      timestamptz not null default now(),
    closed_at         timestamptz,
    reserved_seconds  integer     not null default 0 check (reserved_seconds >= 0),
    billed_seconds    integer     not null default 0 check (billed_seconds   >= 0),
    from_topup        integer     not null default 0 check (from_topup       >= 0),
    model             text,
    voice             text,
    status            text        not null default 'open'
                      check (status in ('open','closed','abandoned'))
);

alter table public.elixis_voice_sessions
    add column if not exists tier text not null default 'flagship';

do $$ begin
    alter table public.elixis_voice_sessions
        add constraint elixis_voice_sessions_tier_chk check (tier in ('flagship','mini'));
exception when duplicate_object then null; end $$;

create index if not exists elixis_voice_sessions_user_idx
    on public.elixis_voice_sessions (user_id, opened_at desc);
create index if not exists elixis_voice_sessions_open_idx
    on public.elixis_voice_sessions (status, last_seen_at) where status = 'open';

-- ───────────────────────────────────────────────────────────────────────────
-- 3 · LIBRO DE RECARGAS  (el haber) — esto es dinero, lleva rastro propio
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.elixis_voice_topups (
    id            uuid        primary key default gen_random_uuid(),
    user_id       uuid        not null references auth.users(id) on delete cascade,
    seconds       integer     not null check (seconds > 0),
    amount_cents  integer,
    source        text        not null default 'stripe' check (source in ('stripe','manual','cortesia')),
    reference     text,
    granted_by    uuid        references auth.users(id),
    created_at    timestamptz not null default now()
);

alter table public.elixis_voice_topups
    add column if not exists tier text not null default 'flagship';

create index if not exists elixis_voice_topups_user_idx
    on public.elixis_voice_topups (user_id, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- 4 · REINICIO PEREZOSO DEL PERIODO (cada 30 dias)
--
--     El PO pidio un "trigger de reset mensual". No existe tal cosa: un
--     trigger reacciona a un INSERT/UPDATE, no al paso del tiempo. Las dos
--     opciones reales son un cron (pg_cron) o un reinicio perezoso. Aqui va
--     el perezoso, y a proposito: la bolsa se renueva la primera vez que se
--     usa la voz pasados los 30 dias. Un cron que falle un dia deja a gente
--     de pago sin su bolsa; esto no puede fallar porque corre en el mismo
--     camino que la reserva. Si mas adelante quieres reportes con cifras
--     frescas sin que nadie hable, se anade pg_cron ENCIMA de esto, no en
--     lugar de esto.
--
--     La bolsa mensual se reinicia A CERO: no se acumula.
--     El top-up NO se toca: se compro aparte y no vence.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.elixis_voice_roll_period(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
    update public.elixis_voice_quotas
       set flagship_used_seconds = 0,
           mini_used_seconds     = 0,
           period_start          = now(),
           period_end            = now() + interval '30 days',
           updated_at            = now()
     where user_id = p_user
       and now() >= period_end;
end;
$fn$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5 · RESERVA ATOMICA CON CADENA DE DEGRADACION
--
--     `for update` serializa a quienes compiten por la MISMA fila: dos
--     pestanas abriendo voz a la vez no pueden gastar el mismo saldo dos
--     veces. La segunda espera y ve el saldo ya descontado.
--
--     Puede conceder MENOS de lo pedido (granted_seconds). Asi no se queda
--     varado un resto de bolsa: si al insignia le sobran 3 minutos y se piden
--     10, concede esos 3 y en la siguiente reserva baja a mini. Por debajo de
--     p_min_seconds no vale la pena abrir sesion, y ahi si degrada.
-- ───────────────────────────────────────────────────────────────────────────
drop function if exists public.elixis_voice_reserve(uuid,integer,text,text);
drop function if exists public.elixis_voice_reserve(uuid,integer,integer,text);

create or replace function public.elixis_voice_reserve(
    p_user          uuid,
    p_seconds       integer,
    p_min_seconds   integer default 60,
    p_voice         text    default null
)
returns table (
    allowed          boolean,
    session_id       uuid,
    tier             text,      -- 'flagship' | 'mini'  → que modelo debe abrir la Edge Function
    granted_seconds  integer,   -- puede ser MENOR que p_seconds
    reason           text,
    fallback_to_text boolean,
    remaining_flagship integer,
    remaining_mini     integer,
    unlimited        boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
    q               public.elixis_voice_quotas%rowtype;
    v_flag_avail    integer;
    v_mini_avail    integer;
    v_grant         integer;
    v_tier          text;
    v_from_month    integer;
    v_from_topup    integer;
    v_session       uuid;
    v_total_used    integer;
begin
    if p_seconds is null or p_seconds <= 0 then
        return query select false, null::uuid, null::text, 0, 'invalid_request'::text, false, 0, 0, false;
        return;
    end if;

    perform public.elixis_voice_roll_period(p_user);

    select * into q from public.elixis_voice_quotas where user_id = p_user for update;

    if not found then
        -- Sin fila de cuota no hay voz. El alta es explicita, nunca implicita:
        -- crear una bolsa sola equivaldria a regalar producto de pago.
        return query select false, null::uuid, null::text, 0, 'no_quota'::text, true, 0, 0, false;
        return;
    end if;

    -- ── Cuenta Master ────────────────────────────────────────────────────
    -- No se bloquea por saldo. SI se bloquea por el fusible anti-bucle, y se
    -- mide siempre: necesitas ver lo que gastas aunque no se te cobre.
    if q.is_unlimited then
        v_total_used := q.flagship_used_seconds + q.mini_used_seconds;

        if q.safety_cap_seconds is not null
           and v_total_used + p_seconds > q.safety_cap_seconds then
            return query select false, null::uuid, null::text, 0,
                                'safety_cap_reached'::text, true,
                                greatest(q.safety_cap_seconds - v_total_used, 0), 0, true;
            return;
        end if;

        update public.elixis_voice_quotas
           set flagship_used_seconds = flagship_used_seconds + p_seconds,
               updated_at = now()
         where user_id = p_user;

        insert into public.elixis_voice_sessions
               (user_id, reserved_seconds, from_topup, tier, voice)
        values (p_user,  p_seconds,        0,          'flagship', p_voice)
        returning id into v_session;

        return query select true, v_session, 'flagship'::text, p_seconds,
                            'unlimited'::text, false,
                            coalesce(q.safety_cap_seconds - v_total_used - p_seconds, 2147483647),
                            0, true;
        return;
    end if;

    -- ── Plan de pago: insignia primero, mini despues ─────────────────────
    v_flag_avail := greatest(q.flagship_monthly_seconds - q.flagship_used_seconds, 0) + q.flagship_topup_seconds;
    v_mini_avail := greatest(q.mini_monthly_seconds     - q.mini_used_seconds,     0) + q.mini_topup_seconds;

    if v_flag_avail >= p_min_seconds then
        v_tier  := 'flagship';
        v_grant := least(p_seconds, v_flag_avail);
    elsif v_mini_avail >= p_min_seconds then
        v_tier  := 'mini';
        v_grant := least(p_seconds, v_mini_avail);
    else
        -- Fin de la cadena: a texto, que no tiene tope.
        return query select false, null::uuid, null::text, 0,
                            'quota_exhausted'::text, true,
                            v_flag_avail, v_mini_avail, false;
        return;
    end if;

    -- Gasta primero la bolsa del mes (que expira) y luego el top-up (que no).
    if v_tier = 'flagship' then
        v_from_month := least(greatest(q.flagship_monthly_seconds - q.flagship_used_seconds, 0), v_grant);
        v_from_topup := v_grant - v_from_month;
        update public.elixis_voice_quotas
           set flagship_used_seconds  = flagship_used_seconds  + v_from_month,
               flagship_topup_seconds = flagship_topup_seconds - v_from_topup,
               updated_at = now()
         where user_id = p_user;
        v_flag_avail := v_flag_avail - v_grant;
    else
        v_from_month := least(greatest(q.mini_monthly_seconds - q.mini_used_seconds, 0), v_grant);
        v_from_topup := v_grant - v_from_month;
        update public.elixis_voice_quotas
           set mini_used_seconds  = mini_used_seconds  + v_from_month,
               mini_topup_seconds = mini_topup_seconds - v_from_topup,
               updated_at = now()
         where user_id = p_user;
        v_mini_avail := v_mini_avail - v_grant;
    end if;

    insert into public.elixis_voice_sessions
           (user_id, reserved_seconds, from_topup, tier, voice)
    values (p_user,  v_grant,          v_from_topup, v_tier, p_voice)
    returning id into v_session;

    return query select true, v_session, v_tier, v_grant, 'ok'::text, false,
                        v_flag_avail, v_mini_avail, false;
end;
$fn$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6 · LIQUIDACION — devuelve lo reservado y no usado, al cubo del que salio
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.elixis_voice_settle(
    p_session uuid,
    p_used    integer
)
returns table (refunded_seconds integer, billed_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
    s              public.elixis_voice_sessions%rowtype;
    v_used         integer;
    v_refund       integer;
    v_refund_topup integer;
    v_refund_month integer;
    v_unlimited    boolean;
begin
    select * into s from public.elixis_voice_sessions
     where id = p_session and status = 'open' for update;

    if not found then
        return query select 0, 0;   -- idempotente: liquidar dos veces no cobra dos veces
        return;
    end if;

    v_used   := least(greatest(coalesce(p_used, 0), 0), s.reserved_seconds);
    v_refund := s.reserved_seconds - v_used;

    update public.elixis_voice_sessions
       set billed_seconds = v_used, closed_at = now(),
           last_seen_at = now(), status = 'closed'
     where id = p_session;

    select is_unlimited into v_unlimited
      from public.elixis_voice_quotas where user_id = s.user_id;

    if v_refund > 0 then
        v_refund_topup := least(v_refund, s.from_topup);
        v_refund_month := v_refund - v_refund_topup;

        if coalesce(v_unlimited, false) then
            -- A la Master no se le cobra, pero el fusible cuenta tiempo real:
            -- devolver lo no usado evita que el tope salte antes de tiempo.
            update public.elixis_voice_quotas
               set flagship_used_seconds = greatest(flagship_used_seconds - v_refund, 0),
                   updated_at = now()
             where user_id = s.user_id;
        elsif s.tier = 'flagship' then
            update public.elixis_voice_quotas
               set flagship_topup_seconds = flagship_topup_seconds + v_refund_topup,
                   flagship_used_seconds  = greatest(flagship_used_seconds - v_refund_month, 0),
                   updated_at = now()
             where user_id = s.user_id;
        else
            update public.elixis_voice_quotas
               set mini_topup_seconds = mini_topup_seconds + v_refund_topup,
                   mini_used_seconds  = greatest(mini_used_seconds - v_refund_month, 0),
                   updated_at = now()
             where user_id = s.user_id;
        end if;
    end if;

    return query select v_refund, v_used;
end;
$fn$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7 · LATIDO
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.elixis_voice_heartbeat(p_session uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_n integer;
begin
    update public.elixis_voice_sessions
       set last_seen_at = now()
     where id = p_session and status = 'open';
    get diagnostics v_n = row_count;
    return coalesce(v_n, 0) > 0;
end;
$fn$;

-- ───────────────────────────────────────────────────────────────────────────
-- 8 · BARRENDERO — cierra sesiones cuyo cliente desaparecio.
--     La reserva NO se devuelve: si el navegador murio, el audio pudo seguir
--     corriendo contra OpenAI. Cobrarlo es lo prudente.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.elixis_voice_close_abandoned(p_stale_minutes integer default 15)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_n integer;
begin
    update public.elixis_voice_sessions
       set status = 'abandoned', closed_at = now(),
           billed_seconds = reserved_seconds
     where status = 'open'
       and last_seen_at < now() - make_interval(mins => p_stale_minutes);
    get diagnostics v_n = row_count;
    return coalesce(v_n, 0);
end;
$fn$;

-- ───────────────────────────────────────────────────────────────────────────
-- 9 · RECARGA — unico camino para acreditar saldo comprado
-- ───────────────────────────────────────────────────────────────────────────
drop function if exists public.elixis_voice_grant_topup(uuid,integer,text,text,integer,uuid);

create or replace function public.elixis_voice_grant_topup(
    p_user         uuid,
    p_seconds      integer,
    p_tier         text    default 'flagship',
    p_source       text    default 'stripe',
    p_reference    text    default null,
    p_amount_cents integer default null,
    p_granted_by   uuid    default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_total integer;
begin
    if p_seconds is null or p_seconds <= 0 then
        raise exception 'elixis_voice_grant_topup: p_seconds debe ser > 0';
    end if;
    if p_tier not in ('flagship','mini') then
        raise exception 'elixis_voice_grant_topup: p_tier invalido (%)', p_tier;
    end if;

    insert into public.elixis_voice_topups
           (user_id, seconds, tier, amount_cents, source, reference, granted_by)
    values (p_user,  p_seconds, p_tier, p_amount_cents, p_source, p_reference, p_granted_by);

    if p_tier = 'flagship' then
        update public.elixis_voice_quotas
           set flagship_topup_seconds = flagship_topup_seconds + p_seconds, updated_at = now()
         where user_id = p_user
        returning flagship_topup_seconds into v_total;
    else
        update public.elixis_voice_quotas
           set mini_topup_seconds = mini_topup_seconds + p_seconds, updated_at = now()
         where user_id = p_user
        returning mini_topup_seconds into v_total;
    end if;

    if v_total is null then
        raise exception 'elixis_voice_grant_topup: el usuario % no tiene bolsa de voz', p_user;
    end if;
    return v_total;
end;
$fn$;

-- ───────────────────────────────────────────────────────────────────────────
-- 10 · RLS — lectura del propio saldo; escritura SOLO por las funciones
-- ───────────────────────────────────────────────────────────────────────────
alter table public.elixis_voice_quotas   enable row level security;
alter table public.elixis_voice_sessions enable row level security;
alter table public.elixis_voice_topups   enable row level security;

drop policy if exists elixis_voice_quotas_self    on public.elixis_voice_quotas;
drop policy if exists elixis_voice_quotas_staff   on public.elixis_voice_quotas;
drop policy if exists elixis_voice_sessions_self  on public.elixis_voice_sessions;
drop policy if exists elixis_voice_sessions_staff on public.elixis_voice_sessions;
drop policy if exists elixis_voice_topups_self    on public.elixis_voice_topups;

create policy elixis_voice_quotas_self on public.elixis_voice_quotas
    for select to authenticated using (user_id = auth.uid());

create policy elixis_voice_quotas_staff on public.elixis_voice_quotas
    for select to authenticated using (
        exists (select 1 from public.dj_profiles p
                 where p.user_id = auth.uid()
                   and lower(coalesce(p.role,'')) in ('owner','admin','manager'))
    );

create policy elixis_voice_sessions_self on public.elixis_voice_sessions
    for select to authenticated using (user_id = auth.uid());

create policy elixis_voice_sessions_staff on public.elixis_voice_sessions
    for select to authenticated using (
        exists (select 1 from public.dj_profiles p
                 where p.user_id = auth.uid()
                   and lower(coalesce(p.role,'')) in ('owner','admin','manager'))
    );

create policy elixis_voice_topups_self on public.elixis_voice_topups
    for select to authenticated using (user_id = auth.uid());

-- Nadie escribe estas tablas con su propio JWT. El unico camino es
-- SECURITY DEFINER, que ademas es el unico lugar donde la deduccion es atomica.
revoke insert, update, delete on public.elixis_voice_quotas   from authenticated, anon;
revoke insert, update, delete on public.elixis_voice_sessions from authenticated, anon;
revoke insert, update, delete on public.elixis_voice_topups   from authenticated, anon;

revoke execute on function public.elixis_voice_reserve(uuid,integer,integer,text)                     from public, anon, authenticated;
revoke execute on function public.elixis_voice_settle(uuid,integer)                                    from public, anon, authenticated;
revoke execute on function public.elixis_voice_heartbeat(uuid)                                         from public, anon, authenticated;
revoke execute on function public.elixis_voice_close_abandoned(integer)                                from public, anon, authenticated;
revoke execute on function public.elixis_voice_grant_topup(uuid,integer,text,text,text,integer,uuid)   from public, anon, authenticated;
revoke execute on function public.elixis_voice_roll_period(uuid)                                       from public, anon, authenticated;

grant execute on function public.elixis_voice_reserve(uuid,integer,integer,text)                   to service_role;
grant execute on function public.elixis_voice_settle(uuid,integer)                                 to service_role;
grant execute on function public.elixis_voice_heartbeat(uuid)                                      to service_role;
grant execute on function public.elixis_voice_close_abandoned(integer)                             to service_role;
grant execute on function public.elixis_voice_grant_topup(uuid,integer,text,text,text,integer,uuid) to service_role;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
--  ALTA DE CUENTAS — APARTE de la migracion, revisando cada correo.
--  Dar bolsa a quien no paga es regalar producto. Reemplaza los correos.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- -- OWNER (Gerardo A. Valle) — Master con fusible de 50 h/mes (180000 s):
-- insert into public.elixis_voice_quotas (user_id, plan, is_unlimited, safety_cap_seconds)
-- select id, 'owner', true, 180000 from auth.users where email = 'REEMPLAZAR@correo'
-- on conflict (user_id) do update
--    set plan = 'owner', is_unlimited = true, safety_cap_seconds = 180000;
--
-- -- ARTISTA PLAN PRO $80/mes — 3 h insignia (10800 s) + 5 h mini (18000 s):
-- insert into public.elixis_voice_quotas
--        (user_id, plan, flagship_monthly_seconds, mini_monthly_seconds)
-- select id, 'pro', 10800, 18000 from auth.users where email = 'REEMPLAZAR@correo'
-- on conflict (user_id) do update
--    set plan = 'pro', flagship_monthly_seconds = 10800, mini_monthly_seconds = 18000;
--
-- -- ARTISTA FUNDADOR — ilimitado POR PLAN, sin tocar rol ni permisos.
-- -- Fusible finito para que no sea un cheque en blanco. AJUSTA ESTE NUMERO:
-- -- un fundador no paga mensualidad, asi que cada hora insignia es costo puro.
-- insert into public.elixis_voice_quotas (user_id, plan, is_unlimited, safety_cap_seconds)
-- select id, 'founder', true, 36000 from auth.users where email = 'REEMPLAZAR@correo'
-- on conflict (user_id) do update
--    set plan = 'founder', is_unlimited = true, safety_cap_seconds = 36000;
--
-- -- RECARGA (top-up) — se acumula y no vence:
-- -- select public.elixis_voice_grant_topup(
-- --   (select id from auth.users where email='REEMPLAZAR@correo'),
-- --   3600, 'flagship', 'stripe', 'cs_test_123', 1500, null);
--
-- ── COMPROBACION RAPIDA tras ejecutar ──
-- select user_id, plan, is_unlimited, safety_cap_seconds,
--        flagship_monthly_seconds, flagship_used_seconds,
--        mini_monthly_seconds, mini_used_seconds, period_end
--   from public.elixis_voice_quotas;
