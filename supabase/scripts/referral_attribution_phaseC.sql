-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: 🧪 PRUEBA  (mdjb-ensayo · project ref rtbsovavmtnjpbbpwsin)
-- El MISMO script se corre en 🔴 PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) en el cutover.
--
-- Fase C — Atribución de referidos (ecosistema "todo enlazado")
-- Objetivo: que el registro de DJ guarde DE QUIÉN VINO (source_ref), igual que
-- ya lo hacen los clientes (client_profiles.source_ref). El reparto de la
-- comisión (resolver source_ref → referidor) lo hará el Bloque 5 (Stripe Connect).
--
-- Idempotente y SEGURO: solo agrega columna/índice si no existen. NO borra ni
-- modifica datos. Correr en el SQL Editor de Supabase (PRUEBA).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Columna de atribución en dj_profiles (client_profiles ya la tiene).
alter table public.dj_profiles
  add column if not exists source_ref text;

-- 2) Índice para resolver "referral_code → referidor" rápido cuando llegue el reparto.
create index if not exists idx_dj_profiles_source_ref
  on public.dj_profiles (source_ref);

-- ── Verificación (opcional) — debe devolver una fila con 'source_ref':
-- select column_name
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name   = 'dj_profiles'
--    and column_name  = 'source_ref';
