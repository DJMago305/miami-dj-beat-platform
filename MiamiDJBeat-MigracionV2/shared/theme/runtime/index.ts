/** MOD-007 Theme Manager — public API — TICKET-MOD-007-THEME-REGISTRY-001 · TICKET-MOD-007-THEME-RESOLVER-001 */

export { ThemeError, isThemeError } from './errors';
export {
  THEME_COUNT,
  THEME_REGISTRY,
  assertThemeIdFormat,
  assertThemeRegistered,
  getDefaultThemeIdForMode,
  getThemeDefinition,
  isRegisteredTheme,
  isValidThemeIdFormat,
  listThemes,
  listThemesByMode,
} from './theme-registry';
export {
  isThemeMode,
  listAvailableThemes,
  normalizeThemeMode,
  resolveDefaultTheme,
  resolveFallbackTheme,
  resolveTheme,
} from './theme-resolver';
export type {
  ThemeDefinition,
  ThemeErrorCode,
  ThemeId,
  ThemeMode,
  ThemeModePreference,
  ThemeResolveInput,
  ThemeResolveReason,
  ThemeResolveResult,
  ThemeTokenMap,
} from './types';
export {
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  FALLBACK_THEME_ID,
  THEME_ID_FORMAT,
  THEME_REGISTRY_VERSION,
} from './types';
