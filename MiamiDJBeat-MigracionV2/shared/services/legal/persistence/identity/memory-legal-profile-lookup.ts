/** LC-13B — In-memory legal profile lookup (lab fixtures; no Supabase) */

import type { DocumentedRoleId } from '../../../../permissions/runtime';
import { LEGAL_FIXTURE_PROFILE_IDS } from '../../in-memory/legal-fixtures';
import type {
  LegalProfileLookupInput,
  LegalProfileLookupPort,
  LegalProfileLookupRecord,
  LegalProfileLookupResult,
} from './legal-profile-lookup-port';

type MemoryBinding = {
  readonly authUserId: string;
  readonly profileKind: 'artist' | 'client';
  readonly legalRecipientId: string;
  readonly legalProfileId?: string;
};

const STAFF_ACTOR_BY_DOCUMENTED_ROLE: Readonly<Partial<Record<DocumentedRoleId, string>>> = Object.freeze({
  staff_owner: 'STAFF-OWNER-001',
  staff_admin: 'STAFF-MANAGER-001',
  staff_manager: 'STAFF-MANAGER-001',
  staff_seller: 'STAFF-SELLER-001',
});

const DEFAULT_MEMORY_BINDINGS: readonly MemoryBinding[] = Object.freeze([
  Object.freeze({
    authUserId: 'mock-user-artist-1',
    profileKind: 'artist',
    legalRecipientId: 'ART-DEMO-001',
    legalProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
  }),
  Object.freeze({
    authUserId: 'usr-art-green-001',
    profileKind: 'artist',
    legalRecipientId: 'ART-DEMO-001',
    legalProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
  }),
  Object.freeze({
    authUserId: 'usr-art-yellow-001',
    profileKind: 'artist',
    legalRecipientId: 'ART-001',
    legalProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistYellow,
  }),
  Object.freeze({
    authUserId: 'mock-user-client-1',
    profileKind: 'client',
    legalRecipientId: 'CLI-001',
    legalProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
  }),
  Object.freeze({
    authUserId: 'mock-user-client-2',
    profileKind: 'client',
    legalRecipientId: 'CLI-001',
    legalProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
  }),
  Object.freeze({
    authUserId: 'usr-cli-001',
    profileKind: 'client',
    legalRecipientId: 'CLI-001',
    legalProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
  }),
]);

function lookupStaffProfile(input: LegalProfileLookupInput): LegalProfileLookupResult {
  const actorId = STAFF_ACTOR_BY_DOCUMENTED_ROLE[input.documentedRole];
  if (!actorId) {
    return Object.freeze({
      ok: false,
      code: 'profile_missing',
      message: `No staff legal actor mapping for documented role ${input.documentedRole}.`,
    });
  }

  return Object.freeze({
    ok: true,
    value: Object.freeze({
      legalRecipientId: actorId,
    }),
  });
}

function lookupArtistOrClientProfile(
  input: LegalProfileLookupInput,
  bindings: readonly MemoryBinding[],
): LegalProfileLookupResult {
  const matches = bindings.filter(
    (binding) => binding.authUserId === input.authUserId && binding.profileKind === input.profileKind,
  );

  if (matches.length === 0) {
    return Object.freeze({
      ok: false,
      code: 'profile_missing',
      message: `No legal profile binding for auth user ${input.authUserId} (${input.profileKind}).`,
    });
  }

  if (matches.length > 1) {
    const recipientIds = [...new Set(matches.map((match) => match.legalRecipientId))];
    if (recipientIds.length > 1) {
      return Object.freeze({
        ok: false,
        code: 'identity_ambiguous',
        message: `Multiple legal recipient IDs for auth user ${input.authUserId}.`,
      });
    }
  }

  const selected = matches[0] as LegalProfileLookupRecord & MemoryBinding;
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      legalRecipientId: selected.legalRecipientId,
      ...(selected.legalProfileId ? { legalProfileId: selected.legalProfileId } : {}),
    }),
  });
}

export type CreateMemoryLegalProfileLookupInput = {
  readonly bindings?: readonly MemoryBinding[];
};

export function createMemoryLegalProfileLookup(
  input: CreateMemoryLegalProfileLookupInput = {},
): LegalProfileLookupPort {
  const bindings = input.bindings ?? DEFAULT_MEMORY_BINDINGS;

  return Object.freeze({
    lookup(profileInput: LegalProfileLookupInput): LegalProfileLookupResult {
      if (profileInput.profileKind === 'staff') {
        return lookupStaffProfile(profileInput);
      }
      return lookupArtistOrClientProfile(profileInput, bindings);
    },
  });
}

export const DEFAULT_MEMORY_LEGAL_PROFILE_LOOKUP = createMemoryLegalProfileLookup();
