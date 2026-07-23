/** OFTL data contracts — enumerations — TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001 */

/** §5A.2 A — OwnerFinancialTransaction.lifecycleStatus only. */
export const TRANSACTION_LIFECYCLE_STATUSES = [
  'DRAFT',
  'PENDING',
  'POSTED',
  'PARTIALLY_SETTLED',
  'SETTLED',
  'REVERSED',
  'VOIDED',
  'FAILED',
] as const;
export type TransactionLifecycleStatus = (typeof TRANSACTION_LIFECYCLE_STATUSES)[number];

/** §5A.2 — FinancialObligation.obligationStatus only. */
export const OBLIGATION_LIFECYCLE_STATUSES = [
  'OPEN',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
  'REVERSED',
] as const;
export type ObligationLifecycleStatus = (typeof OBLIGATION_LIFECYCLE_STATUSES)[number];

/** §5A.7 — company / transaction direction. */
export const FINANCIAL_DIRECTIONS = [
  'INFLOW',
  'OUTFLOW',
  'INTERNAL_TRANSFER',
  'ADJUSTMENT',
] as const;
export type FinancialDirection = (typeof FINANCIAL_DIRECTIONS)[number];

/** Leg-level direction (same vocabulary as FinancialDirection). */
export type FinancialLegDirection = FinancialDirection;

/** §6.4 — business operation types (canonical codes). */
export const FINANCIAL_OPERATION_TYPES = [
  'ARTIST_COMPENSATION_PAYMENT',
  'STAFF_PAYROLL_PAYMENT',
  'VENDOR_PAYMENT',
  'CLIENT_PAYMENT_RECEIVED',
  'CLIENT_CHECK_RECEIVED',
  'CLIENT_DEPOSIT_RECEIVED',
  'COMPANY_EXPENSE',
  'REFUND_TO_CLIENT',
  'BANK_TRANSFER_INTERNAL',
  'MANUAL_ADJUSTMENT',
  'ACCOUNTING_CORRECTION',
] as const;
export type FinancialOperationType = (typeof FINANCIAL_OPERATION_TYPES)[number];

/** §8 — P&L company classification (not payment channel). */
export const COMPANY_FINANCIAL_CATEGORIES = [
  'ARTIST_COMPENSATION',
  'STAFF_PAYROLL',
  'EQUIPMENT',
  'REPAIRS',
  'FUEL',
  'ADVERTISING',
  'INSURANCE',
  'SOFTWARE',
  'SUBSCRIPTIONS',
  'TAXES',
  'PRODUCTION',
  'VENDOR',
  'REFUND',
  'CLIENT_PAYMENT',
  'CLIENT_DEPOSIT',
  'CASH_RECEIPT',
  'WIRE_RECEIPT',
  'SOUNDFORTIPS_PLATFORM_FEE',
  'SUBSCRIPTION',
  'OTHER',
] as const;
export type CompanyFinancialCategory = (typeof COMPANY_FINANCIAL_CATEGORIES)[number];

/** §5A.8 — payment instrument (not company_category). */
export const PAYMENT_METHODS = [
  'CASH',
  'CHECK',
  'CARD',
  'ACH',
  'WIRE',
  'BANK_TRANSFER',
  'DIGITAL_WALLET',
  'OTHER',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** §5A.8 — processor / rail. */
export const PAYMENT_PROVIDERS = [
  'STRIPE',
  'ZELLE',
  'VENMO',
  'PAYPAL',
  'BANK',
  'NONE',
  'OTHER',
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/** §5A.7 — counterparty role. */
export const COUNTERPARTY_TYPES = [
  'ARTIST',
  'STAFF',
  'CLIENT',
  'VENDOR',
  'COMPANY',
  'NONE',
] as const;
export type CounterpartyType = (typeof COUNTERPARTY_TYPES)[number];

/** Obligation business kinds — §5A.4. */
export const FINANCIAL_OBLIGATION_KINDS = [
  'ARTIST_PAYABLE',
  'STAFF_PAYABLE',
  'VENDOR_PAYABLE',
  'CLIENT_RECEIVABLE',
  'COMMISSION_PAYABLE',
  'REFUND_PAYABLE',
] as const;
export type FinancialObligationKind = (typeof FINANCIAL_OBLIGATION_KINDS)[number];

/** OwnerFinancialTransaction.sourceSystem — discovery §6.2 (`source_system` enum). */
export const OWNER_FINANCIAL_SOURCE_SYSTEMS = [
  'owner_manual',
  'staff_manual',
  'import',
  'system_derived',
  'release_rpc_bridge',
] as const;
export type OwnerFinancialSourceSystem = (typeof OWNER_FINANCIAL_SOURCE_SYSTEMS)[number];

/** Logical ledger bucket for a leg (company / wallet / suspense). */
export const LEG_LEDGER_BUCKETS = [
  'COMPANY',
  'ARTIST_WALLET',
  'STAFF',
  'VENDOR',
  'SUSPENSE',
  'UNAPPLIED',
] as const;
export type LegLedgerBucket = (typeof LEG_LEDGER_BUCKETS)[number];

/** Materialized leg role — double-impact pattern §6.1. */
export const TRANSACTION_LEG_ROLES = ['COMPANY', 'COUNTERPARTY', 'ADJUSTMENT', 'MEMO'] as const;
export type TransactionLegRole = (typeof TRANSACTION_LEG_ROLES)[number];
