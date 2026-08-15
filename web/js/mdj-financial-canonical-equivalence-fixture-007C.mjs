/**
 * TICKET-V1-FINANCIAL-CANONICAL-ALIGNMENT-PREINTEGRATION-GATES-007C — Gate 5
 * Fixture anonimizado de 18 casos, materializado exactamente según el
 * esquema del Bloque 4 de 007C.
 *
 * Origen: 100% sintético. Ningún nombre real de venue/DJ/cliente, ningún
 * monto que coincida con el caso real documentado en MOD-ACCOUNTING.md
 * (Sundowner Key Largo / DJ Yuyo / $350 / $250) — verificado caso por caso.
 *
 * Cada caso expone:
 *   - id, bloque4Case (fila de la tabla de Bloque 4), title
 *   - legacyFact: representación estática, autorada a mano, de la forma
 *     legacy documentada en 007C Bloque 2/3 (state.payments / state.venuePayments
 *     / state.recurringPayments) — NUNCA derivada de ejecutar accounting-module.js.
 *   - canonicalSetup(cmd, key): función que invoca el Core REAL
 *     (mdj-financial-local-services.js, sin modificar) para producir el
 *     hecho canónico correspondiente. Producida independientemente de
 *     legacyFact, tal como exige Bloque 6 ("nunca una derivada de la otra
 *     por el mismo código").
 *   - expected: qué debe verificar el harness (Bloque 5, criterios 1-10).
 *
 * Este archivo NO toca accounting-module.js, NO toca el Wizard, NO abre
 * ninguna ruta de escritura legacy real. Es un archivo nuevo, aislado.
 *
 * VERSIONADO — cambiar FIXTURE_VERSION en cualquier PR que modifique
 * legacyFact, canonicalSetup o expected de cualquier caso (agregar un caso
 * nuevo o corregir un bug de autoría también cuenta). No cambiar por
 * reformateo/comentarios. Consultada por el harness y estampada en cada
 * corrida — es lo que permite comparar "misma versión, mismo resultado"
 * dentro de seis meses.
 */
export const FIXTURE_VERSION = '1.0.0';

