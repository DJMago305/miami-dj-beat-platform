/**
 * TICKET-012 — Legacy Import Bridge — Fase 1
 * Pure orchestrator: turns the readonly output of mdj-financial-legacy-adapter.js
 * into a deterministic, idempotent, atomic-per-step import against the closed
 * canonical command layer (TICKET-009, wrapped by TICKET-010).
 *
 * Implements EXACTLY the design contract approved by the Product Owner
 * (TICKET-012 Fase 1, v3 — definitivo). No functional deviation from that
 * contract is permitted without returning to documentary review first.
 *
 * Does NOT modify, import from, or depend on mdj-financial-local-services.js,
 * mdj-financial-domain-events.js, mdj-local-projection-engine.js, or
 * mdj-financial-legacy-adapter.js. The caller supplies:
 *   - `wrappedServices`: the object returned by
 *     MDJFinancialDomainEvents.createDomainEventsOutbox(MDJFinancialLocalServices)
 *   - `adapterOutput`: the object returned by adapter.mapStore(rawStore)
 * This module never reaches into localStorage, document, fetch, Supabase, SQL,
 * UI, or any of the closed modules directly — it only accepts them as data /
 * objects passed in by the caller.
 *
 * Scope boundary (declared, not hidden): occurrences whose legacy status is
 * anything other than 'SCHEDULED' (e.g. 'CANCELLED', 'COMPLETED') are NOT
 * planned as steps in this phase — properly sequencing cancelOccurrence's
 * cascade (auto-VOID of a linked receivable) against a not-yet-created
 * receivable is a real cross-step ordering question that was not covered by
 * the approved contract, and is deliberately left as an ImportCandidate
 * (UNREPRESENTABLE_STATUS) rather than improvised here.
 */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------
   * Generic helpers (pure, self-contained — same house pattern as
   * T009/T010/T011)
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

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function asArray(v) {
    return Array.isArray(v) ? v : [];
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

  function stableHash(parts) {
    return hashString('sh::' + stableStringify(parts));
  }

  /** Normalization for dedupe fingerprints (contract §7): undefined/null/
   * whitespace-only string collapse to null (comparable), strings are
   * trimmed, everything else passes through unchanged. */
  function normalize(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') {
      var trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  }

  /* ---------------------------------------------------------------------
   * Deterministic identity — plannedEntityId / idempotencyKey (contract §2-4)
   * ------------------------------------------------------------------- */

  function plannedEntityId(sourceCollection, legacySourceId, entityKind) {
    return 'legacy-import-entity::' + stableHash([sourceCollection, legacySourceId || 'NO_STABLE_ID', entityKind]);
  }

  function idempotencyKeyFor(sourceCollection, legacySourceId, commandType) {
    return 'legacy-import::' + stableHash(['cmd', sourceCollection, legacySourceId || 'NO_STABLE_ID', commandType]);
  }

  /* `plannedEntityIds` (used for outputBindings and the AJUSTE 1
   * stored-vs-planned comparison against T009's `createdIds`) covers only
   * the REAL entity ids a coreFn itself mints — verified by literal reading
   * of mdj-financial-local-services.js. It deliberately does NOT try to
   * predict the total number of ctx.idGen() calls across the whole pipeline:
   * T009's runCommand envelope also mints an `attemptCommandId` on every
   * call, and T010's wrapCommand (verified by literal reading of
   * mdj-financial-domain-events.js resolveEventCtx/wrapCommand) mints a
   * domainEvent.id AND an outboxRow.id per emitted event from the SAME
   * injected idGenerator — a count that varies by how many events a given
   * command's deriver produces. Rather than hand-count that across two
   * independently-evolving modules (fragile — a future deriver change would
   * silently break a fixed-length assumption here), makeSequentialIdGen is
   * open-ended: it never throws, and synthesizes additional deterministic
   * ids beyond `plannedEntityIds` on demand. Those overflow ids are never
   * bound to anything downstream, so their exact values don't matter — only
   * that they are deterministic (stable across replay-vs-first-run) and
   * distinct from the meaningful ones. */
  function commandIdentity(sourceCollection, legacySourceId, commandType, entityKinds) {
    var entityIds = entityKinds.map(function (kind) { return plannedEntityId(sourceCollection, legacySourceId, kind); });
    return {
      idempotencyKey: idempotencyKeyFor(sourceCollection, legacySourceId, commandType),
      plannedEntityIds: entityIds
    };
  }

  /** Deterministic id generator: yields `plannedEntityIds[0]`, [1], ... in
   * order for the first calls, matching what T009's coreFn itself mints
   * (used for outputBindings/AJUSTE 1). The FIRST call of any command is
   * actually T009's own attemptCommandId (never one of plannedEntityIds —
   * see commandIdentity's comment), and any call beyond
   * plannedEntityIds.length (T010's event/outbox ids) synthesizes a stable,
   * deterministic, unbound id.
   *
   * Overflow-id identity strength (audited, TICKET-012 Fase 1 conformance
   * pass): explicitly hashes stepId + commandType + idempotencyKey + the
   * 0-based consumption index together, rather than relying on
   * (sourceCollection, legacySourceId) alone being an equivalent entropy
   * source — the caller (runStep) supplies `stepId`/`idempotencyKey`
   * directly so this guarantee is self-evident from the formula itself, not
   * an implicit argument about hash-input equivalence. Since idempotencyKey
   * already differs per (sourceCollection, legacySourceId, commandType) and
   * the index always differs within one generator's lifetime, two different
   * commands (anywhere in the plan) can never produce the same overflow id,
   * and neither can two different calls within the same command. */
  function makeSequentialIdGen(stepId, idempotencyKey, commandType, plannedEntityIds) {
    var attemptComponent = 'legacy-import-entity::' + stableHash([stepId, idempotencyKey, commandType, 'attempt']);
    var sequence = [attemptComponent].concat(plannedEntityIds);
    var i = 0;
    return function () {
      var id = i < sequence.length ? sequence[i] : 'legacy-import-overflow::' + stableHash([stepId, commandType, idempotencyKey, i]);
      i++;
      return id;
    };
  }

  /* ---------------------------------------------------------------------
   * Fingerprints per entity kind (contract §7) — specific fields, explicit
   * normalization, never cross-collection, never positional.
   * ------------------------------------------------------------------- */

  function venueFingerprint(rec) {
    return stableHash([normalize(rec.name), normalize(rec.address)]);
  }
  function agreementFingerprint(rec) {
    return stableHash([normalize(rec.venueId), normalize(rec.title), normalize(rec.effectiveFrom)]);
  }
  function occurrenceFingerprint(rec) {
    return stableHash([normalize(rec.venueId), normalize(rec.date), normalize(rec.shift), normalize(rec.startTime)]);
  }
  function paymentFingerprint(rec) {
    return stableHash([normalize(rec.direction), normalize(rec.amountCents), normalize(rec.currency), normalize(rec.paymentDate), normalize(rec.method), normalize(rec.reference)]);
  }
  function receivableFingerprint(rec) {
    return stableHash([normalize(rec.occurrenceId), normalize(rec.amountCents), normalize(rec.currency), normalize(rec.dueDate)]);
  }

  /* ---------------------------------------------------------------------
   * Result classification (contract §5-6)
   * ------------------------------------------------------------------- */

  var ANTICIPATED_ERROR_CODES = ['DUPLICATE_IDEMPOTENCY_KEY'];

  function classifyCommandResult(result) {
    if (result.ok === true) return result.idempotentReplay ? 'REPLAY' : 'NEW';
    if (ANTICIPATED_ERROR_CODES.indexOf(result.errorCode) !== -1) return 'CONFLICT';
    return 'UNEXPECTED';
  }

  /* =========================================================================
   * PLANNING — buildImportPlan (pure, no store, no commands, no idGenerator)
   * ======================================================================= */

  function makeCandidate(reason, sourceCollection, legacySourceId, wouldBeCommandSequence, legacyEvidence, extra) {
    return Object.assign(
      {
        candidateId: 'cand::' + stableHash([reason, sourceCollection, legacySourceId || 'NO_STABLE_ID']),
        reason: reason,
        sourceCollection: sourceCollection,
        legacySourceId: legacySourceId != null ? legacySourceId : null,
        wouldBeCommandSequence: wouldBeCommandSequence || null,
        legacyEvidence: deepCloneJsonSafe(legacyEvidence || null)
      },
      extra || {}
    );
  }

  function makeRejection(sourceCollection, legacySourceId, reason, legacyEvidence) {
    return {
      sourceCollection: sourceCollection,
      legacySourceId: legacySourceId != null ? legacySourceId : null,
      reason: reason,
      legacyEvidence: deepCloneJsonSafe(legacyEvidence || null)
    };
  }

  function isIndexFallback(rec) {
    return rec && rec.legacy && rec.legacy.syntheticIdStability === 'INDEX_FALLBACK';
  }

  /* --- Venues --- */
  function planVenues(canonical) {
    var steps = [];
    var candidates = [];
    asArray(canonical.venues).forEach(function (v) {
      if (isIndexFallback(v)) {
        candidates.push(makeCandidate('UNSTABLE_SYNTHETIC_ID', 'venues', v.id, null, v));
        return;
      }
      if (!v.name || typeof v.name !== 'string') {
        /* coreCreateVenue requires a non-empty string name; the adapter
         * itself allows name:null through (with its own warning) rather
         * than discarding the record — this bridge must not let that reach
         * T009 at execution time as an unanticipated MISSING_REQUIRED_FIELD. */
        candidates.push(makeCandidate('MISSING_VENUE_NAME', 'venues', v.id, null, v));
        return;
      }
      var stepId = plannedEntityId('venues', v.id, 'step');
      var identity = commandIdentity('venues', v.id, 'createVenue', ['venue']);
      steps.push({
        stepId: stepId,
        sourceCollection: 'venues',
        legacySourceId: v.id,
        dependsOnStepIds: [],
        outputBindings: { venueId: identity.plannedEntityIds[0] },
        fingerprint: venueFingerprint(v),
        commandSequence: [
          {
            commandType: 'createVenue',
            idempotencyKey: identity.idempotencyKey,
            plannedEntityIds: identity.plannedEntityIds,
            input: { name: v.name, address: v.address, contactName: v.contactName, contactPhone: v.contactPhone, contactEmail: v.contactEmail }
          }
        ],
        legacyEvidence: v
      });
    });
    return { steps: steps, candidates: candidates };
  }

  /* --- Venue agreements --- */
  function planAgreements(canonical, venueStepsByLegacyId) {
    var steps = [];
    var candidates = [];
    asArray(canonical.venueAgreements).forEach(function (a) {
      if (isIndexFallback(a)) {
        candidates.push(makeCandidate('UNSTABLE_SYNTHETIC_ID', 'agreements', a.id, null, a));
        return;
      }
      var venueStep = a.venueId != null ? venueStepsByLegacyId[a.venueId] : null;
      if (!venueStep) {
        candidates.push(makeCandidate('UNRESOLVED_VENUE_DEPENDENCY', 'agreements', a.id, null, a));
        return;
      }
      var rateByDayKeys = isPlainObject(a.rateByDay) ? Object.keys(a.rateByDay) : [];
      var rateByDayValid = rateByDayKeys.length > 0 && rateByDayKeys.every(function (k) { return Number(a.rateByDay[k]) > 0; });
      if (!rateByDayValid) {
        /* coreCreateVenueAgreement requires a non-empty rateByDay with every
         * value > 0; the adapter defaults a missing/invalid rateByDay to {}
         * rather than discarding the record. */
        candidates.push(makeCandidate('INVALID_RATE_BY_DAY', 'agreements', a.id, null, a));
        return;
      }
      if (a.effectiveFrom && a.effectiveUntil && a.effectiveUntil < a.effectiveFrom) {
        candidates.push(makeCandidate('INVALID_EFFECTIVE_DATE_RANGE', 'agreements', a.id, null, a));
        return;
      }
      var stepId = plannedEntityId('agreements', a.id, 'step');
      var identity = commandIdentity('agreements', a.id, 'createVenueAgreement', ['agreement']);
      steps.push({
        stepId: stepId,
        sourceCollection: 'agreements',
        legacySourceId: a.id,
        dependsOnStepIds: [venueStep.stepId],
        outputBindings: { agreementId: identity.plannedEntityIds[0] },
        fingerprint: agreementFingerprint(a),
        commandSequence: [
          {
            commandType: 'createVenueAgreement',
            idempotencyKey: identity.idempotencyKey,
            plannedEntityIds: identity.plannedEntityIds,
            input: {
              venueId: venueStep.outputBindings.venueId,
              title: a.title,
              frequency: a.frequency,
              scheduledDays: a.scheduledDays,
              rateByDay: a.rateByDay,
              currency: a.currency,
              effectiveFrom: a.effectiveFrom,
              effectiveUntil: a.effectiveUntil
            }
          }
        ],
        legacyEvidence: a
      });
    });
    return { steps: steps, candidates: candidates };
  }

  /* --- Occurrences + PFR (compound step, single command call, 2 minted ids) --- */
  function planOccurrences(canonical, venueStepsByLegacyId, agreementStepsByLegacyId) {
    var steps = [];
    var candidates = [];
    /* DECISIÓN 2 (PO, TICKET-012 Fase 1 conformance pass): array position is
     * never dominance evidence. Group ALL PFRs by occurrenceId first; a
     * group of exactly 1 is usable normally, a group of >1 means NONE of
     * them are planned — every member becomes a DUPLICATE_PFR_CANDIDATE,
     * preserving references to the rest of the ambiguous set. The adapter's
     * own `duplicateForOccurrence` flag is deliberately NOT used to decide
     * a winner here (it only signals "seen before", which is itself an
     * array-position artifact of the adapter's own first-seen resolution —
     * this bridge makes its own, independent, position-blind decision). */
    var pfrGroupsByOccurrenceLegacyId = Object.create(null);
    asArray(canonical.performanceFinancialRecords).forEach(function (p) {
      if (p.occurrenceId == null) return;
      if (!pfrGroupsByOccurrenceLegacyId[p.occurrenceId]) pfrGroupsByOccurrenceLegacyId[p.occurrenceId] = [];
      pfrGroupsByOccurrenceLegacyId[p.occurrenceId].push(p);
    });
    var pfrByOccurrenceLegacyId = Object.create(null);
    Object.keys(pfrGroupsByOccurrenceLegacyId).forEach(function (occId) {
      var group = pfrGroupsByOccurrenceLegacyId[occId];
      if (group.length === 1) {
        pfrByOccurrenceLegacyId[occId] = group[0];
        return;
      }
      group.forEach(function (p) {
        var others = group.filter(function (x) { return x !== p; }).map(function (x) { return x.id; });
        candidates.push(makeCandidate('DUPLICATE_PFR_CANDIDATE', 'performanceFinancialRecords', p.id, null, p, { occurrenceId: occId, ambiguousSetLegacySourceIds: others }));
      });
    });

    asArray(canonical.occurrences).forEach(function (o) {
      if (isIndexFallback(o)) {
        candidates.push(makeCandidate('UNSTABLE_SYNTHETIC_ID', 'occurrences', o.id, null, o));
        return;
      }
      if (o.duplicateSlot) {
        /* the adapter already detected venueId+date+shift+startTime
         * collision (DUPLICATE_OCCURRENCE_SLOT warning) — planning this as a
         * step would let T009's own slot-clash check surface
         * OCCURRENCE_ALREADY_EXISTS at EXECUTION time, which is not an
         * anticipated per-step error code and would incorrectly roll back
         * the whole plan. Route to candidates instead, at planning time,
         * where it belongs. */
        candidates.push(makeCandidate('DUPLICATE_OCCURRENCE_SLOT', 'occurrences', o.id, null, o));
        return;
      }
      if (!o.date) {
        candidates.push(makeCandidate('MISSING_OCCURRENCE_DATE', 'occurrences', o.id, null, o));
        return;
      }
      if (o.status !== 'SCHEDULED') {
        candidates.push(makeCandidate('UNREPRESENTABLE_STATUS', 'occurrences', o.id, null, o, { legacyStatus: o.status }));
        return;
      }
      var venueStep = o.venueId != null ? venueStepsByLegacyId[o.venueId] : null;
      if (!venueStep) {
        candidates.push(makeCandidate('UNRESOLVED_VENUE_DEPENDENCY', 'occurrences', o.id, null, o));
        return;
      }
      var agreementStep = o.agreementId != null ? agreementStepsByLegacyId[o.agreementId] : null;
      var pfr = pfrByOccurrenceLegacyId[o.id];
      if (!pfr || pfr.rateAmountCents == null || !(pfr.rateAmountCents > 0)) {
        candidates.push(makeCandidate('MISSING_OR_INVALID_PFR', 'occurrences', o.id, null, { occurrence: o, pfr: pfr || null }));
        return;
      }
      if (isIndexFallback(pfr)) {
        candidates.push(makeCandidate('UNSTABLE_SYNTHETIC_ID', 'performanceFinancialRecords', pfr.id, null, pfr));
        return;
      }

      var stepId = plannedEntityId('occurrences', o.id, 'step');
      /* Occurrence and PFR have DISTINCT legacy identities (o.id vs pfr.id),
       * so commandIdentity()'s single-source-id shape doesn't fit — built
       * out manually here. */
      var occEntityId = plannedEntityId('occurrences', o.id, 'occurrence');
      var pfrEntityId = plannedEntityId('performanceFinancialRecords', pfr.id, 'pfr');
      var cmdKey = idempotencyKeyFor('occurrences', o.id, 'createOccurrenceWithPfr');
      var deps = [venueStep.stepId];
      if (agreementStep) deps.push(agreementStep.stepId);

      steps.push({
        stepId: stepId,
        sourceCollection: 'occurrences',
        legacySourceId: o.id,
        dependsOnStepIds: deps,
        outputBindings: { occurrenceId: occEntityId, pfrId: pfrEntityId },
        fingerprint: occurrenceFingerprint(o),
        commandSequence: [
          {
            commandType: 'createOccurrenceWithPfr',
            idempotencyKey: cmdKey,
            plannedEntityIds: [occEntityId, pfrEntityId],
            input: {
              venueId: venueStep.outputBindings.venueId,
              agreementId: agreementStep ? agreementStep.outputBindings.agreementId : null,
              assignedProfileId: o.assignedProfileId,
              date: o.date,
              shift: o.shift,
              startTime: o.startTime,
              rateAmountCents: pfr.rateAmountCents,
              currency: pfr.currency,
              expectedArtistPayoutCents: pfr.expectedArtistPayoutCents
            }
          }
        ],
        legacyEvidence: { occurrence: o, pfr: pfr }
      });
    });
    return { steps: steps, candidates: candidates };
  }

  /* --- Venue receivables (always created OPEN; PAID reconstruction only via
   * a verifiable link to a Payment step, attempted separately in
   * planReceivablePaymentLinks) --- */
  function planReceivables(canonical, occurrenceStepsByLegacyId) {
    var steps = [];
    var candidates = [];

    /* DECISIÓN 3 (PO, TICKET-012 Fase 1 conformance pass): array position is
     * never dominance evidence. Group ALL venueReceivables by occurrenceId
     * first (records with no occurrenceId can never collide with each
     * other, so each keys its own singleton group by its own id). A group
     * of exactly 1 proceeds through the normal per-record checks; a group
     * of >1 means NONE of them are planned — every member becomes a
     * DUPLICATE_RECEIVABLE_FOR_OCCURRENCE candidate, with no
     * winningLegacySourceId (there is no winner) and references to the
     * rest of the ambiguous set instead. */
    var groups = Object.create(null);
    asArray(canonical.venueReceivables).forEach(function (r) {
      var key = r.occurrenceId != null ? 'occ::' + r.occurrenceId : 'rid::' + r.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    Object.keys(groups).forEach(function (key) {
      var group = groups[key];
      if (group.length > 1) {
        group.forEach(function (r) {
          var others = group.filter(function (x) { return x !== r; }).map(function (x) { return x.id; });
          candidates.push(makeCandidate('DUPLICATE_RECEIVABLE_FOR_OCCURRENCE', 'venuePayments', r.id, null, r, { occurrenceId: r.occurrenceId, ambiguousSetLegacySourceIds: others }));
        });
        return;
      }

      var r = group[0];
      if (isIndexFallback(r)) {
        candidates.push(makeCandidate('UNSTABLE_SYNTHETIC_ID', 'venuePayments', r.id, null, r));
        return;
      }
      var occStep = r.occurrenceId != null ? occurrenceStepsByLegacyId[r.occurrenceId] : null;
      if (!occStep) {
        candidates.push(makeCandidate('UNRESOLVED_OCCURRENCE_DEPENDENCY', 'venuePayments', r.id, null, r));
        return;
      }
      if (r.amountCents == null || !(r.amountCents > 0)) {
        candidates.push(makeCandidate('INVALID_AMOUNT', 'venuePayments', r.id, null, r));
        return;
      }

      var stepId = plannedEntityId('venuePayments', r.id, 'step');
      var identity = commandIdentity('venuePayments', r.id, 'createVenueReceivable', ['receivable']);
      steps.push({
        stepId: stepId,
        sourceCollection: 'venuePayments',
        legacySourceId: r.id,
        dependsOnStepIds: [occStep.stepId],
        outputBindings: { receivableId: identity.plannedEntityIds[0] },
        fingerprint: receivableFingerprint(r),
        commandSequence: [
          {
            commandType: 'createVenueReceivable',
            idempotencyKey: identity.idempotencyKey,
            plannedEntityIds: identity.plannedEntityIds,
            input: { occurrenceId: occStep.outputBindings.occurrenceId, amountCents: r.amountCents, currency: r.currency, dueDate: r.dueDate }
          }
        ],
        legacyEvidence: r
      });
      if (r.status === 'PAID') {
        candidates.push(
          makeCandidate('UNVERIFIED_PAID_STATUS_DOWNGRADED_TO_OPEN', 'venuePayments', r.id, null, r, {
            note: 'legacy marked this receivable as paid/received; imported as OPEN because no verifiable Payment link was established at planning time (see PO decision Q3/policy for VenueReceivable PAID)'
          })
        );
      }
    });
    return { steps: steps, candidates: candidates };
  }

  /* --- Payments (deposits INFLOW + outgoing OUTFLOW) --- */
  var PAYMENT_STATUS_TO_SECOND_COMMAND = { CONFIRMED: 'confirmPayment', FAILED: 'failPayment' };

  function planPayments(canonical) {
    var steps = [];
    var candidates = [];
    asArray(canonical.payments).forEach(function (p) {
      if (isIndexFallback(p)) {
        candidates.push(makeCandidate('UNSTABLE_SYNTHETIC_ID', p.legacy ? p.legacy.sourceCollection : 'payments', p.id, null, p));
        return;
      }
      if (p.amountCents == null || !(p.amountCents > 0)) {
        candidates.push(makeCandidate('INVALID_AMOUNT', p.legacy ? p.legacy.sourceCollection : 'payments', p.id, null, p));
        return;
      }
      if (!p.paymentDate) {
        candidates.push(makeCandidate('MISSING_PAYMENT_DATE', p.legacy ? p.legacy.sourceCollection : 'payments', p.id, null, p));
        return;
      }
      var sourceCollection = (p.legacy && p.legacy.sourceCollection) || 'payments';
      var stepId = plannedEntityId(sourceCollection, p.id, 'step');
      var recordIdentity = commandIdentity(sourceCollection, p.id, 'recordPayment', ['payment']);
      var entityId = recordIdentity.plannedEntityIds[0];

      var commandSequence = [
        {
          commandType: 'recordPayment',
          idempotencyKey: recordIdentity.idempotencyKey,
          plannedEntityIds: recordIdentity.plannedEntityIds,
          input: { direction: p.direction, amountCents: p.amountCents, currency: p.currency, method: p.method, account: p.account, paymentDate: p.paymentDate, reference: p.reference }
        }
      ];
      var secondCommand = PAYMENT_STATUS_TO_SECOND_COMMAND[p.status];
      if (secondCommand) {
        /* coreConfirmPayment mints exactly one id (the ownerLedgerEntries
         * row); coreFailPayment mints none — verified by literal reading of
         * mdj-financial-local-services.js. */
        var secondEntityKinds = secondCommand === 'confirmPayment' ? ['ownerLedgerEntry'] : [];
        var secondIdentity = commandIdentity(sourceCollection, p.id, secondCommand, secondEntityKinds);
        commandSequence.push({
          commandType: secondCommand,
          idempotencyKey: secondIdentity.idempotencyKey,
          plannedEntityIds: secondIdentity.plannedEntityIds,
          input: { paymentId: entityId }
        });
      }

      steps.push({
        stepId: stepId,
        sourceCollection: sourceCollection,
        legacySourceId: p.id,
        dependsOnStepIds: [],
        outputBindings: { paymentId: entityId },
        fingerprint: paymentFingerprint(p),
        finalStatus: p.status,
        commandSequence: commandSequence,
        legacyEvidence: p
      });
    });
    return { steps: steps, candidates: candidates };
  }

  /* --- Receivable <-> Payment allocation links (contract §5/8, PO Q3/Q5) ---
   * Self-audit finding (fixed before shipping): an earlier draft of this
   * function searched for an "explicit shared identifier" between a
   * venuePayments-derived receivable and a deposits/payments-derived
   * payment, but the current mdj-financial-legacy-adapter.js contract
   * (verified by re-reading readLegacyVenueReceivables/
   * readLegacyDepositsAsPayments/readLegacyOutgoingPayments in Fase 0)
   * exposes NO field on canonical.venueReceivables that references a
   * canonical.payments record's legacy id, reference, or any other shared
   * identifier — `venuePayments[]` and `deposits[]`/`payments[]` are
   * disjoint collections in the adapter's own output. A "matching" branch
   * with no field to ever actually match on is dead code dressed as logic,
   * not a real check — so it is deliberately NOT implemented here.
   *
   * Per Q3/Q5 ("no inventar la allocation" / "no fusionar únicamente porque
   * coincidan monto y fecha"), the correct behavior given this contract gap
   * is exactly what planReceivables() already does unconditionally: create
   * every receivable as OPEN, and flag legacy-PAID ones with
   * UNVERIFIED_PAID_STATUS_DOWNGRADED_TO_OPEN for manual review. This
   * function therefore always returns no steps under the current adapter
   * contract — that is the intended, documented behavior, not a bug. If the
   * adapter is ever extended to carry a real cross-reference field, this is
   * the single function to update; nothing else in the bridge assumes an
   * allocation ever happens automatically. */
  function planReceivablePaymentLinks(receivableSteps, paymentSteps) {
    void receivableSteps;
    void paymentSteps;
    return { steps: [], candidates: [] };
  }

  /* --- payableCandidates (adapter) -> ImportCandidate, never a step --- */
  function planPayableCandidates(canonical) {
    return asArray(canonical.payableCandidates).map(function (c) {
      return makeCandidate('PAYABLE_REQUIRES_MANUAL_CONFIRMATION', 'payments', c.legacy ? c.legacy.sourceId : null, null, c);
    });
  }

  function buildImportPlan(adapterOutput, options) {
    var opts = options || {};
    if (!adapterOutput || adapterOutput.fatal === true || !isPlainObject(adapterOutput.canonical)) {
      return {
        planId: null,
        targetStoreSchemaVersion: opts.targetStoreSchemaVersion != null ? opts.targetStoreSchemaVersion : 1,
        steps: [],
        candidates: [],
        rejectedAtPlanning: [makeRejection(null, null, 'ADAPTER_OUTPUT_INVALID_OR_FATAL', adapterOutput || null)],
        planWarnings: []
      };
    }
    var canonical = adapterOutput.canonical;

    var venuesResult = planVenues(canonical);
    var venueStepsByLegacyId = Object.create(null);
    venuesResult.steps.forEach(function (s) { venueStepsByLegacyId[s.legacySourceId] = s; });

    var agreementsResult = planAgreements(canonical, venueStepsByLegacyId);
    var agreementStepsByLegacyId = Object.create(null);
    agreementsResult.steps.forEach(function (s) { agreementStepsByLegacyId[s.legacySourceId] = s; });

    var occurrencesResult = planOccurrences(canonical, venueStepsByLegacyId, agreementStepsByLegacyId);
    var occurrenceStepsByLegacyId = Object.create(null);
    occurrencesResult.steps.forEach(function (s) { occurrenceStepsByLegacyId[s.legacySourceId] = s; });

    var receivablesResult = planReceivables(canonical, occurrenceStepsByLegacyId);
    var paymentsResult = planPayments(canonical);
    var linksResult = planReceivablePaymentLinks(receivablesResult.steps, paymentsResult.steps);
    var payableCandidates = planPayableCandidates(canonical);

    var rejectedAtPlanning = asArray(adapterOutput.discarded).map(function (d) {
      return makeRejection(d.sourceCollection, d.sourceId, d.reason, d.legacyEvidence);
    });

    var steps = []
      .concat(venuesResult.steps, agreementsResult.steps, occurrencesResult.steps, receivablesResult.steps, paymentsResult.steps, linksResult.steps);

    var candidates = []
      .concat(venuesResult.candidates, agreementsResult.candidates, occurrencesResult.candidates, receivablesResult.candidates, paymentsResult.candidates, linksResult.candidates, payableCandidates);

    var planWarnings = asArray(adapterOutput.warnings).map(deepCloneJsonSafe);

    function byStepId(a, b) { return a.stepId < b.stepId ? -1 : a.stepId > b.stepId ? 1 : 0; }
    function byCandidateId(a, b) { return a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0; }
    function byRejection(a, b) {
      var ka = (a.sourceCollection || '') + '::' + (a.legacySourceId || '');
      var kb = (b.sourceCollection || '') + '::' + (b.legacySourceId || '');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }

    var sortedSteps = steps.slice().sort(byStepId);
    var sortedCandidates = candidates.slice().sort(byCandidateId);
    var sortedRejected = rejectedAtPlanning.slice().sort(byRejection);

    var planId =
      'legacy-import-plan::' +
      stableHash(
        stableStringify({
          schemaVersion: 1,
          steps: sortedSteps.map(function (s) {
            return {
              stepId: s.stepId,
              sourceCollection: s.sourceCollection,
              legacySourceId: s.legacySourceId,
              dependsOnStepIds: s.dependsOnStepIds.slice().sort(),
              commandSequence: s.commandSequence.map(function (c) {
                return { commandType: c.commandType, idempotencyKey: c.idempotencyKey, input: c.input };
              })
            };
          }),
          candidates: sortedCandidates.map(function (c) {
            return { candidateId: c.candidateId, reason: c.reason, sourceCollection: c.sourceCollection, legacySourceId: c.legacySourceId };
          }),
          rejectedAtPlanning: sortedRejected.map(function (r) {
            return { sourceCollection: r.sourceCollection, legacySourceId: r.legacySourceId, reason: r.reason };
          })
        })
      );

    return {
      planId: planId,
      targetStoreSchemaVersion: opts.targetStoreSchemaVersion != null ? opts.targetStoreSchemaVersion : 1,
      steps: sortedSteps,
      candidates: sortedCandidates,
      rejectedAtPlanning: sortedRejected,
      planWarnings: planWarnings
    };
  }

  /* =========================================================================
   * VALIDATION — validateImportPlan (pure, reads targetStore, never writes)
   * ======================================================================= */

  function blocked(reason, detail) {
    return { ok: false, errorCode: 'IMPORT_PLAN_BLOCKED', reason: reason, detail: detail || null };
  }

  /* Every T009 command this bridge invokes (createVenue, createVenueAgreement,
   * createOccurrenceWithPfr, createVenueReceivable, recordPayment,
   * confirmPayment, failPayment) populates `createdIds` with exactly the ids
   * minted via ctx.idGen() for that call — verified by literal reading of
   * mdj-financial-local-services.js. No speculative fallback needed or kept. */
  function extractStoredIdsFromReceipt(receipt) {
    return ((receipt.resultSnapshot && receipt.resultSnapshot.createdIds) || []).slice();
  }

  function findExistingReceipt(currentStore, commandType, idempotencyKey) {
    var receipts = (currentStore && currentStore.commandReceipts) || [];
    for (var i = 0; i < receipts.length; i++) {
      if (receipts[i].commandType === commandType && receipts[i].idempotencyKey === idempotencyKey) return receipts[i];
    }
    return null;
  }

  function hasCycle(steps) {
    var byId = Object.create(null);
    steps.forEach(function (s) { byId[s.stepId] = s; });
    var state = Object.create(null); // 'visiting' | 'done'
    var cyclic = false;

    function visit(stepId, chain) {
      if (cyclic) return;
      if (state[stepId] === 'done') return;
      if (state[stepId] === 'visiting') {
        cyclic = true;
        return;
      }
      state[stepId] = 'visiting';
      var s = byId[stepId];
      if (s) {
        s.dependsOnStepIds.forEach(function (dep) {
          if (byId[dep]) visit(dep, chain.concat([stepId]));
        });
      }
      state[stepId] = 'done';
    }

    steps.forEach(function (s) { visit(s.stepId, []); });
    return cyclic;
  }

  function isStaticallyResolvableValue(value) {
    if (typeof value === 'function') return false;
    if (Array.isArray(value)) return value.every(isStaticallyResolvableValue);
    if (isPlainObject(value)) return Object.keys(value).every(function (k) { return isStaticallyResolvableValue(value[k]); });
    return true; // string | number | boolean | null | undefined all fine
  }

  function validateImportPlan(plan, targetStore) {
    /* AJUSTE 2 — schemaVersion check FIRST, before any other validation. */
    if (!targetStore || targetStore.schemaVersion !== plan.targetStoreSchemaVersion) {
      return blocked('TARGET_STORE_SCHEMA_VERSION_MISMATCH', {
        expected: plan.targetStoreSchemaVersion,
        actual: targetStore ? targetStore.schemaVersion : null
      });
    }

    if (plan.rejectedAtPlanning && plan.rejectedAtPlanning.some(function (r) { return r.reason === 'ADAPTER_OUTPUT_INVALID_OR_FATAL'; })) {
      return blocked('ADAPTER_OUTPUT_INVALID_OR_FATAL', null);
    }

    /* Internal idempotencyKey collision check (pre-existing contract rule). */
    var seenKeys = Object.create(null);
    for (var si = 0; si < plan.steps.length; si++) {
      var step = plan.steps[si];
      for (var ci = 0; ci < step.commandSequence.length; ci++) {
        var cmd = step.commandSequence[ci];
        var compoundKey = cmd.commandType + '::' + cmd.idempotencyKey;
        if (seenKeys[compoundKey]) {
          return blocked('DUPLICATE_IDEMPOTENCY_KEY_WITHIN_PLAN', { commandType: cmd.commandType, idempotencyKey: cmd.idempotencyKey, stepIds: [seenKeys[compoundKey], step.stepId] });
        }
        seenKeys[compoundKey] = step.stepId;

        /* AJUSTE 1 — existing receipt output-id mismatch check. */
        var existing = findExistingReceipt(targetStore, cmd.commandType, cmd.idempotencyKey);
        if (existing) {
          var storedIds = extractStoredIdsFromReceipt(existing);
          var plannedIds = cmd.plannedEntityIds.slice();
          var mismatch = storedIds.length !== plannedIds.length || storedIds.some(function (id, idx) { return id !== plannedIds[idx]; });
          if (mismatch) {
            return blocked('EXISTING_RECEIPT_OUTPUT_ID_MISMATCH', {
              commandType: cmd.commandType,
              idempotencyKey: cmd.idempotencyKey,
              storedIds: storedIds,
              plannedIds: plannedIds
            });
          }
        }

        if (!isStaticallyResolvableValue(cmd.input)) {
          return blocked('NON_DETERMINISTIC_STEP_INPUT', { commandType: cmd.commandType, idempotencyKey: cmd.idempotencyKey });
        }
      }
    }

    if (hasCycle(plan.steps)) {
      return blocked('IMPORT_PLAN_DEPENDENCY_CYCLE', null);
    }

    var stepIds = Object.create(null);
    plan.steps.forEach(function (s) { stepIds[s.stepId] = true; });
    for (var di = 0; di < plan.steps.length; di++) {
      var depsOk = plan.steps[di].dependsOnStepIds.every(function (dep) { return stepIds[dep]; });
      if (!depsOk) {
        return blocked('IMPORT_PLAN_DANGLING_DEPENDENCY', { stepId: plan.steps[di].stepId });
      }
    }

    return { ok: true };
  }

  /* =========================================================================
   * EXECUTION — executeImportPlan (only phase that touches commands/store)
   *
   * Precondition (enforced by the phase separation, contract §11): this
   * phase assumes `plan` already passed validateImportPlan — in particular,
   * that it is acyclic. topoOrder() does not itself re-detect cycles; on a
   * cyclic plan it terminates (the visited-guard prevents infinite
   * recursion) but the resulting order would not be meaningful. Never call
   * executeImportPlan without a prior ok:true from validateImportPlan.
   * ======================================================================= */

  function topoOrder(steps) {
    var byId = Object.create(null);
    steps.forEach(function (s) { byId[s.stepId] = s; });
    var visited = Object.create(null);
    var order = [];

    function visit(stepId) {
      if (visited[stepId]) return;
      visited[stepId] = true;
      var s = byId[stepId];
      if (!s) return;
      s.dependsOnStepIds.forEach(visit);
      order.push(s);
    }

    steps.forEach(function (s) { visit(s.stepId); });
    return order;
  }

  function runStep(wrappedServices, planLevelWorkingStore, step, execCtx) {
    var preStepStore = planLevelWorkingStore;
    var stepStore = preStepStore;
    var commandReports = [];

    for (var i = 0; i < step.commandSequence.length; i++) {
      var cmd = step.commandSequence[i];
      var idGen = makeSequentialIdGen(step.stepId, cmd.idempotencyKey, cmd.commandType, cmd.plannedEntityIds);
      var input = Object.assign({}, cmd.input, { idempotencyKey: cmd.idempotencyKey, idGenerator: idGen, now: execCtx.now });
      var out;
      try {
        out = wrappedServices.commands[cmd.commandType](stepStore, input);
      } catch (e) {
        commandReports.push({ commandType: cmd.commandType, idempotencyKey: cmd.idempotencyKey, outcome: 'UNEXPECTED', errorCode: 'THROWN_EXCEPTION' });
        return { stepClassification: 'UNEXPECTED_FAILURE', preStepStore: preStepStore, commandReports: commandReports };
      }
      var classification = classifyCommandResult(out.result);
      commandReports.push({ commandType: cmd.commandType, idempotencyKey: cmd.idempotencyKey, outcome: classification, errorCode: out.result.ok ? null : out.result.errorCode });

      if (classification === 'UNEXPECTED') {
        return { stepClassification: 'UNEXPECTED_FAILURE', preStepStore: preStepStore, commandReports: commandReports };
      }
      if (classification === 'CONFLICT') {
        return { stepClassification: 'CONFLICT', preStepStore: preStepStore, commandReports: commandReports };
      }
      stepStore = out.store;
    }

    var allReplay = commandReports.every(function (r) { return r.outcome === 'REPLAY'; });
    return { stepClassification: allReplay ? 'REPLAYED' : 'IMPORTED', committedStore: stepStore, commandReports: commandReports };
  }

  function executeImportPlan(wrappedServices, originalStore, plan, options) {
    var opts = options || {};
    var execCtx = { now: opts.now || new Date().toISOString() };
    var ordered = topoOrder(plan.steps);

    var workingStore = originalStore;
    var completedStepIds = Object.create(null);
    var imported = [];
    var replayed = [];
    var conflicts = [];
    var skipped = [];
    var attemptedBeforeRollback = [];

    for (var i = 0; i < ordered.length; i++) {
      var step = ordered[i];
      var unmetDep = step.dependsOnStepIds.find(function (dep) { return !completedStepIds[dep]; });
      if (unmetDep) {
        skipped.push({ stepId: step.stepId, sourceCollection: step.sourceCollection, legacySourceId: step.legacySourceId, reason: 'SKIPPED_DEPENDENCY_NOT_MET', blockedByStepId: unmetDep });
        continue;
      }

      var outcome = runStep(wrappedServices, workingStore, step, execCtx);

      if (outcome.stepClassification === 'UNEXPECTED_FAILURE') {
        attemptedBeforeRollback.push({ stepId: step.stepId, sourceCollection: step.sourceCollection, legacySourceId: step.legacySourceId, commandReports: outcome.commandReports });
        return {
          store: originalStore,
          result: {
            ok: false,
            errorCode: 'IMPORT_EXECUTION_FAILED',
            report: buildReport(plan, {
              transaction: { committed: false, rolledBack: true, failedStepId: step.stepId, failedCommandType: lastAttemptedCommandType(outcome.commandReports) },
              imported: [],
              replayed: [],
              conflicts: [],
              skipped: skipped,
              attemptedBeforeRollback: attemptedBeforeRollback,
              executedAt: execCtx.now
            })
          }
        };
      }

      if (outcome.stepClassification === 'CONFLICT') {
        conflicts.push({ stepId: step.stepId, sourceCollection: step.sourceCollection, legacySourceId: step.legacySourceId, commandReports: outcome.commandReports });
        continue; // workingStore untouched, dependents will be SKIPPED via unmetDep on their own pass
      }

      workingStore = outcome.committedStore;
      completedStepIds[step.stepId] = true;
      var entry = { stepId: step.stepId, sourceCollection: step.sourceCollection, legacySourceId: step.legacySourceId, commandReports: outcome.commandReports };
      if (outcome.stepClassification === 'IMPORTED') imported.push(entry);
      else replayed.push(entry);
    }

    return {
      store: workingStore,
      result: {
        ok: true,
        report: buildReport(plan, {
          transaction: { committed: true, rolledBack: false, failedStepId: null, failedCommandType: null },
          imported: imported,
          replayed: replayed,
          conflicts: conflicts,
          skipped: skipped,
          attemptedBeforeRollback: [],
          executedAt: execCtx.now
        })
      }
    };
  }

  function lastAttemptedCommandType(commandReports) {
    if (!commandReports || !commandReports.length) return null;
    return commandReports[commandReports.length - 1].commandType;
  }

  function buildReport(plan, parts) {
    return {
      planId: plan.planId,
      executedAt: parts.executedAt,
      transaction: parts.transaction,
      imported: parts.imported,
      replayed: parts.replayed,
      conflicts: parts.conflicts,
      skipped: parts.skipped,
      candidates: plan.candidates,
      rejected: plan.rejectedAtPlanning,
      warnings: plan.planWarnings,
      attemptedBeforeRollback: parts.attemptedBeforeRollback,
      summary: {
        importedCount: parts.imported.length,
        replayedCount: parts.replayed.length,
        conflictCount: parts.conflicts.length,
        skippedCount: parts.skipped.length,
        candidateCount: plan.candidates.length,
        rejectedCount: plan.rejectedAtPlanning.length
      },
      ok: parts.transaction.committed,
      errorCode: parts.transaction.committed ? null : 'IMPORT_EXECUTION_FAILED'
    };
  }

  /* ---------------------------------------------------------------------
   * Public factory (same house pattern as T009/T010/T011)
   * ------------------------------------------------------------------- */

  /* Single source of truth for every ImportCandidate reason this module can
   * produce (TICKET-012 Fase 1 conformance pass) — mirrors the house
   * pattern of T009's ERROR_CODES / T010's EVENT_TYPE_CATALOG / T011's
   * ERROR_CODES: self-tests cross-check real observed reasons against THIS
   * list, never a second hand-maintained copy. */
  var CANDIDATE_REASONS = [
    'UNSTABLE_SYNTHETIC_ID',
    'MISSING_VENUE_NAME',
    'UNRESOLVED_VENUE_DEPENDENCY',
    'INVALID_RATE_BY_DAY',
    'INVALID_EFFECTIVE_DATE_RANGE',
    'DUPLICATE_PFR_CANDIDATE',
    'DUPLICATE_OCCURRENCE_SLOT',
    'MISSING_OCCURRENCE_DATE',
    'UNREPRESENTABLE_STATUS',
    'MISSING_OR_INVALID_PFR',
    'UNRESOLVED_OCCURRENCE_DEPENDENCY',
    'INVALID_AMOUNT',
    'DUPLICATE_RECEIVABLE_FOR_OCCURRENCE',
    'UNVERIFIED_PAID_STATUS_DOWNGRADED_TO_OPEN',
    'MISSING_PAYMENT_DATE',
    'PAYABLE_REQUIRES_MANUAL_CONFIRMATION'
  ];

  /* Single source of truth for every IMPORT_PLAN_BLOCKED reason validateImportPlan
   * can produce (TICKET-012 Fase 1 coverage-gap correction pass) — mirrors
   * CANDIDATE_REASONS exactly. Verified by literal enumeration of every
   * `return blocked(...)` call site in this file before this catalog was
   * written; self-tests cross-check real observed reasons against THIS
   * list, never a second hand-maintained copy. */
  var IMPORT_PLAN_BLOCKED_REASONS = [
    'TARGET_STORE_SCHEMA_VERSION_MISMATCH',
    'ADAPTER_OUTPUT_INVALID_OR_FATAL',
    'DUPLICATE_IDEMPOTENCY_KEY_WITHIN_PLAN',
    'EXISTING_RECEIPT_OUTPUT_ID_MISMATCH',
    'NON_DETERMINISTIC_STEP_INPUT',
    'IMPORT_PLAN_DEPENDENCY_CYCLE',
    'IMPORT_PLAN_DANGLING_DEPENDENCY'
  ];

  function createLegacyImportBridge() {
    return {
      buildImportPlan: buildImportPlan,
      validateImportPlan: validateImportPlan,
      executeImportPlan: executeImportPlan,
      CANDIDATE_REASONS: CANDIDATE_REASONS.slice(),
      IMPORT_PLAN_BLOCKED_REASONS: IMPORT_PLAN_BLOCKED_REASONS.slice()
    };
  }

  var api = { createLegacyImportBridge: createLegacyImportBridge };

  global.MDJFinancialLegacyImportBridge = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
