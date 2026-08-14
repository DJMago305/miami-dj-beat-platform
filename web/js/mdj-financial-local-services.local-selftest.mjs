/**
 * TICKET-V1-FINANCIAL-LOCAL-IN-MEMORY-SERVICES-009 — Fase 1B self-test
 * Local-only (no localStorage, no DOM, no network, no Supabase).
 *
 * Run: node web/js/mdj-financial-local-services.local-selftest.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modPath = path.join(__dirname, 'mdj-financial-local-services.js');
const src = fs.readFileSync(modPath, 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* Sandbox WITHOUT document/localStorage/fetch/XHR/navigator — any access throws. */
const windowStub = {};
windowStub.window = windowStub;
windowStub.globalThis = windowStub;
const sandbox = {
  window: windowStub,
  globalThis: windowStub,
  console: console,
  Date: Date,
  Math: Math,
  String: String,
  Number: Number,
  Object: Object,
  Array: Array,
  JSON: JSON,
  Error: Error,
  isFinite: isFinite,
  isNaN: isNaN
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const Mod = windowStub.MDJFinancialLocalServices;
assert(Mod, 'MDJFinancialLocalServices missing from sandbox global');
const svc = Mod.createLocalFinancialServices();
const cmd = svc.commands;
const qry = svc.queries;

/* Deterministic clock + id generator injected into every command call. */
function makeClock(startIso) {
  let t = Date.parse(startIso);
  return function () {
    t += 60000; // +1 minute per call
    return new Date(t).toISOString();
  };
}
function makeIdGen(prefix) {
  let n = 0;
  return function () {
    n++;
    return prefix + '-' + n;
  };
}

const results = {};
let keySeq = 0;
function key(label) {
  keySeq++;
  return 'k-' + label + '-' + keySeq;
}

/* ===========================================================================
 * CORRECTION A — dynamic, real error-code coverage.
 * No manually-typed "coverage guard" array. Every expected error is recorded
 * ONLY through expectError(), which is the single place that both asserts
 * and records. Nothing is counted as observed unless a real result actually
 * carried that errorCode.
 * ======================================================================= */

const observedErrorCodes = new Set();

function expectError(result, expectedCode, msg) {
  assert(result.ok === false, msg + ' (expected ok=false, got ok=' + result.ok + ')');
  assert(result.errorCode === expectedCode, msg + ' — expected errorCode=' + expectedCode + ', got ' + result.errorCode);
  observedErrorCodes.add(result.errorCode);
}

/* The 18 codes actually implemented and reachable in mdj-financial-local-services.js.
 * PERMISSION_DENIED: no actor/ACL model exists at this phase — explicitly out
 *   of executable scope (see module comment), excluded here on purpose.
 * PFR_ALREADY_EXISTS: structurally unreachable from the current public API
 *   (see module comment) — excluded here on purpose, not fabricated. */
const errorCodesExpected = [
  'MISSING_REQUIRED_FIELD',
  'TARGET_NOT_FOUND',
  'OCCURRENCE_ALREADY_EXISTS',
  'DUPLICATE_IDEMPOTENCY_KEY',
  'INVALID_STATE_TRANSITION',
  'RECEIVABLE_ALREADY_EXISTS',
  'INVALID_AMOUNT',
  'INVALID_DATE',
  'CURRENCY_MISMATCH',
  'PAYMENT_NOT_CONFIRMED',
  'PAYMENT_OVERALLOCATED',
  'RECEIVABLE_ALREADY_PAID',
  'PAYABLE_ALREADY_PAID',
  'ALLOCATION_ALREADY_REVERSED',
  'REFUND_EXCEEDS_AVAILABLE_AMOUNT',
  'TARGET_VOID',
  'RECONCILIATION_CONFLICT',
  'PARTIAL_FAILURE_REQUIRES_RECOVERY'
];

/* ===========================================================================
 * Harness
 * ======================================================================= */

function freshHarness() {
  const clock = makeClock('2026-01-01T00:00:00.000Z');
  const idGen = makeIdGen('e');
  let store = svc.createStore();
  function run(name, input) {
    input = Object.assign({}, input, { now: clock(), idGenerator: idGen });
    const out = cmd[name](store, input);
    store = out.store;
    return out.result;
  }
  return { run: run, getStore: function () { return store; }, clock: clock, idGen: idGen };
}

/* --------------------------------------------------------------------- */
function case_createVenue_and_missing_field() {
  const h = freshHarness();
  const r1 = h.run('createVenue', { name: 'Test Venue', idempotencyKey: key('venue') });
  assert(r1.ok === true, 'createVenue must succeed');
  assert(r1.data.status === 'ACTIVE', 'venue must start ACTIVE');
  assert(r1.createdIds.length === 1, 'createVenue must report exactly 1 createdId');

  const before = JSON.stringify(h.getStore());
  const r2 = h.run('createVenue', { idempotencyKey: key('venue-bad') });
  expectError(r2, 'MISSING_REQUIRED_FIELD', 'missing name');
  assert(r2.stateChanged === false, 'failed command must report stateChanged=false');
  assert(JSON.stringify(h.getStore()) === before, 'store must be unchanged after a failed command');
  results.case_createVenue_and_missing_field = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_createVenueAgreement_unresolved_venue() {
  const h = freshHarness();
  const r = h.run('createVenueAgreement', {
    venueId: 'nope',
    rateByDay: { friday: 100 },
    effectiveFrom: '2026-01-01',
    idempotencyKey: key('agr')
  });
  expectError(r, 'TARGET_NOT_FOUND', 'unresolved venueId');
  results.case_createVenueAgreement_unresolved_venue = 'PASS';
}

/* --------------------------------------------------------------------- *
 * CORRECTION B — INVALID_DATE for createVenueAgreement
 * Fase 1D / A — extended with strict store reference-identity checks
 * (bypasses the harness's run() wrapper, which only exposes `result`,
 * so that `out.store` itself can be compared by reference).
 * ----------------------------------------------------------------------*/
function case_invalid_date() {
  const clock = makeClock('2032-01-01T00:00:00.000Z');
  const idGen = makeIdGen('idt');
  let store = svc.createStore();

  const venueOut = cmd.createVenue(store, { name: 'Date Venue', idempotencyKey: key('dv'), now: clock(), idGenerator: idGen });
  store = venueOut.store;
  const venue = venueOut.result.data;

  var storeBefore = store;
  const snapshotBefore = JSON.stringify(storeBefore);
  const out = cmd.createVenueAgreement(storeBefore, {
    venueId: venue.id,
    rateByDay: { friday: 100 },
    effectiveFrom: '2026-06-01',
    effectiveUntil: '2026-01-01', // before effectiveFrom
    idempotencyKey: key('bad-date'),
    now: clock(),
    idGenerator: idGen
  });

  expectError(out.result, 'INVALID_DATE', 'effectiveFrom after effectiveUntil');
  assert(out.store === storeBefore, 'output.store must be the EXACT SAME reference as the input store on an INVALID_DATE failure');
  assert(JSON.stringify(out.store) === snapshotBefore, 'store must be byte-identical before/after an INVALID_DATE failure');
  results.case_invalid_date = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_full_venue_chain_and_occurrence_duplicate() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Chain Venue', idempotencyKey: key('v') }).data;
  const agreement = h.run('createVenueAgreement', { venueId: venue.id, rateByDay: { friday: 300 }, effectiveFrom: '2026-01-01', idempotencyKey: key('a') }).data;

  const occInput = { venueId: venue.id, agreementId: agreement.id, date: '2026-01-09', shift: 'default', startTime: '21:00', rateAmountCents: 30000, expectedArtistPayoutCents: 18000, idempotencyKey: key('occ') };
  const r1 = h.run('createOccurrenceWithPfr', occInput);
  assert(r1.ok === true, 'createOccurrenceWithPfr must succeed');
  assert(r1.createdIds.length === 2, 'must create exactly Occurrence + PFR');

  const dup = Object.assign({}, occInput, { idempotencyKey: key('occ-dup') });
  const r2 = h.run('createOccurrenceWithPfr', dup);
  expectError(r2, 'OCCURRENCE_ALREADY_EXISTS', 'duplicate slot with new key');

  const replayInput = Object.assign({}, occInput);
  const r3 = h.run('createOccurrenceWithPfr', replayInput);
  assert(r3.ok === true && r3.idempotentReplay === true, 'same key+payload must replay idempotently');
  assert(r3.createdIds.join(',') === r1.createdIds.join(','), 'replay must not mint new ids');

  // CORRECTION E (Fase 1D) — genuine idempotency-envelope conflict:
  // same commandType + same literal idempotencyKey + different payload.
  const mismatch = Object.assign({}, occInput, { rateAmountCents: 99999 });
  const storeBeforeConflict1 = h.getStore();
  const snapshotBeforeConflict1 = JSON.stringify(storeBeforeConflict1);
  const receiptsBeforeConflict1 = storeBeforeConflict1.commandReceipts.length;
  const occCountBeforeConflict1 = storeBeforeConflict1.occurrences.length;
  const out4 = cmd.createOccurrenceWithPfr(storeBeforeConflict1, Object.assign({}, mismatch, { now: h.clock(), idGenerator: h.idGen }));
  expectError(out4.result, 'DUPLICATE_IDEMPOTENCY_KEY', 'same key + different payload');
  assert(out4.store === storeBeforeConflict1, 'output.store must be the EXACT SAME reference on a DUPLICATE_IDEMPOTENCY_KEY conflict');
  assert(JSON.stringify(out4.store) === snapshotBeforeConflict1, 'store must be byte-identical before/after a DUPLICATE_IDEMPOTENCY_KEY conflict');
  assert(out4.store.commandReceipts.length === receiptsBeforeConflict1, 'commandReceipts must not increase on a DUPLICATE_IDEMPOTENCY_KEY conflict');
  assert(out4.store.occurrences.length === occCountBeforeConflict1, 'no new Occurrence must be created on a DUPLICATE_IDEMPOTENCY_KEY conflict');

  results.case_full_venue_chain_and_occurrence_duplicate = 'PASS';
  return { venue: venue, agreement: agreement, occurrence: r1.data.occurrence, pfr: r1.data.pfr, h: h, r1: r1 };
}

/* --------------------------------------------------------------------- *
 * CORRECTION E (Fase 1D) — second genuine idempotency-envelope conflict,
 * on a different commandType (recordPayment), with full store-unchanged
 * proof (reference identity + byte identity + receipt/entity counts).
 * ----------------------------------------------------------------------*/
function case_idempotency_conflict_recordPayment() {
  const clock = makeClock('2035-01-01T00:00:00.000Z');
  const idGen = makeIdGen('conf');
  let store = svc.createStore();
  const fixedKey = 'conflict-recordPayment-fixed-key';

  const original = cmd.recordPayment(store, { direction: 'INFLOW', amountCents: 1000, currency: 'USD', method: 'cash', paymentDate: '2035-01-01', idempotencyKey: fixedKey, now: clock(), idGenerator: idGen });
  store = original.store;
  assert(original.result.ok === true, 'original recordPayment must succeed');

  const storeBeforeConflict = store;
  const snapshotBeforeConflict = JSON.stringify(storeBeforeConflict);
  const receiptsBeforeConflict = storeBeforeConflict.commandReceipts.length;
  const paymentsBeforeConflict = storeBeforeConflict.payments.length;

  const conflictOut = cmd.recordPayment(storeBeforeConflict, { direction: 'INFLOW', amountCents: 9999, currency: 'USD', method: 'cash', paymentDate: '2035-01-01', idempotencyKey: fixedKey, now: clock(), idGenerator: idGen });

  expectError(conflictOut.result, 'DUPLICATE_IDEMPOTENCY_KEY', 'same commandType + same key + different payload (recordPayment)');
  assert(conflictOut.store === storeBeforeConflict, 'output.store must be the EXACT SAME reference on a recordPayment idempotency conflict');
  assert(JSON.stringify(conflictOut.store) === snapshotBeforeConflict, 'store must be byte-identical before/after a recordPayment idempotency conflict');
  assert(conflictOut.store.commandReceipts.length === receiptsBeforeConflict, 'commandReceipts must not increase on a recordPayment idempotency conflict');
  assert(conflictOut.store.payments.length === paymentsBeforeConflict, 'no new Payment must be created on a recordPayment idempotency conflict');

  results.case_idempotency_conflict_recordPayment = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_reschedule_happy_and_collision() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Resched Venue', idempotencyKey: key('v') }).data;
  const occA = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-02-01', shift: 'default', startTime: '20:00', rateAmountCents: 10000, idempotencyKey: key('a') }).data.occurrence;
  const occB = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-02-08', shift: 'default', startTime: '20:00', rateAmountCents: 10000, idempotencyKey: key('b') }).data.occurrence;

  const rOk = h.run('rescheduleOccurrence', { occurrenceId: occA.id, newDate: '2026-02-02', reason: 'venue request', requestedBy: 'staff-1', idempotencyKey: key('r1') });
  assert(rOk.ok === true, 'reschedule must succeed for a SCHEDULED occurrence');
  assert(rOk.data.occurrence.id === occA.id, 'reschedule must preserve the same occurrenceId');
  assert(rOk.data.previousDate === '2026-02-01', 'reschedule must report previousDate in the result');

  const rCollide = h.run('rescheduleOccurrence', { occurrenceId: rOk.data.occurrence.id, newDate: occB.date, newShift: occB.shift, newStartTime: occB.startTime, reason: 'test', requestedBy: 'staff-1', idempotencyKey: key('r2') });
  expectError(rCollide, 'OCCURRENCE_ALREADY_EXISTS', 'rescheduling into an occupied slot');

  const cancelled = h.run('cancelOccurrence', { occurrenceId: occB.id, reason: 'test cancel', idempotencyKey: key('cancelB') });
  assert(cancelled.ok === true, 'cancelling a clean SCHEDULED occurrence must succeed');
  const rAfterCancel = h.run('rescheduleOccurrence', { occurrenceId: occB.id, newDate: '2026-03-01', reason: 'x', requestedBy: 'staff-1', idempotencyKey: key('r3') });
  expectError(rAfterCancel, 'INVALID_STATE_TRANSITION', 'rescheduling a CANCELLED occurrence');

  results.case_reschedule_happy_and_collision = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_receivable_duplicate() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Rec Venue', idempotencyKey: key('v') }).data;
  const occ = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-03-01', shift: 'default', startTime: '20:00', rateAmountCents: 20000, idempotencyKey: key('o') }).data.occurrence;

  const r1 = h.run('createVenueReceivable', { occurrenceId: occ.id, amountCents: 20000, idempotencyKey: key('rec1') });
  assert(r1.ok === true, 'createVenueReceivable must succeed');
  const r2 = h.run('createVenueReceivable', { occurrenceId: occ.id, amountCents: 15000, idempotencyKey: key('rec2') });
  expectError(r2, 'RECEIVABLE_ALREADY_EXISTS', 'second receivable for the same occurrence');
  results.case_receivable_duplicate = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_payment_pending_confirmed_failed() {
  const h = freshHarness();
  const p1 = h.run('recordPayment', { direction: 'INFLOW', amountCents: 10000, currency: 'USD', method: 'cash', paymentDate: '2026-01-01', idempotencyKey: key('p1') });
  assert(p1.ok === true && p1.data.status === 'PENDING', 'recordPayment must always start PENDING (never auto-confirm)');

  const confirmed = h.run('confirmPayment', { paymentId: p1.data.id, idempotencyKey: key('c1') });
  assert(confirmed.ok === true && confirmed.data.payment.status === 'CONFIRMED', 'confirmPayment must move PENDING->CONFIRMED');
  assert(h.getStore().ownerLedgerEntries.length === 1, 'confirming must post exactly one ledger entry');

  const doubleConfirm = h.run('confirmPayment', { paymentId: p1.data.id, idempotencyKey: key('c2') });
  expectError(doubleConfirm, 'INVALID_STATE_TRANSITION', 'confirming a CONFIRMED payment');

  const p2 = h.run('recordPayment', { direction: 'OUTFLOW', amountCents: 5000, currency: 'USD', method: 'cash', paymentDate: '2026-01-02', idempotencyKey: key('p2') }).data;
  const failed = h.run('failPayment', { paymentId: p2.id, reason: 'declined', idempotencyKey: key('f1') });
  assert(failed.ok === true && failed.data.status === 'FAILED', 'failPayment must move PENDING->FAILED');
  const failAgain = h.run('failPayment', { paymentId: p2.id, reason: 'x', idempotencyKey: key('f2') });
  expectError(failAgain, 'INVALID_STATE_TRANSITION', 'failing an already-FAILED payment');
  assert(h.getStore().ownerLedgerEntries.length === 1, 'a FAILED payment must never post a ledger entry');

  // CORRECTION F (Fase 1D) — confirmPayment on a FAILED payment must be blocked
  const storeBeforeConfirmFailed = h.getStore();
  const receiptsBeforeConfirmFailed = storeBeforeConfirmFailed.commandReceipts.length;
  const confirmFailedOut = cmd.confirmPayment(storeBeforeConfirmFailed, { paymentId: p2.id, idempotencyKey: key('confirm-failed'), now: h.clock(), idGenerator: h.idGen });
  expectError(confirmFailedOut.result, 'INVALID_STATE_TRANSITION', 'confirming a FAILED payment must be blocked');
  assert(confirmFailedOut.store === storeBeforeConfirmFailed, 'output.store must be the EXACT SAME reference when confirmPayment is blocked on a FAILED payment');
  assert(confirmFailedOut.store.commandReceipts.length === receiptsBeforeConfirmFailed, 'commandReceipts must not increase when confirmPayment is blocked');
  var p2AfterAttempt = confirmFailedOut.store.payments.find(function (p) { return p.id === p2.id; });
  assert(p2AfterAttempt.status === 'FAILED', 'the Payment must remain FAILED after a blocked confirmPayment attempt');

  results.case_payment_pending_confirmed_failed = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_allocation_partial_and_full_plus_overallocation() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Alloc Venue', idempotencyKey: key('v') }).data;
  const occ = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-04-01', shift: 'default', startTime: '20:00', rateAmountCents: 30000, idempotencyKey: key('o') }).data.occurrence;
  const receivable = h.run('createVenueReceivable', { occurrenceId: occ.id, amountCents: 30000, idempotencyKey: key('rec') }).data;

  const pay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 30000, currency: 'USD', method: 'zelle', paymentDate: '2026-04-02', idempotencyKey: key('pay') }).data;
  h.run('confirmPayment', { paymentId: pay.id, idempotencyKey: key('conf') });

  const alloc1 = h.run('allocatePayment', { paymentId: pay.id, targetType: 'VENUE_RECEIVABLE', targetId: receivable.id, amountCents: 20000, idempotencyKey: key('al1') });
  assert(alloc1.ok === true, 'partial allocation must succeed');
  assert(alloc1.data.target.status === 'PARTIALLY_PAID', 'receivable must move OPEN->PARTIALLY_PAID');
  assert(qry.getReceivableBalance(h.getStore(), receivable.id) === 10000, 'receivable balance must be 10000 after a 20000 allocation on a 30000 total');

  const alloc2 = h.run('allocatePayment', { paymentId: pay.id, targetType: 'VENUE_RECEIVABLE', targetId: receivable.id, amountCents: 10000, idempotencyKey: key('al2') });
  assert(alloc2.ok === true && alloc2.data.target.status === 'PAID', 'completing allocation must move PARTIALLY_PAID->PAID');
  assert(qry.getReceivableBalance(h.getStore(), receivable.id) === 0, 'receivable balance must be 0 once fully allocated');

  const overTarget = h.run('allocatePayment', { paymentId: pay.id, targetType: 'VENUE_RECEIVABLE', targetId: receivable.id, amountCents: 1, idempotencyKey: key('al3') });
  expectError(overTarget, 'RECEIVABLE_ALREADY_PAID', 'allocating against an already-PAID receivable');

  const receivable2 = h.run('createVenueReceivable', {
    occurrenceId: h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-04-08', shift: 'default', startTime: '20:00', rateAmountCents: 5000, idempotencyKey: key('o2') }).data.occurrence.id,
    amountCents: 5000,
    idempotencyKey: key('rec2')
  }).data;
  const smallPay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 1000, currency: 'USD', method: 'cash', paymentDate: '2026-04-09', idempotencyKey: key('sp') }).data;
  h.run('confirmPayment', { paymentId: smallPay.id, idempotencyKey: key('spc') });
  const overPayment = h.run('allocatePayment', { paymentId: smallPay.id, targetType: 'VENUE_RECEIVABLE', targetId: receivable2.id, amountCents: 2000, idempotencyKey: key('over-pay') });
  expectError(overPayment, 'PAYMENT_OVERALLOCATED', 'allocating more than the payment amount (payment side)');

  const bigPay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 100000, currency: 'USD', method: 'cash', paymentDate: '2026-04-09', idempotencyKey: key('bp') }).data;
  h.run('confirmPayment', { paymentId: bigPay.id, idempotencyKey: key('bpc') });
  const overTargetBalance = h.run('allocatePayment', { paymentId: bigPay.id, targetType: 'VENUE_RECEIVABLE', targetId: receivable2.id, amountCents: 6000, idempotencyKey: key('over-target') });
  expectError(overTargetBalance, 'PAYMENT_OVERALLOCATED', 'allocating more than the target balance (target side)');

  results.case_allocation_partial_and_full_plus_overallocation = 'PASS';
  return { h: h, venue: venue, receivable: receivable, pay: pay, alloc1: alloc1.data.allocation, alloc2: alloc2.data.allocation };
}

