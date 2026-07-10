/** MOD-002 Session Manager — errors — TICKET-V2-RUNTIME-SESSION-001 */

import type { SessionErrorCode } from './types';

export class SessionError extends Error {
  readonly code: SessionErrorCode;

  constructor(code: SessionErrorCode, message: string) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
  }
}

export function isSessionError(value: unknown): value is SessionError {
  return value instanceof SessionError;
}
