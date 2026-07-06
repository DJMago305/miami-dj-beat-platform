import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { resetErrorHandlerForTests, initializeErrorHandler } from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  clearSession,
  destroySession,
  getSessionSnapshot,
  getSessionState,
  getSessionStoreForTests,
  ingestAuthHandle,
  initializeSession,
  resetSessionForTests,
  SessionError,
} from '@mdj/shared/session';

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

function bootThroughErrorHandler(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
}

function validHandle(overrides: Partial<Parameters<typeof ingestAuthHandle>[0]> = {}) {
  return {
    handoffId: 'handoff-1',
    userId: 'user-123',
    accessTokenRef: 'opaque-access-ref',
    refreshTokenRef: 'opaque-refresh-ref',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    provider: 'mock' as const,
    issuedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MOD-002 Session Manager', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('initializeSession reaches SESSION_READY with anonymous snapshot', () => {
    bootThroughErrorHandler();
    const session = initializeSession({ portal: 'client' });

    expect(getSessionState()).toBe('SESSION_READY');
    expect(session.getState()).toBe('SESSION_READY');

    const snapshot = getSessionSnapshot();
    expect(snapshot.portal).toBe('client');
    expect(snapshot.user).toBeNull();
    expect(snapshot.hydrationPhase).toBe('initial');
    expect(snapshot.sessionId).toMatch(/^ses_/);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('emits SESSION_CREATED and SESSION_READY on boot', () => {
    bootThroughErrorHandler();
    const events: string[] = [];
    getEventBus().subscribe('SESSION_CREATED', (envelope) => {
      events.push(`created:${String(envelope.payload.hydrationPhase)}`);
    });
    getEventBus().subscribe('SESSION_READY', () => {
      events.push('ready');
    });

    initializeSession({ portal: 'artist' });
    expect(events).toContain('created:initial');
    expect(events).toContain('ready');
  });

  it('ingestAuthHandle transitions to SIGNED_IN and SESSION_READY', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'client' });

    const snapshot = ingestAuthHandle(validHandle());
    expect(snapshot.state).toBe('SESSION_READY');
    expect(snapshot.user?.userId).toBe('user-123');
    expect(snapshot.hydrationPhase).toBe('signed_in');
  });

  it('rejects expired AuthHandle with SESSION_EXPIRED', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'client' });

    expect(() =>
      ingestAuthHandle(
        validHandle({ expiresAt: new Date(Date.now() - 1_000).toISOString() }),
      ),
    ).toThrow(SessionError);

    expect(getSessionState()).toBe('SESSION_EXPIRED');
  });

  it('clearSession emits SESSION_CLEARED and returns anonymous ready snapshot', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'staff' });
    ingestAuthHandle(validHandle());

    const cleared: string[] = [];
    getEventBus().subscribe('SESSION_CLEARED', () => {
      cleared.push('cleared');
    });

    const snapshot = clearSession('manual-clear');
    expect(cleared).toHaveLength(1);
    expect(snapshot.user).toBeNull();
    expect(getSessionState()).toBe('SESSION_READY');
  });

  it('destroySession resets to SESSION_UNINITIALIZED', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'client' });
    destroySession('teardown');
    expect(getSessionState()).toBe('SESSION_UNINITIALIZED');
    expect(() => getSessionSnapshot()).toThrow(SessionError);
  });

  it('requires error handler before initialization', () => {
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    expect(() => initializeSession({ portal: 'client' })).toThrowError(/ERR_READY/i);
  });

  it('tracks official machine state ANONYMOUS after boot via provider store', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'client' });

    const store = getSessionStoreForTests();
    expect(store.getMachineState()).toBe('ANONYMOUS');
  });
});
