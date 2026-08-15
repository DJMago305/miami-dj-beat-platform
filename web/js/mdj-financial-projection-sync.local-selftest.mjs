/**
 * TICKET-013 — Financial Projection Sync — Fase 1 self-test
 * Local-only (no localStorage, no DOM, no network, no Supabase).
 * Loads T009 + T010 + Legacy Adapter + Bridge + Projection Engine + this
 * module into one sandbox. Two real end-to-end paths (native T009/T010
 * commands, and a Bridge-executed store) plus targeted unit scenarios using
 * T011's own synthetic test projections for edge cases (DEGRADED, isolation,
 * no-op re-sync) that neither real path naturally exercises.
 *
 * Run: node web/js/mdj-financial-projection-sync.local-selftest.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesSrc = fs.readFileSync(path.join(__dirname, 'mdj-financial-local-services.js'), 'utf8');
const eventsSrc = fs.readFileSync(path.join(__dirname, 'mdj-financial-domain-events.js'), 'utf8');
const adapterSrc = fs.readFileSync(path.join(__dirname, 'mdj-financial-legacy-adapter.js'), 'utf8');
const bridgeSrc = fs.readFileSync(path.join(__dirname, 'mdj-financial-legacy-import-bridge.js'), 'utf8');
const engineSrc = fs.readFileSync(path.join(__dirname, 'mdj-local-projection-engine.js'), 'utf8');
const syncSrc = fs.readFileSync(path.join(__dirname, 'mdj-financial-projection-sync.js'), 'utf8');
const fixtureRaw = fs.readFileSync(path.join(__dirname, 'fixtures', 'mdj-financial-legacy-adapter.synthetic.json'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
}

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
vm.runInContext(adapterSrc, sandbox);
vm.runInContext(bridgeSrc, sandbox);
vm.runInContext(engineSrc, sandbox);
vm.runInContext(syncSrc, sandbox);

const ServicesMod = windowStub.MDJFinancialLocalServices;
const EventsMod = windowStub.MDJFinancialDomainEvents;
const AdapterMod = windowStub.MDJFinancialLegacyAdapter;
const BridgeMod = windowStub.MDJFinancialLegacyImportBridge;
const EngineMod = windowStub.MDJLocalProjectionEngine;
const SyncMod = windowStub.MDJFinancialProjectionSync;
assert(ServicesMod && EventsMod && AdapterMod && BridgeMod && EngineMod && SyncMod, 'all six modules must load into the shared sandbox');

function makeIdGen(prefix) {
  let n = 0;
  return function () {
    n++;
    return prefix + '-' + n;
  };
}

function freshWrappedServices() {
  return EventsMod.createDomainEventsOutbox(ServicesMod);
}
function freshTargetStore(wrapped) {
  return Object.assign({ schemaVersion: 1 }, wrapped.createStore());
}
function freshAdapter() {
  return AdapterMod.createLegacyFinancialAdapter();
}
function freshBridge() {
  return BridgeMod.createLegacyImportBridge();
}
function freshEngine() {
  return EngineMod.createLocalProjectionEngine();
}
function freshSync() {
  return SyncMod.createFinancialProjectionSync();
}

/* Same synthetic projection shapes as T011's own self-test — infrastructure
 * test doubles only, no real business projection is defined in this ticket. */
function counterDefinition(name, subscribedEventTypes) {
  return {
    projectionName: name,
    projectionVersion: 1,
    definitionFingerprint: 'fp-counter-' + name,
    subscribedEventTypes: subscribedEventTypes || '*',
    initialState: { count: 0 },
    reduce: function (state) { return { count: state.count + 1 }; }
  };
}
function faultyDefinition(name, subscribedEventTypes) {
  return {
    projectionName: name,
    projectionVersion: 1,
    definitionFingerprint: 'fp-faulty-' + name,
    subscribedEventTypes: subscribedEventTypes || '*',
    initialState: { count: 0 },
    reduce: function (state, event) {
      if (event.payload && event.payload.shouldFail) throw new Error('SYNTHETIC_REDUCER_FAILURE');
      return { count: state.count + 1 };
    }
  };
}

