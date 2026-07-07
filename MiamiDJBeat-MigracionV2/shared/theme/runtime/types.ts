/** MOD-007 Theme Manager — types — TICKET-MOD-007-THEME-REGISTRY-001 */

export const THEME_ID_FORMAT = /^mdj-[a-z0-9-]+$/;

export type ThemeId =
  | 'mdj-dark-gold'
  | 'mdj-dark-gold-high-contrast'
  | 'mdj-light';

export type ThemeMode = 'dark' | 'light';

export type ThemeTokenMap = Readonly<Record<string, string>>;

export type ThemeDefinition = {
  readonly id: ThemeId;
  readonly mode: ThemeMode;
  readonly version: string;
  readonly description: string;
  readonly tokens: ThemeTokenMap;
};

export type ThemeErrorCode =
  | 'THEME_INVALID_ID'
  | 'THEME_NOT_REGISTERED'
  | 'THEME_REGISTRY_EMPTY';

export type ThemeModePreference = 'dark' | 'light' | 'system';

export type ThemeResolveReason = 'config' | 'user' | 'system' | 'fallback';

export type ThemeResolveInput = {
  readonly configDefaultMode: ThemeMode | string;
  readonly userPreference?: ThemeModePreference | string;
  readonly systemPreference?: ThemeMode | string;
  readonly themeId?: string;
};

export type ThemeResolveResult = {
  readonly themeId: ThemeId;
  readonly mode: ThemeMode;
  readonly tokens: ThemeTokenMap;
  readonly reason: ThemeResolveReason;
};

export const FALLBACK_THEME_ID: ThemeId = 'mdj-dark-gold-high-contrast';

export const DEFAULT_DARK_THEME_ID: ThemeId = 'mdj-dark-gold';

export const DEFAULT_LIGHT_THEME_ID: ThemeId = 'mdj-light';

export const THEME_REGISTRY_VERSION = '1.0';
