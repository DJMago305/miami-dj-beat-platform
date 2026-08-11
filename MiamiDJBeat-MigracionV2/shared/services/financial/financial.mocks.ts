/**
 * Financial V2 — frozen read-model mocks for Vitest (Paso 2).
 * No network · no SQL · no mutations.
 * Isolated from OFTL (`shared/services/finance/`).
 */

import type {
  FinancialBalanceReadDTO,
  PaymentReceiptReadDTO,
  TransactionHistoryDTO,
} from '../../types/financial.types';
import {
  buildArtistWalletBalance,
  buildClientBalance,
  buildStaffMasterBalance,
  mapDjLedgerRowToTransaction,
  mapLeadRowToClientTransaction,
  mapLeadRowToPaymentReceipt,
} from './financial.map-rows';

export const MOCK_FIN_CLIENT_USER_ID = '00000000-0000-4000-8000-000000000001';
export const MOCK_FIN_OTHER_CLIENT_USER_ID = '00000000-0000-4000-8000-000000000099';
export const MOCK_FIN_ARTIST_USER_ID = '00000000-0000-4000-8000-000000000003';
export const MOCK_FIN_DJ_PROFILE_ID = 'dj-profile-fin-1';

/** Client — unpaid (Pending). */
export const MOCK_FIN_LEAD_UNPAID = Object.freeze({
  id: 'fin-lead-unpaid-001',
  client_user_id: MOCK_FIN_CLIENT_USER_ID,
  assigned_dj_id: MOCK_FIN_DJ_PROFILE_ID,
  event_type: 'Wedding',
  event_date: '2026-10-01',
  total_amount: 3000,
  balance_paid: 0,
  payment_status: 'UNPAID',
  stripe_session_id: null,
  staff_invoice_id: null,
  dj_agreed_payout_usd: 800,
  dj_payout_released_at: null,
  created_at: '2026-08-01T12:00:00.000Z',
  updated_at: '2026-08-01T12:00:00.000Z',
});

/** Client — Zelle pending verification. */
export const MOCK_FIN_LEAD_ZELLE_PENDING = Object.freeze({
  ...MOCK_FIN_LEAD_UNPAID,
  id: 'fin-lead-zelle-002',
  payment_status: 'PENDING_ZELLE',
  balance_paid: 0,
  total_amount: 2500,
  dj_agreed_payout_usd: 700,
  updated_at: '2026-08-05T15:00:00.000Z',
});

/** Client — Stripe partial deposit (Verified). */
export const MOCK_FIN_LEAD_STRIPE_PARTIAL = Object.freeze({
  ...MOCK_FIN_LEAD_UNPAID,
  id: 'fin-lead-stripe-003',
  payment_status: 'PARTIAL',
  balance_paid: 500,
  total_amount: 2000,
  stripe_session_id: 'cs_test_partial_abc',
  staff_invoice_id: 'inv-fin-003',
  dj_agreed_payout_usd: 600,
  updated_at: '2026-08-06T10:00:00.000Z',
});

/** Client — paid in full (Completed). */
export const MOCK_FIN_LEAD_PAID = Object.freeze({
  ...MOCK_FIN_LEAD_UNPAID,
  id: 'fin-lead-paid-004',
  payment_status: 'PAID',
  balance_paid: 1800,
  total_amount: 1800,
  stripe_session_id: 'cs_test_paid_xyz',
  staff_invoice_id: 'inv-fin-004',
  dj_agreed_payout_usd: 500,
  dj_payout_released_at: '2026-08-08T18:00:00.000Z',
  updated_at: '2026-08-07T18:00:00.000Z',
});

/** Other client — visibility filter. */
export const MOCK_FIN_LEAD_OTHER_CLIENT = Object.freeze({
  ...MOCK_FIN_LEAD_STRIPE_PARTIAL,
  id: 'fin-lead-other-005',
  client_user_id: MOCK_FIN_OTHER_CLIENT_USER_ID,
  stripe_session_id: 'cs_test_other',
});

export const MOCK_FIN_ALL_LEAD_ROWS = Object.freeze([
  MOCK_FIN_LEAD_UNPAID,
  MOCK_FIN_LEAD_ZELLE_PENDING,
  MOCK_FIN_LEAD_STRIPE_PARTIAL,
  MOCK_FIN_LEAD_PAID,
  MOCK_FIN_LEAD_OTHER_CLIENT,
]);

/** Artist wallet — released payout. */
export const MOCK_FIN_LEDGER_RELEASED = Object.freeze({
  id: 'ledger-001',
  user_id: MOCK_FIN_ARTIST_USER_ID,
  type: 'event_sale_release',
  amount_cents: 50000,
  status: 'posted',
  currency: 'USD',
  created_at: '2026-08-08T18:05:00.000Z',
  metadata: Object.freeze({ lead_id: 'fin-lead-paid-004', label: 'Event payout' }),
});

export const MOCK_FIN_LEDGER_TIP = Object.freeze({
  id: 'ledger-002',
  user_id: MOCK_FIN_ARTIST_USER_ID,
  type: 'sft_tip_net',
  amount_cents: 4500,
  status: 'posted',
  currency: 'USD',
  created_at: '2026-08-09T01:00:00.000Z',
  metadata: Object.freeze({ label: 'SoundForTips net' }),
});

export const MOCK_FIN_ALL_LEDGER_ROWS = Object.freeze([
  MOCK_FIN_LEDGER_RELEASED,
  MOCK_FIN_LEDGER_TIP,
]);

export const MOCK_FIN_RECEIPT_STRIPE: PaymentReceiptReadDTO = mapLeadRowToPaymentReceipt(
  MOCK_FIN_LEAD_STRIPE_PARTIAL,
  'client_own',
);

export const MOCK_FIN_RECEIPT_ZELLE: PaymentReceiptReadDTO = mapLeadRowToPaymentReceipt(
  MOCK_FIN_LEAD_ZELLE_PENDING,
  'client_own',
);

export const MOCK_FIN_TX_CLIENT_PARTIAL: TransactionHistoryDTO = mapLeadRowToClientTransaction(
  MOCK_FIN_LEAD_STRIPE_PARTIAL,
  'client_own',
);

export const MOCK_FIN_TX_LEDGER: TransactionHistoryDTO = mapDjLedgerRowToTransaction(
  MOCK_FIN_LEDGER_RELEASED,
  'artist_wallet',
);

export const MOCK_FIN_CLIENT_BALANCE: FinancialBalanceReadDTO = buildClientBalance(
  MOCK_FIN_ALL_LEAD_ROWS,
  MOCK_FIN_CLIENT_USER_ID,
  '2026-08-11T00:00:00.000Z',
);

export const MOCK_FIN_ARTIST_BALANCE: FinancialBalanceReadDTO = buildArtistWalletBalance({
  artistUserId: MOCK_FIN_ARTIST_USER_ID,
  artistProfileId: MOCK_FIN_DJ_PROFILE_ID,
  ledgerRows: MOCK_FIN_ALL_LEDGER_ROWS,
  assignedLeadRows: MOCK_FIN_ALL_LEAD_ROWS,
  asOf: '2026-08-11T00:00:00.000Z',
});

export const MOCK_FIN_STAFF_BALANCE: FinancialBalanceReadDTO = buildStaffMasterBalance(
  MOCK_FIN_ALL_LEAD_ROWS,
  'staff_full',
  '2026-08-11T00:00:00.000Z',
);
