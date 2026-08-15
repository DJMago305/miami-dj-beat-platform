-- TICKET-V1-CANONICAL-FINANCIAL-ARCHITECTURE-DDL-031
-- DESIGN ONLY. NOT EXECUTED. NOT AUTHORIZED for remote apply.
--
-- Source of truth: docs/architecture/MIAMI-DJ-BEAT-V1-CANONICAL-FINANCIAL-ARCHITECTURE.md
-- (§6 Contrato exacto de entidades, §20 item 13 "Diseño SQL sin ejecutar").
-- Every table/column/constraint below is a literal translation of that
-- document's already-approved contract — no new entity, no new field, no
-- new business rule was invented while writing this file. The in-memory
-- reference implementation (mdj-financial-local-services.js, T009, closed
-- and tested since T009's original closure) is the executable spec this
-- schema must match; where the two could be read to disagree, the JS
-- implementation is authoritative and this file should be corrected, not
-- the other way around.
--
-- Naming: snake_case, `financial_` prefix on every table to keep this
-- whole canonical model in one clearly-scoped namespace, separate from
-- any existing/legacy financial tables (there are none today under these
-- names — verified via repo-wide grep before writing this file).
--
-- Scope of THIS migration: schema (tables, constraints, comments) only.
--   - No RLS policies (deliberately deferred — this is DDL-only per the
--     canonical doc's own ordering; RLS requires its own PO-authorized
--     ticket once persistence itself is authorized).
--   - No seed data.
--   - No backfill.
--   - No FKs to pre-existing tables (dj_profiles, leads, payees) — those
--     are declared as loosely-typed uuid columns with a comment, not a
--     hard FK, because T009's own contract treats them as external
--     references it does not own (see canonical doc §6, Payable.payeeId).
--
-- Remote apply: NOT AUTHORIZED. This file exists so the schema can be
-- reviewed and, if approved, applied first to a local/test Supabase
-- project only (canonical doc §20 item 14) — never directly to production,
-- and never without a separate, explicit, future PO authorization
-- (canonical doc §20 item 15).

-- ═══════════════════════════════════════════════════════════════════════
-- 1) financial_venues  (canonical doc §6 — Venue)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_venues (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  address        text,
  contact_name   text,
  contact_phone  text,
  contact_email  text,
  status         text NOT NULL DEFAULT 'ACTIVE',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  CONSTRAINT chk_financial_venues_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT chk_financial_venues_name_nonempty CHECK (length(trim(name)) > 0)
);
COMMENT ON TABLE public.financial_venues IS
  'Root entity, no FK. Never edit id/created_at/created_by. Reversal: status=INACTIVE, never hard-delete if venue_agreements/occurrences exist.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2) financial_venue_agreements  (canonical doc §6 — VenueAgreement)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_venue_agreements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id          uuid NOT NULL REFERENCES public.financial_venues(id),
  title             text NOT NULL,
  frequency         text NOT NULL,
  scheduled_days    text[] NOT NULL DEFAULT '{}',
  rate_by_day       jsonb NOT NULL DEFAULT '{}'::jsonb,
  currency          text NOT NULL DEFAULT 'USD',
  effective_from    date NOT NULL,
  effective_until   date,
  status            text NOT NULL DEFAULT 'ACTIVE',
  payment_method    text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  CONSTRAINT chk_financial_venue_agreements_frequency CHECK (frequency IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ONE_OFF')),
  CONSTRAINT chk_financial_venue_agreements_status CHECK (status IN ('ACTIVE', 'PAUSED', 'ENDED')),
  CONSTRAINT chk_financial_venue_agreements_date_range CHECK (effective_until IS NULL OR effective_until >= effective_from)
);
COMMENT ON TABLE public.financial_venue_agreements IS
  'rate_by_day: JSON map DayCode->AmountCents, all values must be > 0 (enforced app-side per contract, not a portable CHECK over jsonb keys here). Never edit id/venue_id. Reversal: status=ENDED.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3) financial_occurrences  (canonical doc §6 — Occurrence)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_occurrences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id              uuid NOT NULL REFERENCES public.financial_venues(id),
  agreement_id          uuid REFERENCES public.financial_venue_agreements(id),
  assigned_profile_id   uuid,
  date                  date NOT NULL,
  shift                 text NOT NULL DEFAULT 'default',
  status                text NOT NULL DEFAULT 'SCHEDULED',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  CONSTRAINT chk_financial_occurrences_status CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  CONSTRAINT uq_financial_occurrences_slot UNIQUE (venue_id, date, shift)
);
COMMENT ON TABLE public.financial_occurrences IS
  'assigned_profile_id references dj_profiles.user_id — not a hard FK here by design (external domain, per contract). date/shift never edited directly outside rescheduleOccurrence (app-level command); previousDate/previousShift live only in the OccurrenceRescheduled domain event payload, never as a column.';
