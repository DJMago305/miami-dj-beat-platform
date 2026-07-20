import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { resetSessionForTests } from '@mdj/shared/session';
import {
  createApiClient,
  createMemoryTransport,
  createStaticSessionReader,
  resetApiRequestCounterForTests,
} from '../../shared/api/runtime';
import type { SupabaseAdapter } from '../../shared/api/supabase';
import {
  createAccessSnapshotService,
  createAccessSnapshotServiceFromApiClient,
  mapAccessSnapshotToProfileResolveInput,
  MDJ_ACCESS_SNAPSHOT_RPC,
  validateMdjAccessSnapshotPayload,
} from '../../shared/services/access-snapshot';

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

const anonKey = 'YOUR_ANON_KEY';
const baseConfig = { baseUrl: 'https://example.supabase.co', anonKey };

function bootDeps(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
}

function buildService(authorizationHeader: string | null) {
  const transport = createMemoryTransport();
  const sessionReader = createStaticSessionReader({
    portal: 'client',
    sessionId: authorizationHeader ? 'ses_test' : null,
    authorizationHeader,
    actorType: authorizationHeader ? 'authenticated' : 'guest',
  });
  const apiClient = createApiClient({
    transport,
    config: baseConfig,
    sessionReader,
  });
  const service = createAccessSnapshotServiceFromApiClient({ apiClient, sessionReader });
  return { transport, apiClient, sessionReader, service };
}

function createRecordingAdapter(): {
  adapter: SupabaseAdapter;
  invokeRpc: ReturnType<typeof vi.fn>;
} {
  const invokeRpc = vi.fn(async () =>
    Object.freeze({
      ok: true,
      status: 200,
      data: Object.freeze({ ok: true, profile_kind: 'buyer', buyer_vip: false }),
      metadata: Object.freeze({
        requestId: 'req_test',
        correlationId: 'corr_test',
        durationMs: 1,
        attempt: 1,
        context: Object.freeze({
          requestId: 'req_test',
          correlationId: 'corr_test',
          portal: 'client',
          sessionId: 'ses_test',
          actorType: 'authenticated',
        }),
      }),
    }),
  );

  const adapter = Object.freeze({
    invokeRpc,
    invokeEdge: vi.fn(),
    getAuthContext: vi.fn(),
    cancel: vi.fn(),
    cancelAll: vi.fn(),
  }) as unknown as SupabaseAdapter;

  return { adapter, invokeRpc };
}

