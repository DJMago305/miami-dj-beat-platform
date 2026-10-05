-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- ESTADO: EJECUTADO por el PO en PRODUCCIÓN el 2026-10-05 (éxito, sin errores;
-- verificación posterior: el CHECK ya lista VENDOR_PRODUCTION_AGREEMENT).
-- ============================================================
-- Propósito: aceptar el tipo VENDOR_PRODUCTION_AGREEMENT (plantilla nueva
-- "vendor_production" de web/contracts-engine.html, contrato de proveedor
-- adicional de producción) en el CHECK de signed_contracts.contract_type.
--
-- Sin esto, PREVISUALIZAR y ENVIAR el enlace funcionan, pero GUARDAR el
-- contrato ya firmado falla con 23514 (mismo síntoma que ya ocurrió con el
-- W-9 y con las 4 plantillas de 2026-08-24).
--
-- Aditivo puro y a prueba de deriva: en vez de repetir una lista fija de
-- valores (que pudo haber cambiado desde ampliar_tipos_contrato_signed_contracts.sql),
-- LEE los valores que el constraint acepta hoy y les AÑADE el nuevo. Ningún
-- valor existente se quita; ninguna fila se toca.
--
-- PASO 0 (solo lectura, correr ANTES y comparar con el resultado de abajo):
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.signed_contracts'::regclass and contype = 'c'
--     and pg_get_constraintdef(oid) ilike '%contract_type%';
-- ============================================================

do $$
declare
  v_conname text;
  v_def     text;
  v_vals    text[];
  v_new     constant text := 'VENDOR_PRODUCTION_AGREEMENT';
begin
  select con.conname, pg_get_constraintdef(con.oid)
    into v_conname, v_def
  from pg_constraint con
  where con.conrelid = 'public.signed_contracts'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%contract_type%';

  if v_conname is null then
    raise exception 'No se encontró el CHECK de contract_type en signed_contracts — abortado, no se tocó nada';
  end if;

  -- valores hoy aceptados: los literales 'MAYÚSCULAS_Y_GUIONES' del constraint
  select coalesce(array_agg(distinct m[1]), '{}')
    into v_vals
  from regexp_matches(v_def, '''([A-Z0-9_]+)''', 'g') as t(m);

  if coalesce(array_length(v_vals, 1), 0) < 5 then
    raise exception 'El CHECK actual tiene menos de 5 valores (%), inesperado — abortado', v_vals;
  end if;

  if v_new = any (v_vals) then
    raise notice 'VENDOR_PRODUCTION_AGREEMENT ya está aceptado — sin cambios';
    return;
  end if;

  v_vals := v_vals || v_new;

  execute format('alter table public.signed_contracts drop constraint %I', v_conname);
  execute format(
    'alter table public.signed_contracts add constraint %I check (contract_type in (%s))',
    v_conname,
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_vals) as x)
  );

  raise notice 'CHECK ampliado: % valores (añadido %)', array_length(v_vals, 1), v_new;
end $$;

-- PASO FINAL (solo lectura): confirmar que el constraint ya lista el valor nuevo.
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.signed_contracts'::regclass and contype = 'c'
--     and pg_get_constraintdef(oid) ilike '%VENDOR_PRODUCTION_AGREEMENT%';