/* --------------------------------------------------------------------- */
function case_allocation_reversal_append_only_and_currency_mismatch() {
  const ctx = case_allocation_partial_and_full_plus_overallocation();
  const h = ctx.h;
  const before = JSON.stringify(ctx.alloc1);

  const rev = h.run('reverseAllocation', { allocationId: ctx.alloc1.id, amountCents: 5000, idempotencyKey: key('rev1') });
  assert(rev.ok === true, 'partial reversal must succeed');
  assert(rev.data.reversal.direction === 'REVERSE', 'reversal row must have direction=REVERSE');
  assert(rev.data.target.status === 'PARTIALLY_PAID', 'receivable must move back from PAID to PARTIALLY_PAID after partial reversal');

  const storeAfter = h.getStore();
  const originalRow = storeAfter.paymentAllocations.find(function (a) { return a.id === ctx.alloc1.id; });
  assert(JSON.stringify(originalRow) === before, 'original APPLY allocation row must never be mutated by a reversal');

  const alreadyRevAmount = 5000;
  const remaining = ctx.alloc1.amountCents - alreadyRevAmount;
  const overReverse = h.run('reverseAllocation', { allocationId: ctx.alloc1.id, amountCents: remaining + 1, idempotencyKey: key('rev2') });
  expectError(overReverse, 'PAYMENT_OVERALLOCATED', 'reversing more than remaining applied amount');

  const full = h.run('reverseAllocation', { allocationId: ctx.alloc1.id, amountCents: remaining, idempotencyKey: key('rev3') });
  assert(full.ok === true, 'reversing exactly the remaining amount must succeed');
  const doubleReverse = h.run('reverseAllocation', { allocationId: ctx.alloc1.id, idempotencyKey: key('rev4') });
  expectError(doubleReverse, 'ALLOCATION_ALREADY_REVERSED', 'reversing an already fully-reversed allocation');

  const venue2 = h.run('createVenue', { name: 'EUR Venue', idempotencyKey: key('veur') }).data;
  const occEur = h.run('createOccurrenceWithPfr', { venueId: venue2.id, date: '2026-05-01', shift: 'default', startTime: '20:00', rateAmountCents: 1000, currency: 'EUR', idempotencyKey: key('oeur') }).data.occurrence;
  const recEur = h.run('createVenueReceivable', { occurrenceId: occEur.id, amountCents: 1000, currency: 'EUR', idempotencyKey: key('receur') }).data;
  const usdPay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 1000, currency: 'USD', method: 'cash', paymentDate: '2026-05-02', idempotencyKey: key('usdpay') }).data;
  h.run('confirmPayment', { paymentId: usdPay.id, idempotencyKey: key('usdconf') });
  const mismatch = h.run('allocatePayment', { paymentId: usdPay.id, targetType: 'VENUE_RECEIVABLE', targetId: recEur.id, amountCents: 500, idempotencyKey: key('mismatch') });
  expectError(mismatch, 'CURRENCY_MISMATCH', 'allocating across genuinely mismatched currencies (USD vs EUR)');

  results.case_allocation_reversal_append_only_and_currency_mismatch = 'PASS';
}

