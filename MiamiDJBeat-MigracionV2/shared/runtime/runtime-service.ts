/** MOD-RUNTIME — service facade — TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 */

import { getAuthService } from '../auth/runtime';
import { getConfigState } from '@mdj/shared/config';
import { EVENT_BUS_VERSION, getEventBus, getEventBusState } from '@mdj/shared/events';
import { getErrorState } from '@mdj/shared/errors';
import { getLogger } from '@mdj/shared/logging';
import { getSessionState } from '@mdj/shared/session';
import { RuntimeError } from './errors';
import { areRuntimeEventListenersRegistered, wireRuntimeEventBus } from './event-wiring';
import { assertRuntimeTransition, getRuntimeLifecycleState } from './lifecycle';
import { clearRuntimeRegistryForTests, listRuntimeModules, registerRuntimeModule } from './registry';
import {
  getRuntimeSnapshot,
  markBootCompleted,
  markSystemReadyConfirmed,
  resetRuntimeStateForTests,
  setActivePortal,
} from './state';
import type {
  InitializeRuntimeOptions,
  RuntimePublicApi,
  RuntimeSnapshot,
} from './types';
import { resetRuntimeEventWiringForTests } from './event-wiring';
import { setRuntimeLifecycleStateForTests } from './lifecycle';
import { MDJ_V2_RUNTIME_VERSION } from './meta';

let frozenApi: RuntimePublicApi | null = null;

function assertBootPrerequisites(): void {
  if (getConfigState() !== 'FROZEN') {
    throw new RuntimeError(
      'RUNTIME_PREREQUISITE_MISSING',
      'Configuration must be FROZEN before Runtime initialization.',
    );
  }

  if (getEventBusState() !== 'BUS_READY') {
    throw new RuntimeError(
      'RUNTIME_PREREQUISITE_MISSING',
      'Event Bus must be BUS_READY before Runtime initialization.',
    );
  }

  if (getErrorState() !== 'ERR_READY') {
    throw new RuntimeError(
      'RUNTIME_PREREQUISITE_MISSING',
      'Error Handler must be ERR_READY before Runtime initialization.',
    );
  }

  if (getSessionState() !== 'SESSION_READY') {
    throw new RuntimeError(
      'RUNTIME_PREREQUISITE_MISSING',
      'Session must be SESSION_READY before Runtime initialization.',
    );
  }
}

function registerCoreModules(): void {
  registerRuntimeModule('MOD-006', 'Configuration', getConfigState());
  registerRuntimeModule('MOD-004', 'Event Bus', getEventBusState());
  registerRuntimeModule('MOD-010', 'Logging', 'LOG_READY');
  registerRuntimeModule('MOD-014', 'Error Handler', getErrorState());
  registerRuntimeModule('MOD-001', 'Authentication', getAuthService().getState());
  registerRuntimeModule('MOD-002', 'Session', getSessionState());
}

function buildPublicApi(): RuntimePublicApi {
  return Object.freeze({
    getSnapshot: getRuntimeSnapshot,
    getRegistry: listRuntimeModules,
    getLifecycleState: getRuntimeLifecycleState,
  });
}

/**
 * Boot step 6 — Runtime Registry · State · Lifecycle · Event wiring.
 * Requires Session SESSION_READY (boot steps 1–5 complete).
 */
export function initializeRuntime(options: InitializeRuntimeOptions): RuntimePublicApi {
  if (getRuntimeLifecycleState() === 'RUNTIME_READY' && frozenApi) {
    return frozenApi;
  }

  if (getRuntimeLifecycleState() === 'RUNTIME_SHUTDOWN') {
    throw new RuntimeError('RUNTIME_ALREADY_SHUTDOWN', 'Runtime has been shut down.');
  }

  assertBootPrerequisites();

  assertRuntimeTransition('RUNTIME_UNINITIALIZED', 'RUNTIME_BOOTING');
  setActivePortal(options.portal);

  getLogger().info('Runtime initialization started', {
    moduleId: 'MOD-RUNTIME',
    portal: options.portal,
    lifecycle: getRuntimeLifecycleState(),
  });

  registerCoreModules();
  wireRuntimeEventBus();

  registerRuntimeModule('MOD-RUNTIME', 'Runtime Orchestrator', 'RUNTIME_BOOTING');

  assertRuntimeTransition('RUNTIME_BOOTING', 'RUNTIME_READY');
  registerRuntimeModule('MOD-RUNTIME', 'Runtime Orchestrator', 'RUNTIME_READY');

  frozenApi = buildPublicApi();
  markBootCompleted();

  getLogger().info('Runtime initialization complete', {
    moduleId: 'MOD-RUNTIME',
    portal: options.portal,
    registrySize: listRuntimeModules().length,
    lifecycle: getRuntimeLifecycleState(),
  });

  return frozenApi;
}

/**
 * Boot step 7 — Emit global SYSTEM_READY exactly once after Runtime is READY.
 * Event Bus init emits only BUS_READY (internal); SYSTEM_READY means full boot gate.
 */
export function emitSystemReady(): void {
  if (getRuntimeLifecycleState() !== 'RUNTIME_READY') {
    throw new RuntimeError(
      'RUNTIME_NOT_READY',
      'Runtime must be RUNTIME_READY before emitting SYSTEM_READY.',
    );
  }

  const bus = getEventBus();
  const history = bus.getHistory();
  const priorSystemReady = history.filter((entry) => entry.name === 'SYSTEM_READY');

  if (priorSystemReady.length > 0) {
    throw new RuntimeError(
      'RUNTIME_SYSTEM_READY_MISSING',
      'SYSTEM_READY was already emitted. Canonical boot allows exactly one emission.',
    );
  }

  if (!areRuntimeEventListenersRegistered()) {
    throw new RuntimeError(
      'RUNTIME_PREREQUISITE_MISSING',
      'Runtime event wiring must be active before SYSTEM_READY.',
    );
  }

  const result = bus.publish({
    name: 'SYSTEM_READY',
    payload: {
      busVersion: EVENT_BUS_VERSION,
      runtimeVersion: MDJ_V2_RUNTIME_VERSION,
    },
    emitter: { moduleId: 'MOD-RUNTIME', subsystem: 'boot' },
    scope: 'internal',
  });

  if (!result.ok) {
    throw new RuntimeError(
      'RUNTIME_SYSTEM_READY_MISSING',
      result.message ?? 'SYSTEM_READY publish failed.',
    );
  }

  markSystemReadyConfirmed();

  getLogger().info('Boot gate SYSTEM_READY emitted', {
    moduleId: 'MOD-RUNTIME',
    busVersion: EVENT_BUS_VERSION,
    runtimeVersion: MDJ_V2_RUNTIME_VERSION,
  });
}

export function getRuntimeState(): RuntimeSnapshot {
  return getRuntimeSnapshot();
}

export function getRuntime(): RuntimePublicApi {
  if (!frozenApi || getRuntimeLifecycleState() !== 'RUNTIME_READY') {
    throw new RuntimeError(
      'RUNTIME_NOT_READY',
      'Runtime is not initialized. Call initializeRuntime() during boot.',
    );
  }
  return frozenApi;
}

/** Test-only reset — not for production portals. */
export function resetRuntimeForTests(): void {
  resetRuntimeEventWiringForTests();
  clearRuntimeRegistryForTests();
  resetRuntimeStateForTests();
  setRuntimeLifecycleStateForTests('RUNTIME_UNINITIALIZED');
  frozenApi = null;
}
