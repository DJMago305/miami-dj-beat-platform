-- ═══════════════════════════════════════════════════════════════════════════
--  ⚠️  ENTORNO: PRODUCCION  ·  ref hkuvuqupbxwkiykxvqdr
--  Confirma el ref en la URL antes de pulsar Run.
--
--  TELEMETRIA DE CACHE — hacer visible el unico riesgo de costo que no avisa
--
--  EL PROBLEMA: Realtime reprocesa la sesion acumulada en CADA respuesta. Si
--  el cache acierta, esos tokens cuestan $0,40 por millon y son irrelevantes.
--  Si NO acierta, cuestan $32 por millon y una llamada larga se dispara de
--  ~$0,05 a ~$0,46 por minuto. No lanza error. No se ve en pantalla. Solo
--  aparece en la factura a fin de mes.
--
--  LA SOLUCION: el navegador ya recibe response.usage en cada turno, con
--  input_token_details.cached_tokens. Se acumula por sesion y se guarda junto
--  al libro que ya existe. Lo que se mide, se ve venir.
--
--  Sin marcadores que reemplazar. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Contadores en el libro de sesiones que ya existe ───────────────────
alter table public.elixis_voice_sessions
    add column if not exists turns                integer not null default 0,
    add column if not exists input_tokens         bigint  not null default 0,
    add column if not exists cached_tokens        bigint  not null default 0,
    add column if not exists output_tokens        bigint  not null default 0,
    add column if not exists input_audio_tokens   bigint  not null default 0,
    add column if not exists cached_audio_tokens  bigint  not null default 0,
    add column if not exists output_audio_tokens  bigint  not null default 0;

comment on column public.elixis_voice_sessions.cached_tokens is
    'Tokens de entrada servidos desde cache. Si esto se acerca a input_tokens, el costo es el bueno; si se queda en cero, la sesion esta saliendo hasta 9x mas cara.';

-- ── 2 · Acumular el consumo de un turno ────────────────────────────────────
-- Se SUMA en vez de fijar, para poder llamarla varias veces durante la sesion
-- sin perder lo anterior. Comprueba el dueno: nadie escribe telemetria ajena.
create or replace function public.elixis_voice_usage_record(
    p_session      uuid,
    p_turns        integer default 0,
    p_input        bigint  default 0,
    p_cached       bigint  default 0,
    p_output       bigint  default 0,
    p_input_audio  bigint  default 0,
    p_cached_audio bigint  default 0,
    p_output_audio bigint  default 0
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_n integer;
begin
    update public.elixis_voice_sessions
       set turns               = turns               + greatest(coalesce(p_turns,0), 0),
           input_tokens        = input_tokens        + greatest(coalesce(p_input,0), 0),
           cached_tokens       = cached_tokens       + greatest(coalesce(p_cached,0), 0),
           output_tokens       = output_tokens       + greatest(coalesce(p_output,0), 0),
           input_audio_tokens  = input_audio_tokens  + greatest(coalesce(p_input_audio,0), 0),
           cached_audio_tokens = cached_audio_tokens + greatest(coalesce(p_cached_audio,0), 0),
           output_audio_tokens = output_audio_tokens + greatest(coalesce(p_output_audio,0), 0)
     where id = p_session;
    get diagnostics v_n = row_count;
    return coalesce(v_n,0) > 0;
end;
$fn$;

-- ── 3 · Tarifas, en un solo sitio y auditables ─────────────────────────────
-- Precios de lista OpenAI, agosto 2026, en dolares por MILLON de tokens.
-- Si cambian, se cambian AQUI y todo lo demas se recalcula solo.
create or replace function public.elixis_voice_tarifa(p_tier text)
returns table (audio_in numeric, audio_out numeric, text_in numeric,
               text_out numeric, cached_in numeric)
language sql
immutable
as $fn$
    select * from (values
        ('mini',     10.0,  20.0, 0.60,  2.40, 0.30),
        ('flagship', 32.0,  64.0, 4.00, 24.00, 0.40)
    ) t(tier, audio_in, audio_out, text_in, text_out, cached_in)
    where t.tier = coalesce(p_tier, 'flagship');
$fn$;

-- ── 4 · La vista que responde "¿me esta saliendo cara esta conversacion?" ──
create or replace view public.elixis_voice_consumo as
select
    s.id,
    s.user_id,
    s.opened_at,
    s.tier,
    s.status,
    s.billed_seconds,
    s.turns,
    s.input_tokens,
    s.cached_tokens,
    s.output_tokens,

    -- El numero que importa. Por debajo de ~50% hay que mirar la sesion.
    case when s.input_tokens > 0
         then round(100.0 * s.cached_tokens / s.input_tokens, 1)
         else null end                                    as cache_pct,

    -- Coste ESTIMADO. Entrada no cacheada al precio de audio (en voz es lo
    -- que domina); la cacheada, a su tarifa. Es una estimacion, no la factura.
    round(
        ( greatest(s.input_tokens - s.cached_tokens, 0) * t.audio_in
        + s.cached_tokens                               * t.cached_in
        + s.output_tokens                               * t.audio_out
        ) / 1000000.0
    , 4)                                                  as costo_estimado_usd,

    -- Lo que habria costado sin cache. La diferencia es lo que te ahorra.
    round(
        ( s.input_tokens  * t.audio_in
        + s.output_tokens * t.audio_out
        ) / 1000000.0
    , 4)                                                  as costo_sin_cache_usd,

    case
        when s.input_tokens = 0                              then 'sin datos'
        when s.cached_tokens = 0                             then 'SIN CACHE — revisar'
        when s.cached_tokens::numeric / s.input_tokens < 0.5  then 'cache flojo'
        else 'ok'
    end                                                   as veredicto
  from public.elixis_voice_sessions s
  cross join lateral public.elixis_voice_tarifa(s.tier) t;

comment on view public.elixis_voice_consumo is
    'Consumo y coste estimado por sesion de voz. cache_pct es el numero que hay que vigilar.';

-- ── 5 · Permisos ───────────────────────────────────────────────────────────
revoke execute on function public.elixis_voice_usage_record(uuid,integer,bigint,bigint,bigint,bigint,bigint,bigint)
    from public, anon, authenticated;
grant  execute on function public.elixis_voice_usage_record(uuid,integer,bigint,bigint,bigint,bigint,bigint,bigint)
    to service_role;

-- La vista hereda el RLS de elixis_voice_sessions: cada quien ve lo suyo,
-- owner/staff lo ven todo. No hace falta politica propia.
alter view public.elixis_voice_consumo set (security_invoker = true);
grant select on public.elixis_voice_consumo to authenticated;

commit;

-- ── COMPROBACION ───────────────────────────────────────────────────────────
-- Las columnas nuevas existen y la vista calcula. Con sesiones aun sin
-- telemetria saldra 'sin datos', que es lo correcto.
select count(*) as sesiones,
       count(*) filter (where veredicto = 'ok')               as con_cache_bueno,
       count(*) filter (where veredicto = 'SIN CACHE — revisar') as sin_cache,
       count(*) filter (where veredicto = 'sin datos')        as sin_telemetria,
       coalesce(round(sum(costo_estimado_usd), 4), 0)         as gasto_estimado_usd
  from public.elixis_voice_consumo;
