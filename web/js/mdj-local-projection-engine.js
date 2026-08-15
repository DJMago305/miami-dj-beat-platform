/**
 * TICKET-011 — Local Projection Engine — Fase 1
 * Generic, pure infrastructure for building deterministic, reconstructible
 * read models ("projections") from the Domain Events produced by
 * mdj-financial-domain-events.js (TICKET-010).
 *
 * Locked Product Owner decisions (TICKET-011 Fase 0):
 *   Q1: projections consume domainEvents[] directly — outbox is delivery-only.
 *   Q2: isolation-per-projection is the ONLY mode in V1 (no cross-projection
 *       atomic batch).
 *   Q3: projection receipts are mandatory from V1.
 *   Q4: eventPosition gaps BLOCK processing (PROJECTION_EVENT_OUT_OF_ORDER) —
 *       no silent reorder, no warning-only mode.
 *   Q5: this file implements ONLY the generic engine + synthetic test
 *       projections. No real business projection lives here.
 *
 * Does NOT modify, import from, or depend on mdj-financial-local-services.js
 * or mdj-financial-domain-events.js. Consumes plain Domain Event objects
 * (shape: {id, eventPosition, eventType, aggregateType, aggregateId, payload,
 * commandId, commandType, idempotencyKey, occurredAt, eventVersion}) passed
 * in by the caller — this module never reaches into another store itself.
 *
 * MUST NOT: touch window.localStorage, document, fetch, Supabase, browser
 * APIs, filesystem, SQL, agenda-engine.js, UI, setTimeout/setInterval, or
 * any dispatcher.
 */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------
   * Generic helpers (self-contained — no dependency on any other module)
   * ------------------------------------------------------------------- */

  function deepCloneJsonSafe(value) {
    if (value === undefined) return undefined;
    if (value === null || typeof value !== 'object') return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      void e;
      return value;
    }
  }

  function defaultIdGenerator() {
    var counter = 0;
    return function () {
      counter++;
      return 'id-' + counter + '-' + Math.random().toString(36).slice(2, 8);
    };
  }

  function resolveCtx(options) {
    return {
      idGen: (options && options.idGenerator) || defaultIdGenerator(),
      now: (options && options.now) || new Date().toISOString()
    };
  }

  function hashString(base) {
    var hash = 0;
    for (var i = 0; i < base.length; i++) {
      hash = (hash << 5) - hash + base.charCodeAt(i);
      hash |= 0;
    }
    return (hash >>> 0).toString(16);
  }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    var keys = Object.keys(value).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + stableStringify(value[k]); }).join(',') + '}';
  }

  function fingerprint(value) {
    return hashString('fp::' + stableStringify(value));
  }

  function sanitizeErrorReason(e) {
    if (e && typeof e.message === 'string' && e.message.length > 0) return e.message;
    return 'PROJECTION_ENGINE_BUILD_FAILED';
  }

  function setKey(key, value) {
    var o = {};
    o[key] = value;
    return o;
  }

  /* ---------------------------------------------------------------------
   * Error codes (11 — PROJECTION_ALREADY_REGISTERED deliberately dropped
   * as redundant with PROJECTION_VERSION_MISMATCH, per Fase 0 §9).
   * ------------------------------------------------------------------- */

  var ERROR_CODES = [
    'MISSING_REQUIRED_FIELD',
    'PROJECTION_NOT_REGISTERED',
    'PROJECTION_VERSION_MISMATCH',
    'PROJECTION_EVENT_OUT_OF_ORDER',
    'PROJECTION_EVENT_POSITION_CONFLICT',
    'PROJECTION_EVENT_ID_CONFLICT',
    'PROJECTION_REDUCER_FAILED',
    'PROJECTION_STATE_VALIDATION_FAILED',
    'PROJECTION_REBUILD_FAILED',
    'PROJECTION_CHECKPOINT_INVALID',
    'PROJECTION_PARTIAL_FAILURE_REQUIRES_RECOVERY'
  ];

  var STATUS = {
    ACTIVE: 'ACTIVE',
    DEGRADED: 'DEGRADED',
    ERROR: 'ERROR',
    REBUILDING: 'REBUILDING',
    DISABLED: 'DISABLED'
  };

  /* ---------------------------------------------------------------------
   * Result builders
   * ------------------------------------------------------------------- */

  function okResult(projectionName, stateChanged, extra) {
    return Object.assign({ ok: true, projectionName: projectionName, stateChanged: !!stateChanged }, extra || {});
  }

  function errResult(projectionName, errorCode, reason) {
    return {
      ok: false,
      projectionName: projectionName,
      errorCode: errorCode,
      errorDetails: { stage: 'PROJECTION_ENGINE', reason: reason },
      stateChanged: false
    };
  }

  /* ---------------------------------------------------------------------
   * Store — JSON-safe only. Registry (with its functions) lives OUTSIDE
   * this store entirely, on the engine instance (see createLocalProjectionEngine).
   * ------------------------------------------------------------------- */

  function createProjectionStore() {
    return {
      schemaVersion: 1,
      projectionCheckpoints: {},
      projectionStates: {},
      projectionFailures: [],
      projectionReceipts: []
    };
  }

  function createInitialCheckpoint(def) {
    return {
      projectionName: def.projectionName,
      projectionVersion: def.projectionVersion,
      lastEventPosition: 0,
      lastEventId: null,
      updatedAt: null,
      status: STATUS.ACTIVE
    };
  }

  /* ---------------------------------------------------------------------
   * Engine factory
   * ------------------------------------------------------------------- */

  function createLocalProjectionEngine() {
    /* Runtime-only registry (holds `reduce`/`validateState` functions) —
     * NEVER part of any store, never serialized. Mirrors how EVENT_DERIVERS
     * lives at module scope in mdj-financial-domain-events.js rather than
     * inside its store; here it is per-engine-instance because registration
     * is dynamic (callers register at runtime) rather than fixed at module
     * load time. */
    var registry = {};

    function registerProjection(definition) {
      if (!definition || typeof definition !== 'object') {
        return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: { stage: 'PROJECTION_REGISTRY', reason: 'definition must be an object' } };
      }
      var name = definition.projectionName;
      var version = definition.projectionVersion;
      var defFingerprint = definition.definitionFingerprint;
      if (!name || typeof name !== 'string') {
        return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: { stage: 'PROJECTION_REGISTRY', reason: 'projectionName is required' } };
      }
      if (!(Number.isInteger(version) && version > 0)) {
        return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: { stage: 'PROJECTION_REGISTRY', reason: 'projectionVersion must be a positive integer' } };
      }
      if (typeof defFingerprint !== 'string' || defFingerprint.trim().length === 0) {
        return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: { stage: 'PROJECTION_REGISTRY', reason: 'definitionFingerprint must be a non-empty string' } };
      }
      if (typeof definition.reduce !== 'function') {
        return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: { stage: 'PROJECTION_REGISTRY', reason: 'reduce must be a function' } };
      }
      var subscribed = definition.subscribedEventTypes;
      if (subscribed !== '*' && !Array.isArray(subscribed)) {
        return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: { stage: 'PROJECTION_REGISTRY', reason: 'subscribedEventTypes must be an array or "*"' } };
      }

      /* Fase 1B (PO decision 1): definitionFingerprint is the ONLY signal used
       * to detect a material definition change under the same name+version.
       * Deliberately NOT comparing functions via toString()/reference identity
       * — those are unreliable across re-registration call sites. A caller
       * that changes reduce/initialState/subscriptions/validateState MUST
       * mint a new fingerprint (and, per contract, a new projectionVersion)
       * or the change is rejected rather than silently ignored. */
      var existing = registry[name];
      if (existing) {
        if (existing.projectionVersion !== version || existing.definitionFingerprint !== defFingerprint) {
          return { ok: false, errorCode: 'PROJECTION_VERSION_MISMATCH', errorDetails: { stage: 'PROJECTION_REGISTRY', reason: 'projection "' + name + '" already registered with version ' + existing.projectionVersion + ' / fingerprint "' + existing.definitionFingerprint + '", got version ' + version + ' / fingerprint "' + defFingerprint + '"' } };
        }
        return { ok: true, projectionName: name, projectionVersion: version, idempotentReplay: true };
      }

      registry[name] = {
        projectionName: name,
        projectionVersion: version,
        definitionFingerprint: defFingerprint,
        subscribedEventTypes: subscribed === '*' ? '*' : subscribed.slice(),
        initialState: deepCloneJsonSafe(definition.initialState !== undefined ? definition.initialState : null),
        reduce: definition.reduce,
        validateState: typeof definition.validateState === 'function' ? definition.validateState : null
      };

      return { ok: true, projectionName: name, projectionVersion: version, idempotentReplay: false };
    }

    function isSubscribed(def, eventType) {
      return def.subscribedEventTypes === '*' || def.subscribedEventTypes.indexOf(eventType) !== -1;
    }

    function withProjectionSlice(store, name, checkpointPatch, statePatch, hasStatePatch, receiptToAppend, failureToAppend) {
      var nextCheckpoints = store.projectionCheckpoints;
      if (checkpointPatch) {
        nextCheckpoints = Object.assign({}, store.projectionCheckpoints, setKey(name, checkpointPatch));
      }
      var nextStates = store.projectionStates;
      if (hasStatePatch) {
        nextStates = Object.assign({}, store.projectionStates, setKey(name, statePatch));
      }
      var nextReceipts = receiptToAppend ? store.projectionReceipts.concat([receiptToAppend]) : store.projectionReceipts;
      var nextFailures = failureToAppend ? store.projectionFailures.concat([failureToAppend]) : store.projectionFailures;

      return Object.assign({}, store, {
        projectionCheckpoints: nextCheckpoints,
        projectionStates: nextStates,
        projectionReceipts: nextReceipts,
        projectionFailures: nextFailures
      });
    }

    /* Core single-event apply. `aborted:true` signals a reducer/validation
     * failure specifically (as opposed to a structural/ordering error),
     * used by applyEvents' batch-rollback logic to distinguish "this event
     * was invalid to even attempt" from "this event was legitimate but its
     * reducer failed". */
    function applyEventCore(store, projectionName, def, event, ctx) {
      var checkpoint = store.projectionCheckpoints[projectionName] || createInitialCheckpoint(def);

      /* Fase 1B (PO decision 2, ratified): DEGRADED and ERROR are both
       * hard-blocking statuses. Neither applyEvent nor applyEvents may make
       * ANY further progress on this projection — not even the specific
       * event that follows the failure — until rebuildProjection completes
       * successfully and restores status to ACTIVE. There is deliberately
       * no skip-the-poison-event or incremental-retry recovery path in V1;
       * full replay via rebuildProjection is the ONLY recovery mechanism. */
      if (checkpoint.status !== STATUS.ACTIVE) {
        return { store: store, result: errResult(projectionName, 'PROJECTION_CHECKPOINT_INVALID', 'projection "' + projectionName + '" is ' + checkpoint.status + '; rebuild required before further apply'), aborted: false };
      }
      if (checkpoint.projectionVersion !== def.projectionVersion) {
        return { store: store, result: errResult(projectionName, 'PROJECTION_VERSION_MISMATCH', 'checkpoint version ' + checkpoint.projectionVersion + ' does not match registered version ' + def.projectionVersion + '; rebuild required'), aborted: false };
      }

      if (event.eventPosition <= checkpoint.lastEventPosition) {
        if (event.eventPosition === checkpoint.lastEventPosition && event.id === checkpoint.lastEventId) {
          return { store: store, result: okResult(projectionName, false, { idempotentReplay: true }), aborted: false };
        }
        return { store: store, result: errResult(projectionName, 'PROJECTION_EVENT_POSITION_CONFLICT', 'event position ' + event.eventPosition + ' (id ' + event.id + ') conflicts with checkpoint history'), aborted: false };
      }
      if (event.eventPosition !== checkpoint.lastEventPosition + 1) {
        return { store: store, result: errResult(projectionName, 'PROJECTION_EVENT_OUT_OF_ORDER', 'expected eventPosition ' + (checkpoint.lastEventPosition + 1) + ', got ' + event.eventPosition), aborted: false };
      }

      /* eventId-reuse anomaly: this exact eventId was already recorded by a
       * PRIOR receipt at a DIFFERENT position for this projection. Distinct
       * from PROJECTION_EVENT_POSITION_CONFLICT (which is position-reuse
       * with a mismatched id) — this is id-reuse with a mismatched
       * position, structurally impossible if domainEvents[] ids are unique
       * (they are), but defended against here rather than left unreachable. */
      var duplicateIdReceipt = store.projectionReceipts.filter(function (r) {
        return r.projectionName === projectionName && r.eventId === event.id;
      })[0];
      if (duplicateIdReceipt) {
        return { store: store, result: errResult(projectionName, 'PROJECTION_EVENT_ID_CONFLICT', 'eventId ' + event.id + ' was already recorded at position ' + duplicateIdReceipt.eventPosition + ', cannot reapply at position ' + event.eventPosition), aborted: false };
      }

      if (!isSubscribed(def, event.eventType)) {
        var skipCheckpoint = Object.assign({}, checkpoint, { lastEventPosition: event.eventPosition, lastEventId: event.id, updatedAt: ctx.now });
        var skippedStore = withProjectionSlice(store, projectionName, skipCheckpoint, null, false, null, null);
        return { store: skippedStore, result: okResult(projectionName, false, { skipped: true }), aborted: false };
      }

      var currentState = Object.prototype.hasOwnProperty.call(store.projectionStates, projectionName)
        ? store.projectionStates[projectionName]
        : deepCloneJsonSafe(def.initialState);

      try {
        var rawNextState = def.reduce(currentState, event);
        var clonedState = deepCloneJsonSafe(rawNextState);
        if (rawNextState !== null && rawNextState !== undefined && typeof rawNextState === 'object' && clonedState === rawNextState) {
          throw new Error('reduce() returned a non-JSON-safe value (deep clone failed)');
        }
        if (def.validateState) {
          var validation = def.validateState(clonedState);
          var valid = validation === true || (validation && typeof validation === 'object' && validation.valid === true);
          if (!valid) {
            var reason = (validation && typeof validation === 'object' && validation.reason) || 'state failed validation';
            var vErr = new Error(reason);
            vErr.isValidationFailure = true;
            throw vErr;
          }
        }

        var newCheckpoint = {
          projectionName: projectionName,
          projectionVersion: def.projectionVersion,
          lastEventPosition: event.eventPosition,
          lastEventId: event.id,
          updatedAt: ctx.now,
          status: STATUS.ACTIVE
        };
        var receipt = {
          id: 'prcpt-' + ctx.idGen(),
          projectionName: projectionName,
          projectionVersion: def.projectionVersion,
          eventId: event.id,
          eventPosition: event.eventPosition,
          appliedAt: ctx.now,
          stateFingerprint: fingerprint(clonedState)
        };
        var nextStore = withProjectionSlice(store, projectionName, newCheckpoint, clonedState, true, receipt, null);
        return { store: nextStore, result: okResult(projectionName, true, {}), aborted: false };
      } catch (e) {
        var errorCode = e && e.isValidationFailure ? 'PROJECTION_STATE_VALIDATION_FAILED' : 'PROJECTION_REDUCER_FAILED';
        var failReason = sanitizeErrorReason(e);
        var failure = {
          id: 'prfail-' + ctx.idGen(),
          projectionName: projectionName,
          eventId: event.id,
          eventPosition: event.eventPosition,
          errorCode: errorCode,
          reason: failReason,
          occurredAt: ctx.now
        };
        var degradedCheckpoint = Object.assign({}, checkpoint, { status: STATUS.DEGRADED });
        var failedStore = withProjectionSlice(store, projectionName, degradedCheckpoint, null, false, null, failure);
        return { store: failedStore, result: errResult(projectionName, errorCode, failReason), aborted: true };
      }
    }

    function applyEvent(store, projectionName, event, options) {
      var def = registry[projectionName];
      if (!def) return { store: store, result: errResult(projectionName, 'PROJECTION_NOT_REGISTERED', 'projection "' + projectionName + '" is not registered') };
      if (!event || typeof event !== 'object') return { store: store, result: errResult(projectionName, 'MISSING_REQUIRED_FIELD', 'event must be an object') };
      if (!(Number.isInteger(event.eventPosition) && event.eventPosition >= 1)) return { store: store, result: errResult(projectionName, 'MISSING_REQUIRED_FIELD', 'event.eventPosition must be a positive integer') };
      if (!event.id) return { store: store, result: errResult(projectionName, 'MISSING_REQUIRED_FIELD', 'event.id is required') };

      var ctx = resolveCtx(options);
      var outcome = applyEventCore(store, projectionName, def, event, ctx);
      return { store: outcome.store, result: outcome.result };
    }

    function applyEvents(store, projectionName, events, options) {
      var def = registry[projectionName];
      if (!def) return { store: store, result: errResult(projectionName, 'PROJECTION_NOT_REGISTERED', 'projection "' + projectionName + '" is not registered') };
      if (!Array.isArray(events)) return { store: store, result: errResult(projectionName, 'MISSING_REQUIRED_FIELD', 'events must be an array') };
      if (events.length === 0) return { store: store, result: okResult(projectionName, false, { applied: 0, skipped: 0, failed: 0 }) };

      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        if (!ev || typeof ev !== 'object' || !(Number.isInteger(ev.eventPosition) && ev.eventPosition >= 1) || !ev.id) {
          return { store: store, result: errResult(projectionName, 'MISSING_REQUIRED_FIELD', 'events[' + i + '] is malformed') };
        }
        if (i > 0 && ev.eventPosition !== events[i - 1].eventPosition + 1) {
          return { store: store, result: errResult(projectionName, 'PROJECTION_EVENT_OUT_OF_ORDER', 'events must be strictly contiguous ascending; events[' + i + '] position ' + ev.eventPosition + ' does not follow events[' + (i - 1) + '] position ' + events[i - 1].eventPosition) };
        }
      }

      var originalStore = store;
      var ctx = resolveCtx(options);
      var workingStore = store;
      var applied = 0;
      var skipped = 0;

      for (var j = 0; j < events.length; j++) {
        var outcome = applyEventCore(workingStore, projectionName, def, events[j], ctx);
        if (outcome.aborted) {
          /* Whole-batch rollback for THIS projection: discard all in-batch
           * progress (even earlier-in-this-batch successes) and branch off
           * the ORIGINAL pre-batch store instead, recording exactly one
           * failure + DEGRADED transition anchored to the original
           * (pre-batch) checkpoint. "Todo o nada dentro del batch". */
          var originalCheckpoint = originalStore.projectionCheckpoints[projectionName] || createInitialCheckpoint(def);
          var degradedCheckpoint = Object.assign({}, originalCheckpoint, { status: STATUS.DEGRADED });
          var failure = {
            id: 'prfail-' + ctx.idGen(),
            projectionName: projectionName,
            eventId: events[j].id,
            eventPosition: events[j].eventPosition,
            errorCode: outcome.result.errorCode,
            reason: outcome.result.errorDetails.reason,
            occurredAt: ctx.now
          };
          var rolledBackStore = withProjectionSlice(originalStore, projectionName, degradedCheckpoint, null, false, null, failure);
          return {
            store: rolledBackStore,
            result: errResult(projectionName, 'PROJECTION_PARTIAL_FAILURE_REQUIRES_RECOVERY', 'batch aborted at events[' + j + '] (eventPosition ' + events[j].eventPosition + '): ' + outcome.result.errorDetails.reason)
          };
        }
        if (!outcome.result.ok) {
          return { store: originalStore, result: outcome.result };
        }
        workingStore = outcome.store;
        if (outcome.result.skipped) skipped++;
        else applied++;
      }

      return { store: workingStore, result: okResult(projectionName, applied > 0, { applied: applied, skipped: skipped, failed: 0 }) };
    }

    function rebuildProjection(store, projectionName, events, options) {
      var def = registry[projectionName];
      if (!def) return { store: store, result: errResult(projectionName, 'PROJECTION_NOT_REGISTERED', 'projection "' + projectionName + '" is not registered') };
      if (!Array.isArray(events)) return { store: store, result: errResult(projectionName, 'MISSING_REQUIRED_FIELD', 'events must be an array') };

      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        if (!ev || typeof ev !== 'object' || !(Number.isInteger(ev.eventPosition) && ev.eventPosition >= 1) || !ev.id) {
          return { store: store, result: errResult(projectionName, 'MISSING_REQUIRED_FIELD', 'events[' + i + '] is malformed') };
        }
        if (i === 0 && ev.eventPosition !== 1) {
          return { store: store, result: errResult(projectionName, 'PROJECTION_EVENT_OUT_OF_ORDER', 'rebuild requires the full event history starting at eventPosition 1, got ' + ev.eventPosition) };
        }
        if (i > 0 && ev.eventPosition !== events[i - 1].eventPosition + 1) {
          return { store: store, result: errResult(projectionName, 'PROJECTION_EVENT_OUT_OF_ORDER', 'rebuild requires strictly contiguous ascending events') };
        }
      }

      var originalStore = store;
      var ctx = resolveCtx(options);

      /* Build entirely in an ISOLATED temp store — never touches
       * originalStore until (and unless) the whole rebuild succeeds. */
      var tempStore = withProjectionSlice(
        createProjectionStore(),
        projectionName,
        createInitialCheckpoint(def),
        deepCloneJsonSafe(def.initialState),
        true,
        null,
        null
      );

      var processed = 0;
      var ignored = 0;

      try {
        for (var k = 0; k < events.length; k++) {
          var outcome = applyEventCore(tempStore, projectionName, def, events[k], ctx);
          if (outcome.aborted || !outcome.result.ok) {
            var innerReason = outcome.result.errorDetails ? outcome.result.errorDetails.reason : outcome.result.errorCode;
            throw new Error('rebuild failed at eventPosition ' + events[k].eventPosition + ': ' + innerReason);
          }
          tempStore = outcome.store;
          if (outcome.result.skipped) ignored++;
          else processed++;
        }

        var finalCheckpoint = tempStore.projectionCheckpoints[projectionName];
        var finalState = tempStore.projectionStates[projectionName];
        var freshReceipts = tempStore.projectionReceipts;

        var otherReceipts = originalStore.projectionReceipts.filter(function (r) { return r.projectionName !== projectionName; });
        var otherFailures = originalStore.projectionFailures.filter(function (f) { return f.projectionName !== projectionName; });

        var nextStore = Object.assign({}, originalStore, {
          projectionCheckpoints: Object.assign({}, originalStore.projectionCheckpoints, setKey(projectionName, finalCheckpoint)),
          projectionStates: Object.assign({}, originalStore.projectionStates, setKey(projectionName, finalState)),
          projectionReceipts: otherReceipts.concat(freshReceipts),
          projectionFailures: otherFailures
        });

        return { store: nextStore, result: okResult(projectionName, true, { processed: processed, ignored: ignored, failed: 0 }) };
      } catch (e) {
        var reason = sanitizeErrorReason(e);
        var failure = {
          id: 'prfail-' + ctx.idGen(),
          projectionName: projectionName,
          eventId: null,
          eventPosition: null,
          errorCode: 'PROJECTION_REBUILD_FAILED',
          reason: reason,
          occurredAt: ctx.now
        };
        var priorCheckpoint = originalStore.projectionCheckpoints[projectionName] || createInitialCheckpoint(def);
        var errorCheckpoint = Object.assign({}, priorCheckpoint, { status: STATUS.ERROR });
        var nextStore = withProjectionSlice(originalStore, projectionName, errorCheckpoint, null, false, null, failure);
        return { store: nextStore, result: errResult(projectionName, 'PROJECTION_REBUILD_FAILED', reason) };
      }
    }

    function rebuildAllProjections(store, events, options) {
      var names = Object.keys(registry);
      var workingStore = store;
      var perProjection = {};
      names.forEach(function (name) {
        var outcome = rebuildProjection(workingStore, name, events, options);
        workingStore = outcome.store;
        perProjection[name] = outcome.result;
      });
      return { store: workingStore, result: { ok: true, projections: perProjection } };
    }

    function resetProjection(store, projectionName) {
      var def = registry[projectionName];
      if (!def) return { store: store, result: errResult(projectionName, 'PROJECTION_NOT_REGISTERED', 'projection "' + projectionName + '" is not registered') };

      var freshCheckpoint = createInitialCheckpoint(def);
      var nextStates = Object.assign({}, store.projectionStates);
      delete nextStates[projectionName];
      var nextReceipts = store.projectionReceipts.filter(function (r) { return r.projectionName !== projectionName; });
      var nextFailures = store.projectionFailures.filter(function (f) { return f.projectionName !== projectionName; });

      var nextStore = Object.assign({}, store, {
        projectionCheckpoints: Object.assign({}, store.projectionCheckpoints, setKey(projectionName, freshCheckpoint)),
        projectionStates: nextStates,
        projectionReceipts: nextReceipts,
        projectionFailures: nextFailures
      });
      return { store: nextStore, result: okResult(projectionName, true, {}) };
    }

    /* ---------------------------------------------------------------------
     * Pure queries — deep clone always, never expose internal references,
     * stable null/[] contract, never mutate.
     * ------------------------------------------------------------------- */

    function getProjectionState(store, name) {
      if (!registry[name]) return null;
      if (Object.prototype.hasOwnProperty.call(store.projectionStates, name)) {
        return deepCloneJsonSafe(store.projectionStates[name]);
      }
      return deepCloneJsonSafe(registry[name].initialState);
    }

    function getProjectionCheckpoint(store, name) {
      if (!registry[name]) return null;
      var cp = store.projectionCheckpoints[name];
      return deepCloneJsonSafe(cp || createInitialCheckpoint(registry[name]));
    }

    function getProjectionStatus(store, name) {
      if (!registry[name]) return null;
      var cp = store.projectionCheckpoints[name];
      return cp ? cp.status : STATUS.ACTIVE;
    }

    function getProjectionFailures(store, name) {
      var all = store.projectionFailures;
      var filtered = name ? all.filter(function (f) { return f.projectionName === name; }) : all;
      return filtered.map(deepCloneJsonSafe);
    }

    function getProjectionReceiptForEvent(store, projectionName, eventId) {
      var match = store.projectionReceipts.filter(function (r) { return r.projectionName === projectionName && r.eventId === eventId; });
      return match.length ? deepCloneJsonSafe(match[0]) : null;
    }

    function listRegisteredProjections(store) {
      return Object.keys(registry).map(function (name) {
        return { projectionName: name, projectionVersion: registry[name].projectionVersion, status: getProjectionStatus(store, name) };
      });
    }

    return {
      createStore: createProjectionStore,
      registerProjection: registerProjection,
      applyEvent: applyEvent,
      applyEvents: applyEvents,
      rebuildProjection: rebuildProjection,
      rebuildAllProjections: rebuildAllProjections,
      resetProjection: resetProjection,
      queries: {
        getProjectionState: getProjectionState,
        getProjectionCheckpoint: getProjectionCheckpoint,
        getProjectionStatus: getProjectionStatus,
        getProjectionFailures: getProjectionFailures,
        getProjectionReceiptForEvent: getProjectionReceiptForEvent,
        listRegisteredProjections: listRegisteredProjections
      },
      STATUS: Object.assign({}, STATUS),
      ERROR_CODES: ERROR_CODES.slice()
    };
  }

  var api = { createLocalProjectionEngine: createLocalProjectionEngine };

  global.MDJLocalProjectionEngine = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
