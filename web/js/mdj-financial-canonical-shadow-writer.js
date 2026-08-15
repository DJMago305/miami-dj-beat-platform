/**
 * TICKET-V1-FINANCIAL-CONTROLLED-SHADOW-DUAL-WRITE-007F
 * Controlled, reversible, feature-flagged SHADOW write from the legacy
 * runtime (web/js/accounting-module.js) into an ISOLATED Canonical
 * Financial Core store, exclusively for equivalence verification. Never a
 * second operational writer.
 *
 * AUTHORITY (fixed for the lifetime of this file, per 007C/007F):
 *   LEGACY = operational writer. CANONICAL SHADOW = verification-only
 *   destination. If they diverge, LEGACY WINS — this file never corrects
 *   legacy, never blocks a legacy operation, never surfaces to UI.
 *
 * MUST NOT: touch window.localStorage, document, fetch, Supabase, or any
 * legacy `state` object — it only ever receives plain legacy-shaped
 * objects as arguments, exactly like mdj-financial-legacy-readonly-adapter.js.
 * MUST NOT: call recordPayment/confirmPayment/failPayment/allocatePayment/
 * createPayable/createVenueReceivable through anything other than
 * MDJFinancialLocalServices.commands.* — no reimplementation of the Core.
 * MUST NOT: derive any legacy->canonical mapping itself — every mapping
 * decision is delegated to MDJFinancialLegacyReadonlyAdapter (007D),
 * which remains untouched and readonly.
 * MUST NOT: call reconcilePayment — Reconciliation is explicitly out of
 * scope for this ticket.
 *
 * The feature flag (`CANONICAL_SHADOW_WRITE_ENABLED`, default OFF) lives
 * here, not in accounting-module.js. The only change to accounting-module.js
 * is a minimal, try/caught, flag-gated hook at the tail of executePayment()
 * and allocatePaymentExecution() that calls into this file through a
 * global lookup — if this file is never loaded, or the flag is OFF, the
 * hook is a no-op and legacy behaves exactly as it did before this ticket.
 */
