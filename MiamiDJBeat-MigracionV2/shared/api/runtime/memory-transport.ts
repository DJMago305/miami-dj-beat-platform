/** MOD-005 API Client — memory transport — TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001 */

import {
  TransportCancelledError,
  TransportNetworkError,
  type TransportInput,
  type TransportPort,
  type TransportResult,
} from './transport-port';

export type MemoryTransportEntry =
  | {
      readonly kind: 'response';
      readonly status: number;
      readonly body?: unknown;
      readonly headers?: Readonly<Record<string, string>>;
      readonly delayMs?: number;
    }
  | {
      readonly kind: 'network-error';
      readonly message?: string;
      readonly delayMs?: number;
    };

export class MemoryTransport implements TransportPort {
  private readonly queue: MemoryTransportEntry[] = [];
  readonly calls: TransportInput[] = [];

  enqueue(entry: MemoryTransportEntry): void {
    this.queue.push(entry);
  }

  reset(): void {
    this.queue.length = 0;
    this.calls.length = 0;
  }

  async execute(input: TransportInput): Promise<TransportResult> {
    this.calls.push(input);

    if (input.signal?.aborted) {
      throw new TransportCancelledError();
    }

    const entry = this.queue.shift();
    if (!entry) {
      throw new TransportNetworkError('MemoryTransport queue exhausted.');
    }

    if (entry.delayMs && entry.delayMs > 0) {
      await delay(entry.delayMs, input.signal);
    }

    if (input.signal?.aborted) {
      throw new TransportCancelledError();
    }

    if (entry.kind === 'network-error') {
      throw new TransportNetworkError(entry.message ?? 'Simulated network failure.');
    }

    const bodyText =
      entry.body === undefined
        ? ''
        : typeof entry.body === 'string'
          ? entry.body
          : JSON.stringify(entry.body);

    return {
      status: entry.status,
      headers: Object.freeze({ ...(entry.headers ?? { 'content-type': 'application/json' }) }),
      bodyText,
      durationMs: entry.delayMs ?? 0,
    };
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new TransportCancelledError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new TransportCancelledError());
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function createMemoryTransport(): MemoryTransport {
  return new MemoryTransport();
}
