/**
 * TICKET-010 — Domain Events / Outbox Local — Fase 1 self-test
 * Local-only (no localStorage, no DOM, no network, no Supabase, no dispatcher).
 *
 * Run: node web/js/mdj-financial-domain-events.local-selftest.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesSrc = fs.readFileSync(path.join(__dirname, 'mdj-financial-local-services.js'), 'utf8');
const eventsSrc = fs.readFileSync(path.join(__dirname, 'mdj-financial-domain-events.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
}
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* Sandbox WITHOUT document/localStorage/fetch/XHR/navigator/setTimeout/setInterval
 * — any access throws. Both modules loaded into the SAME sandbox context. */
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
vm.runInContext(servicesSrc, sandbox);
vm.runInContext(eventsSrc, sandbox);

const FinancialServicesMod = windowStub.MDJFinancialLocalServices;
const DomainEventsMod = windowStub.MDJFinancialDomainEvents;
assert(FinancialServicesMod, 'MDJFinancialLocalServices missing from sandbox global');
assert(DomainEventsMod, 'MDJFinancialDomainEvents missing from sandbox global');

const evtSvc = DomainEventsMod.createDomainEventsOutbox(FinancialServicesMod);
const cmd = evtSvc.commands;
const outboxOps = evtSvc.outboxOps;

/* A SEPARATE instance with an injected faultInjector, used ONLY by the
 * dedicated rollback tests below. Every other test in this file uses the
 * plain `evtSvc` above (created with no faultInjector), which is exactly
 * how the suite proves the normal path is unaffected by this seam. */
function createFaultInjectingService(shouldFail) {
  return DomainEventsMod.createDomainEventsOutbox(FinancialServicesMod, {
    faultInjector: function (stage, context) {
      if (shouldFail(stage, context)) {
        throw new Error('INJECTED_TEST_FAULT:' + stage + ':' + (context.index != null ? context.index : ''));
      }
    }
  });
}

/* Fase 1D — a SEPARATE fault-injecting helper that can OVERRIDE a deriver's
 * return value (not just throw), reusing the exact same 'deriver'-stage
 * seam. `overrideFn(stage, context)` returning `{override: X}` swaps in X
 * as the deriver's output for that one call; returning anything else (or
 * nothing) leaves the real deriver untouched. */
function createOverridingService(overrideFn) {
  return DomainEventsMod.createDomainEventsOutbox(FinancialServicesMod, {
    faultInjector: function (stage, context) {
      return overrideFn(stage, context);
    }
  });
}

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
 * Dynamic event-type coverage — fed exclusively from real emitted events
 * (never a hand-typed "exercised" list).
 * ======================================================================= */
const observedEventTypes = new Set();

function freshHarness() {
  const clock = makeClock('2040-01-01T00:00:00.000Z');
  const idGen = makeIdGen('e');
  let store = evtSvc.createStore();
  function run(name, input) {
    const before = store.domainEvents.length;
    input = Object.assign({}, input, { now: clock(), idGenerator: idGen });
    const out = cmd[name](store, input);
    store = out.store;
    store.domainEvents.slice(before).forEach(function (e) { observedEventTypes.add(e.eventType); });
    return out.result;
  }
  return { run: run, getStore: function () { return store; }, clock: clock, idGen: idGen };
}

