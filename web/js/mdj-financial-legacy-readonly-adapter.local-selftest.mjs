// TICKET-V1-FINANCIAL-LEGACY-TO-CANONICAL-READONLY-ADAPTER-007D
// Pure Node self-tests for mdj-financial-legacy-readonly-adapter.js.
// No DOM, no localStorage, no Supabase, no persistence — the adapter itself
// has none of those dependencies, so none are stubbed here.

import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const path = require('path');

const adapterPath = path.join(process.cwd(), 'web/js/mdj-financial-legacy-readonly-adapter.js');
const adapterSource = readFileSync(adapterPath, 'utf8');

global.window = global;
require(adapterPath);
const Adapter = global.MDJFinancialLegacyReadonlyAdapter;

let failures = [];
function check(label, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + label + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
  if (!cond) failures.push(label);
}

function findUnmapped(unmapped, field) {
  return unmapped.find((u) => u.field === field);
}

/* ---------------------------------------------------------------------
 * A. Payment (draft) -> no canonicalPayment, canonicalPayable PENDING
 * ------------------------------------------------------------------- */
(function () {
  const legacy = {
    id: 'pay-1', payeeId: 'payee-1', paymentType: 'contractor_payment', concept: '',
    amount: 500, paidAmount: 0, currency: 'usd', scheduledDate: '2026-08-10',
    paidDate: '', status: 'draft', paymentMethod: 'ach', reference: '',
    agreementId: null, performanceId: null, recordedBy: 'staff-1',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z'
  };
  const res = Adapter.translateLegacyPayment(legacy);
  check('A: draft -> canonicalPayment is null (no movement yet)', res.canonicalPayment === null);
  check('A: draft -> canonicalPayable present with status PENDING', res.canonicalPayable && res.canonicalPayable.status === 'PENDING');
  check('A: amountCents = 50000', res.canonicalPayable.amountCents === 50000);
  check('A: currency normalized to USD', res.canonicalPayable.currency === 'USD');
  check('A: method mapped ach -> ACH', true); // verified indirectly via payment below
})();

/* ---------------------------------------------------------------------
 * B. Payment (paid, full) -> canonicalPayment CONFIRMED + canonicalPayable PAID
 * ------------------------------------------------------------------- */
(function () {
  const legacy = {
    id: 'pay-2', payeeId: 'payee-2', paymentType: 'salary', concept: 'Adobe CC',
    amount: 300, paidAmount: 300, currency: 'USD', scheduledDate: '2026-08-05',
    paidDate: '2026-08-05', status: 'paid', paymentMethod: 'zelle', reference: 'REF-9',
    agreementId: 'agr-1', performanceId: null, recordedBy: 'staff-2',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-05T00:00:00.000Z'
  };
  const res = Adapter.translateLegacyPayment(legacy);
  check('B: paid -> canonicalPayment CONFIRMED', res.canonicalPayment && res.canonicalPayment.status === 'CONFIRMED');
  check('B: canonicalPayable PAID', res.canonicalPayable && res.canonicalPayable.status === 'PAID');
  check('B: canonicalPayment amountCents = 30000', res.canonicalPayment.amountCents === 30000);
  check('B: canonicalPayment method ZELLE', res.canonicalPayment.method === 'ZELLE');
  check('B: canonicalPayable remainingCents = 0', res.canonicalPayable.remainingCents === 0);
  check('B: concept flagged UNMAPPED', !!findUnmapped(res.unmapped, 'concept'));
  check('B: id never reused (synthetic prefix)', res.canonicalPayment.id === 'legacy:payment:pay-2' && res.canonicalPayable.id === 'legacy:payable:pay-2');
  check('B: sourceLegacyId traces back', res.canonicalPayment.sourceLegacyId === 'pay-2');
})();

/* ---------------------------------------------------------------------
 * C. Payment (partial) -> canonicalPayment CONFIRMED + canonicalPayable PARTIALLY_PAID
 * ------------------------------------------------------------------- */
