-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) — correr en el SQL Editor
-- (el clasificador de esta sesión bloquea aplicar migraciones vía MCP; el PO
-- corre el SQL directamente, mismo patrón que el resto de esta sesión).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Motor de Comisiones y Ownership -- dashboard de comisiones (DJ + vendedor).
--
-- Hueco real encontrado al investigar: `referral_sale_commissions` solo tiene
-- lectura para staff (`can_read_financial`) y para `service_role`. Un DJ
-- normal (role='dj', no es staff) hoy NO PUEDE leer ni sus propias filas de
-- comisión de referido -- ni con una consulta directa ni con ninguna RPC
-- existente. Este script agrega SOLO lo que falta: una política adicional
-- (las políticas de RLS se combinan con OR) para que un DJ vea las filas
-- donde él es el `owner_dj_id` -- nada más. No se toca la política de staff
-- ya existente, no se cambia ningún cálculo.
--
-- El lado del vendedor NO necesita cambio de RLS: un `seller` ya es staff,
-- ya pasa `can_read_financial` y ya puede leer la tabla completa hoy -- lo
-- que falta ahí es una pantalla que filtre por su propio `vendedor_id`, no
-- un permiso nuevo.

create policy referral_sale_commissions_dj_owner_read on public.referral_sale_commissions
  for select to authenticated
  using (
    owner_dj_id in (select id from public.dj_profiles where user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación sugerida (solo lectura, correr después de aplicar):
--   -- confirma que la política nueva existe junto a las 2 que ya había:
--   select polname from pg_policy where polrelid = 'public.referral_sale_commissions'::regclass;
-- ═══════════════════════════════════════════════════════════════════════════