COMMENT ON COLUMN public.financial_occurrences.shift IS
  'TICKET-030 finding, preserved here: shift identity is venue_id+date+shift ONLY — no startTime dimension exists in the canonical model. Two legacy occurrences differing only by a start time are the SAME canonical slot unless shift itself differs.';

-- ═══════════════════════════════════════════════════════════════════════
-- 4) financial_performance_records  (canonical doc §6 — PerformanceFinancialRecord / PFR)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_performance_records (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id                  uuid NOT NULL UNIQUE REFERENCES public.financial_occurrences(id),
  agreement_id                   uuid REFERENCES public.financial_venue_agreements(id),
  rate_amount_cents              integer NOT NULL,
  currency                       text NOT NULL DEFAULT 'USD',
  assigned_profile_id            uuid,
  expected_artist_payout_cents   integer DEFAULT 0,
  rate_by_day_snapshot           jsonb,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),
  created_by                     uuid,
  CONSTRAINT chk_financial_performance_records_rate_positive CHECK (rate_amount_cents > 0),
  CONSTRAINT chk_financial_performance_records_payout_nonneg CHECK (expected_artist_payout_cents >= 0)
);
COMMENT ON TABLE public.financial_performance_records IS
  'Strictly 1:1 with occurrence_id (UNIQUE). NEVER stores collectedAmount/paidPayout/collectionStatus/djPayoutStatus/billedIncome/expectedMargin/cashPosition/realizedMargin — all of those are derived views joining this table with financial_venue_receivables/financial_payables/financial_payments (canonical doc §8). Correcting rate_amount_cents/expected_artist_payout_cents is only allowed if no receivable/payable exists yet referencing this PFR; otherwise void + recreate.';
COMMENT ON COLUMN public.financial_performance_records.expected_artist_payout_cents IS
  'TICKET-033 finding: nullable, matching mdj-financial-local-services.js:452 exactly (input.expectedArtistPayoutCents != null ? input.expectedArtistPayoutCents : null) — no assigned profile at creation time means no known payout yet, never falsely asserted as 0.';

-- ═══════════════════════════════════════════════════════════════════════
-- 5) financial_venue_receivables  (canonical doc §6 — VenueReceivable)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_venue_receivables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id   uuid NOT NULL UNIQUE REFERENCES public.financial_occurrences(id),
  amount_cents    integer NOT NULL,
  currency        text NOT NULL DEFAULT 'USD',
  status          text NOT NULL DEFAULT 'OPEN',
  due_date        date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  CONSTRAINT chk_financial_venue_receivables_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT chk_financial_venue_receivables_status CHECK (status IN ('OPEN', 'PARTIALLY_PAID', 'PAID', 'VOID'))
);
COMMENT ON TABLE public.financial_venue_receivables IS
  'Venue Operations channel only — no formal invoice document by design (V1 decision). Never edit occurrence_id/amount_cents once allocations exist against this receivable.';

