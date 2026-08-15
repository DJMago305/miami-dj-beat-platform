/**
 * TICKET-015A — Accounting Center Financial Runtime — self-test
 * Local-only (no localStorage, no DOM, no network, no Supabase).
 * Simulates real <script> tag loading via vm.runInContext, in various
 * orders, to verify the browser integration mechanism itself — never
 * executes a single T009 command, never creates any data beyond the empty
 * stores needed to inspect wiring, never renders anything.
 *
 * Run: node web/js/mdj-accounting-financial-runtime.local-selftest.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesSrc = fs.readFileSync(path.join(__dirname, 'mdj-financial-local-services.js'), 'utf8');
const eventsSrc = fs.readFileSync(path.join(__dirname, 'mdj-financial-domain-events.js'), 'utf8');
const engineSrc = fs.readFileSync(path.join(__dirname, 'mdj-local-projection-engine.js'), 'utf8');
const syncSrc = fs.readFileSync(path.join(__dirname, 'mdj-financial-projection-sync.js'), 'utf8');
const arSrc = fs.readFileSync(path.join(__dirname, 'mdj-ar-by-venue-projection.js'), 'utf8');
const runtimeSrc = fs.readFileSync(path.join(__dirname, 'mdj-accounting-financial-runtime.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
}

function makeSandbox() {
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
  return { sandbox: sandbox, scope: windowStub };
}

const results = {};

/* ===========================================================================
 * GROUP 1 — Documented canonical script order: T009 -> T010 -> T011 -> T013
 * -> T014 -> runtime. This is the order to be used in accounting.html.
 * ======================================================================= */

function case_canonical_order_resolves_and_wires_runtime() {
  const { sandbox, scope } = makeSandbox();
  vm.runInContext(servicesSrc, sandbox);
  vm.runInContext(eventsSrc, sandbox);
  vm.runInContext(engineSrc, sandbox);
  vm.runInContext(syncSrc, sandbox);
  vm.runInContext(arSrc, sandbox);
  vm.runInContext(runtimeSrc, sandbox);

  assert(scope.MDJAccountingFinancialRuntime, 'el runtime debe quedar publicado en el scope global');
  const runtime = scope.MDJAccountingFinancialRuntime.createAccountingFinancialRuntime(scope);
  assert(runtime.ok === true, 'con las 5 factories presentes en el orden canónico, la resolución debe tener éxito, got ' + JSON.stringify(runtime));
  assert(runtime.missing.length === 0);
  assert(typeof runtime.wrappedServices.commands.createVenue === 'function', 'wrappedServices debe exponer los comandos reales de T009/T010');
  assert(typeof runtime.engine.applyEvents === 'function', 'engine debe ser una instancia real de T011');
  assert(typeof runtime.sync.syncProjection === 'function', 'sync debe ser una instancia real de T013');
  assert(runtime.arProjection.projectionName === 'AccountsReceivableByVenue');

  const registered = runtime.engine.queries.listRegisteredProjections(runtime.engine.createStore());
  assert(registered.length === 1 && registered[0].projectionName === 'AccountsReceivableByVenue' && registered[0].status === 'ACTIVE', 'la proyección AR debe quedar registrada y ACTIVE, got ' + JSON.stringify(registered));

  results.case_canonical_order_resolves_and_wires_runtime = 'PASS';
}

/* ===========================================================================
 * GROUP 2 — Order independence AMONG T009/T010/T011/T013/T014 themselves:
 * none of them reference each other at top-level definition time, only the
 * runtime's own factory (called after everything is loaded) does. A
 * different relative order among the five must still resolve successfully —
 * proving the canonical order is a readability choice, not a hard runtime
 * requirement, while the runtime module itself must always load last.
 * ======================================================================= */

