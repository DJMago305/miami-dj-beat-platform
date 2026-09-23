-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Cash Flow no contaba los turnos de residencia (ej. DJYuyo cada viernes en
-- Sundowner Key Largo) -- refresh_dj_flow_rollups_for_user() solo leía
-- dj_ledger (eventos sueltos) y soundfortips_fan_requests (propinas). Ningún
-- proceso convertía un turno de residencia ya cumplido en ingreso. Reportado
-- por el PO 2026-09-22: "no sale lo que ha ganado en los días que ha tenido
-- cobertura".
--
-- Fix: la función ahora EXPANDE residency_schedule + residency_schedule_exceptions
-- (misma lógica de alternancia ya verificada en loadResidencies(),
-- calendario-operacional-inteligente.html) para todas las fechas pasadas
-- (hasta hoy) donde el DJ efectivo de ese día sea p_uid, y suma dj_pay_usd
-- como ingreso neto -- SIN comisión adicional (dj_pay_usd ya es "tu pago",
-- el neto real después de la comisión de la empresa; ver comentarios de
-- loadResidencies(): "El ARTISTA NUNCA pide venue_pay_usd... Solo su propio
-- dj_pay_usd").
--
-- Se recalcula completo en cada refresh (mismo patrón ya existente:
-- DELETE + INSERT), así que no hace falta ninguna bandera de "ya cobrado".

alter table public.dj_flow_daily
  add column if not exists residency_gross_cents bigint not null default 0 check (residency_gross_cents >= 0);

DROP FUNCTION IF EXISTS public.refresh_dj_flow_rollups_for_user(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.refresh_dj_flow_rollups_for_user(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_uid IS NULL THEN
        RETURN;
    END IF;

    -- Solo el propio DJ o gestión (auditoría operativa).
    IF p_uid IS DISTINCT FROM auth.uid() AND NOT public.is_staff_management(auth.uid()) THEN
        RAISE EXCEPTION 'forbidden';
    END IF;

    DELETE FROM public.dj_flow_daily WHERE dj_user_id = p_uid;

    INSERT INTO public.dj_flow_daily (
        dj_user_id,
        bucket_date,
        gross_cents,
        commission_cents,
        net_cents,
        ledger_gross_cents,
        sft_gross_cents,
        residency_gross_cents,
        tx_count,
        updated_at
    )
    WITH ledger_lines AS (
        SELECT
            l.dj_user_id,
            public.mdj_flow_tz_bucket_date(l.created_at) AS bucket_date,
            l.amount_cents::bigint AS gross_cents,
            public.mdj_flow_ledger_line_commission_cents(l.amount_cents, l.metadata) AS comm_cents
        FROM public.dj_ledger l
        WHERE l.dj_user_id = p_uid
          AND l.type = 'income'
          AND l.amount_cents > 0
    ),
    ledger_daily AS (
        SELECT
            dj_user_id,
            bucket_date,
            SUM(gross_cents)::bigint AS ledger_gross,
            SUM(comm_cents)::bigint AS ledger_comm,
            COUNT(*)::integer AS ledger_n
        FROM ledger_lines
        GROUP BY dj_user_id, bucket_date
    ),
    sft_lines AS (
        SELECT
            fr.dj_user_id,
            public.mdj_flow_tz_bucket_date(fr.created_at) AS bucket_date,
            (ROUND(fr.tip_usd * 100))::bigint AS gross_cents
        FROM public.soundfortips_fan_requests fr
        WHERE fr.dj_user_id = p_uid
          AND fr.status = 'accepted'
          AND fr.tip_usd IS NOT NULL
          AND fr.tip_usd > 0
    ),
    sft_daily AS (
        SELECT
            fr.dj_user_id,
            bucket_date,
            SUM(gross_cents)::bigint AS sft_gross,
            SUM(public.mdj_flow_sft_commission_cents(gross_cents))::bigint AS sft_comm,
            COUNT(*)::integer AS sft_n
        FROM sft_lines fr
        GROUP BY fr.dj_user_id, bucket_date
    ),
    -- Expansión de residencias: cada día calendario, desde que la regla arranca
    -- (o hasta 7 años atrás si no tiene start_date) y hasta HOY -- nunca fechas
    -- futuras, todavía no se han cumplido.
    residency_rules AS (
        SELECT id, day_of_week, dj_id, dj_pay_usd,
               COALESCE(start_date, CURRENT_DATE - INTERVAL '7 years')::date AS win_start,
               LEAST(COALESCE(end_date, CURRENT_DATE), CURRENT_DATE)::date AS win_end
        FROM public.residency_schedule
        WHERE active = true AND dj_pay_usd IS NOT NULL AND dj_pay_usd > 0
    ),
    residency_days AS (
        SELECT rr.id AS residency_id, rr.dj_id AS base_dj_id, rr.dj_pay_usd, gs.occ_date::date AS occ_date
        FROM residency_rules rr
        CROSS JOIN LATERAL generate_series(rr.win_start, rr.win_end, interval '1 day') AS gs(occ_date)
        WHERE rr.win_start <= rr.win_end
          AND EXTRACT(DOW FROM gs.occ_date) = rr.day_of_week
    ),
    -- residency_schedule.dj_id y residency_schedule_exceptions.dj_id guardan
    -- dj_profiles.id (NO auth.users.id) -- hay que resolver el user_id real
    -- antes de comparar contra p_uid/dj_flow_daily.dj_user_id.
    residency_effective AS (
        SELECT
            rd.occ_date,
            dp.user_id AS effective_dj_id,
            COALESCE(ex.skip, false) AS skipped,
            rd.dj_pay_usd
        FROM residency_days rd
        LEFT JOIN public.residency_schedule_exceptions ex
            ON ex.residency_id = rd.residency_id AND ex.exception_date = rd.occ_date
        LEFT JOIN public.dj_profiles dp
            ON dp.id = COALESCE(ex.dj_id, rd.base_dj_id)
    ),
    -- DJMago305 es la propia persona del dueño (Identity: Owner vs DJ) -- lo que
    -- "gana" en sus propios turnos NUNCA es un pago personal, es ingreso de la
    -- empresa. Se excluye explícitamente de su Cash Flow personal (2026-09-22,
    -- pedido directo del PO). Si algún día se necesita generalizar esto a otros
    -- casos, conviene una columna real en dj_profiles en vez de este hardcode.
    residency_lines AS (
        SELECT occ_date AS bucket_date, (ROUND(dj_pay_usd * 100))::bigint AS gross_cents
        FROM residency_effective
        WHERE effective_dj_id = p_uid
          AND NOT skipped
          AND p_uid <> '3f5d5196-273c-458e-a4af-6b3545422177'::uuid
    ),
    residency_daily AS (
        SELECT
            p_uid AS dj_user_id,
            bucket_date,
            SUM(gross_cents)::bigint AS residency_gross,
            COUNT(*)::integer AS residency_n
        FROM residency_lines
        GROUP BY bucket_date
    ),
    all_days AS (
        SELECT dj_user_id, bucket_date FROM ledger_daily
        UNION
        SELECT dj_user_id, bucket_date FROM sft_daily
        UNION
        SELECT dj_user_id, bucket_date FROM residency_daily
    )
    SELECT
        d.dj_user_id,
        d.bucket_date,
        (COALESCE(ld.ledger_gross, 0) + COALESCE(sd.sft_gross, 0) + COALESCE(rd.residency_gross, 0))::bigint,
        (COALESCE(ld.ledger_comm, 0) + COALESCE(sd.sft_comm, 0))::bigint,
        (COALESCE(ld.ledger_gross, 0) + COALESCE(sd.sft_gross, 0) + COALESCE(rd.residency_gross, 0)
            - COALESCE(ld.ledger_comm, 0) - COALESCE(sd.sft_comm, 0))::bigint,
        COALESCE(ld.ledger_gross, 0)::bigint,
        COALESCE(sd.sft_gross, 0)::bigint,
        COALESCE(rd.residency_gross, 0)::bigint,
        (COALESCE(ld.ledger_n, 0) + COALESCE(sd.sft_n, 0) + COALESCE(rd.residency_n, 0))::integer,
        now()
    FROM all_days d
    LEFT JOIN ledger_daily ld
        ON ld.dj_user_id = d.dj_user_id AND ld.bucket_date = d.bucket_date
    LEFT JOIN sft_daily sd
        ON sd.dj_user_id = d.dj_user_id AND sd.bucket_date = d.bucket_date
    LEFT JOIN residency_daily rd
        ON rd.dj_user_id = d.dj_user_id AND rd.bucket_date = d.bucket_date
    WHERE (COALESCE(ld.ledger_gross, 0) + COALESCE(sd.sft_gross, 0) + COALESCE(rd.residency_gross, 0)) > 0;

    DELETE FROM public.dj_flow_weekly WHERE dj_user_id = p_uid;
    INSERT INTO public.dj_flow_weekly (
        dj_user_id, week_start, gross_cents, commission_cents, net_cents, tx_count, updated_at
    )
    SELECT
        p_uid,
        date_trunc('week', bucket_date::timestamp)::date,
        SUM(gross_cents)::bigint,
        SUM(commission_cents)::bigint,
        SUM(net_cents)::bigint,
        SUM(tx_count)::integer,
        now()
    FROM public.dj_flow_daily
    WHERE dj_user_id = p_uid
    GROUP BY date_trunc('week', bucket_date::timestamp)::date;

    DELETE FROM public.dj_flow_monthly WHERE dj_user_id = p_uid;
    INSERT INTO public.dj_flow_monthly (
        dj_user_id, month_start, gross_cents, commission_cents, net_cents, tx_count, updated_at
    )
    SELECT
        p_uid,
        date_trunc('month', bucket_date::timestamp)::date,
        SUM(gross_cents)::bigint,
        SUM(commission_cents)::bigint,
        SUM(net_cents)::bigint,
        SUM(tx_count)::integer,
        now()
    FROM public.dj_flow_daily
    WHERE dj_user_id = p_uid
    GROUP BY date_trunc('month', bucket_date::timestamp)::date;

    DELETE FROM public.dj_flow_yearly WHERE dj_user_id = p_uid;
    INSERT INTO public.dj_flow_yearly (
        dj_user_id, year_start, gross_cents, commission_cents, net_cents, tx_count, updated_at
    )
    SELECT
        p_uid,
        date_trunc('year', bucket_date::timestamp)::date,
        SUM(gross_cents)::bigint,
        SUM(commission_cents)::bigint,
        SUM(net_cents)::bigint,
        SUM(tx_count)::integer,
        now()
    FROM public.dj_flow_daily
    WHERE dj_user_id = p_uid
    GROUP BY date_trunc('year', bucket_date::timestamp)::date;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_dj_flow_rollups_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_dj_flow_rollups_for_user(uuid) TO authenticated;
