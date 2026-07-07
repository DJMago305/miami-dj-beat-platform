import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FALLBACK_THEME_ID,
  THEME_REGISTRY,
  ThemeError,
  getActiveTheme,
  getThemeDefinition,
  getThemeRuntimeLifecycleForTests,
  getThemeRuntimeState,
  initializeThemeRuntime,
  isThemeError,
  isThemeReady,
  resetThemeRuntimeForTests,
} from '../../shared/theme/runtime';
import * as themeResolver from '../../shared/theme/runtime/theme-resolver';
import { getThemeRuntimeLifecycleForTests } from '../../shared/theme/runtime/theme-runtime';

describe('MOD-007 Theme Runtime', () => {
  afterEach(() => {
    resetThemeRuntimeForTests();
    vi.restoreAllMocks();
  });

  it('starts in UNKNOWN before initialization', () => {
    const state = getThemeRuntimeState();
    expect(state.lifecycle).toBe('UNKNOWN');
    expect(state.snapshot).toBeNull();
    expect(isThemeReady()).toBe(false);
  });

  it('initializes to READY with a resolved dark default theme', () => {
    const state = initializeThemeRuntime({ configDefaultMode: 'dark' });

    expect(getThemeRuntimeLifecycleForTests()).toBe('READY');
    expect(state.lifecycle).toBe('READY');
    expect(isThemeReady()).toBe(true);
    expect(state.snapshot?.themeId).toBe('mdj-dark-gold');
    expect(state.snapshot?.reason).toBe('config');
    expect(getActiveTheme().themeId).toBe('mdj-dark-gold');
  });

  it('resolves fallback theme when config mode is invalid', () => {
    const state = initializeThemeRuntime({ configDefaultMode: 'neon' });

    expect(state.lifecycle).toBe('READY');
    expect(state.snapshot?.themeId).toBe(FALLBACK_THEME_ID);
    expect(state.snapshot?.reason).toBe('fallback');
    expect(getActiveTheme().reason).toBe('fallback');
  });

  it('enters FAILED when resolver throws for invalid theme id format', () => {
    const state = initializeThemeRuntime({
      configDefaultMode: 'dark',
      themeId: 'Bad.Id',
    });

    expect(state.lifecycle).toBe('FAILED');
    expect(state.errorCode).toBe('THEME_INVALID_ID');
    expect(state.snapshot).toBeNull();
    expect(isThemeReady()).toBe(false);
    expect(() => getActiveTheme()).toThrow(ThemeError);
  });

  it('enters FAILED when registry is empty', () => {
    vi.spyOn(themeResolver, 'resolveTheme').mockImplementation(() => {
      throw new ThemeError('THEME_REGISTRY_EMPTY', 'Theme registry is empty');
    });

    const state = initializeThemeRuntime({ configDefaultMode: 'dark' });

    expect(state.lifecycle).toBe('FAILED');
    expect(state.errorCode).toBe('THEME_REGISTRY_EMPTY');
    expect(isThemeReady()).toBe(false);
  });

  it('is idempotent across multiple initialize calls', () => {
    const first = initializeThemeRuntime({
      configDefaultMode: 'dark',
      userPreference: 'light',
    });
    const second = initializeThemeRuntime({
      configDefaultMode: 'dark',
      userPreference: 'dark',
    });

    expect(second).toBe(first);
    expect(getActiveTheme().themeId).toBe('mdj-light');
    expect(getThemeRuntimeState()).toBe(first);
  });

  it('maps session theme mode input without reading Session runtime', () => {
    const state = initializeThemeRuntime({
      configDefaultMode: 'dark',
      sessionThemeMode: 'light',
    });

    expect(state.lifecycle).toBe('READY');
    expect(state.snapshot?.themeId).toBe('mdj-light');
    expect(state.snapshot?.reason).toBe('user');
  });

  it('exposes immutable runtime state and snapshot', () => {
    const state = initializeThemeRuntime({ configDefaultMode: 'dark' });

    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.snapshot)).toBe(true);
    expect(Object.isFrozen(getActiveTheme())).toBe(true);
    expect(Object.isFrozen(getThemeRuntimeState())).toBe(true);
  });

  it('does not mutate registry entries or token maps', () => {
    const before = getThemeDefinition('mdj-dark-gold');
    const tokenSnapshot = before ? { ...before.tokens } : {};

    initializeThemeRuntime({ configDefaultMode: 'dark', userPreference: 'light' });
    initializeThemeRuntime({ configDefaultMode: 'neon' });
    resetThemeRuntimeForTests();
    initializeThemeRuntime({ configDefaultMode: 'dark', themeId: 'Bad.Id' });

    const after = getThemeDefinition('mdj-dark-gold');
    expect(after?.tokens).toEqual(tokenSnapshot);
    expect(THEME_REGISTRY.size).toBe(3);
  });

  it('resets runtime state for tests', () => {
    initializeThemeRuntime({ configDefaultMode: 'dark' });
    expect(isThemeReady()).toBe(true);

    resetThemeRuntimeForTests();

    expect(isThemeReady()).toBe(false);
    expect(getThemeRuntimeState().lifecycle).toBe('UNKNOWN');
    expect(getThemeRuntimeLifecycleForTests()).toBe('UNKNOWN');
  });

  it('getActiveTheme throws THEME_RUNTIME_NOT_READY before initialize', () => {
    expect(() => getActiveTheme()).toThrow(ThemeError);

    try {
      getActiveTheme();
    } catch (error) {
      expect(isThemeError(error)).toBe(true);
      if (isThemeError(error)) {
        expect(error.code).toBe('THEME_RUNTIME_NOT_READY');
      }
    }
  });

  it('keeps resolver as the only resolution path', () => {
    const resolveSpy = vi.spyOn(themeResolver, 'resolveTheme');

    initializeThemeRuntime({
      configDefaultMode: 'light',
      userPreference: 'system',
      systemPreference: 'dark',
    });

    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(resolveSpy).toHaveBeenCalledWith({
      configDefaultMode: 'light',
      userPreference: 'system',
      systemPreference: 'dark',
    });
    expect(getActiveTheme().themeId).toBe('mdj-dark-gold');
  });
});
