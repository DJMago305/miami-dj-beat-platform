/** MOD-004 Event Bus — public API — TICKET-V2-RUNTIME-EVENT-BUS-001 */

export { EventBusError, isEventBusError } from './errors';
export {
  getEventBus,
  getEventBusHandlerErrorsForTests,
  getEventBusState,
  initializeEventBus,
  resetEventBusForTests,
} from './event-bus-service';
export { EVENT_CATALOG } from './catalog';
export type {
  BusLifecycleState,
  EmitterRef,
  EventBusErrorCode,
  EventBusPublicApi,
  EventEnvelope,
  EventHandler,
  EventMeta,
  EventScope,
  PublishInput,
  PublishResult,
  SubscribeOptions,
} from './types';
export { EVENT_BUS_VERSION } from './types';
