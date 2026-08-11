/**
 * MOD-301 Financial Slice — Staff Master Financial Ledger ViewModel (pure).
 * READ-ONLY projection from fetchMasterFinancialLedger. No writers.
 */

import type {
  FinancialBalanceReadDTO,
  FinancialVisibilityAudience,
  PaymentMethodRead,
  PaymentReceiptReadDTO,
  PaymentTransactionStatus,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';
import { redactReceiptForAudience } from '../../shared/services/financial/index';

export const STAFF_FINANCE_STATUS_FILTERS = Object.freeze([
  'All',
  'Pending',
  'Verified',
  'Rejected',
  'Refunded',
  'Completed',
] as const);

export type StaffFinanceStatusFilter = (typeof STAFF_FINANCE_STATUS_FILTERS)[number];

export const STAFF_FINANCE_METHOD_FILTERS = Object.freeze([
  'All',
  'Zelle',
  'Cash',
  'BankTransfer',
  'StripeCard',
  'Check',
  'Unknown',
  'Other',
] as const);

export type StaffFinanceMethodFilter = (typeof STAFF_FINANCE_METHOD_FILTERS)[number];

export type StaffFinanceRowVM = {
  readonly transactionId: string;
  readonly receiptId: string | null;
  readonly leadId: string | null;
  readonly label: string;
  readonly clientLabel: string;
  readonly artistLabel: string;
  readonly amountLabel: string;
  readonly method: PaymentMethodRead;
  readonly transactionStatus: PaymentTransactionStatus;
  readonly kind: string;
  readonly referenceLabel: string | null;
  readonly occurredAt: string;
  readonly piiIsolated: boolean;
};

export type StaffFinanceSummaryVM = {
  readonly receiptCount: number;
  readonly transactionCount: number;
  readonly totalPaidUsd: number;
  readonly totalDueUsd: number;
  readonly byStatus: Readonly<Record<PaymentTransactionStatus, number>>;
  readonly byMethod: Readonly<Partial<Record<PaymentMethodRead, number>>>;
};

export type StaffFinanceReadViewModel = {
  readonly audience: Extract<FinancialVisibilityAudience, 'staff_seller' | 'staff_full'>;
  readonly statusFilter: StaffFinanceStatusFilter;
  readonly methodFilter: StaffFinanceMethodFilter;
  readonly summary: StaffFinanceSummaryVM;
  readonly rows: readonly StaffFinanceRowVM[];
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

function emptyStatusCounts(): Record<PaymentTransactionStatus, number> {
  return {
    Pending: 0,
    Verified: 0,
    Rejected: 0,
    Refunded: 0,
    Completed: 0,
  };
}

export function filterTransactions(
  rows: readonly TransactionHistoryDTO[],
  statusFilter: StaffFinanceStatusFilter,
  methodFilter: StaffFinanceMethodFilter,
): readonly TransactionHistoryDTO[] {
  return Object.freeze(
    rows.filter((t) => {
      if (statusFilter !== 'All' && t.transactionStatus !== statusFilter) return false;
      if (methodFilter !== 'All' && t.method !== methodFilter) return false;
      return true;
    }),
  );
}

function receiptByLead(
  receipts: readonly PaymentReceiptReadDTO[],
  leadId: string | null,
): PaymentReceiptReadDTO | null {
  if (!leadId) return null;
  return receipts.find((r) => r.leadId === leadId) ?? null;
}

export function toStaffFinanceRow(
  tx: TransactionHistoryDTO,
  receipt: PaymentReceiptReadDTO | null,
  audience: Extract<FinancialVisibilityAudience, 'staff_seller' | 'staff_full'>,
): StaffFinanceRowVM {
  const redacted = receipt ? redactReceiptForAudience(receipt, audience) : null;
  const piiIsolated = audience === 'staff_seller';

  const clientLabel = redacted?.clientUserId
    ? piiIsolated
      ? `Client · ${redacted.clientUserId.slice(0, 8)}…`
      : `Client · ${redacted.clientUserId}`
    : tx.counterpartyRole === 'client'
      ? 'Client payment'
      : '—';

  const artistLabel =
    redacted?.assignedArtistProfileId != null
      ? `Artist · ${redacted.assignedArtistProfileId}`
      : tx.kind === 'dj_payout'
        ? 'Artist wallet'
        : '—';

  return Object.freeze({
    transactionId: tx.transactionId,
    receiptId: redacted?.receiptId ?? null,
    leadId: tx.leadId,
    label: display(tx.label, tx.kind),
    clientLabel,
    artistLabel,
    amountLabel: money(tx.amountUsd),
    method: tx.method,
    transactionStatus: tx.transactionStatus,
    kind: tx.kind,
    referenceLabel: piiIsolated
      ? redacted?.referenceLabel ?? (tx.method === 'Unknown' ? null : tx.method)
      : redacted?.referenceLabel ?? tx.idempotencyKey,
    occurredAt: display(tx.occurredAt),
    piiIsolated,
  });
}

/**
 * Pure mapper — master ledger payload → display model.
 */
export function toStaffFinanceReadViewModel(input: {
  readonly receipts: readonly PaymentReceiptReadDTO[];
  readonly transactions: readonly TransactionHistoryDTO[];
  readonly balance?: FinancialBalanceReadDTO | null;
  readonly audience?: Extract<FinancialVisibilityAudience, 'staff_seller' | 'staff_full'>;
  readonly statusFilter?: StaffFinanceStatusFilter;
  readonly methodFilter?: StaffFinanceMethodFilter;
}): StaffFinanceReadViewModel {
  const audience = input.audience ?? 'staff_full';
  const statusFilter = input.statusFilter ?? 'All';
  const methodFilter = input.methodFilter ?? 'All';

  const receipts =
    audience === 'staff_seller'
      ? input.receipts.map((r) => redactReceiptForAudience(r, 'staff_seller'))
      : input.receipts;

  const byStatus = emptyStatusCounts();
  const byMethod: Partial<Record<PaymentMethodRead, number>> = {};

  for (const t of input.transactions) {
    byStatus[t.transactionStatus] += 1;
    byMethod[t.method] = (byMethod[t.method] ?? 0) + 1;
  }

  const filtered = filterTransactions(input.transactions, statusFilter, methodFilter);
  const rows = filtered.map((t) =>
    toStaffFinanceRow(t, receiptByLead(receipts, t.leadId), audience),
  );

  const balance = input.balance ?? null;

  return Object.freeze({
    audience,
    statusFilter,
    methodFilter,
    summary: Object.freeze({
      receiptCount: receipts.length,
      transactionCount: input.transactions.length,
      totalPaidUsd: balance?.totalPaidUsd ?? 0,
      totalDueUsd: balance?.totalDueUsd ?? 0,
      byStatus: Object.freeze(byStatus),
      byMethod: Object.freeze(byMethod),
    }),
    rows: Object.freeze(rows),
    balance,
  });
}
