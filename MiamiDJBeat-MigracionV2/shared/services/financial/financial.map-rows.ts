/**
 * Financial — map V1 lead / ledger rows → Read DTOs (Paso 2, read-only).
 * Canonical matrix: docs/V2/FINANCIAL-V1-V2-MAPPING-MATRIX.md
 *
 * Never conflate client balance_paid with artist wallet without release.
 */

import {
  mapV1PaymentSignalToTransactionStatus,
  type FinancialBalanceReadDTO,
  type FinancialSourceSystem,
  type FinancialTransactionKind,
  type FinancialVisibilityAudience,
  type PaymentMethodRead,
  type PaymentReceiptReadDTO,
  type TransactionHistoryDTO,
} from '../../types/financial.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRestRows(data: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }
  return isRecord(data) ? [data] : [];
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

export function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Infer payment method — V1 leads often lack payment_method column (matrix G2).
 */
export function inferPaymentMethod(row: Record<string, unknown>): PaymentMethodRead {
  const explicit = asString(row.payment_method) ?? asString(row.payment_channel);
  if (explicit) {
    const key = explicit.trim().toLowerCase().replace(/\s+/g, '_');
    if (key.includes('zelle')) return 'Zelle';
    if (key === 'cash' || key === 'efectivo') return 'Cash';
    if (key.includes('wire') || key.includes('ach') || key.includes('bank') || key.includes('transfer')) {
      return 'BankTransfer';
    }
    if (key.includes('stripe') || key.includes('card') || key === 'credit_card') return 'StripeCard';
    if (key.includes('check') || key.includes('cheque')) return 'Check';
    return 'Other';
  }

  const paymentStatus = (asString(row.payment_status) ?? '').toLowerCase();
  if (paymentStatus.includes('zelle')) return 'Zelle';

  if (asString(row.stripe_session_id) || asString(row.stripe_payment_intent_id) || asString(row.stripe_pi_id)) {
    return 'StripeCard';
  }

  return 'Unknown';
}

function clientPaymentKind(row: Record<string, unknown>): FinancialTransactionKind {
  const total = asNumber(row.total_amount) ?? 0;
  const paid = asNumber(row.balance_paid) ?? 0;
  const status = (asString(row.payment_status) ?? '').toLowerCase();
  if (status.includes('partial') || status.includes('deposit') || (paid > 0 && paid < total)) {
    return 'client_deposit';
  }
  if (paid > 0 || status === 'paid' || status === 'paid_full') return 'client_payment';
  return 'client_deposit';
}

function sourceFromMethod(method: PaymentMethodRead): FinancialSourceSystem {
  if (method === 'Zelle') return 'zelle_rpc';
  if (method === 'StripeCard') return 'stripe_webhook';
  return 'inferred';
}

/**
 * Pure mapper — lead money fields → PaymentReceiptReadDTO (virtual receipt id).
 */
export function mapLeadRowToPaymentReceipt(
  row: Record<string, unknown>,
  visibility: FinancialVisibilityAudience,
): PaymentReceiptReadDTO {
  const leadId = asString(row.id);
  const paid = asNumber(row.balance_paid);
  const method = inferPaymentMethod(row);
  const signal = mapV1PaymentSignalToTransactionStatus(asString(row.payment_status));
  const title =
    asString(row.event_type) ?? asString(row.event_name) ?? asString(row.title) ?? null;

  const reference =
    visibility === 'staff_full' || visibility === 'client_own'
      ? asString(row.stripe_session_id) ??
        (method === 'Zelle' ? 'Zelle deposit' : method === 'Unknown' ? null : method)
      : method === 'Unknown'
        ? null
        : method;

  return Object.freeze({
    receiptId: leadId ? `lead-pay:${leadId}` : `lead-pay:unknown`,
    leadId,
    bookingId: leadId,
    invoiceId: asString(row.staff_invoice_id),
    clientUserId: asString(row.client_user_id),
    assignedArtistProfileId: asString(row.assigned_dj_id),
    amountUsd: paid,
    currency: 'USD',
    method,
    transactionStatus: signal.status,
    statusUnmapped: signal.unmapped,
    issuedAt: asString(row.updated_at) ?? asString(row.created_at),
    referenceLabel: reference,
    bookingTitle: title,
    eventDate: asString(row.event_date),
    visibility,
  });
}

