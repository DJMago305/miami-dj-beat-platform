-- ══════════════════════════════════════════════════════
-- 07_CASH_FLOW_INFRA.sql
-- ══════════════════════════════════════════════════════

-- 1. Asegurar tabla de notificaciones para el Dashboard
-- Esto permite al DJ recibir alertas sobre pagos y estados de cuenta.
CREATE TABLE IF NOT EXISTS dj_notifications (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT now(),
    dj_id       UUID REFERENCES auth.users(id),
    title       TEXT NOT NULL,
    message     TEXT,
    type        TEXT DEFAULT 'info', -- info, success, warning, booking
    read        BOOLEAN DEFAULT false,
    link        TEXT
);

ALTER TABLE dj_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DJs can see own notifications" ON dj_notifications;
CREATE POLICY "DJs can see own notifications" ON dj_notifications
    FOR SELECT TO authenticated
    USING (dj_id = auth.uid());

-- 2. Blindaje Contable (dj_ledger)
-- Aseguramos que solo el DJ dueño pueda ver su libro de transacciones.
ALTER TABLE dj_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DJs can see own ledger" ON dj_ledger;
CREATE POLICY "DJs can see own ledger" ON dj_ledger
    FOR SELECT TO authenticated
    USING (dj_id = auth.uid());

-- 3. Registro inicial de bienvenida (Opcional - Silenciado)
-- INSERT INTO dj_notifications (dj_id, title, message, type)
-- SELECT id, 'Caja Pro Activada', 'Tu nuevo centro de mando financiero ya está configurado.', 'success'
-- FROM auth.users WHERE email = 'djmago305@gmail.com';
