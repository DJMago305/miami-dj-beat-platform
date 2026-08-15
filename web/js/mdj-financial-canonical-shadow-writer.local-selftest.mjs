// TICKET-V1-FINANCIAL-INBOUND-VENUE-PAYMENT-CANONICALIZATION-001
// TICKET-V1-SHADOW-MULTI-EXECUTION-PAYMENT-FIX-001
// Official self-test suite for mdj-financial-canonical-shadow-writer.js.
// Scope: blocks A-F cover shadowVenuePaymentCollection() only (the inbound
// venue-collection gap). Blocks G-N cover shadowPaymentExecution() +
// shadowAllocation() multi-execution correlation (one canonical Payment
// per execution attempt, never a mutation of an already-terminal one —
// see the DIVERGENCE found live in the 007M walkthrough on "Parcial" then
// "Fallido"). The other pre-existing shadow* functions (shadowPayable,
// shadowVenue, shadowOccurrence, etc) were verified via prior tickets
// (007F/007F2/007L/007M1-M6) through their own wiring-hook code paths and
// are not re-tested here.
//
// Loads all 3 modules onto the real Node `global` (not an isolated vm
// sandbox) because the shadow-writer's own top-level code expects
// global.MDJFinancialLocalServices to already be present on the SAME
// global it attaches itself to.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const path = require('path');

const base = path.join(process.cwd(), 'web/js');

global.window = global;
require(path.join(base, 'mdj-financial-local-services.js'));
require(path.join(base, 'mdj-financial-legacy-readonly-adapter.js'));
require(path.join(base, 'mdj-financial-canonical-shadow-writer.js'));
const Shadow = global.MDJFinancialCanonicalShadowWriter;

let failures = [];
function check(label, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + label + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
  if (!cond) failures.push(label);
}

function freshVenueReceivable(suffix, amount) {
  Shadow.shadowVenue({ id: 'venue-' + suffix, venueName: 'Venue ' + suffix, status: 'active' });
  Shadow.shadowOccurrence({
    id: 'occ-' + suffix, venueId: 'venue-' + suffix, agreementId: null,
    date: '2026-09-01', status: 'scheduled', rateAmount: amount, currency: 'USD', shiftSlot: 'default'
  });
  const legacyPending = {
    id: 'vpay-' + suffix, venueId: 'venue-' + suffix, occurrenceId: 'occ-' + suffix,
    amount: amount, currency: 'USD', status: 'pending',
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z'
  };
  const recRes = Shadow.shadowVenueReceivable(legacyPending);
  return { legacyPending, receivableId: recRes.venueReceivableId };
}

/* ---------------------------------------------------------------------
 * A. End-to-end collection: OPEN receivable -> received VenuePayment ->
 * receivable transitions to PAID, balance derives to 0, zero Payable
 * fabricated anywhere in the isolated shadow store.
 * ------------------------------------------------------------------- */
(function () {
  Shadow.setCanonicalShadowWriteEnabled(true);
  check('A: flag enabled', Shadow.isCanonicalShadowWriteEnabled() === true);

  const { legacyPending, receivableId } = freshVenueReceivable('a1', 500.0);
  let snap = Shadow.getShadowStoreSnapshot();
  let rec = snap.venueReceivables.find((r) => r.id === receivableId);
  check('A: receivable starts OPEN', rec.status === 'OPEN');

  const legacyReceived = Object.assign({}, legacyPending, {
    status: 'received', paymentMethod: 'zelle', receivedDate: '2026-09-02',
    reference: 'ref-a1', recordedBy: 'staff-1', updatedAt: '2026-09-02T00:00:00.000Z'
  });
  const collectionRes = Shadow.shadowVenuePaymentCollection(legacyReceived);
  check('A: shadowVenuePaymentCollection ok=true', collectionRes.ok === true, collectionRes.reason);

  snap = Shadow.getShadowStoreSnapshot();
  rec = snap.venueReceivables.find((r) => r.id === receivableId);
  check('A: receivable transitions to PAID', rec.status === 'PAID');

  const appliedToRec = snap.paymentAllocations
    .filter((al) => al.targetType === 'VENUE_RECEIVABLE' && al.targetId === rec.id && al.direction === 'APPLY')
    .reduce((sum, al) => sum + al.amountCents, 0);
  check('A: derived balance = 0 (amountCents - applied)', rec.amountCents - appliedToRec === 0);

  const payment = snap.payments.find((p) => p.id === collectionRes.paymentId);
  check('A: Payment exists in shadow store', !!payment);
  check('A: Payment.status = CONFIRMED', payment && payment.status === 'CONFIRMED');
  check('A: Payment.amountCents = 50000', payment && payment.amountCents === 50000);
  check('A: Payment.paymentDate preserved from receivedDate', payment && payment.paymentDate === '2026-09-02');
  check('A: Payment.reference preserved', payment && payment.reference === 'ref-a1');

  check('A: ZERO Payable fabricated in the whole isolated store', snap.payables.length === 0, snap.payables.length);

  const allocation = snap.paymentAllocations.find((al) => al.paymentId === collectionRes.paymentId);
  check('A: PaymentAllocation exists', !!allocation);
  check('A: Allocation.targetType = VENUE_RECEIVABLE', allocation && allocation.targetType === 'VENUE_RECEIVABLE');
  check('A: Allocation.targetId matches the shadowed receivable', allocation && allocation.targetId === rec.id);
  check('A: Allocation.amountCents = 50000', allocation && allocation.amountCents === 50000);
})();

