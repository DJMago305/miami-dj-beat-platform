/** Access permission orchestrator — retryable policy — TICKET-V2-PHASE-8-ACCESS-PERMISSION-ORCHESTRATOR-001 */

import type { ApiError } from '../../api/runtime/types';
import type { AccessSnapshotMappingCode } from '../access-snapshot/access-snapshot-types';

export function isApiErrorRetryable(error: ApiError, httpStatus: number): boolean {
  switch (error.code) {
    case 'API_TIMEOUT':
      return true;
    case 'API_HTTP_ERROR':
      return httpStatus >= 500;
    case 'API_CANCELLED':
    case 'API_PARSE_ERROR':
    case 'API_INVALID_PAYLOAD':
      return false;
    default:
      return false;
  }
}

export function isDomainMappingRetryable(_code: AccessSnapshotMappingCode): boolean {
  return false;
}

export function isPermissionResolverRetryable(): boolean {
  return false;
}
