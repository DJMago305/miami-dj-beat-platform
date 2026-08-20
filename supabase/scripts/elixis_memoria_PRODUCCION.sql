-- ═══════════════════════════════════════════════════════════════════════════
--  ⚠️  ENTORNO: PRODUCCION  ·  ref hkuvuqupbxwkiykxvqdr
--  ANTES DE PULSAR RUN: confirma el ref en la URL. El proyecto de produccion
--  se muestra con un nombre enganoso; el ref es lo unico fiable.
--
--  PASO 6 — Memoria persistente de ELIXIS
--
--  HECHOS CURADOS, NO TRANSCRIPCIONES. Esta es la regla que manda sobre todo
--  lo demas: Realtime relee el contexto ENTERO en cada turno, asi que una
--  memoria que crece sin limite no es solo desordenada, es cara. Cada hecho
--  cabe en 300 caracteres y la sesion inyecta como mucho 40. Un socio no
--  recuerda cada palabra: recuerda lo que importa.
--
--  LA MEMORIA ES POR CUENTA. La del owner no es la de un artista. Dos cuentas
--  distintas, dos memorias distintas, sin puentes.
--
--  Sin marcadores que reemplazar. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.elixis_memory_facts (
    id         uuid        primary key default gen_random_uuid(),
    user_id    uuid        not null references auth.users(id) on delete cascade,

    -- Identificador estable del hecho. Sirve para ACTUALIZAR en vez de
    -- acumular: si cambia una preferencia, se pisa la anterior y no quedan
    -- dos verdades contradictorias en la cabeza de ELIXIS.
    clave      text        not null check (char_length(clave) between 2 and 60),

    -- El hecho, en una frase. El limite de 300 no es decoracion: es el
    -- presupuesto de contexto convertido en regla de base de datos.
    hecho      text        not null check (char_length(hecho) between 2 and 300),

    origen     text        not null default 'conversacion'
               check (origen in ('conversacion','manual','sistema')),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (user_id, clave)
);

create index if not exists elixis_memory_facts_user_idx
    on public.elixis_memory_facts (user_id, updated_at desc);

comment on table public.elixis_memory_facts is
    'Memoria persistente de ELIXIS: hechos curados por cuenta. Nunca transcripciones.';

