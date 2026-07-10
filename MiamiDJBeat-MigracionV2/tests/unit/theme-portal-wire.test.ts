import { beforeEach, describe, expect, it } from 'vitest';
import { bootScaffold } from '@mdj/bootstrap/boot';
import { resetRuntimeForTests } from '../../shared/runtime/index';
import { resetConfigurationForTests } from '@mdj/shared/config';
import { resetEventBusForTests } from '@mdj/shared/events';
import { resetErrorHandlerForTests } from '@mdj/shared/errors';
import { resetLoggingForTests } from '@mdj/shared/logging';
import { resetSessionForTests } from '@mdj/shared/session';
import {
  getClientPortalThemeWireRegistry,
  resetClientPortalThemeWireForTests,
  resolveClientPortalThemeWire,
} from '../../client/theme-wire';
import {
  getArtistPortalThemeWireRegistry,
  resetArtistPortalThemeWireForTests,
  resolveArtistPortalThemeWire,
} from '../../artist/theme-wire';
import {
  getStaffPortalThemeWireRegistry,
  resetStaffPortalThemeWireForTests,
  resolveStaffPortalThemeWire,
} from '../../staff/theme-wire';
import { resetThemeBootIntegrationForTests } from '../../shared/theme/runtime';

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

describe('MOD-007 Portal Theme Wires', () => {
  beforeEach(() => {
    resetThemeBootIntegrationForTests();
    resetRuntimeForTests();
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    resetClientPortalThemeWireForTests();
    resetArtistPortalThemeWireForTests();
    resetStaffPortalThemeWireForTests();
  });

  it('resolves client portal theme wire after boot', () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');
    expect(boot.ok).toBe(true);

    const registry = resolveClientPortalThemeWire();
    expect(registry.portal).toBe('client');
    expect(registry.snapshot.themeId).toBe('mdj-dark-gold');
    expect(registry.cssVariables.length).toBeGreaterThan(0);
    expect(getClientPortalThemeWireRegistry()).toBe(registry);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--mdj-brand-gold-primary')).toBe('#C9A227');
  });

  it('resolves artist portal theme wire after boot', () => {
    bootScaffold(VALID_LOCAL_ENV, 'artist');
    const registry = resolveArtistPortalThemeWire();
    expect(registry.portal).toBe('artist');
    expect(getArtistPortalThemeWireRegistry()).toBe(registry);
  });

  it('resolves staff portal theme wire after boot', () => {
    bootScaffold(VALID_LOCAL_ENV, 'staff');
    const registry = resolveStaffPortalThemeWire();
    expect(registry.portal).toBe('staff');
    expect(getStaffPortalThemeWireRegistry()).toBe(registry);
  });
});
