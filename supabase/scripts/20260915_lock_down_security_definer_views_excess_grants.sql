-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- Ticket: remediación de las alertas secundarias (auth_users_exposed,
-- security_definer_view) reportadas junto con rls_disabled_in_public
-- el 2026-09-15.
--
-- HALLAZGO CRÍTICO ADICIONAL (no reportado por el PO, encontrado en esta
-- auditoría): varias vistas SECURITY DEFINER tenían permisos de escritura
-- (INSERT/UPDATE/DELETE) otorgados por defecto a `anon`/`authenticated`,
-- probablemente heredados del grant por defecto de Supabase al crear
-- objetos en `public` sin REVOKE explícito. Confirmado EN VIVO (transacción
-- revertida con ROLLBACK, sin tocar datos reales):
--
--   BEGIN; SET LOCAL ROLE anon;
--   UPDATE public.public_dj_profiles SET bio = bio
--     WHERE user_id = (SELECT user_id FROM public.public_dj_profiles LIMIT 1);
--   -- resultado: UPDATE 1 (éxito)
--   ROLLBACK;
--
-- Es decir: cualquier visitante SIN sesión podía modificar el perfil de
-- CUALQUIER DJ público (bypass total de la RLS de dj_profiles, porque la
-- vista es SECURITY DEFINER y ejecuta con privilegios del dueño de la
-- vista). Mismo resultado confirmado en dj_memory_facts.
--
-- Verificado con grep en todo el repo (web/ + supabase/) antes de cada
-- REVOKE: ningún archivo de la app usa escritura vía estas vistas (las
-- escrituras reales de perfil pasan por dj_profiles directamente, con su
-- propia RLS de dueño) ni lectura en absoluto en varios casos.

-- 1) public_dj_profiles: lectura pública real y activa (dj-profile.html,
--    find-dj.html, courses.html, road-map.html, artists.js, mdj-event-
--    builder.js, mdj-assistant.js, Edge Functions elixis-chat/booth-chat).
--    Se mantiene SELECT; se cierra la escritura fantasma.
revoke insert, update, delete on public.public_dj_profiles from anon, authenticated;

-- 2) public_dj_talent: lectura pública real (find-dj-search.mjs). Mismo
--    criterio.
revoke insert, update, delete on public.public_dj_talent from anon, authenticated;

-- 3) event_builder_orders_staff: expone email/teléfono de clientes vía
--    join a auth.users (el hallazgo original de auth_users_exposed).
--    Cero referencias en todo el código de la app -- nada legítimo la
--    usa. Con SELECT+UPDATE+DELETE+INSERT otorgados a `authenticated`,
--    CUALQUIER usuario con sesión (cualquier DJ o cliente) podía leer y
--    modificar los pedidos y datos de contacto de TODOS los clientes.
--    Se revoca todo -- el acceso real de staff debe ir por service_role.
revoke all on public.event_builder_orders_staff from anon, authenticated;

-- 4) v_dj_real_balance: saldo real de CUALQUIER DJ, sin filtro por
--    usuario, expuesto incluso a `anon`. Cero referencias en el código.
revoke all on public.v_dj_real_balance from anon, authenticated;

-- 5) ai_booth_session_training: datos de intención/interés de cliente del
--    booth IA. Cero referencias en código runtime (solo aparece en
--    migraciones). Grants completos a anon+authenticated sin necesidad.
revoke all on public.ai_booth_session_training from anon, authenticated;

-- 6) dj_memory_facts: hechos de memoria de ELIXIS por usuario. Cero
--    referencias en código runtime. Confirmado en vivo que anon podía
--    escribir. Se cierra por completo.
revoke all on public.dj_memory_facts from anon, authenticated;

-- 7) dj_weekly_impressions: sí tiene un uso real (web/weather-lab.html),
--    pero SOLO tras sb.auth.getSession() -- es una herramienta interna
--    con sesión, no pública. Se revoca únicamente el acceso anónimo; se
--    mantiene `authenticated` para no romper esa página.
revoke select, insert, update, delete on public.dj_weekly_impressions from anon;

-- NOTA: residency_schedule_secure ya estaba correctamente acotada (SELECT
-- solo a `authenticated`, sin anon, con su propia lógica is_staff()/
-- auth.uid() dentro de la vista) -- no se toca en este script.

-- VERIFICACIÓN SUGERIDA DESPUÉS DE PEGAR ESTO EN EL SQL EDITOR:
--
--   select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema='public'
--   and table_name in (
--     'public_dj_profiles','public_dj_talent','event_builder_orders_staff',
--     'v_dj_real_balance','ai_booth_session_training','dj_memory_facts',
--     'dj_weekly_impressions'
--   )
--   and grantee in ('anon','authenticated')
--   order by table_name, grantee;
--
-- Debe verse: public_dj_profiles/public_dj_talent solo con SELECT para
-- anon+authenticated; los demás sin ninguna fila para anon (y
-- event_builder_orders_staff/v_dj_real_balance/ai_booth_session_training/
-- dj_memory_facts sin ninguna fila para authenticated tampoco).
