import { beforeEach, describe, expect, it } from 'vitest';
import {
  BOOT_AUTH_HANDOFF_MODE,
  activateAuthForBoot,
  bootScaffold,
  getBootMockAuthProviderForTests,
  registerAuthForBoot,
  resetBootAuthWiringForTests,
} from '@mdj/bootstrap/boot';
import {
  getConfigState,
  initializeConfiguration,
  resetConfigurationForTests,
} from '@mdj/shared/config';
import {
  getErrorState,
  initializeErrorHandler,
  resetErrorHandlerForTests,
} from '@mdj/shared/errors';
import {
  getEventBus,
  getEventBusState,
  initializeEventBus,
  resetEventBusForTests,
} from '@mdj/shared/events';
import {
  getLoggingState,
  initializeLogging,
  resetLoggingForTests,
} from '@mdj/shared/logging';
import {
  emitSystemReady,
  getRuntimeState,
  initializeRuntime,
  resetRuntimeForTests,
} from '@mdj/shared/index';
import {
  getAuthService,
  resetAuthForTests,
  resetAuthHandoffCounterForTests,
} from '../../shared/auth/runtime';
import {
  getSessionSnapshot,
  getSessionState,
  initializeSession,
  resetSessionForTests,
} from '@mdj/shared/session';
import { resetThemeBootIntegrationForTests } from '@mdj/shared/theme';

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
} as const;

function resetBootWiringState(): void {
  resetBootAuthWiringForTests();
  resetAuthForTests();
  resetAuthHandoffCounterForTests();
  resetSessionForTests();
  resetRuntimeForTests();
  resetThemeBootIntegrationForTests();
  resetErrorHandlerForTests();
  resetLoggingForTests();
  resetEventBusForTests();
  resetConfigurationForTests();
}

function seedValidMockRestore(userId: string, email: string): void {
  const provider = getBootMockAuthProviderForTests();
  provider.seedActiveRecordForTests({
    userId,
    email,
    accessTokenRef: `mock-${userId}-access`,
    refreshTokenRef: `mock-${userId}-refresh`,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    issuedAt: new Date().toISOString(),
  });
}

function countEvent(name: string): number {
  return getEventBus()
    .getHistory()
    .filter((entry) => entry.name === name).length;
}

function lastEventIndex(name: string): number {
  const history = getEventBus().getHistory().map((entry) => entry.name);
  return history.lastIndexOf(name);
}

