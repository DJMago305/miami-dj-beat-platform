/**
 * TICKET-015A — Accounting Center — Financial Runtime (browser integration
 * mechanism only).
 *
 * This module does NOT create data, does NOT execute any T009 command, does
 * NOT render anything, does NOT touch localStorage or Supabase. It only:
 *   1. Resolves whether the required factories (T009, T010, T011, T013,
 *      T014) are present on the given global scope.
 *   2. If they are, wires fresh instances of each together (the same
 *      composition every self-test in this line already uses) and returns
 *      them, plus two pass-through store-creator helpers.
 *   3. If any is missing, reports exactly which one(s) — never modifies,
 *      patches, or stubs the missing module.
 *
 * Required script load order (documented here, verified by this module's own
 * self-test in a simulated browser sandbox): T009 -> T010 -> T011 -> T013 ->
 * T014 -> this file. T012 (Legacy Import Bridge) is deliberately NOT part of
 * this runtime — it is a one-time legacy-import tool, not needed for live
 * Accounting Center operation.
 *
 * Nothing in this file executes automatically at load time — exactly like
 * every other module in this line, it only exposes a factory
 * (createAccountingFinancialRuntime). The caller decides if/when to call it.
 *
 * Does NOT modify, patch, or depend on the internals of
 * mdj-financial-local-services.js, mdj-financial-domain-events.js,
 * mdj-local-projection-engine.js, mdj-financial-projection-sync.js, or
 * mdj-ar-by-venue-projection.js — only their already-published global API.
 *
 * MUST NOT: touch window.localStorage, document, fetch, Supabase, run any
 * T009 command, render any UI, or create any table/row.
 */
(function (global) {
  'use strict';

  var REQUIRED_FACTORIES = [
    { globalName: 'MDJFinancialLocalServices', factoryName: 'createLocalFinancialServices' },
    { globalName: 'MDJFinancialDomainEvents', factoryName: 'createDomainEventsOutbox' },
    { globalName: 'MDJLocalProjectionEngine', factoryName: 'createLocalProjectionEngine' },
    { globalName: 'MDJFinancialProjectionSync', factoryName: 'createFinancialProjectionSync' },
    { globalName: 'MDJArByVenueProjection', factoryName: 'createArByVenueProjection' }
  ];

  function resolveFactories(scope) {
    var missing = [];
    var modules = {};
    REQUIRED_FACTORIES.forEach(function (spec) {
      var mod = scope ? scope[spec.globalName] : undefined;
      if (!mod || typeof mod[spec.factoryName] !== 'function') {
        missing.push(spec.globalName + '.' + spec.factoryName);
        return;
      }
      modules[spec.globalName] = mod;
    });
    return { ok: missing.length === 0, missing: missing, modules: modules };
  }

  /* Wires one fresh instance of each resolved factory together. This exact
   * composition (events-outbox wrapping local-services, a fresh projection
   * engine, a fresh sync helper, the AR-by-venue projection registered into
   * that engine) mirrors what every self-test in this line already builds —
   * no new wiring pattern is introduced here. */
  function createAccountingFinancialRuntime(scope) {
    var targetScope = scope || global;
    var resolution = resolveFactories(targetScope);
    if (!resolution.ok) {
      return { ok: false, missing: resolution.missing };
    }

    var servicesModule = resolution.modules.MDJFinancialLocalServices;
    var eventsModule = resolution.modules.MDJFinancialDomainEvents;
    var engineModule = resolution.modules.MDJLocalProjectionEngine;
    var syncModule = resolution.modules.MDJFinancialProjectionSync;
    var arModule = resolution.modules.MDJArByVenueProjection;

    var wrappedServices = eventsModule.createDomainEventsOutbox(servicesModule);
    var engine = engineModule.createLocalProjectionEngine();
    var sync = syncModule.createFinancialProjectionSync();
    var arProjection = arModule.createArByVenueProjection();

    var registration = engine.registerProjection(arProjection);
    if (!registration.ok) {
      return { ok: false, missing: [], registrationError: registration };
    }

    return {
      ok: true,
      missing: [],
      wrappedServices: wrappedServices,
      engine: engine,
      sync: sync,
      arProjection: arProjection,
      createFinancialStore: function () { return wrappedServices.createStore(); },
      createProjectionStore: function () { return engine.createStore(); }
    };
  }

  var api = {
    createAccountingFinancialRuntime: createAccountingFinancialRuntime,
    REQUIRED_FACTORIES: REQUIRED_FACTORIES.map(function (spec) { return spec.globalName + '.' + spec.factoryName; })
  };

  global.MDJAccountingFinancialRuntime = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
