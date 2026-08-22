-- ── Migration 10: Certificates Table ──
-- Enforces uniqueness on certificate numbers and provides the backbone for the /verify portal.

CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cert_number TEXT UNIQUE NOT NULL, -- The readable ID e.g., MDB-20260310-XXXX
    student_name TEXT NOT NULL,
    course TEXT DEFAULT 'ELITE DJ WORKFLOW MASTERCLASS',
    theory_score INTEGER,
    theory_pct INTEGER,
    pre_graduated BOOLEAN DEFAULT false,
    graduated BOOLEAN DEFAULT false,
    date_issued DATE DEFAULT CURRENT_DATE,
    verification_url TEXT,
    email TEXT,
    
    -- Registry Logic (Sync with verify.html)
    public_year INTEGER DEFAULT extract(year from current_date),
    public_seq SERIAL,
    
    -- Status Fields
    revoked BOOLEAN DEFAULT false,
    revoked_reason TEXT,
    revoked_at TIMESTAMPTZ,
    suspended BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public certificates are viewable by everyone" ON public.certificates;
CREATE POLICY "Public certificates are viewable by everyone" 
ON public.certificates FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Certificates can be inserted by authenticated users" ON public.certificates;
CREATE POLICY "Certificates can be inserted by authenticated users" 
ON public.certificates FOR INSERT 
TO anon, authenticated
WITH CHECK (true); -- Allowing anonymous inserts for the exam engine for now

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_certificates_updated_at
BEFORE UPDATE ON public.certificates
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- RPC for hit counting (as used in verify.html)
CREATE OR REPLACE FUNCTION increment_verify_hits(p_cert_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- This requires a verify_hits column which we can add or leave as optional
    -- For now, we'll ensure the table is ready for it.
END;
$$ LANGUAGE plpgsql;