describe('MOD-001 auth bootstrap wiring — TICKET-V2-PHASE-5-MOD-001-AUTH-BOOTSTRAP-WIRING-001', () => {
  beforeEach(() => {
    resetBootWiringState();
  });

  it('registers Auth after Error Handler and before Session restore activation', () => {
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    initializeErrorHandler();

    expect(getErrorState()).toBe('ERR_READY');
    const registration = registerAuthForBoot();
    expect(registration.handoffMode).toBe(BOOT_AUTH_HANDOFF_MODE);
    expect(getAuthService().getState()).toBe('UNKNOWN');

    initializeSession({ portal: 'client' });
    expect(getSessionState()).toBe('SESSION_READY');
    expect(countEvent('USER_LOGIN')).toBe(0);

    const activation = activateAuthForBoot('client');
    expect(activation.ok).toBe(true);
    if (activation.ok) {
      expect(activation.state).toBe('UNAUTHENTICATED');
    }
  });

  it('boots as guest without session restore and emits SYSTEM_READY once', () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');

    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    expect(boot.authReady).toBe(true);
    expect(boot.authState).toBe('UNAUTHENTICATED');
    expect(getSessionSnapshot().user).toBeNull();
    expect(getSessionSnapshot().state).toBe('SESSION_READY');
    expect(countEvent('USER_LOGIN')).toBe(0);
    expect(countEvent('SYSTEM_READY')).toBe(1);
    expect(boot.runtimeReady).toBe(true);
    expect(boot.themeReady).toBe(true);
  });

  it('restores a valid mock session through a single USER_LOGIN handoff', () => {
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    initializeErrorHandler();
    registerAuthForBoot();
    initializeSession({ portal: 'client' });
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');

    const activation = activateAuthForBoot('client');
    expect(activation.ok).toBe(true);
    if (activation.ok) {
      expect(activation.state).toBe('SESSION_HANDOFF_SUCCEEDED');
      expect(activation.userId).toBe('mock-user-client-1');
    }

    expect(countEvent('USER_LOGIN')).toBe(1);
    expect(getSessionSnapshot().user?.userId).toBe('mock-user-client-1');
    expect(getSessionSnapshot().state).toBe('SESSION_READY');
    expect(getAuthService().getState()).toBe('SESSION_HANDOFF_SUCCEEDED');

    initializeRuntime({ portal: 'client' });
    emitSystemReady();

    expect(countEvent('SYSTEM_READY')).toBe(1);
    expect(lastEventIndex('SYSTEM_READY')).toBeGreaterThan(lastEventIndex('USER_LOGIN'));
  });

  it('completes full bootScaffold with valid restore and runtime/theme readiness', () => {
    registerAuthForBoot();
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');

    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');

    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    expect(boot.authState).toBe('SESSION_HANDOFF_SUCCEEDED');
    expect(getSessionSnapshot().user?.userId).toBe('mock-user-client-1');
    expect(countEvent('USER_LOGIN')).toBe(1);
    expect(countEvent('SYSTEM_READY')).toBe(1);
    expect(lastEventIndex('SYSTEM_READY')).toBeGreaterThan(lastEventIndex('USER_LOGIN'));
    expect(boot.runtimeReady).toBe(true);
    expect(boot.themeReady).toBe(true);
  });

  it('uses event-bus-only handoff without SessionHandoffPort injection', () => {
    const registration = registerAuthForBoot();
    expect(registration.handoffMode).toBe('event-bus-only');
  });

  it('does not double publish USER_LOGIN or double ingest session identity', () => {
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    initializeErrorHandler();
    registerAuthForBoot();
    initializeSession({ portal: 'artist' });
    seedValidMockRestore('mock-user-artist-1', 'artist@lab.test');

    activateAuthForBoot('artist');

    expect(countEvent('USER_LOGIN')).toBe(1);
    expect(getSessionSnapshot().user?.userId).toBe('mock-user-artist-1');
  });

  it.each(['client', 'artist', 'staff'] as const)(
    'preserves boot portal %s in auth snapshot after restore',
    (portal) => {
      initializeConfiguration(VALID_LOCAL_ENV);
      initializeEventBus();
      initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
      initializeErrorHandler();
      registerAuthForBoot();
      initializeSession({ portal });
      seedValidMockRestore('mock-user-client-1', 'client@lab.test');

      activateAuthForBoot(portal);

      expect(getAuthService().getSnapshot().portal).toBe(portal);
    },
  );

  it('degrades recoverable restore failure to guest boot', () => {
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    initializeErrorHandler();
    registerAuthForBoot({ failRestore: true });
    initializeSession({ portal: 'client' });

    const activation = activateAuthForBoot('client');
    expect(activation.ok).toBe(false);
    if (activation.ok) {
      return;
    }

    expect(activation.recoverable).toBe(true);
    expect(getAuthService().getState()).toBe('UNAUTHENTICATED');
    expect(getSessionSnapshot().user).toBeNull();
    expect(countEvent('USER_LOGIN')).toBe(0);

    initializeRuntime({ portal: 'client' });
    emitSystemReady();
    expect(getRuntimeState().lifecycle).toBe('RUNTIME_READY');
    expect(countEvent('SYSTEM_READY')).toBe(1);
  });

  it('does not activate identity when restore finds an expired token', () => {
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    initializeErrorHandler();
    registerAuthForBoot();
    initializeSession({ portal: 'client' });

    getBootMockAuthProviderForTests().seedActiveRecordForTests({
      userId: 'mock-user-expired',
      email: 'client@lab.test',
      accessTokenRef: 'mock-user-expired-access',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      issuedAt: new Date(Date.now() - 120_000).toISOString(),
    });

    const activation = activateAuthForBoot('client');

    expect(activation.ok).toBe(false);
    if (activation.ok) {
      return;
    }

    expect(activation.code).toBe('ERR-AUTH-007');
    expect(activation.recoverable).toBe(true);
    expect(getAuthService().getState()).toBe('UNAUTHENTICATED');
    expect(getSessionSnapshot().user).toBeNull();
    expect(countEvent('USER_LOGIN')).toBe(0);
  });

  it('keeps infrastructure ready states after guest boot wiring', () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'staff');

    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    expect(getConfigState()).toBe('FROZEN');
    expect(getEventBusState()).toBe('BUS_READY');
    expect(getLoggingState()).toBe('LOG_READY');
    expect(getErrorState()).toBe('ERR_READY');
    expect(getSessionState()).toBe('SESSION_READY');
    expect(boot.runtimeReady).toBe(true);
    expect(boot.themeReady).toBe(true);
    expect(countEvent('SYSTEM_READY')).toBe(1);
  });
});
