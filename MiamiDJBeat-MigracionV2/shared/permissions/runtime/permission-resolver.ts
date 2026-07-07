/** MOD-003 Permissions — permission resolver — TICKET-MOD-003-PERMISSION-RESOLVER-001 */

import {
  capabilityAllowedOnPortal,
  isRegisteredCapability,
} from './capability-registry';
import { PermissionError } from './errors';
import { resolveProfile } from './profile-matrix';
import { assertDocumentedRole } from './role-matrix';
import { getRoleCapabilities } from './role-capability-matrix';
import type {
  CapabilityId,
  PermissionPortalId,
  PermissionResolverInput,
  PermissionSnapshot,
  SnapshotFlags,
} from './types';

const VIP_BENEFITS_CAPABILITY = 'client.vip.benefits' as CapabilityId;
const SFT_CAPABILITY = 'artist.sft.use' as CapabilityId;

function normalizeFlags(flags: SnapshotFlags | undefined): SnapshotFlags {
  return Object.freeze({
    clientVip: flags?.clientVip === true,
    sftOk: flags?.sftOk === true,
  });
}

function applyFlagOverrides(
  capabilities: readonly CapabilityId[],
  input: PermissionResolverInput,
  flags: SnapshotFlags,
): CapabilityId[] {
  const effective = new Set<CapabilityId>(capabilities);

  if (
    input.profile.kind === 'client' &&
    input.profile.profileId === 'client.vip' &&
    flags.clientVip
  ) {
    effective.add(VIP_BENEFITS_CAPABILITY);
  }

  if (!flags.sftOk) {
    effective.delete(SFT_CAPABILITY);
  }

  return [...effective].sort();
}

export function resolvePermissionSnapshot(
  input: PermissionResolverInput,
): PermissionSnapshot {
  const profile = resolveProfile(input.profile);
  const documentedRole = profile.documentedRole;
  assertDocumentedRole(documentedRole);

  const baseCapabilities = getRoleCapabilities(documentedRole);
  const flags = normalizeFlags(input.flags);
  const capabilities = Object.freeze(
    applyFlagOverrides(baseCapabilities, input, flags),
  );

  const snapshot: PermissionSnapshot = Object.freeze({
    snapshotVersion: input.snapshotVersion ?? 1,
    resolvedAt: new Date().toISOString(),
    userId: input.userId ?? null,
    portal: input.portal,
    profile,
    documentedRole,
    flags,
    capabilities,
    capabilityCount: capabilities.length,
  });

  return snapshot;
}

export function listEffectiveCapabilities(
  snapshot: PermissionSnapshot | null | undefined,
): readonly CapabilityId[] {
  if (!snapshot) {
    return Object.freeze([]);
  }

  return snapshot.capabilities;
}

export function hasCapability(
  snapshot: PermissionSnapshot | null | undefined,
  capabilityId: string,
  portal?: PermissionPortalId,
): boolean {
  if (!snapshot) {
    return false;
  }

  if (!isRegisteredCapability(capabilityId)) {
    return false;
  }

  if (!snapshot.capabilities.includes(capabilityId)) {
    return false;
  }

  const effectivePortal = portal ?? snapshot.portal;
  return capabilityAllowedOnPortal(capabilityId, effectivePortal);
}

export function assertCapability(
  snapshot: PermissionSnapshot | null | undefined,
  capabilityId: string,
  portal?: PermissionPortalId,
): void {
  if (!snapshot) {
    throw new PermissionError('PERM_SNAPSHOT_REQUIRED', 'Permission snapshot is required');
  }

  if (!isRegisteredCapability(capabilityId)) {
    throw new PermissionError(
      'PERM_CAPABILITY_NOT_REGISTERED',
      `Capability not registered: "${capabilityId}"`,
    );
  }

  if (!snapshot.capabilities.includes(capabilityId)) {
    throw new PermissionError(
      'PERM_CAPABILITY_DENIED',
      `Capability not granted in snapshot: "${capabilityId}"`,
    );
  }

  const effectivePortal = portal ?? snapshot.portal;
  if (!capabilityAllowedOnPortal(capabilityId, effectivePortal)) {
    throw new PermissionError(
      'PERM_PORTAL_NOT_ALLOWED',
      `Capability "${capabilityId}" is not allowed on portal "${effectivePortal}"`,
    );
  }
}
