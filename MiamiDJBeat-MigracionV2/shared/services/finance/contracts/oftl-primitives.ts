/** OFTL data contracts — shared primitives — TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001 */

import type { CounterpartyType, OwnerFinancialSourceSystem } from './oftl-enums';
import type { ClientProfileId, DjProfileId, MdjStaffUserId, MdjUserId } from './oftl-ids';

/** ISO 4217 code — explicit on every monetary field (US-first product, not implicit). */
export type CurrencyCode = string;

/**
 * Non-negative integer minor units — JSON-serializable (aligns with V1 `amount_cents`).
 * Sign is **not** encoded in the amount; use direction fields on transaction/leg.
 * Validated via `assertValidMoneyMinorUnits` (semantics B).
 */
export type MoneyMinorUnits = number;

/** Canonical money pair — amount + currency always explicit together. */
export type MoneyAmount = {
  readonly amountMinorUnits: MoneyMinorUnits;
  readonly currencyCode: CurrencyCode;
};

/** Creditor, debtor, or leg counterparty reference. */
export type FinancialPartyRef = {
  readonly partyType: CounterpartyType;
  readonly userId?: MdjUserId;
  readonly djProfileId?: DjProfileId;
  readonly clientProfileId?: ClientProfileId;
  readonly displayName?: string;
};

/** Provenance of an obligation or transaction row. */
export type FinancialSourceReference = {
  readonly sourceSystem: OwnerFinancialSourceSystem;
  readonly sourceRecordId?: string;
};

/** Snapshot of authorization at record time (no runtime enforcement in DC-1). */
export type FinanceAuthorizationContext = {
  readonly recordedByStaffUserId?: MdjStaffUserId;
  readonly recordedByUserId: MdjUserId;
  readonly capabilitySnapshot?: readonly string[];
};

/** JSON-safe audit metadata extension. */
export type FinancialAuditMetadata = Readonly<Record<string, string | number | boolean | null>>;

/** Schema evolution marker — literal for contract version. */
export type OftlContractSchemaVersion = 1;
