/** LC-13B — Cache-backed legal profile lookup adapter (sync; no network) */

import type {
  LegalResolveProfileAccessSourcePortal,
} from './legal-resolve-profile-access-types';
import { mapProfileKindToLegalPortal } from './legal-read-role-mapper';
import type {
  LegalProfileLookupInput,
  LegalProfileLookupPort,
  LegalProfileLookupResult,
} from './legal-profile-lookup-port';
import {
  getDefaultLegalProfileResolutionCache,
  type LegalProfileResolutionCacheKeyInput,
  type LegalProfileResolutionCachePort,
} from './legal-profile-resolution-cache';

export type CreateSupabaseLegalProfileLookupInput = {
  readonly resolutionCache?: LegalProfileResolutionCachePort;
};

function buildLookupCacheKey(input: LegalProfileLookupInput): LegalProfileResolutionCacheKeyInput | null {
  const sourcePortal = mapProfileKindToLegalPortal(input.profileKind);
  if (!sourcePortal || sourcePortal === 'system') {
    return null;
  }

  return Object.freeze({
    authUserId: input.authUserId,
    profileKind: input.profileKind,
    sourcePortal: sourcePortal as LegalResolveProfileAccessSourcePortal,
    documentedRole: input.documentedRole,
  });
}

export function createSupabaseLegalProfileLookup(
  input: CreateSupabaseLegalProfileLookupInput = {},
): LegalProfileLookupPort {
  const cache = input.resolutionCache ?? getDefaultLegalProfileResolutionCache();

  return Object.freeze({
    lookup(profileInput: LegalProfileLookupInput): LegalProfileLookupResult {
      const cacheKey = buildLookupCacheKey(profileInput);
      if (!cacheKey) {
        return Object.freeze({
          ok: false,
          code: 'profile_missing',
          message: 'Unable to derive legal portal for profile kind.',
        });
      }

      const entry = cache.get(cacheKey);
      if (!entry) {
        return Object.freeze({
          ok: false,
          code: 'profile_missing',
          message: `No cached legal profile resolution for auth user ${profileInput.authUserId}.`,
        });
      }

      return Object.freeze({
        ok: true,
        value: Object.freeze({
          legalRecipientId: entry.legalRecipientId,
          ...(entry.legalProfileId ? { legalProfileId: entry.legalProfileId } : {}),
        }),
      });
    },
  });
}

/** Design alias — same factory as createSupabaseLegalProfileLookup. */
export const createSupabaseLegalProfileLookupAdapter = createSupabaseLegalProfileLookup;

export type SupabaseLegalProfileLookupAdapter = LegalProfileLookupPort;