(function (global) {
  'use strict';

  var Adapter = global.MDJFinancialLegacyReadonlyAdapter;
  var Core = global.MDJFinancialLocalServices.createLocalFinancialServices();

  function deepCloneJsonSafe(value) {
    if (value === undefined) return undefined;
    if (value === null || typeof value !== 'object') return value;
    return JSON.parse(JSON.stringify(value));
  }

  /* ---------------------------------------------------------------------
   * Feature flag — OFF by default. Local only: no remote config, no
   * Supabase, no environment secrets, never persisted.
   * ------------------------------------------------------------------- */
  var canonicalShadowWriteEnabled = false;

  function isCanonicalShadowWriteEnabled() {
    return canonicalShadowWriteEnabled === true;
  }

  function setCanonicalShadowWriteEnabled(value) {
    canonicalShadowWriteEnabled = value === true;
  }

  /* ---------------------------------------------------------------------
   * Isolated shadow store — created via the Core's own createStore(),
   * never merged with accounting-module.js `state`, never read by UI.
   * Shadow-writer-local index (legacyId -> Core-issued canonical id):
   * the Core assigns its own ids internally; this index is bookkeeping
   * owned entirely by this file, never persisted, never exposed as a
   * canonical entity itself.
   * ------------------------------------------------------------------- */
  var shadowStore = Core.createStore();
  /* paymentIndex is keyed by TWO different id shapes that never collide in
   * practice (different id prefixes): a plain legacyVenuePaymentId for
   * shadowVenuePaymentCollection() (one collection event = one Payment,
   * no multi-execution concept there), and an execution-scoped key for
   * shadowPaymentExecution() (TICKET-V1-SHADOW-MULTI-EXECUTION-PAYMENT-
   * FIX-001 — see deriveExecutionKey()) so that a single legacyPayment.id
   * that is executed more than once (legacy's own "partial stays eligible
   * for further execution" feature) produces one canonical Payment per
   * execution attempt, never a mutation of an already-terminal one. */
  var paymentIndex = Object.create(null); // executionKey|legacyVenuePaymentId -> canonical Payment id
  var payableIndex = Object.create(null); // legacyPaymentId -> canonical Payable id
  var venueReceivableIndex = Object.create(null); // legacyVenuePaymentId -> canonical VenueReceivable id
  var allocationIndex = Object.create(null); // legacyAllocationId -> canonical PaymentAllocation id
  var venueIndex = Object.create(null); // legacyVenueId -> canonical Venue id
  var venueAgreementIndex = Object.create(null); // legacyAgreementId -> canonical VenueAgreement id
  var occurrenceIndex = Object.create(null); // legacyOccurrenceId -> { occurrenceId, pfrId }
  var evidenceLog = [];

  function getShadowStoreSnapshot() {
    return deepCloneJsonSafe(shadowStore);
  }

  function getEvidenceLog() {
    return deepCloneJsonSafe(evidenceLog);
  }

  /* Test-only / rollback-only reset. Never called automatically, never
   * called from accounting-module.js. Rollback per 007C §7 is achieved by
   * turning the flag OFF (no new shadow writes) — this reset exists only
   * so tests can start from a clean isolated shadow store between cases,
   * and so a future controlled restart of the shadow phase has a defined,
   * explicit way to discard shadow-only evidence without touching legacy
   * or the canonical Core's own module (mdj-financial-local-services.js
   * is never mutated — only this file's local variables are reset). */
  function resetShadowState() {
    shadowStore = Core.createStore();
    paymentIndex = Object.create(null);
    payableIndex = Object.create(null);
    venueReceivableIndex = Object.create(null);
    allocationIndex = Object.create(null);
    venueIndex = Object.create(null);
    venueAgreementIndex = Object.create(null);
    occurrenceIndex = Object.create(null);
    evidenceLog = [];
  }

  function recordEvidence(entry) {
    evidenceLog.push(
      Object.assign(
        {
          legacyFactId: null,
          canonicalFactId: null,
          factType: null,
          expected: null,
          actual: null,
          reason: null,
          severity: 'INFO',
          timestamp: new Date().toISOString()
        },
        entry
      )
    );
  }

  /* ---------------------------------------------------------------------
   * Natural-key reuse lookup — TICKET-V1-FINANCIAL-SHADOW-OBLIGATION-
   * LIFECYCLE-WIRING-007L. Reproduces (read-only, never redefines) the
   * exact Payable natural key already enforced inside coreCreatePayable()
   * / payableKey() in mdj-financial-local-services.js — §6's documented
   * UNIQUE (sourceType, sourceId, payeeId, purpose). This function never
   * changes that key, never adds fields to it (e.g. never paymentId) —
   * it only searches the shadow store's own payables for a row that
   * would already collide under the Core's own rule, so a legitimate
   * reuse can be recognized instead of reported as an error. Written
   * generically enough (targetType-aware evidence, isolated helper) that
   * the same reuse-by-natural-key pattern can be mirrored for
   * VenueReceivable later — not implemented here (Occurrence alignment
   * stays explicitly out of scope, per 007L / 007F).
   * ------------------------------------------------------------------- */
  function findExistingPayableByNaturalKey(sourceType, sourceId, payeeId, purpose) {
    var key = [sourceType, sourceId || '', payeeId, purpose].join('::');
    return (
      shadowStore.payables.find(function (p) {
        return [p.sourceType, p.sourceId || '', p.payeeId, p.purpose].join('::') === key;
      }) || null
    );
  }

  /* ---------------------------------------------------------------------
   * Payable shadow (priority 4) — the only authorized place the Payable
   * Shadow is materialized. Called from the legacy obligation's own birth
   * moment (createPaymentFromInput(), the correct lifecycle boundary —
   * never from executePayment(), which only ever reuses via the index
   * below). Idempotent via shadow-local index + the Core's own
   * idempotencyKey replay + natural-key reuse (this ticket). Never uses
   * state.payments as a Payable — always goes through the adapter's
   * translation.
   * ------------------------------------------------------------------- */
  function shadowPayable(legacyPayment) {
    if (!legacyPayment || !legacyPayment.id) {
      return { ok: false, reason: 'INVALID_LEGACY_PAYMENT' };
    }

    var existing = payableIndex[legacyPayment.id];
    if (existing) {
      return { ok: true, payableId: existing, replayed: true };
    }

    var translated = Adapter.translateLegacyPayment(legacyPayment);
    if (!translated.canonicalPayable) {
      recordEvidence({
        legacyFactId: legacyPayment.id,
        factType: 'PAYABLE',
        expected: null,
        actual: null,
        reason: 'NO_CANONICAL_PAYABLE_FROM_ADAPTER',
        severity: 'INFO'
      });
      return { ok: false, reason: 'NO_CANONICAL_PAYABLE_FROM_ADAPTER' };
    }

    var cp = translated.canonicalPayable;
    var idemKey = 'legacy:shadow:payable:' + legacyPayment.id;
    var res = Core.commands.createPayable(shadowStore, {
      sourceType: cp.sourceType,
      sourceId: cp.sourceId,
      payeeType: cp.payeeType,
      payeeId: cp.payeeId,
      purpose: cp.purpose,
      amountCents: cp.amountCents,
      currency: cp.currency,
      dueDate: cp.dueDate,
      idempotencyKey: idemKey
    });

    if (!res.result.ok) {
      if (res.result.errorCode === 'DUPLICATE_IDEMPOTENCY_KEY') {
        var reused = findExistingPayableByNaturalKey(cp.sourceType, cp.sourceId, cp.payeeId, cp.purpose);
        if (reused) {
          payableIndex[legacyPayment.id] = reused.id;
          recordEvidence({
            legacyFactId: legacyPayment.id,
            canonicalFactId: reused.id,
            factType: 'PAYABLE',
            expected: cp,
            actual: { amountCents: reused.amountCents, currency: reused.currency, sourceType: reused.sourceType, sourceId: reused.sourceId, payeeId: reused.payeeId, purpose: reused.purpose },
            reason: 'REUSED',
            severity: 'REUSED'
          });
          return { ok: true, payableId: reused.id, reused: true };
        }
      }
      recordEvidence({
        legacyFactId: legacyPayment.id,
        factType: 'PAYABLE',
        expected: cp,
        actual: null,
        reason: 'CREATE_PAYABLE_FAILED:' + res.result.errorCode,
        severity: 'ERROR'
      });
      return { ok: false, reason: res.result.errorCode };
    }

    shadowStore = res.store;
    var payableId = res.result.data.id;
    payableIndex[legacyPayment.id] = payableId;

    var equivalenceOk = res.result.data.amountCents === cp.amountCents && res.result.data.currency === cp.currency;
    recordEvidence({
      legacyFactId: legacyPayment.id,
      canonicalFactId: payableId,
      factType: 'PAYABLE',
      expected: { amountCents: cp.amountCents, currency: cp.currency },
      actual: { amountCents: res.result.data.amountCents, currency: res.result.data.currency },
      reason: equivalenceOk ? 'MATCH' : 'DIVERGENCE',
      severity: equivalenceOk ? 'MATCH' : 'DIVERGENCE'
    });

    return { ok: true, payableId: payableId };
  }

  /* ---------------------------------------------------------------------
   * Venue shadow — TICKET-V1-FINANCIAL-SHADOW-OCCURRENCE-VENUE-RECEIVABLE-
   * ALIGNMENT-007M. Discovered during this ticket's mandatory pre-code
   * audit: coreCreateOccurrenceWithPfr() requires a real Venue already
   * present in the same store (`findById(store.venues, input.venueId)`),
   * exactly the same dependency shape already known for VenueReceivable→
   * Occurrence. No Core change — this only supplies the prerequisite.
   * ------------------------------------------------------------------- */
  function shadowVenue(legacyVenue) {
    if (!legacyVenue || !legacyVenue.id) {
      return { ok: false, reason: 'INVALID_LEGACY_VENUE' };
    }

    var existing = venueIndex[legacyVenue.id];
    if (existing) {
      return { ok: true, venueId: existing, replayed: true };
    }

    var translated = Adapter.translateLegacyVenue(legacyVenue);
    if (!translated.canonicalVenue) {
      recordEvidence({
        legacyFactId: legacyVenue.id,
        factType: 'VENUE',
        expected: null,
        actual: null,
        reason: 'NO_CANONICAL_VENUE_FROM_ADAPTER',
        severity: 'INFO'
      });
      return { ok: false, reason: 'NO_CANONICAL_VENUE_FROM_ADAPTER' };
    }

    var cv = translated.canonicalVenue;
    var idemKey = 'legacy:shadow:venue:' + legacyVenue.id;
    var res = Core.commands.createVenue(shadowStore, {
      name: cv.name,
      address: cv.address,
      contactName: cv.contactName,
      contactPhone: cv.contactPhone,
      contactEmail: cv.contactEmail,
      idempotencyKey: idemKey
    });

    if (!res.result.ok) {
      recordEvidence({
        legacyFactId: legacyVenue.id,
        factType: 'VENUE',
        expected: cv,
        actual: null,
        reason: 'CREATE_VENUE_FAILED:' + res.result.errorCode,
        severity: 'ERROR'
      });
      return { ok: false, reason: res.result.errorCode };
    }

    shadowStore = res.store;
    var venueId = res.result.data.id;
    venueIndex[legacyVenue.id] = venueId;

    var equivalenceOk = res.result.data.name === cv.name;
    recordEvidence({
      legacyFactId: legacyVenue.id,
      canonicalFactId: venueId,
      factType: 'VENUE',
      expected: { name: cv.name },
      actual: { name: res.result.data.name },
      reason: equivalenceOk ? 'MATCH' : 'DIVERGENCE',
      severity: equivalenceOk ? 'MATCH' : 'DIVERGENCE'
    });

    return { ok: true, venueId: venueId };
  }

  /* ---------------------------------------------------------------------
   * VenueAgreement shadow. Depends on the Venue already being shadowed —
   * never fabricates one (coreCreateVenueAgreement itself requires a real
   * store.venues row).
   * ------------------------------------------------------------------- */
  function shadowVenueAgreement(legacyAgreement) {
    if (!legacyAgreement || !legacyAgreement.id) {
      return { ok: false, reason: 'INVALID_LEGACY_AGREEMENT' };
    }

    var existing = venueAgreementIndex[legacyAgreement.id];
    if (existing) {
      return { ok: true, venueAgreementId: existing, replayed: true };
    }

    var translated = Adapter.translateLegacyVenueAgreement(legacyAgreement);
    if (!translated.canonicalVenueAgreement) {
      recordEvidence({
        legacyFactId: legacyAgreement.id,
        factType: 'VENUE_AGREEMENT',
        expected: null,
        actual: null,
        reason: 'NO_CANONICAL_VENUE_AGREEMENT_FROM_ADAPTER',
        severity: 'INFO'
      });
      return { ok: false, reason: 'NO_CANONICAL_VENUE_AGREEMENT_FROM_ADAPTER' };
    }

    var ca = translated.canonicalVenueAgreement;
    var shadowVenueId = venueIndex[legacyAgreement.venueId];
    if (!shadowVenueId) {
      recordEvidence({
        legacyFactId: legacyAgreement.id,
        factType: 'VENUE_AGREEMENT',
        expected: ca,
        actual: null,
        reason: 'SKIPPED_MISSING_VENUE_DEPENDENCY',
        severity: 'WARN'
      });
      return { ok: false, reason: 'SKIPPED_MISSING_VENUE_DEPENDENCY' };
    }

    var idemKey = 'legacy:shadow:venueAgreement:' + legacyAgreement.id;
    var res = Core.commands.createVenueAgreement(shadowStore, {
      venueId: shadowVenueId,
      title: ca.title,
      frequency: ca.frequency,
      scheduledDays: ca.scheduledDays,
      rateByDay: ca.rateByDay,
      currency: ca.currency,
      effectiveFrom: ca.effectiveFrom,
      effectiveUntil: ca.effectiveUntil,
      idempotencyKey: idemKey
    });

    if (!res.result.ok) {
      recordEvidence({
        legacyFactId: legacyAgreement.id,
        factType: 'VENUE_AGREEMENT',
        expected: ca,
        actual: null,
        reason: 'CREATE_VENUE_AGREEMENT_FAILED:' + res.result.errorCode,
        severity: 'ERROR'
      });
      return { ok: false, reason: res.result.errorCode };
    }

    shadowStore = res.store;
    var agreementId = res.result.data.id;
    venueAgreementIndex[legacyAgreement.id] = agreementId;

    var equivalenceOk = res.result.data.frequency === ca.frequency && res.result.data.currency === ca.currency;
    recordEvidence({
      legacyFactId: legacyAgreement.id,
      canonicalFactId: agreementId,
      factType: 'VENUE_AGREEMENT',
      expected: { frequency: ca.frequency, currency: ca.currency },
      actual: { frequency: res.result.data.frequency, currency: res.result.data.currency },
      reason: equivalenceOk ? 'MATCH' : 'DIVERGENCE',
      severity: equivalenceOk ? 'MATCH' : 'DIVERGENCE'
    });

    return { ok: true, venueAgreementId: agreementId };
  }

  /* ---------------------------------------------------------------------
   * Occurrence (+ PFR) shadow — the PRIMARY GENESIS POINT this ticket
   * exists to wire. Uses only the Core's existing createOccurrenceWithPfr
   * (creates both atomically, exactly matching the canonical contract —
   * never an orphaned Occurrence, never an orphaned PFR). Depends on the
   * Venue (and, when the legacy occurrence has one, the VenueAgreement)
   * already being shadowed — never fabricates either.
   * ------------------------------------------------------------------- */
  function shadowOccurrence(legacyOccurrence) {
    if (!legacyOccurrence || !legacyOccurrence.id) {
      return { ok: false, reason: 'INVALID_LEGACY_OCCURRENCE' };
    }

    var existing = occurrenceIndex[legacyOccurrence.id];
    if (existing) {
      return { ok: true, occurrenceId: existing.occurrenceId, pfrId: existing.pfrId, replayed: true };
    }

    var translated = Adapter.translateLegacyOccurrence(legacyOccurrence);
    if (!translated.canonicalOccurrence) {
      recordEvidence({
        legacyFactId: legacyOccurrence.id,
        factType: 'OCCURRENCE',
        expected: null,
        actual: null,
        reason: 'NO_CANONICAL_OCCURRENCE_FROM_ADAPTER',
        severity: 'INFO'
      });
      return { ok: false, reason: 'NO_CANONICAL_OCCURRENCE_FROM_ADAPTER' };
    }

    var co = translated.canonicalOccurrence;
    var pfr = translated.canonicalPfr;

    var shadowVenueId = venueIndex[legacyOccurrence.venueId];
    if (!shadowVenueId) {
      recordEvidence({
        legacyFactId: legacyOccurrence.id,
        factType: 'OCCURRENCE',
        expected: co,
        actual: null,
        reason: 'SKIPPED_MISSING_VENUE_DEPENDENCY',
        severity: 'WARN'
      });
      return { ok: false, reason: 'SKIPPED_MISSING_VENUE_DEPENDENCY' };
    }

    var shadowAgreementId = null;
    if (legacyOccurrence.agreementId) {
      shadowAgreementId = venueAgreementIndex[legacyOccurrence.agreementId];
      if (!shadowAgreementId) {
        recordEvidence({
          legacyFactId: legacyOccurrence.id,
          factType: 'OCCURRENCE',
          expected: co,
          actual: null,
          reason: 'SKIPPED_MISSING_AGREEMENT_DEPENDENCY',
          severity: 'WARN'
        });
        return { ok: false, reason: 'SKIPPED_MISSING_AGREEMENT_DEPENDENCY' };
      }
    }

    var idemKey = 'legacy:shadow:occurrence:' + legacyOccurrence.id;
    var res = Core.commands.createOccurrenceWithPfr(shadowStore, {
      venueId: shadowVenueId,
      agreementId: shadowAgreementId,
      assignedProfileId: pfr.assignedProfileId,
      date: co.date,
      shift: co.shift,
      rateAmountCents: pfr.rateAmountCents,
      currency: pfr.currency,
      expectedArtistPayoutCents: pfr.expectedArtistPayoutCents,
      idempotencyKey: idemKey
    });

    if (!res.result.ok) {
      recordEvidence({
        legacyFactId: legacyOccurrence.id,
        factType: 'OCCURRENCE',
        expected: co,
        actual: null,
        reason: 'CREATE_OCCURRENCE_FAILED:' + res.result.errorCode,
        severity: 'ERROR'
      });
      return { ok: false, reason: res.result.errorCode };
    }

    shadowStore = res.store;
    var occurrenceId = res.result.data.occurrence.id;
    var pfrId = res.result.data.pfr.id;
    occurrenceIndex[legacyOccurrence.id] = { occurrenceId: occurrenceId, pfrId: pfrId };

    var equivalenceOk =
      res.result.data.occurrence.date === co.date &&
      res.result.data.occurrence.status === co.status &&
      res.result.data.pfr.rateAmountCents === pfr.rateAmountCents;
    recordEvidence({
      legacyFactId: legacyOccurrence.id,
      canonicalFactId: occurrenceId,
      factType: 'OCCURRENCE',
      expected: { date: co.date, status: co.status, rateAmountCents: pfr.rateAmountCents },
      actual: { date: res.result.data.occurrence.date, status: res.result.data.occurrence.status, rateAmountCents: res.result.data.pfr.rateAmountCents },
      reason: equivalenceOk ? 'MATCH' : 'DIVERGENCE',
      severity: equivalenceOk ? 'MATCH' : 'DIVERGENCE'
    });

    return { ok: true, occurrenceId: occurrenceId, pfrId: pfrId };
  }

  /* ---------------------------------------------------------------------
   * Occurrence cancellation shadow — reuses the Core's own
   * cancelOccurrence() command (never reimplemented here). Only mirrors a
   * legacy cancellation when the Occurrence was already shadowed; never
   * fabricates one just to cancel it.
   * ------------------------------------------------------------------- */
  function shadowOccurrenceCancellation(legacyOccurrenceId) {
    var existing = occurrenceIndex[legacyOccurrenceId];
    if (!existing) {
      recordEvidence({
        legacyFactId: legacyOccurrenceId,
        factType: 'OCCURRENCE_CANCELLATION',
        expected: null,
        actual: null,
        reason: 'SKIPPED_OCCURRENCE_NOT_SHADOWED_YET',
        severity: 'INFO'
      });
      return { ok: false, reason: 'SKIPPED_OCCURRENCE_NOT_SHADOWED_YET' };
    }

    var idemKey = 'legacy:shadow:cancelOccurrence:' + legacyOccurrenceId;
    var res = Core.commands.cancelOccurrence(shadowStore, { occurrenceId: existing.occurrenceId, idempotencyKey: idemKey });

    if (!res.result.ok) {
      recordEvidence({
        legacyFactId: legacyOccurrenceId,
        canonicalFactId: existing.occurrenceId,
        factType: 'OCCURRENCE_CANCELLATION',
        expected: { status: 'CANCELLED' },
        actual: null,
        reason: 'CANCEL_OCCURRENCE_FAILED:' + res.result.errorCode,
        severity: 'ERROR'
      });
      return { ok: false, reason: res.result.errorCode };
    }

    shadowStore = res.store;
    recordEvidence({
      legacyFactId: legacyOccurrenceId,
      canonicalFactId: existing.occurrenceId,
      factType: 'OCCURRENCE_CANCELLATION',
      expected: { status: 'CANCELLED' },
      actual: { status: res.result.data.occurrence.status },
      reason: 'MATCH',
      severity: 'MATCH'
    });
    return { ok: true, occurrenceId: existing.occurrenceId };
  }

  /* ---------------------------------------------------------------------
   * VenueReceivable shadow (priority 4). Now that Occurrence shadowing
   * exists (this ticket), the real canonical occurrenceId is looked up
   * via occurrenceIndex instead of passing the legacy id through — for a
   * VALID occurrence (already shadowed via its own genesis point) this
   * resolves the SKIPPED_MISSING_OCCURRENCE_DEPENDENCY limitation known
   * since 007F. For an occurrence that genuinely was never shadowed (not
   * yet created, or invalid), the same dependency guard still applies —
   * never fabricated.
   * ------------------------------------------------------------------- */
  function shadowVenueReceivable(legacyVenuePayment) {
    if (!legacyVenuePayment || !legacyVenuePayment.id) {
      return { ok: false, reason: 'INVALID_LEGACY_VENUE_PAYMENT' };
    }

    var existing = venueReceivableIndex[legacyVenuePayment.id];
    if (existing) {
      return { ok: true, venueReceivableId: existing, replayed: true };
    }

    var translated = Adapter.translateLegacyVenuePayment(legacyVenuePayment);
    var cv = translated.canonicalVenueReceivable;

    var shadowOccurrenceEntry = occurrenceIndex[legacyVenuePayment.occurrenceId];
    if (!shadowOccurrenceEntry) {
      recordEvidence({
        legacyFactId: legacyVenuePayment.id,
        factType: 'VENUE_RECEIVABLE',
        expected: cv,
        actual: null,
        reason: 'SKIPPED_MISSING_OCCURRENCE_DEPENDENCY',
        severity: 'WARN'
      });
      return { ok: false, reason: 'SKIPPED_MISSING_OCCURRENCE_DEPENDENCY' };
    }

    var idemKey = 'legacy:shadow:venueReceivable:' + legacyVenuePayment.id;
    var res = Core.commands.createVenueReceivable(shadowStore, {
      occurrenceId: shadowOccurrenceEntry.occurrenceId,
      amountCents: cv.amountCents,
      currency: cv.currency,
      dueDate: cv.dueDate,
      idempotencyKey: idemKey
    });

    if (!res.result.ok) {
      recordEvidence({
        legacyFactId: legacyVenuePayment.id,
        factType: 'VENUE_RECEIVABLE',
        expected: cv,
        actual: null,
        reason: 'CREATE_VENUE_RECEIVABLE_FAILED:' + res.result.errorCode,
        severity: 'ERROR'
      });
      return { ok: false, reason: res.result.errorCode, coreErrorCode: res.result.errorCode };
    }

    shadowStore = res.store;
    var venueReceivableId = res.result.data.id;
    venueReceivableIndex[legacyVenuePayment.id] = venueReceivableId;

    var equivalenceOk = res.result.data.amountCents === cv.amountCents && res.result.data.currency === cv.currency;
    recordEvidence({
      legacyFactId: legacyVenuePayment.id,
      canonicalFactId: venueReceivableId,
      factType: 'VENUE_RECEIVABLE',
      expected: { amountCents: cv.amountCents, currency: cv.currency },
      actual: { amountCents: res.result.data.amountCents, currency: res.result.data.currency },
      reason: equivalenceOk ? 'MATCH' : 'DIVERGENCE',
      severity: equivalenceOk ? 'MATCH' : 'DIVERGENCE'
    });

    return { ok: true, venueReceivableId: venueReceivableId };
  }

  /* ---------------------------------------------------------------------
   * TICKET-V1-FINANCIAL-ENTRY-TO-CANONICAL-WIRING-001 — venue receivable
   * collection shadow. Composes recordPayment + confirmPayment +
   * allocatePayment(VENUE_RECEIVABLE) against the VenueReceivable already
   * shadowed by shadowVenueReceivable() (looked up via the same
   * venueReceivableIndex, by legacy id — never a second index, never a
   * parallel receivable). Deliberately never creates or touches a
   * Payable — this direction has none (see the adapter's own note on
   * translateLegacyVenuePaymentCollection()).
   * ------------------------------------------------------------------- */
  function shadowVenuePaymentCollection(legacyVenuePayment) {
    if (!legacyVenuePayment || !legacyVenuePayment.id) {
      return { ok: false, reason: 'INVALID_LEGACY_VENUE_PAYMENT' };
    }

    var translated = Adapter.translateLegacyVenuePaymentCollection(legacyVenuePayment);
    if (!translated.canonicalPayment) {
      recordEvidence({
        legacyFactId: legacyVenuePayment.id,
        factType: 'VENUE_PAYMENT_COLLECTION',
        expected: 'no canonical Payment for this legacy status',
        actual: 'no canonical Payment written',
        reason: 'NO_MOVEMENT_TO_SHADOW_FOR_THIS_STATUS',
        severity: 'INFO'
      });
      return { ok: true, skipped: true, reason: 'NOT_YET_COLLECTED' };
    }

    var receivableId = venueReceivableIndex[legacyVenuePayment.id];
    if (!receivableId) {
      recordEvidence({
        legacyFactId: legacyVenuePayment.id,
        factType: 'VENUE_PAYMENT_COLLECTION',
        expected: translated.canonicalPayment,
        actual: null,
        reason: 'SKIPPED_MISSING_VENUE_RECEIVABLE_DEPENDENCY',
        severity: 'WARN'
      });
      return { ok: false, reason: 'SKIPPED_MISSING_VENUE_RECEIVABLE_DEPENDENCY' };
    }

    var cpay = translated.canonicalPayment;
    var paymentId = paymentIndex[legacyVenuePayment.id];
    var replayed = !!paymentId;

    if (!paymentId) {
      var recordRes = Core.commands.recordPayment(shadowStore, {
        direction: cpay.direction,
        amountCents: cpay.amountCents,
        currency: cpay.currency,
        method: cpay.method,
        account: cpay.account,
        paymentDate: cpay.paymentDate,
        reference: cpay.reference,
        idempotencyKey: cpay.idempotencyKey
      });
      if (!recordRes.result.ok) {
        recordEvidence({
          legacyFactId: legacyVenuePayment.id,
          factType: 'VENUE_PAYMENT_COLLECTION',
          expected: cpay,
          actual: null,
          reason: 'RECORD_PAYMENT_FAILED:' + recordRes.result.errorCode,
          severity: 'ERROR'
        });
        return { ok: false, reason: recordRes.result.errorCode };
      }
      shadowStore = recordRes.store;
      paymentId = recordRes.result.data.id;
      paymentIndex[legacyVenuePayment.id] = paymentId;

      var confirmRes = Core.commands.confirmPayment(shadowStore, {
        paymentId: paymentId,
        idempotencyKey: 'legacy:shadow:confirm:venuePaymentCollection:' + legacyVenuePayment.id
      });
      if (!confirmRes.result.ok) {
        recordEvidence({
          legacyFactId: legacyVenuePayment.id,
          canonicalFactId: paymentId,
          factType: 'VENUE_PAYMENT_COLLECTION',
          expected: { status: 'CONFIRMED' },
          actual: null,
          reason: 'CONFIRM_PAYMENT_FAILED:' + confirmRes.result.errorCode,
          severity: 'ERROR'
        });
        return { ok: false, reason: confirmRes.result.errorCode };
      }
      shadowStore = confirmRes.store;

      var allocRes = Core.commands.allocatePayment(shadowStore, {
        paymentId: paymentId,
        targetType: 'VENUE_RECEIVABLE',
        targetId: receivableId,
        amountCents: cpay.amountCents,
        idempotencyKey: 'legacy:shadow:allocateCollection:' + legacyVenuePayment.id
      });
      if (!allocRes.result.ok) {
        recordEvidence({
          legacyFactId: legacyVenuePayment.id,
          canonicalFactId: paymentId,
          factType: 'VENUE_PAYMENT_COLLECTION',
          expected: { targetId: receivableId, amountCents: cpay.amountCents },
          actual: null,
          reason: 'ALLOCATE_PAYMENT_FAILED:' + allocRes.result.errorCode,
          severity: 'ERROR'
        });
        return { ok: false, reason: allocRes.result.errorCode };
      }
      shadowStore = allocRes.store;
    }

    var finalReceivable = shadowStore.venueReceivables.filter(function (r) {
      return r.id === receivableId;
    })[0];
    var equivalenceOk = !!finalReceivable && finalReceivable.status === 'PAID';
    recordEvidence({
      legacyFactId: legacyVenuePayment.id,
      canonicalFactId: paymentId,
      factType: 'VENUE_PAYMENT_COLLECTION',
      expected: { receivableStatus: 'PAID', amountCents: cpay.amountCents },
      actual: { receivableStatus: finalReceivable ? finalReceivable.status : null },
      reason: equivalenceOk ? (replayed ? 'MATCH_REPLAYED' : 'MATCH') : 'DIVERGENCE',
      severity: equivalenceOk ? 'MATCH' : 'DIVERGENCE'
    });

    return { ok: true, paymentId: paymentId, replayed: replayed };
  }

  /* ---------------------------------------------------------------------
   * TICKET-V1-SHADOW-MULTI-EXECUTION-PAYMENT-FIX-001 — a single
   * legacyPayment.id can legitimately be executed more than once (legacy's
   * own "partial stays eligible for further execution" feature,
   * accounting-module.js getPaymentExecutionEligibility(): a 'partial' row
   * with remaining balance stays eligible, so it can go partial->failed,
   * partial->paid, partial->partial->paid, etc). Each such execution is a
   * separate, real financial fact and must become its own canonical
   * Payment — the Core itself enforces this by design (coreConfirmPayment/
   * coreFailPayment both require p.status==='PENDING' and reject any other
   * transition with INVALID_STATE_TRANSITION; a CONFIRMED or FAILED
   * Payment is immutable, never re-transitioned).
   *
   * `executionMeta` is the legacy paymentExecutions[] record that
   * executePayment() already builds for every call (id via newId('exec'),
   * unique per attempt) — reused verbatim as the correlation identity,
   * never a parallel id invented here. When it (or its `id`) is absent —
   * defensive only, the sole current caller always supplies it — a
   * deterministic fallback is derived from the legacy payment's own
   * mutated fields, which changes exactly when a new execution changes
   * legacy's own state and is stable for repeated calls describing the
   * same execution.
   * ------------------------------------------------------------------- */
  function deriveExecutionKey(legacyPayment, executionMeta) {
    if (executionMeta && executionMeta.id) {
      return 'exec:' + String(executionMeta.id);
    }
    return (
      'fallback:' +
      String(legacyPayment.id) +
      ':' +
      String(legacyPayment.updatedAt || '') +
      ':' +
      String(legacyPayment.status || '') +
      ':' +
      String(legacyPayment.paidAmount != null ? legacyPayment.paidAmount : '')
    );
  }

  /* ---------------------------------------------------------------------
   * Payment execution shadow (priorities 1 and 2 — a legacy payment that
   * reached a confirmed or failed movement state). Never writes an
   * Allocation itself — legacy keeps execution (executePayment) and
   * allocation (allocatePaymentExecution) as two separate steps, and so
   * does the shadow: shadowAllocation() is the only place an Allocation
   * is created, exactly mirroring legacy's own two-step model.
   *
   * Explicitly never converts legacy 'partial' into a canonical
   * Payment.status of 'PARTIAL' (that value does not exist on canonical
   * Payment, §6) — partiality is expressed only through a Payable's
   * derived balance once an Allocation exists (shadowAllocation).
   *
   * One canonical Payment per EXECUTION (see deriveExecutionKey above),
   * never per legacyPayment.id — see TICKET-V1-SHADOW-MULTI-EXECUTION-
   * PAYMENT-FIX-001. The Payable side (shadowPayable, below) is untouched
   * by this and stays correlated by legacyPayment.id alone, since one
   * legacy row has exactly one obligation regardless of how many times it
   * gets executed.
   * ------------------------------------------------------------------- */
  function shadowPaymentExecution(legacyPayment, executionMeta) {
    if (!legacyPayment || !legacyPayment.id) {
      return { ok: false, reason: 'INVALID_LEGACY_PAYMENT' };
    }

    var translated = Adapter.translateLegacyPayment(legacyPayment);

    var payableResult = translated.canonicalPayable ? shadowPayable(legacyPayment) : null;

    if (!translated.canonicalPayment) {
      recordEvidence({
        legacyFactId: legacyPayment.id,
        factType: 'PAYMENT_EXECUTION',
        expected: 'no canonical Payment for this legacy status',
        actual: 'no canonical Payment written',
        reason: 'NO_MOVEMENT_TO_SHADOW_FOR_THIS_STATUS',
        severity: 'INFO'
      });
      return { ok: true, skipped: true, reason: 'NO_CANONICAL_PAYMENT_FOR_THIS_LEGACY_STATUS', payableResult: payableResult };
    }

    var cpay = translated.canonicalPayment;
    var executionKey = deriveExecutionKey(legacyPayment, executionMeta);
    var paymentId = paymentIndex[executionKey];
    var replayed = !!paymentId;

    /* cpay.amountCents (from the adapter, untouched) is derived from
     * legacyPayment.paidAmount — a CUMULATIVE running total on the legacy
     * hybrid row, not a per-execution figure. That is correct for a
     * single-execution reading, but wrong once a second execution moves
     * more money against the same row: the canonical Payment for THAT
     * execution must represent what moved IN THAT EXECUTION (deltaPaid),
     * never the running total (which would double-count against the
     * Payable once each execution's Payment is separately allocated).
     * executionMeta.deltaPaid (accounting-module.js executePayment(),
     * already computed, already real) is the correct source for this —
     * used only to refine the amount of a CONFIRMED movement; a FAILED
     * attempt keeps using the adapter's full-amount convention unchanged
     * (an attempt has no partial "delta" of its own to speak of). */
    var expectedAmountCents = cpay.amountCents;
    if (cpay.status === 'CONFIRMED' && executionMeta && executionMeta.deltaPaid != null) {
      var deltaCentsCandidate = Math.round(Number(executionMeta.deltaPaid) * 100);
      if (isFinite(deltaCentsCandidate) && deltaCentsCandidate >= 0) {
        expectedAmountCents = deltaCentsCandidate;
      }
    }

    if (!paymentId) {
      var recordRes = Core.commands.recordPayment(shadowStore, {
        direction: cpay.direction,
        amountCents: expectedAmountCents,
        currency: cpay.currency,
        method: cpay.method,
        account: cpay.account,
        paymentDate: cpay.paymentDate,
        reference: cpay.reference,
        /* Scoped to this execution, not cpay.idempotencyKey (the adapter's
         * key is a pure function of legacyPayment.id alone and would
         * collide across multiple executions of the same row — the
         * adapter itself is out of scope to change here, so the
         * per-execution scoping happens on this side of the boundary). */
        idempotencyKey: 'legacy:shadow:record:' + executionKey
      });
      if (!recordRes.result.ok) {
        recordEvidence({
          legacyFactId: legacyPayment.id,
          factType: 'PAYMENT_EXECUTION',
          expected: cpay,
          actual: null,
          reason: 'RECORD_PAYMENT_FAILED:' + recordRes.result.errorCode,
          severity: 'ERROR'
        });
        return { ok: false, reason: recordRes.result.errorCode, payableResult: payableResult };
      }
      shadowStore = recordRes.store;
      paymentId = recordRes.result.data.id;
      paymentIndex[executionKey] = paymentId;
    }

    var currentPayment = shadowStore.payments.filter(function (p) {
      return p.id === paymentId;
    })[0];

    if (currentPayment.status === 'PENDING') {
      if (cpay.status === 'CONFIRMED') {
        var confirmRes = Core.commands.confirmPayment(shadowStore, {
          paymentId: paymentId,
          idempotencyKey: 'legacy:shadow:confirm:' + executionKey
        });
        if (!confirmRes.result.ok) {
          recordEvidence({
            legacyFactId: legacyPayment.id,
            canonicalFactId: paymentId,
            factType: 'PAYMENT_EXECUTION',
            expected: { status: 'CONFIRMED' },
            actual: { status: currentPayment.status },
            reason: 'CONFIRM_PAYMENT_FAILED:' + confirmRes.result.errorCode,
            severity: 'ERROR'
          });
          return { ok: false, reason: confirmRes.result.errorCode, payableResult: payableResult };
        }
        shadowStore = confirmRes.store;
      } else if (cpay.status === 'FAILED') {
        var failRes = Core.commands.failPayment(shadowStore, {
          paymentId: paymentId,
          reason: 'legacy_execution_failed',
          idempotencyKey: 'legacy:shadow:fail:' + executionKey
        });
        if (!failRes.result.ok) {
          recordEvidence({
            legacyFactId: legacyPayment.id,
            canonicalFactId: paymentId,
            factType: 'PAYMENT_EXECUTION',
            expected: { status: 'FAILED' },
            actual: { status: currentPayment.status },
            reason: 'FAIL_PAYMENT_FAILED:' + failRes.result.errorCode,
            severity: 'ERROR'
          });
          return { ok: false, reason: failRes.result.errorCode, payableResult: payableResult };
        }
        shadowStore = failRes.store;
      }
    }
    /* No `else` branch mutates a non-PENDING currentPayment under any
     * circumstance — a Payment already CONFIRMED/FAILED from a prior
     * execution is never touched; a genuinely new execution always gets a
     * fresh paymentId from the block above instead. */

    var finalPayment = shadowStore.payments.filter(function (p) {
      return p.id === paymentId;
    })[0];

    var equivalenceOk = finalPayment.status === cpay.status && finalPayment.amountCents === expectedAmountCents && finalPayment.currency === cpay.currency;
    recordEvidence({
      legacyFactId: legacyPayment.id,
      canonicalFactId: paymentId,
      factType: 'PAYMENT_EXECUTION',
      expected: { status: cpay.status, amountCents: expectedAmountCents, currency: cpay.currency, executionKey: executionKey },
      actual: { status: finalPayment.status, amountCents: finalPayment.amountCents, currency: finalPayment.currency },
      reason: equivalenceOk ? (replayed ? 'MATCH_REPLAYED' : 'MATCH') : 'DIVERGENCE',
      severity: equivalenceOk ? 'MATCH' : 'DIVERGENCE'
    });

    return { ok: true, paymentId: paymentId, replayed: replayed, executionKey: executionKey, payableResult: payableResult };
  }

  /* ---------------------------------------------------------------------
   * Allocation shadow (priority 3). Requires the referenced canonical
   * Payment and target (Payable/VenueReceivable) to already exist in the
   * shadow store (created by prior shadowPaymentExecution/shadowPayable/
   * shadowVenueReceivable calls) — never creates them out of order,
   * never fabricates a target. A missing dependency is reported plainly,
   * never silently skipped without evidence.
   * ------------------------------------------------------------------- */
  function shadowAllocation(legacyAllocation) {
    if (!legacyAllocation || !legacyAllocation.id) {
      return { ok: false, reason: 'INVALID_LEGACY_ALLOCATION' };
    }

    var existing = allocationIndex[legacyAllocation.id];
    if (existing) {
      return { ok: true, allocationId: existing, replayed: true };
    }

    var translated = Adapter.translateLegacyPaymentAllocation(legacyAllocation);
    var ca = translated.canonicalPaymentAllocation;

    if (!ca.targetType || !ca.targetId) {
      recordEvidence({
        legacyFactId: legacyAllocation.id,
        factType: 'ALLOCATION',
        expected: ca,
        actual: null,
        reason: 'NO_TARGET_REFERENCE_CANNOT_SHADOW',
        severity: 'INFO'
      });
      return { ok: false, reason: 'NO_TARGET_REFERENCE' };
    }

    /* TICKET-V1-SHADOW-MULTI-EXECUTION-PAYMENT-FIX-001 — paymentIndex is
     * now keyed per execution (see deriveExecutionKey), not per
     * legacyPayment.id, because one legacy payment row can have several
     * canonical Payments (one per execution attempt). An Allocation must
     * resolve to the SPECIFIC execution's Payment, never "whichever one
     * happened to be shadowed last" — accounting-module.js's
     * allocatePaymentExecution() already carries this identity verbatim
     * (`executionId: execution.id`, the same real execution id passed to
     * shadowPaymentExecution() via executionMeta), so no new field is
     * invented here, only reused. legacyAllocation.paymentId is kept as a
     * defensive fallback for any allocation record that somehow lacks
     * executionId — never hit by the current, single real caller. */
    var shadowPaymentId = legacyAllocation.executionId
      ? paymentIndex['exec:' + legacyAllocation.executionId]
      : paymentIndex[legacyAllocation.paymentId];
    if (!shadowPaymentId) {
      recordEvidence({
        legacyFactId: legacyAllocation.id,
        factType: 'ALLOCATION',
        expected: ca,
        actual: null,
        reason: 'DEPENDENCY_MISSING_PAYMENT_NOT_SHADOWED_YET',
        severity: 'WARN'
      });
      return { ok: false, reason: 'DEPENDENCY_MISSING_PAYMENT' };
    }

    var legacyTargetId = legacyAllocation.receivableId || legacyAllocation.payableId;
    var targetIndex = legacyAllocation.receivableId ? venueReceivableIndex : payableIndex;
    var shadowTargetId = targetIndex[legacyTargetId];
    if (!shadowTargetId) {
      recordEvidence({
        legacyFactId: legacyAllocation.id,
        factType: 'ALLOCATION',
        expected: ca,
        actual: null,
        reason: 'DEPENDENCY_MISSING_TARGET_NOT_SHADOWED_YET',
        severity: 'WARN'
      });
      return { ok: false, reason: 'DEPENDENCY_MISSING_TARGET' };
    }

    var idemKey = 'legacy:shadow:allocation:' + legacyAllocation.id;
    var res = Core.commands.allocatePayment(shadowStore, {
      paymentId: shadowPaymentId,
      targetType: ca.targetType,
      targetId: shadowTargetId,
      amountCents: ca.amountCents,
      idempotencyKey: idemKey
    });

    if (!res.result.ok) {
      recordEvidence({
        legacyFactId: legacyAllocation.id,
        factType: 'ALLOCATION',
        expected: ca,
        actual: null,
        reason: 'ALLOCATE_PAYMENT_FAILED:' + res.result.errorCode,
        severity: 'ERROR'
      });
      return { ok: false, reason: res.result.errorCode };
    }

    shadowStore = res.store;
    var allocationId = res.result.data.allocation.id;
    allocationIndex[legacyAllocation.id] = allocationId;

    var equivalenceOk = res.result.data.allocation.amountCents === ca.amountCents && res.result.data.allocation.targetType === ca.targetType;
    recordEvidence({
      legacyFactId: legacyAllocation.id,
      canonicalFactId: allocationId,
      factType: 'ALLOCATION',
      expected: { amountCents: ca.amountCents, targetType: ca.targetType },
      actual: { amountCents: res.result.data.allocation.amountCents, targetType: res.result.data.allocation.targetType },
      reason: equivalenceOk ? 'MATCH' : 'DIVERGENCE',
      severity: equivalenceOk ? 'MATCH' : 'DIVERGENCE'
    });

    return { ok: true, allocationId: allocationId };
  }

  var api = {
    isCanonicalShadowWriteEnabled: isCanonicalShadowWriteEnabled,
    setCanonicalShadowWriteEnabled: setCanonicalShadowWriteEnabled,
    shadowPaymentExecution: shadowPaymentExecution,
    shadowAllocation: shadowAllocation,
    shadowPayable: shadowPayable,
    shadowVenue: shadowVenue,
    shadowVenueAgreement: shadowVenueAgreement,
    shadowOccurrence: shadowOccurrence,
    shadowOccurrenceCancellation: shadowOccurrenceCancellation,
    shadowVenueReceivable: shadowVenueReceivable,
    shadowVenuePaymentCollection: shadowVenuePaymentCollection,
    getShadowStoreSnapshot: getShadowStoreSnapshot,
    getEvidenceLog: getEvidenceLog,
    resetShadowState: resetShadowState
  };

  global.MDJFinancialCanonicalShadowWriter = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
