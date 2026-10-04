-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-10-04
-- Ticket: «el Cash Flow de DJ Solitario no está cableado: lo que se le paga por cada
-- evento debe reflejarse de forma autónoma» (reporte del PO).
-- ============================================================
-- Qué se encontró (probado con un evento de prueba en una transacción que se deshizo):
--   Los triggers de eventos SÍ funcionan solos (agenda, aviso, pago esperado y cuenta
--   por pagar). Lo que fallaba era el CÁLCULO del Cash Flow:
--   1) Un evento del 7-oct asignado el 4-oct aparecía como ingreso del 4-oct: el
--      cálculo agrupaba el pago esperado por la fecha en que se CREÓ la fila, no por la
--      fecha del evento (metadata.fecha), y lo contaba como ganado antes de ocurrir.
--   2) Un pago acordado de $300 aparecía como $270: mdj_flow_ledger_line_commission_cents
--      cobra 10 % por defecto a toda línea de ingreso, pero el pago acordado
--      (dj_agreed_payout_usd) YA es lo que se le paga al DJ; staff_release_event_dj_payout
--      lo libera tal cual, sin comisión.
--   3) Nada recalculaba los totales solos: solo se actualizaban cuando el DJ abría la
--      pestaña Cash Flow (refresh_my_dj_flow_rollups desde flow-handler.js).
-- Qué hace este script (idempotente; no borra ni cambia datos de negocio):
--   A) Separa el cálculo en una función INTERNA (_refresh_dj_flow_rollups_core, sin
--      candado, sin permiso para la API) con 3 correcciones: fecha real del evento, no
--      contar fechas futuras, y sin comisión sobre event_sale_expected/event_sale_release.
--      La función pública refresh_dj_flow_rollups_for_user conserva EXACTAMENTE su
--      candado de siempre («solo el propio DJ o staff») y ahora delega en la interna.
--   B) refresh_all_dj_flow_rollups() (interna) + cron cada 30 minutos.
--   C) Recalcula una vez a todos los DJ.
-- Si el texto de la función cambió y algún reemplazo no aplica exactamente una vez, el
-- script ABORTA sin tocar nada.

DO $do$
DECLARE
  d text;
  n text;
  pat text[];
  rep text[];
  i int;
  veces int;
BEGIN
  IF to_regprocedure('public._refresh_dj_flow_rollups_core(uuid)') IS NOT NULL THEN
    RAISE NOTICE 'ya existe _refresh_dj_flow_rollups_core: no se vuelve a tocar';
    RETURN;
  END IF;

  d := pg_get_functiondef('public.refresh_dj_flow_rollups_for_user(uuid)'::regprocedure);

  pat := ARRAY[
    E'CREATE OR REPLACE FUNCTION public.refresh_dj_flow_rollups_for_user(p_uid uuid)',
    E'    IF p_uid IS DISTINCT FROM auth.uid() AND NOT public.is_staff_management(auth.uid()) THEN\n        RAISE EXCEPTION ''forbidden'';\n    END IF;\n',
    E'public.mdj_flow_tz_bucket_date(l.created_at) AS bucket_date,',
    E'public.mdj_flow_ledger_line_commission_cents(l.amount_cents, l.metadata) AS comm_cents',
    E'AND l.amount_cents > 0\n    ),\n    ledger_daily AS ('
  ];
  rep := ARRAY[
    E'CREATE OR REPLACE FUNCTION public._refresh_dj_flow_rollups_core(p_uid uuid)',
    -- el candado vive SOLO en la función pública
    E'    -- (el candado de acceso vive en refresh_dj_flow_rollups_for_user)\n',
    -- fecha real del evento (metadata.fecha); sin ella, la fecha de creación como antes
    E'COALESCE(NULLIF(l.metadata->>''fecha'', '''')::date, public.mdj_flow_tz_bucket_date(l.created_at)) AS bucket_date,',
    -- el pago acordado ya es neto: sin comisión extra
    E'CASE WHEN COALESCE(l.metadata->>''source'', '''') IN (''event_sale_expected'', ''event_sale_release'')\n                 THEN 0::bigint\n                 ELSE public.mdj_flow_ledger_line_commission_cents(l.amount_cents, l.metadata) END AS comm_cents',
    -- no contar eventos futuros como ingreso
    E'AND l.amount_cents > 0\n          AND COALESCE(NULLIF(l.metadata->>''fecha'', '''')::date, public.mdj_flow_tz_bucket_date(l.created_at)) <= public.mdj_flow_tz_bucket_date(now())\n    ),\n    ledger_daily AS ('
  ];

  n := d;
  FOR i IN 1 .. array_length(pat, 1) LOOP
    veces := (length(n) - length(replace(n, pat[i], ''))) / length(pat[i]);
    IF veces <> 1 THEN
      RAISE EXCEPTION 'Parche %: el texto esperado aparece % veces (debe ser 1). La función cambió; no se toca nada.', i, veces;
    END IF;
    n := replace(n, pat[i], rep[i]);
  END LOOP;

  EXECUTE n;   -- crea la función interna
  REVOKE ALL ON FUNCTION public._refresh_dj_flow_rollups_core(uuid) FROM PUBLIC, anon, authenticated;

  -- La pública conserva su candado de siempre y delega.
  EXECUTE $f$
    CREATE OR REPLACE FUNCTION public.refresh_dj_flow_rollups_for_user(p_uid uuid)
     RETURNS void
     LANGUAGE plpgsql
     SECURITY DEFINER
     SET search_path TO 'public'
    AS $body$
    BEGIN
        IF p_uid IS NULL THEN
            RETURN;
        END IF;

        IF p_uid IS DISTINCT FROM auth.uid() AND NOT public.is_staff_management(auth.uid()) THEN
            RAISE EXCEPTION 'forbidden';
        END IF;

        PERFORM public._refresh_dj_flow_rollups_core(p_uid);
    END;
    $body$
  $f$;

  RAISE NOTICE 'Cash Flow: función interna creada y pública delegando (candado intacto)';
END
$do$;

-- B) Recalculo automático para todos los DJ (solo interno: no se abre a la API)
CREATE OR REPLACE FUNCTION public.refresh_all_dj_flow_rollups()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT user_id FROM public.dj_profiles
    WHERE user_id IS NOT NULL AND lower(coalesce(role, '')) = 'dj'
  LOOP
    BEGIN
      PERFORM public._refresh_dj_flow_rollups_core(r.user_id);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'refresh_all_dj_flow_rollups: % -> %', r.user_id, SQLERRM;
    END;
  END LOOP;
  RETURN n;
END
$$;
REVOKE ALL ON FUNCTION public.refresh_all_dj_flow_rollups() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'dj_flow_rollups_refresh',
  '*/30 * * * *',
  $c$select public.refresh_all_dj_flow_rollups()$c$
);

-- C) Primer recalculo ahora mismo
SELECT public.refresh_all_dj_flow_rollups() AS djs_recalculados;