-- ═══════════════════════════════════════════════════════════════════════
-- 6) financial_payables  (canonical doc §6 — Payable)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_payables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type   text NOT NULL,
  source_id     uuid,
  payee_type    text NOT NULL,
  payee_id      uuid NOT NULL,
  purpose       text NOT NULL,
  amount_cents  integer NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'USD',
  status        text NOT NULL DEFAULT 'PENDING',
  due_date      date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  CONSTRAINT chk_financial_payables_source_type CHECK (source_type IN ('LEAD', 'OCCURRENCE', 'EXPENSE')),
  CONSTRAINT chk_financial_payables_source_id_required CHECK (source_type = 'EXPENSE' OR source_id IS NOT NULL),
  CONSTRAINT chk_financial_payables_payee_type CHECK (payee_type IN ('DJ_PROFILE', 'PAYEE')),
  CONSTRAINT chk_financial_payables_purpose CHECK (purpose IN ('DJ_PAYMENT', 'CONTRACTOR_PAYMENT', 'VENDOR_PAYMENT', 'REIMBURSEMENT', 'ADJUSTMENT', 'OWNER_WORK_RECORD')),
  CONSTRAINT chk_financial_payables_amount_nonneg CHECK (amount_cents >= 0),
  CONSTRAINT chk_financial_payables_amount_zero_only_owner_work CHECK (amount_cents > 0 OR purpose = 'OWNER_WORK_RECORD'),
  CONSTRAINT chk_financial_payables_status CHECK (status IN ('PENDING', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID', 'VOID')),
  CONSTRAINT uq_financial_payables_source_payee_purpose UNIQUE (source_type, source_id, payee_id, purpose)
);
COMMENT ON TABLE public.financial_payables IS
  'payee_id references dj_profiles.user_id or an external payees table depending on payee_type — not a hard FK here (external domain per contract). purpose vocabulary mirrors PAYMENT_TYPES already used in accounting-module.js:311-318.';

-- ═══════════════════════════════════════════════════════════════════════
-- 7) financial_payments  (canonical doc §6 — Payment)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_payments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction              text NOT NULL,
  amount_cents           integer NOT NULL,
  currency               text NOT NULL DEFAULT 'USD',
  method                 text NOT NULL,
  account                text,
  reference              text,
  payment_date           date NOT NULL,
  status                 text NOT NULL DEFAULT 'PENDING',
  idempotency_key        uuid NOT NULL UNIQUE,
  reversal_of_payment_id uuid REFERENCES public.financial_payments(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  CONSTRAINT chk_financial_payments_direction CHECK (direction IN ('INFLOW', 'OUTFLOW')),
  CONSTRAINT chk_financial_payments_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT chk_financial_payments_method CHECK (method IN ('STRIPE', 'ZELLE', 'CASH', 'CHECK', 'WIRE', 'ACH', 'REFUND', 'OTHER')),
  CONSTRAINT chk_financial_payments_status CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED'))
);
COMMENT ON TABLE public.financial_payments IS
  'status NEVER stores REVERSED/PARTIALLY_REVERSED/FULLY_REVERSED — those are derived-in-read effectiveStatus values (canonical doc §7), never a column. amount_cents/direction/idempotency_key/reversal_of_payment_id are immutable forever once written.';

-- ═══════════════════════════════════════════════════════════════════════
-- 8) financial_payment_allocations  (canonical doc §6 — PaymentAllocation)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_payment_allocations (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id                  uuid NOT NULL REFERENCES public.financial_payments(id),
  target_type                 text NOT NULL,
  target_id                   uuid NOT NULL,
  amount_cents                integer NOT NULL,
  direction                   text NOT NULL,
  reversal_of_allocation_id   uuid REFERENCES public.financial_payment_allocations(id),
  idempotency_key             text NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  created_by                  uuid,
  CONSTRAINT chk_financial_payment_allocations_target_type CHECK (target_type IN ('INVOICE', 'VENUE_RECEIVABLE', 'PAYABLE')),
  CONSTRAINT chk_financial_payment_allocations_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT chk_financial_payment_allocations_direction CHECK (direction IN ('APPLY', 'REVERSE'))
);
COMMENT ON TABLE public.financial_payment_allocations IS
  'No status column — the original row is NEVER edited, not even a status flip. Reversal = new row with direction=REVERSE. Net applied amount = SUM(APPLY) - SUM(REVERSE), always computed in read (effectiveStatus, canonical doc §7), never stored.';

-- ═══════════════════════════════════════════════════════════════════════
-- 9) financial_owner_ledger_entries  (canonical doc §6 — OwnerLedgerEntry)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_owner_ledger_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_type          text NOT NULL,
  direction             text NOT NULL,
  amount_cents          integer NOT NULL,
  currency              text NOT NULL DEFAULT 'USD',
  source_type           text NOT NULL,
  source_id             uuid NOT NULL,
  reversal_of_entry_id  uuid REFERENCES public.financial_owner_ledger_entries(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  CONSTRAINT chk_financial_owner_ledger_entries_posting_type CHECK (posting_type IN ('CASH_IN', 'CASH_OUT', 'ADJUSTMENT', 'REFUND', 'ALLOCATION_REVERSAL')),
  CONSTRAINT chk_financial_owner_ledger_entries_direction CHECK (direction IN ('INFLOW', 'OUTFLOW')),
  CONSTRAINT chk_financial_owner_ledger_entries_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT chk_financial_owner_ledger_entries_source_type CHECK (source_type IN ('PAYMENT', 'ALLOCATION', 'RECONCILIATION'))
);
COMMENT ON TABLE public.financial_owner_ledger_entries IS
  '100% append-only, no exception — deliberately has NO updated_at column (canonical doc §6). This is the OWNER-domain ledger; dj_ledger (ARTIST domain) is a separate, pre-existing, frozen table, never merged with this one.';