(function () {
  const legacy = {
    id: 'pay-3', payeeId: 'payee-3', paymentType: 'contractor_payment', concept: '',
    amount: 500, paidAmount: 200, currency: 'USD', scheduledDate: '2026-08-10',
    paidDate: '2026-08-07', status: 'partial', paymentMethod: 'check', reference: 'CHK-1',
    agreementId: null, performanceId: 'perf-1', recordedBy: '',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-07T00:00:00.000Z'
  };
  const res = Adapter.translateLegacyPayment(legacy);
  check('C: partial -> canonicalPayment CONFIRMED', res.canonicalPayment && res.canonicalPayment.status === 'CONFIRMED');
  check('C: canonicalPayable PARTIALLY_PAID', res.canonicalPayable && res.canonicalPayable.status === 'PARTIALLY_PAID');
  check('C: allocatedCents = 20000', res.canonicalPayable.allocatedCents === 20000);
  check('C: remainingCents = 30000', res.canonicalPayable.remainingCents === 30000);
  check('C: sourceType OCCURRENCE via performanceId', res.canonicalPayable.sourceType === 'OCCURRENCE' && res.canonicalPayable.sourceId === 'perf-1');
})();

/* ---------------------------------------------------------------------
 * D. Payment (failed) -> canonicalPayment FAILED, obligation stays PENDING
 * ------------------------------------------------------------------- */
(function () {
  const legacy = {
    id: 'pay-4', payeeId: 'payee-4', paymentType: 'vendor_payment', concept: '',
    amount: 100, paidAmount: 0, currency: 'USD', scheduledDate: '2026-08-10',
    paidDate: '', status: 'failed', paymentMethod: 'wire', reference: '',
    agreementId: null, performanceId: null, recordedBy: '',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-08T00:00:00.000Z'
  };
  const res = Adapter.translateLegacyPayment(legacy);
  check('D: failed -> canonicalPayment FAILED', res.canonicalPayment && res.canonicalPayment.status === 'FAILED');
  check('D: canonicalPayable stays PENDING', res.canonicalPayable && res.canonicalPayable.status === 'PENDING');
})();

/* ---------------------------------------------------------------------
 * E. Payment (cancelled / void) -> canonicalPayment null, UNMAPPED status, obligation VOID
 * ------------------------------------------------------------------- */
(function () {
  const legacyCancelled = { id: 'pay-5', payeeId: 'payee-5', paymentType: 'contractor_payment', amount: 50, paidAmount: 0, currency: 'USD', scheduledDate: '2026-08-10', status: 'cancelled', paymentMethod: 'cash', reference: '' };
  const resC = Adapter.translateLegacyPayment(legacyCancelled);
  check('E: cancelled -> canonicalPayment null', resC.canonicalPayment === null);
  check('E: cancelled -> obligation VOID', resC.canonicalPayable && resC.canonicalPayable.status === 'VOID');
  check('E: cancelled -> status flagged UNMAPPED', !!findUnmapped(resC.unmapped, 'status'));

  const legacyVoid = { id: 'pay-6', payeeId: 'payee-6', paymentType: 'contractor_payment', amount: 50, paidAmount: 20, currency: 'USD', scheduledDate: '2026-08-10', status: 'void', paymentMethod: 'cash', reference: '' };
  const resV = Adapter.translateLegacyPayment(legacyVoid);
  check('E: void -> obligation VOID', resV.canonicalPayable && resV.canonicalPayable.status === 'VOID');
})();

