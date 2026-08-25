-- ============================================================================
-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) — rescate de código ya vigente
-- ============================================================================
-- Estas 3 funciones existen y están ACTIVAS en producción hoy (25-ago-2026),
-- extraídas vía pg_get_functiondef() directo de la base real. No estaban
-- versionadas en ningún archivo de este repo — se aplicaron alguna vez desde
-- el editor SQL del dashboard, sin dejar rastro en git. Este script las deja
-- en el repo como fuente de verdad reproducible (p.ej. para levantarlas en
-- mdjb-ensayo) — NO se ha vuelto a ejecutar en producción, ya están ahí.
--
-- Tabla que consumen: public.signed_contracts (ya existe en prod, no incluida
-- aquí — ver auditoría del 25-ago-2026 para su esquema completo).
--
-- HALLAZGO DE SEGURIDAD (reportado, no corregido en este script):
-- guardar_contrato_firmado tiene EXECUTE otorgado también a 'anon' (rol sin
-- autenticar) — ver GRANTs al final. Es SECURITY DEFINER y no valida que
-- p_artist_profile_id pertenezca a quien llama. La política RLS de INSERT en
-- signed_contracts exige rol 'authenticated', pero una función SECURITY
-- DEFINER corre con los privilegios de su dueño (normalmente con BYPASSRLS),
-- así que esa política podría no ser la barrera real. No se ha confirmado si
-- el dueño de la función tiene BYPASSRLS — queda como pendiente de verificar
-- antes de decidir si hace falta revocar EXECUTE a 'anon'.
-- ============================================================================

-- ── 1. guardar_contrato_firmado ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guardar_contrato_firmado(
    p_artist_profile_id uuid,
    p_contract_type text,
    p_document_version text,
    p_form_payload jsonb,
    p_signature_png_base64 text,
    p_audit_sha256 text,
    p_signer_name text,
    p_signer_email text DEFAULT NULL::text,
    p_signer_phone text DEFAULT NULL::text,
    p_signer_ip text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_contract_id UUID;
BEGIN
    -- Validaciones de integridad
    IF p_signer_name IS NULL OR LENGTH(TRIM(p_signer_name)) = 0 THEN
        RAISE EXCEPTION 'El nombre del firmante es obligatorio.';
    END IF;

    IF p_signature_png_base64 IS NULL OR LENGTH(p_signature_png_base64) < 50 THEN
        RAISE EXCEPTION 'Firma digital no válida o corrupta.';
    END IF;

    IF p_audit_sha256 IS NULL OR LENGTH(p_audit_sha256) != 64 THEN
        RAISE EXCEPTION 'El hash de auditoría SHA-256 no es válido.';
    END IF;

    -- Inserción inmutable
    INSERT INTO public.signed_contracts (
        artist_profile_id,
        contract_type,
        document_version,
        form_payload,
        signature_png_base64,
        audit_sha256,
        signer_name,
        signer_email,
        signer_phone,
        signer_ip,
        signed_at,
        status,
        is_locked,
        created_by
    ) VALUES (
        p_artist_profile_id,
        p_contract_type,
        p_document_version,
        p_form_payload,
        p_signature_png_base64,
        p_audit_sha256,
        p_signer_name,
        p_signer_email,
        p_signer_phone,
        p_signer_ip,
        NOW(),
        'SIGNED',
        TRUE,
        auth.uid()
    )
    RETURNING id INTO v_contract_id;

    RETURN v_contract_id;
END;
$function$;

-- ── 2. obtener_mi_contrato_detalle ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.obtener_mi_contrato_detalle(p_id uuid)
RETURNS TABLE(
    id uuid, contract_type text, document_version text, form_payload jsonb,
    signature_png_base64 text, audit_sha256 text, status text,
    signer_name text, signed_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  select sc.id, sc.contract_type, sc.document_version, sc.form_payload,
         sc.signature_png_base64, sc.audit_sha256, sc.status,
         sc.signer_name, sc.signed_at
  from public.signed_contracts sc
  where sc.id = p_id
    and (
      (auth.uid() is not null and sc.artist_profile_id in (
        select dp.id from public.dj_profiles dp where dp.user_id = auth.uid()
      ))
      or (sc.signer_email is not null and auth.email() is not null
          and lower(sc.signer_email) = lower(auth.email()))
    );
$function$;

-- ── 3. obtener_mis_contratos ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.obtener_mis_contratos()
RETURNS TABLE(
    id uuid, contract_type text, document_version text, status text,
    signer_name text, signed_at timestamp with time zone, created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  select sc.id, sc.contract_type, sc.document_version, sc.status,
         sc.signer_name, sc.signed_at, sc.created_at
  from public.signed_contracts sc
  where
    (auth.uid() is not null and sc.artist_profile_id in (
      select dp.id from public.dj_profiles dp where dp.user_id = auth.uid()
    ))
    or (sc.signer_email is not null and auth.email() is not null
        and lower(sc.signer_email) = lower(auth.email()))
  order by sc.created_at desc;
$function$;

-- ── Grants vigentes en producción (verificado, no re-otorgados por este script) ──
-- guardar_contrato_firmado:      PUBLIC, anon, authenticated, postgres, service_role — EXECUTE
-- obtener_mi_contrato_detalle:   PUBLIC, anon, authenticated, postgres, service_role — EXECUTE
-- obtener_mis_contratos:         PUBLIC, anon, authenticated, postgres, service_role — EXECUTE
--
-- Si se reproduce este esquema en un ambiente nuevo (mdjb-ensayo), replicar
-- igual salvo que se decida cerrar el acceso de 'anon' tras resolver el
-- hallazgo de seguridad anotado arriba:
--   REVOKE EXECUTE ON FUNCTION public.guardar_contrato_firmado FROM anon;
--   REVOKE EXECUTE ON FUNCTION public.obtener_mi_contrato_detalle FROM anon;
--   REVOKE EXECUTE ON FUNCTION public.obtener_mis_contratos FROM anon;