let syntheticEventSeq = 0;
function makeSyntheticEvent(position, eventType, payload) {
  syntheticEventSeq++;
  return {
    id: 'evt-synthetic-' + syntheticEventSeq,
    eventPosition: position,
    eventType: eventType,
    aggregateType: 'TestAggregate',
    aggregateId: 'agg-' + syntheticEventSeq,
    payload: payload || {},
    commandId: 'cmd-synthetic-' + syntheticEventSeq,
    commandType: 'testCommand',
    idempotencyKey: 'k-synthetic-' + syntheticEventSeq,
    occurredAt: '2050-01-01T00:00:00.000Z',
    eventVersion: 1
  };
}

const results = {};
const fixture = JSON.parse(fixtureRaw);

/* ===========================================================================
 * GROUP 1 — Real end-to-end with a native T009/T010 store (no Bridge).
 * ======================================================================= */

function case_sync_incremental_two_native_commands() {
  const wrapped = freshWrappedServices();
  const engine = freshEngine();
  const sync = freshSync();

  let store = freshTargetStore(wrapped);
  const out1 = wrapped.commands.createVenue(store, { name: 'Venue One', idempotencyKey: 'k-venue-1', now: '2050-01-01T00:00:00.000Z', idGenerator: makeIdGen('nv1'), actorId: 'staff-test' });
  assert(out1.result.ok === true, 'setup: first createVenue must succeed');
  store = out1.store;
  const out2 = wrapped.commands.createVenue(store, { name: 'Venue Two', idempotencyKey: 'k-venue-2', now: '2050-01-01T00:01:00.000Z', idGenerator: makeIdGen('nv2'), actorId: 'staff-test' });
  assert(out2.result.ok === true, 'setup: second createVenue must succeed');
  store = out2.store;
  assert(wrapped.events.getAllEvents(store).length === 2, 'setup: two createVenue commands must produce exactly two domain events');

  let projectionStore = engine.createStore();
  engine.registerProjection(counterDefinition('P_NativeIncremental', ['VenueCreated']));

  const outcome = sync.syncProjection(engine, projectionStore, store, wrapped, 'P_NativeIncremental', { now: '2050-01-01T00:02:00.000Z', idGenerator: makeIdGen('proj1') });
  assert(outcome.result.ok === true, 'sync must succeed');
  assert(outcome.result.applied === 2, 'both real domain events must be applied, got ' + outcome.result.applied);
  projectionStore = outcome.store;
  assert(engine.queries.getProjectionState(projectionStore, 'P_NativeIncremental').count === 2);
  assert(engine.queries.getProjectionCheckpoint(projectionStore, 'P_NativeIncremental').lastEventPosition === 2);

  results.case_sync_incremental_two_native_commands = 'PASS';
  return { wrapped: wrapped, engine: engine, sync: sync, eventStore: store, projectionStore: projectionStore };
}

function case_sync_second_call_no_new_events_noop(prev) {
  const outcome = prev.sync.syncProjection(prev.engine, prev.projectionStore, prev.eventStore, prev.wrapped, 'P_NativeIncremental', { now: '2050-01-01T00:03:00.000Z', idGenerator: makeIdGen('proj2') });
  assert(outcome.result.ok === true && outcome.result.applied === 0, 'a second sync with no new events must be a pure no-op, got applied=' + outcome.result.applied);
  assert(outcome.store === prev.projectionStore, 'a no-new-events sync must return the EXACT SAME projection store reference');
  results.case_sync_second_call_no_new_events_noop = 'PASS';
}

/* ===========================================================================
 * GROUP 2 — Real end-to-end with a Bridge-executed store (TICKET-012).
 * ======================================================================= */

