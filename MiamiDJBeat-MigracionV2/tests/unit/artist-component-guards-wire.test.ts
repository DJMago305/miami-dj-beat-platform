import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { initializeEventBus } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  getArtistPortalComponentGuardBundle,
  getArtistPortalComponentGuardRegistry,
  resetArtistPortalComponentGuardRegistryForTests,
  resolveArtistPortalComponentGuards,
} from '../../artist/component-guards-wire';
import {
  initializeSession,
  ingestAuthHandle,
  resetSessionForTests,
  setSessionPermissionFlagsForTests,
  setSessionPermissionProfileForTests,
} from '../../shared/session/runtime';
import {
  canRenderComponent,
  resolvePermissionSnapshot,
  type CapabilityId,
  type PermissionSnapshot,
} from '../../shared/permissions/runtime';

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

const ARTIST_CANDIDATE_COMPONENT_IDS = [
  'artist.cashflow.card',
  'artist.analytics.card',
  'artist.song4tips.card',
  'artist.academy.card',
  'artist.media.upload.button',
  'artist.jobs.button',
  'artist.jobs.panel',
  'artist.calendar.editor',
  'artist.calendar.view',
  'artist.tools.link',
  'artist.profile.edit.form',
  'artist.notifications.panel',
  'artist.orders.panel',
  'artist.cashflow.export.button',
] as const;

function bootThroughSession(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
  initializeSession({ portal: 'artist' });
}

function validHandle() {
  return {
    handoffId: 'handoff-artist-wire-1',
    userId: 'user-artist-wire-1',
    accessTokenRef: 'opaque-access-ref',
    refreshTokenRef: 'opaque-refresh-ref',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    provider: 'mock' as const,
    issuedAt: new Date().toISOString(),
  };
}

function snapshotWithCapabilities(
  base: PermissionSnapshot,
  capabilities: readonly string[],
): PermissionSnapshot {
  const sorted = Object.freeze([...(capabilities as CapabilityId[])].sort());

  return Object.freeze({
    ...base,
    capabilities: sorted,
    capabilityCount: sorted.length,
  });
}

describe('MOD-003 Artist Portal Component Guards Wire', () => {
  beforeEach(() => {
    resetArtistPortalComponentGuardRegistryForTests();
    resetConfigurationForTests();
    initializeConfiguration(VALID_LOCAL_ENV);
    initializeEventBus();
    resetLoggingForTests();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    resetErrorHandlerForTests();
    initializeErrorHandler();
    resetSessionForTests();
  });

  it('registers all artist portal candidate components', () => {
    bootThroughSession();
    const registry = resolveArtistPortalComponentGuards();

    expect(registry.portal).toBe('artist');
    expect(registry.componentCount).toBe(14);
    expect(registry.components).toHaveLength(14);
    expect(getArtistPortalComponentGuardRegistry()).toBe(registry);
  });

  it('resolves render, enable, and action results for each component', () => {
    bootThroughSession();
    const registry = resolveArtistPortalComponentGuards();

    for (const bundle of registry.components) {
      expect(bundle.render.componentId).toBe(bundle.componentId);
      expect(bundle.enable.componentId).toBe(bundle.componentId);
      expect(bundle.action.componentId).toBe(bundle.componentId);
      expect(bundle.render.visibility).toBeDefined();
      expect(bundle.enable.visibility).toBeDefined();
      expect(bundle.action.reason).toBeDefined();
    }
  });

  it('connects all documented artist candidate component ids', () => {
    bootThroughSession();
    const registry = resolveArtistPortalComponentGuards();
    const ids = registry.components.map((entry) => entry.componentId);

    expect(ids).toEqual(expect.arrayContaining([...ARTIST_CANDIDATE_COMPONENT_IDS]));
    expect(ids).toHaveLength(ARTIST_CANDIDATE_COMPONENT_IDS.length);
  });

  it('hides song4tips card for artist lite and shows it for artist pro with sftOk', () => {
    bootThroughSession();
    setSessionPermissionProfileForTests({
      kind: 'artist',
      profileId: 'artist.dj',
      tier: 'Lite',
    });
    setSessionPermissionFlagsForTests({ sftOk: true });
    ingestAuthHandle(validHandle());
    resolveArtistPortalComponentGuards();

    const liteCard = getArtistPortalComponentGuardBundle('artist.song4tips.card');
    expect(liteCard?.render.allowed).toBe(false);
    expect(liteCard?.render.visibility).toBe('HIDDEN');

    resetSessionForTests();
    bootThroughSession();
    setSessionPermissionProfileForTests({
      kind: 'artist',
      profileId: 'artist.dj',
      tier: 'Pro',
    });
    setSessionPermissionFlagsForTests({ sftOk: true });
    ingestAuthHandle(validHandle());
    resolveArtistPortalComponentGuards();

    const proCard = getArtistPortalComponentGuardBundle('artist.song4tips.card');
    expect(proCard?.render.allowed).toBe(true);
    expect(proCard?.render.visibility).toBe('VISIBLE');
    expect(proCard?.sessionCapabilityProbe).toBe(true);
  });

  it('returns READ_ONLY for calendar editor when only read capability is present', () => {
    bootThroughSession();
    setSessionPermissionProfileForTests({
      kind: 'artist',
      profileId: 'artist.dj',
      tier: 'Lite',
    });
    ingestAuthHandle(validHandle());

    const base = resolvePermissionSnapshot({
      profile: { kind: 'artist', profileId: 'artist.dj', tier: 'Lite' },
      portal: 'artist',
    });
    const readOnlySnapshot = snapshotWithCapabilities(base, ['artist.calendar.read.own']);

    const render = canRenderComponent({
      componentId: 'artist.calendar.editor',
      portal: 'artist',
      snapshot: readOnlySnapshot,
    });

    expect(render.allowed).toBe(true);
    expect(render.visibility).toBe('READ_ONLY');
    expect(render.reason).toBe('READ_ONLY');
  });

  it('allows jobs action for artist lite performer', () => {
    bootThroughSession();
    setSessionPermissionProfileForTests({
      kind: 'artist',
      profileId: 'artist.dj',
      tier: 'Lite',
    });
    ingestAuthHandle(validHandle());
    resolveArtistPortalComponentGuards();

    const jobsButton = getArtistPortalComponentGuardBundle('artist.jobs.button');
    expect(jobsButton?.action.allowed).toBe(true);
    expect(jobsButton?.action.matchedCapabilities).toEqual(
      expect.arrayContaining(['jobs.apply']),
    );
  });

  it('keeps registry immutable after resolve', () => {
    bootThroughSession();
    const registry = resolveArtistPortalComponentGuards();

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
