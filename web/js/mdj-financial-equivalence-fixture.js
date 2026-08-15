/**
 * TICKET-V1-FINANCIAL-LEGACY-CANONICAL-EQUIVALENCE-HARNESS-007E
 * Synthetic fixture — 20 scenarios required by
 * docs/tickets/TICKET-V1-FINANCIAL-CANONICAL-ALIGNMENT-PREINTEGRATION-GATES-007C.md
 * Bloque 4/5.
 *
 * Every value here is fictitious: fake ids, round numbers, no real venue/DJ/
 * client name, no date correlated with any real operation. Nothing in this
 * file is derived from mdjb_accounting_local_v1 or Supabase.
 *
 * Each scenario has `legacy` (the input the adapter receives, or `null`
 * when no legacy state can represent the canonical fact — a real coverage
 * gap, reported honestly rather than faked) and `expected` (the canonical
 * fact this scenario is supposed to demonstrate, authored independently of
 * the adapter so the harness never validates the adapter against its own
 * output). `expectedUnmappedFields` lists the field names the adapter is
 * expected to flag as UNMAPPED for this scenario — anything the adapter
 * flags that isn't in this list, or fails to flag that is, is a divergence.
 */
(function (global) {
  'use strict';

  var SCENARIOS = [
    {
      id: 1,
      name: 'Payable abierto',
      kind: 'payment',
      legacy: {
        id: 'fx-pay-01', payeeId: 'fx-payee-01', paymentType: 'contractor_payment', concept: '',
        amount: 500, paidAmount: 0, currency: 'USD', scheduledDate: '2030-01-10', paidDate: '',
        status: 'draft', paymentMethod: 'ach', reference: '', agreementId: null, performanceId: 'fx-perf-01',
        recordedBy: 'fx-staff-01', createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-01T00:00:00.000Z'
      },
      expected: {
        canonicalPayment: null,
        canonicalPayable: { status: 'PENDING', amountCents: 50000, currency: 'USD', sourceId: 'fx-perf-01' }
      },
      expectedUnmappedFields: []
    },
    {
      id: 2,
      name: 'Payable parcialmente pagado',
      kind: 'payment',
      legacy: {
        id: 'fx-pay-02', payeeId: 'fx-payee-02', paymentType: 'contractor_payment', concept: '',
        amount: 500, paidAmount: 200, currency: 'USD', scheduledDate: '2030-01-10', paidDate: '2030-01-05',
        status: 'partial', paymentMethod: 'check', reference: 'FX-REF-02', agreementId: null, performanceId: 'fx-perf-02',
        recordedBy: 'fx-staff-01', createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-05T00:00:00.000Z'
      },
      expected: {
        /* amountCents = paidAmountCents (20000), not the full obligation (50000) —
         * Payment represents money actually moved, not the obligation it's applied
         * against; corrected 2026-08-09 alongside the Gate 2 adapter fix (see
         * docs/validation-legacy-readonly-adapter-cross-validation-gate2-007d-2026-08-09/),
         * this fixture case was authored before that fix and encoded the old,
         * overstating behavior. */
        canonicalPayment: { status: 'CONFIRMED', amountCents: 20000, currency: 'USD', direction: 'OUTFLOW' },
        canonicalPayable: { status: 'PARTIALLY_PAID', amountCents: 50000, allocatedCents: 20000, remainingCents: 30000, currency: 'USD' }
      },
      expectedUnmappedFields: ['paidAmount']
    },
    {
      id: 3,
      name: 'Payable pagado',
      kind: 'payment',
      legacy: {
        id: 'fx-pay-03', payeeId: 'fx-payee-03', paymentType: 'vendor_payment', concept: '',
        amount: 300, paidAmount: 300, currency: 'USD', scheduledDate: '2030-01-10', paidDate: '2030-01-08',
        status: 'paid', paymentMethod: 'zelle', reference: 'FX-REF-03', agreementId: null, performanceId: 'fx-perf-03',
        recordedBy: '', createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-08T00:00:00.000Z'
      },
      expected: {
        canonicalPayment: { status: 'CONFIRMED', amountCents: 30000, currency: 'USD', direction: 'OUTFLOW' },
        canonicalPayable: { status: 'PAID', amountCents: 30000, allocatedCents: 30000, remainingCents: 0, currency: 'USD' }
      },
      expectedUnmappedFields: []
    },
    {
      id: 4,
      name: 'VenueReceivable abierto',
      kind: 'venuePayment',
      legacy: {
        id: 'fx-vpay-04', venueId: 'fx-venue-01', agreementId: 'fx-agr-01', occurrenceId: 'fx-occ-04',
        amount: 350, currency: 'USD', status: 'pending', performanceDate: '2030-01-10',
        concept: '', createdAt: '2030-01-01T00:00:00.000Z'
      },
      expected: {
        canonicalVenueReceivable: { status: 'OPEN', amountCents: 35000, allocatedCents: 0, remainingCents: 35000, currency: 'USD', occurrenceId: 'fx-occ-04' }
      },
      expectedUnmappedFields: []
    },
    {
      id: 5,
      name: 'VenueReceivable parcialmente cobrado',
      kind: 'venuePayment',
      legacy: null,
      expected: {
        canonicalVenueReceivable: { status: 'PARTIALLY_PAID', amountCents: 40000, allocatedCents: 15000, remainingCents: 25000, currency: 'USD' }
      },
      expectedUnmappedFields: [],
      noLegacySourceReason: 'NO_LEGACY_PARTIAL_RECEIVABLE_STATUS — accounting-module.js VenuePayment only ever sets status to \'pending\' or \'received\' (grep-verified, 007A/007D); there is no legacy state representing a partially-collected venue receivable, so no legacy fixture can produce this canonical fact.'
    },
    {
      id: 6,
      name: 'VenueReceivable cobrado',
      kind: 'venuePayment',
      legacy: {
        id: 'fx-vpay-06', venueId: 'fx-venue-02', agreementId: null, occurrenceId: 'fx-occ-06',
        amount: 200, currency: 'USD', status: 'received', performanceDate: '2030-01-10', createdAt: '2030-01-01T00:00:00.000Z'
      },
      expected: {
        canonicalVenueReceivable: { status: 'PAID', amountCents: 20000, allocatedCents: 20000, remainingCents: 0, currency: 'USD' }
      },
      expectedUnmappedFields: []
    },
    {
      id: 7,
      name: 'Payment PENDING',
      kind: 'payment',
      legacy: null,
      expected: {
        canonicalPayment: { status: 'PENDING', amountCents: 10000, currency: 'USD', direction: 'OUTFLOW' }
      },
      expectedUnmappedFields: [],
      noLegacySourceReason: 'NO_LEGACY_UNCONFIRMED_MOVEMENT_STATUS — legacy Payment has no state between "not yet attempted" (draft/scheduled/pending_approval, which the adapter correctly translates to canonicalPayment=null, no movement recorded) and "attempted with a known outcome" (partial/paid/failed). Canonical Payment.status=PENDING ("recordPayment called, not yet confirmed") has no legacy analog by design of the current legacy status vocabulary — a genuine, reportable coverage gap, not an adapter defect.'
    },
    {
      id: 8,
      name: 'Payment CONFIRMED',
      kind: 'payment',
      legacy: {
        id: 'fx-pay-08', payeeId: 'fx-payee-08', paymentType: 'salary', concept: '',
        amount: 400, paidAmount: 400, currency: 'USD', scheduledDate: '2030-01-10', paidDate: '2030-01-10',
        status: 'completed', paymentMethod: 'wire', reference: 'FX-REF-08', agreementId: null, performanceId: null,
        recordedBy: '', createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-10T00:00:00.000Z'
      },
      expected: {
        canonicalPayment: { status: 'CONFIRMED', amountCents: 40000, currency: 'USD', direction: 'OUTFLOW' },
        canonicalPayable: { status: 'PAID', amountCents: 40000, allocatedCents: 40000, remainingCents: 0, currency: 'USD' }
      },
      expectedUnmappedFields: ['sourceType'],
      notes: 'No performanceId/agreementId on this legacy fixture -> adapter cannot resolve sourceType from business context, defaults to EXPENSE and flags it (by design, not inferred).'
    },
    {
      id: 9,
      name: 'Payment FAILED',
      kind: 'payment',
      legacy: {
        id: 'fx-pay-09', payeeId: 'fx-payee-09', paymentType: 'contractor_payment', concept: '',
        amount: 150, paidAmount: 0, currency: 'USD', scheduledDate: '2030-01-10', paidDate: '',
        status: 'failed', paymentMethod: 'ach', reference: '', agreementId: null, performanceId: null,
        recordedBy: '', createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-09T00:00:00.000Z'
      },
      expected: {
        canonicalPayment: { status: 'FAILED', amountCents: 15000, currency: 'USD', direction: 'OUTFLOW' },
        canonicalPayable: { status: 'PENDING', amountCents: 15000, allocatedCents: 0, remainingCents: 15000, currency: 'USD' }
      },
      expectedUnmappedFields: ['sourceType']
    },
    {
      id: 10,
      name: 'PaymentAllocation',
      kind: 'allocation',
      legacy: {
        id: 'fx-alloc-10', idempotencyKey: null, executionId: 'fx-exec-10', paymentId: 'fx-pay-03',
        receivableId: 'fx-vpay-06', payableId: null, occurrenceId: null, agreementId: null,
        amountAllocated: 200, remainingBalance: 0, currency: 'USD', previousStatus: null,
        newStatus: 'active', status: 'active', reconciliationStatus: 'unreviewed',
        allocatedBy: 'fx-staff-01', reference: 'FX-REF-10', concept: '', category: 'vendor_payment',
        createdAt: '2030-01-08T00:00:00.000Z'
      },
      expected: {
        canonicalPaymentAllocation: { targetType: 'VENUE_RECEIVABLE', amountCents: 20000, direction: 'APPLY' }
      },
      expectedUnmappedFields: ['category', 'reference', 'reconciliationStatus'],
      notes: 'Canonical PaymentAllocation (§6) has no currency field at all — only id/paymentId/targetType/targetId/amountCents/direction/reversalOfAllocationId/idempotencyKey/createdAt/createdBy — so currency is intentionally not part of the expected shape here.'
    },
    {
      id: 11,
      name: 'Recurring Payment',
      kind: 'recurring',
      legacy: {
        id: 'fx-rp-11', payeeId: 'fx-payee-11', title: 'Fixture rent', category: 'operations',
        frequency: 'monthly', amount: 1000, currency: 'USD', effectiveFrom: '2030-01-01',
        effectiveUntil: '', nextRunDate: '2030-01-01', paymentMethod: 'check', status: 'active'
      },
      expected: {
        canonicalEntity: null,
        normalizedAmountCents: 100000
      },
      expectedUnmappedFields: ['entity'],
      noLegacySourceReason: 'NO_CANONICAL_RECURRENCE_ENTITY — the Canonical Financial Core has no recurring-rule entity at all (007C Bloque 2: Scheduler = KEEP); this is not a legacy gap, it is a Core gap by design — the recurrence itself never becomes a canonical fact, only the Occurrence/Payable/VenueReceivable it eventually produces.'
    },
    {
      id: 12,
      name: 'Legacy Payment híbrido (obligación+movimiento en una fila)',
      kind: 'payment',
      legacy: {
        id: 'fx-pay-12', payeeId: 'fx-payee-12', paymentType: 'contractor_payment', concept: 'fixture concept',
        amount: 800, paidAmount: 320, currency: 'USD', scheduledDate: '2030-02-01', paidDate: '2030-01-20',
        status: 'partial', paymentMethod: 'cash', reference: '', agreementId: 'fx-agr-12', performanceId: 'fx-perf-12',
        recordedBy: 'fx-staff-02', createdAt: '2030-01-15T00:00:00.000Z', updatedAt: '2030-01-20T00:00:00.000Z'
      },
      expected: {
        /* amountCents = paidAmountCents (32000), not the full obligation (80000) —
         * same correction as case 2, see note there. */
        canonicalPayment: { status: 'CONFIRMED', amountCents: 32000, currency: 'USD', direction: 'OUTFLOW' },
        canonicalPayable: { status: 'PARTIALLY_PAID', amountCents: 80000, allocatedCents: 32000, remainingCents: 48000, currency: 'USD', agreementId: 'fx-agr-12', sourceId: 'fx-perf-12' }
      },
      expectedUnmappedFields: ['concept', 'paidAmount']
    },
    {
      id: 13,
      name: 'Legacy VenuePayment',
      kind: 'venuePayment',
      legacy: {
        id: 'fx-vpay-13', venueId: 'fx-venue-03', agreementId: 'fx-agr-13', occurrenceId: 'fx-occ-13',
        amount: 275, currency: 'USD', status: 'pending', performanceDate: '2030-01-12',
        concept: 'fixture weekly gig', createdAt: '2030-01-05T00:00:00.000Z'
      },
      expected: {
        canonicalVenueReceivable: { status: 'OPEN', amountCents: 27500, currency: 'USD', occurrenceId: 'fx-occ-13', agreementId: 'fx-agr-13' }
      },
      expectedUnmappedFields: ['concept']
    },
    {
      id: 14,
      name: 'Currency (no-USD)',
      kind: 'payment',
      legacy: {
        id: 'fx-pay-14', payeeId: 'fx-payee-14', paymentType: 'contractor_payment', concept: '',
        amount: 90, paidAmount: 90, currency: 'eur', scheduledDate: '2030-01-10', paidDate: '2030-01-10',
        status: 'paid', paymentMethod: 'wire', reference: '', agreementId: null, performanceId: null,
        recordedBy: '', createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-10T00:00:00.000Z'
      },
      expected: {
        canonicalPayment: { status: 'CONFIRMED', amountCents: 9000, currency: 'EUR', direction: 'OUTFLOW' },
        canonicalPayable: { status: 'PAID', amountCents: 9000, currency: 'EUR' }
      },
      expectedUnmappedFields: ['sourceType']
    },
    {
      id: 15,
      name: 'Idempotency (determinism)',
      kind: 'allocation',
      legacy: {
        id: 'fx-alloc-15', idempotencyKey: 'fx-fixed-key-15', executionId: 'fx-exec-15', paymentId: 'fx-pay-15',
        receivableId: null, payableId: 'fx-pay-other-15', amountAllocated: 100, currency: 'USD',
        createdAt: '2030-01-10T00:00:00.000Z'
      },
      expected: {
        canonicalPaymentAllocation: { targetType: 'PAYABLE', amountCents: 10000, direction: 'APPLY' }
      },
      expectedUnmappedFields: [],
      idempotencyCheck: true
    },
    {
      id: 16,
      name: 'OccurrenceId (presente en VenuePayment, ausente en Payment)',
      kind: 'venuePayment',
      legacy: {
        id: 'fx-vpay-16', venueId: 'fx-venue-04', agreementId: null, occurrenceId: 'fx-occ-16',
        amount: 120, currency: 'USD', status: 'pending', createdAt: '2030-01-01T00:00:00.000Z'
      },
      expected: {
        canonicalVenueReceivable: { status: 'OPEN', amountCents: 12000, currency: 'USD', occurrenceId: 'fx-occ-16' }
      },
      expectedUnmappedFields: []
    },
    {
      id: 17,
      name: 'AgreementId (presente en Payment)',
      kind: 'payment',
      legacy: {
        id: 'fx-pay-17', payeeId: 'fx-payee-17', paymentType: 'contractor_payment', concept: '',
        amount: 60, paidAmount: 0, currency: 'USD', scheduledDate: '2030-01-10', paidDate: '',
        status: 'draft', paymentMethod: 'ach', reference: '', agreementId: 'fx-agr-17', performanceId: null,
        recordedBy: '', createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-01T00:00:00.000Z'
      },
      expected: {
        canonicalPayment: null,
        canonicalPayable: { status: 'PENDING', amountCents: 6000, currency: 'USD', agreementId: 'fx-agr-17' }
      },
      expectedUnmappedFields: []
    },
    {
      id: 18,
      name: 'Campos opcionales ausentes (reference/memo vacíos, sin recordedBy)',
      kind: 'payment',
      legacy: {
        id: 'fx-pay-18', payeeId: 'fx-payee-18', paymentType: 'contractor_payment', concept: '',
        amount: 45, paidAmount: 0, currency: 'USD', scheduledDate: '2030-01-10', paidDate: '',
        status: 'draft', paymentMethod: 'cash', reference: '', agreementId: null, performanceId: null,
        recordedBy: '', createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-01T00:00:00.000Z'
      },
      expected: {
        canonicalPayment: null,
        canonicalPayable: { status: 'PENDING', amountCents: 4500, currency: 'USD' }
      },
      expectedUnmappedFields: ['sourceType']
    },
    {
      id: 19,
      name: 'Campos inexistentes (paidAmount undefined — dato legacy incompleto)',
      kind: 'payment',
      legacy: {
        id: 'fx-pay-19', payeeId: 'fx-payee-19', paymentType: 'contractor_payment', concept: '',
        amount: 70, currency: 'USD', scheduledDate: '2030-01-10', paidDate: '2030-01-10',
        status: 'paid', paymentMethod: 'ach', reference: '', agreementId: null, performanceId: null,
        recordedBy: '', createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-10T00:00:00.000Z'
        /* paidAmount intentionally absent */
      },
      expected: {
        /* amountCents = paidAmountCents (0, since paidAmount is missing and treated
         * as 0 — never inferred as "fully paid" just because legacy.status='paid'),
         * not the full obligation (7000). Same correction as case 2 — see note
         * there. A Payment record with amountCents=0 alongside a PARTIALLY_PAID
         * Payable is the correct canonical shape for "legacy claims paid but has
         * no paidAmount to back it": zero money is evidenced as having moved. */
        canonicalPayment: { status: 'CONFIRMED', amountCents: 0, currency: 'USD' },
        canonicalPayable: { status: 'PARTIALLY_PAID', amountCents: 7000, allocatedCents: 0, remainingCents: 7000, currency: 'USD' }
      },
      expectedUnmappedFields: ['sourceType', 'paidAmount'],
      notes: 'paidAmount missing is treated as 0 by the adapter (never inferred as "fully paid" just because legacy.status=\'paid\'); since amount(7000) != treated-paidAmount(0), the obligation is derived as PARTIALLY_PAID with allocatedCents=0, and the Payment movement itself is amountCents=0 — exposing that legacy\'s own status claim ("paid") is not backed by its own paidAmount data. This is a real divergence-of-fact the harness must surface, not silently resolve in favor of legacy\'s claim.'
    },
    {
      id: 20,
      name: 'UNMAPPED (refunded — sin estructura compuesta fabricada)',
      kind: 'payment',
      legacy: {
        id: 'fx-pay-20', payeeId: 'fx-payee-20', paymentType: 'contractor_payment', concept: '',
        amount: 55, paidAmount: 55, currency: 'USD', scheduledDate: '2030-01-10', paidDate: '2030-01-10',
        status: 'refunded', paymentMethod: 'ach', reference: '', agreementId: null, performanceId: null,
        recordedBy: '', createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-12T00:00:00.000Z'
      },
      expected: {
        canonicalPayment: null,
        canonicalPayable: null
      },
      expectedUnmappedFields: ['status']
    }
  ];

  var api = { SCENARIOS: SCENARIOS };

  global.MDJFinancialEquivalenceFixture = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