/**
 * Pure mapper — lead cobro → TransactionHistoryDTO (client payment / deposit).
 */
export function mapLeadRowToClientTransaction(
  row: Record<string, unknown>,
  visibility: FinancialVisibilityAudience,
): TransactionHistoryDTO {
  const leadId = asString(row.id);
  const method = inferPaymentMethod(row);
  const signal = mapV1PaymentSignalToTransactionStatus(asString(row.payment_status));
  const paid = asNumber(row.balance_paid);
  const kind = clientPaymentKind(row);
  const title =
    asString(row.event_type) ?? asString(row.event_name) ?? asString(row.title) ?? 'Client payment';

  return Object.freeze({
    transactionId: leadId ? `tx:lead:${leadId}` : 'tx:lead:unknown',
    occurredAt: asString(row.updated_at) ?? asString(row.created_at),
    kind,
    direction: 'inflow',
    amountUsd: paid,
    currency: 'USD',
    method,
    transactionStatus: signal.status,
    statusUnmapped: signal.unmapped,
    counterpartyRole: 'client',
    leadId,
    invoiceId: asString(row.staff_invoice_id),
    djLedgerId: null,
    sourceSystem: sourceFromMethod(method),
    idempotencyKey: leadId ? `lead_balance:${leadId}:${paid ?? 0}` : null,
    label: title,
    visibility,
  });
}

/**
 * Pure mapper — dj_ledger row → TransactionHistoryDTO (artist wallet).
 */
export function mapDjLedgerRowToTransaction(
  row: Record<string, unknown>,
  visibility: FinancialVisibilityAudience = 'artist_wallet',
): TransactionHistoryDTO {
  const id = asString(row.id) ?? 'unknown';
  const cents = asNumber(row.amount_cents);
  const amountUsd = cents == null ? asNumber(row.amount_usd) : cents / 100;
  const signal = mapV1PaymentSignalToTransactionStatus(
    asString(row.status) ?? asString(row.type) ?? 'posted',
  );
  const meta = isRecord(row.metadata) ? row.metadata : {};
  const leadId = asString(meta.lead_id) ?? asString(row.lead_id);

  return Object.freeze({
    transactionId: `tx:ledger:${id}`,
    occurredAt: asString(row.created_at) ?? asString(row.posted_at),
    kind: 'dj_payout',
    direction: 'inflow',
    amountUsd,
    currency: asString(row.currency) ?? 'USD',
    method: 'Other',
    transactionStatus: signal.status,
    statusUnmapped: signal.unmapped,
    counterpartyRole: 'artist',
    leadId,
    invoiceId: null,
    djLedgerId: id,
    sourceSystem: 'dj_ledger',
    idempotencyKey: `dj_ledger:${id}`,
    label: asString(row.type) ?? asString(meta.label) ?? 'DJ payout release',
    visibility,
  });
}

export function filterReceiptsForClient(
  receipts: readonly PaymentReceiptReadDTO[],
  clientUserId: string,
): readonly PaymentReceiptReadDTO[] {
  const id = clientUserId.trim();
  return Object.freeze(receipts.filter((r) => r.clientUserId === id));
}

export function filterTransactionsForAudience(
  rows: readonly TransactionHistoryDTO[],
  audience: FinancialVisibilityAudience,
): readonly TransactionHistoryDTO[] {
  if (audience === 'staff_full') return rows;
  if (audience === 'staff_seller') {
    return Object.freeze(rows.filter((t) => t.kind !== 'adjustment' || t.visibility === 'staff_seller'));
  }
  return Object.freeze(rows.filter((t) => t.visibility === audience));
}

/**
 * Seller: hide Stripe session-like references on receipts.
 */
export function redactReceiptForAudience(
  receipt: PaymentReceiptReadDTO,
  audience: FinancialVisibilityAudience,
): PaymentReceiptReadDTO {
  if (audience !== 'staff_seller') return receipt;
  return Object.freeze({
    ...receipt,
    visibility: 'staff_seller',
    referenceLabel:
      receipt.method === 'StripeCard' || receipt.method === 'Zelle' ? receipt.method : null,
  });
}

