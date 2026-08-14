/**
 * TICKET-013 — Financial Projection Sync — Fase 1
 * Generic orchestration: feeds Domain Events (mdj-financial-domain-events.js,
 * TICKET-010) from ANY financial store — Legacy Import Bridge output
 * (TICKET-012) or native T009/T010 command output — into the Local
 * Projection Engine (mdj-local-projection-engine.js, TICKET-011).
 *
 * Locked Product Owner decisions (TICKET-013 Fase 0):
 *   Q1: this module is ONLY the generic sync/orchestration layer — no real
 *       business projection is defined here; proven exclusively against
 *       T011's own synthetic test projections.
 *   Q3: sync is an explicit, separate step the caller invokes — never
 *       auto-triggered from inside executeImportPlan or any T009/T010
 *       command.
 *   Q4: no origin-filtering (legacy-import vs native) at this layer — a
 *       projection that needs to distinguish origin can inspect
 *       commandType/idempotencyKey/aggregateType inside its own reduce().
 *   Q5: fixtures/in-memory stores only — same restriction as every module in
 *       this line.
 *
 * Does NOT modify, import from, or depend on mdj-financial-local-services.js,
 * mdj-financial-domain-events.js, mdj-local-projection-engine.js, or
 * mdj-financial-legacy-import-bridge.js — the caller supplies the engine
 * instance, both stores, and wrappedServices.events as collaborators.
 *
 * MUST NOT: touch window.localStorage, document, fetch, Supabase, browser
 * APIs, filesystem, SQL, UI, setTimeout/setInterval, or any dispatcher.
 */
(function (global) {
  'use strict';

  function sortByEventPosition(events) {
    return events.slice().sort(function (a, b) { return a.eventPosition - b.eventPosition; });
  }

  /* Registration errors (PROJECTION_NOT_REGISTERED) are deliberately NOT
   * pre-validated here — an unregistered projection has no checkpoint
   * (getProjectionCheckpoint returns null), so lastPosition defaults to 0
   * and the resulting (possibly non-empty) slice is handed to
   * engine.applyEvents, which rejects on its own registry check before ever
   * looking at the events array. This avoids duplicating T011's own
   * validation. */
  function syncProjection(engine, projectionStore, eventStore, wrappedServices, projectionName, options) {
    var checkpoint = engine.queries.getProjectionCheckpoint(projectionStore, projectionName);
    var lastPosition = checkpoint ? checkpoint.lastEventPosition : 0;
    var allEvents = sortByEventPosition(wrappedServices.events.getAllEvents(eventStore));
    var pending = allEvents.filter(function (e) { return e.eventPosition > lastPosition; });
    return engine.applyEvents(projectionStore, projectionName, pending, options);
  }

  function rebuildProjectionFromEventStore(engine, projectionStore, eventStore, wrappedServices, projectionName, options) {
    var allEvents = sortByEventPosition(wrappedServices.events.getAllEvents(eventStore));
    return engine.rebuildProjection(projectionStore, projectionName, allEvents, options);
  }

  /* Sequential fold over all currently registered projections, mirroring
   * T011's own rebuildAllProjections — including its exact return shape
   * ({store, result: {ok:true, projections:{...}}}), so every public
   * function across this entire line keeps the same (store, input) ->
   * {store, result} contract, this one included. One projection's failure
   * never stops the loop — isolation between projections is T011's own
   * guarantee (Fase 0 Q2), this orchestrator just doesn't add a reason to
   * break it. */
  function syncAllRegisteredProjections(engine, projectionStore, eventStore, wrappedServices, options) {
    var names = engine.queries.listRegisteredProjections(projectionStore).map(function (p) { return p.projectionName; });
    var workingStore = projectionStore;
    var projections = {};
    names.forEach(function (name) {
      var outcome = syncProjection(engine, workingStore, eventStore, wrappedServices, name, options);
      workingStore = outcome.store;
      projections[name] = outcome.result;
    });
    return { store: workingStore, result: { ok: true, projections: projections } };
  }

  function createFinancialProjectionSync() {
    return {
      syncProjection: syncProjection,
      rebuildProjectionFromEventStore: rebuildProjectionFromEventStore,
      syncAllRegisteredProjections: syncAllRegisteredProjections
    };
  }

  var api = { createFinancialProjectionSync: createFinancialProjectionSync };

  global.MDJFinancialProjectionSync = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
