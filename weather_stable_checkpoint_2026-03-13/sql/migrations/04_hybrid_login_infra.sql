-- web/sql/migrations/04_hybrid_login_infra.sql
-- MDJPRO IDENTITY SHIELD - CONSOLIDATED - MODO MILITAR

-- 1. DJ PROFILES: Add email and ensure unique stage names
CREATE TABLE IF NOT EXISTS public.dj_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

DO $$ BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dj_profiles' AND column_name='email') THEN
        ALTER TABLE public.dj_profiles ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dj_profiles' AND column_name='stage_name') THEN
        ALTER TABLE public.dj_profiles ADD COLUMN stage_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dj_profiles' AND column_name='dj_name') THEN
        ALTER TABLE public.dj_profiles ADD COLUMN dj_name TEXT;
    END IF;
END $$;

-- 2. CLIENT PROFILES: Ensure internal table exists
CREATE TABLE IF NOT EXISTS public.client_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT,
    email TEXT,
    username TEXT
);

-- 3. SYNC IDENTITY: DJMago305 (CEO)
UPDATE public.dj_profiles 
SET email = 'djmago305@gmail.com',
    stage_name = 'DJMago305',
    dj_name = 'DJMago305'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'djmago305@gmail.com')
   OR stage_name ILIKE 'DJMago305'
   OR dj_name ILIKE 'DJMago305';

-- If record doesn't exist but user does, insert it
INSERT INTO public.dj_profiles (user_id, email, stage_name, dj_name, status)
SELECT id, email, 'DJMago305', 'DJMago305', 'ACTIVE'
FROM auth.users 
WHERE email = 'djmago305@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

-- 4. RLS Re-check
ALTER TABLE public.dj_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- Allow public identity resolution (needed for login check)
DROP POLICY IF EXISTS "Allow identity check" ON public.dj_profiles;
CREATE POLICY "Allow identity check" ON public.dj_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow client identity check" ON public.client_profiles;
CREATE POLICY "Allow client identity check" ON public.client_profiles FOR SELECT USING (true);