function case_sync_from_zero_using_bridge_executed_store() {
  const wrapped = freshWrappedServices();
  const bridge = freshBridge();
  const adapterOutput = freshAdapter().mapStore(fixture);
  const plan = bridge.buildImportPlan(adapterOutput, { targetStoreSchemaVersion: 1 });
  const targetStore = freshTargetStore(wrapped);
  const out = bridge.executeImportPlan(wrapped, targetStore, plan, { now: '2050-08-05T00:00:00.000Z' });
  assert(out.result.ok === true, 'setup: bridge execution must succeed');
  const totalEvents = wrapped.events.getAllEvents(out.store).length;
  assert(totalEvents > 0, 'setup: the bridge-executed store must contain real domain events');

  const engine = freshEngine();
  engine.registerProjection(counterDefinition('P_BridgeFromZero', '*'));
  const sync = freshSync();

  const outcome = sync.syncProjection(engine, engine.createStore(), out.store, wrapped, 'P_BridgeFromZero', { now: '2050-08-05T00:01:00.000Z', idGenerator: makeIdGen('proj3') });
  assert(outcome.result.ok === true, 'sync from a fresh (never-synced) projection must succeed in one call — no special-casing needed for "first sync"');
  assert(outcome.result.applied === totalEvents, 'all events produced by the bridge run must be applied, expected ' + totalEvents + ' got ' + outcome.result.applied);
  assert(engine.queries.getProjectionState(outcome.store, 'P_BridgeFromZero').count === totalEvents);
  assert(engine.queries.getProjectionCheckpoint(outcome.store, 'P_BridgeFromZero').lastEventPosition === totalEvents, 'checkpoint must land exactly at the last event position of the bridge-executed store');

  results.case_sync_from_zero_using_bridge_executed_store = 'PASS';
}

/* ===========================================================================
 * GROUP 3 — Registry error propagation (no duplicated validation).
 * ======================================================================= */

function case_sync_unregistered_projection_propagates_registry_error() {
  const wrapped = freshWrappedServices();
  const engine = freshEngine();
  const sync = freshSync();
  const eventStore = { domainEvents: [makeSyntheticEvent(1, 'TestEventA', {})] };

  const outcome = sync.syncProjection(engine, engine.createStore(), eventStore, wrapped, 'DoesNotExist', { now: '2050-01-01T00:00:00.000Z', idGenerator: makeIdGen('unreg') });
  assert(outcome.result.ok === false && outcome.result.errorCode === 'PROJECTION_NOT_REGISTERED', 'syncing an unregistered projection must propagate T011\'s own PROJECTION_NOT_REGISTERED verbatim, got ' + JSON.stringify(outcome.result));

  results.case_sync_unregistered_projection_propagates_registry_error = 'PASS';
}

/* ===========================================================================
 * GROUP 4 — DEGRADED: no auto-recovery, manual rebuild is the only path.
 * ======================================================================= */

