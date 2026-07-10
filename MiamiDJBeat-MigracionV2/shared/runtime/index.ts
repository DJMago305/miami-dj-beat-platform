/** MOD-RUNTIME — public API — TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 */

export { RuntimeError, isRuntimeError } from './errors';
export {
  MDJ_V2_RUNTIME_VERSION,
  MDJ_V2_SCAFFOLD_VERSION,
  RUNTIME_META,
  SCAFFOLD_META,
} from './meta';
export { bootstrapPortal } from './portal-bootstrap';
export type { PortalBootstrapInput, PortalBootstrapResult } from './portal-bootstrap';
export {
  areRuntimeEventListenersRegistered,
  resetRuntimeEventWiringForTests,
  wireRuntimeEventBus,
} from './event-wiring';
export {
  clearRuntimeRegistryForTests,
  getRuntimeModule,
  listRuntimeModules,
  registerRuntimeModule,
} from './registry';
export {
  emitSystemReady,
  getRuntime,
  getRuntimeState,
  initializeRuntime,
  resetRuntimeForTests,
} from './runtime-service';
export type {
  InitializeRuntimeOptions,
  RuntimeEventWiringState,
  RuntimeLifecycleState,
  RuntimeMeta,
  RuntimeModuleId,
  RuntimeModuleRegistration,
  RuntimePublicApi,
  RuntimeSnapshot,
} from './types';
