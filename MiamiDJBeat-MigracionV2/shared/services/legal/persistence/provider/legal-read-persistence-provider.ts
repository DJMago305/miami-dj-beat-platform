/** LC-11 — Legal read persistence provider */

import type { ApiClientPublicApi } from '../../../../api/runtime/types';
import type { LegalReadFixtureStore } from '../fixtures/legal-read-fixture-store';
import { createLegalReadFixtureStore } from '../fixtures/legal-read-fixture-store';
import { legalPersistenceError } from '../legal-persistence-errors';
import { createMemoryLegalReadRepositories } from '../memory/memory-legal-read-repositories';
import type { LegalReadPersistenceRepositories } from '../ports/legal-read-repository-ports';
import { createSupabaseLegalReadRepositories } from '../supabase/supabase-legal-read-repositories';
import {
  createApiClientLegalPersistenceReadTransport,
  type LegalPersistenceReadTransport,
} from '../transport/legal-persistence-read-transport';

export type LegalReadPersistenceMode = 'memory' | 'supabase';

export type CreateLegalReadPersistenceProviderInput = {
  readonly mode?: LegalReadPersistenceMode;
  readonly apiClient?: ApiClientPublicApi;
  readonly transport?: LegalPersistenceReadTransport;
  /** Memory mode only — never used by Supabase repositories. */
  readonly fixtureStore?: LegalReadFixtureStore;
};

export type LegalReadPersistenceProvider = {
  readonly mode: LegalReadPersistenceMode;
  readonly repositories: LegalReadPersistenceRepositories;
};

function resolveProviderMode(mode: unknown): LegalReadPersistenceMode {
  if (mode === undefined || mode === 'memory') {
    return 'memory';
  }
  if (mode === 'supabase') {
    return 'supabase';
  }
  throw legalPersistenceError('persistence_mode_invalid', 'Legal read persistence mode must be memory or supabase.');
}

function resolveSupabaseTransport(
  input: CreateLegalReadPersistenceProviderInput,
): LegalPersistenceReadTransport {
  if (input.transport) {
    return input.transport;
  }
  if (input.apiClient) {
    return createApiClientLegalPersistenceReadTransport(input.apiClient);
  }
  throw legalPersistenceError(
    'persistence_provider_dependency_missing',
    'Supabase read persistence mode requires ApiClient or LegalPersistenceReadTransport.',
  );
}

export function createLegalReadPersistenceProvider(
  input: CreateLegalReadPersistenceProviderInput = {},
): LegalReadPersistenceProvider {
  const mode = resolveProviderMode(input.mode);

  if (mode === 'memory') {
    const store = input.fixtureStore ?? createLegalReadFixtureStore();
    return Object.freeze({
      mode,
      repositories: createMemoryLegalReadRepositories(store),
    });
  }

  const transport = resolveSupabaseTransport(input);
  return Object.freeze({
    mode,
    repositories: createSupabaseLegalReadRepositories({ transport }),
  });
}

export function requireApiClientForSupabaseMode(
  mode: LegalReadPersistenceMode,
  apiClient?: ApiClientPublicApi,
  transport?: LegalPersistenceReadTransport,
): ApiClientPublicApi | LegalPersistenceReadTransport {
  if (mode === 'supabase' && !apiClient && !transport) {
    throw legalPersistenceError(
      'persistence_provider_dependency_missing',
      'Supabase read persistence mode requires ApiClient or LegalPersistenceReadTransport.',
    );
  }
  if (transport) {
    return transport;
  }
  if (apiClient) {
    return apiClient;
  }
  throw legalPersistenceError(
    'persistence_provider_dependency_missing',
    'Supabase read persistence mode requires ApiClient or LegalPersistenceReadTransport.',
  );
}
