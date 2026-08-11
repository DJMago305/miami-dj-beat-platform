/** Financial domain — public barrel (Paso 2 read model + read fetch). */

export {
  asNumber,
  asRestRows,
  buildArtistWalletBalance,
  buildClientBalance,
  buildStaffMasterBalance,
  filterReceiptsForClient,
  filterTransactionsForAudience,
  inferPaymentMethod,
  mapDjLedgerRowToTransaction,
  mapLeadRowToClientTransaction,
  mapLeadRowToPaymentReceipt,
  redactReceiptForAudience,
} from './financial.map-rows';

export {
  MOCK_FIN_ALL_LEAD_ROWS,
  MOCK_FIN_ALL_LEDGER_ROWS,
  MOCK_FIN_ARTIST_BALANCE,
  MOCK_FIN_ARTIST_USER_ID,
  MOCK_FIN_CLIENT_BALANCE,
  MOCK_FIN_CLIENT_USER_ID,
  MOCK_FIN_DJ_PROFILE_ID,
  MOCK_FIN_LEAD_OTHER_CLIENT,
  MOCK_FIN_LEAD_PAID,
  MOCK_FIN_LEAD_STRIPE_PARTIAL,
  MOCK_FIN_LEAD_UNPAID,
  MOCK_FIN_LEAD_ZELLE_PENDING,
  MOCK_FIN_LEDGER_RELEASED,
  MOCK_FIN_LEDGER_TIP,
  MOCK_FIN_OTHER_CLIENT_USER_ID,
  MOCK_FIN_RECEIPT_STRIPE,
  MOCK_FIN_RECEIPT_ZELLE,
  MOCK_FIN_STAFF_BALANCE,
  MOCK_FIN_TX_CLIENT_PARTIAL,
  MOCK_FIN_TX_LEDGER,
} from './financial.mocks';

export {
  createFinancialService,
  listFinancialServiceReadMethods,
} from './financial.service';
export type {
  CreateFinancialServiceInput,
  FetchArtistWalletBalanceResult,
  FetchMasterFinancialLedgerResult,
  FetchOwnPaymentReceiptsResult,
  FinancialDataPort,
  FinancialFetchOptions,
  FinancialService,
  FinancialServiceErrorCode,
} from './financial.service';
