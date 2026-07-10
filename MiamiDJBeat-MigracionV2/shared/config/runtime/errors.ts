/** MOD-006 Configuration — TICKET-V2-RUNTIME-CONFIG-001 */

import type { ConfigErrorCode } from './types';

const FATAL_ERR_MAP: Partial<Record<ConfigErrorCode, string>> = {
  CONFIG_ERROR_INVALID_ENV: 'ERR-0001',
  CONFIG_ERROR_MISSING_KEY: 'ERR-0002',
  CONFIG_ERROR_FORBIDDEN_KEY: 'ERR-0003',
  CONFIG_ERROR_INVALID_URL: 'ERR-0004',
  CONFIG_ERROR_V1_PATH: 'ERR-0005',
};

export class ConfigError extends Error {
  readonly code: ConfigErrorCode;
  readonly errNumber: string | undefined;
  readonly fatal: boolean;

  constructor(code: ConfigErrorCode, message: string, options?: { fatal?: boolean }) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
    this.errNumber = FATAL_ERR_MAP[code];
    this.fatal = options?.fatal ?? this.errNumber !== undefined;
  }
}

export function isConfigError(value: unknown): value is ConfigError {
  return value instanceof ConfigError;
}
