/** MOD-RUNTIME — snapshot state — TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 */

import type { PortalId } from '@mdj/shared/config';
import { listRuntimeModules } from './registry';
import type { RuntimeEventWiringState, RuntimeSnapshot } from './types';
import { getRuntimeLifecycleState } from './lifecycle';

let activePortal: PortalId | null = null;
let systemReadyConfirmed = false;
let bootCompletedAt: number | null = null;
let wiringState: RuntimeEventWiringState = {
  wired: false,
  subscriptionIds: [],
  observedEvents: [],
};

export function setActivePortal(portal: PortalId): void {
  activePortal = portal;
}

export function markSystemReadyConfirmed(): void {
  systemReadyConfirmed = true;
}

export function markBootCompleted(): void {
  bootCompletedAt = Date.now();
}

export function setRuntimeWiringState(next: RuntimeEventWiringState): void {
  wiringState = Object.freeze({
    wired: next.wired,
    subscriptionIds: Object.freeze([...next.subscriptionIds]),
    observedEvents: Object.freeze([...next.observedEvents]),
  });
}

export function recordObservedRuntimeEvent(eventName: string): void {
  if (wiringState.observedEvents.includes(eventName)) {
    return;
  }

  wiringState = Object.freeze({
    ...wiringState,
    observedEvents: Object.freeze([...wiringState.observedEvents, eventName]),
  });
}

export function getRuntimeSnapshot(): RuntimeSnapshot {
  return Object.freeze({
    lifecycle: getRuntimeLifecycleState(),
    portal: activePortal,
    systemReadyConfirmed,
    registrySize: listRuntimeModules().length,
    wiring: wiringState,
    bootCompletedAt,
  });
}

export function resetRuntimeStateForTests(): void {
  activePortal = null;
  systemReadyConfirmed = false;
  bootCompletedAt = null;
  wiringState = {
    wired: false,
    subscriptionIds: [],
    observedEvents: [],
  };
}
