-- ═══════════════════════════════════════════════════════════════════════════
-- Entorno: FUENTE ÚNICA — se aplica PRIMERO a PRUEBA (rtbsovavmtnjpbbpwsin)
--          y DESPUÉS a PRODUCCIÓN (hkuvuqupbxwkiykxvqdr), en ese orden,
--          por quien corre migraciones. NO se duplica este archivo por
--          entorno: es el MISMO script ejecutado dos veces, una por proyecto.
--
-- ⚠️ ESTADO AL MOMENTO DE ESCRIBIRSE: NO APLICADA EN NINGÚN ENTORNO.
--    Este archivo es únicamente la migración preparada para revisión del PO.
--
-- ⚠️ DEPENDENCIA DURA: esta migración da por hecho que
--    20260913100000_dj_profiles_seo_publish_status.sql YA se aplicó (esa
--    migración añade dj_profiles.seo_publish_status). Si se aplica esta
--    migración antes que esa, el CREATE VIEW de abajo falla en el momento
--    (referencia a una columna que no existe) — falla RUIDOSA, no en
--    silencio, por diseño. Aplicar SIEMPRE en el orden: 100000 → 110000.
--
-- ⚠️ FIX-DJSLUG-NOT-A-REAL-COLUMN (2026-09-13): la versión anterior de este
--    archivo exigía `dj_slug` como columna física de dj_profiles en
--    required_cols y hacía `SELECT p.dj_slug` directo -- pero dj_slug NUNCA
--    fue una columna real (confirmado contra el esquema real de producción).
--    La 100000 solo la calcula DENTRO de la vista public_dj_profiles; nunca
--    la agrega a la tabla base. Con eso, esta vista fallaba su propio guard
--    en el primer intento, incluso aplicada después de la 100000. Ahora
--    calcula dj_slug con la MISMA expresión que la 100000 (COALESCE
--    username → stage_name → dj_name, sanitizado), sin depender de
--    public_dj_profiles ni asumir columna física.
--
-- Qué hace, y por qué
-- ───────────────────
-- Ticket: DJ Public Profile Engine — "Public Talent Projection". El defecto
-- en producción es que web/find-dj.html busca en public_dj_profiles con
-- SOLO `.eq('available', true)` + coincidencia de texto — sin exigir bio,
-- foto, ni aprobación editorial. Eso permite que filas incompletas o de
-- prueba (confirmado: la cuenta de QA "DJ PRO TEST", y un registro real
-- pero incompleto de un DJ genuino sin bio/foto) aparezcan en una búsqueda
-- pública "DJ" en vivo, y que el link de resultado apunte a
-- profile.html?id=<uid> en vez del perfil canónico /dj/<slug>.html.
--
-- Esta vista es la ÚNICA fuente de verdad de "qué DJ es público/buscable":
-- traduce a SQL exactamente la misma función qualifies() que ya usa y prueba
-- tools/dj-profiles/build.mjs para decidir qué DJ recibe una página
-- web/dj/<slug>.html — NO inventa un criterio nuevo. Un DJ que no calificaría
-- para tener su página estática tampoco debe aparecer en el buscador: el
-- buscador DESCUBRE entidades canónicas ya existentes, no publica una
-- segunda vez por su cuenta.
--
-- FALLA CERRADA — una fila necesita TODO lo siguiente para aparecer:
--   · seo_publish_status = 'approved' (compuerta editorial explícita)
--   · dj_slug no nulo/no vacío, y distinto de 'owner' (Owner no es DJ)
--   · stage_name no nulo/no vacío
--   · photo_url no nulo/no vacío
--   · bio o bio_short no nulos/no vacíos (al menos uno)
--   · artist_specialty o roles contienen la palabra "dj" (isActuallyDJ)
--   · artist_specialty NO contiene la palabra "staff"
-- `available=true` / `status='ACTIVE'` / tener un `plan` NO son, por sí
-- solos ni combinados, motivo de inclusión — a propósito: son exactamente
-- los campos que sí tiene la cuenta de prueba "DJ PRO TEST" y el registro
-- incompleto de un DJ real, y ambos deben quedar fuera.
--
-- PROYECCIÓN MÍNIMA — ninguna columna que find-dj.html no necesite para
-- mostrar/buscar una tarjeta de resultado sale de aquí: nada de phone,
-- email, address, birth_date, ni columnas de tarjeta/pago (card_*,
-- stripe_customer_id, hardware_token, sft_pay_* instructions, wallet_balance,
-- referral_credits, etc.), ni notas internas, ni `status` (interno),
-- ni `rating`/`review_count` (el generador de perfiles ya dejó de fabricar
-- estrellas a partir de un default sin reseñas reales — corrección 17 de
-- build.mjs; esta vista no reabre esa puerta reexponiendo el campo crudo
-- para que el buscador lo reintroduzca por otro lado).
--
-- PURGA DE METADATOS DE FACTURACIÓN (2026-09-13): la versión anterior
-- exponía `plan_type`, `plan_status`, `plan_expires_at` y `subscription_status`
-- -- ninguno es dato personal, pero son estado comercial/de suscripción que
-- no pertenece a una tarjeta pública de búsqueda. Se retiran de la
-- proyección; `plan` se conserva (etiqueta pública del nivel, ej. "PRO").
--
-- No hace referencia a `booking_eligibility` — esa columna no existe y está
-- fuera de alcance de este ticket; no se implementa ni se le pone default.
--
-- ACL — mismo patrón D-07 que la migración anterior: cada CREATE VIEW
-- reinstala permisos por defecto, así que se GRANT SELECT y luego se REVOKE
-- escritura explícitamente, en la misma migración, para que esta vista no
-- nazca con el hueco abierto.
--
-- NO incluye: ningún cambio de RLS sobre dj_profiles, ningún backfill de
-- filas (el backfill de las 3 aprobadas ya vive en la migración anterior),
-- ninguna otra tabla, ninguna vista materializada, ningún RPC.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  required_cols text[] := ARRAY[
    -- dj_slug ya NO está aquí: se calcula, no es columna física (ver fix arriba).
    -- username y dj_name se agregan porque ahora hacen falta para calcularlo.
    'user_id', 'stage_name', 'photo_url', 'city', 'roles',
    'artist_specialty', 'plan', 'is_premium', 'bio', 'bio_short',
    'seo_publish_status', 'username', 'dj_name'
  ];
  c text;
  missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.dj_profiles') IS NULL THEN
    RAISE EXCEPTION 'public.dj_profiles does not exist';
  END IF;

  FOREACH c IN ARRAY required_cols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dj_profiles' AND column_name = c
    ) THEN
      missing := array_append(missing, c);
    END IF;
  END LOOP;

  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'public_dj_talent view requires columns that do not exist yet on dj_profiles: %. Apply 20260913100000_dj_profiles_seo_publish_status.sql first.', array_to_string(missing, ', ');
  END IF;
