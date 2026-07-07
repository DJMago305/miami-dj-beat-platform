import { describe, expect, it } from 'vitest';
import {
  FALLBACK_THEME_ID,
  THEME_REGISTRY,
  ThemeError,
  getThemeDefinition,
  isThemeError,
  isThemeMode,
  listAvailableThemes,
  listThemes,
  normalizeThemeMode,
  resolveDefaultTheme,
  resolveFallbackTheme,
  resolveTheme,
} from '../../shared/theme/runtime';

describe('MOD-007 Theme Resolver', () => {
  it('resolves default dark theme from config', () => {
    const result = resolveDefaultTheme('dark');
    expect(result.themeId).toBe('mdj-dark-gold');
    expect(result.mode).toBe('dark');
    expect(result.reason).toBe('config');
  });

  it('resolves default light theme from config', () => {
    const result = resolveDefaultTheme('light');
    expect(result.themeId).toBe('mdj-light');
    expect(result.mode).toBe('light');
    expect(result.reason).toBe('config');
  });

  it('resolves user dark preference over config default', () => {
    const result = resolveTheme({
      configDefaultMode: 'light',
      userPreference: 'dark',
    });

    expect(result.themeId).toBe('mdj-dark-gold');
    expect(result.mode).toBe('dark');
    expect(result.reason).toBe('user');
  });

  it('resolves user light preference over config default', () => {
    const result = resolveTheme({
      configDefaultMode: 'dark',
      userPreference: 'light',
    });

    expect(result.themeId).toBe('mdj-light');
    expect(result.mode).toBe('light');
    expect(result.reason).toBe('user');
  });

  it('resolves system dark preference when user preference is system', () => {
    const result = resolveTheme({
      configDefaultMode: 'light',
      userPreference: 'system',
      systemPreference: 'dark',
    });

    expect(result.themeId).toBe('mdj-dark-gold');
    expect(result.mode).toBe('dark');
    expect(result.reason).toBe('system');
  });

  it('resolves system light preference when user preference is system', () => {
    const result = resolveTheme({
      configDefaultMode: 'dark',
      userPreference: 'system',
      systemPreference: 'light',
    });

    expect(result.themeId).toBe('mdj-light');
    expect(result.mode).toBe('light');
    expect(result.reason).toBe('system');
  });

  it('falls back to high contrast theme for invalid config mode', () => {
    const result = resolveTheme({
      configDefaultMode: 'neon',
    });

    expect(result.themeId).toBe(FALLBACK_THEME_ID);
    expect(result.mode).toBe('dark');
    expect(result.reason).toBe('fallback');
  });

  it('falls back when user preference mode is invalid', () => {
    const result = resolveTheme({
      configDefaultMode: 'dark',
      userPreference: 'neon',
    });

    expect(result.themeId).toBe(FALLBACK_THEME_ID);
    expect(result.reason).toBe('fallback');
  });

  it('falls back when explicit theme id does not exist', () => {
    const result = resolveTheme({
      configDefaultMode: 'dark',
      themeId: 'mdj-missing-theme',
    });

    expect(result.themeId).toBe(FALLBACK_THEME_ID);
    expect(result.reason).toBe('fallback');
  });

  it('throws for invalid explicit theme id format', () => {
    expect(() =>
      resolveTheme({
        configDefaultMode: 'dark',
        themeId: 'Bad.Id',
      }),
    ).toThrow(ThemeError);

    try {
      resolveTheme({
        configDefaultMode: 'dark',
        themeId: 'Bad.Id',
      });
    } catch (error) {
      expect(isThemeError(error)).toBe(true);
      if (isThemeError(error)) {
        expect(error.code).toBe('THEME_INVALID_ID');
      }
    }
  });

  it('uses config default when user preference is system but system preference is invalid', () => {
    const result = resolveTheme({
      configDefaultMode: 'dark',
      userPreference: 'system',
      systemPreference: 'neon',
    });

    expect(result.themeId).toBe('mdj-dark-gold');
    expect(result.reason).toBe('config');
  });

  it('resolveFallbackTheme returns the accessibility fallback theme', () => {
    const result = resolveFallbackTheme();
    expect(result.themeId).toBe('mdj-dark-gold-high-contrast');
    expect(result.reason).toBe('fallback');
  });

  it('normalizes and validates theme modes', () => {
    expect(normalizeThemeMode('dark')).toBe('dark');
    expect(normalizeThemeMode('light')).toBe('light');
    expect(normalizeThemeMode('invalid')).toBeNull();
    expect(isThemeMode('dark')).toBe(true);
    expect(isThemeMode('system')).toBe(false);
  });

  it('lists available themes from the registry', () => {
    expect(listAvailableThemes()).toHaveLength(3);
    expect(listAvailableThemes()).toEqual(listThemes());
  });

  it('keeps registry integrity and immutable tokens after resolve', () => {
    const beforeDark = getThemeDefinition('mdj-dark-gold');
    const beforeLight = getThemeDefinition('mdj-light');
    const result = resolveTheme({
      configDefaultMode: 'dark',
      userPreference: 'light',
    });
    const afterDark = getThemeDefinition('mdj-dark-gold');
    const afterLight = getThemeDefinition('mdj-light');

    expect(result.tokens).toBe(beforeLight?.tokens);
    expect(afterDark?.tokens).toBe(beforeDark?.tokens);
    expect(afterLight?.tokens).toBe(beforeLight?.tokens);
    expect(Object.isFrozen(THEME_REGISTRY)).toBe(true);
    expect(Object.isFrozen(beforeDark)).toBe(true);
    expect(Object.isFrozen(beforeDark?.tokens)).toBe(true);
  });

  it('remains pure and does not mutate registry entries', () => {
    const darkGold = getThemeDefinition('mdj-dark-gold');
    const tokenSnapshot = darkGold ? { ...darkGold.tokens } : {};

    resolveTheme({ configDefaultMode: 'dark', userPreference: 'light' });
    resolveTheme({ configDefaultMode: 'neon' });
    resolveFallbackTheme();

    const darkGoldAfter = getThemeDefinition('mdj-dark-gold');
    expect(darkGoldAfter?.tokens).toEqual(tokenSnapshot);
    expect(THEME_REGISTRY.size).toBe(3);
  });

  it('never returns null or undefined', () => {
    const cases = [
      resolveTheme({ configDefaultMode: 'dark' }),
      resolveTheme({ configDefaultMode: 'light' }),
      resolveTheme({ configDefaultMode: 'dark', userPreference: 'light' }),
      resolveTheme({ configDefaultMode: 'dark', userPreference: 'system', systemPreference: 'light' }),
      resolveTheme({ configDefaultMode: 'bad' }),
      resolveFallbackTheme(),
      resolveDefaultTheme('dark'),
    ];

    for (const result of cases) {
      expect(result).toBeDefined();
      expect(result.themeId).toBeTruthy();
      expect(result.mode).toMatch(/^(dark|light)$/);
      expect(result.tokens).toBeDefined();
      expect(Object.keys(result.tokens).length).toBeGreaterThan(0);
      expect(result.reason).toMatch(/^(config|user|system|fallback)$/);
      expect(Object.isFrozen(result)).toBe(true);
    }
  });
});
