/**
 * TICKET-V1-FINANCIAL-LOCAL-IN-MEMORY-SERVICES-009 — Fase 1
 * Pure, isolated, in-memory command/query layer for the canonical financial
 * model defined in docs/architecture/MIAMI-DJ-BEAT-V1-CANONICAL-FINANCIAL-ARCHITECTURE.md.
 *
 * MUST NOT: touch window.localStorage, document, fetch, Supabase, browser APIs,
 * filesystem, SQL, or any runtime module (accounting-module.js / production-module.js).
 * MUST NOT: mutate the store object passed into a command — every command
 * returns { store, result }; on error `store` is the exact same reference
 * that was passed in.
 *
 * Not imported by any runtime module. Not wired to any UI in this ticket.
 */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------
   * Generic helpers
   * ------------------------------------------------------------------- */

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

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

  function findById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function hashString(base) {
    var hash = 0;
    var i;
    for (i = 0; i < base.length; i++) {
      hash = (hash << 5) - hash + base.charCodeAt(i);
      hash |= 0;
    }
    return (hash >>> 0).toString(16);
  }

  /** Deterministic stable stringify (sorted object keys) for fingerprinting payloads. */
  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    var keys = Object.keys(value).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + stableStringify(value[k]); }).join(',') + '}';
  }

  /**
   * Default id generator — realistic (counter + random suffix) for real use.
   * Tests MUST inject their own deterministic generator (a simple counter is
   * enough) via input.idGenerator, and MUST reuse the SAME generator instance
   * across every command call in a scenario that needs cross-call sequencing.
   */
  function defaultIdGenerator() {
    var counter = 0;
    return function () {
      counter++;
      return 'id-' + counter + '-' + Math.random().toString(36).slice(2, 8);
    };
  }

  function resolveCtx(input) {
    return {
      idGen: (input && input.idGenerator) || defaultIdGenerator(),
      now: (input && input.now) || new Date().toISOString(),
      actorId: (input && input.actorId) || null
    };
  }

  /**
   * Currency normalization — single authority for the whole module.
   * null/undefined/''/whitespace-only -> 'USD'. Otherwise: trim + uppercase.
   * Deliberately NOT a full ISO-4217 catalog validator (out of scope for this phase).
   * Every entity that stores `currency` MUST pass through this exactly once at
   * creation time; every comparison then compares already-normalized values.
   */
  function normalizeCurrency(value) {
    if (value === undefined || value === null) return 'USD';
    var trimmed = String(value).trim();
    if (!trimmed) return 'USD';
    return trimmed.toUpperCase();
  }

  /**
   * Resolves an id generator WITHOUT ever touching a property of a
   * potentially null/undefined `input` (guarded by `input &&`), and without
   * ever falling back to a raw, un-injectable Math.random() call — the only
   * non-deterministic default anywhere in this module is defaultIdGenerator()
   * itself, used consistently whether input is valid or not.
   */
  function resolveFallbackIdGen(input) {
    if (input && typeof input.idGenerator === 'function') return input.idGenerator;
    return defaultIdGenerator();
  }

  /* ---------------------------------------------------------------------
   * Store
   * ------------------------------------------------------------------- */

  function createStore() {
    return {
      venues: [],
      venueAgreements: [],
      occurrences: [],
      performanceFinancialRecords: [],
      venueReceivables: [],
      payables: [],
      payments: [],
      paymentAllocations: [],
      ownerLedgerEntries: [],
      reconciliations: [],
      commandReceipts: []
    };
  }

  /* ---------------------------------------------------------------------
   * Result contract
   * ------------------------------------------------------------------- */

  function okResult(commandId, data, createdIds, affectedIds, idempotentReplay) {
    return {
      ok: true,
      commandId: commandId,
      data: deepCloneJsonSafe(data),
      createdIds: (createdIds || []).slice(),
      affectedIds: (affectedIds || []).slice(),
      idempotentReplay: !!idempotentReplay
    };
  }

  function errResult(commandId, errorCode, errorDetails) {
    return {
      ok: false,
      commandId: commandId,
      errorCode: errorCode,
      errorDetails: errorDetails != null ? errorDetails : null,
      stateChanged: false
    };
  }

  /* ---------------------------------------------------------------------
   * Idempotency
   * ------------------------------------------------------------------- */

  function fingerprint(input) {
    var clone = Object.assign({}, input);
    delete clone.idempotencyKey;
    delete clone.now;
    delete clone.idGenerator;
    delete clone.actorId;
    return hashString('fp::' + stableStringify(clone));
  }

  function checkIdempotency(store, commandType, input, fp) {
    var key = input.idempotencyKey;
    var existing = null;
    var i;
    for (i = 0; i < store.commandReceipts.length; i++) {
      var r = store.commandReceipts[i];
      if (r.commandType === commandType && r.idempotencyKey === key) {
        existing = r;
        break;
      }
    }
    if (!existing) return { phase: 'new' };
    if (existing.payloadFingerprint === fp) return { phase: 'replay', receipt: existing };
    return { phase: 'conflict' };
  }

  /* ---------------------------------------------------------------------
   * runCommand — shared envelope: idempotency + atomicity + receipt.
   *
   * coreFn(store, input, commandId, ctx) must return either:
   *   { ok:false, errorCode, errorDetails? }   (store is NEVER touched)
   *   { ok:true, data, createdIds?, affectedIds?, nextStore }
   * coreFn must build `nextStore` as a NEW object (never mutate `store`).
   *
   * FUNCTIONAL CONTRACT (locked, Fase 1B):
   *   command(store, input) -> { store, result }
   *   The caller MUST reassign `store = output.store` to observe the effect.
   *   On any ok:false result, `store` is the EXACT SAME reference passed in.
   *
   * REPLAY / commandId SEMANTICS (locked, Fase 1B):
   *   `commandId` identifies a technical ATTEMPT, not a business fact.
   *   Every call to this function — including a replay — mints a fresh
   *   `commandId` via the injected/default id generator. This is deliberate:
   *   the commandId is NOT a business-entity id, so minting one on replay
   *   does not violate "no new business IDs on replay" (see decision #5,
   *   Fase 1B header). A replay:
   *     - never creates any entity, allocation, or payment;
   *     - never appends a commandReceipt;
   *     - never changes `store` (same reference returned);
   *     - returns `data`/`createdIds`/`affectedIds` copied verbatim from the
   *       ORIGINAL attempt's stored resultSnapshot;
   *     - overwrites ONLY `commandId` and `idempotentReplay` on the clone
   *       returned to the caller — the `resultSnapshot` persisted inside the
   *       matching `commandReceipts[]` entry still carries the ORIGINAL
   *       attempt's commandId, untouched.
   * ------------------------------------------------------------------- */

  function runCommand(store, commandType, input, coreFn) {
    if (!isPlainObject(input)) {
      var fallbackIdGen = resolveFallbackIdGen(input);
      var badId = 'cmd-' + fallbackIdGen();
      return { store: store, result: errResult(badId, 'MISSING_REQUIRED_FIELD', 'input must be an object') };
    }
    var ctx = resolveCtx(input);
    var attemptCommandId = 'cmd-' + ctx.idGen();

    if (!input.idempotencyKey) {
      return { store: store, result: errResult(attemptCommandId, 'MISSING_REQUIRED_FIELD', 'idempotencyKey is required') };
    }

    var fp = fingerprint(input);
    var idem = checkIdempotency(store, commandType, input, fp);
    if (idem.phase === 'conflict') {
      return { store: store, result: errResult(attemptCommandId, 'DUPLICATE_IDEMPOTENCY_KEY', 'idempotencyKey reused with a different payload') };
    }
    if (idem.phase === 'replay') {
      /* Replay: same store reference, no receipt, no new entities. Only
       * commandId (this attempt) and idempotentReplay are overwritten on
       * the clone returned to the caller. */
      var snap = deepCloneJsonSafe(idem.receipt.resultSnapshot);
      snap.commandId = attemptCommandId;
      snap.idempotentReplay = true;
      return { store: store, result: snap };
    }

    var outcome;
    try {
      outcome = coreFn(store, input, attemptCommandId, ctx);
    } catch (e) {
      return { store: store, result: errResult(attemptCommandId, 'PARTIAL_FAILURE_REQUIRES_RECOVERY', String((e && e.message) || e)) };
    }

    if (!outcome || outcome.ok !== true) {
      var code = (outcome && outcome.errorCode) || 'PARTIAL_FAILURE_REQUIRES_RECOVERY';
      var details = outcome && outcome.errorDetails;
      return { store: store, result: errResult(attemptCommandId, code, details) };
    }

    var result = okResult(attemptCommandId, outcome.data, outcome.createdIds, outcome.affectedIds, false);
    var receipt = {
      commandId: attemptCommandId,
      commandType: commandType,
      idempotencyKey: input.idempotencyKey,
      payloadFingerprint: fp,
      resultSnapshot: deepCloneJsonSafe(result),
      createdAt: ctx.now
    };
    var nextStore = Object.assign({}, outcome.nextStore, {
      commandReceipts: outcome.nextStore.commandReceipts.concat([receipt])
    });
    return { store: nextStore, result: result };
  }

  /* ---------------------------------------------------------------------
   * Canonical error codes explicitly NOT reachable/implemented in this phase:
   *
   * PERMISSION_DENIED — out of the executable scope of this local in-memory
   *   layer. There is no real actor/ACL model at this phase (no auth, no
   *   roles) to evaluate a permission decision against. Simulating it would
   *   mean fabricating a policy that does not exist yet. Left undeclared by
   *   any coreFn; excluded from the self-test's errorCodesExpected list.
   *
   * PFR_ALREADY_EXISTS — structurally unreachable from the current public
   *   API. `performanceFinancialRecords` are only ever created inside
   *   createOccurrenceWithPfr, always paired 1:1 with a freshly generated
   *   occurrenceId that cannot already have a PFR. No other command creates
   *   or targets a PFR. Kept documented here rather than fabricated via an
   *   artificial seam; excluded from the self-test's errorCodesExpected list
   *   until a legitimate second PFR-producing path exists.
   * ------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
   * Allocation / balance helpers (shared by allocatePayment, reverseAllocation,
   * recordRefund, recordOwnerPayout, cancelOccurrence, voidReceivable, voidPayable)
   * ------------------------------------------------------------------- */

  function sumAllocations(store, predicate, direction) {
    return store.paymentAllocations
      .filter(function (a) {
        return a.direction === direction && predicate(a);
      })
      .reduce(function (sum, a) {
        return sum + a.amountCents;
      }, 0);
  }

  function targetBalanceInfo(store, targetType, targetId) {
    var target = null;
    if (targetType === 'VENUE_RECEIVABLE') target = findById(store.venueReceivables, targetId);
    else if (targetType === 'PAYABLE') target = findById(store.payables, targetId);
    if (!target) return null;
    var applied = sumAllocations(
      store,
      function (a) {
        return a.targetType === targetType && a.targetId === targetId;
      },
      'APPLY'
    );
    var reversed = sumAllocations(
      store,
      function (a) {
        return a.targetType === targetType && a.targetId === targetId;
      },
      'REVERSE'
    );
    var net = applied - reversed;
    return { target: target, netApplied: net, totalAmountCents: target.amountCents, balanceCents: target.amountCents - net };
  }

  function hasActiveAllocations(store, targetType, targetId) {
    var info = targetBalanceInfo(store, targetType, targetId);
    return !!info && info.netApplied > 0;
  }

  function deriveTargetStatus(kind, balanceCents, totalAmountCents, currentStatus) {
    if (currentStatus === 'VOID') return 'VOID';
    if (balanceCents <= 0) return 'PAID';
    if (balanceCents < totalAmountCents) return 'PARTIALLY_PAID';
    return kind === 'RECEIVABLE' ? 'OPEN' : 'PENDING';
  }

  function applyTargetUpdate(nextStore, targetType, updatedTarget) {
    if (targetType === 'VENUE_RECEIVABLE') {
      nextStore.venueReceivables = nextStore.venueReceivables.map(function (r) {
        return r.id === updatedTarget.id ? updatedTarget : r;
      });
    } else {
      nextStore.payables = nextStore.payables.map(function (p) {
        return p.id === updatedTarget.id ? updatedTarget : p;
      });
    }
  }

  /* ---------------------------------------------------------------------
   * Commands
   * ------------------------------------------------------------------- */

  function coreCreateVenue(store, input, commandId, ctx) {
    void commandId;
    if (!input.name || typeof input.name !== 'string') {
      return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: 'name is required' };
    }
    var id = ctx.idGen();
    var venue = {
      id: id,
      name: input.name,
      address: input.address || null,
      contactName: input.contactName || null,
      contactPhone: input.contactPhone || null,
      contactEmail: input.contactEmail || null,
      status: 'ACTIVE',
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId
    };
    var nextStore = Object.assign({}, store, { venues: store.venues.concat([venue]) });
    return { ok: true, data: venue, createdIds: [id], affectedIds: [], nextStore: nextStore };
  }

  function coreCreateVenueAgreement(store, input, commandId, ctx) {
    void commandId;
    var venue = findById(store.venues, input.venueId);
    if (!venue) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'venueId not found' };
    if (venue.status === 'INACTIVE') return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'venue is INACTIVE' };
    if (!isPlainObject(input.rateByDay) || Object.keys(input.rateByDay).length === 0) {
      return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: 'rateByDay is required' };
    }
    var invalidRate = Object.keys(input.rateByDay).some(function (k) {
      return !(Number(input.rateByDay[k]) > 0);
    });
    if (invalidRate) return { ok: false, errorCode: 'INVALID_AMOUNT', errorDetails: 'rateByDay values must be > 0' };
    if (input.effectiveFrom && input.effectiveUntil && input.effectiveUntil < input.effectiveFrom) {
      return { ok: false, errorCode: 'INVALID_DATE', errorDetails: 'effectiveUntil is before effectiveFrom' };
    }
    var id = ctx.idGen();
    var agreement = {
      id: id,
      venueId: input.venueId,
      title: input.title || null,
      frequency: input.frequency || null,
      scheduledDays: Array.isArray(input.scheduledDays) ? input.scheduledDays.slice() : [],
      rateByDay: Object.assign({}, input.rateByDay),
      currency: normalizeCurrency(input.currency),
      effectiveFrom: input.effectiveFrom || null,
      effectiveUntil: input.effectiveUntil || null,
      status: 'ACTIVE',
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId
    };
    var nextStore = Object.assign({}, store, { venueAgreements: store.venueAgreements.concat([agreement]) });
    return { ok: true, data: agreement, createdIds: [id], affectedIds: [], nextStore: nextStore };
  }

  function coreCreateOccurrenceWithPfr(store, input, commandId, ctx) {
    void commandId;
    var venue = findById(store.venues, input.venueId);
    if (!venue) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'venueId not found' };
    var agreement = null;
    if (input.agreementId) {
      agreement = findById(store.venueAgreements, input.agreementId);
      if (!agreement) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'agreementId not found' };
    }
    if (!input.date) return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: 'date is required' };
    var shift = input.shift || 'default';
    var slotClash = store.occurrences.some(function (o) {
      return o.venueId === input.venueId && o.date === input.date && (o.shift || 'default') === shift && o.status !== 'CANCELLED';
    });
    if (slotClash) return { ok: false, errorCode: 'OCCURRENCE_ALREADY_EXISTS', errorDetails: 'venueId+date+shift+startTime already taken' };
    if (!(Number(input.rateAmountCents) > 0)) {
      return { ok: false, errorCode: 'INVALID_AMOUNT', errorDetails: 'rateAmountCents must be > 0' };
    }

    var occId = ctx.idGen();
    var occurrence = {
      id: occId,
      venueId: input.venueId,
      agreementId: input.agreementId || null,
      assignedProfileId: input.assignedProfileId || null,
      date: input.date,
      shift: shift,
      startTime: input.startTime || null,
      status: 'SCHEDULED',
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId
    };
    var pfrId = ctx.idGen();
    var pfr = {
      id: pfrId,
      occurrenceId: occId,
      agreementId: input.agreementId || null,
      rateAmountCents: input.rateAmountCents,
      currency: normalizeCurrency(input.currency),
      assignedProfileId: input.assignedProfileId || null,
      expectedArtistPayoutCents: input.expectedArtistPayoutCents != null ? input.expectedArtistPayoutCents : null,
      rateByDaySnapshot: agreement ? deepCloneJsonSafe(agreement.rateByDay) : null,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId
    };
    var nextStore = Object.assign({}, store, {
      occurrences: store.occurrences.concat([occurrence]),
      performanceFinancialRecords: store.performanceFinancialRecords.concat([pfr])
    });
    return {
      ok: true,
      data: { occurrence: occurrence, pfr: pfr },
      createdIds: [occId, pfrId],
      affectedIds: [],
      nextStore: nextStore
    };
  }

  function coreRescheduleOccurrence(store, input, commandId, ctx) {
    void commandId;
    var occ = findById(store.occurrences, input.occurrenceId);
    if (!occ) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'occurrenceId not found' };
    if (occ.status !== 'SCHEDULED') {
      return { ok: false, errorCode: 'INVALID_STATE_TRANSITION', errorDetails: 'only SCHEDULED occurrences may be rescheduled' };
    }
    if (!input.newDate) return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: 'newDate is required' };
    if (!input.reason) return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: 'reason is required' };

    var newShift = input.newShift || occ.shift || 'default';
    var newStartTime = input.newStartTime !== undefined ? input.newStartTime : occ.startTime;
    var clash = store.occurrences.some(function (o) {
      return o.id !== occ.id && o.venueId === occ.venueId && o.date === input.newDate && (o.shift || 'default') === newShift && o.status !== 'CANCELLED';
    });
    if (clash) return { ok: false, errorCode: 'OCCURRENCE_ALREADY_EXISTS', errorDetails: 'target slot already occupied by another occurrence' };

    var previousDate = occ.date;
    var previousShift = occ.shift;
    var updated = Object.assign({}, occ, { date: input.newDate, shift: newShift, startTime: newStartTime, updatedAt: ctx.now });
    var nextOccurrences = store.occurrences.map(function (o) {
      return o.id === occ.id ? updated : o;
    });
    var nextStore = Object.assign({}, store, { occurrences: nextOccurrences });
    return {
      ok: true,
      data: { occurrence: updated, previousDate: previousDate, previousShift: previousShift, reason: input.reason, requestedBy: input.requestedBy || null },
      createdIds: [],
      affectedIds: [occ.id],
      nextStore: nextStore
    };
  }

  function coreCreateVenueReceivable(store, input, commandId, ctx) {
    void commandId;
    var occ = findById(store.occurrences, input.occurrenceId);
    if (!occ) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'occurrenceId not found' };
    if (occ.status === 'CANCELLED') return { ok: false, errorCode: 'INVALID_STATE_TRANSITION', errorDetails: 'occurrence is CANCELLED' };
    if (!(Number(input.amountCents) > 0)) return { ok: false, errorCode: 'INVALID_AMOUNT', errorDetails: 'amountCents must be > 0' };
    var existing = store.venueReceivables.some(function (r) {
      return r.occurrenceId === input.occurrenceId;
    });
    if (existing) return { ok: false, errorCode: 'RECEIVABLE_ALREADY_EXISTS', errorDetails: 'a receivable already exists for this occurrence' };

    var id = ctx.idGen();
    var receivable = {
      id: id,
      occurrenceId: input.occurrenceId,
      amountCents: input.amountCents,
      currency: normalizeCurrency(input.currency),
      status: 'OPEN',
      dueDate: input.dueDate || null,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId
    };
    var nextStore = Object.assign({}, store, { venueReceivables: store.venueReceivables.concat([receivable]) });
    return { ok: true, data: receivable, createdIds: [id], affectedIds: [], nextStore: nextStore };
  }

  function payableKey(sourceType, sourceId, payeeId, purpose) {
    return [sourceType, sourceId || '', payeeId, purpose].join('::');
  }

  function coreCreatePayable(store, input, commandId, ctx) {
    void commandId;
    if (!input.payeeId) return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: 'payeeId is required' };
    if (!input.purpose) return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: 'purpose is required' };
    if (!(Number(input.amountCents) >= 0)) return { ok: false, errorCode: 'INVALID_AMOUNT', errorDetails: 'amountCents must be >= 0' };
    if (input.amountCents === 0 && input.purpose !== 'OWNER_WORK_RECORD') {
      return { ok: false, errorCode: 'INVALID_AMOUNT', errorDetails: 'amountCents=0 only allowed for OWNER_WORK_RECORD' };
    }
    var key = payableKey(input.sourceType, input.sourceId, input.payeeId, input.purpose);
    var dup = store.payables.some(function (p) {
      return payableKey(p.sourceType, p.sourceId, p.payeeId, p.purpose) === key;
    });
    if (dup) return { ok: false, errorCode: 'DUPLICATE_IDEMPOTENCY_KEY', errorDetails: 'a payable already exists for this (sourceType,sourceId,payeeId,purpose)' };

    var id = ctx.idGen();
    var payable = {
      id: id,
      sourceType: input.sourceType,
      sourceId: input.sourceId || null,
      payeeType: input.payeeType || 'PAYEE',
      payeeId: input.payeeId,
      purpose: input.purpose,
      amountCents: input.amountCents,
      currency: normalizeCurrency(input.currency),
      status: 'PENDING',
      dueDate: input.dueDate || null,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId
    };
    var nextStore = Object.assign({}, store, { payables: store.payables.concat([payable]) });
    return { ok: true, data: payable, createdIds: [id], affectedIds: [], nextStore: nextStore };
  }

  function coreRecordPayment(store, input, commandId, ctx) {
    void commandId;
    if (input.direction !== 'INFLOW' && input.direction !== 'OUTFLOW') {
      return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: 'direction must be INFLOW or OUTFLOW' };
    }
    if (!(Number(input.amountCents) > 0)) return { ok: false, errorCode: 'INVALID_AMOUNT', errorDetails: 'amountCents must be > 0' };
    if (!input.paymentDate) return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: 'paymentDate is required' };

    var id = ctx.idGen();
    var payment = {
      id: id,
      direction: input.direction,
      amountCents: input.amountCents,
      currency: normalizeCurrency(input.currency),
      method: input.method || null,
      account: input.account || null,
      paymentDate: input.paymentDate,
      reference: input.reference || null,
      status: 'PENDING',
      reversalOfPaymentId: null,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId
    };
    var nextStore = Object.assign({}, store, { payments: store.payments.concat([payment]) });
    return { ok: true, data: payment, createdIds: [id], affectedIds: [], nextStore: nextStore };
  }

  function coreConfirmPayment(store, input, commandId, ctx) {
    void commandId;
    var p = findById(store.payments, input.paymentId);
    if (!p) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'paymentId not found' };
    if (p.status !== 'PENDING') return { ok: false, errorCode: 'INVALID_STATE_TRANSITION', errorDetails: 'payment is not PENDING' };

    var updated = Object.assign({}, p, { status: 'CONFIRMED', updatedAt: ctx.now });
    var ledgerId = ctx.idGen();
    var ledgerEntry = {
      id: ledgerId,
      postingType: p.direction === 'INFLOW' ? 'CASH_IN' : 'CASH_OUT',
      direction: p.direction,
      amountCents: p.amountCents,
      currency: p.currency,
      sourceType: 'PAYMENT',
      sourceId: p.id,
      reversalOfEntryId: null,
      createdAt: ctx.now,
      createdBy: ctx.actorId
    };
    var nextPayments = store.payments.map(function (x) {
      return x.id === p.id ? updated : x;
    });
    var nextStore = Object.assign({}, store, { payments: nextPayments, ownerLedgerEntries: store.ownerLedgerEntries.concat([ledgerEntry]) });
    return { ok: true, data: { payment: updated, ledgerEntry: ledgerEntry }, createdIds: [ledgerId], affectedIds: [p.id], nextStore: nextStore };
  }

  function coreFailPayment(store, input, commandId, ctx) {
    void commandId;
    var p = findById(store.payments, input.paymentId);
    if (!p) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'paymentId not found' };
    if (p.status !== 'PENDING') return { ok: false, errorCode: 'INVALID_STATE_TRANSITION', errorDetails: 'payment is not PENDING' };

    var updated = Object.assign({}, p, { status: 'FAILED', updatedAt: ctx.now, failReason: input.reason || null });
    var nextPayments = store.payments.map(function (x) {
      return x.id === p.id ? updated : x;
    });
    var nextStore = Object.assign({}, store, { payments: nextPayments });
    return { ok: true, data: updated, createdIds: [], affectedIds: [p.id], nextStore: nextStore };
  }

  function coreAllocatePayment(store, input, commandId, ctx) {
    void commandId;
    var payment = findById(store.payments, input.paymentId);
    if (!payment) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'paymentId not found' };
    if (payment.status !== 'CONFIRMED') return { ok: false, errorCode: 'PAYMENT_NOT_CONFIRMED', errorDetails: 'payment is not CONFIRMED' };
    if (input.targetType !== 'VENUE_RECEIVABLE' && input.targetType !== 'PAYABLE') {
      return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'unsupported targetType for local services (INVOICE lives in the commercial/Supabase channel)' };
    }
    var info = targetBalanceInfo(store, input.targetType, input.targetId);
    if (!info) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'target not found' };
    if (info.target.status === 'VOID') return { ok: false, errorCode: 'TARGET_VOID', errorDetails: 'target is VOID' };
    if (info.target.status === 'PAID') {
      return { ok: false, errorCode: input.targetType === 'VENUE_RECEIVABLE' ? 'RECEIVABLE_ALREADY_PAID' : 'PAYABLE_ALREADY_PAID', errorDetails: 'target already fully paid' };
    }
    if (payment.currency !== info.target.currency) return { ok: false, errorCode: 'CURRENCY_MISMATCH', errorDetails: 'payment/target currency differ' };
    if (!(Number(input.amountCents) > 0)) return { ok: false, errorCode: 'INVALID_AMOUNT', errorDetails: 'amountCents must be > 0' };

    var paymentApplied = sumAllocations(
      store,
      function (a) {
        return a.paymentId === payment.id;
      },
      'APPLY'
    );
    var paymentReversed = sumAllocations(
      store,
      function (a) {
        return a.paymentId === payment.id;
      },
      'REVERSE'
    );
    var paymentAvailable = payment.amountCents - (paymentApplied - paymentReversed);
    if (input.amountCents > paymentAvailable) return { ok: false, errorCode: 'PAYMENT_OVERALLOCATED', errorDetails: 'exceeds unallocated payment amount' };
    if (input.amountCents > info.balanceCents) return { ok: false, errorCode: 'PAYMENT_OVERALLOCATED', errorDetails: 'exceeds target outstanding balance' };

    var allocId = ctx.idGen();
    var allocation = {
      id: allocId,
      paymentId: payment.id,
      targetType: input.targetType,
      targetId: input.targetId,
      amountCents: input.amountCents,
      direction: 'APPLY',
      reversalOfAllocationId: null,
      createdAt: ctx.now,
      createdBy: ctx.actorId
    };

    var newBalance = info.balanceCents - input.amountCents;
    var kind = input.targetType === 'VENUE_RECEIVABLE' ? 'RECEIVABLE' : 'PAYABLE';
    var newStatus = deriveTargetStatus(kind, newBalance, info.totalAmountCents, info.target.status);
    var updatedTarget = Object.assign({}, info.target, { status: newStatus, updatedAt: ctx.now });

    var nextStore = Object.assign({}, store, { paymentAllocations: store.paymentAllocations.concat([allocation]) });
    applyTargetUpdate(nextStore, input.targetType, updatedTarget);

    return {
      ok: true,
      data: { allocation: allocation, target: updatedTarget },
      createdIds: [allocId],
      affectedIds: [updatedTarget.id],
      nextStore: nextStore
    };
  }

  function coreReverseAllocation(store, input, commandId, ctx) {
    void commandId;
    var original = store.paymentAllocations.find(function (a) {
      return a.id === input.allocationId && a.direction === 'APPLY';
    });
    if (!original) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'allocationId not found' };

    var alreadyReversed = sumAllocations(
      store,
      function (a) {
        return a.reversalOfAllocationId === original.id;
      },
      'REVERSE'
    );
    var remaining = original.amountCents - alreadyReversed;
    if (remaining <= 0) return { ok: false, errorCode: 'ALLOCATION_ALREADY_REVERSED', errorDetails: 'allocation already fully reversed' };

    var amountToReverse = input.amountCents != null ? input.amountCents : remaining;
    if (!(amountToReverse > 0)) return { ok: false, errorCode: 'INVALID_AMOUNT', errorDetails: 'amountCents must be > 0' };
    if (amountToReverse > remaining) return { ok: false, errorCode: 'PAYMENT_OVERALLOCATED', errorDetails: 'cannot reverse more than the remaining applied amount' };

    var revId = ctx.idGen();
    var reversal = {
      id: revId,
      paymentId: original.paymentId,
      targetType: original.targetType,
      targetId: original.targetId,
      amountCents: amountToReverse,
      direction: 'REVERSE',
      reversalOfAllocationId: original.id,
      createdAt: ctx.now,
      createdBy: ctx.actorId
    };

    var info = targetBalanceInfo(store, original.targetType, original.targetId);
    var newBalance = info.balanceCents + amountToReverse;
    var kind = original.targetType === 'VENUE_RECEIVABLE' ? 'RECEIVABLE' : 'PAYABLE';
    var newStatus = deriveTargetStatus(kind, newBalance, info.totalAmountCents, info.target.status);
    var updatedTarget = Object.assign({}, info.target, { status: newStatus, updatedAt: ctx.now });

    var nextStore = Object.assign({}, store, { paymentAllocations: store.paymentAllocations.concat([reversal]) });
    applyTargetUpdate(nextStore, original.targetType, updatedTarget);

    return {
      ok: true,
      data: { reversal: reversal, target: updatedTarget },
      createdIds: [revId],
      affectedIds: [updatedTarget.id],
      nextStore: nextStore
    };
  }

  function remainingConfirmedAmount(store, paymentId) {
    var original = findById(store.payments, paymentId);
    if (!original) return null;
    var reversedConfirmed = store.payments
      .filter(function (p) {
        return p.reversalOfPaymentId === paymentId && p.status === 'CONFIRMED';
      })
      .reduce(function (sum, p) {
        return sum + p.amountCents;
      }, 0);
    return { original: original, remaining: original.amountCents - reversedConfirmed };
  }

  function coreRecordRefund(store, input, commandId, ctx) {
    void commandId;
    var info = remainingConfirmedAmount(store, input.originalPaymentId);
    if (!info) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'originalPaymentId not found' };
    if (info.original.status !== 'CONFIRMED') return { ok: false, errorCode: 'PAYMENT_NOT_CONFIRMED', errorDetails: 'original payment is not CONFIRMED' };
    if (!(Number(input.amountCents) > 0)) return { ok: false, errorCode: 'INVALID_AMOUNT', errorDetails: 'amountCents must be > 0' };
    if (input.amountCents > info.remaining) {
      return { ok: false, errorCode: 'REFUND_EXCEEDS_AVAILABLE_AMOUNT', errorDetails: 'exceeds remaining confirmed amount (' + info.remaining + ')' };
    }

    var allocationToReverse = null;
    if (input.targetAllocationId) {
      allocationToReverse = store.paymentAllocations.find(function (a) {
        return a.id === input.targetAllocationId && a.direction === 'APPLY' && a.paymentId === info.original.id;
      });
      if (!allocationToReverse) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'targetAllocationId not found for this payment' };
    }

    var refundId = ctx.idGen();
    var refundPayment = {
      id: refundId,
      direction: info.original.direction === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
      amountCents: input.amountCents,
      currency: info.original.currency,
      method: 'REFUND',
      account: null,
      paymentDate: input.paymentDate || ctx.now.slice(0, 10),
      reference: input.reason || null,
      status: 'CONFIRMED',
      reversalOfPaymentId: info.original.id,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId
    };
    var ledgerId = ctx.idGen();
    var ledgerEntry = {
      id: ledgerId,
      postingType: 'REFUND',
      direction: refundPayment.direction,
      amountCents: input.amountCents,
      currency: refundPayment.currency,
      sourceType: 'PAYMENT',
      sourceId: refundId,
      reversalOfEntryId: null,
      createdAt: ctx.now,
      createdBy: ctx.actorId
    };

    var nextStore = Object.assign({}, store, {
      payments: store.payments.concat([refundPayment]),
      ownerLedgerEntries: store.ownerLedgerEntries.concat([ledgerEntry])
    });
    var createdIds = [refundId, ledgerId];
    var affectedIds = [];

    if (allocationToReverse) {
      var alreadyReversedOnAlloc = sumAllocations(
        store,
        function (a) {
          return a.reversalOfAllocationId === allocationToReverse.id;
        },
        'REVERSE'
      );
      var remainingOnAlloc = allocationToReverse.amountCents - alreadyReversedOnAlloc;
      var toReverse = Math.min(remainingOnAlloc, input.amountCents);
      if (toReverse > 0) {
        var revId = ctx.idGen();
        var reversal = {
          id: revId,
          paymentId: allocationToReverse.paymentId,
          targetType: allocationToReverse.targetType,
          targetId: allocationToReverse.targetId,
          amountCents: toReverse,
          direction: 'REVERSE',
          reversalOfAllocationId: allocationToReverse.id,
          createdAt: ctx.now,
          createdBy: ctx.actorId
        };
        var info2 = targetBalanceInfo(store, allocationToReverse.targetType, allocationToReverse.targetId);
        var newBalance = info2.balanceCents + toReverse;
        var kind = allocationToReverse.targetType === 'VENUE_RECEIVABLE' ? 'RECEIVABLE' : 'PAYABLE';
        var newStatus = deriveTargetStatus(kind, newBalance, info2.totalAmountCents, info2.target.status);
        var updatedTarget = Object.assign({}, info2.target, { status: newStatus, updatedAt: ctx.now });

        nextStore.paymentAllocations = store.paymentAllocations.concat([reversal]);
        applyTargetUpdate(nextStore, allocationToReverse.targetType, updatedTarget);

        createdIds.push(revId);
        affectedIds.push(updatedTarget.id);
      }
    }

    return { ok: true, data: { refundPayment: refundPayment, ledgerEntry: ledgerEntry }, createdIds: createdIds, affectedIds: affectedIds, nextStore: nextStore };
  }

  function coreRecordOwnerPayout(store, input, commandId, ctx) {
    void commandId;
    var payable = findById(store.payables, input.payableId);
    if (!payable) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'payableId not found' };
    if (payable.status === 'VOID') return { ok: false, errorCode: 'TARGET_VOID', errorDetails: 'payable is VOID' };
    if (payable.status === 'PAID') return { ok: false, errorCode: 'PAYABLE_ALREADY_PAID', errorDetails: 'payable already fully paid' };
    if (!(Number(input.amountCents) > 0)) return { ok: false, errorCode: 'INVALID_AMOUNT', errorDetails: 'amountCents must be > 0' };
    var currency = input.currency != null ? normalizeCurrency(input.currency) : payable.currency;
    if (currency !== payable.currency) return { ok: false, errorCode: 'CURRENCY_MISMATCH', errorDetails: 'payout/payable currency differ' };

    var info = targetBalanceInfo(store, 'PAYABLE', payable.id);
    if (input.amountCents > info.balanceCents) return { ok: false, errorCode: 'PAYMENT_OVERALLOCATED', errorDetails: 'exceeds payable outstanding balance' };
    if (!input.paymentDate) return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: 'paymentDate is required' };

    var paymentId = ctx.idGen();
    var payment = {
      id: paymentId,
      direction: 'OUTFLOW',
      amountCents: input.amountCents,
      currency: currency,
      method: input.method || null,
      account: null,
      paymentDate: input.paymentDate,
      reference: null,
      status: 'CONFIRMED',
      reversalOfPaymentId: null,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId
    };
    var allocId = ctx.idGen();
    var allocation = {
      id: allocId,
      paymentId: paymentId,
      targetType: 'PAYABLE',
      targetId: payable.id,
      amountCents: input.amountCents,
      direction: 'APPLY',
      reversalOfAllocationId: null,
      createdAt: ctx.now,
      createdBy: ctx.actorId
    };
    var ledgerId = ctx.idGen();
    var ledgerEntry = {
      id: ledgerId,
      postingType: 'CASH_OUT',
      direction: 'OUTFLOW',
      amountCents: input.amountCents,
      currency: currency,
      sourceType: 'PAYMENT',
      sourceId: paymentId,
      reversalOfEntryId: null,
      createdAt: ctx.now,
      createdBy: ctx.actorId
    };

    var newBalance = info.balanceCents - input.amountCents;
    var newStatus = deriveTargetStatus('PAYABLE', newBalance, info.totalAmountCents, payable.status);
    var updatedPayable = Object.assign({}, payable, { status: newStatus, updatedAt: ctx.now });

    var nextStore = Object.assign({}, store, {
      payments: store.payments.concat([payment]),
      paymentAllocations: store.paymentAllocations.concat([allocation]),
      ownerLedgerEntries: store.ownerLedgerEntries.concat([ledgerEntry]),
      payables: store.payables.map(function (p) {
        return p.id === updatedPayable.id ? updatedPayable : p;
      })
    });
    return {
      ok: true,
      data: { payment: payment, allocation: allocation, ledgerEntry: ledgerEntry, payable: updatedPayable },
      createdIds: [paymentId, allocId, ledgerId],
      affectedIds: [updatedPayable.id],
      nextStore: nextStore
    };
  }

  var VALID_RECONCILIATION_STATUSES = ['UNRECONCILED', 'MATCHED', 'EXCEPTION', 'RECONCILED'];

  function coreReconcilePayment(store, input, commandId, ctx) {
    void commandId;
    var payment = findById(store.payments, input.paymentId);
    if (!payment) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'paymentId not found' };

    var attemptUuid = input.attemptUuid || input.idempotencyKey;
    var status = input.status || 'UNRECONCILED';
    if (VALID_RECONCILIATION_STATUSES.indexOf(status) === -1) {
      return { ok: false, errorCode: 'MISSING_REQUIRED_FIELD', errorDetails: 'invalid reconciliation status' };
    }
    var conflict = store.reconciliations.some(function (r) {
      return r.paymentId === payment.id && r.attemptUuid === attemptUuid && (r.evidenceRef !== (input.evidenceRef || null) || r.status !== status);
    });
    if (conflict) return { ok: false, errorCode: 'RECONCILIATION_CONFLICT', errorDetails: 'attemptUuid already used with different data' };

    var id = ctx.idGen();
    var reconciliation = {
      id: id,
      paymentId: payment.id,
      attemptUuid: attemptUuid,
      evidenceRef: input.evidenceRef || null,
      status: status,
      reconciledBy: ctx.actorId,
      reconciledAt: status === 'RECONCILED' ? ctx.now : null,
      notes: input.notes || null,
      createdAt: ctx.now
    };
    var nextStore = Object.assign({}, store, { reconciliations: store.reconciliations.concat([reconciliation]) });
    return { ok: true, data: reconciliation, createdIds: [id], affectedIds: [], nextStore: nextStore };
  }

  function coreCancelOccurrence(store, input, commandId, ctx) {
    void commandId;
    var occ = findById(store.occurrences, input.occurrenceId);
    if (!occ) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'occurrenceId not found' };
    if (occ.status !== 'SCHEDULED') {
      return { ok: false, errorCode: 'INVALID_STATE_TRANSITION', errorDetails: 'only SCHEDULED occurrences may be cancelled' };
    }

    var receivable = store.venueReceivables.find(function (r) {
      return r.occurrenceId === occ.id;
    });
    var payablesForOcc = store.payables.filter(function (p) {
      return p.sourceType === 'OCCURRENCE' && p.sourceId === occ.id;
    });

    if (receivable && hasActiveAllocations(store, 'VENUE_RECEIVABLE', receivable.id)) {
      return { ok: false, errorCode: 'PARTIAL_FAILURE_REQUIRES_RECOVERY', errorDetails: 'receivable has active allocations; refund/adjust first' };
    }
    var payableWithMoney = payablesForOcc.find(function (p) {
      return hasActiveAllocations(store, 'PAYABLE', p.id);
    });
    if (payableWithMoney) {
      return { ok: false, errorCode: 'PARTIAL_FAILURE_REQUIRES_RECOVERY', errorDetails: 'payable has active allocations; refund/adjust first' };
    }

    var updatedOcc = Object.assign({}, occ, { status: 'CANCELLED', updatedAt: ctx.now });
    var nextStore = Object.assign({}, store, { occurrences: store.occurrences.map(function (o) { return o.id === occ.id ? updatedOcc : o; }) });
    var affectedIds = [occ.id];

    if (receivable && receivable.status !== 'VOID') {
      var updatedRec = Object.assign({}, receivable, { status: 'VOID', updatedAt: ctx.now });
      nextStore.venueReceivables = nextStore.venueReceivables.map(function (r) {
        return r.id === receivable.id ? updatedRec : r;
      });
      affectedIds.push(receivable.id);
    }
    payablesForOcc.forEach(function (p) {
      if (p.status !== 'VOID') {
        var updatedP = Object.assign({}, p, { status: 'VOID', updatedAt: ctx.now });
        nextStore.payables = nextStore.payables.map(function (x) {
          return x.id === p.id ? updatedP : x;
        });
        affectedIds.push(p.id);
      }
    });

    return { ok: true, data: { occurrence: updatedOcc }, createdIds: [], affectedIds: affectedIds, nextStore: nextStore };
  }

  function coreVoidReceivable(store, input, commandId, ctx) {
    void commandId;
    var r = findById(store.venueReceivables, input.receivableId);
    if (!r) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'receivableId not found' };
    if (r.status === 'VOID') return { ok: false, errorCode: 'TARGET_VOID', errorDetails: 'already VOID' };
    if (r.status === 'PAID') return { ok: false, errorCode: 'RECEIVABLE_ALREADY_PAID', errorDetails: 'cannot void a fully paid receivable' };
    if (hasActiveAllocations(store, 'VENUE_RECEIVABLE', r.id)) {
      return { ok: false, errorCode: 'PARTIAL_FAILURE_REQUIRES_RECOVERY', errorDetails: 'receivable has active allocations' };
    }
    var updated = Object.assign({}, r, { status: 'VOID', updatedAt: ctx.now });
    var nextStore = Object.assign({}, store, { venueReceivables: store.venueReceivables.map(function (x) { return x.id === r.id ? updated : x; }) });
    return { ok: true, data: updated, createdIds: [], affectedIds: [r.id], nextStore: nextStore };
  }

  function coreVoidPayable(store, input, commandId, ctx) {
    void commandId;
    var p = findById(store.payables, input.payableId);
    if (!p) return { ok: false, errorCode: 'TARGET_NOT_FOUND', errorDetails: 'payableId not found' };
    if (p.status === 'VOID') return { ok: false, errorCode: 'TARGET_VOID', errorDetails: 'already VOID' };
    if (p.status === 'PAID') return { ok: false, errorCode: 'PAYABLE_ALREADY_PAID', errorDetails: 'cannot void a fully paid payable' };
    if (hasActiveAllocations(store, 'PAYABLE', p.id)) {
      return { ok: false, errorCode: 'PARTIAL_FAILURE_REQUIRES_RECOVERY', errorDetails: 'payable has active allocations' };
    }
    var updated = Object.assign({}, p, { status: 'VOID', updatedAt: ctx.now });
    var nextStore = Object.assign({}, store, { payables: store.payables.map(function (x) { return x.id === p.id ? updated : x; }) });
    return { ok: true, data: updated, createdIds: [], affectedIds: [p.id], nextStore: nextStore };
  }

  /* ---------------------------------------------------------------------
   * Pure derived queries (§10 of the canonical doc) — never stored.
   * ------------------------------------------------------------------- */

  function queryReceivableBalance(store, receivableId) {
    var info = targetBalanceInfo(store, 'VENUE_RECEIVABLE', receivableId);
    return info ? info.balanceCents : null;
  }

  function queryPayableBalance(store, payableId) {
    var info = targetBalanceInfo(store, 'PAYABLE', payableId);
    return info ? info.balanceCents : null;
  }

  function queryUnallocatedPaymentAmount(store, paymentId) {
    var p = findById(store.payments, paymentId);
    if (!p) return null;
    var applied = sumAllocations(store, function (a) { return a.paymentId === paymentId; }, 'APPLY');
    var reversed = sumAllocations(store, function (a) { return a.paymentId === paymentId; }, 'REVERSE');
    return p.amountCents - (applied - reversed);
  }

  function queryPaymentEffectiveStatus(store, paymentId) {
    var p = findById(store.payments, paymentId);
    if (!p) return null;
    if (p.status !== 'CONFIRMED') return p.status;
    var reversedConfirmed = store.payments
      .filter(function (x) {
        return x.reversalOfPaymentId === paymentId && x.status === 'CONFIRMED';
      })
      .reduce(function (s, x) {
        return s + x.amountCents;
      }, 0);
    if (reversedConfirmed <= 0) return 'CONFIRMED';
    if (reversedConfirmed < p.amountCents) return 'PARTIALLY_REVERSED';
    if (reversedConfirmed === p.amountCents) return 'FULLY_REVERSED';
    return 'ANOMALY_OVERREVERSED';
  }

  function queryAllocationEffectiveStatus(store, allocationId) {
    var a = store.paymentAllocations.find(function (x) {
      return x.id === allocationId && x.direction === 'APPLY';
    });
    if (!a) return null;
    var reversed = sumAllocations(store, function (x) { return x.reversalOfAllocationId === allocationId; }, 'REVERSE');
    if (reversed <= 0) return 'ACTIVE';
    if (reversed < a.amountCents) return 'PARTIALLY_REVERSED';
    return 'FULLY_REVERSED';
  }

  function queryAccountsReceivable(store) {
    return store.venueReceivables
      .filter(function (r) {
        return r.status !== 'VOID' && r.status !== 'PAID';
      })
      .reduce(function (s, r) {
        return s + (queryReceivableBalance(store, r.id) || 0);
      }, 0);
  }

  function queryAccountsPayable(store) {
    return store.payables
      .filter(function (p) {
        return p.status !== 'VOID' && p.status !== 'PAID';
      })
      .reduce(function (s, p) {
        return s + (queryPayableBalance(store, p.id) || 0);
      }, 0);
  }

  function queryCashInflow(store, fromDate, toDate) {
    return store.payments
      .filter(function (p) {
        return p.direction === 'INFLOW' && p.status === 'CONFIRMED' && (!fromDate || p.paymentDate >= fromDate) && (!toDate || p.paymentDate <= toDate);
      })
      .reduce(function (s, p) {
        return s + p.amountCents;
      }, 0);
  }

  function queryCashOutflow(store, fromDate, toDate) {
    return store.payments
      .filter(function (p) {
        return p.direction === 'OUTFLOW' && p.status === 'CONFIRMED' && (!fromDate || p.paymentDate >= fromDate) && (!toDate || p.paymentDate <= toDate);
      })
      .reduce(function (s, p) {
        return s + p.amountCents;
      }, 0);
  }

  function queryNetCash(store, fromDate, toDate) {
    return queryCashInflow(store, fromDate, toDate) - queryCashOutflow(store, fromDate, toDate);
  }

  /* ---------------------------------------------------------------------
   * Public factory
   * ------------------------------------------------------------------- */

  function createLocalFinancialServices() {
    return {
      createStore: createStore,
      commands: {
        createVenue: function (store, input) {
          return runCommand(store, 'createVenue', input, coreCreateVenue);
        },
        createVenueAgreement: function (store, input) {
          return runCommand(store, 'createVenueAgreement', input, coreCreateVenueAgreement);
        },
        createOccurrenceWithPfr: function (store, input) {
          return runCommand(store, 'createOccurrenceWithPfr', input, coreCreateOccurrenceWithPfr);
        },
        rescheduleOccurrence: function (store, input) {
          return runCommand(store, 'rescheduleOccurrence', input, coreRescheduleOccurrence);
        },
        createVenueReceivable: function (store, input) {
          return runCommand(store, 'createVenueReceivable', input, coreCreateVenueReceivable);
        },
        createPayable: function (store, input) {
          return runCommand(store, 'createPayable', input, coreCreatePayable);
        },
        recordPayment: function (store, input) {
          return runCommand(store, 'recordPayment', input, coreRecordPayment);
        },
        confirmPayment: function (store, input) {
          return runCommand(store, 'confirmPayment', input, coreConfirmPayment);
        },
        failPayment: function (store, input) {
          return runCommand(store, 'failPayment', input, coreFailPayment);
        },
        allocatePayment: function (store, input) {
          return runCommand(store, 'allocatePayment', input, coreAllocatePayment);
        },
        reverseAllocation: function (store, input) {
          return runCommand(store, 'reverseAllocation', input, coreReverseAllocation);
        },
        recordRefund: function (store, input) {
          return runCommand(store, 'recordRefund', input, coreRecordRefund);
        },
        recordOwnerPayout: function (store, input) {
          return runCommand(store, 'recordOwnerPayout', input, coreRecordOwnerPayout);
        },
        reconcilePayment: function (store, input) {
          return runCommand(store, 'reconcilePayment', input, coreReconcilePayment);
        },
        cancelOccurrence: function (store, input) {
          return runCommand(store, 'cancelOccurrence', input, coreCancelOccurrence);
        },
        voidReceivable: function (store, input) {
          return runCommand(store, 'voidReceivable', input, coreVoidReceivable);
        },
        voidPayable: function (store, input) {
          return runCommand(store, 'voidPayable', input, coreVoidPayable);
        }
      },
      queries: {
        getReceivableBalance: queryReceivableBalance,
        getPayableBalance: queryPayableBalance,
        getUnallocatedPaymentAmount: queryUnallocatedPaymentAmount,
        getPaymentEffectiveStatus: queryPaymentEffectiveStatus,
        getAllocationEffectiveStatus: queryAllocationEffectiveStatus,
        getAccountsReceivable: queryAccountsReceivable,
        getAccountsPayable: queryAccountsPayable,
        getCashInflow: queryCashInflow,
        getCashOutflow: queryCashOutflow,
        getNetCash: queryNetCash
      }
    };
  }

  var api = { createLocalFinancialServices: createLocalFinancialServices };

  global.MDJFinancialLocalServices = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
