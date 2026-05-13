-- Flujo de caja — extracto tipo banco (Fase A)
-- Agregados día → semana → mes → año (7 años en BD; UI escala antigüedad vía get_my_flow_statement).
-- Zona horaria de cubo: America/New_York (días laborables / noches venue-SFT en Miami).
-- Detalle crudo: dj_ledger + soundfortips_fan_requests (export IRS / Fase C).

-- ── Tablas de agregados ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dj_flow_daily (
    dj_user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket_date        date NOT NULL,
    gross_cents        bigint NOT NULL DEFAULT 0 CHECK (gross_cents >= 0),
    commission_cents   bigint NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
    net_cents          bigint NOT NULL DEFAULT 0,
    ledger_gross_cents bigint NOT NULL DEFAULT 0 CHECK (ledger_gross_cents >= 0),
    sft_gross_cents    bigint NOT NULL DEFAULT 0 CHECK (sft_gross_cents >= 0),
    tx_count           integer NOT NULL DEFAULT 0 CHECK (tx_count >= 0),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dj_user_id, bucket_date)
);

CREATE TABLE IF NOT EXISTS public.dj_flow_weekly (
    dj_user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start         date NOT NULL,
    gross_cents        bigint NOT NULL DEFAULT 0 CHECK (gross_cents >= 0),
    commission_cents   bigint NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
    net_cents          bigint NOT NULL DEFAULT 0,
    tx_count           integer NOT NULL DEFAULT 0 CHECK (tx_count >= 0),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dj_user_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.dj_flow_monthly (
    dj_user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_start        date NOT NULL,
    gross_cents        bigint NOT NULL DEFAULT 0 CHECK (gross_cents >= 0),
    commission_cents   bigint NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
    net_cents          bigint NOT NULL DEFAULT 0,
    tx_count           integer NOT NULL DEFAULT 0 CHECK (tx_count >= 0),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dj_user_id, month_start)
);

CREATE TABLE IF NOT EXISTS public.dj_flow_yearly (
    dj_user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year_start         date NOT NULL,
    gross_cents        bigint NOT NULL DEFAULT 0 CHECK (gross_cents >= 0),
    commission_cents   bigint NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
    net_cents          bigint NOT NULL DEFAULT 0,
    tx_count           integer NOT NULL DEFAULT 0 CHECK (tx_count >= 0),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dj_user_id, year_start)
);

CREATE INDEX IF NOT EXISTS idx_dj_flow_daily_user_date
    ON public.dj_flow_daily (dj_user_id, bucket_date DESC);

COMMENT ON TABLE public.dj_flow_daily IS 'Cash flow rollup per calendar day (America/New_York). Only days with income activity.';
COMMENT ON TABLE public.dj_flow_weekly IS 'Weekly rollup from dj_flow_daily (week starts Monday, PG date_trunc week).';
COMMENT ON TABLE public.dj_flow_monthly IS 'Monthly rollup for bank-style statement tier.';
COMMENT ON TABLE public.dj_flow_yearly IS 'Annual rollup; retain through 7y policy; older rows for export/archive only.';

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.dj_flow_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dj_flow_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dj_flow_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dj_flow_yearly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DJ select own flow daily" ON public.dj_flow_daily;
CREATE POLICY "DJ select own flow daily"
    ON public.dj_flow_daily FOR SELECT TO authenticated
    USING (dj_user_id = auth.uid());

DROP POLICY IF EXISTS "DJ select own flow weekly" ON public.dj_flow_weekly;
CREATE POLICY "DJ select own flow weekly"
    ON public.dj_flow_weekly FOR SELECT TO authenticated
    USING (dj_user_id = auth.uid());

DROP POLICY IF EXISTS "DJ select own flow monthly" ON public.dj_flow_monthly;
CREATE POLICY "DJ select own flow monthly"
    ON public.dj_flow_monthly FOR SELECT TO authenticated
    USING (dj_user_id = auth.uid());

DROP POLICY IF EXISTS "DJ select own flow yearly" ON public.dj_flow_yearly;
CREATE POLICY "DJ select own flow yearly"
    ON public.dj_flow_yearly FOR SELECT TO authenticated
    USING (dj_user_id = auth.uid());

-- Escritura solo vía funciones SECURITY DEFINER (refresh).

-- ── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mdj_flow_tz_bucket_date(p_ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT (p_ts AT TIME ZONE 'America/New_York')::date;
$$;

CREATE OR REPLACE FUNCTION public.mdj_flow_ledger_line_commission_cents(p_amount_cents integer, p_metadata jsonb)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_amount_cents IS NULL OR p_amount_cents <= 0 THEN 0::bigint
        ELSE (
            (p_amount_cents::numeric
                * COALESCE(NULLIF(p_metadata->>'commission_rate', '')::numeric, 10::numeric)
                / 100.0)
        )::bigint
    END;
$$;

CREATE OR REPLACE FUNCTION public.mdj_flow_sft_commission_cents(p_gross_cents bigint)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT (p_gross_cents * 10 / 100)::bigint;
$$;

-- ── Refresh rollups for one DJ ──────────────────────────────────────────────

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
            dj_user_id,
            bucket_date,
            SUM(gross_cents)::bigint AS sft_gross,
            SUM(public.mdj_flow_sft_commission_cents(gross_cents))::bigint AS sft_comm,
            COUNT(*)::integer AS sft_n
        FROM sft_lines
        GROUP BY dj_user_id, bucket_date
    ),
    all_days AS (
        SELECT dj_user_id, bucket_date FROM ledger_daily
        UNION
        SELECT dj_user_id, bucket_date FROM sft_daily
    )
    SELECT
        d.dj_user_id,
        d.bucket_date,
        (COALESCE(ld.ledger_gross, 0) + COALESCE(sd.sft_gross, 0))::bigint,
        (COALESCE(ld.ledger_comm, 0) + COALESCE(sd.sft_comm, 0))::bigint,
        (COALESCE(ld.ledger_gross, 0) + COALESCE(sd.sft_gross, 0)
            - COALESCE(ld.ledger_comm, 0) - COALESCE(sd.sft_comm, 0))::bigint,
        COALESCE(ld.ledger_gross, 0)::bigint,
        COALESCE(sd.sft_gross, 0)::bigint,
        (COALESCE(ld.ledger_n, 0) + COALESCE(sd.sft_n, 0))::integer,
        now()
    FROM all_days d
    LEFT JOIN ledger_daily ld
        ON ld.dj_user_id = d.dj_user_id AND ld.bucket_date = d.bucket_date
    LEFT JOIN sft_daily sd
        ON sd.dj_user_id = d.dj_user_id AND sd.bucket_date = d.bucket_date
    WHERE (COALESCE(ld.ledger_gross, 0) + COALESCE(sd.sft_gross, 0)) > 0;

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

DROP FUNCTION IF EXISTS public.refresh_my_dj_flow_rollups() CASCADE;

