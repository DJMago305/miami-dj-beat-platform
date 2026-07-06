import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  createInMemoryPersistencePort,
  createNoopPersistencePort,
  PERSISTED_SESSION_RECORD_VERSION,
} from '../../shared/session/runtime/persistence-port';
import { SessionProvider } from '../../shared/session/runtime/session-provider';
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

describe('MOD-002 Session hydration — TICKET-MOD-002-SESSION-HYDRATION-RESTORE-001', () => {
  beforeEach(() => {
    resetDeps();
  });

  it('noop PersistencePort yields ANONYMOUS SESSION_READY with hydration trace', () => {
    bootThroughErrorHandler();
    const store = new SessionStore();
    const provider = new SessionProvider(store, createNoopPersistencePort());

    provider.initialize({ portal: 'client' });

    expect(store.getMachineState()).toBe('ANONYMOUS');
    expect(provider.getLifecycleState()).toBe('SESSION_READY');

    const snapshot = provider.getPublicApi().getSnapshot();
    expect(snapshot.user).toBeNull();
    expect(snapshot.hydrationPhase).toBe('initial');
    expect(Object.isFrozen(snapshot)).toBe(true);

    const trace = store.getHydrationTrace();
    expect(trace).not.toBeNull();
    expect(trace?.completedAt).not.toBeNull();
    expect(trace?.steps).toEqual([
      'boot_started',
      'restore_begin',
      'restore_empty',
      'validate_anonymous',
      'ready',
    ]);
  });

  it('in-memory restore with valid user reaches AUTHENTICATED with hydrationPhase initial', () => {
    bootThroughErrorHandler();
    const store = new SessionStore();
    const port = createInMemoryPersistencePort({
      recordVersion: PERSISTED_SESSION_RECORD_VERSION,
      userId: 'restored-user-1',
      email: 'restored@example.com',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const provider = new SessionProvider(store, port);

    provider.initialize({ portal: 'artist' });

    expect(store.getMachineState()).toBe('AUTHENTICATED');
    const snapshot = provider.getPublicApi().getSnapshot();
    expect(snapshot.user?.userId).toBe('restored-user-1');
    expect(snapshot.hydrationPhase).toBe('initial');
    expect(snapshot.state).toBe('SESSION_READY');

    expect(store.getHydrationTrace()?.steps).toEqual([
      'boot_started',
      'restore_begin',
      'restore_found',
      'validate_authenticated',
      'ready',
    ]);
  });

  it('expired persisted record falls back to ANONYMOUS with restore_expired trace', () => {
    bootThroughErrorHandler();
    const store = new SessionStore();
    const port = createInMemoryPersistencePort({
      recordVersion: PERSISTED_SESSION_RECORD_VERSION,
      userId: 'expired-user',
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });
    const provider = new SessionProvider(store, port);

    provider.initialize({ portal: 'staff' });

    expect(store.getMachineState()).toBe('ANONYMOUS');
    expect(provider.getPublicApi().getSnapshot().user).toBeNull();
    expect(store.getHydrationTrace()?.steps).toContain('restore_expired');
    expect(store.getHydrationTrace()?.steps).toContain('validate_anonymous');
  });

  it('invalid record version falls back to ANONYMOUS with restore_invalid trace', () => {
    bootThroughErrorHandler();
    const store = new SessionStore();
    const port = createInMemoryPersistencePort({
      recordVersion: 99,
      userId: 'bad-version-user',
    });
    const provider = new SessionProvider(store, port);

    provider.initialize({ portal: 'client' });

    expect(store.getMachineState()).toBe('ANONYMOUS');
    expect(store.getHydrationTrace()?.steps).toContain('restore_invalid');
  });

  it('restored snapshot is immutable and versioned', () => {
    bootThroughErrorHandler();
    const store = new SessionStore();
    const port = createInMemoryPersistencePort({
      recordVersion: PERSISTED_SESSION_RECORD_VERSION,
      userId: 'version-user',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const provider = new SessionProvider(store, port);

    provider.initialize({ portal: 'client' });
    const first = provider.getPublicApi().getSnapshot();
    const second = provider.getPublicApi().getSnapshot();

    expect(first).toBe(second);
    expect(first.snapshotVersion).toBeGreaterThan(0);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.roles)).toBe(true);
  });

  it('emits SESSION_CREATED and SESSION_READY during hydration boot', () => {
    bootThroughErrorHandler();
    const events: string[] = [];
    getEventBus().subscribe('SESSION_CREATED', (envelope) => {
      events.push(`created:${String(envelope.payload.hydrationPhase)}`);
    });
    getEventBus().subscribe('SESSION_READY', () => {
      events.push('ready');
    });

    const store = new SessionStore();
    const provider = new SessionProvider(store, createNoopPersistencePort());
    provider.initialize({ portal: 'client' });

    expect(events).toContain('created:initial');
    expect(events).toContain('ready');
  });
});
