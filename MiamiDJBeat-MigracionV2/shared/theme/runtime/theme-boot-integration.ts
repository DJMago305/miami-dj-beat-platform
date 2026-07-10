/** MOD-007 Theme Manager — boot integration — TICKET-MOD-007-THEME-INTEGRATION-001 */

import { getEventBus } from '@mdj/shared/events';
import {
  getThemeRuntimeState,
  initializeThemeRuntime,
  isThemeReady,
  resetThemeRuntimeForTests,
} from './theme-runtime';
import type { InitializeThemeRuntimeInput, ThemeMode, ThemeSnapshot, ThemeId } from './types';

export type ThemePortalId = 'client' | 'artist' | 'staff';

export type ThemeBootIntegrationInput = InitializeThemeRuntimeInput & {
  readonly portal: ThemePortalId;
};

export type ThemeBootIntegrationResult = {
  readonly themeReady: boolean;
  readonly eventsEmitted: boolean;
};

export type ThemeBootEventPayload = {
  readonly mode: ThemeMode;
  readonly themeId: ThemeId;
  readonly portal: ThemePortalId;
};

let bootEventsEmitted = false;
let lastBootEventPayload: ThemeBootEventPayload | null = null;

function buildEventPayload(
  portal: ThemePortalId,
  snapshot: ThemeSnapshot,
): ThemeBootEventPayload {
  return Object.freeze({
    mode: snapshot.mode,
    themeId: snapshot.themeId,
    portal,
  });
}

function emitThemeBootEvents(portal: ThemePortalId, snapshot: ThemeSnapshot): void {
  if (bootEventsEmitted) {
    return;
  }

  const payload = buildEventPayload(portal, snapshot);
  const bus = getEventBus();
  const emitter = Object.freeze({ moduleId: 'MOD-007', source: 'theme-boot' });
  const correlationId = `theme-boot-${portal}`;

  bus.publish({
    name: 'THEME_READY',
    emitter,
    payload: {
      mode: payload.mode,
      themeId: payload.themeId,
      portal: payload.portal,
    },
    correlationId,
  });

  bus.publish({
    name: 'THEME_CHANGED',
    emitter,
    payload: {
      mode: payload.mode,
      themeId: payload.themeId,
      portal: payload.portal,
    },
    correlationId,
  });

  bootEventsEmitted = true;
  lastBootEventPayload = payload;
}

export function bootIntegrateTheme(input: ThemeBootIntegrationInput): ThemeBootIntegrationResult {
  initializeThemeRuntime(input);

  const runtimeState = getThemeRuntimeState();
  const ready = isThemeReady() && runtimeState.snapshot !== null;

  if (ready && runtimeState.snapshot) {
    emitThemeBootEvents(input.portal, runtimeState.snapshot);
  }

  return Object.freeze({
    themeReady: ready,
    eventsEmitted: bootEventsEmitted,
  });
}

export function getThemeBootEventPayloadForTests(): ThemeBootEventPayload | null {
  return lastBootEventPayload;
}

export function wereThemeBootEventsEmittedForTests(): boolean {
  return bootEventsEmitted;
}

/** Test-only reset — not for production portals. */
export function resetThemeBootIntegrationForTests(): void {
  bootEventsEmitted = false;
  lastBootEventPayload = null;
  resetThemeRuntimeForTests();
}
