-- Migration: Add App Version and MDJPRO Settings
-- Reason: Centralize software version management and avoid HTML hardcoding errors
-- Impact: Allows dynamic updates of V.2.00 across the entire platform

-- Ensure platform_settings exists (baseline)
CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert/Update App Version
INSERT INTO platform_settings (key, value, description)
VALUES 
    ('mdjpro_app_version', 'V.2.00', 'Versión actual pública del instalador MDJPRO'),
    ('mdjpro_download_url_mac', './downloads/MDJPRO-V2.00.dmg', 'Path oficial de descarga para macOS')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();

COMMENT ON TABLE platform_settings IS 'Configuraciones globales de la plataforma Miami DJ Beat';
