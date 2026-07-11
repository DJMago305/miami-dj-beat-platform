import { describe, expect, it, vi } from 'vitest';
import {
  createApiClient,
  createFetchTransport,
  TransportCancelledError,
  TransportNetworkError,
  type TransportInput,
} from '../../shared/api/runtime';

function baseInput(overrides: Partial<TransportInput> = {}): TransportInput {
  return {
    requestId: 'req_00000001',
    correlationId: 'corr_00000001',
    method: 'GET',
    url: 'https://example.supabase.co/rest/v1/items',
    headers: { Accept: 'application/json' },
    bodyText: null,
    ...overrides,
  };
}

function mockFetchResponse(
  init: {
    status?: number;
    body?: string;
    headers?: Record<string, string>;
  } = {},
): typeof fetch {
  const status = init.status ?? 200;
  const body = init.body ?? '';
  const headers = new Headers(init.headers ?? { 'content-type': 'application/json' });

  return vi.fn(async () => {
    if (status === 204) {
      return new Response(null, { status: 204, headers });
    }
    return new Response(body, { status, headers });
  }) as typeof fetch;
}

describe('MOD-005 FetchTransport — TICKET-V2-PHASE-6-FETCH-TRANSPORT-IMPLEMENTATION-001', () => {
  it('returns 200 JSON as bodyText and status', async () => {
    const fetchFn = mockFetchResponse({ status: 200, body: '{"items":[1]}' });
    const transport = createFetchTransport({ fetchFn });

    const result = await transport.execute(baseInput());

    expect(result.status).toBe(200);
    expect(result.bodyText).toBe('{"items":[1]}');
    expect(result.headers['content-type']).toBe('application/json');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/items',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
        body: undefined,
      }),
    );
  });

  it('returns 204 with empty bodyText', async () => {
    const fetchFn = mockFetchResponse({ status: 204, body: '' });
    const transport = createFetchTransport({ fetchFn });

    const result = await transport.execute(baseInput({ method: 'DELETE' }));

    expect(result.status).toBe(204);
    expect(result.bodyText).toBe('');
  });

  it('returns HTTP 500 without throwing', async () => {
    const fetchFn = mockFetchResponse({ status: 500, body: '{"error":"down"}' });
    const transport = createFetchTransport({ fetchFn });

    const result = await transport.execute(baseInput());

    expect(result.status).toBe(500);
    expect(result.bodyText).toBe('{"error":"down"}');
  });

  it('maps network TypeError to TransportNetworkError', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const transport = createFetchTransport({ fetchFn });

    await expect(transport.execute(baseInput())).rejects.toBeInstanceOf(TransportNetworkError);
    await expect(transport.execute(baseInput())).rejects.toThrow('Failed to fetch');
  });

  it('maps aborted signal to TransportCancelledError', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchFn = mockFetchResponse();
    const transport = createFetchTransport({ fetchFn });

    await expect(transport.execute(baseInput({ signal: controller.signal }))).rejects.toBeInstanceOf(
      TransportCancelledError,
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('maps fetch AbortError to TransportCancelledError', async () => {
    const fetchFn = vi.fn(async (_url, init) => {
      if (init?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    const transport = createFetchTransport({ fetchFn });
    const controller = new AbortController();
    controller.abort();

    await expect(transport.execute(baseInput({ signal: controller.signal }))).rejects.toBeInstanceOf(
      TransportCancelledError,
    );
  });

  it('copies response headers into a frozen record', async () => {
    const fetchFn = mockFetchResponse({
      status: 200,
      body: '{}',
      headers: { 'content-type': 'application/json', 'x-request-id': 'edge-1' },
    });
    const transport = createFetchTransport({ fetchFn });

    const result = await transport.execute(baseInput());

    expect(result.headers).toEqual({
      'content-type': 'application/json',
      'x-request-id': 'edge-1',
    });
    expect(Object.isFrozen(result.headers)).toBe(true);
  });

  it('passes POST bodyText to fetch', async () => {
    const fetchFn = mockFetchResponse({ status: 201, body: '{"ok":true}' });
    const transport = createFetchTransport({ fetchFn });

    await transport.execute(
      baseInput({
        method: 'POST',
        bodyText: '{"name":"test"}',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }),
    );

    expect(fetchFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: '{"name":"test"}' }),
    );
  });

  it('integrates with ApiClient through injected fetchFn', async () => {
    const fetchFn = mockFetchResponse({ status: 200, body: '{"via":"fetch"}' });
    const client = createApiClient({
      transport: createFetchTransport({ fetchFn }),
      config: { baseUrl: 'https://example.supabase.co' },
    });

    const result = await client.get<{ via: string }>('/rest/v1/items');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.via).toBe('fetch');
    }
  });

  it('cancels in-flight ApiClient request through FetchTransport as API_CANCELLED — TICKET-V2-PHASE-6-FETCH-TRANSPORT-QA-INTEGRATION-001', async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchFn = vi.fn((_url, init) => {
      capturedSignal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        const onAbort = () => {
          reject(new DOMException('Aborted', 'AbortError'));
        };
        if (init?.signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        init?.signal?.addEventListener('abort', onAbort, { once: true });
      });
    }) as typeof fetch;

    const client = createApiClient({
      transport: createFetchTransport({ fetchFn }),
      config: { baseUrl: 'https://example.supabase.co' },
    });

    const pending = client.get('/rest/v1/slow');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchFn).toHaveBeenCalled();
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    client.cancelAll();

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_CANCELLED');
      expect(result.error.status).toBe(0);
    }
    expect(capturedSignal?.aborted).toBe(true);
  });
});