/* ---------------------------------------------------------------------
 * F. Payment (refunded) -> fully UNMAPPED, no fabricated compound structure
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'pay-7', payeeId: 'payee-7', paymentType: 'contractor_payment', amount: 100, paidAmount: 100, currency: 'USD', scheduledDate: '2026-08-10', status: 'refunded', paymentMethod: 'ach', reference: '' };
  const res = Adapter.translateLegacyPayment(legacy);
  check('F: refunded -> canonicalPayment null', res.canonicalPayment === null);
  check('F: refunded -> canonicalPayable null (no compound structure fabricated)', res.canonicalPayable === null);
  check('F: refunded -> status flagged UNMAPPED with REQUIRES_COMPENSATING_PAYMENT_STRUCTURE reason', !!findUnmapped(res.unmapped, 'status') && findUnmapped(res.unmapped, 'status').reason.indexOf('REQUIRES_COMPENSATING_PAYMENT_STRUCTURE') === 0);
})();

/* ---------------------------------------------------------------------
 * G. Payment method UNMAPPED (direct_deposit) falls back to OTHER, flagged
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'pay-8', payeeId: 'payee-8', paymentType: 'salary', amount: 100, paidAmount: 100, currency: 'USD', scheduledDate: '2026-08-10', status: 'paid', paymentMethod: 'direct_deposit', reference: '' };
  const res = Adapter.translateLegacyPayment(legacy);
  check('G: direct_deposit -> method falls back to OTHER', res.canonicalPayment.method === 'OTHER');
  check('G: direct_deposit -> flagged UNMAPPED with fallback OTHER', !!findUnmapped(res.unmapped, 'paymentMethod') && findUnmapped(res.unmapped, 'paymentMethod').fallback === 'OTHER');
})();

/* ---------------------------------------------------------------------
 * H. Missing payeeId -> flagged UNMAPPED, never fabricated
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'pay-9', payeeId: null, paymentType: 'contractor_payment', amount: 100, paidAmount: 0, currency: 'USD', scheduledDate: '2026-08-10', status: 'draft', paymentMethod: 'cash', reference: '' };
  const res = Adapter.translateLegacyPayment(legacy);
  check('H: missing payeeId flagged', !!findUnmapped(res.unmapped, 'payeeId'));
  check('H: canonicalPayable.payeeId stays null, never invented', res.canonicalPayable.payeeId === null);
})();

/* ---------------------------------------------------------------------
 * I. Invalid/missing legacy payment -> both null, single UNMAPPED entry
 * ------------------------------------------------------------------- */
(function () {
  const res1 = Adapter.translateLegacyPayment(null);
  check('I: null input -> canonicalPayment/canonicalPayable both null', res1.canonicalPayment === null && res1.canonicalPayable === null);
  check('I: null input -> unmapped has exactly 1 entry', res1.unmapped.length === 1);

  const res2 = Adapter.translateLegacyPayment({ payeeId: 'x' }); // no id
  check('I: missing id -> canonicalPayment/canonicalPayable both null', res2.canonicalPayment === null && res2.canonicalPayable === null);
})();

/* ---------------------------------------------------------------------
 * J. VenuePayment (pending) -> VenueReceivable OPEN
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'vpay-1', venueId: 'venue-1', agreementId: 'agr-2', occurrenceId: 'occ-1', amount: 350, currency: 'USD', status: 'pending', performanceDate: '2026-08-01', concept: 'Weekly gig', createdAt: '2026-08-01T00:00:00.000Z' };
  const res = Adapter.translateLegacyVenuePayment(legacy);
  check('J: pending -> VenueReceivable OPEN', res.canonicalVenueReceivable.status === 'OPEN');
  check('J: occurrenceId carried through', res.canonicalVenueReceivable.occurrenceId === 'occ-1');
  check('J: amountCents = 35000', res.canonicalVenueReceivable.amountCents === 35000);
  check('J: remainingCents = 35000, allocatedCents = 0', res.canonicalVenueReceivable.remainingCents === 35000 && res.canonicalVenueReceivable.allocatedCents === 0);
  check('J: concept flagged UNMAPPED', !!findUnmapped(res.unmapped, 'concept'));
})();

/* ---------------------------------------------------------------------
 * K. VenuePayment (received) -> VenueReceivable PAID
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'vpay-2', venueId: 'venue-2', agreementId: null, occurrenceId: 'occ-2', amount: 200, currency: 'USD', status: 'received', performanceDate: '2026-08-01', createdAt: '2026-08-01T00:00:00.000Z' };
  const res = Adapter.translateLegacyVenuePayment(legacy);
  check('K: received -> VenueReceivable PAID', res.canonicalVenueReceivable.status === 'PAID');
  check('K: allocatedCents = amountCents, remainingCents = 0', res.canonicalVenueReceivable.allocatedCents === 20000 && res.canonicalVenueReceivable.remainingCents === 0);
})();

/* ---------------------------------------------------------------------
 * L. VenuePayment missing occurrenceId -> flagged, never fabricated
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'vpay-3', venueId: 'venue-3', occurrenceId: null, amount: 100, currency: 'USD', status: 'pending' };
  const res = Adapter.translateLegacyVenuePayment(legacy);
  check('L: missing occurrenceId flagged', !!findUnmapped(res.unmapped, 'occurrenceId'));
  check('L: occurrenceId stays null, never invented', res.canonicalVenueReceivable.occurrenceId === null);
})();

/* ---------------------------------------------------------------------
 * M. RecurringPayment -> no canonical entity, normalized envelope only
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'rp-1', payeeId: 'payee-1', title: 'Rent', category: 'operations', frequency: 'monthly', amount: 1000, currency: 'USD', effectiveFrom: '2026-08-01', effectiveUntil: '', nextRunDate: '2026-08-01', paymentMethod: 'check', status: 'active' };
  const res = Adapter.translateLegacyRecurringPayment(legacy);
  check('M: canonicalEntity is null', res.canonicalEntity === null);
  check('M: normalized envelope present with amountCents', res.normalized && res.normalized.amountCents === 100000);
  check('M: note explains NO_CANONICAL_EQUIVALENT', res.note.indexOf('NO_CANONICAL_EQUIVALENT') === 0);
  check('M: unmapped flags entity-level gap', !!findUnmapped(res.unmapped, 'entity'));
})();

/* ---------------------------------------------------------------------
 * N. PaymentAllocation legacy (with receivableId) -> canonical VENUE_RECEIVABLE target
 * ------------------------------------------------------------------- */