describe('Access Snapshot domain service — TICKET-V2-PHASE-7-DOMAIN-SERVICE-WIRING-CORRECTION-001', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    resetApiRequestCounterForTests();
  });

  it('createAccessSnapshotServiceFromApiClient wires adapter with required sessionReader', () => {
    bootDeps();
    const { service } = buildService('Bearer user-jwt-token');

    expect(typeof service.fetchSnapshot).toBe('function');
    expect(Object.isFrozen(service)).toBe(true);
    expect('getSupabaseAdapter' in service).toBe(false);
  });

  it('fetchSnapshot invokes mdj_access_snapshot with empty body via session RPC', async () => {
    bootDeps();
    const { service, transport } = buildService('Bearer user-jwt-token');
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: {
        ok: true,
        profile_kind: 'buyer',
        buyer_vip: false,
        role: 'client',
      },
    });

    const result = await service.fetchSnapshot();

    expect(result.ok).toBe(true);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.method).toBe('POST');
    expect(transport.calls[0]?.url).toBe(
      `https://example.supabase.co/rest/v1/rpc/${MDJ_ACCESS_SNAPSHOT_RPC}`,
    );
    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer user-jwt-token');
    expect(transport.calls[0]?.bodyText).toBe('{}');
    if (result.ok) {
      expect(result.data.ok).toBe(true);
      if (result.data.ok) {
        expect(result.data.profile_kind).toBe('buyer');
      }
    }
  });

  it('fetchSnapshot seals authMode session and requireSession true for every call', async () => {
    bootDeps();
    const { adapter, invokeRpc } = createRecordingAdapter();
    const service = createAccessSnapshotService({ supabaseAdapter: adapter });

    await service.fetchSnapshot({ timeoutMs: 2500, headers: { 'X-Trace': 'phase7' } });

    expect(invokeRpc).toHaveBeenCalledTimes(1);
    expect(invokeRpc.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        functionName: MDJ_ACCESS_SNAPSHOT_RPC,
        params: {},
        options: expect.objectContaining({
          authMode: 'session',
          requireSession: true,
          timeoutMs: 2500,
          headers: { 'X-Trace': 'phase7' },
        }),
      }),
    );
  });

  it('fetchSnapshot cannot accept authMode or requireSession overrides at the type surface', () => {
    bootDeps();
    const service = createAccessSnapshotService({ supabaseAdapter: createRecordingAdapter().adapter });

    type FetchOptions = NonNullable<Parameters<typeof service.fetchSnapshot>[0]>;
    type ForbiddenKeys = 'authMode' | 'requireSession';
    type HasForbiddenKeys = ForbiddenKeys extends keyof FetchOptions ? true : false;

    type ForbiddenKeysCheck = HasForbiddenKeys extends false ? (false extends HasForbiddenKeys ? true : false) : false;
    const _forbiddenKeysCheck: ForbiddenKeysCheck = true as ForbiddenKeysCheck;
    void _forbiddenKeysCheck;
  });

  it('fetchSnapshot blocks without session and returns API_INVALID_PAYLOAD', async () => {
    bootDeps();
    const { service, transport } = buildService(null);

    const result = await service.fetchSnapshot();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_INVALID_PAYLOAD');
    }
    expect(transport.calls).toHaveLength(0);
  });

  it('fetchSnapshot does not infer anon auth when session is missing', async () => {
    bootDeps();
    const { service, transport } = buildService(null);

    await service.fetchSnapshot();

    expect(transport.calls).toHaveLength(0);
  });

  it('fetchSnapshot returns API_PARSE_ERROR for malformed RPC payloads', async () => {
    bootDeps();
    const malformedCases = [
      { label: 'non-object payload', body: null },
      { label: 'missing ok boolean', body: { profile_kind: 'buyer' } },
      { label: 'invalid profile_kind', body: { ok: true, profile_kind: 'alien' } },
      {
        label: 'invalid artist_tier type',
        body: { ok: true, profile_kind: 'artist', artist_tier: 'x' },
      },
      {
        label: 'invalid buyer_vip type',
        body: { ok: true, profile_kind: 'buyer', buyer_vip: 'yes' },
      },
      {
        label: 'invalid role type',
        body: { ok: true, profile_kind: 'staff_full', role: 42 },
      },
      { label: 'invalid reason type', body: { ok: false, reason: 123 } },
    ] as const;

    for (const testCase of malformedCases) {
      const { service, transport } = buildService('Bearer user-jwt-token');
      transport.enqueue({ kind: 'response', status: 200, body: testCase.body });

      const result = await service.fetchSnapshot();

      expect(result.ok, testCase.label).toBe(false);
      if (!result.ok) {
        expect(result.error.code, testCase.label).toBe('API_PARSE_ERROR');
        expect(result.error.message, testCase.label).toBe(
          'Invalid mdj_access_snapshot response payload',
        );
        expect(result.status, testCase.label).toBe(200);
        expect(result.metadata.requestId, testCase.label).toBeTruthy();
        expect(result.metadata.correlationId, testCase.label).toBeTruthy();
      }
    }
  });

  it('fetchSnapshot returns validated success for semantically rejected RPC payload', async () => {
    bootDeps();
    const { service, transport } = buildService('Bearer user-jwt-token');
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: { ok: false, reason: 'no_session' },
    });

    const result = await service.fetchSnapshot();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ ok: false, reason: 'no_session' });
    }

    const mapped = mapAccessSnapshotToProfileResolveInput(result.ok ? result.data : null);
    expect(mapped).toEqual({
      ok: false,
      code: 'ACCESS_SNAPSHOT_REJECTED',
      reason: 'no_session',
    });
  });

  it('fetchSnapshot malformed payload never maps to guest profile', async () => {
    bootDeps();
    const { service, transport } = buildService('Bearer user-jwt-token');
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: { ok: true, profile_kind: 'invalid' },
    });

    const fetchResult = await service.fetchSnapshot();
    expect(fetchResult.ok).toBe(false);
    if (!fetchResult.ok) {
      expect(fetchResult.error.code).toBe('API_PARSE_ERROR');
    }

    const mapped = mapAccessSnapshotToProfileResolveInput({ ok: true, profile_kind: 'invalid' });
    expect(mapped.ok).toBe(false);
    if (!mapped.ok) {
      expect(mapped.code).toBe('ACCESS_SNAPSHOT_INVALID_PAYLOAD');
    }
  });

  it('propagates HTTP 401 through ApiClient normalization', async () => {
    bootDeps();
    const { service, transport } = buildService('Bearer user-jwt-token');
    transport.enqueue({ kind: 'response', status: 401, body: { message: 'JWT expired' } });

    const result = await service.fetchSnapshot();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_HTTP_ERROR');
      expect(result.status).toBe(401);
    }
  });

  it('propagates HTTP 403 through ApiClient normalization', async () => {
    bootDeps();
    const { service, transport } = buildService('Bearer user-jwt-token');
    transport.enqueue({ kind: 'response', status: 403, body: { message: 'Forbidden' } });

    const result = await service.fetchSnapshot();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_HTTP_ERROR');
      expect(result.status).toBe(403);
    }
  });

  it('propagates HTTP 500 through ApiClient normalization', async () => {
    bootDeps();
    const { service, transport } = buildService('Bearer user-jwt-token');
    transport.enqueue({ kind: 'response', status: 500, body: { error: 'server' } });

    const result = await service.fetchSnapshot();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_HTTP_ERROR');
      expect(result.status).toBe(500);
    }
  });

  it('handles timeout via sealed timeoutMs option', async () => {
    bootDeps();
    const { service, transport } = buildService('Bearer user-jwt-token');
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: { ok: true, profile_kind: 'artist', artist_tier: 1 },
      delayMs: 80,
    });

    const result = await service.fetchSnapshot({ timeoutMs: 10 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_TIMEOUT');
    }
  });

  it('handles cancellation via AbortSignal', async () => {
    bootDeps();
    const controller = new AbortController();
    const { service, transport } = buildService('Bearer user-jwt-token');
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: { ok: true, profile_kind: 'artist', artist_tier: 1 },
      delayMs: 60,
    });

    setTimeout(() => controller.abort(), 5);
    const result = await service.fetchSnapshot({ signal: controller.signal });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_CANCELLED');
    }
  });

  it('uses MemoryTransport only with no real network egress', async () => {
    bootDeps();
    const { service, transport } = buildService('Bearer user-jwt-token');
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: { ok: true, profile_kind: 'artist', artist_tier: 1 },
    });

    await service.fetchSnapshot();

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('validateMdjAccessSnapshotPayload rejects malformed payloads', () => {
    expect(validateMdjAccessSnapshotPayload(null).ok).toBe(false);
    expect(validateMdjAccessSnapshotPayload({ ok: 'yes' }).ok).toBe(false);
    expect(validateMdjAccessSnapshotPayload({ ok: true, profile_kind: 'alien' }).ok).toBe(false);
    expect(validateMdjAccessSnapshotPayload({ ok: true, profile_kind: 'buyer', artist_tier: 'x' }).ok).toBe(
      false,
    );
    expect(validateMdjAccessSnapshotPayload({ ok: false }).ok).toBe(false);
  });

  it('mapAccessSnapshotToProfileResolveInput rejects malformed payload without guest fallback', () => {
    const result = mapAccessSnapshotToProfileResolveInput({ ok: true, profile_kind: 'invalid' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('ACCESS_SNAPSHOT_INVALID_PAYLOAD');
    }
  });

  it('mapAccessSnapshotToProfileResolveInput rejects ok:false without guest fallback', () => {
    const result = mapAccessSnapshotToProfileResolveInput({ ok: false, reason: 'no_session' });

    expect(result).toEqual({
      ok: false,
      code: 'ACCESS_SNAPSHOT_REJECTED',
      reason: 'no_session',
    });
  });

  it('mapAccessSnapshotToProfileResolveInput rejects unknown profile_kind without guest fallback', () => {
    const result = mapAccessSnapshotToProfileResolveInput({
      ok: true,
      profile_kind: 'unknown',
      auth_uid: 'uid-123',
    });

    expect(result).toEqual({
      ok: false,
      code: 'ACCESS_SNAPSHOT_UNKNOWN_PROFILE',
      reason: 'Unknown profile for auth uid uid-123',
    });
  });

  it('mapAccessSnapshotToProfileResolveInput maps buyer VIP with flags.clientVip', () => {
    const result = mapAccessSnapshotToProfileResolveInput({
      ok: true,
      profile_kind: 'buyer',
      buyer_vip: true,
    });

    expect(result).toEqual({
      ok: true,
      profile: { kind: 'client', profileId: 'client.vip' },
      flags: { clientVip: true },
    });
  });

  it('mapAccessSnapshotToProfileResolveInput maps non-VIP buyer with clientVip false', () => {
    const result = mapAccessSnapshotToProfileResolveInput({
      ok: true,
      profile_kind: 'buyer',
      buyer_vip: false,
    });

    expect(result).toEqual({
      ok: true,
      profile: { kind: 'client', profileId: 'client.regular' },
      flags: { clientVip: false },
    });
  });

  it('mapAccessSnapshotToProfileResolveInput maps artist tier numbers to ArtistTier', () => {
    expect(
      mapAccessSnapshotToProfileResolveInput({
        ok: true,
        profile_kind: 'artist',
        artist_tier: 0,
      }),
    ).toEqual({
      ok: true,
      profile: { kind: 'artist', profileId: 'artist.dj', tier: 'Lite' },
      flags: {},
    });

    expect(
      mapAccessSnapshotToProfileResolveInput({
        ok: true,
        profile_kind: 'artist',
        artist_tier: 2,
      }),
    ).toEqual({
      ok: true,
      profile: { kind: 'artist', profileId: 'artist.dj', tier: 'Elite' },
      flags: {},
    });
  });

  it('mapAccessSnapshotToProfileResolveInput maps staff_seller profile', () => {
    const result = mapAccessSnapshotToProfileResolveInput({
      ok: true,
      profile_kind: 'staff_seller',
      role: 'seller',
    });

    expect(result).toEqual({
      ok: true,
      profile: { kind: 'staff', profileId: 'staff.seller' },
      flags: {},
    });
  });

  it('mapAccessSnapshotToProfileResolveInput maps staff_full owner role', () => {
    const result = mapAccessSnapshotToProfileResolveInput({
      ok: true,
      profile_kind: 'staff_full',
      role: 'owner',
    });

    expect(result).toEqual({
      ok: true,
      profile: { kind: 'staff', profileId: 'staff.owner' },
      flags: {},
    });
  });

  it('mapAccessSnapshotToProfileResolveInput maps staff_full admin and manager to staff.manager', () => {
    expect(
      mapAccessSnapshotToProfileResolveInput({
        ok: true,
        profile_kind: 'staff_full',
        role: 'admin',
      }),
    ).toEqual({
      ok: true,
      profile: { kind: 'staff', profileId: 'staff.manager' },
      flags: {},
    });

    expect(
      mapAccessSnapshotToProfileResolveInput({
        ok: true,
        profile_kind: 'staff_full',
        role: 'manager',
      }),
    ).toEqual({
      ok: true,
      profile: { kind: 'staff', profileId: 'staff.manager' },
      flags: {},
    });
  });

  it('mapAccessSnapshotToProfileResolveInput does not elevate unknown staff_full role', () => {
    const missingRole = mapAccessSnapshotToProfileResolveInput({
      ok: true,
      profile_kind: 'staff_full',
    });
    const unknownRole = mapAccessSnapshotToProfileResolveInput({
      ok: true,
      profile_kind: 'staff_full',
      role: 'intern',
    });

    expect(missingRole).toEqual({
      ok: false,
      code: 'ACCESS_SNAPSHOT_UNRESOLVED_STAFF',
      reason: 'Missing staff role for staff_full profile.',
    });
    expect(unknownRole).toEqual({
      ok: false,
      code: 'ACCESS_SNAPSHOT_UNRESOLVED_STAFF',
      reason: 'Unsupported staff role: intern',
    });
  });
});
