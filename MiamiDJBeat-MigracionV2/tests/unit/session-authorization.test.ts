import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  clearSession,
  destroySession,
  expireSession,
  getSessionAuthorizationHeader,
  getSessionAuthorizationState,
  getSessionSnapshot,
  getSessionStoreForTests,
  ingestAuthHandle,
  initializeSession,
  refreshSession,
  resetSessionForTests,
} from '@mdj/shared/session';
import { SessionProvider } from '../../shared/session/runtime/session-provider';
import { SessionStore, resetSessionStoreCounterForTests } from '../../shared/session/runtime/session-store';
import type { SessionRefreshPort } from '../../shared/session/runtime/types';

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

function bootSession(): void {
  resetConfigurationForTests();
  resetEventBusForTests();
  resetLoggingForTests();
  resetErrorHandlerForTests();
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
  initializeSession({ portal: 'client' });
}

function validHandle(userId: string, accessTokenRef: string, expiresAt?: string) {
  return {
    handoffId: `handoff-${userId}`,
    userId,
    accessTokenRef,
    refreshTokenRef: `refresh-${userId}`,
    expiresAt: expiresAt ?? new Date(Date.now() + 60_000).toISOString(),
    provider: 'mock' as const,
    issuedAt: new Date().toISOString(),
  };
}

describe('MOD-002 Session opaque authorization — TICKET-V2-PHASE-6-SESSION-OPAQUE-AUTHORIZATION-IMPLEMENTATION-001', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetSessionStoreCounterForTests();
  });

  it('returns null for anonymous session', () => {
    bootSession();
    expect(getSessionAuthorizationHeader()).toBeNull();
    expect(getSessionAuthorizationState().kind).toBe('none');
  });

  it('returns Bearer header after ingestAuthHandle', () => {
    bootSession();
    ingestAuthHandle(validHandle('user-a', 'opaque-token-a'));

    expect(getSessionAuthorizationHeader()).toBe('Bearer opaque-token-a');
    expect(getSessionSnapshot().user?.userId).toBe('user-a');
  });

  it('returns null when machine is EXPIRED even if user and slot remain', () => {
    bootSession();
    ingestAuthHandle(validHandle('user-a', 'opaque-token-a'));
    expect(getSessionAuthorizationHeader()).toBe('Bearer opaque-token-a');

    expireSession('test-expiry');

    expect(getSessionSnapshot().user?.userId).toBe('user-a');
    expect(getSessionStoreForTests().getAccessTokenRef()).toBe('opaque-token-a');
    expect(getSessionAuthorizationHeader()).toBeNull();
    expect(getSessionAuthorizationState()).toMatchObject({ kind: 'none', reason: 'expired' });
  });

  it('returns null when expiresAt is past before formal EXPIRED transition', () => {
    bootSession();
    ingestAuthHandle(validHandle('user-a', 'opaque-token-a'));
    getSessionStoreForTests().setExpiresAt(new Date(Date.now() - 1_000).toISOString());

    expect(getSessionStoreForTests().getMachineState()).toBe('AUTHENTICATED');
    expect(getSessionAuthorizationHeader()).toBeNull();
  });

  it('clears authorization on logout via clearSession', async () => {
    bootSession();
    ingestAuthHandle(validHandle('user-a', 'opaque-token-a'));
    expect(getSessionAuthorizationHeader()).toBe('Bearer opaque-token-a');

    clearSession('logout');

    expect(getSessionAuthorizationHeader()).toBeNull();
    expect(getSessionSnapshot().user).toBeNull();
  });

  it('replaces credential on relogin with different user', () => {
    bootSession();
    ingestAuthHandle(validHandle('user-a', 'token-a'));
    expect(getSessionAuthorizationHeader()).toBe('Bearer token-a');

    ingestAuthHandle(validHandle('user-b', 'token-b'));
    expect(getSessionAuthorizationHeader()).toBe('Bearer token-b');
    expect(getSessionStoreForTests().getBoundUserId()).toBe('user-b');
  });

  it('updates credential when refresh returns a new accessTokenRef', async () => {
    const store = new SessionStore();
    const refreshPort: SessionRefreshPort = {
      refresh: () =>
        Object.freeze({
          ok: true,
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
          accessTokenRef: 'token-after',
        }),
    };
    const provider = new SessionProvider(store, undefined, undefined, refreshPort);

    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    initializeErrorHandler();
    provider.initialize({ portal: 'client' });
    provider.ingestAuthHandle(validHandle('user-a', 'token-before'));

    const versionBefore = store.getCredentialVersion();
    await provider.refreshSession();

    expect(store.resolveAuthorizationHeader()).toBe('Bearer token-after');
    expect(store.getCredentialVersion()).toBeGreaterThan(versionBefore);
  });

  it('keeps credential and version when refresh omits accessTokenRef', async () => {
    const store = new SessionStore();
    const refreshPort: SessionRefreshPort = {
      refresh: () =>
        Object.freeze({
          ok: true,
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
        }),
    };
    const provider = new SessionProvider(store, undefined, undefined, refreshPort);

    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    initializeErrorHandler();
    provider.initialize({ portal: 'client' });
    provider.ingestAuthHandle(validHandle('user-a', 'token-stable'));

    const versionBefore = store.getCredentialVersion();
    await provider.refreshSession();

    expect(store.resolveAuthorizationHeader()).toBe('Bearer token-stable');
    expect(store.getCredentialVersion()).toBe(versionBefore);
  });

  it('clears authorization after destroySession', () => {
    bootSession();
    ingestAuthHandle(validHandle('user-a', 'opaque-token-a'));
    expect(getSessionAuthorizationHeader()).toBe('Bearer opaque-token-a');

    destroySession('teardown');

    expect(getSessionAuthorizationHeader()).toBeNull();
    expect(getSessionStoreForTests().getAccessTokenRef()).toBeNull();
  });
});

