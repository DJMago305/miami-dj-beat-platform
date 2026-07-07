import { describe, expect, it } from 'vitest';
import {
  COMPONENT_CAPABILITY_MAP,
  COMPONENT_COUNT,
  ROUTE_CAPABILITY_MAP,
  capabilityAllowedOnPortal,
  getComponentDefinition,
  isRegisteredCapability,
  isRegisteredComponent,
  listComponentsForPortal,
  listComponentsForRoute,
} from '../../shared/permissions/runtime';

const STAFF_DASHBOARD_ACCESS = 'staff.dashboard.access';

function allComponentCapabilities(
  definition: (typeof COMPONENT_CAPABILITY_MAP)[keyof typeof COMPONENT_CAPABILITY_MAP],
): string[] {
  return [...definition.requiredCapabilities, ...definition.readCapabilities];
}

describe('MOD-003 Component Capability Map', () => {
  describe('Registry counts', () => {
    it('registers the expected component count', () => {
      expect(COMPONENT_COUNT).toBe(52);
      expect(Object.keys(COMPONENT_CAPABILITY_MAP)).toHaveLength(52);
    });

    it('registers components per portal', () => {
      expect(listComponentsForPortal('client')).toHaveLength(12);
      expect(listComponentsForPortal('artist')).toHaveLength(14);
      expect(listComponentsForPortal('staff')).toHaveLength(26);
    });
  });

  describe('Registry integrity', () => {
    it('keeps COMPONENT_CAPABILITY_MAP immutable', () => {
      expect(Object.isFrozen(COMPONENT_CAPABILITY_MAP)).toBe(true);

      for (const definition of Object.values(COMPONENT_CAPABILITY_MAP)) {
        expect(Object.isFrozen(definition)).toBe(true);
        expect(Object.isFrozen(definition.requiredCapabilities)).toBe(true);
        expect(Object.isFrozen(definition.readCapabilities)).toBe(true);
        expect(Object.isFrozen(definition.statePolicy)).toBe(true);
      }
    });

    it('registers only catalog capabilities on every component', () => {
      for (const definition of Object.values(COMPONENT_CAPABILITY_MAP)) {
        for (const capability of allComponentCapabilities(definition)) {
          expect(isRegisteredCapability(capability)).toBe(true);
        }
      }
    });

    it('respects portal binding for every component capability', () => {
      for (const definition of Object.values(COMPONENT_CAPABILITY_MAP)) {
        for (const capability of allComponentCapabilities(definition)) {
          expect(capabilityAllowedOnPortal(capability, definition.portal)).toBe(true);
        }
      }
    });

    it('links every component to a registered route', () => {
      for (const definition of Object.values(COMPONENT_CAPABILITY_MAP)) {
        expect(definition.relatedRouteId in ROUTE_CAPABILITY_MAP).toBe(true);
        expect(ROUTE_CAPABILITY_MAP[definition.relatedRouteId].portal).toBe(definition.portal);
      }
    });

    it('requires staff.dashboard.access on all staff components', () => {
      for (const definition of listComponentsForPortal('staff')) {
        expect(definition.requiredCapabilities).toContain(STAFF_DASHBOARD_ACCESS);
      }
    });
  });

  describe('Lookup helpers', () => {
    it('resolves known and unknown components', () => {
      expect(getComponentDefinition('client.checkout.button')?.portal).toBe('client');
      expect(isRegisteredComponent('client.checkout.button')).toBe(true);
      expect(getComponentDefinition('client.unknown.component')).toBeNull();
      expect(isRegisteredComponent('client.unknown.component')).toBe(false);
    });

    it('lists components for a route', () => {
      const checkoutComponents = listComponentsForRoute('client.shop.checkout');
      expect(checkoutComponents.length).toBeGreaterThanOrEqual(2);
      expect(
        checkoutComponents.every(
          (definition) => definition.relatedRouteId === 'client.shop.checkout',
        ),
      ).toBe(true);
    });

    it('returns an empty list for unknown routes', () => {
      expect(listComponentsForRoute('client.unknown.route')).toEqual([]);
    });

    it('indexes invoice write controls under staff.invoices.write route', () => {
      const writeRouteComponents = listComponentsForRoute('staff.invoices.write');
      expect(writeRouteComponents.map((definition) => definition.id)).toEqual(
        expect.arrayContaining([
          'staff.invoice.create.button',
          'staff.invoice.edit.button',
        ]),
      );
    });
  });

  describe('Candidate component definitions', () => {
    it('defines client checkout and vip surfaces', () => {
      expect(getComponentDefinition('client.checkout.button')?.requiredCapabilities).toContain(
        'client.shop.checkout',
      );
      expect(getComponentDefinition('client.vip.banner')?.requiredCapabilities).toContain(
        'client.vip.benefits',
      );
    });

    it('defines artist pro-gated and read-only surfaces', () => {
      expect(getComponentDefinition('artist.song4tips.card')?.requiredCapabilities).toContain(
        'artist.sft.use',
      );
      expect(getComponentDefinition('artist.jobs.panel')?.readCapabilities).toContain('jobs.read');
      expect(getComponentDefinition('artist.calendar.editor')?.readCapabilities).toContain(
        'artist.calendar.read.own',
      );
    });

    it('defines staff read panels and write actions separately', () => {
      expect(getComponentDefinition('staff.invoice.panel')?.readCapabilities).toContain(
        'staff.invoices.read',
      );
      expect(getComponentDefinition('staff.invoice.create.button')?.requiredCapabilities).toEqual(
        expect.arrayContaining(['staff.dashboard.access', 'staff.invoices.write']),
      );
      expect(getComponentDefinition('staff.featureflags.panel')?.requiredCapabilities).toContain(
        'system.featureflags.override',
      );
    });
  });
});