function case_reordered_dependencies_still_resolve() {
  const { sandbox, scope } = makeSandbox();
  // Deliberately scrambled relative to the canonical order.
  vm.runInContext(arSrc, sandbox);
  vm.runInContext(syncSrc, sandbox);
  vm.runInContext(servicesSrc, sandbox);
  vm.runInContext(engineSrc, sandbox);
  vm.runInContext(eventsSrc, sandbox);
  vm.runInContext(runtimeSrc, sandbox);

  const runtime = scope.MDJAccountingFinancialRuntime.createAccountingFinancialRuntime(scope);
  assert(runtime.ok === true, 'el orden relativo entre T009/T010/T011/T013/T014 no debe importar mientras todas carguen antes que el runtime, got ' + JSON.stringify(runtime));

  results.case_reordered_dependencies_still_resolve = 'PASS';
}

/* ===========================================================================
 * GROUP 3 — Missing factories: reported exactly, never patched/stubbed.
 * ======================================================================= */

function case_single_missing_factory_reported_exactly() {
  const { sandbox, scope } = makeSandbox();
  vm.runInContext(servicesSrc, sandbox);
  vm.runInContext(eventsSrc, sandbox);
  vm.runInContext(engineSrc, sandbox);
  vm.runInContext(syncSrc, sandbox);
  // mdj-ar-by-venue-projection.js deliberately NOT loaded.
  vm.runInContext(runtimeSrc, sandbox);

  const runtime = scope.MDJAccountingFinancialRuntime.createAccountingFinancialRuntime(scope);
  assert(runtime.ok === false, 'con T014 ausente, la resolución debe fallar');
  assert(JSON.stringify(runtime.missing) === JSON.stringify(['MDJArByVenueProjection.createArByVenueProjection']), 'debe reportar exactamente la factory faltante, got ' + JSON.stringify(runtime.missing));
  assert(scope.MDJArByVenueProjection === undefined, 'el módulo ausente jamás debe ser creado, parcheado o simulado por el runtime');

  results.case_single_missing_factory_reported_exactly = 'PASS';
}

function case_different_single_missing_factory_reported_exactly() {
  const { sandbox, scope } = makeSandbox();
  // T011 deliberately NOT loaded this time — proves per-module accuracy,
  // not just "something is missing" generically.
  vm.runInContext(servicesSrc, sandbox);
  vm.runInContext(eventsSrc, sandbox);
  vm.runInContext(syncSrc, sandbox);
  vm.runInContext(arSrc, sandbox);
  vm.runInContext(runtimeSrc, sandbox);

  const runtime = scope.MDJAccountingFinancialRuntime.createAccountingFinancialRuntime(scope);
  assert(runtime.ok === false);
  assert(JSON.stringify(runtime.missing) === JSON.stringify(['MDJLocalProjectionEngine.createLocalProjectionEngine']), 'got ' + JSON.stringify(runtime.missing));

  results.case_different_single_missing_factory_reported_exactly = 'PASS';
}

function case_all_five_missing_reported_exactly() {
  const { sandbox, scope } = makeSandbox();
  vm.runInContext(runtimeSrc, sandbox);

  const runtime = scope.MDJAccountingFinancialRuntime.createAccountingFinancialRuntime(scope);
  assert(runtime.ok === false);
  assert(runtime.missing.length === 5, 'con nada cargado, las 5 factories deben reportarse, got ' + JSON.stringify(runtime.missing));
  const expected = [
    'MDJFinancialLocalServices.createLocalFinancialServices',
    'MDJFinancialDomainEvents.createDomainEventsOutbox',
    'MDJLocalProjectionEngine.createLocalProjectionEngine',
    'MDJFinancialProjectionSync.createFinancialProjectionSync',
    'MDJArByVenueProjection.createArByVenueProjection'
  ];
  assert(JSON.stringify(runtime.missing) === JSON.stringify(expected), 'got ' + JSON.stringify(runtime.missing));
  assert(JSON.stringify(scope.MDJAccountingFinancialRuntime.REQUIRED_FACTORIES) === JSON.stringify(expected), 'REQUIRED_FACTORIES publicado debe coincidir exactamente con lo que la resolución realmente exige');

  results.case_all_five_missing_reported_exactly = 'PASS';
}

