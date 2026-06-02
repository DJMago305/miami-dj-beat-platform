-- Diagnóstico rápido: chat → email (SQL Editor)
-- 1) ¿Existe el trigger?
SELECT tgname, tgenabled
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'portal_messages' AND NOT t.tgisinternal;

-- 2) Últimos mensajes (¿se guardan?)
SELECT id, lead_id, sender_role, left(body, 40) AS body_preview, created_at
FROM public.portal_messages
ORDER BY created_at DESC
LIMIT 5;

-- 3) pg_net habilitado
SELECT extname FROM pg_extension WHERE extname = 'pg_net';
