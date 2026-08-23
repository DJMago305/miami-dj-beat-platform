-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo (rtbsovavmtnjpbbpwsin)                    ║
-- ║  NO EJECUTAR EN PRODUCCIÓN SIN AUTORIZACIÓN EXPRESA DEL PO                ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  Cash Flow del artista · Fase 4 — get_my_cashflow_ledger()                ║
-- ║  Requiere: dj_ledger, event_builder_orders, leads, is_staff()             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- QUÉ ES
--   Contrato de lectura para el Flujo de Caja del artista. Mismo molde que
--   get_my_soundfortips_accepted_for_flow (20260417120000): SECURITY
--   DEFINER, resuelve auth.uid() del lado del servidor, devuelve solo lo
--   que le pertenece a quien llama.
--
--   Vocabulario de salida (amount_cents/source_type/source_id/status)
--   deliberadamente igual al del diseño canónico futuro
--   (financial_payables/financial_payments, canonical-financial-design/ —
--   DDL-only, NUNCA aplicado, sin autorización de despliegue). Así, cuando
--   ese diseño se autorice y se aplique, el contrato que ya consume el
--   frontend no cambia — solo se le agrega una rama UNION a esta función.
--
-- HALLAZGO DE SEGURIDAD QUE FIJA ESTE DISEÑO (léase antes de tocar esto)
--   event_builder_orders.total_usd / amount_paid_usd son el monto que el
--   CLIENTE paga a MDJ — incluyen el margen de la empresa. No existe en
--   event_builder_orders ninguna columna de "lo que le toca al artista".
--   Esa cifra vive en leads.dj_agreed_payout_usd y solo se hace real dinero
--   cuando el staff libera el pago (ver event_sales_staff_cobro.sql:143,
--   que inserta en dj_ledger con event_id = lead_id::text y
--   amount_cents = round(dj_agreed_payout_usd * 100)).
--
--   Por eso esta función NUNCA expone total_usd/amount_paid_usd al artista.
--   dj_ledger es la ÚNICA fuente del monto — event_builder_orders (vía
--   leads, el mismo puente lead_id ↔ event_id ya probado en producción)
--   solo aporta el nombre/fecha del evento para dar contexto legible, jamás
--   una cifra. Mismo principio que residency_schedule_secure con
--   venue_pay_usd: la fila base no cambia, la puerta de lectura sí filtra
--   columna por columna.
--
-- QUÉ NO HACE
--   · No incluye reservas todavía no liberadas a dj_ledger (ingresos
--     "esperados" vía leads.dj_agreed_payout_usd sin liberar) — eso es una
--     extensión de alcance no pedida en este ticket; anotado como posible
--     Fase 4b, no construido aquí.
--   · No lee financial_payables/financial_payments — no existen aplicadas
--     en ningún ambiente todavía.
--   · No construye la pantalla de Cash Flow — es un contrato de datos.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_cashflow_ledger(p_since timestamptz)
RETURNS TABLE (
  id            uuid,
  created_at    timestamptz,
  source_type   text,
  source_id     uuid,
  amount_cents  integer,
  status        text,
  event_label   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lg.id,
    lg.created_at,
    'LEGACY_LEDGER'::text AS source_type,
    lg.id                 AS source_id,
    lg.amount_cents,
    upper(lg.status)      AS status,
    COALESCE(
      ebo.event_name,
      l.event_name,
      initcap(lg.type) || ' · ' || to_char(lg.created_at, 'DD Mon YYYY')
    ) AS event_label
  FROM public.dj_ledger lg
  LEFT JOIN public.leads l
    ON l.id::text = lg.event_id
  LEFT JOIN public.event_builder_orders ebo
    ON ebo.lead_id = l.id
  WHERE lg.dj_user_id = auth.uid()
    AND lg.created_at >= p_since
  ORDER BY lg.created_at DESC;
$$;

COMMENT ON FUNCTION public.get_my_cashflow_ledger(timestamptz) IS
  'Cash Flow del artista · Fase 4. Única fuente de montos: dj_ledger (lo que ya se le liberó). event_builder_orders/leads solo aportan event_label — nunca un monto (total_usd incluye margen de la empresa). Vocabulario de salida alineado al diseño canónico futuro (financial_payables), sin depender de que esté aplicado.';

REVOKE ALL ON FUNCTION public.get_my_cashflow_ledger(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_cashflow_ledger(timestamptz) TO authenticated;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- V1 · Un artista con filas en dj_ledger ve solo las suyas
--   SELECT * FROM public.get_my_cashflow_ledger(now() - interval '90 days');
--   -- ESPERADO: solo filas con dj_user_id = auth.uid() de la sesión activa.
--
-- V2 · event_label se resuelve cuando dj_ledger.event_id coincide con un lead
--      que a su vez tiene una orden en event_builder_orders
--   -- ESPERADO: event_label = event_builder_orders.event_name, no un uuid crudo.
--
-- V3 · Ninguna columna de la salida expone total_usd/amount_paid_usd
--   -- ESPERADO (revisión de código, no query): el SELECT interno de la
--   -- función jamás menciona ebo.total_usd, ebo.amount_paid_usd ni
--   -- ebo.deposit_usd — confirmar leyendo esta migración, no en runtime.
--
-- V4 · Un artista sin ninguna fila en dj_ledger recibe 0 filas, no error
--   SELECT * FROM public.get_my_cashflow_ledger(now() - interval '1 day');
--   -- ESPERADO: 0 filas, sin excepción.
--
-- ── REVERSIÓN ──
-- BEGIN;
--   DROP FUNCTION IF EXISTS public.get_my_cashflow_ledger(timestamptz);
-- COMMIT;
-- Reversible sin pérdida de datos: la función es de solo lectura, no
-- escribe ni transforma ninguna tabla.