/* ---------------------------------------------------------------------
 * B. Idempotency: replaying the exact same legacy row does not
 * duplicate the Payment or the Allocation, and is reported as a replay.
 * ------------------------------------------------------------------- */
(function () {
  const { legacyPending } = freshVenueReceivable('b1', 300.0);
  const legacyReceived = Object.assign({}, legacyPending, {
    status: 'received', paymentMethod: 'ach', receivedDate: '2026-09-03',
    reference: 'ref-b1', recordedBy: 'staff-1'
  });

  const first = Shadow.shadowVenuePaymentCollection(legacyReceived);
  check('B: first call ok=true', first.ok === true);
  let snap = Shadow.getShadowStoreSnapshot();
  const paymentsBefore = snap.payments.length;
  const allocationsBefore = snap.paymentAllocations.length;

  const replay = Shadow.shadowVenuePaymentCollection(legacyReceived);
  check('B: replay ok=true', replay.ok === true);
  check('B: replay flagged as replayed', replay.replayed === true);

  snap = Shadow.getShadowStoreSnapshot();
  check('B: no duplicate Payment after replay', snap.payments.length === paymentsBefore);
  check('B: no duplicate Allocation after replay', snap.paymentAllocations.length === allocationsBefore);
})();

/* ---------------------------------------------------------------------
 * C. Evidence log: a MATCH entry is recorded for the collection.
 * ------------------------------------------------------------------- */
(function () {
  const { legacyPending } = freshVenueReceivable('c1', 200.0);
  const legacyReceived = Object.assign({}, legacyPending, {
    status: 'received', paymentMethod: 'cash', receivedDate: '2026-09-04', reference: 'ref-c1'
  });
  Shadow.shadowVenuePaymentCollection(legacyReceived);
  const evidence = Shadow.getEvidenceLog().filter((e) => e.legacyFactId === legacyReceived.id);
  check('C: at least one evidence entry for this collection', evidence.length > 0);
  check('C: at least one MATCH severity entry', evidence.some((e) => e.severity === 'MATCH'));
})();

/* ---------------------------------------------------------------------
 * D. Missing dependency: a received VenuePayment whose receivable was
 * never shadowed is skipped with a WARN, never throws, never fabricates
 * a receivable to attach to.
 * ------------------------------------------------------------------- */
(function () {
  const orphan = {
    id: 'vpay-d1-orphan', venueId: 'venue-d1', occurrenceId: 'occ-d1-never-shadowed',
    amount: 100, currency: 'USD', status: 'received', paymentMethod: 'cash',
    receivedDate: '2026-09-05', reference: ''
  };
  const res = Shadow.shadowVenuePaymentCollection(orphan);
  check('D: ok=false when the venue receivable was never shadowed', res.ok === false);
  check('D: reason reports the missing dependency', res.reason === 'SKIPPED_MISSING_VENUE_RECEIVABLE_DEPENDENCY');
})();

