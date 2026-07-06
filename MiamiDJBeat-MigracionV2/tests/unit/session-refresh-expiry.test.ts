import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { AuthSessionBoundary } from '../../shared/session/runtime/auth-session-boundary';
import {
  createMockRefreshPort,
  SessionProvider,
} from '../../shared/session/runtime/session-provider';
import { SessionStore, resetSessionStoreCounterForTests } from '../../shared/session/runtime/session-store';
import { resetSessionEventListenersForTests } from '../../shared/session/runtime/session-listeners';

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

function resetDeps(): void {
  resetSessionStoreCounterForTests();
  resetSessionEventListenersForTests();
  resetErrorHandlerForTests();
  resetLoggingForTests();
  resetEventBusForTests();
  resetConfigurationForTests();
}

describe('MOD-002 Session refresh / expiry — TICKET-MOD-002-SESSION-REFRESH-EXPIRY-001', () => {
  beforeEach(() => {
    resetDeps();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-06T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refresh success transitions REFRESHING → AUTHENTICATED and clears isRefreshing', async () => {
    bootThroughErrorHandler();
    const store = new SessionStore();
    const newExpiresAt = '2026-07-06T14:00:00.000Z';
    const provider = new SessionProvider(
      store,
      undefined,
      undefined,
      createMockRefreshPort({ newExpiresAt: () => newExpiresAt }),
    );

    const handoff = new AuthSessionBoundary().createMockAuthHandoff('refresh-user-1');
    provider.initialize({ portal: 'client' });
    provider.ingestAuthHandle(handoff.handle, handoff.identity);

    const refreshed = await provider.refreshSession({ reason: 'mock-refresh' });

    expect(store.getMachineState()).toBe('AUTHENTICATED');
    expect(refreshed.state).toBe('SESSION_READY');
    expect(refreshed.isRefreshing).toBe(false);
    expect(refreshed.expiresAt).toBe(newExpiresAt);
  });

  it('refresh fail transitions REFRESHING → EXPIRED and emits SESSION_EXPIRED', async () => {
    bootThroughErrorHandler();
    const store = new SessionStore();
    const provider = new SessionProvider(
      store,
      undefined,
      undefined,
      createMockRefreshPort({ fail: true, failReason: 'mock-token-revoked' }),
    );

    const handoff = new AuthSessionBoundary().createMockAuthHandoff('refresh-user-2');
    provider.initialize({ portal: 'client' });
    provider.ingestAuthHandle(handoff.handle, handoff.identity);

    const expiredEvents: string[] = [];
    getEventBus().subscribe('SESSION_EXPIRED', (envelope) => {
      expiredEvents.push(String(envelope.payload.reason));
    });

    const snapshot = await provider.refreshSession({ reason: 'refresh-failed' });

    expect(store.getMachineState()).toBe('EXPIRED');
    expect(provider.getLifecycleState()).toBe('SESSION_EXPIRED');
    expect(snapshot.state).toBe('SESSION_EXPIRED');
    expect(snapshot.isRefreshing).toBe(false);
    expect(expiredEvents).toContain('refresh-failed');
  });

  it('concurrent refresh calls reuse the same in-flight operation', async () => {
    bootThroughErrorHandler();
    const store = new SessionStore();
    let refreshCalls = 0;
    const provider = new SessionProvider(
      store,
      undefined,
      undefined,
      createMockRefreshPort({
        delayMs: 100,
        newExpiresAt: () => {
          refreshCalls += 1;
          return '2026-07-06T15:00:00.000Z';
        },
      }),
    );

    const handoff = new AuthSessionBoundary().createMockAuthHandoff('refresh-user-3');
    provider.initialize({ portal: 'client' });
    provider.ingestAuthHandle(handoff.handle, handoff.identity);

    const first = provider.refreshSession();
    const second = provider.refreshSession();
    expect(first).toBe(second);

    await vi.advanceTimersByTimeAsync(100);
    await first;

    expect(refreshCalls).toBe(1);
    expect(store.getMachineState()).toBe('AUTHENTICATED');
  });

  it('detectSessionExpiry reports expired when expiresAt is in the past', () => {
    bootThroughErrorHandler();
    const store = new SessionStore();
    const provider = new SessionProvider(store);

    const handoff = new AuthSessionBoundary().createMockAuthHandoff('expiry-user', {
      expiresAt: '2026-07-06T12:30:00.000Z',
    });
    provider.initialize({ portal: 'client' });
    provider.ingestAuthHandle(handoff.handle, handoff.identity);

    expect(provider.detectSessionExpiry().expired).toBe(false);

    vi.setSystemTime(new Date('2026-07-06T12:31:00.000Z'));
    const probe = provider.detectSessionExpiry();

    expect(probe.expired).toBe(true);
    expect(probe.sessionId).toMatch(/^ses_/);
  });

  it('handleSessionExpiry marks lifecycle SESSION_EXPIRED and emits SESSION_EXPIRED', () => {
    bootThroughErrorHandler();
    const store = new SessionStore();
    const provider = new SessionProvider(store);

    const handoff = new AuthSessionBoundary().createMockAuthHandoff('expiry-user-2');
    provider.initialize({ portal: 'client' });
    provider.ingestAuthHandle(handoff.handle, handoff.identity);

    const expiredEvents: string[] = [];
    getEventBus().subscribe('SESSION_EXPIRED', () => {
      expiredEvents.push('expired');
    });

    const snapshot = provider.handleSessionExpiry('policy-expiry');

    expect(store.getMachineState()).toBe('EXPIRED');
    expect(provider.getLifecycleState()).toBe('SESSION_EXPIRED');
    expect(snapshot.state).toBe('SESSION_EXPIRED');
    expect(expiredEvents).toHaveLength(1);
  });

  it('snapshot exposes isRefreshing=true while refresh is in flight', async () => {
    bootThroughErrorHandler();
    const store = new SessionStore();
    const provider = new SessionProvider(
      store,
      undefined,
      undefined,
      createMockRefreshPort({ delayMs: 50 }),
    );

    const handoff = new AuthSessionBoundary().createMockAuthHandoff('refresh-user-4');
    provider.initialize({ portal: 'client' });
    provider.ingestAuthHandle(handoff.handle, handoff.identity);

    const pending = provider.refreshSession();
    expect(provider.getPublicApi().getSnapshot().isRefreshing).toBe(true);
    expect(store.getMachineState()).toBe('REFRESHING');

    await vi.advanceTimersByTimeAsync(50);
    const done = await pending;

    expect(done.isRefreshing).toBe(false);
    expect(store.getMachineState()).toBe('AUTHENTICATED');
  });
});
