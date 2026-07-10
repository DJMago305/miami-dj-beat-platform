import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { PERSISTED_SESSION_RECORD_VERSION } from '../../shared/session/runtime/persistence-port';
import { SessionError } from '../../shared/session/runtime/errors';
import { SessionProvider, createMockRefreshPort } from '../../shared/session/runtime/session-provider';
import { resetSessionEventListenersForTests } from '../../shared/session/runtime/session-listeners';
import {
  createLocalStorageAdapter,
  createMemoryStorageAdapter,
  createSessionStorageAdapter,
  SESSION_STORAGE_KEY,
} from '../../shared/session/runtime/session-storage';
import { SessionStore, resetSessionStoreCounterForTests } from '../../shared/session/runtime/session-store';
import { assertTransition } from '../../shared/session/runtime/state-machine';
import {
  createSession,
  deliverAuthHandoff,
  destroySession,
  expireSession,
  getAuthSessionBoundaryForTests,
  getSessionRegistry,
  hydrateSession,
  initializeSession,
  refreshSession,
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

function bootThroughErrorHandler(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
}

function ensureBrowserStorage(): void {
  for (const kind of ['localStorage', 'sessionStorage'] as const) {
    try {
      if (typeof globalThis[kind]?.getItem === 'function') {
        continue;
      }
    } catch {
      // fall through to shim
    }

    const store = new Map<string, string>();
    Object.defineProperty(globalThis, kind, {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
        key: () => null,
        get length() {
          return store.size;
        },
      },
      configurable: true,
    });
  }
}

function clearBrowserSessionStorage(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore — non-browser environments
  }
}

function resetDeps(): void {
  resetSessionForTests();
  resetErrorHandlerForTests();
  resetLoggingForTests();
  resetEventBusForTests();
  resetConfigurationForTests();
  resetSessionStoreCounterForTests();
  resetSessionEventListenersForTests();
  clearBrowserSessionStorage();
}

