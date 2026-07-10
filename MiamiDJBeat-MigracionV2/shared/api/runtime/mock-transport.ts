/** MOD-005 API Client — mock transport — TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001 */

import {
  TransportCancelledError,
  TransportNetworkError,
  type TransportInput,
  type TransportPort,
  type TransportResult,
} from './transport-port';

export type MockTransportHandler = (input: TransportInput) => Promise<TransportResult> | TransportResult;

export class MockTransport implements TransportPort {
  private handler: MockTransportHandler;
  readonly calls: TransportInput[] = [];

  constructor(handler: MockTransportHandler) {
    this.handler = handler;
  }

  setHandler(handler: MockTransportHandler): void {
    this.handler = handler;
  }

  resetCalls(): void {
    this.calls.length = 0;
  }

  async execute(input: TransportInput): Promise<TransportResult> {
    this.calls.push(input);

    if (input.signal?.aborted) {
      throw new TransportCancelledError();
    }

    const result = await this.handler(input);
    if (input.signal?.aborted) {
      throw new TransportCancelledError();
    }
    return result;
  }
}

export function createMockTransport(handler: MockTransportHandler): MockTransport {
  return new MockTransport(handler);
}

export function mockResponse(
  status: number,
  body?: unknown,
  headers?: Readonly<Record<string, string>>,
): TransportResult {
  const bodyText =
    body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);

  return {
    status,
    headers: Object.freeze({ 'content-type': 'application/json', ...(headers ?? {}) }),
    bodyText,
    durationMs: 0,
  };
}

export function mockNetworkError(message?: string): never {
  throw new TransportNetworkError(message);
}
