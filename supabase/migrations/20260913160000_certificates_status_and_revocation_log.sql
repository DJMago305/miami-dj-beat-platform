-- Entorno: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- Gobernanza de revocación: certificates solo tenía dos booleans (revoked,
-- suspended) sin un estado único legible ni ninguna bitácora de quién/por qué
-- se tocó un certificado -- cualquiera con el ADMIN_PASS compartido de
-- admin-update podía revocar sin dejar rastro verificable. Esta migración:
--   1) Agrega `status` como columna de lectura derivada (no reemplaza los
--      booleans -- verify.html, dj-profile.html, admin.html y directory.html
--      siguen leyendo/escribiendo revoked/suspended sin cambios).
--   2) Crea certificate_revocation_log: tabla de solo-escritura (los mismos
--      dos triggers "no se puede editar ni borrar" que ya usa audit_log/M2 y
--      m3_permission_grants) para el expediente de The Board, el motivo
--      formal y la firma del Owner en cada revocación/suspensión/reinstalación.
-- Aislada a propósito de audit_log/fenix_puede() (Autoridad Única, M1-M5):
-- esa cadena constitucional sigue sin aplicarse en producción (ver headers de
-- M1-M5) -- este módulo no depende de que eso se resuelva.

BEGIN;

-- ── 1 · status derivado, sincronizado por trigger ──────────────────────────
ALTER TABLE public.certificates
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.certificates
ADD CONSTRAINT certificates_status_check
CHECK (status IN ('active', 'under_investigation', 'revoked'));

-- Backfill de las filas existentes según su estado actual de revoked/suspended.
UPDATE public.certificates
SET status = CASE
  WHEN revoked THEN 'revoked'
  WHEN suspended THEN 'under_investigation'
  ELSE 'active'
END;

CREATE OR REPLACE FUNCTION public.mdb_sync_certificate_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.revoked THEN
    NEW.status := 'revoked';
  ELSIF NEW.suspended THEN
    NEW.status := 'under_investigation';
  ELSE
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mdb_sync_certificate_status ON public.certificates;
CREATE TRIGGER trg_mdb_sync_certificate_status
  BEFORE INSERT OR UPDATE OF revoked, suspended ON public.certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.mdb_sync_certificate_status();

-- ── 2 · certificate_revocation_log — bitácora inmutable ────────────────────
CREATE TABLE IF NOT EXISTS public.certificate_revocation_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_id           text NOT NULL REFERENCES public.certificates(cert_id) ON DELETE CASCADE,
  action            text NOT NULL CHECK (action IN ('revoke', 'suspend', 'reinstate')),
  previous_status   text,
  new_status        text NOT NULL,
  board_case_number text NOT NULL,
  reason            text NOT NULL,
  owner_user_id     uuid NOT NULL REFERENCES auth.users(id),
  owner_signature   text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificate_revocation_log_cert_id
  ON public.certificate_revocation_log (cert_id);

-- Solo-escritura: ni el propio Owner puede editar o borrar una fila ya
-- escrita -- mismo principio que audit_log (M2) y m3_permission_grants:
-- un registro que se puede alterar no es una bitácora, es una nota.
CREATE OR REPLACE FUNCTION public.mdb_certificate_revocation_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'certificate_revocation_log es de solo escritura: no se permite modificar ni eliminar filas ya escritas';
END;
$$;

DROP TRIGGER IF EXISTS trg_certificate_revocation_log_no_update ON public.certificate_revocation_log;
CREATE TRIGGER trg_certificate_revocation_log_no_update
  BEFORE UPDATE ON public.certificate_revocation_log
  FOR EACH ROW
  EXECUTE FUNCTION public.mdb_certificate_revocation_log_immutable();

DROP TRIGGER IF EXISTS trg_certificate_revocation_log_no_delete ON public.certificate_revocation_log;
CREATE TRIGGER trg_certificate_revocation_log_no_delete
  BEFORE DELETE ON public.certificate_revocation_log
  FOR EACH ROW
  EXECUTE FUNCTION public.mdb_certificate_revocation_log_immutable();

-- RLS: sin políticas para anon/authenticated -- deny-all real. Solo la
-- Edge Function admin-update (service_role, que bypassa RLS) escribe y lee
-- aquí. Si en el futuro se construye una vista para el Owner, se agrega una
-- policy de SELECT explícita entonces -- no se adivina su UID en esta migración.
ALTER TABLE public.certificate_revocation_log ENABLE ROW LEVEL SECURITY;

-- Confirmación de esquema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'certificates' AND column_name = 'status';

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'certificate_revocation_log';

COMMIT;