export const fixtureCases = [
  {
    id: 'case01_payable_open',
    bloque4Case: 1,
    title: 'Payable abierto — sin allocations',
    legacyFact: {
      shape: 'state.payments (hybrid, unpaid)',
      id: 'pay-legacy-fx-001',
      payeeId: 'payee-fixture-001',
      amount: 500.0,
      currency: 'USD',
      status: 'pending',
      paidAmount: 0
    },
    canonicalSetup(cmd, key) {
      const payable = cmd('createPayable', {
        sourceType: 'EXPENSE',
        payeeId: 'payee-fixture-001',
        purpose: 'VENDOR_PAYMENT',
        amountCents: 50000,
        currency: 'USD',
        idempotencyKey: key('c1-payable')
      });
      return { payable };
    },
    expected: {
      amountCents: 50000,
      currency: 'USD',
      economicState: 'OPEN',
      remainingCents: 50000
    }
  },

  {
    id: 'case02_payable_partially_paid',
    bloque4Case: 2,
    title: 'Payable parcialmente pagado — 1 allocation < total',
    legacyFact: {
      shape: 'state.payments (hybrid, partial)',
      id: 'pay-legacy-fx-002',
      payeeId: 'payee-fixture-002',
      amount: 600.0,
      currency: 'USD',
      status: 'partial',
      paidAmount: 200.0
    },
    canonicalSetup(cmd, key) {
      const payable = cmd('createPayable', {
        sourceType: 'EXPENSE',
        payeeId: 'payee-fixture-002',
        purpose: 'VENDOR_PAYMENT',
        amountCents: 60000,
        currency: 'USD',
        idempotencyKey: key('c2-payable')
      });
      const payout = cmd('recordOwnerPayout', {
        payableId: payable.data.id,
        amountCents: 20000,
        method: 'zelle',
        paymentDate: '2026-02-01',
        idempotencyKey: key('c2-payout')
      });
      return { payable, payout };
    },
    expected: {
      amountCents: 60000,
      currency: 'USD',
      economicState: 'PARTIALLY_PAID',
      remainingCents: 40000
    }
  },

  {
    id: 'case03_payable_paid',
    bloque4Case: 3,
    title: 'Payable pagado — allocations = total',
    legacyFact: {
      shape: 'state.payments (hybrid, paid)',
      id: 'pay-legacy-fx-003',
      payeeId: 'payee-fixture-003',
      amount: 300.0,
      currency: 'USD',
      status: 'paid',
      paidAmount: 300.0
    },
    canonicalSetup(cmd, key) {
      const payable = cmd('createPayable', {
        sourceType: 'EXPENSE',
        payeeId: 'payee-fixture-003',
        purpose: 'VENDOR_PAYMENT',
        amountCents: 30000,
        currency: 'USD',
        idempotencyKey: key('c3-payable')
      });
      const payout = cmd('recordOwnerPayout', {
        payableId: payable.data.id,
        amountCents: 30000,
        method: 'zelle',
        paymentDate: '2026-02-02',
        idempotencyKey: key('c3-payout')
      });
      return { payable, payout };
    },
    expected: {
      amountCents: 30000,
      currency: 'USD',
      economicState: 'PAID',
      remainingCents: 0
    }
  },

  {
    id: 'case04_receivable_open',
    bloque4Case: 4,
    title: 'VenueReceivable abierto',
    legacyFact: {
      shape: 'state.venuePayments (receivable surrogate, pending)',
      id: 'vpay-legacy-fx-004',
      venueId: 'venue-fixture-alpha',
      amount: 420.0,
      currency: 'USD',
      status: 'pending'
    },
    canonicalSetup(cmd, key) {
      const venue = cmd('createVenue', { name: 'Venue Fixture Alpha', idempotencyKey: key('c4-venue') });
      const occ = cmd('createOccurrenceWithPfr', {
        venueId: venue.data.id,
        date: '2026-03-01',
        shift: 'default',
        startTime: '20:00',
        rateAmountCents: 42000,
        idempotencyKey: key('c4-occ')
      });
      const receivable = cmd('createVenueReceivable', {
        occurrenceId: occ.data.occurrence.id,
        amountCents: 42000,
        idempotencyKey: key('c4-rec')
      });
      return { venue, occ, receivable };
    },
    expected: {
      amountCents: 42000,
      currency: 'USD',
      economicState: 'OPEN',
      remainingCents: 42000
    }
  },

  {
    id: 'case05_receivable_partially_collected',
    bloque4Case: 5,
    title: 'VenueReceivable parcialmente cobrado',
    legacyFact: {
      shape: 'state.venuePayments (receivable surrogate, partial)',
      id: 'vpay-legacy-fx-005',
      venueId: 'venue-fixture-beta',
      amount: 800.0,
      currency: 'USD',
      status: 'partially_received',
      receivedAmount: 300.0
    },
    canonicalSetup(cmd, key) {
      const venue = cmd('createVenue', { name: 'Venue Fixture Beta', idempotencyKey: key('c5-venue') });
      const occ = cmd('createOccurrenceWithPfr', {
        venueId: venue.data.id,
        date: '2026-03-08',
        shift: 'default',
        startTime: '20:00',
        rateAmountCents: 80000,
        idempotencyKey: key('c5-occ')
      });
      const receivable = cmd('createVenueReceivable', {
        occurrenceId: occ.data.occurrence.id,
        amountCents: 80000,
        idempotencyKey: key('c5-rec')
      });
      const payment = cmd('recordPayment', {
        direction: 'INFLOW',
        amountCents: 30000,
        currency: 'USD',
        method: 'zelle',
        paymentDate: '2026-03-09',
        idempotencyKey: key('c5-pay')
      });
      const confirm = cmd('confirmPayment', { paymentId: payment.data.id, idempotencyKey: key('c5-conf') });
      const alloc = cmd('allocatePayment', {
        paymentId: payment.data.id,
        targetType: 'VENUE_RECEIVABLE',
        targetId: receivable.data.id,
        amountCents: 30000,
        idempotencyKey: key('c5-alloc')
      });
      return { venue, occ, receivable, payment, confirm, alloc };
    },
    expected: {
      amountCents: 80000,
      currency: 'USD',
      economicState: 'PARTIALLY_PAID',
      remainingCents: 50000
    }
  },

  {
    id: 'case06_receivable_paid',
    bloque4Case: 6,
    title: 'VenueReceivable pagado — full',
    legacyFact: {
      shape: 'state.venuePayments (receivable surrogate, received)',
      id: 'vpay-legacy-fx-006',
      venueId: 'venue-fixture-gamma',
      amount: 600.0,
      currency: 'USD',
      status: 'received'
    },
    canonicalSetup(cmd, key) {
      const venue = cmd('createVenue', { name: 'Venue Fixture Gamma', idempotencyKey: key('c6-venue') });
      const occ = cmd('createOccurrenceWithPfr', {
        venueId: venue.data.id,
        date: '2026-03-15',
        shift: 'default',
        startTime: '20:00',
        rateAmountCents: 60000,
        idempotencyKey: key('c6-occ')
      });
      const receivable = cmd('createVenueReceivable', {
        occurrenceId: occ.data.occurrence.id,
        amountCents: 60000,
        idempotencyKey: key('c6-rec')
      });
      const payment = cmd('recordPayment', {
        direction: 'INFLOW',
        amountCents: 60000,
        currency: 'USD',
        method: 'cash',
        paymentDate: '2026-03-16',
        idempotencyKey: key('c6-pay')
      });
      cmd('confirmPayment', { paymentId: payment.data.id, idempotencyKey: key('c6-conf') });
      const alloc = cmd('allocatePayment', {
        paymentId: payment.data.id,
        targetType: 'VENUE_RECEIVABLE',
        targetId: receivable.data.id,
        amountCents: 60000,
        idempotencyKey: key('c6-alloc')
      });
      return { venue, occ, receivable, payment, alloc };
    },
    expected: {
      amountCents: 60000,
      currency: 'USD',
      economicState: 'PAID',
      remainingCents: 0
    }
  },

  {
    id: 'case07_payment_pending',
    bloque4Case: 7,
    title: 'Payment PENDING — recordPayment sin confirmar',
    legacyFact: {
      shape: 'state.payments (recorded, not yet executed)',
      id: 'pay-legacy-fx-007',
      amount: 150.0,
      currency: 'USD',
      status: 'scheduled'
    },
    canonicalSetup(cmd, key) {
      const payment = cmd('recordPayment', {
        direction: 'OUTFLOW',
        amountCents: 15000,
        currency: 'USD',
        method: 'check',
        paymentDate: '2026-03-20',
        idempotencyKey: key('c7-pay')
      });
      return { payment };
    },
    expected: {
      amountCents: 15000,
      currency: 'USD',
      economicState: 'PENDING'
    }
  },

  {
    id: 'case08_payment_confirmed',
    bloque4Case: 8,
    title: 'Payment CONFIRMED — con OwnerLedgerEntry asociado',
    legacyFact: {
      shape: 'state.paymentExecutions (executed) / state.payments status=paid',
      id: 'pay-legacy-fx-008',
      amount: 275.0,
      currency: 'USD',
      status: 'paid'
    },
    canonicalSetup(cmd, key) {
      const payment = cmd('recordPayment', {
        direction: 'OUTFLOW',
        amountCents: 27500,
        currency: 'USD',
        method: 'ach',
        paymentDate: '2026-03-21',
        idempotencyKey: key('c8-pay')
      });
      const confirm = cmd('confirmPayment', { paymentId: payment.data.id, idempotencyKey: key('c8-conf') });
      return { payment, confirm };
    },
    expected: {
      amountCents: 27500,
      currency: 'USD',
      economicState: 'CONFIRMED',
      expectOwnerLedgerEntry: true
    }
  },

  {
    id: 'case09_payment_failed',
    bloque4Case: 9,
    title: 'Payment FAILED',
    legacyFact: {
      shape: 'state.payments status=failed',
      id: 'pay-legacy-fx-009',
      amount: 90.0,
      currency: 'USD',
      status: 'failed'
    },
    canonicalSetup(cmd, key) {
      const payment = cmd('recordPayment', {
        direction: 'OUTFLOW',
        amountCents: 9000,
        currency: 'USD',
        method: 'check',
        paymentDate: '2026-03-22',
        idempotencyKey: key('c9-pay')
      });
      const fail = cmd('failPayment', { paymentId: payment.data.id, reason: 'declined', idempotencyKey: key('c9-fail') });
      return { payment, fail };
    },
    expected: {
      amountCents: 9000,
      currency: 'USD',
      economicState: 'FAILED'
    }
  },

  {
    id: 'case10_allocation_both_target_types',
    bloque4Case: 10,
    title: 'PaymentAllocation — targetType VENUE_RECEIVABLE y PAYABLE',
    legacyFact: {
      shape: 'state.paymentAllocations (two rows, two target kinds)',
      rows: [
        { id: 'alloc-legacy-fx-010a', targetKind: 'venuePayment', amount: 100.0 },
        { id: 'alloc-legacy-fx-010b', targetKind: 'payment(payable)', amount: 120.0 }
      ]
    },
    canonicalSetup(cmd, key) {
      const venue = cmd('createVenue', { name: 'Venue Fixture Delta', idempotencyKey: key('c10-venue') });
      const occ = cmd('createOccurrenceWithPfr', {
        venueId: venue.data.id,
        date: '2026-03-25',
        shift: 'default',
        startTime: '20:00',
        rateAmountCents: 10000,
        idempotencyKey: key('c10-occ')
      });
      const receivable = cmd('createVenueReceivable', {
        occurrenceId: occ.data.occurrence.id,
        amountCents: 10000,
        idempotencyKey: key('c10-rec')
      });
      const inPayment = cmd('recordPayment', {
        direction: 'INFLOW', amountCents: 10000, currency: 'USD', method: 'zelle', paymentDate: '2026-03-26', idempotencyKey: key('c10-inpay')
      });
      cmd('confirmPayment', { paymentId: inPayment.data.id, idempotencyKey: key('c10-inconf') });
      const allocReceivable = cmd('allocatePayment', {
        paymentId: inPayment.data.id, targetType: 'VENUE_RECEIVABLE', targetId: receivable.data.id, amountCents: 10000, idempotencyKey: key('c10-allocA')
      });

      const payable = cmd('createPayable', {
        sourceType: 'EXPENSE', payeeId: 'payee-fixture-010', purpose: 'VENDOR_PAYMENT', amountCents: 12000, currency: 'USD', idempotencyKey: key('c10-payable')
      });
      const outPayment = cmd('recordPayment', {
        direction: 'OUTFLOW', amountCents: 12000, currency: 'USD', method: 'zelle', paymentDate: '2026-03-27', idempotencyKey: key('c10-outpay')
      });
      cmd('confirmPayment', { paymentId: outPayment.data.id, idempotencyKey: key('c10-outconf') });
      const allocPayable = cmd('allocatePayment', {
        paymentId: outPayment.data.id, targetType: 'PAYABLE', targetId: payable.data.id, amountCents: 12000, idempotencyKey: key('c10-allocB')
      });

      return { venue, occ, receivable, inPayment, allocReceivable, payable, outPayment, allocPayable };
    },
    expected: {
      allocationA: { amountCents: 10000, targetType: 'VENUE_RECEIVABLE' },
      allocationB: { amountCents: 12000, targetType: 'PAYABLE' }
    }
  },

  {
    id: 'case11_recurring_instance',
    bloque4Case: 11,
    title: 'Recurrencia — instancia generada por el Scheduler',
    legacyFact: {
      shape: 'state.recurringPayments (active) + 1 generated instance',
      recurringDefinition: { id: 'recur-legacy-fx-011', frequency: 'monthly', amount: 220.0, currency: 'USD', active: true },
      generatedInstance: { amount: 220.0, currency: 'USD', dueDate: '2026-04-01' }
    },
    canonicalSetup(cmd, key) {
      // El motor de recurrencia (generateDueRecurringPaymentInstances) es
      // KEEP sin equivalente canónico propio (007C Bloque 2) — su ÚNICA
      // salida económica es una instancia de Payment normal, una vez
      // generada. Se materializa aquí como un recordPayment ordinario,
      // exactamente como haría el Core cuando esa instancia se ejecute.
      const payment = cmd('recordPayment', {
        direction: 'OUTFLOW',
        amountCents: 22000,
        currency: 'USD',
        method: 'ach',
        paymentDate: '2026-04-01',
        idempotencyKey: key('c11-pay')
      });
      return { payment };
    },
    expected: {
      amountCents: 22000,
      currency: 'USD',
      economicState: 'PENDING',
      note: 'El Scheduler en sí no tiene entidad canónica — solo su instancia generada.'
    }
  },

  {
    id: 'case12_hybrid_partial_three_pieces',
    bloque4Case: 12,
    title: 'Pago legacy híbrido (partial) — 3 piezas canónicas relacionadas',
    legacyFact: {
      shape: 'state.payments (hybrid, partial)',
      id: 'pay-legacy-fx-012',
      payeeId: 'payee-fixture-012',
      amount: 900.0,
      currency: 'USD',
      status: 'partial',
      paidAmount: 400.0
    },
    canonicalSetup(cmd, key) {
      const payable = cmd('createPayable', {
        sourceType: 'EXPENSE', payeeId: 'payee-fixture-012', purpose: 'VENDOR_PAYMENT', amountCents: 90000, currency: 'USD', idempotencyKey: key('c12-payable')
      });
      const payment = cmd('recordPayment', {
        direction: 'OUTFLOW', amountCents: 40000, currency: 'USD', method: 'zelle', paymentDate: '2026-04-05', idempotencyKey: key('c12-pay')
      });
      const confirm = cmd('confirmPayment', { paymentId: payment.data.id, idempotencyKey: key('c12-conf') });
      const alloc = cmd('allocatePayment', {
        paymentId: payment.data.id, targetType: 'PAYABLE', targetId: payable.data.id, amountCents: 40000, idempotencyKey: key('c12-alloc')
      });
      return { payable, payment, confirm, alloc };
    },
    expected: {
      // Regla explícita de Bloque 5: legacy 'partial' NO se traduce 1:1.
      // Es Payment CONFIRMED + Payable PARTIALLY_PAID + 1 Allocation < total.
      payableAmountCents: 90000,
      paymentAmountCents: 40000,
      paymentEconomicState: 'CONFIRMED',
      payableEconomicState: 'PARTIALLY_PAID',
      payableRemainingCents: 50000,
      allocationLessThanPayable: true
    }
  },

  {
    id: 'case13_venuepayment_legacy_pending',
    bloque4Case: 13,
    title: 'VenuePayment legacy — status=pending (equivalente a VenueReceivable OPEN)',
    legacyFact: {
      shape: 'state.venuePayments',
      id: 'vpay-legacy-fx-013',
      venueId: 'venue-fixture-epsilon',
      amount: 480.0,
      currency: 'USD',
      status: 'pending'
    },
    canonicalSetup(cmd, key) {
      const venue = cmd('createVenue', { name: 'Venue Fixture Epsilon', idempotencyKey: key('c13-venue') });
      const occ = cmd('createOccurrenceWithPfr', {
        venueId: venue.data.id, date: '2026-04-10', shift: 'default', startTime: '20:00', rateAmountCents: 48000, idempotencyKey: key('c13-occ')
      });
      const receivable = cmd('createVenueReceivable', {
        occurrenceId: occ.data.occurrence.id, amountCents: 48000, idempotencyKey: key('c13-rec')
      });
      return { venue, occ, receivable };
    },
    expected: {
      amountCents: 48000,
      currency: 'USD',
      economicState: 'OPEN',
      remainingCents: 48000
    }
  },

  {
    id: 'case14_currency_mismatch',
    bloque4Case: 14,
    title: 'Moneda no-USD — prueba normalizeCurrency / CURRENCY_MISMATCH',
    legacyFact: {
      shape: 'state.venuePayments (EUR) vs state.payments (USD)',
      receivable: { id: 'vpay-legacy-fx-014', currency: 'EUR', amount: 100.0 },
      payment: { id: 'pay-legacy-fx-014', currency: 'USD', amount: 100.0 },
      note: 'legacy no aplica bloqueo estricto de moneda en el mismo punto que el Core — ver nota de asimetría en el reporte del harness.'
    },
    canonicalSetup(cmd, key) {
      const venue = cmd('createVenue', { name: 'Venue Fixture Zeta', idempotencyKey: key('c14-venue') });
      const occ = cmd('createOccurrenceWithPfr', {
        venueId: venue.data.id, date: '2026-04-15', shift: 'default', startTime: '20:00', rateAmountCents: 10000, idempotencyKey: key('c14-occ')
      });
      const receivable = cmd('createVenueReceivable', {
        occurrenceId: occ.data.occurrence.id, amountCents: 10000, currency: 'EUR', idempotencyKey: key('c14-rec')
      });
      const payment = cmd('recordPayment', {
        direction: 'INFLOW', amountCents: 10000, currency: 'USD', method: 'cash', paymentDate: '2026-04-16', idempotencyKey: key('c14-pay')
      });
      cmd('confirmPayment', { paymentId: payment.data.id, idempotencyKey: key('c14-conf') });
      const allocAttempt = cmd('allocatePayment', {
        paymentId: payment.data.id, targetType: 'VENUE_RECEIVABLE', targetId: receivable.data.id, amountCents: 10000, idempotencyKey: key('c14-alloc')
      });
      return { venue, occ, receivable, payment, allocAttempt };
    },
    expected: {
      allocationMustFail: true,
      expectedErrorCode: 'CURRENCY_MISMATCH'
    }
  },

  {
    id: 'case15_idempotency_replay',
    bloque4Case: 15,
    title: 'Idempotencia — misma idempotencyKey, mismo payload, dos invocaciones',
    legacyFact: {
      shape: 'executePayment/allocatePaymentExecution con opts.idempotencyKey repetida (patrón ya documentado en accounting-module.js self-tests)',
      note: 'No se ejecuta accounting-module.js en este harness (restricción del ticket) — se documenta el comportamiento esperado según su propio patrón de idempotencia ya probado, no se verifica en vivo.'
    },
    canonicalSetup(cmd, key) {
      const fixedKey = 'c15-fixed-idempotency-key';
      const payload = {
        direction: 'OUTFLOW', amountCents: 33000, currency: 'USD', method: 'check', paymentDate: '2026-04-20', idempotencyKey: fixedKey
      };
      const first = cmd('recordPayment', payload);
      const second = cmd('recordPayment', payload);
      return { first, second };
    },
    expected: {
      firstCreatesEntity: true,
      secondIsReplay: true,
      noDuplicateEntity: true
    }
  },

  {
    id: 'case16_occurrenceId_present_and_absent',
    bloque4Case: 16,
    title: 'occurrenceId — un caso presente, uno ausente',
    legacyFact: {
      shape: 'state.payments.performanceId presente / ausente',
      withOccurrence: { id: 'pay-legacy-fx-016a', performanceId: 'occ-legacy-fx-016' },
      withoutOccurrence: { id: 'pay-legacy-fx-016b', performanceId: null }
    },
    canonicalSetup(cmd, key) {
      const venue = cmd('createVenue', { name: 'Venue Fixture Eta', idempotencyKey: key('c16-venue') });
      const occ = cmd('createOccurrenceWithPfr', {
        venueId: venue.data.id, date: '2026-04-25', shift: 'default', startTime: '20:00', rateAmountCents: 20000, idempotencyKey: key('c16-occ')
      });
      const receivableWithOcc = cmd('createVenueReceivable', {
        occurrenceId: occ.data.occurrence.id, amountCents: 20000, idempotencyKey: key('c16-rec')
      });
      const payableWithoutOcc = cmd('createPayable', {
        sourceType: 'EXPENSE', payeeId: 'payee-fixture-016', purpose: 'VENDOR_PAYMENT', amountCents: 15000, currency: 'USD', idempotencyKey: key('c16-payable')
      });
      return { venue, occ, receivableWithOcc, payableWithoutOcc };
    },
    expected: {
      withOccurrence: { hasOccurrenceLink: true },
      withoutOccurrence: { hasOccurrenceLink: false }
    }
  },

  {
    id: 'case17_agreementId_present_and_absent',
    bloque4Case: 17,
    title: 'agreementId — un caso presente (residencia), uno ausente (one-off coverage)',
    legacyFact: {
      shape: 'Accounting Center Wizard: Recurring occurrence (agreementId presente) vs One-off coverage (agreementId ausente)',
      withAgreement: { note: 'createOccurrenceWithPfr(agreementId=<real>) — vía createVenueAgreement' },
      withoutAgreement: { note: 'createOccurrenceWithPfr(agreementId=null) — cobertura puntual, ya documentada como NO conectada en runtime real (§18 doc técnico)' }
    },
    canonicalSetup(cmd, key) {
      const venue = cmd('createVenue', { name: 'Venue Fixture Theta', idempotencyKey: key('c17-venue') });
      const agreement = cmd('createVenueAgreement', {
        venueId: venue.data.id, rateByDay: { friday: 20000 }, effectiveFrom: '2026-05-01', idempotencyKey: key('c17-agr')
      });
      const occWithAgreement = cmd('createOccurrenceWithPfr', {
        venueId: venue.data.id, agreementId: agreement.data.id, date: '2026-05-01', shift: 'default', startTime: '20:00', rateAmountCents: 20000, idempotencyKey: key('c17-occ-with')
      });
      const occOneOff = cmd('createOccurrenceWithPfr', {
        venueId: venue.data.id, date: '2026-05-08', shift: 'default', startTime: '20:00', rateAmountCents: 25000, idempotencyKey: key('c17-occ-without')
      });
      return { venue, agreement, occWithAgreement, occOneOff };
    },
    expected: {
      withAgreement: { hasAgreementLink: true },
      withoutAgreement: { hasAgreementLink: false }
    }
  },

  {
    id: 'case18_incomplete_legacy_data',
    bloque4Case: 18,
    title: 'Datos legacy incompletos — paidAmount ausente, reference vacío',
    legacyFact: {
      shape: 'state.payments con campos ausentes/vacíos',
      id: 'pay-legacy-fx-018',
      amount: 200.0,
      currency: 'USD',
      paidAmount: undefined,
      reference: ''
    },
    canonicalSetup(cmd, key) {
      const payment = cmd('recordPayment', {
        direction: 'OUTFLOW',
        amountCents: 20000,
        currency: 'USD',
        method: 'check',
        paymentDate: '2026-05-10',
        idempotencyKey: key('c18-pay')
        // reference intencionalmente omitido — no se fabrica un valor.
      });
      return { payment };
    },
    expected: {
      amountCents: 20000,
      currency: 'USD',
      paidAmountTreatedAsZero: true,
      referenceMustBeAbsentNotFabricated: true
    }
  }
];
