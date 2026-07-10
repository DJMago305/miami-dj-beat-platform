/** MOD-004 Event Bus — errors — TICKET-V2-RUNTIME-EVENT-BUS-001 */

import type { EventBusErrorCode } from './types';

export class EventBusError extends Error {
  readonly code: EventBusErrorCode;

  constructor(code: EventBusErrorCode, message: string) {
    super(message);
    this.name = 'EventBusError';
    this.code = code;
  }
}

export function isEventBusError(value: unknown): value is EventBusError {
  return value instanceof EventBusError;
}
