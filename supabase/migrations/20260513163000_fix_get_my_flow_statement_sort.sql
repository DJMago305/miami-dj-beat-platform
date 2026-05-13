-- Fix 42703: ORDER BY s.sort_at on unnamed UNION columns in get_my_flow_statement.

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
    v_cut_monthly date;
    v_cut_yearly date;
    v_floor date;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    v_as_of := public.mdj_flow_tz_bucket_date(COALESCE(p_as_of, now()));
    v_week_start := date_trunc('week', v_as_of::timestamp)::date;
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

NOTIFY pgrst, 'reload schema';
