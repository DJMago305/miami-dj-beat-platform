-- ═══════════════════════════════════════════════════════════════════════════
--  ⚠️  ENTORNO: PRODUCCION  ·  ref hkuvuqupbxwkiykxvqdr
--  Confirma el ref en la URL antes de pulsar Run.
--
--  PASO A — Cola de SMS con aprobacion humana real
--
--  POR QUE UNA COLA Y NO UN ENVIO DIRECTO:
--  Si ELIXIS tuviera una herramienta que envia, nada le impide llamarla dos
--  veces en el mismo turno: preparar, auto-confirmarse y mandar. La regla
--  quedaria en el prompt, que es una recomendacion, no un candado.
--  Aqui el modelo SOLO puede dejar el SMS en cola. El envio lo dispara una
--  funcion aparte que exige el JWT del owner/staff y que ELIXIS no conoce.
--
--  Idempotente. Sin marcadores que reemplazar.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.elixis_sms_pending (
    id           uuid        primary key default gen_random_uuid(),

    -- Quien lo pidio (sale del JWT verificado, nunca del cuerpo)
    solicitado_por uuid      not null references auth.users(id) on delete cascade,

    -- Destinatario YA RESUELTO contra la base. Nunca un numero dictado al vuelo:
    -- un digito mal oido manda la cotizacion a un desconocido.
    destinatario_id    uuid,
    destinatario_nombre text  not null,
    telefono           text   not null
                       check (telefono ~ '^\+[1-9][0-9]{1,14}$'),   -- E.164 estricto

    mensaje      text        not null check (char_length(mensaje) between 2 and 1500),

    -- pendiente → enviado | cancelado | fallido
    estado       text        not null default 'pendiente'
                 check (estado in ('pendiente','enviado','cancelado','fallido')),

    twilio_sid   text,
    error        text,

    creado_en    timestamptz not null default now(),
    resuelto_en  timestamptz,
    resuelto_por uuid        references auth.users(id)
);

create index if not exists elixis_sms_pending_estado_idx
    on public.elixis_sms_pending (estado, creado_en desc);
create index if not exists elixis_sms_pending_solicitante_idx
    on public.elixis_sms_pending (solicitado_por, creado_en desc);

comment on table public.elixis_sms_pending is
    'Cola de SMS preparados por ELIXIS. El agente solo encola; el envio lo dispara una persona.';

-- ── Encolar (lo unico que ELIXIS puede hacer) ──────────────────────────────
create or replace function public.elixis_sms_encolar(
    p_solicitante uuid,
    p_dest_id     uuid,
    p_nombre      text,
    p_telefono    text,
    p_mensaje     text
)
returns table (id uuid, telefono text, nombre text)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_id uuid;
begin
    if coalesce(btrim(p_mensaje),'') = '' then
        raise exception 'mensaje vacio';
    end if;
    if p_telefono !~ '^\+[1-9][0-9]{1,14}$' then
        raise exception 'telefono no esta en formato E.164';
    end if;

    insert into public.elixis_sms_pending
           (solicitado_por, destinatario_id, destinatario_nombre, telefono, mensaje)
    values (p_solicitante, p_dest_id, coalesce(nullif(btrim(p_nombre),''),'(sin nombre)'),
            p_telefono, substring(btrim(p_mensaje) from 1 for 1500))
    returning elixis_sms_pending.id into v_id;

    return query select v_id, p_telefono, p_nombre;
end;
$fn$;

