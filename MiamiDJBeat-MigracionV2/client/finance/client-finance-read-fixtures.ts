/**
 * MOD-103 Financial Slice — Client receipts lab fixtures.
 * Built from financial.mocks — no network / SQL.
 */

import {
  MOCK_FIN_ALL_LEAD_ROWS,
  MOCK_FIN_CLIENT_USER_ID,
  buildClientBalance,
  filterReceiptsForClient,
  mapLeadRowToClientTransaction,
  mapLeadRowToPaymentReceipt,
} from '../../shared/services/financial/index';
import type {
  FinancialBalanceReadDTO,
  PaymentReceiptReadDTO,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';

const ownRows = MOCK_FIN_ALL_LEAD_ROWS.filter(
  (row) => row.client_user_id === MOCK_FIN_CLIENT_USER_ID,
);

export const LAB_CLIENT_RECEIPTS: {
  readonly clientUserId: string;
  readonly receipts: readonly PaymentReceiptReadDTO[];
  readonly transactions: readonly TransactionHistoryDTO[];
  readonly balance: FinancialBalanceReadDTO;
} = Object.freeze({
  clientUserId: MOCK_FIN_CLIENT_USER_ID,
  receipts: filterReceiptsForClient(
    ownRows.map((row) => mapLeadRowToPaymentReceipt(row, 'client_own')),
    MOCK_FIN_CLIENT_USER_ID,
  ),
  transactions: Object.freeze(
    ownRows.map((row) => mapLeadRowToClientTransaction(row, 'client_own')),
  ),
  balance: buildClientBalance(MOCK_FIN_ALL_LEAD_ROWS, MOCK_FIN_CLIENT_USER_ID, '2026-08-11T00:00:00.000Z'),
});