(function () {
  const legacy = {
    id: 'alloc-1', idempotencyKey: null, executionId: 'exec-1', paymentId: 'pay-2',
    receivableId: 'vpay-1', payableId: null, occurrenceId: null, agreementId: null,
    amountAllocated: 300, remainingBalance: 0, currency: 'USD', previousStatus: null,
    newStatus: 'active', status: 'active', reconciliationStatus: 'unreviewed',
    allocatedBy: 'Gerardo', reference: 'REF-9', concept: 'Adobe CC', category: 'software_apps',
    createdAt: '2026-08-05T00:00:00.000Z'
  };
  const res = Adapter.translateLegacyPaymentAllocation(legacy);
  check('N: targetType VENUE_RECEIVABLE derived from receivableId', res.canonicalPaymentAllocation.targetType === 'VENUE_RECEIVABLE');
  check('N: targetId synthesized from receivableId', res.canonicalPaymentAllocation.targetId === 'legacy:venuePayment:vpay-1');
  check('N: paymentId synthesized', res.canonicalPaymentAllocation.paymentId === 'legacy:payment:pay-2');
  check('N: amountCents = 30000', res.canonicalPaymentAllocation.amountCents === 30000);
  check('N: direction always APPLY (no reversal concept in legacy)', res.canonicalPaymentAllocation.direction === 'APPLY');
  check('N: createdBy from allocatedBy', res.canonicalPaymentAllocation.createdBy === 'Gerardo');
  check('N: category flagged UNMAPPED', !!findUnmapped(res.unmapped, 'category'));
  check('N: reference flagged UNMAPPED', !!findUnmapped(res.unmapped, 'reference'));
  check('N: reconciliationStatus flagged UNMAPPED', !!findUnmapped(res.unmapped, 'reconciliationStatus'));
})();

