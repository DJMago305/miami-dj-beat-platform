/**
 * MOD-103 Financial Slice — Client Payment Receipts ViewModel (pure).
 * READ-ONLY projection from fetchOwnPaymentReceipts. No pay / upload / refund writers.
 */

import type {
  FinancialBalanceReadDTO,
  PaymentMethodRead,
  PaymentReceiptReadDTO,
  PaymentTransactionStatus,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';

export const CLIENT_RECEIPT_STATUS_FILTERS = Object.freeze([
  'All',
  'Pending',
  'Verified',
  'Refunded',
  'Completed',
] as const);

export type ClientReceiptStatusFilter = (typeof CLIENT_RECEIPT_STATUS_FILTERS)[number];

export type ClientReceiptCardVM = {
  readonly receiptId: string;
  readonly bookingLabel: string;
  readonly eventDate: string;
  readonly amountPaidLabel: string;
  readonly amountDueLabel: string;
  readonly method: PaymentMethodRead;
  readonly transactionStatus: PaymentTransactionStatus;
  readonly paidAt: string;
  readonly referenceLabel: string;
  readonly previewLabel: string;
  readonly breakdownLabel: string;
};

export type ClientReceiptsSummaryVM = {
  readonly receiptCount: number;
  readonly totalPaidUsd: number;
  readonly totalDueUsd: number;
  readonly byStatus: Readonly<Partial<Record<PaymentTransactionStatus, number>>>;
};

export type ClientFinanceReadViewModel = {
  readonly filter: ClientReceiptStatusFilter;
  readonly summary: ClientReceiptsSummaryVM;
  readonly cards: readonly ClientReceiptCardVM[];
  readonly balance: FinancialBalanceReadDTO | null;
};

function display(value: string | null | undefined, fallback = '—'): string {
  const t = typeof value === 'string' ? value.trim() : '';
  return t.length > 0 ? t : fallback;
}

/**
 * MOD-211 — `receipt.issuedAt` is a full ISO timestamp
 * ("2026-08-01T12:00:00.000Z"); "Paid at" was showing that raw string
 * instead of a readable date (visual audit finding, 2026-08-12).
 */
function formatDate(value: string | null | undefined, fallback = '—'): string {
  const t = typeof value === 'string' ? value.trim() : '';
  if (!t) return fallback;
  const parsed = new Date(t);
  if (Number.isNaN(parsed.getTime())) return t;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

/** Mask sensitive payment refs for display (client still sees own truncated ref). */
export function maskPaymentReference(raw: string | null | undefined): string {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (!t) return '—';
  if (t.length <= 10) return t;
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

export function filterReceiptsByStatus(
  receipts: readonly PaymentReceiptReadDTO[],
  filter: ClientReceiptStatusFilter,
): readonly PaymentReceiptReadDTO[] {
  if (filter === 'All') return receipts;
  return Object.freeze(receipts.filter((r) => r.transactionStatus === filter));
}

function dueForReceipt(
  receipt: PaymentReceiptReadDTO,
  balance: FinancialBalanceReadDTO | null,
  all: readonly PaymentReceiptReadDTO[],
): number | null {
  // Lab: approximate outstanding share — if Completed, due 0; else use remaining from totals when single open.
  if (receipt.transactionStatus === 'Completed') return 0;
  if (receipt.transactionStatus === 'Refunded') return null;
  const open = all.filter(
    (r) => r.transactionStatus === 'Pending' || r.transactionStatus === 'Verified',
  );
  if (open.length === 1 && balance?.totalDueUsd != null) return balance.totalDueUsd;
  return null;
}

export function toClientReceiptCard(
  receipt: PaymentReceiptReadDTO,
  tx: TransactionHistoryDTO | null,
  balance: FinancialBalanceReadDTO | null,
  all: readonly PaymentReceiptReadDTO[],
): ClientReceiptCardVM {
  const due = dueForReceipt(receipt, balance, all);
  const kind = tx?.kind ?? 'client_payment';
  const breakdown =
    kind === 'client_deposit'
      ? 'Deposit / partial payment'
      : kind === 'client_payment'
        ? 'Event balance payment'
        : kind;

  return Object.freeze({
    receiptId: receipt.receiptId,
    bookingLabel: display(receipt.bookingTitle, display(receipt.bookingId, 'Booking')),
    eventDate: display(receipt.eventDate),
    amountPaidLabel: money(receipt.amountUsd),
    amountDueLabel: due == null ? '—' : money(due),
    method: receipt.method,
    transactionStatus: receipt.transactionStatus,
    paidAt: formatDate(receipt.issuedAt),
    referenceLabel: maskPaymentReference(receipt.referenceLabel),
    previewLabel: 'Receipt preview (read-only) — PDF download not enabled in this slice',
    breakdownLabel: breakdown,
  });
}

/**
 * Pure mapper — own receipts payload → display model.
 */
export function toClientFinanceReadViewModel(input: {
  readonly receipts: readonly PaymentReceiptReadDTO[];
  readonly transactions?: readonly TransactionHistoryDTO[];
  readonly balance?: FinancialBalanceReadDTO | null;
  readonly filter?: ClientReceiptStatusFilter;
}): ClientFinanceReadViewModel {
  const filter = input.filter ?? 'All';
  const balance = input.balance ?? null;
  const txs = input.transactions ?? [];
  const txByLead = new Map<string, TransactionHistoryDTO>();
  for (const t of txs) {
    if (t.leadId) txByLead.set(t.leadId, t);
  }

  const byStatus: Partial<Record<PaymentTransactionStatus, number>> = {};
  for (const r of input.receipts) {
    byStatus[r.transactionStatus] = (byStatus[r.transactionStatus] ?? 0) + 1;
  }

  const filtered = filterReceiptsByStatus(input.receipts, filter);
  const cards = filtered.map((r) =>
    toClientReceiptCard(r, r.leadId ? txByLead.get(r.leadId) ?? null : null, balance, input.receipts),
  );

  return Object.freeze({
    filter,
    summary: Object.freeze({
      receiptCount: input.receipts.length,
      totalPaidUsd: balance?.totalPaidUsd ?? 0,
      totalDueUsd: balance?.totalDueUsd ?? 0,
      byStatus: Object.freeze(byStatus),
    }),
    cards: Object.freeze(cards),
    balance,
  });
}