/* --------------------------------------------------------------------- *
 * CORRECTION G (Fase 1D) — an allocation fully compensated by REVERSE must
 * stop counting as active financial activity: void/cancel become possible
 * again, while the original APPLY row stays byte-identical and the REVERSE
 * row is strictly append-only.
 * ----------------------------------------------------------------------*/
function case_allocation_fully_reversed_no_longer_active() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'FullReversal Venue', idempotencyKey: key('frv') }).data;
  const occ = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2036-01-01', shift: 'default', startTime: '20:00', rateAmountCents: 7000, idempotencyKey: key('fro') }).data.occurrence;
  const rec = h.run('createVenueReceivable', { occurrenceId: occ.id, amountCents: 7000, idempotencyKey: key('frr') }).data;
  const pay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 7000, currency: 'USD', method: 'cash', paymentDate: '2036-01-02', idempotencyKey: key('frp') }).data;
  h.run('confirmPayment', { paymentId: pay.id, idempotencyKey: key('frc') });

  // Deliberately PARTIAL (6000 of 7000): a FULL allocation would move the
  // receivable straight to PAID, and voidReceivable's PAID-specific guard
  // (checked before the active-allocations guard) would short-circuit with
  // RECEIVABLE_ALREADY_PAID instead of PARTIAL_FAILURE_REQUIRES_RECOVERY —
  // that is correct, more-specific behavior in services.js, not a defect;
  // a partial allocation is what actually exercises the active-allocations
  // guard this test is targeting.
  const allocResult = h.run('allocatePayment', { paymentId: pay.id, targetType: 'VENUE_RECEIVABLE', targetId: rec.id, amountCents: 6000, idempotencyKey: key('fra') });
  assert(allocResult.ok === true, 'setup: partial allocation must succeed');
  const alloc = allocResult.data.allocation;
  const allocSnapshotBeforeReversal = JSON.stringify(alloc);
  assert(qry.getReceivableBalance(h.getStore(), rec.id) === 1000, 'setup: receivable balance must be 1000 (7000-6000) while allocation is active');
  assert(allocResult.data.target.status === 'PARTIALLY_PAID', 'setup: receivable must be PARTIALLY_PAID, not PAID, so the active-allocations guard (not the PAID guard) is what blocks void/cancel');

  // 6. blocked while netApplied > 0
  const voidBlocked = h.run('voidReceivable', { receivableId: rec.id, idempotencyKey: key('frv1') });
  expectError(voidBlocked, 'PARTIAL_FAILURE_REQUIRES_RECOVERY', 'voidReceivable must be blocked while the allocation is active');
  const cancelBlocked = h.run('cancelOccurrence', { occurrenceId: occ.id, reason: 'attempt while active', idempotencyKey: key('frcx') });
  expectError(cancelBlocked, 'PARTIAL_FAILURE_REQUIRES_RECOVERY', 'cancelOccurrence must be blocked while the allocation is active');

  // 7. reverse 100% of the APPLY amount (6000, the full applied amount)
  const reverseResult = h.run('reverseAllocation', { allocationId: alloc.id, amountCents: 6000, idempotencyKey: key('frrv') });
  assert(reverseResult.ok === true, 'full reversal must succeed');
  assert(reverseResult.data.reversal.direction === 'REVERSE', 'the compensating row must have direction=REVERSE');

  // 11. original APPLY row remains byte-identical
  const originalRowAfter = h.getStore().paymentAllocations.find(function (a) { return a.id === alloc.id; });
  assert(JSON.stringify(originalRowAfter) === allocSnapshotBeforeReversal, 'the original APPLY row must remain byte-identical after a full reversal');

  // 12. REVERSE row is append-only (a new row; APPLY row is preserved, not replaced)
  const applyRows = h.getStore().paymentAllocations.filter(function (a) { return a.direction === 'APPLY' && a.targetId === rec.id; });
  const reverseRows = h.getStore().paymentAllocations.filter(function (a) { return a.direction === 'REVERSE' && a.reversalOfAllocationId === alloc.id; });
  assert(applyRows.length === 1, 'exactly one APPLY row must exist for this target (no mutation, no duplication)');
  assert(reverseRows.length === 1, 'exactly one REVERSE row must exist, appended alongside (not replacing) the APPLY row');

  // 8. netApplied back to 0 -> balance back to the full amount
  assert(qry.getReceivableBalance(h.getStore(), rec.id) === 7000, 'receivable balance must return to the full amount once the allocation is fully reversed (netApplied === 0)');

  // 9/10 Route 1: voidReceivable must now succeed
  const voidNowOk = h.run('voidReceivable', { receivableId: rec.id, idempotencyKey: key('frv2') });
  assert(voidNowOk.ok === true, 'voidReceivable must succeed once the allocation is no longer active');
  assert(voidNowOk.data.status === 'VOID', 'receivable must be VOID after a successful void');

  // 9/10 Route 2: cancelOccurrence must now also succeed (receivable already VOID, no active allocations)
  const cancelNowOk = h.run('cancelOccurrence', { occurrenceId: occ.id, reason: 'clean after full reversal', idempotencyKey: key('frc2') });
  assert(cancelNowOk.ok === true, 'cancelOccurrence must succeed once the allocation is no longer active');
  assert(cancelNowOk.data.occurrence.status === 'CANCELLED', 'occurrence must be CANCELLED after a successful cancel');

  results.case_allocation_fully_reversed_no_longer_active = 'PASS';
}