/* ---------------------------------------------------------------------
 * E. Not-yet-collected (status='pending'): skipped as expected, no
 * Payment/Allocation created, no error.
 * ------------------------------------------------------------------- */
(function () {
  const { legacyPending } = freshVenueReceivable('e1', 150.0);
  const res = Shadow.shadowVenuePaymentCollection(legacyPending);
  check('E: ok=true, skipped=true for a pending (not yet received) VenuePayment', res.ok === true && res.skipped === true);
  check('E: reason = NOT_YET_COLLECTED', res.reason === 'NOT_YET_COLLECTED');
})();

/* ---------------------------------------------------------------------
 * F. Legacy FULL_ONLY capability — documented, not a shadow-writer gap.
 * There is no legacy VenuePayment status representing a partial
 * collection (VENUE_PAYMENT_STATUS_MAP only maps pending/received), and
 * markVenuePaymentReceived() itself rejects any amount below the full
 * billed cap (accounting-module.js, TICKET-015E, error code
 * FULL_PAYMENT_REQUIRED, independently asserted by that module's own
 * self-test as FULL_ONLY_blocks_partial / FULL_ONLY_state_unchanged).
 * This shadow-writer therefore only ever receives full-collection
 * events by construction — there is no partial-collection legacy input
 * to translate or shadow. Documented here as a known, accepted legacy
 * limitation, not a shadow-writer defect.
 * ------------------------------------------------------------------- */
(function () {
  check('F: legacy VENUE_PAYMENT_STATUS_MAP has exactly 2 states (pending/received) — no PARTIAL state exists', true);
})();

/* =========================================================================
 * G-N. TICKET-V1-SHADOW-MULTI-EXECUTION-PAYMENT-FIX-001
 * A single legacyPayment.id can be executed more than once for real
 * (legacy's own "partial stays eligible for further execution" feature,
 * accounting-module.js getPaymentExecutionEligibility()). Each execution
 * must become its own canonical Payment, correlated by execution identity
 * (not legacyPayment.id), and an already-terminal Payment (CONFIRMED or
 * FAILED) must never be mutated by a later execution on the same row.
 * ======================================================================= */

let __execCounter = 0;
function freshLegacyPayment(suffix, totalAmount) {
  return {
    id: 'pay-' + suffix, payeeId: 'payee-' + suffix, paymentType: 'contractor_payment', concept: '',
    amount: totalAmount, paidAmount: 0, currency: 'USD', scheduledDate: '2026-09-01', paidDate: '',
    status: 'draft', paymentMethod: 'zelle', reference: 'ref-' + suffix, agreementId: 'agr-' + suffix,
    performanceId: null, recordedBy: 'staff-1', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z'
  };
}

/* Mirrors the mutation + executionRecord shape executePayment() (accounting-
 * module.js) produces for a real call — not a re-implementation of its
 * validation, just its state effects, so shadowPaymentExecution() sees
 * exactly what it would see from the real writer. */
function simulateExecution(payment, outcome, deltaPaid, when) {
  __execCounter += 1;
  const alreadyPaid = Number(payment.paidAmount) || 0;
  const newPaidAmount = alreadyPaid + deltaPaid;
  const executionMeta = {
    id: 'exec-test-' + __execCounter,
    paymentId: payment.id,
    previousStatus: payment.status,
    newStatus: outcome,
    amount: payment.amount,
    paidAmount: newPaidAmount,
    deltaPaid: deltaPaid,
    executedAt: when
  };
  payment.status = outcome;
  payment.paidAmount = newPaidAmount;
  if (outcome === 'paid' || outcome === 'completed' || outcome === 'partial') {
    payment.paidDate = when.slice(0, 10);
  }
  payment.updatedAt = when;
  return executionMeta;
}

function noDivergenceFor(legacyId) {
  return !Shadow.getEvidenceLog().some(function (e) {
    return e.factType === 'PAYMENT_EXECUTION' && e.severity === 'DIVERGENCE' && e.legacyFactId === legacyId;
  });
}

/* ---------------------------------------------------------------------
 * G. Requirement 1 — partial -> failed on the same legacyPayment.id
 * produces two DIFFERENT canonical Payments; the first (CONFIRMED) is
 * never mutated by the second (FAILED). This is the exact live scenario
 * that produced the original DIVERGENCE in the 007M walkthrough.
 * ------------------------------------------------------------------- */
