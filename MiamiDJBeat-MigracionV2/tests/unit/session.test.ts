import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { resetErrorHandlerForTests, initializeErrorHandler } from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  asSessionSnapshotWithPermissions,
  awaitSessionAuthOutcome,
  clearSession,
  deliverAuthHandoff,
  destroySession,
  detectSessionExpiry,
  getAuthSessionBoundaryForTests,
  getSessionSnapshot,
  getSessionState,
  getSessionStoreForTests,
  handleSessionExpiry,
  ingestAuthHandle,
  initializeSession,
  refreshSession,
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
    expect(asSessionSnapshotWithPermissions(snapshot).permissions.documentedRole).toBe('guest');
    expect(getSessionStoreForTests().getHydrationTrace()?.steps).toContain('restore_empty');
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

  it('ingestAuthHandle transitions to SIGNED_IN and SESSION_READY', async () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'client' });

    const handoff = getAuthSessionBoundaryForTests().createMockAuthHandoff('user-123');
    const snapshot = await awaitSessionAuthOutcome(deliverAuthHandoff(handoff));
    expect(snapshot.state).toBe('SESSION_READY');
    expect(snapshot.user?.userId).toBe('user-123');
    expect(snapshot.hydrationPhase).toBe('signed_in');
  });

  it('deliverAuthHandoff moves ANONYMOUS machine state to AUTHENTICATED', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'client' });

    expect(getSessionStoreForTests().getMachineState()).toBe('ANONYMOUS');

    const handoff = getAuthSessionBoundaryForTests().createMockAuthHandoff('handoff-user-1');
    deliverAuthHandoff(handoff);

    expect(getSessionStoreForTests().getMachineState()).toBe('AUTHENTICATED');
    expect(getSessionState()).toBe('SESSION_READY');
  });

  it('logout via clearSession returns ANONYMOUS after authenticated handoff', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'staff' });
    deliverAuthHandoff(getAuthSessionBoundaryForTests().createMockAuthHandoff('logout-user'));

    const snapshot = clearSession('auth-logout');
    expect(snapshot.user).toBeNull();
    expect(getSessionState()).toBe('SESSION_READY');
    expect(getSessionStoreForTests().getMachineState()).toBe('ANONYMOUS');
  });

  it('rejects expired AuthHandle with SESSION_EXPIRED', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'client' });

    const expired = getAuthSessionBoundaryForTests().createMockExpiredHandoff('expired-user');

    expect(() => deliverAuthHandoff(expired)).toThrow(SessionError);

    expect(getSessionState()).toBe('SESSION_EXPIRED');
  });

  it('clearSession emits SESSION_DESTROYED and returns anonymous ready snapshot', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'staff' });
    ingestAuthHandle(validHandle());

    const destroyed: string[] = [];
    getEventBus().subscribe('SESSION_DESTROYED', () => {
      destroyed.push('destroyed');
    });

    const snapshot = clearSession('manual-clear');
    expect(destroyed.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.user).toBeNull();
    expect(getSessionState()).toBe('SESSION_READY');
  });

  it('destroySession emits SESSION_DESTROYED and resets to SESSION_UNINITIALIZED', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'client' });

    const destroyed: string[] = [];
    getEventBus().subscribe('SESSION_DESTROYED', () => {
      destroyed.push('destroyed');
    });

    destroySession('teardown');
    expect(destroyed).toHaveLength(1);
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

  it('refreshSession via service returns AUTHENTICATED SESSION_READY snapshot', async () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'client' });
    deliverAuthHandoff(getAuthSessionBoundaryForTests().createMockAuthHandoff('service-refresh-user'));

    const snapshot = await refreshSession({ reason: 'service-refresh' });

    expect(snapshot.state).toBe('SESSION_READY');
    expect(getSessionStoreForTests().getMachineState()).toBe('AUTHENTICATED');
    expect(snapshot.isRefreshing).toBe(false);
  });

  it('handleSessionExpiry via service emits SESSION_EXPIRED lifecycle', () => {
    bootThroughErrorHandler();
    initializeSession({ portal: 'client' });
    deliverAuthHandoff(getAuthSessionBoundaryForTests().createMockAuthHandoff('service-expiry-user'));

    const snapshot = handleSessionExpiry('timer-expiry');
    expect(snapshot.state).toBe('SESSION_EXPIRED');
    expect(getSessionState()).toBe('SESSION_EXPIRED');
    expect(detectSessionExpiry().expired).toBe(false);
  });
});
