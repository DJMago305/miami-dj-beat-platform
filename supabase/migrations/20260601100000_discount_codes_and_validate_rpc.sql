-- Miami DJ Beat — Discount codes table + server-side validation RPC
-- Security model: clients NEVER read the table directly; only call the RPC.
-- Staff creates codes via admin panel or SQL. RPC validates + returns discount cents.

-- ── Tabla de códigos de descuento ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.discount_codes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text NOT NULL UNIQUE,          -- 'MDJB-SUMMER25', 'BIENVENIDO'
    label           text,                           -- UI-friendly description
    discount_type   text NOT NULL DEFAULT 'fixed',  -- 'fixed' | 'percent'
    amount_cents    bigint,                         -- fixed: discount in cents USD
    percent         numeric(5, 2),                  -- percent: 0.00-100.00
    min_order_cents bigint DEFAULT 0,               -- minimum order to apply
    max_uses        int,                            -- null = unlimited
    uses            int NOT NULL DEFAULT 0,
    active          boolean NOT NULL DEFAULT true,
    valid_from      timestamptz DEFAULT now(),
    valid_until     timestamptz,                    -- null = no expiry
    created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    notes           text,
    created_at      timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_codes_upper
    ON public.discount_codes (upper(trim(code)));

COMMENT ON TABLE public.discount_codes IS
    'Promo / discount codes managed by staff. Clients validate via RPC only (no direct table access).';

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Clients: no direct table access (validation via RPC SECURITY DEFINER)
DROP POLICY IF EXISTS "No client reads discount_codes" ON public.discount_codes;
CREATE POLICY "No client reads discount_codes"
    ON public.discount_codes FOR SELECT TO authenticated
    USING (public.is_staff(auth.uid()));

-- Staff full access
DROP POLICY IF EXISTS "Staff manages discount_codes" ON public.discount_codes;
CREATE POLICY "Staff manages discount_codes"
    ON public.discount_codes FOR ALL TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

-- ── RPC: validar código (SECURITY DEFINER — bypasses RLS) ────────────────────
-- Returns: { valid, code, label, discount_type, discount_cents, discount_usd, error? }
-- Validates: active, not expired, max_uses not exceeded, min_order met.
-- Does NOT increment 'uses' here — increment on confirmed payment.

DROP FUNCTION IF EXISTS public.mdj_validate_discount_code(text, bigint) CASCADE;

CREATE OR REPLACE FUNCTION public.mdj_validate_discount_code(
    p_code          text,
    p_order_cents   bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row       public.discount_codes%ROWTYPE;
    v_disc      bigint := 0;
    v_now       timestamptz := now();
BEGIN
    -- Basic sanitization
    IF p_code IS NULL OR trim(p_code) = '' THEN
        RETURN jsonb_build_object('valid', false, 'error', 'No code provided');
    END IF;

    SELECT * INTO v_row
    FROM public.discount_codes
    WHERE upper(trim(code)) = upper(trim(p_code))
      AND active = true
      AND (valid_from  IS NULL OR valid_from  <= v_now)
      AND (valid_until IS NULL OR valid_until >= v_now)
      AND (max_uses    IS NULL OR uses < max_uses);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Code not found, expired, or already used up');
    END IF;

    -- Minimum order check
    IF v_row.min_order_cents IS NOT NULL AND p_order_cents < v_row.min_order_cents THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', format(
                'Minimum order of $%s required for this code',
                to_char(v_row.min_order_cents::numeric / 100, 'FM9999990.00')
            )
        );
    END IF;

    -- Compute discount
    IF v_row.discount_type = 'fixed' AND v_row.amount_cents IS NOT NULL THEN
        v_disc := LEAST(v_row.amount_cents, GREATEST(p_order_cents, 0));
    ELSIF v_row.discount_type = 'percent' AND v_row.percent IS NOT NULL THEN
        v_disc := FLOOR(p_order_cents * v_row.percent / 100.0);
    END IF;

    RETURN jsonb_build_object(
        'valid',          true,
        'code',           v_row.code,
        'label',          COALESCE(v_row.label, v_row.code),
        'discount_type',  v_row.discount_type,
        'discount_cents', v_disc,
        'discount_usd',   ROUND(v_disc::numeric / 100, 2)
    );
END;
$$;

-- Authenticated clients can call validation RPC; anon cannot
REVOKE ALL ON FUNCTION public.mdj_validate_discount_code(text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_validate_discount_code(text, bigint) TO authenticated;

COMMENT ON FUNCTION public.mdj_validate_discount_code(text, bigint) IS
    'Client-safe RPC: validates a discount code without exposing the codes table. Returns discount_cents and error. Does not auto-increment uses (call mdj_redeem_discount_code on confirmed payment).';

-- ── RPC: marcar código como usado (llamar al confirmar pago) ─────────────────
DROP FUNCTION IF EXISTS public.mdj_redeem_discount_code(text, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.mdj_redeem_discount_code(
    p_code      text,
    p_lead_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated int;
BEGIN
    UPDATE public.discount_codes
    SET uses = uses + 1
    WHERE upper(trim(code)) = upper(trim(p_code))
      AND active = true
      AND (valid_until IS NULL OR valid_until >= now())
      AND (max_uses    IS NULL OR uses < max_uses);

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN jsonb_build_object('redeemed', false, 'error', 'Code no longer valid');
    END IF;

    RETURN jsonb_build_object('redeemed', true, 'code', p_code);
END;
$$;

REVOKE ALL ON FUNCTION public.mdj_redeem_discount_code(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdj_redeem_discount_code(text, uuid) TO authenticated;

COMMENT ON FUNCTION public.mdj_redeem_discount_code(text, uuid) IS
    'Increments uses count on confirmed payment. Called by Edge Function / server-side only.';

-- Seed example codes so staff can test immediately (inactive by default in prod)
INSERT INTO public.discount_codes (code, label, discount_type, amount_cents, active, notes)
VALUES
    ('MDJB-BIENVENIDO', 'Welcome - $30 off first event', 'fixed',   3000, false, 'Seed: deactivate after testing'),
    ('MDJB-VIP20PCT',   'VIP Client 20% discount',       'percent',  null, false, 'Seed: percent type demo')
ON CONFLICT (code) DO NOTHING;

NOTIFY pgrst, 'reload schema';
