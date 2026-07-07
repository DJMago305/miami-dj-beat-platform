import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_COUNT,
  CAPABILITY_REGISTRY,
  PermissionError,
  assertCapabilityAllowedOnPortal,
  assertCapabilityIdFormat,
  assertCapabilityRegistered,
  capabilityAllowedOnPortal,
  getCapabilityDefinition,
  isPermissionError,
  isRegisteredCapability,
  isValidCapabilityIdFormat,
  listAllCapabilities,
  listCapabilitiesByDomain,
  listCapabilityDomains,
  type PermissionPortalId,
} from '../../shared/permissions/runtime';

describe('MOD-003 Capability Registry', () => {
  it('registers all 51 documented capabilities', () => {
    expect(CAPABILITY_COUNT).toBe(51);
    expect(CAPABILITY_REGISTRY.size).toBe(51);
    expect(listAllCapabilities()).toHaveLength(51);
  });

  it('lookup returns a frozen definition for a registered capability', () => {
    const definition = getCapabilityDefinition('orders.read.own');
    expect(definition).toBeDefined();
    expect(definition?.id).toBe('orders.read.own');
    expect(definition?.domain).toBe('orders');
    expect(definition?.portals).toEqual(['client']);
    expect(definition?.redZone).toBe(false);
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition?.portals)).toBe(true);
  });

  it('lookup returns undefined for invalid or unregistered ids (deny-default)', () => {
    expect(getCapabilityDefinition('not-a-capability')).toBeUndefined();
    expect(getCapabilityDefinition('orders.read.missing')).toBeUndefined();
    expect(isRegisteredCapability('')).toBe(false);
    expect(isRegisteredCapability('UPPER.CASE')).toBe(false);
    expect(capabilityAllowedOnPortal('orders.write', 'staff')).toBe(true);
    expect(capabilityAllowedOnPortal('orders.write', 'client')).toBe(false);
    expect(capabilityAllowedOnPortal('unknown.action.here', 'staff')).toBe(false);
  });

  it('assertCapabilityRegistered throws PERM_CAPABILITY_NOT_REGISTERED for unknown ids', () => {
    expect(() => assertCapabilityRegistered('orders.missing.action')).toThrow(PermissionError);
    try {
      assertCapabilityRegistered('orders.missing.action');
    } catch (error) {
      expect(isPermissionError(error)).toBe(true);
      if (isPermissionError(error)) {
        expect(error.code).toBe('PERM_CAPABILITY_NOT_REGISTERED');
      }
    }
  });

  it('assertCapabilityIdFormat rejects malformed ids', () => {
    expect(isValidCapabilityIdFormat('orders.read.own')).toBe(true);
    expect(isValidCapabilityIdFormat('Bad.Id')).toBe(false);
    expect(() => assertCapabilityIdFormat('')).toThrow(PermissionError);
    try {
      assertCapabilityIdFormat('');
    } catch (error) {
      expect(isPermissionError(error)).toBe(true);
      if (isPermissionError(error)) {
        expect(error.code).toBe('PERM_INVALID_CAPABILITY_ID');
      }
    }
  });

  it('portal binding allows declared portals only', () => {
    expect(capabilityAllowedOnPortal('client.shop.browse', 'client')).toBe(true);
    expect(capabilityAllowedOnPortal('client.shop.browse', 'guest')).toBe(true);
    expect(capabilityAllowedOnPortal('client.shop.browse', 'artist')).toBe(false);
    expect(capabilityAllowedOnPortal('staff.dashboard.access', 'staff')).toBe(true);
    expect(capabilityAllowedOnPortal('staff.dashboard.access', 'client')).toBe(false);
    expect(assertCapabilityAllowedOnPortal('jobs.read', 'artist')).toMatchObject({
      id: 'jobs.read',
    });
  });

  it('portal binding throws PERM_PORTAL_NOT_ALLOWED when portal is prohibited', () => {
    expect(() => assertCapabilityAllowedOnPortal('orders.write', 'client')).toThrow(
      PermissionError,
    );
    try {
      assertCapabilityAllowedOnPortal('orders.write', 'client');
    } catch (error) {
      expect(isPermissionError(error)).toBe(true);
      if (isPermissionError(error)) {
        expect(error.code).toBe('PERM_PORTAL_NOT_ALLOWED');
      }
    }
  });

  it('lists capabilities grouped by domain', () => {
    const orders = listCapabilitiesByDomain('orders');
    expect(orders).toHaveLength(6);
    expect(orders.every((entry) => entry.domain === 'orders')).toBe(true);
    expect(Object.isFrozen(orders)).toBe(true);

    const domains = listCapabilityDomains();
    expect(domains).toEqual([
      'artist',
      'client',
      'crm',
      'guest',
      'jobs',
      'notifications',
      'orders',
      'payments',
      'staff',
      'system',
    ]);
  });

  it('registry map and catalog seeds remain immutable', () => {
    expect(Object.isFrozen(CAPABILITY_REGISTRY)).toBe(true);

    const definition = assertCapabilityRegistered('crm.delete');
    expect(definition.redZone).toBe(true);

    expect(() => {
      (definition as { description: string }).description = 'mutated';
    }).toThrow();

    expect(() => {
      (definition.portals as PermissionPortalId[]).push('guest');
    }).toThrow();
  });
});