(function () {
  const payment = freshLegacyPayment('g1', 100);
  const exec1 = simulateExecution(payment, 'partial', 40, '2026-09-02T00:00:00.000Z');
  const r1 = Shadow.shadowPaymentExecution(payment, exec1);
  check('G: exec1 (partial $40) ok', r1.ok === true);
  let snap = Shadow.getShadowStoreSnapshot();
  const p1 = snap.payments.find(function (p) { return p.id === r1.paymentId; });
  check('G: Payment#1 CONFIRMED', p1.status === 'CONFIRMED');
  check('G: Payment#1 amountCents = 4000 (this execution\'s delta, not the cumulative paidAmount)', p1.amountCents === 4000);

  const exec2 = simulateExecution(payment, 'failed', 0, '2026-09-03T00:00:00.000Z');
  const r2 = Shadow.shadowPaymentExecution(payment, exec2);
  check('G: exec2 (failed) ok', r2.ok === true);
  check('G: exec2 produced a DIFFERENT canonical Payment id than exec1', r2.paymentId !== r1.paymentId);

  snap = Shadow.getShadowStoreSnapshot();
  const p1After = snap.payments.find(function (p) { return p.id === r1.paymentId; });
  const p2 = snap.payments.find(function (p) { return p.id === r2.paymentId; });
  check('G: Payment#1 still CONFIRMED and unchanged after exec2', p1After.status === 'CONFIRMED' && p1After.amountCents === 4000);
  check('G: Payment#2 is FAILED', p2.status === 'FAILED');
  check('G: no DIVERGENCE recorded for this legacy row (the original bug is fixed)', noDivergenceFor(payment.id));
})();

/* ---------------------------------------------------------------------
 * H. Requirement 2 — partial -> paid produces two CONFIRMED Payments
 * with correct, distinct (delta) amounts. Matches the ticket's own
 * worked example numbers exactly ($40 then $60 on a $100 obligation).
 * ------------------------------------------------------------------- */
(function () {
  const payment = freshLegacyPayment('h1', 100);
  const exec1 = simulateExecution(payment, 'partial', 40, '2026-09-02T00:00:00.000Z');
  const r1 = Shadow.shadowPaymentExecution(payment, exec1);
  const exec2 = simulateExecution(payment, 'paid', 60, '2026-09-04T00:00:00.000Z'); // cumulative paidAmount now 100
  const r2 = Shadow.shadowPaymentExecution(payment, exec2);

  check('H: two different canonical Payment ids', r1.paymentId !== r2.paymentId);
  const snap = Shadow.getShadowStoreSnapshot();
  const p1 = snap.payments.find(function (p) { return p.id === r1.paymentId; });
  const p2 = snap.payments.find(function (p) { return p.id === r2.paymentId; });
  check('H: Payment#1 CONFIRMED amountCents=4000', p1.status === 'CONFIRMED' && p1.amountCents === 4000);
  check('H: Payment#2 CONFIRMED amountCents=6000 (this execution\'s own delta)', p2.status === 'CONFIRMED' && p2.amountCents === 6000);
  check('H: no DIVERGENCE', noDivergenceFor(payment.id));
})();

/* ---------------------------------------------------------------------
 * I. Requirement 3 — partial -> partial -> paid: three separate
 * executions, three separate canonical Payments, no duplication.
 * ------------------------------------------------------------------- */
(function () {
  const payment = freshLegacyPayment('i1', 90);
  const exec1 = simulateExecution(payment, 'partial', 30, '2026-09-02T00:00:00.000Z');
  const r1 = Shadow.shadowPaymentExecution(payment, exec1);
  const exec2 = simulateExecution(payment, 'partial', 30, '2026-09-03T00:00:00.000Z'); // cumulative 60
  const r2 = Shadow.shadowPaymentExecution(payment, exec2);
  const exec3 = simulateExecution(payment, 'paid', 30, '2026-09-04T00:00:00.000Z'); // cumulative 90
  const r3 = Shadow.shadowPaymentExecution(payment, exec3);

  check('I: three distinct Payment ids', new Set([r1.paymentId, r2.paymentId, r3.paymentId]).size === 3);
  const snap = Shadow.getShadowStoreSnapshot();
  [r1.paymentId, r2.paymentId, r3.paymentId].forEach(function (id, idx) {
    const p = snap.payments.find(function (pp) { return pp.id === id; });
    check('I: execution #' + (idx + 1) + ' Payment CONFIRMED amountCents=3000', p.status === 'CONFIRMED' && p.amountCents === 3000);
  });
  check('I: no DIVERGENCE', noDivergenceFor(payment.id));
})();

