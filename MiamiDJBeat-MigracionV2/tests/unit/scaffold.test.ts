import { describe, expect, it, beforeEach } from 'vitest';
import { bootScaffold } from '@mdj/bootstrap/boot';
import { MDJ_V2_RUNTIME_VERSION, RUNTIME_META, resetRuntimeForTests } from '@mdj/shared/index';
import { resetConfigurationForTests } from '@mdj/shared/config';
import { resetEventBusForTests } from '@mdj/shared/events';
import { resetLoggingForTests } from '@mdj/shared/logging';
import { resetErrorHandlerForTests } from '@mdj/shared/errors';
import { resetSessionForTests } from '@mdj/shared/session';
import { resetThemeBootIntegrationForTests } from '@mdj/shared/theme';

const VALID_LOCAL_ENV = {
  MDJ_V2_ENV: 'local',
  MDJ_V2_DEPLOY_ROOT: '/',
  MDJ_V2_PORTAL_CLIENT_URL: 'http://localhost:5173/client/',
  MDJ_V2_PORTAL_ARTIST_URL: 'http://localhost:5173/artist/',
  MDJ_V2_PORTAL_STAFF_URL: 'http://localhost:5173/staff/',
  MDJ_V2_API_PUBLIC_URL: 'https://example.supabase.co',
  MDJ_V2_API_ANON_KEY: 'YOUR_ANON_KEY',
};

/** TICKET-V2-RUNTIME-SCAFFOLD-001 · TICKET-V2-RUNTIME-CONFIG-001 */
describe('scaffold', () => {
  beforeEach(() => {
    resetThemeBootIntegrationForTests();
    resetRuntimeForTests();
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetConfigurationForTests();
    resetEventBusForTests();
  });

  it('bootScaffold resolves theme phase when env valid', () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');
    expect(boot.ok).toBe(true);
    if (boot.ok) {
      expect(boot.phase).toBe('theme');
      expect(boot.configLoaded).toBe(true);
      expect(boot.busReady).toBe(true);
      expect(boot.loggingReady).toBe(true);
      expect(boot.errorHandlerReady).toBe(true);
      expect(boot.sessionReady).toBe(true);
      expect(boot.runtimeReady).toBe(true);
      expect(boot.systemReadyConfirmed).toBe(true);
      expect(boot.themeReady).toBe(true);
    }
  });

  it('runtime meta declares no business logic', () => {
    expect(RUNTIME_META.businessLogic).toBe(false);
    expect(MDJ_V2_RUNTIME_VERSION).toMatch(/runtime-p0/);
  });
});
