/**
 * MOD-204 Financial Slice — Artist Wallet lab fixtures.
 * Built from financial.mocks — no network / SQL.
 */

import {
  MOCK_FIN_ALL_LEDGER_ROWS,
  MOCK_FIN_ARTIST_USER_ID,
  MOCK_FIN_DJ_PROFILE_ID,
  MOCK_FIN_LEAD_PAID,
  MOCK_FIN_LEAD_STRIPE_PARTIAL,
  MOCK_FIN_LEAD_UNPAID,
  MOCK_FIN_LEAD_ZELLE_PENDING,
  buildArtistWalletBalance,
  mapDjLedgerRowToTransaction,
} from '../../shared/services/financial/index';
import type {
  FinancialBalanceReadDTO,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';
import type { ArtistPendingReleaseDTO } from './artist-finance-read-view-model';

function asPending(row: {
  readonly id: string;
  readonly event_type?: string;
  readonly event_date?: string | null;
  readonly dj_agreed_payout_usd?: number | null;
  readonly dj_payout_released_at?: string | null;
}): ArtistPendingReleaseDTO | null {
  if (row.dj_payout_released_at) return null;
  const amount = row.dj_agreed_payout_usd ?? 0;
  if (!(amount > 0)) return null;
  return Object.freeze({
    pendingId: `pending:${row.id}`,
    leadId: row.id,
    eventLabel: row.event_type ?? 'Gig',
    eventDate: row.event_date ?? null,
    amountUsd: amount,
    staffNote: 'Payout agreed — pending staff release',
  });
}

const assignedLeads = [
  MOCK_FIN_LEAD_UNPAID,
  MOCK_FIN_LEAD_ZELLE_PENDING,
  MOCK_FIN_LEAD_STRIPE_PARTIAL,
  MOCK_FIN_LEAD_PAID,
];

export const LAB_ARTIST_WALLET: {
  readonly artistUserId: string;
  readonly artistProfileId: string;
  readonly balance: FinancialBalanceReadDTO;
  readonly transactions: readonly TransactionHistoryDTO[];
  readonly pendingReleases: readonly ArtistPendingReleaseDTO[];
} = Object.freeze({
  artistUserId: MOCK_FIN_ARTIST_USER_ID,
  artistProfileId: MOCK_FIN_DJ_PROFILE_ID,
  balance: buildArtistWalletBalance({
    artistUserId: MOCK_FIN_ARTIST_USER_ID,
    artistProfileId: MOCK_FIN_DJ_PROFILE_ID,
    ledgerRows: MOCK_FIN_ALL_LEDGER_ROWS,
    assignedLeadRows: assignedLeads,
    asOf: '2026-08-11T00:00:00.000Z',
  }),
  transactions: Object.freeze(
    MOCK_FIN_ALL_LEDGER_ROWS.map((row) => mapDjLedgerRowToTransaction(row, 'artist_wallet')),
  ),
  pendingReleases: Object.freeze(
    assignedLeads.map(asPending).filter((p): p is ArtistPendingReleaseDTO => p != null),
  ),
});