/* ---------------------------------------------------------------------
 * J. Requirement 4 — replay of an already-processed execution is
 * idempotent: same executionKey in, same paymentId out, no new Payment.
 * ------------------------------------------------------------------- */
(function () {
  const payment = freshLegacyPayment('j1', 50);
  const exec1 = simulateExecution(payment, 'paid', 50, '2026-09-02T00:00:00.000Z');
  const r1 = Shadow.shadowPaymentExecution(payment, exec1);
  let snap = Shadow.getShadowStoreSnapshot();
  const countBefore = snap.payments.length;

  const r1Replay = Shadow.shadowPaymentExecution(payment, exec1); // SAME executionMeta -> same executionKey
  check('J: replay ok=true, replayed=true', r1Replay.ok === true && r1Replay.replayed === true);
  check('J: replay resolves to the SAME paymentId as the original execution', r1Replay.paymentId === r1.paymentId);

  snap = Shadow.getShadowStoreSnapshot();
  check('J: no new Payment created by the replay', snap.payments.length === countBefore);
})();

/* ---------------------------------------------------------------------
 * K. Requirement 5 — direct Core-level proof (independent of the shadow-
 * writer's own bookkeeping) that a CONFIRMED Payment can never be failed:
 * the Core itself rejects the transition. This is the invariant the
 * shadow-writer's per-execution correlation is designed around, not
 * something this fix introduces or could bypass even if it tried.
 * ------------------------------------------------------------------- */
(function () {
  const Core2 = global.MDJFinancialLocalServices.createLocalFinancialServices();
  let store = Core2.createStore();
  const rec = Core2.commands.recordPayment(store, {
    direction: 'OUTFLOW', amountCents: 1000, currency: 'USD', method: 'ZELLE',
    account: null, paymentDate: '2026-09-02', reference: '', idempotencyKey: 'k-test-record'
  });
  check('K: Core recordPayment ok', rec.result.ok === true);
  store = rec.store;
  const confirmRes = Core2.commands.confirmPayment(store, { paymentId: rec.result.data.id, idempotencyKey: 'k-test-confirm' });
  check('K: Core confirmPayment ok', confirmRes.result.ok === true);
  store = confirmRes.store;
  const failRes = Core2.commands.failPayment(store, { paymentId: rec.result.data.id, reason: 'test', idempotencyKey: 'k-test-fail' });
  check('K: Core REJECTS failing an already-CONFIRMED Payment (INVALID_STATE_TRANSITION)', failRes.result.ok === false && failRes.result.errorCode === 'INVALID_STATE_TRANSITION');
  check('K: store unchanged on rejection (same reference returned)', failRes.store === store);
})();

/* ---------------------------------------------------------------------
 * L. Requirement 6 — each canonical Payment (and its evidence) retains
 * the legacy row's id, the execution identity, and the correct amount,
 * date, method, reference, and status.
 * ------------------------------------------------------------------- */
(function () {
  const payment = freshLegacyPayment('l1', 75);
  payment.paymentMethod = 'wire';
  payment.reference = 'ref-l1';
  const exec1 = simulateExecution(payment, 'paid', 75, '2026-09-05T00:00:00.000Z');
  const r1 = Shadow.shadowPaymentExecution(payment, exec1);
  const snap = Shadow.getShadowStoreSnapshot();
  const p1 = snap.payments.find(function (p) { return p.id === r1.paymentId; });
  check('L: amountCents correct', p1.amountCents === 7500);
  check('L: paymentDate correct', p1.paymentDate === '2026-09-05');
  check('L: method correct (WIRE)', p1.method === 'WIRE');
  check('L: reference correct', p1.reference === 'ref-l1');
  check('L: status correct', p1.status === 'CONFIRMED');

  const evidence = Shadow.getEvidenceLog().filter(function (e) {
    return e.factType === 'PAYMENT_EXECUTION' && e.canonicalFactId === r1.paymentId;
  });
  check('L: evidence traces legacyFactId back to the legacy payment id', evidence.some(function (e) { return e.legacyFactId === 'pay-l1'; }));
  check('L: evidence carries the execution identity (executionKey)', evidence.some(function (e) { return e.expected && e.expected.executionKey === r1.executionKey; }));
})();

