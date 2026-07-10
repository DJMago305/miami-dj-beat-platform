/** MOD-RUNTIME — Event Bus wiring — TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 */

import { getEventBus } from '@mdj/shared/events';
import { getLogger } from '@mdj/shared/logging';
import { recordObservedRuntimeEvent, setRuntimeWiringState } from './state';

const RUNTIME_EMITTER = Object.freeze({ moduleId: 'MOD-RUNTIME', subsystem: 'event-wiring' });

let wiringRegistered = false;
const subscriptionIds: string[] = [];

const OBSERVED_EVENTS = [
  'BUS_READY',
  'SYSTEM_READY',
  'SESSION_READY',
  'THEME_READY',
  'PORTAL_READY',
  'DASHBOARD_READY',
] as const;

function observeEvent(eventName: string): void {
  recordObservedRuntimeEvent(eventName);
  getLogger().debug('Runtime observed bus event', {
    moduleId: 'MOD-RUNTIME',
    eventName,
  });
}

/** Idempotent — registers runtime listeners exactly once per boot cycle. */
export function wireRuntimeEventBus(): void {
  if (wiringRegistered) {
    return;
  }

  const bus = getEventBus();

  for (const eventName of OBSERVED_EVENTS) {
    subscriptionIds.push(
      bus.subscribe(eventName, () => {
        observeEvent(eventName);
      }),
    );
  }

  wiringRegistered = true;
  setRuntimeWiringState({
    wired: true,
    subscriptionIds: [...subscriptionIds],
    observedEvents: [],
  });

  getLogger().info('Runtime event wiring registered', {
    moduleId: 'MOD-RUNTIME',
    emitter: RUNTIME_EMITTER,
    events: OBSERVED_EVENTS,
  });
}

export function areRuntimeEventListenersRegistered(): boolean {
  return wiringRegistered;
}

/** Test-only teardown — not for production portals. */
export function resetRuntimeEventWiringForTests(): void {
  if (!wiringRegistered) {
    return;
  }

  const bus = getEventBus();
  for (const id of subscriptionIds) {
    bus.unsubscribe(id);
  }

  subscriptionIds.length = 0;
  wiringRegistered = false;
  setRuntimeWiringState({
    wired: false,
    subscriptionIds: [],
    observedEvents: [],
  });
}
