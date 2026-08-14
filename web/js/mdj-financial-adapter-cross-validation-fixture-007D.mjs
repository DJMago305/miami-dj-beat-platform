/**
 * TICKET-V1-FINANCIAL-LEGACY-TO-CANONICAL-READONLY-ADAPTER-007D — cross-
 * validation fixture. Cierra la cadena LEGACY FACT → ADAPTER → CANONICAL
 * SHAPE → CANONICAL CORE, reutilizando los 18 casos ya aprobados de Gate 5/6
 * (mdj-financial-canonical-equivalence-fixture-007C.mjs) sin modificarlos —
 * ese archivo permanece intacto, su sha256 archivado en Gate 5/6 sigue
 * siendo válido.
 *
 * Este archivo aporta SOLO lo que el adapter necesita y el fixture original
 * no tenía: campos técnicos (paymentMethod, recordedBy, IDs de occurrence,
 * createdAt) y, donde el vocabulario de `status` que usé en el fixture
 * original no coincide con el vocabulario real que el adapter reconoce
 * (§6 / 007C Bloque 3), la corrección exacta — nunca un monto, estado
 * económico, relación o escenario de negocio nuevo.
 *
 * DETERMINACIÓN PREVIA POR CASO (regla crítica de 007D: primero decidir
 * dónde está el problema, antes de correr nada):
 *
 * - Caso 1: legacyFact.status='pending' en el fixture original NO es un
 *   valor real de accounting-module.js (su enum real es scheduled/approved/
 *   paid/partial/failed/cancelled/not_applicable — confirmado en el diff
 *   real del archivo). Es una imprecisión de autoría del fixture, no del
 *   adapter. Corrección: 'scheduled' — mismo significado económico (abierto,
 *   no ejecutado), vocabulario correcto.
 * - Caso 5: el adapter documenta explícitamente (comentario propio, línea
 *   ~253) que "no partial-collection state exists in legacy VenuePayment
 *   today" — coincide con el hueco ya confirmado en MOD-ACCOUNTING.md
 *   ("1 occurrence cobrable = 1 venuePayment pending, no resuelto"). El
 *   'partially_received' que usé en el fixture original no es un legacyFact
 *   real — no existe forma legacy que lo represente. NO se fuerza: este
 *   caso queda marcado `applicable:false` con la razón documentada, no como
 *   FAIL — es una limitación real y ya conocida del legacy, no del adapter.
 * - Caso 10: el fixture original describía las allocations con campos
 *   inventados (targetKind/amount) que no existen en el adapter
 *   (amountAllocated/receivableId/payableId/paymentId, §6). Reescrito con
 *   los nombres de campo reales, mismos montos (100.00/120.00) y mismos
 *   target types que el canonicalSetup original ya crea.
 * - Caso 11: el fixture original anidaba los datos bajo `recurringDefinition`/
 *   `generatedInstance`; el adapter espera los campos al nivel superior del
 *   objeto. Reestructurado, mismo monto/frecuencia.
 * - Caso 14: la mecánica de CURRENCY_MISMATCH es un comportamiento del Core
 *   en tiempo de allocation (Gate 6 ya la probó) — el adapter nunca asigna
 *   nada, solo traduce forma. Aquí se verifica que EUR/USD se traducen cada
 *   uno correctamente por separado, no que el adapter produzca el error.
 * - Caso 15: la idempotencia es un concepto de runtime/store; el adapter es
 *   puro y sin estado (su propio self-test ya prueba que llamadas repetidas
 *   producen salida idéntica). No hay legacyFact real que traducir aquí —
 *   `applicable:false`, no FAIL.
 * - Caso 16: el fixture original decía "state.payments.performanceId" pero
 *   el canonicalSetup real de ese caso crea un VenueReceivable (con
 *   occurrence) y un Payable (sin occurrence) — nunca un Payment. Reescrito
 *   para traducir exactamente esas dos piezas (VenuePayment con
 *   occurrenceId / Payment pre-ejecución sin performanceId ni agreementId →
 *   sourceType EXPENSE), no un Payment con performanceId que el
 *   canonicalSetup nunca creó.
 * - Caso 17: el fixture original no tenía datos, solo notas — construido
 *   completo contra `translateLegacyOccurrence`, mismos montos/fechas que
 *   canonicalSetup ya usa.
 * - Caso 12: el adapter traduce el Payment híbrido a exactamente 2 piezas
 *   (Payment + Payable) — el modelo legacy híbrido no tiene una fila de
 *   Allocation separada (esa solo existe en el mecanismo distinto de
 *   `state.paymentAllocations`, ticket 007, ya cubierto por el Caso 10). La
 *   comparación de este caso es Payment+Payable únicamente — no se inventa
 *   una allocation legacy que el modelo híbrido no tiene.
 *
 * Todos los IDs/fechas/`recordedBy` añadidos aquí son sintéticos,
 * determinísticos, no sensibles — ninguno cambia importe, estado económico
 * ni relación de ningún caso.
 */

