import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activateAuthForBoot,
  bootScaffold,
  getBootMemoryTransportForTests,
  getBootMockAuthProviderForTests,
  initializeApiForBoot,
  registerAuthForBoot,
  resetBootApiWiringForTests,
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
  getApiClient,
  getApiClientState,
  resetApiClientForTests,
} from '../../shared/api/runtime';
import * as apiClientModule from '../../shared/api/runtime/api-client';
import {
  getSessionAuthorizationHeader,
  getSessionSnapshot,
  getSessionState,
  ingestAuthHandle,
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

const API_RUNTIME_FILES = [
  'shared/api/runtime/api-service.ts',
  'shared/api/runtime/api-client.ts',
  'shared/api/runtime/session-reader-port.ts',
  'shared/api/runtime/memory-transport.ts',
] as const;

const BOOT_API_WIRING_FILE = 'bootstrap/initialize-api.ts';

function resetBootWiringState(): void {
  resetBootApiWiringForTests();
  resetApiClientForTests();
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

function bootThroughAuthActivate(portal: 'client' | 'artist' | 'staff'): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
  registerAuthForBoot();
  initializeSession({ portal });
  activateAuthForBoot(portal);
}

describe('MOD-005 API bootstrap wiring — TICKET-V2-PHASE-6-MOD-005-API-BOOTSTRAP-WIRING-001', () => {
  beforeEach(() => {
    resetBootWiringState();
  });

  it('initializes API Client after Auth activate', () => {
    bootThroughAuthActivate('client');

    expect(getApiClientState()).toBe('API_UNINITIALIZED');
    expect(() => getApiClient()).toThrow(/not initialized/i);

    const apiBoot = initializeApiForBoot('client');
    expect(apiBoot.ok).toBe(true);
    if (apiBoot.ok) {
      expect(apiBoot.state).toBe('API_READY');
    }
    expect(getApiClientState()).toBe('API_READY');
  });

  it('initializes API Client before Runtime', () => {
    bootThroughAuthActivate('client');

    const apiBoot = initializeApiForBoot('client');
    expect(apiBoot.ok).toBe(true);
    expect(getApiClientState()).toBe('API_READY');

    initializeRuntime({ portal: 'client' });
    expect(getRuntimeState().lifecycle).toBe('RUNTIME_READY');
  });

  it('boots guest with API_READY, no Authorization, successful boot, and single SYSTEM_READY', async () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');

    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    expect(getApiClientState()).toBe('API_READY');
    expect(getSessionSnapshot().user).toBeNull();

    const transport = getBootMemoryTransportForTests();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    await getApiClient().get('/lab/guest');

    expect(transport.calls[0]?.headers.Authorization).toBeUndefined();
    expect(countEvent('SYSTEM_READY')).toBe(1);
    expect(boot.runtimeReady).toBe(true);
    expect(boot.themeReady).toBe(true);
  });

  it('boots signed-in with API_READY and Authorization from SessionReaderPort', async () => {
    registerAuthForBoot();
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');

    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');

    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    expect(getApiClientState()).toBe('API_READY');
    expect(getSessionSnapshot().user?.userId).toBe('mock-user-client-1');

    const transport = getBootMemoryTransportForTests();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    await getApiClient().get('/lab/signed-in');

    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer mock-mock-user-client-1-access');
    expect(countEvent('SYSTEM_READY')).toBe(1);
  });

  it('does not import Auth directly inside API runtime modules', () => {
    const root = resolve(__dirname, '../..');

    for (const relativePath of API_RUNTIME_FILES) {
      const source = readFileSync(resolve(root, relativePath), 'utf8');
      expect(source).not.toMatch(/shared\/auth\/runtime/);
      expect(source).not.toMatch(/getAuthService/);
    }
  });

  it('resolves Authorization from Session slot without Event Bus history lookup', () => {
    const root = resolve(__dirname, '../..');
    const source = readFileSync(resolve(root, BOOT_API_WIRING_FILE), 'utf8');

    expect(source).toMatch(/getSessionAuthorizationHeader/);
    expect(source).not.toMatch(/getEventBus\(\)\.getHistory/);
    expect(source).not.toMatch(/parseUserLoginPayload/);
  });

  it('omits Authorization after logout even when USER_LOGIN remains in bus history', async () => {
    registerAuthForBoot();
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');

    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');
    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    expect(getSessionAuthorizationHeader()).toBe('Bearer mock-mock-user-client-1-access');
    expect(countEvent('USER_LOGIN')).toBeGreaterThan(0);

    const transport = getBootMemoryTransportForTests();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    await getApiClient().get('/lab/signed-in');
    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer mock-mock-user-client-1-access');

    await getAuthService().signOut();

    expect(getSessionAuthorizationHeader()).toBeNull();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    await getApiClient().get('/lab/post-logout');
    expect(transport.calls[1]?.headers.Authorization).toBeUndefined();
  });

  it('uses updated Authorization after relogin with a different user', async () => {
    registerAuthForBoot();
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');
    bootScaffold(VALID_LOCAL_ENV, 'client');

    expect(getSessionAuthorizationHeader()).toBe('Bearer mock-mock-user-client-1-access');

    await getAuthService().signOut();
    expect(getSessionAuthorizationHeader()).toBeNull();

    ingestAuthHandle({
      handoffId: 'handoff-client-2',
      userId: 'mock-user-client-2',
      accessTokenRef: 'mock-mock-user-client-2-access',
      refreshTokenRef: 'mock-mock-user-client-2-refresh',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      provider: 'mock',
      issuedAt: new Date().toISOString(),
    });

    expect(getSessionSnapshot().user?.userId).toBe('mock-user-client-2');
    expect(getSessionAuthorizationHeader()).toBe('Bearer mock-mock-user-client-2-access');
  });

  it('returns the same frozen singleton from getApiClient()', () => {
    bootThroughAuthActivate('client');
    initializeApiForBoot('client');

    const first = getApiClient();
    const second = getApiClient();

    expect(first).toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('throws when getApiClient() is called before initializeApiClient()', () => {
    expect(getApiClientState()).toBe('API_UNINITIALIZED');
    expect(() => getApiClient()).toThrow(/not initialized/i);
  });

  it('clears singleton state with resetApiClientForTests()', () => {
    bootThroughAuthActivate('client');
    initializeApiForBoot('client');
    expect(getApiClientState()).toBe('API_READY');

    resetApiClientForTests();
    resetBootApiWiringForTests();

    expect(getApiClientState()).toBe('API_UNINITIALIZED');
    expect(() => getApiClient()).toThrow(/not initialized/i);
  });

  it.each(['client', 'artist', 'staff'] as const)('preserves successful boot for portal %s', (portal) => {
    const boot = bootScaffold(VALID_LOCAL_ENV, portal);

    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    expect(getApiClientState()).toBe('API_READY');
    expect(boot.runtimeReady).toBe(true);
    expect(boot.themeReady).toBe(true);
    expect(countEvent('SYSTEM_READY')).toBe(1);
  });

  it('keeps Runtime ready after full boot', () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');

    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    expect(getRuntimeState().lifecycle).toBe('RUNTIME_READY');
    expect(boot.runtimeReady).toBe(true);
  });

  it('keeps Theme ready after full boot', () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');

    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    expect(boot.themeReady).toBe(true);
    expect(boot.phase).toBe('theme');
  });

  it('emits SYSTEM_READY only after API initialization during manual boot chain', () => {
    bootThroughAuthActivate('client');

    expect(getApiClientState()).toBe('API_UNINITIALIZED');
    expect(countEvent('SYSTEM_READY')).toBe(0);

    initializeApiForBoot('client');
    expect(getApiClientState()).toBe('API_READY');
    expect(countEvent('SYSTEM_READY')).toBe(0);

    initializeRuntime({ portal: 'client' });
    emitSystemReady();

    expect(countEvent('SYSTEM_READY')).toBe(1);
    expect(getApiClientState()).toBe('API_READY');
  });

  it('uses MemoryTransport without real network calls', async () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');
    expect(boot.ok).toBe(true);

    const transport = getBootMemoryTransportForTests();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await getApiClient().get('/lab/no-network');

    expect(transport.calls).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('does not mutate Session snapshot during API boot initialization', () => {
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    initializeErrorHandler();
    registerAuthForBoot();
    initializeSession({ portal: 'client' });
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');
    activateAuthForBoot('client');

    const before = JSON.stringify(getSessionSnapshot());
    initializeApiForBoot('client');
    const after = JSON.stringify(getSessionSnapshot());

    expect(after).toBe(before);
    expect(getSessionState()).toBe('SESSION_READY');
  });

  it('does not mutate Auth state during API boot initialization', () => {
    registerAuthForBoot();
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    initializeErrorHandler();
    initializeSession({ portal: 'client' });
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');
    activateAuthForBoot('client');

    const authStateBefore = getAuthService().getState();
    const authSnapshotBefore = JSON.stringify(getAuthService().getSnapshot());

    initializeApiForBoot('client');

    expect(getAuthService().getState()).toBe(authStateBefore);
    expect(JSON.stringify(getAuthService().getSnapshot())).toBe(authSnapshotBefore);
  });

  it('blocks SYSTEM_READY when api-client boot phase fails', () => {
    vi.spyOn(apiClientModule, 'createApiClient').mockImplementationOnce(() => {
      throw new Error('MemoryTransport init failed');
    });

    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');

    expect(boot.ok).toBe(false);
    if (boot.ok) {
      return;
    }

    expect(boot.phase).toBe('api-client');
    expect(boot.runtimeReady).toBe(false);
    expect(boot.systemReadyConfirmed).toBe(false);
    expect(countEvent('SYSTEM_READY')).toBe(0);
    expect(getApiClientState()).toBe('API_ERROR');

    vi.restoreAllMocks();
  });

  it('preserves infrastructure readiness flags after guest boot', () => {
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
    expect(getApiClientState()).toBe('API_READY');
  });
});

describe('MOD-005 API logout cancellation wiring — TICKET-V2-PHASE-6-RUNTIME-LOGOUT-CANCELLATION-IMPLEMENTATION-001', () => {
  beforeEach(() => {
    resetBootWiringState();
  });

  it('wires USER_LOGOUT and SESSION_DESTROYED to cancelAll in bootstrap source', () => {
    const root = resolve(__dirname, '../..');
    const source = readFileSync(resolve(root, BOOT_API_WIRING_FILE), 'utf8');

    expect(source).toMatch(/USER_LOGOUT/);
    expect(source).toMatch(/SESSION_DESTROYED/);
    expect(source).toMatch(/cancelAll/);
    expect(source).not.toMatch(/shared\/session\/runtime/);
    expect(source).not.toMatch(/shared\/auth\/runtime/);
  });

  it('invokes cancelAll when USER_LOGOUT is published', async () => {
    bootScaffold(VALID_LOCAL_ENV, 'client');

    const transport = getBootMemoryTransportForTests();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true }, delayMs: 200 });

    const pending = getApiClient().get('/lab/user-logout-event');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const publishResult = getEventBus().publish({
      name: 'USER_LOGOUT',
      payload: { reason: 'test' },
      emitter: { moduleId: 'MOD-001', subsystem: 'test' },
      scope: 'public',
    });
    expect(publishResult.ok).toBe(true);

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_CANCELLED');
    }
  });

  it('invokes cancelAll when SESSION_DESTROYED is published', async () => {
    bootScaffold(VALID_LOCAL_ENV, 'client');

    const transport = getBootMemoryTransportForTests();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true }, delayMs: 200 });

    const pending = getApiClient().get('/lab/session-destroyed-event');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const publishResult = getEventBus().publish({
      name: 'SESSION_DESTROYED',
      payload: { reason: 'test' },
      emitter: { moduleId: 'MOD-002', subsystem: 'test' },
      scope: 'internal',
    });
    expect(publishResult.ok).toBe(true);

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_CANCELLED');
    }
  });

  it('aborts an in-flight request when logout happens during the request', async () => {
    registerAuthForBoot();
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');
    bootScaffold(VALID_LOCAL_ENV, 'client');

    const transport = getBootMemoryTransportForTests();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true }, delayMs: 200 });

    const pending = getApiClient().get('/lab/in-flight-logout');
    await new Promise((resolve) => setTimeout(resolve, 0));

    await getAuthService().signOut();

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_CANCELLED');
    }
  });

  it('cancels multiple in-flight requests on logout', async () => {
    registerAuthForBoot();
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');
    bootScaffold(VALID_LOCAL_ENV, 'client');

    const transport = getBootMemoryTransportForTests();
    transport.enqueue({ kind: 'response', status: 200, body: { n: 1 }, delayMs: 200 });
    transport.enqueue({ kind: 'response', status: 200, body: { n: 2 }, delayMs: 200 });

    const first = getApiClient().get('/lab/concurrent-a');
    const second = getApiClient().get('/lab/concurrent-b');
    await new Promise((resolve) => setTimeout(resolve, 0));

    await getAuthService().signOut();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.ok).toBe(false);
    expect(secondResult.ok).toBe(false);
    if (!firstResult.ok && !secondResult.ok) {
      expect(firstResult.error.code).toBe('API_CANCELLED');
      expect(secondResult.error.code).toBe('API_CANCELLED');
    }
  });

  it('does not leave prior-user requests alive after relogin', async () => {
    registerAuthForBoot();
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');
    bootScaffold(VALID_LOCAL_ENV, 'client');

    const transport = getBootMemoryTransportForTests();
    transport.enqueue({ kind: 'response', status: 200, body: { user: 1 }, delayMs: 200 });

    const priorUserRequest = getApiClient().get('/lab/prior-user');
    await new Promise((resolve) => setTimeout(resolve, 0));

    await getAuthService().signOut();

    ingestAuthHandle({
      handoffId: 'handoff-client-2',
      userId: 'mock-user-client-2',
      accessTokenRef: 'mock-mock-user-client-2-access',
      refreshTokenRef: 'mock-mock-user-client-2-refresh',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      provider: 'mock',
      issuedAt: new Date().toISOString(),
    });

    transport.enqueue({ kind: 'response', status: 200, body: { user: 2 } });
    const nextUserResult = await getApiClient().get('/lab/next-user');
    const priorUserResult = await priorUserRequest;

    expect(priorUserResult.ok).toBe(false);
    if (!priorUserResult.ok) {
      expect(priorUserResult.error.code).toBe('API_CANCELLED');
    }
    expect(nextUserResult.ok).toBe(true);
  });

  it('allows repeated cancelAll without throwing', async () => {
    registerAuthForBoot();
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');
    bootScaffold(VALID_LOCAL_ENV, 'client');

    const client = getApiClient();
    expect(() => client.cancelAll()).not.toThrow();
    expect(() => client.cancelAll()).not.toThrow();
    await expect(getAuthService().signOut()).resolves.toMatchObject({ ok: true });
  });
});