-- ── Normalizacion de la clave ──────────────────────────────────────────────
-- El modelo inventa la clave hablando; sin normalizar, "Musica Bodas" y
-- "musica_bodas" serian dos hechos distintos sobre lo mismo.
-- El quitado de acentos va con translate y no con unaccent, que es una
-- extension que puede no estar instalada. Se define PRIMERO porque Postgres
-- valida el cuerpo de una funcion SQL en el momento de crearla.
create or replace function public.elixis_sin_acentos(p text)
returns text
language sql
immutable
as $fn$
    select translate(coalesce(p,''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN');
$fn$;

create or replace function public.elixis_memory_slug(p text)
returns text
language sql
immutable
as $fn$
    select nullif(
        substring(
            regexp_replace(
                regexp_replace(lower(public.elixis_sin_acentos(coalesce(p,''))), '[^a-z0-9]+', '_', 'g'),
                '(^_+|_+$)', '', 'g'
            ) from 1 for 60
        ), ''
    );
$fn$;

-- ── Escribir / actualizar un hecho ─────────────────────────────────────────
create or replace function public.elixis_memory_write(
    p_user   uuid,
    p_clave  text,
    p_hecho  text,
    p_origen text default 'conversacion'
)
returns table (ok boolean, motivo text, total integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
    v_clave text;
    v_hecho text;
    v_n     integer;
    v_existe boolean;
begin
    v_clave := public.elixis_memory_slug(p_clave);
    v_hecho := btrim(coalesce(p_hecho, ''));

    if v_clave is null then
        return query select false, 'clave_invalida'::text, 0; return;
    end if;
    if char_length(v_hecho) < 2 then
        return query select false, 'hecho_vacio'::text, 0; return;
    end if;
    -- Se recorta en vez de rechazar: mejor guardar la frase acortada que
    -- perder el dato porque el modelo se paso de largo.
    v_hecho := substring(v_hecho from 1 for 300);

    select count(*) into v_n from public.elixis_memory_facts where user_id = p_user;
    select exists(select 1 from public.elixis_memory_facts
                   where user_id = p_user and clave = v_clave) into v_existe;

    -- Tope duro. NO se borra nada por su cuenta: se avisa y decide una persona.
    if v_n >= 200 and not v_existe then
        return query select false, 'memoria_llena'::text, v_n; return;
    end if;

    insert into public.elixis_memory_facts (user_id, clave, hecho, origen)
    values (p_user, v_clave, v_hecho, coalesce(p_origen,'conversacion'))
    on conflict (user_id, clave) do update
       set hecho = excluded.hecho, origen = excluded.origen, updated_at = now();

    select count(*) into v_n from public.elixis_memory_facts where user_id = p_user;
    return query select true, 'ok'::text, v_n;
end;
$fn$;

-- ── Olvidar ────────────────────────────────────────────────────────────────
create or replace function public.elixis_memory_forget(p_user uuid, p_clave text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_n integer;
begin
    delete from public.elixis_memory_facts
     where user_id = p_user and clave = public.elixis_memory_slug(p_clave);
    get diagnostics v_n = row_count;
    return coalesce(v_n,0) > 0;
end;
$fn$;

-- ── Recordar (lo que se inyecta al abrir sesion) ───────────────────────────
create or replace function public.elixis_memory_recall(p_user uuid, p_limit integer default 40)
returns table (clave text, hecho text)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
    select f.clave, f.hecho
      from public.elixis_memory_facts f
     where f.user_id = p_user
     order by f.updated_at desc
     limit least(greatest(coalesce(p_limit, 40), 1), 100);
$fn$;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.elixis_memory_facts enable row level security;

drop policy if exists elixis_memory_self on public.elixis_memory_facts;

-- Cada quien ve SU memoria. Sin politica para staff: la memoria de una persona
-- no es un dato de negocio que otro deba leer.
create policy elixis_memory_self on public.elixis_memory_facts
    for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.elixis_memory_facts from authenticated, anon;

revoke execute on function public.elixis_memory_write(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.elixis_memory_forget(uuid,text)          from public, anon, authenticated;
revoke execute on function public.elixis_memory_recall(uuid,integer)       from public, anon, authenticated;

grant execute on function public.elixis_memory_write(uuid,text,text,text) to service_role;
grant execute on function public.elixis_memory_forget(uuid,text)          to service_role;
grant execute on function public.elixis_memory_recall(uuid,integer)       to service_role;

commit;

-- ── COMPROBACION ───────────────────────────────────────────────────────────
-- En plpgsql y no en CTEs: el orden de evaluacion de varias CTEs con efectos
-- NO esta garantizado, y el borrado podia correr antes que la escritura.
-- Escribe un hecho de prueba en la cuenta de owner, lo lee y lo borra.

create or replace function public.elixis_memory_selftest()
returns table (escrito boolean, motivo text, hechos_totales integer,
               recordado integer, olvidado boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
    v_user uuid;
    w      record;
    v_n    integer;
    v_del  boolean;
begin
    select p.user_id into v_user
      from public.dj_profiles p
     where lower(coalesce(p.role,'')) = 'owner'
     limit 1;

    if v_user is null then
        return query select false, 'sin_cuenta_owner'::text, 0, 0, false;
        return;
    end if;

    select * into w from public.elixis_memory_write(
        v_user, 'Prueba de Memoria', 'Este hecho es solo una prueba y se borra enseguida.');

    select count(*)::int into v_n
      from public.elixis_memory_recall(v_user, 40) r
     where r.clave = 'prueba_de_memoria';

    select public.elixis_memory_forget(v_user, 'Prueba de Memoria') into v_del;

    return query select w.ok, w.motivo, w.total, v_n, v_del;
end;
$fn$;

revoke execute on function public.elixis_memory_selftest() from public, anon, authenticated;

-- Tiene que devolver: escrito=true, motivo=ok, recordado=1, olvidado=true.
-- Si sale 'sin_cuenta_owner', para y avisa.
select * from public.elixis_memory_selftest();
