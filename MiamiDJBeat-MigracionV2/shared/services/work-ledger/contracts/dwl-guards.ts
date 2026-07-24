/** DWL data contracts — pure guards — DC-1 + DC-2 */

import {
  ATTENDANCE_STATUSES,
  COVERAGE_REASON_CODES,
  COVERAGE_SCOPE_KINDS,
  COVERAGE_STATUSES,
  COVERAGE_TYPES,
  PERFORMANCE_STATUSES,
  WORK_RECORD_STATUSES,
  WORK_ROLES,
  WORK_SESSION_STATUSES,
  WORK_SET_STATUSES,
  WORK_SET_TYPES,
  type AttendanceStatus,
  type CoverageReasonCode,
  type CoverageScopeKind,
  type CoverageStatus,
  type CoverageType,
  type PerformanceStatus,
  type WorkRecordStatus,
  type WorkRole,
  type WorkSessionStatus,
  type WorkSetStatus,
  type WorkSetType,
} from './dwl-enums';
import type { WorkCoverageScope } from './dwl-entities';

export type WorkLedgerContractErrorCode =
  | 'DWL_SEQUENCE_INVALID'
  | 'DWL_STATUS_INVALID'
  | 'DWL_SCOPE_INVALID'
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

/** WorkSet.sequence uses the same safe positive integer rules as WorkSession (DC-2 §9). */
export function assertValidWorkSetSequence(value: number): asserts value is number {
  assertValidWorkSessionSequence(value);
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

export const isWorkSetStatus = (value: string): value is WorkSetStatus =>
  (WORK_SET_STATUSES as readonly string[]).includes(value);

export const isWorkSetType = (value: string): value is WorkSetType =>
  (WORK_SET_TYPES as readonly string[]).includes(value);

export const isCoverageType = (value: string): value is CoverageType =>
  (COVERAGE_TYPES as readonly string[]).includes(value);

export const isCoverageStatus = (value: string): value is CoverageStatus =>
  (COVERAGE_STATUSES as readonly string[]).includes(value);

export const isCoverageReasonCode = (value: string): value is CoverageReasonCode =>
  (COVERAGE_REASON_CODES as readonly string[]).includes(value);

export const isCoverageScopeKind = (value: string): value is CoverageScopeKind =>
  (COVERAGE_SCOPE_KINDS as readonly string[]).includes(value);

/**
 * Structural guard for WorkCoverageRecord.coverageScope union.
 * Does not validate temporal containment or deduplication (no persistence in DC-2).
 */
export function assertValidWorkCoverageScope(
  scope: WorkCoverageScope,
): asserts scope is WorkCoverageScope {
  if (!isCoverageScopeKind(scope.scopeKind)) {
    throw new WorkLedgerContractError('DWL_SCOPE_INVALID', 'Invalid coverage scope kind');
  }

  switch (scope.scopeKind) {
    case 'WORK_RECORD_SCOPE':
      if (!scope.workRecordId) {
        throw new WorkLedgerContractError('DWL_SCOPE_INVALID', 'WORK_RECORD_SCOPE requires workRecordId');
      }
      return;
    case 'WORK_SESSION_SCOPE':
      if (!scope.workRecordId || !scope.workSessionId) {
        throw new WorkLedgerContractError(
          'DWL_SCOPE_INVALID',
          'WORK_SESSION_SCOPE requires workRecordId and workSessionId',
        );
      }
      return;
    case 'WORK_SET_SCOPE':
      if (!scope.workRecordId || !scope.workSessionId || !scope.workSetId) {
        throw new WorkLedgerContractError(
          'DWL_SCOPE_INVALID',
          'WORK_SET_SCOPE requires workRecordId, workSessionId and workSetId',
        );
      }
      return;
    case 'TIME_RANGE_SCOPE':
      if (!scope.workRecordId) {
        throw new WorkLedgerContractError('DWL_SCOPE_INVALID', 'TIME_RANGE_SCOPE requires workRecordId');
      }
      return;
    default: {
      const _exhaustive: never = scope;
      throw new WorkLedgerContractError(
        'DWL_SCOPE_INVALID',
        `Unhandled coverage scope kind: ${String(_exhaustive)}`,
      );
    }
  }
}
