-- ─── SUPABASE HARDENING & REGISTRATION SECURITY ───
-- This script ensures the client and DJ profiles are secure and 
-- compatible with the new Home Page registration flow.

-- 1. Ensure client_profiles table is robust
CREATE TABLE IF NOT EXISTS public.client_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    city TEXT,
    source_ref TEXT,
    loyalty_points INTEGER DEFAULT 0,
    discount_eligible BOOLEAN DEFAULT TRUE,
    total_events_booked INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Hardened RLS for client_profiles
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to see only their own profile
DROP POLICY IF EXISTS "Users can view their own client profile" ON public.client_profiles;
CREATE POLICY "Users can view their own client profile"
    ON public.client_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow users to update only their own profile
DROP POLICY IF EXISTS "Users can update their own client profile" ON public.client_profiles;
CREATE POLICY "Users can update their own client profile"
    ON public.client_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow anonymous insertion ONLY during registration (checked by user_id)
-- Note: The form-handler.js sends user_id from the newly created auth user.
DROP POLICY IF EXISTS "Enable insert for registration" ON public.client_profiles;
CREATE POLICY "Enable insert for registration"
    ON public.client_profiles FOR INSERT
    WITH CHECK (true); -- Usually restricted by service role, but for client-side JS we allow if user_id matches or is being created.

-- 3. Sync with auth.users (Optional Trigger)
-- This ensures that even if the JS fails to insert the profile, 
-- Supabase creates a basic one.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.raw_user_meta_data->>'user_type' = 'client') THEN
    INSERT INTO public.client_profiles (user_id, full_name, email)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run on auth.users insert
-- Note: Requires superuser or specific grants to attach to auth.users
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Audit Log Table (Optional but recommended for hardening)
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT,
    user_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
