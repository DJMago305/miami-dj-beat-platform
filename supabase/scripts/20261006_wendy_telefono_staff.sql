-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - Telefono de Wendy Elizabeth Ayala (staff · vendedor)
-- Dato del PO (2026-10-05): 3054235812. Solo escribe dj_profiles.phone de UNA fila (la cuenta wendy.miamidjbeat@gmail.com).
-- Disparadores de dj_profiles revisados: el guardia de rol, el de usuario y el de plan/rol/premium NO reaccionan a la columna phone.
-- Idempotente: si ya tiene telefono, no cambia nada.
update public.dj_profiles
   set phone = '(305) 423-5812'
 where user_id = 'c07a065a-e096-4a39-ab68-44a8f59d8901'
   and role = 'seller'
   and (phone is null or btrim(phone) = '');

-- Comprobacion: debe dar  1 fila con el telefono
select user_id, email, role, phone
  from public.dj_profiles
 where user_id = 'c07a065a-e096-4a39-ab68-44a8f59d8901';