-- ── Cerrar la cola tras el intento de envio (lo llama el despachador) ──────
create or replace function public.elixis_sms_cerrar(
    p_id     uuid,
    p_por    uuid,
    p_estado text,
    p_sid    text default null,
    p_error  text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_n integer;
begin
    if p_estado not in ('enviado','cancelado','fallido') then
        raise exception 'estado invalido: %', p_estado;
    end if;
    update public.elixis_sms_pending
       set estado = p_estado, twilio_sid = p_sid, error = p_error,
           resuelto_en = now(), resuelto_por = p_por
     where id = p_id and estado = 'pendiente';   -- nunca se reenvia lo ya resuelto
    get diagnostics v_n = row_count;
    return coalesce(v_n,0) > 0;
end;
$fn$;

-- ── AUDITORIA ──────────────────────────────────────────────────────────────
-- Un SMS a un cliente es irreversible: una vez sale, salio. El rastro de quien
-- lo pidio, quien lo aprobo y que decidio Twilio no puede depender de que
-- nadie se acuerde de escribirlo. Lo escribe la base, en cada cambio de estado.
create table if not exists public.elixis_sms_audit (
    id          bigserial   primary key,
    sms_id      uuid        not null,
    estado_ant  text,
    estado_nue  text        not null,
    actor       uuid,
    telefono    text,
    twilio_sid  text,
    error       text,
    en          timestamptz not null default now()
);

create index if not exists elixis_sms_audit_sms_idx
    on public.elixis_sms_audit (sms_id, en desc);

create or replace function public.elixis_sms_auditar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
    -- Solo interesa el cambio de estado: un UPDATE que no lo mueve no es un
    -- hecho auditable, es ruido.
    if TG_OP = 'INSERT' or NEW.estado is distinct from OLD.estado then
        insert into public.elixis_sms_audit
               (sms_id, estado_ant, estado_nue, actor, telefono, twilio_sid, error)
        values (NEW.id,
                case when TG_OP = 'INSERT' then null else OLD.estado end,
                NEW.estado,
                coalesce(NEW.resuelto_por, NEW.solicitado_por),
                NEW.telefono, NEW.twilio_sid, NEW.error);
    end if;
    return NEW;
end;
$fn$;

drop trigger if exists elixis_sms_audit_trg on public.elixis_sms_pending;
create trigger elixis_sms_audit_trg
    after insert or update on public.elixis_sms_pending
    for each row execute function public.elixis_sms_auditar();

alter table public.elixis_sms_audit enable row level security;
drop policy if exists elixis_sms_audit_staff on public.elixis_sms_audit;
-- Solo owner/admin/manager leen el rastro. Y NADIE lo escribe ni lo borra con
-- su propio JWT: un registro de auditoria que se puede editar no sirve de nada.
create policy elixis_sms_audit_staff on public.elixis_sms_audit
    for select to authenticated using (
        exists (select 1 from public.dj_profiles p
                 where p.user_id = auth.uid()
                   and lower(coalesce(p.role,'')) in ('owner','admin','manager'))
    );
revoke insert, update, delete on public.elixis_sms_audit from authenticated, anon;

-- ── RLS: cada quien ve lo suyo; owner/staff ven la cola entera ─────────────
alter table public.elixis_sms_pending enable row level security;

drop policy if exists elixis_sms_self  on public.elixis_sms_pending;
drop policy if exists elixis_sms_staff on public.elixis_sms_pending;

create policy elixis_sms_self on public.elixis_sms_pending
    for select to authenticated using (solicitado_por = auth.uid());

create policy elixis_sms_staff on public.elixis_sms_pending
    for select to authenticated using (
        exists (select 1 from public.dj_profiles p
                 where p.user_id = auth.uid()
                   and lower(coalesce(p.role,'')) in ('owner','admin','manager','seller'))
    );

-- Nadie escribe la cola con su propio JWT: solo las funciones de arriba.
revoke insert, update, delete on public.elixis_sms_pending from authenticated, anon;

revoke execute on function public.elixis_sms_encolar(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.elixis_sms_cerrar(uuid,uuid,text,text,text)  from public, anon, authenticated;
grant  execute on function public.elixis_sms_encolar(uuid,uuid,text,text,text) to service_role;
grant  execute on function public.elixis_sms_cerrar(uuid,uuid,text,text,text)  to service_role;

commit;

-- ── COMPROBACION ───────────────────────────────────────────────────────────
-- La tabla existe, el check de E.164 muerde y la cola arranca vacia.
select
  (select count(*) from public.elixis_sms_pending)                        as en_cola,
  (select count(*) from public.elixis_sms_audit)                          as auditoria,
  (select count(*) from pg_trigger
    where tgname = 'elixis_sms_audit_trg')                                as trigger_puesto,
  '+13055551234' ~ '^\+[1-9][0-9]{1,14}$'                                 as acepta_e164_bueno,
  '3055551234'   ~ '^\+[1-9][0-9]{1,14}$'                                 as rechaza_sin_prefijo;
