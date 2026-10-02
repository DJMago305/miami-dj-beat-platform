-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- APLICADO el 2026-09-30 directo
-- vía SQL Editor/MCP (execute_sql), con autorización explícita del PO en cada
-- paso. Registro histórico -- ver docs/ESTADO_MAESTRO.md [2026-09-30]
-- "CRÍTICO CERRADO -- bank_accounts_safe..." y el bloque siguiente sobre las
-- otras 3 vistas revisadas el mismo día.
--
-- Origen: el PO compartió una captura del Dashboard -- "Advisor found 6
-- issues", todas SECURITY/CRITICAL/"Security Definer View". Se investigó
-- cada una por API (get_advisors + pg_get_viewdef + information_schema.
-- role_table_grants + pg_trigger) antes de tocar nada, mismo criterio que el
-- resto de hallazgos de seguridad de esta sesión -- no se reacciona a la
-- etiqueta "CRITICAL" sola.
--
-- Las 6 vistas marcadas por el Advisor: public_dj_talent,
-- dj_weekly_impressions, service_catalog_public, residency_schedule_secure,
-- public_dj_profiles, bank_accounts_safe.
--   · public_dj_profiles y service_catalog_public: SECURITY DEFINER
--     INTENCIONAL, ya verificado antes en esta misma sesión (así se sirve el
--     directorio público / catálogo de precios sin depender de RLS) -- no se
--     tocan aquí.
--   · Las 4 restantes se auditaron así: ¿qué expone la vista de verdad
--     (pg_get_viewdef)? ¿tiene disparador que permita escritura real
--     (pg_trigger)? ¿hay uso legítimo en el código (grep de web/ y
--     supabase/functions/)? Resultado abajo, por vista.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. bank_accounts_safe -- GRAVE, corregido ───────────────────────────────
-- Vista simple de 1 sola tabla sobre `bank_accounts` (columnas curadas: id,
-- provider, institution_name, account_name, account_type, last4, active,
-- created_at -- nunca el número de cuenta completo). Por ser SECURITY
-- DEFINER + vista simple auto-actualizable (sin JOIN/GROUP BY/columnas
-- calculadas), Postgres SÍ propaga escrituras a la tabla real. Tenía `anon`
-- con SELECT+INSERT+UPDATE+DELETE+TRUNCATE: cualquier visitante sin sesión
-- podía borrar o vaciar por completo las cuentas bancarias conectadas de la
-- empresa. Verificado con grep: CERO referencias a bank_accounts_safe ni a
-- bank_accounts desde el navegador -- solo 2 Edge Functions
-- (teller-sync-transactions, teller-store-enrollment) tocan la tabla real,
-- ambas vía service_role (nunca dependen de estos permisos).
revoke all privileges on public.bank_accounts_safe from anon, authenticated;
-- Verificado con curl anónimo real tras aplicar: GET (SELECT) -> 401;
-- DELETE -> 401. service_role (Edge Functions de Teller) sin cambios.

-- ── 2. dj_weekly_impressions -- prolijidad, sin riesgo real ─────────────────
-- Vista agregada (GROUP BY sobre search_impressions) -- Postgres rechaza
-- cualquier INSERT/UPDATE/DELETE/TRUNCATE sobre una vista con GROUP BY
-- (confirmado además: pg_trigger vacío, sin INSTEAD OF que lo habilite). Los
-- permisos de escritura que tenía `anon`/`authenticated` eran letra muerta,
-- no explotable -- se revocan igual por buena práctica (mínimo privilegio).
-- Uso real confirmado por grep: solo SELECT, desde web/weather-lab.html.
revoke all privileges on public.dj_weekly_impressions from anon;
revoke insert, update, delete, truncate on public.dj_weekly_impressions from authenticated;
-- Verificado con curl anónimo real tras aplicar: GET (SELECT) -> 401.

-- ── 3. residency_schedule_secure -- prolijidad, sin riesgo real ─────────────
-- Vista con una columna calculada (`CASE WHEN is_staff(auth.uid()) THEN
-- venue_pay_usd ELSE NULL END`) -- tampoco es auto-actualizable, mismo
-- resultado: pg_trigger vacío, escrituras rechazadas por Postgres sin
-- importar el GRANT. La vista además ya implementa su propia seguridad de
-- fila/columna dentro del propio SELECT (WHERE ... AND (is_staff(auth.uid())
-- OR dj_id = ...), venue_pay_usd oculto a quien no es staff) -- diseño
-- correcto, no se toca esa lógica. `anon` ya no tenía ningún permiso aquí
-- (confirmado antes de tocar nada). Uso real confirmado por grep: solo
-- SELECT, desde web/staff-agenda.html, web/dj-dashboard.html,
-- web/calendario-operacional-inteligente.html.
revoke insert, update, delete, truncate on public.residency_schedule_secure from authenticated;

-- ── 4. public_dj_talent -- revisada, sin cambios ────────────────────────────
-- Directorio público real de web/find-dj.html. Filtra correctamente:
-- seo_publish_status='approved', excluye dj_slug='owner' y
-- artist_specialty ~* '\mstaff\M', exige stage_name/photo_url/bio. Expone
-- solo columnas de directorio (user_id, dj_slug, stage_name, photo_url,
-- city, roles, artist_specialty, plan, is_premium, bio_preview truncada a
-- 160 caracteres) -- nada sensible. Ya tenía SOLO SELECT+REFERENCES+TRIGGER
-- para anon/authenticated (sin permisos de escritura de entrada) -- ninguna
-- acción necesaria, se deja documentado como revisada.

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación sugerida (solo lectura, correr después de aplicar):
--   select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema='public'
--     and table_name in ('bank_accounts_safe','dj_weekly_impressions','residency_schedule_secure','public_dj_talent')
--     and grantee in ('anon','authenticated')
--   order by table_name, grantee;
--   -- Esperado: bank_accounts_safe sin filas de anon/authenticated;
--   -- dj_weekly_impressions sin anon, authenticated solo SELECT/REFERENCES/TRIGGER;
--   -- residency_schedule_secure sin anon, authenticated solo SELECT/REFERENCES/TRIGGER;
--   -- public_dj_talent sin cambios (SELECT/REFERENCES/TRIGGER en ambos roles).
-- ═══════════════════════════════════════════════════════════════════════════