/* --------------------------------------------------------------------- */
function case_simple_emission_createVenue() {
  const h = freshHarness();
  const r = h.run('createVenue', { name: 'Simple Venue', idempotencyKey: key('sv') });
  assert(r.ok === true, 'createVenue must succeed');

  const store = h.getStore();
  assert(store.domainEvents.length === 1, 'exactly 1 event must be emitted for a simple createVenue');
  assert(store.outbox.length === 1, 'exactly 1 outbox row must be created for that event');

  const ev = store.domainEvents[0];
  assert(ev.eventType === 'VenueCreated', 'event type must be VenueCreated');
  assert(ev.aggregateType === 'Venue', 'aggregateType must be Venue');
  assert(ev.aggregateId === r.data.id, 'aggregateId must equal the created venue id');
  assert(ev.eventVersion === 1, 'eventVersion must be 1');
  assert(ev.eventPosition === 1, 'first event in a fresh store must have eventPosition 1');
  assert(ev.commandId === r.commandId, 'event commandId must equal the command result commandId');
  assert(ev.commandType === 'createVenue', 'event commandType must equal the wrapped command name');
  assert(ev.idempotencyKey, 'event idempotencyKey must be populated');
  assert(ev.payload.name === 'Simple Venue', 'event payload must carry the created entity data');

  const outboxRow = store.outbox[0];
  assert(outboxRow.eventId === ev.id, 'outbox row must reference the emitted event by id');
  assert(outboxRow.status === 'PENDING', 'a fresh outbox row must start PENDING');
  assert(outboxRow.attempts === 0, 'a fresh outbox row must start with attempts=0');
  assert(outboxRow.maxAttempts === 5, 'maxAttempts must be 5');
  assert(outboxRow.lastAttemptAt === null, 'a fresh outbox row must have lastAttemptAt=null');
  assert(outboxRow.lastError === null, 'a fresh outbox row must have lastError=null');
  assert(outboxRow.nextRetryAt === null, 'a fresh outbox row must have nextRetryAt=null');

  results.case_simple_emission_createVenue = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_compound_createOccurrenceWithPfr() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Compound Venue', idempotencyKey: key('cv') }).data;
  const before = h.getStore().domainEvents.length;
  const r = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2040-02-01', shift: 'default', startTime: '20:00', rateAmountCents: 5000, idempotencyKey: key('co') });
  assert(r.ok === true, 'createOccurrenceWithPfr must succeed');

  const store = h.getStore();
  const newEvents = store.domainEvents.slice(before);
  assert(newEvents.length === 2, 'createOccurrenceWithPfr must emit exactly 2 events (Occurrence + PFR)');
  assert(newEvents[0].eventType === 'OccurrenceScheduled', 'first compound event must be OccurrenceScheduled');
  assert(newEvents[0].aggregateId === r.data.occurrence.id, 'OccurrenceScheduled aggregateId must be the occurrence id');
  assert(newEvents[1].eventType === 'PerformanceFinancialRecordCreated', 'second compound event must be PerformanceFinancialRecordCreated');
  assert(newEvents[1].aggregateId === r.data.pfr.id, 'PerformanceFinancialRecordCreated aggregateId must be the pfr id');
  assert(newEvents[1].eventPosition === newEvents[0].eventPosition + 1, 'compound events must have strictly consecutive positions');

  const newOutbox = store.outbox.slice(store.outbox.length - 2);
  assert(newOutbox.length === 2, 'exactly 2 outbox rows must be created for the 2 compound events');
  assert(newOutbox[0].eventId === newEvents[0].id && newOutbox[1].eventId === newEvents[1].id, 'each outbox row must reference its own event 1:1');

  results.case_compound_createOccurrenceWithPfr = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_eventPosition_global_increasing() {
  const h = freshHarness();
  h.run('createVenue', { name: 'Position Venue', idempotencyKey: key('pv') });
  h.run('createPayable', { sourceType: 'EXPENSE', payeeId: 'payee-pos', purpose: 'VENDOR_PAYMENT', amountCents: 100, idempotencyKey: key('pp') });
  h.run('recordPayment', { direction: 'INFLOW', amountCents: 100, currency: 'USD', method: 'cash', paymentDate: '2040-03-01', idempotencyKey: key('prp') });

  const positions = h.getStore().domainEvents.map(function (e) { return e.eventPosition; });
  assert(positions.length === 3, 'expected exactly 3 events across 3 different commandTypes');
  for (let i = 0; i < positions.length; i++) {
    assert(positions[i] === i + 1, 'eventPosition must be globally sequential across DIFFERENT commandTypes, got ' + positions.join(','));
  }
  results.case_eventPosition_global_increasing = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_append_only_domainEvents_and_outbox() {
  const h = freshHarness();
  h.run('createVenue', { name: 'Append Venue 1', idempotencyKey: key('av1') });
  const snapshotAfterFirst = JSON.stringify(h.getStore().domainEvents[0]);
  const outboxSnapshotAfterFirst = JSON.stringify(h.getStore().outbox[0]);

  h.run('createVenue', { name: 'Append Venue 2', idempotencyKey: key('av2') });
  h.run('createVenue', { name: 'Append Venue 3', idempotencyKey: key('av3') });

  const store = h.getStore();
  assert(store.domainEvents.length === 3, 'domainEvents must only grow, never shrink or replace');
  assert(store.outbox.length === 3, 'outbox must only grow, never shrink or replace');
  assert(JSON.stringify(store.domainEvents[0]) === snapshotAfterFirst, 'the first event row must remain byte-identical after later commands append more events');
  assert(JSON.stringify(store.outbox[0]) === outboxSnapshotAfterFirst, 'the first outbox row must remain byte-identical after later commands append more rows');

  results.case_append_only_domainEvents_and_outbox = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_payload_deep_clone() {
  const h = freshHarness();
  const r = h.run('createVenue', { name: 'Clone Venue', idempotencyKey: key('clv') });
  const storedBefore = JSON.stringify(h.getStore().domainEvents[0]);

  r.data.name = 'MUTATED_AFTER_THE_FACT';
  r.data.injectedKey = 'INJECTED';

  const storedAfter = h.getStore().domainEvents[0];
  assert(JSON.stringify(storedAfter) === storedBefore, 'mutating the command result AFTER the call must never affect the already-stored event payload');
  assert(storedAfter.payload.name === 'Clone Venue', 'stored event payload must retain the original value, unaffected by later mutation');
  assert(!('injectedKey' in storedAfter.payload), 'stored event payload must not gain a key injected via later mutation of the live result');

  results.case_payload_deep_clone = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_replay_no_events() {
  const h = freshHarness();
  const input = { name: 'Replay Venue', idempotencyKey: key('rv') };
  const r1 = h.run('createVenue', input);
  assert(r1.ok === true && r1.idempotentReplay === false, 'first call must be a genuine new success');
  const countsAfterFirst = { events: h.getStore().domainEvents.length, outbox: h.getStore().outbox.length };

  const r2 = h.run('createVenue', input);
  assert(r2.ok === true && r2.idempotentReplay === true, 'second identical call must be a replay');
  assert(h.getStore().domainEvents.length === countsAfterFirst.events, 'a replay must NOT emit any new domainEvent');
  assert(h.getStore().outbox.length === countsAfterFirst.outbox, 'a replay must NOT create any new outbox row');

  results.case_replay_no_events = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_conflict_no_events() {
  const h = freshHarness();
  const fixedKey = key('cfk');
  h.run('createVenue', { name: 'Conflict Venue A', idempotencyKey: fixedKey });
  const countsAfterFirst = { events: h.getStore().domainEvents.length, outbox: h.getStore().outbox.length };

  const conflict = h.run('createVenue', { name: 'Conflict Venue B (different payload)', idempotencyKey: fixedKey });
  assert(conflict.ok === false && conflict.errorCode === 'DUPLICATE_IDEMPOTENCY_KEY', 'same key + different payload must conflict');
  assert(h.getStore().domainEvents.length === countsAfterFirst.events, 'a DUPLICATE_IDEMPOTENCY_KEY conflict must NOT emit any event');
  assert(h.getStore().outbox.length === countsAfterFirst.outbox, 'a DUPLICATE_IDEMPOTENCY_KEY conflict must NOT create any outbox row');

  results.case_conflict_no_events = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_error_no_events_sweep() {
  const h = freshHarness();
  const before = { events: h.getStore().domainEvents.length, outbox: h.getStore().outbox.length };

  const errorCalls = [
    ['createVenue', {}],
    ['createVenueAgreement', { venueId: 'nope', rateByDay: { friday: 1 }, effectiveFrom: '2040-01-01' }],
    ['recordPayment', { direction: 'BAD', amountCents: 100, paymentDate: '2040-01-01' }],
    ['voidPayable', { payableId: 'nope' }]
  ];
  errorCalls.forEach(function (pair) {
    const r = h.run(pair[0], Object.assign({}, pair[1], { idempotencyKey: key('err-' + pair[0]) }));
    assert(r.ok === false, 'expected an error for ' + pair[0]);
  });

  assert(h.getStore().domainEvents.length === before.events, 'no error path may ever emit a domainEvent');
  assert(h.getStore().outbox.length === before.outbox, 'no error path may ever create an outbox row');

  results.case_error_no_events_sweep = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_atomicity_entities_receipt_events_outbox_together() {
  const h = freshHarness();
  const beforeCounts = function () {
    const s = h.getStore();
    return { venues: s.venues.length, receipts: s.commandReceipts.length, events: s.domainEvents.length, outbox: s.outbox.length };
  };

  const b1 = beforeCounts();
  h.run('createVenue', { name: 'Atomic Venue', idempotencyKey: key('atv') });
  const a1 = beforeCounts();
  assert(a1.venues === b1.venues + 1, 'venue count must increment on success');
  assert(a1.receipts === b1.receipts + 1, 'commandReceipts must increment together with the venue');
  assert(a1.events === b1.events + 1, 'domainEvents must increment together with the venue');
  assert(a1.outbox === b1.outbox + 1, 'outbox must increment together with the venue');

  const b2 = beforeCounts();
  const errRes = h.run('createVenue', {}); // MISSING_REQUIRED_FIELD
  assert(errRes.ok === false, 'setup: this call must fail');
  const a2 = beforeCounts();
  assert(a2.venues === b2.venues, 'venue count must NOT change on error');
  assert(a2.receipts === b2.receipts, 'commandReceipts must NOT change on error (all 4 stay together, none partially advance)');
  assert(a2.events === b2.events, 'domainEvents must NOT change on error');
  assert(a2.outbox === b2.outbox, 'outbox must NOT change on error');

  results.case_atomicity_entities_receipt_events_outbox_together = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_outbox_1to1_with_events() {
  const h = freshHarness();
  h.run('createVenue', { name: 'Ratio Venue', idempotencyKey: key('ratv') });
  const venue = h.getStore().venues[0];
  h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2040-04-01', shift: 'default', startTime: '20:00', rateAmountCents: 3000, idempotencyKey: key('rato') });

  const store = h.getStore();
  assert(store.outbox.length === store.domainEvents.length, 'outbox.length must always equal domainEvents.length (strict 1:1)');
  const eventIds = store.domainEvents.map(function (e) { return e.id; });
  const outboxEventIds = store.outbox.map(function (o) { return o.eventId; });
  assert(deepEqual(eventIds.slice().sort(), outboxEventIds.slice().sort()), 'every outbox row must reference exactly one existing event, and vice versa');

  results.case_outbox_1to1_with_events = 'PASS';
}

/* --------------------------------------------------------------------- *
 * Outbox pure operations: retry backoff, POISON, DELIVERED, deliverable set
 * ----------------------------------------------------------------------*/
function case_retry_backoff_schedule() {
  const h = freshHarness();
  h.run('createVenue', { name: 'Backoff Venue', idempotencyKey: key('bov') });
  const outboxId = h.getStore().outbox[0].id;
  let store = h.getStore();
  const baseNow = '2040-05-01T00:00:00.000Z';

  store = outboxOps.recordOutboxFailure(store, outboxId, baseNow, 'transient error 1');
  let row = store.outbox.filter(function (r) { return r.id === outboxId; })[0];
  assert(row.status === 'FAILED', 'attempt 1 failure must set status=FAILED');
  assert(row.attempts === 1, 'attempt 1 failure must set attempts=1');
  assert(row.nextRetryAt === '2040-05-01T00:01:00.000Z', 'attempt 1 failure must schedule +1 minute, got ' + row.nextRetryAt);
  assert(row.lastError === 'transient error 1', 'lastError must be recorded');

  store = outboxOps.recordOutboxFailure(store, outboxId, row.nextRetryAt, 'transient error 2');
  row = store.outbox.filter(function (r) { return r.id === outboxId; })[0];
  assert(row.attempts === 2, 'attempt 2 failure must set attempts=2');
  assert(row.nextRetryAt === '2040-05-01T00:06:00.000Z', 'attempt 2 failure must schedule +5 minutes from the attempt time, got ' + row.nextRetryAt);

  store = outboxOps.recordOutboxFailure(store, outboxId, row.nextRetryAt, 'transient error 3');
  row = store.outbox.filter(function (r) { return r.id === outboxId; })[0];
  assert(row.attempts === 3, 'attempt 3 failure must set attempts=3');
  assert(row.nextRetryAt === '2040-05-01T00:21:00.000Z', 'attempt 3 failure must schedule +15 minutes, got ' + row.nextRetryAt);

  store = outboxOps.recordOutboxFailure(store, outboxId, row.nextRetryAt, 'transient error 4');
  row = store.outbox.filter(function (r) { return r.id === outboxId; })[0];
  assert(row.attempts === 4, 'attempt 4 failure must set attempts=4');
  assert(row.nextRetryAt === '2040-05-01T01:21:00.000Z', 'attempt 4 failure must schedule +1 hour, got ' + row.nextRetryAt);
  assert(row.status === 'FAILED', 'attempt 4 failure must still be FAILED (not yet POISON)');

  results.case_retry_backoff_schedule = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_retry_poison_on_5th_failure() {
  const h = freshHarness();
  h.run('createVenue', { name: 'Poison Venue', idempotencyKey: key('poiv') });
  const outboxId = h.getStore().outbox[0].id;
  let store = h.getStore();
  let now = '2040-06-01T00:00:00.000Z';

  for (let attempt = 1; attempt <= 4; attempt++) {
    store = outboxOps.recordOutboxFailure(store, outboxId, now, 'fail ' + attempt);
    const row = store.outbox.filter(function (r) { return r.id === outboxId; })[0];
    assert(row.status === 'FAILED', 'attempts 1-4 must stay FAILED, not POISON yet (attempt ' + attempt + ')');
    now = row.nextRetryAt;
  }

  store = outboxOps.recordOutboxFailure(store, outboxId, now, 'fail 5 final');
  const row = store.outbox.filter(function (r) { return r.id === outboxId; })[0];
  assert(row.status === 'POISON', 'the 5th failure must set status=POISON');
  assert(row.attempts === 5, 'the 5th failure must set attempts=5');
  assert(row.nextRetryAt === null, 'a POISON row must have nextRetryAt=null');
  assert(row.lastError === 'fail 5 final', 'POISON row must retain the last error message');

  results.case_retry_poison_on_5th_failure = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_outbox_delivered() {
  const h = freshHarness();
  h.run('createVenue', { name: 'Delivered Venue', idempotencyKey: key('delv') });
  const outboxId = h.getStore().outbox[0].id;
  let store = h.getStore();

  store = outboxOps.recordOutboxFailure(store, outboxId, '2040-07-01T00:00:00.000Z', 'transient');
  store = outboxOps.markOutboxDelivered(store, outboxId, '2040-07-01T00:02:00.000Z');
  const row = store.outbox.filter(function (r) { return r.id === outboxId; })[0];

  assert(row.status === 'DELIVERED', 'markOutboxDelivered must set status=DELIVERED');
  assert(row.attempts === 2, 'delivery counts as a real attempt too (1 prior failure + 1 successful delivery = 2)');
  assert(row.nextRetryAt === null, 'a DELIVERED row must have nextRetryAt=null');
  assert(row.lastError === null, 'a DELIVERED row must clear lastError');
  assert(row.lastAttemptAt === '2040-07-01T00:02:00.000Z', 'lastAttemptAt must reflect the delivery timestamp');

  results.case_outbox_delivered = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_poison_does_not_block_other_outbox_rows() {
  const h = freshHarness();
  h.run('createVenue', { name: 'Poison Blocker Venue', idempotencyKey: key('pbv') });
  h.run('createPayable', { sourceType: 'EXPENSE', payeeId: 'payee-pb', purpose: 'VENDOR_PAYMENT', amountCents: 500, idempotencyKey: key('pbp') });

  let store = h.getStore();
  assert(store.outbox.length === 2, 'setup: expected exactly 2 outbox rows');
  const [rowA, rowB] = store.outbox;
  let now = '2040-08-01T00:00:00.000Z';

  for (let attempt = 1; attempt <= 5; attempt++) {
    store = outboxOps.recordOutboxFailure(store, rowA.id, now, 'poisoning A, attempt ' + attempt);
    const current = store.outbox.filter(function (r) { return r.id === rowA.id; })[0];
    now = current.nextRetryAt || now;
  }
  const poisoned = store.outbox.filter(function (r) { return r.id === rowA.id; })[0];
  assert(poisoned.status === 'POISON', 'setup: row A must now be POISON');

  const deliverable = outboxOps.getDeliverableOutbox(store, '2040-09-01T00:00:00.000Z');
  const deliverableIds = deliverable.map(function (r) { return r.id; });
  assert(deliverableIds.indexOf(rowA.id) === -1, 'a POISON row must never be returned as deliverable');
  assert(deliverableIds.indexOf(rowB.id) !== -1, 'row B (never touched) must still be deliverable — POISON on A must not block B');

  results.case_poison_does_not_block_other_outbox_rows = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_getDeliverableOutbox_semantics() {
  const h = freshHarness();
  h.run('createVenue', { name: 'Deliverable Venue', idempotencyKey: key('dlv') });
  let store = h.getStore();
  const outboxId = store.outbox[0].id;

  // Fresh PENDING row (nextRetryAt=null) must be immediately deliverable.
  let deliverable = outboxOps.getDeliverableOutbox(store, '2040-10-01T00:00:00.000Z');
  assert(deliverable.some(function (r) { return r.id === outboxId; }), 'a fresh PENDING row must be deliverable immediately');

  // After a failure with a FUTURE nextRetryAt, it must NOT be deliverable yet.
  store = outboxOps.recordOutboxFailure(store, outboxId, '2040-10-01T00:00:00.000Z', 'transient');
  const row = store.outbox.filter(function (r) { return r.id === outboxId; })[0];
  deliverable = outboxOps.getDeliverableOutbox(store, '2040-10-01T00:00:30.000Z'); // 30s later, before the 1-minute nextRetryAt
  assert(!deliverable.some(function (r) { return r.id === outboxId; }), 'a FAILED row must NOT be deliverable before its nextRetryAt');

  // Once "now" reaches/passes nextRetryAt, it must become deliverable again.
  deliverable = outboxOps.getDeliverableOutbox(store, row.nextRetryAt);
  assert(deliverable.some(function (r) { return r.id === outboxId; }), 'a FAILED row must be deliverable once now >= nextRetryAt');

  // A DELIVERED row must never be deliverable again.
  const delivered = outboxOps.markOutboxDelivered(store, outboxId, row.nextRetryAt);
  deliverable = outboxOps.getDeliverableOutbox(delivered, '2099-01-01T00:00:00.000Z');
  assert(!deliverable.some(function (r) { return r.id === outboxId; }), 'a DELIVERED row must never be returned as deliverable again');

  results.case_getDeliverableOutbox_semantics = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_eventVersion_and_traceability_fields() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Trace Venue', idempotencyKey: key('trv') }).data;
  const occ = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2040-11-01', shift: 'default', startTime: '20:00', rateAmountCents: 4000, idempotencyKey: key('tro') }).data.occurrence;
  const payInput = { direction: 'INFLOW', amountCents: 4000, currency: 'USD', method: 'cash', paymentDate: '2040-11-02', idempotencyKey: key('trp') };
  const pay = h.run('recordPayment', payInput).data;
  const confirmInput = { paymentId: pay.id, idempotencyKey: key('trc') };
  const confirmResult = h.run('confirmPayment', confirmInput);

  const store = h.getStore();
  const confirmEvent = store.domainEvents.filter(function (e) { return e.eventType === 'PaymentConfirmed'; })[0];
  assert(confirmEvent, 'expected a PaymentConfirmed event');
  assert(confirmEvent.eventVersion === 1, 'eventVersion must be 1');
  assert(confirmEvent.commandId === confirmResult.commandId, 'commandId must match the confirmPayment result commandId');
  assert(confirmEvent.idempotencyKey === confirmInput.idempotencyKey, 'idempotencyKey must match the confirmPayment input');
  assert(confirmEvent.aggregateType === 'Payment', 'PaymentConfirmed aggregateType must be Payment');
  assert(confirmEvent.aggregateId === pay.id, 'PaymentConfirmed aggregateId must be the payment id');
  assert(confirmEvent.payload.payment.status === 'CONFIRMED', 'payload must carry the confirmed payment');
  assert(confirmEvent.payload.ledgerEntry, 'payload must embed the ledgerEntry as context (not as its own event, per Q1)');
  assert(store.domainEvents.filter(function (e) { return e.eventType === 'OwnerLedgerEntryPosted'; }).length === 0, 'OwnerLedgerEntry must NEVER produce its own event type (locked Q1 decision)');

  void occ;
  results.case_eventVersion_and_traceability_fields = 'PASS';
}

/* --------------------------------------------------------------------- *
 * Compound / cascading command coverage (drives full 18-type catalog)
 * ----------------------------------------------------------------------*/
function case_cascade_cancelOccurrence_events() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Cascade Venue', idempotencyKey: key('csv') }).data;
  const occ = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2040-12-01', shift: 'default', startTime: '20:00', rateAmountCents: 2000, idempotencyKey: key('cso') }).data.occurrence;
  h.run('createVenueReceivable', { occurrenceId: occ.id, amountCents: 2000, idempotencyKey: key('csr') });
  h.run('createPayable', { sourceType: 'OCCURRENCE', sourceId: occ.id, payeeId: 'dj-cascade', purpose: 'DJ_PAYMENT', amountCents: 1500, idempotencyKey: key('csp') });

  const before = h.getStore().domainEvents.length;
  const cancelResult = h.run('cancelOccurrence', { occurrenceId: occ.id, reason: 'cascade test', idempotencyKey: key('cscancel') });
  assert(cancelResult.ok === true, 'cancelOccurrence must succeed (no active allocations exist)');

  const newEvents = h.getStore().domainEvents.slice(before);
  assert(newEvents.length === 3, 'cancelling a clean occurrence with a receivable AND a payable must cascade into exactly 3 events, got ' + newEvents.length);
  const types = newEvents.map(function (e) { return e.eventType; }).sort();
  assert(deepEqual(types, ['OccurrenceCancelled', 'PayableVoided', 'VenueReceivableVoided'].sort()), 'cascade must produce exactly OccurrenceCancelled + VenueReceivableVoided + PayableVoided, got ' + types.join(','));

  results.case_cascade_cancelOccurrence_events = 'PASS';
}

/* --------------------------------------------------------------------- */
function case_recordRefund_conditional_second_event() {
  const h = freshHarness();

  // Refund WITHOUT targetAllocationId -> exactly 1 event.
  const pay1 = h.run('recordPayment', { direction: 'INFLOW', amountCents: 3000, currency: 'USD', method: 'cash', paymentDate: '2041-01-01', idempotencyKey: key('rr1p') }).data;
  h.run('confirmPayment', { paymentId: pay1.id, idempotencyKey: key('rr1c') });
  const before1 = h.getStore().domainEvents.length;
  h.run('recordRefund', { originalPaymentId: pay1.id, amountCents: 1000, reason: 'no alloc', idempotencyKey: key('rr1r') });
  const events1 = h.getStore().domainEvents.slice(before1);
  assert(events1.length === 1, 'a refund with no targetAllocationId must emit exactly 1 event (PaymentRefunded), got ' + events1.length);
  assert(events1[0].eventType === 'PaymentRefunded', 'the single event must be PaymentRefunded');

  // Refund WITH targetAllocationId -> 2 events (PaymentRefunded + PaymentAllocationReversed).
  const venue = h.run('createVenue', { name: 'Refund Cascade Venue', idempotencyKey: key('rr2v') }).data;
  const occ = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2041-02-01', shift: 'default', startTime: '20:00', rateAmountCents: 5000, idempotencyKey: key('rr2o') }).data.occurrence;
  const rec = h.run('createVenueReceivable', { occurrenceId: occ.id, amountCents: 5000, idempotencyKey: key('rr2rec') }).data;
  const pay2 = h.run('recordPayment', { direction: 'INFLOW', amountCents: 5000, currency: 'USD', method: 'cash', paymentDate: '2041-02-02', idempotencyKey: key('rr2p') }).data;
  h.run('confirmPayment', { paymentId: pay2.id, idempotencyKey: key('rr2c') });
  const alloc = h.run('allocatePayment', { paymentId: pay2.id, targetType: 'VENUE_RECEIVABLE', targetId: rec.id, amountCents: 5000, idempotencyKey: key('rr2al') }).data.allocation;

  const before2 = h.getStore().domainEvents.length;
  h.run('recordRefund', { originalPaymentId: pay2.id, amountCents: 2000, reason: 'with alloc', targetAllocationId: alloc.id, idempotencyKey: key('rr2r') });
  const events2 = h.getStore().domainEvents.slice(before2);
  assert(events2.length === 2, 'a refund WITH targetAllocationId must emit exactly 2 events, got ' + events2.length);
  const types2 = events2.map(function (e) { return e.eventType; });
  assert(types2[0] === 'PaymentRefunded', 'first event must be PaymentRefunded');
  assert(types2[1] === 'PaymentAllocationReversed', 'second event must be PaymentAllocationReversed');

  results.case_recordRefund_conditional_second_event = 'PASS';
}

/* --------------------------------------------------------------------- *
 * Remaining single-event commandTypes, run once each so every catalog
 * entry is genuinely exercised (drives the dynamic 18/18 coverage check).
 * ----------------------------------------------------------------------*/
function case_remaining_single_event_commands() {
  const h = freshHarness();
  const venue = h.run('createVenue', { name: 'Catalog Venue', idempotencyKey: key('catv') }).data;
  const agreementResult = h.run('createVenueAgreement', { venueId: venue.id, rateByDay: { friday: 200 }, effectiveFrom: '2041-03-01', idempotencyKey: key('catag') });
  assert(agreementResult.ok === true, 'createVenueAgreement must succeed');

  const occA = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2041-03-08', shift: 'default', startTime: '20:00', rateAmountCents: 2500, idempotencyKey: key('catoa') }).data.occurrence;
  const rescheduleResult = h.run('rescheduleOccurrence', { occurrenceId: occA.id, newDate: '2041-03-09', reason: 'catalog test', requestedBy: 'staff', idempotencyKey: key('catresched') });
  assert(rescheduleResult.ok === true, 'rescheduleOccurrence must succeed');

  const occB = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2041-03-15', shift: 'default', startTime: '20:00', rateAmountCents: 3000, idempotencyKey: key('catob') }).data.occurrence;
  const receivable = h.run('createVenueReceivable', { occurrenceId: occB.id, amountCents: 3000, idempotencyKey: key('catrec') }).data;
  const payable = h.run('createPayable', { sourceType: 'OCCURRENCE', sourceId: occB.id, payeeId: 'dj-catalog', purpose: 'DJ_PAYMENT', amountCents: 1000, idempotencyKey: key('catpay') }).data;

  const pay = h.run('recordPayment', { direction: 'INFLOW', amountCents: 3000, currency: 'USD', method: 'cash', paymentDate: '2041-03-16', idempotencyKey: key('catrp') }).data;
  h.run('confirmPayment', { paymentId: pay.id, idempotencyKey: key('catcp') });

  const alloc = h.run('allocatePayment', { paymentId: pay.id, targetType: 'VENUE_RECEIVABLE', targetId: receivable.id, amountCents: 2000, idempotencyKey: key('catalloc') }).data.allocation;
  const reverseResult = h.run('reverseAllocation', { allocationId: alloc.id, amountCents: 500, idempotencyKey: key('catrev') });
  assert(reverseResult.ok === true, 'reverseAllocation must succeed');

  const payOut = h.run('recordPayment', { direction: 'OUTFLOW', amountCents: 100, currency: 'USD', method: 'cash', paymentDate: '2041-03-17', idempotencyKey: key('catfailpay') }).data;
  const failResult = h.run('failPayment', { paymentId: payOut.id, reason: 'catalog test', idempotencyKey: key('catfail') });
  assert(failResult.ok === true, 'failPayment must succeed');

  const payoutResult = h.run('recordOwnerPayout', { payableId: payable.id, amountCents: 1000, method: 'zelle', paymentDate: '2041-03-18', idempotencyKey: key('catpayout') });
  assert(payoutResult.ok === true, 'recordOwnerPayout must succeed');

  const reconcileResult = h.run('reconcilePayment', { paymentId: pay.id, evidenceRef: 'bank-catalog', status: 'RECONCILED', attemptUuid: 'catalog-att-1', idempotencyKey: key('catrecon') });
  assert(reconcileResult.ok === true, 'reconcilePayment must succeed');

  const voidRecVenue = h.run('createVenue', { name: 'Void Rec Catalog Venue', idempotencyKey: key('catvrv') }).data;
  const occC = h.run('createOccurrenceWithPfr', { venueId: voidRecVenue.id, date: '2041-04-01', shift: 'default', startTime: '20:00', rateAmountCents: 1000, idempotencyKey: key('catvro') }).data.occurrence;
  const recC = h.run('createVenueReceivable', { occurrenceId: occC.id, amountCents: 1000, idempotencyKey: key('catvrrec') }).data;
  const voidRecResult = h.run('voidReceivable', { receivableId: recC.id, idempotencyKey: key('catvoidrec') });
  assert(voidRecResult.ok === true, 'voidReceivable must succeed');

  const payableD = h.run('createPayable', { sourceType: 'EXPENSE', payeeId: 'payee-catalog-void', purpose: 'VENDOR_PAYMENT', amountCents: 100, idempotencyKey: key('catvpay') }).data;
  const voidPayResult = h.run('voidPayable', { payableId: payableD.id, idempotencyKey: key('catvoidpay') });
  assert(voidPayResult.ok === true, 'voidPayable must succeed');

  results.case_remaining_single_event_commands = 'PASS';
}

/* ===========================================================================
 * Fase 1B — atomic rollback tests (directed audit HIGH finding correction)
 * ======================================================================= */

/* TEST OBLIGATORIO 1 — fallo forzado en el segundo evento (PerformanceFinancialRecordCreated) */
function case_atomic_rollback_second_event_failure() {
  const failingSvc = createFaultInjectingService(function (stage, context) {
    return context.commandType === 'createOccurrenceWithPfr' && context.index === 1;
  });
  const cmdF = failingSvc.commands;
  const clock = makeClock('2042-01-01T00:00:00.000Z');
  const idGen = makeIdGen('arb1');
  let store = failingSvc.createStore();

  const venueOut = cmdF.createVenue(store, { name: 'Rollback Venue', idempotencyKey: key('arv'), now: clock(), idGenerator: idGen });
  store = venueOut.store;
  const venue = venueOut.result.data;

  const originalStoreRef = store;
  const snapshotBefore = JSON.stringify(store);
  const countsBefore = {
    occurrences: store.occurrences.length,
    pfrs: store.performanceFinancialRecords.length,
    receipts: store.commandReceipts.length,
    events: store.domainEvents.length,
    outbox: store.outbox.length
  };

  let threw = false;
  let out;
  try {
    out = cmdF.createOccurrenceWithPfr(originalStoreRef, { venueId: venue.id, date: '2042-02-01', shift: 'default', startTime: '20:00', rateAmountCents: 3000, idempotencyKey: key('aro'), now: clock(), idGenerator: idGen });
  } catch (e) {
    threw = true;
  }

  assert(threw === false, 'the wrapper must never re-throw to the caller, even when the fault injector fires on the 2nd event');
  assert(out.result.ok === false, 'result.ok must be false after an injected post-success failure');
  assert(out.result.errorCode === 'PARTIAL_FAILURE_REQUIRES_RECOVERY', 'errorCode must be PARTIAL_FAILURE_REQUIRES_RECOVERY, got ' + out.result.errorCode);
  assert(out.result.stateChanged === false, 'result.stateChanged must be false');
  assert(out.result.errorDetails && out.result.errorDetails.stage === 'DOMAIN_EVENTS_OUTBOX', 'errorDetails.stage must be DOMAIN_EVENTS_OUTBOX');
  assert(typeof out.result.errorDetails.reason === 'string' && out.result.errorDetails.reason.length > 0, 'errorDetails.reason must be a stable non-empty string');
  assert(out.store === originalStoreRef, 'output.store must be the EXACT SAME reference as the store before the failing command');
  assert(JSON.stringify(out.store) === snapshotBefore, 'store must be byte-identical to the pre-command snapshot');

  const countsAfter = {
    occurrences: out.store.occurrences.length,
    pfrs: out.store.performanceFinancialRecords.length,
    receipts: out.store.commandReceipts.length,
    events: out.store.domainEvents.length,
    outbox: out.store.outbox.length
  };
  assert(countsAfter.occurrences === countsBefore.occurrences, 'no new Occurrence must survive a rolled-back createOccurrenceWithPfr');
  assert(countsAfter.pfrs === countsBefore.pfrs, 'no new PerformanceFinancialRecord must survive');
  assert(countsAfter.receipts === countsBefore.receipts, 'no new commandReceipt must survive — the underlying financial command\'s own receipt is rolled back too');
  assert(countsAfter.events === countsBefore.events, 'no new domainEvent must survive (not even the already-built OccurrenceScheduled)');
  assert(countsAfter.outbox === countsBefore.outbox, 'no new outbox row must survive');

  results.case_atomic_rollback_second_event_failure = 'PASS';
}

/* TEST OBLIGATORIO 2 — fallo forzado durante la construcción del outbox de un comando simple */
function case_atomic_rollback_outbox_failure() {
  const failingSvc = createFaultInjectingService(function (stage, context) {
    return context.commandType === 'createVenue' && stage === 'outbox' && context.index === 0;
  });
  const cmdF = failingSvc.commands;
  const clock = makeClock('2042-03-01T00:00:00.000Z');
  const idGen = makeIdGen('arb2');
  const originalStoreRef = failingSvc.createStore();
  const snapshotBefore = JSON.stringify(originalStoreRef);

  let threw = false;
  let out;
  try {
    out = cmdF.createVenue(originalStoreRef, { name: 'Outbox Fail Venue', idempotencyKey: key('arv2'), now: clock(), idGenerator: idGen });
  } catch (e) {
    threw = true;
  }

  assert(threw === false, 'the wrapper must never re-throw to the caller for an outbox-stage injected failure');
  assert(out.result.ok === false, 'result.ok must be false');
  assert(out.result.errorCode === 'PARTIAL_FAILURE_REQUIRES_RECOVERY', 'errorCode must be PARTIAL_FAILURE_REQUIRES_RECOVERY, got ' + out.result.errorCode);
  assert(out.result.stateChanged === false, 'result.stateChanged must be false');
  assert(out.result.errorDetails.stage === 'DOMAIN_EVENTS_OUTBOX', 'errorDetails.stage must be DOMAIN_EVENTS_OUTBOX');
  assert(out.store === originalStoreRef, 'output.store must be the EXACT SAME reference as the original (empty) store');
  assert(JSON.stringify(out.store) === snapshotBefore, 'store must be byte-identical to the pre-command snapshot');
  assert(out.store.venues.length === 0, 'no Venue must survive an outbox-stage rollback');
  assert(out.store.commandReceipts.length === 0, 'no commandReceipt must survive');
  assert(out.store.domainEvents.length === 0, 'no domainEvent must survive (the already-built VenueCreated is discarded too)');
  assert(out.store.outbox.length === 0, 'no outbox row must survive');

  results.case_atomic_rollback_outbox_failure = 'PASS';
}

/* ===========================================================================
 * Fase 1D — HALLAZGO 1: a deriver that returns [], null, or undefined must
 * trigger the SAME atomic rollback as any other post-success failure, never
 * a silent "success with zero events".
 * ======================================================================= */

/* TEST OBLIGATORIO A — deriver devuelve [] */
function case_atomic_rollback_deriver_returns_empty_array() {
  const failingSvc = createOverridingService(function (stage, context) {
    if (stage === 'deriver' && context.commandType === 'createVenue') {
      return { override: [] };
    }
  });
  const cmdF = failingSvc.commands;
  const clock = makeClock('2044-01-01T00:00:00.000Z');
  const idGen = makeIdGen('devA');
  const originalStoreRef = failingSvc.createStore();
  const snapshotBefore = JSON.stringify(originalStoreRef);

  let threw = false;
  let out;
  try {
    out = cmdF.createVenue(originalStoreRef, { name: 'Empty Deriver Venue', idempotencyKey: key('deva'), now: clock(), idGenerator: idGen });
  } catch (e) {
    threw = true;
  }

  assert(threw === false, 'the wrapper must never re-throw to the caller when the deriver returns []');
  assert(out.result.ok === false, 'result.ok must be false when the deriver returns zero events');
  assert(out.result.errorCode === 'PARTIAL_FAILURE_REQUIRES_RECOVERY', 'errorCode must be PARTIAL_FAILURE_REQUIRES_RECOVERY, got ' + out.result.errorCode);
  assert(out.result.errorDetails.stage === 'DOMAIN_EVENTS_OUTBOX', 'errorDetails.stage must be DOMAIN_EVENTS_OUTBOX');
  assert(out.result.errorDetails.reason === 'DOMAIN_EVENT_DERIVER_RETURNED_NO_EVENTS', 'errorDetails.reason must be the stable constant, got ' + out.result.errorDetails.reason);
  assert(out.result.stateChanged === false, 'result.stateChanged must be false');
  assert(out.store === originalStoreRef, 'output.store must be the EXACT SAME reference as the original store');
  assert(JSON.stringify(out.store) === snapshotBefore, 'store must be byte-identical to the pre-command snapshot');
  assert(out.store.venues.length === 0, 'no Venue must survive when the deriver returns []');
  assert(out.store.commandReceipts.length === 0, 'no commandReceipt must survive');
  assert(out.store.domainEvents.length === 0, 'no domainEvent must survive');
  assert(out.store.outbox.length === 0, 'no outbox row must survive');

  results.case_atomic_rollback_deriver_returns_empty_array = 'PASS';
}

/* TEST OBLIGATORIO B — deriver devuelve null */
function case_atomic_rollback_deriver_returns_null() {
  const failingSvc = createOverridingService(function (stage, context) {
    if (stage === 'deriver' && context.commandType === 'createVenue') {
      return { override: null };
    }
  });
  const cmdF = failingSvc.commands;
  const clock = makeClock('2044-02-01T00:00:00.000Z');
  const idGen = makeIdGen('devB');
  const originalStoreRef = failingSvc.createStore();
  const snapshotBefore = JSON.stringify(originalStoreRef);

  let threw = false;
  let out;
  try {
    out = cmdF.createVenue(originalStoreRef, { name: 'Null Deriver Venue', idempotencyKey: key('devb'), now: clock(), idGenerator: idGen });
  } catch (e) {
    threw = true;
  }

  assert(threw === false, 'the wrapper must never re-throw to the caller when the deriver returns null');
  assert(out.result.ok === false, 'result.ok must be false when the deriver returns null');
  assert(out.result.errorCode === 'PARTIAL_FAILURE_REQUIRES_RECOVERY', 'errorCode must be PARTIAL_FAILURE_REQUIRES_RECOVERY, got ' + out.result.errorCode);
  assert(out.result.errorDetails.reason === 'DOMAIN_EVENT_DERIVER_RETURNED_NO_EVENTS', 'errorDetails.reason must be the stable constant, got ' + out.result.errorDetails.reason);
  assert(out.result.stateChanged === false, 'result.stateChanged must be false');
  assert(out.store === originalStoreRef, 'output.store must be the EXACT SAME reference as the original store');
  assert(JSON.stringify(out.store) === snapshotBefore, 'store must be byte-identical to the pre-command snapshot');
  assert(out.store.venues.length === 0, 'no Venue must survive when the deriver returns null');
  assert(out.store.commandReceipts.length === 0, 'no commandReceipt must survive');
  assert(out.store.domainEvents.length === 0, 'no domainEvent must survive');
  assert(out.store.outbox.length === 0, 'no outbox row must survive');

  results.case_atomic_rollback_deriver_returns_null = 'PASS';
}

/* Additional coverage (not strictly required — "al menos uno" was null
 * above) — undefined follows the identical !Array.isArray branch, tested
 * here for completeness rather than left as an inference. */
function case_atomic_rollback_deriver_returns_undefined() {
  const failingSvc = createOverridingService(function (stage, context) {
    if (stage === 'deriver' && context.commandType === 'createVenue') {
      return { override: undefined };
    }
  });
  const cmdF = failingSvc.commands;
  const clock = makeClock('2044-02-15T00:00:00.000Z');
  const idGen = makeIdGen('devC');
  const originalStoreRef = failingSvc.createStore();
  const snapshotBefore = JSON.stringify(originalStoreRef);

  let threw = false;
  let out;
  try {
    out = cmdF.createVenue(originalStoreRef, { name: 'Undefined Deriver Venue', idempotencyKey: key('devc'), now: clock(), idGenerator: idGen });
  } catch (e) {
    threw = true;
  }

  assert(threw === false, 'the wrapper must never re-throw to the caller when the deriver returns undefined');
  assert(out.result.ok === false, 'result.ok must be false when the deriver returns undefined');
  assert(out.result.errorCode === 'PARTIAL_FAILURE_REQUIRES_RECOVERY', 'errorCode must be PARTIAL_FAILURE_REQUIRES_RECOVERY, got ' + out.result.errorCode);
  assert(out.result.errorDetails.reason === 'DOMAIN_EVENT_DERIVER_RETURNED_NO_EVENTS', 'errorDetails.reason must be the stable constant, got ' + out.result.errorDetails.reason);
  assert(out.store === originalStoreRef, 'output.store must be the EXACT SAME reference as the original store');
  assert(JSON.stringify(out.store) === snapshotBefore, 'store must be byte-identical to the pre-command snapshot');
  assert(out.store.venues.length === 0, 'no Venue must survive when the deriver returns undefined');
  assert(out.store.domainEvents.length === 0, 'no domainEvent must survive');
  assert(out.store.outbox.length === 0, 'no outbox row must survive');

  results.case_atomic_rollback_deriver_returns_undefined = 'PASS';
}

/* TEST OBLIGATORIO 3 — camino feliz sin faultInjector, sin regresión */
function case_no_regression_without_fault_injector() {
  const h = freshHarness(); // the module-level evtSvc, created with NO faultInjector
  const venue = h.run('createVenue', { name: 'No Regression Venue', idempotencyKey: key('nrv') }).data;
  assert(h.getStore().venues.length === 1, 'createVenue must still create a Venue without a fault injector');
  assert(h.getStore().commandReceipts.length === 1, 'createVenue must still create a commandReceipt');
  assert(h.getStore().domainEvents.filter(function (e) { return e.eventType === 'VenueCreated'; }).length === 1, 'createVenue must still emit VenueCreated');
  assert(h.getStore().outbox.filter(function (o) { return o.status === 'PENDING'; }).length === 1, 'the fresh outbox row must still start PENDING');

  const before = h.getStore().domainEvents.length;
  const occResult = h.run('createOccurrenceWithPfr', { venueId: venue.id, date: '2042-04-01', shift: 'default', startTime: '20:00', rateAmountCents: 2000, idempotencyKey: key('nro') });
  assert(occResult.ok === true, 'createOccurrenceWithPfr must still succeed without a fault injector');
  const newEvents = h.getStore().domainEvents.slice(before);
  assert(newEvents.length === 2, 'createOccurrenceWithPfr must still emit exactly 2 events without a fault injector');
  assert(newEvents[1].eventPosition === newEvents[0].eventPosition + 1, 'eventPosition must still be consecutive');

  results.case_no_regression_without_fault_injector = 'PASS';
}

/* ===========================================================================
 * Fase 1B — LOW query coverage (getAllEvents / getEventsForAggregate /
 * getOutboxEntryForEvent / getPoisonOutbox). Queries themselves are NOT
 * redesigned in this pass — only tested as-is.
 * ======================================================================= */

function case_query_getAllEvents() {
  const h = freshHarness();
  h.run('createVenue', { name: 'Query Venue A', idempotencyKey: key('qa') });
  h.run('createVenue', { name: 'Query Venue B', idempotencyKey: key('qb') });
  const store = h.getStore();

  const all = evtSvc.events.getAllEvents(store);
  assert(all.length === 2, 'getAllEvents must return all emitted events, got ' + all.length);
  assert(all[0].eventType === 'VenueCreated' && all[1].eventType === 'VenueCreated', 'getAllEvents must return the actual events in order');

  // Identity (Fase 1D point E): the returned objects must NOT be the same
  // reference as the internal store's objects.
  assert(all[0] !== store.domainEvents[0], 'getAllEvents must not return the internal event object by reference');

  // Array-level isolation: pushing into the RETURNED array must not affect the store.
  all.push({ id: 'INJECTED', eventType: 'FAKE' });
  assert(store.domainEvents.length === 2, 'appending to the array returned by getAllEvents must not grow the internal store');

  // Fase 1D fix: mutating a TOP-LEVEL field of a returned event must NOT
  // corrupt the internal store (deep clone, not a shared reference).
  const eventTypeBeforeMutation = store.domainEvents[0].eventType;
  all[0].eventType = 'MUTATED_VIA_QUERY_RESULT';
  assert(store.domainEvents[0].eventType === eventTypeBeforeMutation, 'mutating a returned event top-level field must NOT propagate to the internal store (deep clone fix)');

  // Fase 1D fix: mutating the NESTED payload of a returned event must also
  // NOT corrupt the internal store.
  const payloadNameBeforeMutation = store.domainEvents[0].payload.name;
  all[0].payload.name = 'MUTATED_PAYLOAD_VIA_QUERY_RESULT';
  assert(store.domainEvents[0].payload.name === payloadNameBeforeMutation, 'mutating a returned event NESTED payload must NOT propagate to the internal store (deep clone fix)');

  results.case_query_getAllEvents = 'PASS';
}

function case_query_getEventsForAggregate() {
  const h = freshHarness();
  const venueA = h.run('createVenue', { name: 'Aggregate Venue A', idempotencyKey: key('qaa') }).data;
  const venueB = h.run('createVenue', { name: 'Aggregate Venue B', idempotencyKey: key('qab') }).data;
  const store = h.getStore();

  const forA = evtSvc.events.getEventsForAggregate(store, 'Venue', venueA.id);
  assert(forA.length === 1, 'getEventsForAggregate must return exactly 1 event for venueA, got ' + forA.length);
  assert(forA[0].aggregateId === venueA.id, 'returned event must belong to venueA');

  const forB = evtSvc.events.getEventsForAggregate(store, 'Venue', venueB.id);
  assert(forB.length === 1 && forB[0].aggregateId === venueB.id, 'getEventsForAggregate must filter by aggregateId, not just aggregateType');

  const wrongType = evtSvc.events.getEventsForAggregate(store, 'Payable', venueA.id);
  assert(wrongType.length === 0, 'getEventsForAggregate must filter by aggregateType too — same id, wrong type, must return empty');

  const internalEventA = store.domainEvents.filter(function (e) { return e.aggregateId === venueA.id; })[0];
  assert(forA[0] !== internalEventA, 'getEventsForAggregate must not return the internal event object by reference');

  const metadataBefore = internalEventA.eventType;
  const payloadNameBefore = internalEventA.payload.name;
  forA[0].eventType = 'MUTATED_METADATA';
  forA[0].payload.name = 'MUTATED_NESTED_PAYLOAD';
  assert(internalEventA.eventType === metadataBefore, 'mutating returned metadata must NOT propagate to the internal store');
  assert(internalEventA.payload.name === payloadNameBefore, 'mutating returned nested payload must NOT propagate to the internal store');

  results.case_query_getEventsForAggregate = 'PASS';
}

function case_query_getOutboxEntryForEvent() {
  const h = freshHarness();
  h.run('createVenue', { name: 'Outbox Query Venue', idempotencyKey: key('qov') });
  const store = h.getStore();
  const ev = store.domainEvents[0];
  const internalRow = store.outbox[0];

  const row = evtSvc.events.getOutboxEntryForEvent(store, ev.id);
  assert(row, 'getOutboxEntryForEvent must find the outbox row for a real event id');
  assert(row.eventId === ev.id, 'returned row must reference the correct eventId');
  assert(row !== internalRow, 'getOutboxEntryForEvent must not return the internal outbox row by reference');

  const statusBefore = internalRow.status;
  const attemptsBefore = internalRow.attempts;
  const lastErrorBefore = internalRow.lastError;
  row.status = 'MUTATED_STATUS';
  row.attempts = 999;
  row.lastError = 'MUTATED_ERROR';
  assert(internalRow.status === statusBefore, 'mutating the returned row.status must NOT propagate to store.outbox');
  assert(internalRow.attempts === attemptsBefore, 'mutating the returned row.attempts must NOT propagate to store.outbox');
  assert(internalRow.lastError === lastErrorBefore, 'mutating the returned row.lastError must NOT propagate to store.outbox');

  const missing = evtSvc.events.getOutboxEntryForEvent(store, 'does-not-exist');
  assert(missing === null, 'getOutboxEntryForEvent must return null (not undefined, not throw) for an unknown eventId — contract preserved');

  results.case_query_getOutboxEntryForEvent = 'PASS';
}

function case_query_getPoisonOutbox() {
  const h = freshHarness();
  h.run('createVenue', { name: 'Poison Query Venue', idempotencyKey: key('qpv') });
  let store = h.getStore();
  const outboxId = store.outbox[0].id;

  const beforePoison = evtSvc.events.getPoisonOutbox(store);
  assert(beforePoison.length === 0, 'getPoisonOutbox must return empty before anything is poisoned');

  let now = '2043-01-01T00:00:00.000Z';
  for (let attempt = 1; attempt <= 5; attempt++) {
    store = outboxOps.recordOutboxFailure(store, outboxId, now, 'poison query test ' + attempt);
    const row = store.outbox.filter(function (r) { return r.id === outboxId; })[0];
    now = row.nextRetryAt || now;
  }

  const afterPoison = evtSvc.events.getPoisonOutbox(store);
  assert(afterPoison.length === 1, 'getPoisonOutbox must return exactly the 1 POISON row, got ' + afterPoison.length);
  assert(afterPoison[0].id === outboxId && afterPoison[0].status === 'POISON', 'getPoisonOutbox must return only rows with status=POISON');

  const internalPoisonRow = store.outbox.filter(function (r) { return r.id === outboxId; })[0];
  assert(afterPoison[0] !== internalPoisonRow, 'getPoisonOutbox must not return the internal outbox row by reference');

  afterPoison[0].status = 'MUTATED';
  afterPoison[0].attempts = -1;
  assert(internalPoisonRow.status === 'POISON', 'mutating the first returned POISON row must NOT propagate to the internal store');
  assert(internalPoisonRow.attempts === 5, 'mutating the first returned POISON row.attempts must NOT propagate to the internal store');

  results.case_query_getPoisonOutbox = 'PASS';
}

/* ===========================================================================
 * Run everything
 * ======================================================================= */

case_simple_emission_createVenue();
case_compound_createOccurrenceWithPfr();
case_eventPosition_global_increasing();
case_append_only_domainEvents_and_outbox();
case_payload_deep_clone();
case_replay_no_events();
case_conflict_no_events();
case_error_no_events_sweep();
case_atomicity_entities_receipt_events_outbox_together();
case_outbox_1to1_with_events();
case_retry_backoff_schedule();
case_retry_poison_on_5th_failure();
case_outbox_delivered();
case_poison_does_not_block_other_outbox_rows();
case_getDeliverableOutbox_semantics();
case_eventVersion_and_traceability_fields();
case_cascade_cancelOccurrence_events();
case_recordRefund_conditional_second_event();
case_remaining_single_event_commands();
case_atomic_rollback_second_event_failure();
case_atomic_rollback_outbox_failure();
case_atomic_rollback_deriver_returns_empty_array();
case_atomic_rollback_deriver_returns_null();
case_atomic_rollback_deriver_returns_undefined();
case_no_regression_without_fault_injector();
case_query_getAllEvents();
case_query_getEventsForAggregate();
case_query_getOutboxEntryForEvent();
case_query_getPoisonOutbox();

/* ===========================================================================
 * Dynamic event-type catalog coverage (no manual "exercised" list).
 * ======================================================================= */
const expectedEventTypes = evtSvc.EVENT_TYPE_CATALOG.slice().sort();
const observedEventTypesArray = Array.from(observedEventTypes).sort();
const missingEventTypes = expectedEventTypes.filter(function (t) { return !observedEventTypes.has(t); });
const unexpectedEventTypes = observedEventTypesArray.filter(function (t) { return expectedEventTypes.indexOf(t) === -1; });

assert(missingEventTypes.length === 0, 'expected event types never actually observed: ' + missingEventTypes.join(', '));
assert(unexpectedEventTypes.length === 0, 'observed event types not in the catalog (drift or typo): ' + unexpectedEventTypes.join(', '));

results.eventTypesExpected = expectedEventTypes;
results.eventTypesObserved = observedEventTypesArray;
results.missingEventTypes = missingEventTypes;
results.unexpectedEventTypes = unexpectedEventTypes;

console.log(
  JSON.stringify(
    {
      ok: true,
      results: results,
      networkAccess: 0,
      localStorageAccess: 0,
      domAccess: 0,
      dispatcherInvoked: 0,
      note: 'sandbox never defined fetch/localStorage/document/setTimeout/setInterval — any access would have thrown ReferenceError before reaching this line'
    },
    null,
    2
  )
);