END $$;

DROP VIEW IF EXISTS public.public_dj_talent CASCADE;

-- security_invoker=false: mismo modelo que public_dj_profiles (lectura
-- pública explícita vía GRANT, no depende de las RLS del rol que consulta).
--
-- dj_slug se calcula en la subconsulta `t` (misma fórmula que la 100000:
-- COALESCE username → stage_name → dj_name, sanitizado a minúsculas/guiones)
-- para poder tanto proyectarlo como filtrarlo en el WHERE de abajo -- un
-- alias de SELECT no puede referenciarse en el WHERE del mismo nivel.
CREATE VIEW public.public_dj_talent
WITH (security_invoker = false)
AS
SELECT
  t.user_id,
  t.dj_slug,
  t.stage_name,
  t.photo_url,
  t.city,
  t.roles,
  t.artist_specialty,
  t.plan,
  t.is_premium,
  t.bio_preview
FROM (
  SELECT
    p.user_id,
    lower(regexp_replace(trim(COALESCE(
      NULLIF(p.username, ''), NULLIF(p.stage_name, ''), NULLIF(p.dj_name, ''), ''
    )), '[^a-zA-Z0-9]+', '-', 'g')) AS dj_slug,
    p.stage_name,
    p.photo_url,
    p.city,
    p.roles,
    p.artist_specialty,
    p.plan,
    p.is_premium,
    p.bio,
    p.bio_short,
    p.seo_publish_status,
    -- bio_preview: recorte corto para tarjeta de resultado. Nunca se expone la
    -- bio larga completa en el buscador — el perfil canónico /dj/<slug>.html
    -- (enlazado desde cada tarjeta) es el lugar para la bio completa.
    left(coalesce(nullif(p.bio_short, ''), nullif(p.bio, '')), 160) AS bio_preview
  FROM public.dj_profiles p
) t
WHERE t.seo_publish_status = 'approved'
  AND t.dj_slug IS NOT NULL AND t.dj_slug <> '' AND t.dj_slug <> 'owner'
  AND t.stage_name IS NOT NULL AND t.stage_name <> ''
  AND t.photo_url IS NOT NULL AND t.photo_url <> ''
  AND coalesce(nullif(t.bio, ''), nullif(t.bio_short, '')) IS NOT NULL
  -- isActuallyDJ(): \b dj \b sobre artist_specialty || roles, insensible a
  -- mayúsculas — \m/\M son los anclajes de límite de palabra de Postgres.
  AND (coalesce(t.artist_specialty, '') || ' ' || coalesce(t.roles, '')) ~* '\mdj\M'
  -- exclusión de Staff (qualifies(): /\bstaff\b/i sobre artist_specialty).
  AND coalesce(t.artist_specialty, '') !~* '\mstaff\M';

COMMENT ON VIEW public.public_dj_talent IS
  'Public Talent Projection — SSOT de "qué DJ es público/buscable". Falla cerrada: seo_publish_status=''approved'' + bio/bio_short + photo_url + stage_name + dj_slug (calculado) + rol DJ real, sin Staff/Owner (traducción exacta de qualifies() en tools/dj-profiles/build.mjs). Proyección mínima: sin phone/email/address/birth_date/columnas de pago/facturación (plan_type, plan_status, plan_expires_at, subscription_status)/rating crudo. find-dj.html debe consultar ESTA vista, no public_dj_profiles directamente, para búsqueda pública.';

GRANT SELECT ON public.public_dj_talent TO anon, authenticated;

-- D-07 (mismo hallazgo que la migración anterior): una vista recién creada
-- hereda ACL de escritura por defecto. Se revoca explícitamente para que
-- esta vista no nazca con el hueco abierto. No resuelve D-07 de raíz (sigue
-- siendo un handoff de SEGURIDAD/PRIVACIDAD), solo no lo agrava.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.public_dj_talent FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
