import { describe, expect, it } from 'vitest';
import {
  ROUTE_CAPABILITY_MAP,
  ROUTE_COUNT,
  canActivateRoute,
  capabilityAllowedOnPortal,
  getRouteDefinition,
  isRegisteredCapability,
  isRegisteredRoute,
  listRoutesForPortal,
  resolvePermissionSnapshot,
} from '../../shared/permissions/runtime';

function snapshotFor(
  profile: Parameters<typeof resolvePermissionSnapshot>[0]['profile'],
  options?: {
    portal?: 'client' | 'artist' | 'staff' | 'guest';
    flags?: { clientVip?: boolean; sftOk?: boolean };
  },
) {
  return resolvePermissionSnapshot({
    profile,
    portal: options?.portal ?? 'client',
    flags: options?.flags,
  });
}

describe('MOD-003 Route Guards', () => {
  describe('Registry integrity', () => {
    it('registers the expected route count', () => {
      expect(ROUTE_COUNT).toBe(47);
      expect(Object.keys(ROUTE_CAPABILITY_MAP)).toHaveLength(47);
    });

    it('keeps ROUTE_CAPABILITY_MAP immutable', () => {
      expect(Object.isFrozen(ROUTE_CAPABILITY_MAP)).toBe(true);
      for (const definition of Object.values(ROUTE_CAPABILITY_MAP)) {
        expect(Object.isFrozen(definition)).toBe(true);
        expect(Object.isFrozen(definition.requiredCapabilities)).toBe(true);
      }
    });

    it('registers only catalog capabilities on every route', () => {
      for (const definition of Object.values(ROUTE_CAPABILITY_MAP)) {
        for (const capability of definition.requiredCapabilities) {
          expect(isRegisteredCapability(capability)).toBe(true);
        }
      }
    });

    it('respects portal binding for every route capability', () => {
      for (const definition of Object.values(ROUTE_CAPABILITY_MAP)) {
        for (const capability of definition.requiredCapabilities) {
          expect(capabilityAllowedOnPortal(capability, definition.portal)).toBe(true);
        }
      }
    });

    it('requires staff.dashboard.access on all staff routes', () => {
      const staffRoutes = listRoutesForPortal('staff');
      expect(staffRoutes).toHaveLength(22);
      for (const route of staffRoutes) {
        expect(route.requiredCapabilities).toContain('staff.dashboard.access');
      }
    });
  });

  describe('Route lookup helpers', () => {
    it('resolves known and unknown routes', () => {
      expect(getRouteDefinition('client.home')?.portal).toBe('client');
      expect(isRegisteredRoute('client.home')).toBe(true);
      expect(getRouteDefinition('not.registered.route')).toBeNull();
      expect(isRegisteredRoute('not.registered.route')).toBe(false);
    });

    it('lists routes per portal', () => {
      expect(listRoutesForPortal('client')).toHaveLength(11);
      expect(listRoutesForPortal('artist')).toHaveLength(14);
      expect(listRoutesForPortal('staff')).toHaveLength(22);
      expect(listRoutesForPortal('client').every((route) => route.portal === 'client')).toBe(true);
    });
  });

  describe('Deny-default and public routes', () => {
    it('denies unregistered routes', () => {
      const result = canActivateRoute({
        routeId: 'client.unknown',
        portal: 'client',
        snapshot: null,
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('ROUTE_NOT_REGISTERED');
        expect(result.redirectHint).toBe('forbidden');
      }
    });

    it('denies portal mismatch', () => {
      const snapshot = snapshotFor({ kind: 'client', profileId: 'client.regular' });
      const result = canActivateRoute({
        routeId: 'client.home',
        portal: 'artist',
        snapshot,
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('ROUTE_PORTAL_MISMATCH');
        expect(result.redirectHint).toBe('portal-home');
      }
    });

    it('allows public client.home without snapshot', () => {
      const result = canActivateRoute({
        routeId: 'client.home',
        portal: 'client',
        snapshot: null,
      });

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.matchedCapabilities).toEqual([]);
        expect(result.redirectHint).toBe('none');
      }
    });

    it('denies protected client.account without snapshot', () => {
      const result = canActivateRoute({
        routeId: 'client.account',
        portal: 'client',
        snapshot: null,
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('SNAPSHOT_REQUIRED');
        expect(result.redirectHint).toBe('login');
        expect(result.requiredCapabilities).toContain('client.profile.edit.own');
      }
    });
  });

  describe('Client portal routes', () => {
    it('allows client.regular on client.orders', () => {
      const snapshot = snapshotFor({ kind: 'client', profileId: 'client.regular' });
      const result = canActivateRoute({
        routeId: 'client.orders',
        portal: 'client',
        snapshot,
      });

      expect(result.allowed).toBe(true);
    });

    it('denies client.regular on client.vip', () => {
      const snapshot = snapshotFor({ kind: 'client', profileId: 'client.regular' });
      const result = canActivateRoute({
        routeId: 'client.vip',
        portal: 'client',
        snapshot,
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('CAPABILITY_DENIED');
        expect(result.redirectHint).toBe('forbidden');
      }
    });

    it('allows client.vip with clientVip flag on client.vip', () => {
      const snapshot = snapshotFor(
        { kind: 'client', profileId: 'client.vip' },
        { flags: { clientVip: true } },
      );
      const result = canActivateRoute({
        routeId: 'client.vip',
        portal: 'client',
        snapshot,
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Artist portal routes', () => {
    it('denies artist.lite on artist.sft', () => {
      const snapshot = snapshotFor(
        { kind: 'artist', profileId: 'artist.dj', tier: 'Lite' },
        { portal: 'artist', flags: { sftOk: true } },
      );
      const result = canActivateRoute({
        routeId: 'artist.sft',
        portal: 'artist',
        snapshot,
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('CAPABILITY_DENIED');
      }
    });

    it('allows artist.pro with sftOk on artist.sft', () => {
      const snapshot = snapshotFor(
        { kind: 'artist', profileId: 'artist.dj', tier: 'Pro' },
        { portal: 'artist', flags: { sftOk: true } },
      );
      const result = canActivateRoute({
        routeId: 'artist.sft',
        portal: 'artist',
        snapshot,
      });

      expect(result.allowed).toBe(true);
    });

    it('uses match all by default on artist.jobs', () => {
      const snapshot = snapshotFor(
        { kind: 'artist', profileId: 'artist.dj', tier: 'Lite' },
        { portal: 'artist' },
      );
      const result = canActivateRoute({
        routeId: 'artist.jobs',
        portal: 'artist',
        snapshot,
      });

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.matchedCapabilities).toEqual(['jobs.read', 'jobs.apply']);
      }
    });
  });

  describe('Staff portal routes', () => {
    it('allows seller on staff.invoices read', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.seller' },
        { portal: 'staff' },
      );
      const result = canActivateRoute({
        routeId: 'staff.invoices',
        portal: 'staff',
        snapshot,
      });

      expect(result.allowed).toBe(true);
    });

    it('denies seller on staff.invoices.write', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.seller' },
        { portal: 'staff' },
      );
      const result = canActivateRoute({
        routeId: 'staff.invoices.write',
        portal: 'staff',
        snapshot,
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('CAPABILITY_DENIED');
        expect(result.redirectHint).toBe('forbidden');
      }
    });

    it('allows manager on staff.invoices.write', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.manager' },
        { portal: 'staff' },
      );
      const result = canActivateRoute({
        routeId: 'staff.invoices.write',
        portal: 'staff',
        snapshot,
      });

      expect(result.allowed).toBe(true);
    });

    it('allows owner on staff.featureflags', () => {
      const snapshot = snapshotFor(
        { kind: 'staff', profileId: 'staff.owner' },
        { portal: 'staff' },
      );
      const result = canActivateRoute({
        routeId: 'staff.featureflags',
        portal: 'staff',
        snapshot,
      });

      expect(result.allowed).toBe(true);
    });

    it('denies guest on staff.dashboard with staff-gate-failed hint', () => {
      const snapshot = snapshotFor({ kind: 'guest' }, { portal: 'staff' });
      const result = canActivateRoute({
        routeId: 'staff.dashboard',
        portal: 'staff',
        snapshot,
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('CAPABILITY_DENIED');
        expect(result.redirectHint).toBe('staff-gate-failed');
      }
    });
  });
});
