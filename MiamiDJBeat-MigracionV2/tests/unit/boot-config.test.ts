import { beforeEach, describe, expect, it } from 'vitest';
import { bootScaffold } from '@mdj/bootstrap/boot';
import { resetRuntimeForTests } from '@mdj/shared/index';
import {
  getConfigState,
  resetConfigurationForTests,
} from '@mdj/shared/config';
import {
  getErrorState,
  resetErrorHandlerForTests,
} from '@mdj/shared/errors';
import { getEventBusState, resetEventBusForTests } from '@mdj/shared/events';
import { getLoggingState, resetLoggingForTests } from '@mdj/shared/logging';
import { getSessionState, resetSessionForTests } from '@mdj/shared/session';
import { isThemeReady, resetThemeBootIntegrationForTests } from '@mdj/shared/theme';

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

describe('boot + Core through MOD-007 Theme', () => {
  beforeEach(() => {
    resetThemeBootIntegrationForTests();
    resetRuntimeForTests();
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('bootScaffold succeeds through theme phase', () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');
    expect(boot.ok).toBe(true);
    if (boot.ok) {
      expect(boot.phase).toBe('theme');
      expect(boot.sessionReady).toBe(true);
      expect(boot.runtimeReady).toBe(true);
      expect(boot.systemReadyConfirmed).toBe(true);
      expect(boot.themeReady).toBe(true);
      expect(boot.sessionState).toBe('SESSION_READY');
      expect(boot.runtimeState.lifecycle).toBe('RUNTIME_READY');
      expect(boot.errorHandlerReady).toBe(true);
    }
    expect(isThemeReady()).toBe(true);
  });

  it('bootScaffold returns controlled failure on missing env', () => {
    const boot = bootScaffold({ MDJ_V2_DEPLOY_ROOT: '/' });
    expect(boot.ok).toBe(false);
    if (!boot.ok) {
      expect(boot.sessionReady).toBe(false);
      expect(boot.themeReady).toBe(false);
      expect(boot.errorCode).toBe('CONFIG_ERROR_MISSING_KEY');
    }
    expect(getConfigState()).toBe('ERROR');
    expect(getEventBusState()).toBe('BUS_UNINITIALIZED');
    expect(getLoggingState()).toBe('LOG_UNINITIALIZED');
    expect(getErrorState()).toBe('ERR_UNINITIALIZED');
    expect(getSessionState()).toBe('SESSION_UNINITIALIZED');
    expect(isThemeReady()).toBe(false);
  });
});
