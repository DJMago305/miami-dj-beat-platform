-- web/sql/migrations/05_security_alerts_infra.sql
-- SECURITY ALERTS INFRASTRUCTURE - MODO MILITAR

-- 1. Ensure client_profiles table exists before extending
CREATE TABLE IF NOT EXISTS public.client_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Extend DJ Profiles with Security Fields
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dj_profiles' AND column_name='security_preference') THEN
        ALTER TABLE public.dj_profiles ADD COLUMN security_preference TEXT DEFAULT 'email' CHECK (security_preference IN ('email', 'sms', 'both', 'none'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dj_profiles' AND column_name='known_devices') THEN
        ALTER TABLE public.dj_profiles ADD COLUMN known_devices JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dj_profiles' AND column_name='two_factor_enabled') THEN
        ALTER TABLE public.dj_profiles ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Extend Client Profiles with Security Fields
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_profiles' AND column_name='security_preference') THEN
        ALTER TABLE public.client_profiles ADD COLUMN security_preference TEXT DEFAULT 'email' CHECK (security_preference IN ('email', 'sms', 'both', 'none'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_profiles' AND column_name='known_devices') THEN
        ALTER TABLE public.client_profiles ADD COLUMN known_devices JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_profiles' AND column_name='two_factor_enabled') THEN
        ALTER TABLE public.client_profiles ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 3. Security Audit Log: Track Device Access
CREATE TABLE IF NOT EXISTS public.security_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT,
    browser_info TEXT,
    ip_address TEXT,
    status TEXT CHECK (status IN ('approved', 'pending_verification', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS for Safety
ALTER TABLE public.security_access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own access logs" ON public.security_access_logs
FOR SELECT USING (auth.uid() = user_id);
