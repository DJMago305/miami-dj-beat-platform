import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  createAuthService,
  createMockAuthProvider,
  resetAuthForTests,
  resetAuthHandoffCounterForTests,
} from '../../shared/auth/runtime';
import {
  deliverAuthHandoff,
  getAuthSessionBoundaryForTests,
  getSessionSnapshot,
  initializeSession,
  resetSessionForTests,
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

function bootThroughSession(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
  initializeSession({ portal: 'client' });
}

describe('MOD-001 ↔ MOD-002 auth session handoff — TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001', () => {
  beforeEach(() => {
    resetAuthForTests();
    resetAuthHandoffCounterForTests();
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('sign-in event handoff hydrates Session via USER_LOGIN listener', async () => {
    bootThroughSession();
    const auth = createAuthService({ provider: createMockAuthProvider() });
    await auth.initialize();

    const before = getSessionSnapshot();
    expect(before.user).toBeNull();
    expect(before.state).toBe('SESSION_READY');

    const result = await auth.signIn(
      { email: 'client@lab.test', password: 'lab-pass' },
      'client',
    );

    expect(result.ok).toBe(true);
    const after = getSessionSnapshot();
    expect(after.user?.userId).toBe('mock-user-client-1');
    expect(after.state).toBe('SESSION_READY');
    expect(after.hydrationPhase).toBe('signed_in');
  });

  it('builds AuthHandle payloads compatible with AuthSessionBoundary', async () => {
    bootThroughSession();
    const boundary = getAuthSessionBoundaryForTests();
    const auth = createAuthService({ provider: createMockAuthProvider() });
    await auth.initialize();

    await auth.signIn({ email: 'artist@lab.test', password: 'lab-pass' }, 'artist');

    const loginEnvelope = getEventBus()
      .getHistory()
      .find((entry) => entry.name === 'USER_LOGIN');

    expect(loginEnvelope).toBeDefined();
    const handle = boundary.buildAuthHandleFromUserLogin({
      userId: String(loginEnvelope?.payload.userId),
      handoffId: String(loginEnvelope?.payload.handoffId),
      accessTokenRef: String(loginEnvelope?.payload.accessTokenRef),
      refreshTokenRef:
        typeof loginEnvelope?.payload.refreshTokenRef === 'string'
          ? loginEnvelope.payload.refreshTokenRef
          : undefined,
      expiresAt: String(loginEnvelope?.payload.expiresAt),
      issuedAt: String(loginEnvelope?.payload.issuedAt),
      provider: 'mock',
    });

    const validated = boundary.validateAuthHandoff({
      handle,
      identity: {
        userId: 'mock-user-artist-1',
        email: 'artist@lab.test',
        mdjbId: 'MDJB-0001-0001-A',
        authProvider: 'mock',
      },
    });

    expect(validated.userRef.userId).toBe('mock-user-artist-1');
    expect(Object.isFrozen(handle)).toBe(true);
  });

  it('rejects expired AuthHandle shape before Session ingest', () => {
    bootThroughSession();
    const boundary = getAuthSessionBoundaryForTests();
    const expired = boundary.createMockExpiredHandoff('expired-user');

    expect(() => deliverAuthHandoff(expired)).toThrow();
    expect(getSessionSnapshot().user).toBeNull();
  });

  it('requestLogout from AuthPort emits USER_LOGOUT without breaking Session baseline', async () => {
    bootThroughSession();
    const auth = createAuthService({ provider: createMockAuthProvider() });
    await auth.initialize();
    await auth.signIn({ email: 'client@lab.test', password: 'lab-pass' }, 'client');

    const logout = await auth.requestLogout('forced', 'mock-user-client-1');

    expect(logout.ok).toBe(true);
    expect(auth.getState()).toBe('UNAUTHENTICATED');
    expect(
      getEventBus()
        .getHistory()
        .some((entry) => entry.name === 'USER_LOGOUT' && entry.payload.reason === 'forced'),
    ).toBe(true);
  });
});
