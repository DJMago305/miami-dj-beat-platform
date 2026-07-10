/** MOD-RUNTIME — module registry — TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 */

import type { RuntimeModuleId, RuntimeModuleRegistration } from './types';

const registry = new Map<RuntimeModuleId, RuntimeModuleRegistration>();

export function registerRuntimeModule(
  moduleId: RuntimeModuleId,
  label: string,
  lifecycleState: string,
): RuntimeModuleRegistration {
  const entry = Object.freeze({
    moduleId,
    label,
    lifecycleState,
    registeredAt: Date.now(),
  });
  registry.set(moduleId, entry);
  return entry;
}

export function getRuntimeModule(moduleId: RuntimeModuleId): RuntimeModuleRegistration | undefined {
  return registry.get(moduleId);
}

export function listRuntimeModules(): readonly RuntimeModuleRegistration[] {
  return Object.freeze([...registry.values()]);
}

export function clearRuntimeRegistryForTests(): void {
  registry.clear();
}
