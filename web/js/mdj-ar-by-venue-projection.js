/**
 * TICKET-014 — Accounts Receivable by Venue — Fase 1
 * First real business projection registered against
 * mdj-local-projection-engine.js (TICKET-011). Consumes ONLY real Domain
 * Events (mdj-financial-domain-events.js, TICKET-010) — never touches
 * T009/T012/T013 directly; the caller feeds events via
 * mdj-financial-projection-sync.js (TICKET-013).
 *
 * Subscribed event types (exactly these 5 — everything else is skipped by
 * T011 itself before reduce() is ever called, per its own subscription
 * mechanism):
 *   OccurrenceScheduled, VenueReceivableCreated, PaymentAllocated,
 *   PaymentAllocationReversed, VenueReceivableVoided.
 *
 * Design decision (verified from mdj-financial-local-services.js, not
 * assumed): a VenueReceivable entity never stores its own remaining
 * balance — T009 derives status (OPEN/PARTIALLY_PAID/PAID) at allocation
 * time from summing paymentAllocations. This projection tracks its own
 * `appliedCents` per receivable, computed ONLY from the amountCents already
 * present in real PaymentAllocated/PaymentAllocationReversed event payloads
 * (never inferred, never re-deriving allocatePayment's own logic) so that
 * totalOutstandingCents can reflect the true remaining balance for
 * PARTIALLY_PAID receivables, not just their original face value.
 *
 * Aggregate bucket semantics (documented explicitly since the ticket text
 * itself is ambiguous on this point):
 *   totalOpenCents / totalPartiallyPaidCents / totalPaidCents /
 *   totalVoidCents = sum of each receivable's ORIGINAL amountCents (face
 *   value), grouped by its CURRENT status — a face-value breakdown by
 *   bucket, always summing to the venue+currency's total receivable volume.
 *   totalOutstandingCents = the separate, genuinely computed "still owed"
 *   figure (full amountCents for OPEN, true remaining balance for
 *   PARTIALLY_PAID, 0 for PAID/VOID) — NOT a re-statement of the open/
 *   partially-paid face-value buckets above.
 *
 * OVERDUE is never a stored/persisted status — reduce(state, event) has no
 * access to a clock. isOverdue() is a pure query taking todayIso as an
 * explicit parameter.
 *
 * Invariants (fail via a thrown Error, which T011's own engine converts
 * into PROJECTION_REDUCER_FAILED + DEGRADED — no custom error handling
 * needed here):
 *   - VenueReceivableCreated for an occurrenceId never seen via
 *     OccurrenceScheduled -> throw (no temporary venue/bucket is created).
 *   - PaymentAllocated / PaymentAllocationReversed / VenueReceivableVoided
 *     referencing a receivableId never seen via VenueReceivableCreated ->
 *     throw.
 *   - PaymentAllocated / PaymentAllocationReversed whose target is NOT a
 *     VENUE_RECEIVABLE (i.e. a Payable allocation) -> silently ignored,
 *     state unchanged — this is a different, legitimate event class, not an
 *     invariant violation.
 *
 * NO_VERIFIABLE_PAYMENT_RECEIVABLE_LINK (TICKET-012's documented Legacy
 * Adapter data limitation) is left fully intact: this projection never
 * infers, matches, or reconstructs a payment-to-receivable link by amount,
 * date, or occurrence — it only reflects PaymentAllocated/
 * PaymentAllocationReversed events that already exist in the store.
 *
 * Does NOT modify, import from, or depend on mdj-financial-local-services.js,
 * mdj-financial-domain-events.js, mdj-local-projection-engine.js,
 * mdj-financial-legacy-import-bridge.js, or mdj-financial-projection-sync.js.
 *
 * MUST NOT: touch window.localStorage, document, fetch, Supabase, browser
 * APIs, filesystem, SQL, UI, setTimeout/setInterval, or any dispatcher.
 */