describe('MOD-002 Session opaque authorization machine states — TICKET-V2-PHASE-6-SESSION-OPAQUE-AUTHORIZATION-QA-COVERAGE-001', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetSessionStoreCounterForTests();
  });

  function seedAuthenticatedSlot(
    store: SessionStore,
    userId = 'user-a',
    accessTokenRef = 'opaque-token-a',
  ): void {
    store.setUser({ userId, email: `${userId}@lab.test` });
    store.setCredential(accessTokenRef, userId);
    store.setExpiresAt(new Date(Date.now() + 60_000).toISOString());
  }

  it('returns null when machine is INITIAL even if credential slot is populated', () => {
    const store = new SessionStore();
    store.beginSession('client');

    expect(store.getMachineState()).toBe('INITIAL');
    seedAuthenticatedSlot(store);

    expect(store.resolveAuthorizationHeader()).toBeNull();
  });

  it('returns null when machine is LOADING even if credential slot is populated', () => {
    const store = new SessionStore();
    store.beginSession('client');
    store.applyMachineTransition('INITIAL', 'SYSTEM_READY', 'LOADING');

    expect(store.getMachineState()).toBe('LOADING');
    seedAuthenticatedSlot(store);

    expect(store.resolveAuthorizationHeader()).toBeNull();
  });

  it('retains valid Authorization while machine is REFRESHING', () => {
    bootSession();
    ingestAuthHandle(validHandle('user-a', 'opaque-token-a'));
    expect(getSessionAuthorizationHeader()).toBe('Bearer opaque-token-a');

    const store = getSessionStoreForTests();
    store.applyMachineTransition('AUTHENTICATED', 'REFRESH_START', 'REFRESHING');
    store.setRefreshing(true);

    expect(store.getMachineState()).toBe('REFRESHING');
    expect(getSessionAuthorizationHeader()).toBe('Bearer opaque-token-a');
  });

  it('returns null when machine is LOGGING_OUT even if credential slot remains', () => {
    bootSession();
    ingestAuthHandle(validHandle('user-a', 'opaque-token-a'));
    expect(getSessionAuthorizationHeader()).toBe('Bearer opaque-token-a');

    const store = getSessionStoreForTests();
    store.applyMachineTransition('AUTHENTICATED', 'USER_LOGOUT', 'LOGGING_OUT');

    expect(store.getMachineState()).toBe('LOGGING_OUT');
    expect(getSessionStoreForTests().getAccessTokenRef()).toBe('opaque-token-a');
    expect(getSessionAuthorizationHeader()).toBeNull();
  });

  it('returns null when machine is ERROR even if credential slot remains', () => {
    bootSession();

    const store = getSessionStoreForTests();
    store.applyMachineTransition('ANONYMOUS', 'USER_LOGIN', 'LOADING');
    seedAuthenticatedSlot(store);
    store.applyMachineTransition('LOADING', 'VALIDATE_FAIL_FATAL', 'ERROR');

    expect(store.getMachineState()).toBe('ERROR');
    expect(getSessionStoreForTests().getAccessTokenRef()).toBe('opaque-token-a');
    expect(getSessionAuthorizationHeader()).toBeNull();
  });
});
