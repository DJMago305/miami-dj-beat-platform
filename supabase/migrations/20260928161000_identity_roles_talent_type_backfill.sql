-- 🔴 PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- 2026-09-28: rol genérico "dj" en identity.user_roles — item #3 de la lista
-- maestra, ticket docs/tickets/2026-09-27-rol-generico-dj-identidad-y-pendientes.md,
-- sección 1 (hallazgo estructural). Requiere que la migración
-- 20260928160000_identity_role_bartender_enum.sql ya esté aplicada.
--
-- Estado real confirmado antes de tocar nada (8 cuentas con role='dj'):
-- solo 2 están mal clasificadas — el resto SON DJs reales (algunos con
-- perfil incompleto, que es un problema distinto, no de rol):
--   - Jean Paul (Vergara): bartender real, categoria='bartender' ya escrita
--     en dj_profiles desde el ticket original (2026-09-27) → role='bartender'
--   - AHI NA MA (Yury Cabrera): orquesta Latina / Músicos en Vivo,
--     categoria='orquesta' ya escrita → role='performer' (el enum ya tenía
--     este valor sin usar, encaja con "artista que se presenta en vivo")
--
-- Auditoría de impacto ANTES de aplicar (2026-09-28, verificado con datos
-- reales, no supuesto): el frontend entero decide navegación/permisos por
-- `dj_profiles.role` (columna DISTINTA, sin relación automática con
-- identity.user_roles) y por `auth.jwt() → app_metadata.role` (para las 3
-- políticas RLS de escritura en dj_profiles/artist_rates) — ninguna de las
-- dos consulta identity.user_roles directamente hoy. app_metadata.role de
-- estas 2 cuentas ya es 'artist' (no 'dj'), así que este cambio NO afecta
-- su capacidad de escribir en su propio perfil. dj_profiles.role queda
-- intacto a propósito — es un campo activo y fuera del alcance de este
-- ticket; cambiarlo es una decisión aparte, no pedida aquí.
--
-- 1) role_allowed(): agrega 'bartender' a lo permitido para account_type
--    'artist' (ya incluía 'dj','performer','producer'). CREATE OR REPLACE
--    de una función SQL simple — mismo patrón usado en toda la sesión.
CREATE OR REPLACE FUNCTION identity.role_allowed(p_account identity.account_type, p_role identity.app_role)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE p_account
    WHEN 'artist' THEN p_role IN ('dj', 'performer', 'producer', 'bartender')
    WHEN 'client' THEN p_role IN ('client', 'venue')
    WHEN 'staff'  THEN p_role IN ('owner', 'admin', 'manager', 'seller')
  END;
$function$;

-- 2) Backfill de las 2 cuentas reales mal clasificadas — con guardas dobles
--    (user_id exacto + stage_name) para que esto nunca toque otra fila por
--    error, e idempotente (solo si sigue en 'dj').
UPDATE identity.user_roles ur
SET role = 'bartender'
FROM dj_profiles dp
WHERE ur.user_id = dp.user_id
  AND ur.user_id = '110f0b66-970a-40f1-9a6f-a293d34a1cdb'
  AND dp.stage_name = 'Jean Paul'
  AND ur.role = 'dj';

UPDATE identity.user_roles ur
SET role = 'performer'
FROM dj_profiles dp
WHERE ur.user_id = dp.user_id
  AND ur.user_id = '84de976e-5b6c-4a5f-8aa4-4ffd2e335af1'
  AND dp.stage_name = 'AHI NA MA'
  AND ur.role = 'dj';

-- El resto de las 8 cuentas (DJ Ary, DJMago305, DJSolitario, DJYuyo,
-- JULITO DJ PMM) SON DJs reales — quedan en role='dj' sin tocar. Aron Rosso
-- ya fue corregido antes (sección 4 del ticket, 2026-09-27) y no tiene
-- role='dj' desde entonces. Jaziel sigue con perfil incompleto (sin
-- artist_specialty/categoria) — sin evidencia para clasificarlo, se deja
-- en 'dj' por ahora (es la categoría por defecto del flujo de registro).
