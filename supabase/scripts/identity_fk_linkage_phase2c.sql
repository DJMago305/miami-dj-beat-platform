-- ════════════════════════════════════════════════════════════════════════════
-- FASE 2c · Enlace FK: perfiles → identidad canónica   (MÁXIMA SUPERVISIÓN)
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠️ ESTE ES EL ÚNICO SCRIPT QUE MODIFICA public.dj_profiles / client_profiles.
--    NADA a producción sin tu supervisión visual previa.
--    Ejecución MANUAL. Vive en scripts/ para que NO se auto-aplique.
--
-- Precondiciones (verificar en 2e del backfill):
--   • conflictos_pendientes = 0
--   • coherencia global = 0 filas
--   • toda fila de dj_profiles/client_profiles con user_id NO NULO ya tiene
--     su identidad en identity.users.
--
-- Estrategia de bajo bloqueo:
--   1. ADD CONSTRAINT ... NOT VALID   → no escanea la tabla, no bloquea escrituras
--      largas; empieza a aplicar a filas nuevas de inmediato.
--   2. VALIDATE CONSTRAINT (paso 2) → valida el histórico con lock suave.
--   Se separan para que puedas supervisar entre uno y otro.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Chequeo previo (debe dar 0 en ambas; si no, DETENERSE) ──────────────────
-- dj_profiles huérfanos respecto a la canónica:
SELECT count(*) AS dj_huerfanos
FROM public.dj_profiles d
WHERE d.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM identity.users u WHERE u.id = d.user_id);

-- client_profiles huérfanos respecto a la canónica:
SELECT count(*) AS client_huerfanos
FROM public.client_profiles c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM identity.users u WHERE u.id = c.user_id);

-- 🔴 Si cualquiera de los dos > 0: NO CONTINUAR. Volver al backfill / resolver conflictos.


-- ── Paso 1 · Añadir FK como NOT VALID (no bloqueante) ───────────────────────
-- (Descomentar para ejecutar, tras aprobar los chequeos de arriba.)
-- ALTER TABLE public.dj_profiles
--   ADD CONSTRAINT fk_dj_identity
--   FOREIGN KEY (user_id) REFERENCES identity.users(id) NOT VALID;
--
-- ALTER TABLE public.client_profiles
--   ADD CONSTRAINT fk_client_identity
--   FOREIGN KEY (user_id) REFERENCES identity.users(id) NOT VALID;


-- ── Paso 2 · Validar el histórico (lock suave; tras supervisión) ────────────
-- ALTER TABLE public.dj_profiles      VALIDATE CONSTRAINT fk_dj_identity;
-- ALTER TABLE public.client_profiles  VALIDATE CONSTRAINT fk_client_identity;


-- ── ROLLBACK de este paso (si hiciera falta) ────────────────────────────────
-- ALTER TABLE public.dj_profiles      DROP CONSTRAINT IF EXISTS fk_dj_identity;
-- ALTER TABLE public.client_profiles  DROP CONSTRAINT IF EXISTS fk_client_identity;

-- ════════════════════════════════════════════════════════════════════════════
-- Con este enlace, el solapamiento deja de ser posible por construcción:
-- todo perfil apunta a UNA identidad canónica. Fin de la Fase 2.
-- ════════════════════════════════════════════════════════════════════════════
