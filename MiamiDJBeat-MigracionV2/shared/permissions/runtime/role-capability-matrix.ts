/** MOD-003 Permissions — role capability matrix — TICKET-MOD-003-PERMISSION-RESOLVER-001 */

import { PermissionError } from './errors';
import type { CapabilityId, DocumentedRoleId } from './types';

type RoleCapabilitySeed = {
  readonly role: DocumentedRoleId;
  readonly capabilities: readonly string[];
};

/**
 * ROLE-MATRIX.md v1.0 — literal encode.
 * `client.vip.benefits` excluded from buyer base (flag override in resolver).
 */
const ROLE_CAPABILITY_SEEDS: readonly RoleCapabilitySeed[] = [
  {
    role: 'guest',
    capabilities: [
      'artist.profile.read.public',
      'client.shop.browse',
      'guest.browse.public',
    ],
  },
  {
    role: 'buyer',
    capabilities: [
      'orders.read.own',
      'payments.read.own',
      'artist.profile.read.public',
      'client.profile.edit.own',
      'client.shop.browse',
      'client.shop.checkout',
      'client.documents.read.own',
      'client.notifications.read.own',
      'notifications.read.own',
    ],
  },
  {
    role: 'artist_lite',
    capabilities: [
      'orders.read.assigned',
      'jobs.read',
      'jobs.apply',
      'artist.profile.read.public',
      'artist.profile.edit.own',
      'artist.calendar.read.own',
      'artist.calendar.edit.own',
      'artist.cashflow.read.own',
      'artist.tools.use',
      'artist.academy.access',
      'artist.media.upload.own',
      'notifications.read.own',
    ],
  },
  {
    role: 'artist_pro',
    capabilities: [
      'orders.read.assigned',
      'jobs.read',
      'jobs.apply',
      'artist.profile.read.public',
      'artist.profile.edit.own',
      'artist.calendar.read.own',
      'artist.calendar.edit.own',
      'artist.cashflow.read.own',
      'artist.tools.use',
      'artist.academy.access',
      'artist.sft.use',
      'artist.media.upload.own',
      'artist.analytics.read.own',
      'notifications.read.own',
    ],
  },
  {
    role: 'artist_elite',
    capabilities: [
      'orders.read.assigned',
      'jobs.read',
      'jobs.apply',
      'artist.profile.read.public',
      'artist.profile.edit.own',
      'artist.calendar.read.own',
      'artist.calendar.edit.own',
      'artist.cashflow.read.own',
      'artist.tools.use',
      'artist.academy.access',
      'artist.sft.use',
      'artist.media.upload.own',
      'artist.analytics.read.own',
      'notifications.read.own',
    ],
  },
  {
    role: 'staff_seller',
    capabilities: [
      'orders.read',
      'payments.read',
      'crm.read',
      'jobs.read',
      'artist.profile.read.public',
      'staff.dashboard.access',
      'staff.leads.read',
      'staff.invoices.read',
      'staff.production.read',
      'staff.reports.read',
      'notifications.read.own',
    ],
  },
  {
    role: 'staff_manager',
    capabilities: [
      'orders.read',
      'orders.write',
      'orders.assign',
      'orders.cancel',
      'payments.read',
      'payments.write',
      'payments.refund',
      'crm.read',
      'crm.write',
      'crm.delete',
      'jobs.read',
      'jobs.publish',
      'jobs.assign',
      'artist.profile.read.public',
      'staff.dashboard.access',
      'staff.leads.read',
      'staff.leads.write',
      'staff.invoices.read',
      'staff.invoices.write',
      'staff.production.read',
      'staff.production.write',
      'staff.matching.run',
      'staff.reports.read',
      'staff.users.read',
      'staff.users.write',
      'staff.roles.read',
      'staff.audit.read',
      'staff.manage',
      'notifications.read.own',
    ],
  },
  {
    role: 'staff_admin',
    capabilities: [
      'orders.read',
      'orders.write',
      'orders.assign',
      'orders.cancel',
      'payments.read',
      'payments.write',
      'payments.refund',
      'crm.read',
      'crm.write',
      'crm.delete',
      'jobs.read',
      'jobs.publish',
      'jobs.assign',
      'artist.profile.read.public',
      'staff.dashboard.access',
      'staff.leads.read',
      'staff.leads.write',
      'staff.invoices.read',
      'staff.invoices.write',
      'staff.production.read',
      'staff.production.write',
      'staff.matching.run',
      'staff.reports.read',
      'staff.users.read',
      'staff.users.write',
      'staff.roles.read',
      'staff.audit.read',
      'staff.manage',
      'system.admin',
      'notifications.read.own',
    ],
  },
  {
    role: 'staff_owner',
    capabilities: [
      'orders.read',
      'orders.write',
      'orders.assign',
      'orders.cancel',
      'payments.read',
      'payments.write',
      'payments.refund',
      'crm.read',
      'crm.write',
      'crm.delete',
      'jobs.read',
      'jobs.publish',
      'jobs.assign',
      'artist.profile.read.public',
      'staff.dashboard.access',
      'staff.leads.read',
      'staff.leads.write',
      'staff.invoices.read',
      'staff.invoices.write',
      'staff.production.read',
      'staff.production.write',
      'staff.matching.run',
      'staff.reports.read',
      'staff.users.read',
      'staff.users.write',
      'staff.roles.read',
      'staff.audit.read',
      'staff.manage',
      'system.admin',
      'system.featureflags.override',
      'notifications.read.own',
    ],
  },
];

