import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  getStaffPortalComponentGuardBundle,
  getStaffPortalComponentGuardRegistry,
  resetStaffPortalComponentGuardRegistryForTests,
  resolveStaffPortalComponentGuards,
} from '../../staff/component-guards-wire';
import {
  initializeSession,
  ingestAuthHandle,
  resetSessionForTests,
  setSessionPermissionProfileForTests,
} from '../../shared/session/runtime';

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

function bootThroughSession(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
  initializeSession({ portal: 'staff' });
}

function validHandle() {
  return {
    handoffId: 'handoff-staff-wire-1',
    userId: 'user-staff-wire-1',
    accessTokenRef: 'opaque-access-ref',
    refreshTokenRef: 'opaque-refresh-ref',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    provider: 'mock' as const,
    issuedAt: new Date().toISOString(),
  };
}

describe('MOD-003 Staff Portal Component Guards Wire', () => {
  beforeEach(() => {
    resetStaffPortalComponentGuardRegistryForTests();
    resetConfigurationForTests();
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    resetLoggingForTests();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    resetErrorHandlerForTests();
    initializeErrorHandler();
    resetSessionForTests();
  });

  it('registers all staff portal candidate components', () => {
    bootThroughSession();
    const registry = resolveStaffPortalComponentGuards();

    expect(registry.portal).toBe('staff');
    expect(registry.componentCount).toBe(26);
    expect(registry.components).toHaveLength(26);
    expect(getStaffPortalComponentGuardRegistry()).toBe(registry);
  });

  it('resolves render, enable, and action results for each component', () => {
    bootThroughSession();
    const registry = resolveStaffPortalComponentGuards();

    for (const bundle of registry.components) {
      expect(bundle.render.componentId).toBe(bundle.componentId);
      expect(bundle.enable.componentId).toBe(bundle.componentId);
      expect(bundle.action.componentId).toBe(bundle.componentId);
      expect(bundle.render.visibility).toBeDefined();
      expect(bundle.enable.visibility).toBeDefined();
      expect(bundle.action.reason).toBeDefined();
    }
  });

  it('returns READ_ONLY invoice panel for seller', () => {
    bootThroughSession();
    setSessionPermissionProfileForTests({ kind: 'staff', profileId: 'staff.seller' });
    ingestAuthHandle(validHandle());
    resolveStaffPortalComponentGuards();

    const panel = getStaffPortalComponentGuardBundle('staff.invoice.panel');
    expect(panel?.render.allowed).toBe(true);
    expect(panel?.render.visibility).toBe('READ_ONLY');
    expect(panel?.render.reason).toBe('READ_ONLY');
  });

  it('hides invoice create button for seller and allows it for manager', () => {
    bootThroughSession();
    setSessionPermissionProfileForTests({ kind: 'staff', profileId: 'staff.seller' });
    ingestAuthHandle(validHandle());
    resolveStaffPortalComponentGuards();

    const sellerCreate = getStaffPortalComponentGuardBundle('staff.invoice.create.button');
    expect(sellerCreate?.render.allowed).toBe(false);
    expect(sellerCreate?.render.visibility).toBe('HIDDEN');

    resetStaffPortalComponentGuardRegistryForTests();
    resetSessionForTests();
    bootThroughSession();
    setSessionPermissionProfileForTests({ kind: 'staff', profileId: 'staff.manager' });
    ingestAuthHandle(validHandle());
    resolveStaffPortalComponentGuards();

    const managerCreate = getStaffPortalComponentGuardBundle('staff.invoice.create.button');
    expect(managerCreate?.action.allowed).toBe(true);
    expect(managerCreate?.action.visibility).toBe('VISIBLE');
  });

  it('shows featureflags panel for owner and hides it for manager', () => {
    bootThroughSession();
    setSessionPermissionProfileForTests({ kind: 'staff', profileId: 'staff.owner' });
    ingestAuthHandle(validHandle());
    resolveStaffPortalComponentGuards();

    const ownerPanel = getStaffPortalComponentGuardBundle('staff.featureflags.panel');
    expect(ownerPanel?.render.allowed).toBe(true);
    expect(ownerPanel?.render.visibility).toBe('VISIBLE');

    resetStaffPortalComponentGuardRegistryForTests();
    resetSessionForTests();
    bootThroughSession();
    setSessionPermissionProfileForTests({ kind: 'staff', profileId: 'staff.manager' });
    ingestAuthHandle(validHandle());
    resolveStaffPortalComponentGuards();

    const managerPanel = getStaffPortalComponentGuardBundle('staff.featureflags.panel');
    expect(managerPanel?.render.allowed).toBe(false);
    expect(managerPanel?.render.visibility).toBe('HIDDEN');
  });

  it('keeps registry immutable after resolve', () => {
    bootThroughSession();
    const registry = resolveStaffPortalComponentGuards();

    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.components)).toBe(true);
    for (const bundle of registry.components) {
      expect(Object.isFrozen(bundle)).toBe(true);
      expect(Object.isFrozen(bundle.render)).toBe(true);
      expect(Object.isFrozen(bundle.enable)).toBe(true);
      expect(Object.isFrozen(bundle.action)).toBe(true);
    }
  });
});
