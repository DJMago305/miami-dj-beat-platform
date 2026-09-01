-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr). Ticket "NUEVO EPIC: INTEGRACIÓN
-- DE CALENDARIOS EXTERNOS EN TIEMPO REAL (APPLE/GOOGLE)" (2026-09-01) --
-- FASE 1 (infraestructura de base de datos + UI). El flujo OAuth real y el
-- despacho/recepción de webhooks quedan para una fase aparte, explícitamente
-- diferida por el propio ticket -- esta migración NO crea ninguna Edge
-- Function ni escribe tokens reales todavía.
--
-- NOTA DE SEGURIDAD (decisión deliberada, no un olvido): el ticket ofrece dos
-- caminos -- "encriptado si es posible o RLS estricto". pgsodium/Vault no
-- está instalado en este proyecto (solo pgcrypto), y cifrar aquí sin la
-- Edge Function real que va a leer/escribir estos tokens implicaría inventar
-- un esquema de manejo de llaves a ciegas, antes de saber cómo la fase 2 real
-- necesita usarlos. Se implementa el RLS estricto (dueño = auth.uid()) que el
-- propio ticket ofrece como alternativa. Cifrado de columnas queda anotado
-- como decisión pendiente de la fase 2 (donde sí existirá el flujo real que
-- determina cómo debe manejarse la llave).

CREATE TABLE IF NOT EXISTS public.user_calendar_integrations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider        text        NOT NULL CHECK (provider IN ('apple', 'google')),
  access_token    text,
  refresh_token   text,
  sync_token      text,
  status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_calendar_integrations_user_provider_unique UNIQUE (user_id, provider)
);

COMMENT ON TABLE public.user_calendar_integrations IS
  'Fase 1 (infraestructura): autorizaciones OAuth de calendario externo por DJ. Sin Edge Function de OAuth/webhooks todavía -- tabla vacía hasta la fase 2.';
COMMENT ON COLUMN public.user_calendar_integrations.access_token IS
  'Sin cifrar en esta fase (decisión deliberada, ver cabecera de la migración). Revisar antes de que la fase 2 escriba tokens reales.';

CREATE INDEX IF NOT EXISTS idx_user_calendar_integrations_user ON public.user_calendar_integrations (user_id);

ALTER TABLE public.user_calendar_integrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_calendar_integrations FROM PUBLIC;
REVOKE ALL ON TABLE public.user_calendar_integrations FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_calendar_integrations TO authenticated;
GRANT ALL ON TABLE public.user_calendar_integrations TO service_role;

-- Estricto: SOLO el dueño (user_id = auth.uid()), sin excepción de
-- owner/admin -- son credenciales personales del artista, no un dato
-- operativo del negocio.
DROP POLICY IF EXISTS calendar_integrations_select_own ON public.user_calendar_integrations;
CREATE POLICY calendar_integrations_select_own
  ON public.user_calendar_integrations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS calendar_integrations_insert_own ON public.user_calendar_integrations;
CREATE POLICY calendar_integrations_insert_own
  ON public.user_calendar_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS calendar_integrations_update_own ON public.user_calendar_integrations;
CREATE POLICY calendar_integrations_update_own
  ON public.user_calendar_integrations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY calendar_integrations_select_own ON public.user_calendar_integrations IS
  'Estricto: un DJ solo ve sus propias integraciones de calendario, sin excepción de staff/owner.';

-- Mapeo de eventos externos (fase 1: solo la columna, sin logica de sync
-- todavia). Nullable -- ningun evento existente hoy tiene un evento externo
-- correspondiente.
ALTER TABLE public.elixis_agenda_eventos
  ADD COLUMN IF NOT EXISTS external_event_id text;

COMMENT ON COLUMN public.elixis_agenda_eventos.external_event_id IS
  'ID del evento correspondiente en Apple/Google Calendar, para procesar updates/deletes de sincronización externa. NULL hasta que exista la fase 2 (OAuth + webhooks).';

NOTIFY pgrst, 'reload schema';