CREATE OR REPLACE FUNCTION public.refresh_my_dj_flow_rollups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;
    PERFORM public.refresh_dj_flow_rollups_for_user(auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_dj_flow_rollups_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_dj_flow_rollups_for_user(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.refresh_my_dj_flow_rollups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_my_dj_flow_rollups() TO authenticated;

-- ── Extracto banco para UI (escala por antigüedad) ─────────────────────────
-- Semana en curso (lun–dom PG): filas diarias con actividad.
-- Hasta 12 meses antes de esa semana: semanal.
-- 12 meses – 3 años: mensual.
-- 3 – 7 años: anual.
-- > 7 años: no devuelve (reservado export IRS / Fase C).

DROP FUNCTION IF EXISTS public.get_my_flow_statement(timestamptz) CASCADE;

CREATE OR REPLACE FUNCTION public.get_my_flow_statement(p_as_of timestamptz DEFAULT now())
RETURNS TABLE (
    grain            text,
    period_start     date,
    period_end       date,
    label            text,
    gross_cents      bigint,
    commission_cents bigint,
    net_cents        bigint,
    tx_count         integer,
    sort_at          timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_as_of date;
    v_week_start date;
    v_cut_weekly date;
    v_cut_monthly date;
    v_cut_yearly date;
    v_floor date;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    v_as_of := public.mdj_flow_tz_bucket_date(COALESCE(p_as_of, now()));
    v_week_start := date_trunc('week', v_as_of::timestamp)::date;
    v_cut_weekly := (v_week_start - interval '7 days')::date;
    v_cut_monthly := (v_as_of - interval '12 months')::date;
    v_cut_yearly := (v_as_of - interval '3 years')::date;
    v_floor := (v_as_of - interval '7 years')::date;

    RETURN QUERY
  SELECT
    s.grain,
    s.period_start,
    s.period_end,
    s.label,
    s.gross_cents,
    s.commission_cents,
    s.net_cents,
    s.tx_count,
    s.sort_at
  FROM (
    -- Diario: semana calendario actual (solo días con fila en rollup)
    SELECT
        'day'::text AS grain,
        d.bucket_date AS period_start,
        d.bucket_date AS period_end,
        (to_char(d.bucket_date, 'Dy DD Mon YYYY') || ' · ingresos')::text AS label,
        d.gross_cents,
        d.commission_cents,
        d.net_cents,
        d.tx_count,
        (d.bucket_date::timestamp AT TIME ZONE 'America/New_York') AS sort_at
    FROM public.dj_flow_daily d
    WHERE d.dj_user_id = v_uid
      AND d.bucket_date >= v_week_start
      AND d.bucket_date <= v_as_of
      AND d.bucket_date >= v_floor

    UNION ALL

    -- Semanal: desde 12m atrás hasta antes de la semana actual
    SELECT
        'week'::text,
        w.week_start,
        (w.week_start + 6),
        ('Sem ' || to_char(w.week_start, 'DD Mon') || ' – ' || to_char(w.week_start + 6, 'DD Mon YYYY'))::text,
        w.gross_cents,
        w.commission_cents,
        w.net_cents,
        w.tx_count,
        (w.week_start::timestamp AT TIME ZONE 'America/New_York')
    FROM public.dj_flow_weekly w
    WHERE w.dj_user_id = v_uid
      AND w.week_start < v_week_start
      AND w.week_start >= v_cut_monthly
      AND w.week_start >= v_floor

    UNION ALL

    -- Mensual: 12m – 3a
    SELECT
        'month'::text,
        m.month_start,
        (date_trunc('month', m.month_start::timestamp) + interval '1 month - 1 day')::date,
        to_char(m.month_start, 'Mon YYYY')::text,
        m.gross_cents,
        m.commission_cents,
        m.net_cents,
        m.tx_count,
        (m.month_start::timestamp AT TIME ZONE 'America/New_York')
    FROM public.dj_flow_monthly m
    WHERE m.dj_user_id = v_uid
      AND m.month_start < v_cut_monthly
      AND m.month_start >= v_cut_yearly
      AND m.month_start >= v_floor

    UNION ALL

    -- Anual: 3a – 7a
    SELECT
        'year'::text,
        y.year_start,
        (date_trunc('year', y.year_start::timestamp) + interval '1 year - 1 day')::date,
        to_char(y.year_start, 'YYYY')::text,
        y.gross_cents,
        y.commission_cents,
        y.net_cents,
        y.tx_count,
        (y.year_start::timestamp AT TIME ZONE 'America/New_York')
    FROM public.dj_flow_yearly y
    WHERE y.dj_user_id = v_uid
      AND y.year_start < v_cut_yearly
      AND y.year_start >= v_floor
  ) s
  ORDER BY s.sort_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_flow_statement(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_flow_statement(timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_my_flow_statement IS
  'Bank-style cash flow statement: day (current week) → week (12m) → month (3y) → year (7y). Call refresh_my_dj_flow_rollups() first.';

-- ── Años con datos (para export IRS / Fase C) ─────────────────────────────

DROP FUNCTION IF EXISTS public.get_my_flow_export_years() CASCADE;

CREATE OR REPLACE FUNCTION public.get_my_flow_export_years()
RETURNS TABLE (
    tax_year integer,
    gross_cents bigint,
    net_cents bigint,
    line_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        EXTRACT(YEAR FROM y.year_start)::integer AS tax_year,
        y.gross_cents,
        y.net_cents,
        y.tx_count::bigint
    FROM public.dj_flow_yearly y
    WHERE y.dj_user_id = auth.uid()
      AND y.year_start >= (public.mdj_flow_tz_bucket_date(now()) - interval '7 years')::date
    ORDER BY tax_year DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_flow_export_years() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_flow_export_years() TO authenticated;

COMMENT ON FUNCTION public.get_my_flow_export_years IS
  'Lists fiscal years (last 7y) with rollup totals — UI export picker (Fase C).';

NOTIFY pgrst, 'reload schema';
