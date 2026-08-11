/**
 * MOD-204 Financial Slice — Artist Wallet & Earnings ViewModel (pure).
 * READ-ONLY projection from fetchArtistWalletBalance. No payout-request writers.
 *
 * Filters (product Paso 4): All · Pending · Completed · Released
 * — Pending = agreed payout not yet released
 * — Released = event_sale_release ledger lines
 * — Completed = other posted wallet lines (e.g. tips)
 */

import type {
  FinancialBalanceReadDTO,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';

export const ARTIST_WALLET_RELEASE_FILTERS = Object.freeze([
  'All',
  'Pending',
  'Completed',
  'Released',
] as const);

export type ArtistWalletReleaseFilter = (typeof ARTIST_WALLET_RELEASE_FILTERS)[number];

export type ArtistWalletReleaseStatus = 'Pending' | 'Completed' | 'Released';

/** Pending honorarium inferred from assigned lead (not yet in dj_ledger). */
export type ArtistPendingReleaseDTO = {
  readonly pendingId: string;
  readonly leadId: string;
  readonly eventLabel: string;
  readonly eventDate: string | null;
  readonly amountUsd: number;
  readonly staffNote: string | null;
};

export type ArtistWalletCardVM = {
  readonly rowId: string;
  readonly releaseStatus: ArtistWalletReleaseStatus;
  readonly eventLabel: string;
  readonly eventDate: string;
  readonly amountLabel: string;
  readonly staffNote: string;
  readonly kindLabel: string;
  readonly occurredAt: string;
};

export type ArtistWalletSummaryVM = {
  readonly availableUsd: number;
  readonly pendingReleaseUsd: number;
  readonly processedCount: number;
  readonly pendingCount: number;
  readonly releasedCount: number;
};

export type ArtistWalletReadViewModel = {
  readonly filter: ArtistWalletReleaseFilter;
  readonly summary: ArtistWalletSummaryVM;
  readonly cards: readonly ArtistWalletCardVM[];
  readonly balance: FinancialBalanceReadDTO | null;
};

function display(value: string | null | undefined, fallback = '—'): string {
  const t = typeof value === 'string' ? value.trim() : '';
  return t.length > 0 ? t : fallback;
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

function isReleaseLedger(tx: TransactionHistoryDTO): boolean {
  const label = `${tx.label ?? ''} ${tx.kind}`.toLowerCase();
  return label.includes('event_sale_release') || label.includes('event payout');
}

export function toArtistWalletCardFromPending(p: ArtistPendingReleaseDTO): ArtistWalletCardVM {
  return Object.freeze({
    rowId: p.pendingId,
    releaseStatus: 'Pending',
    eventLabel: display(p.eventLabel, 'Assigned gig'),
    eventDate: display(p.eventDate),
    amountLabel: money(p.amountUsd),
    staffNote: display(p.staffNote, 'Awaiting staff payout release'),
    kindLabel: 'Pending honorarium',
    occurredAt: display(p.eventDate),
  });
}

export function toArtistWalletCardFromTransaction(tx: TransactionHistoryDTO): ArtistWalletCardVM {
  const released = isReleaseLedger(tx);
  return Object.freeze({
    rowId: tx.transactionId,
    releaseStatus: released ? 'Released' : 'Completed',
    eventLabel: display(tx.label, tx.kind),
    eventDate: display(tx.occurredAt),
    amountLabel: money(tx.amountUsd),
    staffNote: released
      ? 'Funds released to wallet (staff payout)'
      : display(tx.label, 'Posted wallet movement'),
    kindLabel: tx.kind,
    occurredAt: display(tx.occurredAt),
  });
}

export function filterArtistWalletCards(
  cards: readonly ArtistWalletCardVM[],
  filter: ArtistWalletReleaseFilter,
): readonly ArtistWalletCardVM[] {
  if (filter === 'All') return cards;
  return Object.freeze(cards.filter((c) => c.releaseStatus === filter));
}

/**
 * Pure mapper — artist wallet payload → display model.
 */
export function toArtistWalletReadViewModel(input: {
  readonly balance?: FinancialBalanceReadDTO | null;
  readonly transactions: readonly TransactionHistoryDTO[];
  readonly pendingReleases?: readonly ArtistPendingReleaseDTO[];
  readonly filter?: ArtistWalletReleaseFilter;
}): ArtistWalletReadViewModel {
  const filter = input.filter ?? 'All';
  const pending = input.pendingReleases ?? [];
  const balance = input.balance ?? null;

  const pendingCards = pending.map(toArtistWalletCardFromPending);
  const txCards = input.transactions.map(toArtistWalletCardFromTransaction);
  const allCards = Object.freeze([...pendingCards, ...txCards]);
  const cards = filterArtistWalletCards(allCards, filter);

  let releasedCount = 0;
  let completedCount = 0;
  for (const c of allCards) {
    if (c.releaseStatus === 'Released') releasedCount += 1;
    if (c.releaseStatus === 'Completed') completedCount += 1;
  }

  return Object.freeze({
    filter,
    summary: Object.freeze({
      availableUsd: balance?.walletAvailableUsd ?? 0,
      pendingReleaseUsd: balance?.walletPendingReleaseUsd ?? 0,
      processedCount: releasedCount + completedCount,
      pendingCount: pendingCards.length,
      releasedCount,
    }),
    cards,
    balance,
  });
}
