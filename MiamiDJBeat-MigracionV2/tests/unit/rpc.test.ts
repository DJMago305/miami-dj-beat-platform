import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { resetSessionForTests } from '@mdj/shared/session';
import {
  createApiClient,
  createMemoryTransport,
  createMockTransport,
  createStaticSessionReader,
  mockResponse,
  resetApiRequestCounterForTests,
  sanitizeRpcFunctionName,
} from '../../shared/api/runtime';

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

function clientWithSession(authorizationHeader: string | null) {
  const transport = createMemoryTransport();
  transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
  return {
    transport,
    client: createApiClient({
      transport,
      config: baseConfig,
      sessionReader: createStaticSessionReader({
        portal: 'client',
        sessionId: 'ses_test',
        authorizationHeader,
        actorType: authorizationHeader ? 'authenticated' : 'guest',
      }),
    }),
  };
}

describe('MOD-005 rpc — TICKET-V2-PHASE-6-RPC-IMPLEMENTATION-001', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    resetApiRequestCounterForTests();
  });

  it('POSTs to /rest/v1/rpc/{sanitizedName} with session Authorization and apikey', async () => {
    bootDeps();
    const { client, transport } = clientWithSession('Bearer user-jwt-token');

    const result = await client.rpc<{ ok: boolean }>('mdj_identity_snapshot', { p_uid: 'abc' });

    expect(result.ok).toBe(true);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.method).toBe('POST');
    expect(transport.calls[0]?.url).toBe('https://example.supabase.co/rest/v1/rpc/mdj_identity_snapshot');
    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer user-jwt-token');
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
    expect(transport.calls[0]?.bodyText).toBe(JSON.stringify({ p_uid: 'abc' }));
  });

  it('session mode without user sends apikey only', async () => {
    bootDeps();
    const { client, transport } = clientWithSession(null);

    await client.rpc('mdj_public_search_event_teasers', { p_query: 'miami' });

    expect(transport.calls[0]?.headers.Authorization).toBeUndefined();
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('anon guest mode sends anon Authorization and apikey', async () => {
    bootDeps();
    const { client, transport } = clientWithSession(null);

    await client.rpc('mdj_public_search_event_teasers', { p_query: 'beat' }, { authMode: 'anon' });

    expect(transport.calls[0]?.headers.Authorization).toBe(`Bearer ${anonKey}`);
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('anon mode with active session prefers session Authorization', async () => {
    bootDeps();
    const { client, transport } = clientWithSession('Bearer user-jwt-token');

    await client.rpc('mdjb_ensure_mine', {}, { authMode: 'anon' });

    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer user-jwt-token');
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('ignores caller Authorization override', async () => {
    bootDeps();
    const { client, transport } = clientWithSession('Bearer user-jwt-token');

    await client.rpc(
      'mdj_record_login_device',
      { p_fingerprint: 'fp' },
      { headers: { Authorization: 'Bearer caller-override' } },
    );

    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer user-jwt-token');
  });

  it('ignores caller apikey override', async () => {
    bootDeps();
    const { client, transport } = clientWithSession('Bearer user-jwt-token');

    await client.rpc('mdj_record_login_device', {}, { headers: { apikey: 'caller-key' } });

    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('preserves non-protected caller headers', async () => {
    bootDeps();
    const { client, transport } = clientWithSession('Bearer user-jwt-token');

    await client.rpc('mdj_record_login_device', {}, { headers: { 'X-Trace': 'ok' } });

    expect(transport.calls[0]?.headers['X-Trace']).toBe('ok');
  });

  it('serializes params in the request body', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { valid: true } });
    const client = createApiClient({ transport, config: baseConfig });

    await client.rpc('mdj_validate_discount_code', { p_code: 'VIP10', p_event_id: 'evt_1' });

    expect(transport.calls[0]?.bodyText).toBe(
      JSON.stringify({ p_code: 'VIP10', p_event_id: 'evt_1' }),
    );
  });

  it('sends empty object body when params are omitted', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: true });
    const client = createApiClient({ transport, config: baseConfig });

    await client.rpc('mdjb_ensure_mine');

    expect(transport.calls[0]?.bodyText).toBe('{}');
  });

  it('trims exterior slashes from valid function names', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    const client = createApiClient({ transport, config: baseConfig });

    await client.rpc('/create_invoice/');

    expect(transport.calls[0]?.url).toBe('https://example.supabase.co/rest/v1/rpc/create_invoice');
  });

  it.each(['', '   ', '..', 'https://evil.example/rpc', 'schema/nested_fn', 'fn?x=1', 'fn#frag', 'bad name'])(
    'rejects invalid function name %j without transport call',
    async (functionName) => {
      bootDeps();
      const transport = createMemoryTransport();
      const client = createApiClient({ transport, config: baseConfig });

      const result = await client.rpc(functionName);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('API_INVALID_PAYLOAD');
      }
      expect(transport.calls).toHaveLength(0);
    },
  );

  it('does not retry rpc POST failures by default', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'network-error' });
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    const client = createApiClient({ transport, config: baseConfig });

    await client.rpc('mdj_identity_snapshot');
    expect(transport.calls).toHaveLength(1);
  });

  it('uses 15s default timeout when caller does not override', async () => {
    bootDeps();
    const transport = createMockTransport((input) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(mockResponse(200, { ok: true })), 30_000);
        input.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new Error('transport aborted'));
          },
          { once: true },
        );
      });
    });
    const client = createApiClient({ transport, config: baseConfig });

    const started = Date.now();
    const result = await client.rpc('mdj_identity_snapshot');
    const elapsed = Date.now() - started;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_TIMEOUT');
      expect(result.error.status).toBe(0);
    }
    expect(elapsed).toBeGreaterThanOrEqual(14_000);
    expect(elapsed).toBeLessThan(18_000);
    expect(transport.calls).toHaveLength(1);
  }, 25_000);

  it('respects explicit timeoutMs override', async () => {
    bootDeps();
    const transport = createMockTransport(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return mockResponse(200, { ok: true });
    });
    const client = createApiClient({ transport, config: baseConfig });

    const result = await client.rpc('mdj_identity_snapshot', {}, { timeoutMs: 10 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_TIMEOUT');
      expect(result.error.status).toBe(0);
    }
  });

  it.each([
    [401, 'API_HTTP_ERROR'],
    [403, 'API_HTTP_ERROR'],
    [429, 'API_RATE_LIMITED'],
    [500, 'API_HTTP_ERROR'],
  ] as const)('maps HTTP %i to %s via existing normalization', async (status, code) => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status,
      body: { message: 'rpc-failure', code: 'PGRST116' },
    });
    const client = createApiClient({ transport, config: baseConfig });

    const result = await client.rpc('mdj_identity_snapshot');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(code);
      expect(result.error.status).toBe(status);
    }
  });

  it('maps cancel(requestId) to API_CANCELLED', async () => {
    bootDeps();
    const transport = createMockTransport((input) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(mockResponse(200, { ok: true })), 100);
        input.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
          },
          { once: true },
        );
      });
    });
    const client = createApiClient({ transport, config: baseConfig });

    const pending = client.rpc('mdj_identity_snapshot');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const requestId = transport.calls[0]?.requestId;
    expect(requestId).toBeTruthy();
    client.cancel(requestId!);
    const result = await pending;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_CANCELLED');
    }
  });
});

describe('sanitizeRpcFunctionName', () => {
  it('accepts canonical RPC function names', () => {
    expect(sanitizeRpcFunctionName('create_invoice')).toEqual({ ok: true, name: 'create_invoice' });
    expect(sanitizeRpcFunctionName('release_cash_movement')).toEqual({
      ok: true,
      name: 'release_cash_movement',
    });
    expect(sanitizeRpcFunctionName('/create_invoice/')).toEqual({ ok: true, name: 'create_invoice' });
    expect(sanitizeRpcFunctionName('mdj-validate-code')).toEqual({ ok: true, name: 'mdj-validate-code' });
  });

  it('rejects unsafe names', () => {
    expect(sanitizeRpcFunctionName('')).toMatchObject({ ok: false });
    expect(sanitizeRpcFunctionName('foo/bar')).toMatchObject({ ok: false });
    expect(sanitizeRpcFunctionName('https://evil.example/fn')).toMatchObject({ ok: false });
    expect(sanitizeRpcFunctionName('fn?query=1')).toMatchObject({ ok: false });
    expect(sanitizeRpcFunctionName('fn with space')).toMatchObject({ ok: false });
  });
});