function case_sync_batch_failure_degrades_and_blocks_further_sync() {
  const wrapped = freshWrappedServices();
  const engine = freshEngine();
  const sync = freshSync();
  engine.registerProjection(faultyDefinition('P_Degrade', ['TestEventA']));

  const ev1 = makeSyntheticEvent(1, 'TestEventA', {});
  const ev2 = makeSyntheticEvent(2, 'TestEventA', { shouldFail: true });
  let eventStore = { domainEvents: [ev1] };
  let projectionStore = engine.createStore();

  const out1 = sync.syncProjection(engine, projectionStore, eventStore, wrapped, 'P_Degrade', { now: '2050-01-01T00:00:00.000Z', idGenerator: makeIdGen('deg1') });
  assert(out1.result.ok === true && out1.result.applied === 1, 'setup: first healthy event must apply');
  projectionStore = out1.store;

  eventStore = { domainEvents: [ev1, ev2] };
  const out2 = sync.syncProjection(engine, projectionStore, eventStore, wrapped, 'P_Degrade', { now: '2050-01-01T00:01:00.000Z', idGenerator: makeIdGen('deg2') });
  assert(out2.result.ok === false && out2.result.errorCode === 'PROJECTION_PARTIAL_FAILURE_REQUIRES_RECOVERY', 'the failing event must degrade the projection, got ' + JSON.stringify(out2.result));
  projectionStore = out2.store;
  assert(engine.queries.getProjectionStatus(projectionStore, 'P_Degrade') === 'DEGRADED');
  assert(engine.queries.getProjectionCheckpoint(projectionStore, 'P_Degrade').lastEventPosition === 1, 'checkpoint must stay frozen at the last good position');

  // Third call: the same pending event (ev2) is still there — sync must NOT
  // attempt any silent skip/retry recovery; it must surface T011's own
  // PROJECTION_CHECKPOINT_INVALID exactly like a direct applyEvents call would.
  const out3 = sync.syncProjection(engine, projectionStore, eventStore, wrapped, 'P_Degrade', { now: '2050-01-01T00:02:00.000Z', idGenerator: makeIdGen('deg3') });
  assert(out3.result.ok === false && out3.result.errorCode === 'PROJECTION_CHECKPOINT_INVALID', 'a DEGRADED projection must block further sync attempts with no auto-recovery, got ' + JSON.stringify(out3.result));

  results.case_sync_batch_failure_degrades_and_blocks_further_sync = 'PASS';
  return { wrapped: wrapped, engine: engine, sync: sync, projectionStore: projectionStore };
}

function case_rebuild_from_event_store_recovers_degraded_projection(prev) {
  const ev1 = makeSyntheticEvent(1, 'TestEventA', {});
  const ev2Healthy = makeSyntheticEvent(2, 'TestEventA', {}); // same position, no shouldFail this time
  const healthyEventStore = { domainEvents: [ev1, ev2Healthy] };

  const outcome = prev.sync.rebuildProjectionFromEventStore(prev.engine, prev.projectionStore, healthyEventStore, prev.wrapped, 'P_Degrade', { now: '2050-01-01T00:03:00.000Z', idGenerator: makeIdGen('rebuild1') });
  assert(outcome.result.ok === true, 'rebuild from a non-poisoning event history must succeed');
  assert(prev.engine.queries.getProjectionStatus(outcome.store, 'P_Degrade') === 'ACTIVE', 'a successful rebuild must restore ACTIVE — the ONLY recovery path, never an automatic one');
  assert(prev.engine.queries.getProjectionState(outcome.store, 'P_Degrade').count === 2);

  results.case_rebuild_from_event_store_recovers_degraded_projection = 'PASS';
}

/* ===========================================================================
 * GROUP 5 — syncAllRegisteredProjections: isolation between projections.
 * ======================================================================= */

function case_sync_all_registered_isolates_failing_projection() {
  const wrapped = freshWrappedServices();
  const engine = freshEngine();
  const sync = freshSync();
  engine.registerProjection(counterDefinition('Healthy', ['TestEventA']));
  engine.registerProjection(faultyDefinition('Faulty', ['TestEventA']));

  const eventStore = { domainEvents: [makeSyntheticEvent(1, 'TestEventA', { shouldFail: true })] };
  const outcome = sync.syncAllRegisteredProjections(engine, engine.createStore(), eventStore, wrapped, { now: '2050-01-01T00:00:00.000Z', idGenerator: makeIdGen('all1') });

  // Return shape must match T011's own rebuildAllProjections exactly:
  // {store, result: {ok:true, projections:{...}}} — the same (store, input)
  // -> {store, result} contract every other public function in this line
  // follows, this one included.
  assert(outcome.result && outcome.result.ok === true, 'syncAllRegisteredProjections must return {store, result} like every other public function in this line, got ' + JSON.stringify(outcome.result));
  assert(outcome.result.projections.Healthy.ok === true, 'Healthy must succeed — it ignores the shouldFail marker');
  assert(outcome.result.projections.Faulty.ok === false, 'Faulty must fail on the exact same event');
  assert(engine.queries.getProjectionStatus(outcome.store, 'Healthy') === 'ACTIVE', 'one projection failing must never affect another projection\'s status');
  assert(engine.queries.getProjectionStatus(outcome.store, 'Faulty') === 'DEGRADED');

  results.case_sync_all_registered_isolates_failing_projection = 'PASS';
}

