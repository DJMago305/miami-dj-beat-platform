/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  OftlContractError,
  assertValidMoneyMinorUnits,
  asFinancialObligationId,
  asIdempotencyKey,
  asOwnerFinancialTransactionId,
  asOwnerTransactionLegId,
  asTransactionGroupId,
  isObligationLifecycleStatus,
  isTransactionLifecycleStatus,
  OBLIGATION_LIFECYCLE_STATUSES,
  TRANSACTION_LIFECYCLE_STATUSES,
  type FinancialObligation,
  type FinancialObligationId,
  type OwnerFinancialTransaction,
  type OwnerFinancialTransactionId,
  type OwnerTransactionLeg,
  type OwnerTransactionLegId,
} from '../../shared/services/finance/contracts';

const USD = 'USD' as const;

const sampleObligation = (): FinancialObligation => ({
  schemaVersion: 1,
  financialObligationId: asFinancialObligationId('obl-001'),
  obligationKind: 'ARTIST_PAYABLE',
  obligationStatus: 'OPEN',
  creditorParty: { partyType: 'ARTIST', djProfileId: 'dj-001', displayName: 'DJ Carlos' },
  debtorParty: { partyType: 'COMPANY', displayName: 'Miami DJ Beat' },
  sourceReference: { sourceSystem: 'owner_manual', sourceRecordId: 'manual-1' },
  originalAmount: { amountMinorUnits: 40000, currencyCode: USD },
  pendingAmount: { amountMinorUnits: 40000, currencyCode: USD },
  effectiveDate: '2026-07-01',
  dueDate: '2026-07-15',
  concept: 'Event payout agreement',
  recordedByUserId: 'user-owner-001',
  createdAt: '2026-07-23T12:00:00.000Z',
  updatedAt: '2026-07-23T12:00:00.000Z',
});

const sampleTransaction = (): OwnerFinancialTransaction => ({
  schemaVersion: 1,
  ownerFinancialTransactionId: asOwnerFinancialTransactionId('txn-001'),
  transactionGroupId: asTransactionGroupId('grp-001'),
  idempotencyKey: asIdempotencyKey('idemp-001'),
  sourceSystem: 'owner_manual',
  lifecycleStatus: 'POSTED',
  direction: 'OUTFLOW',
  operationType: 'ARTIST_COMPENSATION_PAYMENT',
  companyCategory: 'ARTIST_COMPENSATION',
  paymentMethod: 'CASH',
  paymentProvider: 'NONE',
  totalAmount: { amountMinorUnits: 40000, currencyCode: USD },
  counterpartyType: 'ARTIST',
  djProfileId: 'dj-001',
  concept: 'Cash payout DJ Carlos',
  effectiveDate: '2026-07-23',
  paymentDate: '2026-07-23',
  recordedAt: '2026-07-23T14:00:00.000Z',
  transactionLegIds: [asOwnerTransactionLegId('leg-001'), asOwnerTransactionLegId('leg-002')],
  authorizationContext: {
    recordedByUserId: 'user-owner-001',
    capabilitySnapshot: ['finance.transaction.create'],
  },
  createdAt: '2026-07-23T14:00:00.000Z',
  updatedAt: '2026-07-23T14:00:00.000Z',
});

const sampleLeg = (): OwnerTransactionLeg => ({
  schemaVersion: 1,
  ownerTransactionLegId: asOwnerTransactionLegId('leg-001'),
  ownerFinancialTransactionId: asOwnerFinancialTransactionId('txn-001'),
  transactionGroupId: asTransactionGroupId('grp-001'),
  legRole: 'COMPANY',
  legDirection: 'OUTFLOW',
  ledgerBucket: 'COMPANY',
  companyCategory: 'ARTIST_COMPENSATION',
  party: { partyType: 'COMPANY', displayName: 'Miami DJ Beat' },
  amount: { amountMinorUnits: 40000, currencyCode: USD },
  operationType: 'ARTIST_COMPENSATION_PAYMENT',
  concept: 'Company expense leg',
  createdAt: '2026-07-23T14:00:00.000Z',
  updatedAt: '2026-07-23T14:00:00.000Z',
});

