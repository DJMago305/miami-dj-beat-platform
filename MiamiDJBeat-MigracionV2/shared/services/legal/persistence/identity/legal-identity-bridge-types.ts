/** LC-13B — Legal identity bridge types */

import type { PermissionSnapshot } from '../../../../permissions/runtime';
import type { SessionSnapshot } from '../../../../session/runtime/types';
import type { LegalReadAccessContext } from '../legal-read-access-context';
import type { LegalProfileLookupPort } from './legal-profile-lookup-port';

export type LegalIdentityBridgeErrorCode =
  | 'identity_unavailable'
  | 'identity_ambiguous'
  | 'role_unresolved'
  | 'profile_missing'
  | 'portal_mismatch'
  | 'session_expired'
  | 'contract_violation';

export type LegalIdentityBridgeFailure = {
  readonly ok: false;
  readonly code: LegalIdentityBridgeErrorCode;
  readonly message: string;
};

export type LegalIdentityBridgeSuccess = {
  readonly ok: true;
  readonly value: LegalReadAccessContext;
};

export type LegalIdentityBridgeResult = LegalIdentityBridgeSuccess | LegalIdentityBridgeFailure;

export type LegalIdentityBridgeInput = {
  readonly session: SessionSnapshot;
  readonly permissions: PermissionSnapshot;
  readonly legalProfileLookup: LegalProfileLookupPort;
};

export function legalIdentityBridgeFailure(
  code: LegalIdentityBridgeErrorCode,
  message: string,
): LegalIdentityBridgeFailure {
  return Object.freeze({ ok: false, code, message });
}

export function legalIdentityBridgeSuccess(value: LegalReadAccessContext): LegalIdentityBridgeSuccess {
  return Object.freeze({ ok: true, value });
}