/* ===========================================================================
 * GROUP 4 — registerProjection failure path: exercised with a deliberately
 * broken FAKE T014-shaped module (never the real, closed T014 file), to
 * prove this branch is real and not dead code.
 * ======================================================================= */

function case_registration_failure_reported() {
  const { sandbox, scope } = makeSandbox();
  vm.runInContext(servicesSrc, sandbox);
  vm.runInContext(eventsSrc, sandbox);
  vm.runInContext(engineSrc, sandbox);
  vm.runInContext(syncSrc, sandbox);
  vm.runInContext(runtimeSrc, sandbox);
  // Inject a fake, intentionally-invalid AR module (missing `reduce`) —
  // never the real closed T014 file — purely to prove
  // engine.registerProjection's failure path is handled, not silently
  // swallowed or crashed on.
  scope.MDJArByVenueProjection = {
    createArByVenueProjection: function () {
      return { projectionName: 'Broken', projectionVersion: 1, definitionFingerprint: 'fp-broken', subscribedEventTypes: ['X'], initialState: {} };
    }
  };

  const runtime = scope.MDJAccountingFinancialRuntime.createAccountingFinancialRuntime(scope);
  assert(runtime.ok === false, 'una proyección inválida (sin reduce) debe hacer fallar el registro, no crashear ni ignorarse');
  assert(runtime.registrationError && runtime.registrationError.ok === false, 'debe propagar el error real de registerProjection, got ' + JSON.stringify(runtime.registrationError));

  results.case_registration_failure_reported = 'PASS';
}

/* ===========================================================================
 * GROUP 5 — Zero writes, zero commands, zero UI, zero localStorage.
 * ======================================================================= */

function case_zero_writes_and_zero_commands() {
  const { sandbox, scope } = makeSandbox();
  vm.runInContext(servicesSrc, sandbox);
  vm.runInContext(eventsSrc, sandbox);
  vm.runInContext(engineSrc, sandbox);
  vm.runInContext(syncSrc, sandbox);
  vm.runInContext(arSrc, sandbox);
  vm.runInContext(runtimeSrc, sandbox);

  const runtime = scope.MDJAccountingFinancialRuntime.createAccountingFinancialRuntime(scope);
  assert(runtime.ok === true);

  // Creating a runtime must never itself create any financial entity, event,
  // or projection state — only empty, structural stores when the CALLER
  // explicitly asks for one via the exposed helpers.
  const financialStore = runtime.createFinancialStore();
  assert(runtime.wrappedServices.events.getAllEvents(financialStore).length === 0, 'ningún evento debe existir antes de que el caller ejecute un comando real');
  assert(financialStore.venues.length === 0 && financialStore.venueReceivables.length === 0 && financialStore.payments.length === 0, 'el store financiero debe nacer completamente vacío — el runtime no crea datos');

  const projectionStore = runtime.createProjectionStore();
  const arState = runtime.engine.queries.getProjectionState(projectionStore, runtime.arProjection.projectionName);
  assert(Object.keys(arState.receivablesById).length === 0 && Object.keys(arState.aggregates).length === 0, 'el estado de la proyección AR debe nacer vacío — cero escrituras');

  results.case_zero_writes_and_zero_commands = 'PASS';
}

/* ===========================================================================
 * Run everything
 * ======================================================================= */

case_canonical_order_resolves_and_wires_runtime();
case_reordered_dependencies_still_resolve();
case_single_missing_factory_reported_exactly();
case_different_single_missing_factory_reported_exactly();
case_all_five_missing_reported_exactly();
case_registration_failure_reported();
case_zero_writes_and_zero_commands();

console.log(
  JSON.stringify(
    {
      ok: true,
      results: results,
      networkAccess: 0,
      localStorageAccess: 0,
      domAccess: 0,
      commandsExecuted: 0,
      uiElementsCreated: 0,
      note: 'sandbox never defined fetch/localStorage/document/setTimeout/setInterval — any access would have thrown ReferenceError before reaching this line; no T009 command was ever invoked in this file'
    },
    null,
    2
  )
);
