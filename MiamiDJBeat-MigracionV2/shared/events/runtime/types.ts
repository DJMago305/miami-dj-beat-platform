/** MOD-004 Event Bus — types — TICKET-V2-RUNTIME-EVENT-BUS-001 */

export const EVENT_BUS_VERSION = '1.0.0';

export type BusLifecycleState =
  | 'BUS_UNINITIALIZED'
  | 'BUS_READY'
  | 'BUS_SUSPENDED'
  | 'BUS_SHUTDOWN';

export type EventScope = 'internal' | 'public';

export type PortalId = 'client' | 'artist' | 'staff';

export type EmitterRef = {
  moduleId: string;
  subsystem?: string;
};

export type EventMeta = {
  portal?: PortalId;
  userId?: string;
  env?: string;
};

export type EventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  eventId: string;
  name: string;
  version: number;
  timestamp: string;
  emitter: EmitterRef;
  scope: EventScope;
  payload: TPayload;
  correlationId?: string;
  meta?: EventMeta;
};

export type PublishInput = {
  name: string;
  payload: Record<string, unknown>;
  emitter: EmitterRef;
  scope?: EventScope;
  version?: number;
  correlationId?: string;
  meta?: EventMeta;
};

export type SubscribeOptions = {
  version?: number;
};

export type EventHandler = (envelope: EventEnvelope) => void;

export type SubscriptionRef = {
  id: string;
  name: string;
  handler: EventHandler;
  version?: number;
  once: boolean;
};

export type PublishSuccess = {
  ok: true;
  envelope: EventEnvelope;
};

export type PublishFailure = {
  ok: false;
  code: EventBusErrorCode;
  message: string;
};

export type PublishResult = PublishSuccess | PublishFailure;

export type EventBusErrorCode =
  | 'EVENT_UNKNOWN'
  | 'EVENT_UNAUTHORIZED_EMITTER'
  | 'EVENT_PAYLOAD_INVALID'
  | 'EVENT_HANDLER_THROW'
  | 'EVENT_DUPLICATE_ONCE'
  | 'EVENT_BUS_NOT_READY'
  | 'EVENT_EMIT_REJECTED'
  | 'EVENT_DUPLICATE_EMIT';

export type CatalogEntry = {
  name: string;
  scope: EventScope;
  authorizedEmitters: readonly string[];
  requiredPayloadKeys: readonly string[];
  onceEligible?: boolean;
  defaultVersion: number;
};

export type EventBusPublicApi = {
  readonly publish: (input: PublishInput) => PublishResult;
  readonly subscribe: (
    name: string,
    handler: EventHandler,
    options?: SubscribeOptions,
  ) => string;
  readonly unsubscribe: (subscriptionId: string) => boolean;
  readonly once: (name: string, handler: EventHandler, options?: SubscribeOptions) => string;
  readonly clear: (eventName?: string) => void;
  readonly destroy: () => void;
  readonly getState: () => BusLifecycleState;
  readonly getHistory: () => readonly EventEnvelope[];
};
