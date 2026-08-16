-- ════════════════════════════════════════════════════════════════════════════
-- FASE 2 · Backfill de identidades legadas → SSOT   (REVISIÓN, no auto-ejecutar)
-- ════════════════════════════════════════════════════════════════════════════
-- VIVE EN scripts/ A PROPÓSITO: NO se aplica solo con `supabase db push`.
-- Ejecución MANUAL y gateada. NADA a producción sin supervisión visual previa.
--
-- Requisitos antes de correr:
--   1. La Fase 1 (esquema identity) debe estar aplicada y verificada
--      (SELECT * FROM identity.verify_phase1();  → todo PASS).
--   2. PASO DE SUPERVISIÓN VISUAL OBLIGATORIO (abajo, 2·PREVIEW).
--
-- Qué hace: LEE public.dj_profiles / client_profiles y POBLA identity.users +
--           identity.user_roles. NO altera los perfiles (eso es Fase 2c, aparte).
-- Idempotente: ON CONFLICT DO NOTHING → re-ejecutable sin duplicar.
-- El trigger de coherencia (Fase 1) actúa de red de seguridad: si un rol no
-- cuadra con su account_type, el INSERT falla ruidosamente en vez de corromper.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 2 · PREVIEW (SUPERVISIÓN VISUAL — revisa esto ANTES de nada) ─────────────
-- Solo-lectura. Mira qué se va a migrar y, sobre todo, los CONFLICT.
--   SELECT proposed_account_type, count(*)
--   FROM identity.v_legacy_reconciliation
--   GROUP BY proposed_account_type
--   ORDER BY 1;
--
--   -- Detalle de conflictos (usuarios en AMBAS tablas):
--   SELECT * FROM identity.v_legacy_reconciliation
--   WHERE proposed_account_type LIKE 'CONFLICT%';
--
-- ── REGLA DE RESOLUCIÓN DE CONFLICTOS (decisión del PO, 2026-08-12) ─────────
--   Si un usuario está en dj_profiles, ESA es su identidad principal:
--     • rol owner/admin/manager/seller → staff
--     • cualquier otro (dj, etc.)       → artist
--   Solo los que están ÚNICAMENTE en client_profiles → client.
--   Su historial de reservas (client_profiles) se CONSERVA como datos suyos;
--   "reservar un evento" es una acción, no una segunda identidad.
--   Diagnóstico real del 2026-08-12: 6 artista, 2 cliente, 5 conflictos
--   (miamidjbeat@=owner→staff; djmago305@, djalexito30512@, yunielaryam1984@,
--    yuyodj1980@ = dj→artist). Esta regla los resuelve automáticamente.


-- ── 2a · STAFF (dj_profiles.role ∈ owner/admin/manager/seller) ──────────────
-- dj_profiles gana la identidad; incluye conflictos con rol de staff (owner).
INSERT INTO identity.users (id, account_type)
SELECT d.user_id, 'staff'
FROM public.dj_profiles d
WHERE d.user_id IS NOT NULL
  AND lower(trim(coalesce(d.role, ''))) IN ('owner', 'admin', 'manager', 'seller')
ON CONFLICT (id) DO NOTHING;

-- ── 2b · ARTIST (en dj_profiles, no-staff) ──────────────────────────────────
-- Incluye a los DJ que también tienen client_profile (los 4 conflictos dj).
INSERT INTO identity.users (id, account_type)
SELECT d.user_id, 'artist'
FROM public.dj_profiles d
WHERE d.user_id IS NOT NULL
  AND lower(trim(coalesce(d.role, ''))) NOT IN ('owner', 'admin', 'manager', 'seller')
ON CONFLICT (id) DO NOTHING;

-- ── 2c · CLIENT (ÚNICAMENTE en client_profiles) ─────────────────────────────
INSERT INTO identity.users (id, account_type)
SELECT c.user_id, 'client'
FROM public.client_profiles c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.dj_profiles d WHERE d.user_id = c.user_id)
ON CONFLICT (id) DO NOTHING;

-- NOTA: los conflictos (en ambas tablas) quedan resueltos por 2a/2b: su
--       identidad la define dj_profiles. La fila en client_profiles NO se borra;
--       queda como su historial de reservas, ahora bajo su identidad canónica.


-- ── 2d · Roles (RBAC) ───────────────────────────────────────────────────────
-- Staff: rol real desde dj_profiles.role
INSERT INTO identity.user_roles (user_id, role)
SELECT u.id, lower(trim(d.role))::identity.app_role
FROM identity.users u
JOIN public.dj_profiles d ON d.user_id = u.id
WHERE u.account_type = 'staff'
  AND lower(trim(coalesce(d.role, ''))) IN ('owner', 'admin', 'manager', 'seller')
ON CONFLICT DO NOTHING;

-- Artist: rol base 'dj' (⚠️ SUPUESTO — refinar performer/producer manualmente si aplica)
INSERT INTO identity.user_roles (user_id, role)
SELECT u.id, 'dj'
FROM identity.users u
WHERE u.account_type = 'artist'
ON CONFLICT DO NOTHING;

-- Client: rol 'client'
INSERT INTO identity.user_roles (user_id, role)
SELECT u.id, 'client'
FROM identity.users u
WHERE u.account_type = 'client'
ON CONFLICT DO NOTHING;


-- ── 2e · RESUMEN POST-BACKFILL (segunda supervisión visual) ─────────────────
SELECT account_type, count(*) AS identidades
FROM identity.users
GROUP BY account_type
ORDER BY account_type;

SELECT count(*) AS conflictos_pendientes
FROM identity.v_legacy_reconciliation
WHERE proposed_account_type LIKE 'CONFLICT%';

-- Coherencia global (debe dar 0 filas):
SELECT ur.user_id, u.account_type, ur.role
FROM identity.user_roles ur
JOIN identity.users u ON u.id = ur.user_id
WHERE NOT identity.role_allowed(u.account_type, ur.role);

-- ════════════════════════════════════════════════════════════════════════════
-- Siguiente: identity_fk_linkage_phase2c.sql  (ese SÍ modifica los perfiles →
-- máxima supervisión; correr solo con conflictos_pendientes = 0).
-- ════════════════════════════════════════════════════════════════════════════
