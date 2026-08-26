-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-08-26
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- CONTEXTO
-- --------
-- Al revisar por qué la Bóveda del Artista (account-settings.html ->
-- Documentos Legales -> Descargar) no mostraba el cargo del firmante
-- ("Gerardo A Valle, Owner") junto a la firma, se descubrió que el
-- problema es más de raíz de lo que parecía: signed_contracts NUNCA tuvo
-- una columna signer_role, y guardar_contrato_firmado() nunca la
-- recibía ni la guardaba — el campo solo vivía en memoria del navegador
-- del staff durante esa sesión (por eso SÍ se veía del lado Staff, que
-- nunca recarga desde Supabase para su propia vista en curso).
--
-- Esta migración:
--   1) Agrega la columna signer_role (nullable — no rompe filas viejas,
--      pero significa que los contratos firmados ANTES de esta
--      migración seguirán mostrando el cargo en blanco para siempre,
--      porque ese dato simplemente nunca se capturó).
--   2) Actualiza guardar_contrato_firmado() para aceptar y guardar
--      p_signer_role.
--   3) Actualiza obtener_mi_contrato_detalle() para devolver
--      signer_role, y además artist_profile_id + el nombre del artista
--      ya resuelto (join a dj_profiles) para que el pie "Documento
--      vinculado al expediente de [Nombre]" deje de mostrar null en la
--      vista del propio artista.
--
-- No se toca signed_contracts en su calidad de tabla inmutable (sigue
-- sin política de UPDATE); esto es aditivo en columna + funciones.
-- ============================================================

-- 1) Columna nueva (aditiva, nullable)
alter table public.signed_contracts
  add column if not exists signer_role text;

-- 2) guardar_contrato_firmado — agrega p_signer_role al final (mismo
--    patrón de DROP+CREATE que la migración de user_agent, porque
--    Postgres no permite cambiar el número de parámetros con solo
--    CREATE OR REPLACE)
drop function if exists public.guardar_contrato_firmado(
  uuid, text, text, jsonb, text, text, text, text, text, text, text
);

create or replace function public.guardar_contrato_firmado(
  p_artist_profile_id uuid,
  p_contract_type text,
  p_document_version text,
  p_form_payload jsonb,
  p_signature_png_base64 text,
  p_audit_sha256 text,
  p_signer_name text,
  p_signer_email text default null::text,
  p_signer_phone text default null::text,
  p_signer_ip text default null::text,
  p_user_agent text default null::text,
  p_signer_role text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
    v_contract_id uuid;
begin
    if p_signer_name is null or length(trim(p_signer_name)) = 0 then
        raise exception 'El nombre del firmante es obligatorio.';
    end if;

    if p_signature_png_base64 is null or length(p_signature_png_base64) < 50 then
        raise exception 'Firma digital no válida o corrupta.';
    end if;

    if p_audit_sha256 is null or length(p_audit_sha256) != 64 then
        raise exception 'El hash de auditoría SHA-256 no es válido.';
    end if;

    insert into public.signed_contracts (
        artist_profile_id, contract_type, document_version, form_payload,
        signature_png_base64, audit_sha256, signer_name, signer_email,
        signer_phone, signer_ip, user_agent, signer_role, signed_at,
        status, is_locked, created_by
    ) values (
        p_artist_profile_id, p_contract_type, p_document_version, p_form_payload,
        p_signature_png_base64, p_audit_sha256, p_signer_name, p_signer_email,
        p_signer_phone, p_signer_ip, p_user_agent, p_signer_role, now(),
        'SIGNED', true, auth.uid()
    )
    returning id into v_contract_id;

    return v_contract_id;
end;
$function$;

grant execute on function public.guardar_contrato_firmado(
  uuid, text, text, jsonb, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- 3) obtener_mi_contrato_detalle — agrega signer_role + resuelve el
--    nombre del artista vinculado (join a dj_profiles, solo lectura)
drop function if exists public.obtener_mi_contrato_detalle(uuid);

create or replace function public.obtener_mi_contrato_detalle(p_id uuid)
returns table (
  id uuid, contract_type text, document_version text, form_payload jsonb,
  signature_png_base64 text, audit_sha256 text, status text,
  signer_name text, signer_role text, signed_at timestamptz,
  artist_profile_id uuid, linked_profile_name text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select sc.id, sc.contract_type, sc.document_version, sc.form_payload,
         sc.signature_png_base64, sc.audit_sha256, sc.status,
         sc.signer_name, sc.signer_role, sc.signed_at,
         sc.artist_profile_id,
         coalesce(dp.dj_name, dp.stage_name, dp.full_name) as linked_profile_name
  from public.signed_contracts sc
  left join public.dj_profiles dp on dp.id = sc.artist_profile_id
  where sc.id = p_id
    and (
      (auth.uid() is not null and sc.artist_profile_id in (
        select dp2.id from public.dj_profiles dp2 where dp2.user_id = auth.uid()
      ))
      or (sc.signer_email is not null and auth.email() is not null
          and lower(sc.signer_email) = lower(auth.email()))
    );
$function$;

grant execute on function public.obtener_mi_contrato_detalle(uuid) to anon, authenticated;
