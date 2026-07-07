import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  getClientPortalComponentGuardBundle,
  getClientPortalComponentGuardRegistry,
  resetClientPortalComponentGuardRegistryForTests,
  resolveClientPortalComponentGuards,
} from '../../client/component-guards-wire';
import {
  initializeSession,
  ingestAuthHandle,
  resetSessionForTests,
  setSessionPermissionFlagsForTests,
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
  initializeSession({ portal: 'client' });
}

function validHandle() {
  return {
    handoffId: 'handoff-client-wire-1',
    userId: 'user-client-wire-1',
    accessTokenRef: 'opaque-access-ref',
    refreshTokenRef: 'opaque-refresh-ref',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    provider: 'mock' as const,
    issuedAt: new Date().toISOString(),
  };
}

describe('MOD-003 Client Portal Component Guards Wire', () => {
  beforeEach(() => {
    resetClientPortalComponentGuardRegistryForTests();
    resetConfigurationForTests();
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    resetLoggingForTests();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    resetErrorHandlerForTests();
    initializeErrorHandler();
    resetSessionForTests();
  });

  it('registers all client portal candidate components', () => {
    bootThroughSession();
    const registry = resolveClientPortalComponentGuards();

    expect(registry.portal).toBe('client');
    expect(registry.componentCount).toBe(12);
    expect(registry.components).toHaveLength(12);
    expect(getClientPortalComponentGuardRegistry()).toBe(registry);
  });

  it('resolves render, enable, and action results for each component', () => {
    bootThroughSession();
    const registry = resolveClientPortalComponentGuards();

    for (const bundle of registry.components) {
      expect(bundle.render.componentId).toBe(bundle.componentId);
      expect(bundle.enable.componentId).toBe(bundle.componentId);
      expect(bundle.action.componentId).toBe(bundle.componentId);
      expect(bundle.render.visibility).toBeDefined();
      expect(bundle.enable.visibility).toBeDefined();
      expect(bundle.action.reason).toBeDefined();
    }
  });

  it('allows checkout action for buyer and hides vip banner for regular client', () => {
    bootThroughSession();
    ingestAuthHandle(validHandle());
    resolveClientPortalComponentGuards();

    const checkout = getClientPortalComponentGuardBundle('client.checkout.button');
    const vipBanner = getClientPortalComponentGuardBundle('client.vip.banner');

    expect(checkout?.action.allowed).toBe(true);
    expect(checkout?.sessionCapabilityProbe).toBe(true);
    expect(vipBanner?.render.allowed).toBe(false);
    expect(vipBanner?.render.visibility).toBe('HIDDEN');
    expect(vipBanner?.sessionCapabilityProbe).toBe(false);
  });

  it('shows vip banner bundle as granted for vip profile with clientVip flag', () => {
    bootThroughSession();
    setSessionPermissionProfileForTests({ kind: 'client', profileId: 'client.vip' });
    setSessionPermissionFlagsForTests({ clientVip: true });
    ingestAuthHandle(validHandle());
    resolveClientPortalComponentGuards();

    const vipBanner = getClientPortalComponentGuardBundle('client.vip.banner');

    expect(vipBanner?.render.allowed).toBe(true);
    expect(vipBanner?.render.visibility).toBe('VISIBLE');
    expect(vipBanner?.sessionCapabilityProbe).toBe(true);
  });

  it('keeps registry immutable after resolve', () => {
    bootThroughSession();
    const registry = resolveClientPortalComponentGuards();

    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.components)).toBe(true);
    for (const bundle of registry.components) {
      expect(Object.isFrozen(bundle)).toBe(true);
      expect(Object.isFrozen(bundle.render)).toBe(true);
      expect(Object.isFrozen(bundle.enable)).toBe(true);
      expect(Object.isFrozen(bundle.action)).toBe(true);
    }
  });

  it('connects all documented client candidate component ids', () => {
    bootThroughSession();
    const registry = resolveClientPortalComponentGuards();
    const ids = registry.components.map((entry) => entry.componentId);

    expect(ids).toEqual(
      expect.arrayContaining([
        'client.checkout.button',
        'client.vip.banner',
        'client.payments.panel',
        'client.documents.tab',
        'client.notifications.panel',
        'client.orders.panel',
        'client.account.form',
        'client.shop.browse.grid',
        'client.login.button',
        'client.profile.save.button',
        'client.checkout.summary',
        'client.vip.crown.badge',
      ]),
    );
  });
});
