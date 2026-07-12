import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import {
  API_TO_GLOBAL_MAP,
  AUTHORIZED_API_BRIDGE_CODES,
  DOMAIN_ACCESS_SNAPSHOT_STATIC_GLOBAL_MAP,
  initializeErrorHandler,
  normalizeApiClientError,
  normalizeDomainError,
  resetErrorHandlerForTests,
} from '@mdj/shared/errors';
import { initializeEventBus, getEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, getLoggingState, resetLoggingForTests } from '@mdj/shared/logging';
import { createApiError } from '../../shared/api/runtime';

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

function buildApiFailure(
  error: ReturnType<typeof createApiError>,
  status: number,
  correlationId = 'corr-api-001',
) {
  return Object.freeze({
    ok: false as const,
    status,
    error,
    metadata: Object.freeze({
      requestId: 'req-api-001',
      correlationId,
      durationMs: 3,
      attempt: 1,
      context: Object.freeze({
        requestId: 'req-api-001',
        correlationId,
        sessionId: 'ses_test',
        actorType: 'authenticated',
      }),
    }),
  });
}

describe('MOD-014 API error bridge — CONTRACT-FIX-001', () => {
  beforeEach(() => {
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it.each([
    ['API_HTTP_ERROR', 'ERR-0500', 403, 'error.api.http.403'],
    ['API_PARSE_ERROR', 'ERR-0501', 0, 'error.api.parse'],
    ['API_TIMEOUT', 'ERR-0502', 0, 'error.api.timeout'],
    ['API_CANCELLED', 'ERR-0504', 0, 'error.api.cancelled'],
    ['API_INVALID_PAYLOAD', 'ERR-0800', 0, 'error.api.invalid_payload'],
  ] as const)(
    'maps authorized %s to %s',
    (apiCode, globalCode, status, userMessageKey) => {
      bootThroughLogging();
      const normalized = normalizeApiClientError(
        createApiError(apiCode, `${apiCode} message`, status, null),
      );

      expect(normalized.code).toBe(globalCode);
      expect(normalized.cause).toBe(apiCode);
      expect(normalized.userMessageKey).toBe(userMessageKey);
      expect(Object.isFrozen(normalized)).toBe(true);
    },
  );

  it('limits API_TO_GLOBAL_MAP to five authorized ApiErrorCode values', () => {
    expect(Object.keys(API_TO_GLOBAL_MAP).sort()).toEqual([...AUTHORIZED_API_BRIDGE_CODES].sort());
    expect(API_TO_GLOBAL_MAP).not.toHaveProperty('API_EDGE_REJECTED');
    expect(API_TO_GLOBAL_MAP).not.toHaveProperty('API_NETWORK');
    expect(API_TO_GLOBAL_MAP).not.toHaveProperty('API_RATE_LIMITED');
    expect(API_TO_GLOBAL_MAP).not.toHaveProperty('API_UNKNOWN');
  });

  it('maps unauthorized API_NETWORK to ERR-0999 fallback without canonical mapping', () => {
    bootThroughLogging();
    const normalized = normalizeApiClientError(
      createApiError('API_NETWORK', 'fetch failed', 0, null),
    );

    expect(normalized.code).toBe('ERR-0999');
    expect(normalized.cause).toBe('API_NETWORK');
  });

  it('does not normalize ApiSuccess as an API error', () => {
    bootThroughLogging();
    const normalized = normalizeApiClientError({
      ok: true,
      status: 200,
      data: { profile_kind: 'buyer' },
      metadata: {
        requestId: 'req-success',
        correlationId: 'corr-success',
        durationMs: 1,
        attempt: 1,
        context: {
          requestId: 'req-success',
          correlationId: 'corr-success',
        },
      },
    });

    expect(normalized.code).toBe('ERR-0999');
    expect(normalized.logMessage).toContain('ApiSuccess cannot be normalized');
  });

  it('maps ApiFailure and preserves correlationId from metadata', () => {
    bootThroughLogging();
    const failure = buildApiFailure(
      createApiError('API_HTTP_ERROR', 'JWT expired', 401, null),
      401,
      'corr-from-metadata',
    );

    const normalized = normalizeApiClientError(failure);

    expect(normalized.code).toBe('ERR-0500');
    expect(normalized.correlationId).toBe('corr-from-metadata');
    expect(normalized.userMessageKey).toBe('error.api.http.401');
  });

  it('does not mutate the original ApiError message', () => {
    bootThroughLogging();
    const apiError = createApiError('API_HTTP_ERROR', 'Server error', 500, null);
    const messageBefore = apiError.message;

    normalizeApiClientError(apiError);

    expect(apiError.message).toBe(messageBefore);
  });

  it('does not publish SYSTEM_ERROR for API_CANCELLED INFO severity', () => {
    bootThroughLogging();
    const published: string[] = [];
    getEventBus().subscribe('SYSTEM_ERROR', () => {
      published.push('SYSTEM_ERROR');
    });

    normalizeApiClientError(createApiError('API_CANCELLED', 'Request was cancelled.', 0, null));

    expect(published).toHaveLength(0);
  });

  it('does not publish SYSTEM_ERROR for API_TIMEOUT WARNING severity', () => {
    bootThroughLogging();
    const published: string[] = [];
    getEventBus().subscribe('SYSTEM_ERROR', () => {
      published.push('SYSTEM_ERROR');
    });

    normalizeApiClientError(createApiError('API_TIMEOUT', 'Request timed out.', 0, null));

    expect(published).toHaveLength(0);
    expect(normalizeApiClientError(createApiError('API_TIMEOUT', 'Request timed out.', 0, null)).severity).toBe(
      'WARNING',
    );
  });

  it('publishes SYSTEM_ERROR for API_HTTP_ERROR ERROR severity', () => {
    bootThroughLogging();
    const published: string[] = [];
    getEventBus().subscribe('SYSTEM_ERROR', () => {
      published.push('SYSTEM_ERROR');
    });

    normalizeApiClientError(createApiError('API_HTTP_ERROR', 'Server error', 500, null));

    expect(published).toHaveLength(1);
  });

  it('redacts sensitive API error messages', () => {
    bootThroughLogging();
    const normalized = normalizeApiClientError(
      createApiError('API_HTTP_ERROR', 'Bearer secret-token-value leaked', 500, null),
    );

    expect(normalized.logMessage).toBe('[REDACTED]');
    expect(normalized.logMessage).not.toContain('secret-token-value');
  });

  it('returns idempotent frozen output for consecutive normalizations', () => {
    bootThroughLogging();
    const first = normalizeApiClientError(
      createApiError('API_PARSE_ERROR', 'Invalid body', 0, null),
    );
    const second = normalizeApiClientError(first);

    expect(second).toBe(first);
  });

  it('normalizes null input to ERR-0999 without throwing', () => {
    bootThroughLogging();
    const normalized = normalizeApiClientError(null);

    expect(normalized.code).toBe('ERR-0999');
  });

  it('does not publish SYSTEM_ERROR when Error Handler is not initialized', () => {
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    const published: string[] = [];
    getEventBus().subscribe('SYSTEM_ERROR', () => {
      published.push('SYSTEM_ERROR');
    });

    const normalized = normalizeApiClientError(
      createApiError('API_HTTP_ERROR', 'Server error', 500, null),
    );

    expect(normalized.code).toBe('ERR-0500');
    expect(published).toHaveLength(0);
  });

  it('does not log when Logging is not initialized', () => {
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();

    normalizeApiClientError(createApiError('API_HTTP_ERROR', 'Server error', 500, null));

    expect(getLoggingState()).not.toBe('LOG_READY');
  });
});

describe('MOD-014 domain error bridge — CONTRACT-FIX-001', () => {
  beforeEach(() => {
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('maps ACCESS_SNAPSHOT_REJECTED with no_session to ERR-0300', () => {
    bootThroughLogging();
    const normalized = normalizeDomainError({
      ok: false,
      code: 'ACCESS_SNAPSHOT_REJECTED',
      reason: 'no_session',
    });

    expect(normalized.code).toBe('ERR-0300');
    expect(normalized.userMessageKey).toBe('error.session.hydrate_failed');
    expect(normalized.cause).toBe('ACCESS_SNAPSHOT_REJECTED');
  });

  it('maps ACCESS_SNAPSHOT_REJECTED with other reason to ERR-0999', () => {
    bootThroughLogging();
    const normalized = normalizeDomainError({
      ok: false,
      code: 'ACCESS_SNAPSHOT_REJECTED',
      reason: 'backend_rejected',
    });

    expect(normalized.code).toBe('ERR-0999');
    expect(normalized.userMessageKey).toBe('error.access_snapshot.rejected');
    expect(normalized.code).not.toBe('ERR-0300');
  });

  it('maps ACCESS_SNAPSHOT_UNKNOWN_PROFILE to ERR-0999 never ERR-0200', () => {
    bootThroughLogging();
    const normalized = normalizeDomainError({
      ok: false,
      code: 'ACCESS_SNAPSHOT_UNKNOWN_PROFILE',
      reason: 'Unknown authenticated profile',
    });

    expect(normalized.code).toBe('ERR-0999');
    expect(normalized.userMessageKey).toBe('error.access_snapshot.unknown_profile');
    expect(normalized.code).not.toBe('ERR-0200');
    expect(normalized.userMessageKey).not.toBe('error.perm.denied');
  });

  it('maps ACCESS_SNAPSHOT_UNRESOLVED_STAFF to ERR-0999 never ERR-0201', () => {
    bootThroughLogging();
    const normalized = normalizeDomainError({
      ok: false,
      code: 'ACCESS_SNAPSHOT_UNRESOLVED_STAFF',
      reason: 'Unsupported staff role: intern',
    });

    expect(normalized.code).toBe('ERR-0999');
    expect(normalized.userMessageKey).toBe('error.access_snapshot.unresolved_staff');
    expect(normalized.code).not.toBe('ERR-0201');
    expect(normalized.userMessageKey).not.toBe('error.perm.staff_gate_failed');
  });

  it('maps ACCESS_SNAPSHOT_INVALID_PAYLOAD to ERR-0501 parse contract error', () => {
    bootThroughLogging();
    const normalized = normalizeDomainError({
      ok: false,
      code: 'ACCESS_SNAPSHOT_INVALID_PAYLOAD',
      reason: 'Access snapshot payload must be an object.',
    });

    expect(normalized.code).toBe('ERR-0501');
    expect(normalized.userMessageKey).toBe('error.api.parse');
    expect(DOMAIN_ACCESS_SNAPSHOT_STATIC_GLOBAL_MAP.ACCESS_SNAPSHOT_INVALID_PAYLOAD).toBe('ERR-0501');
  });

  it('preserves correlationId and does not mutate domain input', () => {
    bootThroughLogging();
    const input = {
      ok: false as const,
      code: 'ACCESS_SNAPSHOT_UNKNOWN_PROFILE' as const,
      reason: 'Unknown profile',
    };
    const reasonBefore = input.reason;

    const normalized = normalizeDomainError(input, { correlationId: 'corr-domain-001' });

    expect(normalized.correlationId).toBe('corr-domain-001');
    expect(input.reason).toBe(reasonBefore);
  });

  it('returns idempotent frozen output for consecutive domain normalizations', () => {
    bootThroughLogging();
    const first = normalizeDomainError({
      ok: false,
      code: 'ACCESS_SNAPSHOT_INVALID_PAYLOAD',
      reason: 'Malformed payload',
    });
    const second = normalizeDomainError(first);

    expect(second).toBe(first);
  });

  it('publishes SYSTEM_ERROR for ACCESS_SNAPSHOT_INVALID_PAYLOAD ERROR severity', () => {
    bootThroughLogging();
    const published: string[] = [];
    getEventBus().subscribe('SYSTEM_ERROR', () => {
      published.push('SYSTEM_ERROR');
    });

    normalizeDomainError({
      ok: false,
      code: 'ACCESS_SNAPSHOT_INVALID_PAYLOAD',
      reason: 'Malformed payload',
    });

    expect(published).toHaveLength(1);
  });

  it('normalizes null domain input to ERR-0999 without throwing', () => {
    bootThroughLogging();
    const normalized = normalizeDomainError(null);

    expect(normalized.code).toBe('ERR-0999');
  });
});
