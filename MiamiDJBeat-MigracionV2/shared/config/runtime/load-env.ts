/** MOD-006 Configuration — Load phase — TICKET-V2-RUNTIME-CONFIG-001 */

import type { RawEnvMap } from './types';

const MDJ_PREFIX = 'MDJ_V2_';

/** Reads Vite-injected env (import.meta.env) into a raw map. */
export function readViteEnv(): RawEnvMap {
  const source = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
  const out: RawEnvMap = {};

  if (!source || typeof source !== 'object') {
    return out;
  }

  for (const [key, value] of Object.entries(source)) {
    if (!key.startsWith(MDJ_PREFIX) || value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'string') {
      out[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = String(value);
    }
  }

  return out;
}

/** Merge explicit overrides (tests) atop vite env. */
export function loadRawEnv(overrides: RawEnvMap = {}): RawEnvMap {
  return { ...readViteEnv(), ...overrides };
}
