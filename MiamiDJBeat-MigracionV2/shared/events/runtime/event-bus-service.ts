/** MOD-004 Event Bus — in-memory service — TICKET-V2-RUNTIME-EVENT-BUS-001 */

import { EventBusError, isEventBusError } from './errors';
import type {
  BusLifecycleState,
  EventBusPublicApi,
  EventEnvelope,
  EventHandler,
  PublishInput,
  PublishResult,
  SubscribeOptions,
  SubscriptionRef,
} from './types';
import { EVENT_BUS_VERSION } from './types';
import { validatePublishInput } from './validate';

const MAX_HISTORY = 100;

let lifecycleState: BusLifecycleState = 'BUS_UNINITIALIZED';
let subscriptionCounter = 0;
let eventIdCounter = 0;

const listenerRegistry = new Map<string, SubscriptionRef[]>();
const subscriptionsById = new Map<string, SubscriptionRef>();
const emittedFlags = new Map<string, boolean>();
const lastEnvelopeByName = new Map<string, EventEnvelope>();
const onceCorrelationIds = new Set<string>();
const eventHistory: EventEnvelope[] = [];
const handlerErrors: EventBusError[] = [];

const dispatchQueue: EventEnvelope[] = [];
let isDispatching = false;

function nextSubscriptionId(): string {
  subscriptionCounter += 1;
  return `sub_${String(subscriptionCounter)}`;
}

function nextEventId(): string {
  eventIdCounter += 1;
  return `evt_${String(eventIdCounter).padStart(8, '0')}`;
}

function createFailure(code: EventBusError['code'], message: string): PublishResult {
  return { ok: false, code, message };
}

function recordHistory(envelope: EventEnvelope): void {
  eventHistory.push(envelope);
  if (eventHistory.length > MAX_HISTORY) {
    eventHistory.shift();
  }
}

function removeSubscription(subscription: SubscriptionRef): void {
  subscriptionsById.delete(subscription.id);
  const listeners = listenerRegistry.get(subscription.name);
  if (!listeners) {
    return;
  }
  const next = listeners.filter((item) => item.id !== subscription.id);
  if (next.length === 0) {
    listenerRegistry.delete(subscription.name);
  } else {
    listenerRegistry.set(subscription.name, next);
  }
}

function invokeHandler(subscription: SubscriptionRef, envelope: EventEnvelope): void {
  try {
    subscription.handler(envelope);
  } catch (error) {
    const handlerError = new EventBusError(
      'EVENT_HANDLER_THROW',
      error instanceof Error ? error.message : 'Event handler threw an unknown error.',
    );
    handlerErrors.push(handlerError);
  } finally {
    if (subscription.once) {
      removeSubscription(subscription);
    }
  }
}

function runCatchUp(subscription: SubscriptionRef): void {
  if (!emittedFlags.get(subscription.name)) {
    return;
  }

  const lastEnvelope = lastEnvelopeByName.get(subscription.name);
  if (!lastEnvelope) {
    return;
  }

  if (subscription.version !== undefined && subscription.version !== lastEnvelope.version) {
    return;
  }

  invokeHandler(subscription, lastEnvelope);
}

function dispatchToListeners(envelope: EventEnvelope): void {
  const listeners = listenerRegistry.get(envelope.name) ?? [];
  const snapshot = [...listeners];

  for (const subscription of snapshot) {
    if (subscription.version !== undefined && subscription.version !== envelope.version) {
      continue;
    }

    if (!subscriptionsById.has(subscription.id)) {
      continue;
    }

    invokeHandler(subscription, envelope);
  }
}

function processDispatchQueue(): void {
  isDispatching = true;
  while (dispatchQueue.length > 0) {
    const envelope = dispatchQueue.shift();
    if (!envelope) {
      continue;
    }
    dispatchToListeners(envelope);
    recordHistory(envelope);
  }
  isDispatching = false;
}

function enqueueDispatch(envelope: EventEnvelope): void {
  dispatchQueue.push(envelope);
  if (!isDispatching) {
    processDispatchQueue();
  }
}

function internalPublish(input: PublishInput): PublishResult {
  if (lifecycleState !== 'BUS_READY') {
    return createFailure(
      'EVENT_BUS_NOT_READY',
      `Cannot publish "${input.name}" while bus is ${lifecycleState}.`,
    );
  }

  try {
    const { entry, version, scope } = validatePublishInput(input);

    if (entry.onceEligible && input.correlationId) {
      const duplicateKey = `${entry.name}:${input.correlationId}`;
      if (onceCorrelationIds.has(duplicateKey)) {
        return createFailure(
          'EVENT_DUPLICATE_ONCE',
          `Duplicate correlationId for once-eligible event "${entry.name}".`,
        );
      }
    }

    const envelope: EventEnvelope = Object.freeze({
      eventId: nextEventId(),
      name: entry.name,
      version,
      timestamp: new Date().toISOString(),
      emitter: Object.freeze({ ...input.emitter }),
      scope,
      payload: Object.freeze({ ...input.payload }),
      ...(input.correlationId ? { correlationId: input.correlationId } : {}),
      ...(input.meta ? { meta: Object.freeze({ ...input.meta }) } : {}),
    });

    if (entry.onceEligible && input.correlationId) {
      onceCorrelationIds.add(`${entry.name}:${input.correlationId}`);
    }

    emittedFlags.set(entry.name, true);
    lastEnvelopeByName.set(entry.name, envelope);
    enqueueDispatch(envelope);

    return { ok: true, envelope };
  } catch (error) {
    if (isEventBusError(error)) {
      return createFailure(error.code, error.message);
    }
    return createFailure('EVENT_EMIT_REJECTED', 'Event publish rejected.');
  }
}