describe('MOD-002 Phase 3 corrections — TICKET-V2-PHASE-3-MOD-002-CORRECTION-001', () => {
  beforeEach(() => {
    ensureBrowserStorage();
    resetDeps();
  });

  describe('CORRECCIÓN 1 — Session Registry expiresAt', () => {
    it('authenticated session registry carries expiresAt from snapshot', () => {
      bootThroughErrorHandler();
      initializeSession({ portal: 'client' });
      const handoff = getAuthSessionBoundaryForTests().createMockAuthHandoff('registry-auth-user');
      deliverAuthHandoff(handoff);

      const active = getSessionRegistry().getActive();
      expect(active?.expiresAt).toBe(handoff.handle.expiresAt);
      expect(active?.machineState).toBe('AUTHENTICATED');
    });

    it('refresh updates registry expiresAt', async () => {
      bootThroughErrorHandler();
      const store = new SessionStore();
      const newExpiresAt = new Date(Date.now() + 7_200_000).toISOString();
      const provider = new SessionProvider(
        store,
        undefined,
        undefined,
        createMockRefreshPort({ newExpiresAt: () => newExpiresAt }),
      );

      provider.createSession({ portal: 'client' });
      provider.hydrateSession();
      provider.ingestAuthHandle(
        getAuthSessionBoundaryForTests().createMockAuthHandoff('registry-refresh-user').handle,
      );

      await provider.refreshSession();

      const active = getSessionRegistry().getActive();
      expect(active?.expiresAt).toBe(newExpiresAt);
    });

    it('anonymous session registry has null expiresAt', () => {
      bootThroughErrorHandler();
      initializeSession({ portal: 'staff' });

      const active = getSessionRegistry().getActive();
      expect(active?.expiresAt).toBeNull();
      expect(active?.portal).toBe('staff');
    });

    it('destroy removes registry entry', () => {
      bootThroughErrorHandler();
      initializeSession({ portal: 'artist' });
      const sessionId = getSessionRegistry().getActive()?.sessionId;
      expect(sessionId).toBeTruthy();

      destroySession('registry-destroy');
      expect(getSessionRegistry().getActive()).toBeNull();
      if (sessionId) {
        expect(getSessionRegistry().get(sessionId)).toBeNull();
      }
    });

    it('registry entry snapshot is immutable', () => {
      bootThroughErrorHandler();
      initializeSession({ portal: 'client' });
      const entry = getSessionRegistry().getActive();
      expect(entry).not.toBeNull();
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry?.capabilities)).toBe(true);

      expect(() => {
        (entry as { portal: string }).portal = 'artist';
      }).toThrow();
    });
  });

  describe('CORRECCIÓN 2 — runtime ERROR path', () => {
    it('recoverable invalid record version falls back to ANONYMOUS without SESSION_ERROR', () => {
      bootThroughErrorHandler();
      const events: string[] = [];
      getEventBus().subscribe('SESSION_ERROR', () => events.push('SESSION_ERROR'));
      getEventBus().subscribe('SESSION_READY', () => events.push('SESSION_READY'));

      const store = new SessionStore();
      const provider = new SessionProvider(
        store,
        createMemoryStorageAdapter({ recordVersion: 99, userId: 'bad-version-user' }),
      );
      provider.createSession({ portal: 'client' });
      const snapshot = provider.hydrateSession();

      expect(store.getMachineState()).toBe('ANONYMOUS');
      expect(snapshot.state).toBe('SESSION_READY');
      expect(events).toContain('SESSION_READY');
      expect(events).not.toContain('SESSION_ERROR');
    });

    it('fatal portal allowlist mismatch transitions LOADING to ERROR and emits SESSION_ERROR once', () => {
      bootThroughErrorHandler();
      const errorPayloads: Array<Record<string, unknown>> = [];
      const readyCount = { value: 0 };

      getEventBus().subscribe('SESSION_ERROR', (envelope) => {
        errorPayloads.push(envelope.payload as Record<string, unknown>);
      });
      getEventBus().subscribe('SESSION_READY', () => {
        readyCount.value += 1;
      });

      const store = new SessionStore();
      const provider = new SessionProvider(
        store,
        createMemoryStorageAdapter({
          recordVersion: PERSISTED_SESSION_RECORD_VERSION,
          userId: 'portal-mismatch-user',
          portal: 'client',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      );

      provider.createSession({ portal: 'artist' });
      expect(() => provider.hydrateSession()).toThrow(SessionError);

      expect(store.getMachineState()).toBe('ERROR');
      expect(errorPayloads).toHaveLength(1);
      expect(errorPayloads[0]?.code).toBe('SESSION_ERROR_VALIDATE_FATAL');
      expect(readyCount.value).toBe(0);
    });

    it('SYSTEM_READY handler does not promote ERROR machine state to SESSION_READY', () => {
      bootThroughErrorHandler();
      const store = new SessionStore();
      const provider = new SessionProvider(
        store,
        createMemoryStorageAdapter({
          recordVersion: PERSISTED_SESSION_RECORD_VERSION,
          userId: 'fatal-system-ready-user',
          portal: 'staff',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      );

      provider.createSession({ portal: 'client' });
      try {
        provider.hydrateSession();
      } catch {
        // expected fatal
      }

      provider.handleSystemReadyEvent();
      expect(store.getMachineState()).toBe('ERROR');
      expect(provider.getLifecycleState()).toBe('SESSION_UNINITIALIZED');
    });

    it('rejects illegal transition after ERROR sticky state', () => {
      expect(() => assertTransition('ERROR', 'LOGGING_OUT', 'USER_LOGOUT')).toThrow(SessionError);
    });
  });

  describe('CORRECCIÓN 3 — invalid JSON storage', () => {
    it('invalid JSON clears storage and hydrates to ANONYMOUS without crash', () => {
      bootThroughErrorHandler();
      localStorage.setItem(SESSION_STORAGE_KEY, '{not-valid-json');

      const adapter = createLocalStorageAdapter();
      const restore = adapter.restore();
      expect('then' in restore).toBe(false);
      if ('then' in restore) {
        throw new Error('restore must be synchronous');
      }
      expect(restore.found).toBe(false);
      expect(restore.record).toBeNull();
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();

      const store = new SessionStore();
      const provider = new SessionProvider(store, adapter);
      provider.createSession({ portal: 'client' });
      const snapshot = provider.hydrateSession();

      expect(snapshot.user).toBeNull();
      expect(store.getMachineState()).toBe('ANONYMOUS');
      expect(snapshot.state).toBe('SESSION_READY');
    });
  });

  describe('CORRECCIÓN 4 — portal isolation (singleton registry)', () => {
    it('registers the correct portal for client, artist, and staff sequentially', () => {
      bootThroughErrorHandler();

      for (const portal of ['client', 'artist', 'staff'] as const) {
        resetDeps();
        bootThroughErrorHandler();
        initializeSession({ portal });
        expect(getSessionRegistry().getActive()?.portal).toBe(portal);
      }
    });

    it('does not leak client session into artist after reset', () => {
      bootThroughErrorHandler();
      initializeSession({ portal: 'client' });
      deliverAuthHandoff(getAuthSessionBoundaryForTests().createMockAuthHandoff('client-only-user'));

      const clientEntry = getSessionRegistry().getActive();
      expect(clientEntry).not.toBeNull();
      expect(clientEntry?.portal).toBe('client');
      expect(clientEntry?.machineState).toBe('AUTHENTICATED');
      expect(clientEntry?.role).not.toBe('guest');
      expect((clientEntry?.capabilities.length ?? 0) > 0).toBe(true);

      resetSessionForTests();
      bootThroughErrorHandler();

      expect(getSessionRegistry().getActive()).toBeNull();
      expect(getSessionRegistry().list()).toHaveLength(0);
      expect(getSessionRegistry().get(clientEntry!.sessionId)).toBeNull();

      initializeSession({ portal: 'artist' });

      const active = getSessionRegistry().getActive();
      expect(active).not.toBeNull();
      expect(active?.portal).toBe('artist');
      expect(active?.role).toBe('guest');
      expect(active?.machineState).toBe('ANONYMOUS');
      expect(active?.capabilities).not.toEqual(clientEntry?.capabilities);
      expect(active?.role).not.toBe(clientEntry?.role);
      expect(active?.machineState).not.toBe(clientEntry?.machineState);
      expect(active?.lifecycleState).toBe('SESSION_READY');
      expect(getSessionRegistry().list()).toHaveLength(1);
      // Counter may reuse ses_00000001 after reset; registry row must be artist-scoped, not client residue.
      if (active?.sessionId === clientEntry?.sessionId) {
        expect(active?.portal).toBe('artist');
        expect(active?.machineState).toBe('ANONYMOUS');
        expect(active?.role).toBe('guest');
      }
    });

    it('destroy removes only the active session entry', () => {
      bootThroughErrorHandler();
      initializeSession({ portal: 'staff' });
      const sessionId = getSessionRegistry().getActive()?.sessionId;
      expect(sessionId).toBeTruthy();

      destroySession('portal-isolation-destroy');
      expect(getSessionRegistry().list()).toHaveLength(0);
    });

    it('capabilities and role belong to the active portal snapshot', () => {
      bootThroughErrorHandler();
      initializeSession({ portal: 'artist' });
      deliverAuthHandoff(getAuthSessionBoundaryForTests().createMockAuthHandoff('artist-cap-user'));

      const active = getSessionRegistry().getActive();
      expect(active?.portal).toBe('artist');
      expect(active?.role).not.toBe('guest');
      expect((active?.capabilities.length ?? 0) > 0).toBe(true);
    });
  });

  describe('baseline Phase 3 foundation', () => {
    it('lifecycle facade supports createSession + hydrateSession', () => {
      bootThroughErrorHandler();

      const api = createSession({ portal: 'artist' });
      expect(api.getState()).toBe('INITIAL_SESSION');

      const snapshot = hydrateSession();
      expect(snapshot.state).toBe('SESSION_READY');
      expect(snapshot.portal).toBe('artist');
      expect(snapshot.user).toBeNull();
    });

    it('session registry stores sessionId, portal, role, capabilities, timestamps, lifecycle state', () => {
      bootThroughErrorHandler();
      initializeSession({ portal: 'client' });

      const active = getSessionRegistry().getActive();
      expect(active).not.toBeNull();
      expect(active?.sessionId).toMatch(/^ses_/);
      expect(active?.portal).toBe('client');
      expect(active?.role).toBe('guest');
      expect(active?.lifecycleState).toBe('SESSION_READY');
      expect(active?.machineState).toBe('ANONYMOUS');
      expect(active?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(active?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Array.isArray(active?.capabilities)).toBe(true);
    });

    it('memory storage adapter restores authenticated session on hydrate', () => {
      bootThroughErrorHandler();
      const store = new SessionStore();
      const adapter = createMemoryStorageAdapter({
        recordVersion: PERSISTED_SESSION_RECORD_VERSION,
        userId: 'memory-user-1',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      const provider = new SessionProvider(store, adapter);

      provider.createSession({ portal: 'staff' });
      const snapshot = provider.hydrateSession();

      expect(snapshot.user?.userId).toBe('memory-user-1');
      expect(store.getMachineState()).toBe('AUTHENTICATED');
      const restored = adapter.restore();
      expect('then' in restored).toBe(false);
      if ('then' in restored) {
        throw new Error('memory adapter restore must be synchronous');
      }
      expect(restored.found).toBe(true);
    });

    it('localStorage adapter persists and restores session record', () => {
      bootThroughErrorHandler();
      const adapter = createLocalStorageAdapter();

      adapter.persist?.({
        recordVersion: PERSISTED_SESSION_RECORD_VERSION,
        userId: 'local-user',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        portal: 'client',
      });

      const restore = adapter.restore();
      expect('then' in restore).toBe(false);
      if ('then' in restore) {
        throw new Error('localStorage adapter restore must be synchronous');
      }
      expect(restore.found).toBe(true);
      expect(restore.record?.userId).toBe('local-user');
      expect(adapter.backend).toBe('localStorage');
    });

    it('sessionStorage adapter persists and restores session record', () => {
      bootThroughErrorHandler();
      const adapter = createSessionStorageAdapter();

      adapter.persist?.({
        recordVersion: PERSISTED_SESSION_RECORD_VERSION,
        userId: 'tab-user',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        portal: 'artist',
      });

      const restore = adapter.restore();
      expect('then' in restore).toBe(false);
      if ('then' in restore) {
        throw new Error('sessionStorage adapter restore must be synchronous');
      }
      expect(restore.found).toBe(true);
      expect(restore.record?.userId).toBe('tab-user');
      expect(adapter.backend).toBe('sessionStorage');
    });

    it('emits SESSION_CREATED, SESSION_READY, SESSION_EXPIRED, SESSION_DESTROYED lifecycle events', () => {
      bootThroughErrorHandler();
      const events: string[] = [];

      getEventBus().subscribe('SESSION_CREATED', () => events.push('SESSION_CREATED'));
      getEventBus().subscribe('SESSION_READY', () => events.push('SESSION_READY'));
      getEventBus().subscribe('SESSION_EXPIRED', () => events.push('SESSION_EXPIRED'));
      getEventBus().subscribe('SESSION_DESTROYED', () => events.push('SESSION_DESTROYED'));

      initializeSession({ portal: 'client' });
      expect(events).toContain('SESSION_CREATED');
      expect(events).toContain('SESSION_READY');

      deliverAuthHandoff(getAuthSessionBoundaryForTests().createMockAuthHandoff('phase3-expiry-user'));
      expireSession('phase3-expiry');
      expect(events).toContain('SESSION_EXPIRED');

      destroySession('phase3-destroy');
      expect(events).toContain('SESSION_DESTROYED');
    });

    it('refreshSession emits SESSION_REFRESH start and done phases', async () => {
      bootThroughErrorHandler();
      const refreshEvents: string[] = [];

      getEventBus().subscribe('SESSION_REFRESH', (envelope) => {
        refreshEvents.push(String(envelope.payload.phase));
      });

      initializeSession({ portal: 'client' });
      deliverAuthHandoff(getAuthSessionBoundaryForTests().createMockAuthHandoff('phase3-refresh-user'));
      await refreshSession({ reason: 'phase3-refresh' });

      expect(refreshEvents).toEqual(['start', 'done']);
    });
  });
});
