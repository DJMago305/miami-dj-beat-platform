-- Prueba VIP rápida: PREMIUM + código de referido BOSS305 + token de app.
-- 1) Copia tu user_id desde Supabase → Authentication → Users (o: SELECT user_id FROM dj_profiles WHERE dj_name ILIKE '%tu nombre%';)
-- 2) Sustituye PASTE_YOUR_USER_UUID_ABAJO en ambos sitios.
-- 3) Si referral_code 'BOSS305' ya existe en otro perfil, cambia el texto (ej. BOSS305A).

UPDATE public.dj_profiles
SET
  is_premium = true,
  plan = 'PRO',
  plan_type = 'pro_monthly',
  plan_status = 'active',
  subscription_status = 'active',
  referral_code = 'BOSS305',
  hardware_token = COALESCE(hardware_token, 'MDB-ACTIV-MANUAL-BOSS305')
WHERE user_id = 'PASTE_YOUR_USER_UUID_ABAJO'::uuid;

-- Verificación:
-- SELECT user_id, is_premium, referral_code, hardware_token FROM public.dj_profiles WHERE user_id = 'PASTE_YOUR_USER_UUID_ABAJO'::uuid;