/* --------------------------------------------------------------------- *
 * CORRECTION D — currency normalization
 * ----------------------------------------------------------------------*/
function case_currency_normalization() {
  const h = freshHarness();

  const v1 = h.run('createVenue', { name: 'Norm Venue', idempotencyKey: key('nv') }).data;
  const occLower = h.run('createOccurrenceWithPfr', { venueId: v1.id, date: '2026-06-01', shift: 'default', startTime: '20:00', rateAmountCents: 5000, currency: 'usd', idempotencyKey: key('nvo') }).data.occurrence;
  const recMixedCase = h.run('createVenueReceivable', { occurrenceId: occLower.id, amountCents: 5000, currency: 'Usd', idempotencyKey: key('nvr') }).data;
  assert(recMixedCase.currency === 'USD', '"Usd" must normalize to "USD" at storage time, got ' + recMixedCase.currency);

  const paySpaces = h.run('recordPayment', { direction: 'INFLOW', amountCents: 5000, currency: ' usd ', method: 'cash', paymentDate: '2026-06-02', idempotencyKey: key('nvp') }).data;
  assert(paySpaces.currency === 'USD', '" usd " must normalize to "USD" (trim+uppercase), got ' + paySpaces.currency);

  const payWhitespaceOnly = h.run('recordPayment', { direction: 'INFLOW', amountCents: 100, currency: '   ', method: 'cash', paymentDate: '2026-06-03', idempotencyKey: key('nvp2') }).data;
  assert(payWhitespaceOnly.currency === 'USD', 'whitespace-only currency must default to "USD", got ' + payWhitespaceOnly.currency);

  const payEmpty = h.run('recordPayment', { direction: 'INFLOW', amountCents: 100, currency: '', method: 'cash', paymentDate: '2026-06-03', idempotencyKey: key('nvp3') }).data;
  assert(payEmpty.currency === 'USD', 'empty-string currency must default to "USD", got ' + payEmpty.currency);

  // "usd" payment (normalized to USD) must allocate cleanly against a "Usd" receivable (also normalized to USD) — no false CURRENCY_MISMATCH
  h.run('confirmPayment', { paymentId: paySpaces.id, idempotencyKey: key('nvc') });
  const alloc = h.run('allocatePayment', { paymentId: paySpaces.id, targetType: 'VENUE_RECEIVABLE', targetId: recMixedCase.id, amountCents: 5000, idempotencyKey: key('nva') });
  assert(alloc.ok === true, 'a "usd"-labeled payment must allocate cleanly against a "Usd"-labeled receivable once both are normalized (no false CURRENCY_MISMATCH)');

  results.case_currency_normalization = 'PASS';
}

/* --------------------------------------------------------------------- *
 * CORRECTION H (Fase 1D) — OwnerLedgerEntry.currency is always normalized
 * (uppercase, trimmed), demonstrated at each of its 3 creation sites,
 * WITHOUT adding any normalization inside services.js (locked file).
 * ----------------------------------------------------------------------*/