export const CROSS_VALIDATION_FIXTURE_VERSION = '1.0.0';

export const adapterCases = [
  {
    id: 'case01_payable_open',
    applicable: true,
    translate: 'translateLegacyPayment',
    input: {
      id: 'pay-legacy-fx-001',
      payeeId: 'payee-fixture-001',
      amount: 500.0,
      currency: 'USD',
      status: 'scheduled', // corregido de 'pending' — vocabulario real, mismo significado económico
      paidAmount: 0,
      recordedBy: 'staff-fixture-adapter',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z'
    }
  },
  {
    id: 'case02_payable_partially_paid',
    applicable: true,
    translate: 'translateLegacyPayment',
    input: {
      id: 'pay-legacy-fx-002',
      payeeId: 'payee-fixture-002',
      amount: 600.0,
      currency: 'USD',
      status: 'partial',
      paidAmount: 200.0,
      paymentMethod: 'zelle',
      paidDate: '2026-02-01',
      recordedBy: 'staff-fixture-adapter',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z'
    }
  },
  {
    id: 'case03_payable_paid',
    applicable: true,
    translate: 'translateLegacyPayment',
    input: {
      id: 'pay-legacy-fx-003',
      payeeId: 'payee-fixture-003',
      amount: 300.0,
      currency: 'USD',
      status: 'paid',
      paidAmount: 300.0,
      paymentMethod: 'zelle',
      paidDate: '2026-02-02',
      recordedBy: 'staff-fixture-adapter',
      createdAt: '2026-02-02T00:00:00.000Z',
      updatedAt: '2026-02-02T00:00:00.000Z'
    }
  },
  {
    id: 'case04_receivable_open',
    applicable: true,
    translate: 'translateLegacyVenuePayment',
    input: {
      id: 'vpay-legacy-fx-004',
      venueId: 'venue-fixture-alpha',
      occurrenceId: 'occ-legacy-fx-004', // técnico, faltaba en el fixture original
      amount: 420.0,
      currency: 'USD',
      status: 'pending',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z'
    }
  },
  {
    id: 'case05_receivable_partially_collected',
    applicable: false,
    reason:
      'NO_LEGACY_SHAPE_EXISTS — el adapter documenta (y MOD-ACCOUNTING.md ya confirma) que legacy VenuePayment no tiene estado de cobro parcial. No existe legacyFact real que representar aquí; forzarlo inventaría una forma legacy que nunca existió. No es una divergencia del adapter.'
  },
  {
    id: 'case06_receivable_paid',
    applicable: true,
    translate: 'translateLegacyVenuePayment',
    input: {
      id: 'vpay-legacy-fx-006',
      venueId: 'venue-fixture-gamma',
      occurrenceId: 'occ-legacy-fx-006',
      amount: 600.0,
      currency: 'USD',
      status: 'received',
      createdAt: '2026-03-15T00:00:00.000Z',
      updatedAt: '2026-03-16T00:00:00.000Z'
    }
  },
  {
    id: 'case07_payment_pending',
    applicable: true,
    translate: 'translateLegacyPayment',
    input: {
      id: 'pay-legacy-fx-007',
      amount: 150.0,
      currency: 'USD',
      status: 'scheduled',
      paymentMethod: 'check',
      payeeId: 'payee-fixture-007',
      recordedBy: 'staff-fixture-adapter',
      createdAt: '2026-03-20T00:00:00.000Z',
      updatedAt: '2026-03-20T00:00:00.000Z'
    }
  },
  {
    id: 'case08_payment_confirmed',
    applicable: true,
    translate: 'translateLegacyPayment',
    input: {
      id: 'pay-legacy-fx-008',
      amount: 275.0,
      currency: 'USD',
      status: 'paid',
      paidAmount: 275.0,
      paymentMethod: 'ach',
      payeeId: 'payee-fixture-008',
      paidDate: '2026-03-21',
      recordedBy: 'staff-fixture-adapter',
      createdAt: '2026-03-21T00:00:00.000Z',
      updatedAt: '2026-03-21T00:00:00.000Z'
    }
  },
  {
    id: 'case09_payment_failed',
    applicable: true,
    translate: 'translateLegacyPayment',
    input: {
      id: 'pay-legacy-fx-009',
      amount: 90.0,
      currency: 'USD',
      status: 'failed',
      paymentMethod: 'check',
      payeeId: 'payee-fixture-009',
      recordedBy: 'staff-fixture-adapter',
      createdAt: '2026-03-22T00:00:00.000Z',
      updatedAt: '2026-03-22T00:00:00.000Z'
    }
  },
  {
    id: 'case10_allocation_both_target_types',
    applicable: true,
    translate: 'translateLegacyPaymentAllocation',
    inputs: [
      {
        id: 'alloc-legacy-fx-010a',
        paymentId: 'pay-legacy-fx-010a',
        receivableId: 'vpay-legacy-fx-010a',
        amountAllocated: 100.0,
        allocatedBy: 'staff-fixture-adapter',
        createdAt: '2026-03-26T00:00:00.000Z'
      },
      {
        id: 'alloc-legacy-fx-010b',
        paymentId: 'pay-legacy-fx-010b',
        payableId: 'payable-legacy-fx-010b',
        amountAllocated: 120.0,
        allocatedBy: 'staff-fixture-adapter',
        createdAt: '2026-03-27T00:00:00.000Z'
      }
    ]
  },
  {
    id: 'case11_recurring_instance',
    applicable: true,
    translate: 'translateLegacyRecurringPayment',
    input: {
      id: 'recur-legacy-fx-011',
      payeeId: 'payee-fixture-011',
      amount: 220.0,
      currency: 'USD',
      paymentMethod: 'ach',
      frequency: 'monthly',
      effectiveFrom: '2026-04-01',
      effectiveUntil: null,
      status: 'active'
    }
  },
  {
    id: 'case12_hybrid_partial_three_pieces',
    applicable: true,
    translate: 'translateLegacyPayment',
    input: {
      id: 'pay-legacy-fx-012',
      payeeId: 'payee-fixture-012',
      amount: 900.0,
      currency: 'USD',
      status: 'partial',
      paidAmount: 400.0,
      paymentMethod: 'zelle',
      paidDate: '2026-04-05',
      recordedBy: 'staff-fixture-adapter',
      createdAt: '2026-04-05T00:00:00.000Z',
      updatedAt: '2026-04-05T00:00:00.000Z'
    },
    note: 'El modelo legacy híbrido no tiene fila de Allocation separada — solo Payment+Payable. La pieza de Allocation ya se cubre por mecanismo distinto en el Caso 10.'
  },
  {
    id: 'case13_venuepayment_legacy_pending',
    applicable: true,
    translate: 'translateLegacyVenuePayment',
    input: {
      id: 'vpay-legacy-fx-013',
      venueId: 'venue-fixture-epsilon',
      occurrenceId: 'occ-legacy-fx-013',
      amount: 480.0,
      currency: 'USD',
      status: 'pending',
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z'
    }
  },
  {
    id: 'case14_currency_mismatch',
    applicable: true,
    translate: 'multi',
    note: 'El adapter nunca asigna (allocatePayment es del Core, ya probado en Gate 6). Aquí solo se verifica que EUR y USD se traducen correctamente por separado — no que el adapter produzca CURRENCY_MISMATCH.',
    inputs: {
      receivable: {
        translate: 'translateLegacyVenuePayment',
        value: {
          id: 'vpay-legacy-fx-014',
          venueId: 'venue-fixture-zeta',
          occurrenceId: 'occ-legacy-fx-014',
          amount: 100.0,
          currency: 'EUR',
          status: 'pending',
          createdAt: '2026-04-15T00:00:00.000Z',
          updatedAt: '2026-04-15T00:00:00.000Z'
        }
      },
      payment: {
        translate: 'translateLegacyPayment',
        value: {
          id: 'pay-legacy-fx-014',
          payeeId: 'payee-fixture-014',
          amount: 100.0,
          currency: 'USD',
          status: 'paid',
          paidAmount: 100.0,
          paymentMethod: 'cash',
          paidDate: '2026-04-16',
          recordedBy: 'staff-fixture-adapter',
          createdAt: '2026-04-16T00:00:00.000Z',
          updatedAt: '2026-04-16T00:00:00.000Z'
        }
      }
    }
  },
  {
    id: 'case15_idempotency_replay',
    applicable: false,
    reason:
      'NOT_AN_ADAPTER_CONCERN — el adapter es puro y sin estado (nunca persiste, nunca lleva un store de idempotencyKey); su propio self-test (caso R) ya prueba que llamadas repetidas con el mismo input producen salida idéntica y referencias distintas. No hay legacyFact real que ejecutar dos veces contra un adapter que no tiene concepto de "segunda vez".'
  },
  {
    id: 'case16_occurrenceId_present_and_absent',
    applicable: true,
    translate: 'multi',
    note: 'El canonicalSetup real de este caso crea un VenueReceivable (con occurrence) y un Payable (sin occurrence) — nunca un Payment. Corregido para traducir exactamente esas dos piezas, no una forma que el canonicalSetup nunca creó.',
    inputs: {
      withOccurrence: {
        translate: 'translateLegacyVenuePayment',
        value: {
          id: 'vpay-legacy-fx-016',
          venueId: 'venue-fixture-eta',
          occurrenceId: 'occ-legacy-fx-016',
          amount: 200.0,
          currency: 'USD',
          status: 'pending',
          createdAt: '2026-04-25T00:00:00.000Z',
          updatedAt: '2026-04-25T00:00:00.000Z'
        }
      },
      withoutOccurrence: {
        translate: 'translateLegacyPayment',
        value: {
          id: 'pay-legacy-fx-016b',
          payeeId: 'payee-fixture-016',
          amount: 150.0,
          currency: 'USD',
          status: 'scheduled',
          performanceId: null,
          agreementId: null,
          recordedBy: 'staff-fixture-adapter',
          createdAt: '2026-04-25T00:00:00.000Z',
          updatedAt: '2026-04-25T00:00:00.000Z'
        }
      }
    }
  },
  {
    id: 'case17_agreementId_present_and_absent',
    applicable: true,
    translate: 'multi',
    inputs: {
      withAgreement: {
        translate: 'translateLegacyOccurrence',
        value: {
          id: 'occ-legacy-fx-017a',
          venueId: 'venue-fixture-theta',
          agreementId: 'agr-legacy-fx-017',
          date: '2026-05-01',
          rateAmount: 200.0,
          currency: 'USD',
          status: 'scheduled',
          shiftSlot: 'default'
        }
      },
      withoutAgreement: {
        translate: 'translateLegacyOccurrence',
        value: {
          id: 'occ-legacy-fx-017b',
          venueId: 'venue-fixture-theta',
          agreementId: null,
          date: '2026-05-08',
          rateAmount: 250.0,
          currency: 'USD',
          status: 'scheduled',
          shiftSlot: 'default'
        }
      }
    }
  },
  {
    id: 'case18_incomplete_legacy_data',
    applicable: true,
    translate: 'translateLegacyPayment',
    input: {
      id: 'pay-legacy-fx-018',
      payeeId: 'payee-fixture-018',
      amount: 200.0,
      currency: 'USD',
      status: 'scheduled',
      paidAmount: undefined,
      reference: '',
      paymentMethod: 'check',
      recordedBy: 'staff-fixture-adapter',
      createdAt: '2026-05-10T00:00:00.000Z',
      updatedAt: '2026-05-10T00:00:00.000Z'
    }
  }
];
