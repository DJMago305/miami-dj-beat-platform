/** MOD-014 Error Handler — catalog — TICKET-V2-RUNTIME-ERROR-HANDLER-001 */

import type { CatalogEntry } from './types';

export const ERROR_CATALOG: readonly CatalogEntry[] = [
  { code: 'ERR-0001', category: 'C-04', severity: 'FATAL', recovery: 'fatal', userMessageKey: 'error.config.invalid_env' },
  { code: 'ERR-0002', category: 'C-04', severity: 'FATAL', recovery: 'fatal', userMessageKey: 'error.config.missing_key' },
  { code: 'ERR-0003', category: 'C-04', severity: 'FATAL', recovery: 'fatal', userMessageKey: 'error.config.forbidden_key' },
  { code: 'ERR-0004', category: 'C-04', severity: 'FATAL', recovery: 'fatal', userMessageKey: 'error.config.invalid_url' },
  { code: 'ERR-0005', category: 'C-04', severity: 'FATAL', recovery: 'fatal', userMessageKey: 'error.config.v1_path' },
  { code: 'ERR-0010', category: 'C-04', severity: 'CRITICAL', recovery: 'retryable', userMessageKey: 'error.system.not_ready' },
  { code: 'ERR-0100', category: 'C-02', severity: 'INFO', recovery: 'recoverable', userMessageKey: 'error.auth.invalid_credentials' },
  { code: 'ERR-0101', category: 'C-02', severity: 'WARNING', recovery: 'recoverable', userMessageKey: 'error.auth.token_expired' },
  { code: 'ERR-0102', category: 'C-02', severity: 'ERROR', recovery: 'retryable', userMessageKey: 'error.auth.provider_unavailable' },
  { code: 'ERR-0103', category: 'C-02', severity: 'CRITICAL', recovery: 'fatal', userMessageKey: 'error.auth.security' },
  { code: 'ERR-0104', category: 'C-02', severity: 'WARNING', recovery: 'recoverable', userMessageKey: 'error.auth.restore_failed' },
  { code: 'ERR-0105', category: 'C-02', severity: 'ERROR', recovery: 'fatal', userMessageKey: 'error.auth.identity_invalid' },
  { code: 'ERR-0106', category: 'C-02', severity: 'ERROR', recovery: 'recoverable', userMessageKey: 'error.auth.refresh_failed' },
  { code: 'ERR-0107', category: 'C-02', severity: 'ERROR', recovery: 'recoverable', userMessageKey: 'error.auth.handoff_failed' },
  { code: 'ERR-0108', category: 'C-02', severity: 'WARNING', recovery: 'recoverable', userMessageKey: 'error.auth.logout_failed' },
  { code: 'ERR-0109', category: 'C-02', severity: 'WARNING', recovery: 'recoverable', userMessageKey: 'error.auth.unknown_state' },
  { code: 'ERR-0200', category: 'C-03', severity: 'INFO', recovery: 'recoverable', userMessageKey: 'error.perm.denied' },
  { code: 'ERR-0201', category: 'C-03', severity: 'WARNING', recovery: 'fatal', userMessageKey: 'error.perm.staff_gate_failed' },
  { code: 'ERR-0300', category: 'C-03', severity: 'ERROR', recovery: 'retryable', userMessageKey: 'error.session.hydrate_failed' },
  { code: 'ERR-0400', category: 'C-05', severity: 'WARNING', recovery: 'retryable', userMessageKey: 'error.network.offline' },
  { code: 'ERR-0401', category: 'C-05', severity: 'WARNING', recovery: 'retryable', userMessageKey: 'error.network.timeout' },
  { code: 'ERR-0500', category: 'C-06', severity: 'ERROR', recovery: 'retryable', userMessageKey: 'error.api.http' },
  { code: 'ERR-0501', category: 'C-06', severity: 'ERROR', recovery: 'retryable', userMessageKey: 'error.api.parse' },
  { code: 'ERR-0502', category: 'C-06', severity: 'WARNING', recovery: 'retryable', userMessageKey: 'error.api.timeout' },
  { code: 'ERR-0504', category: 'C-06', severity: 'INFO', recovery: 'ignorable', userMessageKey: 'error.api.cancelled' },
  { code: 'ERR-0600', category: 'C-07', severity: 'ERROR', recovery: 'recoverable', userMessageKey: 'error.storage.quota_exceeded' },
  { code: 'ERR-0800', category: 'C-01', severity: 'INFO', recovery: 'recoverable', userMessageKey: 'error.validation.required_field' },
  { code: 'ERR-0900', category: 'C-09', severity: 'ERROR', recovery: 'ignorable', userMessageKey: 'error.runtime.event_handler_throw' },
  { code: 'ERR-0901', category: 'C-09', severity: 'CRITICAL', recovery: 'fatal', userMessageKey: 'error.runtime.contract_violation' },
  { code: 'ERR-0950', category: 'C-10', severity: 'CRITICAL', recovery: 'retryable', userMessageKey: 'error.unexpected.generic' },
  { code: 'ERR-0999', category: 'C-10', severity: 'CRITICAL', recovery: 'fatal', userMessageKey: 'error.unknown.generic' },
] as const;

const catalogByCode = new Map<string, CatalogEntry>(
  ERROR_CATALOG.map((entry) => [entry.code, entry]),
);

const CONFIG_CODE_MAP: Record<string, string> = {
  CONFIG_ERROR_INVALID_ENV: 'ERR-0001',
  CONFIG_ERROR_MISSING_KEY: 'ERR-0002',
  CONFIG_ERROR_FORBIDDEN_KEY: 'ERR-0003',
  CONFIG_ERROR_INVALID_URL: 'ERR-0004',
  CONFIG_ERROR_V1_PATH: 'ERR-0005',
};

export function lookupCatalogEntry(code: string): CatalogEntry | undefined {
  return catalogByCode.get(code);
}

export function mapConfigErrorCode(configCode: string): string | undefined {
  return CONFIG_CODE_MAP[configCode];
}

export function inferCategoryFromCode(code: string): CatalogEntry['category'] {
  const match = /^ERR-(\d{2})/.exec(code);
  const range = match?.[1];
  switch (range) {
    case '00':
      return 'C-04';
    case '01':
      return 'C-02';
    case '02':
      return 'C-03';
    case '03':
      return 'C-03';
    case '04':
      return 'C-05';
    case '05':
      return 'C-06';
    case '06':
      return 'C-07';
    case '07':
      return 'C-08';
    case '08':
      return 'C-01';
    case '09':
      return 'C-09';
    default:
      return 'C-10';
  }
}
