-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: 🔴 PRODUCCIÓN  (project ref hkuvuqupbxwkiykxvqdr)
--
-- Fase C — Atribución de referidos: dj_profiles.source_ref
--   Cierra el hueco vs clientes (client_profiles.source_ref ya existe). Guarda
--   DE QUIÉN VINO el DJ al registrarse (?ref=<user_id>, contrato nativo "DJ_UUID").
--   El reparto de la comisión (source_ref → referidor) lo hará el Bloque 5.
--
-- CUÁNDO: correr en el SQL Editor de Supabase (PRODUCCIÓN) *ANTES* de desplegar
--   el nuevo auth.js. Si la columna no existe cuando el nuevo auth.js intente
--   escribir source_ref, el registro del DJ fallaría.
--
-- SEGURIDAD: idempotente. Solo agrega columna/índice si no existen. NO borra ni
--   modifica datos. Ya validado en 🧪 PRUEBA (mdjb-ensayo · rtbsovavmtnjpbbpwsin).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Columna de atribución en dj_profiles.
alter table public.dj_profiles
  add column if not exists source_ref text;

-- 2) Índice para resolver "referral → referidor" rápido cuando llegue el reparto.
create index if not exists idx_dj_profiles_source_ref
  on public.dj_profiles (source_ref);

-- ── Verificación (opcional) — debe devolver una fila con 'source_ref':
-- select column_name
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name   = 'dj_profiles'
--    and column_name  = 'source_ref';
