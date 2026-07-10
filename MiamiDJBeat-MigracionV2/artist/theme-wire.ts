/** MOD-007 Artist Portal — theme wire — TICKET-MOD-007-THEME-INTEGRATION-001 */

import {
  applyThemeTokensToRoot,
  getThemeRuntimeState,
  isThemeReady,
  type ThemeSnapshot,
} from '../shared/theme/runtime';
import { ThemeError } from '../shared/theme/runtime/errors';

export const ARTIST_THEME_PORTAL_ID = 'artist' as const;

export type ArtistPortalThemeWireRegistry = {
  readonly portal: typeof ARTIST_THEME_PORTAL_ID;
  readonly resolvedAt: string;
  readonly snapshot: ThemeSnapshot;
  readonly cssVariables: readonly string[];
};

let artistPortalThemeWireRegistry: ArtistPortalThemeWireRegistry | null = null;

export function resolveArtistPortalThemeWire(): ArtistPortalThemeWireRegistry {
  if (!isThemeReady()) {
    throw new ThemeError('THEME_RUNTIME_NOT_READY', 'Theme runtime is not READY');
  }

  const runtimeState = getThemeRuntimeState();
  const snapshot = runtimeState.snapshot;
  if (!snapshot) {
    throw new ThemeError('THEME_RUNTIME_NOT_READY', 'Theme snapshot is unavailable');
  }

  const registry: ArtistPortalThemeWireRegistry = Object.freeze({
    portal: ARTIST_THEME_PORTAL_ID,
    resolvedAt: new Date().toISOString(),
    snapshot,
    cssVariables: applyThemeTokensToRoot(snapshot.tokens),
  });

  artistPortalThemeWireRegistry = registry;
  return registry;
}

export function getArtistPortalThemeWireRegistry(): ArtistPortalThemeWireRegistry | null {
  return artistPortalThemeWireRegistry;
}

/** Test-only reset — not for production portals. */
export function resetArtistPortalThemeWireForTests(): void {
  artistPortalThemeWireRegistry = null;
}
