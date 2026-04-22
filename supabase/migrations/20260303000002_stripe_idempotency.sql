-- Migración: Crear tabla de control de idempotencia para Stripe Webhooks
CREATE TABLE IF NOT EXISTS processed_webhooks (
    event_id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para optimizar búsquedas frecuentes por event_id
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_id ON processed_webhooks(event_id);

-- Comentario para auditoría
COMMENT ON TABLE processed_webhooks IS 'Rastrea los IDs de eventos de Stripe ya procesados para evitar re-ejecuciones (Idempotencia).';
