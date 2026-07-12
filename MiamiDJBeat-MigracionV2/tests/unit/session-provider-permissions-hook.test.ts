import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { resolvePermissionSnapshot } from '../../shared/permissions/runtime';
import type { AccessPermissionResolutionResult } from '../../shared/services/access-permissions';
import type { ClientProfileId, ProfileResolveInput } from '../../shared/permissions/runtime/types';
import {
  asSessionSnapshotWithPermissions,
  clearSession,
  createInMemoryPersistencePort,
  getSessionPermissionFlagsForTests,
  getSessionPermissionProfileForTests,
  getSessionPermissionsResolutionPhaseForTests,
  getSessionProviderForTests,
  getSessionSnapshot,
  getSessionState,
  hasSessionCapability,
  initializeSession,
  destroySession,
  ingestAuthHandle,
  refreshSession,
  registerAccessPermissionResolutionPort,
  resetSessionForTests,
} from '../../shared/session/runtime';
import { PERSISTED_SESSION_RECORD_VERSION } from '../../shared/session/runtime/persistence-port';
import { SessionProvider } from '../../shared/session/runtime/session-provider';
import { SessionStore } from '../../shared/session/runtime/session-store';

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
  MDJ_V2_FEATURE_ACCESS_SNAPSHOT_PERMISSIONS: 'false',
};

const FLAG_ON_ENV = {
  ...VALID_LOCAL_ENV,
  MDJ_V2_FEATURE_ACCESS_SNAPSHOT_PERMISSIONS: 'true',
};

function boot(env: Record<string, string> = VALID_LOCAL_ENV): void {
  initializeConfiguration(env);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
}

function validHandle(userId = 'user-hook-1') {
  return {
    handoffId: `handoff-${userId}`,
    userId,
    accessTokenRef: 'opaque-access-ref',
    refreshTokenRef: 'opaque-refresh-ref',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    provider: 'mock' as const,
    issuedAt: new Date().toISOString(),
  };
}

async function completeAuth(
  outcome: ReturnType<typeof ingestAuthHandle>,
): Promise<ReturnType<typeof getSessionSnapshot>> {
  return outcome instanceof Promise ? outcome : outcome;
}

function clientProfileId(profile: ProfileResolveInput): ClientProfileId | null {
  return profile.kind === 'client' ? profile.profileId : null;
}

function successResult(
  profile: Extract<AccessPermissionResolutionResult, { ok: true }>['profile'],
  flags: Extract<AccessPermissionResolutionResult, { ok: true }>['flags'] = {},
  resolutionEpoch = 1,
): Extract<AccessPermissionResolutionResult, { ok: true }> {
  const permissions = resolvePermissionSnapshot({
    profile,
    portal: 'client',
    flags,
    userId: 'mock-user',
    snapshotVersion: 1,
  });
  return Object.freeze({
    ok: true,
    resolutionEpoch,
    stage: 'complete',
    profile,
    flags,
    permissions,
  });
}

function failureResult(
  overrides: Partial<Extract<AccessPermissionResolutionResult, { ok: false }>> = {},
): Extract<AccessPermissionResolutionResult, { ok: false }> {
  return Object.freeze({
    ok: false,
    resolutionEpoch: 1,
    stage: 'snapshot',
    retryable: true,
    ...overrides,
  });
}

function publishUserLogin(userId = 'user-hook-1') {
  getEventBus().publish({
    name: 'USER_LOGIN',
    payload: {
      userId,
      handoffId: `handoff-${userId}`,
      accessTokenRef: 'opaque-access-ref',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      issuedAt: new Date().toISOString(),
      provider: 'mock',
    },
    emitter: { moduleId: 'MOD-001' },
    scope: 'public',
  });
}

function publishPermissionChanged(userId: string) {
  getEventBus().publish({
    name: 'PERMISSION_CHANGED',
    payload: {
      userId,
      snapshotVersion: 2,
      capabilities: ['guest.browse.public'],
    },
    emitter: { moduleId: 'MOD-003' },
    scope: 'internal',
  });
}

