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
import { createSupabaseAdapter } from '../../shared/api/supabase';

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

function buildStack(authorizationHeader: string | null) {
  const transport = createMemoryTransport();
  transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
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
  const adapter = createSupabaseAdapter({ apiClient, sessionReader });
  return { transport, apiClient, sessionReader, adapter };
}

describe('MOD-005 Supabase Adapter — TICKET-V2-PHASE-7-SUPABASE-ADAPTER-IMPLEMENTATION-001', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    resetApiRequestCounterForTests();
  });

  it('createSupabaseAdapter returns frozen adapter with required apiClient injection', () => {
    bootDeps();
    const { apiClient, adapter } = buildStack(null);

    expect(typeof createSupabaseAdapter).toBe('function');
    expect(Object.isFrozen(adapter)).toBe(true);
    expect(adapter).not.toBe(apiClient);
  });

  it('invokeEdge session mode sends session Authorization when user is present', async () => {
    bootDeps();
    const { adapter, transport } = buildStack('Bearer user-jwt-token');

    const result = await adapter.invokeEdge<{ ok: boolean }>({
      functionName: 'create-checkout',
      body: { success_url: 'https://example.com/ok' },
    });

    expect(result.ok).toBe(true);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.method).toBe('POST');
    expect(transport.calls[0]?.url).toBe('https://example.supabase.co/functions/v1/create-checkout');
    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer user-jwt-token');
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('invokeRpc session mode sends session Authorization when user is present', async () => {
    bootDeps();
    const { adapter, transport } = buildStack('Bearer user-jwt-token');

    await adapter.invokeRpc({
      functionName: 'mdj_identity_snapshot',
      params: { p_uid: 'abc' },
    });

    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer user-jwt-token');
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('invokeRpc anon mode requires explicit opt-in and never infers anon from missing session', async () => {
    bootDeps();
    const { adapter, transport } = buildStack(null);

    await adapter.invokeRpc({
      functionName: 'mdj_public_search_event_teasers',
      params: { p_query: 'beat' },
      options: { authMode: 'anon' },
    });

    expect(transport.calls[0]?.headers.Authorization).toBe(`Bearer ${anonKey}`);
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('does not fallback session to anon when session mode has no authorization header', async () => {
    bootDeps();
    const { adapter, transport } = buildStack(null);

    await adapter.invokeRpc({ functionName: 'mdj_public_search_event_teasers' });

    expect(transport.calls[0]?.headers.Authorization).toBeUndefined();
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('delegates requestId generation to ApiClient when context is omitted', async () => {
    bootDeps();
    const { adapter, transport } = buildStack('Bearer user-jwt-token');

    await adapter.invokeRpc({ functionName: 'mdj_identity_snapshot' });
    await adapter.invokeRpc({ functionName: 'mdjb_ensure_mine' });

    expect(transport.calls[0]?.requestId).toMatch(/^req_/);
    expect(transport.calls[1]?.requestId).toMatch(/^req_/);
    expect(transport.calls[0]?.requestId).not.toBe(transport.calls[1]?.requestId);
  });

  it('invokeRpc delegates to apiClient.rpc with POST /rest/v1/rpc/{name}', async () => {
    bootDeps();
    const { adapter, transport } = buildStack('Bearer user-jwt-token');

    const result = await adapter.invokeRpc<{ ok: boolean }>({
      functionName: 'mdj_identity_snapshot',
      params: { p_uid: 'abc' },
    });

    expect(result.ok).toBe(true);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.method).toBe('POST');
    expect(transport.calls[0]?.url).toBe('https://example.supabase.co/rest/v1/rpc/mdj_identity_snapshot');
    expect(transport.calls[0]?.bodyText).toBe(JSON.stringify({ p_uid: 'abc' }));
  });

  it('defaults authMode to session when caller omits options', async () => {
    bootDeps();
    const { adapter, transport } = buildStack(null);

    await adapter.invokeRpc({ functionName: 'mdj_public_search_event_teasers', params: { p_query: 'miami' } });

    expect(transport.calls[0]?.headers.Authorization).toBeUndefined();
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('propagates explicit authMode anon', async () => {
    bootDeps();
    const { adapter, transport } = buildStack(null);

    await adapter.invokeEdge({
      functionName: 'public-edge',
      options: { authMode: 'anon' },
    });

    expect(transport.calls[0]?.headers.Authorization).toBe(`Bearer ${anonKey}`);
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('requireSession true without session fails locally with API_INVALID_PAYLOAD', async () => {
    bootDeps();
    const { adapter, transport } = buildStack(null);

    const result = await adapter.invokeRpc({
      functionName: 'mdjb_ensure_mine',
      options: { requireSession: true },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_INVALID_PAYLOAD');
      expect(result.status).toBe(0);
    }
    expect(transport.calls).toHaveLength(0);
  });

  it('requireSession true with active session reaches transport', async () => {
    bootDeps();
    const { adapter, transport } = buildStack('Bearer user-jwt-token');

    const result = await adapter.invokeRpc({
      functionName: 'mdjb_ensure_mine',
      options: { requireSession: true },
    });

    expect(result.ok).toBe(true);
    expect(transport.calls).toHaveLength(1);
  });

  it('getAuthContext reports guest without authorization header', () => {
    bootDeps();
    const { adapter } = buildStack(null);

    expect(adapter.getAuthContext()).toEqual({
      hasSession: false,
      sessionId: null,
      portal: 'client',
      actorType: 'guest',
    });
  });

  it('getAuthContext reports authenticated session snapshot', () => {
    bootDeps();
    const { adapter } = buildStack('Bearer user-jwt-token');

    expect(adapter.getAuthContext()).toEqual({
      hasSession: true,
      sessionId: 'ses_test',
      portal: 'client',
      actorType: 'authenticated',
    });
  });

  it('cancel delegates to apiClient.cancel', () => {
    bootDeps();
    const cancel = vi.fn();
    const cancelAll = vi.fn();
    const apiClient = {
      invokeEdge: vi.fn(),
      rpc: vi.fn(),
      cancel,
      cancelAll,
    } as unknown as ReturnType<typeof createApiClient>;
    const adapter = createSupabaseAdapter({ apiClient });

    adapter.cancel('req_00000001');

    expect(cancel).toHaveBeenCalledWith('req_00000001');
  });

  it('cancelAll delegates to apiClient.cancelAll', () => {
    bootDeps();
    const cancel = vi.fn();
    const cancelAll = vi.fn();
    const apiClient = {
      invokeEdge: vi.fn(),
      rpc: vi.fn(),
      cancel,
      cancelAll,
    } as unknown as ReturnType<typeof createApiClient>;
    const adapter = createSupabaseAdapter({ apiClient });

    adapter.cancelAll();

    expect(cancelAll).toHaveBeenCalledTimes(1);
  });

  it('invokeRpc uses empty params object by default through ApiClient', async () => {
    bootDeps();
    const { adapter, transport } = buildStack('Bearer user-jwt-token');

    await adapter.invokeRpc({ functionName: 'mdjb_ensure_mine' });

    expect(transport.calls[0]?.bodyText).toBe('{}');
  });

  it('rejects invalid rpc function names via ApiClient sanitization', async () => {
    bootDeps();
    const { adapter, transport } = buildStack('Bearer user-jwt-token');

    const result = await adapter.invokeRpc({ functionName: '../evil' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_INVALID_PAYLOAD');
    }
    expect(transport.calls).toHaveLength(0);
  });

  it('rejects invalid edge function names via ApiClient sanitization', async () => {
    bootDeps();
    const { adapter, transport } = buildStack('Bearer user-jwt-token');

    const result = await adapter.invokeEdge({ functionName: 'https://evil.example/fn' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_INVALID_PAYLOAD');
    }
    expect(transport.calls).toHaveLength(0);
  });

  it('returns ApiResponse shape on success without adapter-specific error codes', async () => {
    bootDeps();
    const { adapter } = buildStack('Bearer user-jwt-token');

    const result = await adapter.invokeEdge<{ ok: boolean }>({ functionName: 'create-checkout' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata.requestId).toMatch(/^req_/);
      expect(result.metadata.correlationId).toBeTruthy();
      expect(result.data).toEqual({ ok: true });
    }
  });

  it('propagates request context without generating a second request identity', async () => {
    bootDeps();
    const { adapter, transport } = buildStack('Bearer user-jwt-token');

    await adapter.invokeRpc({
      functionName: 'mdj_identity_snapshot',
      options: {
        context: {
          requestId: 'req_custom_01',
          correlationId: 'corr_custom_01',
          portal: 'artist',
        },
      },
    });

    expect(transport.calls[0]?.requestId).toBe('req_custom_01');
    expect(transport.calls[0]?.correlationId).toBe('corr_custom_01');
  });

  it('invokeRpc delegates to apiClient.rpc and not invokeEdge', async () => {
    bootDeps();
    const invokeEdge = vi.fn().mockResolvedValue({ ok: true, status: 200, data: {}, metadata: {} });
    const rpc = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { ok: true }, metadata: {} });
    const apiClient = {
      invokeEdge,
      rpc,
      cancel: vi.fn(),
      cancelAll: vi.fn(),
    } as unknown as ReturnType<typeof createApiClient>;
    const adapter = createSupabaseAdapter({ apiClient });

    await adapter.invokeRpc({ functionName: 'mdj_identity_snapshot', params: { p_uid: 'x' } });

    expect(rpc).toHaveBeenCalledOnce();
    expect(invokeEdge).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('mdj_identity_snapshot', { p_uid: 'x' }, {});
  });

  it('maps HTTP failures through ApiClient normalizeApiError', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 401, body: { message: 'JWT expired' } });
    const apiClient = createApiClient({ transport, config: baseConfig });
    const adapter = createSupabaseAdapter({ apiClient });

    const result = await adapter.invokeRpc({ functionName: 'mdjb_ensure_mine' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_HTTP_ERROR');
      expect(result.status).toBe(401);
    }
  });

  it('uses MemoryTransport only and performs no real network egress', async () => {
    bootDeps();
    const { adapter, transport } = buildStack('Bearer user-jwt-token');

    await adapter.invokeEdge({ functionName: 'create-checkout' });
    await adapter.invokeRpc({ functionName: 'mdj_identity_snapshot' });

    expect(transport.calls).toHaveLength(2);
    expect(typeof fetch).toBe('function');
  });

  it('requireSession edge pre-check blocks transport', async () => {
    bootDeps();
    const { adapter, transport } = buildStack(null);

    const result = await adapter.invokeEdge({
      functionName: 'create-checkout',
      options: { requireSession: true },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_INVALID_PAYLOAD');
    }
    expect(transport.calls).toHaveLength(0);
  });

  it('preserves caller headers while protected headers remain ApiClient-owned', async () => {
    bootDeps();
    const { adapter, transport } = buildStack('Bearer user-jwt-token');

    await adapter.invokeRpc({
      functionName: 'mdj_record_login_device',
      params: { p_fingerprint: 'fp' },
      options: {
        headers: {
          'X-Custom-Trace': 'trace-1',
          Authorization: 'Bearer caller-override',
          apikey: 'caller-key',
        },
      },
    });

    expect(transport.calls[0]?.headers['X-Custom-Trace']).toBe('trace-1');
    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer user-jwt-token');
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('frozen adapter surface exposes only documented methods', () => {
    bootDeps();
    const { adapter } = buildStack(null);

    expect(Object.isFrozen(adapter)).toBe(true);
    expect(typeof adapter.invokeEdge).toBe('function');
    expect(typeof adapter.invokeRpc).toBe('function');
    expect(typeof adapter.getAuthContext).toBe('function');
    expect(typeof adapter.cancel).toBe('function');
    expect(typeof adapter.cancelAll).toBe('function');
    expect('getSupabaseAdapter' in (adapter as object)).toBe(false);
  });
});
