import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { resetSessionForTests } from '@mdj/shared/session';
import {
  createApiClient,
  createMemoryTransport,
  createStaticSessionReader,
  mergeSupabaseInvokeCallerHeaders,
  resetApiRequestCounterForTests,
  resolveSupabaseInvokeHeaders,
  sanitizeEdgeFunctionName,
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

function bootDeps(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
}

describe('MOD-005 invokeEdge — TICKET-V2-PHASE-6-INVOKE-EDGE-IMPLEMENTATION-001', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    resetApiRequestCounterForTests();
  });

  it('POSTs to /functions/v1/{sanitizedName} on success', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: { ok: true, url: 'https://checkout.stripe.com/session' },
    });
    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });

    const result = await client.invokeEdge<{ ok: boolean; url: string }>('create-checkout', {
      success_url: 'https://example.com/ok',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.url).toContain('checkout.stripe.com');
    }
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.method).toBe('POST');
    expect(transport.calls[0]?.url).toBe('https://example.supabase.co/functions/v1/create-checkout');
    expect(transport.calls[0]?.bodyText).toContain('success_url');
  });

  it('allows optional body and trims function name slashes', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });

    const result = await client.invokeEdge('/notify-new-lead/');
    expect(result.ok).toBe(true);
    expect(transport.calls[0]?.url).toBe('https://example.supabase.co/functions/v1/notify-new-lead');
    expect(transport.calls[0]?.bodyText).toBeNull();
  });

  it('maps HTTP 422 as API_EDGE_REJECTED', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status: 422,
      body: { error: 'validation', detail: 'field-x' },
    });
    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });

    const result = await client.invokeEdge('validate-input', { field: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_EDGE_REJECTED');
      expect(result.error.status).toBe(422);
    }
  });

  it('maps business error payload on HTTP 200 as API_EDGE_REJECTED', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: { error: 'business-fail', detail: 'nope' },
    });
    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });

    const result = await client.invokeEdge('edge-fn');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_EDGE_REJECTED');
      expect(result.error.status).toBe(200);
    }
  });

  it.each(['', '   ', '..', 'https://evil.example/fn', 'foo/bar'])(
    'rejects invalid function name %j without transport call',
    async (functionName) => {
      bootDeps();
      const transport = createMemoryTransport();
      const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });

      const result = await client.invokeEdge(functionName);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('API_INVALID_PAYLOAD');
      }
      expect(transport.calls).toHaveLength(0);
    },
  );

  it('does not retry invokeEdge POST failures by default', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'network-error' });
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });

    await client.invokeEdge('create-checkout', { plan: 'pro' });
    expect(transport.calls).toHaveLength(1);
  });

  it('includes apikey on invokeEdge when anonKey is configured', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'YOUR_ANON_KEY' },
    });

    await client.invokeEdge('create-course-checkout');
    expect(transport.calls[0]?.headers.apikey).toBe('YOUR_ANON_KEY');
  });
});

describe('MOD-005 invokeEdge header policy — TICKET-V2-PHASE-6-EDGE-HEADER-POLICY-IMPLEMENTATION-001', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    resetApiRequestCounterForTests();
  });

  const anonKey = 'YOUR_ANON_KEY';
  const baseConfig = { baseUrl: 'https://example.supabase.co', anonKey };

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

  it('session mode with signed-in user sends session Authorization and apikey', async () => {
    bootDeps();
    const { client, transport } = clientWithSession('Bearer user-jwt-token');

    await client.invokeEdge('create-checkout', { plan: 'pro' });

    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer user-jwt-token');
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('session mode without session sends apikey only', async () => {
    bootDeps();
    const { client, transport } = clientWithSession(null);

    await client.invokeEdge('notify-new-lead');

    expect(transport.calls[0]?.headers.Authorization).toBeUndefined();
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('anon mode without session mirrors V1 mdjSupabaseAnonInvokeHeaders', async () => {
    bootDeps();
    const { client, transport } = clientWithSession(null);

    await client.invokeEdge('create-course-checkout', { success_url: 'https://example.com/ok' }, { authMode: 'anon' });

    expect(transport.calls[0]?.headers.Authorization).toBe(`Bearer ${anonKey}`);
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('anon mode with active session prefers session Authorization over anon bearer', async () => {
    bootDeps();
    const { client, transport } = clientWithSession('Bearer user-jwt-token');

    await client.invokeEdge('create-checkout', {}, { authMode: 'anon' });

    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer user-jwt-token');
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
  });

  it('strips caller-supplied Authorization and apikey before applying policy', async () => {
    bootDeps();
    const { client, transport } = clientWithSession('Bearer user-jwt-token');

    await client.invokeEdge(
      'create-checkout',
      {},
      {
        headers: {
          Authorization: 'Bearer caller-override',
          apikey: 'caller-key',
          'X-Trace': 'ok',
        },
      },
    );

    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer user-jwt-token');
    expect(transport.calls[0]?.headers.apikey).toBe(anonKey);
    expect(transport.calls[0]?.headers['X-Trace']).toBe('ok');
  });

  it('does not apply Supabase header policy to generic post()', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    const client = createApiClient({ transport, config: baseConfig });

    await client.post('/functions/v1/create-checkout', { plan: 'pro' });

    expect(transport.calls[0]?.headers.apikey).toBeUndefined();
    expect(transport.calls[0]?.headers.Authorization).toBeUndefined();
  });
});

describe('resolveSupabaseInvokeHeaders', () => {
  it('session mode with session authorization', () => {
    expect(
      resolveSupabaseInvokeHeaders({
        authMode: 'session',
        anonKey: 'anon-key',
        sessionAuthorization: 'Bearer user',
      }),
    ).toEqual({
      apikey: 'anon-key',
      Authorization: 'Bearer user',
    });
  });

  it('anon mode without session authorization', () => {
    expect(
      resolveSupabaseInvokeHeaders({
        authMode: 'anon',
        anonKey: 'anon-key',
        sessionAuthorization: null,
      }),
    ).toEqual({
      apikey: 'anon-key',
      Authorization: 'Bearer anon-key',
    });
  });
});

describe('mergeSupabaseInvokeCallerHeaders', () => {
  it('removes reserved headers and preserves unrelated caller headers', () => {
    expect(
      mergeSupabaseInvokeCallerHeaders(
        { Authorization: 'Bearer x', apikey: 'y', 'X-Trace': 'ok' },
        { apikey: 'policy-key', Authorization: 'Bearer policy' },
      ),
    ).toEqual({
      'X-Trace': 'ok',
      apikey: 'policy-key',
      Authorization: 'Bearer policy',
    });
  });
});

describe('sanitizeEdgeFunctionName', () => {
  it('accepts canonical edge function names', () => {
    expect(sanitizeEdgeFunctionName('create-checkout')).toEqual({ ok: true, name: 'create-checkout' });
    expect(sanitizeEdgeFunctionName('/create-checkout/')).toEqual({ ok: true, name: 'create-checkout' });
  });

  it('rejects unsafe names', () => {
    expect(sanitizeEdgeFunctionName('')).toMatchObject({ ok: false });
    expect(sanitizeEdgeFunctionName('../escape')).toMatchObject({ ok: false });
    expect(sanitizeEdgeFunctionName('https://evil.example/fn')).toMatchObject({ ok: false });
  });
});
