/** MOD-RUNTIME — types — TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 */

import type { PortalId } from '@mdj/shared/config';

export type RuntimeLifecycleState =
  | 'RUNTIME_UNINITIALIZED'
  | 'RUNTIME_BOOTING'
  | 'RUNTIME_READY'
  | 'RUNTIME_ERROR'
  | 'RUNTIME_SHUTDOWN';

export type RuntimeModuleId =
  | 'MOD-006'
  | 'MOD-004'
  | 'MOD-010'
  | 'MOD-014'
  | 'MOD-001'
  | 'MOD-002'
  | 'MOD-005'
  | 'MOD-007'
  | 'MOD-RUNTIME';

export type RuntimeModuleRegistration = {
  readonly moduleId: RuntimeModuleId;
  readonly label: string;
  readonly lifecycleState: string;
  readonly registeredAt: number;
};

export type RuntimeEventWiringState = {
  readonly wired: boolean;
  readonly subscriptionIds: readonly string[];
  readonly observedEvents: readonly string[];
};

export type RuntimeSnapshot = {
  readonly lifecycle: RuntimeLifecycleState;
  readonly portal: PortalId | null;
  readonly systemReadyConfirmed: boolean;
  readonly registrySize: number;
  readonly wiring: RuntimeEventWiringState;
  readonly bootCompletedAt: number | null;
};

export type InitializeRuntimeOptions = {
  readonly portal: PortalId;
};

export type RuntimePublicApi = {
  readonly getSnapshot: () => RuntimeSnapshot;
  readonly getRegistry: () => readonly RuntimeModuleRegistration[];
  readonly getLifecycleState: () => RuntimeLifecycleState;
};

export type RuntimeMeta = {
  readonly ticket: 'TICKET-V2-BOOTSTRAP-RUNTIME-P0-001';
  readonly businessLogic: false;
};
