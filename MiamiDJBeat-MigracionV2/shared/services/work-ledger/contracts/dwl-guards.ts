/** DWL data contracts — pure guards — TICKET-V2-DWL-DC-1-CORE-WORK-CONTRACTS-001 */

import {
  ATTENDANCE_STATUSES,
  PERFORMANCE_STATUSES,
  WORK_RECORD_STATUSES,
  WORK_ROLES,
  WORK_SESSION_STATUSES,
  type AttendanceStatus,
  type PerformanceStatus,
  type WorkRecordStatus,
  type WorkRole,
  type WorkSessionStatus,
} from './dwl-enums';

export type WorkLedgerContractErrorCode =
  | 'DWL_SEQUENCE_INVALID'
  | 'DWL_STATUS_INVALID'
  | 'DWL_CONTRACT_INVALID';

export class WorkLedgerContractError extends Error {
  readonly code: WorkLedgerContractErrorCode;

  constructor(code: WorkLedgerContractErrorCode, message: string) {
    super(message);
    this.name = 'WorkLedgerContractError';
    this.code = code;
  }
}

/**
 * Validates WorkSession.sequence — safe positive integer (DWL-DC1-INV-07).
 * Accepts 1 … Number.MAX_SAFE_INTEGER.
 */
export function assertValidWorkSessionSequence(value: number): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new WorkLedgerContractError('DWL_SEQUENCE_INVALID', 'Sequence must be a finite number');
  }

  if (!Number.isFinite(value)) {
    throw new WorkLedgerContractError('DWL_SEQUENCE_INVALID', 'Sequence must be finite');
  }

  if (!Number.isInteger(value)) {
    throw new WorkLedgerContractError('DWL_SEQUENCE_INVALID', 'Sequence must be an integer');
  }

  if (!Number.isSafeInteger(value)) {
    throw new WorkLedgerContractError('DWL_SEQUENCE_INVALID', 'Sequence must be a safe integer');
  }

  if (value <= 0) {
    throw new WorkLedgerContractError(
      'DWL_SEQUENCE_INVALID',
      'Sequence must be a positive integer',
    );
  }
}

export const isWorkRecordStatus = (value: string): value is WorkRecordStatus =>
  (WORK_RECORD_STATUSES as readonly string[]).includes(value);

export const isAttendanceStatus = (value: string): value is AttendanceStatus =>
  (ATTENDANCE_STATUSES as readonly string[]).includes(value);

export const isPerformanceStatus = (value: string): value is PerformanceStatus =>
  (PERFORMANCE_STATUSES as readonly string[]).includes(value);

export const isWorkSessionStatus = (value: string): value is WorkSessionStatus =>
  (WORK_SESSION_STATUSES as readonly string[]).includes(value);

export const isWorkRole = (value: string): value is WorkRole =>
  (WORK_ROLES as readonly string[]).includes(value);
