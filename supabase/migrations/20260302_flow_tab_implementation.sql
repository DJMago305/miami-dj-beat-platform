-- 1. SINCRONIZACIÓN DE dj_profiles
ALTER TABLE public.dj_profiles 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 2. CREACIÓN DE TABLA dj_ledger
CREATE TABLE IF NOT EXISTS public.dj_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dj_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'withdrawal', 'payout')),
    amount_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('available', 'pending', 'held', 'disputed')),
    unlock_at TIMESTAMPTZ,
    event_id TEXT, -- Referencia opcional a un evento/booking
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. SEGURIDAD (RLS)
ALTER TABLE public.dj_ledger ENABLE ROW LEVEL SECURITY;

-- Política: Los DJs solo pueden ver su propio ledger
DROP POLICY IF EXISTS "DJs can view own ledger" ON public.dj_ledger;
CREATE POLICY "DJs can view own ledger" 
ON public.dj_ledger 
FOR SELECT 
USING (auth.uid() = dj_user_id);

-- Política: El sistema (service_role) puede hacer todo
DROP POLICY IF EXISTS "System full access" ON public.dj_ledger;
CREATE POLICY "System full access" 
ON public.dj_ledger 
FOR ALL 
USING (true)
WITH CHECK (true);

-- 4. ÍNDICES PARA RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_ledger_user_status ON public.dj_ledger(dj_user_id, status);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON public.dj_ledger(created_at);

-- Refrescar esquema
NOTIFY pgrst, 'reload schema';
