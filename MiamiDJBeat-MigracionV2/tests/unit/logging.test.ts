import { beforeEach, describe, expect, it } from 'vitest';
import {
  getConfig,
  initializeConfiguration,
  resetConfigurationForTests,
} from '@mdj/shared/config';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import {
  getLogger,
  getLoggingState,
  initializeLogging,
  resetLoggingForTests,
} from '@mdj/shared/logging';

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
  MDJ_V2_SESSION_STORAGE: 'session',
  MDJ_V2_REFRESH_BEFORE_MS: '300000',
};

function bootConfigAndBus(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
}

describe('MOD-010 Logging', () => {
  beforeEach(() => {
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('initializeLogging sets LOG_READY after config and bus', () => {
    bootConfigAndBus();
    const logger = initializeLogging({ source: 'boot', correlationId: 'corr-test-1' });

    expect(getLoggingState()).toBe('LOG_READY');
    expect(logger.getState()).toBe('LOG_READY');
    expect(Object.isFrozen(logger)).toBe(true);
  });

  it('records LogEntry with required fields in ring buffer', () => {
    bootConfigAndBus();
    const logger = initializeLogging({ source: 'boot', moduleId: 'MOD-010' });

    logger.info('test message', { orderId: 'ord-1' });
    const history = logger.getHistory();
    const entry = history.find((item) => item.message === 'test message');

    expect(entry).toBeDefined();
    expect(entry?.level).toBe('info');
    expect(entry?.moduleId).toBe('MOD-010');
    expect(entry?.source).toBe('boot');
    expect(entry?.env).toBe('local');
    expect(entry?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.isFrozen(entry)).toBe(true);
  });

  it('filters by configured min level except fatal always emits', () => {
    initializeConfiguration({ ...VALID_LOCAL_ENV, MDJ_V2_LOG_LEVEL: 'warn' });
    initializeEventBus();
    const logger = initializeLogging({ source: 'core' });

    logger.debug('hidden debug');
    logger.info('hidden info');
    logger.warn('visible warn');
    logger.fatal('always fatal');

    const messages = logger.getHistory().map((entry) => entry.message);
    expect(messages).toContain('visible warn');
    expect(messages).toContain('always fatal');
    expect(messages).not.toContain('hidden debug');
    expect(messages).not.toContain('hidden info');
  });

  it('redacts sensitive meta keys', () => {
    bootConfigAndBus();
    const logger = initializeLogging({ source: 'core' });

    logger.warn('secret test', { password: 'abc123', orderId: 'ord-1' });
    const entry = logger.getHistory().find((item) => item.message === 'secret test');

    expect(entry?.meta).toEqual({ password: '[REDACTED]', orderId: 'ord-1' });
  });

  it('getLogger throws before initializeLogging', () => {
    expect(() => getLogger()).toThrowError(/not initialized/i);
    expect(getLoggingState()).toBe('LOG_UNINITIALIZED');
  });

  it('initializeLogging requires BUS_READY', () => {
    initializeConfiguration(VALID_LOCAL_ENV);
    expect(() => initializeLogging()).toThrowError(/BUS_READY/i);
  });

  it('ring buffer enforces max history size', () => {
    bootConfigAndBus();
    const logger = initializeLogging({ source: 'test' });

    for (let index = 0; index < 210; index += 1) {
      logger.debug(`entry-${String(index)}`);
    }

    expect(logger.getHistory().length).toBeLessThanOrEqual(200);
  });

  it('exposes debug info warn error fatal methods', () => {
    bootConfigAndBus();
    const logger = initializeLogging({ source: 'core' });

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    logger.fatal('f');

    const levels = logger.getHistory().map((entry) => entry.level);
    expect(levels).toEqual(expect.arrayContaining(['debug', 'info', 'warn', 'error', 'fatal']));
  });

  it('reads env from frozen config', () => {
    bootConfigAndBus();
    initializeLogging({ source: 'boot' });
    expect(getConfig().env).toBe('local');
  });
});
