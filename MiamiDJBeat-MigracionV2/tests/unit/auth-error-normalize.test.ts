import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigError, initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import {
  AUTH_TO_GLOBAL_MAP,
  initializeErrorHandler,
  normalizeAuthError,
  normalizeError,
  resetErrorHandlerForTests,
} from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { AuthError, createAuthError } from '../../shared/auth/runtime';

const VALID_LOCAL_ENV = {
  MDJ_V2_ENV: 'local',
  MDJ_V2_APP_NAME: 'MiamiDJBeat-MigracionV2',
  MDJ_V2_DEPLOY_ROOT: '/',
  MDJ_V2_PORTAL_CLIENT_URL: 'http://localhost:5173/client/',
  MDJ_V2_PORTAL_ARTIST_URL: 'http://localhost:5173/artist/',
  MDJ_V2_PORTAL_STAFF_URL: 'http://localhost:5173/staff/',
  MDJ_V2_DEFAULT_LOCALE: 'en',
  MDJ_V2_DEFAULT_THEME: 'dark',
  MDJ_V2_LOG_LEVEL: 'debug',
  MDJ_V2_API_PUBLIC_URL: 'https://example.supabase.co',
  MDJ_V2_API_ANON_KEY: 'YOUR_ANON_KEY',
};

function bootThroughLogging(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
}

