/** MOD-007 Theme Manager — theme runtime — TICKET-MOD-007-THEME-RUNTIME-001 */

import { ThemeError, isThemeError } from './errors';
import { resolveTheme } from './theme-resolver';
import type {
  InitializeThemeRuntimeInput,
  ThemeResolveInput,
  ThemeResolveResult,
  ThemeRuntimeLifecycleState,
  ThemeRuntimeState,
  ThemeSnapshot,
} from './types';

let lifecycle: ThemeRuntimeLifecycleState = 'UNKNOWN';
let runtimeState: ThemeRuntimeState | null = null;
let activeTheme: ThemeResolveResult | null = null;

function buildResolveInput(input?: InitializeThemeRuntimeInput): ThemeResolveInput {
  if (!input) {
    return { configDefaultMode: 'dark' };
  }

  const { sessionThemeMode, ...resolveInput } = input;

  if (sessionThemeMode === undefined) {
    return resolveInput;
  }

  return {
    ...resolveInput,
    userPreference: sessionThemeMode,
  };
}

function buildSnapshot(resolved: ThemeResolveResult): ThemeSnapshot {
  return Object.freeze({
    lifecycle: 'READY',
    resolvedAt: new Date().toISOString(),
    themeId: resolved.themeId,
    mode: resolved.mode,
    tokens: resolved.tokens,
    reason: resolved.reason,
  });
}

function buildReadyState(snapshot: ThemeSnapshot): ThemeRuntimeState {
  return Object.freeze({
    lifecycle: 'READY',
    snapshot,
    initializedAt: snapshot.resolvedAt,
  });
}

function buildFailedState(error: unknown): ThemeRuntimeState {
  return Object.freeze({
    lifecycle: 'FAILED',
    snapshot: null,
    initializedAt: new Date().toISOString(),
    errorCode: isThemeError(error) ? error.code : 'THEME_NOT_REGISTERED',
  });
}

export function initializeThemeRuntime(input?: InitializeThemeRuntimeInput): ThemeRuntimeState {
  if (lifecycle === 'READY' && runtimeState) {
    return runtimeState;
  }

  lifecycle = 'INITIALIZING';

  try {
    const resolved = resolveTheme(buildResolveInput(input));
    lifecycle = 'THEME_RESOLVED';

    const snapshot = buildSnapshot(resolved);
    activeTheme = resolved;
    lifecycle = 'READY';
    runtimeState = buildReadyState(snapshot);

    return runtimeState;
  } catch (error) {
    lifecycle = 'FAILED';
    activeTheme = null;
    runtimeState = buildFailedState(error);
    return runtimeState;
  }
}

export function getThemeRuntimeState(): ThemeRuntimeState {
  if (!runtimeState) {
    return Object.freeze({
      lifecycle: 'UNKNOWN',
      snapshot: null,
      initializedAt: null,
    });
  }

  return runtimeState;
}

export function getActiveTheme(): ThemeResolveResult {
  if (lifecycle !== 'READY' || !activeTheme) {
    throw new ThemeError('THEME_RUNTIME_NOT_READY', 'Theme runtime is not READY');
  }

  return activeTheme;
}

export function isThemeReady(): boolean {
  return lifecycle === 'READY' && activeTheme !== null;
}

/** Test-only reset — not for production portals. */
export function resetThemeRuntimeForTests(): void {
  lifecycle = 'UNKNOWN';
  runtimeState = null;
  activeTheme = null;
}

/** Test-only lifecycle probe — not for production portals. */
export function getThemeRuntimeLifecycleForTests(): ThemeRuntimeLifecycleState {
  return lifecycle;
}
