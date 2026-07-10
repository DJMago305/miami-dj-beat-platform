/** MOD-001 Authentication — errors — TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001 */

import type { AuthErrorCode } from './types';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export function isAuthError(value: unknown): value is AuthError {
  return value instanceof AuthError;
}

export function createAuthError(code: AuthErrorCode, message: string): AuthError {
  return new AuthError(code, message);
}
