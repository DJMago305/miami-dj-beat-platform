-- ============================================================
-- ENTORNO: DISEÑO LOCAL, NO APLICADO A NINGÚN PROYECTO TODAVÍA
-- (ni PRUEBA mdjb-ensayo rtbsovavmtnjpbbpwsin, ni PRODUCCIÓN hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-08-26
-- Autor: Claude (Frontend & Workspace), a pedido del PO
-- ============================================================
--
-- QUÉ ES ESTO Y QUÉ NO ES:
-- El PO pidió "elixis_session_threads" para aislar sesiones multi-artista.
-- Verificado antes de escribir una sola línea: ese aislamiento YA EXISTE.
-- supabase/functions/elixis-realtime-session/index.ts ya identifica a
-- quien llama por su JWT real (auth.getUser), nunca por un artist_id que
-- mande el cliente, y ya inyecta memoria de largo plazo POR USUARIO vía
-- la RPC elixis_memory_recall() -- esa es la tabla elixis_memory_facts,
-- la memoria del motor de VOZ. Es DISTINTA de agent_memory (memoria de
-- elixis-chat/consola de texto, migración 20260816150000) -- las dos
-- existen y funcionan, cada una para su propio consumidor, pero NO están
-- conectadas entre sí. Construir un
-- "elixis-session-broker" nuevo hubiera sido una segunda forma de hacer
-- lo que esa función ya hace -- el propio archivo lo dice en su cabecera:
-- "para no inventar una segunda forma de hacer lo mismo".
--
-- Lo que SÍ falta, y es lo que esta tabla resuelve: elixis_memory_facts
-- guarda HECHOS condensados de largo plazo, no la CONVERSACIÓN cruda reciente.
-- Esto es un buffer corto (TTL, por defecto 7 días) del hilo hablado, con
-- el modo de enfoque activo en cada turno -- para que una sesión nueva
-- pueda retomar "dónde íbamos" sin tener que releer toda la memoria
-- condensada, y para que el modo elegido (Correo/Legal/Distribución/
-- Eventos/General) quede en el registro, no solo en la sesión de voz viva.
--
-- LO QUE NO HACE ESTA MIGRACIÓN: no agrega limpieza automática por
-- pg_cron. Expirar por TTL aquí es LÓGICO (las lecturas filtran
-- expires_at > now()) no físico -- borrar filas vencidas de verdad es una
-- decisión de infraestructura aparte (prender pg_cron, con qué frecuencia)
-- que le toca decidir al PO, no asumirla en este diseño.
-- ============================================================

create table if not exists public.elixis_session_threads (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null,  -- SIEMPRE del JWT verificado del lado del servidor, nunca de un parametro del cliente
  modo_enfoque   text        check (modo_enfoque is null or modo_enfoque in ('correo','legal','distribucion','eventos','general')),
  rol            text        not null check (rol in ('yo','elixis')),
  contenido      text        not null check (char_length(contenido) between 1 and 4000),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '7 days')
);

comment on table public.elixis_session_threads is
  'Buffer corto (TTL logico) de la conversacion hablada reciente, por usuario. NO es memoria de largo plazo -- eso es agent_memory/elixis_memory_recall, ya conectado. Escribe solo el service_role (desde elixis-realtime-session), nunca el cliente directo.';

create index if not exists idx_elixis_session_threads_user
  on public.elixis_session_threads (user_id, created_at desc);

create index if not exists idx_elixis_session_threads_expires
  on public.elixis_session_threads (expires_at);

alter table public.elixis_session_threads enable row level security;

revoke all on table public.elixis_session_threads from public;
revoke all on table public.elixis_session_threads from anon;
revoke all on table public.elixis_session_threads from authenticated;

grant select on table public.elixis_session_threads to authenticated;
grant all on table public.elixis_session_threads to service_role;

-- Mismo patron que agent_memory_select_own_staff: cada quien lee SOLO su
-- propio hilo, y solo si sigue vigente (TTL logico via expires_at).
drop policy if exists elixis_session_threads_select_own on public.elixis_session_threads;
create policy elixis_session_threads_select_own
  on public.elixis_session_threads
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and expires_at > now()
  );

comment on policy elixis_session_threads_select_own on public.elixis_session_threads is
  'Cada usuario lee solo su propio hilo reciente, y solo mientras no haya expirado. Ningun artista puede leer el hilo de otro. No hay INSERT/UPDATE/DELETE de cliente.';

drop policy if exists elixis_session_threads_select_management on public.elixis_session_threads;
create policy elixis_session_threads_select_management
  on public.elixis_session_threads
  for select
  to authenticated
  using (public.is_staff_management(auth.uid()));

comment on policy elixis_session_threads_select_management on public.elixis_session_threads is
  'Management puede leer todos los hilos (auditoria), vigentes o no. Sin escritura de cliente.';

-- El navegador es quien recibe las lineas de transcripcion (los eventos
-- Realtime llegan por el DataChannel al cliente, no a un webhook del
-- servidor -- ver el contrato de voz de esta sesion). Por eso hace falta
-- una via de escritura para el cliente autenticado, pero NUNCA de cliente
-- directo a la tabla (RLS arriba lo bloquea explicitamente). Misma forma
-- que agent_memory_upsert: SECURITY DEFINER, user_id sale de auth.uid()
-- adentro de la funcion, jamas de un parametro -- nadie puede escribir
-- en el hilo de otro por mas que lo intente.
create or replace function public.elixis_thread_append(
  p_rol          text,
  p_contenido    text,
  p_modo_enfoque text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'forbidden: requiere sesion autenticada';
  end if;
  insert into public.elixis_session_threads (user_id, rol, contenido, modo_enfoque)
  values (auth.uid(), p_rol, p_contenido, p_modo_enfoque)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.elixis_thread_append(text, text, text) from public;
revoke all on function public.elixis_thread_append(text, text, text) from anon;
grant execute on function public.elixis_thread_append(text, text, text) to authenticated;

comment on function public.elixis_thread_append(text, text, text) is
  'Unica via de escritura para el cliente: user_id siempre sale de auth.uid(), nunca de un parametro. Usar desde elixis-voice-session.js al recibir cada linea real de transcripcion.';

notify pgrst, 'reload schema';
