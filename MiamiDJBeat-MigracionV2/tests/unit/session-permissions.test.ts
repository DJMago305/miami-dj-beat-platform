import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  asSessionSnapshotWithPermissions,
  getSessionPermissionResolverInvokeCountForTests,
  getSessionSnapshot,
  hasSessionCapability,
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

function bootThroughErrorHandler(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
}

function validHandle() {
  return {
    handoffId: 'handoff-permissions-1',
    userId: 'user-permissions-1',
    accessTokenRef: 'opaque-access-ref',
    refreshTokenRef: 'opaque-refresh-ref',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    provider: 'mock' as const,
    issuedAt: new Date().toISOString(),
  };
}

function readySnapshot() {
  return asSessionSnapshotWithPermissions(getSessionSnapshot());
}

describe('MOD-003 Session Permission Wire', () => {
  beforeEach(() => {
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
    bootThroughErrorHandler();
  });

  it('SESSION_READY builds a frozen PermissionSnapshot for guest', () => {
    initializeSession({ portal: 'client' });
    const snapshot = readySnapshot();

    expect(snapshot.state).toBe('SESSION_READY');
    expect(snapshot.permissions.documentedRole).toBe('guest');
    expect(snapshot.permissionVersion).toBe(snapshot.permissions.snapshotVersion);
    expect(snapshot.resolvedAt).toBe(snapshot.permissions.resolvedAt);
    expect(snapshot.capabilityCount).toBe(3);
    expect(snapshot.capabilities).toHaveLength(3);
    expect(hasSessionCapability('guest.browse.public')).toBe(true);
    expect(hasSessionCapability('staff.dashboard.access', 'staff')).toBe(false);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.permissions)).toBe(true);
    expect(Object.isFrozen(snapshot.capabilities)).toBe(true);
  });

  it('invokes permission resolver exactly once per SESSION_READY publish', () => {
    initializeSession({ portal: 'artist' });
    expect(getSessionPermissionResolverInvokeCountForTests()).toBe(1);
    getSessionSnapshot();
    expect(getSessionPermissionResolverInvokeCountForTests()).toBe(1);
  });

  it('resolves buyer for client.regular authenticated session', () => {
    initializeSession({ portal: 'client' });
    ingestAuthHandle(validHandle());

    const snapshot = readySnapshot();
    expect(snapshot.permissions.documentedRole).toBe('buyer');
    expect(snapshot.capabilityCount).toBe(9);
    expect(hasSessionCapability('client.shop.checkout')).toBe(true);
    expect(hasSessionCapability('client.vip.benefits')).toBe(false);
  });

  it('denies VIP benefits for client.vip without clientVip flag', () => {
    initializeSession({ portal: 'client' });
    setSessionPermissionProfileForTests({ kind: 'client', profileId: 'client.vip' });
    ingestAuthHandle(validHandle());
    expect(hasSessionCapability('client.vip.benefits')).toBe(false);
  });

  it('grants VIP benefits with client.vip profile and clientVip flag', () => {
    initializeSession({ portal: 'client' });
    setSessionPermissionProfileForTests({ kind: 'client', profileId: 'client.vip' });
    setSessionPermissionFlagsForTests({ clientVip: true });
    ingestAuthHandle(validHandle());

    const snapshot = readySnapshot();
    expect(snapshot.permissions.profile.clientProfileType).toBe('vip');
    expect(hasSessionCapability('client.vip.benefits')).toBe(true);
    expect(snapshot.capabilityCount).toBe(10);
  });

  it('resolves commercial client as buyer base capabilities', () => {
    initializeSession({ portal: 'client' });
    setSessionPermissionProfileForTests({ kind: 'client', profileId: 'client.commercial' });
    ingestAuthHandle(validHandle());

    const snapshot = readySnapshot();
    expect(snapshot.permissions.documentedRole).toBe('buyer');
    expect(snapshot.permissions.profile.clientProfileType).toBe('commercial');
    expect(hasSessionCapability('orders.read.own')).toBe(true);
  });

  it('resolves staff owner, manager, and seller profiles', () => {
    initializeSession({ portal: 'staff' });
    setSessionPermissionProfileForTests({ kind: 'staff', profileId: 'staff.owner' });
    ingestAuthHandle(validHandle());
    expect(readySnapshot().permissions.documentedRole).toBe('staff_owner');
    expect(hasSessionCapability('system.featureflags.override', 'staff')).toBe(true);

    resetSessionForTests();
    bootThroughErrorHandler();
    initializeSession({ portal: 'staff' });
    setSessionPermissionProfileForTests({ kind: 'staff', profileId: 'staff.manager' });
    ingestAuthHandle(validHandle());
    expect(readySnapshot().permissions.documentedRole).toBe('staff_manager');
    expect(hasSessionCapability('staff.invoices.write', 'staff')).toBe(true);

    resetSessionForTests();
    bootThroughErrorHandler();
    initializeSession({ portal: 'staff' });
    setSessionPermissionProfileForTests({ kind: 'staff', profileId: 'staff.seller' });
    ingestAuthHandle(validHandle());
    expect(readySnapshot().permissions.documentedRole).toBe('staff_seller');
    expect(hasSessionCapability('staff.dashboard.access', 'staff')).toBe(true);
    expect(hasSessionCapability('staff.manage', 'staff')).toBe(false);
  });

  it('resolves artist lite, pro, and elite by tier with category orthogonal to tier', () => {
    initializeSession({ portal: 'artist' });
    setSessionPermissionProfileForTests({
      kind: 'artist',
      profileId: 'artist.dj',
      tier: 'Lite',
    });
    ingestAuthHandle(validHandle());

    let snapshot = readySnapshot();
    expect(snapshot.permissions.documentedRole).toBe('artist_lite');
    expect(snapshot.permissions.profile.artistCategory).toBe('DJ');
    expect(snapshot.permissions.profile.artistTier).toBe('Lite');
    expect(hasSessionCapability('artist.tools.use', 'artist')).toBe(true);
    expect(hasSessionCapability('artist.sft.use', 'artist')).toBe(false);

    resetSessionForTests();
    bootThroughErrorHandler();
    initializeSession({ portal: 'artist' });
    setSessionPermissionProfileForTests({
      kind: 'artist',
      profileId: 'artist.dj',
      tier: 'Pro',
    });
    setSessionPermissionFlagsForTests({ sftOk: true });
    ingestAuthHandle(validHandle());

    snapshot = readySnapshot();
    expect(snapshot.permissions.documentedRole).toBe('artist_pro');
    expect(hasSessionCapability('artist.sft.use', 'artist')).toBe(true);

    resetSessionForTests();
    bootThroughErrorHandler();
    initializeSession({ portal: 'artist' });
    setSessionPermissionProfileForTests({
      kind: 'artist',
      profileId: 'artist.singer_solo',
      tier: 'Pro',
    });
    setSessionPermissionFlagsForTests({ sftOk: true });
    ingestAuthHandle(validHandle());
    expect(readySnapshot().permissions.documentedRole).toBe('artist_pro');

    resetSessionForTests();
    bootThroughErrorHandler();
    initializeSession({ portal: 'artist' });
    setSessionPermissionProfileForTests({
      kind: 'artist',
      profileId: 'artist.band_group',
      tier: 'Elite',
    });
    setSessionPermissionFlagsForTests({ sftOk: true });
    ingestAuthHandle(validHandle());

    snapshot = readySnapshot();
    expect(snapshot.permissions.documentedRole).toBe('artist_elite');
    expect(snapshot.permissions.profile.artistCategory).toBe('Band');
    expect(snapshot.permissions.profile.artistTier).toBe('Elite');
    expect(snapshot.permissions.profile.artistCategory).not.toBe(
      snapshot.permissions.profile.artistTier,
    );
  });
});
