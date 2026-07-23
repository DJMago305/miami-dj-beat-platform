/** OFTL data contracts — nominal IDs — TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001 */

/**
 * Branded string IDs — compile-time nominal separation (pattern: CapabilityId).
 * JSON serialization remains a plain string value.
 */
export type FinancialObligationId = string & { readonly __brand: 'FinancialObligationId' };
export type OwnerFinancialTransactionId = string & {
  readonly __brand: 'OwnerFinancialTransactionId';
};
export type OwnerTransactionLegId = string & { readonly __brand: 'OwnerTransactionLegId' };

export type TransactionGroupId = string & { readonly __brand: 'TransactionGroupId' };
export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey' };

/** Cross-domain correlation (auth / staff). */
export type MdjUserId = string;
export type MdjStaffUserId = string;

/** Optional FK-style references — validated at persistence boundary. */
export type DjProfileId = string;
export type ClientProfileId = string;
export type LeadId = string;
export type StaffInvoiceId = string;

/** Boundary cast helpers — no runtime validation in DC-1. */
export function asFinancialObligationId(value: string): FinancialObligationId {
  return value as FinancialObligationId;
}

export function asOwnerFinancialTransactionId(value: string): OwnerFinancialTransactionId {
  return value as OwnerFinancialTransactionId;
}

export function asOwnerTransactionLegId(value: string): OwnerTransactionLegId {
  return value as OwnerTransactionLegId;
}

export function asTransactionGroupId(value: string): TransactionGroupId {
  return value as TransactionGroupId;
}

export function asIdempotencyKey(value: string): IdempotencyKey {
  return value as IdempotencyKey;
}
