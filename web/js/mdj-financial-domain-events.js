/**
 * TICKET-010 — Domain Events / Outbox Local — Fase 1
 * Pure, isolated wrapper around MDJFinancialLocalServices (Ticket 009).
 *
 * Does NOT modify mdj-financial-local-services.js. Does NOT reimplement any
 * financial rule, state transition, or idempotency mechanism — it only reads
 * the already-validated {store, result} returned by each of the 17 wrapped
 * commands and, on genuine first-time success, appends append-only
 * `domainEvents[]` / `outbox[]` rows to the store.
 *
 * MUST NOT: touch window.localStorage, document, fetch, Supabase, browser APIs,
 * filesystem, SQL, any runtime module, setTimeout/setInterval, or any dispatcher.
 * Not imported by any runtime module. Not wired to any UI in this ticket.
 */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------
   * Generic helpers (self-contained — no dependency on services.js internals)
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

  function resolveEventCtx(input) {
    return {
      idGen: (input && input.idGenerator) || defaultIdGenerator(),
      now: (input && input.now) || new Date().toISOString()
    };
  }

  function addMinutesIso(iso, minutes) {
    var t = Date.parse(iso);
    return new Date(t + minutes * 60000).toISOString();
  }

  /* Stable, sanitized error reason — never a raw exception object, never a
   * stack trace. Falls back to a fixed constant if the caught value has no
   * usable string message. */
  function sanitizeErrorReason(e) {
    if (e && typeof e.message === 'string' && e.message.length > 0) return e.message;
    return 'DOMAIN_EVENTS_OUTBOX_BUILD_FAILED';
  }

  /* ---------------------------------------------------------------------
   * Constants (locked Product Owner decisions, TICKET-010 Fase 0)
   * ------------------------------------------------------------------- */

  var EVENT_VERSION = 1;
  var MAX_ATTEMPTS = 5;
  /* Delay applied AFTER attempt N fails, before attempt N+1 may run.
   * Index 0 = after attempt 1, index 1 = after attempt 2, etc.
   * After attempt 5 (index 4, out of bounds) -> POISON, no further retry. */
  var RETRY_DELAYS_MINUTES = [1, 5, 15, 60];

  /* ---------------------------------------------------------------------
   * Store extension
   * ------------------------------------------------------------------- */

  function createEventStore(financialServicesModule) {
    var base = financialServicesModule.createLocalFinancialServices().createStore();
    return Object.assign({}, base, { domainEvents: [], outbox: [] });
  }

  /* ---------------------------------------------------------------------
   * Event / outbox row builders (pure)
   * ------------------------------------------------------------------- */

  function buildDomainEvent(idGen, now, commandType, commandId, idempotencyKey, position, ev) {
    return {
      id: 'evt-' + idGen(),
      eventVersion: EVENT_VERSION,
      eventPosition: position,
      eventType: ev.eventType,
      aggregateType: ev.aggregateType,
      aggregateId: ev.aggregateId,
      payload: deepCloneJsonSafe(ev.payload),
      commandId: commandId,
      commandType: commandType,
      idempotencyKey: idempotencyKey,
      occurredAt: now
    };
  }

  function buildOutboxRow(idGen, now, eventId) {
    return {
      id: 'obx-' + idGen(),
      eventId: eventId,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      lastAttemptAt: null,
      lastError: null,
      nextRetryAt: null,
      createdAt: now
    };
  }

  /* ---------------------------------------------------------------------
   * Domain event catalog — one deriver per commandType.
   * Each deriver receives the ALREADY-SUCCESSFUL, non-replay `result` and
   * the POST-command `store`, and returns an array of
   * { eventType, aggregateType, aggregateId, payload } — zero, one, or
   * several events (never mutates anything).
   *
   * NOTE (Product Owner decision, Q1): OwnerLedgerEntry never produces its
   * own event — where present, it is embedded as context inside the payload
   * of the event that caused it (PaymentConfirmed / PaymentRefunded /
   * OwnerPayoutRecorded), never emitted as a standalone entry.
   *
   * NOTE: InvoiceIssued and any Invoice-related event are explicitly out of
   * scope for this ticket (Invoice lives in the commercial/Supabase channel).
   * ------------------------------------------------------------------- */

  function deriveCreateVenue(result) {
    var venue = result.data;
    return [{ eventType: 'VenueCreated', aggregateType: 'Venue', aggregateId: venue.id, payload: venue }];
  }

  function deriveCreateVenueAgreement(result) {
    var agreement = result.data;
    return [{ eventType: 'VenueAgreementCreated', aggregateType: 'VenueAgreement', aggregateId: agreement.id, payload: agreement }];
  }

  function deriveCreateOccurrenceWithPfr(result) {
    var occurrence = result.data.occurrence;
    var pfr = result.data.pfr;
    return [
      { eventType: 'OccurrenceScheduled', aggregateType: 'Occurrence', aggregateId: occurrence.id, payload: occurrence },
      { eventType: 'PerformanceFinancialRecordCreated', aggregateType: 'PerformanceFinancialRecord', aggregateId: pfr.id, payload: pfr }
    ];
  }

  function deriveRescheduleOccurrence(result) {
    var occurrence = result.data.occurrence;
    return [{
      eventType: 'OccurrenceRescheduled',
      aggregateType: 'Occurrence',
      aggregateId: occurrence.id,
      payload: { occurrence: occurrence, previousDate: result.data.previousDate, previousShift: result.data.previousShift, reason: result.data.reason, requestedBy: result.data.requestedBy }
    }];
  }

  function deriveCreateVenueReceivable(result) {
    var receivable = result.data;
    return [{ eventType: 'VenueReceivableCreated', aggregateType: 'VenueReceivable', aggregateId: receivable.id, payload: receivable }];
  }

  function deriveCreatePayable(result) {
    var payable = result.data;
    return [{ eventType: 'PayableCreated', aggregateType: 'Payable', aggregateId: payable.id, payload: payable }];
  }

  function deriveRecordPayment(result) {
    var payment = result.data;
    return [{ eventType: 'PaymentRecorded', aggregateType: 'Payment', aggregateId: payment.id, payload: payment }];
  }

  function deriveConfirmPayment(result) {
    var payment = result.data.payment;
    return [{
      eventType: 'PaymentConfirmed',
      aggregateType: 'Payment',
      aggregateId: payment.id,
      payload: { payment: payment, ledgerEntry: result.data.ledgerEntry }
    }];
  }

  function deriveFailPayment(result) {
    var payment = result.data;
    return [{ eventType: 'PaymentFailed', aggregateType: 'Payment', aggregateId: payment.id, payload: payment }];
  }

  function deriveAllocatePayment(result) {
    var allocation = result.data.allocation;
    return [{
      eventType: 'PaymentAllocated',
      aggregateType: 'PaymentAllocation',
      aggregateId: allocation.id,
      payload: { allocation: allocation, target: result.data.target }
    }];
  }

  function deriveReverseAllocation(result) {
    var reversal = result.data.reversal;
    return [{
      eventType: 'PaymentAllocationReversed',
      aggregateType: 'PaymentAllocation',
      aggregateId: reversal.id,
      payload: { reversal: reversal, target: result.data.target }
    }];
  }

  function deriveRecordRefund(result, store) {
    var refundPayment = result.data.refundPayment;
    var events = [{
      eventType: 'PaymentRefunded',
      aggregateType: 'Payment',
      aggregateId: refundPayment.id,
      payload: { refundPayment: refundPayment, ledgerEntry: result.data.ledgerEntry }
    }];
    /* A 3rd createdId means coreRecordRefund also created a compensating
     * REVERSE allocation row (targetAllocationId path). Look it up from the
     * post-command store (read-only) to build its own event — this is
     * reading already-computed state, not recomputing any financial rule. */
    if (result.createdIds.length === 3) {
      var reversalId = result.createdIds[2];
      var reversalRow = store.paymentAllocations.filter(function (a) { return a.id === reversalId; })[0];
      if (reversalRow) {
        events.push({
          eventType: 'PaymentAllocationReversed',
          aggregateType: 'PaymentAllocation',
          aggregateId: reversalRow.id,
          payload: reversalRow
        });
      }
    }
    return events;
  }

  function deriveRecordOwnerPayout(result) {
    var payable = result.data.payable;
    return [{
      eventType: 'OwnerPayoutRecorded',
      aggregateType: 'Payable',
      aggregateId: payable.id,
      payload: { payment: result.data.payment, allocation: result.data.allocation, payable: payable }
    }];
  }

  function deriveReconcilePayment(result) {
    var reconciliation = result.data;
    return [{ eventType: 'PaymentReconciliationRecorded', aggregateType: 'Reconciliation', aggregateId: reconciliation.id, payload: reconciliation }];
  }

  function deriveCancelOccurrence(result, store) {
    var occurrence = result.data.occurrence;
    var events = [{ eventType: 'OccurrenceCancelled', aggregateType: 'Occurrence', aggregateId: occurrence.id, payload: occurrence }];
    result.affectedIds
      .filter(function (id) { return id !== occurrence.id; })
      .forEach(function (id) {
        var receivable = store.venueReceivables.filter(function (r) { return r.id === id; })[0];
        if (receivable) {
          events.push({ eventType: 'VenueReceivableVoided', aggregateType: 'VenueReceivable', aggregateId: receivable.id, payload: receivable });
          return;
        }
        var payable = store.payables.filter(function (p) { return p.id === id; })[0];
        if (payable) {
          events.push({ eventType: 'PayableVoided', aggregateType: 'Payable', aggregateId: payable.id, payload: payable });
        }
      });
    return events;
  }

  function deriveVoidReceivable(result) {
    var receivable = result.data;
    return [{ eventType: 'VenueReceivableVoided', aggregateType: 'VenueReceivable', aggregateId: receivable.id, payload: receivable }];
  }

  function deriveVoidPayable(result) {
    var payable = result.data;
    return [{ eventType: 'PayableVoided', aggregateType: 'Payable', aggregateId: payable.id, payload: payable }];
  }

  var EVENT_DERIVERS = {
    createVenue: deriveCreateVenue,
    createVenueAgreement: deriveCreateVenueAgreement,
    createOccurrenceWithPfr: deriveCreateOccurrenceWithPfr,
    rescheduleOccurrence: deriveRescheduleOccurrence,
    createVenueReceivable: deriveCreateVenueReceivable,
    createPayable: deriveCreatePayable,
    recordPayment: deriveRecordPayment,
    confirmPayment: deriveConfirmPayment,
    failPayment: deriveFailPayment,
    allocatePayment: deriveAllocatePayment,
    reverseAllocation: deriveReverseAllocation,
    recordRefund: deriveRecordRefund,
    recordOwnerPayout: deriveRecordOwnerPayout,
    reconcilePayment: deriveReconcilePayment,
    cancelOccurrence: deriveCancelOccurrence,
    voidReceivable: deriveVoidReceivable,
    voidPayable: deriveVoidPayable
  };

  /* The full catalog, exposed for tests/audits — must match EVENT_DERIVERS'
   * possible outputs exactly (dynamically verified in the self-test, not by
   * a second hand-typed list pretending to be authoritative on its own). */
  var EVENT_TYPE_CATALOG = [
    'VenueCreated',
    'VenueAgreementCreated',
    'OccurrenceScheduled',
    'PerformanceFinancialRecordCreated',
    'OccurrenceRescheduled',
    'VenueReceivableCreated',
    'PayableCreated',
    'PaymentRecorded',
    'PaymentConfirmed',
    'PaymentFailed',
    'PaymentAllocated',
    'PaymentAllocationReversed',
    'PaymentRefunded',
    'OwnerPayoutRecorded',
    'PaymentReconciliationRecorded',
    'OccurrenceCancelled',
    'VenueReceivableVoided',
    'PayableVoided'
  ];

  /* ---------------------------------------------------------------------
   * The single emission point — every wrapped command passes through here.
   *
   * ATOMIC ROLLBACK CONTRACT (locked, Fase 1B — corrects the HIGH finding
   * from the directed atomicity audit):
   *   `originalStore` is captured before coreCommandFn ever runs. The ENTIRE
   *   post-success phase (deriverFn, buildDomainEvent, deepClone,
   *   eventPosition, buildOutboxRow, array construction) executes inside a
   *   single try/catch. If ANY of it throws — for ANY reason, including a
   *   deliberately-injected test fault — the wrapper:
   *     - returns `store: originalStore` (the EXACT reference passed in,
   *       never `out.store`, never a partially-built store);
   *     - returns a stable error result: ok:false,
   *       errorCode:'PARTIAL_FAILURE_REQUIRES_RECOVERY',
   *       errorDetails:{stage:'DOMAIN_EVENTS_OUTBOX', reason:<sanitized>},
   *       stateChanged:false;
   *     - never re-throws to the caller.
   *   This means a late failure can NEVER leave the underlying financial
   *   entity + its commandReceipt "accepted" in the store the caller
   *   actually receives back — either everything (entity + receipt +
   *   events + outbox) lands together, or none of it does, from the
   *   caller's point of view.
   * ------------------------------------------------------------------- */

  function wrapCommand(commandType, coreCommandFn, deriverFn, faultInjector) {
    return function (store, input) {
      var originalStore = store;
      var out = coreCommandFn(originalStore, input);

      /* Idempotency-of-effect (locked decision): only a genuine first-time
       * success emits events. Error and replay are structurally excluded
       * here, before touching domainEvents/outbox at all. */
      if (!out.result.ok || out.result.idempotentReplay) {
        return out;
      }

      try {
        /* Fase 1D — the 'deriver' stage may, ONLY for test purposes, signal
         * an override of the deriver's actual output by returning an object
         * with an own `override` property (any value, including [], null,
         * or undefined all count as "override present" — the property's
         * mere presence is the signal, not its value). This lets tests
         * simulate a broken deriver without a second production code path
         * and without duplicating any real deriver. Normal production calls
         * (no faultInjector, or one that returns nothing at this stage)
         * are completely unaffected: `derivedEvents` comes from the real
         * `deriverFn` exactly as before. */
        var deriverSignal = faultInjector ? faultInjector('deriver', { commandType: commandType, result: out.result }) : undefined;
        var derivedEvents = (deriverSignal && Object.prototype.hasOwnProperty.call(deriverSignal, 'override'))
          ? deriverSignal.override
          : deriverFn(out.result, out.store);

        /* Locked contract: a genuinely new, successful command MUST produce
         * at least one Domain Event. A deriver returning [], null,
         * undefined, or anything that isn't a non-empty array is treated as
         * a build failure — same atomic rollback as any other exception in
         * this stage, never a silent "success with nothing recorded". */
        if (!Array.isArray(derivedEvents) || derivedEvents.length === 0) {
          throw new Error('DOMAIN_EVENT_DERIVER_RETURNED_NO_EVENTS');
        }
        var events = derivedEvents;

        var ctx = resolveEventCtx(input);
        var nextStore = out.store;

        events.forEach(function (ev, i) {
          if (faultInjector) faultInjector('event', { commandType: commandType, index: i, eventType: ev.eventType });
          var position = nextStore.domainEvents.length + 1;
          var domainEvent = buildDomainEvent(ctx.idGen, ctx.now, commandType, out.result.commandId, input.idempotencyKey, position, ev);
          if (faultInjector) faultInjector('outbox', { commandType: commandType, index: i, eventType: ev.eventType, eventId: domainEvent.id });
          var outboxRow = buildOutboxRow(ctx.idGen, ctx.now, domainEvent.id);
          /* Single Object.assign per event — the whole (entities + receipt)
           * from `out.store` plus the new event/outbox rows land in exactly
           * one returned {store, result}; no intermediate state is ever
           * observable by the caller (and if anything throws mid-loop, the
           * surrounding try/catch discards this partially-built nextStore
           * entirely — the caller never sees it). */
          nextStore = Object.assign({}, nextStore, {
            domainEvents: nextStore.domainEvents.concat([domainEvent]),
            outbox: nextStore.outbox.concat([outboxRow])
          });
        });

        return { store: nextStore, result: out.result };
      } catch (e) {
        return {
          store: originalStore,
          result: {
            ok: false,
            commandId: out.result.commandId,
            errorCode: 'PARTIAL_FAILURE_REQUIRES_RECOVERY',
            errorDetails: { stage: 'DOMAIN_EVENTS_OUTBOX', reason: sanitizeErrorReason(e) },
            stateChanged: false
          }
        };
      }
    };
  }

  /* ---------------------------------------------------------------------
   * Outbox pure operations — no dispatcher, no timers, no automatic process.
   * These are plain functions a FUTURE dispatcher would call; nothing in
   * this module invokes them on its own.
   * ------------------------------------------------------------------- */

  function findOutboxIndex(store, outboxId) {
    for (var i = 0; i < store.outbox.length; i++) {
      if (store.outbox[i].id === outboxId) return i;
    }
    return -1;
  }

  function replaceOutboxRow(store, index, updatedRow) {
    var nextOutbox = store.outbox.slice();
    nextOutbox[index] = updatedRow;
    return Object.assign({}, store, { outbox: nextOutbox });
  }

  function markOutboxDelivered(store, outboxId, now) {
    var idx = findOutboxIndex(store, outboxId);
    if (idx === -1) return store;
    var row = store.outbox[idx];
    var updated = Object.assign({}, row, {
      status: 'DELIVERED',
      attempts: row.attempts + 1,
      lastAttemptAt: now,
      lastError: null,
      nextRetryAt: null
    });
    return replaceOutboxRow(store, idx, updated);
  }

  function recordOutboxFailure(store, outboxId, now, errorMessage) {
    var idx = findOutboxIndex(store, outboxId);
    if (idx === -1) return store;
    var row = store.outbox[idx];
    var newAttempts = row.attempts + 1;
    var updated;
    if (newAttempts >= MAX_ATTEMPTS) {
      updated = Object.assign({}, row, {
        status: 'POISON',
        attempts: newAttempts,
        lastAttemptAt: now,
        lastError: errorMessage != null ? errorMessage : null,
        nextRetryAt: null
      });
    } else {
      var delayMinutes = RETRY_DELAYS_MINUTES[newAttempts - 1];
      updated = Object.assign({}, row, {
        status: 'FAILED',
        attempts: newAttempts,
        lastAttemptAt: now,
        lastError: errorMessage != null ? errorMessage : null,
        nextRetryAt: addMinutesIso(now, delayMinutes)
      });
    }
    return replaceOutboxRow(store, idx, updated);
  }

  /* PENDING or FAILED rows whose nextRetryAt has arrived (or is null, i.e.
   * never attempted). POISON and DELIVERED are never deliverable again.
   * POISON rows are simply excluded here — they never block any other row
   * from being returned (no ordering dependency between outbox entries). */
  function getDeliverableOutbox(store, now) {
    return store.outbox.filter(function (row) {
      if (row.status !== 'PENDING' && row.status !== 'FAILED') return false;
      if (row.nextRetryAt === null) return true;
      return row.nextRetryAt <= now;
    });
  }

  /* ---------------------------------------------------------------------
   * Read-only event/outbox queries — genuinely read-only (Fase 1D).
   * Every element returned is a deep JSON clone (deepCloneJsonSafe), not a
   * reference into the store — this also isolates nested `payload`, not
   * just the top-level event/outbox row object. A caller mutating any part
   * of a query result can never affect the internal store. Contract
   * preserved: array-returning queries still return [] (never null/throw)
   * when nothing matches; getOutboxEntryForEvent still returns null.
   * ------------------------------------------------------------------- */

  function getEventsForAggregate(store, aggregateType, aggregateId) {
    return store.domainEvents
      .filter(function (e) {
        return e.aggregateType === aggregateType && e.aggregateId === aggregateId;
      })
      .map(deepCloneJsonSafe);
  }

  function getAllEvents(store) {
    return store.domainEvents.map(deepCloneJsonSafe);
  }

  function getOutboxEntryForEvent(store, eventId) {
    var match = store.outbox.filter(function (row) { return row.eventId === eventId; });
    return match.length ? deepCloneJsonSafe(match[0]) : null;
  }

  function getPoisonOutbox(store) {
    return store.outbox.filter(function (row) { return row.status === 'POISON'; }).map(deepCloneJsonSafe);
  }

  /* ---------------------------------------------------------------------
   * Public factory
   * ------------------------------------------------------------------- */

  function createDomainEventsOutbox(financialServicesModule, options) {
    /* Optional test-only seam. Not a global, not timers, not Math.random —
     * a plain function closed over by wrapCommand, invoked synchronously at
     * well-defined stages ('deriver' | 'event' | 'outbox'). When omitted
     * (the normal/production path), every call site below is a no-op and
     * behavior is byte-for-byte identical to before this seam existed. */
    var faultInjector = (options && options.faultInjector) || null;
    var base = financialServicesModule.createLocalFinancialServices();
    var wrappedCommands = {};
    Object.keys(EVENT_DERIVERS).forEach(function (commandType) {
      wrappedCommands[commandType] = wrapCommand(commandType, base.commands[commandType], EVENT_DERIVERS[commandType], faultInjector);
    });

    return {
      createStore: function () { return createEventStore(financialServicesModule); },
      commands: wrappedCommands,
      queries: base.queries,
      events: {
        getAllEvents: getAllEvents,
        getEventsForAggregate: getEventsForAggregate,
        getOutboxEntryForEvent: getOutboxEntryForEvent,
        getDeliverableOutbox: getDeliverableOutbox,
        getPoisonOutbox: getPoisonOutbox
      },
      outboxOps: {
        markOutboxDelivered: markOutboxDelivered,
        recordOutboxFailure: recordOutboxFailure,
        getDeliverableOutbox: getDeliverableOutbox
      },
      EVENT_TYPE_CATALOG: EVENT_TYPE_CATALOG.slice(),
      EVENT_VERSION: EVENT_VERSION,
      MAX_ATTEMPTS: MAX_ATTEMPTS,
      RETRY_DELAYS_MINUTES: RETRY_DELAYS_MINUTES.slice()
    };
  }

  var api = { createDomainEventsOutbox: createDomainEventsOutbox };

  global.MDJFinancialDomainEvents = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
