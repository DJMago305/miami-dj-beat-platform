import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { getLogger, initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  getSessionSnapshot,
  initializeSession,
  resetSessionForTests,
} from '@mdj/shared/session';
import {
  buildUrl,
  createApiClient,
  createMemoryTransport,
  createMockTransport,
  createSessionReaderFromSnapshot,
  createStaticSessionReader,
  getApiClient,
  initializeApiClient,
  mockResponse,
  normalizeUnknownFailure,
  resetApiClientForTests,
  resetApiRequestCounterForTests,
} from '../../shared/api/runtime';
import {
  REDACT_MAX_DEPTH,
  isSensitiveDataKey,
  isSensitiveHeaderName,
  redactHeaders,
  redactRequestMeta,
} from '../../shared/api/runtime/redact';

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

describe('MOD-005 API Client foundation — TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    resetApiRequestCounterForTests();
  });

  it('GET success', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { items: [1] } });

    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co' },
    });

    const result = await client.get<{ items: number[] }>('/rest/v1/items');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.data.items).toEqual([1]);
    }
    expect(transport.calls).toHaveLength(1);
  });

  it('POST success', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 201, body: { id: 'ord_1' } });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.post('/rest/v1/orders', { total: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(201);
      expect(result.data).toEqual({ id: 'ord_1' });
    }
  });

  it('PUT success', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { updated: true } });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.put('/rest/v1/profile', { name: 'DJ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ updated: true });
    }
  });

  it('DELETE success', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 204, body: null });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.delete('/rest/v1/items/1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(204);
    }
  });

  it('maps HTTP 400', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 400, body: { error: 'bad-input', detail: 'invalid' } });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.post('/functions/v1/checkout');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(400);
      expect(result.error.code).toBe('API_HTTP_ERROR');
      expect(result.error.message).toBeTruthy();
      expect(result.error.details).toBeTruthy();
    }
  });

  it.each([
    [401, 'Unauthorized.'],
    [403, 'Forbidden.'],
    [404, 'Resource not found.'],
    [409, 'Conflict.'],
  ])('maps HTTP %i', async (status, message) => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status, body: { error: 'denied' } });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.get('/secure');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(status);
      expect(result.error.message).toBe(message);
    }
  });

  it('maps HTTP 422 as API_EDGE_REJECTED', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 422, body: { error: 'validation', detail: 'field-x' } });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.post('/functions/v1/validate');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_EDGE_REJECTED');
      expect(result.error.status).toBe(422);
    }
  });

  it('maps HTTP 500', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 500, body: { error: 'server' } });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.get('/unstable', {
      retryPolicy: { maxAttempts: 1, backoffMs: [0], retryOn: ['API_NETWORK'], jitter: false },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(500);
      expect(result.error.code).toBe('API_HTTP_ERROR');
    }
  });

  it('handles timeout', async () => {
    bootDeps();
    const transport = createMockTransport(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return mockResponse(200, { late: true });
    });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.get('/slow', { timeoutMs: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_TIMEOUT');
      expect(result.error.status).toBe(0);
      expect(result.error.details).toBeNull();
    }
  });

  it('handles cancellation via AbortSignal', async () => {
    bootDeps();
    const controller = new AbortController();
    const transport = createMockTransport(async (input) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      if (input.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      return mockResponse(200, { ok: true });
    });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    setTimeout(() => controller.abort(), 5);
    const result = await client.get('/cancel-me', { signal: controller.signal });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_CANCELLED');
    }
  });

  it('handles cancel(requestId)', async () => {
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
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const pending = client.get('/blocked');
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

  it('retries when eligible and eventually succeeds', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'network-error' });
    transport.enqueue({ kind: 'network-error' });
    transport.enqueue({ kind: 'response', status: 200, body: { retried: true } });

    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });
    const result = await client.get('/retry-ok');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata.attempt).toBe(3);
      expect(result.metadata.correlationId).toBeTruthy();
      expect(result.data).toEqual({ retried: true });
    }
    expect(transport.calls.length).toBe(3);
  });

  it('stops retrying when attempts are exhausted', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'network-error' });
    transport.enqueue({ kind: 'network-error' });
    transport.enqueue({ kind: 'network-error' });

    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });
    const result = await client.get('/retry-fail');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_NETWORK');
      expect(result.metadata.attempt).toBe(3);
    }
    expect(transport.calls.length).toBe(3);
  });

  it('does not retry POST without retrySafe', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'network-error' });
    transport.enqueue({ kind: 'response', status: 200, body: { should: 'not-reach' } });

    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });
    const result = await client.post('/mutate');

    expect(result.ok).toBe(false);
    expect(transport.calls.length).toBe(1);
  });

  it('handles network failure', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'network-error', message: 'offline' });
    transport.enqueue({ kind: 'network-error', message: 'offline' });
    transport.enqueue({ kind: 'network-error', message: 'offline' });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.get('/offline', {
      retryPolicy: { maxAttempts: 1, backoffMs: [0], retryOn: ['API_NETWORK'], jitter: false },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_NETWORK');
      expect(result.error.message).toContain('offline');
      expect(result.error.status).toBe(0);
    }
  });

  it('rejects invalid payload before transport', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const result = await client.post('/bad-body', circular);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_INVALID_PAYLOAD');
    }
    expect(transport.calls).toHaveLength(0);
  });

  it('maps invalid JSON response', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: '{not-json' });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.get('/broken-json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_PARSE_ERROR');
    }
  });

  it('maps Edge-style 200 with business error flag', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { error: 'business-fail', detail: 'nope' } });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.post('/functions/v1/edge');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details).toBeTruthy();
    }
  });

  it('propagates request context from session reader', async () => {
    bootDeps();
    initializeSession({ portal: 'artist' });
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });

    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co' },
      sessionReader: createSessionReaderFromSnapshot(() => getSessionSnapshot()),
    });

    const result = await client.get('/context');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata.context.portal).toBe('artist');
      expect(result.metadata.context.sessionId).toMatch(/^ses_/);
      expect(result.metadata.context.actorType).toBe('guest');
      expect(result.metadata.context.correlationId).toBeTruthy();
      expect(result.metadata.context.requestId).toMatch(/^req_/);
    }
    expect(transport.calls[0]?.headers['X-Client-Portal']).toBe('artist');
  });

  it('redacts sensitive authorization data in logs while injecting transport header', async () => {
    bootDeps();
    const logger = getLogger();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });

    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co' },
      logger,
      sessionReader: createStaticSessionReader({
        portal: 'client',
        sessionId: 'ses_test',
        authorizationHeader: 'Bearer super-secret-token',
        actorType: 'authenticated',
      }),
    });

    await client.get('/secure');
    expect(transport.calls[0]?.headers.Authorization).toBe('Bearer super-secret-token');

    const redacted = redactHeaders({ Authorization: 'Bearer super-secret-token' });
    expect(redacted.Authorization).toBe('[REDACTED]');

    const history = logger.getHistory();
    const apiLog = history.find((entry) => entry.message === 'API request settled');
    expect(apiLog).toBeTruthy();
    expect(JSON.stringify(apiLog)).not.toContain('super-secret-token');
  });

  it('uses only injected transport without external fetch', async () => {
    bootDeps();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { local: true } });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    await client.get('/local-only');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('cancelAll aborts in-flight requests', async () => {
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
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const pending = client.get('/one');
    await new Promise((resolve) => setTimeout(resolve, 0));
    client.cancelAll();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_CANCELLED');
    }
  });

  it('resetApiClientForTests aborts pending requests before clearing singleton', async () => {
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

    initializeApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });
    const pending = getApiClient().get('/pending-reset');
    await new Promise((resolve) => setTimeout(resolve, 0));

    resetApiClientForTests();

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_CANCELLED');
    }
  });
});

