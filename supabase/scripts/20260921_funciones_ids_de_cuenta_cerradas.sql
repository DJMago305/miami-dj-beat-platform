-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- YA APLICADO el 2026-09-21 (a pedido del PO, "soluciona esa").
-- Vulnerabilidad #4 de la auditoría de funciones SECURITY DEFINER abiertas a anon: generate_mdj_user_id(uuid) y
-- mdjb_ensure_code_core(uuid) aceptaban CUALQUIER uid de CUALQUIER llamante (incluso sin sesión):
--   · devolvían el código de cuenta MDJB-XXXX-XXXX-X de cualquier usuario (saltándose el RLS "self_or_staff" de mdjb_account_ids),
--   · servían de oráculo de existencia de usuarios (user_not_found vs id),
--   · creaban/tocaban esas filas (updated_at).
-- Severidad real: BAJA (el código es un ID público / enlace de referido, no una credencial; no mueve dinero).
--
-- Los únicos llamadores legítimos son SECURITY DEFINER (corren como `postgres`, que conserva el permiso):
--   mdjb_ensure_mine(), mdj_access_snapshot(), mdj_identity_snapshot(p_uid) y los disparadores
--   trg_mdjb_ensure_client / trg_mdjb_ensure_dj. La web solo llama a esos envoltorios (usan auth.uid(); el de identidad
--   rechaza p_uid ≠ auth.uid() salvo service_role). No cambia el código de ninguna función.

revoke execute on function public.generate_mdj_user_id(uuid) from public;
revoke execute on function public.generate_mdj_user_id(uuid) from anon, authenticated;
revoke execute on function public.mdjb_ensure_code_core(uuid) from public;
revoke execute on function public.mdjb_ensure_code_core(uuid) from anon, authenticated;
