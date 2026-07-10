import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigError, initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import {
  classifyErrorSeverity,
  clearErrorHistory,
  createAppError,
  getErrorHandler,
  getErrorState,
  initializeErrorHandler,
  normalizeError,
  resetErrorHandlerForTests,
} from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';

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
}

describe('MOD-014 Error Handler', () => {
  beforeEach(() => {
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('initializeErrorHandler sets ERR_READY after logging', () => {
    bootThroughLogging();
    const handler = initializeErrorHandler();
    expect(getErrorState()).toBe('ERR_READY');
    expect(handler.getState()).toBe('ERR_READY');
    expect(Object.isFrozen(handler)).toBe(true);
  });

  it('createAppError builds coded AppError', () => {
    bootThroughLogging();
    initializeErrorHandler();
    const error = createAppError({
      code: 'ERR-0800',
      message: 'Field required',
      moduleId: 'MOD-014',
    });
    expect(error.code).toBe('ERR-0800');
    expect(error.message).toBe('Field required');
  });

  it('normalizeError maps AppError to NormalizedError with catalog metadata', () => {
    bootThroughLogging();
    initializeErrorHandler();
    const normalized = normalizeError(
      createAppError({ code: 'ERR-0200', message: 'Denied', moduleId: 'MOD-003' }),
    );

    expect(normalized.code).toBe('ERR-0200');
    expect(normalized.category).toBe('C-03');
    expect(normalized.severity).toBe('INFO');
    expect(normalized.recovery).toBe('recoverable');
    expect(normalized.userMessageKey).toBe('error.perm.denied');
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(getErrorHandler().getHistory()).toHaveLength(1);
  });

  it('normalizeError maps ConfigError to ERR-000x', () => {
    bootThroughLogging();
    initializeErrorHandler();
    const normalized = normalizeError(
      new ConfigError('CONFIG_ERROR_MISSING_KEY', 'Missing MDJ_V2_ENV'),
    );

    expect(normalized.code).toBe('ERR-0002');
    expect(normalized.category).toBe('C-04');
    expect(normalized.severity).toBe('FATAL');
  });

  it('normalizeError redacts sensitive messages', () => {
    bootThroughLogging();
    initializeErrorHandler();
    const normalized = normalizeError('password=secret-token leaked');
    expect(normalized.logMessage).toBe('[REDACTED]');
    expect(normalized.code).toBe('ERR-0950');
  });

  it('classifyErrorSeverity reads catalog severity', () => {
    expect(classifyErrorSeverity('ERR-0401')).toBe('WARNING');
    expect(classifyErrorSeverity('ERR-0999')).toBe('CRITICAL');
    expect(classifyErrorSeverity('ERR-UNKNOWN')).toBe('CRITICAL');
  });

  it('publishes SYSTEM_ERROR for severity ERROR and above', () => {
    bootThroughLogging();
    initializeErrorHandler();
    const events: string[] = [];
    getEventBus().subscribe('SYSTEM_ERROR', (envelope) => {
      events.push(String(envelope.payload.code));
    });

    normalizeError(createAppError({ code: 'ERR-0500', message: 'API failed' }));
    normalizeError(createAppError({ code: 'ERR-0800', message: 'Validation' }));

    expect(events).toContain('ERR-0500');
    expect(events).not.toContain('ERR-0800');
  });

  it('clearErrorHistory empties registry', () => {
    bootThroughLogging();
    initializeErrorHandler();
    normalizeError(new Error('boom'));
    expect(getErrorHandler().getHistory().length).toBeGreaterThan(0);
    clearErrorHistory();
    expect(getErrorHandler().getHistory()).toHaveLength(0);
  });

  it('requires logging before initialization', () => {
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    expect(() => initializeErrorHandler()).toThrowError(/LOG_READY/i);
  });

  it('getErrorHandler throws before initialize', () => {
    expect(() => getErrorHandler()).toThrowError(/not initialized/i);
  });
});