function internalSubscribe(
  name: string,
  handler: EventHandler,
  options: SubscribeOptions | undefined,
  once: boolean,
): string {
  if (lifecycleState !== 'BUS_READY') {
    throw new EventBusError(
      'EVENT_BUS_NOT_READY',
      `Cannot subscribe to "${name}" while bus is ${lifecycleState}.`,
    );
  }

  const subscription: SubscriptionRef = {
    id: nextSubscriptionId(),
    name,
    handler,
    version: options?.version,
    once,
  };

  const listeners = listenerRegistry.get(name) ?? [];
  listeners.push(subscription);
  listenerRegistry.set(name, listeners);
  subscriptionsById.set(subscription.id, subscription);

  runCatchUp(subscription);

  return subscription.id;
}

function internalUnsubscribe(subscriptionId: string): boolean {
  const subscription = subscriptionsById.get(subscriptionId);
  if (!subscription) {
    return false;
  }
  removeSubscription(subscription);
  return true;
}

function internalClear(eventName?: string): void {
  if (eventName) {
    const listeners = listenerRegistry.get(eventName) ?? [];
    for (const subscription of listeners) {
      subscriptionsById.delete(subscription.id);
    }
    listenerRegistry.delete(eventName);
    return;
  }

  listenerRegistry.clear();
  subscriptionsById.clear();
}

function internalDestroy(): void {
  internalClear();
  emittedFlags.clear();
  lastEnvelopeByName.clear();
  onceCorrelationIds.clear();
  eventHistory.length = 0;
  handlerErrors.length = 0;
  dispatchQueue.length = 0;
  lifecycleState = 'BUS_SHUTDOWN';
}

function buildPublicApi(): EventBusPublicApi {
  return Object.freeze({
    publish: internalPublish,
    subscribe: (name, handler, options) => internalSubscribe(name, handler, options, false),
    unsubscribe: internalUnsubscribe,
    once: (name, handler, options) => internalSubscribe(name, handler, options, true),
    clear: internalClear,
    destroy: internalDestroy,
    getState: () => lifecycleState,
    getHistory: () => Object.freeze([...eventHistory]),
  });
}

let frozenApi: EventBusPublicApi | null = null;

/** BOOT → REGISTER_CATALOG → BUS_READY (+ BUS_READY internal event) */
export function initializeEventBus(): EventBusPublicApi {
  if (lifecycleState === 'BUS_READY' && frozenApi) {
    return frozenApi;
  }

  if (lifecycleState === 'BUS_SHUTDOWN') {
    throw new EventBusError('EVENT_BUS_NOT_READY', 'Event Bus has been destroyed.');
  }

  lifecycleState = 'BUS_READY';
  frozenApi = buildPublicApi();

  const readyResult = frozenApi.publish({
    name: 'BUS_READY',
    payload: { busVersion: EVENT_BUS_VERSION },
    emitter: { moduleId: 'MOD-004', subsystem: 'boot' },
    scope: 'internal',
  });

  if (!readyResult.ok) {
    lifecycleState = 'BUS_UNINITIALIZED';
    frozenApi = null;
    throw new EventBusError(readyResult.code, readyResult.message);
  }

  return frozenApi;
}

export function getEventBus(): EventBusPublicApi {
  if (!frozenApi || lifecycleState !== 'BUS_READY') {
    throw new EventBusError(
      'EVENT_BUS_NOT_READY',
      'Event Bus is not initialized. Call initializeEventBus() during boot.',
    );
  }
  return frozenApi;
}

export function getEventBusState(): BusLifecycleState {
  return lifecycleState;
}

/** Test-only diagnostics — handler throws recorded without console output. */
export function getEventBusHandlerErrorsForTests(): readonly EventBusError[] {
  return [...handlerErrors];
}

/** Test-only reset — not for production portals. */
export function resetEventBusForTests(): void {
  internalDestroy();
  lifecycleState = 'BUS_UNINITIALIZED';
  frozenApi = null;
  subscriptionCounter = 0;
  eventIdCounter = 0;
  handlerErrors.length = 0;
  dispatchQueue.length = 0;
  isDispatching = false;
}
