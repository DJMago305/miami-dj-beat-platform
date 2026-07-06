import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { SessionProvider } from '../../shared/session/runtime/session-provider';
import { SessionStore, resetSessionStoreCounterForTests } from '../../shared/session/runtime/session-store';
import { SessionError } from '../../shared/session/runtime/errors';
import { areSessionEventListenersRegistered, resetSessionEventListenersForTests } from '../../shared/session/runtime/session-listeners';

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

function validHandle() {
  return {
    handoffId: 'handoff-1',
    userId: 'user-123',
    accessTokenRef: 'opaque-access-ref',
    refreshTokenRef: 'opaque-refresh-ref',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    provider: 'mock' as const,
    issuedAt: new Date().toISOString(),
  };
}

describe('MOD-002 SessionProvider — TICKET-MOD-002-SESSION-PROVIDER-STORE-001', () => {
  let store: SessionStore;
  let provider: SessionProvider;

  beforeEach(() => {
    resetSessionStoreCounterForTests();
    resetSessionEventListenersForTests();
    resetSessionForTestsDeps();
    store = new SessionStore();
    provider = new SessionProvider(store);
  });

  function resetSessionForTestsDeps(): void {
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  }

  it('boot anonymous path reaches ANONYMOUS machine state and SESSION_READY lifecycle', () => {
    bootThroughErrorHandler();
    provider.initialize({ portal: 'client' });

    expect(store.getMachineState()).toBe('ANONYMOUS');
    expect(provider.getLifecycleState()).toBe('SESSION_READY');

    const snapshot = provider.getPublicApi().getSnapshot();
    expect(snapshot.user).toBeNull();
    expect(snapshot.hydrationPhase).toBe('initial');
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('ingestAuthHandle drives LOADING → AUTHENTICATED machine path', () => {
    bootThroughErrorHandler();
    provider.initialize({ portal: 'artist' });

    const snapshot = provider.ingestAuthHandle(validHandle());

    expect(store.getMachineState()).toBe('AUTHENTICATED');
    expect(snapshot.state).toBe('SESSION_READY');
    expect(snapshot.user?.userId).toBe('user-123');
    expect(snapshot.hydrationPhase).toBe('signed_in');
  });

  it('clearSession returns anonymous ready snapshot after authenticated session', () => {
    bootThroughErrorHandler();
    provider.initialize({ portal: 'staff' });
    provider.ingestAuthHandle(validHandle());

    const cleared = provider.clearSession('manual');

    expect(cleared.user).toBeNull();
    expect(provider.getLifecycleState()).toBe('SESSION_READY');
    expect(store.getMachineState()).toBe('ANONYMOUS');
  });

  it('destroySession invalidates store and public api', () => {
    bootThroughErrorHandler();
    provider.initialize({ portal: 'client' });
    provider.destroySession('teardown');

    expect(store.getLifecycleState()).toBe('SESSION_UNINITIALIZED');
    expect(() => provider.getPublicApi()).toThrow(SessionError);
  });

  it('emits SESSION_CREATED and SESSION_READY during initialize', () => {
    bootThroughErrorHandler();
    const events: string[] = [];
    getEventBus().subscribe('SESSION_CREATED', (envelope) => {
      events.push(`created:${String(envelope.payload.hydrationPhase)}`);
    });
    getEventBus().subscribe('SESSION_READY', () => {
      events.push('ready');
    });

    provider.initialize({ portal: 'client' });

    expect(events).toContain('created:initial');
    expect(events).toContain('ready');
  });

  it('registers event listeners idempotently on initialize', () => {
    bootThroughErrorHandler();
    provider.initialize({ portal: 'client' });
    expect(areSessionEventListenersRegistered()).toBe(true);
    provider.initialize({ portal: 'client' });
    expect(areSessionEventListenersRegistered()).toBe(true);
  });

  it('handles USER_LOGIN bus event with mock payload', () => {
    bootThroughErrorHandler();
    provider.initialize({ portal: 'client' });

    getEventBus().publish({
      name: 'USER_LOGIN',
      payload: {
        userId: 'bus-user-1',
        handoffId: 'handoff-bus-1',
        accessTokenRef: 'token-bus',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        issuedAt: new Date().toISOString(),
        provider: 'mock',
      },
      emitter: { moduleId: 'MOD-001' },
      scope: 'public',
    });

    const snapshot = provider.getPublicApi().getSnapshot();
    expect(snapshot.user?.userId).toBe('bus-user-1');
    expect(snapshot.state).toBe('SESSION_READY');
  });

  it('SYSTEM_READY after boot does not duplicate SESSION_READY emissions', () => {
    bootThroughErrorHandler();
    let readyCount = 0;
    getEventBus().subscribe('SESSION_READY', () => {
      readyCount += 1;
    });

    provider.initialize({ portal: 'client' });
    const afterInit = readyCount;

    getEventBus().publish({
      name: 'SYSTEM_READY',
      payload: { busVersion: '1.0.0' },
      emitter: { moduleId: 'MOD-004', subsystem: 'test' },
      scope: 'internal',
    });

    expect(readyCount).toBe(afterInit);
  });
});
