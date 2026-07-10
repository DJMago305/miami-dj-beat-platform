/** MOD-006 Configuration — Lifecycle service — TICKET-V2-RUNTIME-CONFIG-001 */

import { isConfigError } from './errors';
import { loadRawEnv } from './load-env';
import type { AppConfig, ConfigLifecycleState, RawEnvMap } from './types';
import { parseAndValidateConfig } from './validate';

let lifecycleState: ConfigLifecycleState = 'UNLOADED';
let frozenConfig: AppConfig | null = null;
let lastWarnings: string[] = [];

function deepFreeze<T extends object>(value: T): T {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child as object);
    }
  }
  return value;
}

/** Load → Parse → Validate → Freeze (CONFIG-LIFECYCLE.md) */
export function initializeConfiguration(overrides: RawEnvMap = {}): AppConfig {
  lifecycleState = 'LOADING';

  try {
    const raw = loadRawEnv(overrides);
    const { config, warnings } = parseAndValidateConfig(raw);
    lastWarnings = warnings;
    frozenConfig = deepFreeze({ ...config, deploy: { ...config.deploy, portalUrls: { ...config.deploy.portalUrls } } });
    lifecycleState = 'FROZEN';
    return frozenConfig;
  } catch (error) {
    lifecycleState = 'ERROR';
    if (isConfigError(error)) {
      throw error;
    }
    throw error;
  }
}

export function getConfig(): AppConfig {
  if (lifecycleState !== 'FROZEN' || !frozenConfig) {
    throw new Error('Configuration is not initialized. Call initializeConfiguration() during boot.');
  }
  return frozenConfig;
}

export function getConfigState(): ConfigLifecycleState {
  return lifecycleState;
}

export function getConfigWarnings(): readonly string[] {
  return lastWarnings;
}

/** Test-only reset — not for production portals. */
export function resetConfigurationForTests(): void {
  lifecycleState = 'UNLOADED';
  frozenConfig = null;
  lastWarnings = [];
}
