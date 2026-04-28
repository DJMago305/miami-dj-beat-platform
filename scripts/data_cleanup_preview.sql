-- ═══════════════════════════════════════════════════════════════════════════
-- PREVIEW de datos “basura” — SOLO SELECT. Revisa resultados antes de borrar.
-- Los DELETE están comentados: descomenta y ajusta filtros bajo tu responsabilidad.
-- Haz backup / export CSV antes de cualquier borrado en producción.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A) Leads de prueba (ajusta patrones a tu convención) ───────────────────
-- Ejemplo: emails de test, nombre literal "test", fuentes internas
SELECT id, created_at, email, status, source, assigned_dj_id
FROM public.leads
WHERE email ILIKE '%test%'
   OR email ILIKE '%@example.%'
   OR email ILIKE '%fake%'
   OR coalesce(notes, '') ILIKE '%prueba%'
ORDER BY created_at DESC
LIMIT 200;

-- DELETE ejemplo (NO ejecutar a ciegas):
-- DELETE FROM public.leads WHERE id IN (...ids revisados...);

-- ── B) Ledger: montos cero o metadata vacío / de prueba ─────────────────────
SELECT id, dj_user_id, type, amount_cents, status, metadata, created_at
FROM public.dj_ledger
WHERE amount_cents = 0
   OR (metadata IS NOT NULL AND metadata::text ILIKE '%test%')
   OR (metadata IS NOT NULL AND metadata::text ILIKE '%dummy%')
ORDER BY created_at DESC
LIMIT 200;

-- ── C) Ledger income sin split cuando ya operáis con split obligatorio (info)
SELECT id, dj_user_id, amount_cents, type, metadata, created_at
FROM public.dj_ledger
WHERE type = 'income'
  AND (metadata->'split' IS NULL OR metadata->'split' = 'null'::jsonb)
ORDER BY created_at DESC
LIMIT 200;

-- Nota: “metadata incompleta” no siempre es basura — puede ser histórico previo al split.
