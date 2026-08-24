-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- ============================================================
-- Propósito: ampliar el CHECK constraint de signed_contracts.contract_type
-- para aceptar los 4 nuevos tipos de contrato especializado creados en
-- contracts-engine.html (arquitectura de plantillas por figura del
-- entretenimiento). NO es un ALTER TABLE de columnas ni estructura — solo
-- amplía la lista de valores permitidos en el constraint ya existente.
-- Aditivo puro: los 5 valores actuales (W9, DJ_AGREEMENT, VENUE_AGREEMENT,
-- CORPORATE_AGREEMENT, STAFF_AGREEMENT) siguen aceptados sin cambios, y
-- ningún registro existente se toca.
--
-- Sin esta migración, cualquier intento de GUARDAR (no de previsualizar)
-- un contrato de Banda/Orquesta, Solista, Show/Hora Loca o Cliente
-- Particular fallará con error 23514 (constraint violation) — el mismo
-- síntoma que ya se vio y resolvió una vez con el W-9.
-- ============================================================

do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'signed_contracts' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%contract_type%';

  if v_conname is not null then
    execute format('alter table public.signed_contracts drop constraint %I', v_conname);
  end if;

  alter table public.signed_contracts
    add constraint signed_contracts_contract_type_check
    check (contract_type in (
      'W9', 'DJ_AGREEMENT', 'VENUE_AGREEMENT', 'CORPORATE_AGREEMENT', 'STAFF_AGREEMENT',
      'LIVE_BAND_AGREEMENT', 'SOLO_ARTIST_AGREEMENT', 'SUBCONTRACTOR_SHOW_AGREEMENT', 'PRIVATE_EVENT_AGREEMENT'
    ));
end $$;
