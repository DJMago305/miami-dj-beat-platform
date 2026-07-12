import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import {
  initializeErrorHandler,
  normalizeApiClientError,
  normalizeDomainError,
  normalizeError,
  resetErrorHandlerForTests,
} from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { PermissionError } from '../../shared/permissions/runtime/errors';
import { resolvePermissionSnapshot } from '../../shared/permissions/runtime/permission-resolver';
import {
  createApiClient,
  createMemoryTransport,
  createStaticSessionReader,
  resetApiRequestCounterForTests,
} from '../../shared/api/runtime';
import { createAccessSnapshotServiceFromApiClient } from '../../shared/services/access-snapshot';
import {
  createAccessPermissionOrchestrator,
  isApiErrorRetryable,
  isDomainMappingRetryable,
  isPermissionResolverRetryable,
} from '../../shared/services/access-permissions';

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

const baseConfig = { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' };

const defaultOptions = {
  portal: 'client' as const,
  userId: 'user-orchestrator-1',
  sessionId: 'ses-orchestrator-1',
  snapshotVersion: 1,
};

function bootDeps(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
}

function buildStack(authorizationHeader = 'Bearer user-jwt-token') {
  const transport = createMemoryTransport();
  const sessionReader = createStaticSessionReader({
    portal: 'client',
    sessionId: 'ses_test',
    authorizationHeader,
    actorType: 'authenticated',
  });
  const apiClient = createApiClient({
    transport,
    config: baseConfig,
    sessionReader,
  });
  const accessSnapshotService = createAccessSnapshotServiceFromApiClient({
    apiClient,
    sessionReader,
  });
  return { transport, accessSnapshotService };
}

function createOrchestrator(
  accessSnapshotService: ReturnType<typeof buildStack>['accessSnapshotService'],
  overrides?: Partial<Parameters<typeof createAccessPermissionOrchestrator>[0]>,
) {
  return createAccessPermissionOrchestrator({
    accessSnapshotService,
    resolvePermissions: resolvePermissionSnapshot,
    normalizeApiClientError,
    normalizeDomainError,
    normalizeError,
    moduleId: 'MOD-ACCESS-PERMISSIONS-TEST',
    ...overrides,
  });
}

function enqueueSnapshot(
  transport: ReturnType<typeof buildStack>['transport'],
  body: Record<string, unknown>,
  delayMs?: number,
) {
  transport.enqueue({
    kind: 'response',
    status: 200,
    body,
    ...(delayMs !== undefined ? { delayMs } : {}),
  });
}

describe('AccessPermissionOrchestrator — TICKET-V2-PHASE-8-ACCESS-PERMISSION-ORCHESTRATOR-001', () => {
  beforeEach(() => {
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    resetApiRequestCounterForTests();
  });

  it('creates a frozen factory with resolve()', () => {
    bootDeps();
    const { accessSnapshotService } = buildStack();
    const orchestrator = createOrchestrator(accessSnapshotService);

    expect(typeof orchestrator.resolve).toBe('function');
    expect(Object.isFrozen(orchestrator)).toBe(true);
  });

  it('resolves buyer regular profile and permissions', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer', buyer_vip: false });

    const result = await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stage).toBe('complete');
      expect(result.profile).toEqual({ kind: 'client', profileId: 'client.regular' });
      expect(result.flags.clientVip).toBe(false);
      expect(result.permissions.documentedRole).toBe('buyer');
      expect(result.resolutionEpoch).toBe(1);
    }
  });

  it('resolves buyer VIP with flags.clientVip', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer', buyer_vip: true });

    const result = await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile).toEqual({ kind: 'client', profileId: 'client.vip' });
      expect(result.flags.clientVip).toBe(true);
      expect(result.permissions.capabilities).toContain('client.vip.benefits');
    }
  });

  it.each([
    ['Lite', 0, 'artist_lite'],
    ['Pro', 1, 'artist_pro'],
    ['Elite', 2, 'artist_elite'],
  ] as const)('resolves artist %s tier', async (_label, tier, documentedRole) => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'artist', artist_tier: tier });

    const result = await createOrchestrator(accessSnapshotService).resolve({
      ...defaultOptions,
      portal: 'artist',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile).toEqual({
        kind: 'artist',
        profileId: 'artist.dj',
        tier: _label,
      });
      expect(result.permissions.documentedRole).toBe(documentedRole);
    }
  });

  it('resolves staff seller', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'staff_seller' });

    const result = await createOrchestrator(accessSnapshotService).resolve({
      ...defaultOptions,
      portal: 'staff',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile).toEqual({ kind: 'staff', profileId: 'staff.seller' });
      expect(result.permissions.documentedRole).toBe('staff_seller');
    }
  });

  it('resolves staff manager from admin role', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'staff_full', role: 'admin' });

    const result = await createOrchestrator(accessSnapshotService).resolve({
      ...defaultOptions,
      portal: 'staff',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile).toEqual({ kind: 'staff', profileId: 'staff.manager' });
      expect(result.permissions.documentedRole).toBe('staff_manager');
    }
  });

  it('resolves staff owner', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'staff_full', role: 'owner' });

    const result = await createOrchestrator(accessSnapshotService).resolve({
      ...defaultOptions,
      portal: 'staff',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile).toEqual({ kind: 'staff', profileId: 'staff.owner' });
      expect(result.permissions.documentedRole).toBe('staff_owner');
    }
  });

  it('returns snapshot failure for HTTP 401 with retryable false', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    transport.enqueue({ kind: 'response', status: 401, body: { message: 'JWT expired' } });

    const result = await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('snapshot');
      expect(result.retryable).toBe(false);
      expect(result.normalizedError?.cause).toBe('API_HTTP_ERROR');
    }
  });

  it('returns snapshot failure for HTTP 403 with retryable false', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    transport.enqueue({ kind: 'response', status: 403, body: { message: 'Forbidden' } });

    const result = await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('snapshot');
      expect(result.retryable).toBe(false);
    }
  });

  it('returns snapshot failure for HTTP 500 with retryable true', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    transport.enqueue({ kind: 'response', status: 500, body: { error: 'server' } });

    const result = await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('snapshot');
      expect(result.retryable).toBe(true);
    }
  });

  it('returns snapshot failure for timeout with retryable true', async () => {
    bootDeps();
    const { transport } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer' }, 80);

    const sessionReader = createStaticSessionReader({
      portal: 'client',
      sessionId: 'ses_test',
      authorizationHeader: 'Bearer user-jwt-token',
      actorType: 'authenticated',
    });
    const apiClient = createApiClient({
      transport,
      config: baseConfig,
      sessionReader,
    });
    const slowService = createAccessSnapshotServiceFromApiClient({
      apiClient,
      sessionReader,
    });

    const originalFetch = slowService.fetchSnapshot.bind(slowService);
    const fetchSnapshot = vi.fn(async (options?: Parameters<typeof originalFetch>[0]) =>
      originalFetch({ ...options, timeoutMs: 10 }),
    );
    const timeoutService = Object.freeze({
      fetchSnapshot,
    });

    const result = await createOrchestrator(timeoutService).resolve(defaultOptions);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('snapshot');
      expect(result.retryable).toBe(true);
      expect(result.normalizedError?.cause).toBe('API_TIMEOUT');
    }
  });

  it('returns cancelled or stale when a newer resolution supersedes the in-flight one', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer' }, 50);
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer', buyer_vip: true });

    const orchestrator = createOrchestrator(accessSnapshotService);
    const first = orchestrator.resolve(defaultOptions);
    const second = await orchestrator.resolve(defaultOptions);
    const firstResult = await first;

    expect(second.ok).toBe(true);
    expect(firstResult.ok).toBe(false);
    if (!firstResult.ok) {
      expect(['stale', 'cancelled']).toContain(firstResult.stage);
      expect(firstResult.retryable).toBe(false);
    }
  });

  it('returns mapping failure for malformed RPC payload', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'invalid' });

    const result = await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('snapshot');
      expect(result.retryable).toBe(false);
      expect(result.normalizedError?.cause).toBe('API_PARSE_ERROR');
    }
  });

  it('returns mapping failure for ACCESS_SNAPSHOT_REJECTED', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: false, reason: 'no_session' });

    const result = await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('mapping');
      expect(result.retryable).toBe(false);
      expect(result.normalizedError?.cause).toBe('ACCESS_SNAPSHOT_REJECTED');
    }
  });

  it('returns mapping failure for ACCESS_SNAPSHOT_UNKNOWN_PROFILE', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'unknown', auth_uid: 'uid-1' });

    const result = await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('mapping');
      expect(result.retryable).toBe(false);
      expect(result.normalizedError?.cause).toBe('ACCESS_SNAPSHOT_UNKNOWN_PROFILE');
    }
  });

  it('returns mapping failure for ACCESS_SNAPSHOT_UNRESOLVED_STAFF', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'staff_full', role: 'intern' });

    const result = await createOrchestrator(accessSnapshotService).resolve({
      ...defaultOptions,
      portal: 'staff',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('mapping');
      expect(result.retryable).toBe(false);
      expect(result.normalizedError?.cause).toBe('ACCESS_SNAPSHOT_UNRESOLVED_STAFF');
    }
  });

  it('returns permissions failure when resolvePermissions throws PermissionError', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer', buyer_vip: false });

    const resolvePermissions = vi.fn(() => {
      throw new PermissionError('PERM_INVALID_PROFILE', 'forced permission failure');
    });

    const result = await createOrchestrator(accessSnapshotService, { resolvePermissions }).resolve(
      defaultOptions,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('permissions');
      expect(result.retryable).toBe(false);
      expect(result.normalizedError).toBeTruthy();
    }
  });

  it('never maps authenticated failures to guest profile', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'unknown' });

    const result = await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('mapping');
    }
  });

  it('does not infer sftOk from RPC payload', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'artist', artist_tier: 1, sft_ok: true });

    const result = await createOrchestrator(accessSnapshotService).resolve({
      ...defaultOptions,
      portal: 'artist',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.flags.sftOk).toBeFalsy();
      expect(result.permissions.capabilities).not.toContain('artist.sft.use');
    }
  });

  it('increments resolutionEpoch across successive resolves', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer', buyer_vip: false });
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer', buyer_vip: false });

    const orchestrator = createOrchestrator(accessSnapshotService);
    const first = await orchestrator.resolve(defaultOptions);
    const second = await orchestrator.resolve(defaultOptions);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.resolutionEpoch).toBeGreaterThan(first.resolutionEpoch);
    }
  });

  it('applies latest-wins so only the newest successful resolution completes', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer', buyer_vip: false }, 40);
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer', buyer_vip: true });

    const orchestrator = createOrchestrator(accessSnapshotService);
    const first = orchestrator.resolve(defaultOptions);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await orchestrator.resolve(defaultOptions);
    const firstResult = await first;

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.flags.clientVip).toBe(true);
    }
    expect(firstResult.ok).toBe(false);
    if (!firstResult.ok) {
      expect(firstResult.stage).toMatch(/stale|cancelled/);
    }
  });

  it('returns stale for superseded epoch without success payload', async () => {
    bootDeps();
    let inFlight = 0;

    const fetchSnapshot = vi.fn(async () => {
      const call = inFlight + 1;
      inFlight = call;
      if (call === 1) {
        await new Promise((resolve) => setTimeout(resolve, 40));
        if (inFlight !== 1) {
          return Object.freeze({
            ok: false as const,
            status: 0,
            error: {
              code: 'API_CANCELLED' as const,
              message: 'cancelled',
              status: 0,
              details: null,
            },
            metadata: Object.freeze({
              requestId: 'req_cancel',
              correlationId: 'corr_cancel',
              durationMs: 1,
              attempt: 1,
              context: Object.freeze({
                requestId: 'req_cancel',
                correlationId: 'corr_cancel',
                sessionId: 'ses_test',
                actorType: 'authenticated',
              }),
            }),
          });
        }
      }

      return Object.freeze({
        ok: true as const,
        status: 200,
        data: Object.freeze({ ok: true, profile_kind: 'buyer', buyer_vip: true }),
        metadata: Object.freeze({
          requestId: 'req_stale',
          correlationId: 'corr_stale',
          durationMs: 1,
          attempt: 1,
          context: Object.freeze({
            requestId: 'req_stale',
            correlationId: 'corr_stale',
            sessionId: 'ses_test',
            actorType: 'authenticated',
          }),
        }),
      });
    });

    const orchestrator = createAccessPermissionOrchestrator({
      accessSnapshotService: Object.freeze({ fetchSnapshot }),
      resolvePermissions: resolvePermissionSnapshot,
      normalizeApiClientError,
      normalizeDomainError,
      normalizeError,
    });

    const first = orchestrator.resolve(defaultOptions);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await orchestrator.resolve(defaultOptions);
    const firstResult = await first;

    expect(second.ok).toBe(true);
    expect(firstResult.ok).toBe(false);
    if (!firstResult.ok) {
      expect(['stale', 'cancelled']).toContain(firstResult.stage);
      expect(firstResult.retryable).toBe(false);
    }
  });

  it('honours external AbortSignal with cancelled result', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer' }, 100);

    const controller = new AbortController();
    const pending = createOrchestrator(accessSnapshotService).resolve({
      ...defaultOptions,
      signal: controller.signal,
    });
    controller.abort();
    const result = await pending;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toMatch(/cancelled|snapshot/);
      expect(result.retryable).toBe(false);
    }
  });

  it('handles two concurrent resolves without global state leakage between instances', async () => {
    bootDeps();
    const stackA = buildStack();
    const stackB = buildStack();
    enqueueSnapshot(stackA.transport, { ok: true, profile_kind: 'buyer', buyer_vip: false });
    enqueueSnapshot(stackB.transport, { ok: true, profile_kind: 'buyer', buyer_vip: true });

    const orchestratorA = createOrchestrator(stackA.accessSnapshotService);
    const orchestratorB = createOrchestrator(stackB.accessSnapshotService);

    const [resultA, resultB] = await Promise.all([
      orchestratorA.resolve(defaultOptions),
      orchestratorB.resolve(defaultOptions),
    ]);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (resultA.ok && resultB.ok) {
      expect(resultA.flags.clientVip).toBe(false);
      expect(resultB.flags.clientVip).toBe(true);
      expect(resultA.resolutionEpoch).toBe(1);
      expect(resultB.resolutionEpoch).toBe(1);
    }
  });

  it.each([
    ['API_HTTP_ERROR', 500, true],
    ['API_HTTP_ERROR', 401, false],
    ['API_HTTP_ERROR', 403, false],
    ['API_TIMEOUT', 0, true],
    ['API_CANCELLED', 0, false],
    ['API_PARSE_ERROR', 0, false],
    ['API_INVALID_PAYLOAD', 0, false],
  ] as const)('retryable policy for %s status %s → %s', (code, status, expected) => {
    expect(isApiErrorRetryable({ code, message: 'x', status, details: null }, status)).toBe(
      expected,
    );
  });

  it('domain mapping retryable policy is always false', () => {
    expect(isDomainMappingRetryable('ACCESS_SNAPSHOT_REJECTED')).toBe(false);
    expect(isDomainMappingRetryable('ACCESS_SNAPSHOT_UNKNOWN_PROFILE')).toBe(false);
    expect(isDomainMappingRetryable('ACCESS_SNAPSHOT_UNRESOLVED_STAFF')).toBe(false);
    expect(isDomainMappingRetryable('ACCESS_SNAPSHOT_INVALID_PAYLOAD')).toBe(false);
  });

  it('permission resolver retryable policy is false', () => {
    expect(isPermissionResolverRetryable()).toBe(false);
  });

  it('normalizes API failures exactly once', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    transport.enqueue({ kind: 'response', status: 500, body: { error: 'server' } });

    const normalizeApi = vi.fn(normalizeApiClientError);
    const normalizeDomain = vi.fn(normalizeDomainError);

    const result = await createOrchestrator(accessSnapshotService, {
      normalizeApiClientError: normalizeApi,
      normalizeDomainError: normalizeDomain,
    }).resolve(defaultOptions);

    expect(result.ok).toBe(false);
    expect(normalizeApi).toHaveBeenCalledTimes(1);
    expect(normalizeDomain).not.toHaveBeenCalled();
  });

  it('normalizes domain mapping failures exactly once', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: false, reason: 'no_session' });

    const normalizeApi = vi.fn(normalizeApiClientError);
    const normalizeDomain = vi.fn(normalizeDomainError);

    const result = await createOrchestrator(accessSnapshotService, {
      normalizeApiClientError: normalizeApi,
      normalizeDomainError: normalizeDomain,
    }).resolve(defaultOptions);

    expect(result.ok).toBe(false);
    expect(normalizeApi).not.toHaveBeenCalled();
    expect(normalizeDomain).toHaveBeenCalledTimes(1);
  });

  it('does not publish SESSION_READY or PERMISSION_CHANGED during orchestrator resolve', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer', buyer_vip: false });

    const bus = getEventBus();
    const observed: string[] = [];
    const subscriptionId = bus.subscribe('SESSION_READY', () => {
      observed.push('SESSION_READY');
    });
    bus.subscribe('PERMISSION_CHANGED', () => {
      observed.push('PERMISSION_CHANGED');
    });

    await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    bus.unsubscribe(subscriptionId);
    expect(observed).toEqual([]);
  });

  it('uses MemoryTransport without real network egress', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer', buyer_vip: false });

    const result = await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    expect(result.ok).toBe(true);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.url).toContain('/rest/v1/rpc/mdj_access_snapshot');
  });

  it('returns frozen discriminated union results', async () => {
    bootDeps();
    const { transport, accessSnapshotService } = buildStack();
    enqueueSnapshot(transport, { ok: true, profile_kind: 'buyer', buyer_vip: false });

    const result = await createOrchestrator(accessSnapshotService).resolve(defaultOptions);

    expect(Object.isFrozen(result)).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.permissions)).toBe(true);
    }
  });
});
