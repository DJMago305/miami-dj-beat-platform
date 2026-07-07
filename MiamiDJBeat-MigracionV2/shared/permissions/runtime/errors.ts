/** MOD-003 Permissions — errors — TICKET-MOD-003-CAPABILITY-REGISTRY-001 */

import type { PermissionErrorCode } from './types';

export class PermissionError extends Error {
  readonly code: PermissionErrorCode;

  constructor(code: PermissionErrorCode, message: string) {
    super(message);
    this.name = 'PermissionError';
    this.code = code;
  }
}

export function isPermissionError(value: unknown): value is PermissionError {
  return value instanceof PermissionError;
}