/* ===========================================================================
 * GROUP 7 — Defensive ordering: syncProjection must sort by eventPosition
 * itself, never trust the event store's array order (getAllEvents does not
 * document sortedness — this is what backs that assumption).
 * ======================================================================= */

function case_sync_sorts_out_of_order_events_defensively() {
  const wrapped = freshWrappedServices();
  const engine = freshEngine();
  const sync = freshSync();
  engine.registerProjection(counterDefinition('P_OutOfOrder', ['TestEventA']));

  const ev1 = makeSyntheticEvent(1, 'TestEventA', {});
  const ev2 = makeSyntheticEvent(2, 'TestEventA', {});
  // Deliberately inserted in REVERSE array order. Without a defensive sort,
  // applyEvents' own pre-validation (checking events[i] against events[i-1])
  // would reject this as PROJECTION_EVENT_OUT_OF_ORDER — so this test fails
  // loudly if the sort is ever removed, proving the sort is load-bearing.
  const eventStore = { domainEvents: [ev2, ev1] };

  const outcome = sync.syncProjection(engine, engine.createStore(), eventStore, wrapped, 'P_OutOfOrder', { now: '2050-01-01T00:00:00.000Z', idGenerator: makeIdGen('oos1') });
  assert(outcome.result.ok === true, 'syncProjection must sort by eventPosition before delegating, regardless of the event store\'s array order, got ' + JSON.stringify(outcome.result));
  assert(outcome.result.applied === 2, 'both events must apply once correctly ordered, got applied=' + outcome.result.applied);
  assert(engine.queries.getProjectionCheckpoint(outcome.store, 'P_OutOfOrder').lastEventPosition === 2);

  results.case_sync_sorts_out_of_order_events_defensively = 'PASS';
}

/* ===========================================================================
 * GROUP 6 — No mutation of the caller-supplied event store.
 * ======================================================================= */

function case_sync_does_not_mutate_event_store() {
  const wrapped = freshWrappedServices();
  const engine = freshEngine();
  const sync = freshSync();
  engine.registerProjection(counterDefinition('P_NoMutate', ['TestEventA']));
  const eventStore = { domainEvents: [makeSyntheticEvent(1, 'TestEventA', {}), makeSyntheticEvent(2, 'TestEventA', {})] };
  const snapshotBefore = JSON.stringify(eventStore);

  sync.syncProjection(engine, engine.createStore(), eventStore, wrapped, 'P_NoMutate', { now: '2050-01-01T00:00:00.000Z', idGenerator: makeIdGen('nomut') });
  assert(JSON.stringify(eventStore) === snapshotBefore, 'syncProjection must never mutate the caller-supplied event store');

  results.case_sync_does_not_mutate_event_store = 'PASS';
}

/* ===========================================================================
 * Run everything
 * ======================================================================= */

const nativeRun = case_sync_incremental_two_native_commands();
case_sync_second_call_no_new_events_noop(nativeRun);

case_sync_from_zero_using_bridge_executed_store();

case_sync_unregistered_projection_propagates_registry_error();

const degradeRun = case_sync_batch_failure_degrades_and_blocks_further_sync();
case_rebuild_from_event_store_recovers_degraded_projection(degradeRun);

case_sync_all_registered_isolates_failing_projection();

case_sync_sorts_out_of_order_events_defensively();

case_sync_does_not_mutate_event_store();

console.log(
  JSON.stringify(
    {
      ok: true,
      results: results,
      networkAccess: 0,
      localStorageAccess: 0,
      domAccess: 0,
      note: 'sandbox never defined fetch/localStorage/document/setTimeout/setInterval — any access would have thrown ReferenceError before reaching this line'
    },
    null,
    2
  )
);
