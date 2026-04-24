-- Prueba manual: marcar UN DJ como premium y asignar hardware_token.
-- Reemplaza YOUR_USER_UUID por el user_id real (Auth → Users o dj_profiles.user_id).

UPDATE public.dj_profiles
SET
  is_premium = true,
  plan = 'PRO',
  plan_type = 'pro_monthly',
  plan_status = 'active',
  subscription_status = 'active',
  hardware_token = COALESCE(
    hardware_token,
    'MDB-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 12))
  )
WHERE user_id = 'YOUR_USER_UUID'::uuid;

-- Verificar:
-- SELECT user_id, is_premium, plan, plan_type, hardware_token, referral_code FROM dj_profiles WHERE user_id = 'YOUR_USER_UUID'::uuid;
