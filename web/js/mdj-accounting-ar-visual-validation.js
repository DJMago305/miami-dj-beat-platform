/**
 * TICKET-015B — Accounting Center — AR by Venue — Local Visual Validation
 *
 * Builds ONE readonly view model row by running a real, deterministic,
 * in-memory pass through the actual financial pipeline:
 *   MDJAccountingFinancialRuntime (T015A)
 *     -> T009 real commands (createVenue, createOccurrenceWithPfr,
 *        createVenueReceivable, recordPayment, confirmPayment,
 *        allocatePayment)
 *     -> T010 real Domain Events (emitted automatically by the T010-wrapped
 *        commands above)
 *     -> T013 syncProjection (feeds those real events into T011)
 *     -> T014 AR-by-venue projection queries (getVenueReceivables,
 *        getVenueTotals, isOverdue)
 *
 * This module NEVER recomputes anything T014 already computes: status,
 * appliedCents, and overdue all come verbatim from T014's own queries.
 * outstandingCents specifically comes from T014's getVenueTotals aggregate
 * (totalOutstandingCents) rather than from a per-receivable field, because
 * T014's getVenueReceivables query does not expose a per-receivable
 * outstanding balance (only status + appliedCents) — with exactly one
 * receivable in this venue+currency bucket, the aggregate total IS that
 * receivable's own outstanding balance, so this is still 100% T014-sourced,
 * never independently calculated here.
 *
 * Never touches T012 (Legacy Adapter / Import Bridge), never touches
 * localStorage/sessionStorage/IndexedDB/cookies/Supabase/fetch, never uses
 * Date.now()/new Date()/Math.random()/crypto.randomUUID()/setTimeout/
 * setInterval — clock and ids are deterministic and scoped fresh to each
 * buildValidationViewModel() call, so two calls with the same input produce
 * deep-equal output.
 *
 * Nothing executes automatically at load time — only a factory is exposed,
 * same convention as every other module in this line.
 */