function trackSessionReadyOnly() {
  const sessionReady: string[] = [];
  getEventBus().subscribe('SESSION_READY', () => sessionReady.push('SESSION_READY'));
  return {
    sessionReady,
    clear: () => {
      sessionReady.length = 0;
    },
  };
}

function trackSessionEvents() {
  const sessionReady: string[] = [];
  const permissionChanged: string[] = [];
  getEventBus().subscribe('SESSION_READY', () => sessionReady.push('SESSION_READY'));
  getEventBus().subscribe('PERMISSION_CHANGED', () => permissionChanged.push('PERMISSION_CHANGED'));
  return {
    sessionReady,
    permissionChanged,
    clear: () => {
      sessionReady.length = 0;
      permissionChanged.length = 0;
    },
  };
}

describe('MOD-002 SessionProvider permissions hook — TICKET-V2-PHASE-8-SESSION-PROVIDER-PERMISSIONS-WIRING-001', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    registerAccessPermissionResolutionPort(null);
  });

  describe('flag OFF', () => {
    it('keeps defaultAuthenticatedProfile behavior', async () => {
      boot();
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      const snapshot = asSessionSnapshotWithPermissions(getSessionSnapshot());
      expect(snapshot.permissions.documentedRole).toBe('buyer');
      expect(getSessionPermissionsResolutionPhaseForTests()).toBe('idle');
    });

    it('does not call resolution port', async () => {
      boot();
      const resolve = vi.fn();
      registerAccessPermissionResolutionPort({ resolve });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(resolve).not.toHaveBeenCalled();
    });

    it('publishes SESSION_READY as before on login', async () => {
      boot();
      initializeSession({ portal: 'client' });
      const events = trackSessionEvents();
      events.clear();
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionState()).toBe('SESSION_READY');
      expect(events.sessionReady).toEqual(['SESSION_READY']);
    });

    it('keeps historical restore behavior', async () => {
      boot();
      const store = new SessionStore();
      const provider = new SessionProvider(
        store,
        createInMemoryPersistencePort({
          recordVersion: PERSISTED_SESSION_RECORD_VERSION,
          portal: 'client',
          userId: 'restore-off',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      );
      provider.initialize({ portal: 'client' });
      const outcome = provider.runHydrationRestore();
      const snapshot = await (outcome instanceof Promise ? outcome : Promise.resolve(outcome));
      expect(snapshot.state).toBe('SESSION_READY');
      expect(asSessionSnapshotWithPermissions(snapshot).permissions.documentedRole).toBe('buyer');
    });

    it('does not call resolution port on refresh', async () => {
      boot();
      const resolve = vi.fn();
      registerAccessPermissionResolutionPort({ resolve });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      await refreshSession();
      expect(resolve).not.toHaveBeenCalled();
    });
  });

  describe('flag ON success', () => {
    it('stays SIGNED_IN while resolution is pending', async () => {
      boot(FLAG_ON_ENV);
      let release: (() => void) | undefined;
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(
          (): Promise<AccessPermissionResolutionResult> =>
            new Promise((resolvePromise) => {
              release = () => resolvePromise(successResult({ kind: 'client', profileId: 'client.regular' }));
            }),
        ),
      });
      initializeSession({ portal: 'client' });
      const pending = completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionState()).toBe('SIGNED_IN');
      release?.();
      await pending;
    });

    it('does not publish SESSION_READY before resolve completes', async () => {
      boot(FLAG_ON_ENV);
      let release: (() => void) | undefined;
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(
          (): Promise<AccessPermissionResolutionResult> =>
            new Promise((resolvePromise) => {
              release = () => resolvePromise(successResult({ kind: 'client', profileId: 'client.regular' }));
            }),
        ),
      });
      initializeSession({ portal: 'client' });
      const events = trackSessionEvents();
      events.clear();
      const pending = completeAuth(ingestAuthHandle(validHandle()));
      expect(events.sessionReady).toEqual([]);
      release?.();
      await pending;
      expect(events.sessionReady).toEqual(['SESSION_READY']);
    });

    it('does not assign elevated provisional profile', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => successResult({ kind: 'client', profileId: 'client.regular' })),
      });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionPermissionProfileForTests().kind).toBe('client');
      expect(clientProfileId(getSessionPermissionProfileForTests())).toBe('client.regular');
    });

    it.each([
      ['buyer regular', { kind: 'client' as const, profileId: 'client.regular' as const }, {}, 'buyer', false],
      ['buyer VIP', { kind: 'client' as const, profileId: 'client.vip' as const }, { clientVip: true }, 'buyer', true],
      ['artist', { kind: 'artist' as const, profileId: 'artist.dj' as const, tier: 'Lite' as const }, {}, 'artist_lite', false],
      ['staff', { kind: 'staff' as const, profileId: 'staff.seller' as const }, {}, 'staff_seller', false],
    ])('applies %s on success', async (_label, profile, flags, role, vip) => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => successResult(profile, flags)),
      });
      initializeSession({ portal: profile.kind === 'staff' ? 'staff' : profile.kind === 'artist' ? 'artist' : 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      const snapshot = asSessionSnapshotWithPermissions(getSessionSnapshot());
      expect(snapshot.permissions.documentedRole).toBe(role);
      if (vip) {
        expect(snapshot.permissions.capabilities).toContain('client.vip.benefits');
      }
    });

    it('emits SESSION_READY exactly once after success', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => successResult({ kind: 'client', profileId: 'client.regular' })),
      });
      initializeSession({ portal: 'client' });
      const events = trackSessionEvents();
      events.clear();
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(events.sessionReady).toEqual(['SESSION_READY']);
      expect(events.permissionChanged).toEqual([]);
      expect(getSessionPermissionsResolutionPhaseForTests()).toBe('resolved');
    });
  });

  describe('restore flag ON', () => {
    it('stays pending without SESSION_READY until success', async () => {
      boot(FLAG_ON_ENV);
      let release: (() => void) | undefined;
      const resolve = vi.fn(
        () =>
          new Promise<AccessPermissionResolutionResult>((resolvePromise) => {
            release = () => resolvePromise(successResult({ kind: 'client', profileId: 'client.vip' }, { clientVip: true }));
          }),
      );
      const provider = new SessionProvider(
        new SessionStore(),
        createInMemoryPersistencePort({
          recordVersion: PERSISTED_SESSION_RECORD_VERSION,
          portal: 'client',
          userId: 'restore-pending',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      );
      provider.setAccessPermissionResolutionPort({ resolve });
      provider.createSession({ portal: 'client' });
      const events = trackSessionEvents();
      events.clear();
      const pending = provider.runHydrationRestore();
      expect(events.sessionReady).toEqual([]);
      release?.();
      await pending;
      expect(events.sessionReady).toEqual(['SESSION_READY']);
    });

    it('publishes SESSION_READY once on restore success', async () => {
      boot(FLAG_ON_ENV);
      const provider = new SessionProvider(
        new SessionStore(),
        createInMemoryPersistencePort({
          recordVersion: PERSISTED_SESSION_RECORD_VERSION,
          portal: 'client',
          userId: 'restore-success',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      );
      provider.setAccessPermissionResolutionPort({
        resolve: vi.fn(async () => successResult({ kind: 'client', profileId: 'client.vip' }, { clientVip: true })),
      });
      provider.createSession({ portal: 'client' });
      const events = trackSessionEvents();
      events.clear();
      await provider.runHydrationRestore();
      expect(events.sessionReady).toEqual(['SESSION_READY']);
    });

    it('does not publish SESSION_READY on restore failure', async () => {
      boot(FLAG_ON_ENV);
      const provider = new SessionProvider(
        new SessionStore(),
        createInMemoryPersistencePort({
          recordVersion: PERSISTED_SESSION_RECORD_VERSION,
          portal: 'client',
          userId: 'restore-fail',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      );
      provider.setAccessPermissionResolutionPort({
        resolve: vi.fn(async () => failureResult({ stage: 'mapping', retryable: false })),
      });
      provider.createSession({ portal: 'client' });
      const events = trackSessionEvents();
      events.clear();
      await provider.runHydrationRestore();
      expect(events.sessionReady).toEqual([]);
      expect(provider.getLifecycleState()).toBe('SIGNED_IN');
    });
  });

  describe('failures flag ON', () => {
    it('403 does not logout', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => failureResult({ stage: 'snapshot', retryable: false })),
      });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionState()).toBe('SIGNED_IN');
      expect(getSessionProviderForTests().getStore().getMachineState()).toBe('AUTHENTICATED');
    });

    it('500 does not logout', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => failureResult({ stage: 'snapshot', retryable: true })),
      });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionProviderForTests().getStore().getMachineState()).toBe('AUTHENTICATED');
    });

    it('timeout does not logout', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => failureResult({ stage: 'snapshot', retryable: true })),
      });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionProviderForTests().getStore().getMachineState()).toBe('AUTHENTICATED');
    });

    it('failure without last valid keeps minimum permissions', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => failureResult({ stage: 'mapping', retryable: false })),
      });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionPermissionProfileForTests().kind).toBe('guest');
      expect(getSessionPermissionsResolutionPhaseForTests()).toBe('failed');
    });

    it('failure with last valid conserves prior profile', async () => {
      boot(FLAG_ON_ENV);
      const resolve = vi
        .fn()
        .mockResolvedValueOnce(successResult({ kind: 'client', profileId: 'client.vip' }, { clientVip: true }))
        .mockResolvedValueOnce(failureResult({ stage: 'snapshot', retryable: true }));
      registerAccessPermissionResolutionPort({ resolve });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle('user-a')));
      await completeAuth(ingestAuthHandle(validHandle('user-a')));
      expect(clientProfileId(getSessionPermissionProfileForTests())).toBe('client.vip');
      expect(getSessionPermissionFlagsForTests().clientVip).toBe(true);
    });

    it('cancelled does not apply new permissions', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => failureResult({ cancelled: true, stage: 'cancelled', retryable: false })),
      });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionPermissionProfileForTests().kind).toBe('guest');
      expect(getSessionPermissionsResolutionPhaseForTests()).toBe('idle');
    });

    it('stale does not apply new permissions', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => failureResult({ stale: true, stage: 'stale', retryable: false })),
      });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionPermissionsResolutionPhaseForTests()).toBe('idle');
    });

    it('mapping failure does not convert to guest authenticated elevation', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => failureResult({ stage: 'mapping', retryable: false })),
      });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionPermissionProfileForTests().kind).toBe('guest');
      expect(hasSessionCapability('staff.dashboard.access', 'staff')).toBe(false);
    });

    it('missing port marks failed without SESSION_READY', async () => {
      boot(FLAG_ON_ENV);
      initializeSession({ portal: 'client' });
      const events = trackSessionEvents();
      events.clear();
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionPermissionsResolutionPhaseForTests()).toBe('failed');
      expect(events.sessionReady).toEqual([]);
      expect(getSessionState()).toBe('SIGNED_IN');
    });
  });

  describe('concurrency', () => {
    it('logout during pending discards late response', async () => {
      boot(FLAG_ON_ENV);
      let release: (() => void) | undefined;
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(
          (): Promise<AccessPermissionResolutionResult> =>
            new Promise((resolvePromise) => {
              release = () =>
                resolvePromise(successResult({ kind: 'client', profileId: 'client.vip' }, { clientVip: true }));
            }),
        ),
      });
      initializeSession({ portal: 'client' });
      const pending = completeAuth(ingestAuthHandle(validHandle()));
      clearSession('logout-race');
      release?.();
      await pending.catch(() => undefined);
      expect(getSessionState()).toBe('SESSION_READY');
      expect(getSessionPermissionProfileForTests().kind).toBe('guest');
    });

    it('new session generation discards stale response', async () => {
      boot(FLAG_ON_ENV);
      let releaseFirst: (() => void) | undefined;
      const resolve = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolvePromise) => {
              releaseFirst = () =>
                resolvePromise(successResult({ kind: 'client', profileId: 'client.vip' }, { clientVip: true }, 1));
            }),
        )
        .mockResolvedValueOnce(successResult({ kind: 'client', profileId: 'client.regular' }, {}, 2));
      registerAccessPermissionResolutionPort({ resolve });
      initializeSession({ portal: 'client' });
      const first = completeAuth(ingestAuthHandle(validHandle('user-a')));
      await completeAuth(ingestAuthHandle(validHandle('user-b')));
      releaseFirst?.();
      await first;
      expect(clientProfileId(getSessionPermissionProfileForTests())).toBe('client.regular');
    });

    it('second resolution cannot overwrite first valid result', async () => {
      boot(FLAG_ON_ENV);
      let releaseFirst: (() => void) | undefined;
      const resolve = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolvePromise) => {
              releaseFirst = () =>
                resolvePromise(successResult({ kind: 'client', profileId: 'client.vip' }, { clientVip: true }, 1));
            }),
        )
        .mockResolvedValueOnce(successResult({ kind: 'client', profileId: 'client.regular' }, {}, 2));
      registerAccessPermissionResolutionPort({ resolve });
      initializeSession({ portal: 'client' });
      const first = completeAuth(ingestAuthHandle(validHandle('user-a')));
      await completeAuth(ingestAuthHandle(validHandle('user-b')));
      expect(clientProfileId(getSessionPermissionProfileForTests())).toBe('client.regular');
      releaseFirst?.();
      await first;
      expect(clientProfileId(getSessionPermissionProfileForTests())).toBe('client.regular');
    });

    it('reset clears port and private state', () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => successResult({ kind: 'client', profileId: 'client.regular' })),
      });
      resetSessionForTests();
      expect(getSessionPermissionsResolutionPhaseForTests()).toBe('idle');
    });
  });

  describe('events and refresh', () => {
    it('never emits PERMISSION_CHANGED from hook flow', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => successResult({ kind: 'client', profileId: 'client.regular' })),
      });
      initializeSession({ portal: 'client' });
      const events = trackSessionEvents();
      events.clear();
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(events.permissionChanged).toEqual([]);
    });

    it('flag OFF keeps SESSION_READY event pattern', async () => {
      boot();
      initializeSession({ portal: 'client' });
      const events = trackSessionEvents();
      events.clear();
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(events.permissionChanged).toEqual([]);
      expect(events.sessionReady).toEqual(['SESSION_READY']);
    });

    it('refresh does not re-fetch permissions in v1', async () => {
      boot(FLAG_ON_ENV);
      const resolve = vi.fn(async () => successResult({ kind: 'client', profileId: 'client.regular' }));
      registerAccessPermissionResolutionPort({ resolve });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      resolve.mockClear();
      await refreshSession();
      expect(resolve).not.toHaveBeenCalled();
    });
  });

  describe('401 failure', () => {
    it('keeps auth session without silent guest conversion', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () =>
          failureResult({
            stage: 'snapshot',
            retryable: false,
            normalizedError: Object.freeze({
              code: 'API_HTTP_ERROR',
              category: 'C-03',
              severity: 'WARNING',
              recovery: 'fatal',
              userMessageKey: 'errors.api.http',
              logMessage: 'HTTP 401 Unauthorized',
              moduleId: 'MOD-005',
              timestamp: new Date().toISOString(),
            }),
          }),
        ),
      });
      initializeSession({ portal: 'client' });
      const events = trackSessionEvents();
      events.clear();
      await completeAuth(ingestAuthHandle(validHandle()));
      expect(getSessionState()).toBe('SIGNED_IN');
      expect(getSessionPermissionsResolutionPhaseForTests()).toBe('failed');
      expect(getSessionPermissionProfileForTests().kind).toBe('guest');
      expect(events.sessionReady).toEqual([]);
      expect(getSessionProviderForTests().getLastPermissionResolutionFailureForTests()?.normalizedError?.code).toBe(
        'API_HTTP_ERROR',
      );
    });
  });

  describe('cross-user last valid', () => {
    it('does not reuse user A VIP profile when user B resolution fails', async () => {
      boot(FLAG_ON_ENV);
      const resolve = vi
        .fn()
        .mockResolvedValueOnce(successResult({ kind: 'client', profileId: 'client.vip' }, { clientVip: true }))
        .mockResolvedValueOnce(failureResult({ stage: 'snapshot', retryable: true }));
      registerAccessPermissionResolutionPort({ resolve });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle('user-a')));
      expect(clientProfileId(getSessionPermissionProfileForTests())).toBe('client.vip');
      const events = trackSessionEvents();
      events.clear();
      await completeAuth(ingestAuthHandle(validHandle('user-b')));
      expect(getSessionState()).toBe('SIGNED_IN');
      expect(getSessionPermissionsResolutionPhaseForTests()).toBe('failed');
      expect(getSessionPermissionProfileForTests().kind).toBe('guest');
      expect(getSessionPermissionFlagsForTests().clientVip).toBeUndefined();
      expect(hasSessionCapability('client.vip.benefits', 'client')).toBe(false);
      expect(events.sessionReady).toEqual([]);
      expect(getSessionProviderForTests().getLastValidPermissionIdentityForTests()).toBeNull();
    });
  });

  describe('async internal callers', () => {
    it('handleUserLoginEvent tracks and awaits flag ON resolution before SESSION_READY', async () => {
      boot(FLAG_ON_ENV);
      let release: (() => void) | undefined;
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(
          () =>
            new Promise<AccessPermissionResolutionResult>((resolvePromise) => {
              release = () =>
                resolvePromise(successResult({ kind: 'client', profileId: 'client.regular' }));
            }),
        ),
      });
      initializeSession({ portal: 'client' });
      const events = trackSessionEvents();
      events.clear();
      publishUserLogin();
      const inFlight = getSessionProviderForTests().getSessionAuthOutcomeInFlightForTests();
      expect(inFlight).not.toBeNull();
      expect(getSessionState()).toBe('SIGNED_IN');
      expect(events.sessionReady).toEqual([]);
      release?.();
      await inFlight;
      expect(events.sessionReady).toEqual(['SESSION_READY']);
    });

    it('initialize tracks async restore when flag ON and persistence exists', async () => {
      boot(FLAG_ON_ENV);
      let release: (() => void) | undefined;
      const provider = new SessionProvider(
        new SessionStore(),
        createInMemoryPersistencePort({
          recordVersion: PERSISTED_SESSION_RECORD_VERSION,
          portal: 'client',
          userId: 'restore-async-user',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      );
      provider.setAccessPermissionResolutionPort({
        resolve: vi.fn(
          () =>
            new Promise<AccessPermissionResolutionResult>((resolvePromise) => {
              release = () =>
                resolvePromise(successResult({ kind: 'client', profileId: 'client.regular' }));
            }),
        ),
      });
      provider.initialize({ portal: 'client' });
      const inFlight = provider.getSessionAuthOutcomeInFlightForTests();
      expect(inFlight).not.toBeNull();
      release?.();
      await inFlight;
      expect(provider.getLifecycleState()).toBe('SESSION_READY');
    });

    it('flag OFF initialize leaves no auth outcome in flight', () => {
      boot();
      initializeSession({ portal: 'client' });
      expect(getSessionProviderForTests().getSessionAuthOutcomeInFlightForTests()).toBeNull();
    });

    it('handleSystemReadyEvent tracks async restore when flag ON', async () => {
      boot(FLAG_ON_ENV);
      let release: (() => void) | undefined;
      const provider = new SessionProvider(
        new SessionStore(),
        createInMemoryPersistencePort({
          recordVersion: PERSISTED_SESSION_RECORD_VERSION,
          portal: 'client',
          userId: 'system-ready-restore',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      );
      provider.setAccessPermissionResolutionPort({
        resolve: vi.fn(
          () =>
            new Promise<AccessPermissionResolutionResult>((resolvePromise) => {
              release = () =>
                resolvePromise(successResult({ kind: 'client', profileId: 'client.regular' }));
            }),
        ),
      });
      provider.createSession({ portal: 'client' });
      provider.handleSystemReadyEvent();
      const inFlight = provider.getSessionAuthOutcomeInFlightForTests();
      expect(inFlight).not.toBeNull();
      release?.();
      await inFlight;
      expect(provider.getLifecycleState()).toBe('SESSION_READY');
    });
  });

  describe('external republishReadySnapshot', () => {
    it('flag OFF allows PERMISSION_CHANGED republish on authenticated session', async () => {
      boot();
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      const events = trackSessionReadyOnly();
      events.clear();
      publishPermissionChanged('user-hook-1');
      expect(events.sessionReady).toEqual(['SESSION_READY']);
    });

    it('flag ON resolved allows PERMISSION_CHANGED republish', async () => {
      boot(FLAG_ON_ENV);
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(async () => successResult({ kind: 'client', profileId: 'client.regular' })),
      });
      initializeSession({ portal: 'client' });
      await completeAuth(ingestAuthHandle(validHandle()));
      const events = trackSessionReadyOnly();
      events.clear();
      publishPermissionChanged('user-hook-1');
      expect(events.sessionReady).toEqual(['SESSION_READY']);
    });

    it('flag ON pending blocks PERMISSION_CHANGED republish', async () => {
      boot(FLAG_ON_ENV);
      let release: (() => void) | undefined;
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(
          () =>
            new Promise<AccessPermissionResolutionResult>((resolvePromise) => {
              release = () =>
                resolvePromise(successResult({ kind: 'client', profileId: 'client.regular' }));
            }),
        ),
      });
      initializeSession({ portal: 'client' });
      const pending = completeAuth(ingestAuthHandle(validHandle()));
      const events = trackSessionReadyOnly();
      events.clear();
      publishPermissionChanged('user-hook-1');
      expect(events.sessionReady).toEqual([]);
      release?.();
      await pending;
    });
  });

  describe('destroy race', () => {
    it('destroy during pending aborts resolution and clears last valid identity', async () => {
      boot(FLAG_ON_ENV);
      let release: (() => void) | undefined;
      registerAccessPermissionResolutionPort({
        resolve: vi.fn(
          () =>
            new Promise<AccessPermissionResolutionResult>((resolvePromise) => {
              release = () =>
                resolvePromise(successResult({ kind: 'client', profileId: 'client.vip' }, { clientVip: true }));
            }),
        ),
      });
      initializeSession({ portal: 'client' });
      const pending = completeAuth(ingestAuthHandle(validHandle()));
      destroySession('destroy-race');
      release?.();
      await pending.catch(() => undefined);
      expect(getSessionPermissionsResolutionPhaseForTests()).toBe('idle');
      expect(getSessionProviderForTests().getLastValidPermissionIdentityForTests()).toBeNull();
      expect(getSessionProviderForTests().getSessionAuthOutcomeInFlightForTests()).toBeNull();
    });
  });
});