function case_ownerLedgerEntry_currency_normalized() {
  const h = freshHarness();

  // Path 1: confirmPayment — currency variant ' usd '
  const pay1 = h.run('recordPayment', { direction: 'INFLOW', amountCents: 1000, currency: ' usd ', method: 'cash', paymentDate: '2037-01-01', idempotencyKey: key('oln1') });
  const confirm1 = h.run('confirmPayment', { paymentId: pay1.data.id, idempotencyKey: key('oln1c') });
  assert(confirm1.data.ledgerEntry.currency === 'USD', 'confirmPayment ledger entry currency must normalize " usd " to "USD", got ' + confirm1.data.ledgerEntry.currency);

  // Path 2: recordRefund — original payment currency variant 'Usd'
  const pay2 = h.run('recordPayment', { direction: 'INFLOW', amountCents: 2000, currency: 'Usd', method: 'zelle', paymentDate: '2037-01-02', idempotencyKey: key('oln2') }).data;
  h.run('confirmPayment', { paymentId: pay2.id, idempotencyKey: key('oln2c') });
  const refund2 = h.run('recordRefund', { originalPaymentId: pay2.id, amountCents: 500, reason: 'currency check', idempotencyKey: key('oln2r') });
  assert(refund2.data.refundPayment.currency === 'USD', 'recordRefund refundPayment currency must normalize "Usd" to "USD", got ' + refund2.data.refundPayment.currency);
  assert(refund2.data.ledgerEntry.currency === 'USD', 'recordRefund ledger entry currency must normalize "Usd" to "USD", got ' + refund2.data.ledgerEntry.currency);

  // Path 3a: recordOwnerPayout — currency inherited from an already-normalized Payable ('USD' literal)
  const payable3a = h.run('createPayable', { sourceType: 'EXPENSE', payeeId: 'payee-oln-3a', purpose: 'VENDOR_PAYMENT', amountCents: 800, currency: 'USD', idempotencyKey: key('oln3a') }).data;
  const payout3a = h.run('recordOwnerPayout', { payableId: payable3a.id, amountCents: 800, method: 'zelle', paymentDate: '2037-01-03', idempotencyKey: key('oln3ap') });
  assert(payout3a.data.ledgerEntry.currency === 'USD', 'recordOwnerPayout ledger entry currency (inherited from Payable) must be "USD", got ' + payout3a.data.ledgerEntry.currency);

  // Path 3b: recordOwnerPayout — explicit currency variant ' usd ' passed directly on the payout
  const payable3b = h.run('createPayable', { sourceType: 'EXPENSE', payeeId: 'payee-oln-3b', purpose: 'VENDOR_PAYMENT', amountCents: 900, currency: 'USD', idempotencyKey: key('oln3b') }).data;
  const payout3b = h.run('recordOwnerPayout', { payableId: payable3b.id, amountCents: 900, currency: ' usd ', method: 'zelle', paymentDate: '2037-01-04', idempotencyKey: key('oln3bp') });
  assert(payout3b.ok === true, 'explicit " usd " on payout must normalize and match the already-USD payable (no false CURRENCY_MISMATCH)');
  assert(payout3b.data.ledgerEntry.currency === 'USD', 'recordOwnerPayout ledger entry currency (explicit " usd ") must normalize to "USD", got ' + payout3b.data.ledgerEntry.currency);
  assert(payout3b.data.payment.currency === 'USD', 'recordOwnerPayout Payment currency (explicit " usd ") must normalize to "USD", got ' + payout3b.data.payment.currency);

  results.case_ownerLedgerEntry_currency_normalized = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_refund_partial_multiple_and_excessive() {
  const h = freshHarness();
  const pay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 10000, currency: 'USD', method: 'zelle', paymentDate: '2026-06-01', idempotencyKey: key('p') }).data;
  h.run('confirmPayment', { paymentId: pay.id, idempotencyKey: key('c') });

  const notConfirmedPay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 100, currency: 'USD', method: 'cash', paymentDate: '2026-06-01', idempotencyKey: key('pnc') }).data;
  const refundNotConfirmed = h.run('recordRefund', { originalPaymentId: notConfirmedPay.id, amountCents: 50, reason: 'x', idempotencyKey: key('rfnc') });
  expectError(refundNotConfirmed, 'PAYMENT_NOT_CONFIRMED', 'refund on a non-CONFIRMED payment');

  const refund1 = h.run('recordRefund', { originalPaymentId: pay.id, amountCents: 3000, reason: 'partial 1', idempotencyKey: key('rf1') });
  assert(refund1.ok === true, 'first partial refund must succeed');
  assert(refund1.data.refundPayment.direction === 'OUTFLOW', 'refund of an INFLOW original must be OUTFLOW');
  assert(refund1.data.refundPayment.status === 'CONFIRMED', 'refund payment must be created already CONFIRMED');

  const refund2 = h.run('recordRefund', { originalPaymentId: pay.id, amountCents: 4000, reason: 'partial 2', idempotencyKey: key('rf2') });
  assert(refund2.ok === true, 'second independent partial refund must succeed');

  assert(qry.getPaymentEffectiveStatus(h.getStore(), pay.id) === 'PARTIALLY_REVERSED', 'original payment effectiveStatus must be PARTIALLY_REVERSED after 3000+4000 of 10000 refunded');
  const storedOriginal = h.getStore().payments.find(function (p) { return p.id === pay.id; });
  assert(storedOriginal.status === 'CONFIRMED', 'original Payment.status (stored) must remain CONFIRMED — effectiveStatus is derived, not stored');

  const refund3Excessive = h.run('recordRefund', { originalPaymentId: pay.id, amountCents: 4000, reason: 'too much', idempotencyKey: key('rf3') });
  expectError(refund3Excessive, 'REFUND_EXCEEDS_AVAILABLE_AMOUNT', 'refund exceeding remaining confirmed amount');

  const refund3Exact = h.run('recordRefund', { originalPaymentId: pay.id, amountCents: 3000, reason: 'final', idempotencyKey: key('rf4') });
  assert(refund3Exact.ok === true, 'refund of exactly the remaining amount must succeed');
  assert(qry.getPaymentEffectiveStatus(h.getStore(), pay.id) === 'FULLY_REVERSED', 'original payment effectiveStatus must be FULLY_REVERSED once fully refunded');

  results.case_refund_partial_multiple_and_excessive = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_refund_with_allocation_reversal() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Refund Alloc Venue', idempotencyKey: key('v') }).data;
  const occ = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-07-01', shift: 'default', startTime: '20:00', rateAmountCents: 10000, idempotencyKey: key('o') }).data.occurrence;
  const rec = h.run('createVenueReceivable', { occurrenceId: occ.id, amountCents: 10000, idempotencyKey: key('rec') }).data;
  const pay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 10000, currency: 'USD', method: 'zelle', paymentDate: '2026-07-02', idempotencyKey: key('p') }).data;
  h.run('confirmPayment', { paymentId: pay.id, idempotencyKey: key('c') });
  const alloc = h.run('allocatePayment', { paymentId: pay.id, targetType: 'VENUE_RECEIVABLE', targetId: rec.id, amountCents: 10000, idempotencyKey: key('al') }).data.allocation;
  assert(qry.getReceivableBalance(h.getStore(), rec.id) === 0, 'receivable fully allocated');

  const refund = h.run('recordRefund', { originalPaymentId: pay.id, amountCents: 4000, reason: 'partial', targetAllocationId: alloc.id, idempotencyKey: key('rf') });
  assert(refund.ok === true, 'refund with targetAllocationId must succeed');
  assert(qry.getReceivableBalance(h.getStore(), rec.id) === 4000, 'receivable balance must reopen by the refunded amount');
  const target = h.getStore().venueReceivables.find(function (r) { return r.id === rec.id; });
  assert(target.status === 'PARTIALLY_PAID', 'receivable must move back from PAID to PARTIALLY_PAID');

  results.case_refund_with_allocation_reversal = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_payable_partial_and_complete_and_ownerpayout_overallocation() {
  const h = freshHarness();
  const payable = h.run('createPayable', { sourceType: 'EXPENSE', payeeId: 'payee-1', purpose: 'VENDOR_PAYMENT', amountCents: 8000, idempotencyKey: key('pay') }).data;

  const payout1 = h.run('recordOwnerPayout', { payableId: payable.id, amountCents: 5000, method: 'zelle', paymentDate: '2026-08-01', idempotencyKey: key('po1') });
  assert(payout1.ok === true, 'partial payout must succeed');
  assert(payout1.data.payable.status === 'PARTIALLY_PAID', 'payable must move PENDING->PARTIALLY_PAID');
  assert(h.getStore().ownerLedgerEntries.some(function (l) { return l.postingType === 'CASH_OUT'; }), 'payout must post a CASH_OUT ledger entry');

  const over = h.run('recordOwnerPayout', { payableId: payable.id, amountCents: 4000, method: 'zelle', paymentDate: '2026-08-02', idempotencyKey: key('po-over') });
  expectError(over, 'PAYMENT_OVERALLOCATED', 'payout exceeding remaining balance');

  const payout2 = h.run('recordOwnerPayout', { payableId: payable.id, amountCents: 3000, method: 'zelle', paymentDate: '2026-08-03', idempotencyKey: key('po2') });
  assert(payout2.ok === true && payout2.data.payable.status === 'PAID', 'completing payout must move PARTIALLY_PAID->PAID');

  const afterPaid = h.run('recordOwnerPayout', { payableId: payable.id, amountCents: 1, method: 'zelle', paymentDate: '2026-08-04', idempotencyKey: key('po3') });
  expectError(afterPaid, 'PAYABLE_ALREADY_PAID', 'payout on an already-PAID payable');

  const dupPayable = h.run('createPayable', { sourceType: 'EXPENSE', payeeId: 'payee-1', purpose: 'VENDOR_PAYMENT', amountCents: 999, idempotencyKey: key('pay-dup') });
  expectError(dupPayable, 'DUPLICATE_IDEMPOTENCY_KEY', 'duplicate (sourceType,sourceId,payeeId,purpose)');

  results.case_payable_partial_and_complete_and_ownerpayout_overallocation = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_cancel_occurrence_clean_and_with_money() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Cancel Venue', idempotencyKey: key('v') }).data;

  const occClean = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-09-01', shift: 'default', startTime: '20:00', rateAmountCents: 5000, idempotencyKey: key('oc1') }).data.occurrence;
  const cancelClean = h.run('cancelOccurrence', { occurrenceId: occClean.id, reason: 'weather', idempotencyKey: key('cc1') });
  assert(cancelClean.ok === true, 'cancelling an occurrence with no receivable must succeed cleanly');

  const occMoney = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-09-08', shift: 'default', startTime: '20:00', rateAmountCents: 5000, idempotencyKey: key('oc2') }).data.occurrence;
  const rec = h.run('createVenueReceivable', { occurrenceId: occMoney.id, amountCents: 5000, idempotencyKey: key('rc2') }).data;
  const pay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 5000, currency: 'USD', method: 'cash', paymentDate: '2026-09-09', idempotencyKey: key('p2') }).data;
  h.run('confirmPayment', { paymentId: pay.id, idempotencyKey: key('c2') });
  h.run('allocatePayment', { paymentId: pay.id, targetType: 'VENUE_RECEIVABLE', targetId: rec.id, amountCents: 5000, idempotencyKey: key('al2') });

  const before = JSON.stringify(h.getStore());
  const cancelBlocked = h.run('cancelOccurrence', { occurrenceId: occMoney.id, reason: 'try anyway', idempotencyKey: key('cc2') });
  expectError(cancelBlocked, 'PARTIAL_FAILURE_REQUIRES_RECOVERY', 'cancelling an occurrence with active allocations');
  assert(JSON.stringify(h.getStore()) === before, 'blocked cancellation must not mutate the store at all');

  results.case_cancel_occurrence_clean_and_with_money = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_void_permitted_and_blocked() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Void Venue', idempotencyKey: key('v') }).data;
  const occ1 = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-10-01', shift: 'default', startTime: '20:00', rateAmountCents: 4000, idempotencyKey: key('o1') }).data.occurrence;
  const rec1 = h.run('createVenueReceivable', { occurrenceId: occ1.id, amountCents: 4000, idempotencyKey: key('r1') }).data;
  const voidOk = h.run('voidReceivable', { receivableId: rec1.id, idempotencyKey: key('vo1') });
  assert(voidOk.ok === true && voidOk.data.status === 'VOID', 'voiding a clean OPEN receivable must succeed');
  const voidTwice = h.run('voidReceivable', { receivableId: rec1.id, idempotencyKey: key('vo2') });
  expectError(voidTwice, 'TARGET_VOID', 'voiding an already-VOID receivable');

  const occ2 = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-10-08', shift: 'default', startTime: '20:00', rateAmountCents: 4000, idempotencyKey: key('o2') }).data.occurrence;
  const rec2 = h.run('createVenueReceivable', { occurrenceId: occ2.id, amountCents: 4000, idempotencyKey: key('r2') }).data;
  const pay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 4000, currency: 'USD', method: 'cash', paymentDate: '2026-10-09', idempotencyKey: key('p') }).data;
  h.run('confirmPayment', { paymentId: pay.id, idempotencyKey: key('c') });
  h.run('allocatePayment', { paymentId: pay.id, targetType: 'VENUE_RECEIVABLE', targetId: rec2.id, amountCents: 4000, idempotencyKey: key('al') });
  const voidBlocked = h.run('voidReceivable', { receivableId: rec2.id, idempotencyKey: key('vo3') });
  expectError(voidBlocked, 'RECEIVABLE_ALREADY_PAID', 'voiding a fully-PAID receivable');

  const payable = h.run('createPayable', { sourceType: 'EXPENSE', payeeId: 'payee-void', purpose: 'VENDOR_PAYMENT', amountCents: 1000, idempotencyKey: key('pv') }).data;
  const voidPayableOk = h.run('voidPayable', { payableId: payable.id, idempotencyKey: key('vp1') });
  assert(voidPayableOk.ok === true, 'voiding a clean PENDING payable must succeed');

  results.case_void_permitted_and_blocked = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_reconciliation_multiple_attempts() {
  const h = freshHarness();
  const pay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 2000, currency: 'USD', method: 'wire', paymentDate: '2026-11-01', idempotencyKey: key('p') }).data;

  const r1 = h.run('reconcilePayment', { paymentId: pay.id, evidenceRef: 'bank-ref-1', status: 'UNRECONCILED', attemptUuid: 'att-1', idempotencyKey: key('rec1') });
  assert(r1.ok === true, 'first reconciliation attempt must succeed');
  const r2 = h.run('reconcilePayment', { paymentId: pay.id, evidenceRef: 'bank-ref-1-mismatch', status: 'EXCEPTION', attemptUuid: 'att-2', idempotencyKey: key('rec2') });
  assert(r2.ok === true, 'second reconciliation attempt (exception) must succeed as a NEW row');
  const r3 = h.run('reconcilePayment', { paymentId: pay.id, evidenceRef: 'bank-ref-1', status: 'RECONCILED', attemptUuid: 'att-3', idempotencyKey: key('rec3') });
  assert(r3.ok === true, 'third reconciliation attempt (reconciled) must succeed as a NEW row');

  assert(h.getStore().reconciliations.length === 3, 'all 3 reconciliation attempts must coexist, none overwritten');
  assert(h.getStore().payments.find(function (p) { return p.id === pay.id; }).amountCents === 2000, 'reconciliation must never alter the payment amount');

  const conflict = h.run('reconcilePayment', { paymentId: pay.id, evidenceRef: 'DIFFERENT', status: 'MATCHED', attemptUuid: 'att-1', idempotencyKey: key('rec4') });
  expectError(conflict, 'RECONCILIATION_CONFLICT', 'reusing attemptUuid with different data');

  results.case_reconciliation_multiple_attempts = 'PASS';
}

/* --------------------------------------------------------------------- *
 * CORRECTION G — deep clone proof extended to NESTED structures, and to
 * the resultSnapshot stored inside commandReceipts (not just the live
 * command output).
 * ----------------------------------------------------------------------*/