(function (global) {
  'use strict';

  var PROJECTION_NAME = 'AccountsReceivableByVenue';
  var PROJECTION_VERSION = 1;
  var DEFINITION_FINGERPRINT = 'fp-ar-by-venue-v1';
  var SUBSCRIBED_EVENT_TYPES = [
    'OccurrenceScheduled',
    'VenueReceivableCreated',
    'PaymentAllocated',
    'PaymentAllocationReversed',
    'VenueReceivableVoided'
  ];
  var RECEIVABLE_STATUSES = ['OPEN', 'PARTIALLY_PAID', 'PAID', 'VOID'];

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

  function createInitialState() {
    return {
      occurrenceVenueIndex: {},
      receivablesById: {},
      venueIndex: {},
      aggregates: {}
    };
  }

  function emptyAggregateBucket() {
    return {
      totalOpenCents: 0,
      totalPartiallyPaidCents: 0,
      totalPaidCents: 0,
      totalVoidCents: 0,
      totalOutstandingCents: 0,
      receivableCount: 0
    };
  }

  function bucketKeyForStatus(status) {
    if (status === 'OPEN') return 'totalOpenCents';
    if (status === 'PARTIALLY_PAID') return 'totalPartiallyPaidCents';
    if (status === 'PAID') return 'totalPaidCents';
    if (status === 'VOID') return 'totalVoidCents';
    throw new Error('unrecognized receivable status "' + status + '"');
  }

  function computeOutstandingCents(receivable) {
    if (receivable.status === 'PAID' || receivable.status === 'VOID') return 0;
    return receivable.amountCents - receivable.appliedCents;
  }

  function getAggregateBucket(aggregates, venueId, currency) {
    return (aggregates[venueId] && aggregates[venueId][currency]) || emptyAggregateBucket();
  }

  function setAggregateBucket(aggregates, venueId, currency, bucket) {
    var nextVenueAggregates = Object.assign({}, aggregates[venueId]);
    nextVenueAggregates[currency] = bucket;
    var next = Object.assign({}, aggregates);
    next[venueId] = nextVenueAggregates;
    return next;
  }

  function addReceivableToAggregate(aggregates, receivable) {
    var bucket = getAggregateBucket(aggregates, receivable.venueId, receivable.currency);
    var nextBucket = Object.assign({}, bucket);
    var key = bucketKeyForStatus(receivable.status);
    nextBucket[key] = bucket[key] + receivable.amountCents;
    nextBucket.totalOutstandingCents = bucket.totalOutstandingCents + computeOutstandingCents(receivable);
    nextBucket.receivableCount = bucket.receivableCount + 1;
    return setAggregateBucket(aggregates, receivable.venueId, receivable.currency, nextBucket);
  }

  function removeReceivableFromAggregate(aggregates, receivable) {
    var bucket = getAggregateBucket(aggregates, receivable.venueId, receivable.currency);
    var nextBucket = Object.assign({}, bucket);
    var key = bucketKeyForStatus(receivable.status);
    nextBucket[key] = bucket[key] - receivable.amountCents;
    nextBucket.totalOutstandingCents = bucket.totalOutstandingCents - computeOutstandingCents(receivable);
    nextBucket.receivableCount = bucket.receivableCount - 1;
    return setAggregateBucket(aggregates, receivable.venueId, receivable.currency, nextBucket);
  }

  function replaceReceivableAggregateContribution(state, oldReceivable, newReceivable) {
    var afterRemoval = removeReceivableFromAggregate(state.aggregates, oldReceivable);
    return addReceivableToAggregate(afterRemoval, newReceivable);
  }

  function applyOccurrenceScheduled(state, occurrence) {
    var nextIndex = Object.assign({}, state.occurrenceVenueIndex);
    nextIndex[occurrence.id] = occurrence.venueId;
    return Object.assign({}, state, { occurrenceVenueIndex: nextIndex });
  }

  function applyVenueReceivableCreated(state, receivable) {
    var venueId = state.occurrenceVenueIndex[receivable.occurrenceId];
    if (!venueId) {
      throw new Error('VenueReceivableCreated references occurrenceId "' + receivable.occurrenceId + '" with no prior OccurrenceScheduled — cannot resolve venueId');
    }

    var stored = {
      receivableId: receivable.id,
      occurrenceId: receivable.occurrenceId,
      venueId: venueId,
      amountCents: receivable.amountCents,
      currency: receivable.currency,
      status: receivable.status,
      dueDate: receivable.dueDate,
      appliedCents: 0
    };

    var nextReceivablesById = Object.assign({}, state.receivablesById);
    nextReceivablesById[stored.receivableId] = stored;

    var nextVenueIndex = Object.assign({}, state.venueIndex);
    nextVenueIndex[venueId] = (nextVenueIndex[venueId] || []).concat([stored.receivableId]);

    var nextAggregates = addReceivableToAggregate(state.aggregates, stored);

    return Object.assign({}, state, {
      receivablesById: nextReceivablesById,
      venueIndex: nextVenueIndex,
      aggregates: nextAggregates
    });
  }

  function applyPaymentAllocated(state, payload) {
    var allocation = payload.allocation;
    if (allocation.targetType !== 'VENUE_RECEIVABLE') return state;

    var receivableId = payload.target.id;
    var existing = state.receivablesById[receivableId];
    if (!existing) {
      throw new Error('PaymentAllocated references receivableId "' + receivableId + '" with no prior VenueReceivableCreated');
    }

    var updated = Object.assign({}, existing, {
      status: payload.target.status,
      appliedCents: existing.appliedCents + allocation.amountCents
    });

    var nextReceivablesById = Object.assign({}, state.receivablesById);
    nextReceivablesById[receivableId] = updated;

    return Object.assign({}, state, {
      receivablesById: nextReceivablesById,
      aggregates: replaceReceivableAggregateContribution(state, existing, updated)
    });
  }

  function applyPaymentAllocationReversed(state, payload) {
    var reversal = payload.reversal;
    if (reversal.targetType !== 'VENUE_RECEIVABLE') return state;

    var receivableId = payload.target.id;
    var existing = state.receivablesById[receivableId];
    if (!existing) {
      throw new Error('PaymentAllocationReversed references receivableId "' + receivableId + '" with no prior VenueReceivableCreated');
    }

    var updated = Object.assign({}, existing, {
      status: payload.target.status,
      appliedCents: existing.appliedCents - reversal.amountCents
    });

    var nextReceivablesById = Object.assign({}, state.receivablesById);
    nextReceivablesById[receivableId] = updated;

    return Object.assign({}, state, {
      receivablesById: nextReceivablesById,
      aggregates: replaceReceivableAggregateContribution(state, existing, updated)
    });
  }

  function applyVenueReceivableVoided(state, receivable) {
    var existing = state.receivablesById[receivable.id];
    if (!existing) {
      throw new Error('VenueReceivableVoided references receivableId "' + receivable.id + '" with no prior VenueReceivableCreated');
    }

    var updated = Object.assign({}, existing, { status: 'VOID' });

    var nextReceivablesById = Object.assign({}, state.receivablesById);
    nextReceivablesById[receivable.id] = updated;

    return Object.assign({}, state, {
      receivablesById: nextReceivablesById,
      aggregates: replaceReceivableAggregateContribution(state, existing, updated)
    });
  }

  function reduce(state, event) {
    switch (event.eventType) {
      case 'OccurrenceScheduled': return applyOccurrenceScheduled(state, event.payload);
      case 'VenueReceivableCreated': return applyVenueReceivableCreated(state, event.payload);
      case 'PaymentAllocated': return applyPaymentAllocated(state, event.payload);
      case 'PaymentAllocationReversed': return applyPaymentAllocationReversed(state, event.payload);
      case 'VenueReceivableVoided': return applyVenueReceivableVoided(state, event.payload);
      default: return state;
    }
  }

  /* ---------------------------------------------------------------------
   * Pure queries — deep clone always, never mutate, stable contract.
   * ------------------------------------------------------------------- */

  function getVenueReceivables(state, venueId) {
    var ids = state.venueIndex[venueId] || [];
    return ids.map(function (id) { return deepCloneJsonSafe(state.receivablesById[id]); });
  }

  function getVenueTotals(state, venueId, currency) {
    return deepCloneJsonSafe(getAggregateBucket(state.aggregates, venueId, currency));
  }

  function isOverdue(receivable, todayIso) {
    if (!receivable.dueDate) return false;
    if (receivable.status !== 'OPEN' && receivable.status !== 'PARTIALLY_PAID') return false;
    return receivable.dueDate < todayIso;
  }

  function listOverdueReceivables(state, todayIso) {
    return Object.keys(state.receivablesById)
      .map(function (id) { return state.receivablesById[id]; })
      .filter(function (r) { return isOverdue(r, todayIso); })
      .map(deepCloneJsonSafe);
  }

  function createArByVenueProjection() {
    return {
      projectionName: PROJECTION_NAME,
      projectionVersion: PROJECTION_VERSION,
      definitionFingerprint: DEFINITION_FINGERPRINT,
      subscribedEventTypes: SUBSCRIBED_EVENT_TYPES.slice(),
      initialState: createInitialState(),
      reduce: reduce,
      queries: {
        getVenueReceivables: getVenueReceivables,
        getVenueTotals: getVenueTotals,
        isOverdue: isOverdue,
        listOverdueReceivables: listOverdueReceivables
      }
    };
  }

  var api = {
    createArByVenueProjection: createArByVenueProjection,
    PROJECTION_NAME: PROJECTION_NAME,
    PROJECTION_VERSION: PROJECTION_VERSION,
    SUBSCRIBED_EVENT_TYPES: SUBSCRIBED_EVENT_TYPES.slice(),
    RECEIVABLE_STATUSES: RECEIVABLE_STATUSES.slice()
  };

  global.MDJArByVenueProjection = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