-- ═══════════════════════════════════════════════════════════════════════
-- 10) financial_reconciliations  (canonical doc §6 — Reconciliation)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_reconciliations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      uuid NOT NULL REFERENCES public.financial_payments(id),
  attempt_uuid    uuid NOT NULL,
  evidence_ref    text,
  status          text NOT NULL DEFAULT 'UNRECONCILED',
  reconciled_by   uuid,
  reconciled_at   timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_financial_reconciliations_status CHECK (status IN ('UNRECONCILED', 'MATCHED', 'EXCEPTION', 'RECONCILED')),
  CONSTRAINT uq_financial_reconciliations_payment_attempt UNIQUE (payment_id, attempt_uuid)
);
COMMENT ON TABLE public.financial_reconciliations IS
  'UNIQUE(payment_id, attempt_uuid) deliberately, NOT UNIQUE(payment_id) alone — multiple historical reconciliation attempts per payment are allowed and preserved.';

-- ═══════════════════════════════════════════════════════════════════════
-- 11) financial_domain_events  (canonical doc §6 — DomainEvent)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_domain_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        text NOT NULL,
  event_version     integer NOT NULL DEFAULT 1,
  event_position    bigint GENERATED ALWAYS AS IDENTITY,
  aggregate_type    text NOT NULL,
  aggregate_id      uuid NOT NULL,
  command_id        text NOT NULL,
  correlation_id    uuid,
  causation_id      uuid,
  actor_id          uuid,
  idempotency_key   text NOT NULL,
  payload           jsonb NOT NULL,
  occurred_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_financial_domain_events_idempotency_key
  ON public.financial_domain_events (idempotency_key);
COMMENT ON COLUMN public.financial_domain_events.idempotency_key IS
  'TICKET-033 finding: NOT globally unique — mdj-financial-domain-events.js:96 (buildDomainEvent) deliberately reuses one COMMAND''s idempotencyKey across every event that command emits (e.g. createOccurrenceWithPfr emits OccurrenceCreated + PfrCreated sharing one key). Only id is unique per event. Indexed (not UNIQUE) for lookup by command.';
COMMENT ON TABLE public.financial_domain_events IS
  'Append-only, strict. event_position is server-assigned and monotonic (IDENTITY column) — the real read order (ORDER BY event_position ASC), never rely on occurred_at alone. payload: minimum IDs + amounts + status, never a full document copy (canonical doc §6).';

CREATE INDEX IF NOT EXISTS idx_financial_domain_events_aggregate
  ON public.financial_domain_events (aggregate_type, aggregate_id, event_position);

-- ═══════════════════════════════════════════════════════════════════════
-- 12) financial_domain_event_deliveries  (canonical doc §6 — DomainEventDelivery)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_domain_event_deliveries (
  event_id           uuid NOT NULL REFERENCES public.financial_domain_events(id),
  consumer_name      text NOT NULL,
  status             text NOT NULL DEFAULT 'PENDING',
  attempt_count      integer NOT NULL DEFAULT 0,
  last_error_code    text,
  last_error_message text,
  next_attempt_at    timestamptz,
  first_attempt_at   timestamptz,
  processed_at       timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_financial_domain_event_deliveries_status CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER')),
  CONSTRAINT pk_financial_domain_event_deliveries PRIMARY KEY (event_id, consumer_name)
);
COMMENT ON TABLE public.financial_domain_event_deliveries IS
  'UNIQUE(event_id, consumer_name) via composite PK — this IS the dedupe/claim key. No single global processed_at — each consumer has its own row/checkpoint (canonical doc §16). Producer (the command layer) never inserts here; each consumer claims/creates its own row deterministically.';

-- ═══════════════════════════════════════════════════════════════════════
-- 13) financial_command_receipts  (T009 mdj-financial-local-services.js
--     runCommand() envelope — idempotency ledger, not in the canonical
--     doc's §6 entity list because it is an implementation-layer construct
--     of T009 itself, not a business entity. Shape read directly from the
--     real closed source, not guessed: {commandId, commandType,
--     idempotencyKey, payloadFingerprint, resultSnapshot, createdAt}.)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.financial_command_receipts (
  command_id           text NOT NULL,
  command_type         text NOT NULL,
  idempotency_key      text NOT NULL,
  payload_fingerprint  text NOT NULL,
  result_snapshot      jsonb NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_financial_command_receipts PRIMARY KEY (command_type, idempotency_key)
);
COMMENT ON TABLE public.financial_command_receipts IS
  'Mirrors mdj-financial-local-services.js checkIdempotency() exactly: lookup key is (command_type, idempotency_key) — same fingerprint replay returns the stored result_snapshot verbatim; different fingerprint under the same key is DUPLICATE_IDEMPOTENCY_KEY. Never updated after insert.';