describe('MOD-014 normalizeAuthError', () => {
  beforeEach(() => {
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('maps ERR-AUTH-002 to ERR-0100 with auth cause', () => {
    bootThroughLogging();
    const normalized = normalizeAuthError(createAuthError('ERR-AUTH-002', 'Invalid credentials'));

    expect(normalized.code).toBe('ERR-0100');
    expect(normalized.category).toBe('C-02');
    expect(normalized.cause).toBe('ERR-AUTH-002');
    expect(normalized.moduleId).toBe('MOD-001');
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it('maps ERR-AUTH-006 to ERR-0102 with retryable recovery', () => {
    bootThroughLogging();
    const normalized = normalizeAuthError(createAuthError('ERR-AUTH-006', 'Provider unavailable'));

    expect(normalized.code).toBe('ERR-0102');
    expect(normalized.recovery).toBe('retryable');
    expect(normalized.cause).toBe('ERR-AUTH-006');
  });

  it('maps ERR-AUTH-010 to ERR-0103 as CRITICAL fatal', () => {
    bootThroughLogging();
    const normalized = normalizeAuthError(createAuthError('ERR-AUTH-010', 'Security violation'));

    expect(normalized.code).toBe('ERR-0103');
    expect(normalized.severity).toBe('CRITICAL');
    expect(normalized.recovery).toBe('fatal');
    expect(normalized.cause).toBe('ERR-AUTH-010');
  });

  it('maps AuthFailureShape ERR-AUTH-007 to ERR-0101', () => {
    bootThroughLogging();
    const normalized = normalizeAuthError({
      ok: false,
      code: 'ERR-AUTH-007',
      message: 'Access token expired',
    });

    expect(normalized.code).toBe('ERR-0101');
    expect(normalized.cause).toBe('ERR-AUTH-007');
  });

  it('maps recognized network errors to ERR-0102', () => {
    bootThroughLogging();
    const normalized = normalizeAuthError(new Error('fetch failed'));

    expect(normalized.code).toBe('ERR-0102');
    expect(normalized.category).toBe('C-02');
    expect(normalized.cause).toBeUndefined();
  });

  it('redacts sensitive string input', () => {
    bootThroughLogging();
    const normalized = normalizeAuthError('password=secret-token leaked');

    expect(normalized.logMessage).toBe('[REDACTED]');
    expect(normalized.code).toBe('ERR-0950');
  });

  it('maps null and undefined to ERR-0999', () => {
    bootThroughLogging();
    const fromNull = normalizeAuthError(null);
    const fromUndefined = normalizeAuthError(undefined);

    expect(fromNull.code).toBe('ERR-0999');
    expect(fromUndefined.code).toBe('ERR-0999');
  });

  it('redacts nested object secrets without leaking access_token', () => {
    bootThroughLogging();
    const normalized = normalizeAuthError({
      nested: { access_token: 'super-secret-token-value' },
    });

    expect(normalized.code).toBe('ERR-0999');
    expect(normalized.logMessage).toBe('[REDACTED]');
    expect(normalized.logMessage).not.toContain('super-secret-token-value');
  });

  it('preserves correlationId from context', () => {
    bootThroughLogging();
    const normalized = normalizeAuthError(createAuthError('ERR-AUTH-002', 'Invalid credentials'), {
      correlationId: 'corr-auth-001',
    });

    expect(normalized.correlationId).toBe('corr-auth-001');
  });

  it('returns idempotent frozen NormalizedError for category C-02', () => {
    bootThroughLogging();
    const first = normalizeAuthError(createAuthError('ERR-AUTH-002', 'Invalid credentials'));
    const second = normalizeAuthError(first);

    expect(second).toBe(first);
    expect(Object.isFrozen(second)).toBe(true);
  });

  it('does not mutate the original AuthError message', () => {
    bootThroughLogging();
    const original = createAuthError('ERR-AUTH-002', 'Invalid credentials');
    const messageBefore = original.message;

    normalizeAuthError(original);

    expect(original.message).toBe(messageBefore);
  });

  it('maps ERR-AUTH-001 to ERR-0109', () => {
    bootThroughLogging();
    const normalized = normalizeAuthError(createAuthError('ERR-AUTH-001', 'Unknown auth state'));

    expect(normalized.code).toBe('ERR-0109');
    expect(normalized.cause).toBe('ERR-AUTH-001');
  });

  it('classifies retry behavior for ERR-AUTH-002, 006 and 010', () => {
    bootThroughLogging();

    const loginFailed = normalizeAuthError(createAuthError('ERR-AUTH-002', 'Invalid credentials'));
    const providerDown = normalizeAuthError(createAuthError('ERR-AUTH-006', 'Provider unavailable'));
    const securityViolation = normalizeAuthError(createAuthError('ERR-AUTH-010', 'Security violation'));

    expect(loginFailed.recovery).toBe('recoverable');
    expect(providerDown.recovery).toBe('retryable');
    expect(securityViolation.recovery).toBe('fatal');
  });

  it('never exposes stack traces in normalized output', () => {
    bootThroughLogging();
    const error = new Error('provider timeout');
    error.stack = 'Error: provider timeout\n    at AuthService.signIn (auth-service.ts:10:5)';

    const normalized = normalizeAuthError(error);

    expect('stack' in normalized).toBe(false);
    expect(normalized.logMessage).not.toMatch(/\bat\b/i);
    expect(normalized.logMessage).not.toContain('auth-service.ts');
  });

  it('keeps normalizeError behavior unchanged for AuthError and ConfigError', () => {
    bootThroughLogging();

    const authViaGeneric = normalizeError(new AuthError('ERR-AUTH-002', 'Invalid credentials'));
    const configViaGeneric = normalizeError(
      new ConfigError('CONFIG_ERROR_MISSING_KEY', 'Missing MDJ_V2_ENV'),
    );

    expect(authViaGeneric.code).toBe('ERR-0950');
    expect(configViaGeneric.code).toBe('ERR-0002');
  });

  it('implements the full AUTH_TO_GLOBAL_MAP contract', () => {
    expect(AUTH_TO_GLOBAL_MAP).toEqual({
      'ERR-AUTH-001': 'ERR-0109',
      'ERR-AUTH-002': 'ERR-0100',
      'ERR-AUTH-003': 'ERR-0108',
      'ERR-AUTH-004': 'ERR-0104',
      'ERR-AUTH-005': 'ERR-0105',
      'ERR-AUTH-006': 'ERR-0102',
      'ERR-AUTH-007': 'ERR-0101',
      'ERR-AUTH-008': 'ERR-0106',
      'ERR-AUTH-009': 'ERR-0107',
      'ERR-AUTH-010': 'ERR-0103',
    });
  });
});
