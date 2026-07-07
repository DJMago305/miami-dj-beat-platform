/** MOD-007 Theme Manager — theme resolver — TICKET-MOD-007-THEME-RESOLVER-001 */

import { ThemeError } from './errors';
import {
  assertThemeRegistered,
  getDefaultThemeIdForMode,
  isRegisteredTheme,
  isValidThemeIdFormat,
  listThemes,
  THEME_COUNT,
} from './theme-registry';
import type {
  ThemeId,
  ThemeMode,
  ThemeResolveInput,
  ThemeResolveReason,
  ThemeResolveResult,
} from './types';
import { FALLBACK_THEME_ID } from './types';

function assertThemeRegistryAvailable(): void {
  if (THEME_COUNT === 0) {
    throw new ThemeError('THEME_REGISTRY_EMPTY', 'Theme registry is empty');
  }
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light';
}

export function normalizeThemeMode(value: unknown): ThemeMode | null {
  if (!isThemeMode(value)) {
    return null;
  }
  return value;
}

function buildResult(themeId: ThemeId, reason: ThemeResolveReason): ThemeResolveResult {
  const definition = assertThemeRegistered(themeId);

  return Object.freeze({
    themeId: definition.id,
    mode: definition.mode,
    tokens: definition.tokens,
    reason,
  });
}

function resolveFromMode(mode: ThemeMode, reason: ThemeResolveReason): ThemeResolveResult {
  return buildResult(getDefaultThemeIdForMode(mode), reason);
}

function resolveExplicitThemeId(
  themeId: string,
  reason: ThemeResolveReason,
): ThemeResolveResult {
  if (!isValidThemeIdFormat(themeId)) {
    throw new ThemeError('THEME_INVALID_ID', `Invalid theme id format: "${themeId}"`);
  }

  if (!isRegisteredTheme(themeId)) {
    return resolveFallbackTheme();
  }

  return buildResult(themeId, reason);
}

export function resolveFallbackTheme(): ThemeResolveResult {
  assertThemeRegistryAvailable();
  return buildResult(FALLBACK_THEME_ID, 'fallback');
}

export function resolveDefaultTheme(configDefaultMode: ThemeMode | string): ThemeResolveResult {
  assertThemeRegistryAvailable();

  const mode = normalizeThemeMode(configDefaultMode);
  if (!mode) {
    return resolveFallbackTheme();
  }

  return resolveFromMode(mode, 'config');
}

export function listAvailableThemes() {
  assertThemeRegistryAvailable();
  return listThemes();
}

export function resolveTheme(input: ThemeResolveInput): ThemeResolveResult {
  assertThemeRegistryAvailable();

  let mode: ThemeMode | null = normalizeThemeMode(input.configDefaultMode);
  let reason: ThemeResolveReason = mode ? 'config' : 'fallback';

  if (input.userPreference !== undefined) {
    if (input.userPreference === 'system') {
      const systemMode = normalizeThemeMode(input.systemPreference);
      if (systemMode) {
        mode = systemMode;
        reason = 'system';
      }
    } else {
      const userMode = normalizeThemeMode(input.userPreference);
      if (userMode) {
        mode = userMode;
        reason = 'user';
      } else {
        return resolveFallbackTheme();
      }
    }
  }

  if (!mode) {
    return resolveFallbackTheme();
  }

  if (input.themeId !== undefined) {
    return resolveExplicitThemeId(input.themeId, reason);
  }

  return resolveFromMode(mode, reason);
}
