/**
 * MOD-301 Financial Slice — Staff Master Financial Ledger fixtures (lab).
 * Built from financial.mocks via pure mappers — no network / SQL.
 */

import {
  MOCK_FIN_ALL_LEAD_ROWS,
  MOCK_FIN_ALL_LEDGER_ROWS,
  buildStaffMasterBalance,
  mapDjLedgerRowToTransaction,
  mapLeadRowToClientTransaction,
  mapLeadRowToPaymentReceipt,
} from '../../shared/services/financial/index';
import type {
  FinancialBalanceReadDTO,
  PaymentReceiptReadDTO,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';

const audience = 'staff_full' as const;

export const LAB_STAFF_MASTER_FINANCE: {
  readonly receipts: readonly PaymentReceiptReadDTO[];
  readonly transactions: readonly TransactionHistoryDTO[];
  readonly balance: FinancialBalanceReadDTO;
  readonly audience: 'staff_full';
} = Object.freeze({
  audience,
  receipts: Object.freeze(
    MOCK_FIN_ALL_LEAD_ROWS.map((row) => mapLeadRowToPaymentReceipt(row, audience)),
  ),
  transactions: Object.freeze([
    ...MOCK_FIN_ALL_LEAD_ROWS.map((row) => mapLeadRowToClientTransaction(row, audience)),
    ...MOCK_FIN_ALL_LEDGER_ROWS.map((row) => mapDjLedgerRowToTransaction(row, audience)),
  ]),
  balance: buildStaffMasterBalance(MOCK_FIN_ALL_LEAD_ROWS, audience, '2026-08-11T00:00:00.000Z'),
});
