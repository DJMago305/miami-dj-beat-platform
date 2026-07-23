/** OFTL data contracts — pure guards — TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001 */

import {
  OBLIGATION_LIFECYCLE_STATUSES,
  TRANSACTION_LIFECYCLE_STATUSES,
  type ObligationLifecycleStatus,
  type TransactionLifecycleStatus,
} from './oftl-enums';
import type { MoneyMinorUnits } from './oftl-primitives';

export type OftlContractErrorCode =
  | 'OFTL_MONEY_INVALID'
  | 'OFTL_LIFECYCLE_INVALID'
  | 'OFTL_CONTRACT_INVALID';

export class OftlContractError extends Error {
  readonly code: OftlContractErrorCode;

  constructor(code: OftlContractErrorCode, message: string) {
    super(message);
    this.name = 'OftlContractError';
    this.code = code;
  }
}

export type AssertValidMoneyMinorUnitsOptions = {
  readonly allowZero?: boolean;
};

/**
 * Validates JSON-serializable **non-negative** integer minor units (OFTL-DC-02).
 *
 * Semantics **B**: amounts are magnitude-only; debit/credit or inflow/outflow is
 * expressed via `FinancialDirection` / `FinancialLegDirection`, not negative amounts.
 *
 * Rejects: NaN, ±Infinity, decimals, negatives, unsafe integers.
 * Default: strictly positive (`allowZero: false`). Pass `{ allowZero: true }` for zero.
 */
export function assertValidMoneyMinorUnits(
  value: number,
  options: AssertValidMoneyMinorUnitsOptions = {},
): asserts value is MoneyMinorUnits {
  const { allowZero = false } = options;

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new OftlContractError('OFTL_MONEY_INVALID', 'Money minor units must be a finite number');
  }

  if (!Number.isFinite(value)) {
    throw new OftlContractError('OFTL_MONEY_INVALID', 'Money minor units must be finite');
  }

  if (!Number.isInteger(value)) {
    throw new OftlContractError('OFTL_MONEY_INVALID', 'Money minor units must be an integer');
  }

  if (!Number.isSafeInteger(value)) {
    throw new OftlContractError('OFTL_MONEY_INVALID', 'Money minor units must be a safe integer');
  }

  if (value < 0 || (value === 0 && !allowZero)) {
    throw new OftlContractError(
      'OFTL_MONEY_INVALID',
      allowZero
        ? 'Money minor units must be non-negative'
        : 'Money minor units must be a positive integer',
    );
  }
}

export const isTransactionLifecycleStatus = (value: string): value is TransactionLifecycleStatus =>
  (TRANSACTION_LIFECYCLE_STATUSES as readonly string[]).includes(value);

export const isObligationLifecycleStatus = (value: string): value is ObligationLifecycleStatus =>
  (OBLIGATION_LIFECYCLE_STATUSES as readonly string[]).includes(value);
