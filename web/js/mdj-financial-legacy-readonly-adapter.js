/**
 * TICKET-V1-FINANCIAL-LEGACY-TO-CANONICAL-READONLY-ADAPTER-007D
 * Pure, readonly translation layer: legacy accounting-module.js shapes ->
 * canonical representations per docs/architecture/MIAMI-DJ-BEAT-V1-CANONICAL-FINANCIAL-ARCHITECTURE.md
 * §6, using the mapping contract fixed in
 * docs/tickets/TICKET-V1-FINANCIAL-CANONICAL-ALIGNMENT-PREINTEGRATION-GATES-007C.md
 * Bloque 3/5.
 *
 * MUST NOT: call recordPayment/confirmPayment/failPayment/allocatePayment/
 * reconcilePayment/voidPayable/voidReceivable or any other command from
 * mdj-financial-local-services.js. MUST NOT: touch window.localStorage,
 * document, fetch, Supabase, browser APIs, filesystem, SQL, or mutate any
 * object passed in. MUST NOT: import or require accounting-module.js or
 * mdj-financial-local-services.js — this file receives plain objects only.
 *
 * Every translate* function returns { ..., unmapped } where `unmapped` is a
 * list of { field, legacyValue, reason, fallback? } entries — one per input
 * field/value that has no canonical equivalent. Never fabricated: when a
 * mapping cannot be determined honestly, the corresponding canonical field
 * is `null` and the reason is recorded in `unmapped`, never guessed.
 *
 * Output is a deep clone (JSON-safe round trip) — no reference back to the
 * legacy object, no reference to canonical store objects (none are ever
 * touched). Ids are never reused: canonical ids are synthesized as
 * `legacy:{kind}:{legacyId}` so a future equivalence harness can trace a
 * canonical representation back to the exact legacy row it came from
 * without ever colliding with a real canonical-store id.
 */