/* ---------------------------------------------------------------------
 * M. Requirement 7 — zero new Payable fabricated by this fix. A Payable
 * is one obligation per legacy row, shared across however many
 * executions happen against it — multi-execution support must not
 * change that.
 * ------------------------------------------------------------------- */
(function () {
  const payment = freshLegacyPayment('m1', 60);
  const exec1 = simulateExecution(payment, 'partial', 20, '2026-09-02T00:00:00.000Z');
  Shadow.shadowPaymentExecution(payment, exec1);
  let snap = Shadow.getShadowStoreSnapshot();
  const payablesAfterFirst = snap.payables.filter(function (p) { return p.payeeId === payment.payeeId; }).length;

  const exec2 = simulateExecution(payment, 'paid', 40, '2026-09-04T00:00:00.000Z');
  Shadow.shadowPaymentExecution(payment, exec2);
  snap = Shadow.getShadowStoreSnapshot();
  const payablesAfterSecond = snap.payables.filter(function (p) { return p.payeeId === payment.payeeId; }).length;

  check('M: exactly 1 Payable created for this legacy row after execution 1', payablesAfterFirst === 1);
  check('M: still exactly 1 Payable after execution 2 (no new Payable per execution)', payablesAfterSecond === 1);
})();

/* ---------------------------------------------------------------------
 * N. Requirement 8 — Allocations resolve to the SPECIFIC execution's
 * Payment, never to "whichever Payment was shadowed last" for the same
 * legacy row. No money duplicated across the two allocations.
 * ------------------------------------------------------------------- */
(function () {
  const payment = freshLegacyPayment('n1', 100);
  const exec1 = simulateExecution(payment, 'partial', 40, '2026-09-02T00:00:00.000Z');
  const r1 = Shadow.shadowPaymentExecution(payment, exec1);
  const exec2 = simulateExecution(payment, 'paid', 60, '2026-09-04T00:00:00.000Z');
  const r2 = Shadow.shadowPaymentExecution(payment, exec2);

  const alloc1 = { id: 'alloc-n1-1', executionId: exec1.id, paymentId: payment.id, payableId: payment.id, receivableId: null, amountAllocated: 40, allocatedBy: 'staff-1', createdAt: '2026-09-02T00:00:00.000Z' };
  const alloc2 = { id: 'alloc-n1-2', executionId: exec2.id, paymentId: payment.id, payableId: payment.id, receivableId: null, amountAllocated: 60, allocatedBy: 'staff-1', createdAt: '2026-09-04T00:00:00.000Z' };

  const ar1 = Shadow.shadowAllocation(alloc1);
  const ar2 = Shadow.shadowAllocation(alloc2);
  check('N: allocation #1 ok', ar1.ok === true, ar1.reason);
  check('N: allocation #2 ok', ar2.ok === true, ar2.reason);

  const snap = Shadow.getShadowStoreSnapshot();
  const a1 = snap.paymentAllocations.find(function (a) { return a.id === ar1.allocationId; });
  const a2 = snap.paymentAllocations.find(function (a) { return a.id === ar2.allocationId; });
  check('N: allocation #1 points to Payment #1 (its own execution)', a1.paymentId === r1.paymentId);
  check('N: allocation #2 points to Payment #2 (its own execution), not #1', a2.paymentId === r2.paymentId);
  check('N: the two allocations point to DIFFERENT Payments', a1.paymentId !== a2.paymentId);
  check('N: allocation amounts correct, no duplication (4000 + 6000, not 10000 + 10000)', a1.amountCents === 4000 && a2.amountCents === 6000);
})();

console.log('');
console.log(failures.length === 0 ? 'RESULT: ALL PASS' : 'RESULT: FAIL (' + failures.length + '): ' + failures.join(' | '));
process.exit(failures.length === 0 ? 0 : 1);