(function (global) {
  'use strict';

  var VALIDATION_SOURCE = 'LOCAL_VALIDATION';
  var VALIDATION_LABEL = 'VALIDACIÓN LOCAL — DATOS DE PRUEBA';

  /* Fixture values explicitly authorized by TICKET-015B. Only ever used as
   * INPUT to real commands — never assigned directly to the output view
   * model. */
  var FIXTURE = {
    venueName: 'Miami DJ Beat Validation Venue',
    currency: 'USD',
    occurrenceDate: '2026-07-15',
    receivableAmountCents: 100000,
    paymentAmountCents: 40000,
    allocationAmountCents: 40000,
    dueDate: '2026-08-01'
  };

  function errorResult(errorCode, message) {
    return { ok: false, source: VALIDATION_SOURCE, label: VALIDATION_LABEL, errorCode: errorCode, message: message };
  }

  function makeDeterministicIdGen(prefix) {
    var n = 0;
    return function () {
      n++;
      return prefix + '-' + n;
    };
  }

  /* Fixed base instant, advanced by a whole minute per call — deterministic,
   * never wall-clock. Fresh per buildValidationViewModel() invocation. */
  function makeDeterministicClock() {
    var t = Date.parse('2026-08-04T00:00:00.000Z');
    return function () {
      t += 60000;
      return new Date(t).toISOString();
    };
  }

  function runCommand(fn, store, input, errorCode) {
    var out = fn(store, input);
    if (!out.result.ok) {
      throw { errorCode: errorCode, message: (out.result.errorDetails && JSON.stringify(out.result.errorDetails)) || out.result.errorCode };
    }
    return out;
  }

  function buildValidationViewModel(input) {
    var todayIso = (input && input.todayIso) || '2026-08-04';

    try {
      var runtimeApi = global.MDJAccountingFinancialRuntime;
      if (!runtimeApi || typeof runtimeApi.createAccountingFinancialRuntime !== 'function') {
        return errorResult('AR_VALIDATION_RUNTIME_UNAVAILABLE', 'MDJAccountingFinancialRuntime.createAccountingFinancialRuntime no está disponible en este scope');
      }

      var runtime = runtimeApi.createAccountingFinancialRuntime(global);
      if (!runtime.ok) {
        return errorResult('AR_VALIDATION_RUNTIME_MISSING_FACTORIES', 'Factories faltantes para el runtime: ' + JSON.stringify(runtime.missing));
      }

      var wrapped = runtime.wrappedServices;
      var engine = runtime.engine;
      var sync = runtime.sync;
      var arProjection = runtime.arProjection;

      var clock = makeDeterministicClock();
      var idGen = makeDeterministicIdGen('arvv');
      var actorId = 'ar-visual-validation';

      var financialStore = runtime.createFinancialStore();

      var venueOut = runCommand(wrapped.commands.createVenue, financialStore, {
        name: FIXTURE.venueName,
        idempotencyKey: 'arvv-create-venue',
        now: clock(),
        idGenerator: idGen,
        actorId: actorId
      }, 'AR_VALIDATION_CREATE_VENUE_FAILED');
      financialStore = venueOut.store;
      var venue = venueOut.result.data;

      var occOut = runCommand(wrapped.commands.createOccurrenceWithPfr, financialStore, {
        venueId: venue.id,
        date: FIXTURE.occurrenceDate,
        rateAmountCents: FIXTURE.receivableAmountCents,
        currency: FIXTURE.currency,
        idempotencyKey: 'arvv-create-occurrence',
        now: clock(),
        idGenerator: idGen,
        actorId: actorId
      }, 'AR_VALIDATION_CREATE_OCCURRENCE_FAILED');
      financialStore = occOut.store;
      var occurrence = occOut.result.data.occurrence;

      var receivableOut = runCommand(wrapped.commands.createVenueReceivable, financialStore, {
        occurrenceId: occurrence.id,
        amountCents: FIXTURE.receivableAmountCents,
        currency: FIXTURE.currency,
        dueDate: FIXTURE.dueDate,
        idempotencyKey: 'arvv-create-receivable',
        now: clock(),
        idGenerator: idGen,
        actorId: actorId
      }, 'AR_VALIDATION_CREATE_RECEIVABLE_FAILED');
      financialStore = receivableOut.store;
      var receivable = receivableOut.result.data;

      var paymentOut = runCommand(wrapped.commands.recordPayment, financialStore, {
        direction: 'INFLOW',
        amountCents: FIXTURE.paymentAmountCents,
        currency: FIXTURE.currency,
        paymentDate: FIXTURE.dueDate,
        idempotencyKey: 'arvv-record-payment',
        now: clock(),
        idGenerator: idGen,
        actorId: actorId
      }, 'AR_VALIDATION_RECORD_PAYMENT_FAILED');
      financialStore = paymentOut.store;
      var payment = paymentOut.result.data;

      var confirmOut = runCommand(wrapped.commands.confirmPayment, financialStore, {
        paymentId: payment.id,
        idempotencyKey: 'arvv-confirm-payment',
        now: clock(),
        idGenerator: idGen,
        actorId: actorId
      }, 'AR_VALIDATION_CONFIRM_PAYMENT_FAILED');
      financialStore = confirmOut.store;
      var confirmedPayment = confirmOut.result.data.payment;

      var allocateOut = runCommand(wrapped.commands.allocatePayment, financialStore, {
        paymentId: payment.id,
        targetType: 'VENUE_RECEIVABLE',
        targetId: receivable.id,
        amountCents: FIXTURE.allocationAmountCents,
        idempotencyKey: 'arvv-allocate-payment',
        now: clock(),
        idGenerator: idGen,
        actorId: actorId
      }, 'AR_VALIDATION_ALLOCATE_PAYMENT_FAILED');
      financialStore = allocateOut.store;
      var allocation = allocateOut.result.data.allocation;

      var domainEvents = wrapped.events.getAllEvents(financialStore);

      var projectionStore = runtime.createProjectionStore();
      var syncOut = sync.syncProjection(engine, projectionStore, financialStore, wrapped, arProjection.projectionName, {
        now: clock(),
        idGenerator: idGen
      });
      if (!syncOut.result.ok) {
        return errorResult('AR_VALIDATION_SYNC_FAILED', JSON.stringify(syncOut.result));
      }
      projectionStore = syncOut.store;

      var checkpoint = engine.queries.getProjectionCheckpoint(projectionStore, arProjection.projectionName);
      var projectionState = engine.queries.getProjectionState(projectionStore, arProjection.projectionName);
      var t014Receivables = arProjection.queries.getVenueReceivables(projectionState, venue.id);
      var t014Receivable = t014Receivables.filter(function (r) { return r.receivableId === receivable.id; })[0];
      var t014Totals = t014Receivable ? arProjection.queries.getVenueTotals(projectionState, venue.id, t014Receivable.currency) : null;
      var t014Overdue = t014Receivable ? arProjection.queries.isOverdue(t014Receivable, todayIso) : null;

      /* Authenticity checks — every claim this module makes about the
       * pipeline must be independently verifiable right here, in order,
       * before ok:true is ever returned. */
      var checks = [
        { ok: !!(venue && venue.id), errorCode: 'AR_VALIDATION_VENUE_MISSING', message: 'el venue creado no existe' },
        { ok: !!(occurrence && occurrence.id), errorCode: 'AR_VALIDATION_OCCURRENCE_MISSING', message: 'la occurrence creada no existe' },
        { ok: !!(receivable && receivable.id), errorCode: 'AR_VALIDATION_RECEIVABLE_MISSING', message: 'el receivable creado no existe' },
        { ok: !!(confirmedPayment && confirmedPayment.status === 'CONFIRMED'), errorCode: 'AR_VALIDATION_PAYMENT_NOT_CONFIRMED', message: 'el payment no quedó CONFIRMED' },
        { ok: !!(allocation && allocation.id), errorCode: 'AR_VALIDATION_ALLOCATION_MISSING', message: 'la paymentAllocation no existe' },
        { ok: domainEvents.length > 0, errorCode: 'AR_VALIDATION_NO_DOMAIN_EVENTS', message: 'no existen Domain Events' },
        { ok: !!(checkpoint && checkpoint.lastEventPosition > 0), errorCode: 'AR_VALIDATION_CHECKPOINT_NOT_ADVANCED', message: 'el checkpoint de la proyección no avanzó' },
        { ok: !!t014Receivable, errorCode: 'AR_VALIDATION_T014_RECEIVABLE_MISSING', message: 'T014 no contiene el receivable' },
        { ok: !!(t014Receivable && t014Receivable.status === 'PARTIALLY_PAID'), errorCode: 'AR_VALIDATION_T014_STATUS_MISMATCH', message: 'T014 no reporta PARTIALLY_PAID' },
        { ok: !!(t014Receivable && t014Receivable.appliedCents === FIXTURE.allocationAmountCents), errorCode: 'AR_VALIDATION_T014_APPLIED_MISMATCH', message: 'T014 no reporta appliedCents=' + FIXTURE.allocationAmountCents },
        { ok: !!(t014Totals && t014Totals.totalOutstandingCents === (FIXTURE.receivableAmountCents - FIXTURE.allocationAmountCents)), errorCode: 'AR_VALIDATION_T014_OUTSTANDING_MISMATCH', message: 'T014 no reporta el outstanding esperado' },
        { ok: t014Overdue === true, errorCode: 'AR_VALIDATION_T014_OVERDUE_MISMATCH', message: 'T014 isOverdue no devolvió true' }
      ];
      var firstFailure = checks.filter(function (c) { return !c.ok; })[0];
      if (firstFailure) {
        return errorResult(firstFailure.errorCode, firstFailure.message);
      }

      return {
        ok: true,
        source: VALIDATION_SOURCE,
        label: VALIDATION_LABEL,
        rows: [
          {
            venueId: venue.id,
            venueName: venue.name,
            receivableId: t014Receivable.receivableId,
            occurrenceId: t014Receivable.occurrenceId,
            currency: t014Receivable.currency,
            status: t014Receivable.status,
            amountCents: FIXTURE.receivableAmountCents,
            appliedCents: t014Receivable.appliedCents,
            outstandingCents: t014Totals.totalOutstandingCents,
            dueDate: t014Receivable.dueDate,
            overdue: t014Overdue
          }
        ],
        diagnostics: {
          domainEventCount: domainEvents.length,
          projectionName: arProjection.projectionName,
          checkpointPosition: checkpoint.lastEventPosition
        }
      };
    } catch (e) {
      if (e && e.errorCode) {
        return errorResult(e.errorCode, e.message);
      }
      return errorResult('AR_VALIDATION_UNEXPECTED_ERROR', (e && e.message) || String(e));
    }
  }

  function createAccountingArVisualValidation() {
    return { buildValidationViewModel: buildValidationViewModel };
  }

  var api = { createAccountingArVisualValidation: createAccountingArVisualValidation };

  global.MDJAccountingArVisualValidation = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
