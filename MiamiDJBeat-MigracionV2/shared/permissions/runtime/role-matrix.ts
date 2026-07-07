/** MOD-003 Permissions — role matrix catalog — TICKET-MOD-003-PROFILE-MATRIX-001 */

import { PermissionError } from './errors';
import type { DocumentedRoleDefinition, DocumentedRoleId } from './types';

type RoleSeed = {
  readonly id: DocumentedRoleId;
  readonly label: string;
  readonly matrixKey: string;
  readonly portalHome: DocumentedRoleDefinition['portalHome'];
  readonly principal: DocumentedRoleDefinition['principal'];
};

/** Official documented roles — PERMISSIONS-SPEC.md §2 · ROLE-MATRIX.md. */
const ROLE_SEEDS: readonly RoleSeed[] = [
  {
    id: 'guest',
    label: 'Guest',
    matrixKey: 'G',
    portalHome: 'client',
    principal: null,
  },
  {
    id: 'buyer',
    label: 'Buyer',
    matrixKey: 'B',
    portalHome: 'client',
    principal: 'buyer',
  },
  {
    id: 'artist_lite',
    label: 'Artist Lite',
    matrixKey: 'AL',
    portalHome: 'artist',
    principal: 'performer',
  },
  {
    id: 'artist_pro',
    label: 'Artist Pro',
    matrixKey: 'AP',
    portalHome: 'artist',
    principal: 'performer',
  },
  {
    id: 'artist_elite',
    label: 'Artist Elite',
    matrixKey: 'AE',
    portalHome: 'artist',
    principal: 'performer',
  },
  {
    id: 'staff_seller',
    label: 'Seller',
    matrixKey: 'S',
    portalHome: 'staff',
    principal: 'staff',
  },
  {
    id: 'staff_manager',
    label: 'Manager',
    matrixKey: 'M',
    portalHome: 'staff',
    principal: 'staff',
  },
  {
    id: 'staff_admin',
    label: 'Admin',
    matrixKey: 'A',
    portalHome: 'staff',
    principal: 'staff',
  },
  {
    id: 'staff_owner',
    label: 'Owner',
    matrixKey: 'O',
    portalHome: 'staff',
    principal: 'staff',
  },
];

function buildRoleDefinition(seed: RoleSeed): DocumentedRoleDefinition {
  return Object.freeze({
    id: seed.id,
    label: seed.label,
    matrixKey: seed.matrixKey,
    portalHome: seed.portalHome,
    principal: seed.principal,
  });
}

function buildRoleRegistry(): ReadonlyMap<DocumentedRoleId, DocumentedRoleDefinition> {
  const entries = ROLE_SEEDS.map((seed) => [seed.id, buildRoleDefinition(seed)] as const);
  return Object.freeze(new Map<DocumentedRoleId, DocumentedRoleDefinition>(entries));
}

export const DOCUMENTED_ROLE_REGISTRY: ReadonlyMap<
  DocumentedRoleId,
  DocumentedRoleDefinition
> = buildRoleRegistry();

export const DOCUMENTED_ROLE_COUNT = DOCUMENTED_ROLE_REGISTRY.size;

export function isDocumentedRoleId(value: string): value is DocumentedRoleId {
  return DOCUMENTED_ROLE_REGISTRY.has(value as DocumentedRoleId);
}

export function getDocumentedRoleDefinition(
  roleId: DocumentedRoleId,
): DocumentedRoleDefinition | undefined {
  return DOCUMENTED_ROLE_REGISTRY.get(roleId);
}

export function assertDocumentedRole(roleId: string): DocumentedRoleDefinition {
  if (!isDocumentedRoleId(roleId)) {
    throw new PermissionError(
      'PERM_DOCUMENTED_ROLE_NOT_FOUND',
      `Documented role not found: "${roleId}"`,
    );
  }

  return DOCUMENTED_ROLE_REGISTRY.get(roleId)!;
}

export function listSupportedRoles(): readonly DocumentedRoleDefinition[] {
  return Object.freeze([...DOCUMENTED_ROLE_REGISTRY.values()]);
}
