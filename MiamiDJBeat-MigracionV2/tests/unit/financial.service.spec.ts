/**
 * financial.service.spec.ts — Paso 2 read-only financial service + mappers.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ApiMetadata, ApiResponse } from '../../shared/api/runtime';
import { createStaticSessionReader } from '../../shared/api/runtime';
import {
  MOCK_FIN_ALL_LEAD_ROWS,
  MOCK_FIN_ALL_LEDGER_ROWS,
  MOCK_FIN_ARTIST_USER_ID,
  MOCK_FIN_CLIENT_USER_ID,
  MOCK_FIN_DJ_PROFILE_ID,
  MOCK_FIN_LEAD_OTHER_CLIENT,
  MOCK_FIN_LEAD_PAID,
  MOCK_FIN_LEAD_STRIPE_PARTIAL,
  MOCK_FIN_LEAD_UNPAID,
  MOCK_FIN_LEAD_ZELLE_PENDING,
  MOCK_FIN_LEDGER_RELEASED,
  buildArtistWalletBalance,
  buildClientBalance,
  createFinancialService,
  filterReceiptsForClient,
  inferPaymentMethod,
  listFinancialServiceReadMethods,
  mapDjLedgerRowToTransaction,
  mapLeadRowToPaymentReceipt,
  redactReceiptForAudience,
  type FinancialDataPort,
} from '../../shared/services/financial/index';
import { mapV1PaymentSignalToTransactionStatus } from '../../shared/types/financial.types';

const meta: ApiMetadata = Object.freeze({
  requestId: 'req_financial',
  correlationId: 'corr_financial',
  durationMs: 1,
  attempt: 1,
  context: Object.freeze({
    requestId: 'req_financial',
    correlationId: 'corr_financial',
    portal: 'client' as const,
    sessionId: 'ses_1',
    actorType: 'authenticated',
  }),
});

function ok<T>(data: T): ApiResponse<T> {
  return Object.freeze({ ok: true, status: 200, data, metadata: meta });
}

function createPort(partial: Partial<FinancialDataPort> = {}): FinancialDataPort {
  return Object.freeze({
    selectLeadsForClient: vi.fn(async () => ok([])),
    selectLeadsForStaff: vi.fn(async () => ok([])),
    selectLeadsAssignedToArtist: vi.fn(async () => ok([])),
    selectDjLedgerForArtist: vi.fn(async () => ok([])),
    selectDjLedgerForStaff: vi.fn(async () => ok([])),
    ...partial,
  });
}

const authed = () =>
  createStaticSessionReader({
    portal: 'client',
    sessionId: 'ses_1',
    authorizationHeader: 'Bearer test',
    actorType: 'authenticated',
  });

describe('financial.map-rows — method & status', () => {
  it('infers Zelle from PENDING_ZELLE and Stripe from session id', () => {
    expect(inferPaymentMethod(MOCK_FIN_LEAD_ZELLE_PENDING)).toBe('Zelle');
    expect(inferPaymentMethod(MOCK_FIN_LEAD_STRIPE_PARTIAL)).toBe('StripeCard');
    expect(inferPaymentMethod(MOCK_FIN_LEAD_UNPAID)).toBe('Unknown');
  });

  it('maps payment signals to PaymentTransactionStatus', () => {
    expect(mapV1PaymentSignalToTransactionStatus('PENDING_ZELLE').status).toBe('Pending');
    expect(mapV1PaymentSignalToTransactionStatus('PARTIAL').status).toBe('Verified');
    expect(mapV1PaymentSignalToTransactionStatus('PAID').status).toBe('Completed');
    expect(mapV1PaymentSignalToTransactionStatus('void').status).toBe('Rejected');
    expect(mapV1PaymentSignalToTransactionStatus('refunded').status).toBe('Refunded');
  });

  it('maps lead row to receipt with virtual id', () => {
    const receipt = mapLeadRowToPaymentReceipt(MOCK_FIN_LEAD_STRIPE_PARTIAL, 'client_own');
    expect(receipt.receiptId).toBe('lead-pay:fin-lead-stripe-003');
    expect(receipt.method).toBe('StripeCard');
    expect(receipt.transactionStatus).toBe('Verified');
    expect(receipt.amountUsd).toBe(500);
    expect(receipt.visibility).toBe('client_own');
  });

  it('filters client receipts to own user id only', () => {
    const all = MOCK_FIN_ALL_LEAD_ROWS.map((row) =>
      mapLeadRowToPaymentReceipt(row, 'client_own'),
    );
    const own = filterReceiptsForClient(all, MOCK_FIN_CLIENT_USER_ID);
    expect(own.every((r) => r.clientUserId === MOCK_FIN_CLIENT_USER_ID)).toBe(true);
    expect(own.some((r) => r.leadId === MOCK_FIN_LEAD_OTHER_CLIENT.id)).toBe(false);
  });

  it('builds client balance without mixing artist wallet', () => {
    const balance = buildClientBalance(MOCK_FIN_ALL_LEAD_ROWS, MOCK_FIN_CLIENT_USER_ID);
    expect(balance.audience).toBe('client_own');
    expect(balance.walletAvailableUsd).toBeNull();
    expect(balance.totalPaidUsd).toBeGreaterThan(0);
    expect(balance.totalDueUsd).toBeGreaterThan(0);
  });

  it('builds artist wallet from ledger + pending release from leads', () => {
    const balance = buildArtistWalletBalance({
      artistUserId: MOCK_FIN_ARTIST_USER_ID,
      artistProfileId: MOCK_FIN_DJ_PROFILE_ID,
      ledgerRows: MOCK_FIN_ALL_LEDGER_ROWS,
      assignedLeadRows: MOCK_FIN_ALL_LEAD_ROWS,
    });
    expect(balance.audience).toBe('artist_wallet');
    expect(balance.totalDueUsd).toBeNull();
    // 50000 + 4500 cents
    expect(balance.walletAvailableUsd).toBe(545);
    // unpaid + zelle + partial still have agreed payouts not released
    expect(balance.walletPendingReleaseUsd).toBeGreaterThan(0);
  });

  it('maps dj_ledger to payout transaction', () => {
    const tx = mapDjLedgerRowToTransaction(MOCK_FIN_LEDGER_RELEASED);
    expect(tx.kind).toBe('dj_payout');
    expect(tx.amountUsd).toBe(500);
    expect(tx.sourceSystem).toBe('dj_ledger');
    expect(tx.leadId).toBe('fin-lead-paid-004');
  });

  it('redacts stripe session for staff_seller', () => {
    const full = mapLeadRowToPaymentReceipt(MOCK_FIN_LEAD_STRIPE_PARTIAL, 'staff_full');
    expect(full.referenceLabel).toContain('cs_test');
    const seller = redactReceiptForAudience(full, 'staff_seller');
    expect(seller.referenceLabel).toBe('StripeCard');
  });
});

describe('financial.service — session & surface', () => {
  it('exposes only read methods (no writers)', () => {
    const methods = listFinancialServiceReadMethods();
    expect(methods).toEqual([
      'fetchOwnPaymentReceipts',
      'fetchArtistWalletBalance',
      'fetchMasterFinancialLedger',
    ]);
    const service = createFinancialService({ dataPort: createPort(), sessionReader: authed() });
    expect(Object.keys(service).sort()).toEqual([...methods].sort());
    expect(JSON.stringify(service)).not.toMatch(
      /insert|update|delete|refund|charge|recordPayment|releasePayout|upsert/i,
    );
  });

  it('requires session for fetchOwnPaymentReceipts', async () => {
    const guest = createStaticSessionReader({
      portal: 'client',
      sessionId: null,
      authorizationHeader: null,
      actorType: 'guest',
    });
    const service = createFinancialService({ dataPort: createPort(), sessionReader: guest });
    const result = await service.fetchOwnPaymentReceipts({
      clientUserId: MOCK_FIN_CLIENT_USER_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details).toBe('FINANCIAL_SESSION_REQUIRED');
  });
});

describe('financial.service — fetchOwnPaymentReceipts', () => {
  it('returns only the authenticated client receipts and balance', async () => {
    const port = createPort({
      selectLeadsForClient: vi.fn(async () => ok([...MOCK_FIN_ALL_LEAD_ROWS])),
    });
    const service = createFinancialService({ dataPort: port, sessionReader: authed() });
    const result = await service.fetchOwnPaymentReceipts({
      clientUserId: MOCK_FIN_CLIENT_USER_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.receipts.every((r) => r.clientUserId === MOCK_FIN_CLIENT_USER_ID)).toBe(
      true,
    );
    expect(result.data.receipts.some((r) => r.method === 'Zelle')).toBe(true);
    expect(result.data.receipts.some((r) => r.method === 'StripeCard')).toBe(true);
    expect(result.data.balance.audience).toBe('client_own');
    expect(result.data.transactions.length).toBe(result.data.receipts.length);
  });
});

describe('financial.service — fetchArtistWalletBalance', () => {
  it('returns wallet available and ledger transactions without client due totals', async () => {
    const port = createPort({
      selectDjLedgerForArtist: vi.fn(async () => ok([...MOCK_FIN_ALL_LEDGER_ROWS])),
      selectLeadsAssignedToArtist: vi.fn(async () =>
        ok([MOCK_FIN_LEAD_UNPAID, MOCK_FIN_LEAD_PAID, MOCK_FIN_LEAD_STRIPE_PARTIAL]),
      ),
    });
    const service = createFinancialService({
      dataPort: port,
      sessionReader: createStaticSessionReader({
        portal: 'artist',
        sessionId: 'ses_a',
        authorizationHeader: 'Bearer artist',
        actorType: 'authenticated',
      }),
    });
    const result = await service.fetchArtistWalletBalance({
      artistUserId: MOCK_FIN_ARTIST_USER_ID,
      artistProfileId: MOCK_FIN_DJ_PROFILE_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.balance.walletAvailableUsd).toBe(545);
    expect(result.data.balance.totalDueUsd).toBeNull();
    expect(result.data.transactions.every((t) => t.kind === 'dj_payout')).toBe(true);
  });
});

describe('financial.service — fetchMasterFinancialLedger', () => {
  it('returns master receipts + client and ledger txs for staff_full', async () => {
    const port = createPort({
      selectLeadsForStaff: vi.fn(async () => ok([...MOCK_FIN_ALL_LEAD_ROWS])),
      selectDjLedgerForStaff: vi.fn(async () => ok([...MOCK_FIN_ALL_LEDGER_ROWS])),
    });
    const service = createFinancialService({
      dataPort: port,
      sessionReader: createStaticSessionReader({
        portal: 'staff',
        sessionId: 'ses_s',
        authorizationHeader: 'Bearer staff',
        actorType: 'staff',
      }),
    });
    const result = await service.fetchMasterFinancialLedger({ audience: 'staff_full' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.receipts.length).toBe(MOCK_FIN_ALL_LEAD_ROWS.length);
    expect(result.data.transactions.length).toBe(
      MOCK_FIN_ALL_LEAD_ROWS.length + MOCK_FIN_ALL_LEDGER_ROWS.length,
    );
    expect(result.data.balance.audience).toBe('staff_full');
    expect(result.data.balance.totalPaidUsd).toBeGreaterThan(0);
  });

  it('rejects non-staff audience', async () => {
    const service = createFinancialService({ dataPort: createPort(), sessionReader: authed() });
    const result = await service.fetchMasterFinancialLedger({
      audience: 'client_own' as 'staff_full',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details).toBe('FINANCIAL_FORBIDDEN');
  });
});

describe('financial.mocks — paid lead fixture', () => {
  it('maps PAID lead to Completed receipt', () => {
    const receipt = mapLeadRowToPaymentReceipt(MOCK_FIN_LEAD_PAID, 'client_own');
    expect(receipt.transactionStatus).toBe('Completed');
    expect(receipt.amountUsd).toBe(1800);
  });
});
