-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-17
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- Activa Supabase Realtime en elixis_agenda_eventos para que la campana de
-- Recordatorios (calendario-operacional-inteligente.html) se actualice sola
-- cuando llega un evento nuevo (sync de Google Calendar o escritura de
-- ELIXIS), sin esperar a que el usuario recargue la página. Realtime respeta
-- las mismas políticas RLS ya existentes en la tabla (owner/admin ven todo,
-- un artista solo lo suyo no-confidencial) -- no se abre nada nuevo.
--
-- Mismo mecanismo ya usado por portal_messages (web/client-portal.js:3375,
-- .channel(...).on('postgres_changes', ...)) -- no se inventa un patrón
-- nuevo para esto.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.elixis_agenda_eventos;