function case_output_does_not_share_dangerous_references() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Ref Venue', idempotencyKey: key('v') }).data;
  const beforeStoreSnapshot = JSON.stringify(h.getStore());

  // top-level mutation (kept from Fase 1)
  venue.name = 'MUTATED';
  venue.contactName = 'MUTATED';
  assert(JSON.stringify(h.getStore()) === beforeStoreSnapshot, 'mutating command output (top-level) must never affect the internal store');

  // NESTED mutation — agreement.rateByDay and pfr.rateByDaySnapshot
  const agreementResult = h.run('createVenueAgreement', { venueId: venue.id, rateByDay: { friday: 250 }, effectiveFrom: '2026-01-01', idempotencyKey: key('ag') });
  const occResult = h.run('createOccurrenceWithPfr', { venueId: venue.id, agreementId: agreementResult.data.id, date: '2026-06-15', shift: 'default', startTime: '20:00', rateAmountCents: 25000, idempotencyKey: key('oc') });
  const beforeNestedSnapshot = JSON.stringify(h.getStore());

  agreementResult.data.rateByDay.friday = 999999;
  agreementResult.data.rateByDay.injectedKey = 'MUTATED_BY_TEST';
  occResult.data.pfr.rateByDaySnapshot.friday = 888888;

  assert(JSON.stringify(h.getStore()) === beforeNestedSnapshot, 'mutating NESTED objects in command output must never affect the internal store');

  const storedAgreement = h.getStore().venueAgreements.find(function (a) { return a.id === agreementResult.data.id; });
  assert(storedAgreement.rateByDay.friday === 250, 'internal store must retain the original rateByDay.friday value');
  assert(!('injectedKey' in storedAgreement.rateByDay), 'internal store must not gain a key injected via the mutated output');

  const storedPfr = h.getStore().performanceFinancialRecords.find(function (p) { return p.id === occResult.data.pfr.id; });
  assert(storedPfr.rateByDaySnapshot.friday === 250, 'internal store PFR snapshot must retain the original nested value');

  // the resultSnapshot persisted inside commandReceipts must ALSO be unaffected
  const receipt = h.getStore().commandReceipts.find(function (r) { return r.commandId === agreementResult.commandId; });
  assert(receipt, 'expected a commandReceipt for the agreement creation');
  assert(receipt.resultSnapshot.data.rateByDay.friday === 250, 'the persisted resultSnapshot must retain the original nested value, unaffected by later output mutation');
  assert(!('injectedKey' in receipt.resultSnapshot.data.rateByDay), 'the persisted resultSnapshot must not gain a key injected via the mutated live output');

  results.case_output_does_not_share_dangerous_references = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_rollback_on_thrown_error_mid_command() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Rollback Venue', idempotencyKey: key('v') }).data;
  const occ = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-12-01', shift: 'default', startTime: '20:00', rateAmountCents: 1000, idempotencyKey: key('o') }).data.occurrence;
  const snapshotBeforeFailingReceivable = JSON.stringify(h.getStore());
  const badReceivable = h.run('createVenueReceivable', { occurrenceId: occ.id, amountCents: -50, idempotencyKey: key('bad-rec') });
  expectError(badReceivable, 'INVALID_AMOUNT', 'negative amountCents deep in validation');
  assert(JSON.stringify(h.getStore()) === snapshotBeforeFailingReceivable, 'store must be byte-identical after a validation failure partway through a command');
  results.case_rollback_on_thrown_error_mid_command = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_recordPayment_error_paths() {
  const h = freshHarness();
  const before = JSON.stringify(h.getStore());

  const badDirection = h.run('recordPayment', { direction: 'SIDEWAYS', amountCents: 100, currency: 'USD', paymentDate: '2026-01-01', idempotencyKey: key('rp1') });
  expectError(badDirection, 'MISSING_REQUIRED_FIELD', 'invalid direction');

  const badAmount = h.run('recordPayment', { direction: 'INFLOW', amountCents: 0, currency: 'USD', paymentDate: '2026-01-01', idempotencyKey: key('rp2') });
  expectError(badAmount, 'INVALID_AMOUNT', 'amountCents<=0');

  const missingDate = h.run('recordPayment', { direction: 'INFLOW', amountCents: 100, currency: 'USD', idempotencyKey: key('rp3') });
  expectError(missingDate, 'MISSING_REQUIRED_FIELD', 'missing paymentDate');

  assert(JSON.stringify(h.getStore()) === before, 'store must be untouched after every recordPayment error path');
  results.case_recordPayment_error_paths = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_voidPayable_error_paths() {
  const h = freshHarness();
  const payable = h.run('createPayable', { sourceType: 'EXPENSE', payeeId: 'payee-vp', purpose: 'VENDOR_PAYMENT', amountCents: 500, idempotencyKey: key('vp-create') }).data;

  const notFound = h.run('voidPayable', { payableId: 'does-not-exist', idempotencyKey: key('vp-nf') });
  expectError(notFound, 'TARGET_NOT_FOUND', 'voiding an unknown payableId');

  const paidOut = h.run('recordOwnerPayout', { payableId: payable.id, amountCents: 500, method: 'zelle', paymentDate: '2026-01-05', idempotencyKey: key('vp-payout') });
  assert(paidOut.ok === true && paidOut.data.payable.status === 'PAID', 'setup: payable must reach PAID');
  const blockedOnPaid = h.run('voidPayable', { payableId: payable.id, idempotencyKey: key('vp-blocked-paid') });
  expectError(blockedOnPaid, 'PAYABLE_ALREADY_PAID', 'voiding a fully-PAID payable');

  const partialPayable = h.run('createPayable', { sourceType: 'EXPENSE', payeeId: 'payee-vp2', purpose: 'VENDOR_PAYMENT', amountCents: 1000, idempotencyKey: key('vp-create2') }).data;
  h.run('recordOwnerPayout', { payableId: partialPayable.id, amountCents: 200, method: 'zelle', paymentDate: '2026-01-06', idempotencyKey: key('vp-payout2') });
  const before = JSON.stringify(h.getStore());
  const blockedOnActive = h.run('voidPayable', { payableId: partialPayable.id, idempotencyKey: key('vp-blocked-active') });
  expectError(blockedOnActive, 'PARTIAL_FAILURE_REQUIRES_RECOVERY', 'voiding a payable with active allocations');
  assert(JSON.stringify(h.getStore()) === before, 'store must be untouched after the blocked void attempt');

  results.case_voidPayable_error_paths = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_store_unmutated_on_error_all_17_commands() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Sweep Venue', idempotencyKey: key('sv') }).data;
  const agreement = h.run('createVenueAgreement', { venueId: venue.id, rateByDay: { friday: 100 }, effectiveFrom: '2026-01-01', idempotencyKey: key('sa') }).data;
  const occ = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2026-06-01', shift: 'default', startTime: '20:00', rateAmountCents: 5000, idempotencyKey: key('so') }).data.occurrence;
  const rec = h.run('createVenueReceivable', { occurrenceId: occ.id, amountCents: 5000, idempotencyKey: key('sr') }).data;
  const payable = h.run('createPayable', { sourceType: 'EXPENSE', payeeId: 'payee-sweep', purpose: 'VENDOR_PAYMENT', amountCents: 3000, idempotencyKey: key('sp') }).data;
  const pay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 5000, currency: 'USD', method: 'cash', paymentDate: '2026-06-02', idempotencyKey: key('spay') }).data;
  h.run('confirmPayment', { paymentId: pay.id, idempotencyKey: key('sconf') });
  const alloc = h.run('allocatePayment', { paymentId: pay.id, targetType: 'VENUE_RECEIVABLE', targetId: rec.id, amountCents: 2000, idempotencyKey: key('salloc') }).data.allocation;

  const invalidCalls = [
    ['createVenue', {}],
    ['createVenueAgreement', { venueId: 'nope', rateByDay: { friday: 1 }, effectiveFrom: '2026-01-01' }],
    ['createOccurrenceWithPfr', { venueId: 'nope', date: '2026-01-01', rateAmountCents: 100 }],
    ['rescheduleOccurrence', { occurrenceId: 'nope', newDate: '2026-01-01', reason: 'x', requestedBy: 'x' }],
    ['createVenueReceivable', { occurrenceId: 'nope', amountCents: 100 }],
    ['createPayable', { payeeId: null, purpose: 'VENDOR_PAYMENT', amountCents: 100 }],
    ['recordPayment', { direction: 'BAD', amountCents: 100, paymentDate: '2026-01-01' }],
    ['confirmPayment', { paymentId: 'nope' }],
    ['failPayment', { paymentId: 'nope', reason: 'x' }],
    ['allocatePayment', { paymentId: 'nope', targetType: 'VENUE_RECEIVABLE', targetId: rec.id, amountCents: 100 }],
    ['reverseAllocation', { allocationId: 'nope' }],
    ['recordRefund', { originalPaymentId: 'nope', amountCents: 100, reason: 'x' }],
    ['recordOwnerPayout', { payableId: 'nope', amountCents: 100, method: 'zelle', paymentDate: '2026-01-01' }],
    ['reconcilePayment', { paymentId: 'nope', status: 'MATCHED', attemptUuid: 'x' }],
    ['cancelOccurrence', { occurrenceId: 'nope', reason: 'x' }],
    ['voidReceivable', { receivableId: 'nope' }],
    ['voidPayable', { payableId: 'nope' }]
  ];
  assert(invalidCalls.length === 17, 'sweep must cover exactly 17 commands, got ' + invalidCalls.length);

  invalidCalls.forEach(function (pair) {
    var name = pair[0];
    var badInput = Object.assign({}, pair[1], { idempotencyKey: key('sweep-' + name), now: h.clock(), idGenerator: h.idGen });
    var storeBefore = h.getStore();
    var out = cmd[name](storeBefore, badInput);
    assert(out.result.ok === false, 'sweep expected an error for ' + name + ', got ok=true');
    assert(out.store === storeBefore, 'store reference must be unchanged after error in ' + name);
    observedErrorCodes.add(out.result.errorCode);
  });

  void agreement;
  void payable;
  void alloc;
  results.case_store_unmutated_on_error_all_17_commands = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_missing_idempotency_key() {
  const h = freshHarness();
  const r = h.run('createVenue', { name: 'No Key Venue' });
  expectError(r, 'MISSING_REQUIRED_FIELD', 'missing idempotencyKey');
  results.case_missing_idempotency_key = 'PASS';
}

/* --------------------------------------------------------------------- *
 * CORRECTION E — no ungoverned Math.random() on the invalid-input path;
 * deterministic even when input is null/string/array, using the injected
 * generator when present.
 * ----------------------------------------------------------------------*/