function toCapabilityId(id: string): CapabilityId {
  return id as CapabilityId;
}

function buildRoleCapabilityMatrix(): ReadonlyMap<DocumentedRoleId, readonly CapabilityId[]> {
  const entries = ROLE_CAPABILITY_SEEDS.map((seed) => {
    const capabilities = Object.freeze(
      seed.capabilities.map(toCapabilityId).sort() as CapabilityId[],
    );
    return [seed.role, capabilities] as const;
  });

  return Object.freeze(new Map<DocumentedRoleId, readonly CapabilityId[]>(entries));
}

export const ROLE_CAPABILITY_MATRIX: ReadonlyMap<
  DocumentedRoleId,
  readonly CapabilityId[]
> = buildRoleCapabilityMatrix();

/** Effective counts encoded from ROLE-MATRIX.md tables (literal, not doc approx totals). */
export const ROLE_CAPABILITY_COUNTS: Readonly<Record<DocumentedRoleId, number>> = Object.freeze({
  guest: ROLE_CAPABILITY_MATRIX.get('guest')!.length,
  buyer: ROLE_CAPABILITY_MATRIX.get('buyer')!.length,
  artist_lite: ROLE_CAPABILITY_MATRIX.get('artist_lite')!.length,
  artist_pro: ROLE_CAPABILITY_MATRIX.get('artist_pro')!.length,
  artist_elite: ROLE_CAPABILITY_MATRIX.get('artist_elite')!.length,
  staff_seller: ROLE_CAPABILITY_MATRIX.get('staff_seller')!.length,
  staff_manager: ROLE_CAPABILITY_MATRIX.get('staff_manager')!.length,
  staff_admin: ROLE_CAPABILITY_MATRIX.get('staff_admin')!.length,
  staff_owner: ROLE_CAPABILITY_MATRIX.get('staff_owner')!.length,
});

export function listRoleCapabilityMatrixRoles(): readonly DocumentedRoleId[] {
  return Object.freeze([...ROLE_CAPABILITY_MATRIX.keys()]);
}

export function getRoleCapabilities(roleId: DocumentedRoleId): readonly CapabilityId[] {
  const capabilities = ROLE_CAPABILITY_MATRIX.get(roleId);
  if (!capabilities) {
    throw new PermissionError(
      'PERM_ROLE_CAPABILITY_MATRIX_MISSING',
      `Role capability matrix missing for role: "${roleId}"`,
    );
  }

  return capabilities;
}

export function assertRoleCapabilities(roleId: DocumentedRoleId): readonly CapabilityId[] {
  return getRoleCapabilities(roleId);
}

export function getRoleCapabilityCount(roleId: DocumentedRoleId): number {
  return getRoleCapabilities(roleId).length;
}
