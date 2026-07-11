/** MOD-005 API Client — fetch transport — TICKET-V2-PHASE-6-FETCH-TRANSPORT-IMPLEMENTATION-001 */

import {
  TransportCancelledError,
  TransportNetworkError,
  type TransportInput,
  type TransportPort,
  type TransportResult,
} from './transport-port';

export type FetchTransportOptions = Readonly<{
  fetchFn?: typeof fetch;
}>;

export class FetchTransport implements TransportPort {
  private readonly fetchFn: typeof fetch;

  constructor(options?: FetchTransportOptions) {
    const resolved = options?.fetchFn ?? globalThis.fetch;
    if (typeof resolved !== 'function') {
      throw new Error('FetchTransport requires a fetch implementation.');
    }
    this.fetchFn = resolved.bind(globalThis);
  }

  async execute(input: TransportInput): Promise<TransportResult> {
    if (input.signal?.aborted) {
      throw new TransportCancelledError();
    }

    const startedAt = Date.now();

    try {
      const response = await this.fetchFn(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.bodyText ?? undefined,
        signal: input.signal,
      });

      if (input.signal?.aborted) {
        throw new TransportCancelledError();
      }

      const bodyText = await response.text();

      if (input.signal?.aborted) {
        throw new TransportCancelledError();
      }

      return {
        status: response.status,
        headers: freezeHeaders(response.headers),
        bodyText,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (isAbortError(error) || input.signal?.aborted) {
        throw new TransportCancelledError();
      }

      if (error instanceof TransportCancelledError || error instanceof TransportNetworkError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Transport network failure.';
      throw new TransportNetworkError(message);
    }
  }
}

export function createFetchTransport(options?: FetchTransportOptions): TransportPort {
  return new FetchTransport(options);
}

function freezeHeaders(headers: Headers): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return Object.freeze(out);
}

function isAbortError(error: unknown): boolean {
  if (error instanceof TransportCancelledError) {
    return true;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }
  return false;
}
