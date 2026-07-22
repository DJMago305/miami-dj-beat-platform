/** LC-13B — DocumentedRoleId → LegalReadAccessContext field mapping */

import type { DocumentedRoleId, ProfileKind } from '../../../../permissions/runtime';
import type { LegalReadAccessContext } from '../legal-read-access-context';

export type LegalReadRoleMapping = {
  readonly actorType: LegalReadAccessContext['actorType'];
  readonly role: LegalReadAccessContext['role'];
  readonly portal: LegalReadAccessContext['portal'];
};

const PROFILE_KIND_TO_PORTAL: Readonly<
  Record<Exclude<ProfileKind, 'guest'>, LegalReadAccessContext['portal']>
> = Object.freeze({
  staff: 'staff',
  artist: 'artist',
  client: 'client',
});

export function mapProfileKindToLegalPortal(
  profileKind: ProfileKind,
): LegalReadAccessContext['portal'] | null {
  if (profileKind === 'guest') {
    return null;
  }
  return PROFILE_KIND_TO_PORTAL[profileKind];
}

export function mapDocumentedRoleToLegalReadRole(
  documentedRole: DocumentedRoleId,
): LegalReadRoleMapping | null {
  switch (documentedRole) {
    case 'staff_owner':
      return Object.freeze({ actorType: 'staff', role: 'owner', portal: 'staff' });
    case 'staff_admin':
    case 'staff_manager':
      return Object.freeze({ actorType: 'staff', role: 'manager', portal: 'staff' });
    case 'staff_seller':
      return Object.freeze({ actorType: 'staff', role: 'seller', portal: 'staff' });
    case 'artist_lite':
    case 'artist_pro':
    case 'artist_elite':
      return Object.freeze({ actorType: 'artist', role: 'artist', portal: 'artist' });
    case 'buyer':
      return Object.freeze({ actorType: 'client', role: 'client', portal: 'client' });
    case 'guest':
      return null;
    default:
      return null;
  }
}

export function validateLegalReadAccessContextInvariants(
  context: LegalReadAccessContext,
  documentedRole: DocumentedRoleId,
): boolean {
  const mapped = mapDocumentedRoleToLegalReadRole(documentedRole);
  if (!mapped) {
    return false;
  }

  if (context.actorType !== mapped.actorType || context.role !== mapped.role || context.portal !== mapped.portal) {
    return false;
  }

  if (context.portal === 'artist' && context.recipientScope !== undefined && context.recipientScope !== context.actorId) {
    return false;
  }

  if (context.portal === 'artist' && context.recipientScope === undefined) {
    return false;
  }

  return true;
}