describe('MOD-005 API Client — audit contracts', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    resetApiRequestCounterForTests();
  });

  it('resolves base URL from MOD-006 getConfig() when config omitted', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { via: 'config' } });
    const client = createApiClient({ transport });

    await client.get('/from-config');
    expect(transport.calls[0]?.url).toBe('https://example.supabase.co/from-config');
  });

  it('normalizes base URL and path slashes without double slashes', () => {
    expect(buildUrl('https://example.supabase.co/', '/rest/v1/items')).toBe(
      'https://example.supabase.co/rest/v1/items',
    );
    expect(buildUrl('https://example.supabase.co', 'rest/v1/items')).toBe(
      'https://example.supabase.co/rest/v1/items',
    );
    expect(buildUrl('https://example.supabase.co/', '/items', { q: 'a b', n: 1 })).toBe(
      'https://example.supabase.co/items?q=a+b&n=1',
    );
  });

  it('returns 204 with null data', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 204, body: null });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.delete('/items/1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(204);
      expect(result.data).toBeNull();
    }
  });

  it('maps plain-text 200 body as API_PARSE_ERROR', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: 'plain-text-response',
      headers: { 'content-type': 'text/plain' },
    });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const result = await client.get('/text');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_PARSE_ERROR');
    }
  });

  it('maps unknown failure helper with status 0', () => {
    const error = normalizeUnknownFailure('unexpected');
    expect(error).toEqual({
      code: 'API_UNKNOWN',
      message: 'unexpected',
      details: null,
      status: 0,
    });
  });

  it('MemoryTransport empty queue surfaces API_NETWORK', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co' },
    });

    const result = await client.get('/empty-queue', {
      retryPolicy: { maxAttempts: 1, backoffMs: [0], retryOn: ['API_NETWORK'], jitter: false },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_NETWORK');
      expect(result.error.message).toContain('queue exhausted');
      expect(result.error.status).toBe(0);
    }
  });

  it('does not retry PUT without retrySafe', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'network-error' });
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    await client.put('/profile', { name: 'x' });
    expect(transport.calls).toHaveLength(1);
  });

  it('retries GET 500 and stops after maxAttempts', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 500, body: { error: 'down' } });
    transport.enqueue({ kind: 'response', status: 500, body: { error: 'down' } });
    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co' },
    });

    const result = await client.get('/unstable', {
      retryPolicy: { maxAttempts: 2, backoffMs: [0], retryOn: ['API_NETWORK'], jitter: false },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(500);
      expect(result.metadata.attempt).toBe(2);
    }
    expect(transport.calls).toHaveLength(2);
  });

  it('does not retry HTTP 401 on GET', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 401, body: { error: 'auth' } });
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    await client.get('/secure');
    expect(transport.calls).toHaveLength(1);
  });

  it('cancels during retry backoff without starting next attempt', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'network-error' });
    transport.enqueue({ kind: 'response', status: 200, body: { ok: true } });

    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });
    const pending = client.get('/retry-cancel', {
      retryPolicy: { maxAttempts: 3, backoffMs: [200], retryOn: ['API_NETWORK'], jitter: false },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    const requestId = transport.calls[0]?.requestId;
    client.cancel(requestId!);

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_CANCELLED');
    }
    expect(transport.calls).toHaveLength(1);
  });

  it('cancel(requestId) does not cancel a different in-flight request', async () => {
    bootDeps();
    const transport = createMockTransport((input) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(mockResponse(200, { path: input.url })), 40);
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
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const first = client.get('/one');
    const second = client.get('/two');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const firstId = transport.calls[0]?.requestId;
    const secondId = transport.calls[1]?.requestId;
    expect(firstId).not.toBe(secondId);
    client.cancel(firstId!);

    const firstResult = await first;
    const secondResult = await second;

    expect(firstResult.ok).toBe(false);
    if (!firstResult.ok) {
      expect(firstResult.error.code).toBe('API_CANCELLED');
    }
    expect(secondResult.ok).toBe(true);
  });

  it('supports two concurrent successful requests with isolated transport calls', async () => {
    bootDeps();
    const transport = createMemoryTransport();
    transport.enqueue({ kind: 'response', status: 200, body: { n: 1 } });
    transport.enqueue({ kind: 'response', status: 200, body: { n: 2 } });
    const client = createApiClient({ transport, config: { baseUrl: 'https://example.supabase.co' } });

    const [a, b] = await Promise.all([client.get('/a'), client.get('/b')]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(transport.calls).toHaveLength(2);
    expect(transport.calls[0]?.url).toContain('/a');
    expect(transport.calls[1]?.url).toContain('/b');
  });

  it('redacts nested sensitive keys without mutating source object', () => {
    const source = {
      nested: { accessToken: 'secret-value', safe: 'ok' },
      metadata: [{ refreshToken: 'rt' }, { label: 'x' }],
      Authorization: 'Bearer abc',
    };
    const snapshot = JSON.parse(JSON.stringify(source)) as typeof source;
    const redacted = redactRequestMeta(source as Record<string, unknown>);

    expect((redacted.nested as Record<string, unknown>).accessToken).toBe('[REDACTED]');
    expect((redacted.metadata as Array<Record<string, unknown>>)[0]?.refreshToken).toBe('[REDACTED]');
    expect(redacted.Authorization).toBe('[REDACTED]');
    expect(source.nested.accessToken).toBe('secret-value');
    expect(snapshot).toEqual(source);
    expect(JSON.stringify(redacted)).not.toContain('secret-value');
    expect(JSON.stringify(redacted)).not.toContain('Bearer abc');
  });
});

