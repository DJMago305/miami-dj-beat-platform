import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootScaffold } from '@mdj/bootstrap/boot';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import { initializeSession, resetSessionForTests } from '@mdj/shared/session';
import {
  bootIntegrateTheme,
  getThemeBootEventPayloadForTests,
  isThemeReady,
  resetThemeBootIntegrationForTests,
  wereThemeBootEventsEmittedForTests,
} from '../../shared/theme/runtime';
import * as themeResolver from '../../shared/theme/runtime/theme-resolver';

const VALID_LOCAL_ENV = {
  MDJ_V2_ENV: 'local',
  MDJ_V2_APP_NAME: 'MiamiDJBeat-MigracionV2',
  MDJ_V2_DEPLOY_ROOT: '/',
  MDJ_V2_PORTAL_CLIENT_URL: 'http://localhost:5173/client/',
  MDJ_V2_PORTAL_ARTIST_URL: 'http://localhost:5173/artist/',
  MDJ_V2_PORTAL_STAFF_URL: 'http://localhost:5173/staff/',
  MDJ_V2_DEFAULT_LOCALE: 'en',
  MDJ_V2_DEFAULT_THEME: 'dark',
  MDJ_V2_LOG_LEVEL: 'debug',
  MDJ_V2_API_PUBLIC_URL: 'https://example.supabase.co',
  MDJ_V2_API_ANON_KEY: 'YOUR_ANON_KEY',
};

function bootThroughSession(portal: 'client' | 'artist' | 'staff' = 'client'): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
  initializeSession({ portal });
}

describe('MOD-007 Theme Boot Integration', () => {
  beforeEach(() => {
    resetThemeBootIntegrationForTests();
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('integrates theme runtime to READY during bootScaffold', () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');

    expect(boot.ok).toBe(true);
    if (boot.ok) {
      expect(boot.phase).toBe('theme');
      expect(boot.themeReady).toBe(true);
      expect(boot.sessionReady).toBe(true);
    }
    expect(isThemeReady()).toBe(true);
  });

  it('emits THEME_READY and THEME_CHANGED exactly once during boot integration', () => {
    bootThroughSession('artist');

    const first = bootIntegrateTheme({
      portal: 'artist',
      configDefaultMode: 'dark',
      sessionThemeMode: 'dark',
    });
    const second = bootIntegrateTheme({
      portal: 'artist',
      configDefaultMode: 'light',
      sessionThemeMode: 'light',
    });

    expect(first.themeReady).toBe(true);
    expect(first.eventsEmitted).toBe(true);
    expect(second.eventsEmitted).toBe(true);
    expect(wereThemeBootEventsEmittedForTests()).toBe(true);
    expect(getThemeBootEventPayloadForTests()?.portal).toBe('artist');

    const history = getEventBus().getHistory();
    const readyEvents = history.filter((entry) => entry.name === 'THEME_READY');
    const changedEvents = history.filter((entry) => entry.name === 'THEME_CHANGED');
    expect(readyEvents).toHaveLength(1);
    expect(changedEvents).toHaveLength(1);
    expect(readyEvents[0]?.payload).toMatchObject({
      mode: 'dark',
      themeId: 'mdj-dark-gold',
      portal: 'artist',
    });
    expect(changedEvents[0]?.payload).toMatchObject({
      mode: 'dark',
      themeId: 'mdj-dark-gold',
      portal: 'artist',
    });
  });

  it('returns themeReady false when runtime integration fails', () => {
    bootThroughSession('client');
    vi.spyOn(themeResolver, 'resolveTheme').mockImplementation(() => {
      throw new Error('forced theme failure');
    });

    const result = bootIntegrateTheme({
      portal: 'client',
      configDefaultMode: 'dark',
    });

    expect(result.themeReady).toBe(false);
    expect(wereThemeBootEventsEmittedForTests()).toBe(false);
  });
});
