-- ============================================================
-- ENTORNO: DISEÑO — NO EJECUTADO TODAVÍA (para revisión del PO)
-- Fecha: 2026-08-26
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- Fase: "Contactos Maestros" — backfill de leads históricos
-- ============================================================
--
-- ANÁLISIS DE ESTADO (verificado en vivo contra producción, 7 filas):
--   · Nombre del cliente real: `contact_person` (NO `name` — 100% vacía).
--   · email: 7/7 filas la tienen. phone: solo 2/7, ambas ya en formato
--     limpio de 10 dígitos (find_or_create_master_client ya normaliza a
--     +1XXXXXXXXXX, no hace falta limpieza extra aquí).
--   · assigned_dj_id: solo 2/7 filas lo tienen, y ambas SÍ apuntan a un
--     dj_profiles.id real (verificado con join, no hay huérfanos).
--
-- DECISIONES DE DISEÑO (pendientes de tu confirmación):
--   1) find_or_create_master_client() exige un dj_id (dj_client_affiliations
--      .dj_id es NOT NULL) — un lead SIN assigned_dj_id no tiene con quién
--      afiliarse. Este script LOS OMITE (5 de 7 casos hoy) en vez de
--      inventar una afiliación falsa. Quedan disponibles para capturarse
--      normalmente el día que si se les asigne un DJ real.
--   2) NO se infiere birthday/wedding_anniversary desde event_date aunque
--      event_type='Wedding' — quien reserva no siempre es quien se casa
--      (wedding planner, padre pagando la boda de su hija). Se deja NULL.
--
-- SEGURO DE CORRER MÁS DE UNA VEZ: find_or_create_master_client() ya hace
-- match por teléfono/email antes de insertar, y el ON CONFLICT en
-- dj_client_affiliations evita duplicar la afiliación.
-- ============================================================

-- ── PASO 0 (opcional, recomendado) — vista previa de solo lectura ──
-- Corre esto primero para ver EXACTAMENTE qué se va a procesar y qué se
-- va a omitir, antes de tocar nada:
--
-- select id, contact_person, email, phone, assigned_dj_id,
--        (assigned_dj_id is null) as se_omite_sin_dj
-- from public.leads
-- order by se_omite_sin_dj, created_at;

do $$
declare
  r record;
  v_master_id uuid;
  v_processed int := 0;
  v_skipped_no_dj int := 0;
  v_skipped_no_identity int := 0;
  v_errors int := 0;
begin
  for r in
    select id, contact_person, email, phone, assigned_dj_id
    from public.leads
    where (email is not null or phone is not null)
  loop
    if r.assigned_dj_id is null then
      v_skipped_no_dj := v_skipped_no_dj + 1;
      raise notice 'Lead % omitido: sin assigned_dj_id (no hay con quién afiliar)', r.id;
      continue;
    end if;

    begin
      v_master_id := public.find_or_create_master_client(
        p_dj_id := r.assigned_dj_id,
        p_phone := r.phone,
        p_email := r.email,
        p_name := r.contact_person
      );
      v_processed := v_processed + 1;
    exception when others then
      -- Un lead con datos raros no debe tumbar el backfill completo — se
      -- reporta y se sigue con el resto.
      v_errors := v_errors + 1;
      raise warning 'Lead % falló: %', r.id, sqlerrm;
    end;
  end loop;

  raise notice '── Backfill leads -> master_clients ──';
  raise notice 'Procesados: %  |  Omitidos (sin DJ): %  |  Errores: %',
    v_processed, v_skipped_no_dj, v_errors;
end $$;

-- ── PASO DE VERIFICACIÓN (correr después) ──
-- select count(*) from public.master_clients;
-- select mc.*, array_agg(dca.dj_id) as djs
--   from public.master_clients mc
--   join public.dj_client_affiliations dca on dca.master_client_id = mc.id
--   group by mc.id;
