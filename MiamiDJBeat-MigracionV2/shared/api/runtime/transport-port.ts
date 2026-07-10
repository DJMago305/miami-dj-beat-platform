/** MOD-005 API Client — transport port — TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001 */

import type { ApiMethod } from './types';

export type TransportInput = {
  readonly requestId: string;
  readonly correlationId: string;
  readonly method: ApiMethod;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly bodyText: string | null;
  readonly signal?: AbortSignal;
};

export type TransportResult = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly bodyText: string;
  readonly durationMs: number;
};

export type TransportPort = {
  execute(input: TransportInput): Promise<TransportResult>;
};

export class TransportNetworkError extends Error {
  constructor(message = 'Transport network failure.') {
    super(message);
    this.name = 'TransportNetworkError';
  }
}

export class TransportCancelledError extends Error {
  constructor(message = 'Transport cancelled.') {
    super(message);
    this.name = 'TransportCancelledError';
  }
}
