/** MOD-007 Theme Manager — errors — TICKET-MOD-007-THEME-REGISTRY-001 */

import type { ThemeErrorCode } from './types';

export class ThemeError extends Error {
  readonly code: ThemeErrorCode;

  constructor(code: ThemeErrorCode, message: string) {
    super(message);
    this.name = 'ThemeError';
    this.code = code;
  }
}

export function isThemeError(value: unknown): value is ThemeError {
  return value instanceof ThemeError;
}