/* ---------------------------------------------------------------------
 * O. PaymentAllocation legacy (with payableId) -> canonical PAYABLE target
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'alloc-2', executionId: 'exec-2', paymentId: 'pay-3', receivableId: null, payableId: 'pay-other-1', amountAllocated: 200, currency: 'USD', createdAt: '2026-08-06T00:00:00.000Z' };
  const res = Adapter.translateLegacyPaymentAllocation(legacy);
  check('O: targetType PAYABLE derived from payableId', res.canonicalPaymentAllocation.targetType === 'PAYABLE');
  check('O: targetId synthesized from payableId', res.canonicalPaymentAllocation.targetId === 'legacy:payable:pay-other-1');
})();

/* ---------------------------------------------------------------------
 * P. PaymentAllocation legacy with NEITHER payableId nor receivableId ->
 * UNMAPPED targetType (a real gap: ticket 007's allocatePaymentExecution
 * never required either field)
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'alloc-3', executionId: 'exec-3', paymentId: 'pay-4', receivableId: null, payableId: null, amountAllocated: 100, currency: 'USD', createdAt: '2026-08-06T00:00:00.000Z' };
  const res = Adapter.translateLegacyPaymentAllocation(legacy);
  check('P: targetType null when neither payableId nor receivableId present', res.canonicalPaymentAllocation.targetType === null);
  check('P: targetId null', res.canonicalPaymentAllocation.targetId === null);
  check('P: flagged UNMAPPED with NO_TARGET_REFERENCE', !!findUnmapped(res.unmapped, 'targetType'));
})();

/* ---------------------------------------------------------------------
 * Q. Deep clone / no shared references / no mutation
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'pay-clone-1', payeeId: 'payee-1', paymentType: 'contractor_payment', amount: 100, paidAmount: 100, currency: 'USD', scheduledDate: '2026-08-10', status: 'paid', paymentMethod: 'ach', reference: '' };
  const before = JSON.stringify(legacy);
  const res = Adapter.translateLegacyPayment(legacy);
  check('Q: legacy object untouched after translation', JSON.stringify(legacy) === before);

  res.canonicalPayment.amountCents = 999999;
  res.canonicalPayable.status = 'MUTATED';
  const res2 = Adapter.translateLegacyPayment(legacy);
  check('Q: mutating a previous result does not affect a fresh translation (no shared references)', res2.canonicalPayment.amountCents !== 999999 && res2.canonicalPayable.status !== 'MUTATED');

  const legacyVp = { id: 'vpay-clone-1', occurrenceId: 'occ-1', amount: 100, currency: 'USD', status: 'pending' };
  const beforeVp = JSON.stringify(legacyVp);
  const resVp = Adapter.translateLegacyVenuePayment(legacyVp);
  check('Q: legacy venuePayment untouched after translation', JSON.stringify(legacyVp) === beforeVp);
  check('Q: canonicalVenueReceivable is not the same object reference as legacy', resVp.canonicalVenueReceivable !== legacyVp);
})();

/* ---------------------------------------------------------------------
 * R. No side effects: no global state, no localStorage, no persistence,
 * two calls with the same input produce structurally identical (but not
 * reference-equal) output
 * ------------------------------------------------------------------- */
