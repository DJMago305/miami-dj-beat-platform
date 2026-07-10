/** MOD-RUNTIME — lifecycle state machine — TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 */

import type { RuntimeLifecycleState } from './types';

const VALID_TRANSITIONS: Readonly<Record<RuntimeLifecycleState, readonly RuntimeLifecycleState[]>> =
  {
    RUNTIME_UNINITIALIZED: ['RUNTIME_BOOTING', 'RUNTIME_ERROR'],
    RUNTIME_BOOTING: ['RUNTIME_READY', 'RUNTIME_ERROR'],
    RUNTIME_READY: ['RUNTIME_SHUTDOWN', 'RUNTIME_ERROR'],
    RUNTIME_ERROR: ['RUNTIME_SHUTDOWN'],
    RUNTIME_SHUTDOWN: [],
  };

let lifecycleState: RuntimeLifecycleState = 'RUNTIME_UNINITIALIZED';

export function getRuntimeLifecycleState(): RuntimeLifecycleState {
  return lifecycleState;
}

export function assertRuntimeTransition(
  from: RuntimeLifecycleState,
  to: RuntimeLifecycleState,
): void {
  if (lifecycleState !== from) {
    throw new Error(
      `Invalid runtime lifecycle transition: expected from ${from}, current ${lifecycleState}.`,
    );
  }

  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid runtime lifecycle transition: ${from} → ${to}.`);
  }

  lifecycleState = to;
}

export function setRuntimeLifecycleStateForTests(state: RuntimeLifecycleState): void {
  lifecycleState = state;
}
