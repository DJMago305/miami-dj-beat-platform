/**
 * E2E lab chain — TICKET-V2-PHASE-8-ACCESS-PERMISSION-ORCHESTRATOR-INTEGRATION-001
 * ApiClient → Supabase Adapter → Access Snapshot → Orchestrator → MOD-003 → MOD-014
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import {
  getErrorHandler,
  initializeErrorHandler,
  normalizeApiClientError,
  normalizeDomainError,
  normalizeError,
  resetErrorHandlerForTests,
} from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import type { PortalId } from '@mdj/shared/config';
import { PermissionError } from '../../shared/permissions/runtime/errors';
import { resolvePermissionSnapshot } from '../../shared/permissions/runtime/permission-resolver';
import {
  createApiClient,
  createMemoryTransport,
  createStaticSessionReader,
  resetApiClientForTests,
  resetApiRequestCounterForTests,
} from '../../shared/api/runtime';
import { createSupabaseAdapter } from '../../shared/api/supabase';
import {
  createAccessSnapshotService,
  MDJ_ACCESS_SNAPSHOT_RPC,
} from '../../shared/services/access-snapshot';
import { createAccessPermissionOrchestrator } from '../../shared/services/access-permissions';

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

const API_BASE = 'https://example.supabase.co';
const ANON_KEY = 'YOUR_ANON_KEY';
const RPC_PATH = `/rest/v1/rpc/${MDJ_ACCESS_SNAPSHOT_RPC}`;
const SESSION_JWT = 'lab-session-jwt-not-a-real-secret';

const defaultResolveOptions = {
  portal: 'client' as PortalId,
  userId: 'user-integration-1',
  sessionId: 'ses-integration-1',
  snapshotVersion: 1,
};

type IntegrationChain = {
  transport: ReturnType<typeof createMemoryTransport>;
  orchestrator: ReturnType<typeof createAccessPermissionOrchestrator>;
};

function bootLab(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'integration', moduleId: 'MOD-010' });
  initializeErrorHandler();
}

function resetLab(): void {
  resetErrorHandlerForTests();
  resetLoggingForTests();
  resetEventBusForTests();
  resetConfigurationForTests();
  resetApiClientForTests();
  resetApiRequestCounterForTests();
  vi.restoreAllMocks();
}

function buildIntegrationChain(
  authorizationHeader: string | null = `Bearer ${SESSION_JWT}`,
  overrides?: {
    resolvePermissions?: typeof resolvePermissionSnapshot;
    shortTimeoutMs?: number;
  },
): IntegrationChain {
  const transport = createMemoryTransport();
  const sessionReader = createStaticSessionReader({
    portal: 'client',
    sessionId: 'ses_integration',
    authorizationHeader,
    actorType: authorizationHeader ? 'authenticated' : 'guest',
  });
  const apiClient = createApiClient({
    transport,
    config: { baseUrl: API_BASE, anonKey: ANON_KEY },
    sessionReader,
  });
  const supabaseAdapter = createSupabaseAdapter({ apiClient, sessionReader });
  const baseAccessSnapshotService = createAccessSnapshotService({ supabaseAdapter });
  const accessSnapshotService =
    overrides?.shortTimeoutMs !== undefined
      ? Object.freeze({
          fetchSnapshot: (options?: Parameters<typeof baseAccessSnapshotService.fetchSnapshot>[0]) =>
            baseAccessSnapshotService.fetchSnapshot({
              ...options,
              timeoutMs: overrides.shortTimeoutMs,
            }),
        })
      : baseAccessSnapshotService;
  const orchestrator = createAccessPermissionOrchestrator({
    accessSnapshotService,
    resolvePermissions: overrides?.resolvePermissions ?? resolvePermissionSnapshot,
    normalizeApiClientError,
    normalizeDomainError,
    normalizeError,
    moduleId: 'MOD-ACCESS-PERMISSIONS-INT',
  });

  return { transport, orchestrator };
}

function enqueueRpc(
  transport: IntegrationChain['transport'],
  body: unknown,
  options?: { status?: number; delayMs?: number },
) {
  transport.enqueue({
    kind: 'response',
    status: options?.status ?? 200,
    body,
    ...(options?.delayMs !== undefined ? { delayMs: options.delayMs } : {}),
  });
}

function assertRpcRequest(transport: IntegrationChain['transport']) {
  expect(transport.calls).toHaveLength(1);
  const call = transport.calls[0];
  expect(call?.method).toBe('POST');
  expect(call?.url).toBe(`${API_BASE}${RPC_PATH}`);
  expect(call?.bodyText).toBe('{}');
  expect(call?.headers.Authorization).toBe(`Bearer ${SESSION_JWT}`);
  expect(call?.headers.apikey).toBe(ANON_KEY);
}

describe('Access permission orchestrator integration — TICKET-V2-PHASE-8-ACCESS-PERMISSION-ORCHESTRATOR-INTEGRATION-001', () => {
  beforeEach(() => {
    resetLab();
  });

  afterEach(() => {
    resetLab();
  });

  describe('success chain', () => {
    it.each([
      [
        'buyer regular',
        { portal: 'client' as PortalId, body: { ok: true, profile_kind: 'buyer', buyer_vip: false, artist_tier: null, role: null } },
        { profile: { kind: 'client', profileId: 'client.regular' }, flags: { clientVip: false }, role: 'buyer', vipCap: false },
      ],
      [
        'buyer VIP',
        { portal: 'client' as PortalId, body: { ok: true, profile_kind: 'buyer', buyer_vip: true, artist_tier: null, role: null } },
        { profile: { kind: 'client', profileId: 'client.vip' }, flags: { clientVip: true }, role: 'buyer', vipCap: true },
      ],
      [
        'artist Lite',
        { portal: 'artist' as PortalId, body: { ok: true, profile_kind: 'artist', artist_tier: 0, buyer_vip: false, role: null } },
        { profile: { kind: 'artist', profileId: 'artist.dj', tier: 'Lite' }, flags: {}, role: 'artist_lite', vipCap: false },
      ],
      [
        'artist Pro',
        { portal: 'artist' as PortalId, body: { ok: true, profile_kind: 'artist', artist_tier: 1, buyer_vip: false, role: null } },
        { profile: { kind: 'artist', profileId: 'artist.dj', tier: 'Pro' }, flags: {}, role: 'artist_pro', vipCap: false },
      ],
      [
        'artist Elite',
        { portal: 'artist' as PortalId, body: { ok: true, profile_kind: 'artist', artist_tier: 2, buyer_vip: false, role: null } },
        { profile: { kind: 'artist', profileId: 'artist.dj', tier: 'Elite' }, flags: {}, role: 'artist_elite', vipCap: false },
      ],
      [
        'staff seller',
        { portal: 'staff' as PortalId, body: { ok: true, profile_kind: 'staff_seller', artist_tier: null, role: null } },
        { profile: { kind: 'staff', profileId: 'staff.seller' }, flags: {}, role: 'staff_seller', vipCap: false },
      ],
      [
        'staff manager',
        { portal: 'staff' as PortalId, body: { ok: true, profile_kind: 'staff_full', role: 'admin', artist_tier: null } },
        { profile: { kind: 'staff', profileId: 'staff.manager' }, flags: {}, role: 'staff_manager', vipCap: false },
      ],
      [
        'staff owner',
        { portal: 'staff' as PortalId, body: { ok: true, profile_kind: 'staff_full', role: 'owner', artist_tier: null } },
        { profile: { kind: 'staff', profileId: 'staff.owner' }, flags: {}, role: 'staff_owner', vipCap: false },
      ],
    ] as const)(
      'integrates %s through full MemoryTransport chain',
      async (_label, input, expected) => {
        bootLab();
        const { transport, orchestrator } = buildIntegrationChain();
        enqueueRpc(transport, input.body);

        const bus = getEventBus();
        const orchestratorEvents: string[] = [];
        const sessionReadySubscriptionId = bus.subscribe('SESSION_READY', () => {
          orchestratorEvents.push('SESSION_READY');
        });
        bus.subscribe('PERMISSION_CHANGED', () => {
          orchestratorEvents.push('PERMISSION_CHANGED');
        });

        const result = await orchestrator.resolve({
          ...defaultResolveOptions,
          portal: input.portal,
        });

        bus.unsubscribe(sessionReadySubscriptionId);
        assertRpcRequest(transport);
        expect(result.ok).toBe(true);
        if (!result.ok) {
          return;
        }

        expect(result.stage).toBe('complete');
        expect(result.profile).toEqual(expected.profile);
        if ('clientVip' in expected.flags) {
          expect(result.flags.clientVip).toBe(expected.flags.clientVip);
        }
        expect(result.permissions.documentedRole).toBe(expected.role);
        expect(result.flags.sftOk).toBeFalsy();
        expect(result.permissions.capabilities).not.toContain('artist.sft.use');
        if (expected.vipCap) {
          expect(result.permissions.capabilities).toContain('client.vip.benefits');
        }
        expect(orchestratorEvents).toEqual([]);
      },
    );
  });

  describe('error chain', () => {
    it('blocks without session and does not egress RPC', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain(null);

      const result = await orchestrator.resolve(defaultResolveOptions);

      expect(transport.calls).toHaveLength(0);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.stage).toBe('snapshot');
        expect(result.retryable).toBe(false);
        expect(result.normalizedError?.cause).toBe('API_INVALID_PAYLOAD');
      }
    });

    it.each([
      [401, false, 'API_HTTP_ERROR'],
      [403, false, 'API_HTTP_ERROR'],
      [500, true, 'API_HTTP_ERROR'],
    ] as const)('maps HTTP %s with retryable=%s', async (status, retryable, cause) => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain();
      transport.enqueue({ kind: 'response', status, body: { message: `http-${status}` } });

      const result = await orchestrator.resolve(defaultResolveOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.stage).toBe('snapshot');
        expect(result.retryable).toBe(retryable);
        expect(result.normalizedError?.cause).toBe(cause);
        expect(result.normalizedError?.correlationId).toBeTruthy();
      }
    });

    it('maps timeout as retryable snapshot failure without SYSTEM_ERROR', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain(`Bearer ${SESSION_JWT}`, {
        shortTimeoutMs: 10,
      });
      enqueueRpc(transport, { ok: true, profile_kind: 'buyer', buyer_vip: false }, { delayMs: 80 });

      const systemErrors: string[] = [];
      getEventBus().subscribe('SYSTEM_ERROR', () => systemErrors.push('SYSTEM_ERROR'));

      const result = await orchestrator.resolve({
        ...defaultResolveOptions,
        correlationId: 'corr-timeout-int',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.stage).toBe('snapshot');
        expect(result.retryable).toBe(true);
        expect(result.normalizedError?.cause).toBe('API_TIMEOUT');
      }
      expect(systemErrors).toEqual([]);
    });

    it('maps cancellation without operational SYSTEM_ERROR', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain();
      enqueueRpc(transport, { ok: true, profile_kind: 'buyer' }, { delayMs: 100 });

      const controller = new AbortController();
      const systemErrors: string[] = [];
      getEventBus().subscribe('SYSTEM_ERROR', () => systemErrors.push('SYSTEM_ERROR'));

      const pending = orchestrator.resolve({
        ...defaultResolveOptions,
        signal: controller.signal,
      });
      controller.abort();
      const result = await pending;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(['cancelled', 'snapshot']).toContain(result.stage);
        expect(result.retryable).toBe(false);
      }
      expect(systemErrors).toEqual([]);
    });

    it('maps malformed RPC payload to snapshot parse failure', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain();
      enqueueRpc(transport, { ok: true, profile_kind: 'not-valid' });

      const result = await orchestrator.resolve(defaultResolveOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.stage).toBe('snapshot');
        expect(result.retryable).toBe(false);
        expect(result.normalizedError?.cause).toBe('API_PARSE_ERROR');
      }
    });

    it('maps semantic no_session rejection without guest fallback', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain();
      enqueueRpc(transport, { ok: false, reason: 'no_session' });

      const result = await orchestrator.resolve(defaultResolveOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.stage).toBe('mapping');
        expect(result.retryable).toBe(false);
        expect(result.normalizedError?.cause).toBe('ACCESS_SNAPSHOT_REJECTED');
        expect(result.normalizedError?.code).toBe('ERR-0300');
      }
    });

    it('maps unknown profile without privilege escalation', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain();
      enqueueRpc(transport, { ok: true, profile_kind: 'unknown', auth_uid: 'uid-unknown' });

      const result = await orchestrator.resolve(defaultResolveOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.stage).toBe('mapping');
        expect(result.normalizedError?.cause).toBe('ACCESS_SNAPSHOT_UNKNOWN_PROFILE');
      }
    });

    it.each([
      ['missing staff role', { ok: true, profile_kind: 'staff_full' }],
      ['unknown staff role', { ok: true, profile_kind: 'staff_full', role: 'intern' }],
    ] as const)('maps %s to unresolved staff', async (_label, body) => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain();
      enqueueRpc(transport, body);

      const result = await orchestrator.resolve({ ...defaultResolveOptions, portal: 'staff' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.stage).toBe('mapping');
        expect(result.normalizedError?.cause).toBe('ACCESS_SNAPSHOT_UNRESOLVED_STAFF');
      }
    });

    it('maps PermissionError from MOD-003 without guest fallback', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain(`Bearer ${SESSION_JWT}`, {
        resolvePermissions: () => {
          throw new PermissionError('PERM_INVALID_PROFILE', 'integration forced permission failure');
        },
      });
      enqueueRpc(transport, { ok: true, profile_kind: 'buyer', buyer_vip: false });

      const result = await orchestrator.resolve(defaultResolveOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.stage).toBe('permissions');
        expect(result.retryable).toBe(false);
        expect(result.normalizedError).toBeTruthy();
      }
    });

    it('normalizes API and domain failures exactly once through the real chain', async () => {
      bootLab();
      const normalizeApi = vi.fn(normalizeApiClientError);
      const normalizeDomain = vi.fn(normalizeDomainError);
      const { transport } = buildIntegrationChain();
      const sessionReader = createStaticSessionReader({
        portal: 'client',
        sessionId: 'ses_integration',
        authorizationHeader: `Bearer ${SESSION_JWT}`,
        actorType: 'authenticated',
      });
      const apiClient = createApiClient({
        transport,
        config: { baseUrl: API_BASE, anonKey: ANON_KEY },
        sessionReader,
      });
      const orchestrator = createAccessPermissionOrchestrator({
        accessSnapshotService: createAccessSnapshotService({
          supabaseAdapter: createSupabaseAdapter({ apiClient, sessionReader }),
        }),
        resolvePermissions: resolvePermissionSnapshot,
        normalizeApiClientError: normalizeApi,
        normalizeDomainError: normalizeDomain,
        normalizeError,
      });

      transport.enqueue({ kind: 'response', status: 500, body: { error: 'server' } });
      await orchestrator.resolve(defaultResolveOptions);
      expect(normalizeApi).toHaveBeenCalledTimes(1);
      expect(normalizeDomain).not.toHaveBeenCalled();

      transport.reset();
      normalizeApi.mockClear();
      normalizeDomain.mockClear();
      enqueueRpc(transport, { ok: false, reason: 'no_session' });
      await orchestrator.resolve(defaultResolveOptions);
      expect(normalizeApi).not.toHaveBeenCalled();
      expect(normalizeDomain).toHaveBeenCalledTimes(1);
    });
  });

  describe('concurrency integration', () => {
    it('latest-wins when second resolve supersedes delayed first response', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain();
      enqueueRpc(transport, { ok: true, profile_kind: 'buyer', buyer_vip: false }, { delayMs: 50 });
      enqueueRpc(transport, { ok: true, profile_kind: 'buyer', buyer_vip: true });

      const first = orchestrator.resolve(defaultResolveOptions);
      const second = await orchestrator.resolve(defaultResolveOptions);
      const firstResult = await first;

      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.flags.clientVip).toBe(true);
        expect(second.resolutionEpoch).toBeGreaterThan(1);
      }
      expect(firstResult.ok).toBe(false);
      if (!firstResult.ok) {
        expect(['stale', 'cancelled']).toContain(firstResult.stage);
      }
    });

    it('returns cancelled when external signal is pre-aborted', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain();
      enqueueRpc(transport, { ok: true, profile_kind: 'buyer' });

      const controller = new AbortController();
      controller.abort();

      const result = await orchestrator.resolve({
        ...defaultResolveOptions,
        signal: controller.signal,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.stage).toBe('cancelled');
        expect(result.cancelled).toBe(true);
      }
    });

    it('isolates epoch and AbortController across separate orchestrator instances', async () => {
      bootLab();
      const chainA = buildIntegrationChain();
      const chainB = buildIntegrationChain();
      enqueueRpc(chainA.transport, { ok: true, profile_kind: 'buyer', buyer_vip: false });
      enqueueRpc(chainB.transport, { ok: true, profile_kind: 'buyer', buyer_vip: true });

      const [resultA, resultB] = await Promise.all([
        chainA.orchestrator.resolve(defaultResolveOptions),
        chainB.orchestrator.resolve(defaultResolveOptions),
      ]);

      expect(resultA.ok).toBe(true);
      expect(resultB.ok).toBe(true);
      if (resultA.ok && resultB.ok) {
        expect(resultA.resolutionEpoch).toBe(1);
        expect(resultB.resolutionEpoch).toBe(1);
        expect(resultA.flags.clientVip).toBe(false);
        expect(resultB.flags.clientVip).toBe(true);
      }
    });
  });

  describe('event bus and logging', () => {
    it('publishes single SYSTEM_ERROR for HTTP 500 ERROR severity', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain();
      transport.enqueue({ kind: 'response', status: 500, body: { error: 'server' } });

      const published: string[] = [];
      getEventBus().subscribe('SYSTEM_ERROR', () => published.push('SYSTEM_ERROR'));

      await orchestrator.resolve(defaultResolveOptions);

      expect(published).toEqual(['SYSTEM_ERROR']);
    });

    it('does not leak Authorization token into normalized error history', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain();
      transport.enqueue({ kind: 'response', status: 500, body: { error: 'server' } });

      await orchestrator.resolve(defaultResolveOptions);

      const history = getErrorHandler().getHistory();
      expect(history.length).toBeGreaterThan(0);
      const serialized = JSON.stringify(history);
      expect(serialized).not.toContain(SESSION_JWT);
      expect(serialized).not.toContain('Bearer ');
    });

    it('does not persist raw RPC payload or apikey in error history metadata', async () => {
      bootLab();
      const { transport, orchestrator } = buildIntegrationChain();
      transport.enqueue({ kind: 'response', status: 500, body: { error: 'server', secret_field: 'must-not-appear' } });

      await orchestrator.resolve(defaultResolveOptions);

      const history = getErrorHandler().getHistory();
      const serialized = JSON.stringify(history);
      expect(serialized).not.toContain('must-not-appear');
      expect(serialized).not.toContain(ANON_KEY);
      expect(serialized).not.toContain(SESSION_JWT);
      expect(transport.calls[0]?.headers.apikey).toBe(ANON_KEY);
      expect(transport.calls[0]?.headers.Authorization).toBe(`Bearer ${SESSION_JWT}`);
    });
  });
});