(function (global) {
  'use strict';

  var CENTS_PER_UNIT = 100;

  function deepCloneJsonSafe(value) {
    if (value === undefined) return undefined;
    if (value === null || typeof value !== 'object') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function toAmountCents(amount) {
    var n = Number(amount);
    if (!isFinite(n)) return null;
    return Math.round(n * CENTS_PER_UNIT);
  }

  function normalizeCurrency(value) {
    if (value === undefined || value === null) return 'USD';
    var trimmed = String(value).trim();
    return trimmed ? trimmed.toUpperCase() : 'USD';
  }

  function syntheticId(kind, legacyId) {
    return 'legacy:' + kind + ':' + String(legacyId);
  }

  function syntheticIdempotencyKey(kind, legacyId) {
    return 'legacy:' + kind + ':' + String(legacyId);
  }

  function pushUnmapped(list, field, legacyValue, reason, fallback) {
    var entry = { field: field, legacyValue: legacyValue === undefined ? null : legacyValue, reason: reason };
    if (fallback !== undefined) entry.fallback = fallback;
    list.push(entry);
  }

  /* ------------------------------------------------------------------
   * Payment method: legacy PAYMENT_FORM_METHOD_VALID -> canonical
   * Payment.method (§6). 'direct_deposit' has no canonical value — falls
   * back to OTHER and is recorded as UNMAPPED, never silently dropped.
   * ------------------------------------------------------------------ */
  var PAYMENT_METHOD_MAP = {
    cash: 'CASH',
    check: 'CHECK',
    ach: 'ACH',
    wire: 'WIRE',
    zelle: 'ZELLE',
    other: 'OTHER'
  };

  function mapPaymentMethod(legacyMethod, unmapped) {
    var key = String(legacyMethod || '').trim().toLowerCase();
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(PAYMENT_METHOD_MAP, key)) {
      return PAYMENT_METHOD_MAP[key];
    }
    pushUnmapped(unmapped, 'paymentMethod', legacyMethod, 'NO_CANONICAL_METHOD_EQUIVALENT', 'OTHER');
    return 'OTHER';
  }

  /* ------------------------------------------------------------------
   * Payment / Payable status derivation — per 007C Bloque 5: equivalence
   * is by financial fact, never 1:1 status-name mapping. A legacy status
   * that never represents an executed movement (draft/scheduled/
   * pending_approval) produces NO canonical Payment (movement hasn't
   * happened yet) — only the obligation side (canonicalPayable) exists.
   * A legacy status that represents an executed movement produces a
   * CONFIRMED/FAILED canonical Payment plus the obligation's derived
   * balance state, mirroring mdj-financial-local-services.js's own
   * deriveTargetStatus() logic (balance<=0 -> PAID, 0<balance<total ->
   * PARTIALLY_PAID, else PENDING/OPEN), never invented independently.
   * ------------------------------------------------------------------ */
  var PRE_EXECUTION_STATUSES = ['draft', 'scheduled', 'pending_approval'];
  var CONFIRMED_MOVEMENT_STATUSES = ['partial', 'paid', 'completed'];

  function deriveMovementAndObligation(legacyStatus, amountCents, paidAmountCents, unmapped) {
    var status = String(legacyStatus || '').trim().toLowerCase();

    if (PRE_EXECUTION_STATUSES.indexOf(status) !== -1) {
      return {
        canonicalPaymentStatus: null,
        obligationStatus: status === 'pending_approval' ? 'SCHEDULED' : 'PENDING',
        allocatedCents: 0,
        remainingCents: amountCents
      };
    }

    if (CONFIRMED_MOVEMENT_STATUSES.indexOf(status) !== -1) {
      var remaining = amountCents - paidAmountCents;
      var obligationStatus = remaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      return {
        canonicalPaymentStatus: 'CONFIRMED',
        obligationStatus: obligationStatus,
        allocatedCents: paidAmountCents,
        remainingCents: Math.max(remaining, 0)
      };
    }

    if (status === 'failed') {
      return {
        canonicalPaymentStatus: 'FAILED',
        obligationStatus: 'PENDING',
        allocatedCents: 0,
        remainingCents: amountCents
      };
    }

    if (status === 'cancelled' || status === 'void') {
      pushUnmapped(unmapped, 'status', legacyStatus, 'NO_CANONICAL_PAYMENT_STATUS_FOR_CANCELLED_OR_VOID — obligation-level VOID is the closest canonical fact (mirrors voidPayable/voidReceivable); canonical Payment itself has no CANCELLED/VOID value (§6)');
      return {
        canonicalPaymentStatus: null,
        obligationStatus: 'VOID',
        allocatedCents: paidAmountCents,
        remainingCents: Math.max(amountCents - paidAmountCents, 0)
      };
    }

    if (status === 'refunded') {
      pushUnmapped(unmapped, 'status', legacyStatus, 'REQUIRES_COMPENSATING_PAYMENT_STRUCTURE — canonical refund is recordRefund() (a NEW compensatory Payment + a REVERSE PaymentAllocation), not a single-record status; this adapter does not synthesize a compound structure');
      return {
        canonicalPaymentStatus: null,
        obligationStatus: null,
        allocatedCents: null,
        remainingCents: null
      };
    }

    pushUnmapped(unmapped, 'status', legacyStatus, 'UNKNOWN_LEGACY_STATUS');
    return { canonicalPaymentStatus: null, obligationStatus: null, allocatedCents: null, remainingCents: null };
  }

  /* ------------------------------------------------------------------
   * Payment legacy (hybrid: obligation+movement in one row) ->
   * canonical Payment (movement, when it happened) + canonical Payable
   * (obligation) — §6 Payment / §6 Payable.
   * ------------------------------------------------------------------ */
  function translateLegacyPayment(legacyPayment) {
    var unmapped = [];
    if (!legacyPayment || typeof legacyPayment !== 'object' || legacyPayment.id == null) {
      return { canonicalPayment: null, canonicalPayable: null, unmapped: [{ field: 'id', legacyValue: null, reason: 'MISSING_OR_INVALID_LEGACY_PAYMENT' }] };
    }

    var amountCents = toAmountCents(legacyPayment.amount);
    if (amountCents === null) {
      pushUnmapped(unmapped, 'amount', legacyPayment.amount, 'INVALID_AMOUNT');
      amountCents = 0;
    }
    var paidAmountCents = toAmountCents(legacyPayment.paidAmount != null ? legacyPayment.paidAmount : 0);
    if (paidAmountCents === null) paidAmountCents = 0;

    var currency = normalizeCurrency(legacyPayment.currency);
    var method = mapPaymentMethod(legacyPayment.paymentMethod, unmapped);
    var derived = deriveMovementAndObligation(legacyPayment.status, amountCents, paidAmountCents, unmapped);

    if (legacyPayment.occurrenceId != null) {
      pushUnmapped(unmapped, 'occurrenceId', legacyPayment.occurrenceId, 'FIELD_PRESENT_BUT_UNEXPECTED_ON_LEGACY_PAYMENT — accounting-module.js Payment model has no occurrenceId field per 007A; carried through verbatim, not dropped');
    }

    var canonicalPayment = null;
    if (derived.canonicalPaymentStatus !== null) {
      /* §6: Payment.amountCents represents "cuánto dinero se movió" — for a
       * FAILED attempt that's the full attempted amount (nothing partial
       * about an attempt); for a CONFIRMED movement it's what actually
       * moved, which legacy only tracks as `paidAmount` on the hybrid row
       * (never a discrete per-transaction figure — see unmapped note below
       * when this is a partial payment on a row that could represent more
       * than one historical movement). Using the obligation's full `amount`
       * here for a CONFIRMED partial payment would overstate the movement
       * (bug found and fixed 2026-08-09, cross-validated against Gate 5/6:
       * docs/validation-legacy-readonly-adapter-cross-validation-gate2-007d-2026-08-09/). */
      var movementAmountCents = derived.canonicalPaymentStatus === 'FAILED' ? amountCents : paidAmountCents;
      if (derived.canonicalPaymentStatus === 'CONFIRMED' && paidAmountCents < amountCents) {
        pushUnmapped(
          unmapped,
          'paidAmount',
          legacyPayment.paidAmount,
          'PARTIAL_PAYMENT_MOVEMENT_SIZE_IS_CUMULATIVE_NOT_DISCRETE — legacy hybrid row has no per-transaction movement amount, only a running paidAmount total; used as the best available approximation for Payment.amountCents'
        );
      }
      canonicalPayment = {
        id: syntheticId('payment', legacyPayment.id),
        direction: legacyPayment.direction === 'INFLOW' ? 'INFLOW' : 'OUTFLOW',
        amountCents: movementAmountCents,
        currency: currency,
        method: method,
        account: legacyPayment.sourceAccount || null,
        paymentDate: legacyPayment.paidDate || legacyPayment.scheduledDate || null,
        reference: legacyPayment.reference || null,
        status: derived.canonicalPaymentStatus,
        idempotencyKey: syntheticIdempotencyKey('payment', legacyPayment.id),
        reversalOfPaymentId: null,
        createdAt: legacyPayment.createdAt || null,
        updatedAt: legacyPayment.updatedAt || null,
        createdBy: legacyPayment.recordedBy || null,
        sourceLegacyId: legacyPayment.id
      };
    }

    var canonicalPayable = null;
    if (derived.obligationStatus !== null) {
      canonicalPayable = {
        id: syntheticId('payable', legacyPayment.id),
        sourceType: legacyPayment.performanceId ? 'OCCURRENCE' : (legacyPayment.agreementId ? 'OCCURRENCE' : 'EXPENSE'),
        sourceId: legacyPayment.performanceId || null,
        payeeType: 'PAYEE',
        payeeId: legacyPayment.payeeId || null,
        purpose: legacyPayment.paymentType || null,
        amountCents: amountCents,
        currency: currency,
        status: derived.obligationStatus,
        allocatedCents: derived.allocatedCents,
        remainingCents: derived.remainingCents,
        dueDate: legacyPayment.scheduledDate || null,
        agreementId: legacyPayment.agreementId || null,
        createdAt: legacyPayment.createdAt || null,
        updatedAt: legacyPayment.updatedAt || null,
        createdBy: legacyPayment.recordedBy || null,
        sourceLegacyId: legacyPayment.id
      };
      if (!legacyPayment.performanceId && !legacyPayment.agreementId) {
        pushUnmapped(unmapped, 'sourceType', null, 'NO_OCCURRENCE_OR_AGREEMENT_CONTEXT — sourceType defaulted to EXPENSE, not inferred from business meaning');
      }
    }

    if (!legacyPayment.payeeId) {
      pushUnmapped(unmapped, 'payeeId', legacyPayment.payeeId, 'MISSING_PAYEE_ID');
    }
    if (legacyPayment.concept) {
      pushUnmapped(unmapped, 'concept', legacyPayment.concept, 'NO_CANONICAL_FIELD_ON_PAYMENT_OR_PAYABLE — carried nowhere; §6 Payment/Payable have no free-text concept field');
    }

    return {
      canonicalPayment: deepCloneJsonSafe(canonicalPayment),
      canonicalPayable: deepCloneJsonSafe(canonicalPayable),
      unmapped: deepCloneJsonSafe(unmapped)
    };
  }

  /* ------------------------------------------------------------------
   * VenuePayment legacy -> canonical VenueReceivable — §6 VenueReceivable.
   * Legacy VenuePayment statuses observed in accounting-module.js:
   * 'pending' (not yet collected) and 'received' (fully collected) —
   * no partial-collection state exists in legacy VenuePayment today.
   * ------------------------------------------------------------------ */
  var VENUE_PAYMENT_STATUS_MAP = {
    pending: 'OPEN',
    received: 'PAID'
  };

  function translateLegacyVenuePayment(legacyVenuePayment) {
    var unmapped = [];
    if (!legacyVenuePayment || typeof legacyVenuePayment !== 'object' || legacyVenuePayment.id == null) {
      return { canonicalVenueReceivable: null, unmapped: [{ field: 'id', legacyValue: null, reason: 'MISSING_OR_INVALID_LEGACY_VENUE_PAYMENT' }] };
    }

    var amountCents = toAmountCents(legacyVenuePayment.amount);
    if (amountCents === null) {
      pushUnmapped(unmapped, 'amount', legacyVenuePayment.amount, 'INVALID_AMOUNT');
      amountCents = 0;
    }

    var statusKey = String(legacyVenuePayment.status || '').trim().toLowerCase();
    var canonicalStatus = Object.prototype.hasOwnProperty.call(VENUE_PAYMENT_STATUS_MAP, statusKey)
      ? VENUE_PAYMENT_STATUS_MAP[statusKey]
      : null;
    if (canonicalStatus === null) {
      pushUnmapped(unmapped, 'status', legacyVenuePayment.status, 'UNKNOWN_LEGACY_VENUE_PAYMENT_STATUS');
      canonicalStatus = 'OPEN';
    }

    if (!legacyVenuePayment.occurrenceId) {
      pushUnmapped(unmapped, 'occurrenceId', legacyVenuePayment.occurrenceId, 'MISSING_OCCURRENCE_ID — canonical VenueReceivable requires occurrenceId (§6, UNIQUE FK)');
    }

    var canonicalVenueReceivable = {
      id: syntheticId('venuePayment', legacyVenuePayment.id),
      occurrenceId: legacyVenuePayment.occurrenceId || null,
      amountCents: amountCents,
      currency: normalizeCurrency(legacyVenuePayment.currency),
      status: canonicalStatus,
      allocatedCents: canonicalStatus === 'PAID' ? amountCents : 0,
      remainingCents: canonicalStatus === 'PAID' ? 0 : amountCents,
      dueDate: null,
      venueId: legacyVenuePayment.venueId || null,
      agreementId: legacyVenuePayment.agreementId || null,
      createdAt: legacyVenuePayment.createdAt || null,
      updatedAt: legacyVenuePayment.updatedAt || null,
      createdBy: null,
      sourceLegacyId: legacyVenuePayment.id
    };

    if (legacyVenuePayment.concept) {
      pushUnmapped(unmapped, 'concept', legacyVenuePayment.concept, 'NO_CANONICAL_FIELD_ON_VENUE_RECEIVABLE — §6 VenueReceivable has no free-text concept field');
    }

    return {
      canonicalVenueReceivable: deepCloneJsonSafe(canonicalVenueReceivable),
      unmapped: deepCloneJsonSafe(unmapped)
    };
  }

  /* ------------------------------------------------------------------
   * VenuePayment legacy, when 'received' -> canonical Payment (INFLOW)
   * representing the collection movement — §6 Payment.
   * TICKET-V1-FINANCIAL-ENTRY-TO-CANONICAL-WIRING-001.
   *
   * Deliberately NEVER builds a canonicalPayable — unlike
   * translateLegacyPayment() (built for the MDJB→payee outbound direction,
   * which always has an obligation), a venue collection is inbound money
   * against an obligation that already exists as a VenueReceivable
   * (translateLegacyVenuePayment(), shadowed separately, earlier, at
   * creation time). Reusing translateLegacyPayment() here would fabricate
   * a Payable that was never real — found and rejected during the audit
   * of 2026-08-09 (docs/tickets/TICKET-V1-FINANCIAL-ENTRY-TO-CANONICAL-
   * WIRING-001, section M).
   * ------------------------------------------------------------------ */
  function translateLegacyVenuePaymentCollection(legacyVenuePayment) {
    var unmapped = [];
    if (!legacyVenuePayment || typeof legacyVenuePayment !== 'object' || legacyVenuePayment.id == null) {
      return { canonicalPayment: null, unmapped: [{ field: 'id', legacyValue: null, reason: 'MISSING_OR_INVALID_LEGACY_VENUE_PAYMENT' }] };
    }
    var statusKey = String(legacyVenuePayment.status || '').trim().toLowerCase();
    if (statusKey !== 'received') {
      return {
        canonicalPayment: null,
        unmapped: [{ field: 'status', legacyValue: legacyVenuePayment.status, reason: 'NOT_YET_COLLECTED — only a received VenuePayment represents an inbound movement' }]
      };
    }

    var amountCents = toAmountCents(legacyVenuePayment.amount);
    if (amountCents === null) {
      pushUnmapped(unmapped, 'amount', legacyVenuePayment.amount, 'INVALID_AMOUNT');
      amountCents = 0;
    }
    var method = mapPaymentMethod(legacyVenuePayment.paymentMethod, unmapped);

    var canonicalPayment = {
      id: syntheticId('venuePaymentCollection', legacyVenuePayment.id),
      direction: 'INFLOW',
      amountCents: amountCents,
      currency: normalizeCurrency(legacyVenuePayment.currency),
      method: method,
      account: null,
      paymentDate: legacyVenuePayment.receivedDate || null,
      reference: legacyVenuePayment.reference || null,
      status: 'CONFIRMED',
      idempotencyKey: syntheticIdempotencyKey('venuePaymentCollection', legacyVenuePayment.id),
      reversalOfPaymentId: null,
      createdAt: legacyVenuePayment.updatedAt || legacyVenuePayment.createdAt || null,
      updatedAt: legacyVenuePayment.updatedAt || null,
      createdBy: legacyVenuePayment.recordedBy || null,
      sourceLegacyId: legacyVenuePayment.id
    };

    if (legacyVenuePayment.notes) {
      pushUnmapped(unmapped, 'notes', legacyVenuePayment.notes, 'NO_CANONICAL_FIELD_ON_PAYMENT — §6 Payment has no free-text notes field');
    }

    return {
      canonicalPayment: deepCloneJsonSafe(canonicalPayment),
      unmapped: deepCloneJsonSafe(unmapped)
    };
  }

  /* ------------------------------------------------------------------
   * RecurringPayment legacy -> NO canonical entity exists (007B/007C:
   * Scheduler is KEEP, the Core has no recurrence-rule entity at all —
   * only the Occurrence/Payable/VenueReceivable it eventually produces).
   * This returns a normalized, canonical-shaped envelope for future
   * observability/harness use, explicitly flagged as having no canonical
   * entity — never fabricates one.
   * ------------------------------------------------------------------ */
  function translateLegacyRecurringPayment(legacyRecurringPayment) {
    var unmapped = [];
    if (!legacyRecurringPayment || typeof legacyRecurringPayment !== 'object' || legacyRecurringPayment.id == null) {
      return { canonicalEntity: null, normalized: null, note: null, unmapped: [{ field: 'id', legacyValue: null, reason: 'MISSING_OR_INVALID_LEGACY_RECURRING_PAYMENT' }] };
    }

    pushUnmapped(unmapped, 'entity', legacyRecurringPayment.id, 'NO_CANONICAL_RECURRENCE_ENTITY — Recurring Scheduler is KEEP per 007C Bloque 2; the Canonical Core has no recurring-rule entity, only the Occurrence/Payable/VenueReceivable it eventually produces');

    var amountCents = toAmountCents(legacyRecurringPayment.amount);
    if (amountCents === null) {
      pushUnmapped(unmapped, 'amount', legacyRecurringPayment.amount, 'INVALID_AMOUNT');
      amountCents = 0;
    }

    var normalized = {
      sourceLegacyId: legacyRecurringPayment.id,
      payeeId: legacyRecurringPayment.payeeId || null,
      amountCents: amountCents,
      currency: normalizeCurrency(legacyRecurringPayment.currency || 'USD'),
      method: mapPaymentMethod(legacyRecurringPayment.paymentMethod, unmapped),
      frequency: legacyRecurringPayment.frequency || null,
      effectiveFrom: legacyRecurringPayment.effectiveFrom || null,
      effectiveUntil: legacyRecurringPayment.effectiveUntil || null,
      status: legacyRecurringPayment.status || null
    };

    return {
      canonicalEntity: null,
      normalized: deepCloneJsonSafe(normalized),
      note: 'NO_CANONICAL_EQUIVALENT — descriptive envelope only, per 007C Bloque 2 (Scheduler = KEEP)',
      unmapped: deepCloneJsonSafe(unmapped)
    };
  }

  /* ------------------------------------------------------------------
   * PaymentAllocation legacy (ticket 007, accounting-module.js) ->
   * canonical PaymentAllocation — §6 PaymentAllocation.
   * ------------------------------------------------------------------ */
  function translateLegacyPaymentAllocation(legacyAllocation) {
    var unmapped = [];
    if (!legacyAllocation || typeof legacyAllocation !== 'object' || legacyAllocation.id == null) {
      return { canonicalPaymentAllocation: null, unmapped: [{ field: 'id', legacyValue: null, reason: 'MISSING_OR_INVALID_LEGACY_ALLOCATION' }] };
    }

    var amountCents = toAmountCents(legacyAllocation.amountAllocated);
    if (amountCents === null) {
      pushUnmapped(unmapped, 'amountAllocated', legacyAllocation.amountAllocated, 'INVALID_AMOUNT');
      amountCents = 0;
    }

    var targetType = null;
    var targetId = null;
    if (legacyAllocation.receivableId) {
      targetType = 'VENUE_RECEIVABLE';
      targetId = syntheticId('venuePayment', legacyAllocation.receivableId);
    } else if (legacyAllocation.payableId) {
      targetType = 'PAYABLE';
      targetId = syntheticId('payable', legacyAllocation.payableId);
    } else {
      pushUnmapped(
        unmapped,
        'targetType',
        null,
        'NO_TARGET_REFERENCE — legacy allocation (ticket 007) does not require payableId/receivableId to be set; canonical PaymentAllocation requires targetType+targetId (§6)'
      );
    }

    var canonicalPaymentAllocation = {
      id: syntheticId('allocation', legacyAllocation.id),
      paymentId: syntheticId('payment', legacyAllocation.paymentId),
      targetType: targetType,
      targetId: targetId,
      amountCents: amountCents,
      direction: 'APPLY',
      reversalOfAllocationId: null,
      idempotencyKey: legacyAllocation.idempotencyKey ? syntheticIdempotencyKey('allocation', legacyAllocation.idempotencyKey) : syntheticIdempotencyKey('allocation', legacyAllocation.id),
      createdAt: legacyAllocation.createdAt || null,
      createdBy: legacyAllocation.allocatedBy || null,
      sourceLegacyId: legacyAllocation.id
    };

    if (legacyAllocation.category) {
      pushUnmapped(unmapped, 'category', legacyAllocation.category, 'NO_CANONICAL_FIELD_ON_PAYMENT_ALLOCATION — §6 PaymentAllocation has no category field');
    }
    if (legacyAllocation.reference) {
      pushUnmapped(unmapped, 'reference', legacyAllocation.reference, 'NO_CANONICAL_FIELD_ON_PAYMENT_ALLOCATION — §6 PaymentAllocation has no reference field');
    }
    if (legacyAllocation.reconciliationStatus) {
      pushUnmapped(unmapped, 'reconciliationStatus', legacyAllocation.reconciliationStatus, 'BELONGS_TO_RECONCILIATION_ENTITY_NOT_ALLOCATION — §6 Reconciliation is a separate entity, out of scope for this adapter');
    }

    return {
      canonicalPaymentAllocation: deepCloneJsonSafe(canonicalPaymentAllocation),
      unmapped: deepCloneJsonSafe(unmapped)
    };
  }

  /* ------------------------------------------------------------------
   * Venue legacy -> canonical Venue — §6 Venue.
   * TICKET-V1-FINANCIAL-SHADOW-OCCURRENCE-VENUE-RECEIVABLE-ALIGNMENT-007M.
   * Additive to the 007D contract, same pattern (deep clone, UNMAPPED,
   * synthetic ids, no side effects) — no architecture redefinition.
   * ------------------------------------------------------------------ */
  var VENUE_STATUS_MAP = {
    active: 'ACTIVE',
    pending: 'ACTIVE',
    paused: 'ACTIVE',
    inactive: 'INACTIVE',
    archived: 'INACTIVE',
    deleted: 'INACTIVE'
  };

  function translateLegacyVenue(legacyVenue) {
    var unmapped = [];
    if (!legacyVenue || typeof legacyVenue !== 'object' || legacyVenue.id == null) {
      return { canonicalVenue: null, unmapped: [{ field: 'id', legacyValue: null, reason: 'MISSING_OR_INVALID_LEGACY_VENUE' }] };
    }
    if (!legacyVenue.venueName) {
      pushUnmapped(unmapped, 'venueName', legacyVenue.venueName, 'MISSING_VENUE_NAME');
    }
    var statusKey = String(legacyVenue.status || '').trim().toLowerCase();
    var canonicalStatus = Object.prototype.hasOwnProperty.call(VENUE_STATUS_MAP, statusKey) ? VENUE_STATUS_MAP[statusKey] : null;
    if (canonicalStatus === null) {
      pushUnmapped(unmapped, 'status', legacyVenue.status, 'UNKNOWN_LEGACY_VENUE_STATUS');
      canonicalStatus = 'ACTIVE';
    }

    var canonicalVenue = {
      id: syntheticId('venue', legacyVenue.id),
      name: legacyVenue.venueName || null,
      address: legacyVenue.address || null,
      contactName: legacyVenue.contactName || null,
      contactPhone: legacyVenue.contactPhone || null,
      contactEmail: legacyVenue.contactEmail || null,
      status: canonicalStatus,
      sourceLegacyId: legacyVenue.id
    };

    return { canonicalVenue: deepCloneJsonSafe(canonicalVenue), unmapped: deepCloneJsonSafe(unmapped) };
  }

  /* ------------------------------------------------------------------
   * VenueAgreement legacy -> canonical VenueAgreement — §6 VenueAgreement.
   * ------------------------------------------------------------------ */
  function translateLegacyVenueAgreement(legacyAgreement) {
    var unmapped = [];
    if (!legacyAgreement || typeof legacyAgreement !== 'object' || legacyAgreement.id == null) {
      return { canonicalVenueAgreement: null, unmapped: [{ field: 'id', legacyValue: null, reason: 'MISSING_OR_INVALID_LEGACY_AGREEMENT' }] };
    }
    if (!legacyAgreement.venueId) {
      pushUnmapped(unmapped, 'venueId', legacyAgreement.venueId, 'MISSING_VENUE_ID');
    }
    var rateByDay = legacyAgreement.rateByDay && typeof legacyAgreement.rateByDay === 'object' ? legacyAgreement.rateByDay : {};
    if (!Object.keys(rateByDay).length) {
      pushUnmapped(unmapped, 'rateByDay', rateByDay, 'MISSING_OR_EMPTY_RATE_BY_DAY — canonical VenueAgreement requires at least one entry (§6)');
    }

    var canonicalVenueAgreement = {
      id: syntheticId('venueAgreement', legacyAgreement.id),
      venueId: legacyAgreement.venueId ? syntheticId('venue', legacyAgreement.venueId) : null,
      title: legacyAgreement.title || null,
      frequency: legacyAgreement.frequency || null,
      scheduledDays: Array.isArray(legacyAgreement.scheduledDays) ? legacyAgreement.scheduledDays.slice() : [],
      rateByDay: deepCloneJsonSafe(rateByDay),
      currency: normalizeCurrency(legacyAgreement.currency),
      effectiveFrom: legacyAgreement.effectiveFrom || null,
      effectiveUntil: legacyAgreement.effectiveUntil || null,
      sourceLegacyId: legacyAgreement.id,
      sourceLegacyVenueId: legacyAgreement.venueId || null
    };

    return { canonicalVenueAgreement: deepCloneJsonSafe(canonicalVenueAgreement), unmapped: deepCloneJsonSafe(unmapped) };
  }

  /* ------------------------------------------------------------------
   * Occurrence legacy -> canonical Occurrence + PFR — §6 Occurrence /
   * PerformanceFinancialRecord. The Core's createOccurrenceWithPfr()
   * creates both atomically, so this translation bundles both shapes in
   * one result — never one without the other. Legacy status 'rescheduled'
   * has no canonical equivalent (canonical Occurrence.status is only
   * SCHEDULED | COMPLETED | CANCELLED | NO_SHOW, §6) — flagged UNMAPPED,
   * never fabricated as any of those four.
   * ------------------------------------------------------------------ */
  var OCCURRENCE_STATUS_MAP = {
    scheduled: 'SCHEDULED',
    cancelled: 'CANCELLED'
  };

  function translateLegacyOccurrence(legacyOccurrence) {
    var unmapped = [];
    if (!legacyOccurrence || typeof legacyOccurrence !== 'object' || legacyOccurrence.id == null) {
      return { canonicalOccurrence: null, canonicalPfr: null, unmapped: [{ field: 'id', legacyValue: null, reason: 'MISSING_OR_INVALID_LEGACY_OCCURRENCE' }] };
    }
    if (!legacyOccurrence.venueId) {
      pushUnmapped(unmapped, 'venueId', legacyOccurrence.venueId, 'MISSING_VENUE_ID');
    }
    if (!legacyOccurrence.date) {
      pushUnmapped(unmapped, 'date', legacyOccurrence.date, 'MISSING_DATE');
    }
    var amountCents = toAmountCents(legacyOccurrence.rateAmount);
    if (amountCents === null || amountCents <= 0) {
      pushUnmapped(unmapped, 'rateAmount', legacyOccurrence.rateAmount, 'INVALID_OR_MISSING_RATE_AMOUNT — canonical rateAmountCents must be > 0 (§6)');
      amountCents = null;
    }

    var statusKey = String(legacyOccurrence.status || '').trim().toLowerCase();
    var canonicalStatus = Object.prototype.hasOwnProperty.call(OCCURRENCE_STATUS_MAP, statusKey) ? OCCURRENCE_STATUS_MAP[statusKey] : null;
    if (canonicalStatus === null) {
      pushUnmapped(unmapped, 'status', legacyOccurrence.status, statusKey === 'rescheduled' ? 'NO_CANONICAL_STATUS_FOR_RESCHEDULED — superseded occurrence, not a fresh canonical fact (§6 has no RESCHEDULED value)' : 'UNKNOWN_LEGACY_OCCURRENCE_STATUS');
    }

    if (!legacyOccurrence.venueId || !legacyOccurrence.date || amountCents === null || canonicalStatus === null) {
      return { canonicalOccurrence: null, canonicalPfr: null, unmapped: deepCloneJsonSafe(unmapped) };
    }

    var canonicalOccurrence = {
      id: syntheticId('occurrence', legacyOccurrence.id),
      venueId: syntheticId('venue', legacyOccurrence.venueId),
      agreementId: legacyOccurrence.agreementId ? syntheticId('venueAgreement', legacyOccurrence.agreementId) : null,
      assignedProfileId: null,
      date: legacyOccurrence.date,
      shift: legacyOccurrence.shiftSlot || 'default',
      status: canonicalStatus,
      sourceLegacyId: legacyOccurrence.id,
      sourceLegacyVenueId: legacyOccurrence.venueId,
      sourceLegacyAgreementId: legacyOccurrence.agreementId || null
    };

    var canonicalPfr = {
      occurrenceId: canonicalOccurrence.id,
      agreementId: canonicalOccurrence.agreementId,
      rateAmountCents: amountCents,
      currency: normalizeCurrency(legacyOccurrence.currency),
      assignedProfileId: null,
      expectedArtistPayoutCents: null
    };

    if (legacyOccurrence.assignedProfileId) {
      pushUnmapped(unmapped, 'assignedProfileId', legacyOccurrence.assignedProfileId, 'FIELD_PRESENT_BUT_UNEXPECTED_ON_LEGACY_OCCURRENCE — createOccurrenceModel() has no assignedProfileId field; carried nowhere');
    }

    return {
      canonicalOccurrence: deepCloneJsonSafe(canonicalOccurrence),
      canonicalPfr: deepCloneJsonSafe(canonicalPfr),
      unmapped: deepCloneJsonSafe(unmapped)
    };
  }

  var api = {
    translateLegacyPayment: translateLegacyPayment,
    translateLegacyVenuePayment: translateLegacyVenuePayment,
    translateLegacyVenuePaymentCollection: translateLegacyVenuePaymentCollection,
    translateLegacyRecurringPayment: translateLegacyRecurringPayment,
    translateLegacyPaymentAllocation: translateLegacyPaymentAllocation,
    translateLegacyVenue: translateLegacyVenue,
    translateLegacyVenueAgreement: translateLegacyVenueAgreement,
    translateLegacyOccurrence: translateLegacyOccurrence
  };

  global.MDJFinancialLegacyReadonlyAdapter = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