function case_invalid_input_deterministic() {
  // Fase 1D / B — for each invalid input, capture the exact store reference
  // passed in and prove: no exception, ok===false, output.store === storeRef
  // (strict reference identity), and byte-identity. Variety of inputs kept
  // exactly as-is (null, undefined, string, number, array) — not reduced.
  [null, undefined, 'not-an-object', 42, []].forEach(function (bad) {
    const storeRef = svc.createStore();
    const snapshotRef = JSON.stringify(storeRef);
    let out;
    let threw = false;
    try {
      out = cmd.createVenue(storeRef, bad);
    } catch (e) {
      threw = true;
    }
    assert(threw === false, 'invalid input must not throw an exception, but threw for ' + JSON.stringify(bad));
    assert(out.result.ok === false, 'invalid (non-object) input must fail, got ok=true for ' + JSON.stringify(bad));
    assert(out.result.errorCode === 'MISSING_REQUIRED_FIELD', 'invalid input must fail with MISSING_REQUIRED_FIELD');
    assert(out.result.stateChanged === false, 'invalid input must report stateChanged=false');
    assert(out.store === storeRef, 'output.store must be the EXACT SAME reference as the store passed in, for invalid input ' + JSON.stringify(bad));
    assert(JSON.stringify(out.store) === snapshotRef, 'store must be byte-identical before/after invalid-input rejection, for input ' + JSON.stringify(bad));
    observedErrorCodes.add(out.result.errorCode);
  });

  // determinism: when input is an object-like value that DOES carry an
  // injected idGenerator (e.g. an array, which is typeof 'object'), the
  // resulting commandId must be produced via that generator, not raw Math.random().
  const idGenA = makeIdGen('inv');
  const arrInputA = [];
  arrInputA.idGenerator = idGenA;
  const outA = cmd.createVenue(svc.createStore(), arrInputA);

  const idGenB = makeIdGen('inv');
  const arrInputB = [];
  arrInputB.idGenerator = idGenB;
  const outB = cmd.createVenue(svc.createStore(), arrInputB);

  assert(outA.result.commandId === outB.result.commandId, 'invalid-input commandId must be deterministic when an idGenerator is attached to the (non-plain-object) input, got ' + outA.result.commandId + ' vs ' + outB.result.commandId);

  results.case_invalid_input_deterministic = 'PASS';
}

/* --------------------------------------------------------------------- *
 * CORRECTION F — explicit replay / commandId semantics assertions.
 * ----------------------------------------------------------------------*/
function case_replay_semantics_explicit() {
  const clock = makeClock('2029-01-01T00:00:00.000Z');
  const idGen = makeIdGen('rp');
  let store = svc.createStore();

  const input = { name: 'Replay Venue', idempotencyKey: 'replay-fixed-key', now: clock(), idGenerator: idGen };
  const original = cmd.createVenue(store, input);
  store = original.store;
  const receiptsCountAfterOriginal = store.commandReceipts.length;
  const storedReceipt = store.commandReceipts.find(function (r) { return r.idempotencyKey === 'replay-fixed-key' && r.commandType === 'createVenue'; });
  assert(storedReceipt, 'expected a commandReceipt for the original attempt');
  assert(storedReceipt.resultSnapshot.commandId === original.result.commandId, 'the persisted resultSnapshot must carry the ORIGINAL attempt commandId');

  const storeBeforeReplay = store;
  const replayInput = { name: 'Replay Venue', idempotencyKey: 'replay-fixed-key', now: clock(), idGenerator: idGen };
  const replay = cmd.createVenue(storeBeforeReplay, replayInput);

  assert(original.result.commandId !== replay.result.commandId, 'a replay must mint a new technical commandId, distinct from the original attempt');
  assert(deepEqual(original.result.data, replay.result.data), 'replay data must equal the original data exactly (deep)');
  assert(deepEqual(original.result.createdIds, replay.result.createdIds), 'replay createdIds must equal the original exactly — no new business ids');
  assert(deepEqual(original.result.affectedIds, replay.result.affectedIds), 'replay affectedIds must equal the original exactly');
  assert(replay.result.idempotentReplay === true, 'replay result must report idempotentReplay=true');
  assert(replay.store === storeBeforeReplay, 'replay must return the EXACT SAME store reference it was given — no new store, no mutation');
  assert(replay.store.commandReceipts.length === receiptsCountAfterOriginal, 'replay must not append a new commandReceipt');
  assert(replay.store.venues.length === 1, 'replay must not create a second venue');

  results.case_replay_semantics_explicit = 'PASS';
}

/* --------------------------------------------------------------------- *
 * CORRECTION C (Fase 1D) — explicit replay test dedicated to recordPayment.
 * ----------------------------------------------------------------------*/
function case_replay_explicit_recordPayment() {
  const clock = makeClock('2033-01-01T00:00:00.000Z');
  const idGen = makeIdGen('rpm');
  let store = svc.createStore();
  const fixedKey = 'replay-recordPayment-fixed-key';
  const input = { direction: 'INFLOW', amountCents: 5000, currency: 'USD', method: 'cash', paymentDate: '2033-01-01', idempotencyKey: fixedKey, now: clock(), idGenerator: idGen };

  const original = cmd.recordPayment(store, input);
  store = original.store;
  assert(original.result.ok === true, 'original recordPayment must succeed');
  const paymentsCountAfterOriginal = store.payments.length;
  const receiptsCountAfterOriginal = store.commandReceipts.length;

  const storeBeforeReplay = store;
  const replay = cmd.recordPayment(storeBeforeReplay, Object.assign({}, input));

  assert(replay.result.ok === true, 'replay must succeed');
  assert(replay.result.idempotentReplay === true, 'replay must report idempotentReplay=true');
  assert(replay.result.commandId !== original.result.commandId, 'replay must mint a new technical commandId, distinct from the original');
  assert(deepEqual(original.result.data, replay.result.data), 'replay data must equal the original data exactly (deep)');
  assert(deepEqual(original.result.createdIds, replay.result.createdIds), 'replay createdIds must equal the original exactly');
  assert(deepEqual(original.result.affectedIds, replay.result.affectedIds), 'replay affectedIds must equal the original exactly');
  assert(replay.store === storeBeforeReplay, 'replay must return the EXACT SAME store reference it was given');
  assert(replay.store.payments.length === paymentsCountAfterOriginal, 'replay must not create a second Payment (payments.length unchanged)');
  assert(replay.store.commandReceipts.length === receiptsCountAfterOriginal, 'replay must not append a new commandReceipt');

  results.case_replay_explicit_recordPayment = 'PASS';
}

/* --------------------------------------------------------------------- *
 * CORRECTION D (Fase 1D) — explicit replay test dedicated to allocatePayment.
 * ----------------------------------------------------------------------*/
function case_replay_explicit_allocatePayment() {
  const clock = makeClock('2034-01-01T00:00:00.000Z');
  const idGen = makeIdGen('rpa');
  let store = svc.createStore();
  function run(name, input) {
    const out = cmd[name](store, Object.assign({}, input, { now: clock(), idGenerator: idGen }));
    store = out.store;
    return out.result;
  }
  const venue = run('createVenue', { name: 'Replay Alloc Venue', idempotencyKey: key('rav') }).data;
  const occ = run('createOccurrenceWithPfr', { venueId: venue.id, date: '2034-01-08', shift: 'default', startTime: '20:00', rateAmountCents: 4000, idempotencyKey: key('rao') }).data.occurrence;
  const rec = run('createVenueReceivable', { occurrenceId: occ.id, amountCents: 4000, idempotencyKey: key('rar') }).data;
  const pay = run('recordPayment', { direction: 'INFLOW', amountCents: 4000, currency: 'USD', method: 'cash', paymentDate: '2034-01-09', idempotencyKey: key('rap') }).data;
  run('confirmPayment', { paymentId: pay.id, idempotencyKey: key('rac') });

  const fixedKey = 'replay-allocatePayment-fixed-key';
  const allocInput = { paymentId: pay.id, targetType: 'VENUE_RECEIVABLE', targetId: rec.id, amountCents: 4000, idempotencyKey: fixedKey, now: clock(), idGenerator: idGen };

  const original = cmd.allocatePayment(store, allocInput);
  store = original.store;
  assert(original.result.ok === true, 'original allocatePayment must succeed');
  const allocCountAfterOriginal = store.paymentAllocations.length;
  const receiptsCountAfterOriginal = store.commandReceipts.length;

  const storeBeforeReplay = store;
  const replay = cmd.allocatePayment(storeBeforeReplay, Object.assign({}, allocInput));

  assert(replay.result.idempotentReplay === true, 'replay must report idempotentReplay=true');
  assert(replay.store === storeBeforeReplay, 'replay must return the EXACT SAME store reference it was given');
  assert(replay.store.paymentAllocations.length === allocCountAfterOriginal, 'replay must not create a second Allocation');
  assert(replay.store.commandReceipts.length === receiptsCountAfterOriginal, 'replay must not append a new commandReceipt');
  assert(deepEqual(original.result.data, replay.result.data), 'replay data must equal the original data exactly (deep)');
  assert(deepEqual(original.result.createdIds, replay.result.createdIds), 'replay createdIds must equal the original exactly');
  assert(deepEqual(original.result.affectedIds, replay.result.affectedIds), 'replay affectedIds must equal the original exactly');
  assert(replay.result.commandId !== original.result.commandId, 'replay must mint a new technical commandId, distinct from the original');

  results.case_replay_explicit_allocatePayment = 'PASS';
}

/* --------------------------------------------------------------------- *
 * CORRECTION C — the {store, result} contract itself, made explicit.
 * ----------------------------------------------------------------------*/
