/** LC-13B — Identity bridge: Session + PermissionSnapshot + legal profile lookup → LegalReadAccessContext */

import type { LegalPersistenceErrorCode } from '../legal-persistence-errors';
import type { LegalReadAccessContext } from '../legal-read-access-context';
import {
  legalIdentityBridgeFailure,
  legalIdentityBridgeSuccess,
  type LegalIdentityBridgeInput,
  type LegalIdentityBridgeErrorCode,
  type LegalIdentityBridgeResult,
} from './legal-identity-bridge-types';
import {
  mapDocumentedRoleToLegalReadRole,
  mapProfileKindToLegalPortal,
  validateLegalReadAccessContextInvariants,
} from './legal-read-role-mapper';

export function resolveLegalReadAccessContextFromSession(
  input: LegalIdentityBridgeInput,
): LegalIdentityBridgeResult {
  const { session, permissions, legalProfileLookup } = input;

  if (session.state === 'SESSION_EXPIRED') {
    return legalIdentityBridgeFailure('session_expired', 'Session is expired.');
  }

  const authUserId = session.user?.userId?.trim();
  if (!authUserId) {
    return legalIdentityBridgeFailure('identity_unavailable', 'Authenticated session user is required.');
  }

  if (permissions.documentedRole === 'guest') {
    return legalIdentityBridgeFailure('role_unresolved', 'Guest role cannot resolve legal read access.');
  }

  const roleMapping = mapDocumentedRoleToLegalReadRole(permissions.documentedRole);
  if (!roleMapping) {
    return legalIdentityBridgeFailure(
      'role_unresolved',
      `Unsupported documented role: ${permissions.documentedRole}.`,
    );
  }

  const profileKind = permissions.profile.kind;
  if (profileKind === 'guest') {
    return legalIdentityBridgeFailure('role_unresolved', 'Guest profile kind cannot resolve legal read access.');
  }

  const effectivePortal = mapProfileKindToLegalPortal(profileKind);
  if (!effectivePortal) {
    return legalIdentityBridgeFailure('role_unresolved', 'Unable to derive effective legal portal.');
  }

  if (session.portal !== effectivePortal) {
    return legalIdentityBridgeFailure(
      'portal_mismatch',
      `Portal shell ${session.portal} does not match effective identity portal ${effectivePortal}.`,
    );
  }

  const lookupResult = legalProfileLookup.lookup({
    authUserId,
    profileKind,
    documentedRole: permissions.documentedRole,
  });

  if (!lookupResult.ok) {
    if (lookupResult.code === 'identity_ambiguous') {
      return legalIdentityBridgeFailure('identity_ambiguous', lookupResult.message);
    }
    return legalIdentityBridgeFailure('profile_missing', lookupResult.message);
  }

  const context: LegalReadAccessContext = Object.freeze({
    actorType: roleMapping.actorType,
    actorId: lookupResult.value.legalRecipientId,
    role: roleMapping.role,
    portal: effectivePortal,
    ...(roleMapping.actorType === 'artist'
      ? { recipientScope: lookupResult.value.legalRecipientId }
      : {}),
  });

  if (!validateLegalReadAccessContextInvariants(context, permissions.documentedRole)) {
    return legalIdentityBridgeFailure(
      'contract_violation',
      'LegalReadAccessContext invariants failed after bridge resolution.',
    );
  }

  return legalIdentityBridgeSuccess(context);
}

export function mapLegalIdentityBridgeErrorToPersistenceCode(
  code: LegalIdentityBridgeErrorCode,
): LegalPersistenceErrorCode {
  switch (code) {
    case 'identity_unavailable':
    case 'profile_missing':
    case 'session_expired':
      return 'persistence_access_forbidden';
    case 'role_unresolved':
    case 'identity_ambiguous':
    case 'portal_mismatch':
    case 'contract_violation':
      return 'persistence_access_forbidden';
    default:
      return 'persistence_access_forbidden';
  }
}
