import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  THEME_COUNT,
  THEME_REGISTRY,
  ThemeError,
  assertThemeRegistered,
  getDefaultThemeIdForMode,
  getThemeDefinition,
  isRegisteredTheme,
  isThemeError,
  isValidThemeIdFormat,
  listThemes,
  listThemesByMode,
} from '../../shared/theme/runtime';

describe('MOD-007 Theme Registry', () => {
  it('registers all 3 documented MVP themes', () => {
    expect(THEME_COUNT).toBe(3);
    expect(THEME_REGISTRY.size).toBe(3);
    expect(listThemes()).toHaveLength(3);
  });

  it('lookup returns a frozen definition with non-empty tokens', () => {
    const definition = getThemeDefinition('mdj-dark-gold');
    expect(definition).toBeDefined();
    expect(definition?.id).toBe('mdj-dark-gold');
    expect(definition?.mode).toBe('dark');
    expect(definition?.version).toBe('1.0');
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition?.tokens)).toBe(true);

    for (const value of Object.values(definition?.tokens ?? {})) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('registers mdj-dark-gold, mdj-dark-gold-high-contrast, and mdj-light', () => {
    expect(isRegisteredTheme('mdj-dark-gold')).toBe(true);
    expect(isRegisteredTheme('mdj-dark-gold-high-contrast')).toBe(true);
    expect(isRegisteredTheme('mdj-light')).toBe(true);
  });

  it('lookup returns undefined for invalid or unregistered ids (deny-default)', () => {
    expect(getThemeDefinition('not-a-theme')).toBeUndefined();
    expect(getThemeDefinition('mdj-missing-theme')).toBeUndefined();
    expect(isRegisteredTheme('')).toBe(false);
    expect(isRegisteredTheme('MDJ-DARK-GOLD')).toBe(false);
  });

  it('assertThemeRegistered throws THEME_NOT_REGISTERED for unknown ids', () => {
    expect(() => assertThemeRegistered('mdj-missing-theme')).toThrow(ThemeError);
    try {
      assertThemeRegistered('mdj-missing-theme');
    } catch (error) {
      expect(isThemeError(error)).toBe(true);
      if (isThemeError(error)) {
        expect(error.code).toBe('THEME_NOT_REGISTERED');
      }
    }
  });

  it('rejects malformed theme ids', () => {
    expect(isValidThemeIdFormat('mdj-dark-gold')).toBe(true);
    expect(isValidThemeIdFormat('Bad.Id')).toBe(false);
  });

  it('maps default theme ids by mode', () => {
    expect(getDefaultThemeIdForMode('dark')).toBe(DEFAULT_DARK_THEME_ID);
    expect(getDefaultThemeIdForMode('dark')).toBe('mdj-dark-gold');
    expect(getDefaultThemeIdForMode('light')).toBe(DEFAULT_LIGHT_THEME_ID);
    expect(getDefaultThemeIdForMode('light')).toBe('mdj-light');
  });

  it('lists dark themes including high contrast and light theme separately', () => {
    const darkThemes = listThemesByMode('dark');
    const lightThemes = listThemesByMode('light');

    expect(darkThemes).toHaveLength(2);
    expect(lightThemes).toHaveLength(1);
    expect(darkThemes.map((theme) => theme.id)).toEqual([
      'mdj-dark-gold',
      'mdj-dark-gold-high-contrast',
    ]);
    expect(lightThemes[0]?.id).toBe('mdj-light');
  });

  it('keeps high contrast theme in dark mode', () => {
    const highContrast = assertThemeRegistered('mdj-dark-gold-high-contrast');
    expect(highContrast.mode).toBe('dark');
  });

  it('uses the same token key set across all themes', () => {
    const themes = listThemes();
    const keySets = themes.map((theme) => Object.keys(theme.tokens).sort());
    expect(keySets[0]).toEqual(keySets[1]);
    expect(keySets[0]).toEqual(keySets[2]);
    expect(keySets[0]?.length).toBeGreaterThan(0);
  });

  it('keeps registry immutable after load', () => {
    expect(Object.isFrozen(THEME_REGISTRY)).toBe(true);
    for (const theme of listThemes()) {
      expect(Object.isFrozen(theme)).toBe(true);
      expect(Object.isFrozen(theme.tokens)).toBe(true);
    }
  });
});
