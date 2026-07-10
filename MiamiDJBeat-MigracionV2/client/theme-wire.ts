/** MOD-007 Client Portal — theme wire — TICKET-MOD-007-THEME-INTEGRATION-001 */

import {
  applyThemeTokensToRoot,
  getThemeRuntimeState,
  isThemeReady,
  type ThemeSnapshot,
} from '../shared/theme/runtime';
import { ThemeError } from '../shared/theme/runtime/errors';

export const CLIENT_THEME_PORTAL_ID = 'client' as const;

export type ClientPortalThemeWireRegistry = {
  readonly portal: typeof CLIENT_THEME_PORTAL_ID;
  readonly resolvedAt: string;
  readonly snapshot: ThemeSnapshot;
  readonly cssVariables: readonly string[];
};

let clientPortalThemeWireRegistry: ClientPortalThemeWireRegistry | null = null;

export function resolveClientPortalThemeWire(): ClientPortalThemeWireRegistry {
  if (!isThemeReady()) {
    throw new ThemeError('THEME_RUNTIME_NOT_READY', 'Theme runtime is not READY');
  }

  const runtimeState = getThemeRuntimeState();
  const snapshot = runtimeState.snapshot;
  if (!snapshot) {
    throw new ThemeError('THEME_RUNTIME_NOT_READY', 'Theme snapshot is unavailable');
  }

  const registry: ClientPortalThemeWireRegistry = Object.freeze({
    portal: CLIENT_THEME_PORTAL_ID,
    resolvedAt: new Date().toISOString(),
    snapshot,
    cssVariables: applyThemeTokensToRoot(snapshot.tokens),
  });

  clientPortalThemeWireRegistry = registry;
  return registry;
}

export function getClientPortalThemeWireRegistry(): ClientPortalThemeWireRegistry | null {
  return clientPortalThemeWireRegistry;
}

/** Test-only reset — not for production portals. */
export function resetClientPortalThemeWireForTests(): void {
  clientPortalThemeWireRegistry = null;
}