function case_functional_contract_explicit() {
  const clock = makeClock('2030-01-01T00:00:00.000Z');
  const idGen = makeIdGen('fc');
  const inputStore = svc.createStore();
  const beforeSnapshot = JSON.stringify(inputStore);

  const out = cmd.createVenue(inputStore, { name: 'Contract Venue', idempotencyKey: key('fc1'), now: clock(), idGenerator: idGen });
  assert(out.result.ok === true, 'command must succeed');

  // 1. the ORIGINAL store reference is untouched after a SUCCESSFUL command
  assert(JSON.stringify(inputStore) === beforeSnapshot, 'the original store must remain byte-identical after a successful command (only output.store reflects it)');
  assert(inputStore.venues.length === 0, 'the original store must not contain the new venue');

  // 2. output.store contains the operation
  assert(out.store !== inputStore, 'output.store must be a different reference than the input store');
  assert(out.store.venues.length === 1, 'output.store must contain the newly created venue');

  // 3. if the caller ignores output.store, the effect is invisible on the original
  //    (already proven by point 1 — restated here for explicitness)
  assert(inputStore.venues.length === 0, 'ignoring output.store means the original store never observes the write');

  // 4. correct chaining pattern
  var store = inputStore;
  var out2 = cmd.createVenue(store, { name: 'Chained Venue', idempotencyKey: key('fc2'), now: clock(), idGenerator: idGen });
  store = out2.store;
  assert(store.venues.length === 1, 'after correct chaining (store = out.store), the local variable must reflect the operation');

  // 5. a second command run against the ORIGINAL (never-reassigned) store must NOT see the first operation
  const venueId = out.result.data.id;
  const onOriginal = cmd.createVenueAgreement(inputStore, { venueId: venueId, rateByDay: { friday: 100 }, effectiveFrom: '2030-01-01', idempotencyKey: key('fc3'), now: clock(), idGenerator: idGen });
  assert(onOriginal.result.ok === false && onOriginal.result.errorCode === 'TARGET_NOT_FOUND', 'a command run against the ORIGINAL (un-reassigned) store must not see a venue created by a prior call whose output.store was ignored');
  observedErrorCodes.add(onOriginal.result.errorCode);

  // 6. a second command run against output.store DOES see the first operation
  const onOutput = cmd.createVenueAgreement(out.store, { venueId: venueId, rateByDay: { friday: 100 }, effectiveFrom: '2030-01-01', idempotencyKey: key('fc4'), now: clock(), idGenerator: idGen });
  assert(onOutput.result.ok === true, 'a command run against output.store MUST see the venue created by the prior command');

  results.case_functional_contract_explicit = 'PASS';
}

/* --------------------------------------------------------------------- *
 * CORRECTION H — idempotencyKey scoped by (commandType, key), not global.
 * ----------------------------------------------------------------------*/
function case_idempotencyKey_scoped_per_commandType() {
  const clock = makeClock('2031-01-01T00:00:00.000Z');
  const idGen = makeIdGen('sc');
  let store = svc.createStore();
  const sharedKey = 'shared-key-across-command-types';

  const out1 = cmd.createVenue(store, { name: 'Scoped Venue', idempotencyKey: sharedKey, now: clock(), idGenerator: idGen });
  store = out1.store;
  assert(out1.result.ok === true, 'createVenue with the shared key must succeed');

  const out2 = cmd.recordPayment(store, { direction: 'INFLOW', amountCents: 100, currency: 'USD', paymentDate: '2031-01-02', idempotencyKey: sharedKey, now: clock(), idGenerator: idGen });
  store = out2.store;
  assert(out2.result.ok === true, 'recordPayment reusing the SAME literal idempotencyKey (different commandType) must succeed, not be treated as a duplicate — the key is scoped per (commandType, key)');
  assert(out2.result.errorCode !== 'DUPLICATE_IDEMPOTENCY_KEY', 'must not raise a cross-commandType DUPLICATE_IDEMPOTENCY_KEY');

  const receiptsForKey = store.commandReceipts.filter(function (r) { return r.idempotencyKey === sharedKey; });
  assert(receiptsForKey.length === 2, 'expected exactly 2 receipts sharing the same idempotencyKey string');
  const commandTypes = receiptsForKey.map(function (r) { return r.commandType; }).sort();
  assert(commandTypes[0] === 'createVenue' && commandTypes[1] === 'recordPayment', 'the two receipts must have distinct commandType values: ' + commandTypes.join(','));

  results.case_idempotencyKey_scoped_per_commandType = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_determinism_same_scenario_twice() {
  function runScenario() {
    const clock = makeClock('2027-01-01T00:00:00.000Z');
    const idGen = makeIdGen('d');
    let store = svc.createStore();
    function run(name, input) {
      const out = cmd[name](store, Object.assign({}, input, { now: clock(), idGenerator: idGen }));
      store = out.store;
      return out.result;
    }
    const venue = run('createVenue', { name: 'Determinism Venue', idempotencyKey: 'fixed-key-venue' }).data;
    const occ = run('createOccurrenceWithPfr', { venueId: venue.id, date: '2027-01-08', shift: 'default', startTime: '20:00', rateAmountCents: 7500, idempotencyKey: 'fixed-key-occ' }).data.occurrence;
    return { store: store, venueId: venue.id, occId: occ.id };
  }
  const run1 = runScenario();
  const run2 = runScenario();
  assert(run1.venueId === run2.venueId, 'deterministic idGenerator must produce identical ids across independent runs');
  assert(run1.occId === run2.occId, 'deterministic idGenerator must produce identical ids across independent runs (occurrence)');
  assert(JSON.stringify(run1.store) === JSON.stringify(run2.store), 'identical scenario with injected deterministic clock/idGenerator must produce byte-identical stores');
  results.case_determinism_same_scenario_twice = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_queries_ar_ap_cash() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Query Venue', idempotencyKey: key('v') }).data;
  const occ = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2027-02-01', shift: 'default', startTime: '20:00', rateAmountCents: 9000, idempotencyKey: key('o') }).data.occurrence;
  const rec = h.run('createVenueReceivable', { occurrenceId: occ.id, amountCents: 9000, idempotencyKey: key('r') }).data;
  assert(qry.getAccountsReceivable(h.getStore()) === 9000, 'AR must equal the open receivable balance before any collection');

  const payable = h.run('createPayable', { sourceType: 'OCCURRENCE', sourceId: occ.id, payeeId: 'dj-1', purpose: 'DJ_PAYMENT', amountCents: 6000, idempotencyKey: key('pay') }).data;
  assert(qry.getAccountsPayable(h.getStore()) === 6000, 'AP must equal the open payable balance before any payout');

  const inflowBefore = qry.getCashInflow(h.getStore());
  const pay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 9000, currency: 'USD', method: 'cash', paymentDate: '2027-02-02', idempotencyKey: key('p') }).data;
  h.run('confirmPayment', { paymentId: pay.id, idempotencyKey: key('c') });
  assert(qry.getCashInflow(h.getStore()) === inflowBefore + 9000, 'cashInflow must increase only after CONFIRMED, not on PENDING');
  h.run('allocatePayment', { paymentId: pay.id, targetType: 'VENUE_RECEIVABLE', targetId: rec.id, amountCents: 9000, idempotencyKey: key('al') });
  assert(qry.getAccountsReceivable(h.getStore()) === 0, 'AR must drop to 0 once fully allocated');

  h.run('recordOwnerPayout', { payableId: payable.id, amountCents: 6000, method: 'zelle', paymentDate: '2027-02-03', idempotencyKey: key('po') });
  assert(qry.getAccountsPayable(h.getStore()) === 0, 'AP must drop to 0 once fully paid out');
  assert(qry.getCashOutflow(h.getStore()) === 6000, 'cashOutflow must reflect the confirmed payout');
  assert(qry.getNetCash(h.getStore()) === 9000 - 6000, 'netCash must equal inflow - outflow');

  results.case_queries_ar_ap_cash = 'PASS';
}

/* ===========================================================================
 * Run everything
 * ======================================================================= */

case_createVenue_and_missing_field();
case_createVenueAgreement_unresolved_venue();
case_invalid_date();
case_full_venue_chain_and_occurrence_duplicate();
case_idempotency_conflict_recordPayment();
case_reschedule_happy_and_collision();
case_receivable_duplicate();
case_payment_pending_confirmed_failed();
case_allocation_partial_and_full_plus_overallocation();
case_allocation_reversal_append_only_and_currency_mismatch();
case_allocation_fully_reversed_no_longer_active();
case_currency_normalization();
case_ownerLedgerEntry_currency_normalized();
case_refund_partial_multiple_and_excessive();
case_refund_with_allocation_reversal();
case_payable_partial_and_complete_and_ownerpayout_overallocation();
case_cancel_occurrence_clean_and_with_money();
case_void_permitted_and_blocked();
case_reconciliation_multiple_attempts();
case_output_does_not_share_dangerous_references();
case_rollback_on_thrown_error_mid_command();
case_recordPayment_error_paths();
case_voidPayable_error_paths();
case_store_unmutated_on_error_all_17_commands();
case_missing_idempotency_key();
case_invalid_input_deterministic();
case_replay_semantics_explicit();
case_replay_explicit_recordPayment();
case_replay_explicit_allocatePayment();
case_functional_contract_explicit();
case_idempotencyKey_scoped_per_commandType();
case_determinism_same_scenario_twice();
case_queries_ar_ap_cash();

/* ===========================================================================
 * CORRECTION A — real dynamic coverage report (no manual guard array).
 * ======================================================================= */

const errorCodesObservedArray = Array.from(observedErrorCodes).sort();
const errorCodesExpectedSorted = errorCodesExpected.slice().sort();
const missingErrorCodes = errorCodesExpectedSorted.filter(function (c) { return !observedErrorCodes.has(c); });
const unexpectedErrorCodes = errorCodesObservedArray.filter(function (c) { return errorCodesExpected.indexOf(c) === -1; });

assert(missingErrorCodes.length === 0, 'expected error codes never actually observed during the run: ' + missingErrorCodes.join(', '));
assert(unexpectedErrorCodes.length === 0, 'observed error codes not in the expected list (module drift or typo): ' + unexpectedErrorCodes.join(', '));

results.errorCodesExpected = errorCodesExpectedSorted;
results.errorCodesObserved = errorCodesObservedArray;
results.missingErrorCodes = missingErrorCodes;
results.unexpectedErrorCodes = unexpectedErrorCodes;

console.log(
  JSON.stringify(
    {
      ok: true,
      results: results,
      networkAccess: 0,
      localStorageAccess: 0,
      domAccess: 0,
      note: 'sandbox never defined fetch/localStorage/document — any access would have thrown ReferenceError before reaching this line'
    },
    null,
    2
  )
);
