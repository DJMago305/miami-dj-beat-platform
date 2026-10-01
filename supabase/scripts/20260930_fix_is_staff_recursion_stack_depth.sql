-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-30
-- Autorizado por el PO: "sí, corrígelo ahora" / "autorizo el arreglo"
--
-- PROBLEMA REAL ENCONTRADO (reproducido en vivo con curl y en el navegador):
-- Cualquier SELECT sobre public.dj_profiles fallaba con:
--   ERROR 54001: stack depth limit exceeded
--   HINT: Increase the configuration parameter "max_stack_depth"...
-- Esto rompía la carga del propio perfil (dj-profile.html) para CUALQUIER
-- DJ o staff logueado -- no era el incidente de latencia de Supabase ni un
-- problema del navegador, era una recursión infinita real en el servidor.
--
-- CAUSA RAÍZ:
-- La política RLS "dj_profiles_staff_select_all" (SELECT) usa como condición
-- is_staff(auth.uid()). is_staff() NO era SECURITY DEFINER, así que su
-- propio SELECT interno a public.dj_profiles vuelve a evaluar las políticas
-- RLS de dj_profiles -- incluida la misma "dj_profiles_staff_select_all" --
-- lo que la vuelve a llamar a sí misma. Recursión infinita -> stack overflow
-- de Postgres. Lo mismo aplicaba a is_staff_management(), usada en la
-- política de INSERT "dj_profiles: alta solo cuenta artista".
--
-- ARREGLO (mínimo, no toca ninguna política ni cambia permisos):
-- Marcar is_staff() e is_staff_management() como SECURITY DEFINER (ya
-- tenían SET search_path TO 'public' correctamente fijado). Al ser
-- SECURITY DEFINER, su SELECT interno a dj_profiles corre con los
-- privilegios del dueño de la función y NO vuelve a pasar por RLS -->
-- se rompe la recursión sin cambiar a quién se le considera staff.
--
-- VERIFICADO: simulando la sesión real de DJMago305 (auth.uid() =
-- 3f5d5196-273c-458e-a4af-6b3545422177) y de otra cuenta staff
-- (01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4) vía
--   set local request.jwt.claims = '{"sub":"<uid>","role":"authenticated"}'
-- ambas devuelven la fila esperada sin error. Confirmado también en el
-- navegador: dj-profile.html?id=3f5d5196-... carga limpio, sin 500, con
-- foto/reseñas/residencia reales (antes se quedaba en blanco / "Sin fila
-- dj_profiles en P1").

create or replace function public.is_staff(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.dj_profiles d
    where d.user_id = p_uid
      and lower(trim(coalesce(d.role, ''))) in ('admin', 'owner', 'manager', 'seller')
  );
$function$;

create or replace function public.is_staff_management(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.dj_profiles d
    where d.user_id = p_uid
      and lower(trim(coalesce(d.role, ''))) in ('admin', 'owner', 'manager')
  );
$function$;

-- NOTA para sesión futura: is_staff()/is_staff_management() las usan
-- decenas de políticas RLS en otras tablas además de dj_profiles (ver
-- memoria "dj_profiles: 61 funciones SQL de permisos dependen"). Vale la
-- pena, en sesión dedicada, revisar si hay otras funciones de permisos
-- (no solo estas dos) que consulten dj_profiles sin SECURITY DEFINER y
-- puedan tener el mismo riesgo de recursión en otras tablas.
