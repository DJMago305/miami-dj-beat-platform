-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-08-26
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- CONTEXTO
-- --------
-- Refuerzo del expediente de auditoría de firma electrónica de
-- signed_contracts. Ya existía signer_ip (agregado hoy mismo, ver commit
-- de contracts-engine.html — antes se guardaba pero siempre en NULL, ya
-- se corrigió para capturarlo de verdad). Este segundo refuerzo agrega el
-- user-agent del navegador con el que se firmó (qué dispositivo/navegador
-- se usó) — junto con el SHA-256, el Transaction ID y ahora la IP, deja
-- un rastro de atribución mucho más sólido si algún día se disputa quién
-- firmó un contrato.
--
-- signed_contracts es la tabla legal INMUTABLE (tiene la política "Bloqueo
-- total: contratos firmados son inmutables", UPDATE ... USING (false)).
-- Esta migración solo AGREGA una columna nueva (nullable, no rompe filas
-- existentes) y actualiza la función de inserción — no toca esa política
-- de inmutabilidad ni ninguna fila ya firmada.
--
-- Nota técnica: no se puede usar CREATE OR REPLACE FUNCTION para agregar
-- un parámetro nuevo sin cambiar la firma (Postgres identifica una función
-- por nombre + lista de tipos de parámetros). Por eso aquí se hace DROP +
-- CREATE de guardar_contrato_firmado, para terminar con UNA sola función
-- de 11 parámetros — no dos versiones ambiguas conviviendo. El nuevo
-- parámetro va al final con DEFAULT NULL, así cualquier llamada vieja que
-- no lo mande sigue funcionando igual.
--
-- ============================================================

-- 1) Columna nueva (aditiva, nullable — no requiere backfill)
alter table public.signed_contracts
  add column if not exists user_agent text;

-- 2) Recrear guardar_contrato_firmado con el parámetro nuevo al final
drop function if exists public.guardar_contrato_firmado(
  uuid, text, text, jsonb, text, text, text, text, text, text
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
  p_user_agent text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
    v_contract_id uuid;
begin
    -- Validaciones de integridad (idénticas a la versión anterior)
    if p_signer_name is null or length(trim(p_signer_name)) = 0 then
        raise exception 'El nombre del firmante es obligatorio.';
    end if;

    if p_signature_png_base64 is null or length(p_signature_png_base64) < 50 then
        raise exception 'Firma digital no válida o corrupta.';
    end if;

    if p_audit_sha256 is null or length(p_audit_sha256) != 64 then
        raise exception 'El hash de auditoría SHA-256 no es válido.';
    end if;

    -- Inserción inmutable
    insert into public.signed_contracts (
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
        user_agent,
        signed_at,
        status,
        is_locked,
        created_by
    ) values (
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
        p_user_agent,
        now(),
        'SIGNED',
        true,
        auth.uid()
    )
    returning id into v_contract_id;

    return v_contract_id;
end;
$function$;

grant execute on function public.guardar_contrato_firmado(
  uuid, text, text, jsonb, text, text, text, text, text, text, text
) to anon, authenticated;
