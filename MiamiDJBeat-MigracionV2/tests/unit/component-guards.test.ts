import { describe, expect, it } from 'vitest';
import {
  canEnableComponent,
  canRenderComponent,
  canUseAction,
  resolvePermissionSnapshot,
  type CapabilityId,
  type PermissionSnapshot,
} from '../../shared/permissions/runtime';

function snapshotFor(
  profile: Parameters<typeof resolvePermissionSnapshot>[0]['profile'],
  options?: {
    portal?: 'client' | 'artist' | 'staff' | 'guest';
    flags?: { clientVip?: boolean; sftOk?: boolean };
  },
): PermissionSnapshot {
  return resolvePermissionSnapshot({
    profile,
    portal: options?.portal ?? 'client',
    flags: options?.flags,
  });
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

describe('MOD-003 Component Guards', () => {
  describe('Deny-default', () => {
    it('denies unregistered components', () => {
      const result = canRenderComponent({
        componentId: 'client.unknown.component',
        portal: 'client',
        snapshot: snapshotFor({ kind: 'client', profileId: 'client.regular' }),
      });

      expect(result.allowed).toBe(false);
      expect(result.visibility).toBe('HIDDEN');
      expect(result.reason).toBe('COMPONENT_NOT_REGISTERED');
    });

    it('denies portal mismatch', () => {
      const result = canRenderComponent({
        componentId: 'client.checkout.button',
        portal: 'artist',
        snapshot: snapshotFor({ kind: 'client', profileId: 'client.regular' }),
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('COMPONENT_PORTAL_MISMATCH');
    });

    it('denies protected components without snapshot', () => {
      const result = canRenderComponent({
        componentId: 'client.checkout.button',
        portal: 'client',
        snapshot: null,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('SNAPSHOT_REQUIRED');
    });
  });

  describe('Client portal components', () => {
    it('allows buyer to render and use checkout button', () => {
      const snapshot = snapshotFor({ kind: 'client', profileId: 'client.regular' });

      const render = canRenderComponent({
        componentId: 'client.checkout.button',
        portal: 'client',
        snapshot,
      });
      const enable = canEnableComponent({
        componentId: 'client.checkout.button',
        portal: 'client',
        snapshot,
      });
      const action = canUseAction({
        componentId: 'client.checkout.button',
        portal: 'client',
        snapshot,
      });

      expect(render.allowed).toBe(true);
      expect(render.visibility).toBe('VISIBLE');
      expect(render.reason).toBe('GRANTED');
      expect(enable.allowed).toBe(true);
      expect(action.allowed).toBe(true);
      expect(action.matchedCapabilities).toContain('client.shop.checkout');
    });

    it('hides vip banner for regular buyer', () => {
      const snapshot = snapshotFor({ kind: 'client', profileId: 'client.regular' });
      const result = canRenderComponent({
        componentId: 'client.vip.banner',
        portal: 'client',
        snapshot,
      });

      expect(result.allowed).toBe(false);
      expect(result.visibility).toBe('HIDDEN');
      expect(result.reason).toBe('CAPABILITY_DENIED');
      expect(result.requiredCapabilities).toContain('client.vip.benefits');
    });

    it('shows vip banner for vip buyer with clientVip flag', () => {
      const snapshot = snapshotFor(
        { kind: 'client', profileId: 'client.vip' },
        { flags: { clientVip: true } },
      );
      const result = canRenderComponent({
        componentId: 'client.vip.banner',
        portal: 'client',
        snapshot,
      });

      expect(result.allowed).toBe(true);
      expect(result.visibility).toBe('VISIBLE');
      expect(result.reason).toBe('GRANTED');
      expect(result.matchedCapabilities).toContain('client.vip.benefits');
    });
  });

  describe('Artist portal components', () => {
    it('hides song4tips card for artist lite', () => {
      const snapshot = snapshotFor(
        { kind: 'artist', profileId: 'artist.dj', tier: 'Lite' },
        { portal: 'artist', flags: { sftOk: true } },
      );
      const result = canRenderComponent({
        componentId: 'artist.song4tips.card',
        portal: 'artist',
        snapshot,
      });

      expect(result.allowed).toBe(false);
      expect(result.visibility).toBe('HIDDEN');
      expect(result.reason).toBe('CAPABILITY_DENIED');
    });

    it('shows song4tips card for artist pro with sftOk', () => {
      const snapshot = snapshotFor(
        { kind: 'artist', profileId: 'artist.dj', tier: 'Pro' },
        { portal: 'artist', flags: { sftOk: true } },
      );
      const result = canRenderComponent({
        componentId: 'artist.song4tips.card',
        portal: 'artist',
        snapshot,
      });

      expect(result.allowed).toBe(true);
      expect(result.visibility).toBe('VISIBLE');
      expect(result.matchedCapabilities).toContain('artist.sft.use');
    });

    it('returns READ_ONLY for calendar editor when only read capability is present', () => {
      const base = snapshotFor(
        { kind: 'artist', profileId: 'artist.dj', tier: 'Lite' },
        { portal: 'artist' },
      );
      const snapshot = snapshotWithCapabilities(base, ['artist.calendar.read.own']);

      const render = canRenderComponent({
        componentId: 'artist.calendar.editor',
        portal: 'artist',
        snapshot,
      });
      const enable = canEnableComponent({
        componentId: 'artist.calendar.editor',
        portal: 'artist',
        snapshot,
      });
      const action = canUseAction({
        componentId: 'artist.calendar.editor',
        portal: 'artist',
        snapshot,
      });

      expect(render.allowed).toBe(true);
      expect(render.visibility).toBe('READ_ONLY');
      expect(render.reason).toBe('READ_ONLY');
      expect(render.matchedCapabilities).toContain('artist.calendar.read.own');
      expect(enable.allowed).toBe(false);
      expect(enable.visibility).toBe('DISABLED');
      expect(action.allowed).toBe(false);
    });
  });

  describe('Staff portal components', () => {
    it('returns READ_ONLY invoice panel for seller', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.seller' },
        { portal: 'staff' },
      );
      const result = canRenderComponent({
        componentId: 'staff.invoice.panel',
        portal: 'staff',
        snapshot,
      });

      expect(result.allowed).toBe(true);
      expect(result.visibility).toBe('READ_ONLY');
      expect(result.reason).toBe('READ_ONLY');
      expect(result.requiredCapabilities).toContain('staff.dashboard.access');
      expect(result.matchedCapabilities).toContain('staff.invoices.read');
    });

    it('hides invoice create button for seller', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.seller' },
        { portal: 'staff' },
      );
      const result = canRenderComponent({
        componentId: 'staff.invoice.create.button',
        portal: 'staff',
        snapshot,
      });

      expect(result.allowed).toBe(false);
      expect(result.visibility).toBe('HIDDEN');
      expect(result.reason).toBe('CAPABILITY_DENIED');
    });

    it('allows invoice create button for manager', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.manager' },
        { portal: 'staff' },
      );
      const result = canUseAction({
        componentId: 'staff.invoice.create.button',
        portal: 'staff',
        snapshot,
      });

      expect(result.allowed).toBe(true);
      expect(result.visibility).toBe('VISIBLE');
      expect(result.matchedCapabilities).toEqual(
        expect.arrayContaining(['staff.dashboard.access', 'staff.invoices.write']),
      );
    });

    it('shows featureflags panel for owner', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.owner' },
        { portal: 'staff' },
      );
      const result = canRenderComponent({
        componentId: 'staff.featureflags.panel',
        portal: 'staff',
        snapshot,
      });

      expect(result.allowed).toBe(true);
      expect(result.visibility).toBe('VISIBLE');
      expect(result.matchedCapabilities).toContain('system.featureflags.override');
    });

    it('hides featureflags panel for manager', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.manager' },
        { portal: 'staff' },
      );
      const result = canRenderComponent({
        componentId: 'staff.featureflags.panel',
        portal: 'staff',
        snapshot,
      });

      expect(result.allowed).toBe(false);
      expect(result.visibility).toBe('HIDDEN');
      expect(result.reason).toBe('CAPABILITY_DENIED');
    });
  });

  describe('Action and enable enforcement', () => {
    it('blocks action without capability and allows action with capability', () => {
      const buyer = snapshotFor({ kind: 'client', profileId: 'client.regular' });
      const denied = canUseAction({
        componentId: 'client.vip.banner',
        portal: 'client',
        snapshot: buyer,
      });
      const allowed = canUseAction({
        componentId: 'client.checkout.button',
        portal: 'client',
        snapshot: buyer,
      });

      expect(denied.allowed).toBe(false);
      expect(denied.reason).toBe('CAPABILITY_DENIED');
      expect(allowed.allowed).toBe(true);
      expect(allowed.reason).toBe('GRANTED');
    });

    it('returns DISABLED from canEnableComponent when policy applies', () => {
      const guest = snapshotFor({ kind: 'guest' });
      const result = canEnableComponent({
        componentId: 'client.account.form',
        portal: 'client',
        snapshot: guest,
      });

      expect(result.allowed).toBe(false);
      expect(result.visibility).toBe('DISABLED');
      expect(result.reason).toBe('CAPABILITY_DENIED');
    });
  });

  describe('Result integrity', () => {
    it('returns immutable results and does not mutate snapshot', () => {
      const snapshot = snapshotFor({ kind: 'client', profileId: 'client.regular' });
      const beforeCaps = [...snapshot.capabilities];

      const result = canRenderComponent({
        componentId: 'client.checkout.button',
        portal: 'client',
        snapshot,
      });

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.requiredCapabilities)).toBe(true);
      expect(Object.isFrozen(result.matchedCapabilities)).toBe(true);
      expect([...snapshot.capabilities]).toEqual(beforeCaps);
      expect(result.requiredCapabilities).toContain('client.shop.checkout');
    });
  });
});
