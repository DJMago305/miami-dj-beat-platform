import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  AUTH_STATE_MACHINE_STATES,
  assertAuthTransition,
  createAuthService,
  createMockAuthProvider,
  getAuthEntryStateForTests,
  isValidAuthTransition,
  resetAuthForTests,
  resetAuthHandoffCounterForTests,
  type SessionHandoffPort,
} from '../../shared/auth/runtime';

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

function bootEventDeps(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
}

describe('MOD-001 Authentication foundation — TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001', () => {
  beforeEach(() => {
    resetAuthForTests();
    resetAuthHandoffCounterForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('exposes the official 12-state auth machine', () => {
    expect(AUTH_STATE_MACHINE_STATES).toHaveLength(12);
    expect(getAuthEntryStateForTests()).toBe('UNKNOWN');
    expect(isValidAuthTransition('UNKNOWN', 'CHECKING_EXISTING_AUTH', 'BOOT_START')).toBe(true);
    expect(() => {
      assertAuthTransition('UNAUTHENTICATED', 'SESSION_HANDOFF_SUCCEEDED', 'SIGN_IN_REQUEST');
    }).toThrow();
  });

  it('initializes to UNAUTHENTICATED when mock restore is empty', async () => {
    bootEventDeps();
    const auth = createAuthService({ provider: createMockAuthProvider() });
    const result = await auth.initialize();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toBe('UNAUTHENTICATED');
    }
    expect(auth.getState()).toBe('UNAUTHENTICATED');
  });

  it('signs in with MockAuthProvider and reaches SESSION_HANDOFF_SUCCEEDED', async () => {
    bootEventDeps();
    const auth = createAuthService({ provider: createMockAuthProvider() });
    await auth.initialize();

    const result = await auth.signIn(
      { email: 'client@lab.test', password: 'lab-pass' },
      'client',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe('mock-user-client-1');
      expect(result.handoffId).toMatch(/^auth-handoff-mock-user-client-1-/);
    }
    expect(auth.getState()).toBe('SESSION_HANDOFF_SUCCEEDED');
    expect(auth.getSnapshot().identity?.email).toBe('client@lab.test');
  });

  it('rejects invalid credentials with ERR-AUTH-002', async () => {
    bootEventDeps();
    const auth = createAuthService({ provider: createMockAuthProvider() });
    await auth.initialize();

    const result = await auth.signIn({ email: 'fail@lab.test', password: 'x' }, 'client');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('ERR-AUTH-002');
    }
    expect(auth.getState()).toBe('UNAUTHENTICATED');
  });

  it('emits USER_LOGIN and USER_LOGOUT through Event Bus as MOD-001', async () => {
    bootEventDeps();
    const auth = createAuthService({ provider: createMockAuthProvider() });
    await auth.initialize();

    await auth.signIn({ email: 'artist@lab.test', password: 'lab-pass' }, 'artist');
    await auth.signOut({ reason: 'user' });

    const history = getEventBus().getHistory();
    const login = history.find((entry) => entry.name === 'USER_LOGIN');
    const logout = history.find((entry) => entry.name === 'USER_LOGOUT');

    expect(login?.emitter.moduleId).toBe('MOD-001');
    expect(login?.payload.userId).toBe('mock-user-artist-1');
    expect(login?.payload.handoffId).toMatch(/^auth-handoff-/);
    expect(login?.payload.accessTokenRef).toMatch(/^mock-/);
    expect(logout?.emitter.moduleId).toBe('MOD-001');
    expect(logout?.payload.reason).toBe('user');
  });

  it('uses SessionHandoffPort when injected without importing Session', async () => {
    bootEventDeps();

    const deliveries: string[] = [];
    const handoffPort: SessionHandoffPort = {
      deliver(input) {
        deliveries.push(input.handle.handoffId);
        return {
          ok: true,
          handoffId: input.handle.handoffId,
          userId: input.handle.userId,
        };
      },
    };

    const auth = createAuthService({
      provider: createMockAuthProvider(),
      sessionHandoffPort: handoffPort,
    });
    await auth.initialize();

    const result = await auth.signIn(
      { email: 'client@lab.test', password: 'lab-pass' },
      'client',
    );

    expect(result.ok).toBe(true);
    expect(deliveries).toHaveLength(1);
    expect(auth.getState()).toBe('SESSION_HANDOFF_SUCCEEDED');
  });

  it('maps handoff rejection to ERR-AUTH-009 and returns to UNAUTHENTICATED', async () => {
    bootEventDeps();

    const handoffPort: SessionHandoffPort = {
      deliver(input) {
        return {
          ok: false,
          handoffId: input.handle.handoffId,
          code: 'SESSION_ERROR_INVALID_HANDLE',
          message: 'Rejected by test port.',
        };
      },
    };

    const auth = createAuthService({
      provider: createMockAuthProvider(),
      sessionHandoffPort: handoffPort,
    });
    await auth.initialize();

    const result = await auth.signIn(
      { email: 'client@lab.test', password: 'lab-pass' },
      'client',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('ERR-AUTH-009');
    }
    expect(auth.getState()).toBe('UNAUTHENTICATED');
  });

  it('refreshes token refs while staying in SESSION_HANDOFF_SUCCEEDED', async () => {
    bootEventDeps();
    const auth = createAuthService({ provider: createMockAuthProvider() });
    await auth.initialize();
    await auth.signIn({ email: 'client@lab.test', password: 'lab-pass' }, 'client');

    const refresh = await auth.refresh();

    expect(refresh.ok).toBe(true);
    expect(auth.getState()).toBe('SESSION_HANDOFF_SUCCEEDED');
    expect(getEventBus().getHistory().filter((entry) => entry.name === 'USER_LOGIN').length).toBe(2);
  });

  it('restore failure maps to ERR-AUTH-004', async () => {
    bootEventDeps();
    const auth = createAuthService({
      provider: createMockAuthProvider({ failRestore: true }),
    });

    const result = await auth.initialize();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('ERR-AUTH-004');
    }
    expect(auth.getState()).toBe('UNAUTHENTICATED');
  });
});
