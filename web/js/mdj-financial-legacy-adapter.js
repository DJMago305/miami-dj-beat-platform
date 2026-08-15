/**
 * TICKET-V1-FINANCIAL-LEGACY-ADAPTER-READONLY-006
 * TICKET-V1-FINANCIAL-LEGACY-ADAPTER-MINIMAL-CORRECTION-008
 * Pure, isolated, readonly adapter: mdjb_accounting_local_v1 (raw JSON) -> canonical
 * financial shapes defined in docs/architecture/MIAMI-DJ-BEAT-V1-CANONICAL-FINANCIAL-ARCHITECTURE.md.
 *
 * MUST NOT: touch window.localStorage, document, fetch, Supabase, browser APIs,
 * filesystem, Date.now(), Math.random(), or any non-deterministic source.
 * MUST NOT: mutate the input object/arrays.
 * Not imported by any runtime module. Not wired to any UI in this ticket.
 *
 * Synthetic ids (legacy-synthetic-*) are never UUID canónicos and must never be
 * used as financial idempotency keys — see legacy.syntheticIdStability.
 */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------
   * Generic helpers (pure)
   * ------------------------------------------------------------------- */

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function asArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function toAmountCents(rawAmount) {
    var n = Number(rawAmount);
    if (!isFinite(n)) return null;
    return Math.round(n * 100);
  }

  function isValidDateString(s) {
    if (typeof s !== 'string' || !s) return false;
    return /^\d{4}-\d{2}-\d{2}/.test(s) && !isNaN(Date.parse(s));
  }

  var LEGACY_LINK_FORMAT = /^[a-zA-Z0-9_-]{3,}$/;

  /** JSON round-trip clone — acceptable for this contract because the legacy
   * store is itself JSON (localStorage-serialized): no functions/Dates/undefined
   * are expected in it. Ensures no output ever holds a live reference into a
   * nested object/array of the raw input. */
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

  function makeWarning(code, severity, sourceCollection, sourceId, field, message, confidence) {
    return {
      code: code,
      severity: severity,
      sourceCollection: sourceCollection,
      sourceId: sourceId != null ? sourceId : null,
      field: field != null ? field : null,
      message: message,
      confidence: confidence || null
    };
  }

  function buildLegacyMeta(sourceCollection, sourceId, confidence, warnings, syntheticIdStability) {
    return {
      sourceCollection: sourceCollection,
      sourceId: sourceId != null ? sourceId : null,
      confidence: confidence,
      syntheticIdStability: syntheticIdStability !== undefined ? syntheticIdStability : null,
      warnings: warnings.slice()
    };
  }

  function pickFieldsDeepCloned(obj, fields) {
    var out = {};
    fields.forEach(function (f) {
      out[f] = deepCloneJsonSafe(obj[f]);
    });
    return out;
  }

  function pushDiscard(list, sourceCollection, rawIndex, reason, sourceId, legacyEvidence) {
    var entry = {
      sourceCollection: sourceCollection,
      sourceId: sourceId != null ? sourceId : null,
      rawIndex: rawIndex,
      reason: reason
    };
    if (legacyEvidence !== undefined) entry.legacyEvidence = deepCloneJsonSafe(legacyEvidence);
    list.push(entry);
  }

  function resolveCurrency(raw, sourceCollection, legacyId, warnings, downgrade) {
    if (raw) return raw;
    warnings.push(
      makeWarning('CURRENCY_DEFAULTED', 'INFO', sourceCollection, legacyId, 'currency', 'currency missing, defaulted to USD', 'MEDIUM')
    );
    downgrade();
    return 'USD';
  }

  function makeConfidenceTracker() {
    var level = 'HIGH';
    return {
      downgradeToMedium: function () {
        if (level === 'HIGH') level = 'MEDIUM';
      },
      downgradeToLow: function () {
        level = 'LOW';
      },
      value: function () {
        return level;
      }
    };
  }

  function capAtMedium(level) {
    return level === 'HIGH' ? 'MEDIUM' : level;
  }

  /* ---------------------------------------------------------------------
   * Synthetic id resolution — content-based first, index only as fallback.
   * Never a UUID canónico. Never usable as a financial idempotency key.
   * ------------------------------------------------------------------- */

  function computeContentHash(sourceCollection, parts) {
    var base = sourceCollection + '::' + parts.map(String).join('|');
    var hash = 0;
    var i;
    for (i = 0; i < base.length; i++) {
      hash = (hash << 5) - hash + base.charCodeAt(i);
      hash |= 0;
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * @param rawRecord   the raw legacy object
   * @param sourceCollection  e.g. 'venues'
   * @param index       array index (fallback only)
   * @param stableValues  array of pre-extracted stable field values for this record
   * @returns {id, sourceId, stability: 'CONTENT_BASED'|'INDEX_FALLBACK'|null, warnings: []}
   */
  function resolveLegacyId(rawRecord, sourceCollection, index, stableValues) {
    if (rawRecord.id != null) {
      var realId = String(rawRecord.id);
      return { id: realId, sourceId: realId, stability: null, warnings: [] };
    }
    var allPresent = stableValues.every(function (v) {
      return v !== undefined && v !== null && v !== '';
    });
    var warnings = [];
    var id;
    var stability;
    if (allPresent) {
      id = 'legacy-synthetic-' + sourceCollection + '-' + computeContentHash(sourceCollection, stableValues);
      stability = 'CONTENT_BASED';
    } else {
      id = 'legacy-synthetic-' + sourceCollection + '-idx' + index + '-' + computeContentHash(sourceCollection, [index].concat(stableValues));
      stability = 'INDEX_FALLBACK';
      warnings.push(
        makeWarning(
          'SYNTHETIC_ID_INDEX_FALLBACK',
          'INFO',
          sourceCollection,
          null,
          null,
          'not enough stable fields present; synthetic id falls back to array index and is NOT stable across reordering of the source array',
          'LOW'
        )
      );
    }
    return { id: id, sourceId: null, stability: stability, warnings: warnings };
  }

  /* ---------------------------------------------------------------------
   * Reader: venues[]
   * ------------------------------------------------------------------- */

  function readLegacyVenues(rawStore) {
    var records = [];
    var warnings = [];
    var discarded = [];
    asArray(rawStore && rawStore.venues).forEach(function (v, i) {
      if (!isPlainObject(v)) {
        pushDiscard(discarded, 'venues', i, 'MISSING_REQUIRED_FIELD: entry is not an object');
        return;
      }
      /* TICKET-026 — real venues never carry `.name` (Accounting Center
       * writes `.commercialName`, matching the same fallback chain already
       * used elsewhere in the legacy store: accounting-module.js's own
       * `venue.name || venue.venueName || venue.commercialName ||
       * venue.legalName`). Reusing that established convention here, not
       * inventing a new one. */
      var resolvedName = v.name || v.venueName || v.commercialName || v.legalName || null;
      var idInfo = resolveLegacyId(v, 'venues', i, [resolvedName, v.address]);
      var legacyId = idInfo.id;
      var localWarnings = idInfo.warnings.slice();
      var conf = makeConfidenceTracker();
      if (idInfo.stability === 'INDEX_FALLBACK') conf.downgradeToMedium();
      if (v.id == null) {
        localWarnings.push(makeWarning('MISSING_REQUIRED_FIELD', 'WARNING', 'venues', legacyId, 'id', 'venue missing id, synthetic id generated', 'MEDIUM'));
        conf.downgradeToMedium();
      }
      if (!resolvedName) {
        localWarnings.push(makeWarning('MISSING_REQUIRED_FIELD', 'WARNING', 'venues', legacyId, 'name', 'venue missing name (checked name/venueName/commercialName/legalName)', 'LOW'));
        conf.downgradeToLow();
      }
      records.push({
        id: legacyId,
        name: resolvedName,
        address: v.address || null,
        contactName: v.contactName || null,
        contactPhone: v.contactPhone || null,
        contactEmail: v.contactEmail || null,
        status: v.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        legacy: buildLegacyMeta('venues', idInfo.sourceId, conf.value(), localWarnings, idInfo.stability)
      });
      warnings = warnings.concat(localWarnings);
    });
    return { records: records, warnings: warnings, discarded: discarded };
  }

  function collectRawVenueIds(rawStore) {
    var set = Object.create(null);
    asArray(rawStore && rawStore.venues).forEach(function (v) {
      if (isPlainObject(v) && v.id != null) set[String(v.id)] = true;
    });
    return set;
  }

  function collectRawAgreementIds(rawStore) {
    var set = Object.create(null);
    asArray(rawStore && rawStore.agreements).forEach(function (a) {
      if (isPlainObject(a) && a.id != null) set[String(a.id)] = true;
    });
    return set;
  }

  /* ---------------------------------------------------------------------
   * Reader: agreements[]
   * ------------------------------------------------------------------- */

  /* TICKET-033 finding — real Accounting Center exports write lowercase
   * frequency values ('weekly'), never the uppercase canonical vocabulary
   * (WEEKLY | BIWEEKLY | MONTHLY | ONE_OFF, canonical doc §6). Same class of
   * gap as TICKET-026's status normalization: the adapter previously passed
   * this field through raw. An unrecognized value still passes through
   * unchanged (never silently coerced to a guess). */
  var LEGACY_AGREEMENT_FREQUENCY_TO_CANONICAL = {
    weekly: 'WEEKLY',
    biweekly: 'BIWEEKLY',
    monthly: 'MONTHLY',
    one_off: 'ONE_OFF',
    oneoff: 'ONE_OFF'
  };

  function readLegacyAgreements(rawStore) {
    var records = [];
    var warnings = [];
    var discarded = [];
    var venueIds = collectRawVenueIds(rawStore);
    asArray(rawStore && rawStore.agreements).forEach(function (a, i) {
      if (!isPlainObject(a)) {
        pushDiscard(discarded, 'agreements', i, 'MISSING_REQUIRED_FIELD: entry is not an object');
        return;
      }
      var idInfo = resolveLegacyId(a, 'agreements', i, [a.venueId, a.effectiveFrom, a.title]);
      var legacyId = idInfo.id;
      var localWarnings = idInfo.warnings.slice();
      var conf = makeConfidenceTracker();
      if (idInfo.stability === 'INDEX_FALLBACK') conf.downgradeToMedium();
      var venueResolves = a.venueId != null && !!venueIds[String(a.venueId)];
      if (!venueResolves) {
        localWarnings.push(makeWarning('UNRESOLVED_VENUE', 'WARNING', 'agreements', legacyId, 'venueId', 'agreement references a venueId not found among venues[]', 'LOW'));
        conf.downgradeToLow();
      }
      var currency = resolveCurrency(a.currency, 'agreements', legacyId, localWarnings, conf.downgradeToMedium);
      records.push({
        id: legacyId,
        venueId: a.venueId != null ? String(a.venueId) : null,
        title: a.title || null,
        frequency: (function () {
          var rawFrequency = a.frequency != null ? String(a.frequency).trim() : '';
          if (!rawFrequency) return null;
          return LEGACY_AGREEMENT_FREQUENCY_TO_CANONICAL[rawFrequency.toLowerCase()] || rawFrequency;
        })(),
        scheduledDays: Array.isArray(a.scheduledDays) ? deepCloneJsonSafe(a.scheduledDays) : [],
        rateByDay: isPlainObject(a.rateByDay) ? deepCloneJsonSafe(a.rateByDay) : {},
        currency: currency,
        effectiveFrom: a.effectiveFrom || null,
        effectiveUntil: a.effectiveUntil || null,
        status: a.status || 'ACTIVE',
        legacy: buildLegacyMeta('agreements', idInfo.sourceId, conf.value(), localWarnings, idInfo.stability)
      });
      warnings = warnings.concat(localWarnings);
    });
    return { records: records, warnings: warnings, discarded: discarded };
  }

  /* TICKET-026 — real Accounting Center exports write lowercase status
   * values ('scheduled'), never the uppercase canonical form the bridge's
   * planOccurrences checks against. This is a casing translation only —
   * it must NOT change which statuses are treated as equivalent to
   * SCHEDULED vs genuinely different (CANCELLED/COMPLETED/NO_SHOW), which
   * the bridge's UNREPRESENTABLE_STATUS candidate deliberately still routes
   * to manual review (see mdj-financial-legacy-import-bridge.js header). */
  var LEGACY_OCCURRENCE_STATUS_TO_CANONICAL = {
    scheduled: 'SCHEDULED',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
    canceled: 'CANCELLED',
    no_show: 'NO_SHOW',
    noshow: 'NO_SHOW'
  };

  /* ---------------------------------------------------------------------
   * Reader: occurrences[] + casualServices[]
   * ------------------------------------------------------------------- */

  function readLegacyOccurrences(rawStore) {
    var records = [];
    var warnings = [];
    var discarded = [];
    var venueIds = collectRawVenueIds(rawStore);
    var agreementIds = collectRawAgreementIds(rawStore);
    var seenSlots = Object.create(null);

    function mapOne(o, i, sourceCollection, isCasual) {
      if (!isPlainObject(o)) {
        pushDiscard(discarded, sourceCollection, i, 'MISSING_REQUIRED_FIELD: entry is not an object');
        return;
      }
      /* TICKET-030 — the real legacy Occurrence model (createOccurrenceModel(),
       * accounting-module.js) names this field `shiftSlot`, not `shift`; `.shift`
       * never carries a value in any real record (confirmed: 0 of 306 real
       * occurrences have it, exactly 1 has `.shiftSlot` populated). This was
       * causing two genuinely distinct real operations at the same venue+date
       * (a weekly presentation and a separate one-off night coverage, each with
       * its own PFR, its own DJ payout, its own audit trail) to collide under
       * T009's real venueId+date+shift uniqueness rule and be misclassified as
       * a duplicate. `.shift` still wins if a future/external source ever sets
       * it (per PO decision) — this is a compatible fallback, not a replacement. */
      var shift = o.shift || o.shiftSlot || null;
      var startTime = o.startTime || null;
      /* TICKET-026 — casualServices[] uses `serviceDate`, not `date`; every
       * casual entry was silently losing its date before this fallback. */
      var occDate = o.date || o.serviceDate || null;
      var idInfo = resolveLegacyId(o, sourceCollection, i, [o.venueId, occDate, shift, startTime]);
      var legacyId = idInfo.id;
      var localWarnings = idInfo.warnings.slice();
      var conf = makeConfidenceTracker();
      if (idInfo.stability === 'INDEX_FALLBACK') conf.downgradeToMedium();

      var venueResolves = o.venueId != null && !!venueIds[String(o.venueId)];
      if (!venueResolves) {
        localWarnings.push(makeWarning('UNRESOLVED_VENUE', 'WARNING', sourceCollection, legacyId, 'venueId', 'occurrence references a venueId not found among venues[]', 'LOW'));
        conf.downgradeToLow();
      }

      var agreementId = isCasual ? null : (o.agreementId != null ? String(o.agreementId) : null);
      if (!isCasual && agreementId && !agreementIds[agreementId]) {
        localWarnings.push(makeWarning('UNRESOLVED_AGREEMENT', 'WARNING', sourceCollection, legacyId, 'agreementId', 'occurrence references an agreementId not found among agreements[]', 'LOW'));
        conf.downgradeToMedium();
      }

      if (!shift || !startTime) {
        conf.downgradeToMedium();
      }

      if (!isValidDateString(occDate)) {
        localWarnings.push(makeWarning('INVALID_DATE', 'WARNING', sourceCollection, legacyId, 'date', 'occurrence date is missing or not a valid date string', 'LOW'));
        conf.downgradeToLow();
      }

      /* TICKET-029 — corrected: T009's own coreCreateOccurrenceWithPfr slot-clash
       * check (mdj-financial-local-services.js:421-425) keys uniqueness on
       * venueId+date+shift ONLY — startTime is never part of the real
       * canonical uniqueness rule. The adapter previously included startTime
       * in this key, so two legacy occurrences at the same venue+date+shift
       * but different startTime were never flagged here, both got planned as
       * separate steps, and the second one crashed executeImportPlan() with
       * an UNEXPECTED_FAILURE (OCCURRENCE_ALREADY_EXISTS) that rolled back
       * the entire plan — confirmed against real Accounting Center data in
       * TICKET-029. This key must match T009's real invariant, not a
       * stricter one the canonical layer doesn't actually enforce. */
      var slotKey = [o.venueId, occDate, shift || '(default)'].join('|');
      var duplicateSlot = false;
      if (seenSlots[slotKey]) {
        duplicateSlot = true;
        localWarnings.push(
          makeWarning(
            'DUPLICATE_OCCURRENCE_SLOT',
            'WARNING',
            sourceCollection,
            legacyId,
            null,
            'occurrence collides with ' + seenSlots[slotKey] + ' on venueId+date+shift (T009\'s real uniqueness key)',
            'LOW'
          )
        );
        conf.downgradeToLow();
      } else {
        seenSlots[slotKey] = legacyId;
      }

      records.push({
        id: legacyId,
        venueId: o.venueId != null ? String(o.venueId) : null,
        agreementId: agreementId,
        assignedProfileId: o.assignedProfileId != null ? String(o.assignedProfileId) : null,
        date: occDate,
        shift: shift,
        startTime: startTime,
        status: (function () {
          var rawStatus = o.status != null ? String(o.status).trim() : '';
          if (!rawStatus) return 'SCHEDULED';
          return LEGACY_OCCURRENCE_STATUS_TO_CANONICAL[rawStatus.toLowerCase()] || rawStatus;
        })(),
        duplicateSlot: duplicateSlot,
        legacy: buildLegacyMeta(sourceCollection, idInfo.sourceId, conf.value(), localWarnings, idInfo.stability)
      });
      warnings = warnings.concat(localWarnings);
    }

    asArray(rawStore && rawStore.occurrences).forEach(function (o, i) {
      mapOne(o, i, 'occurrences', false);
    });
    asArray(rawStore && rawStore.casualServices).forEach(function (o, i) {
      mapOne(o, i, 'casualServices', true);
    });

    return { records: records, warnings: warnings, discarded: discarded };
  }

  /* ---------------------------------------------------------------------
   * Reader: deposits[] -> Payment(INFLOW)
   *
   * status='draft'  -> mapped as a migration-candidate Payment (PENDING),
   *                    never counted as confirmed cash. LEGACY_DRAFT_PAYMENT_PRESERVED.
   * status='voided' -> never mapped to canonical.payments. Kept in discarded[]
   *                    with minimal legacyEvidence. LEGACY_VOIDED_PAYMENT_IGNORED.
   * ------------------------------------------------------------------- */

  function buildDepositLegacyLinks(d, legacyId, warnings, downgrade) {
    var legacyLinks = {};
    ['leadId', 'invoiceId', 'eventId'].forEach(function (linkField) {
      var val = d[linkField];
      if (val == null || val === '') return;
      legacyLinks[linkField] = String(val);
      var wellFormed = LEGACY_LINK_FORMAT.test(String(val));
      if (!wellFormed) {
        warnings.push(
          makeWarning('LEGACY_LINK_INVALID_FORMAT', 'WARNING', 'deposits', legacyId, linkField, 'legacy link "' + linkField + '" has an invalid format', 'LOW')
        );
        downgrade();
      } else {
        warnings.push(
          makeWarning(
            'LEGACY_LINK_NOT_VERIFIABLE',
            'INFO',
            'deposits',
            legacyId,
            linkField,
            'legacy link "' + linkField + '" is well-formed but cannot be verified against the commercial channel by this isolated adapter (NEW_WRITE_DISABLED)',
            'MEDIUM'
          )
        );
      }
    });
    return legacyLinks;
  }

  function readLegacyDepositsAsPayments(rawStore) {
    var records = [];
    var warnings = [];
    var discarded = [];
    asArray(rawStore && rawStore.deposits).forEach(function (d, i) {
      if (!isPlainObject(d)) {
        pushDiscard(discarded, 'deposits', i, 'MISSING_REQUIRED_FIELD: entry is not an object');
        return;
      }
      var idInfo = resolveLegacyId(d, 'deposits', i, [
        d.amount,
        d.receivedDate,
        d.paymentMethod != null ? d.paymentMethod : d.method,
        d.checkNumber != null ? d.checkNumber : d.reference != null ? d.reference : d.depositNumber
      ]);
      var legacyId = idInfo.id;

      if (d.status === 'voided') {
        var voidedEvidence = {
          sourceId: idInfo.sourceId,
          amount: d.amount != null ? d.amount : null,
          date: d.receivedDate || null,
          method: d.paymentMethod || d.method || null,
          legacyStatus: 'voided'
        };
        warnings.push(
          makeWarning('LEGACY_VOIDED_PAYMENT_IGNORED', 'INFO', 'deposits', legacyId, 'status', 'deposit was voided at the source; never mapped as a payment fact', 'HIGH')
        );
        pushDiscard(discarded, 'deposits', i, 'LEGACY_VOIDED_PAYMENT_IGNORED', legacyId, voidedEvidence);
        return;
      }

      var localWarnings = idInfo.warnings.slice();
      var conf = makeConfidenceTracker();
      if (idInfo.stability === 'INDEX_FALLBACK') conf.downgradeToMedium();

      var isDraft = d.status === 'draft';
      if (isDraft) {
        localWarnings.push(
          makeWarning('LEGACY_DRAFT_PAYMENT_PRESERVED', 'WARNING', 'deposits', legacyId, 'status', 'deposit is a draft at the source; preserved as a migration candidate, not counted as confirmed cash', 'MEDIUM')
        );
        conf.downgradeToMedium();
      }

      var amountCents = toAmountCents(d.amount);
      if (amountCents == null || amountCents <= 0) {
        localWarnings.push(makeWarning('INVALID_AMOUNT', 'ERROR', 'deposits', legacyId, 'amount', 'deposit amount is missing or not a positive number', 'LOW'));
        conf.downgradeToLow();
      }
      if (!isValidDateString(d.receivedDate)) {
        localWarnings.push(makeWarning('INVALID_DATE', 'WARNING', 'deposits', legacyId, 'receivedDate', 'deposit receivedDate is missing or invalid', 'LOW'));
        conf.downgradeToMedium();
      }
      var currency = resolveCurrency(d.currency, 'deposits', legacyId, localWarnings, conf.downgradeToMedium);
      var legacyLinks = buildDepositLegacyLinks(d, legacyId, localWarnings, conf.downgradeToMedium);

      records.push({
        id: legacyId,
        direction: 'INFLOW',
        amountCents: amountCents,
        currency: currency,
        method: d.paymentMethod || d.method || null,
        account: d.bankReference || null,
        paymentDate: d.receivedDate || null,
        reference: d.checkNumber || d.reference || d.depositNumber || null,
        status: isDraft ? 'PENDING' : 'CONFIRMED',
        migrationCandidate: isDraft,
        legacyStatus: d.status || null,
        legacyLinks: legacyLinks,
        legacy: buildLegacyMeta('deposits', idInfo.sourceId, conf.value(), localWarnings, idInfo.stability)
      });
      warnings = warnings.concat(localWarnings);
    });
    return { records: records, warnings: warnings, discarded: discarded };
  }

  /* ---------------------------------------------------------------------
   * Reader: payments[] (outgoing) -> Payment(OUTFLOW) + candidate Payable
   * ------------------------------------------------------------------- */

  var LEGACY_PAYMENT_TYPE_TO_PURPOSE = {
    owner_work_record: 'OWNER_WORK_RECORD',
    dj_payment: 'DJ_PAYMENT',
    contractor_payment: 'CONTRACTOR_PAYMENT',
    vendor_payment: 'VENDOR_PAYMENT',
    reimbursement: 'REIMBURSEMENT',
    outgoing_adjustment: 'ADJUSTMENT'
  };

  var LEGACY_PAYMENT_STATUS_TO_CANONICAL = {
    paid: 'CONFIRMED',
    completed: 'CONFIRMED',
    failed: 'FAILED',
    cancelled: 'FAILED',
    pending: 'PENDING',
    scheduled: 'PENDING',
    approved: 'PENDING',
    not_applicable: 'PENDING'
  };

  function readLegacyOutgoingPayments(rawStore) {
    var records = [];
    var payableCandidates = [];
    var warnings = [];
    var discarded = [];
    var payees = asArray(rawStore && rawStore.payees);

    asArray(rawStore && rawStore.payments).forEach(function (p, i) {
      if (!isPlainObject(p)) {
        pushDiscard(discarded, 'payments', i, 'MISSING_REQUIRED_FIELD: entry is not an object');
        return;
      }
      var idInfo = resolveLegacyId(p, 'payments', i, [p.payeeId, p.amount, p.paidDate != null ? p.paidDate : p.scheduledDate, p.paymentNumber]);
      var legacyId = idInfo.id;
      var localWarnings = idInfo.warnings.slice();
      var conf = makeConfidenceTracker();
      if (idInfo.stability === 'INDEX_FALLBACK') conf.downgradeToMedium();

      var amountCents = toAmountCents(p.amount);
      if (amountCents == null || amountCents <= 0) {
        localWarnings.push(makeWarning('INVALID_AMOUNT', 'ERROR', 'payments', legacyId, 'amount', 'outgoing payment amount is missing or not a positive number', 'LOW'));
        conf.downgradeToLow();
      }
      var currency = resolveCurrency(p.currency, 'payments', legacyId, localWarnings, conf.downgradeToMedium);

      var rawStatus = p.status != null ? String(p.status).toLowerCase() : '';
      var canonicalStatus = LEGACY_PAYMENT_STATUS_TO_CANONICAL[rawStatus];
      if (!canonicalStatus) {
        localWarnings.push(makeWarning('UNKNOWN_LEGACY_STATUS', 'INFO', 'payments', legacyId, 'status', 'unrecognized legacy status "' + p.status + '", defaulted to PENDING', 'MEDIUM'));
        conf.downgradeToMedium();
        canonicalStatus = 'PENDING';
      }

      var payeeId = p.payeeId != null ? String(p.payeeId) : null;
      var candidatePayable = null;
      if (!payeeId) {
        localWarnings.push(makeWarning('UNRESOLVED_PAYEE', 'INFO', 'payments', legacyId, 'payeeId', 'payment has no payeeId; no Payable candidate created', 'MEDIUM'));
        conf.downgradeToMedium();
      } else {
        var payeeResolves = payees.some(function (pe) {
          return isPlainObject(pe) && pe.id != null && String(pe.id) === payeeId;
        });
        if (!payeeResolves) {
          localWarnings.push(makeWarning('UNRESOLVED_PAYEE', 'WARNING', 'payments', legacyId, 'payeeId', 'payment references a payeeId not found among payees[]', 'LOW'));
          conf.downgradeToLow();
        } else {
          var purposeWarnings = [];
          var purpose = LEGACY_PAYMENT_TYPE_TO_PURPOSE[p.paymentType];
          if (!purpose) {
            purposeWarnings.push(
              makeWarning('UNKNOWN_LEGACY_STATUS', 'INFO', 'payments', legacyId, 'paymentType', 'unrecognized legacy paymentType "' + p.paymentType + '", defaulted to CONTRACTOR_PAYMENT', 'MEDIUM')
            );
            purpose = 'CONTRACTOR_PAYMENT';
          }
          localWarnings = localWarnings.concat(purposeWarnings);
          var candidateConfidence = capAtMedium(purposeWarnings.length ? capAtMedium(conf.value()) : conf.value());
          candidatePayable = {
            id: idInfo.stability
              ? 'legacy-synthetic-payables-' + computeContentHash('payables', [payeeId, purpose, amountCents])
              : 'legacy-synthetic-payables-' + computeContentHash('payables', [legacyId, payeeId, purpose]),
            migrationCandidate: true,
            sourceTypeInferred: true,
            sourceType: 'EXPENSE',
            sourceId: null,
            payeeType: 'PAYEE',
            payeeId: payeeId,
            purpose: purpose,
            amountCents: amountCents,
            currency: currency,
            status: 'PENDING',
            requiresManualConfirmation: true,
            confidence: candidateConfidence,
            legacy: buildLegacyMeta('payments', idInfo.sourceId, candidateConfidence, localWarnings.concat(purposeWarnings), idInfo.stability)
          };
          payableCandidates.push(candidatePayable);
        }
      }

      records.push({
        id: legacyId,
        direction: 'OUTFLOW',
        amountCents: amountCents,
        currency: currency,
        method: p.method || null,
        account: null,
        paymentDate: p.paidDate || p.scheduledDate || null,
        reference: p.paymentNumber || null,
        status: canonicalStatus,
        payeeId: payeeId,
        candidatePayableId: candidatePayable ? candidatePayable.id : null,
        legacy: buildLegacyMeta('payments', idInfo.sourceId, conf.value(), localWarnings, idInfo.stability)
      });
      warnings = warnings.concat(localWarnings);
    });

    return { records: records, payableCandidates: payableCandidates, warnings: warnings, discarded: discarded };
  }

  /* ---------------------------------------------------------------------
   * Reader: venuePayments[] -> VenueReceivable (venueIncomes[] intentionally ignored)
   * ------------------------------------------------------------------- */

  var LEGACY_COLLECTION_STATUS_TO_RECEIVABLE_STATUS = {
    pending: 'OPEN',
    received: 'PAID'
  };

  function readLegacyVenueReceivables(rawStore) {
    var records = [];
    var warnings = [];
    var discarded = [];

    var pfrByOccurrence = Object.create(null);
    asArray(rawStore && rawStore.performanceFinancialRecords).forEach(function (r) {
      if (isPlainObject(r) && r.occurrenceId != null) {
        var key = String(r.occurrenceId);
        if (!pfrByOccurrence[key]) pfrByOccurrence[key] = r;
      }
    });

    asArray(rawStore && rawStore.venuePayments).forEach(function (vp, i) {
      if (!isPlainObject(vp)) {
        pushDiscard(discarded, 'venuePayments', i, 'MISSING_REQUIRED_FIELD: entry is not an object');
        return;
      }
      var idInfo = resolveLegacyId(vp, 'venuePayments', i, [vp.venueId, vp.occurrenceId, vp.performanceDate, vp.amount]);
      var legacyId = idInfo.id;
      var localWarnings = idInfo.warnings.slice();
      var conf = makeConfidenceTracker();
      if (idInfo.stability === 'INDEX_FALLBACK') conf.downgradeToMedium();

      var amountCents = toAmountCents(vp.amount);
      if (amountCents == null || amountCents <= 0) {
        localWarnings.push(makeWarning('INVALID_AMOUNT', 'ERROR', 'venuePayments', legacyId, 'amount', 'venuePayment amount is missing or not a positive number', 'LOW'));
        conf.downgradeToLow();
      }
      var currency = resolveCurrency(vp.currency, 'venuePayments', legacyId, localWarnings, conf.downgradeToMedium);

      if (vp.occurrenceId != null) {
        var pfr = pfrByOccurrence[String(vp.occurrenceId)];
        if (pfr) {
          var pfrCents = toAmountCents(pfr.rateAmount != null ? pfr.rateAmount : pfr.billedIncome);
          if (pfrCents != null && amountCents != null && pfrCents !== amountCents) {
            localWarnings.push(
              makeWarning(
                'VENUE_RECEIVABLE_PFR_AMOUNT_MISMATCH',
                'WARNING',
                'venuePayments',
                legacyId,
                'amount',
                'venuePayment amount (' + amountCents + ') does not match associated PFR rate/billedIncome (' + pfrCents + ')',
                'LOW'
              )
            );
            conf.downgradeToLow();
          }
        }
      }

      var rawStatus = vp.status != null ? String(vp.status).toLowerCase() : '';
      var canonicalStatus = LEGACY_COLLECTION_STATUS_TO_RECEIVABLE_STATUS[rawStatus];
      if (!canonicalStatus) {
        localWarnings.push(makeWarning('UNKNOWN_LEGACY_STATUS', 'INFO', 'venuePayments', legacyId, 'status', 'unrecognized legacy status "' + vp.status + '", defaulted to OPEN', 'MEDIUM'));
        conf.downgradeToMedium();
        canonicalStatus = 'OPEN';
      }

      records.push({
        id: legacyId,
        occurrenceId: vp.occurrenceId != null ? String(vp.occurrenceId) : null,
        amountCents: amountCents,
        currency: currency,
        status: canonicalStatus,
        dueDate: vp.expectedPaymentDate || null,
        legacy: buildLegacyMeta('venuePayments', idInfo.sourceId, conf.value(), localWarnings, idInfo.stability)
      });
      warnings = warnings.concat(localWarnings);
    });

    var incomes = asArray(rawStore && rawStore.venueIncomes);
    if (incomes.length) {
      warnings.push(
        makeWarning(
          'SUPERSEDED_COLLECTION_IGNORED',
          'INFO',
          'venueIncomes',
          null,
          null,
          'venueIncomes[] (' + incomes.length + ' entries) is a confirmed duplicate of venuePayments[] and is not used as a source',
          'HIGH'
        )
      );
      incomes.forEach(function (inc, i) {
        pushDiscard(discarded, 'venueIncomes', i, 'SUPERSEDED_COLLECTION_IGNORED: duplicates venuePayments[]', isPlainObject(inc) && inc.id != null ? String(inc.id) : null);
      });
    }

    return { records: records, warnings: warnings, discarded: discarded };
  }

  /* ---------------------------------------------------------------------
   * Reader: performanceFinancialRecords[]
   * ------------------------------------------------------------------- */

  var PFR_DERIVED_FIELDS = ['collectedAmount', 'collectionStatus', 'djPayoutStatus', 'billedIncome', 'paidPayout'];

  function readLegacyPfr(rawStore) {
    var records = [];
    var warnings = [];
    var discarded = [];
    var seenOccurrence = Object.create(null);

    asArray(rawStore && rawStore.performanceFinancialRecords).forEach(function (r, i) {
      if (!isPlainObject(r)) {
        pushDiscard(discarded, 'performanceFinancialRecords', i, 'MISSING_REQUIRED_FIELD: entry is not an object');
        return;
      }
      var idInfo = resolveLegacyId(r, 'performanceFinancialRecords', i, [r.occurrenceId, r.rateAmount != null ? r.rateAmount : r.billedIncome]);
      var legacyId = idInfo.id;
      var localWarnings = idInfo.warnings.slice();
      var conf = makeConfidenceTracker();
      if (idInfo.stability === 'INDEX_FALLBACK') conf.downgradeToMedium();

      var occurrenceId = r.occurrenceId != null ? String(r.occurrenceId) : null;
      var duplicateForOccurrence = false;
      if (!occurrenceId) {
        localWarnings.push(makeWarning('MISSING_REQUIRED_FIELD', 'ERROR', 'performanceFinancialRecords', legacyId, 'occurrenceId', 'PFR missing occurrenceId', 'LOW'));
        conf.downgradeToLow();
      } else if (seenOccurrence[occurrenceId]) {
        duplicateForOccurrence = true;
        localWarnings.push(
          makeWarning(
            'DUPLICATE_PFR_FOR_OCCURRENCE',
            'WARNING',
            'performanceFinancialRecords',
            legacyId,
            'occurrenceId',
            'more than one PFR references occurrenceId "' + occurrenceId + '" (1:1 required); first seen: ' + seenOccurrence[occurrenceId],
            'LOW'
          )
        );
        conf.downgradeToLow();
      } else {
        seenOccurrence[occurrenceId] = legacyId;
      }

      var rateAmountCents = toAmountCents(r.rateAmount != null ? r.rateAmount : r.billedIncome);
      if (rateAmountCents == null) {
        localWarnings.push(makeWarning('INVALID_AMOUNT', 'ERROR', 'performanceFinancialRecords', legacyId, 'rateAmount', 'PFR rateAmount/billedIncome is missing or not numeric', 'LOW'));
        conf.downgradeToLow();
      }
      var currency = resolveCurrency(r.currency, 'performanceFinancialRecords', legacyId, localWarnings, conf.downgradeToMedium);

      var derivedFieldsPresent = PFR_DERIVED_FIELDS.filter(function (f) {
        return r[f] !== undefined && r[f] !== null;
      });
      var legacyEvidence = null;
      if (derivedFieldsPresent.length) {
        localWarnings.push(
          makeWarning(
            'DERIVED_FIELD_NOT_MIGRATED',
            'INFO',
            'performanceFinancialRecords',
            legacyId,
            derivedFieldsPresent.join(','),
            'derived fields present in legacy PFR are not promoted to the canonical model: ' + derivedFieldsPresent.join(', '),
            'HIGH'
          )
        );
        legacyEvidence = pickFieldsDeepCloned(r, derivedFieldsPresent);
      }

      records.push({
        id: legacyId,
        occurrenceId: occurrenceId,
        agreementId: r.agreementId != null ? String(r.agreementId) : null,
        rateAmountCents: rateAmountCents,
        currency: currency,
        assignedProfileId: r.assignedProfileId != null ? String(r.assignedProfileId) : r.djAssigned || null,
        expectedArtistPayoutCents: toAmountCents(r.expectedArtistPayout != null ? r.expectedArtistPayout : r.djAgreedPayout),
        duplicateForOccurrence: duplicateForOccurrence,
        legacyEvidence: legacyEvidence,
        legacy: buildLegacyMeta('performanceFinancialRecords', idInfo.sourceId, conf.value(), localWarnings, idInfo.stability)
      });
      warnings = warnings.concat(localWarnings);
    });

    return { records: records, warnings: warnings, discarded: discarded };
  }

  /* ---------------------------------------------------------------------
   * Reader: auditHistory[] (technical audit, never treated as financial history)
   * ------------------------------------------------------------------- */

  function readLegacyAuditHistory(rawStore) {
    var records = [];
    var discarded = [];
    var source = rawStore && (rawStore.auditHistory || rawStore.history);
    asArray(source).forEach(function (h, i) {
      if (!isPlainObject(h)) {
        pushDiscard(discarded, 'auditHistory', i, 'MISSING_REQUIRED_FIELD: entry is not an object');
        return;
      }
      var actorId = isPlainObject(h.actor) ? h.actor.id : h.actor;
      var idInfo = resolveLegacyId(h, 'auditHistory', i, [h.timestamp, h.action, actorId]);
      var legacyId = idInfo.id;
      records.push({
        id: legacyId,
        action: h.action || null,
        actor: deepCloneJsonSafe(h.actor) || null,
        timestamp: h.timestamp || null,
        legacy: buildLegacyMeta('auditHistory', idInfo.sourceId, 'HIGH', idInfo.warnings, idInfo.stability)
      });
    });
    return { records: records, warnings: [], discarded: discarded };
  }

  /* ---------------------------------------------------------------------
   * Metrics
   * ------------------------------------------------------------------- */

  function buildMetrics(rawStore, canonical, discarded) {
    var sourceCounts = {
      venues: asArray(rawStore.venues).length,
      agreements: asArray(rawStore.agreements).length,
      occurrences: asArray(rawStore.occurrences).length,
      casualServices: asArray(rawStore.casualServices).length,
      deposits: asArray(rawStore.deposits).length,
      payments: asArray(rawStore.payments).length,
      venuePayments: asArray(rawStore.venuePayments).length,
      venueIncomes: asArray(rawStore.venueIncomes).length,
      performanceFinancialRecords: asArray(rawStore.performanceFinancialRecords).length,
      auditHistory: asArray(rawStore.auditHistory || rawStore.history).length,
      incomeSchedules: asArray(rawStore.incomeSchedules).length,
      ledger: asArray(rawStore.ledger).length
    };
    var mappedCounts = {
      venues: canonical.venues.length,
      venueAgreements: canonical.venueAgreements.length,
      occurrences: canonical.occurrences.length,
      payments: canonical.payments.length,
      payables: canonical.payables.length,
      payableCandidates: canonical.payableCandidates.length,
      venueReceivables: canonical.venueReceivables.length,
      performanceFinancialRecords: canonical.performanceFinancialRecords.length,
      auditHistory: canonical.auditHistory.length
    };
    var discardedCounts = {};
    discarded.forEach(function (d) {
      discardedCounts[d.sourceCollection] = (discardedCounts[d.sourceCollection] || 0) + 1;
    });
    var confidenceCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    Object.keys(canonical).forEach(function (key) {
      canonical[key].forEach(function (rec) {
        var confidence = rec && (rec.confidence || (rec.legacy && rec.legacy.confidence));
        if (confidence && confidenceCounts.hasOwnProperty(confidence)) {
          confidenceCounts[confidence]++;
        }
      });
    });
    return {
      sourceCounts: sourceCounts,
      mappedCounts: mappedCounts,
      discardedCounts: discardedCounts,
      confidenceCounts: confidenceCounts
    };
  }

  /* ---------------------------------------------------------------------
   * mapStore — top-level entry point
   * ------------------------------------------------------------------- */

  function mapStore(rawStore) {
    if (!isPlainObject(rawStore)) {
      return {
        canonical: null,
        discarded: [],
        warnings: [makeWarning('INPUT_NOT_OBJECT', 'ERROR', null, null, null, 'rawStore is not a usable object', null)],
        anomalies: [],
        metrics: { sourceCounts: {}, mappedCounts: {}, discardedCounts: {}, confidenceCounts: {} },
        fatal: true
      };
    }

    var venues = readLegacyVenues(rawStore);
    var agreements = readLegacyAgreements(rawStore);
    var occurrences = readLegacyOccurrences(rawStore);
    var deposits = readLegacyDepositsAsPayments(rawStore);
    var outgoing = readLegacyOutgoingPayments(rawStore);
    var receivables = readLegacyVenueReceivables(rawStore);
    var pfr = readLegacyPfr(rawStore);
    var audit = readLegacyAuditHistory(rawStore);

    var extraWarnings = [];
    var extraDiscarded = [];
    var incomeSchedules = asArray(rawStore.incomeSchedules);
    if (incomeSchedules.length) {
      extraWarnings.push(
        makeWarning('SUPERSEDED_COLLECTION_IGNORED', 'INFO', 'incomeSchedules', null, null, 'incomeSchedules[] is superseded by agreements[] and is not used as a source', 'HIGH')
      );
      incomeSchedules.forEach(function (s, i) {
        pushDiscard(extraDiscarded, 'incomeSchedules', i, 'SUPERSEDED_COLLECTION_IGNORED: superseded by agreements[]', isPlainObject(s) && s.id != null ? String(s.id) : null);
      });
    }
    var legacyLedger = asArray(rawStore.ledger);
    if (legacyLedger.length) {
      extraWarnings.push(
        makeWarning('SUPERSEDED_COLLECTION_IGNORED', 'INFO', 'ledger', null, null, 'ledger[] is a derived view, not a canonical source, and is not migrated literally', 'HIGH')
      );
      legacyLedger.forEach(function (l, i) {
        pushDiscard(extraDiscarded, 'ledger', i, 'SUPERSEDED_COLLECTION_IGNORED: derived view, not migrated literally', isPlainObject(l) && l.id != null ? String(l.id) : null);
      });
    }

    var canonical = {
      venues: venues.records,
      venueAgreements: agreements.records,
      occurrences: occurrences.records,
      payments: deposits.records.concat(outgoing.records),
      payables: [],
      payableCandidates: outgoing.payableCandidates,
      venueReceivables: receivables.records,
      performanceFinancialRecords: pfr.records,
      auditHistory: audit.records
    };

    var warnings = []
      .concat(venues.warnings, agreements.warnings, occurrences.warnings)
      .concat(deposits.warnings, outgoing.warnings, receivables.warnings)
      .concat(pfr.warnings, audit.warnings, extraWarnings);

    var discarded = []
      .concat(venues.discarded, agreements.discarded, occurrences.discarded)
      .concat(deposits.discarded, outgoing.discarded, receivables.discarded)
      .concat(pfr.discarded, audit.discarded, extraDiscarded);

    var anomalies = warnings.filter(function (w) {
      return w.severity === 'ERROR';
    });

    return {
      canonical: canonical,
      discarded: discarded,
      warnings: warnings,
      anomalies: anomalies,
      metrics: buildMetrics(rawStore, canonical, discarded)
    };
  }

  /* ---------------------------------------------------------------------
   * Public factory
   * ------------------------------------------------------------------- */

  function createLegacyFinancialAdapter(options) {
    void options;
    return {
      mapStore: mapStore,
      readLegacyVenues: readLegacyVenues,
      readLegacyAgreements: readLegacyAgreements,
      readLegacyOccurrences: readLegacyOccurrences,
      readLegacyDepositsAsPayments: readLegacyDepositsAsPayments,
      readLegacyOutgoingPayments: readLegacyOutgoingPayments,
      readLegacyVenueReceivables: readLegacyVenueReceivables,
      readLegacyPfr: readLegacyPfr,
      readLegacyAuditHistory: readLegacyAuditHistory
    };
  }

  var api = { createLegacyFinancialAdapter: createLegacyFinancialAdapter };

  global.MDJFinancialLegacyAdapter = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
