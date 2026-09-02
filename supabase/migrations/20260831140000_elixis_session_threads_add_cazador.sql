-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Aplicada ya vía MCP el 2026-08-31
-- (ticket "AUTORIZACIÓN DE MIGRACIÓN SUPABASE Y CONSTRUCCIÓN DE MEMORIA DE
-- HILOS"); este archivo la deja versionada en el repo, no la vuelve a aplicar.
--
-- Gap real encontrado al revisar 20260826200000_elixis_session_threads.sql:
-- el CHECK de modo_enfoque listaba solo ('correo','legal','distribucion',
-- 'eventos','general') -- faltaba 'cazador', a pesar de que el ticket del PO
-- lo lista explícitamente como modo agrupable y el cliente (staff.html) ya
-- manda modoActual='cazador' como p_modo_enfoque en elixis_thread_append.

alter table public.elixis_session_threads
  drop constraint if exists elixis_session_threads_modo_enfoque_check;

alter table public.elixis_session_threads
  add constraint elixis_session_threads_modo_enfoque_check
  check (modo_enfoque is null or modo_enfoque in ('correo','legal','distribucion','eventos','general','cazador'));
