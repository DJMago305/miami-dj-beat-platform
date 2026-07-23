/** LC-13B — Legal profile lookup binding (memory fixture vs cache-backed) */

import { getConfig } from '@mdj/shared/config';
import { DEFAULT_MEMORY_LEGAL_PROFILE_LOOKUP } from './memory-legal-profile-lookup';
import type { LegalProfileLookupPort } from './legal-profile-lookup-port';
import {
  createSupabaseLegalProfileLookup,
  type CreateSupabaseLegalProfileLookupInput,
} from './supabase-legal-profile-lookup';

export type LegalProfileLookupBindingMode = 'MEMORY_FIXTURE' | 'CACHE_BACKED';

let bindingModeOverride: LegalProfileLookupBindingMode | null = null;

export function resolveLegalProfileLookupBindingMode(): LegalProfileLookupBindingMode {
  if (bindingModeOverride) {
    return bindingModeOverride;
  }
  return getConfig().api.transportMode === 'memory' ? 'MEMORY_FIXTURE' : 'CACHE_BACKED';
}

export function setLegalProfileLookupBindingModeForTests(mode: LegalProfileLookupBindingMode | null): void {
  bindingModeOverride = mode;
}

export type ResolveLegalProfileLookupPortInput = CreateSupabaseLegalProfileLookupInput & {
  readonly mode?: LegalProfileLookupBindingMode;
};

export function resolveLegalProfileLookupPort(
  input: ResolveLegalProfileLookupPortInput = {},
): LegalProfileLookupPort {
  const mode = input.mode ?? resolveLegalProfileLookupBindingMode();
  if (mode === 'MEMORY_FIXTURE') {
    return DEFAULT_MEMORY_LEGAL_PROFILE_LOOKUP;
  }
  return createSupabaseLegalProfileLookup(input);
}