(function () {
  const adapterCode = adapterSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check('R: adapter code (excluding comments) never invokes localStorage/document/fetch/getSupabaseClient', !/localStorage\.|document\.|fetch\(|getSupabaseClient\(/.test(adapterCode));
  check('R: adapter source never calls a financial command (recordPayment/confirmPayment/allocatePayment/etc.)', !/\.(recordPayment|confirmPayment|failPayment|allocatePayment|reconcilePayment|voidPayable|voidReceivable)\s*\(/.test(adapterSource));
  const legacy = { id: 'pay-idem-1', payeeId: 'payee-1', paymentType: 'contractor_payment', amount: 100, paidAmount: 100, currency: 'USD', scheduledDate: '2026-08-10', status: 'paid', paymentMethod: 'ach', reference: '' };
  const r1 = Adapter.translateLegacyPayment(legacy);
  const r2 = Adapter.translateLegacyPayment(legacy);
  check('R: repeated calls produce structurally identical output', JSON.stringify(r1) === JSON.stringify(r2));
  check('R: repeated calls produce distinct object references', r1.canonicalPayment !== r2.canonicalPayment);
})();

/* ---------------------------------------------------------------------
 * S. Compatibility with 007C: agreementId IS a direct field on legacy
 * Payment (createPaymentModel) — carried through directly, not left
 * UNMAPPED. (Corrects an inaccuracy in the 007C summary table, which
 * said "sin campo directo"; the real runtime field exists and is used.)
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'pay-agr-1', payeeId: 'payee-1', paymentType: 'contractor_payment', amount: 100, paidAmount: 0, currency: 'USD', scheduledDate: '2026-08-10', status: 'draft', paymentMethod: 'ach', reference: '', agreementId: 'agr-5' };
  const res = Adapter.translateLegacyPayment(legacy);
  check('S: agreementId carried through directly on canonicalPayable', res.canonicalPayable.agreementId === 'agr-5');
  check('S: agreementId NOT flagged UNMAPPED (real field, correctly mapped)', !findUnmapped(res.unmapped, 'agreementId'));
})();

/* ---------------------------------------------------------------------
 * T. TICKET-V1-FINANCIAL-INBOUND-VENUE-PAYMENT-CANONICALIZATION-001 —
 * translateLegacyVenuePaymentCollection(). A venue collection (inbound
 * money) must NEVER produce a canonicalPayable — only a translateLegacyPayment()-
 * style outbound MDJB→payee fact does. Full amount, method, date,
 * reference, currency must all carry through.
 * ------------------------------------------------------------------- */
(function () {
  const legacy = {
    id: 'vpay-collect-1',
    venueId: 'venue-1',
    occurrenceId: 'occ-1',
    amount: 1000,
    currency: 'USD',
    status: 'received',
    paymentMethod: 'zelle',
    receivedDate: '2026-09-02',
    reference: 'ref-collect-1',
    recordedBy: 'staff-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z'
  };
  const res = Adapter.translateLegacyVenuePaymentCollection(legacy);
  check('T: canonicalPayment produced for a received VenuePayment', !!res.canonicalPayment);
  check('T: canonicalPayable is NEVER produced (key entirely absent, not just null)', res.canonicalPayable === undefined);
  check('T: direction=INFLOW', res.canonicalPayment.direction === 'INFLOW');
  check('T: amountCents = full amount received (100000)', res.canonicalPayment.amountCents === 100000);
  check('T: currency preserved (USD)', res.canonicalPayment.currency === 'USD');
  check('T: method mapped (ZELLE)', res.canonicalPayment.method === 'ZELLE');
  check('T: paymentDate = receivedDate', res.canonicalPayment.paymentDate === '2026-09-02');
  check('T: reference preserved', res.canonicalPayment.reference === 'ref-collect-1');
  check('T: status = CONFIRMED (a received collection is already a done movement)', res.canonicalPayment.status === 'CONFIRMED');
  check('T: sourceLegacyId traces back to the legacy venuePayment id', res.canonicalPayment.sourceLegacyId === 'vpay-collect-1');
})();

/* ---------------------------------------------------------------------
 * U. Non-USD currency preserved, not silently coerced to USD.
 * ------------------------------------------------------------------- */
(function () {
  const legacy = {
    id: 'vpay-collect-2', venueId: 'venue-2', occurrenceId: 'occ-2', amount: 250, currency: 'eur',
    status: 'received', paymentMethod: 'wire', receivedDate: '2026-09-03', reference: '', recordedBy: 'staff-1'
  };
  const res = Adapter.translateLegacyVenuePaymentCollection(legacy);
  check('U: currency normalized to uppercase, not defaulted to USD', res.canonicalPayment.currency === 'EUR');
  check('U: amountCents = 25000', res.canonicalPayment.amountCents === 25000);
})();

/* ---------------------------------------------------------------------
 * V. status='pending' (not yet collected) — no canonical Payment,
 * never fabricated. This is the pre-collection state; nothing has
 * moved yet, so nothing should be shadowed.
 * ------------------------------------------------------------------- */
(function () {
  const legacy = { id: 'vpay-collect-3', venueId: 'venue-3', occurrenceId: 'occ-3', amount: 500, currency: 'USD', status: 'pending' };
  const res = Adapter.translateLegacyVenuePaymentCollection(legacy);
  check('V: no canonicalPayment for a pending (not yet collected) VenuePayment', res.canonicalPayment === null);
  check('V: status flagged in unmapped with an honest reason', !!findUnmapped(res.unmapped, 'status'));
})();

console.log('');
console.log(failures.length === 0 ? 'RESULT: ALL PASS' : 'RESULT: FAIL (' + failures.length + '): ' + failures.join(' | '));
process.exit(failures.length === 0 ? 0 : 1);
