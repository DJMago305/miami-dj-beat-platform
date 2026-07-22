/** LC-13B — Legal profile lookup port (local adapter boundary) */

import type { DocumentedRoleId, ProfileKind } from '../../../../permissions/runtime';

export type LegalProfileLookupInput = {
  readonly authUserId: string;
  readonly profileKind: Exclude<ProfileKind, 'guest'>;
  readonly documentedRole: DocumentedRoleId;
};

export type LegalProfileLookupRecord = {
  readonly legalRecipientId: string;
  readonly legalProfileId?: string;
};

export type LegalProfileLookupErrorCode = 'profile_missing' | 'identity_ambiguous';

export type LegalProfileLookupFailure = {
  readonly ok: false;
  readonly code: LegalProfileLookupErrorCode;
  readonly message: string;
};

export type LegalProfileLookupResult =
  | { readonly ok: true; readonly value: LegalProfileLookupRecord }
  | LegalProfileLookupFailure;

export type LegalProfileLookupPort = {
  lookup(input: LegalProfileLookupInput): LegalProfileLookupResult;
};
