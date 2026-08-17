-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: 🧪 PRUEBA (rtbsovavmtnjpbbpwsin) para validar → 🔴 PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
--          Para que TU cuenta real quede Fundador, corre en 🔴 PRODUCCIÓN (ahí vive tu cuenta).
--          Confirma arriba-izquierda que el proyecto NO diga "ensayo" antes de correr en prod.
--
-- FÉNIX / MIAMI DJ BEAT — LICENCIA DJ FUNDADOR (GRANDFATHERED / VITALICIA)
-- Regla: la cuenta matriz (role=owner) tiene ACCESO TOTAL ilimitado; los artistas nuevos
-- siguen iniciando en 'free' (50 consultas, herramientas bloqueadas). ADITIVO e idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) TIER 'founder' en entitlements: acceso total, capacidad ILIMITADA (centinela -1).
insert into public.plan_entitlements
  (plan,      ai_tier,    monthly_ai_capacity, gmail_read,gmail_compose,gmail_send, calendar_read,calendar_write, campaign_prepare, automation_level)
values
  ('founder', 'advanced', -1,                  true, true, true,        true, true,             true,             3)
on conflict (plan) do update set
  ai_tier             = excluded.ai_tier,
  monthly_ai_capacity = excluded.monthly_ai_capacity,   -- -1 = ilimitado
  gmail_read = excluded.gmail_read, gmail_compose = excluded.gmail_compose, gmail_send = excluded.gmail_send,
  calendar_read = excluded.calendar_read, calendar_write = excluded.calendar_write,
  campaign_prepare = excluded.campaign_prepare, automation_level = excluded.automation_level,
  updated_at = now();

-- 2) Asignar FOUNDER permanente a la cuenta matriz (todos los perfiles role=owner).
--    Los artistas regulares (role artista/dj) NO se tocan → conservan su plan (free por defecto).
update public.dj_profiles set plan = 'founder' where role = 'owner';

-- 2-bis) OPCIONAL — si tu cuenta de DJ Fundador NO tiene role='owner' (p.ej. es una cuenta
--        de artista concreta), márcala por email quitando el comentario y poniendo tu correo:
-- update public.dj_profiles set plan = 'founder'
--   where user_id = (select id from auth.users where lower(email) = lower('TU_CORREO_AQUI'));

-- ── Verificación (opcional, después de correr) ──
-- select user_id, role, plan from public.dj_profiles where role = 'owner';       -- debe decir plan = founder
-- select * from public.plan_entitlements where plan = 'founder';                  -- capacidad -1, todo true
-- select public.fenix_can((select user_id from public.dj_profiles where role='owner' limit 1), 'gmail.read'); -- true

notify pgrst, 'reload schema';