describe('MOD-005 API Client — security redaction — TICKET-V2-PHASE-4-MOD-005-SECURITY-CORRECTION-001', () => {
  it.each([
    ['Set-Cookie', 'sid=opaque'],
    ['set-cookie', 'sid=opaque'],
    ['SET-COOKIE', 'sid=opaque'],
    ['Cookie', 'c=opaque'],
    ['authorization', 'Bearer opaque'],
    ['X-API-KEY', 'opaque'],
    ['Api-Key', 'opaque'],
    ['Proxy-Authorization', 'opaque'],
  ])('redacts sensitive header %s case-insensitively', (headerName) => {
    const headers = { [headerName]: 'sensitive-value' };
    const redacted = redactHeaders(headers);
    expect(redacted[headerName]).toBe('[REDACTED]');
    expect(headers[headerName]).toBe('sensitive-value');
    expect(isSensitiveHeaderName(headerName)).toBe(true);
  });

  it.each([
    'anonKey',
    'anon_key',
    'anonymousKey',
    'apiKey',
    'api_key',
    'clientSecret',
    'serviceRoleKey',
  ])('redacts sensitive data key %s in nested metadata', (keyName) => {
    const source = { payload: { [keyName]: 'sensitive-value', safe: 'ok' } };
    const redacted = redactRequestMeta(source as Record<string, unknown>);
    expect((redacted.payload as Record<string, unknown>)[keyName]).toBe('[REDACTED]');
    expect((source.payload as Record<string, unknown>)[keyName]).toBe('sensitive-value');
    expect(isSensitiveDataKey(keyName)).toBe(true);
  });

  it('does not redact innocent keys with ambiguous substrings', () => {
    const source = {
      tokenCount: 3,
      secretaryName: 'Ada',
      monkey: 'George',
      label: 'safe',
    };
    const redacted = redactRequestMeta(source as Record<string, unknown>);
    expect(redacted.tokenCount).toBe(3);
    expect(redacted.secretaryName).toBe('Ada');
    expect(redacted.monkey).toBe('George');
    expect(isSensitiveDataKey('tokenCount')).toBe(false);
    expect(isSensitiveDataKey('secretaryName')).toBe(false);
  });

  it('redacts arrays of objects and arrays nested inside objects', () => {
    const source = {
      headers: { Authorization: 'Bearer opaque', 'X-Trace': 'ok' },
      requestBody: { anonKey: 'opaque', items: [{ api_key: 'opaque' }, { name: 'ok' }] },
      errorDetails: { nested: { refreshToken: 'opaque', code: 'ERR' } },
    };
    const snapshot = JSON.parse(JSON.stringify(source)) as typeof source;
    const redacted = redactRequestMeta(source as Record<string, unknown>);

    expect((redacted.headers as Record<string, string>).Authorization).toBe('[REDACTED]');
    expect((redacted.requestBody as Record<string, unknown>).anonKey).toBe('[REDACTED]');
    expect(((redacted.requestBody as Record<string, unknown>).items as Array<Record<string, unknown>>)[0]?.api_key).toBe(
      '[REDACTED]',
    );
    expect(
      ((redacted.errorDetails as Record<string, unknown>).nested as Record<string, unknown>).refreshToken,
    ).toBe('[REDACTED]');
    expect(snapshot).toEqual(source);
    expect(JSON.stringify(redacted)).not.toContain('opaque');
  });

  it(`truncates nested structures beyond REDACT_MAX_DEPTH (${REDACT_MAX_DEPTH})`, () => {
    const deep = { l1: { l2: { l3: { l4: { l5: { secret: 'deep' } } } } } };
    const redacted = redactRequestMeta({ deep } as Record<string, unknown>);
    let cursor: unknown = (redacted.deep as Record<string, unknown>).l1;
    for (let depth = 1; depth < REDACT_MAX_DEPTH; depth += 1) {
      expect(cursor).toBeTypeOf('object');
      cursor = Object.values(cursor as Record<string, unknown>)[0];
    }
    expect(cursor).toBe('[TRUNCATED]');
  });
});