describe('OFTL data contracts — TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001', () => {
  it('builds valid FinancialObligation fixture', () => {
    const obligation = sampleObligation();
    expect(obligation.financialObligationId).toBe('obl-001');
    expect(obligation.originalAmount.currencyCode).toBe(USD);
    assertValidMoneyMinorUnits(obligation.originalAmount.amountMinorUnits);
  });

  it('builds valid OwnerFinancialTransaction fixture', () => {
    const txn = sampleTransaction();
    expect(txn.lifecycleStatus).toBe('POSTED');
    expect(txn.totalAmount.currencyCode).toBe(USD);
    expect(txn.transactionLegIds).toHaveLength(2);
  });

  it('builds valid OwnerTransactionLeg fixture', () => {
    const leg = sampleLeg();
    expect(leg.ownerFinancialTransactionId).toBe('txn-001');
    expect(leg.financialObligationId).toBeUndefined();
  });

  it('JSON-serializes all three core contracts', () => {
    const roundtrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
    expect(roundtrip(sampleObligation()).schemaVersion).toBe(1);
    expect(roundtrip(sampleTransaction()).idempotencyKey).toBe('idemp-001');
    expect(roundtrip(sampleLeg()).ledgerBucket).toBe('COMPANY');
  });

  it('requires explicit currency on monetary fields', () => {
    const txn = sampleTransaction();
    expect(txn.totalAmount.currencyCode).toBeTruthy();
    expect(typeof txn.totalAmount.currencyCode).toBe('string');
  });

  it('uses integer minor units for amounts', () => {
    const amount = sampleTransaction().totalAmount.amountMinorUnits;
    expect(Number.isInteger(amount)).toBe(true);
    assertValidMoneyMinorUnits(amount);
  });

  it('rejects decimal minor units', () => {
    expect(() => assertValidMoneyMinorUnits(10.5)).toThrow(OftlContractError);
  });

  it('rejects NaN minor units', () => {
    expect(() => assertValidMoneyMinorUnits(Number.NaN)).toThrow(OftlContractError);
  });

  it('rejects Infinity minor units', () => {
    expect(() => assertValidMoneyMinorUnits(Number.POSITIVE_INFINITY)).toThrow(OftlContractError);
    expect(() => assertValidMoneyMinorUnits(Number.NEGATIVE_INFINITY)).toThrow(OftlContractError);
  });

  it('rejects unsafe positive integer minor units', () => {
    expect(() => assertValidMoneyMinorUnits(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      OftlContractError,
    );
  });

  it('rejects unsafe negative integer minor units', () => {
    expect(() => assertValidMoneyMinorUnits(Number.MIN_SAFE_INTEGER - 1)).toThrow(
      OftlContractError,
    );
  });

  it('accepts one and max safe positive minor units', () => {
    expect(() => assertValidMoneyMinorUnits(1)).not.toThrow();
    expect(() => assertValidMoneyMinorUnits(Number.MAX_SAFE_INTEGER)).not.toThrow();
  });

  it('rejects zero by default and accepts zero when allowZero is true', () => {
    expect(() => assertValidMoneyMinorUnits(0)).toThrow(OftlContractError);
    expect(() => assertValidMoneyMinorUnits(0, { allowZero: true })).not.toThrow();
  });

  it('rejects negative minor units (sign via direction, not amount)', () => {
    expect(() => assertValidMoneyMinorUnits(-1)).toThrow(OftlContractError);
    expect(() => assertValidMoneyMinorUnits(Number.MIN_SAFE_INTEGER)).toThrow(OftlContractError);
  });

  it('separates obligation lifecycle from transaction lifecycle types', () => {
    expect(TRANSACTION_LIFECYCLE_STATUSES).not.toContain('OPEN');
    expect(OBLIGATION_LIFECYCLE_STATUSES).not.toContain('POSTED');
    expect(isTransactionLifecycleStatus('POSTED')).toBe(true);
    expect(isObligationLifecycleStatus('OPEN')).toBe(true);
    expect(isTransactionLifecycleStatus('OPEN')).toBe(false);
    expect(isObligationLifecycleStatus('POSTED')).toBe(false);
  });

  it('links each leg to a parent transaction', () => {
    const leg = sampleLeg();
    expect(leg.ownerFinancialTransactionId).toBe('txn-001');
  });

  it('allows optional obligation reference on leg', () => {
    const withObligation: OwnerTransactionLeg = {
      ...sampleLeg(),
      ownerTransactionLegId: asOwnerTransactionLegId('leg-002'),
      legRole: 'COUNTERPARTY',
      legDirection: 'INFLOW',
      ledgerBucket: 'ARTIST_WALLET',
      financialObligationId: asFinancialObligationId('obl-001'),
      party: { partyType: 'ARTIST', djProfileId: 'dj-001' },
    };
    expect(withObligation.financialObligationId).toBe('obl-001');
  });

  it('exports public contract symbols from finance barrel', async () => {
    const finance = await import('../../shared/services/finance');
    expect(finance.assertValidMoneyMinorUnits).toBeTypeOf('function');
    expect(finance.asFinancialObligationId).toBeTypeOf('function');
    expect(finance.TRANSACTION_LIFECYCLE_STATUSES.length).toBeGreaterThan(0);
    expect(finance.OBLIGATION_LIFECYCLE_STATUSES.length).toBeGreaterThan(0);
  });

  it('module source has no runtime forbidden imports', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const root = path.resolve(import.meta.dirname, '../../shared/services/finance');
    const files = [
      'contracts/oftl-ids.ts',
      'contracts/oftl-enums.ts',
      'contracts/oftl-primitives.ts',
      'contracts/oftl-entities.ts',
      'contracts/oftl-guards.ts',
      'contracts/index.ts',
      'index.ts',
    ];
    const forbidden = [
      '@supabase',
      'localStorage',
      'sessionStorage',
      'fetch(',
      'XMLHttpRequest',
      "from '../provider",
      'from "./provider',
      "from '../../provider",
      '/repository',
      '/adapter',
    ];
    for (const file of files) {
      const content = await fs.readFile(path.join(root, file), 'utf8');
      for (const needle of forbidden) {
        expect(content.includes(needle), `${file} must not reference ${needle}`).toBe(false);
      }
    }
  });

  it('OFTL-DC-01: obligation and transaction are distinct contract shapes', () => {
    const obligation = sampleObligation();
    const txn = sampleTransaction();
    expect('financialObligationId' in obligation).toBe(true);
    expect('ownerFinancialTransactionId' in txn).toBe(true);
    expect('obligationStatus' in obligation).toBe(true);
    expect('lifecycleStatus' in txn).toBe(true);
    expect('financialObligationId' in txn).toBe(false);
  });

  it('core financial IDs are nominally incompatible at compile time', () => {
    const obligationId = asFinancialObligationId('obl-001');
    const transactionId = asOwnerFinancialTransactionId('txn-001');
    const legId = asOwnerTransactionLegId('leg-001');

    expect(obligationId).toBe('obl-001');
    expect(transactionId).toBe('txn-001');
    expect(legId).toBe('leg-001');

    type ExpectNotAssignable<T, U> = T extends U ? never : true;
    type ObligationToTransaction = ExpectNotAssignable<
      FinancialObligationId,
      OwnerFinancialTransactionId
    >;
    type TransactionToLeg = ExpectNotAssignable<OwnerFinancialTransactionId, OwnerTransactionLegId>;
    type LegToObligation = ExpectNotAssignable<OwnerTransactionLegId, FinancialObligationId>;

    const obligationToTransaction: ObligationToTransaction = true;
    const transactionToLeg: TransactionToLeg = true;
    const legToObligation: LegToObligation = true;

    expect(obligationToTransaction).toBe(true);
    expect(transactionToLeg).toBe(true);
    expect(legToObligation).toBe(true);

    // @ts-expect-error FinancialObligationId must not assign to OwnerFinancialTransactionId
    const badTxnId: OwnerFinancialTransactionId = obligationId;
    // @ts-expect-error OwnerFinancialTransactionId must not assign to OwnerTransactionLegId
    const badLegId: OwnerTransactionLegId = transactionId;
    // @ts-expect-error OwnerTransactionLegId must not assign to FinancialObligationId
    const badOblId: FinancialObligationId = legId;

    expect(badTxnId).toBe('obl-001');
    expect(badLegId).toBe('txn-001');
    expect(badOblId).toBe('leg-001');
  });
});
