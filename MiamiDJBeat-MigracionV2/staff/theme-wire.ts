/** MOD-007 Staff Portal — theme wire — TICKET-MOD-007-THEME-INTEGRATION-001 */

import {
  applyThemeTokensToRoot,
  getThemeRuntimeState,
  isThemeReady,
  type ThemeSnapshot,
} from '../shared/theme/runtime';
import { ThemeError } from '../shared/theme/runtime/errors';

export const STAFF_THEME_PORTAL_ID = 'staff' as const;

export type StaffPortalThemeWireRegistry = {
  readonly portal: typeof STAFF_THEME_PORTAL_ID;
  readonly resolvedAt: string;
  readonly snapshot: ThemeSnapshot;
  readonly cssVariables: readonly string[];
};

let staffPortalThemeWireRegistry: StaffPortalThemeWireRegistry | null = null;

export function resolveStaffPortalThemeWire(): StaffPortalThemeWireRegistry {
  if (!isThemeReady()) {
    throw new ThemeError('THEME_RUNTIME_NOT_READY', 'Theme runtime is not READY');
  }

  const runtimeState = getThemeRuntimeState();
  const snapshot = runtimeState.snapshot;
  if (!snapshot) {
    throw new ThemeError('THEME_RUNTIME_NOT_READY', 'Theme snapshot is unavailable');
  }

  const registry: StaffPortalThemeWireRegistry = Object.freeze({
    portal: STAFF_THEME_PORTAL_ID,
    resolvedAt: new Date().toISOString(),
    snapshot,
    cssVariables: applyThemeTokensToRoot(snapshot.tokens),
  });

  staffPortalThemeWireRegistry = registry;
  return registry;
}

export function getStaffPortalThemeWireRegistry(): StaffPortalThemeWireRegistry | null {
  return staffPortalThemeWireRegistry;
}

/** Test-only reset — not for production portals. */
export function resetStaffPortalThemeWireForTests(): void {
  staffPortalThemeWireRegistry = null;
}