export function buildClientBalance(
  leadRows: readonly Record<string, unknown>[],
  clientUserId: string,
  asOf?: string | null,
): FinancialBalanceReadDTO {
  const own = leadRows.filter((r) => asString(r.client_user_id) === clientUserId);
  let totalDue = 0;
  let totalPaid = 0;
  let openCount = 0;
  let completedCount = 0;

  for (const row of own) {
    const total = asNumber(row.total_amount) ?? 0;
    const paid = asNumber(row.balance_paid) ?? 0;
    totalPaid += paid;
    const due = Math.max(0, total - paid);
    totalDue += due;
    const signal = mapV1PaymentSignalToTransactionStatus(asString(row.payment_status));
    if (signal.status === 'Completed' && due <= 0.009) completedCount += 1;
    else if (due > 0 || signal.status === 'Pending' || signal.status === 'Verified') openCount += 1;
  }

  return Object.freeze({
    balanceId: `client:${clientUserId}`,
    audience: 'client_own',
    currency: 'USD',
    asOf: asOf ?? null,
    totalDueUsd: totalDue,
    totalPaidUsd: totalPaid,
    walletAvailableUsd: null,
    walletPendingReleaseUsd: null,
    openReceiptCount: openCount,
    completedReceiptCount: completedCount,
  });
}

/**
 * Artist wallet from dj_ledger + pending release inferred from assigned leads
 * where payout agreed but not released (dj_payout_released_at null).
 */
export function buildArtistWalletBalance(input: {
  readonly artistUserId: string;
  readonly artistProfileId?: string | null;
  readonly ledgerRows: readonly Record<string, unknown>[];
  readonly assignedLeadRows?: readonly Record<string, unknown>[];
  readonly asOf?: string | null;
}): FinancialBalanceReadDTO {
  let available = 0;
  let completed = 0;
  for (const row of input.ledgerRows) {
    const cents = asNumber(row.amount_cents);
    const amount = cents == null ? asNumber(row.amount_usd) ?? 0 : cents / 100;
    const status = (asString(row.status) ?? 'posted').toLowerCase();
    if (status === 'posted' || status === 'released' || status === 'paid' || status === 'completed') {
      available += amount;
      completed += 1;
    }
  }

  let pending = 0;
  const profileId = input.artistProfileId ?? null;
  for (const row of input.assignedLeadRows ?? []) {
    const assigned = asString(row.assigned_dj_id);
    if (profileId && assigned && assigned !== profileId) continue;
    const released = asString(row.dj_payout_released_at);
    const agreed = asNumber(row.dj_agreed_payout_usd) ?? 0;
    if (!released && agreed > 0) pending += agreed;
  }

  return Object.freeze({
    balanceId: `artist:${input.artistUserId}`,
    audience: 'artist_wallet',
    currency: 'USD',
    asOf: input.asOf ?? null,
    totalDueUsd: null,
    totalPaidUsd: null,
    walletAvailableUsd: available,
    walletPendingReleaseUsd: pending,
    openReceiptCount: pending > 0 ? 1 : 0,
    completedReceiptCount: completed,
  });
}

export function buildStaffMasterBalance(
  leadRows: readonly Record<string, unknown>[],
  audience: Extract<FinancialVisibilityAudience, 'staff_seller' | 'staff_full'>,
  asOf?: string | null,
): FinancialBalanceReadDTO {
  let totalDue = 0;
  let totalPaid = 0;
  let openCount = 0;
  let completedCount = 0;

  for (const row of leadRows) {
    const total = asNumber(row.total_amount) ?? 0;
    const paid = asNumber(row.balance_paid) ?? 0;
    totalPaid += paid;
    totalDue += Math.max(0, total - paid);
    const signal = mapV1PaymentSignalToTransactionStatus(asString(row.payment_status));
    if (signal.status === 'Completed' && total - paid <= 0.009) completedCount += 1;
    else openCount += 1;
  }

  return Object.freeze({
    balanceId: `company:master:${audience}`,
    audience,
    currency: 'USD',
    asOf: asOf ?? null,
    totalDueUsd: totalDue,
    totalPaidUsd: totalPaid,
    walletAvailableUsd: null,
    walletPendingReleaseUsd: null,
    openReceiptCount: openCount,
    completedReceiptCount: completedCount,
  });
}
