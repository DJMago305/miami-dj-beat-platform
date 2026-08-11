/**
 * Financial / Payments V2 — Read Model types (Paso 1).
 * Canonical matrix: docs/V2/FINANCIAL-V1-V2-MAPPING-MATRIX.md
 *
 * READ-ONLY: no writers, no SQL, no RLS changes.
 * Lab only: http://localhost:5173
 *
 * Orthogonal to:
 * - BookingPaymentStatus (Agenda) — summary on bookings only
 * - OFTL contracts (shared/services/finance/) — north-star owner ledger; do not merge
 */

/** V2 canonical transaction / receipt lifecycle (portal read model). */
export type PaymentTransactionStatus =
  | 'Pending'
  | 'Verified'
  | 'Rejected'
  | 'Refunded'
  | 'Completed';

/**
 * Payment instrument as shown in receipts / history.
 * V1 often lacks `leads.payment_method` — mappers may emit `Unknown`.
 */
export type PaymentMethodRead =
  | 'Zelle'
  | 'Cash'
  | 'BankTransfer'
  | 'StripeCard'
  | 'Check'
  | 'Unknown'
  | 'Other';

/** Conceptual movement kind (CFMovement-aligned, read projection). */
export type FinancialTransactionKind =
  | 'client_deposit'
  | 'client_payment'
  | 'dj_payout'
  | 'refund'
  | 'adjustment'
  | 'invoice_issued'
  | 'tip'
  | 'other';

export type FinancialDirectionRead = 'inflow' | 'outflow' | 'internal';

export type FinancialCounterpartyRole =
  | 'client'
  | 'artist'
  | 'company'
  | 'platform'
  | 'seller'
  | 'unknown';

/** Who may see a financial row in lab projections (aligns to portal + RLS intent). */
export type FinancialVisibilityAudience =
  | 'client_own'
  | 'artist_wallet'
  | 'artist_assigned_limited'
  | 'staff_seller'
  | 'staff_full'
  | 'public_none';

export type FinancialSourceSystem =
  | 'stripe_webhook'
  | 'zelle_rpc'
  | 'dj_ledger'
  | 'invoice'
  | 'event_builder'
  | 'inferred'
  | 'lab_mock';

/**
 * PaymentReceiptReadDTO — comprobante / recibo (MOD-105 / MOD-306).
 * Virtual identity: no V1 `payment_receipts` table.
 */
export type PaymentReceiptReadDTO = {
  readonly receiptId: string;
  readonly leadId: string | null;
  readonly bookingId: string | null;
  readonly invoiceId: string | null;
  readonly clientUserId: string | null;
  readonly assignedArtistProfileId: string | null;
  readonly amountUsd: number | null;
  readonly currency: string;
  readonly method: PaymentMethodRead;
  readonly transactionStatus: PaymentTransactionStatus;
  /** True when V1 signal did not map cleanly (matrix §4.2). */
  readonly statusUnmapped: boolean;
  readonly issuedAt: string | null;
  readonly referenceLabel: string | null;
  readonly bookingTitle: string | null;
  readonly eventDate: string | null;
  readonly visibility: FinancialVisibilityAudience;
};

/**
 * TransactionHistoryDTO — timeline line (MOD-106 / MOD-209 / MOD-309).
 * Projection of CFMovement-style facts; not an OFTL writer entity.
 */
export type TransactionHistoryDTO = {
  readonly transactionId: string;
  readonly occurredAt: string | null;
  readonly kind: FinancialTransactionKind;
  readonly direction: FinancialDirectionRead;
  readonly amountUsd: number | null;
  readonly currency: string;
  readonly method: PaymentMethodRead;
  readonly transactionStatus: PaymentTransactionStatus;
  readonly statusUnmapped: boolean;
  readonly counterpartyRole: FinancialCounterpartyRole;
  readonly leadId: string | null;
  readonly invoiceId: string | null;
  readonly djLedgerId: string | null;
  readonly sourceSystem: FinancialSourceSystem;
  readonly idempotencyKey: string | null;
  readonly label: string | null;
  readonly visibility: FinancialVisibilityAudience;
};

/**
 * FinancialBalanceReadDTO — aggregated balance card (MOD-209 / staff master).
 * Never conflate client `balance_paid` with artist wallet without release.
 */
export type FinancialBalanceReadDTO = {
  readonly balanceId: string;
  readonly audience: FinancialVisibilityAudience;
  readonly currency: string;
  readonly asOf: string | null;
  /** Client / company: amount still owed on open events. */
  readonly totalDueUsd: number | null;
  /** Client / company: cumulative paid on scoped events. */
  readonly totalPaidUsd: number | null;
  /** Artist wallet: released / available (from dj_ledger projection). */
  readonly walletAvailableUsd: number | null;
  /** Artist: agreed payout not yet released. */
  readonly walletPendingReleaseUsd: number | null;
  readonly openReceiptCount: number | null;
  readonly completedReceiptCount: number | null;
};

/**
 * Normalize common V1 payment / invoice / ledger signals → PaymentTransactionStatus.
 * Discovery helper for future mappers (Paso 2+). Read-only.
 */
export function mapV1PaymentSignalToTransactionStatus(
  raw: string | null | undefined,
): { readonly status: PaymentTransactionStatus; readonly unmapped: boolean } {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (!s) return Object.freeze({ status: 'Pending' as const, unmapped: true });

  if (
    s === 'pending_zelle' ||
    s === 'pending' ||
    s === 'unpaid' ||
    s === 'draft' ||
    s === 'sent'
  ) {
    return Object.freeze({ status: 'Pending' as const, unmapped: false });
  }

  if (s === 'partial' || s === 'deposit_paid' || s === 'verified') {
    return Object.freeze({ status: 'Verified' as const, unmapped: false });
  }

  if (s === 'paid' || s === 'paid_full' || s === 'completed' || s === 'posted' || s === 'released') {
    return Object.freeze({ status: 'Completed' as const, unmapped: false });
  }

  if (s === 'void' || s === 'rejected' || s === 'failed' || s === 'cancelled' || s === 'canceled') {
    return Object.freeze({ status: 'Rejected' as const, unmapped: false });
  }

  if (s === 'refunded' || s === 'refund' || s === 'reversed') {
    return Object.freeze({ status: 'Refunded' as const, unmapped: false });
  }

  return Object.freeze({ status: 'Pending' as const, unmapped: true });
}
