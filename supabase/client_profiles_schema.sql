-- ─── CLIENT PROFILES SCHEMA ───────────────────────────────────────────
-- Extends the auth.users for client-specific metadata and loyalty.

CREATE TABLE IF NOT EXISTS client_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    city TEXT,
    source_ref TEXT, -- Stores Referral Code or 'QR' origin
    loyalty_points INTEGER DEFAULT 0,
    discount_eligible BOOLEAN DEFAULT TRUE,
    total_events_booked INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own client profile"
    ON client_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own client profile"
    ON client_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_profiles_updated_at
    BEFORE UPDATE ON client_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
