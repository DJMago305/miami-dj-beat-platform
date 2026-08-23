-- ══════════════════════════════════════════════════════════════════════════════
--  ENTORNO: PRODUCCIÓN   ·   proyecto  hkuvuqupbxwkiykxvqdr
--  ⚠️  El nombre del proyecto es engañoso: COMPRUEBA EL REF EN LA URL ANTES DE EJECUTAR.
--
--  DESTRUCTIVO. Este guion SÍ borra la tabla `public.dj_events`. No es de
--  solo lectura como los guiones de verificación de hoy — léelo entero, en
--  orden, sin saltarte pasos, antes de correr nada.
--
--  Por qué se retira: `dj_events` (legacy, mar-2026) no tiene NINGÚN
--  consumidor de código en toda la plataforma — ni en web/, ni en
--  supabase/functions/. La única mención en `elixis-chat` es un comentario
--  explicando por qué NO se usa. Confirmado además: ninguna otra tabla tiene
--  FK hacia ella (revisado en el esquema, supabase/migrations/20260303000001).
--  Decisión de SSOT del PO (docs/ESTADO_MAESTRO.md, 22-ago): `event_builder_orders`
--  gana como fuente de verdad de reserva; `dj_events` queda marcada para DROP.
--
--  Vive en supabase/scripts/, no en supabase/migrations/ — a propósito. Un
--  DROP TABLE no se ejecuta con `supabase db push` sin que un humano lo
--  corra a mano, línea por línea, en el SQL Editor.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── PASO 1 · SOLO LECTURA — vuelve a comprobar antes de borrar nada ────────────
-- No confíes en que "ya se verificó antes" — la Regla 1 del Libro de Operaciones
-- IA es verificar antes de ejecutar, siempre, con la consulta física en la mano.

-- 1a) ¿Cuántas filas hay? Si esto es 0, no hay pérdida de datos histórica.
--     Si es mayor que 0, LÉELAS antes de seguir — puede haber eventos reales
--     de marzo-2026 que valga la pena archivar, aunque nadie los lea hoy.
select count(*) as filas_en_dj_events from public.dj_events;

-- 1b) ¿Sigue sin haber ninguna FK de otra tabla apuntando aquí? Si esta consulta
--     devuelve alguna fila, DETENTE — algo cambió desde la auditoría del 22-ago.
select
  tc.table_name as tabla_que_referencia,
  kcu.column_name as columna
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and ccu.table_name = 'dj_events';

-- 1c) ¿Sigue existiendo alguna vista que dependa de dj_events? Si aparece algo,
--     DETENTE — hay que retirar esa vista primero, en su propio paso revisado.
select viewname from pg_views
where definition ilike '%dj_events%' and schemaname = 'public';


-- ── PASO 2 · RED DE SEGURIDAD — copia de resguardo antes de borrar ─────────────
-- Barato, reversible, y evita que un DROP sea la única copia del dato.
-- Si el paso 1a dio 0 filas, esta tabla de resguardo queda vacía — no estorba.
create table if not exists public.dj_events_archive_20260822 as
  table public.dj_events;

comment on table public.dj_events_archive_20260822 is
  'Resguardo de public.dj_events antes de su baja (22-ago-2026). '
  'dj_events no tenía consumidores de código; event_builder_orders es la '
  'fuente de verdad de reserva (docs/ESTADO_MAESTRO.md). Este archivo puede '
  'borrarse cuando el PO confirme que no hace falta ninguna fila histórica.';


-- ── PASO 3 · LA BAJA ────────────────────────────────────────────────────────────
-- Descomenta esta línea solo después de leer los resultados de los pasos 1a-1c
-- y confirmar que siguen diciendo lo mismo que en la auditoría del 22-ago.

-- drop table public.dj_events;


-- ── PASO 4 · CONFIRMACIÓN (correr después del DROP) ────────────────────────────
-- Debe devolver 0 filas — la tabla ya no existe.
-- select count(*) from information_schema.tables
--   where table_schema = 'public' and table_name = 'dj_events';
